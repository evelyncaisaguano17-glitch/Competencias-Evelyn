// publico/js/modulos/canciones.js · Reproductor y catálogo de canciones educativas con sincronización LRC
import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import api from "../nucleo/api.js";
import * as util from "../nucleo/util.js";
import * as ui from "../nucleo/ui.js";

let canciones = [];
let temas = [];
let asignaturas = [];
let unidades = [];
let mapaTemas = new Map();
let mapaUnidades = new Map();
let mapaAsignaturas = new Map();

let cancionActiva = null;
let lineasLrc = [];
let indiceLrcActivo = -1;

export function formatoTiempo(segundos) {
  if (isNaN(segundos) || segundos < 0) return "00:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== "string") return [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const lineas = [];
  const filas = lrcTexto.split("\n");

  for (const fila of filas) {
    const coincidencias = [...fila.matchAll(regex)];
    if (coincidencias.length > 0) {
      const texto = fila.replace(regex, "").trim();
      for (const m of coincidencias) {
        const min = parseInt(m[1], 10);
        const seg = parseInt(m[2], 10);
        const cent = m[3] ? parseFloat("0." + m[3]) : 0;
        const tiempo = min * 60 + seg + cent;
        lineas.push({ tiempo, texto: texto || "♪" });
      }
    }
  }

  return lineas.sort((a, b) => a.tiempo - b.tiempo);
}

