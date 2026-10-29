// servidor/alertas.js · Detección de riesgo académico y mensajes de apoyo
import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { notificar } from './notificar.js';

/**
 * Notifica al docente responsable y opcionalmente a los administradores
 * en tono de apoyo cuando se genera una nueva alerta.
 */
async function notificarDocenteYAdmin(docenteId, estudianteId, regla, detalle, grupoId, temaId) {
  try {
    const usuarios = await almacen.leer('usuarios');
    const est = usuarios.find((u) => u && u.id === estudianteId);
    const nombreEst = est ? `${est.nombre || ''} ${est.apellido || ''}`.trim() : 'Un estudiante';

    let mensaje = '';
    if (regla === 'promedioBajo') {
      mensaje = `Alerta de apoyo: ${nombreEst} presenta un promedio bajo en sus actividades recientes. Te sugerimos revisar su progreso.`;
    } else if (regla === 'fallosQuiz') {
      mensaje = `Alerta de apoyo: ${nombreEst} ha tenido dificultades consecutivas en el quiz. Te sugerimos brindarle acompañamiento.`;
    } else if (regla === 'inactividad') {
      mensaje = `Alerta de seguimiento: ${nombreEst} no registra actividad reciente en la plataforma. Te sugerimos contactarle.`;
    } else {
      mensaje = `Alerta de seguimiento: ${nombreEst} requiere apoyo. ${detalle}`;
    }

    const enlace = `/paginas/panel-docente.html?grupoId=${grupoId || ''}`;

    if (docenteId) {
      await notificar(docenteId, {
        tipo: 'alerta',
        mensaje,
        enlace
      });
    }

    const ajustes = await almacen.leerConfig('ajustes');
    if (ajustes?.alertasAdmin) {
      const admins = usuarios.filter((u) => u && u.rol === 'admin' && u.activo !== false);
      for (const adm of admins) {
        if (adm.id !== docenteId) {
          await notificar(adm.id, {
            tipo: 'alerta',
            mensaje,
            enlace
          });
        }
      }
    }
  } catch (err) {
    console.error('Error al notificar alerta:', err);
  }
}

/**
 * Evalúa reglas de alerta sobre un nuevo intento:
 * - "promedioBajo": promedio de los últimos N intentos < umbral (sin "tema-revisado").
 * - "fallosQuiz": N intentos de quiz seguidos no aprobados en el mismo tema y nivel.
 * @param {Object} intento
 * @param {Object} usuario
 * @returns {Promise<Array>} Alertas generadas
 */
