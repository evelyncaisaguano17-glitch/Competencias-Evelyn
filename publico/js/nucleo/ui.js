// publico/js/nucleo/ui.js · Componentes e interfaz de usuario accesible

// Escapa caracteres especiales de HTML
export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Limpia HTML con DOMPurify si está disponible; de lo contrario, escapa el texto
export function limpiar(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

// Contenedor persistente con aria-live para avisos/toasts
function obtenerContenedorAvisos() {
  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    contenedor.setAttribute('aria-atomic', 'true');
    contenedor.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:360px;width:calc(100% - 40px);';
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

// Muestra una notificación toast temporal durante 4 segundos
export function aviso(texto, tipo = 'info') {
  if (typeof document === 'undefined') return;

  const contenedor = obtenerContenedorAvisos();
  const toast = document.createElement('div');
  toast.className = `aviso aviso-${tipo}`;
  toast.setAttribute('role', 'status');
  toast.style.cssText = 'pointer-events:auto;padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#1e293b;color:#ffffff;transition:opacity 0.3s ease,transform 0.3s ease;';

  if (tipo === 'exito') {
    toast.style.background = '#15803d';
  } else if (tipo === 'error') {
    toast.style.background = '#b91c1c';
  } else if (tipo === 'info') {
    toast.style.background = '#1d4ed8';
  }

  const span = document.createElement('span');
  span.textContent = texto;
  toast.appendChild(span);

  const btnCerrar = document.createElement('button');
  btnCerrar.type = 'button';
  btnCerrar.setAttribute('aria-label', 'Cerrar aviso');
  btnCerrar.innerHTML = '&times;';
  btnCerrar.style.cssText = 'background:transparent;border:none;color:inherit;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;';
  btnCerrar.onclick = () => remover();
  toast.appendChild(btnCerrar);

  contenedor.appendChild(toast);

  function remover() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }

  setTimeout(remover, 4000);
}

// Modal accesible con rol dialog, trampa de foco y cierre con Escape
export function modal({ titulo = '', contenido = '', acciones = [] } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const focoPrevio = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px;';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal-dialogo';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    dialogo.tabIndex = -1;
    dialogo.style.cssText = 'background:#ffffff;color:#1e293b;border-radius:12px;max-width:480px;width:100%;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);padding:24px;display:flex;flex-direction:column;gap:16px;outline:none;';

    const idTitulo = `modal-titulo-${Math.random().toString(36).slice(2, 9)}`;
    dialogo.setAttribute('aria-labelledby', idTitulo);

    const cabecera = document.createElement('div');
    cabecera.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

    const h2 = document.createElement('h2');
    h2.id = idTitulo;
    h2.style.cssText = 'margin:0;font-size:18px;font-weight:600;';
    h2.textContent = titulo;
    cabecera.appendChild(h2);

    const btnCerrar = document.createElement('button');
    btnCerrar.type = 'button';
    btnCerrar.setAttribute('aria-label', 'Cerrar ventana modal');
    btnCerrar.innerHTML = '&times;';
    btnCerrar.style.cssText = 'background:transparent;border:none;font-size:24px;line-height:1;cursor:pointer;color:#64748b;padding:0;';
    cabecera.appendChild(btnCerrar);
    dialogo.appendChild(cabecera);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal__cuerpo modal-cuerpo';
    cuerpo.style.cssText = 'font-size:15px;line-height:1.5;color:inherit;';
    if (typeof contenido === 'string') {
      if (contenido.includes('<')) {
        cuerpo.innerHTML = contenido;
      } else {
        cuerpo.textContent = contenido;
      }
    } else if (contenido instanceof Node) {
      cuerpo.appendChild(contenido);
    }
    dialogo.appendChild(cuerpo);

    const contenedorAcciones = document.createElement('div');
    contenedorAcciones.className = 'modal__pie modal-acciones';
    contenedorAcciones.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;margin-top:8px;';

    const listaAcciones = Array.isArray(acciones) && acciones.length > 0
      ? acciones
      : [{ texto: 'Aceptar', valor: true }];

    let resuelta = false;
    function cerrar(valor) {
      if (resuelta) return;
      resuelta = true;
      document.removeEventListener('keydown', manejarTeclado);
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
      if (focoPrevio && typeof focoPrevio.focus === 'function') {
        focoPrevio.focus();
      }
      resolve(valor);
    }

    btnCerrar.onclick = () => cerrar(null);
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cerrar(null);
      }
    };

    for (const accion of listaAcciones) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = accion.clase ? `btn ${accion.clase}` : (accion.primario ? 'btn btn--primario' : 'btn btn--secundario');
      btn.textContent = accion.texto || 'Aceptar';
      btn.style.cssText = 'padding:8px 16px;border-radius:6px;font-size:14px;cursor:pointer;';
      btn.onclick = async () => {
        if (typeof accion.alHacer === 'function') {
          const res = await accion.alHacer(dialogo, cuerpo);
          if (res === false) return;
          cerrar(res !== undefined ? res : accion.valor);
          return;
        }
        cerrar(accion.valor !== undefined ? accion.valor : true);
      };
      contenedorAcciones.appendChild(btn);
    }

    dialogo.appendChild(contenedorAcciones);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    const selectorFoco = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const obtenerFocables = () => Array.from(dialogo.querySelectorAll(selectorFoco)).filter((el) => !el.disabled);

    function manejarTeclado(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(null);
        return;
      }

      if (e.key === 'Tab') {
        const focables = obtenerFocables();
        if (focables.length === 0) {
          e.preventDefault();
          dialogo.focus();
          return;
        }
        const primero = focables[0];
        const ultimo = focables[focables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primero || !dialogo.contains(document.activeElement)) {
            e.preventDefault();
            ultimo.focus();
          }
        } else {
          if (document.activeElement === ultimo || !dialogo.contains(document.activeElement)) {
            e.preventDefault();
            primero.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', manejarTeclado);

    const focables = obtenerFocables();
    if (focables.length > 0) {
      focables[0].focus();
    } else {
      dialogo.focus();
    }
  });
}

// Diálogo de confirmación accesible basado en modal()
export async function confirmar(texto) {
  const respuesta = await modal({
    titulo: 'Confirmación',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });
  return Boolean(respuesta);
}

// Muestra u oculta el indicador visual de carga (.cargando)
export function cargando(bool) {
  if (typeof document === 'undefined') return;
  let indicador = document.querySelector('.cargando');
  if (bool) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-live', 'polite');
      indicador.setAttribute('aria-label', 'Cargando...');
      indicador.style.cssText = 'position:fixed;top:0;left:0;right:0;height:4px;background:#2563eb;z-index:99999;';
      document.body.appendChild(indicador);
    } else {
      indicador.style.display = 'block';
    }
  } else if (indicador) {
    indicador.style.display = 'none';
  }
}

export default {
  aviso,
  confirmar,
  modal,
  cargando,
  escapar,
  limpiar
};
