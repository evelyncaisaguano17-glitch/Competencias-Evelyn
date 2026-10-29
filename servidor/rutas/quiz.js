// servidor/rutas/quiz.js · Motor del quiz formativo por niveles
import express from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';
import { procesarIntento } from '../gamificacion.js';

const router = express.Router();

const NOMBRES_NIVELES = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

/**
 * Normaliza texto a mayúsculas, sin tildes ni diéresis, conservando la Ñ.
 */
function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  const recortado = String(texto).trim().toUpperCase();
  const conMarcador = recortado.replace(/Ñ/g, '\uE000');
  const sinTildes = conMarcador.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return sinTildes.replace(/\uE000/g, 'Ñ');
}

/**
 * Baraja un arreglo usando Fisher-Yates sin mutar el original.
 */
function barajar(arr) {
  if (!Array.isArray(arr)) return [];
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Middleware para verificar que el usuario sea estudiante y tenga sesión activa.
 */
function exigirEstudiante(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Sesión no iniciada' });
  }
  if (req.usuario.rol !== 'estudiante') {
    return res.status(403).json({ error: 'Solo los estudiantes pueden acceder al motor de quiz' });
  }
  next();
}

/**
 * Verifica si el estudiante tiene acceso al tema solicitado.
 */
async function verificarAccesoTema(usuario, temaId) {
  if (!temaId) {
    const err = new Error('temaId es obligatorio');
    err.estado = 400;
    throw err;
  }
  const asignaturaId = await acceso.asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const err = new Error('Tema no encontrado');
    err.estado = 404;
    throw err;
  }
  const asignaturas = await acceso.asignaturasDe(usuario);
  const tieneAcceso = asignaturas.some(a => a && a.id === asignaturaId);
  if (!tieneAcceso) {
    const err = new Error('No tienes acceso a este tema');
    err.estado = 403;
    throw err;
  }
  return asignaturaId;
}

/**
 * 1. GET /api/quiz/estado?temaId=
 * Consulta el estado de los niveles (1 a 5) y el mejor porcentaje para un tema.
 */
router.get('/quiz/estado', exigirEstudiante, async (req, res) => {
  try {
    const { temaId } = req.query;
    await verificarAccesoTema(req.usuario, temaId);

    // Obtener nivel aprobado más alto en logros
    const logros = await almacen.leer('logros');
    const miLogro = logros.find(l => l && l.usuarioId === req.usuario.id) || { nivelQuiz: {} };
    const nivelQuiz = miLogro.nivelQuiz || {};
    const nivelAprobadoMax = Number(nivelQuiz[temaId] || 0);

    // Obtener historial de intentos del estudiante en este tema
    const intentos = await almacen.leer('intentos');
    const intentosQuiz = intentos.filter(i =>
      i &&
      i.usuarioId === req.usuario.id &&
      i.actividad === 'quiz' &&
      i.temaId === temaId
    );

    const niveles = [];
    for (let n = 1; n <= 5; n++) {
      let estado = 'bloqueado';
      if (n <= nivelAprobadoMax) {
        estado = 'aprobado';
      } else if (n === 1 || n === nivelAprobadoMax + 1) {
        estado = 'disponible';
      }

      // Mejor porcentaje obtenido en este nivel
      const intentosNivel = intentosQuiz.filter(i => Number(i.nivel) === n && i.maximo > 0);
      const porcentajes = intentosNivel.map(i => Math.round((i.puntaje / i.maximo) * 100));
      const mejorPorcentaje = porcentajes.length > 0 ? Math.max(...porcentajes) : 0;

      niveles.push({
        nivel: n,
        nombre: NOMBRES_NIVELES[n] || `Nivel ${n}`,
        estado,
        mejorPorcentaje
      });
    }

    return res.json({ niveles });
  } catch (err) {
    const estado = err.estado || 500;
    return res.status(estado).json({ error: err.message || 'Error al obtener estado del quiz' });
  }
});

