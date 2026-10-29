// publico/js/modulos/quiz.js · Motor del quiz formativo por niveles en el navegador
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";
import util from "../nucleo/util.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { mostrarLogros } from "../nucleo/gamificacion.js";
import { generarDiploma } from "../nucleo/pdf.js";

await montarPlantilla({ titulo: "Quiz por niveles", roles: ["estudiante"] });

const contenedor = document.getElementById("contenido");

const ICONOS_NIVELES = {
  1: "🔹",
  2: "🔷",
  3: "⭐",
  4: "🌟",
  5: "🏆"
};

const NOMBRES_BLOOM = {
  1: "Recordar",
  2: "Comprender",
  3: "Aplicar",
  4: "Analizar",
  5: "Evaluar"
};

let temaActual = null;
let estadoNiveles = [];
let sesionActiva = null;
let preguntasSesion = [];
let indicePregunta = 0;
let nivelActual = 1;
let respuestaSeleccionada = null;
let preguntaRespondida = false;

/**
 * Inicializa la página obteniendo el tema contextual o mostrando el selector curricular.
 */
async function inicializar() {
  ui.cargando(true);
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual || !temaActual.id) {
      if (contenedor) {
        contenedor.innerHTML = `
          <div class="tarjeta" style="text-align: center; padding: var(--espacio-2xl); max-width: 600px; margin: var(--espacio-2xl) auto;">
            <p class="color-texto-suave" style="font-size: var(--tamano-l); margin-bottom: var(--espacio-l);">
              No has seleccionado un tema para realizar el quiz.
            </p>
            <button type="button" class="btn btn--primario" id="btn-seleccionar-tema">
              Elegir tema de estudio
            </button>
          </div>
        `;
        document.getElementById("btn-seleccionar-tema")?.addEventListener("click", inicializar);
      }
      return;
    }

    await cargarLobbyQuiz();
  } catch (err) {
    ui.aviso(err.message || "Error al inicializar el quiz", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Carga el estado de los 5 niveles del tema y renderiza las tarjetas de nivel.
 */
async function cargarLobbyQuiz() {
  if (!contenedor || !temaActual) return;
  ui.cargando(true);

  try {
    const dataEstado = await api.llamar("GET", `/api/quiz/estado?temaId=${encodeURIComponent(temaActual.id)}`);
    estadoNiveles = dataEstado.niveles || [];

    contenedor.innerHTML = `
      <div class="pila">
        <header class="quiz-lobby-header">
          <div>
            <div style="display:flex; align-items:center; gap:var(--espacio-s); margin-bottom:var(--espacio-xs);">
              <span class="insignia insignia--primario">Quiz Formativo</span>
              <span class="color-texto-suave" style="font-size:var(--tamano-s);">Evaluación por competencias</span>
            </div>
            <h2>${ui.escapar(temaActual.titulo)}</h2>
            <p class="color-texto-suave">
              Avanza a través de los 5 niveles de la Taxonomía de Bloom. Necesitas el 70% de aciertos para aprobar y desbloquear el siguiente nivel.
            </p>
          </div>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-cambiar-tema">
            🔄 Cambiar tema
          </button>
        </header>

        <!-- Cuadrícula con las 5 tarjetas de nivel -->
        <section class="quiz-niveles-grid" aria-label="Niveles cognitivos del quiz">
          ${estadoNiveles.map(n => renderTarjetaNivel(n)).join("")}
        </section>
      </div>
    `;

    document.getElementById("btn-cambiar-tema")?.addEventListener("click", async () => {
      const nuevoTema = await obtenerTemaActividad();
      if (nuevoTema && nuevoTema.id) {
        temaActual = nuevoTema;
        await cargarLobbyQuiz();
      }
    });

    conectarEventosLobby();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar los niveles del quiz", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Genera el HTML para cada una de las 5 tarjetas de nivel cognitivo.
 */
function renderTarjetaNivel(nivelInfo) {
  const n = nivelInfo.nivel;
  const nombreBloom = nivelInfo.nombre || NOMBRES_BLOOM[n];
  const estado = nivelInfo.estado; // "bloqueado" | "disponible" | "aprobado"
  const mejorPorcentaje = Number(nivelInfo.mejorPorcentaje) || 0;
  const icono = ICONOS_NIVELES[n] || "⭐";

  let claseMod = "tarjeta-nivel--disponible";
  let badgeHtml = '<span class="insignia insignia--primario">Disponible</span>';
  let accionHtml = `
    <button type="button" class="btn btn--primario btn-iniciar-nivel" data-nivel="${n}">
      Comenzar nivel ▶
    </button>
  `;

  if (estado === "aprobado") {
    claseMod = "tarjeta-nivel--aprobado";
    badgeHtml = '<span class="insignia insignia--exito">Aprobado ✓</span>';
    accionHtml = `
      <button type="button" class="btn btn--secundario btn-iniciar-nivel" data-nivel="${n}">
        Jugar de nuevo 🔄
      </button>
      <button type="button" class="btn btn--primario btn-diploma-nivel" data-nivel="${n}">
        🎓 Descargar diploma
      </button>
    `;
  } else if (estado === "bloqueado") {
    claseMod = "tarjeta-nivel--bloqueado";
    badgeHtml = '<span class="insignia insignia--secundario">Bloqueado 🔒</span>';
    accionHtml = `
      <button type="button" class="btn btn--secundario btn-iniciar-nivel" data-nivel="${n}" disabled style="cursor:not-allowed;">
        Nivel bloqueado
      </button>
    `;
  }

  return `
    <article class="tarjeta-nivel ${claseMod}" data-nivel="${n}">
      <div class="pila" style="gap:var(--espacio-s);">
        <div class="tarjeta-nivel__cabecera">
          <div>
            <span class="tarjeta-nivel__subtitulo">NIVEL ${n}</span>
            <h3 class="tarjeta-nivel__titulo">${ui.escapar(nombreBloom)}</h3>
          </div>
          <div class="tarjeta-nivel__icono" aria-hidden="true">${icono}</div>
        </div>

        <div style="margin: var(--espacio-xs) 0;">
          ${badgeHtml}
        </div>

        <div class="tarjeta-nivel__kpis">
          <div class="tarjeta-nivel__porcentaje-fila">
            <span class="color-texto-suave">Mejor puntuación:</span>
            <strong>${mejorPorcentaje > 0 ? `${mejorPorcentaje}%` : 'Sin intentos'}</strong>
          </div>
          <div class="tarjeta-nivel__barra-fondo" role="progressbar" aria-valuenow="${mejorPorcentaje}" aria-valuemin="0" aria-valuemax="100">
            <div class="tarjeta-nivel__barra-relleno ${mejorPorcentaje >= 70 ? 'tarjeta-nivel__barra-relleno--exito' : ''}" style="width: ${mejorPorcentaje}%;"></div>
          </div>
        </div>
      </div>

      <div class="tarjeta-nivel__acciones">
        ${accionHtml}
      </div>
    </article>
  `;
}

/**
 * Conecta los eventos de clic en los botones de inicio de nivel y descarga de diplomas en el lobby.
 */
function conectarEventosLobby() {
  document.querySelectorAll(".btn-iniciar-nivel").forEach(btn => {
    btn.addEventListener("click", () => {
      const nivel = parseInt(btn.getAttribute("data-nivel"), 10);
      if (nivel) {
        iniciarNivel(nivel);
      }
    });
  });

  document.querySelectorAll(".btn-diploma-nivel").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nivel = parseInt(btn.getAttribute("data-nivel"), 10);
      if (nivel) {
        await descargarDiplomaNivel(nivel);
      }
    });
  });
}

