// publico/js/nucleo/notificaciones.js · Campana y centro de notificaciones en el navegador
import { llamar } from './api.js';
import { escapar } from './ui.js';
import { fechaRelativa } from './util.js';

let temporizador = null;
let listenerVisibilidad = null;

/**
 * Consulta la cantidad total de notificaciones no leídas del usuario actual.
 * @returns {Promise<number>}
 */
export async function noLeidas() {
  try {
    const res = await llamar('GET', '/api/notificaciones');
    return typeof res?.totalSinLeer === 'number' ? res.totalSinLeer : 0;
  } catch {
    return 0;
  }
}

/**
 * Monta el botón de la campana con contador y panel desplegable en el encabezado.
 * Consulta periódicamente cada 60 s únicamente cuando la pestaña está visible.
 */
export async function montarCampana() {
  let contenedor = document.getElementById('contenedor-campana');
  if (!contenedor) {
    const acciones = document.querySelector('.encabezado__acciones');
    if (acciones) {
      contenedor = document.createElement('div');
      contenedor.id = 'contenedor-campana';
      contenedor.className = 'campana-contenedor';
      const perfil = acciones.querySelector('.encabezado__perfil');
      if (perfil) {
        acciones.insertBefore(contenedor, perfil);
      } else {
        acciones.prepend(contenedor);
      }
    }
  }

  if (!contenedor) return;

  // Si ya fue montado en este contenedor, solo refrescar datos
  if (contenedor.dataset.montado === 'true') {
    return refrescar();
  }
  contenedor.dataset.montado = 'true';

  contenedor.innerHTML = `
    <button type="button" class="btn-campana" id="btn-campana" aria-label="0 notificaciones sin leer" aria-expanded="false" aria-haspopup="true">
      <span class="campana-icono" aria-hidden="true">🔔</span>
      <span class="campana-badge" id="campana-badge" style="display: none;">0</span>
    </button>
    <div class="campana-desplegable" id="campana-desplegable" role="region" aria-label="Panel de notificaciones" hidden>
      <div class="campana-desplegable__encabezado">
        <h3 class="campana-desplegable__titulo">Notificaciones</h3>
        <button type="button" class="campana-btn-accion" id="btn-marcar-todas-leidas">Marcar todas como leídas</button>
      </div>
      <div class="campana-desplegable__lista" id="campana-lista" role="feed">
        <div class="campana-vacio">Cargando notificaciones...</div>
      </div>
    </div>
  `;

  const btnCampana = document.getElementById('btn-campana');
  const badge = document.getElementById('campana-badge');
  const panel = document.getElementById('campana-desplegable');
  const listaEl = document.getElementById('campana-lista');
  const btnMarcarTodas = document.getElementById('btn-marcar-todas-leidas');

  async function refrescar() {
    try {
      const res = await llamar('GET', '/api/notificaciones');
      const totalSinLeer = typeof res?.totalSinLeer === 'number' ? res.totalSinLeer : 0;
      const notificaciones = Array.isArray(res?.notificaciones) ? res.notificaciones : [];

      // Actualizar botón accesible
      const textoAria = totalSinLeer === 1 ? '1 notificación sin leer' : `${totalSinLeer} notificaciones sin leer`;
      btnCampana.setAttribute('aria-label', textoAria);

      // Actualizar contador visual
      if (totalSinLeer > 0) {
        badge.textContent = totalSinLeer > 99 ? '99+' : String(totalSinLeer);
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '0';
        badge.style.display = 'none';
      }

      // Renderizar lista en panel
      if (notificaciones.length === 0) {
        listaEl.innerHTML = '<div class="campana-vacio">No tienes notificaciones</div>';
      } else {
        listaEl.innerHTML = notificaciones
          .map((n) => {
            const noLeida = !n.leida;
            const claseNoLeida = noLeida ? ' campana-item--no-leida' : '';
            const fechaStr = n.fecha ? fechaRelativa(n.fecha) : '';
            const enlaceHtml = n.enlace
              ? `<a href="${escapar(n.enlace)}" class="campana-item__enlace">Ver detalle →</a>`
              : '';
            return `
              <div class="campana-item${claseNoLeida}" data-id="${escapar(n.id || '')}">
                <div class="campana-item__contenido">
                  <p class="campana-item__texto">${escapar(n.mensaje || '')}</p>
                  <div class="campana-item__meta">
                    <span class="campana-item__fecha">${escapar(fechaStr)}</span>
                    ${enlaceHtml}
                  </div>
                </div>
              </div>
            `;
          })
          .join('');

        // Eventos para marcar como leída individualmente al hacer clic
        const items = listaEl.querySelectorAll('.campana-item--no-leida');
        items.forEach((item) => {
          item.addEventListener('click', async (e) => {
            if (e.target.closest('a')) return; // Permitir navegación
            const id = item.dataset.id;
            if (!id) return;
            try {
              await llamar('POST', `/api/notificaciones/${id}/leida`);
              item.classList.remove('campana-item--no-leida');
              await refrescar();
            } catch (err) {
              console.error('Error al marcar leída:', err);
            }
          });
        });
      }
    } catch (err) {
      console.error('Error al refrescar notificaciones:', err);
    }
  }

  // Desplegar / ocultar panel
  btnCampana.addEventListener('click', async (e) => {
    e.stopPropagation();
    const estabaOculto = panel.hidden;
    panel.hidden = !estabaOculto;
    btnCampana.setAttribute('aria-expanded', String(estabaOculto));
    if (estabaOculto) {
      await refrescar();
    }
  });

  // Botón "Marcar todas como leídas"
  btnMarcarTodas.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await llamar('POST', '/api/notificaciones/leidas');
      await refrescar();
    } catch (err) {
      console.error('Error al marcar todas las notificaciones como leídas:', err);
    }
  });

  // Cerrar al hacer clic fuera del contenedor
  document.addEventListener('click', (e) => {
    if (!contenedor.contains(e.target) && !panel.hidden) {
      panel.hidden = true;
      btnCampana.setAttribute('aria-expanded', 'false');
    }
  });

  // Cerrar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      btnCampana.setAttribute('aria-expanded', 'false');
      btnCampana.focus();
    }
  });

  // Consulta inicial
  await refrescar();

  // Consulta periódica cada 60 s, solo si la pestaña está visible
  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(async () => {
    if (!document.hidden) {
      await refrescar();
    }
  }, 60000);

  // Al volver a la pestaña, refrescar de inmediato
  if (!listenerVisibilidad) {
    listenerVisibilidad = () => {
      if (!document.hidden) {
        refrescar();
      }
    };
    document.addEventListener('visibilitychange', listenerVisibilidad);
  }
}

export default { noLeidas, montarCampana };