/**
 * 2. POST /api/quiz/iniciar
 * Inicia una sesión de quiz para un tema y nivel disponible.
 */
router.post('/quiz/iniciar', exigirEstudiante, async (req, res) => {
  try {
    const { temaId, nivel } = req.body || {};
    const nivelNum = Number(nivel);

    if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
      return res.status(400).json({ error: 'Nivel no válido (debe ser del 1 al 5)' });
    }

    const asignaturaId = await verificarAccesoTema(req.usuario, temaId);

    // Verificar disponibilidad del nivel
    const logros = await almacen.leer('logros');
    const miLogro = logros.find(l => l && l.usuarioId === req.usuario.id) || { nivelQuiz: {} };
    const nivelAprobadoMax = Number((miLogro.nivelQuiz && miLogro.nivelQuiz[temaId]) || 0);

    if (nivelNum > 1 && nivelNum > nivelAprobadoMax + 1) {
      return res.status(400).json({ error: 'El nivel solicitado se encuentra bloqueado' });
    }

    // Cantidad requerida de preguntas
    const reglas = await almacen.leerConfig('reglas-gamificacion').catch(() => ({}));
    const preguntasPorNivel = reglas.quiz?.preguntasPorNivel || 10;

    // Preguntas aprobadas del tema y nivel
    const preguntas = await almacen.leer('preguntas');
    const preguntasAprobadas = preguntas.filter(p =>
      p &&
      p.temaId === temaId &&
      Number(p.nivel) === nivelNum &&
      p.estado === 'aprobado'
    );

    if (preguntasAprobadas.length === 0) {
      return res.status(400).json({ error: 'No hay preguntas aprobadas disponibles para este nivel' });
    }

    // Historial de preguntas ya vistas por el estudiante
    const sesiones = await almacen.leer('quiz-sesiones');
    const misSesiones = sesiones.filter(s =>
      s &&
      s.usuarioId === req.usuario.id &&
      s.temaId === temaId &&
      Number(s.nivel) === nivelNum
    );

    const mapaVistas = new Map();
    for (const s of misSesiones) {
      const fecha = s.inicio || s.fecha || '2000-01-01T00:00:00.000Z';
      for (const pid of (s.preguntasIds || [])) {
        const previa = mapaVistas.get(pid);
        if (!previa || new Date(fecha) > new Date(previa)) {
          mapaVistas.set(pid, fecha);
        }
      }
    }

    const noVistas = preguntasAprobadas.filter(p => !mapaVistas.has(p.id));
    const vistas = preguntasAprobadas.filter(p => mapaVistas.has(p.id));

    let seleccion = barajar(noVistas).slice(0, preguntasPorNivel);
    const faltan = preguntasPorNivel - seleccion.length;
    let completoConVistas = false;

    if (faltan > 0 && vistas.length > 0) {
      completoConVistas = true;
      // Ordenar por fecha vista: de más antigua a más reciente
      vistas.sort((a, b) => new Date(mapaVistas.get(a.id)) - new Date(mapaVistas.get(b.id)));
      seleccion.push(...vistas.slice(0, faltan));
    }

    // Barajar la selección final
    seleccion = barajar(seleccion);

    // Si no alcanzaron las no vistas, notificar al docente del grupo (máx 1 vez al día por tema y nivel)
    if (completoConVistas) {
      try {
        const grupos = await acceso.gruposDe(req.usuario);
        const grupo = grupos.find(g => g && g.asignaturaId === asignaturaId);
        const docenteId = grupo?.docenteId;

        if (docenteId) {
          const notificaciones = await almacen.leer('notificaciones').catch(() => []);
          const hoy = new Date().toISOString().slice(0, 10);
          const yaNotificado = notificaciones.some(n =>
            n &&
            n.usuarioId === docenteId &&
            n.tipo === 'quiz-escasez' &&
            typeof n.fecha === 'string' &&
            n.fecha.startsWith(hoy) &&
            n.enlace?.includes(`temaId=${temaId}`) &&
            n.mensaje?.includes(`nivel ${nivelNum}`)
          );

          if (!yaNotificado) {
            await notificar(docenteId, {
              tipo: 'quiz-escasez',
              mensaje: `El banco de preguntas para el tema y nivel ${nivelNum} requiere más preguntas aprobadas para evitar repeticiones.`,
              enlace: `/paginas/banco-preguntas.html?temaId=${temaId}`
            });
          }
        }
      } catch (errNotif) {
        console.error('Error al notificar al docente sobre banco de preguntas escaso:', errNotif);
      }
    }

    // Crear quiz-sesión
    const nuevaSesion = await almacen.agregar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId,
      nivel: nivelNum,
      preguntasIds: seleccion.map(p => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    });

    // Devolver sesión y preguntas SIN respuestas ni retroalimentación
    return res.json({
      sesionId: nuevaSesion.id,
      preguntas: seleccion.map(p => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: p.opciones
      }))
    });
  } catch (err) {
    const estado = err.estado || 500;
    return res.status(estado).json({ error: err.message || 'Error al iniciar quiz' });
  }
});

