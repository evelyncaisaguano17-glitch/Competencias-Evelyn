import express from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import { evaluarInactividad } from '../alertas.js';

const router = express.Router();

/**
 * Calcula el promedio de puntajes (escala 0 a 10) con 1 decimal, sin contar "tema-revisado".
 * @param {Array} lista
 * @returns {number}
 */
export function calcularPromedio(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return 0;
  const validos = lista.filter(i =>
    i &&
    i.actividad !== 'tema-revisado' &&
    typeof i.puntaje === 'number' &&
    typeof i.maximo === 'number' &&
    i.maximo > 0
  );
  if (validos.length === 0) return 0;
  const suma = validos.reduce((acc, i) => acc + (i.puntaje / i.maximo) * 10, 0);
  return Math.round((suma / validos.length) * 10) / 10;
}

/**
 * Devuelve la semana ISO en formato YYYY-Www para una fecha dada.
 * @param {string|Date} fechaIso
 * @returns {string|null}
 */
export function obtenerSemanaISO(fechaIso) {
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  // Jueves de la semana determina el año ISO correspondiente
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const semana1 = new Date(d.getFullYear(), 0, 4);
  const numSemana = 1 + Math.round(((d.getTime() - semana1.getTime()) / 86400000 - 3 + ((semana1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(numSemana).padStart(2, '0')}`;
}

/**
 * Obtiene la fecha de la última conexión registrada en bitacora.jsonl para un usuario.
 * Prioriza eventos de tipo 'login', o en su defecto el último evento registrado.
 * @param {string} usuarioId
 * @param {Array} bitacora
 * @returns {string|null}
 */
export function obtenerUltimaConexion(usuarioId, bitacora) {
  if (!usuarioId || !Array.isArray(bitacora) || bitacora.length === 0) return null;
  let ultimoEvento = null;
  for (let idx = bitacora.length - 1; idx >= 0; idx--) {
    const reg = bitacora[idx];
    if (reg && reg.usuarioId === usuarioId) {
      if (reg.tipo === 'login') {
        return reg.fecha || null;
      }
      if (!ultimoEvento) {
        ultimoEvento = reg.fecha || null;
      }
    }
  }
  return ultimoEvento;
}

/**
 * GET /api/resumen/estudiante/:id
 * Resumen de progreso de un estudiante ("yo" permitido).
 * Acceso: el propio estudiante, un docente de sus grupos o el admin.
 */
router.get('/resumen/estudiante/:id', exigirRol('sesion'), async (req, res) => {
  try {
    const usuarioActual = req.usuario;
    const paramId = req.params.id;
    const estudianteId = paramId === 'yo' ? usuarioActual.id : paramId;

    // Lectura de cada colección y bitacora.jsonl UNA SOLA VEZ por petición
    const [
      usuarios,
      distributivo,
      asignaturas,
      unidades,
      temas,
      progresoTemas,
      logros,
      intentos,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios').catch(() => []),
      almacen.leer('distributivo').catch(() => []),
      almacen.leer('asignaturas').catch(() => []),
      almacen.leer('unidades').catch(() => []),
      almacen.leer('temas').catch(() => []),
      almacen.leer('progreso-temas').catch(() => []),
      almacen.leer('logros').catch(() => []),
      almacen.leer('intentos').catch(() => []),
      almacen.leerLineas('bitacora.jsonl').catch(() => [])
    ]);

    // Verificar existencia del estudiante
    const usuarioEstudiante = usuarios.find(u => u && u.id === estudianteId);
    if (!usuarioEstudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Control de acceso: el propio estudiante, docente de sus grupos o admin
    const esPropio = usuarioActual.id === estudianteId;
    const esAdmin = usuarioActual.rol === 'admin';
    const gruposDocente = distributivo.filter(g => g && g.docenteId === usuarioActual.id);
    const esDocenteDelEstudiante = gruposDocente.some(g =>
      Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
    );

    if (!esPropio && !esAdmin && !esDocenteDelEstudiante) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    // 1. Puntos y nivel quiz máximo
    const logro = logros.find(l => l && l.usuarioId === estudianteId) || {};
    const puntos = typeof logro.puntos === 'number' ? logro.puntos : 0;
    const nivelesQuiz = Object.values(logro.nivelQuiz || {}).map(Number).filter(n => !isNaN(n));
    const nivelQuizMax = nivelesQuiz.length > 0 ? Math.max(...nivelesQuiz) : 0;

    // 2. Asignaturas y temas publicados del estudiante
    const gruposEstudiante = distributivo.filter(g =>
      g && Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
    );
    let asigIds = new Set(gruposEstudiante.map(g => g.asignaturaId).filter(Boolean));
    if (asigIds.size === 0) {
      asigIds = new Set(asignaturas.map(a => a.id));
    }

    const unidadesAsig = unidades.filter(u => u && (asigIds.size === 0 || asigIds.has(u.asignaturaId)));
    const unidadesIds = new Set(unidadesAsig.map(u => u.id));
    const temasPublicados = temas.filter(t => t && t.estado === 'publicado' && (unidadesIds.size === 0 || unidadesIds.has(t.unidadId)));

    const revisadosIds = new Set(
      progresoTemas.filter(p => p && p.usuarioId === estudianteId).map(p => p.temaId)
    );
    const temasRevisados = temasPublicados.filter(t => revisadosIds.has(t.id));
    const pctTemas = temasPublicados.length > 0
      ? Math.round((temasRevisados.length / temasPublicados.length) * 100)
      : 0;

    // 3. Intentos del estudiante y promedio general
    const misIntentos = intentos.filter(i => i && i.usuarioId === estudianteId);
    const promedio = calcularPromedio(misIntentos);

    // 4. Desglose por actividad
    const actMap = new Map();
    for (const i of misIntentos) {
      if (!i || !i.actividad || i.actividad === 'tema-revisado') continue;
      if (!actMap.has(i.actividad)) actMap.set(i.actividad, []);
      actMap.get(i.actividad).push(i);
    }
    const porActividad = Array.from(actMap.entries()).map(([actividad, lista]) => ({
      actividad,
      promedio: calcularPromedio(lista),
      intentos: lista.length
    }));

    // 5. Desglose por tema
    const temasMap = new Map();
    for (const t of temasPublicados) {
      temasMap.set(t.id, t.titulo || t.id);
    }
    for (const i of misIntentos) {
      if (i && i.temaId && !temasMap.has(i.temaId) && i.actividad !== 'tema-revisado') {
        const t = temas.find(tema => tema && tema.id === i.temaId);
        temasMap.set(i.temaId, t ? t.titulo : i.temaId);
      }
    }
    const porTema = Array.from(temasMap.entries()).map(([temaId, titulo]) => {
      const intentosTema = misIntentos.filter(i => i && i.temaId === temaId && i.actividad !== 'tema-revisado');
      return {
        temaId,
        titulo,
        promedio: calcularPromedio(intentosTema),
        intentos: intentosTema.length
      };
    });

    // 6. Evolución temporal (últimas 8 semanas con datos)
    const intentosValidos = misIntentos.filter(i =>
      i &&
      i.actividad !== 'tema-revisado' &&
      typeof i.puntaje === 'number' &&
      typeof i.maximo === 'number' &&
      i.maximo > 0 &&
      i.fecha
    );

    const semanasMap = new Map();
    for (const i of intentosValidos) {
      const sem = obtenerSemanaISO(i.fecha);
      if (!sem) continue;
      if (!semanasMap.has(sem)) semanasMap.set(sem, []);
      semanasMap.get(sem).push(i);
    }

    const semanasOrdenadas = Array.from(semanasMap.keys()).sort();
    const ultimas8Semanas = semanasOrdenadas.slice(-8);
    const evolucion = ultimas8Semanas.map(semana => ({
      semana,
      promedio: calcularPromedio(semanasMap.get(semana))
    }));

    // 7. Temas pendientes (temas publicados sin revisar)
    const pendientes = temasPublicados
      .filter(t => !revisadosIds.has(t.id))
      .map(t => ({ temaId: t.id, titulo: t.titulo }));

    // 8. Última conexión, tiempo total en minutos y últimos 20 intentos
    const ultimaConexion = obtenerUltimaConexion(estudianteId, bitacora);
    const totalSeg = misIntentos.reduce((acc, i) => acc + (typeof i.duracionSeg === 'number' ? i.duracionSeg : 0), 0);
    const tiempoMin = Math.round(totalSeg / 60);

    const ultimosIntentos = [...misIntentos]
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
      .slice(0, 20);

    res.json({
      puntos,
      nivelQuizMax,
      pctTemas,
      promedio,
      porActividad,
      porTema,
      evolucion,
      pendientes,
      ultimaConexion,
      tiempoMin,
      ultimosIntentos
    });
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 500;
    res.status(estado).json({ error: err.message || 'Error al obtener resumen de estudiante' });
  }
});

/**
 * GET /api/resumen/grupo/:grupoId
 * Resumen de progreso grupal para docentes del grupo o administradores.
 */
router.get('/resumen/grupo/:grupoId', exigirRol('sesion'), async (req, res) => {
  try {
    const usuarioActual = req.usuario;
    const { grupoId } = req.params;
    await evaluarInactividad(grupoId).catch(() => {});

    // Lectura de cada colección y bitacora.jsonl UNA SOLA VEZ por petición
    const [
      distributivo,
      usuarios,
      unidades,
      temas,
      progresoTemas,
      intentos,
      alertas,
      bitacora
    ] = await Promise.all([
      almacen.leer('distributivo').catch(() => []),
      almacen.leer('usuarios').catch(() => []),
      almacen.leer('unidades').catch(() => []),
      almacen.leer('temas').catch(() => []),
      almacen.leer('progreso-temas').catch(() => []),
      almacen.leer('intentos').catch(() => []),
      almacen.leer('alertas').catch(() => []),
      almacen.leerLineas('bitacora.jsonl').catch(() => [])
    ]);

    const grupo = distributivo.find(g => g && g.id === grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // Control de acceso: docente del grupo o admin
    const esAdmin = usuarioActual.rol === 'admin';
    const esDocenteGrupo = usuarioActual.rol === 'docente' && grupo.docenteId === usuarioActual.id;

    if (!esAdmin && !esDocenteGrupo) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    // Temas publicados de la asignatura del grupo
    const unidadesGrupo = unidades.filter(u => u && u.asignaturaId === grupo.asignaturaId);
    const idsUnidadesGrupo = new Set(unidadesGrupo.map(u => u.id));
    const temasGrupo = temas.filter(t => t && t.estado === 'publicado' && idsUnidadesGrupo.has(t.unidadId));

    // Estudiantes del grupo
    const idsEstudiantes = Array.isArray(grupo.estudiantes) ? grupo.estudiantes : [];
    const estudiantes = idsEstudiantes.map(eId => {
      const u = usuarios.find(user => user && user.id === eId) || { id: eId, nombre: 'Estudiante', apellido: '' };
      const intentosEst = intentos.filter(i => i && i.usuarioId === eId);
      const actividades = intentosEst.filter(i => i && i.actividad !== 'tema-revisado').length;
      const promedio = calcularPromedio(intentosEst);

      const revEst = new Set(progresoTemas.filter(p => p && p.usuarioId === eId).map(p => p.temaId));
      const pctTemas = temasGrupo.length > 0
        ? Math.round((temasGrupo.filter(t => revEst.has(t.id)).length / temasGrupo.length) * 100)
        : 0;

      const ultimaConexion = obtenerUltimaConexion(eId, bitacora);
      const alertasActivas = alertas.filter(a => a && a.estudianteId === eId && a.estado === 'activa').length;

      return {
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        promedio,
        actividades,
        pctTemas,
        ultimaConexion,
        alertasActivas
      };
    });

    // Desglose por tema en el grupo
    const temasMap = new Map();
    for (const t of temasGrupo) {
      temasMap.set(t.id, t.titulo || t.id);
    }
    // Incluir otros temas si hubo intentos por estudiantes del grupo
    for (const i of intentos) {
      if (i && i.temaId && idsEstudiantes.includes(i.usuarioId) && !temasMap.has(i.temaId) && i.actividad !== 'tema-revisado') {
        const t = temas.find(tema => tema && tema.id === i.temaId);
        temasMap.set(i.temaId, t ? t.titulo : i.temaId);
      }
    }

    const porTema = Array.from(temasMap.entries()).map(([temaId, titulo]) => {
      const intentosTema = intentos.filter(i =>
        i &&
        i.temaId === temaId &&
        idsEstudiantes.includes(i.usuarioId) &&
        i.actividad !== 'tema-revisado'
      );
      return {
        temaId,
        titulo,
        promedio: calcularPromedio(intentosTema),
        intentos: intentosTema.length
      };
    });

    res.json({
      grupo,
      estudiantes,
      porTema
    });
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 500;
    res.status(estado).json({ error: err.message || 'Error al obtener resumen de grupo' });
  }
});

export default router;