export async function inicializarCanciones() {
  await montarPlantilla({ titulo: "Canciones", roles: ["sesion"] });
  const usuario = usuarioActual();

  const accionesDocente = document.getElementById("acciones-docente");
  if (accionesDocente && (usuario?.rol === "docente" || usuario?.rol === "admin")) {
    accionesDocente.style.display = "block";
  }

  const filtroAsig = document.getElementById("filtro-asignatura");
  const filtroTema = document.getElementById("filtro-tema");
  const contenedorLista = document.getElementById("lista-canciones");

  // Elementos del reproductor
  const seccionPlayer = document.getElementById("seccion-reproductor");
  const audio = document.getElementById("audio-elemento");
  const playerTema = document.getElementById("player-etiqueta-tema");
  const playerTitulo = document.getElementById("player-titulo");
  const playerAutoria = document.getElementById("player-autoria");
  const playerLicencia = document.getElementById("player-licencia");
  const btnPlayPause = document.getElementById("btn-play-pause");
  const btnReiniciar = document.getElementById("btn-reiniciar");
  const barraProgreso = document.getElementById("barra-progreso");
  const tiempoActual = document.getElementById("tiempo-actual");
  const tiempoTotal = document.getElementById("tiempo-total");
  const btnMute = document.getElementById("btn-mute");
  const barraVolumen = document.getElementById("barra-volumen");
  const badgeLrc = document.getElementById("badge-tipo-letra");
  const contenedorLetras = document.getElementById("contenedor-letras");

  ui.cargando(true);
  try {
    const [cData, tData, aData, uData] = await Promise.all([
      api.listar("canciones"),
      api.listar("temas").catch(() => []),
      api.listar("asignaturas").catch(() => []),
      api.listar("unidades").catch(() => [])
    ]);

    canciones = Array.isArray(cData) ? cData : [];
    temas = Array.isArray(tData) ? tData : [];
    asignaturas = Array.isArray(aData) ? aData : [];
    unidades = Array.isArray(uData) ? uData : [];

    mapaTemas = new Map(temas.map(t => [t.id, t]));
    mapaUnidades = new Map(unidades.map(u => [u.id, u]));
    mapaAsignaturas = new Map(asignaturas.map(a => [a.id, a]));

    // Población de selectores
    if (filtroAsig) {
      asignaturas.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.nombre;
        filtroAsig.appendChild(opt);
      });
    }

    actualizarOpcionesTemas();

    // Comprobar parámetro ?temaId=
    const temaIdParam = util.parametro("temaId");
    if (temaIdParam && mapaTemas.has(temaIdParam)) {
      const temaObj = mapaTemas.get(temaIdParam);
      const uniObj = mapaUnidades.get(temaObj.unidadId);
      if (uniObj && uniObj.asignaturaId && filtroAsig) {
        filtroAsig.value = uniObj.asignaturaId;
        actualizarOpcionesTemas();
      }
      if (filtroTema) {
        filtroTema.value = temaIdParam;
      }
    }

    renderizarLista();
  } catch (err) {
    ui.aviso("Error al cargar canciones: " + err.message, "error");
  } finally {
    ui.cargando(false);
  }

  function getAsignaturaIdDeTema(tId) {
    const t = mapaTemas.get(tId);
    if (!t) return null;
    const u = mapaUnidades.get(t.unidadId);
    return u ? u.asignaturaId : null;
  }

  function actualizarOpcionesTemas() {
    if (!filtroTema) return;
    const asigSeleccionada = filtroAsig?.value || "";
    const temaPrevio = filtroTema.value;

    filtroTema.innerHTML = `<option value="">Todos los temas</option>`;

    temas.forEach(t => {
      const asigId = getAsignaturaIdDeTema(t.id);
      if (!asigSeleccionada || asigId === asigSeleccionada) {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.titulo || `Tema ${t.id}`;
        filtroTema.appendChild(opt);
      }
    });

    if (temaPrevio && [...filtroTema.options].some(o => o.value === temaPrevio)) {
      filtroTema.value = temaPrevio;
    }
  }

  filtroAsig?.addEventListener("change", () => {
    actualizarOpcionesTemas();
    renderizarLista();
  });

  filtroTema?.addEventListener("change", () => {
    renderizarLista();
  });

  function renderizarLista() {
    if (!contenedorLista) return;

    const asigFiltro = filtroAsig?.value || "";
    const temaFiltro = filtroTema?.value || "";

    const filtradas = canciones.filter(c => {
      if (temaFiltro && c.temaId !== temaFiltro) return false;
      if (asigFiltro) {
        const asigId = getAsignaturaIdDeTema(c.temaId);
        if (asigId !== asigFiltro) return false;
      }
      return true;
    });

    if (filtradas.length === 0) {
      contenedorLista.innerHTML = `
        <div class="tarjeta pila pila--centrada" style="padding: var(--espacio-6); text-align: center;">
          <p class="texto-atenuado">No se encontraron canciones para los filtros seleccionados.</p>
        </div>
      `;
      return;
    }

    const esDocenteOAdmin = usuario?.rol === "docente" || usuario?.rol === "admin";

    contenedorLista.innerHTML = filtradas.map(c => {
      const temaObj = mapaTemas.get(c.temaId);
      const temaNombre = temaObj ? temaObj.titulo : "Tema curricular";
      const asigId = getAsignaturaIdDeTema(c.temaId);
      const asigObj = mapaAsignaturas.get(asigId);
      const asigNombre = asigObj ? asigObj.nombre : "";
      const esActiva = cancionActiva && cancionActiva.id === c.id;

      const portadaSrc = c.portada || '/recursos/subidas/d64fada8659a6b97b66ae156b182a375.jpg';
      const duracionStr = c.duracion || '2:49';
      const versionStr = c.version || c.licencia || 'V6-MINI';
      const estiloStr = c.estilo || `Educativo · ${asigNombre || 'Medicina'} · Autoría: ${c.autoria || 'Cátedra'}`;

      const btnEditar = esDocenteOAdmin ? `
        <a href="/paginas/editor-cancion.html?id=${encodeURIComponent(c.id)}" class="btn btn--fantasma btn--pequeno">Editar</a>
      ` : "";

      return `
        <article class="tarjeta-cancion ${esActiva ? 'tarjeta-cancion--activa' : ''}" data-id="${ui.escapar(c.id)}">
          <div class="cancion-cover-wrap">
            <img src="${ui.escapar(portadaSrc)}" alt="Portada de ${ui.escapar(c.titulo)}" class="cancion-cover-img" loading="lazy">
            <span class="cancion-duracion-badge">${ui.escapar(duracionStr)}</span>
          </div>

          <div class="cancion-cuerpo">
            <div class="cancion-cabecera-linea">
              <h3 class="cancion-titulo">${ui.escapar(c.titulo)}</h3>
              <span class="cancion-tag-version">${ui.escapar(versionStr)}</span>
              ${asigNombre ? `<span class="cancion-asig-tag">${ui.escapar(asigNombre)}</span>` : ''}
            </div>

            <p class="cancion-estilo-desc">${ui.escapar(estiloStr)}</p>

            <div class="cancion-acciones-barra">
              <div class="cancion-reacciones">
                <button type="button" class="btn-cancion-icon btn-cancion-like" title="Me gusta" aria-label="Me gusta">
                  <span>👍</span>
                </button>
                <button type="button" class="btn-cancion-icon btn-cancion-dislike" title="No me gusta" aria-label="No me gusta">
                  <span>👎</span>
                </button>
                <button type="button" class="btn-cancion-icon btn-cancion-share" title="Compartir" aria-label="Compartir">
                  <span>↗</span> <span>Share</span>
                </button>
              </div>

              <div class="cancion-acciones-derecha">
                ${btnEditar}
                <button type="button" class="btn btn--primario btn-escuchar-cancion" data-id="${ui.escapar(c.id)}">
                  ${esActiva && !audio.paused ? '⏸ Pausar' : '▶ Escuchar'}
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // Asignar eventos de click a botones escuchar
    contenedorLista.querySelectorAll(".btn-escuchar-cancion").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const elegida = canciones.find(c => c.id === id);
        if (elegida) {
          if (cancionActiva && cancionActiva.id === elegida.id) {
            // Alternar pausa / reproducción
            if (audio.paused) {
              audio.play();
            } else {
              audio.pause();
            }
          } else {
            cargarYReproducir(elegida);
          }
        }
      });
    });

    // Eventos para botones de reacción y compartir
    contenedorLista.querySelectorAll(".btn-cancion-like").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("btn-cancion-icon--activo");
        const dislike = btn.parentElement?.querySelector(".btn-cancion-dislike");
        if (dislike) dislike.classList.remove("btn-cancion-icon--activo");
      });
    });

    contenedorLista.querySelectorAll(".btn-cancion-dislike").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("btn-cancion-icon--activo");
        const like = btn.parentElement?.querySelector(".btn-cancion-like");
        if (like) like.classList.remove("btn-cancion-icon--activo");
      });
    });

    contenedorLista.querySelectorAll(".btn-cancion-share").forEach(btn => {
      btn.addEventListener("click", () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(window.location.href);
          ui.aviso("Enlace de la canción copiado al portapapeles", "exito");
        } else {
          ui.aviso("Comparte este enlace para escuchar la canción", "info");
        }
      });
    });
  }

  function cargarYReproducir(cancion) {
    cancionActiva = cancion;
    if (seccionPlayer) seccionPlayer.style.display = "block";

    const temaObj = mapaTemas.get(cancion.temaId);
    if (playerTema) playerTema.textContent = temaObj ? temaObj.titulo : "Tema curricular";
    if (playerTitulo) playerTitulo.textContent = cancion.titulo;
    if (playerAutoria) playerAutoria.textContent = `Autoría: ${cancion.autoria || 'No especificada'}`;
    if (playerLicencia) playerLicencia.textContent = cancion.licencia || "Propia";

    // Preparar letras
    indiceLrcActivo = -1;
    const tieneLrc = !!(cancion.lrc && cancion.lrc.trim());
    if (badgeLrc) badgeLrc.style.display = tieneLrc ? "inline-block" : "none";

    if (tieneLrc) {
      lineasLrc = parsearLRC(cancion.lrc);
      if (contenedorLetras) {
        if (lineasLrc.length > 0) {
          contenedorLetras.innerHTML = lineasLrc.map((l, i) => `
            <p class="linea-lrc" id="linea-lrc-${i}" data-tiempo="${l.tiempo}">${ui.escapar(l.texto)}</p>
          `).join("");
        } else {
          contenedorLetras.innerHTML = `<p class="texto-atenuado">${ui.escapar(cancion.lrc)}</p>`;
        }
      }
    } else if (cancion.letra && cancion.letra.trim()) {
      lineasLrc = [];
      if (contenedorLetras) {
        contenedorLetras.innerHTML = `
          <div style="white-space: pre-wrap; line-height: var(--interlineado-relajado); color: var(--color-texto);">
            ${ui.escapar(cancion.letra)}
          </div>
        `;
      }
    } else {
      lineasLrc = [];
      if (contenedorLetras) {
        contenedorLetras.innerHTML = `<p class="texto-atenuado">Esta canción no incluye letra registrada.</p>`;
      }
    }

    audio.src = cancion.audio;
    audio.play().catch(e => console.warn("Autoplay bloqueado o formato:", e));
    renderizarLista();
    seccionPlayer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Eventos del elemento de audio
  audio.addEventListener("play", () => {
    if (btnPlayPause) {
      btnPlayPause.textContent = "⏸";
      btnPlayPause.setAttribute("aria-label", "Pausar");
    }
    renderizarLista();
  });

  audio.addEventListener("pause", () => {
    if (btnPlayPause) {
      btnPlayPause.textContent = "▶";
      btnPlayPause.setAttribute("aria-label", "Reproducir");
    }
    renderizarLista();
  });

  audio.addEventListener("timeupdate", () => {
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;

    if (tiempoActual) tiempoActual.textContent = formatoTiempo(cur);
    if (barraProgreso && dur > 0) {
      barraProgreso.value = (cur / dur) * 100;
    }

    // Sincronización de letra LRC
    if (lineasLrc.length > 0) {
      let nuevoIndice = -1;
      for (let i = 0; i < lineasLrc.length; i++) {
        if (lineasLrc[i].tiempo <= cur + 0.25) {
          nuevoIndice = i;
        } else {
          break;
        }
      }

      if (nuevoIndice !== indiceLrcActivo && nuevoIndice >= 0) {
        if (indiceLrcActivo >= 0) {
          const anteriorEl = document.getElementById(`linea-lrc-${indiceLrcActivo}`);
          if (anteriorEl) anteriorEl.classList.remove("linea-lrc--activa");
        }

        indiceLrcActivo = nuevoIndice;
        const actualEl = document.getElementById(`linea-lrc-${indiceLrcActivo}`);
        if (actualEl) {
          actualEl.classList.add("linea-lrc--activa");
          actualEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (tiempoTotal) tiempoTotal.textContent = formatoTiempo(audio.duration || 0);
  });

  audio.addEventListener("ended", () => {
    if (btnPlayPause) {
      btnPlayPause.textContent = "▶";
      btnPlayPause.setAttribute("aria-label", "Reproducir");
    }
    if (barraProgreso) barraProgreso.value = 0;
  });

  // Controles de usuario
  btnPlayPause?.addEventListener("click", () => {
    if (!audio.src) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  });

  btnReiniciar?.addEventListener("click", () => {
    if (!audio.src) return;
    audio.currentTime = 0;
    audio.play();
  });

  barraProgreso?.addEventListener("input", () => {
    if (!audio.duration) return;
    const nuevoTiempo = (barraProgreso.value / 100) * audio.duration;
    audio.currentTime = nuevoTiempo;
  });

  barraVolumen?.addEventListener("input", () => {
    audio.volume = parseFloat(barraVolumen.value);
    audio.muted = false;
    if (btnMute) btnMute.textContent = audio.volume === 0 ? "🔇" : "🔊";
  });

  btnMute?.addEventListener("click", () => {
    audio.muted = !audio.muted;
    btnMute.textContent = audio.muted ? "🔇" : "🔊";
  });
}

if (typeof document !== "undefined") {
  inicializarCanciones();
}

export default { inicializarCanciones, parsearLRC, formatoTiempo };