/**
 * Descarga el diploma de acreditación del nivel especificado.
 */
async function descargarDiplomaNivel(nivel) {
  ui.cargando(true);
  try {
    await generarDiploma({
      tipo: "nivel-quiz",
      temaId: temaActual.id,
      nivel
    });
    ui.aviso(`Diploma del Nivel ${nivel} descargado exitosamente`, "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al generar diploma", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * 2. Inicia una sesión de quiz en el servidor y prepara las preguntas.
 */
async function iniciarNivel(nivel) {
  ui.cargando(true);
  try {
    const dataSesion = await api.llamar("POST", "/api/quiz/iniciar", {
      temaId: temaActual.id,
      nivel
    });

    sesionActiva = dataSesion.sesionId;
    preguntasSesion = dataSesion.preguntas || [];
    indicePregunta = 0;
    nivelActual = nivel;

    if (preguntasSesion.length === 0) {
      ui.aviso("No hay preguntas disponibles para este nivel", "advertencia");
      await cargarLobbyQuiz();
      return;
    }

    renderizarPregunta();
  } catch (err) {
    ui.aviso(err.message || "Error al iniciar el quiz", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la pregunta actual con barra de progreso y el componente correspondiente a su tipo.
 */
function renderizarPregunta() {
  if (!contenedor || indicePregunta >= preguntasSesion.length) {
    finalizarQuiz();
    return;
  }

  const pregunta = preguntasSesion[indicePregunta];
  const total = preguntasSesion.length;
  const progresoPct = Math.round(((indicePregunta) / total) * 100);

  respuestaSeleccionada = null;
  preguntaRespondida = false;

  let inputsHtml = "";
  if (pregunta.tipo === "opcion") {
    // Opción múltiple como botones de radio grandes
    const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
    inputsHtml = `
      <div class="quiz-opciones-lista" role="radiogroup" aria-label="Opciones de respuesta">
        ${opciones.map((op, idx) => `
          <label class="quiz-opcion-item" id="label-opcion-${idx}">
            <input type="radio" name="quiz-radio-opcion" value="${idx}" id="radio-opcion-${idx}">
            <span>${ui.escapar(op)}</span>
          </label>
        `).join("")}
      </div>
    `;
  } else if (pregunta.tipo === "vf") {
    // V/F como dos botones grandes
    inputsHtml = `
      <div class="quiz-vf-grid">
        <button type="button" class="quiz-vf-btn quiz-vf-btn--verdadero" id="btn-vf-verdadero" data-valor="true">
          <span style="font-size: 2rem;">✓</span>
          <span>Verdadero</span>
        </button>
        <button type="button" class="quiz-vf-btn quiz-vf-btn--falso" id="btn-vf-falso" data-valor="false">
          <span style="font-size: 2rem;">✗</span>
          <span>Falso</span>
        </button>
      </div>
    `;
  } else if (pregunta.tipo === "completar") {
    // Completar como campo de texto
    inputsHtml = `
      <div class="quiz-completar-wrapper">
        <label for="input-completar" style="font-size:var(--tamano-s); color:var(--color-texto-suave);">
          Escribe la palabra o término que completa la frase:
        </label>
        <input
          type="text"
          id="input-completar"
          class="quiz-completar-input"
          placeholder="Escribe tu respuesta aquí..."
          autocomplete="off"
          spellcheck="false"
        >
      </div>
    `;
  }

  contenedor.innerHTML = `
    <div class="quiz-jugando pila">
      <!-- Barra de progreso -->
      <div class="quiz-progreso-barra-wrapper">
        <div class="quiz-progreso-info">
          <span>Nivel ${nivelActual} · ${NOMBRES_BLOOM[nivelActual] || ''}</span>
          <span>Pregunta ${indicePregunta + 1} de ${total}</span>
        </div>
        <div class="barra-progreso" role="progressbar" aria-valuenow="${progresoPct}" aria-valuemin="0" aria-valuemax="100">
          <div class="barra-progreso__relleno" style="width: ${progresoPct}%;"></div>
        </div>
      </div>

      <!-- Tarjeta con la pregunta -->
      <article class="quiz-pregunta-card pila" aria-live="polite">
        <div class="quiz-enunciado">
          ${ui.escapar(pregunta.enunciado)}
        </div>

        <form id="form-pregunta-quiz" onsubmit="return false;">
          ${inputsHtml}
        </form>

        <div id="contenedor-retro" style="margin-top: var(--espacio-m);"></div>

        <footer class="quiz-navegacion">
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-abandonar">
            ← Salir del quiz
          </button>

          <div style="display:flex; gap:var(--espacio-s);">
            <button type="button" class="btn btn--primario" id="btn-responder" disabled>
              Responder
            </button>
            <button type="button" class="btn btn--primario" id="btn-siguiente" style="display: none;">
              ${indicePregunta === total - 1 ? 'Ver resultados finales 🏆' : 'Siguiente pregunta ▶'}
            </button>
          </div>
        </footer>
      </article>
    </div>
  `;

  conectarEventosPregunta(pregunta);
}

/**
 * Conecta los eventos de selección, respuesta y navegación de la pregunta activa.
 */
function conectarEventosPregunta(pregunta) {
  const btnResponder = document.getElementById("btn-responder");
  const btnSiguiente = document.getElementById("btn-siguiente");
  const btnAbandonar = document.getElementById("btn-abandonar");

  // Salir con confirmación
  btnAbandonar?.addEventListener("click", async () => {
    const confirmar = await ui.confirmar("¿Deseas salir del quiz? Tu progreso actual en esta sesión no se guardará.");
    if (confirmar) {
      cargarLobbyQuiz();
    }
  });

  // Control según tipo de pregunta
  if (pregunta.tipo === "opcion") {
    const radios = document.querySelectorAll('input[name="quiz-radio-opcion"]');
    radios.forEach(radio => {
      radio.addEventListener("change", () => {
        document.querySelectorAll(".quiz-opcion-item").forEach(item => item.classList.remove("quiz-opcion-item--seleccionada"));
        const parentLabel = radio.closest(".quiz-opcion-item");
        if (parentLabel) parentLabel.classList.add("quiz-opcion-item--seleccionada");
        respuestaSeleccionada = parseInt(radio.value, 10);
        if (btnResponder) btnResponder.disabled = false;
      });
    });
  } else if (pregunta.tipo === "vf") {
    const btnV = document.getElementById("btn-vf-verdadero");
    const btnF = document.getElementById("btn-vf-falso");

    btnV?.addEventListener("click", () => {
      if (preguntaRespondida) return;
      btnV.classList.add("quiz-vf-btn--seleccionado");
      btnF?.classList.remove("quiz-vf-btn--seleccionado");
      respuestaSeleccionada = true;
      if (btnResponder) btnResponder.disabled = false;
    });

    btnF?.addEventListener("click", () => {
      if (preguntaRespondida) return;
      btnF.classList.add("quiz-vf-btn--seleccionado");
      btnV?.classList.remove("quiz-vf-btn--seleccionado");
      respuestaSeleccionada = false;
      if (btnResponder) btnResponder.disabled = false;
    });
  } else if (pregunta.tipo === "completar") {
    const inputComp = document.getElementById("input-completar");
    inputComp?.focus();
    inputComp?.addEventListener("input", () => {
      const valor = inputComp.value.trim();
      respuestaSeleccionada = valor;
      if (btnResponder) btnResponder.disabled = valor.length === 0;
    });

    inputComp?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !btnResponder?.disabled && !preguntaRespondida) {
        e.preventDefault();
        responderPregunta(pregunta);
      }
    });
  }

  btnResponder?.addEventListener("click", () => {
    responderPregunta(pregunta);
  });

  btnSiguiente?.addEventListener("click", () => {
    indicePregunta++;
    renderizarPregunta();
  });
}

/**
 * Envía la respuesta al servidor y muestra la retroalimentación inmediata.
 */
async function responderPregunta(pregunta) {
  if (preguntaRespondida || respuestaSeleccionada === null || respuestaSeleccionada === undefined) return;

  const btnResponder = document.getElementById("btn-responder");
  const btnSiguiente = document.getElementById("btn-siguiente");
  ui.cargando(true);

  try {
    const res = await api.llamar("POST", "/api/quiz/responder", {
      sesionId: sesionActiva,
      preguntaId: pregunta.id,
      respuesta: respuestaSeleccionada
    });

    preguntaRespondida = true;

    // Deshabilitar entradas
    document.querySelectorAll('input[name="quiz-radio-opcion"]').forEach(r => r.disabled = true);
    document.querySelectorAll(".quiz-vf-btn").forEach(b => b.disabled = true);
    const inputComp = document.getElementById("input-completar");
    if (inputComp) inputComp.disabled = true;

    // Mostrar panel de retroalimentación inmediata (.retro)
    mostrarRetro({
      correcto: res.correcto,
      explicacion: res.retroalimentacion,
      sugerencia: res.correcto ? "" : `Respuesta correcta: ${res.correcta}`,
      contenedor: "#contenedor-retro"
    });

    if (btnResponder) btnResponder.style.display = "none";
    if (btnSiguiente) {
      btnSiguiente.style.display = "inline-flex";
      btnSiguiente.focus();
    }
  } catch (err) {
    ui.aviso(err.message || "Error al registrar la respuesta", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * 3. Finaliza el quiz, calcula resultados, muestra logros y diplomas.
 */
async function finalizarQuiz() {
  ui.cargando(true);
  try {
    const fin = await api.llamar("POST", "/api/quiz/finalizar", {
      sesionId: sesionActiva
    });

    // Mostrar modal estándar de resumen
    await mostrarResumen({
      titulo: fin.aprobado ? `¡Nivel ${nivelActual} Aprobado!` : `Nivel ${nivelActual} No Superado`,
      aciertos: fin.aciertos,
      errores: fin.total - fin.aciertos,
      recomendaciones: fin.repasar || [],
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
    });

    // Si aprobó, celebrar con logros ganados e insignias
    if (fin.aprobado) {
      await mostrarLogros({
        puntosGanados: fin.puntosGanados,
        insigniasNuevas: fin.insigniasNuevas
      });
    }

    renderizarPantallaFinal(fin);
  } catch (err) {
    ui.aviso(err.message || "Error al finalizar el quiz", "error");
    await cargarLobbyQuiz();
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la pantalla de resultados con descarga de diploma o reintento.
 */
function renderizarPantallaFinal(fin) {
  if (!contenedor) return;

  const aprobado = fin.aprobado;
  const porcentaje = fin.porcentaje;

  contenedor.innerHTML = `
    <section class="quiz-resultado-card pila" aria-live="polite">
      <div class="quiz-resultado-insignia" aria-hidden="true">
        ${aprobado ? '🏆' : '📚'}
      </div>

      <h2>${aprobado ? `¡Felicitaciones! Nivel ${nivelActual} Completado` : `Buen intento en Nivel ${nivelActual}`}</h2>

      <div class="quiz-resultado-porcentaje ${aprobado ? 'quiz-resultado-porcentaje--aprobado' : 'quiz-resultado-porcentaje--reprobado'}">
        ${porcentaje}%
      </div>

      <p class="color-texto-suave">
        Respondiste correctamente <strong>${fin.aciertos} de ${fin.total}</strong> preguntas.
        ${aprobado ? 'Has cumplido el requisito de aprobación del 70%.' : 'Se requiere al menos el 70% de aciertos para aprobar este nivel.'}
      </p>

      ${!aprobado && Array.isArray(fin.repasar) && fin.repasar.length > 0 ? `
        <div class="quiz-repasar-lista">
          <strong>Recomendaciones para repasar:</strong>
          <ul>
            ${fin.repasar.map(r => `<li>${ui.escapar(r)}</li>`).join("")}
          </ul>
        </div>
      ` : ''}

      <div class="fila" style="justify-content: center; gap: var(--espacio-m); margin-top: var(--espacio-l); flex-wrap: wrap;">
        ${aprobado ? `
          <button type="button" class="btn btn--primario" id="btn-final-diploma">
            🎓 Descargar diploma (PDF)
          </button>
          ${nivelActual < 5 ? `
            <button type="button" class="btn btn--secundario" id="btn-siguiente-nivel">
              Siguiente Nivel (${nivelActual + 1}) ▶
            </button>
          ` : ''}
        ` : `
          <button type="button" class="btn btn--primario" id="btn-reintentar-nivel">
            🔄 Reintentar con preguntas nuevas
          </button>
        `}
        <button type="button" class="btn btn--secundario" id="btn-volver-lobby">
          Ver todos los niveles
        </button>
      </div>
    </section>
  `;

  document.getElementById("btn-final-diploma")?.addEventListener("click", async () => {
    await descargarDiplomaNivel(nivelActual);
  });

  document.getElementById("btn-siguiente-nivel")?.addEventListener("click", () => {
    iniciarNivel(nivelActual + 1);
  });

  document.getElementById("btn-reintentar-nivel")?.addEventListener("click", () => {
    iniciarNivel(nivelActual);
  });

  document.getElementById("btn-volver-lobby")?.addEventListener("click", () => {
    cargarLobbyQuiz();
  });
}

// Iniciar aplicación
inicializar();
