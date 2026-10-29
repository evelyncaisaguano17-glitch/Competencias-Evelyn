// servidor/rutas/certificados.js · Rutas de certificados y validación académica
import express from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = express.Router();

function generarCodigoUnico(existentes, anio) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  do {
    let aleatorio = '';
    for (let i = 0; i < 6; i++) {
      aleatorio += chars[Math.floor(Math.random() * chars.length)];
    }
    codigo = `EE-${anio}-${aleatorio}`;
  } while (existentes.some(c => c && c.codigo === codigo));
  return codigo;
}

/**
 * GET /api/certificados/verificar/:codigo (sin sesión requerida)
 */
router.get('/certificados/verificar/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo || typeof codigo !== 'string') {
      return res.json({ valido: false });
    }

    const certificados = await almacen.leer('certificados').catch(() => []);
    const codigoNormalizado = codigo.trim().toUpperCase();

    const cert = certificados.find(c => c && c.codigo && c.codigo.toUpperCase() === codigoNormalizado);
    if (!cert) {
      return res.json({ valido: false });
    }

    res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto || 'Estudiante',
      detalle: cert.detalle || 'Certificado académico',
      fecha: cert.fecha
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar certificado' });
  }
});

/**
 * GET /api/certificados/estado
 * Evalúa las condiciones para el certificado de cumplimiento según reglas-gamificacion.json.
 */
router.get('/certificados/estado', exigirRol('sesion'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const reglas = await almacen.leerConfig('reglas-gamificacion').catch(() => ({}));
    const cfg = (reglas && reglas.certificado) || {
      nivelQuizRequerido: 5,
      temasConNivelRequerido: 1,
      puntosMinimos: 400,
      temasRevisadosPct: 80
    };

    // 1. Resolver temas publicados de sus asignaturas
    let misAsignaturas = await acceso.asignaturasDe(usuario);
    if (!Array.isArray(misAsignaturas) || misAsignaturas.length === 0) {
      misAsignaturas = await almacen.leer('asignaturas');
    }
    const idsAsig = new Set(misAsignaturas.map(a => a.id));

    const unidades = await almacen.leer('unidades');
    const idsUni = new Set(unidades.filter(u => u && idsAsig.has(u.asignaturaId)).map(u => u.id));

    const temas = await almacen.leer('temas');
    const temasPublicados = temas.filter(t => t && idsUni.has(t.unidadId) && t.estado === 'publicado');
    const totalTemas = temasPublicados.length;

    // 2. Temas revisados por el usuario
    const progreso = await almacen.leer('progreso-temas');
    const misRevisados = progreso.filter(p => p && p.usuarioId === usuario.id && temasPublicados.some(t => t.id === p.temaId));
    const pctRevisados = totalTemas > 0 ? Math.round((misRevisados.length / totalTemas) * 100) : 0;

    // 3. Logros del usuario (puntos y niveles de quiz)
    const logros = await almacen.leer('logros');
    const logro = logros.find(l => l && l.usuarioId === usuario.id) || { puntos: 0, nivelQuiz: {} };
    const puntosActual = logro.puntos || 0;
    const nivelQuiz = logro.nivelQuiz || {};

    const reqNivel = cfg.nivelQuizRequerido || 5;
    const reqTemasQuiz = cfg.temasConNivelRequerido || 1;
    const temasConNivel = Object.values(nivelQuiz).filter(n => Number(n) >= reqNivel).length;
    const cumpleQuiz = temasConNivel >= reqTemasQuiz;

    const reqPuntos = cfg.puntosMinimos || 400;
    const cumplePuntos = puntosActual >= reqPuntos;

    const reqPct = cfg.temasRevisadosPct || 80;
    const cumplePct = pctRevisados >= reqPct;

    const condiciones = [
      {
        nombre: `Temas con nivel de quiz ≥ ${reqNivel}`,
        actual: temasConNivel,
        requerido: reqTemasQuiz,
        cumple: cumpleQuiz
      },
      {
        nombre: 'Puntos mínimos acumulados',
        actual: puntosActual,
        requerido: reqPuntos,
        cumple: cumplePuntos
      },
      {
        nombre: 'Porcentaje de temas revisados (%)',
        actual: pctRevisados,
        requerido: reqPct,
        cumple: cumplePct
      }
    ];

    const cumple = cumpleQuiz && cumplePuntos && cumplePct;

    res.json({ condiciones, cumple });
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 500;
    res.status(estado).json({ error: err.message || 'Error al obtener estado de certificado' });
  }
});

/**
 * POST /api/certificados
 * Crea o devuelve un certificado para el usuario autenticado.
 * Body: { tipo: "cumplimiento" | "nivel-quiz", temaId, nivel }
 */
