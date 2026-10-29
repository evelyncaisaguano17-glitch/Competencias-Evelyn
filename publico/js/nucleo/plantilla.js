// publico/js/nucleo/plantilla.js · Encabezado común, menú lateral filtrado por rol y pie
import { MENU } from "./menu.js";
import { usuarioActual, exigirRol, cerrar } from "./sesion.js";
import { registrarEvento } from "./bitacora.js";
import { aviso } from "./ui.js";
import { logrosDe } from "./gamificacion.js";
import { montarCampana } from "./notificaciones.js";

export const NOMBRE = "Ecosistema Educativo";

/**
 * Monta la estructura común de la página en #plantilla y el pie en body.
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título de la página actual
 * @param {string[]|string} [opciones.roles] - Roles permitidos para acceder a la página
 */
export async function montarPlantilla({ titulo = "", roles = null } = {}) {
  // 1. Exigir rol si se especifica
  if (roles) {
    exigirRol(roles);
  }

  // 2. Título del documento: título + " · " + NOMBRE
  document.title = titulo ? `${titulo} · ${NOMBRE}` : NOMBRE;

  // 3. Mostrar aviso pendiente si hubo una redirección previa por rol no permitido
  if (typeof sessionStorage !== 'undefined') {
    const avisoPendienteRaw = sessionStorage.getItem('aviso_pendiente');
    if (avisoPendienteRaw) {
      sessionStorage.removeItem('aviso_pendiente');
      try {
        const { texto, tipo } = JSON.parse(avisoPendienteRaw);
        aviso(texto, tipo || 'error');
      } catch {
        // Ignorar error de parsing
      }
    }
  }

  // 4. Obtener usuario de la sesión actual
  const usuario = usuarioActual();

  // 5. Con sesión llama a registrarEvento("pagina", location.pathname) sin esperar la respuesta
  if (usuario && typeof window !== 'undefined' && window.location) {
    registrarEvento("pagina", window.location.pathname).catch(() => {});
  }

  // 6. Filtrar ítems del menú según el rol
  const itemsVisibles = MENU.filter((item) => {
    if (!item.roles || item.roles.includes("publico")) return true;
    if (item.roles.includes("sesion")) return !!usuario;
    if (usuario && item.roles.includes(usuario.rol)) return true;
    return false;
  });

  // 7. Generar enlaces del menú marcando la página actual
  const rutaActual = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '';
  const iconosMenu = {
    "Inicio": "🏠",
    "Mi perfil": "👤",
    "Usuarios": "👥",
    "Asignaturas": "📚",
    "Distributivo": "📋",
    "Contenidos": "📁",
    "Mis asignaturas": "📖",
    "Noticias": "📢",
    "Canciones": "🎵"
  };

  const enlacesHtml = itemsVisibles
    .map((item) => {
      const esActual =
        rutaActual === item.href ||
        (item.href === "/index.html" && (rutaActual === "/" || rutaActual === "" || rutaActual.endsWith("/index.html")));
      const claseActivo = esActual ? " menu__item--activo" : "";
      const ariaCurrent = esActual ? ' aria-current="page"' : "";
      const icono = iconosMenu[item.texto] || "•";
      return `<a href="${item.href}" class="menu__item${claseActivo}"${ariaCurrent}><span class="menu__icono" aria-hidden="true">${icono}</span> <span class="menu__texto">${item.texto}</span></a>`;
    })
    .join("");

  // 8. Construir área de acciones del encabezado
  let accionesUsuarioHtml = "";
  if (usuario) {
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Mi perfil';
    const iniciales = (usuario.nombre?.[0] || 'U') + (usuario.apellido?.[0] || '');
    const puntosHtml = usuario.rol === 'estudiante'
      ? `<div id="puntos-usuario" class="puntos-usuario" title="Tus puntos acumulados"><span class="puntos-usuario__icono" aria-hidden="true">🪙</span> <span class="puntos-usuario__cantidad">...</span></div>`
      : '';

    accionesUsuarioHtml = `
      <div class="encabezado__acciones">
        ${puntosHtml}
        <div id="contenedor-campana" class="campana-contenedor"></div>
        <a href="/paginas/perfil.html" class="encabezado__perfil" title="Ver mi perfil">
          <div class="encabezado__avatar" aria-hidden="true">${iniciales.toUpperCase()}</div>
          <div class="encabezado__usuario-info">
            <span class="encabezado__usuario-nombre">${nombreCompleto}</span>
            <span class="encabezado__usuario-rol">${usuario.rol || 'estudiante'}</span>
          </div>
        </a>
        <button type="button" class="btn btn--peligro btn--pequeno" id="btn-salir">Salir</button>
      </div>
    `;
  } else {
    accionesUsuarioHtml = `
      <div class="encabezado__acciones">
        <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno">Registrarse</a>
      </div>
    `;
  }

  // 9. Insertar encabezado y menú lateral en #plantilla
  const elPlantilla = document.getElementById("plantilla");
  if (elPlantilla) {
    elPlantilla.innerHTML = `
      <header class="encabezado" role="banner">
        <div class="encabezado__marca">
          <button type="button" class="btn btn--secundario btn--pequeno menu__boton-movil" id="btn-menu-movil" aria-label="Abrir menú de navegación" aria-expanded="false" aria-controls="menu-lateral">
            ☰
          </button>
          <a href="/index.html" class="encabezado__nombre">${NOMBRE}</a>
          <span class="encabezado__separador" aria-hidden="true">|</span>
          <h1 class="encabezado__titulo">${titulo}</h1>
        </div>
        ${accionesUsuarioHtml}
      </header>
      <aside id="menu-lateral" class="menu" aria-label="Menú principal">
        <nav class="pila" aria-label="Navegación">
          ${enlacesHtml}
        </nav>
      </aside>
    `;

    // 10. Asignar evento al botón "Salir" si existe
    const btnSalir = document.getElementById("btn-salir");
    if (btnSalir) {
      btnSalir.addEventListener("click", async () => {
        await cerrar();
      });
    }

    // 10.1 Cargar puntos para estudiantes con logrosDe()
    if (usuario && usuario.rol === 'estudiante') {
      logrosDe('yo')
        .then((logro) => {
          const elPuntos = document.getElementById('puntos-usuario');
          if (elPuntos && logro && typeof logro.puntos === 'number') {
            const cant = elPuntos.querySelector('.puntos-usuario__cantidad');
            if (cant) {
              cant.textContent = `${logro.puntos} pts`;
            } else {
              elPuntos.innerHTML = `<span class="puntos-usuario__icono" aria-hidden="true">🪙</span> <span class="puntos-usuario__cantidad">${logro.puntos} pts</span>`;
            }
          }
        })
        .catch(() => {});
    }

    // 10.2 Montar campana de notificaciones cuando hay sesión
    if (usuario) {
      montarCampana().catch((err) => {
        console.error("Error al montar campana de notificaciones:", err);
      });
    }

    // 11. Eventos del botón de navegación en celular
    const btnMovil = document.getElementById("btn-menu-movil");
    const menuLateral = document.getElementById("menu-lateral");
    if (btnMovil && menuLateral) {
      btnMovil.addEventListener("click", (e) => {
        e.stopPropagation();
        const abierto = menuLateral.classList.toggle("menu--abierto");
        btnMovil.setAttribute("aria-expanded", String(abierto));
      });

      document.addEventListener("click", (e) => {
        if (
          menuLateral.classList.contains("menu--abierto") &&
          !menuLateral.contains(e.target) &&
          !btnMovil.contains(e.target)
        ) {
          menuLateral.classList.remove("menu--abierto");
          btnMovil.setAttribute("aria-expanded", "false");
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && menuLateral.classList.contains("menu--abierto")) {
          menuLateral.classList.remove("menu--abierto");
          btnMovil.setAttribute("aria-expanded", "false");
          btnMovil.focus();
        }
      });
    }
  }

  // 12. Insertar pie con el año al final del body si no existe
  let elPie = document.querySelector("footer.pie");
  const anio = new Date().getFullYear();
  if (!elPie) {
    elPie = document.createElement("footer");
    elPie.className = "pie";
    elPie.innerHTML = `
      <div class="contenedor">
        <p>© ${anio} ${NOMBRE} · Todos los derechos reservados.</p>
      </div>
    `;
    document.body.appendChild(elPie);
  }

  // 13. Mostrar noticias sin leer junto a "Noticias" en el menú
  if (usuario && typeof window !== 'undefined' && window.location) {
    actualizarContadorNoticias().catch(() => {});
  }
}

