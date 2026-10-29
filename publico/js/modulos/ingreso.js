// publico/js/modulos/ingreso.js · Módulo de inicio de sesión
import { montarPlantilla } from "../nucleo/plantilla.js";
import sesion from "../nucleo/sesion.js";
import ui from "../nucleo/ui.js";

// Si ya tiene sesión activa, redirigir a inicio
if (sesion.usuarioActual() && sesion.token()) {
  window.location.href = "/index.html";
}

await montarPlantilla({ titulo: "Iniciar Sesión", roles: ["publico"] });

const contenido = document.getElementById("contenido");
if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta ingreso-tarjeta pila">
      <div class="ingreso-encabezado">
        <h2>Bienvenido</h2>
        <p class="color-texto-suave">Ingresa a tu cuenta para continuar aprendiendo</p>
      </div>

      <form id="form-ingreso" novalidate class="pila">
        <div class="campo" id="contenedor-correo">
          <label for="campo-correo">Correo electrónico <span aria-hidden="true">*</span></label>
          <input
            type="email"
            id="campo-correo"
            name="correo"
            autocomplete="email"
            required
            placeholder="ejemplo@correo.com"
          >
          <span class="campo__error" id="error-correo" aria-live="polite"></span>
        </div>

        <div class="campo" id="contenedor-clave">
          <label for="campo-clave">Contraseña <span aria-hidden="true">*</span></label>
          <input
            type="password"
            id="campo-clave"
            name="clave"
            autocomplete="current-password"
            required
            placeholder="Tu contraseña"
          >
          <span class="campo__error" id="error-clave" aria-live="polite"></span>
        </div>

        <button type="submit" class="btn btn--primario" id="btn-enviar">
          Iniciar Sesión
        </button>

        <div class="ingreso-enlaces">
          <p>¿No tienes una cuenta? <a href="/paginas/registro.html">Regístrate aquí</a></p>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("form-ingreso");
  const inputCorreo = document.getElementById("campo-correo");
  const errorCorreo = document.getElementById("error-correo");
  const inputClave = document.getElementById("campo-clave");
  const errorClave = document.getElementById("error-clave");
  const btnEnviar = document.getElementById("btn-enviar");

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    if (!val) {
      errorCorreo.textContent = "El correo es obligatorio";
      inputCorreo.setAttribute("aria-invalid", "true");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errorCorreo.textContent = "Formato de correo no válido";
      inputCorreo.setAttribute("aria-invalid", "true");
      return false;
    }
    errorCorreo.textContent = "";
    inputCorreo.removeAttribute("aria-invalid");
    return true;
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) {
      errorClave.textContent = "La contraseña es obligatoria";
      inputClave.setAttribute("aria-invalid", "true");
      return false;
    }
    errorClave.textContent = "";
    inputClave.removeAttribute("aria-invalid");
    return true;
  }

  // Validación en vivo
  inputCorreo.addEventListener("input", validarCorreo);
  inputCorreo.addEventListener("blur", validarCorreo);
  inputClave.addEventListener("input", validarClave);
  inputClave.addEventListener("blur", validarClave);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correoOk = validarCorreo();
    const claveOk = validarClave();

    if (!correoOk || !claveOk) {
      ui.aviso("Revisa los errores en el formulario", "error");
      return;
    }

    try {
      btnEnviar.disabled = true;
      ui.cargando(true);
      await sesion.iniciar(inputCorreo.value.trim(), inputClave.value);
      ui.aviso("Bienvenido al sistema", "exito");
      window.location.href = "/index.html";
    } catch (err) {
      ui.aviso(err.message || "Error al iniciar sesión", "error");
      btnEnviar.disabled = false;
      ui.cargando(false);
    }
  });
}
