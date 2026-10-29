// publico/js/modulos/editor-contenidos.js · Editor de contenidos (unidades y temas)
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Editor de Contenidos",
  roles: ["docente", "admin"]
});

const contenedor = document.getElementById("contenido");

// Estado del módulo
let listaAsignaturas = [];
let asignaturaSeleccionadaId = null;
let listaUnidades = [];
let unidadSeleccionadaId = null;
let listaTemas = [];

// Inicialización de la vista
contenedor.innerHTML = `
  <div class="editor-contenidos">
    <header class="editor-contenidos__cabecera">
      <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-s);">
        <div>
          <h2>Editor de Contenidos</h2>
          <p class="color-texto-suave">Gestiona las unidades y temas curriculares de tus asignaturas.</p>
        </div>
      </div>

      <div class="editor-contenidos__selector-asig">
        <label for="selector-asig"><strong>Asignatura:</strong></label>
        <select id="selector-asig" class="campo__control" aria-label="Seleccionar asignatura para editar contenidos">
          <option value="">Cargando asignaturas disponibles...</option>
        </select>
      </div>
    </header>

    <div class="editor-contenidos__layout">
      <!-- Columna 1: Unidades -->
      <section class="editor-panel" aria-labelledby="titulo-panel-unidades">
        <div class="editor-panel__cabecera">
          <h3 id="titulo-panel-unidades" class="editor-panel__titulo">
            <span>Unidades</span>
            <span class="insignia insignia--secundario" id="contador-unidades">0</span>
          </h3>
          <button type="button" class="btn btn--primario btn--pequeno" id="btn-nueva-unidad" disabled>
            + Nueva Unidad
          </button>
        </div>

        <div id="contenedor-unidades">
          <div class="editor-vacio">Selecciona una asignatura para visualizar sus unidades.</div>
        </div>
      </section>

      <!-- Columna 2: Temas -->
      <section class="editor-panel" aria-labelledby="titulo-panel-temas">
        <div class="editor-panel__cabecera">
          <h3 id="titulo-panel-temas" class="editor-panel__titulo">
            <span id="texto-panel-temas">Temas</span>
            <span class="insignia insignia--secundario" id="contador-temas">0</span>
          </h3>
          <button type="button" class="btn btn--primario btn--pequeno" id="btn-nuevo-tema" disabled>
            + Nuevo Tema
          </button>
        </div>

        <div id="contenedor-temas">
          <div class="editor-vacio">Elige una unidad para gestionar sus temas.</div>
        </div>
      </section>
    </div>
  </div>
`;

const selectAsignatura = document.getElementById("selector-asig");
const btnNuevaUnidad = document.getElementById("btn-nueva-unidad");
const btnNuevoTema = document.getElementById("btn-nuevo-tema");
const contenedorUnidades = document.getElementById("contenedor-unidades");
const contenedorTemas = document.getElementById("contenedor-temas");
const contadorUnidades = document.getElementById("contador-unidades");
const contadorTemas = document.getElementById("contador-temas");
const textoPanelTemas = document.getElementById("texto-panel-temas");

// Carga inicial de asignaturas
async function iniciar() {
  try {
    ui.cargando(true);
    listaAsignaturas = await api.listar("asignaturas");

    if (!Array.isArray(listaAsignaturas) || listaAsignaturas.length === 0) {
      selectAsignatura.innerHTML = `<option value="">No tienes asignaturas disponibles</option>`;
      selectAsignatura.disabled = true;
      contenedorUnidades.innerHTML = `<div class="editor-vacio">No tienes asignaturas asignadas.</div>`;
      return;
    }

    selectAsignatura.innerHTML = `
      <option value="">-- Selecciona una asignatura --</option>
      ${listaAsignaturas
        .map(
          (a) =>
            `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)} (${ui.escapar(
              a.nivel || "General"
            )})</option>`
        )
        .join("")}
    `;
    selectAsignatura.disabled = false;

    // Detectar parámetro en la URL o auto-seleccionar la primera si solo hay una
    const paramAsig = util.parametro("asignaturaId");
    if (paramAsig && listaAsignaturas.some((a) => a.id === paramAsig)) {
      asignaturaSeleccionadaId = paramAsig;
      selectAsignatura.value = paramAsig;
      await cargarUnidades(asignaturaSeleccionadaId);
    } else if (listaAsignaturas.length === 1) {
      asignaturaSeleccionadaId = listaAsignaturas[0].id;
      selectAsignatura.value = asignaturaSeleccionadaId;
      await cargarUnidades(asignaturaSeleccionadaId);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar asignaturas", "error");
  } finally {
    ui.cargando(false);
  }
}

