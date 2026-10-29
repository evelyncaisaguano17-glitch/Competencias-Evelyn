// publico/js/modulos/registro.js · Módulo de registro de nuevo estudiante
import { montarPlantilla } from "../nucleo/plantilla.js";
import sesion from "../nucleo/sesion.js";
import ui from "../nucleo/ui.js";

// Si ya tiene sesión activa, redirigir a inicio
if (sesion.usuarioActual() && sesion.token()) {
  window.location.href = "/index.html";
}

await montarPlantilla({ titulo: "Registro de Estudiante", roles: ["publico"] });

const contenido = document.getElementById("contenido");
if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta registro-tarjeta pila">
      <div class="registro-encabezado">
        <h2>Crear una Cuenta</h2>
        <p class="color-texto-suave">Únete al Ecosistema Educativo Digital</p>
      </div>

      <form id="form-registro" novalidate class="pila">
        <div class="fila">
          <div class="campo" style="flex: 1; min-width: 200px;">
            <label for="campo-nombre">Nombre <span aria-hidden="true">*</span></label>
            <input
              type="text"
              id="campo-nombre"
              name="nombre"
              autocomplete="given-name"
              required
              placeholder="Tu nombre"
            >
            <span class="campo__error" id="error-nombre" aria-live="polite"></span>
          </div>

          <div class="campo" style="flex: 1; min-width: 200px;">
            <label for="campo-apellido">Apellido <span aria-hidden="true">*</span></label>
            <input
              type="text"
              id="campo-apellido"
              name="apellido"
              autocomplete="family-name"
              required
              placeholder="Tu apellido"
            >
            <span class="campo__error" id="error-apellido" aria-live="polite"></span>
          </div>
        </div>

        <div class="campo">
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

        <div class="campo">
          <label for="campo-clave">Contraseña <span aria-hidden="true">*</span></label>
          <input
            type="password"
            id="campo-clave"
            name="clave"
            autocomplete="new-password"
            required
            placeholder="Mínimo 8 caracteres (letras y números)"
          >
          <span class="campo__error" id="error-clave" aria-live="polite"></span>
        </div>

        <div class="campo">
          <div class="registro-casilla">
            <input type="checkbox" id="campo-consentimiento" name="consentimiento" required>
            <label for="campo-consentimiento">
              Acepto el <a href="/paginas/privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a>
            </label>
          </div>
          <span class="campo__error" id="error-consentimiento" aria-live="polite"></span>
        </div>

        <button type="submit" class="btn btn--primario" id="btn-enviar">
          Crear Cuenta
        </button>

        <div class="registro-enlaces">
          <p>¿Ya tienes una cuenta? <a href="/paginas/ingreso.html">Inicia sesión aquí</a></p>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("form-registro");
  const inputNombre = document.getElementById("campo-nombre");
  const errorNombre = document.getElementById("error-nombre");
  const inputApellido = document.getElementById("campo-apellido");
  const errorApellido = document.getElementById("error-apellido");
  const inputCorreo = document.getElementById("campo-correo");
  const errorCorreo = document.getElementById("error-correo");
  const inputClave = document.getElementById("campo-clave");
  const errorClave = document.getElementById("error-clave");
  const inputConsentimiento = document.getElementById("campo-consentimiento");
  const errorConsentimiento = document.getElementById("error-consentimiento");
  const btnEnviar = document.getElementById("btn-enviar");

  function validarNombre() {
    const val = inputNombre.value.trim();
    if (!val) {
      errorNombre.textContent = "El nombre es obligatorio";
      inputNombre.setAttribute("aria-invalid", "true");
      return false;
    }
    errorNombre.textContent = "";
    inputNombre.removeAttribute("aria-invalid");
    return true;
  }

  function validarApellido() {
    const val = inputApellido.value.trim();
    if (!val) {
      errorApellido.textContent = "El apellido es obligatorio";
      inputApellido.setAttribute("aria-invalid", "true");
      return false;
    }
    errorApellido.textContent = "";
    inputApellido.removeAttribute("aria-invalid");
    return true;
  }

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
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(val)) {
      errorClave.textContent = "Mínimo 8 caracteres, con letras y números";
      inputClave.setAttribute("aria-invalid", "true");
      return false;
    }
    errorClave.textContent = "";
    inputClave.removeAttribute("aria-invalid");
    return true;
  }

  function validarConsentimiento() {
    if (!inputConsentimiento.checked) {
      errorConsentimiento.textContent = "Debes aceptar el aviso de privacidad para continuar";
      inputConsentimiento.setAttribute("aria-invalid", "true");
      return false;
    }
    errorConsentimiento.textContent = "";
    inputConsentimiento.removeAttribute("aria-invalid");
    return true;
  }

  // Validación en vivo
  inputNombre.addEventListener("input", validarNombre);
  inputNombre.addEventListener("blur", validarNombre);
  inputApellido.addEventListener("input", validarApellido);
  inputApellido.addEventListener("blur", validarApellido);
  inputCorreo.addEventListener("input", validarCorreo);
  inputCorreo.addEventListener("blur", validarCorreo);
  inputClave.addEventListener("input", validarClave);
  inputClave.addEventListener("blur", validarClave);
  inputConsentimiento.addEventListener("change", validarConsentimiento);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombreOk = validarNombre();
    const apellidoOk = validarApellido();
    const correoOk = validarCorreo();
    const claveOk = validarClave();
    const consentimientoOk = validarConsentimiento();

    if (!nombreOk || !apellidoOk || !correoOk || !claveOk || !consentimientoOk) {
      ui.aviso("Por favor, corrige los campos marcados", "error");
      return;
    }

    const correo = inputCorreo.value.trim();
    const clave = inputClave.value;

    try {
      btnEnviar.disabled = true;
      ui.cargando(true);

      // 1. Registrar usuario
      await sesion.registrar({
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        correo,
        clave,
        consentimiento: true
      });

      // 2. Iniciar sesión automáticamente
      await sesion.iniciar(correo, clave);

      ui.aviso("Cuenta creada con éxito", "exito");
      window.location.href = "/index.html";
    } catch (err) {
      ui.aviso(err.message || "Error al crear la cuenta", "error");
      btnEnviar.disabled = false;
      ui.cargando(false);
    }
  });
}
