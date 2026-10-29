// servidor/gamificacion.js · Motor de gamificación y evaluación de logros
import * as almacen from './almacen.js';
import * as acceso from './acceso.js';

// Registro en memoria de intentos por usuario para control de tasa (límite por hora)
const intentosEnMemoria = new Map();

/**
 * Limpia el registro en memoria de intentos por hora (útil para pruebas).
 */
export function limpiarLimiteHora() {
  intentosEnMemoria.clear();
}

/**
 * Obtiene el valor de una propiedad navegando por puntos (ej. "detalle.simulacionId").
 */
function obtenerPropiedad(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = String(ruta).split('.');
  let actual = obj;
  for (const p of partes) {
    if (actual == null) return undefined;
    actual = actual[p];
  }
  return actual;
}

/**
 * Valida el límite de intentos por hora en memoria para un usuario.
 * @param {string} usuarioId
 * @param {number} limiteHora
 */
function verificarLimiteHora(usuarioId, limiteHora) {
  const ahora = Date.now();
  const ventanaMs = 3600 * 1000;
  const cutoff = ahora - ventanaMs;

  let marcas = intentosEnMemoria.get(usuarioId) || [];
  marcas = marcas.filter(t => t > cutoff);

  if (marcas.length >= limiteHora) {
    const error = new Error('Límite de intentos por hora superado');
    error.estado = 429;
    throw error;
  }

  marcas.push(ahora);
  intentosEnMemoria.set(usuarioId, marcas);
}