/**
 * 3. POST /api/quiz/responder
 * Registra la respuesta para una pregunta de la sesión activa y devuelve retroalimentación.
 */
router.post('/quiz/responder', exigirEstudiante, async (req, res) => {
  try {
    const { sesionId, preguntaId, respuesta } = req.body || {};

    if (!sesionId || !preguntaId || respuesta === undefined || respuesta === null) {
      return res.status(400).json({ error: 'sesionId, preguntaId y respuesta son requeridos' });
    }

    const sesiones = await almacen.leer('quiz-sesiones');
    const sesion = sesiones.find(s => s && s.id === sesionId && s.usuarioId === req.usuario.id);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'Esta sesión de quiz ya ha sido finalizada' });
    }

    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      return res.status(400).json({ error: 'La pregunta no pertenece a esta sesión' });
    }

    const respuestas = sesion.respuestas || {};
    if (respuestas[preguntaId] !== undefined) {
      return res.status(400).json({ error: 'Esta pregunta ya ha sido respondida' });
    }

    // Buscar pregunta en banco de preguntas
    const preguntas = await almacen.leer('preguntas');
    const pregunta = preguntas.find(p => p && p.id === preguntaId);

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    let correcto = false;
    let correctaTexto = '';

    if (pregunta.tipo === 'opcion') {
      const idxCorrecta = Number(pregunta.correcta);
      const idxResp = Number(respuesta);
      correcto = !isNaN(idxCorrecta) && !isNaN(idxResp) && idxResp === idxCorrecta;
      correctaTexto = Array.isArray(pregunta.opciones) && pregunta.opciones[idxCorrecta] !== undefined
        ? String(pregunta.opciones[idxCorrecta])
        : String(pregunta.correcta);
    } else if (pregunta.tipo === 'vf') {
      const esVerdadero = (v) => v === true || String(v).trim().toLowerCase() === 'true' || String(v).trim().toLowerCase() === 'verdadero';
      const esFalso = (v) => v === false || String(v).trim().toLowerCase() === 'false' || String(v).trim().toLowerCase() === 'falso';

      const respPreguntaVerdadera = esVerdadero(pregunta.correcta);
      correcto = respPreguntaVerdadera ? esVerdadero(respuesta) : esFalso(respuesta);
      correctaTexto = respPreguntaVerdadera ? 'Verdadero' : 'Falso';
    } else if (pregunta.tipo === 'completar') {
      const respNorm = normalizar(respuesta);
      const correctaNorm = normalizar(pregunta.correcta);
      correcto = respNorm === correctaNorm && correctaNorm !== '';
      correctaTexto = String(pregunta.correcta || '');
    } else {
      correcto = String(respuesta).trim() === String(pregunta.correcta).trim();
      correctaTexto = String(pregunta.correcta || '');
    }

    // Guardar respuesta en la sesión
    respuestas[preguntaId] = {
      respuesta,
      correcto,
      fecha: new Date().toISOString()
    };

    await almacen.actualizar('quiz-sesiones', sesion.id, { respuestas });

    return res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || '',
      correcta: correctaTexto
    });
  } catch (err) {
    const estado = err.estado || 500;
    return res.status(estado).json({ error: err.message || 'Error al responder pregunta' });
  }
});

