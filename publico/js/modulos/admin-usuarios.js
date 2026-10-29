// publico/js/modulos/admin-usuarios.js · Administración de usuarios (solo admin)
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";
import sesion from "../nucleo/sesion.js";

await montarPlantilla({ titulo: "Usuarios", roles: ["admin"] });

const contenido = document.getElementById("contenido");

if (contenido) {
  contenido.innerHTML = `
    <div class="pila admin-contenedor">
      <header class="fila" style="justify-content: space-between;">
        <div>
          <h2>Gestión de Usuarios</h2>
          <p class="color-texto-suave">Administra roles, estados de cuenta y restablecimiento de credenciales.</p>
        </div>
        <div class="fila" style="gap: var(--espacio-sm);">
          <a href="/paginas/admin-configuracion.html" class="btn btn--primario btn--pequeno" id="btn-config-ia">
            ⚙️ Configurar IA
          </a>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-refrescar">
            Actualizar Lista
          </button>
        </div>
      </header>

      <!-- Barra de filtros -->
      <section class="admin-filtros" aria-label="Filtros de búsqueda">
        <div class="campo">
          <label for="filtro-buscar">Buscar usuario</label>
          <input
            type="search"
            id="filtro-buscar"
            placeholder="Buscar por nombre, apellido o correo..."
          >
        </div>

        <div class="campo" style="max-width: 220px;">
          <label for="filtro-rol">Filtrar por rol</label>
          <select id="filtro-rol">
            <option value="">Todos los roles</option>
            <option value="estudiante">Estudiante</option>
            <option value="docente">Docente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </section>

      <!-- Tabla de usuarios -->
      <section class="tabla-contenedor" aria-label="Listado de usuarios">
        <table class="tabla admin-tabla">
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Correo</th>
              <th scope="col">Rol</th>
              <th scope="col" style="text-align: center;">Activo</th>
              <th scope="col" style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-usuarios"></tbody>
        </table>
      </section>

      <p id="mensaje-sin-usuarios" class="alerta alerta--info oculto">
        No se encontraron usuarios que coincidan con los criterios de búsqueda.
      </p>
    </div>
  `;

  let listaUsuarios = [];
  const cuerpoTabla = document.getElementById("cuerpo-tabla-usuarios");
  const filtroBuscar = document.getElementById("filtro-buscar");
  const filtroRol = document.getElementById("filtro-rol");
  const mensajeSinUsuarios = document.getElementById("mensaje-sin-usuarios");
  const btnRefrescar = document.getElementById("btn-refrescar");

  async function cargarUsuarios() {
    try {
      ui.cargando(true);
      listaUsuarios = await api.listar("usuarios");
      renderizarTabla();
    } catch (err) {
      ui.aviso(err.message || "Error al cargar la lista de usuarios", "error");
    } finally {
      ui.cargando(false);
    }
  }

  function renderizarTabla() {
    const textoBusqueda = filtroBuscar.value.trim().toLowerCase();
    const rolSeleccionado = filtroRol.value;
    const usuarioSesion = sesion.usuarioActual();

    const filtrados = listaUsuarios.filter((u) => {
      if (!u) return false;
      const coincideTexto =
        !textoBusqueda ||
        (u.nombre && u.nombre.toLowerCase().includes(textoBusqueda)) ||
        (u.apellido && u.apellido.toLowerCase().includes(textoBusqueda)) ||
        (u.correo && u.correo.toLowerCase().includes(textoBusqueda));

      const coincideRol = !rolSeleccionado || u.rol === rolSeleccionado;
      return coincideTexto && coincideRol;
    });

    if (filtrados.length === 0) {
      cuerpoTabla.innerHTML = "";
      mensajeSinUsuarios.classList.remove("oculto");
      return;
    }

    mensajeSinUsuarios.classList.add("oculto");
    cuerpoTabla.innerHTML = filtrados
      .map((u) => {
        const nombreCompleto = `${u.nombre || ""} ${u.apellido || ""}`.trim() || "Sin nombre";
        const iniciales = `${(u.nombre || "").charAt(0)}${(u.apellido || "").charAt(0)}`.toUpperCase() || "U";
        const avatarHtml = u.foto
          ? `<img src="${ui.escapar(u.foto)}" alt="">`
          : `<span>${ui.escapar(iniciales)}</span>`;

        const esActivo = u.activo !== false;
        const esPropioUsuario = Boolean(usuarioSesion && usuarioSesion.id === u.id);

        return `
          <tr data-id="${ui.escapar(u.id)}">
            <td>
              <div class="admin-usuario-info">
                <div class="admin-usuario-avatar">${avatarHtml}</div>
                <div>
                  <strong>${ui.escapar(nombreCompleto)}${esPropioUsuario ? ' <span class="insignia insignia--secundario" style="margin-left: 0.25rem;">Tú</span>' : ''}</strong>
                  <div><small class="color-texto-suave">ID: ${ui.escapar(u.id)}</small></div>
                </div>
              </div>
            </td>
            <td>${ui.escapar(u.correo || "-")}</td>
            <td>
              <select
                class="selector-rol"
                data-id="${ui.escapar(u.id)}"
                data-rol-actual="${ui.escapar(u.rol || 'estudiante')}"
                ${esPropioUsuario ? 'disabled title="Por seguridad no puedes cambiar tu propio rol"' : ''}
              >
                <option value="estudiante" ${u.rol === "estudiante" ? "selected" : ""}>Estudiante</option>
                <option value="docente" ${u.rol === "docente" ? "selected" : ""}>Docente</option>
                <option value="admin" ${u.rol === "admin" ? "selected" : ""}>Administrador</option>
              </select>
            </td>
            <td style="text-align: center;">
              <input
                type="checkbox"
                class="casilla-activo"
                data-id="${ui.escapar(u.id)}"
                ${esActivo ? "checked" : ""}
                ${esPropioUsuario ? 'disabled title="Por seguridad no puedes desactivar tu propia cuenta"' : ''}
                aria-label="Activar o desactivar cuenta de ${ui.escapar(nombreCompleto)}"
              >
            </td>
            <td style="text-align: right;">
              <button
                type="button"
                class="btn btn--secundario btn--pequeno btn-restablecer"
                data-id="${ui.escapar(u.id)}"
                data-nombre="${ui.escapar(nombreCompleto)}"
                ${esPropioUsuario ? 'disabled title="Para cambiar tu contraseña ve a Mi Perfil"' : ''}
              >
                Restablecer clave
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Delegación de eventos para selector de rol
  cuerpoTabla.addEventListener("change", async (e) => {
    if (e.target.classList.contains("selector-rol")) {
      const select = e.target;
      const id = select.getAttribute("data-id");
      const nuevoRol = select.value;
      const rolAnterior = select.getAttribute("data-rol-actual");

      try {
        ui.cargando(true);
        await api.actualizar("usuarios", id, { rol: nuevoRol });
        select.setAttribute("data-rol-actual", nuevoRol);
        ui.aviso("Rol de usuario actualizado", "exito");
        // Actualizar en el arreglo local
        const usr = listaUsuarios.find((u) => u && u.id === id);
        if (usr) usr.rol = nuevoRol;
      } catch (err) {
        select.value = rolAnterior;
        ui.aviso(err.message || "Error al actualizar el rol", "error");
      } finally {
        ui.cargando(false);
      }
    }

    // Delegación de eventos para casilla Activo
    if (e.target.classList.contains("casilla-activo")) {
      const checkbox = e.target;
      const id = checkbox.getAttribute("data-id");
      const nuevoEstado = checkbox.checked;

      try {
        ui.cargando(true);
        await api.actualizar("usuarios", id, { activo: nuevoEstado });
        ui.aviso(`Usuario ${nuevoEstado ? "activado" : "desactivado"} con éxito`, "exito");
        const usr = listaUsuarios.find((u) => u && u.id === id);
        if (usr) usr.activo = nuevoEstado;
      } catch (err) {
        checkbox.checked = !nuevoEstado;
        ui.aviso(err.message || "Error al actualizar el estado", "error");
      } finally {
        ui.cargando(false);
      }
    }
  });

  // Delegación de eventos para restablecer clave
  cuerpoTabla.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-restablecer");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const nombre = btn.getAttribute("data-nombre");

    const seguro = await ui.confirmar(`¿Deseas restablecer la contraseña de ${nombre}?`);
    if (!seguro) return;

    try {
      ui.cargando(true);
      const res = await api.llamar("POST", `/api/admin/usuarios/${id}/restablecer`);
      const claveTemporal = res.claveTemporal;

      await ui.modal({
        titulo: "Clave Temporal Generada",
        contenido: `
          <div class="pila">
            <p>Se generó una clave temporal para <strong>${ui.escapar(nombre)}</strong>:</p>
            <div class="alerta alerta--info fila" style="justify-content: space-between; align-items: center;">
              <code id="codigo-clave-temp" style="font-size: var(--tamano-l); font-weight: var(--peso-negrita); letter-spacing: 1px;">${ui.escapar(claveTemporal)}</code>
              <button type="button" class="btn btn--primario btn--pequeno" id="btn-copiar-clave">
                Copiar
              </button>
            </div>
            <small class="color-texto-suave">Esta clave se muestra una sola vez. Comunícasela al usuario.</small>
          </div>
        `,
        acciones: [{ texto: "Cerrar", valor: "cerrar", primario: true }]
      });
    } catch (err) {
      ui.aviso(err.message || "Error al restablecer la contraseña", "error");
    } finally {
      ui.cargando(false);
    }
  });

  // Copiar clave temporal al portapapeles desde el modal
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "btn-copiar-clave") {
      const codigo = document.getElementById("codigo-clave-temp");
      if (codigo) {
        navigator.clipboard.writeText(codigo.textContent.trim()).then(() => {
          ui.aviso("Contraseña copiada al portapapeles", "exito");
          e.target.textContent = "¡Copiado!";
        }).catch(() => {
          ui.aviso("No se pudo copiar automáticamente. Selecciónala manualmente.", "advertencia");
        });
      }
    }
  });

  filtroBuscar.addEventListener("input", renderizarTabla);
  filtroRol.addEventListener("change", renderizarTabla);
  btnRefrescar.addEventListener("click", cargarUsuarios);

  await cargarUsuarios();
}
