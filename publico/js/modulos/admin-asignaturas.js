// publico/js/modulos/admin-asignaturas.js · Administración de asignaturas (solo admin)
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Asignaturas", roles: ["admin"] });

const contenido = document.getElementById("contenido");

if (contenido) {
  contenido.innerHTML = `
    <div class="pila admin-asig-contenedor">
      <header class="admin-asig-cabecera">
        <div>
          <h2>Gestión de Asignaturas</h2>
          <p class="color-texto-suave">Crea, edita y organiza las materias del plan de estudios.</p>
        </div>
        <button type="button" class="btn btn--primario" id="btn-nueva-asignatura">
          + Nueva Asignatura
        </button>
      </header>

      <!-- Barra de búsqueda -->
      <section class="fila" style="max-width: 400px;">
        <div class="campo" style="flex: 1;">
          <label for="buscar-asignatura" class="sr-only">Buscar asignatura</label>
          <input
            type="search"
            id="buscar-asignatura"
            placeholder="Buscar por nombre o nivel..."
          >
        </div>
      </section>

      <!-- Grid de asignaturas -->
      <section id="grid-asignaturas" class="admin-asig-grid" aria-label="Lista de asignaturas"></section>

      <p id="mensaje-sin-asignaturas" class="alerta alerta--info oculto">
        No hay asignaturas registradas que coincidan con la búsqueda.
      </p>
    </div>
  `;

  let listaAsignaturas = [];
  let listaDistributivo = [];

  const grid = document.getElementById("grid-asignaturas");
  const mensajeSinAsignaturas = document.getElementById("mensaje-sin-asignaturas");
  const inputBuscar = document.getElementById("buscar-asignatura");
  const btnNueva = document.getElementById("btn-nueva-asignatura");

  async function cargarDatos() {
    try {
      ui.cargando(true);
      const [asigs, dist] = await Promise.all([
        api.listar("asignaturas"),
        api.listar("distributivo").catch(() => [])
      ]);
      listaAsignaturas = Array.isArray(asigs) ? asigs : [];
      listaDistributivo = Array.isArray(dist) ? dist : [];
      renderizarTarjetas();
    } catch (err) {
      ui.aviso(err.message || "Error al cargar asignaturas", "error");
    } finally {
      ui.cargando(false);
    }
  }

  function renderizarTarjetas() {
    const texto = inputBuscar.value.trim().toLowerCase();
    const filtradas = listaAsignaturas.filter((a) => {
      if (!a) return false;
      return (
        !texto ||
        (a.nombre && a.nombre.toLowerCase().includes(texto)) ||
        (a.nivel && a.nivel.toLowerCase().includes(texto)) ||
        (a.descripcion && a.descripcion.toLowerCase().includes(texto))
      );
    });

    if (filtradas.length === 0) {
      grid.innerHTML = "";
      mensajeSinAsignaturas.classList.remove("oculto");
      return;
    }

    mensajeSinAsignaturas.classList.add("oculto");
    grid.innerHTML = filtradas
      .map((a) => {
        const numGrupos = listaDistributivo.filter((g) => g && g.asignaturaId === a.id).length;
        const descHtml = a.descripcion
          ? `<p class="color-texto-suave">${ui.escapar(a.descripcion)}</p>`
          : `<p class="color-texto-suave"><em>Sin descripción registrada</em></p>`;

        return `
          <article class="tarjeta-asignatura" data-id="${ui.escapar(a.id)}">
            <div class="tarjeta-asignatura__cuerpo">
              <span class="insignia insignia--primario tarjeta-asignatura__nivel">
                ${ui.escapar(a.nivel || "Nivel no especificado")}
              </span>
              <h3>${ui.escapar(a.nombre || "Sin título")}</h3>
              ${descHtml}
              <small class="color-texto-suave">
                <strong>${numGrupos}</strong> ${numGrupos === 1 ? "grupo vinculado" : "grupos vinculados"}
              </small>
            </div>
            <div class="tarjeta-asignatura__acciones">
              <button
                type="button"
                class="btn btn--secundario btn--pequeno btn-editar"
                data-id="${ui.escapar(a.id)}"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn--peligro btn--pequeno btn-eliminar"
                data-id="${ui.escapar(a.id)}"
                data-nombre="${ui.escapar(a.nombre || '')}"
                data-grupos="${numGrupos}"
              >
                Eliminar
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function abrirModalFormulario(asignatura = null) {
    const esEdicion = Boolean(asignatura && asignatura.id);
    const tituloModal = esEdicion ? "Editar Asignatura" : "Nueva Asignatura";

    const nombreVal = esEdicion ? asignatura.nombre || "" : "";
    const descVal = esEdicion ? asignatura.descripcion || "" : "";
    const nivelVal = esEdicion ? asignatura.nivel || "MAESTRÍA" : "MAESTRÍA";

    const formHtml = `
      <form id="form-modal-asig" class="pila" novalidate>
        <div class="campo">
          <label for="asig-nombre">Nombre de la asignatura <span aria-hidden="true">*</span></label>
          <input
            type="text"
            id="asig-nombre"
            name="nombre"
            required
            value="${ui.escapar(nombreVal)}"
            placeholder="Ej. COMPETENCIAS DIGITALES"
          >
          <span class="campo__error" id="error-asig-nombre"></span>
        </div>

        <div class="campo">
          <label for="asig-nivel">Nivel académico <span aria-hidden="true">*</span></label>
          <select id="asig-nivel" name="nivel" required>
            <option value="MAESTRÍA" ${nivelVal === "MAESTRÍA" ? "selected" : ""}>MAESTRÍA</option>
            <option value="GRADO" ${nivelVal === "GRADO" ? "selected" : ""}>GRADO</option>
            <option value="BACHILLERATO" ${nivelVal === "BACHILLERATO" ? "selected" : ""}>BACHILLERATO</option>
            <option value="BÁSICA" ${nivelVal === "BÁSICA" ? "selected" : ""}>BÁSICA</option>
          </select>
        </div>

        <div class="campo">
          <label for="asig-desc">Descripción</label>
          <textarea
            id="asig-desc"
            name="descripcion"
            rows="3"
            placeholder="Breve resumen de objetivos y contenidos..."
          >${ui.escapar(descVal)}</textarea>
        </div>
      </form>
    `;

    await ui.modal({
      titulo: tituloModal,
      contenido: formHtml,
      acciones: [
        { texto: "Cancelar", valor: "cancelar" },
        {
          texto: esEdicion ? "Actualizar" : "Crear",
          valor: "guardar",
          primario: true,
          alHacer: async (dialogo, cuerpo) => {
            const inputNombre = cuerpo.querySelector("#asig-nombre");
            const inputNivel = cuerpo.querySelector("#asig-nivel");
            const inputDesc = cuerpo.querySelector("#asig-desc");
            const errorNombre = cuerpo.querySelector("#error-asig-nombre");

            const nombre = inputNombre ? inputNombre.value.trim() : "";
            const nivel = inputNivel ? inputNivel.value.trim() : "";
            const descripcion = inputDesc ? inputDesc.value.trim() : "";

            if (!nombre) {
              if (errorNombre) errorNombre.textContent = "El nombre de la asignatura es obligatorio";
              ui.aviso("El nombre de la asignatura es obligatorio", "error");
              if (inputNombre) inputNombre.focus();
              return false;
            }

            try {
              ui.cargando(true);
              if (esEdicion) {
                await api.actualizar("asignaturas", asignatura.id, { nombre, nivel, descripcion });
                ui.aviso("Asignatura actualizada con éxito", "exito");
              } else {
                await api.crear("asignaturas", { nombre, nivel, descripcion });
                ui.aviso("Asignatura creada con éxito", "exito");
              }
              await cargarDatos();
              return true;
            } catch (err) {
              ui.aviso(err.message || "Error al guardar la asignatura", "error");
              return false;
            } finally {
              ui.cargando(false);
            }
          }
        }
      ]
    });
  }

  // Delegación de eventos en el grid para editar y eliminar
  grid.addEventListener("click", async (e) => {
    const btnEditar = e.target.closest(".btn-editar");
    if (btnEditar) {
      const id = btnEditar.getAttribute("data-id");
      const asig = listaAsignaturas.find((a) => a && a.id === id);
      if (asig) {
        abrirModalFormulario(asig);
      }
      return;
    }

    const btnEliminar = e.target.closest(".btn-eliminar");
    if (btnEliminar) {
      const id = btnEliminar.getAttribute("data-id");
      const nombre = btnEliminar.getAttribute("data-nombre");
      const numGrupos = parseInt(btnEliminar.getAttribute("data-grupos") || "0", 10);

      if (numGrupos > 0) {
        ui.aviso(
          `No se puede eliminar "${nombre}" porque tiene ${numGrupos} grupo(s) vinculado(s) en el distributivo.`,
          "error"
        );
        return;
      }

      const seguro = await ui.confirmar(`¿Estás seguro de que deseas eliminar la asignatura "${nombre}"?`);
      if (!seguro) return;

      try {
        ui.cargando(true);
        await api.eliminar("asignaturas", id);
        ui.aviso("Asignatura eliminada con éxito", "exito");
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || "Error al eliminar la asignatura", "error");
      } finally {
        ui.cargando(false);
      }
    }
  });

  btnNueva.addEventListener("click", () => abrirModalFormulario(null));
  inputBuscar.addEventListener("input", renderizarTarjetas);

  await cargarDatos();
}
