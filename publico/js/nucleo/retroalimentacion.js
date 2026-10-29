// publico/js/nucleo/retroalimentacion.js · Retroalimentación inmediata y resumen accesible de actividades
import * as ui from './ui.js';
import * as util from './util.js';

/**
 * Muestra un panel de retroalimentación inmediata (.retro) con accesibilidad aria-live.
 * @param {Object} opciones
 * @param {boolean} opciones.correcto - Indica si la respuesta fue correcta o no
 * @param {string} [opciones.explicacion=""] - Explicación pedagógica de la respuesta
 * @param {string} [opciones.sugerencia=""] - Pista o sugerencia complementaria
 * @param {string} [opciones.enlaceTema=""] - URL para repasar el contenido formativo del tema
 * @param {HTMLElement|string} [opciones.contenedor=null] - Contenedor DOM donde insertar el panel
 * @returns {HTMLElement} Elemento del panel de retroalimentación creado
 */
export function mostrarRetro({
  correcto = true,
  explicacion = '',
  sugerencia = '',
  enlaceTema = '',
  contenedor = null
} = {}) {
  const panel = document.createElement('div');
  const modClase = correcto ? 'retro--correcto' : 'retro--incorrecto';
  panel.className = `retro ${modClase}`;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');

  const iconoTexto = correcto ? '✓' : '✗';
  const cuerpoHtml = `
    <div class="retro__icono" aria-hidden="true">${iconoTexto}</div>
    <div class="retro__cuerpo">
      <div class="retro__explicacion">${explicacion ? util.formatoBasico(explicacion) : (correcto ? '¡Respuesta correcta!' : 'Respuesta incorrecta')}</div>
      ${sugerencia ? `<div class="retro__sugerencia"><strong>Sugerencia:</strong> ${ui.escapar(sugerencia)}</div>` : ''}
      ${enlaceTema ? `<div class="retro__accion"><a href="${ui.escapar(enlaceTema)}" class="retro__enlace">Repasar el tema →</a></div>` : ''}
    </div>
  `;

  panel.innerHTML = cuerpoHtml;

  // Si se especifica un contenedor, insertarlo o reemplazarlo
  let destino = null;
  if (typeof contenedor === 'string') {
    destino = document.querySelector(contenedor);
  } else if (contenedor instanceof HTMLElement) {
    destino = contenedor;
  } else {
    destino = document.getElementById('retro') || document.getElementById('retroalimentacion');
  }

  if (destino) {
    destino.innerHTML = '';
    destino.appendChild(panel);
  }

  return panel;
}

/**
 * Muestra el modal de resumen final de la actividad.
 * @param {Object} opciones
 * @param {string} [opciones.titulo="Resumen de la actividad"]
 * @param {number} [opciones.aciertos=0]
 * @param {number} [opciones.errores=0]
 * @param {string|string[]} [opciones.recomendaciones=""]
 * @param {string} [opciones.enlaceTema=""]
 * @returns {Promise<"repetir" | "salir">}
 */
export async function mostrarResumen({
  titulo = 'Resumen de la actividad',
  aciertos = 0,
  errores = 0,
  recomendaciones = '',
  enlaceTema = ''
} = {}) {
  let recomendacionHtml = '';
  if (Array.isArray(recomendaciones) && recomendaciones.length > 0) {
    recomendacionHtml = `
      <div class="retro-resumen__recomendaciones">
        <h4>Recomendaciones de refuerzo:</h4>
        <ul>
          ${recomendaciones.map(r => `<li>${ui.escapar(String(r))}</li>`).join('')}
        </ul>
      </div>
    `;
  } else if (typeof recomendaciones === 'string' && recomendaciones.trim()) {
    recomendacionHtml = `
      <div class="retro-resumen__recomendaciones">
        <h4>Recomendaciones de refuerzo:</h4>
        <div>${util.formatoBasico(recomendaciones)}</div>
      </div>
    `;
  }

  const contenidoHtml = `
    <div class="retro-resumen">
      <div class="retro-resumen__marcador">
        <div class="retro-resumen__item retro-resumen__item--aciertos">
          <span class="retro-resumen__num">${Number(aciertos) || 0}</span>
          <span class="retro-resumen__etiqueta">Aciertos ✓</span>
        </div>
        <div class="retro-resumen__item retro-resumen__item--errores">
          <span class="retro-resumen__num">${Number(errores) || 0}</span>
          <span class="retro-resumen__etiqueta">Errores ✗</span>
        </div>
      </div>
      ${recomendacionHtml}
    </div>
  `;

  const acciones = [
    { texto: 'Repasar el tema', valor: 'salir', clase: 'btn btn--secundario' },
    { texto: 'Jugar de nuevo', valor: 'repetir', clase: 'btn btn--primario' }
  ];

  const eleccion = await ui.modal({
    titulo,
    contenido: contenidoHtml,
    acciones
  });

  const resultado = eleccion === 'repetir' ? 'repetir' : 'salir';

  if (resultado === 'salir' && enlaceTema && typeof window !== 'undefined' && window.location) {
    window.location.href = enlaceTema;
  }

  return resultado;
}

export default {
  mostrarRetro,
  mostrarResumen
};