export async function evaluarAlertas(intento, usuario) {
  const estudianteId = usuario?.id || intento?.usuarioId;
  if (!estudianteId) return [];

  const generadas = [];

  try {
    const distributivo = await almacen.leer('distributivo');
    let grupo = null;

    if (intento?.temaId) {
      const asignaturaId = await acceso.asignaturaDeTema(intento.temaId);
      if (asignaturaId) {
        grupo = distributivo.find(
          (g) =>
            g &&
            g.asignaturaId === asignaturaId &&
            Array.isArray(g.estudiantes) &&
            g.estudiantes.includes(estudianteId)
        );
      }
    }

    if (!grupo) {
      grupo = distributivo.find(
        (g) => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
      );
    }

    const grupoId = grupo?.id || null;
    const docenteId = grupo?.docenteId || null;

    const reglas = await almacen.leerConfig('reglas-alertas');

    // 1. Regla promedioBajo
    if (reglas?.promedioBajo?.activa) {
      const umbral = typeof reglas.promedioBajo.umbral === 'number' ? reglas.promedioBajo.umbral : 7;
      const ultimosN = typeof reglas.promedioBajo.ultimos === 'number' ? reglas.promedioBajo.ultimos : 3;

      const intentos = await almacen.leer('intentos');
      const delEstudiante = intentos.filter(
        (i) =>
          i &&
          i.usuarioId === estudianteId &&
          i.actividad !== 'tema-revisado' &&
          typeof i.puntaje === 'number' &&
          typeof i.maximo === 'number' &&
          i.maximo > 0
      );

      delEstudiante.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

      if (delEstudiante.length >= ultimosN) {
        const muestra = delEstudiante.slice(0, ultimosN);
        const suma = muestra.reduce((acc, i) => acc + (i.puntaje / i.maximo) * 10, 0);
        const promedio = Math.round((suma / muestra.length) * 10) / 10;

        if (promedio < umbral) {
          const alertas = await almacen.leer('alertas');
          const yaExiste = alertas.some(
            (a) =>
              a &&
              a.estudianteId === estudianteId &&
              a.regla === 'promedioBajo' &&
              a.estado === 'activa'
          );

          if (!yaExiste) {
            const detalle = `Promedio de ${promedio}/10 en los últimos ${ultimosN} intentos (umbral: ${umbral}).`;
            const nueva = await almacen.agregar('alertas', {
              estudianteId,
              docenteId,
              grupoId,
              regla: 'promedioBajo',
              temaId: intento?.temaId || null,
              detalle,
              estado: 'activa'
            });
            await notificarDocenteYAdmin(docenteId, estudianteId, 'promedioBajo', detalle, grupoId, intento?.temaId);
            generadas.push(nueva);
          }
        }
      }
    }

    // 2. Regla fallosQuiz
    if (reglas?.fallosQuiz?.activa && intento?.actividad === 'quiz' && intento?.temaId) {
      const veces = typeof reglas.fallosQuiz.veces === 'number' ? reglas.fallosQuiz.veces : 3;
      const nivel = intento.nivel || 1;

      const intentos = await almacen.leer('intentos');
      const deQuiz = intentos.filter(
        (i) =>
          i &&
          i.usuarioId === estudianteId &&
          i.actividad === 'quiz' &&
          i.temaId === intento.temaId &&
          (i.nivel || 1) === nivel
      );

      deQuiz.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

      if (deQuiz.length >= veces) {
        const muestraQuiz = deQuiz.slice(0, veces);
        const esNoAprobado = (it) =>
          it.detalle?.aprobado !== true && (!it.maximo || (it.puntaje / it.maximo) < 0.7);

        const todosFallados = muestraQuiz.every(esNoAprobado);
        if (todosFallados) {
          const alertas = await almacen.leer('alertas');
          const yaExiste = alertas.some(
            (a) =>
              a &&
              a.estudianteId === estudianteId &&
              a.regla === 'fallosQuiz' &&
              a.temaId === intento.temaId &&
              a.estado === 'activa'
          );

          if (!yaExiste) {
            const detalle = `${veces} intentos seguidos no aprobados en el quiz del tema (nivel ${nivel}).`;
            const nueva = await almacen.agregar('alertas', {
              estudianteId,
              docenteId,
              grupoId,
              regla: 'fallosQuiz',
              temaId: intento.temaId,
              detalle,
              estado: 'activa'
            });
            await notificarDocenteYAdmin(docenteId, estudianteId, 'fallosQuiz', detalle, grupoId, intento.temaId);
            generadas.push(nueva);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error al evaluar alertas:', err);
  }

  return generadas;
}

/**
 * Evalúa inactividad en un grupo:
 * Genera alerta "inactividad" si un estudiante no tiene eventos en bitacora en X días.
 * Se llama desde GET /api/resumen/grupo/:grupoId antes de calcular.
 * @param {string} grupoId
 * @returns {Promise<Array>} Alertas generadas
 */
export async function evaluarInactividad(grupoId) {
  if (!grupoId) return [];
  const generadas = [];

  try {
    const reglas = await almacen.leerConfig('reglas-alertas');
    if (!reglas?.inactividad?.activa) return [];

    const diasUmbral = typeof reglas.inactividad.dias === 'number' ? reglas.inactividad.dias : 7;
    const msUmbral = diasUmbral * 24 * 60 * 60 * 1000;
    const ahora = Date.now();

    const distributivo = await almacen.leer('distributivo');
    const grupo = distributivo.find((g) => g && g.id === grupoId);
    if (!grupo || !Array.isArray(grupo.estudiantes) || grupo.estudiantes.length === 0) {
      return [];
    }

    const [bitacora, usuarios, alertas] = await Promise.all([
      almacen.leerLineas('bitacora.jsonl').catch(() => []),
      almacen.leer('usuarios').catch(() => []),
      almacen.leer('alertas').catch(() => [])
    ]);

    for (const estudianteId of grupo.estudiantes) {
      const eventosEst = bitacora.filter((b) => b && b.usuarioId === estudianteId);
      let ultimaFechaMs = null;

      if (eventosEst.length > 0) {
        for (const ev of eventosEst) {
          const t = new Date(ev.fecha || 0).getTime();
          if (!isNaN(t) && (!ultimaFechaMs || t > ultimaFechaMs)) {
            ultimaFechaMs = t;
          }
        }
      } else {
        const u = usuarios.find((usr) => usr && usr.id === estudianteId);
        if (u?.fecha) {
          const t = new Date(u.fecha).getTime();
          if (!isNaN(t)) ultimaFechaMs = t;
        }
      }

      if (ultimaFechaMs && ahora - ultimaFechaMs >= msUmbral) {
        const diasInactivo = Math.floor((ahora - ultimaFechaMs) / (24 * 60 * 60 * 1000));
        const yaExiste = alertas.some(
          (a) =>
            a &&
            a.estudianteId === estudianteId &&
            a.regla === 'inactividad' &&
            a.estado === 'activa'
        );

        if (!yaExiste) {
          const detalle = `Sin eventos en la bitácora desde hace ${diasInactivo} días (umbral: ${diasUmbral} días).`;
          const nueva = await almacen.agregar('alertas', {
            estudianteId,
            docenteId: grupo.docenteId,
            grupoId,
            regla: 'inactividad',
            temaId: null,
            detalle,
            estado: 'activa'
          });
          alertas.push(nueva);
          await notificarDocenteYAdmin(grupo.docenteId, estudianteId, 'inactividad', detalle, grupoId, null);
          generadas.push(nueva);
        }
      }
    }
  } catch (err) {
    console.error('Error al evaluar inactividad:', err);
  }

  return generadas;
}

export default {
  evaluarAlertas,
  evaluarInactividad
};
