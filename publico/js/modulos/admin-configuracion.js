// publico/js/modulos/admin-configuracion.js · Configuración de proveedor, clave y modelo de IA (solo admin)
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";

await montarPlantilla({ titulo: "Configuración de IA", roles: ["admin"] });

const contenedor = document.getElementById("contenido");

if (contenedor) {
  contenedor.innerHTML = `
    <div class="pila">
      <header class="fila" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <h2>Configuración del Servicio de IA</h2>
          <p class="color-texto-suave">
            Configura el proveedor (Google Gemini), la clave de API (API Key) y el modelo de lenguaje para toda la plataforma.
          </p>
        </div>
        <a href="/paginas/admin-usuarios.html" class="btn btn--secundario btn--pequeno">
          Volver a Usuarios
        </a>
      </header>

      <div class="config-ia-grid">
        <!-- Columna Principal: Formulario de Configuración -->
        <section class="config-ia-card pila" aria-labelledby="titulo-parametros">
          <h3 id="titulo-parametros">Parámetros del Proveedor</h3>

          <form id="form-config-ia" class="pila" style="gap: var(--espacio-md);">
            <!-- Proveedor -->
            <div class="campo">
              <label for="campo-proveedor">Proveedor de Inteligencia Artificial</label>
              <select id="campo-proveedor" required>
                <option value="gemini">Google Gemini (Recomendado)</option>
                <option value="openai">OpenAI (o compatible)</option>
              </select>
              <small class="color-texto-suave">
                Para Google Gemini, se utiliza la API v1beta oficial de Google AI Studio.
              </small>
            </div>

            <!-- Clave de API -->
            <div class="campo">
              <label for="campo-clave">Clave de API (API Key)</label>
              <div class="config-ia-clave-wrapper">
                <input
                  type="password"
                  id="campo-clave"
                  placeholder="Ingresa tu clave de API de Google AI Studio o Gemini"
                  autocomplete="off"
                  spellcheck="false"
                >
                <button
                  type="button"
                  class="btn-toggle-clave"
                  id="btn-toggle-clave"
                  title="Mostrar u ocultar clave"
                  aria-label="Mostrar u ocultar clave"
                >
                  👁️
                </button>
              </div>
              <small class="color-texto-suave">
                La clave se almacena de forma segura en el servidor. Nunca se transmite a los navegadores de estudiantes ni docentes.
              </small>
            </div>

            <!-- Modelo -->
            <div class="campo">
              <label for="campo-modelo">Nombre del Modelo</label>
              <input
                type="text"
                id="campo-modelo"
                list="lista-modelos-sugeridos"
                placeholder="Ej. gemini-3.8-flash, gemini-4-argon, gemini-1.5-flash"
                required
              >
              <datalist id="lista-modelos-sugeridos">
                <option value="gemini-3.8-flash"></option>
                <option value="gemini-4-argon"></option>
                <option value="gemini-2.0-flash"></option>
                <option value="gemini-1.5-flash"></option>
                <option value="gemini-1.5-pro"></option>
                <option value="gpt-4o-mini"></option>
              </datalist>

              <div class="pila" style="gap: var(--espacio-xs); margin-top: var(--espacio-xs);">
                <span class="color-texto-suave" style="font-size: var(--tamano-fuente-xs);">
                  Sugerencias rápidas (haz clic para aplicar):
                </span>
                <div class="chips-modelos" role="group" aria-label="Modelos sugeridos">
                  <button type="button" class="chip-modelo" data-modelo="gemini-3.8-flash">gemini-3.8-flash</button>
                  <button type="button" class="chip-modelo" data-modelo="gemini-4-argon">gemini-4-argon</button>
                  <button type="button" class="chip-modelo" data-modelo="gemini-2.0-flash">gemini-2.0-flash</button>
                  <button type="button" class="chip-modelo" data-modelo="gemini-1.5-flash">gemini-1.5-flash</button>
                </div>
              </div>
            </div>

            <!-- Modo de Operación -->
            <div class="campo">
              <label for="campo-modo">Modo de Operación</label>
              <select id="campo-modo">
                <option value="real">🌐 API Real en Vivo (Llamadas a Google Gemini / OpenAI)</option>
                <option value="mock">🧪 Modo Simulado / Mock (Para pruebas locales sin consumir cuota)</option>
              </select>
              <small class="color-texto-suave">
                En modo simulado, el servidor devuelve ejemplos predefinidos sin llamar al proveedor externo.
              </small>
            </div>

            <div class="fila" style="justify-content: flex-end; gap: var(--espacio-sm); margin-top: var(--espacio-md);">
              <button type="submit" class="btn btn--primario" id="btn-guardar">
                Guardar Configuración
              </button>
            </div>
          </form>
        </section>

        <!-- Columna Secundaria: Diagnóstico y Prueba de Conexión -->
        <section class="config-ia-card pila" aria-labelledby="titulo-diagnostico">
          <h3 id="titulo-diagnostico">Estado y Diagnóstico</h3>
          <p class="color-texto-suave" style="font-size: var(--tamano-fuente-sm);">
            Verifica que la clave y el modelo configurados respondan correctamente a peticiones reales.
          </p>

          <button type="button" class="btn btn--secundario" id="btn-probar-conexion">
            ⚡ Probar Conexión con IA
          </button>

          <div id="caja-resultado-prueba" class="estado-conexion estado-conexion--aviso" style="display: none;">
            <!-- Contenido dinámico de la prueba -->
          </div>

          <hr style="border: 0; border-top: 1px solid var(--color-borde); margin: var(--espacio-sm) 0;">

          <div class="pila" style="gap: var(--espacio-xs); font-size: var(--tamano-fuente-xs); color: var(--color-texto-suave);">
            <strong>📌 Información de configuración:</strong>
            <p>• Los cambios se guardan permanentemente en <code>datos/config/ajustes.json</code> y se sincronizan de inmediato.</p>
            <p>• Si el modelo indicado no está disponible en la versión v1beta de tu API Key, el botón de diagnóstico mostrará el error específico devuelto por Google.</p>
          </div>
        </section>
      </div>
    </div>
  `;

  const form = document.getElementById("form-config-ia");
  const selectProveedor = document.getElementById("campo-proveedor");
  const inputClave = document.getElementById("campo-clave");
  const inputModelo = document.getElementById("campo-modelo");
  const selectModo = document.getElementById("campo-modo");
  const btnToggleClave = document.getElementById("btn-toggle-clave");
  const btnProbar = document.getElementById("btn-probar-conexion");
  const cajaResultado = document.getElementById("caja-resultado-prueba");
  const chipsModelos = document.querySelectorAll(".chip-modelo");

  // Alternar visibilidad de la clave
  btnToggleClave?.addEventListener("click", () => {
    if (inputClave.type === "password") {
      inputClave.type = "text";
      btnToggleClave.textContent = "🔒";
    } else {
      inputClave.type = "password";
      btnToggleClave.textContent = "👁️";
    }
  });

  // Chips para rellenar modelo rápidamente
  chipsModelos.forEach((chip) => {
    chip.addEventListener("click", () => {
      const mod = chip.getAttribute("data-modelo");
      if (mod) {
        inputModelo.value = mod;
        inputModelo.focus();
      }
    });
  });

  // Cargar configuración actual
  async function cargarConfiguracion() {
    ui.cargando(true);
    try {
      const config = await api.llamar("GET", "/api/ia/config");
      selectProveedor.value = config.proveedor || "gemini";
      inputModelo.value = config.modelo || "gemini-3.8-flash";
      selectModo.value = config.mock ? "mock" : "real";
      if (config.clave) {
        inputClave.value = config.clave;
      }
    } catch (err) {
      ui.aviso(err.message || "Error al cargar la configuración de IA", "error");
    } finally {
      ui.cargando(false);
    }
  }

  // Guardar configuración
  form?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ui.cargando(true);
    try {
      const datos = {
        proveedor: selectProveedor.value.trim(),
        modelo: inputModelo.value.trim(),
        clave: inputClave.value.trim(),
        mock: selectModo.value === "mock"
      };

      const res = await api.llamar("PUT", "/api/ia/config", datos);
      ui.aviso(res.mensaje || "Configuración de IA guardada correctamente", "exito");

      // Si no es mock, sugerir ejecutar prueba de conexión
      if (!datos.mock && datos.clave) {
        probarConexion();
      }
    } catch (err) {
      ui.aviso(err.message || "No se pudo guardar la configuración", "error");
    } finally {
      ui.cargando(false);
    }
  });

  // Probar conexión
  async function probarConexion() {
    if (!cajaResultado) return;
    cajaResultado.style.display = "block";
    cajaResultado.className = "estado-conexion estado-conexion--aviso";
    cajaResultado.innerHTML = `⏳ Verificando conexión con el proveedor...`;

    try {
      const res = await api.llamar("GET", "/api/ia/prueba");
      cajaResultado.className = "estado-conexion estado-conexion--ok";
      cajaResultado.innerHTML = `
        <strong>✅ Conexión exitosa</strong><br>
        El proveedor respondió correctamente: <em>${ui.escapar(res.respuesta || "OK")}</em>.<br>
        La generación con IA está lista para usarse en Glosario, Preguntas y Simulaciones.
      `;
    } catch (err) {
      cajaResultado.className = "estado-conexion estado-conexion--error";
      cajaResultado.innerHTML = `
        <strong>❌ Error de conexión con la IA</strong><br>
        ${ui.escapar(err.message || "No fue posible conectar con el proveedor")}.<br><br>
        <small>Verifica que la clave de API sea válida y que el modelo esté activo en tu cuenta de Google Cloud / Google AI Studio.</small>
      `;
    }
  }

  btnProbar?.addEventListener("click", probarConexion);

  await cargarConfiguracion();
}