/**
 * 4. POST /api/quiz/finalizar
 * Concluye la sesión, actualiza nivel alcanzado, registra el intento y devuelve resultados.
 */
router.post('/quiz/finalizar', exigirEstudiante, async (req, res) => {
  try {
    const { sesionId } = req.body || {};
    if (!sesionId) {
      return res.status(400).json({ error: 'sesionId es obligatorio' });
    }

    const sesiones = await almacen.leer('quiz-sesiones');
    const sesion = sesiones.find(s => s && s.id === sesionId && s.usuarioId === req.usuario.id);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'La sesión de quiz ya fue finalizada' });
    }

    const preguntasIds = sesion.preguntasIds || [];
    const total = preguntasIds.length;
    if (total === 0) {
      return res.status(400).json({ error: 'La sesión no tiene preguntas válidas' });
    }

    const respuestas = sesion.respuestas || {};
    let aciertos = 0;
    const falladasIds = [];

    for (const pid of preguntasIds) {
      const r = respuestas[pid];
      if (r && r.correcto) {
        aciertos++;
      } else {
        falladasIds.push(pid);
      }
    }

    const errores = total - aciertos;
    const porcentaje = Math.round((aciertos / total) * 100);

    // Obtener porcentaje de aprobación de las reglas
    const reglas = await almacen.leerConfig('reglas-gamificacion').catch(() => ({}));
    const porcentajeAprobacion = reglas.quiz?.porcentajeAprobacion ?? 70;
    const aprobado = porcentaje >= porcentajeAprobacion;

    // Si aprueba, primero actualiza logros.nivelQuiz[temaId] al máximo
    if (aprobado) {
      const logros = await almacen.leer('logros');
      let logro = logros.find(l => l && l.usuarioId === req.usuario.id);
      if (!logro) {
        logro = await almacen.agregar('logros', {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz: {}
        });
      }
      if (!logro.nivelQuiz) {
        logro.nivelQuiz = {};
      }
      const prev = Number(logro.nivelQuiz[sesion.temaId] || 0);
      const nuevoNivel = Math.max(prev, Number(sesion.nivel));
      logro.nivelQuiz[sesion.temaId] = nuevoNivel;
      await almacen.actualizar('logros', logro.id, { nivelQuiz: logro.nivelQuiz });
    }

    // Calcular duración de la sesión
    const inicioMs = sesion.inicio ? new Date(sesion.inicio).getTime() : Date.now();
    const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));

    // En todos los casos llamar a procesarIntento
    const resultadoGamif = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: { aprobado }
    });

    // Marcar sesión como finalizada
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fin: new Date().toISOString(),
      aciertos,
      total,
      porcentaje,
      aprobado
    });

    // Obtener retroalimentaciones de las preguntas falladas
    const preguntas = await almacen.leer('preguntas');
    const repasar = falladasIds
      .map(id => preguntas.find(p => p && p.id === id))
      .filter(p => p && p.retroalimentacion)
      .map(p => p.retroalimentacion);

    return res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: resultadoGamif?.puntosGanados || 0,
      insigniasNuevas: resultadoGamif?.insigniasNuevas || []
    });
  } catch (err) {
    const estado = err.estado || 500;
    return res.status(estado).json({ error: err.message || 'Error al finalizar quiz' });
  }
});

export default router;
