// publico/js/modulos/tema.js · Visualización curricular del tema y progreso
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { ACTIVIDADES } from "../nucleo/catalogo-actividades.js";
import { registrarIntento } from "../nucleo/gamificacion.js";

await montarPlantilla({
  titulo: "Tema",
  roles: ["estudiante", "docente"]
});

const contenedor = document.getElementById("contenido");
const temaId = util.parametro("id");

if (!temaId) {
  contenedor.innerHTML = `
    <div class="seccion-tema">
      <div class="alerta alerta--peligro">
        <p>No se especificó un identificador de tema válido (?id=...).</p>
      </div>
      <p><a href="/paginas/asignaturas.html" class="btn btn--secundario">← Volver a Mis asignaturas</a></p>
    </div>
  `;
  throw new Error("temaId no especificado en URL");
}

// Helpers para incrustar video de YouTube o Vimeo
function obtenerEmbedVideo(url, titulo) {
  if (!url || typeof url !== "string") return null;

  // 1. YouTube
  const matchYT = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (matchYT && matchYT[1]) {
    const videoId = matchYT[1];
    return `
      <div class="recurso-video-embed">
        <iframe
          src="https://www.youtube.com/embed/${videoId}"
          title="${ui.escapar(titulo || 'Video de YouTube')}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    `;
  }

  // 2. Vimeo
  const matchVimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (matchVimeo && matchVimeo[1]) {
    const videoId = matchVimeo[1];
    return `
      <div class="recurso-video-embed">
        <iframe
          src="https://player.vimeo.com/video/${videoId}"
          title="${ui.escapar(titulo || 'Video de Vimeo')}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    `;
  }

  // 3. Otro enlace de video
  return `
    <a href="${ui.escapar(url)}" target="_blank" rel="noopener noreferrer" class="recurso-enlace">
      ▶ Ver video: ${ui.escapar(titulo || url)} ↗
    </a>
  `;
}

