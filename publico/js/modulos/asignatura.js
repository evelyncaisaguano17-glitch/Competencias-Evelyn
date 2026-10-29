// publico/js/modulos/asignatura.js · Vista detallada de asignatura con Tutor Virtual Socrático
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";
import { calcularAvance } from "./asignaturas.js";

await montarPlantilla({
  titulo: "Asignatura",
  roles: ["estudiante", "docente"]
});

const contenedor = document.getElementById("contenido");
const asignaturaId = util.parametro("id");

if (!asignaturaId) {
  contenedor.innerHTML = `
    <div class="seccion-asignatura">
      <div class="alerta alerta--peligro">
        <p>No se especificó un identificador de asignatura (?id=...).</p>
      </div>
      <p><a href="/paginas/asignaturas.html" class="btn btn--secundario">← Volver a Mis asignaturas</a></p>
    </div>
  `;
  throw new Error("asignaturaId no especificado en URL");
}

let historialChat = [];
let enviandoMensaje = false;

async function iniciar() {
  try {
    ui.cargando(true);

    const [asignatura, todasUnidades, todosTemas, progreso, avance] = await Promise.all([
      api.obtener("asignaturas", asignaturaId),
      api.listar("unidades", { asignaturaId }),
      api.listar("temas"),
      api.listar("progreso-temas"),
      calcularAvance(asignaturaId)
    ]);

    if (!asignatura) {
      contenedor.innerHTML = `
        <div class="seccion-asignatura">
          <div class="alerta alerta--peligro">
            <p>La asignatura solicitada no existe o no tienes acceso a ella.</p>
          </div>
          <p><a href="/paginas/asignaturas.html" class="btn btn--secundario">← Volver a Mis asignaturas</a></p>
        </div>
      `;
      return;
    }

    // Filtrar unidades visibles ordenadas por orden
    const unidadesVisibles = (Array.isArray(todasUnidades) ? todasUnidades : [])
      .filter((u) => u && u.visible !== false)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    // Mapa de temas publicados por unidad
    const setRevisados = new Set(
      Array.isArray(progreso) ? progreso.map((p) => p && p.temaId).filter(Boolean) : []
    );

    const temasPorUnidad = new Map();
    const listaTemasAsignatura = [];
    if (Array.isArray(todosTemas)) {
      const idsUnidades = new Set(unidadesVisibles.map((u) => u.id));
      for (const t of todosTemas) {
        if (t && t.unidadId && idsUnidades.has(t.unidadId) && t.estado === "publicado") {
          if (!temasPorUnidad.has(t.unidadId)) {
            temasPorUnidad.set(t.unidadId, []);
          }
          temasPorUnidad.get(t.unidadId).push(t);
          listaTemasAsignatura.push(t);
        }
      }
    }

    // Ordenar temas en cada unidad
    for (const [, lista] of temasPorUnidad.entries()) {
      lista.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    }

    // Extraer preguntas sugeridas desde las preguntas guía de los temas
    const preguntasSugeridas = [];
    for (const t of listaTemasAsignatura) {
      if (Array.isArray(t.preguntasGuia)) {
        for (const p of t.preguntasGuia) {
          if (p && typeof p === "string" && !preguntasSugeridas.includes(p)) {
            preguntasSugeridas.push(p.trim());
          }
        }
      }
    }
    // Si no hay suficientes preguntasGuia, agregar preguntas de exploración curricular
    if (preguntasSugeridas.length === 0) {
      for (const t of listaTemasAsignatura.slice(0, 3)) {
        preguntasSugeridas.push(`¿Por qué es fundamental dominar el tema "${t.titulo}"?`);
      }
    }

    const pct = avance.porcentaje || 0;
    const descHtml = asignatura.descripcion
      ? `<p>${ui.escapar(asignatura.descripcion)}</p>`
      : `<p class="color-texto-suave"><em>Sin descripción registrada.</em></p>`;

    // Recuperar historial guardado en sessionStorage de esta asignatura
    try {
      const guardado = sessionStorage.getItem(`tutor_chat_${asignaturaId}`);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed) && parsed.length > 0) {
          historialChat = parsed;
        }
      }
    } catch {}

    // Si está vacío, iniciar con mensaje socrático de bienvenida
    if (historialChat.length === 0) {
      historialChat.push({
        rol: "tutor",
        texto: `¡Hola! Soy tu **Tutor Virtual Socrático** en **${asignatura.nombre || 'esta asignatura'}** 🦉.\n\nMi labor pedagógica no es entregarte respuestas directas ni soluciones automáticas, sino guiarte mediante preguntas orientadoras, pistas y análisis crítico para que descubras el conocimiento por ti mismo.\n\n¿Qué concepto, duda o tema curricular deseas comenzar a explorar hoy?`,
        hora: util.fechaRelativa(new Date().toISOString())
      });
    }

    contenedor.innerHTML = `
      <div class="seccion-asignatura">
        <!-- Migas de pan -->
        <nav class="migas-pan" aria-label="Ruta de navegación">
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">${ui.escapar(asignatura.nombre || 'Asignatura')}</span>
        </nav>

        <!-- Cabecera hero de la materia -->
        <header class="asignatura-hero">
          <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-s);">
            <div>
              <span class="insignia insignia--primario" style="margin-bottom: var(--espacio-xs);">
                ${ui.escapar(asignatura.nivel || "General")}
              </span>
              <h2>${ui.escapar(asignatura.nombre || "Sin título")}</h2>
            </div>
            <div style="display:flex; gap:var(--espacio-s); align-items:center;">
              <a href="/paginas/quiz.html?temaId=${encodeURIComponent(listaTemasAsignatura[0]?.id || '')}" class="btn btn--primario btn--pequeno">
                🎯 Quiz formativo
              </a>
              <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno">
                ← Mis asignaturas
              </a>
            </div>
          </div>

          ${descHtml}

          <!-- Avance general -->
          <div class="pila" style="gap: 6px; margin-top: var(--espacio-xs);">
            <div class="fila" style="justify-content: space-between; font-size: var(--tamano-s); color: var(--color-texto-suave);">
              <strong>Avance general del curso: ${pct}%</strong>
              <span>${avance.revisados} de ${avance.total} temas revisados</span>
            </div>
            <div class="barra-avance" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
              <div class="barra-avance__relleno ${pct >= 100 ? 'barra-avance__relleno--completo' : ''}" style="width: ${pct}%;"></div>
            </div>
          </div>
        </header>

        <!-- Layout vertical: Temario arriba y Tutor Socrático abajo -->
        <div class="asignatura-layout">
          <!-- Columna Izquierda: Unidades y temas -->
          <section id="panel-temario" class="asignatura-columna-temario" aria-label="Unidades y temas del curso">
            <div class="asignatura-unidades-lista">
              ${renderUnidades(unidadesVisibles, temasPorUnidad, setRevisados)}
            </div>
          </section>

          <!-- Columna Derecha: Tutor Socrático Interactivo -->
          <aside id="panel-tutor" class="asignatura-columna-tutor" aria-label="Tutor socrático inteligente">
            <div class="tutor-panel">
              <!-- Cabecera del chat -->
              <header class="tutor-panel__cabecera">
                <div class="tutor-panel__perfil">
                  <div class="tutor-panel__avatar" aria-hidden="true">🦉</div>
                  <div>
                    <h3 class="tutor-panel__titulo">Tutor Virtual Socrático</h3>
                    <div class="tutor-panel__subtitulo">
                      <span class="tutor-panel__indicador-online" aria-hidden="true"></span>
                      <span>En línea · ${ui.escapar(asignatura.nombre)}</span>
                    </div>
                  </div>
                </div>
                <div class="tutor-panel__acciones-cabecera">
                  <button type="button" class="btn btn--fantasma btn--pequeno" id="btn-limpiar-chat" title="Reiniciar conversación socrática" aria-label="Nueva consulta socrática">
                    🔄 Nueva consulta
                  </button>
                </div>
              </header>

              <!-- Píldoras de sugerencias curriculares rápidas -->
              ${preguntasSugeridas.length > 0 ? `
                <div class="tutor-panel__sugerencias-wrapper">
                  <span class="tutor-panel__sugerencias-label">💡 Sugerencias para reflexionar:</span>
                  <div class="tutor-panel__sugerencias-scroll" role="list">
                    ${preguntasSugeridas.slice(0, 4).map((p) => `
                      <button type="button" class="tutor-pildora" data-pregunta="${ui.escapar(p)}" role="listitem">
                        ${ui.escapar(p)}
                      </button>
                    `).join("")}
                  </div>
                </div>
              ` : ''}

              <!-- Área de mensajes del chat -->
              <div class="tutor-panel__mensajes" id="tutor-mensajes-lista" role="log" aria-live="polite" aria-relevant="additions">
                ${renderHistorialMensajes()}
              </div>

              <!-- Indicador de pensamiento socrático -->
              <div id="tutor-indicador-pensando" class="tutor-pensando" style="display: none;" aria-live="polite">
                <span class="tutor-pensando__avatar">🦉</span>
                <div class="tutor-pensando__burbuja">
                  <span>El tutor socrático está formulando una pregunta orientadora</span>
                  <span class="tutor-pensando__puntos">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              </div>

              <!-- Formulario de entrada de mensaje -->
              <form id="form-tutor-chat" class="tutor-panel__formulario" onsubmit="return false;">
                <label for="input-tutor-mensaje" class="sr-only">Escribe tu consulta socrática</label>
                <textarea
                  id="input-tutor-mensaje"
                  class="tutor-panel__input"
                  placeholder="Escribe tu razonamiento o pregunta sobre ${ui.escapar(asignatura.nombre)}..."
                  rows="2"
                  maxlength="1000"
                  aria-label="Mensaje para el tutor socrático"
                ></textarea>
                <div class="tutor-panel__barra-inferior">
                  <span class="tutor-panel__ayuda-tecla color-texto-suave" style="font-size: var(--tamano-xs);">
                    Presiona <kbd>Enter</kbd> para enviar
                  </span>
                  <button type="submit" class="btn btn--primario btn--pequeno" id="btn-enviar-tutor" aria-label="Enviar mensaje">
                    <span>Enviar</span>
                    <span aria-hidden="true">➤</span>
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      </div>
    `;

    conectarEventosTutor(asignatura);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la asignatura", "error");
    contenedor.innerHTML = `
      <div class="seccion-asignatura">
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

/**
 * Renderiza la lista de unidades y temas.
 */
function renderUnidades(unidades, temasPorUnidad, setRevisados) {
  if (unidades.length === 0) {
    return `
      <div class="alerta alerta--info">
        <p>Esta asignatura no tiene unidades disponibles o visibles en este momento.</p>
      </div>
    `;
  }

  return unidades
    .map((u, i) => {
      const temas = temasPorUnidad.get(u.id) || [];
      const numTemas = temas.length;

      let cuerpoTemasHtml = "";
      if (numTemas === 0) {
        cuerpoTemasHtml = `<p class="color-texto-suave" style="padding: var(--espacio-l); text-align: center;">No hay temas publicados en esta unidad.</p>`;
      } else {
        const filas = temas
          .map((t, idx) => {
            const estaRevisado = setRevisados.has(t.id);
            return `
              <li class="tema-fila">
                <div class="tema-fila__info">
                  <span class="tema-fila__orden">${t.orden || idx + 1}</span>
                  <div>
                    <strong>${ui.escapar(t.titulo || "Sin título")}</strong>
                  </div>
                </div>

                <div class="tema-fila__acciones">
                  <span class="insignia ${estaRevisado ? 'insignia--exito' : 'insignia--secundario'}">
                    ${estaRevisado ? 'Revisado ✓' : 'Pendiente'}
                  </span>
                  <a
                    href="/paginas/tema.html?id=${encodeURIComponent(t.id)}"
                    class="btn btn--secundario btn--pequeno"
                  >
                    Ver tema →
                  </a>
                </div>
              </li>
            `;
          })
          .join("");

        cuerpoTemasHtml = `<ul class="temas-lista">${filas}</ul>`;
      }

      return `
        <section class="unidad-bloque" aria-labelledby="unidad-titulo-${u.id}">
          <header class="unidad-bloque__cabecera">
            <h3 id="unidad-titulo-${u.id}" class="unidad-bloque__titulo">
              <span class="insignia insignia--secundario">Unidad ${u.orden || i + 1}</span>
              <span>${ui.escapar(u.titulo || "Sin título")}</span>
            </h3>
            <span class="color-texto-suave" style="font-size: var(--tamano-s);">
              ${numTemas} ${numTemas === 1 ? 'tema' : 'temas'}
            </span>
          </header>
          ${cuerpoTemasHtml}
        </section>
      `;
    })
    .join("");
}

/**
 * Genera el HTML de los mensajes guardados en el historial.
 */
function renderHistorialMensajes() {
  return historialChat.map((m) => renderBurbujaMensaje(m)).join("");
}

/**
 * Renderiza una burbuja individual de mensaje (estudiante o tutor).
 */
function renderBurbujaMensaje(m) {
  const esTutor = m.rol === "tutor";
  const claseBurbuja = esTutor ? "tutor-mensaje--tutor" : "tutor-mensaje--estudiante";
  const avatarIcono = esTutor ? "🦉" : "👤";
  const remitente = esTutor ? "Tutor Socrático" : "Tú";
  const horaTexto = m.hora || util.fechaRelativa(new Date().toISOString());

  // Formato seguro con util.formatoBasico()
  const contenidoHtml = util.formatoBasico(m.texto);

  return `
    <div class="tutor-mensaje ${claseBurbuja}">
      <div class="tutor-mensaje__avatar" aria-hidden="true">${avatarIcono}</div>
      <div class="tutor-mensaje__cuerpo">
        <div class="tutor-mensaje__meta">
          <span class="tutor-mensaje__remitente">${ui.escapar(remitente)}</span>
          <span class="tutor-mensaje__hora">${ui.escapar(horaTexto)}</span>
        </div>
        <div class="tutor-mensaje__texto">
          ${contenidoHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Conecta los eventos de interactividad del chat del tutor socrático.
 */
function conectarEventosTutor(asignatura) {
  const form = document.getElementById("form-tutor-chat");
  const textarea = document.getElementById("input-tutor-mensaje");
  const btnEnviar = document.getElementById("btn-enviar-tutor");
  const btnLimpiar = document.getElementById("btn-limpiar-chat");
  const contenedorMensajes = document.getElementById("tutor-mensajes-lista");

  // Scroll inicial al final del historial
  scrollChatAlFinal();

  // Enviar con Enter (sin Shift)
  textarea?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form?.dispatchEvent(new Event("submit"));
    }
  });

  // Envío del formulario
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (enviandoMensaje || !textarea) return;

    const texto = textarea.value.trim();
    if (!texto) return;

    textarea.value = "";
    await procesarEnvioPregunta(texto, asignatura);
  });

  // Píldoras de preguntas sugeridas
  document.querySelectorAll(".tutor-pildora").forEach((pildora) => {
    pildora.addEventListener("click", async () => {
      const pregunta = pildora.getAttribute("data-pregunta");
      if (pregunta && !enviandoMensaje) {
        await procesarEnvioPregunta(pregunta, asignatura);
      }
    });
  });

  // Botón de limpiar chat
  btnLimpiar?.addEventListener("click", async () => {
    const confirmar = await ui.confirmar("¿Deseas reiniciar la conversación con el tutor socrático?");
    if (confirmar) {
      historialChat = [
        {
          rol: "tutor",
          texto: `¡Conversación reiniciada! ¿Qué concepto o inquietud de **${asignatura.nombre}** te gustaría examinar ahora?`,
          hora: util.fechaRelativa(new Date().toISOString())
        }
      ];
      try {
        sessionStorage.removeItem(`tutor_chat_${asignaturaId}`);
      } catch {}
      if (contenedorMensajes) {
        contenedorMensajes.innerHTML = renderHistorialMensajes();
        scrollChatAlFinal();
      }
      ui.aviso("Conversación socrática reiniciada", "info");
      textarea?.focus();
    }
  });
}

