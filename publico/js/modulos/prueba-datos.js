// publico/js/modulos/prueba-datos.js · Lógica para formulario y listado de la colección "prueba"
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Prueba de datos", roles: ["publico"] });

const contenido = document.getElementById("contenido");
if (contenido) {
  contenido.innerHTML = `
    <div class="pila">
      <form id="form-prueba" class="tarjeta pila prueba-formulario">
        <h2>Nuevo registro en "prueba"</h2>
        <div class="campo">
          <label for="campo-texto">Texto <span aria-hidden="true">*</span></label>
          <input type="text" id="campo-texto" name="texto" required placeholder="Escribe un texto de prueba...">
          <small class="campo__ayuda">El dato se almacenará en la colección "prueba" mediante api.crear().</small>
        </div>
        <div class="fila">
          <button type="submit" class="btn btn--primario" id="btn-guardar">
            Guardar registro
          </button>
        </div>
      </form>

      <section class="prueba-registros pila" aria-labelledby="titulo-registros">
        <div class="fila" style="justify-content: space-between;">
          <h2 id="titulo-registros">Registros almacenados</h2>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-refrescar">
            Actualizar lista
          </button>
        </div>
        <div class="tabla-contenedor">
          <table class="tabla" id="tabla-registros">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Texto</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody id="cuerpo-tabla"></tbody>
          </table>
        </div>
        <p id="mensaje-vacio" class="prueba-vacio oculto">No hay registros guardados en la colección "prueba".</p>
      </section>
    </div>
  `;

  const form = document.getElementById("form-prueba");
  const inputTexto = document.getElementById("campo-texto");
  const cuerpoTabla = document.getElementById("cuerpo-tabla");
  const mensajeVacio = document.getElementById("mensaje-vacio");
  const btnRefrescar = document.getElementById("btn-refrescar");

  async function cargarRegistros() {
    try {
      ui.cargando(true);
      const registros = await api.listar("prueba");
      if (!Array.isArray(registros) || registros.length === 0) {
        cuerpoTabla.innerHTML = "";
        mensajeVacio.classList.remove("oculto");
      } else {
        mensajeVacio.classList.add("oculto");
        cuerpoTabla.innerHTML = registros
          .map(
            (reg) => `
              <tr>
                <td><code>${ui.escapar(reg.id || "")}</code></td>
                <td>${ui.escapar(reg.texto || "")}</td>
                <td><small>${ui.escapar(reg.fecha || "-")}</small></td>
              </tr>
            `
          )
          .join("");
      }
    } catch (error) {
      ui.aviso(error.message || "Error al listar los registros", "error");
    } finally {
      ui.cargando(false);
    }
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const texto = inputTexto.value.trim();
    if (!texto) {
      ui.aviso("El campo texto es obligatorio", "error");
      return;
    }

    try {
      ui.cargando(true);
      await api.crear("prueba", { texto });
      ui.aviso("Registro guardado con éxito", "exito");
      inputTexto.value = "";
      await cargarRegistros();
    } catch (error) {
      ui.aviso(error.message || "Error al guardar el registro", "error");
    } finally {
      ui.cargando(false);
    }
  });

  if (btnRefrescar) {
    btnRefrescar.addEventListener("click", () => cargarRegistros());
  }

  await cargarRegistros();
}