/**
 * Consulta noticias publicadas y lecturas del usuario para mostrar el número de noticias sin leer.
 */
export async function actualizarContadorNoticias() {
  try {
    const { default: api } = await import("./api.js");
    const [noticias, lecturas] = await Promise.all([
      api.listar("noticias"),
      api.listar("lecturas-noticias")
    ]);
    const publicadas = (noticias || []).filter(n => n.estado === "publicado");
    const leidasIds = new Set((lecturas || []).map(l => l.noticiaId));
    const sinLeer = publicadas.filter(n => !leidasIds.has(n.id)).length;

    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const enlace = document.querySelector('a.menu__item[href="/paginas/noticias.html"]');
      if (enlace) {
        let badge = enlace.querySelector ? enlace.querySelector('.menu__badge-noticias') : null;
        if (sinLeer > 0) {
          if (!badge && document.createElement) {
            badge = document.createElement('span');
            badge.className = 'insignia insignia--primario menu__badge-noticias';
            badge.style.marginLeft = 'auto';
            if (enlace.appendChild) enlace.appendChild(badge);
          }
          if (badge) {
            badge.textContent = String(sinLeer);
            if (badge.setAttribute) badge.setAttribute('aria-label', `${sinLeer} noticias sin leer`);
          }
        } else if (badge && badge.remove) {
          badge.remove();
        }
      }
    }
    return sinLeer;
  } catch {
    return 0;
  }
}

export default { NOMBRE, montarPlantilla, actualizarContadorNoticias };
