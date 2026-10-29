// publico/js/nucleo/gamificacion.js · Registro de intentos, retroalimentación de logros y consulta de puntos
import * as api from './api.js';
import * as ui from './ui.js';

/**
 * Consulta los logros del usuario actual o de un usuario específico.
 * @param {string} [usuarioId="yo"]
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = 'yo') {
  return await api.llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
}

/**
 * Muestra las recompensas obtenidas tras una actividad:
 * - Aviso toast con puntos ganados (si son > 0).
 * - Modal de celebración animado por cada nueva insignia desbloqueada.
 * - Actualización inmediata del contador #puntos-usuario en la interfaz.
 * @param {Object} resultado - { puntosGanados, puntosTotales, insigniasNuevas }
 */
export async function mostrarLogros(resultado) {
  if (!resultado) return;

  // 1. Mostrar puntos ganados en toast si son mayores a 0
  if (typeof resultado.puntosGanados === 'number' && resultado.puntosGanados > 0) {
    ui.aviso(`+${resultado.puntosGanados} puntos ganados`, 'exito');
  }

  // 2. Actualizar visualmente el elemento #puntos-usuario en el encabezado
  if (typeof resultado.puntosTotales === 'number') {
    const elPuntos = document.getElementById('puntos-usuario');
    if (elPuntos) {
      const cant = elPuntos.querySelector('.puntos-usuario__cantidad');
      if (cant) {
        cant.textContent = `${resultado.puntosTotales} pts`;
      } else {
        elPuntos.innerHTML = `<span class="puntos-usuario__icono" aria-hidden="true">🪙</span> <span class="puntos-usuario__cantidad">${resultado.puntosTotales} pts</span>`;
      }
    }
  }

  // 3. Modal de celebración por cada nueva insignia
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    for (const ins of resultado.insigniasNuevas) {
      const htmlCelebracion = `
        <div class="celebracion">
          <div class="celebracion__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏆')}</div>
          <h3 class="celebracion__nombre">${ui.escapar(ins.nombre || 'Insignia')}</h3>
          <p class="celebracion__descripcion">¡Has desbloqueado una nueva insignia por tus logros!</p>
        </div>
      `;
      await ui.modal({
        titulo: '¡Nueva Insignia Desbloqueada!',
        contenido: htmlCelebracion,
        acciones: [{ texto: '¡Genial!', valor: true, clase: 'btn btn--primario' }]
      });
    }
  }
}

/**
 * Registra un intento de actividad en el servidor y muestra la retroalimentación de logros.
 * @param {Object} intento - { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function registrarIntento(intento) {
  const resultado = await api.llamar('POST', '/api/intentos', intento);
  await mostrarLogros(resultado);
  return resultado;
}

export default {
  logrosDe,
  mostrarLogros,
  registrarIntento
};
