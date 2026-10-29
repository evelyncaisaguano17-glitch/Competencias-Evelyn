// publico/js/modulos/editor-tema.js · Ficha del tema y glosario curricular
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Ficha del Tema",
  roles: ["docente", "admin"]
});

const contenedor = document.getElementById("contenido");
const temaId = util.parametro("id");

if (!temaId) {
  contenedor.innerHTML = `
    <div class="editor-tema">
      <div class="alerta alerta--peligro">
        <p>No se especificó un identificador de tema válido (?id=...).</p>
      </div>
      <p><a href="/paginas/editor-contenidos.html" class="btn btn--secundario">← Volver a Contenidos</a></p>
    </div>
  `;
  throw new Error("temaId no especificado en URL");
}

// Estado del módulo
let datosTema = null;
let listaGlosario = [];
let hayCambiosSinGuardar = false;

// Helper: Contador de palabras
function contarPalabras(texto) {
  if (!texto || typeof texto !== "string") return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

// Marcar cambios sin guardar
function marcarCambio() {
  hayCambiosSinGuardar = true;
  actualizarEstadoBotonGuardar();
}

function desmarcarCambio() {
  hayCambiosSinGuardar = false;
  actualizarEstadoBotonGuardar();
}

function actualizarEstadoBotonGuardar() {
  const btnGuardar = document.getElementById("btn-guardar-tema");
  if (btnGuardar) {
    if (hayCambiosSinGuardar) {
      btnGuardar.classList.remove("btn--secundario");
      btnGuardar.classList.add("btn--primario");
      btnGuardar.innerHTML = "Guardar cambios *";
    } else {
      btnGuardar.innerHTML = "Guardar cambios";
    }
  }
}

// Advertencia al abandonar la página con cambios pendientes
window.addEventListener("beforeunload", (e) => {
  if (hayCambiosSinGuardar) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Cargar datos iniciales del tema y del glosario
async function cargarDatos() {
  try {
    ui.cargando(true);
    const [temaRes, glosarioRes] = await Promise.all([
      api.obtener("temas", temaId),
      api.listar("glosario", { temaId })
    ]);

    datosTema = temaRes;
    listaGlosario = Array.isArray(glosarioRes) ? glosarioRes : [];
    desmarcarCambio();
    renderizarTodo();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la información del tema", "error");
    contenedor.innerHTML = `
      <div class="editor-tema">
        <div class="alerta alerta--peligro">
          <p>${ui.escapar(err.message || "Error al cargar tema")}</p>
        </div>
        <p><a href="/paginas/editor-contenidos.html" class="btn btn--secundario">← Volver a Contenidos</a></p>
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

// Renderizado principal
function renderizarTodo() {
  if (!datosTema) return;

  const objetivos = Array.isArray(datosTema.objetivos) ? datosTema.objetivos : [];
  const ejemplos = Array.isArray(datosTema.ejemplos) ? datosTema.ejemplos : [];
  const errores = Array.isArray(datosTema.erroresFrecuentes) ? datosTema.erroresFrecuentes : [];
  const preguntas = Array.isArray(datosTema.preguntasGuia) ? datosTema.preguntasGuia : [];
  const recursos = Array.isArray(datosTema.recursos) ? datosTema.recursos : [];
  const palabrasClave = Array.isArray(datosTema.palabrasClave)
    ? datosTema.palabrasClave.join(", ")
    : (datosTema.palabrasClave || "");

  const numPalabrasResumen = contarPalabras(datosTema.resumen || "");

  contenedor.innerHTML = `
    <div class="editor-tema">
      <!-- Barra superior de navegación y guardado -->
      <nav class="editor-tema__navegacion" aria-label="Navegación de tema">
        <a href="/paginas/editor-contenidos.html" class="btn btn--secundario" id="enlace-volver-contenidos">
          ← Volver a Contenidos
        </a>
        <div class="editor-tema__barra-acciones">
          <!-- Botón #btn-generar-ia activado en P07.2 (antes disabled) -->
          <button
            type="button"
            id="btn-generar-ia"
            class="btn btn--secundario"
            title="Generar términos con IA"
          >
            Generar con IA
          </button>
          <button type="button" id="btn-guardar-tema" class="btn btn--primario">
            Guardar cambios
          </button>
        </div>
      </nav>

      <!-- SECCIÓN 1: FICHA PEDAGÓGICA DEL TEMA -->
      <form id="form-ficha-tema" class="editor-tema__seccion" novalidate>
        <div class="editor-tema__seccion-titulo">
          <span>Ficha Pedagógica del Tema</span>
          <span class="insignia ${datosTema.estado === 'publicado' ? 'insignia--exito' : 'insignia--advertencia'}" id="badge-estado-tema">
            ${datosTema.estado === 'publicado' ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        <div class="editor-tema__grid editor-tema__grid--3col">
          <div class="campo" style="grid-column: 1 / -1;">
            <label for="tema-titulo">Título del tema <span aria-hidden="true">*</span></label>
            <input
              type="text"
              id="tema-titulo"
              required
              value="${ui.escapar(datosTema.titulo || '')}"
              placeholder="Ej. Estrategias de Búsqueda Avanzada"
            >
          </div>

          <div class="campo">
            <label for="tema-dificultad">Dificultad</label>
            <select id="tema-dificultad">
              <option value="básico" ${datosTema.dificultad === 'básico' ? 'selected' : ''}>Básico</option>
              <option value="intermedio" ${!datosTema.dificultad || datosTema.dificultad === 'intermedio' ? 'selected' : ''}>Intermedio</option>
              <option value="avanzado" ${datosTema.dificultad === 'avanzado' ? 'selected' : ''}>Avanzado</option>
            </select>
          </div>

          <div class="campo">
            <label for="tema-estado">Estado de publicación</label>
            <select id="tema-estado">
              <option value="borrador" ${datosTema.estado !== 'publicado' ? 'selected' : ''}>Borrador</option>
              <option value="publicado" ${datosTema.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
            </select>
          </div>

          <div class="campo">
            <label for="tema-palabras-clave">Palabras clave (separadas por comas)</label>
            <input
              type="text"
              id="tema-palabras-clave"
              value="${ui.escapar(palabrasClave)}"
              placeholder="Ej. internet, búsqueda, filtros, booleanos"
            >
          </div>
        </div>

        <!-- Resumen con contador y formato básico -->
        <div class="campo resumen-contenedor">
          <div class="resumen-meta">
            <label for="tema-resumen"><strong>Resumen curricular</strong> (admite formato básico: negritas con ** y listas con - )</label>
            <div>
              <span id="contador-palabras-resumen" class="${numPalabrasResumen >= 300 && numPalabrasResumen <= 800 ? 'insignia insignia--exito' : 'insignia insignia--secundario'}">
                ${numPalabrasResumen} palabras (recomendado: 300 a 800)
              </span>
              <button type="button" id="btn-toggle-preview" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-xs);">
                Vista previa
              </button>
            </div>
          </div>
          <textarea id="tema-resumen" rows="8" placeholder="Escribe el resumen del tema pedagógico...">${ui.escapar(datosTema.resumen || '')}</textarea>
          <div id="tema-resumen-preview" class="resumen-preview oculto" aria-live="polite"></div>
        </div>

        <!-- Listas dinámicas -->
        <div class="editor-tema__grid editor-tema__grid--2col">
          <!-- Objetivos -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label><strong>Objetivos de aprendizaje</strong></label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-agregar-objetivo">+ Agregar</button>
            </div>
            <ul id="lista-objetivos" class="lista-dinamica">
              ${renderItemsListaDinamica(objetivos, "objetivo")}
            </ul>
          </div>

          <!-- Ejemplos -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label><strong>Ejemplos prácticos</strong></label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-agregar-ejemplo">+ Agregar</button>
            </div>
            <ul id="lista-ejemplos" class="lista-dinamica">
              ${renderItemsListaDinamica(ejemplos, "ejemplo")}
            </ul>
          </div>

          <!-- Errores frecuentes -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label><strong>Errores frecuentes</strong></label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-agregar-error">+ Agregar</button>
            </div>
            <ul id="lista-errores" class="lista-dinamica">
              ${renderItemsListaDinamica(errores, "error")}
            </ul>
          </div>

          <!-- Preguntas guía -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label><strong>Preguntas guía para reflexión</strong></label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-agregar-pregunta">+ Agregar</button>
            </div>
            <ul id="lista-preguntas" class="lista-dinamica">
              ${renderItemsListaDinamica(preguntas, "pregunta")}
            </ul>
          </div>
        </div>

        <!-- Recursos -->
        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-xs);">
            <label><strong>Recursos multimedia y enlaces</strong></label>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-agregar-recurso">+ Agregar Recurso</button>
          </div>
          <div id="lista-recursos" class="recursos-lista">
            ${renderRecursos(recursos)}
          </div>
        </div>

        <!-- Fuentes -->
        <div class="campo">
          <label for="tema-fuentes">Fuentes y referencias bibliográficas</label>
          <textarea id="tema-fuentes" rows="3" placeholder="Referencias bibliográficas, normas APA, libros o sitios consultados...">${ui.escapar(datosTema.fuentes || '')}</textarea>
        </div>
      </form>

      <!-- SECCIÓN 2: GLOSARIO DE TÉRMINOS -->
      <section class="editor-tema__seccion" aria-labelledby="titulo-glosario">
        <div class="editor-tema__seccion-titulo">
          <span id="titulo-glosario">Glosario de Términos</span>
          <button type="button" class="btn btn--primario btn--pequeno" id="btn-nuevo-termino">
            + Nuevo Término
          </button>
        </div>

        <!-- Métricas del glosario -->
        <div class="glosario-metricas" id="metricas-glosario">
          ${renderMetricasGlosario()}
        </div>

        <!-- Tabla editable de glosario -->
        <div class="glosario-tabla-contenedor">
          <table class="tabla" style="width: 100%;">
            <thead>
              <tr>
                <th style="width: 15%;">Término</th>
                <th style="width: 35%;">Definición (máx. 25 pal.)</th>
                <th style="width: 20%;">Pista (máx. 10 pal.)</th>
                <th style="width: 15%;">Retroalimentación</th>
                <th style="width: 7%; text-align: center;">6 Letras</th>
                <th style="width: 8%; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpo-tabla-glosario">
              ${renderFilasGlosario()}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  conectarEventosFicha();
}

// Render items de listas dinámicas
function renderItemsListaDinamica(items, tipo) {
  if (!items || items.length === 0) {
    return `<li class="item-dinamico"><input type="text" class="input-${tipo}" placeholder="Escribe un elemento..."><button type="button" class="btn btn--peligro btn-orden btn-quitar-item" aria-label="Quitar">×</button></li>`;
  }
  return items
    .map(
      (it) => `
        <li class="item-dinamico">
          <input type="text" class="input-${tipo}" value="${ui.escapar(it)}" placeholder="Escribe un elemento...">
          <button type="button" class="btn btn--peligro btn-orden btn-quitar-item" aria-label="Quitar">×</button>
        </li>
      `
    )
    .join("");
}

// Render lista de recursos
function renderRecursos(recursos) {
  if (!recursos || recursos.length === 0) {
    return `<p class="color-texto-suave" id="vacio-recursos" style="padding: var(--espacio-s);">No hay recursos agregados a este tema.</p>`;
  }

  return recursos
    .map((r, index) => {
      const tipo = r.tipo || "enlace";
      const permiteSubida = tipo === "pdf" || tipo === "imagen";

      return `
        <div class="tarjeta-recurso" data-index="${index}">
          <div class="tarjeta-recurso__campo" style="max-width: 130px;">
            <label><small>Tipo</small></label>
            <select class="recurso-tipo" data-index="${index}">
              <option value="video" ${tipo === "video" ? "selected" : ""}>Video</option>
              <option value="pdf" ${tipo === "pdf" ? "selected" : ""}>PDF</option>
              <option value="imagen" ${tipo === "imagen" ? "selected" : ""}>Imagen</option>
              <option value="enlace" ${tipo === "enlace" ? "selected" : ""}>Enlace</option>
            </select>
          </div>

          <div class="tarjeta-recurso__campo">
            <label><small>Título</small></label>
            <input type="text" class="recurso-titulo" value="${ui.escapar(r.titulo || '')}" placeholder="Nombre del recurso">
          </div>

          <div class="tarjeta-recurso__campo" style="flex: 2;">
            <label><small>URL o Enlace</small></label>
            <div class="tarjeta-recurso__subida">
              <input type="text" class="recurso-url" value="${ui.escapar(r.url || '')}" placeholder="https://... o /recursos/..." style="flex: 1;">
              ${permiteSubida ? `
                <button type="button" class="btn btn--secundario btn--pequeno btn-subir-archivo" data-index="${index}">
                  Subir
                </button>
                <input type="file" class="input-archivo-oculto" data-index="${index}" style="display: none;" accept="${tipo === 'pdf' ? '.pdf,application/pdf' : 'image/*'}">
              ` : ''}
            </div>
          </div>

          <button type="button" class="btn btn--peligro btn-orden btn-quitar-recurso" data-index="${index}" aria-label="Eliminar recurso">
            ×
          </button>
        </div>
      `;
    })
    .join("");
}

// Render métricas de glosario
function renderMetricasGlosario() {
  const total = listaGlosario.length;
  const de6Letras = listaGlosario.filter((g) => {
    const norm = util.normalizar(g.termino || "").trim();
    return norm.length === 6 && !norm.includes(" ");
  }).length;

  const esApto = total >= 12 && de6Letras >= 3;

  return `
    <span class="insignia insignia--secundario" id="metric-total-glosario">
      Total términos: <strong>${total}</strong>
    </span>
    <span class="insignia insignia--secundario" id="metric-6letras-glosario">
      De 6 letras: <strong>${de6Letras}</strong> / mín. 3
    </span>
    <span class="insignia ${esApto ? "insignia--exito" : "insignia--advertencia"}" id="indicador-apto-juegos">
      ${esApto ? "✓ Apto para juegos" : "Incompleto para juegos (mín. 12 términos y 3 de 6 letras)"}
    </span>
  `;
}

// Render filas de glosario
function renderFilasGlosario() {
  if (listaGlosario.length === 0) {
    return `<tr><td colspan="6" class="color-texto-suave" style="text-align: center; padding: var(--espacio-l);">No hay términos registrados en el glosario para este tema. Haz clic en "+ Nuevo Término".</td></tr>`;
  }

  return listaGlosario
    .map((g) => {
      const norm = util.normalizar(g.termino || "").trim();
      const es6 = norm.length === 6 && !norm.includes(" ");

      return `
        <tr data-id="${ui.escapar(g.id)}">
          <td><strong>${ui.escapar(g.termino || '')}</strong></td>
          <td>${ui.escapar(g.definicion || '')}</td>
          <td><small class="color-texto-suave">${ui.escapar(g.pista || '-')}</small></td>
          <td><small>${ui.escapar(g.retroalimentacion || '-')}</small></td>
          <td style="text-align: center;">
            <span class="insignia ${es6 ? 'insignia--exito' : 'insignia--secundario'}">
              ${es6 ? 'Sí' : 'No'}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-termino" data-id="${ui.escapar(g.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-termino" data-id="${ui.escapar(g.id)}" data-termino="${ui.escapar(g.termino || '')}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// -------------------------------------------------------------
// CONEXIÓN DE EVENTOS DE LA FICHA
// -------------------------------------------------------------
function conectarEventosFicha() {
  const formFicha = document.getElementById("form-ficha-tema");
  const textareaResumen = document.getElementById("tema-resumen");
  const contadorResumen = document.getElementById("contador-palabras-resumen");
  const btnTogglePreview = document.getElementById("btn-toggle-preview");
  const previewResumen = document.getElementById("tema-resumen-preview");
  const btnGuardarTema = document.getElementById("btn-guardar-tema");
  const enlaceVolver = document.getElementById("enlace-volver-contenidos");

  // Detección de cambios en el formulario
  formFicha.addEventListener("input", () => marcarCambio());
  formFicha.addEventListener("change", () => marcarCambio());

  // Contador de palabras en tiempo real para el resumen
  if (textareaResumen && contadorResumen) {
    textareaResumen.addEventListener("input", () => {
      const cant = contarPalabras(textareaResumen.value);
      const enRango = cant >= 300 && cant <= 800;
      contadorResumen.textContent = `${cant} palabras (recomendado: 300 a 800)`;
      contadorResumen.className = enRango ? "insignia insignia--exito" : "insignia insignia--secundario";
    });
  }

  // Toggle de vista previa del resumen
  if (btnTogglePreview && previewResumen && textareaResumen) {
    btnTogglePreview.addEventListener("click", () => {
      const oculta = previewResumen.classList.contains("oculto");
      if (oculta) {
        previewResumen.innerHTML = util.formatoBasico(textareaResumen.value || "(Sin contenido de resumen)");
        previewResumen.classList.remove("oculto");
        btnTogglePreview.textContent = "Ocultar vista previa";
      } else {
        previewResumen.classList.add("oculto");
        btnTogglePreview.textContent = "Vista previa";
      }
    });
  }

  // Interceptar enlace de retorno si hay cambios pendientes
  if (enlaceVolver) {
    enlaceVolver.addEventListener("click", async (e) => {
      if (hayCambiosSinGuardar) {
        e.preventDefault();
        const seguro = await ui.confirmar("Tienes cambios sin guardar en la ficha del tema. ¿Deseas salir de todas formas?");
        if (seguro) {
          hayCambiosSinGuardar = false;
          window.location.href = enlaceVolver.href;
        }
      }
    });
  }

  // Botón guardar tema
  if (btnGuardarTema) {
    btnGuardarTema.addEventListener("click", async () => {
      await guardarFichaTema();
    });
  }

  // Botones para agregar items a listas dinámicas
  conectarBotonLista("btn-agregar-objetivo", "lista-objetivos", "objetivo");
  conectarBotonLista("btn-agregar-ejemplo", "lista-ejemplos", "ejemplo");
  conectarBotonLista("btn-agregar-error", "lista-errores", "error");
  conectarBotonLista("btn-agregar-pregunta", "lista-preguntas", "pregunta");

  // Delegación para eliminar items de listas dinámicas
  contenedor.addEventListener("click", (e) => {
    const btnQuitar = e.target.closest(".btn-quitar-item");
    if (btnQuitar) {
      const li = btnQuitar.closest(".item-dinamico");
      if (li) {
        li.remove();
        marcarCambio();
      }
      return;
    }
  });

  // Recursos: agregar, quitar, cambiar tipo y subir archivo
  const btnAgregarRecurso = document.getElementById("btn-agregar-recurso");
  const listaRecursosContenedor = document.getElementById("lista-recursos");

  if (btnAgregarRecurso && listaRecursosContenedor) {
    btnAgregarRecurso.addEventListener("click", () => {
      const vacio = document.getElementById("vacio-recursos");
      if (vacio) vacio.remove();

      const index = listaRecursosContenedor.querySelectorAll(".tarjeta-recurso").length;
      const div = document.createElement("div");
      div.className = "tarjeta-recurso";
      div.setAttribute("data-index", String(index));
      div.innerHTML = `
        <div class="tarjeta-recurso__campo" style="max-width: 130px;">
          <label><small>Tipo</small></label>
          <select class="recurso-tipo" data-index="${index}">
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
            <option value="imagen">Imagen</option>
            <option value="enlace" selected>Enlace</option>
          </select>
        </div>
        <div class="tarjeta-recurso__campo">
          <label><small>Título</small></label>
          <input type="text" class="recurso-titulo" placeholder="Nombre del recurso">
        </div>
        <div class="tarjeta-recurso__campo" style="flex: 2;">
          <label><small>URL o Enlace</small></label>
          <div class="tarjeta-recurso__subida">
            <input type="text" class="recurso-url" placeholder="https://... o /recursos/..." style="flex: 1;">
          </div>
        </div>
        <button type="button" class="btn btn--peligro btn-orden btn-quitar-recurso" data-index="${index}" aria-label="Eliminar recurso">
          ×
        </button>
      `;
      listaRecursosContenedor.appendChild(div);
      marcarCambio();
    });

    listaRecursosContenedor.addEventListener("change", (e) => {
      const selTipo = e.target.closest(".recurso-tipo");
      if (selTipo) {
        const tarjeta = selTipo.closest(".tarjeta-recurso");
        const tipo = selTipo.value;
        const subidaContenedor = tarjeta.querySelector(".tarjeta-recurso__subida");
        const index = tarjeta.getAttribute("data-index");

        const btnSubirExistente = subidaContenedor.querySelector(".btn-subir-archivo");
        const inputArchivoExistente = subidaContenedor.querySelector(".input-archivo-oculto");
        if (btnSubirExistente) btnSubirExistente.remove();
        if (inputArchivoExistente) inputArchivoExistente.remove();

        if (tipo === "pdf" || tipo === "imagen") {
          const btnSubir = document.createElement("button");
          btnSubir.type = "button";
          btnSubir.className = "btn btn--secundario btn--pequeno btn-subir-archivo";
          btnSubir.setAttribute("data-index", index);
          btnSubir.textContent = "Subir";

          const inputArchivo = document.createElement("input");
          inputArchivo.type = "file";
          inputArchivo.className = "input-archivo-oculto";
          inputArchivo.setAttribute("data-index", index);
          inputArchivo.style.display = "none";
          inputArchivo.accept = tipo === "pdf" ? ".pdf,application/pdf" : "image/*";

          subidaContenedor.appendChild(btnSubir);
          subidaContenedor.appendChild(inputArchivo);
        }
        marcarCambio();
      }
    });

    listaRecursosContenedor.addEventListener("click", async (e) => {
      const btnQuitar = e.target.closest(".btn-quitar-recurso");
      if (btnQuitar) {
        const tarjeta = btnQuitar.closest(".tarjeta-recurso");
        if (tarjeta) {
          tarjeta.remove();
          marcarCambio();
        }
        return;
      }

      const btnSubir = e.target.closest(".btn-subir-archivo");
      if (btnSubir) {
        const tarjeta = btnSubir.closest(".tarjeta-recurso");
        const fileInput = tarjeta.querySelector(".input-archivo-oculto");
        if (fileInput) {
          fileInput.click();
        }
        return;
      }
    });

    listaRecursosContenedor.addEventListener("change", async (e) => {
      const fileInput = e.target.closest(".input-archivo-oculto");
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const tarjeta = fileInput.closest(".tarjeta-recurso");
        const urlInput = tarjeta.querySelector(".recurso-url");
        const archivo = fileInput.files[0];

        try {
          ui.cargando(true);
          const respuesta = await api.subir(archivo);
          if (respuesta && respuesta.url) {
            urlInput.value = respuesta.url;
            ui.aviso("Archivo subido con éxito", "exito");
            marcarCambio();
          }
        } catch (err) {
          ui.aviso(err.message || "Error al subir el archivo", "error");
        } finally {
          ui.cargando(false);
          fileInput.value = "";
        }
      }
    });
  }

  // Glosario: generar con IA (Tarea P07.2)
  const btnGenerarIA = document.getElementById("btn-generar-ia");
  if (btnGenerarIA) {
    btnGenerarIA.addEventListener("click", () => iniciarGeneracionGlosarioIA());
  }

  // Glosario: nuevo término
  const btnNuevoTermino = document.getElementById("btn-nuevo-termino");
  if (btnNuevoTermino) {
    btnNuevoTermino.addEventListener("click", () => abrirModalTerminoGlosario());
  }

  // Glosario: delegación en tabla
  const cuerpoTablaGlosario = document.getElementById("cuerpo-tabla-glosario");
  if (cuerpoTablaGlosario) {
    cuerpoTablaGlosario.addEventListener("click", async (e) => {
      const btnEditar = e.target.closest(".btn-editar-termino");
      if (btnEditar) {
        const id = btnEditar.getAttribute("data-id");
        const terminoObj = listaGlosario.find((g) => g.id === id);
        if (terminoObj) {
          await abrirModalTerminoGlosario(terminoObj);
        }
        return;
      }

      const btnEliminar = e.target.closest(".btn-eliminar-termino");
      if (btnEliminar) {
        const id = btnEliminar.getAttribute("data-id");
        const nombreTermino = btnEliminar.getAttribute("data-termino");
        const seguro = await ui.confirmar(`¿Deseas eliminar el término "${nombreTermino}" del glosario?`);
        if (seguro) {
          try {
            ui.cargando(true);
            await api.eliminar("glosario", id);
            ui.aviso("Término eliminado del glosario", "exito");
            listaGlosario = listaGlosario.filter((g) => g.id !== id);
            actualizarTablaGlosario();
          } catch (err) {
            ui.aviso(err.message || "Error al eliminar término", "error");
          } finally {
            ui.cargando(false);
          }
        }
        return;
      }
    });
  }
}

function conectarBotonLista(btnId, listaId, tipo) {
  const btn = document.getElementById(btnId);
  const lista = document.getElementById(listaId);
  if (btn && lista) {
    btn.addEventListener("click", () => {
      const li = document.createElement("li");
      li.className = "item-dinamico";
      li.innerHTML = `
        <input type="text" class="input-${tipo}" placeholder="Escribe un elemento..." autofocus>
        <button type="button" class="btn btn--peligro btn-orden btn-quitar-item" aria-label="Quitar">×</button>
      `;
      lista.appendChild(li);
      marcarCambio();
    });
  }
}

// -------------------------------------------------------------
// GUARDADO DE LA FICHA DEL TEMA
// -------------------------------------------------------------
async function guardarFichaTema() {
  const inputTitulo = document.getElementById("tema-titulo");
  const selectDificultad = document.getElementById("tema-dificultad");
  const selectEstado = document.getElementById("tema-estado");
  const inputPalabrasClave = document.getElementById("tema-palabras-clave");
  const textareaResumen = document.getElementById("tema-resumen");
  const textareaFuentes = document.getElementById("tema-fuentes");

  const titulo = inputTitulo ? inputTitulo.value.trim() : "";
  if (!titulo) {
    ui.aviso("El título del tema es obligatorio", "error");
    if (inputTitulo) inputTitulo.focus();
    return;
  }

  // Recolectar listas dinámicas
  const objetivos = Array.from(document.querySelectorAll(".input-objetivo"))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const ejemplos = Array.from(document.querySelectorAll(".input-ejemplo"))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const erroresFrecuentes = Array.from(document.querySelectorAll(".input-error"))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const preguntasGuia = Array.from(document.querySelectorAll(".input-pregunta"))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  // Recolectar recursos
  const recursos = Array.from(document.querySelectorAll(".tarjeta-recurso")).map((tarjeta) => {
    const tipo = tarjeta.querySelector(".recurso-tipo")?.value || "enlace";
    const titulo = tarjeta.querySelector(".recurso-titulo")?.value.trim() || "";
    const url = tarjeta.querySelector(".recurso-url")?.value.trim() || "";
    return { tipo, titulo, url };
  }).filter((r) => r.titulo || r.url);

  // Palabras clave como array
  const rawClaves = inputPalabrasClave ? inputPalabrasClave.value : "";
  const palabrasClave = rawClaves
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    titulo,
    dificultad: selectDificultad ? selectDificultad.value : "intermedio",
    estado: selectEstado ? selectEstado.value : "borrador",
    resumen: textareaResumen ? textareaResumen.value.trim() : "",
    fuentes: textareaFuentes ? textareaFuentes.value.trim() : "",
    objetivos,
    ejemplos,
    erroresFrecuentes,
    preguntasGuia,
    recursos,
    palabrasClave
  };

  try {
    ui.cargando(true);
    const actualizado = await api.actualizar("temas", temaId, payload);
    datosTema = { ...datosTema, ...actualizado };
    desmarcarCambio();

    // Actualizar badge visual de estado
    const badgeEstado = document.getElementById("badge-estado-tema");
    if (badgeEstado) {
      badgeEstado.textContent = datosTema.estado === "publicado" ? "Publicado" : "Borrador";
      badgeEstado.className = `insignia ${datosTema.estado === "publicado" ? "insignia--exito" : "insignia--advertencia"}`;
    }

    ui.aviso("Ficha del tema guardada con éxito", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la ficha del tema", "error");
  } finally {
    ui.cargando(false);
  }
}

// -------------------------------------------------------------
// OPERACIONES DEL GLOSARIO (MODAL AGREGAR / EDITAR)
// -------------------------------------------------------------
async function abrirModalTerminoGlosario(terminoObj = null) {
  const esEdicion = Boolean(terminoObj && terminoObj.id);
  const tituloModal = esEdicion ? "Editar Término del Glosario" : "Nuevo Término en Glosario";

  const terminoVal = esEdicion ? terminoObj.termino || "" : "";
  const defVal = esEdicion ? terminoObj.definicion || "" : "";
  const pistaVal = esEdicion ? terminoObj.pista || "" : "";
  const retroVal = esEdicion ? terminoObj.retroalimentacion || "" : "";

  const formHtml = `
    <form id="form-modal-glosario" class="pila" novalidate>
      <div class="campo">
        <label for="glosario-termino">Término <span aria-hidden="true">*</span></label>
        <input
          type="text"
          id="glosario-termino"
          required
          value="${ui.escapar(terminoVal)}"
          placeholder="Ej. NAVEGADOR"
          autofocus
        >
        <small class="color-texto-suave">Recomendación: una sola palabra. Si tiene 6 letras exactas, servirá para juegos adicionales.</small>
      </div>

      <div class="campo">
        <div class="fila" style="justify-content: space-between;">
          <label for="glosario-def">Definición <span aria-hidden="true">*</span></label>
          <small id="contador-def" class="color-texto-suave">${contarPalabras(defVal)} / 25 palabras</small>
        </div>
        <textarea id="glosario-def" rows="3" required placeholder="Definición clara y concisa (máximo 25 palabras)...">${ui.escapar(defVal)}</textarea>
      </div>

      <div class="campo">
        <div class="fila" style="justify-content: space-between;">
          <label for="glosario-pista">Pista breve</label>
          <small id="contador-pista" class="color-texto-suave">${contarPalabras(pistaVal)} / 10 palabras</small>
        </div>
        <textarea id="glosario-pista" rows="2" placeholder="Pista para adivinanzas o juegos (máximo 10 palabras)...">${ui.escapar(pistaVal)}</textarea>
      </div>

      <div class="campo">
        <label for="glosario-retro">Retroalimentación / Explicación didáctica</label>
        <textarea id="glosario-retro" rows="2" placeholder="Mensaje que se mostrará al estudiante al resolver o fallar...">${ui.escapar(retroVal)}</textarea>
      </div>
    </form>
  `;

  // Conectar contadores reactivos en el modal
  setTimeout(() => {
    const textareaDef = document.getElementById("glosario-def");
    const contadorDef = document.getElementById("contador-def");
    const textareaPista = document.getElementById("glosario-pista");
    const contadorPista = document.getElementById("contador-pista");

    if (textareaDef && contadorDef) {
      textareaDef.addEventListener("input", () => {
        const num = contarPalabras(textareaDef.value);
        contadorDef.textContent = `${num} / 25 palabras`;
        contadorDef.className = num > 25 ? "contador-alerta" : "color-texto-suave";
      });
    }

    if (textareaPista && contadorPista) {
      textareaPista.addEventListener("input", () => {
        const num = contarPalabras(textareaPista.value);
        contadorPista.textContent = `${num} / 10 palabras`;
        contadorPista.className = num > 10 ? "contador-alerta" : "color-texto-suave";
      });
    }
  }, 10);

  await ui.modal({
    titulo: tituloModal,
    contenido: formHtml,
    acciones: [
      { texto: "Cancelar", valor: "cancelar" },
      {
        texto: esEdicion ? "Actualizar" : "Guardar",
        valor: "guardar",
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const inputTermino = cuerpo.querySelector("#glosario-termino");
          const textareaDef = cuerpo.querySelector("#glosario-def");
          const textareaPista = cuerpo.querySelector("#glosario-pista");
          const textareaRetro = cuerpo.querySelector("#glosario-retro");

          const termino = inputTermino ? inputTermino.value.trim() : "";
          const definicion = textareaDef ? textareaDef.value.trim() : "";
          const pista = textareaPista ? textareaPista.value.trim() : "";
          const retroalimentacion = textareaRetro ? textareaRetro.value.trim() : "";

          if (!termino) {
            ui.aviso("El término es obligatorio", "error");
            if (inputTermino) inputTermino.focus();
            return false;
          }

          if (!definicion) {
            ui.aviso("La definición es obligatoria", "error");
            if (textareaDef) textareaDef.focus();
            return false;
          }

          const palabrasDef = contarPalabras(definicion);
          if (palabrasDef > 25) {
            ui.aviso(`La definición tiene ${palabrasDef} palabras (máximo permitido: 25)`, "error");
            if (textareaDef) textareaDef.focus();
            return false;
          }

          const palabrasPista = contarPalabras(pista);
          if (palabrasPista > 10) {
            ui.aviso(`La pista tiene ${palabrasPista} palabras (máximo permitido: 10)`, "error");
            if (textareaPista) textareaPista.focus();
            return false;
          }

          const datosTermino = {
            temaId,
            termino,
            definicion,
            pista,
            retroalimentacion,
            origen: "docente",
            estado: "aprobado"
          };

          try {
            ui.cargando(true);
            if (esEdicion) {
              const actualizado = await api.actualizar("glosario", terminoObj.id, datosTermino);
              const idx = listaGlosario.findIndex((g) => g.id === terminoObj.id);
              if (idx !== -1) listaGlosario[idx] = { ...listaGlosario[idx], ...actualizado };
              ui.aviso("Término actualizado con éxito", "exito");
            } else {
              const creado = await api.crear("glosario", datosTermino);
              listaGlosario.push(creado);
              ui.aviso("Término añadido al glosario", "exito");
            }
            actualizarTablaGlosario();
            return true;
          } catch (err) {
            ui.aviso(err.message || "Error al guardar término en glosario", "error");
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

function actualizarTablaGlosario() {
  const metricas = document.getElementById("metricas-glosario");
  const cuerpoTabla = document.getElementById("cuerpo-tabla-glosario");

  if (metricas) metricas.innerHTML = renderMetricasGlosario();
  if (cuerpoTabla) cuerpoTabla.innerHTML = renderFilasGlosario();
}

// -------------------------------------------------------------
// GENERACIÓN DE GLOSARIO CON IA (TAREA P07.2)
// -------------------------------------------------------------

/**
 * Inicia el flujo de generación de términos de glosario con IA:
 * 1. Modal para seleccionar la cantidad (5 a 20, por defecto 10).
 * 2. Llamada a api.ia("generar-glosario", { temaId, cantidad }) con ui.cargando.
 * 3. Modal con tabla editable de propuestas (repetidas desmarcadas y señaladas).
 * 4. Aprobación en lote con origen "ia" y estado "aprobado", actualizando tabla y contadores.
 */
async function iniciarGeneracionGlosarioIA() {
  const cantidad = await solicitarCantidadIA();
  if (!cantidad) return;

  let propuestas = null;
  try {
    ui.cargando(true);
    propuestas = await api.ia("generar-glosario", { temaId, cantidad });
  } catch (err) {
    ui.aviso(err.message || "Error al generar términos con IA", "error");
    return;
  } finally {
    ui.cargando(false);
  }

  if (!Array.isArray(propuestas) || propuestas.length === 0) {
    ui.aviso("La IA no devolvió ningún término", "advertencia");
    return;
  }

  await mostrarModalPropuestasGlosario(propuestas);
}

/**
 * Muestra el modal para configurar la cantidad de términos a generar.
 * @returns {Promise<number|null>}
 */
async function solicitarCantidadIA() {
  const contenidoHtml = `
    <div class="modal-cantidad-ia">
      <p style="margin-bottom: var(--espacio-s);">
        Indica cuántos términos clave deseas que la Inteligencia Artificial extraiga a partir del contenido de este tema:
      </p>
      <div class="campo">
        <label for="input-cantidad-ia"><strong>Cantidad (5 a 20):</strong></label>
        <input
          type="number"
          id="input-cantidad-ia"
          min="5"
          max="20"
          value="10"
          required
          style="width: 120px;"
        >
        <small class="color-texto-suave">Por defecto: 10 términos. Se incluirán términos de 6 letras para juegos didácticos.</small>
      </div>
    </div>
  `;

  return await ui.modal({
    titulo: "Generar glosario con IA",
    contenido: contenidoHtml,
    acciones: [
      { texto: "Cancelar", valor: null },
      {
        texto: "Generar",
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const inputCant = cuerpo.querySelector("#input-cantidad-ia");
          const val = parseInt(inputCant?.value, 10);
          if (isNaN(val) || val < 5 || val > 20) {
            ui.aviso("La cantidad debe estar entre 5 y 20", "error");
            if (inputCant) inputCant.focus();
            return false;
          }
          return val;
        }
      }
    ]
  });
}

/**
 * Presenta las propuestas de IA en una tabla editable con casillas de selección.
 * Las repetidas aparecen desmarcadas y señaladas.
 * Al pulsar "Aprobar seleccionados", crea cada término en glosario con origen "ia" y estado "aprobado".
 * @param {Array<Object>} propuestas
 */
async function mostrarModalPropuestasGlosario(propuestas) {
  // Conjunto de términos existentes normalizados
  const existentesNorm = new Set(
    listaGlosario.map((g) => util.normalizar(g.termino || "").trim()).filter(Boolean)
  );

  // Analizar cada propuesta para marcar repetidas
  const analizadas = propuestas.map((p, idx) => {
    const norm = util.normalizar(p.termino || "").trim();
    const esRepetida = norm !== "" && existentesNorm.has(norm);
    if (norm !== "") {
      existentesNorm.add(norm);
    }
    return {
      ...p,
      idx,
      esRepetida
    };
  });

  const todasMarcadas = analizadas.every((p) => !p.esRepetida);

  const contenidoHtml = `
    <div class="modal-propuestas-ia">
      <p class="color-texto-suave" style="margin-bottom: var(--espacio-s);">
        Revisa, edita o desmarca las propuestas de la IA. Las repetidas aparecen desmarcadas y señaladas. Al aprobarlas, se incorporarán directamente al glosario.
      </p>
      <div class="modal-propuestas-ia__tabla-contenedor">
        <table class="tabla tabla--compacta" style="width: 100%; min-width: 720px;">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">
                <input type="checkbox" id="check-todos-propuestas" title="Seleccionar o desmarcar todos" ${todasMarcadas ? "checked" : ""}>
              </th>
              <th style="width: 18%;">Término</th>
              <th style="width: 32%;">Definición (máx. 25 pal.)</th>
              <th style="width: 20%;">Pista (máx. 10 pal.)</th>
              <th style="width: 20%;">Retroalimentación</th>
              <th style="width: 10%; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-propuestas">
            ${analizadas
              .map((p) => {
                const norm = util.normalizar(p.termino || "").trim();
                const es6 = norm.length === 6 && !norm.includes(" ");
                return `
                  <tr class="fila-propuesta ${p.esRepetida ? "fila-propuesta--repetida" : ""}" data-index="${p.idx}">
                    <td style="text-align: center; vertical-align: middle;">
                      <input
                        type="checkbox"
                        class="check-propuesta"
                        data-index="${p.idx}"
                        ${p.esRepetida ? "" : "checked"}
                        aria-label="Seleccionar término ${ui.escapar(p.termino || '')}"
                      >
                    </td>
                    <td>
                      <input
                        type="text"
                        class="input-propuesta-termino"
                        value="${ui.escapar(p.termino || '')}"
                        placeholder="Término"
                        style="width: 100%; box-sizing: border-box;"
                        required
                      >
                      ${es6 ? '<small class="color-texto-suave">6 letras</small>' : ""}
                    </td>
                    <td>
                      <textarea
                        class="input-propuesta-def"
                        rows="2"
                        placeholder="Definición..."
                        style="width: 100%; box-sizing: border-box; resize: vertical;"
                        required
                      >${ui.escapar(p.definicion || '')}</textarea>
                    </td>
                    <td>
                      <input
                        type="text"
                        class="input-propuesta-pista"
                        value="${ui.escapar(p.pista || '')}"
                        placeholder="Pista opcional"
                        style="width: 100%; box-sizing: border-box;"
                      >
                    </td>
                    <td>
                      <textarea
                        class="input-propuesta-retro"
                        rows="2"
                        placeholder="Retroalimentación..."
                        style="width: 100%; box-sizing: border-box; resize: vertical;"
                      >${ui.escapar(p.retroalimentacion || '')}</textarea>
                    </td>
                    <td style="text-align: center; vertical-align: middle; white-space: nowrap;">
                      ${
                        p.esRepetida
                          ? '<span class="insignia insignia--advertencia" title="Ya existe en el glosario">⚠️ Repetido</span>'
                          : '<span class="insignia insignia--exito">Nuevo</span>'
                      }
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Ajustar ancho del diálogo y conectar casillas en el DOM
  setTimeout(() => {
    const dialogos = document.querySelectorAll(".modal-dialogo");
    const dialogoActual = dialogos[dialogos.length - 1];
    if (dialogoActual) {
      dialogoActual.style.maxWidth = "min(96vw, 1100px)";
      dialogoActual.style.maxHeight = "92vh";
    }

    const checkTodos = document.getElementById("check-todos-propuestas");
    const cuerpoPropuestas = document.getElementById("cuerpo-tabla-propuestas");

    if (checkTodos && cuerpoPropuestas) {
      const actualizarMasterCheck = () => {
        const checks = Array.from(cuerpoPropuestas.querySelectorAll(".check-propuesta"));
        const total = checks.length;
        const marcados = checks.filter((c) => c.checked).length;
        checkTodos.checked = total > 0 && marcados === total;
        checkTodos.indeterminate = marcados > 0 && marcados < total;
      };

      actualizarMasterCheck();

      checkTodos.addEventListener("change", () => {
        const checks = cuerpoPropuestas.querySelectorAll(".check-propuesta");
        checks.forEach((chk) => {
          chk.checked = checkTodos.checked;
        });
      });

      cuerpoPropuestas.addEventListener("change", (e) => {
        if (e.target.classList.contains("check-propuesta")) {
          actualizarMasterCheck();
        }
      });
    }
  }, 10);

  await ui.modal({
    titulo: "Propuestas de Glosario con IA",
    contenido: contenidoHtml,
    acciones: [
      { texto: "Cancelar", valor: false },
      {
        texto: "Aprobar seleccionados",
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const filas = Array.from(cuerpo.querySelectorAll(".fila-propuesta"));
          const seleccionados = [];

          for (const fila of filas) {
            const chk = fila.querySelector(".check-propuesta");
            if (!chk || !chk.checked) continue;

            const inputTermino = fila.querySelector(".input-propuesta-termino");
            const textareaDef = fila.querySelector(".input-propuesta-def");
            const inputPista = fila.querySelector(".input-propuesta-pista");
            const textareaRetro = fila.querySelector(".input-propuesta-retro");

            const termino = inputTermino ? inputTermino.value.trim() : "";
            const definicion = textareaDef ? textareaDef.value.trim() : "";
            const pista = inputPista ? inputPista.value.trim() : "";
            const retroalimentacion = textareaRetro ? textareaRetro.value.trim() : "";

            if (!termino) {
              ui.aviso("Todos los términos seleccionados deben tener un nombre", "error");
              if (inputTermino) inputTermino.focus();
              return false;
            }

            if (!definicion) {
              ui.aviso(`El término "${termino}" debe tener una definición`, "error");
              if (textareaDef) textareaDef.focus();
              return false;
            }

            const palDef = contarPalabras(definicion);
            if (palDef > 25) {
              ui.aviso(`La definición de "${termino}" tiene ${palDef} palabras (máx. 25)`, "error");
              if (textareaDef) textareaDef.focus();
              return false;
            }

            const palPista = contarPalabras(pista);
            if (palPista > 10) {
              ui.aviso(`La pista de "${termino}" tiene ${palPista} palabras (máx. 10)`, "error");
              if (inputPista) inputPista.focus();
              return false;
            }

            seleccionados.push({
              temaId,
              termino,
              definicion,
              pista,
              retroalimentacion,
              origen: "ia",
              estado: "aprobado"
            });
          }

          if (seleccionados.length === 0) {
            ui.aviso("Selecciona al menos un término para aprobar", "advertencia");
            return false;
          }

          try {
            ui.cargando(true);
            const guardados = [];
            for (const item of seleccionados) {
              const creado = await api.crear("glosario", item);
              guardados.push(creado);
              listaGlosario.push(creado);
            }

            actualizarTablaGlosario();
            ui.aviso(`Se agregaron ${guardados.length} término(s) con éxito al glosario`, "exito");
            return true;
          } catch (err) {
            ui.aviso(err.message || "Error al guardar términos en el glosario", "error");
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

// Iniciar carga del tema
await cargarDatos();