/**
 * Procesa el envío de una pregunta al Tutor Socrático y actualiza la interfaz.
 */
async function procesarEnvioPregunta(texto, asignatura) {
  const textarea = document.getElementById("input-tutor-mensaje");
  const btnEnviar = document.getElementById("btn-enviar-tutor");
  const contenedorMensajes = document.getElementById("tutor-mensajes-lista");
  const indicadorPensando = document.getElementById("tutor-indicador-pensando");

  enviandoMensaje = true;
  if (btnEnviar) btnEnviar.disabled = true;
  if (textarea) textarea.disabled = true;

  // 1. Agregar mensaje del estudiante a la UI y al historial
  const nuevoMensajeEstudiante = {
    rol: "estudiante",
    texto,
    hora: util.fechaRelativa(new Date().toISOString())
  };
  historialChat.push(nuevoMensajeEstudiante);

  if (contenedorMensajes) {
    contenedorMensajes.insertAdjacentHTML("beforeend", renderBurbujaMensaje(nuevoMensajeEstudiante));
    scrollChatAlFinal();
  }

  // 2. Mostrar indicador de pensamiento socrático
  if (indicadorPensando) {
    indicadorPensando.style.display = "flex";
    scrollChatAlFinal();
  }

  try {
    // 3. Invocar al tutor socrático en el servidor usando api.ia()
    const respuestaIA = await api.ia("tutor", {
      asignaturaId: asignatura.id,
      mensaje: texto,
      historial: historialChat
    });

    const textoRespuesta = typeof respuestaIA === "string"
      ? respuestaIA
      : (respuestaIA?.respuesta || respuestaIA?.texto || "No se pudo obtener respuesta del tutor socrático.");

    // 4. Agregar respuesta del tutor a la UI y al historial
    const nuevoMensajeTutor = {
      rol: "tutor",
      texto: textoRespuesta,
      hora: util.fechaRelativa(new Date().toISOString())
    };
    historialChat.push(nuevoMensajeTutor);

    // 5. Persistir en sessionStorage
    try {
      sessionStorage.setItem(`tutor_chat_${asignaturaId}`, JSON.stringify(historialChat));
    } catch {}

    if (contenedorMensajes) {
      contenedorMensajes.insertAdjacentHTML("beforeend", renderBurbujaMensaje(nuevoMensajeTutor));
    }
  } catch (err) {
    console.error("Error al consultar al tutor socrático:", err);
    const mensajeError = err.message || "Error al conectar con el tutor socrático";

    const errorBurbuja = {
      rol: "tutor",
      texto: `⚠️ *No pude procesar tu consulta:* ${mensajeError}. Por favor intenta de nuevo.`,
      hora: util.fechaRelativa(new Date().toISOString())
    };
    historialChat.push(errorBurbuja);

    if (contenedorMensajes) {
      contenedorMensajes.insertAdjacentHTML("beforeend", renderBurbujaMensaje(errorBurbuja));
    }
    ui.aviso(mensajeError, "error");
  } finally {
    // Ocultar indicador de pensamiento y reactivar formulario
    if (indicadorPensando) {
      indicadorPensando.style.display = "none";
    }
    enviandoMensaje = false;
    if (btnEnviar) btnEnviar.disabled = false;
    if (textarea) {
      textarea.disabled = false;
      textarea.focus();
    }
    scrollChatAlFinal();
  }
}

/**
 * Desplaza suavemente el área de mensajes del chat hacia el final.
 */
function scrollChatAlFinal() {
  const contenedorMensajes = document.getElementById("tutor-mensajes-lista");
  if (contenedorMensajes) {
    setTimeout(() => {
      contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }, 50);
  }
}

await iniciar();