// Cargar y renderizar unidades de una asignatura
async function cargarUnidades(asigId, idUnidadASeleccionar = null) {
  if (!asigId) {
    listaUnidades = [];
    unidadSeleccionadaId = null;
    contadorUnidades.textContent = "0";
    btnNuevaUnidad.disabled = true;
    contenedorUnidades.innerHTML = `<div class="editor-vacio">Selecciona una asignatura para visualizar sus unidades.</div>`;
    limpiarPanelTemas();
    return;
  }

  try {
    ui.cargando(true);
    btnNuevaUnidad.disabled = false;
    const datos = await api.listar("unidades", { asignaturaId: asigId });
    listaUnidades = Array.isArray(datos) ? datos : [];

    // Ordenar de forma ascendente por el campo orden
    listaUnidades.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    contadorUnidades.textContent = String(listaUnidades.length);

    // Determinar unidad activa
    if (idUnidadASeleccionar && listaUnidades.some((u) => u.id === idUnidadASeleccionar)) {
      unidadSeleccionadaId = idUnidadASeleccionar;
    } else if (unidadSeleccionadaId && listaUnidades.some((u) => u.id === unidadSeleccionadaId)) {
      // Mantener la actual
    } else if (listaUnidades.length > 0) {
      unidadSeleccionadaId = listaUnidades[0].id;
    } else {
      unidadSeleccionadaId = null;
    }

    renderizarUnidades();

    if (unidadSeleccionadaId) {
      await cargarTemas(unidadSeleccionadaId);
    } else {
      limpiarPanelTemas();
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar unidades", "error");
  } finally {
    ui.cargando(false);
  }
}

// Render de lista de unidades
function renderizarUnidades() {
  if (listaUnidades.length === 0) {
    contenedorUnidades.innerHTML = `
      <div class="editor-vacio">
        <p>No hay unidades registradas en esta asignatura.</p>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btn-vacio-unidad" style="margin-top: var(--espacio-s);">
          + Crear primera unidad
        </button>
      </div>
    `;
    const btnVacio = document.getElementById("btn-vacio-unidad");
    if (btnVacio) btnVacio.onclick = () => abrirModalCrearUnidad();
    return;
  }

  const itemsHtml = listaUnidades
    .map((u, index) => {
      const esActiva = u.id === unidadSeleccionadaId;
      const esVisible = u.visible !== false;
      const esPrimera = index === 0;
      const esUltima = index === listaUnidades.length - 1;

      return `
        <li class="editor-item ${esActiva ? "editor-item--activo" : ""}" data-id="${ui.escapar(u.id)}">
          <div class="editor-item__cuerpo">
            <span class="editor-item__orden-badge" title="Orden ${u.orden || index + 1}">${u.orden || index + 1}</span>
            <div class="editor-item__detalles">
              <button
                type="button"
                class="editor-item__titulo-btn btn-seleccionar-unidad"
                data-id="${ui.escapar(u.id)}"
                title="Ver temas de esta unidad"
              >
                ${ui.escapar(u.titulo || "Sin título")}
              </button>
              <div class="editor-item__meta">
                <span class="insignia ${esVisible ? "insignia--exito" : "insignia--advertencia"}">
                  ${esVisible ? "Visible" : "Oculta"}
                </span>
              </div>
            </div>
          </div>

          <div class="editor-item__acciones">
            <button
              type="button"
              class="btn btn--secundario btn-orden btn-subir-unidad"
              data-id="${ui.escapar(u.id)}"
              data-index="${index}"
              ${esPrimera ? "disabled" : ""}
              aria-label="Subir orden de la unidad"
              title="Subir orden"
            >
              ▲
            </button>
            <button
              type="button"
              class="btn btn--secundario btn-orden btn-bajar-unidad"
              data-id="${ui.escapar(u.id)}"
              data-index="${index}"
              ${esUltima ? "disabled" : ""}
              aria-label="Bajar orden de la unidad"
              title="Bajar orden"
            >
              ▼
            </button>
            <button
              type="button"
              class="btn btn--secundario btn--pequeno btn-visibilidad-unidad"
              data-id="${ui.escapar(u.id)}"
              data-visible="${esVisible}"
              title="${esVisible ? 'Ocultar a estudiantes' : 'Mostrar a estudiantes'}"
            >
              ${esVisible ? "Ocultar" : "Mostrar"}
            </button>
            <button
              type="button"
              class="btn btn--secundario btn--pequeno btn-renombrar-unidad"
              data-id="${ui.escapar(u.id)}"
              data-titulo="${ui.escapar(u.titulo || '')}"
              title="Renombrar unidad"
            >
              Renombrar
            </button>
          </div>
        </li>
      `;
    })
    .join("");

  contenedorUnidades.innerHTML = `<ul class="editor-lista">${itemsHtml}</ul>`;
}

// Cargar y renderizar temas de una unidad
async function cargarTemas(unidadId) {
  if (!unidadId) {
    limpiarPanelTemas();
    return;
  }

  const unidad = listaUnidades.find((u) => u.id === unidadId);
  textoPanelTemas.textContent = unidad ? `Temas: ${unidad.titulo}` : "Temas";
  btnNuevoTema.disabled = false;

  try {
    ui.cargando(true);
    const datos = await api.listar("temas", { unidadId });
    listaTemas = Array.isArray(datos) ? datos : [];

    // Ordenar de forma ascendente por el campo orden
    listaTemas.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    contadorTemas.textContent = String(listaTemas.length);

    renderizarTemas();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar temas", "error");
  } finally {
    ui.cargando(false);
  }
}

// Limpiar panel de temas cuando no hay unidad activa
function limpiarPanelTemas() {
  listaTemas = [];
  contadorTemas.textContent = "0";
  btnNuevoTema.disabled = true;
  textoPanelTemas.textContent = "Temas";
  contenedorTemas.innerHTML = `<div class="editor-vacio">Elige una unidad para gestionar sus temas.</div>`;
}

// Render de lista de temas
function renderizarTemas() {
  if (listaTemas.length === 0) {
    contenedorTemas.innerHTML = `
      <div class="editor-vacio">
        <p>Esta unidad aún no tiene temas registrados.</p>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btn-vacio-tema" style="margin-top: var(--espacio-s);">
          + Crear primer tema
        </button>
      </div>
    `;
    const btnVacio = document.getElementById("btn-vacio-tema");
    if (btnVacio) btnVacio.onclick = () => abrirModalCrearTema();
    return;
  }

  const itemsHtml = listaTemas
    .map((t, index) => {
      const esPublicado = t.estado === "publicado";
      const esPrimero = index === 0;
      const esUltimo = index === listaTemas.length - 1;

      return `
        <li class="editor-item" data-id="${ui.escapar(t.id)}">
          <div class="editor-item__cuerpo">
            <span class="editor-item__orden-badge" title="Orden ${t.orden || index + 1}">${t.orden || index + 1}</span>
            <div class="editor-item__detalles">
              <strong>${ui.escapar(t.titulo || "Sin título")}</strong>
              <div class="editor-item__meta">
                <span class="insignia ${esPublicado ? "insignia--exito" : "insignia--advertencia"}">
                  ${esPublicado ? "Publicado" : "Borrador"}
                </span>
              </div>
            </div>
          </div>

          <div class="editor-item__acciones">
            <button
              type="button"
              class="btn btn--secundario btn-orden btn-subir-tema"
              data-id="${ui.escapar(t.id)}"
              data-index="${index}"
              ${esPrimero ? "disabled" : ""}
              aria-label="Subir orden del tema"
              title="Subir orden"
            >
              ▲
            </button>
            <button
              type="button"
              class="btn btn--secundario btn-orden btn-bajar-tema"
              data-id="${ui.escapar(t.id)}"
              data-index="${index}"
              ${esUltimo ? "disabled" : ""}
              aria-label="Bajar orden del tema"
              title="Bajar orden"
            >
              ▼
            </button>
            <button
              type="button"
              class="btn btn--secundario btn--pequeno btn-estado-tema"
              data-id="${ui.escapar(t.id)}"
              data-estado="${ui.escapar(t.estado || 'borrador')}"
              title="Cambiar estado de publicación"
            >
              ${esPublicado ? "A borrador" : "Publicar"}
            </button>
            <a
              href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}"
              class="btn btn--secundario btn--pequeno btn-editar-ficha"
              title="Editar ficha completa del tema"
            >
              Editar ficha
            </a>
          </div>
        </li>
      `;
    })
    .join("");

  contenedorTemas.innerHTML = `<ul class="editor-lista">${itemsHtml}</ul>`;
}

// -------------------------------------------------------------
// OPERACIONES DE UNIDADES
// -------------------------------------------------------------

async function abrirModalCrearUnidad() {
  if (!asignaturaSeleccionadaId) {
    ui.aviso("Selecciona una asignatura primero", "error");
    return;
  }

  const formHtml = `
    <form id="form-crear-unidad" class="pila" novalidate>
      <div class="campo">
        <label for="input-titulo-unidad">Título de la unidad <span aria-hidden="true">*</span></label>
        <input
          type="text"
          id="input-titulo-unidad"
          name="titulo"
          required
          placeholder="Ej. UNIDAD 1: Alfabetización Digital"
          autofocus
        >
        <span class="campo__error" id="error-titulo-unidad"></span>
      </div>
    </form>
  `;

  await ui.modal({
    titulo: "Nueva Unidad",
    contenido: formHtml,
    acciones: [
      { texto: "Cancelar", valor: "cancelar" },
      {
        texto: "Crear Unidad",
        valor: "guardar",
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const input = cuerpo.querySelector("#input-titulo-unidad");
          const errorSpan = cuerpo.querySelector("#error-titulo-unidad");
          const titulo = input ? input.value.trim() : "";

          if (!titulo) {
            if (errorSpan) errorSpan.textContent = "El título es obligatorio";
            ui.aviso("El título de la unidad es obligatorio", "error");
            if (input) input.focus();
            return false;
          }

          const maxOrden = listaUnidades.reduce((max, u) => Math.max(max, Number(u.orden) || 0), 0);
          const siguienteOrden = maxOrden + 1;

          try {
            ui.cargando(true);
            const nueva = await api.crear("unidades", {
              asignaturaId: asignaturaSeleccionadaId,
              titulo,
              orden: siguienteOrden,
              visible: true
            });
            ui.aviso("Unidad creada con éxito", "exito");
            await cargarUnidades(asignaturaSeleccionadaId, nueva.id);
            return true;
          } catch (err) {
            ui.aviso(err.message || "Error al crear unidad", "error");
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

async function abrirModalRenombrarUnidad(unidadId, tituloActual) {
  const formHtml = `
    <form id="form-renombrar-unidad" class="pila" novalidate>
      <div class="campo">
        <label for="input-nuevo-titulo">Nuevo título de la unidad <span aria-hidden="true">*</span></label>
        <input
          type="text"
          id="input-nuevo-titulo"
          name="titulo"
          required
          value="${ui.escapar(tituloActual)}"
          autofocus
        >
        <span class="campo__error" id="error-nuevo-titulo"></span>
      </div>
    </form>
  `;

  await ui.modal({
    titulo: "Renombrar Unidad",
    contenido: formHtml,
    acciones: [
      { texto: "Cancelar", valor: "cancelar" },
      {
        texto: "Guardar",
        valor: "guardar",
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const input = cuerpo.querySelector("#input-nuevo-titulo");
          const errorSpan = cuerpo.querySelector("#error-nuevo-titulo");
          const titulo = input ? input.value.trim() : "";

          if (!titulo) {
            if (errorSpan) errorSpan.textContent = "El título es obligatorio";
            ui.aviso("El título de la unidad es obligatorio", "error");
            if (input) input.focus();
            return false;
          }

          try {
            ui.cargando(true);
            await api.actualizar("unidades", unidadId, { titulo });
            ui.aviso("Unidad renombrada con éxito", "exito");
            await cargarUnidades(asignaturaSeleccionadaId, unidadId);
            return true;
          } catch (err) {
            ui.aviso(err.message || "Error al renombrar unidad", "error");
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

async function alternarVisibilidadUnidad(unidadId, visibleActual) {
  const nuevoVisible = !visibleActual;
  try {
    ui.cargando(true);
    await api.actualizar("unidades", unidadId, { visible: nuevoVisible });
    ui.aviso(`Unidad ${nuevoVisible ? "marcada como visible" : "oculta para estudiantes"}`, "exito");
    await cargarUnidades(asignaturaSeleccionadaId, unidadId);
  } catch (err) {
    ui.aviso(err.message || "Error al actualizar visibilidad", "error");
  } finally {
    ui.cargando(false);
  }
}

async function moverOrdenUnidad(indiceOrigen, direccion) {
  const indiceDestino = indiceOrigen + direccion;
  if (indiceDestino < 0 || indiceDestino >= listaUnidades.length) return;

  const actual = listaUnidades[indiceOrigen];
  const adyacente = listaUnidades[indiceDestino];

  const ordenActual = Number(actual.orden) || indiceOrigen + 1;
  const ordenAdyacente = Number(adyacente.orden) || indiceDestino + 1;

  try {
    ui.cargando(true);
    // Intercambiar órdenes
    await api.actualizar("unidades", actual.id, { orden: ordenAdyacente });
    await api.actualizar("unidades", adyacente.id, { orden: ordenActual });
    ui.aviso("Orden de unidades actualizado", "exito");
    await cargarUnidades(asignaturaSeleccionadaId, actual.id);
  } catch (err) {
    ui.aviso(err.message || "Error al reordenar unidades", "error");
  } finally {
    ui.cargando(false);
  }
}

// -------------------------------------------------------------
// OPERACIONES DE TEMAS
// -------------------------------------------------------------

async function abrirModalCrearTema() {
  if (!unidadSeleccionadaId) {
    ui.aviso("Selecciona una unidad primero", "error");
    return;
  }

  const formHtml = `
    <form id="form-crear-tema" class="pila" novalidate>
      <div class="campo">
        <label for="input-titulo-tema">Título del tema <span aria-hidden="true">*</span></label>
        <input
          type="text"
          id="input-titulo-tema"
          name="titulo"
          required
          placeholder="Ej. Estrategias de Búsqueda Avanzada"
          autofocus
        >
        <span class="campo__error" id="error-titulo-tema"></span>
      </div>
    </form>
  `;

  await ui.modal({
    titulo: "Nuevo Tema",
    contenido: formHtml,
    acciones: [
      { texto: "Cancelar", valor: "cancelar" },
      {
        texto: "Crear Tema",
        valor: "guardar",
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const input = cuerpo.querySelector("#input-titulo-tema");
          const errorSpan = cuerpo.querySelector("#error-titulo-tema");
          const titulo = input ? input.value.trim() : "";

          if (!titulo) {
            if (errorSpan) errorSpan.textContent = "El título es obligatorio";
            ui.aviso("El título del tema es obligatorio", "error");
            if (input) input.focus();
            return false;
          }

          const maxOrden = listaTemas.reduce((max, t) => Math.max(max, Number(t.orden) || 0), 0);
          const siguienteOrden = maxOrden + 1;

          try {
            ui.cargando(true);
            await api.crear("temas", {
              unidadId: unidadSeleccionadaId,
              titulo,
              orden: siguienteOrden,
              estado: "borrador"
            });
            ui.aviso("Tema creado en estado borrador", "exito");
            await cargarTemas(unidadSeleccionadaId);
            return true;
          } catch (err) {
            ui.aviso(err.message || "Error al crear tema", "error");
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

async function alternarEstadoTema(temaId, estadoActual) {
  const nuevoEstado = estadoActual === "publicado" ? "borrador" : "publicado";
  try {
    ui.cargando(true);
    await api.actualizar("temas", temaId, { estado: nuevoEstado });
    ui.aviso(`Tema marcado como ${nuevoEstado}`, "exito");
    await cargarTemas(unidadSeleccionadaId);
  } catch (err) {
    ui.aviso(err.message || "Error al actualizar estado del tema", "error");
  } finally {
    ui.cargando(false);
  }
}

async function moverOrdenTema(indiceOrigen, direccion) {
  const indiceDestino = indiceOrigen + direccion;
  if (indiceDestino < 0 || indiceDestino >= listaTemas.length) return;

  const actual = listaTemas[indiceOrigen];
  const adyacente = listaTemas[indiceDestino];

  const ordenActual = Number(actual.orden) || indiceOrigen + 1;
  const ordenAdyacente = Number(adyacente.orden) || indiceDestino + 1;

  try {
    ui.cargando(true);
    await api.actualizar("temas", actual.id, { orden: ordenAdyacente });
    await api.actualizar("temas", adyacente.id, { orden: ordenActual });
    ui.aviso("Orden de temas actualizado", "exito");
    await cargarTemas(unidadSeleccionadaId);
  } catch (err) {
    ui.aviso(err.message || "Error al reordenar temas", "error");
  } finally {
    ui.cargando(false);
  }
}

// -------------------------------------------------------------
// EVENTOS Y DELEGACIÓN
// -------------------------------------------------------------

// Cambio en el selector de asignaturas
selectAsignatura.addEventListener("change", async (e) => {
  const nuevaAsigId = e.target.value;
  asignaturaSeleccionadaId = nuevaAsigId;

  // Actualizar parámetro en la URL limpiamente sin recargar
  const url = new URL(window.location.href);
  if (nuevaAsigId) {
    url.searchParams.set("asignaturaId", nuevaAsigId);
  } else {
    url.searchParams.delete("asignaturaId");
  }
  window.history.replaceState({}, "", url.pathname + url.search);

  await cargarUnidades(nuevaAsigId);
});

// Botones superiores de creación
btnNuevaUnidad.addEventListener("click", () => abrirModalCrearUnidad());
btnNuevoTema.addEventListener("click", () => abrirModalCrearTema());

// Delegación en la lista de unidades
contenedorUnidades.addEventListener("click", async (e) => {
  const btnSeleccionar = e.target.closest(".btn-seleccionar-unidad");
  if (btnSeleccionar) {
    const id = btnSeleccionar.getAttribute("data-id");
    if (id && id !== unidadSeleccionadaId) {
      unidadSeleccionadaId = id;
      renderizarUnidades();
      await cargarTemas(id);
    }
    return;
  }

  const btnRenombrar = e.target.closest(".btn-renombrar-unidad");
  if (btnRenombrar) {
    const id = btnRenombrar.getAttribute("data-id");
    const titulo = btnRenombrar.getAttribute("data-titulo");
    await abrirModalRenombrarUnidad(id, titulo);
    return;
  }

  const btnVisibilidad = e.target.closest(".btn-visibilidad-unidad");
  if (btnVisibilidad) {
    const id = btnVisibilidad.getAttribute("data-id");
    const visible = btnVisibilidad.getAttribute("data-visible") === "true";
    await alternarVisibilidadUnidad(id, visible);
    return;
  }

  const btnSubir = e.target.closest(".btn-subir-unidad");
  if (btnSubir) {
    const index = Number(btnSubir.getAttribute("data-index"));
    await moverOrdenUnidad(index, -1);
    return;
  }

  const btnBajar = e.target.closest(".btn-bajar-unidad");
  if (btnBajar) {
    const index = Number(btnBajar.getAttribute("data-index"));
    await moverOrdenUnidad(index, 1);
    return;
  }
});

// Delegación en la lista de temas
contenedorTemas.addEventListener("click", async (e) => {
  const btnEstado = e.target.closest(".btn-estado-tema");
  if (btnEstado) {
    const id = btnEstado.getAttribute("data-id");
    const estadoActual = btnEstado.getAttribute("data-estado");
    await alternarEstadoTema(id, estadoActual);
    return;
  }

  const btnSubir = e.target.closest(".btn-subir-tema");
  if (btnSubir) {
    const index = Number(btnSubir.getAttribute("data-index"));
    await moverOrdenTema(index, -1);
    return;
  }

  const btnBajar = e.target.closest(".btn-bajar-tema");
  if (btnBajar) {
    const index = Number(btnBajar.getAttribute("data-index"));
    await moverOrdenTema(index, 1);
    return;
  }
});

// Iniciar módulo
await iniciar();
