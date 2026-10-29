// publico/js/modulos/noticias.js · Catálogo de noticias paginado con filtros y marcas de lectura
import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import api from "../nucleo/api.js";
import * as util from "../nucleo/util.js";
import * as ui from "../nucleo/ui.js";

const POR_PAGINA = 9;
let todasLasNoticias = [];
let leidasIds = new Set();
let temasMap = new Map();
let paginaActual = 1;
let usuario = null;

export async function inicializarNoticias() {
  await montarPlantilla({ titulo: "Noticias", roles: ["sesion"] });
  usuario = usuarioActual();

  const accionesDocente = document.getElementById("acciones-docente");
  if (accionesDocente && (usuario?.rol === "docente" || usuario?.rol === "admin")) {
    accionesDocente.style.display = "block";
  }

  const contenedorLista = document.getElementById("lista-noticias");
  const filtroBuscar = document.getElementById("filtro-buscar");
  const filtroCategoria = document.getElementById("filtro-categoria");
  const filtroTema = document.getElementById("filtro-tema");
  const paginacionNav = document.getElementById("paginacion-noticias");
  const btnAnterior = document.getElementById("btn-pagina-anterior");
  const btnSiguiente = document.getElementById("btn-pagina-siguiente");
  const indPagina = document.getElementById("indicador-pagina");

  ui.cargando(true);
  try {
    const [noticias, lecturas, temas] = await Promise.all([
      api.listar("noticias"),
      api.listar("lecturas-noticias").catch(() => []),
      api.listar("temas").catch(() => [])
    ]);

    todasLasNoticias = Array.isArray(noticias) ? noticias : [];
    leidasIds = new Set((lecturas || []).map(l => l.noticiaId));

    if (Array.isArray(temas) && filtroTema) {
      temas.forEach(t => {
        temasMap.set(t.id, t.titulo);
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.titulo;
        filtroTema.appendChild(opt);
      });
    }

    renderizar();
  } catch (err) {
    ui.aviso("Error al cargar noticias: " + err.message, "error");
    if (contenedorLista) {
      contenedorLista.innerHTML = `<p class="alerta alerta--peligro">No se pudieron cargar las noticias.</p>`;
    }
  } finally {
    ui.cargando(false);
  }

  function obtenerFiltradas() {
    const q = (filtroBuscar?.value || "").toLowerCase().trim();
    const cat = filtroCategoria?.value || "";
    const tema = filtroTema?.value || "";

    return todasLasNoticias.filter(n => {
      if (cat && n.categoria !== cat) return false;
      if (tema && n.temaId !== tema) return false;
      if (q) {
        const enTitulo = (n.titulo || "").toLowerCase().includes(q);
        const enResumen = (n.resumen || "").toLowerCase().includes(q);
        if (!enTitulo && !enResumen) return false;
      }
      return true;
    }).sort((a, b) => {
      // Destacadas primero
      if (a.destacada && !b.destacada) return -1;
      if (!a.destacada && b.destacada) return 1;
      // Por fecha descendente
      const fechaA = new Date(a.fechaPublicacion || a.creado || 0).getTime();
      const fechaB = new Date(b.fechaPublicacion || b.creado || 0).getTime();
      return fechaB - fechaA;
    });
  }

  function renderizar() {
    if (!contenedorLista) return;

    const filtradas = obtenerFiltradas();
    const total = filtradas.length;
    const totalPaginas = Math.ceil(total / POR_PAGINA) || 1;

    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;

    const inicio = (paginaActual - 1) * POR_PAGINA;
    const itemsPagina = filtradas.slice(inicio, inicio + POR_PAGINA);

    if (itemsPagina.length === 0) {
      contenedorLista.innerHTML = `
        <div class="tarjeta pila pila--centrada" style="grid-column: 1 / -1; padding: var(--espacio-6); text-align: center;">
          <p class="texto-atenuado">No se encontraron noticias que coincidan con los filtros.</p>
        </div>
      `;
      if (paginacionNav) paginacionNav.style.display = "none";
      return;
    }

    const esDocenteOAdmin = usuario?.rol === "docente" || usuario?.rol === "admin";

    contenedorLista.innerHTML = itemsPagina.map(n => {
      const leida = leidasIds.has(n.id);
      const fechaStr = util.fechaRelativa(n.fechaPublicacion || n.creado);
      const temaNombre = n.temaId && temasMap.has(n.temaId) ? temasMap.get(n.temaId) : null;

      const cat = n.categoria || 'Institucional';
      const catSlug = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

      // Imagen con proporción 16:9 (fallback estético garantizado)
      const fallbackImg = '/recursos/subidas/add9f44fa0bff7d4b8ea234d19f9ed2f.jpg';
      const imgSrc = (n.imagen && n.imagen.trim()) ? n.imagen : fallbackImg;

      let etiquetasExtra = "";
      if (n.destacada) {
        etiquetasExtra += `<span class="insignia insignia--exito">★ Destacada</span>`;
      }
      if (!leida) {
        etiquetasExtra += `<span class="insignia insignia--peligro">Nuevo</span>`;
      }
      if (esDocenteOAdmin && n.estado === "borrador") {
        etiquetasExtra += `<span class="insignia insignia--advertencia">Borrador</span>`;
      }

      const btnEditar = esDocenteOAdmin ? `
        <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--secundario btn--pequeno">Editar</a>
      ` : "";

      return `
        <article class="tarjeta-noticia ${n.destacada ? 'tarjeta-noticia--destacada' : ''}">
          <div class="tarjeta-noticia__img-wrap">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" aria-label="Leer ${ui.escapar(n.titulo)}">
              <img src="${ui.escapar(imgSrc)}" alt="${ui.escapar(n.titulo)}" class="tarjeta-noticia__img" loading="lazy">
            </a>
          </div>
          <div class="tarjeta-noticia__cuerpo">
            <div class="tarjeta-noticia__titular-linea">
              <span class="noticia-categoria-acento noticia-cat--${catSlug}">${ui.escapar(cat)}</span>
              <span class="noticia-separador">•</span>
              <h3 class="tarjeta-noticia__titulo">
                <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}">${ui.escapar(n.titulo)}</a>
              </h3>
            </div>
            <p class="tarjeta-noticia__resumen">${ui.escapar(n.resumen)}</p>
            ${temaNombre ? `<span class="noticia-tema-tag">Tema: ${ui.escapar(temaNombre)}</span>` : ''}
            <div class="tarjeta-noticia__pie">
              <div class="fila fila--centrada" style="gap: var(--espacio-1); flex-wrap: wrap;">
                <time class="noticia-fecha" datetime="${ui.escapar(n.fechaPublicacion || n.creado || '')}">${fechaStr}</time>
                ${etiquetasExtra}
              </div>
              <div class="fila fila--centrada" style="gap: var(--espacio-1);">
                ${btnEditar}
                <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--primario btn--pequeno">Leer</a>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // Actualizar paginador
    if (paginacionNav) {
      if (totalPaginas > 1) {
        paginacionNav.style.display = "flex";
        if (indPagina) indPagina.textContent = `Página ${paginaActual} de ${totalPaginas} (${total} noticias)`;
        if (btnAnterior) btnAnterior.disabled = paginaActual <= 1;
        if (btnSiguiente) btnSiguiente.disabled = paginaActual >= totalPaginas;
      } else {
        paginacionNav.style.display = "none";
      }
    }
  }

  // Eventos de filtros y paginación
  filtroBuscar?.addEventListener("input", () => {
    paginaActual = 1;
    renderizar();
  });

  filtroCategoria?.addEventListener("change", () => {
    paginaActual = 1;
    renderizar();
  });

  filtroTema?.addEventListener("change", () => {
    paginaActual = 1;
    renderizar();
  });

  btnAnterior?.addEventListener("click", () => {
    if (paginaActual > 1) {
      paginaActual--;
      renderizar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  btnSiguiente?.addEventListener("click", () => {
    const totalPaginas = Math.ceil(obtenerFiltradas().length / POR_PAGINA) || 1;
    if (paginaActual < totalPaginas) {
      paginaActual++;
      renderizar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

if (typeof document !== "undefined") {
  inicializarNoticias();
}

export default { inicializarNoticias };