router.post('/certificados', exigirRol('sesion'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const { tipo = 'cumplimiento', temaId, nivel } = req.body || {};

    const certificados = await almacen.leer('certificados').catch(() => []);
    const anio = new Date().getFullYear();
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Estudiante';

    let detalle = '';

    if (tipo === 'nivel-quiz') {
      const numNivel = Number(nivel);
      if (!temaId || !numNivel || numNivel < 1) {
        return res.status(400).json({ error: 'Parámetros de nivel-quiz no válidos' });
      }

      // Validar que el usuario tenga ese nivel en logros
      const logros = await almacen.leer('logros');
      const miLogro = logros.find(l => l && l.usuarioId === usuario.id) || { nivelQuiz: {} };
      const nivelAlcanzado = (miLogro.nivelQuiz && miLogro.nivelQuiz[temaId]) || 0;

      if (nivelAlcanzado < numNivel) {
        return res.status(400).json({ error: `Aún no alcanzas el nivel ${numNivel} requerido en este quiz` });
      }

      // Si ya existe un certificado igual, devolverlo
      const existente = certificados.find(c => {
        return c && c.usuarioId === usuario.id && c.tipo === 'nivel-quiz' && c.temaId === temaId && Number(c.nivel) === numNivel;
      });

      if (existente) {
        return res.json(existente);
      }

      const temas = await almacen.leer('temas');
      const tema = temas.find(t => t && t.id === temaId);
      const tituloTema = tema?.titulo || 'Cirugía y Heridas';
      detalle = `Por haber alcanzado con excelencia el Nivel ${numNivel} en el Quiz del tema: ${tituloTema}`;

      const codigo = generarCodigoUnico(certificados, anio);
      const nuevo = {
        codigo,
        usuarioId: usuario.id,
        tipo: 'nivel-quiz',
        temaId,
        nivel: numNivel,
        detalle,
        nombreCompleto
      };

      const creado = await almacen.agregar('certificados', nuevo);
      return res.status(201).json(creado);
    }

    if (tipo === 'cumplimiento') {
      // Validar cumplimiento
      const reglas = await almacen.leerConfig('reglas-gamificacion').catch(() => ({}));
      const cfg = (reglas && reglas.certificado) || {
        nivelQuizRequerido: 5,
        temasConNivelRequerido: 1,
        puntosMinimos: 400,
        temasRevisadosPct: 80
      };

      let misAsignaturas = await acceso.asignaturasDe(usuario);
      if (!Array.isArray(misAsignaturas) || misAsignaturas.length === 0) {
        misAsignaturas = await almacen.leer('asignaturas');
      }
      const idsAsig = new Set(misAsignaturas.map(a => a.id));
      const unidades = await almacen.leer('unidades');
      const idsUni = new Set(unidades.filter(u => u && idsAsig.has(u.asignaturaId)).map(u => u.id));
      const temas = await almacen.leer('temas');
      const temasPublicados = temas.filter(t => t && idsUni.has(t.unidadId) && t.estado === 'publicado');
      const totalTemas = temasPublicados.length;

      const progreso = await almacen.leer('progreso-temas');
      const misRevisados = progreso.filter(p => p && p.usuarioId === usuario.id && temasPublicados.some(t => t.id === p.temaId));
      const pctRevisados = totalTemas > 0 ? Math.round((misRevisados.length / totalTemas) * 100) : 0;

      const logros = await almacen.leer('logros');
      const miLogro = logros.find(l => l && l.usuarioId === usuario.id) || { puntos: 0, nivelQuiz: {} };
      const puntosActual = miLogro.puntos || 0;
      const nivelQuiz = miLogro.nivelQuiz || {};

      const reqNivel = cfg.nivelQuizRequerido || 5;
      const reqTemasQuiz = cfg.temasConNivelRequerido || 1;
      const temasConNivel = Object.values(nivelQuiz).filter(n => Number(n) >= reqNivel).length;

      const cumple = temasConNivel >= reqTemasQuiz &&
                     puntosActual >= (cfg.puntosMinimos || 400) &&
                     pctRevisados >= (cfg.temasRevisadosPct || 80);

      if (!cumple) {
        return res.status(400).json({ error: 'No cumples con todas las condiciones para el certificado de cumplimiento' });
      }

      // Si ya existe un certificado de cumplimiento, devolverlo
      const existente = certificados.find(c => c && c.usuarioId === usuario.id && c.tipo === 'cumplimiento');
      if (existente) {
        return res.json(existente);
      }

      detalle = 'Por haber completado satisfactoriamente los requisitos formativos del programa de Cirugía y manejo de heridas';
      const codigo = generarCodigoUnico(certificados, anio);
      const nuevo = {
        codigo,
        usuarioId: usuario.id,
        tipo: 'cumplimiento',
        detalle,
        nombreCompleto
      };

      const creado = await almacen.agregar('certificados', nuevo);
      return res.status(201).json(creado);
    }

    res.status(400).json({ error: 'Tipo de certificado no soportado' });
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 500;
    res.status(estado).json({ error: err.message || 'Error al emitir certificado' });
  }
});

export default router;
