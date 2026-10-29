// publico/js/modulos/distributivo.js · Gestión del distributivo de grupos (solo admin)
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Distributivo", roles: ["admin"] });

const contenido = document.getElementById("contenido");

if (contenido) {
  contenido.innerHTML = `
    <div class="pila dist-contenedor">
      <header class="dist-cabecera">
        <div>
          <h2>Distributivo Académico</h2>
          <p class="color-texto-suave">Asigna asignaturas, paralelos, docentes y estudiantes a cada grupo.</p>
        </div>
        <button type="button" class="btn btn--primario" id="btn-nuevo-grupo">
          + Nuevo Grupo
        </button>
      </header>

      <!-- Barra de filtros -->
      <section class="dist-filtros" aria-label="Filtros de distributivo">
        <div class="campo" style="flex: 1; min-width: 200px;">
          <label for="buscar-distributivo">Buscar</label>
          <input
            type="search"
            id="buscar-distributivo"
            placeholder="Buscar por asignatura, docente o paralelo..."
          >
        </div>

        <div class="campo" style="min-width: 180px;">
          <label for="filtro-periodo">Período</label>
          <select id="filtro-periodo">
            <option value="">Todos los períodos</option>
          </select>
        </div>
      </section>

      <!-- Tabla de grupos -->
      <section class="dist-tabla-contenedor" aria-label="Listado de grupos">
        <table class="tabla">
          <thead>
            <tr>
              <th scope="col">Asignatura</th>
              <th scope="col" style="text-align: center;">Paralelo</th>
              <th scope="col">Período</th>
              <th scope="col">Docente</th>
              <th scope="col" style="text-align: center;">Estudiantes</th>
              <th scope="col" style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-dist"></tbody>
        </table>
      </section>

      <p id="mensaje-sin-distributivo" class="alerta alerta--info oculto">
        No se encontraron grupos en el distributivo que coincidan con la búsqueda.
      </p>
    </div>
  `;

  let listaGrupos = [];
  let listaAsignaturas = [];
  let listaUsuarios = [];

  const cuerpoTabla = document.getElementById("cuerpo-tabla-dist");
  const mensajeSinGrupos = document.getElementById("mensaje-sin-distributivo");
  const inputBuscar = document.getElementById("buscar-distributivo");
  const selectPeriodo = document.getElementById("filtro-periodo");
  const btnNuevo = document.getElementById("btn-nuevo-grupo");

  async function cargarDatos() {
    try {
      ui.cargando(true);
      const [grupos, asigs, users] = await Promise.all([
        api.listar("distributivo"),
        api.listar("asignaturas").catch(() => []),
        api.listar("usuarios").catch(() => [])
      ]);

      listaGrupos = Array.isArray(grupos) ? grupos : [];
      listaAsignaturas = Array.isArray(asigs) ? asigs : [];
      listaUsuarios = Array.isArray(users) ? users : [];

      actualizarFiltroPeriodos();
      renderizarTabla();
    } catch (err) {
      ui.aviso(err.message || "Error al cargar datos del distributivo", "error");
    } finally {
      ui.cargando(false);
    }
  }

  function actualizarFiltroPeriodos() {
    const periodos = new Set();
    listaGrupos.forEach((g) => {
      if (g && g.periodo) periodos.add(g.periodo);
    });

    const valorActual = selectPeriodo.value;
    selectPeriodo.innerHTML = `<option value="">Todos los períodos</option>` +
      Array.from(periodos)
        .sort()
        .map((p) => `<option value="${ui.escapar(p)}" ${p === valorActual ? "selected" : ""}>${ui.escapar(p)}</option>`)
        .join("");
  }

  function obtenerNombreAsignatura(id) {
    const a = listaAsignaturas.find((item) => item && item.id === id);
    return a ? a.nombre : "Asignatura no encontrada";
  }

  function obtenerNombreDocente(id) {
    const u = listaUsuarios.find((item) => item && item.id === id);
    return u ? `${u.nombre || ""} ${u.apellido || ""}`.trim() : "Docente no asignado";
  }

  function renderizarTabla() {
    const texto = inputBuscar.value.trim().toLowerCase();
    const periodoSel = selectPeriodo.value;

    const filtrados = listaGrupos.filter((g) => {
      if (!g) return false;
      const nombreAsig = obtenerNombreAsignatura(g.asignaturaId).toLowerCase();
      const nombreDoc = obtenerNombreDocente(g.docenteId).toLowerCase();
      const paralelo = (g.paralelo || "").toLowerCase();
      const periodo = (g.periodo || "").toLowerCase();

      const coincideTexto =
        !texto ||
        nombreAsig.includes(texto) ||
        nombreDoc.includes(texto) ||
        paralelo.includes(texto) ||
        periodo.includes(texto);

      const coincidePeriodo = !periodoSel || g.periodo === periodoSel;

      return coincideTexto && coincidePeriodo;
    });

    if (filtrados.length === 0) {
      cuerpoTabla.innerHTML = "";
      mensajeSinGrupos.classList.remove("oculto");
      return;
    }

    mensajeSinGrupos.classList.add("oculto");
    cuerpoTabla.innerHTML = filtrados
      .map((g) => {
        const nombreAsig = obtenerNombreAsignatura(g.asignaturaId);
        const nombreDoc = obtenerNombreDocente(g.docenteId);
        const numEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

        return `
          <tr data-id="${ui.escapar(g.id)}">
            <td>
              <strong>${ui.escapar(nombreAsig)}</strong>
            </td>
            <td style="text-align: center;">
              <span class="insignia insignia--secundario">${ui.escapar(g.paralelo || "A")}</span>
            </td>
            <td>${ui.escapar(g.periodo || "-")}</td>
            <td>${ui.escapar(nombreDoc)}</td>
            <td style="text-align: center;">
              <span class="insignia insignia--primario">${numEstudiantes}</span>
            </td>
            <td style="text-align: right;">
              <button
                type="button"
                class="btn btn--secundario btn--pequeno btn-editar-grupo"
                data-id="${ui.escapar(g.id)}"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn--peligro btn--pequeno btn-eliminar-grupo"
                data-id="${ui.escapar(g.id)}"
                data-asig="${ui.escapar(nombreAsig)}"
                data-paralelo="${ui.escapar(g.paralelo || 'A')}"
              >
                Eliminar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function abrirModalFormulario(grupo = null) {
    const esEdicion = Boolean(grupo && grupo.id);
    const tituloModal = esEdicion ? "Editar Grupo" : "Nuevo Grupo en Distributivo";

    const asignaturaIdVal = esEdicion ? grupo.asignaturaId : "";
    const paraleloVal = esEdicion ? grupo.paralelo || "A" : "A";
    const periodoVal = esEdicion ? grupo.periodo || "2026-2027" : "2026-2027";
    const docenteIdVal = esEdicion ? grupo.docenteId : "";
    const estudiantesSeleccionados = new Set(esEdicion && Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []);

    const docentes = listaUsuarios.filter((u) => u && u.rol === "docente");
    const estudiantes = listaUsuarios.filter((u) => u && u.rol === "estudiante");

    const opcionesAsignaturas = listaAsignaturas
      .map((a) => `<option value="${ui.escapar(a.id)}" ${a.id === asignaturaIdVal ? "selected" : ""}>${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || "General")})</option>`)
      .join("");

    const opcionesDocentes = docentes
      .map((d) => `<option value="${ui.escapar(d.id)}" ${d.id === docenteIdVal ? "selected" : ""}>${ui.escapar(d.nombre || "")} ${ui.escapar(d.apellido || "")} (${ui.escapar(d.correo)})</option>`)
      .join("");

    const itemsEstudiantes = estudiantes
      .map((e) => {
        const checked = estudiantesSeleccionados.has(e.id) ? "checked" : "";
        const nombreCompleto = `${e.nombre || ""} ${e.apellido || ""}`.trim() || e.correo;
        return `
          <label class="dist-estudiante-item" data-id="${ui.escapar(e.id)}" data-texto="${ui.escapar(nombreCompleto.toLowerCase())} ${ui.escapar(e.correo.toLowerCase())}">
            <input type="checkbox" class="chk-estudiante-modal" value="${ui.escapar(e.id)}" ${checked}>
            <span>${ui.escapar(nombreCompleto)} <small class="color-texto-suave">(${ui.escapar(e.correo)})</small></span>
          </label>
        `;
      })
      .join("");

    const contenidoModal = `
      <form id="form-modal-dist" class="pila" novalidate>
        <div class="campo">
          <label for="modal-asig">Asignatura <span aria-hidden="true">*</span></label>
          <select id="modal-asig" required>
            <option value="">-- Selecciona una asignatura --</option>
            ${opcionesAsignaturas}
          </select>
        </div>

        <div class="fila">
          <div class="campo" style="flex: 1;">
            <label for="modal-paralelo">Paralelo <span aria-hidden="true">*</span></label>
            <input type="text" id="modal-paralelo" value="${ui.escapar(paraleloVal)}" required placeholder="Ej. A">
          </div>
          <div class="campo" style="flex: 1;">
            <label for="modal-periodo">Período lectivo <span aria-hidden="true">*</span></label>
            <input type="text" id="modal-periodo" value="${ui.escapar(periodoVal)}" required placeholder="Ej. 2026-2027">
          </div>
        </div>

        <div class="campo">
          <label for="modal-docente">Docente asignado <span aria-hidden="true">*</span></label>
          <select id="modal-docente" required>
            <option value="">-- Selecciona un docente --</option>
            ${opcionesDocentes}
          </select>
        </div>

        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <label>Estudiantes del grupo</label>
            <span id="modal-contador-estudiantes" class="dist-contador-badge">
              ${estudiantesSeleccionados.size} seleccionados
            </span>
          </div>

          <div class="dist-selector-estudiantes">
            <input
              type="search"
              id="modal-buscar-est"
              placeholder="Filtrar estudiantes..."
              style="margin-bottom: var(--espacio-xs);"
            >
            <div class="dist-estudiantes-lista" id="modal-lista-estudiantes">
              ${itemsEstudiantes.length > 0 ? itemsEstudiantes : '<p class="color-texto-suave" style="padding: var(--espacio-s);">No hay estudiantes registrados</p>'}
            </div>
          </div>
        </div>
      </form>
    `;

    // Conectar eventos dinámicos para el buscador y contador de estudiantes
    setTimeout(() => {
      const inputBuscarEst = document.getElementById("modal-buscar-est");
      const listaEst = document.getElementById("modal-lista-estudiantes");
      const contadorEst = document.getElementById("modal-contador-estudiantes");

      function actualizarContador() {
        const seleccionados = listaEst ? listaEst.querySelectorAll(".chk-estudiante-modal:checked").length : 0;
        if (contadorEst) {
          contadorEst.textContent = `${seleccionados} ${seleccionados === 1 ? "seleccionado" : "seleccionados"}`;
        }
      }

      if (listaEst) {
        listaEst.addEventListener("change", (e) => {
          if (e.target && e.target.classList.contains("chk-estudiante-modal")) {
            actualizarContador();
          }
        });
      }

      if (inputBuscarEst && listaEst) {
        inputBuscarEst.addEventListener("input", () => {
          const q = inputBuscarEst.value.trim().toLowerCase();
          const items = listaEst.querySelectorAll(".dist-estudiante-item");
          items.forEach((item) => {
            const txt = item.getAttribute("data-texto") || "";
            if (!q || txt.includes(q)) {
              item.style.display = "flex";
            } else {
              item.style.display = "none";
            }
          });
        });
      }
    }, 10);

    // Abrir modal y añadir listeners reactivos dentro del DOM del modal
    await ui.modal({
      titulo: tituloModal,
      contenido: contenidoModal,
      acciones: [
        { texto: "Cancelar", valor: "cancelar" },
        {
          texto: esEdicion ? "Actualizar" : "Crear Grupo",
          valor: "guardar",
          primario: true,
          alHacer: async (dialogo, cuerpo) => {
            const selAsig = cuerpo.querySelector("#modal-asig");
            const inputParalelo = cuerpo.querySelector("#modal-paralelo");
            const inputPeriodo = cuerpo.querySelector("#modal-periodo");
            const selDocente = cuerpo.querySelector("#modal-docente");
            const listaEst = cuerpo.querySelector("#modal-lista-estudiantes");

            const asignaturaId = selAsig ? selAsig.value.trim() : "";
            const paralelo = inputParalelo ? inputParalelo.value.trim().toUpperCase() : "";
            const periodo = inputPeriodo ? inputPeriodo.value.trim() : "";
            const docenteId = selDocente ? selDocente.value.trim() : "";

            const estudiantes = [];
            if (listaEst) {
              listaEst.querySelectorAll(".chk-estudiante-modal:checked").forEach((chk) => {
                estudiantes.push(chk.value);
              });
            }

            if (!asignaturaId) {
              ui.aviso("Debes seleccionar una asignatura", "error");
              if (selAsig) selAsig.focus();
              return false;
            }
            if (!paralelo) {
              ui.aviso("El paralelo es obligatorio", "error");
              if (inputParalelo) inputParalelo.focus();
              return false;
            }
            if (!periodo) {
              ui.aviso("El período lectivo es obligatorio", "error");
              if (inputPeriodo) inputPeriodo.focus();
              return false;
            }
            if (!docenteId) {
              ui.aviso("Debes asignar un docente", "error");
              if (selDocente) selDocente.focus();
              return false;
            }

            const datosGrupo = { asignaturaId, paralelo, periodo, docenteId, estudiantes };

            try {
              ui.cargando(true);
              if (esEdicion) {
                await api.actualizar("distributivo", grupo.id, datosGrupo);
                ui.aviso("Grupo actualizado con éxito", "exito");
              } else {
                await api.crear("distributivo", datosGrupo);
                ui.aviso("Grupo creado con éxito", "exito");
              }
              await cargarDatos();
              return true;
            } catch (err) {
              ui.aviso(err.message || "Error al guardar grupo en distributivo", "error");
              return false;
            } finally {
              ui.cargando(false);
            }
          }
        }
      ]
    });
  }

  // Delegación de eventos en la tabla para editar y eliminar
  cuerpoTabla.addEventListener("click", async (e) => {
    const btnEditar = e.target.closest(".btn-editar-grupo");
    if (btnEditar) {
      const id = btnEditar.getAttribute("data-id");
      const grupo = listaGrupos.find((g) => g && g.id === id);
      if (grupo) {
        abrirModalFormulario(grupo);
      }
      return;
    }

    const btnEliminar = e.target.closest(".btn-eliminar-grupo");
    if (btnEliminar) {
      const id = btnEliminar.getAttribute("data-id");
      const asig = btnEliminar.getAttribute("data-asig");
      const paralelo = btnEliminar.getAttribute("data-paralelo");

      const seguro = await ui.confirmar(
        `¿Estás seguro de que deseas eliminar el grupo paralelo ${paralelo} de "${asig}"?`
      );
      if (!seguro) return;

      try {
        ui.cargando(true);
        await api.eliminar("distributivo", id);
        ui.aviso("Grupo eliminado del distributivo con éxito", "exito");
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || "Error al eliminar el grupo", "error");
      } finally {
        ui.cargando(false);
      }
    }
  });

  btnNuevo.addEventListener("click", () => abrirModalFormulario(null));
  inputBuscar.addEventListener("input", renderizarTabla);
  selectPeriodo.addEventListener("change", renderizarTabla);

  await cargarDatos();
}