/**
 * Procesa un intento de actividad, calcula puntos, otorga insignias y actualiza logros.
 * @param {Object} usuario - Usuario autenticado
 * @param {Object} datos - Datos del intento
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion').catch(() => null);
  if (!reglas || !reglas.puntos) {
    const error = new Error('Configuración de gamificación no disponible');
    error.estado = 500;
    throw error;
  }

  const {
    actividad,
    puntaje,
    maximo,
    errores = 0,
    duracionSeg = 0,
    detalle = {},
    temaId = null,
    nivel = null
  } = datos || {};

  // 1. Validar actividad existente en reglas.puntos
  if (!actividad || typeof actividad !== 'string' || !(actividad in reglas.puntos)) {
    const error = new Error(`Actividad no válida o inexistente en reglas: ${actividad}`);
    error.estado = 400;
    throw error;
  }

  // 2. Validar: 0 ≤ puntaje ≤ maximo y maximo > 0
  if (
    typeof puntaje !== 'number' ||
    typeof maximo !== 'number' ||
    isNaN(puntaje) ||
    isNaN(maximo) ||
    maximo <= 0 ||
    puntaje < 0 ||
    puntaje > maximo
  ) {
    const error = new Error('Puntaje o máximo no válido (0 <= puntaje <= maximo y maximo > 0)');
    error.estado = 400;
    throw error;
  }

  // 3. Validar: si viene temaId, que el usuario tenga acceso (acceso.js)
  if (temaId) {
    const asignaturaId = await acceso.asignaturaDeTema(temaId);
    if (!asignaturaId) {
      const error = new Error('Tema no encontrado');
      error.estado = 404;
      throw error;
    }
    const asignaturasUsuario = await acceso.asignaturasDe(usuario);
    const tieneAcceso = asignaturasUsuario.some(a => a && a.id === asignaturaId);
    if (!tieneAcceso) {
      const error = new Error('No tienes acceso a este tema');
      error.estado = 403;
      throw error;
    }
  }

  // 4. Validar: máximo reglas.limiteIntentosHora intentos por hora (en memoria) → 429
  const limiteHora = typeof reglas.limiteIntentosHora === 'number' ? reglas.limiteIntentosHora : 60;
  verificarLimiteHora(usuario.id, limiteHora);

  // 5. Cálculo base de puntos y bono sin errores
  const basePuntos = reglas.puntos[actividad] || 0;
  let puntosCalculados = Math.round(basePuntos * (puntaje / maximo));
  const numErrores = typeof errores === 'number' ? errores : 0;
  if (numErrores === 0 && puntaje === maximo) {
    puntosCalculados += (reglas.bonoSinErrores || 0);
  }

  // Cargar intentos históricos del usuario
  const todosIntentos = await almacen.leer('intentos').catch(() => []);
  const intentosUsuario = todosIntentos.filter(i => i && i.usuarioId === usuario.id);

  // 6. Condiciones para registrar sin puntos:
  // - Actividad en reglas.unicas y ya hay un intento con puntos con la misma clave
  let esUnicaConPuntosPrevios = false;
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const camposClave = reglas.unicas[actividad];
    esUnicaConPuntosPrevios = intentosUsuario.some(i => {
      if (i.actividad !== actividad) return false;
      if (!i.puntos || i.puntos <= 0) return false;
      return camposClave.every(campo => {
        const valNuevo = obtenerPropiedad(datos, campo);
        const valAnterior = obtenerPropiedad(i, campo);
        return valNuevo !== undefined && valNuevo === valAnterior;
      });
    });
  }

  // - Actividad en requiereAprobado y detalle.aprobado !== true
  let noAprobadoRequerido = false;
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (!detalle || detalle.aprobado !== true) {
      noAprobadoRequerido = true;
    }
  }

  // - Ya alcanzó hoy reglas.maxDiario[actividad] intentos con puntos
  let alcanzoMaxDiario = false;
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === 'number') {
    const maxDiario = reglas.maxDiario[actividad];
    const hoy = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = intentosUsuario.filter(i => {
      if (i.actividad !== actividad) return false;
      if (!i.puntos || i.puntos <= 0) return false;
      const f = i.fecha ? i.fecha.slice(0, 10) : '';
      return f === hoy;
    });
    if (intentosHoyConPuntos.length >= maxDiario) {
      alcanzoMaxDiario = true;
    }
  }

  let puntosGanados = puntosCalculados;
  if (esUnicaConPuntosPrevios || noAprobadoRequerido || alcanzoMaxDiario) {
    puntosGanados = 0;
  }

  // 7. Guardar el intento (con sus puntos)
  const nuevoIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: temaId || null,
    nivel: nivel !== undefined && nivel !== null ? Number(nivel) : null,
    puntaje,
    maximo,
    errores: numErrores,
    duracionSeg: typeof duracionSeg === 'number' ? duracionSeg : 0,
    detalle: detalle && typeof detalle === 'object' ? detalle : {},
    puntos: puntosGanados
  };
  const intentoGuardado = await almacen.agregar('intentos', nuevoIntento);
  intentosUsuario.push(intentoGuardado);

  // 8. Actualizar logros (lo crea si no existe)
  const todosLogros = await almacen.leer('logros').catch(() => []);
  let registroLogro = todosLogros.find(l => l && l.usuarioId === usuario.id);
  let esNuevoLogro = false;

  if (!registroLogro) {
    esNuevoLogro = true;
    registroLogro = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }

  registroLogro.puntos = (registroLogro.puntos || 0) + puntosGanados;
  if (!registroLogro.insignias) registroLogro.insignias = [];
  if (!registroLogro.nivelQuiz) registroLogro.nivelQuiz = {};

  // Actualizar nivelQuiz si corresponde (si aprobó quiz)
  if (actividad === 'quiz' && temaId && nivel !== undefined && nivel !== null) {
    const aprobado = detalle && detalle.aprobado === true;
    if (aprobado) {
      const nNum = Number(nivel);
      const previo = registroLogro.nivelQuiz[temaId] || 0;
      if (nNum > previo) {
        registroLogro.nivelQuiz[temaId] = nNum;
      }
    }
  }

  // 9. Evaluar insignias no obtenidas
  const todasInsignias = await almacen.leer('insignias').catch(() => []);
  const idsObtenidas = new Set(registroLogro.insignias.map(ins => ins && ins.id));
  const noObtenidas = todasInsignias.filter(ins => ins && !idsObtenidas.has(ins.id));

  const insigniasNuevas = [];

  for (const ins of noObtenidas) {
    const { condicion } = ins;
    if (!condicion || !condicion.tipo) continue;

    let cumple = false;

    if (condicion.tipo === 'conteo') {
      const act = condicion.actividad;
      const min = condicion.minimo || 1;
      const intentosAct = intentosUsuario.filter(i => i && i.actividad === act);

      if (reglas.unicas && Array.isArray(reglas.unicas[act])) {
        // En actividades únicas, contar claves distintas
        const campos = reglas.unicas[act];
        const clavesDistintas = new Set();
        for (const i of intentosAct) {
          const clave = campos.map(c => String(obtenerPropiedad(i, c))).join('::');
          clavesDistintas.add(clave);
        }
        cumple = clavesDistintas.size >= min;
      } else {
        cumple = intentosAct.length >= min;
      }
    } else if (condicion.tipo === 'sinErrores') {
      const act = condicion.actividad;
      cumple = intentosUsuario.some(
        i => i && i.actividad === act && i.errores === 0 && i.puntaje === i.maximo && i.maximo > 0
      );
    } else if (condicion.tipo === 'puntos') {
      cumple = (registroLogro.puntos || 0) >= (condicion.minimo || 0);
    } else if (condicion.tipo === 'nivelQuiz') {
      const nivelReq = Number(condicion.nivel);
      const nivelesTemas = Object.values(registroLogro.nivelQuiz || {});
      const maxNivel = nivelesTemas.length > 0 ? Math.max(...nivelesTemas) : 0;
      cumple = maxNivel >= nivelReq;
      if (!cumple) {
        cumple = intentosUsuario.some(
          i => i && i.actividad === 'quiz' && Number(i.nivel) >= nivelReq && i.detalle && i.detalle.aprobado === true
        );
      }
    } else if (condicion.tipo === 'racha') {
      const diasReq = condicion.dias || 1;
      const fechasSet = new Set(
        intentosUsuario
          .map(i => (i && i.fecha ? i.fecha.slice(0, 10) : null))
          .filter(Boolean)
      );
      if (intentoGuardado.fecha) {
        fechasSet.add(intentoGuardado.fecha.slice(0, 10));
      }

      let diasConsecutivos = 0;
      let d = new Date(intentoGuardado.fecha || Date.now());
      while (true) {
        const fechaStr = d.toISOString().slice(0, 10);
        if (fechasSet.has(fechaStr)) {
          diasConsecutivos++;
          d.setUTCDate(d.getUTCDate() - 1);
        } else {
          break;
        }
      }
      cumple = diasConsecutivos >= diasReq;
    }

    if (cumple) {
      const fechaOtorgada = new Date().toISOString();
      registroLogro.insignias.push({ id: ins.id, fecha: fechaOtorgada });
      insigniasNuevas.push({
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      });
    }
  }

  // Guardar logros actualizados
  if (esNuevoLogro) {
    await almacen.agregar('logros', registroLogro);
  } else {
    await almacen.actualizar('logros', registroLogro.id, registroLogro);
  }

  // 10. Evaluar alertas dentro de try/catch
  try {
    const { evaluarAlertas } = await import('./alertas.js');
    if (typeof evaluarAlertas === 'function') {
      await evaluarAlertas(intentoGuardado, usuario);
    }
  } catch (err) {
    // Alertas no deben impedir el registro del intento
  }

  return {
    puntosGanados,
    puntosTotales: registroLogro.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento,
  limpiarLimiteHora
};
