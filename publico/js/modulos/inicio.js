// publico/js/modulos/inicio.js · Vista principal pública y panel de inicio para usuarios autenticados
import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import api from "../nucleo/api.js";
import * as util from "../nucleo/util.js";
import * as ui from "../nucleo/ui.js";
import { calcularAvance } from "./asignaturas.js";

export async function inicializarInicio() {
  await montarPlantilla({ titulo: "Inicio", roles: ["publico"] });

  const usuario = usuarioActual();
  const contenido = document.getElementById("contenido");
  if (!contenido) return;

  // 1. Vista sin sesión (Público)
  if (!usuario) {
    contenido.innerHTML = `
      <section class="inicio-hero-publico">
        <h1 class="inicio-hero-publico__titulo">Ecosistema Educativo Digital</h1>
        <p class="inicio-hero-publico__descripcion">
          Plataforma interactiva para la formación en Cirugía y manejo de heridas con contenidos estructurados,
          juegos con retroalimentación inmediata, canciones educativas y tutor inteligente.
        </p>
        <div class="inicio-hero-publico__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--primario" style="padding: 0.85rem 2rem; font-size: 1rem;">Ingresar</a>
          <a href="/paginas/registro.html" class="btn btn--secundario" style="padding: 0.85rem 2rem; font-size: 1rem;">Registrarse</a>
        </div>
      </section>

      <div class="inicio-caracteristicas">
        <article class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono" aria-hidden="true">📚</div>
          <h3 style="color: #0f172a; margin-bottom: 0.5rem;">Contenidos Estructurados</h3>
          <p class="texto-atenuado texto-pequeno">
            Aprende paso a paso con unidades temáticas, recursos multimedia y seguimiento de tu avance en tiempo real.
          </p>
        </article>
        <article class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono" aria-hidden="true">🎵</div>
          <h3 style="color: #0f172a; margin-bottom: 0.5rem;">Canciones Educativas</h3>
          <p class="texto-atenuado texto-pequeno">
            Refuerza conceptos curriculares con música temática, reproductor interactivo y karaoke sincronizado LRC.
          </p>
        </article>
        <article class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono" aria-hidden="true">📢</div>
          <h3 style="color: #0f172a; margin-bottom: 0.5rem;">Novedades y Noticias</h3>
          <p class="texto-atenuado texto-pequeno">
            Mantente al día con comunicados oficiales, eventos académicos y logros destacados de la comunidad.
          </p>
        </article>
      </div>
    `;
    return;
  }

  // 2. Vista con sesión (Dashboard interactivo estilo Runachay)
  ui.cargando(true);
  try {
    const [asignaturasData, noticiasData, distributivoData] = await Promise.all([
      api.listar("asignaturas").catch(() => []),
      api.listar("noticias").catch(() => []),
      api.listar("distributivo").catch(() => [])
    ]);

    const primerNombre = (usuario.nombre || 'Estudiante').split(' ')[0];
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Estudiante';
    const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";

    // Ilustración SVG de estudio
    const ilustracionSvg = `
      <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; max-width: 190px;">
        <rect x="25" y="45" width="85" height="55" rx="6" fill="#1E293B"/>
        <rect x="30" y="50" width="75" height="45" rx="3" fill="#38BDF8" fill-opacity="0.3"/>
        <path d="M15 100h105c3 0 5 2 4 5l-2 3c-1 2-3 3-5 3H18c-2 0-4-1-5-3l-2-3c-1-3 1-5 4-5z" fill="#94A3B8"/>
        <!-- Pila de libros -->
        <rect x="120" y="88" width="55" height="12" rx="3" fill="#3B82F6"/>
        <rect x="123" y="74" width="50" height="12" rx="3" fill="#10B981"/>
        <rect x="126" y="60" width="45" height="12" rx="3" fill="#F59E0B"/>
        <rect x="130" y="48" width="38" height="10" rx="3" fill="#EF4444"/>
        <!-- Lápices -->
        <rect x="178" y="70" width="16" height="30" rx="4" fill="#64748B"/>
        <path d="M182 50l4 20h-8l4-20z" fill="#F59E0B"/>
        <path d="M190 55l3 15h-6l3-15z" fill="#EC4899"/>
      </svg>
    `;

    // 2.1 Banner de Bienvenida
    const bannerHtml = `
      <section class="banner-bienvenida" aria-label="Bienvenida al portal">
        <div class="banner-bienvenida__texto">
          <h2 class="banner-bienvenida__saludo">¡Hola, ${ui.escapar(primerNombre)}! 👋</h2>
          <p class="banner-bienvenida__subtitulo">Bienvenida a tu ecosistema formativo digital.</p>
        </div>
        <div class="banner-bienvenida__ilustracion" aria-hidden="true">
          ${ilustracionSvg}
        </div>
      </section>
    `;

    // 2.2 Pestañas de navegación
    const pestanasHtml = `
      <nav class="inicio-pestanas" aria-label="Pestañas de asignaturas">
        <a href="${usuario.rol === 'admin' ? '/paginas/admin-asignaturas.html' : '/paginas/asignaturas.html'}" class="pildora-tab pildora-tab--activa">
          <span aria-hidden="true">📚</span> ${usuario.rol === 'admin' ? 'Asignaturas' : 'Materias Asignadas'}
        </a>
        <a href="${usuario.rol === 'admin' ? '/paginas/editor-contenidos.html' : '/paginas/asignaturas.html'}" class="pildora-tab">
          <span aria-hidden="true">👥</span> ${usuario.rol === 'admin' ? 'Contenidos' : 'Mis Asignaturas'}
        </a>
      </nav>
    `;

    // 2.3 Accesos rápidos para docentes y admin
    let accesosDocenteHtml = "";
    if (esDocenteOAdmin) {
      accesosDocenteHtml = `
        <div class="inicio-accesos-docente" aria-label="Accesos rápidos de gestión">
          <span>Gestión:</span>
          <a href="/paginas/editor-contenidos.html" class="btn btn--secundario btn--pequeno">Gestionar Contenidos</a>
          <a href="/paginas/editor-noticia.html" class="btn btn--secundario btn--pequeno">+ Nueva Noticia</a>
          <a href="/paginas/editor-cancion.html" class="btn btn--secundario btn--pequeno">+ Nueva Canción</a>
          <a href="/paginas/noticias.html" class="btn btn--fantasma btn--pequeno">Ver Noticias</a>
        </div>
      `;
    }

    // 2.4 Continuar donde te quedaste (localStorage "ultimoTema")
    let continuarHtml = "";
    try {
      const rawUltimoTema = localStorage.getItem("ultimoTema");
      if (rawUltimoTema) {
        const ultimo = JSON.parse(rawUltimoTema);
        if (ultimo && ultimo.id) {
          continuarHtml = `
            <section class="inicio-continuar" aria-label="Continuar estudio">
              <div class="inicio-continuar__info">
                <span class="insignia insignia--primario">📌 Continuar donde te quedaste</span>
                <h3>${ui.escapar(ultimo.titulo || 'Tema curricular')}</h3>
              </div>
              <a href="/paginas/tema.html?id=${encodeURIComponent(ultimo.id)}" class="btn btn--primario">Continuar estudio →</a>
            </section>
          `;
        }
      }
    } catch { }

    // 2.5 Asignaturas y cálculo de avance
    const listaAsignaturas = Array.isArray(asignaturasData) ? asignaturasData : [];
    const asignaturasConAvance = await Promise.all(
      listaAsignaturas.map(async (asig) => {
        const avance = await calcularAvance(asig.id);
        return { asig, avance };
      })
    );

    // Paletas temáticas de banner
    const paletas = [
      { banner: "tarjeta-asignatura__banner--azul", icono: "📐" },
      { banner: "tarjeta-asignatura__banner--turquesa", icono: "💻" },
      { banner: "tarjeta-asignatura__banner--naranja", icono: "📖" },
      { banner: "tarjeta-asignatura__banner--morado", icono: "🔬" }
    ];

    let asignaturasHtml = "";
    if (asignaturasConAvance.length > 0) {
      asignaturasHtml = `
        <div class="inicio-barra-filtros">
          <div class="inicio-barra-filtros__busqueda">
            <span style="font-weight: 700; color: #334155;">Buscar:</span>
            <input type="search" id="filtro-rapido-asig" placeholder="Buscar materia..." class="inicio-input-buscar">
          </div>
          <span class="texto-atenuado texto-pequeno" id="contador-mostrando">Mostrando ${asignaturasConAvance.length} de ${asignaturasConAvance.length} registros</span>
        </div>

        <div class="inicio-asignaturas-grid" id="grid-asig-inicio">
          ${asignaturasConAvance.map(({ asig, avance }, idx) => {
        const temaVisual = paletas[idx % paletas.length];
        const destinoUrl = usuario.rol === 'admin' ? '/paginas/editor-contenidos.html' : `/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}`;
        return `
              <article class="tarjeta-asignatura-runachay" data-nombre="${ui.escapar((asig.nombre || '').toLowerCase())}" style="cursor: pointer;" onclick="if (!event.target.closest('a')) window.location.href='${destinoUrl}';">
                <div class="tarjeta-asignatura__banner ${temaVisual.banner}">
                  <span class="tarjeta-asignatura__icono-ilustrativo" aria-hidden="true">${temaVisual.icono}</span>
                  <div class="tarjeta-asignatura__badge-usuario" aria-hidden="true" title="Asignatura activa">👤</div>
                </div>

                <div class="tarjeta-asignatura__cuerpo">
                  <a href="${destinoUrl}" style="text-decoration: none; color: inherit;">
                    <h3 class="tarjeta-asignatura__nombre">${ui.escapar(asig.nombre)}</h3>
                  </a>
                  <div class="tarjeta-asignatura__nivel">${ui.escapar(asig.nivel || 'Nivel Superior')}</div>
                  <p class="tarjeta-asignatura__descripcion">${ui.escapar(asig.descripcion || 'Competencias y habilidades formativas.')}</p>

                  <div class="tarjeta-asignatura__progreso-wrap">
                    <div class="fila fila--entre fila--centrada margen-b-1">
                      <span class="texto-pequeno" style="font-weight: 700; color: #1e293b;">Progreso: ${avance.porcentaje}%</span>
                      <span class="texto-pequeno texto-atenuado">${avance.revisados} de ${avance.total} temas</span>
                    </div>
                    <div class="tarjeta-asignatura__progreso-barra">
                      <div class="tarjeta-asignatura__progreso-relleno" style="width: ${avance.porcentaje}%;"></div>
                    </div>
                  </div>
                </div>

                <div class="tarjeta-asignatura__pie">
                  <span class="tarjeta-asignatura__docente">Docente: ${ui.escapar(nombreCompleto)}</span>
                  <a href="${destinoUrl}" class="btn-circular-accion" title="${usuario.rol === 'admin' ? 'Gestionar contenidos de la materia' : 'Ir a la materia'}" aria-label="${usuario.rol === 'admin' ? 'Gestionar contenidos' : 'Ir a la materia'} ${ui.escapar(asig.nombre)}">
                    →
                  </a>
                </div>
              </article>
            `;
      }).join("")}
        </div>
      `;
    } else {
      asignaturasHtml = `
        <div class="tarjeta pila pila--centrada" style="padding: 3rem; text-align: center; margin-bottom: 2rem;">
          <p class="texto-atenuado">No tienes materias asignadas en este momento.</p>
        </div>
      `;
    }

    // 2.6 Las 3 noticias publicadas más recientes
    const todasNoticias = Array.isArray(noticiasData) ? noticiasData : [];
    const publicadas = todasNoticias
      .filter((n) => n && n.estado === "publicado")
      .sort((a, b) => {
        if (a.destacada && !b.destacada) return -1;
        if (!a.destacada && b.destacada) return 1;
        const fechaA = new Date(a.fechaPublicacion || a.creado || 0).getTime();
        const fechaB = new Date(b.fechaPublicacion || b.creado || 0).getTime();
        return fechaB - fechaA;
      })
      .slice(0, 3);

    let noticiasHtml = "";
    if (publicadas.length > 0) {
      noticiasHtml = `
        <div class="inicio-noticias-grid">
          ${publicadas.map((n) => `
            <article class="tarjeta-noticia-inicio ${n.destacada ? 'tarjeta-noticia-inicio--destacada' : ''}">
              <div>
                <div class="tarjeta-noticia-inicio__etiquetas">
                  <span class="insignia insignia--primario">${ui.escapar(n.categoria || 'Institucional')}</span>
                  ${n.destacada ? '<span class="insignia insignia--exito">★ Destacada</span>' : ''}
                </div>
                <h4 class="tarjeta-noticia-inicio__titulo">
                  <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}">${ui.escapar(n.titulo)}</a>
                </h4>
                <p class="tarjeta-noticia-inicio__resumen">
                  ${ui.escapar(n.resumen || '')}
                </p>
              </div>
              <div class="tarjeta-noticia-inicio__pie">
                <time class="texto-atenuado texto-pequeno">${util.fechaRelativa(n.fechaPublicacion || n.creado)}</time>
                <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--primario btn--pequeno">Leer noticia</a>
              </div>
            </article>
          `).join("")}
        </div>
      `;
    } else {
      noticiasHtml = `
        <div class="tarjeta pila pila--centrada" style="padding: 2.5rem; text-align: center;">
          <p class="texto-atenuado">No hay noticias publicadas en este momento.</p>
        </div>
      `;
    }

    // 2.7 Inyección final en el DOM
    contenido.innerHTML = `
      ${bannerHtml}
      ${pestanasHtml}
      ${accesosDocenteHtml}
      ${continuarHtml}

      <section style="margin-bottom: 2.5rem;" aria-label="Materias Asignadas">
        <div class="inicio-seccion-titulo">
          <span>Mis Asignaturas</span>
          <a href="/paginas/asignaturas.html" class="enlace texto-pequeno" style="font-weight: 600;">Ver todas las asignaturas →</a>
        </div>
        ${asignaturasHtml}
      </section>

      <section style="margin-bottom: 2.5rem;" aria-label="Noticias institucionales recientes">
        <div class="inicio-seccion-titulo">
          <span>Últimas Noticias</span>
          <a href="/paginas/noticias.html" class="enlace texto-pequeno" style="font-weight: 600;">Ver todas las noticias →</a>
        </div>
        ${noticiasHtml}
      </section>
    `;

    // Filtro rápido de asignaturas en el input
    const inputFiltro = document.getElementById("filtro-rapido-asig");
    const gridAsig = document.getElementById("grid-asig-inicio");
    const contadorMostrando = document.getElementById("contador-mostrando");

    if (inputFiltro && gridAsig) {
      inputFiltro.addEventListener("input", () => {
        const query = inputFiltro.value.toLowerCase().trim();
        const tarjetas = gridAsig.querySelectorAll(".tarjeta-asignatura-runachay");
        let visibles = 0;
        tarjetas.forEach((t) => {
          const nombre = t.getAttribute("data-nombre") || "";
          const coincide = nombre.includes(query);
          t.style.display = coincide ? "flex" : "none";
          if (coincide) visibles++;
        });
        if (contadorMostrando) {
          contadorMostrando.textContent = `Mostrando ${visibles} de ${tarjetas.length} registros`;
        }
      });
    }
  } catch (err) {
    console.error("Error al inicializar inicio:", err);
    ui.aviso("Error al cargar datos del tablero de inicio", "error");
  } finally {
    ui.cargando(false);
  }
}

if (typeof document !== "undefined") {
  inicializarInicio();
}

export default { inicializarInicio };