async function iniciar() {
  try {
    ui.cargando(true);

    const [tema, progreso] = await Promise.all([
      api.obtener("temas", temaId),
      api.listar("progreso-temas")
    ]);

    if (!tema) {
      contenedor.innerHTML = `
        <div class="seccion-tema">
          <div class="alerta alerta--peligro">
            <p>El tema solicitado no existe o no se encuentra disponible.</p>
          </div>
          <p><a href="/paginas/asignaturas.html" class="btn btn--secundario">← Volver a Mis asignaturas</a></p>
        </div>
      `;
      return;
    }

    // Guardar en localStorage el último tema consultado
    try {
      localStorage.setItem("ultimoTema", JSON.stringify({ id: tema.id, titulo: tema.titulo || "Tema" }));
    } catch (e) {
      // Ignorar restricciones locales de almacenamiento
    }

    // Resolver unidad y asignatura para la ruta de migas de pan
    let unidad = null;
    let asignatura = null;
    if (tema.unidadId) {
      try {
        unidad = await api.obtener("unidades", tema.unidadId);
        if (unidad && unidad.asignaturaId) {
          asignatura = await api.obtener("asignaturas", unidad.asignaturaId);
        }
      } catch (e) {
        // En caso de fallo no crítico, continuar
      }
    }

    const estaRevisado = Array.isArray(progreso) && progreso.some((p) => p && p.temaId === tema.id);

    // Contenido estructurado
    const objetivos = Array.isArray(tema.objetivos) ? tema.objetivos.filter(Boolean) : [];
    const ejemplos = Array.isArray(tema.ejemplos) ? tema.ejemplos.filter(Boolean) : [];
    const recursos = Array.isArray(tema.recursos) ? tema.recursos : [];
    const resumenHtml = util.formatoBasico(tema.resumen || "*(Sin resumen disponible)*");

    contenedor.innerHTML = `
      <div class="seccion-tema">
        <!-- Migas de pan -->
        <nav class="migas-pan" aria-label="Ruta de navegación">
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span aria-hidden="true">/</span>
          ${asignatura ? `<a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${ui.escapar(asignatura.nombre)}</a><span aria-hidden="true">/</span>` : ''}
          ${unidad ? `<span>${ui.escapar(unidad.titulo)}</span><span aria-hidden="true">/</span>` : ''}
          <span aria-current="page">${ui.escapar(tema.titulo || 'Tema')}</span>
        </nav>

        <!-- Cabecera del tema y botón de revisado -->
        <header class="tema-cabecera">
          <div class="tema-cabecera__barra">
            <span class="insignia insignia--primario">
              Dificultad: ${ui.escapar(tema.dificultad || 'Intermedio')}
            </span>
            <div id="contenedor-btn-revisado">
              ${
                estaRevisado
                  ? `<button type="button" class="btn btn--exito" disabled aria-label="Tema ya revisado">Revisado ✓</button>`
                  : `<button type="button" id="btn-marcar-revisado" class="btn btn--primario">Marcar como revisado</button>`
              }
            </div>
          </div>
          <h2>${ui.escapar(tema.titulo || 'Sin título')}</h2>
        </header>

        <!-- Objetivos de aprendizaje -->
        ${
          objetivos.length > 0
            ? `
              <section class="tema-seccion" aria-labelledby="titulo-objetivos">
                <h3 id="titulo-objetivos">Objetivos de Aprendizaje</h3>
                <ul class="tema-lista">
                  ${objetivos.map((o) => `<li>${ui.escapar(o)}</li>`).join("")}
                </ul>
              </section>
            `
            : ""
        }

        <!-- Resumen curricular -->
        <section class="tema-seccion" aria-labelledby="titulo-resumen">
          <h3 id="titulo-resumen">Resumen Curricular</h3>
          <div class="tema-resumen-cuerpo">
            ${resumenHtml}
          </div>
        </section>

        <!-- Ejemplos prácticos -->
        ${
          ejemplos.length > 0
            ? `
              <section class="tema-seccion" aria-labelledby="titulo-ejemplos">
                <h3 id="titulo-ejemplos">Ejemplos Prácticos</h3>
                <ul class="tema-lista">
                  ${ejemplos.map((e) => `<li>${ui.escapar(e)}</li>`).join("")}
                </ul>
              </section>
            `
            : ""
        }

        <!-- Recursos multimedia -->
        ${
          recursos.length > 0
            ? `
              <section class="tema-seccion" aria-labelledby="titulo-recursos">
                <h3 id="titulo-recursos">Recursos Multimedia y Complementarios</h3>
                <div class="recursos-contenedor">
                  ${renderRecursosVisuales(recursos)}
                </div>
              </section>
            `
            : ""
        }

        <!-- Bloque Practica este tema -->
        <section class="tema-seccion bloque-practica" aria-labelledby="titulo-practica">
          <h3 id="titulo-practica">Practica este tema</h3>
          <div id="contenedor-actividades">
            ${renderActividadesPractica(tema.id)}
          </div>
        </section>
      </div>
    `;

    // Conectar botón Marcar como revisado
    const btnRevisar = document.getElementById("btn-marcar-revisado");
    if (btnRevisar) {
      btnRevisar.addEventListener("click", async () => {
        if (btnRevisar.disabled) return;
        btnRevisar.disabled = true;
        try {
          ui.cargando(true);
          try {
            await api.crear("progreso-temas", { temaId: tema.id });
          } catch (errCrear) {
            if (!errCrear.message?.includes("Ya se ha registrado")) {
              throw errCrear;
            }
          }
          await registrarIntento({ actividad: "tema-revisado", temaId: tema.id, puntaje: 1, maximo: 1 });
          ui.aviso("¡Tema marcado como revisado!", "exito");

          const contenedorBtn = document.getElementById("contenedor-btn-revisado");
          if (contenedorBtn) {
            contenedorBtn.innerHTML = `<button type="button" class="btn btn--exito" disabled>Revisado ✓</button>`;
          }
        } catch (err) {
          if (err.message?.includes("Ya se ha registrado")) {
            const contenedorBtn = document.getElementById("contenedor-btn-revisado");
            if (contenedorBtn) {
              contenedorBtn.innerHTML = `<button type="button" class="btn btn--exito" disabled>Revisado ✓</button>`;
            }
            ui.aviso("Este tema ya ha sido marcado como revisado", "info");
          } else {
            btnRevisar.disabled = false;
            ui.aviso(err.message || "Error al registrar avance del tema", "error");
          }
        } finally {
          ui.cargando(false);
        }
      });
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el tema", "error");
    contenedor.innerHTML = `
      <div class="seccion-tema">
        <div class="alerta alerta--peligro">
          <p>${ui.escapar(err.message || "Error de conexión")}</p>
        </div>
        <p><a href="/paginas/asignaturas.html" class="btn btn--secundario">← Volver a Mis asignaturas</a></p>
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

// Renderizado de recursos multimedia
function renderRecursosVisuales(recursos) {
  return recursos
    .map((r) => {
      const tipo = r.tipo || "enlace";
      const titulo = r.titulo || "Recurso";
      const url = r.url || "";

      if (tipo === "video") {
        return `
          <div class="pila" style="gap: var(--espacio-xs);">
            <strong>${ui.escapar(titulo)}</strong>
            ${obtenerEmbedVideo(url, titulo)}
          </div>
        `;
      }

      if (tipo === "pdf") {
        return `
          <a href="${ui.escapar(url)}" target="_blank" rel="noopener noreferrer" class="recurso-pdf" title="Abrir archivo PDF">
            <span>📄</span>
            <div>
              <strong>${ui.escapar(titulo)}</strong>
              <div><small class="color-texto-suave">Documento PDF (Descargar o leer en línea)</small></div>
            </div>
          </a>
        `;
      }

      if (tipo === "imagen") {
        return `
          <figure class="recurso-imagen">
            <img src="${ui.escapar(url)}" alt="${ui.escapar(titulo)}" loading="lazy">
            <figcaption class="color-texto-suave"><small>${ui.escapar(titulo)}</small></figcaption>
          </figure>
        `;
      }

      // Enlace genérico
      return `
        <a href="${ui.escapar(url)}" target="_blank" rel="noopener noreferrer" class="recurso-enlace">
          <span>🔗</span>
          <div>
            <strong>${ui.escapar(titulo)}</strong>
            <div><small class="color-texto-suave">${ui.escapar(url)}</small></div>
          </div>
        </a>
      `;
    })
    .join("");
}

// Renderizado del bloque "Practica este tema"
function renderActividadesPractica(id) {
  if (!Array.isArray(ACTIVIDADES) || ACTIVIDADES.length === 0) {
    return `<p class="color-texto-suave">Las actividades interactivas para este tema estarán disponibles próximamente.</p>`;
  }

  const items = ACTIVIDADES.map((act) => {
    const enlace = `${act.href}?temaId=${encodeURIComponent(id)}`;
    return `
      <article class="tarjeta" style="background-color: var(--color-fondo);">
        <h4>${ui.escapar(act.texto || "Actividad")}</h4>
        <p class="color-texto-suave">${ui.escapar(act.descripcion || "")}</p>
        <a href="${ui.escapar(enlace)}" class="btn btn--primario btn--pequeno" style="align-self: flex-start; margin-top: var(--espacio-xs);">
          Comenzar práctica →
        </a>
      </article>
    `;
  }).join("");

  return `<div class="actividades-grid">${items}</div>`;
}

await iniciar();
