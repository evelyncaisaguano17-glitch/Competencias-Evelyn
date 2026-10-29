// publico/js/modulos/perfil.js · Módulo de gestión del perfil de usuario y foto
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";
import util from "../nucleo/util.js";
import { logrosDe } from "../nucleo/gamificacion.js";
import { generarDiploma } from "../nucleo/pdf.js";

if (typeof document !== "undefined") {
  await montarPlantilla({ titulo: "Mi Perfil", roles: ["sesion"] });
}

const contenido = typeof document !== "undefined" ? document.getElementById("contenido") : null;


/**
 * Optimiza y comprime una imagen en el navegador si excede las dimensiones o el peso máximo.
 * @param {File} archivo
 * @param {number} maxDim - Dimensión máxima en px
 * @param {number} calidad - Factor de compresión JPEG (0.1 - 1.0)
 * @returns {Promise<File>}
 */
async function optimizarImagen(archivo, maxDim = 1200, calidad = 0.85) {
  if (!archivo || !archivo.type.startsWith("image/")) {
    return archivo;
  }

  // Si ya es liviana (<= 1.8 MB), se conserva el original
  if (archivo.size <= 1.8 * 1024 * 1024) {
    return archivo;
  }

  return new Promise((resolve) => {
    const lector = new FileReader();
    lector.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < archivo.size) {
              const nombreBase = archivo.name.replace(/\.[^.]+$/, "");
              const optimizado = new File([blob], `${nombreBase}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now()
              });
              resolve(optimizado);
            } else {
              resolve(archivo);
            }
          },
          "image/jpeg",
          calidad
        );
      };
      img.onerror = () => resolve(archivo);
      img.src = e.target.result;
    };
    lector.onerror = () => resolve(archivo);
    lector.readAsDataURL(archivo);
  });
}

async function cargarPerfil() {
  if (!contenido) return;

  try {
    ui.cargando(true);
    const usuario = await api.llamar("GET", "/api/auth/yo");
    const iniciales = `${(usuario.nombre || "").charAt(0)}${(usuario.apellido || "").charAt(0)}`.toUpperCase() || "U";
    const fechaReg = usuario.fecha ? util.fechaLarga(usuario.fecha) : "-";

    const avatarHtml = usuario.foto
      ? `<img src="${ui.escapar(usuario.foto)}" alt="Foto de perfil de ${ui.escapar(usuario.nombre || '')}" class="perfil-avatar-img">`
      : `<span aria-hidden="true">${ui.escapar(iniciales)}</span>`;

    contenido.innerHTML = `
      <div class="pila perfil-contenedor">
        <!-- Resumen de cuenta -->
        <section class="tarjeta pila" aria-labelledby="titulo-resumen">
          <div class="perfil-cabecera">
            <div class="perfil-avatar">${avatarHtml}</div>
            <div class="perfil-datos">
              <h2 id="titulo-resumen">${ui.escapar(usuario.nombre || "")} ${ui.escapar(usuario.apellido || "")}</h2>
              <span class="insignia insignia--primario">${ui.escapar(usuario.rol || "estudiante")}</span>
            </div>
          </div>

          <dl class="perfil-detalles">
            <div>
              <dt>Correo electrónico</dt>
              <dd>${ui.escapar(usuario.correo || "")}</dd>
            </div>
            <div>
              <dt>ID de usuario</dt>
              <dd><code>${ui.escapar(usuario.id || "")}</code></dd>
            </div>
            <div>
              <dt>Miembro desde</dt>
              <dd>${ui.escapar(fechaReg)}</dd>
            </div>
            <div>
              <dt>Estado de cuenta</dt>
              <dd>${usuario.activo !== false ? "Activa" : "Inactiva"}</dd>
            </div>
          </dl>
        </section>

        <!-- Formulario 1: Datos Personales y Foto -->
        <section class="tarjeta pila" aria-labelledby="titulo-datos">
          <h3 id="titulo-datos">Datos Personales</h3>
          <form id="form-datos" novalidate class="pila">
            <div class="fila">
              <div class="campo" style="flex: 1; min-width: 200px;">
                <label for="campo-nombre">Nombre <span aria-hidden="true">*</span></label>
                <input
                  type="text"
                  id="campo-nombre"
                  name="nombre"
                  required
                  value="${ui.escapar(usuario.nombre || "")}"
                >
                <span class="campo__error" id="error-nombre" aria-live="polite"></span>
              </div>

              <div class="campo" style="flex: 1; min-width: 200px;">
                <label for="campo-apellido">Apellido <span aria-hidden="true">*</span></label>
                <input
                  type="text"
                  id="campo-apellido"
                  name="apellido"
                  required
                  value="${ui.escapar(usuario.apellido || "")}"
                >
                <span class="campo__error" id="error-apellido" aria-live="polite"></span>
              </div>
            </div>

            <div class="campo">
              <label for="campo-foto">Foto de perfil</label>
              <div class="fila" style="align-items: center; gap: var(--espacio-m);">
                <img id="preview-avatar" class="perfil-preview-foto oculto" alt="Vista previa de foto">
                <input
                  type="file"
                  id="campo-foto"
                  name="archivo"
                  accept="image/jpeg,image/png,image/webp"
                  style="flex: 1;"
                >
              </div>
              <small class="color-texto-suave">Formatos permitidos: JPG, PNG o WEBP (se optimiza automáticamente si supera 2 MB).</small>
              <span class="campo__error" id="error-foto" aria-live="polite"></span>
            </div>

            <div class="fila">
              <button type="submit" class="btn btn--primario" id="btn-guardar-datos">
                Guardar Cambios
              </button>
            </div>
          </form>
        </section>

        <!-- Formulario 2: Cambiar Contraseña -->
        <section class="tarjeta pila" aria-labelledby="titulo-clave">
          <h3 id="titulo-clave">Cambiar Contraseña</h3>
          <form id="form-clave" novalidate class="pila">
            <div class="campo">
              <label for="campo-clave-actual">Contraseña actual <span aria-hidden="true">*</span></label>
              <input
                type="password"
                id="campo-clave-actual"
                name="actual"
                autocomplete="current-password"
                required
                placeholder="Ingresa tu contraseña actual"
              >
              <span class="campo__error" id="error-clave-actual" aria-live="polite"></span>
            </div>

            <div class="fila">
              <div class="campo" style="flex: 1; min-width: 200px;">
                <label for="campo-clave-nueva">Nueva contraseña <span aria-hidden="true">*</span></label>
                <input
                  type="password"
                  id="campo-clave-nueva"
                  name="nueva"
                  autocomplete="new-password"
                  required
                  placeholder="Mínimo 8 caracteres (letras y números)"
                >
                <span class="campo__error" id="error-clave-nueva" aria-live="polite"></span>
              </div>

              <div class="campo" style="flex: 1; min-width: 200px;">
                <label for="campo-clave-repetir">Repetir nueva contraseña <span aria-hidden="true">*</span></label>
                <input
                  type="password"
                  id="campo-clave-repetir"
                  name="repetir"
                  autocomplete="new-password"
                  required
                  placeholder="Repite la nueva contraseña"
                >
                <span class="campo__error" id="error-clave-repetir" aria-live="polite"></span>
              </div>
            </div>

            <div class="fila">
              <button type="submit" class="btn btn--secundario" id="btn-guardar-clave">
                Actualizar Contraseña
              </button>
            </div>
          </form>
        </section>

        <!-- Sección de logros (se completa en Sprint 5) -->
        <section id="logros" aria-label="Logros y reconocimientos"></section>
      </div>
    `;

    // Eventos Formulario 1: Datos Personales y Foto
    const formDatos = document.getElementById("form-datos");
    const inputNombre = document.getElementById("campo-nombre");
    const errorNombre = document.getElementById("error-nombre");
    const inputApellido = document.getElementById("campo-apellido");
    const errorApellido = document.getElementById("error-apellido");
    const inputFoto = document.getElementById("campo-foto");
    const errorFoto = document.getElementById("error-foto");
    const previewAvatar = document.getElementById("preview-avatar");
    const btnGuardarDatos = document.getElementById("btn-guardar-datos");

    let archivoSeleccionado = null;

    function validarNombre() {
      const v = inputNombre.value.trim();
      if (!v) {
        errorNombre.textContent = "El nombre es obligatorio";
        inputNombre.setAttribute("aria-invalid", "true");
        return false;
      }
      errorNombre.textContent = "";
      inputNombre.removeAttribute("aria-invalid");
      return true;
    }

    function validarApellido() {
      const v = inputApellido.value.trim();
      if (!v) {
        errorApellido.textContent = "El apellido es obligatorio";
        inputApellido.setAttribute("aria-invalid", "true");
        return false;
      }
      errorApellido.textContent = "";
      inputApellido.removeAttribute("aria-invalid");
      return true;
    }

    inputNombre.addEventListener("input", validarNombre);
    inputApellido.addEventListener("input", validarApellido);

    // Al seleccionar imagen: validación, optimización automática si excede 2 MB y vista previa
    inputFoto.addEventListener("change", async () => {
      errorFoto.textContent = "";
      if (inputFoto.files && inputFoto.files[0]) {
        let archivo = inputFoto.files[0];
        if (!archivo.type.startsWith("image/")) {
          errorFoto.textContent = "Solo se permiten imágenes (JPG, PNG o WEBP)";
          archivoSeleccionado = null;
          previewAvatar.classList.add("oculto");
          return;
        }

        if (archivo.size > 2 * 1024 * 1024) {
          ui.aviso("Optimizando tamaño de la imagen para ajustarla a 2 MB...", "info");
          archivo = await optimizarImagen(archivo);
        }

        archivoSeleccionado = archivo;

        // Mostrar previsualización
        const lector = new FileReader();
        lector.onload = (e) => {
          previewAvatar.src = e.target.result;
          previewAvatar.classList.remove("oculto");
        };
        lector.readAsDataURL(archivo);
      } else {
        archivoSeleccionado = null;
        previewAvatar.classList.add("oculto");
      }
    });

    formDatos.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validarNombre() || !validarApellido()) {
        ui.aviso("Revisa los campos del formulario de datos", "error");
        return;
      }

      try {
        btnGuardarDatos.disabled = true;
        ui.cargando(true);

        let fotoUrl = usuario.foto || null;
        if (archivoSeleccionado) {
          let archivoParaSubir = archivoSeleccionado;
          if (archivoParaSubir.size > 2 * 1024 * 1024) {
            archivoParaSubir = await optimizarImagen(archivoParaSubir);
          }

          if (archivoParaSubir.size > 2 * 1024 * 1024) {
            errorFoto.textContent = "La imagen no pudo reducirse a menos de 2 MB. Elige una imagen más liviana.";
            btnGuardarDatos.disabled = false;
            ui.cargando(false);
            return;
          }

          const subida = await api.subir(archivoParaSubir);
          fotoUrl = subida.url;
        }

        const actualizado = await api.llamar("PUT", "/api/auth/perfil", {
          nombre: inputNombre.value.trim(),
          apellido: inputApellido.value.trim(),
          foto: fotoUrl
        });

        // Actualizar sesión guardada en sessionStorage
        const sesionActual = JSON.parse(sessionStorage.getItem("usuario") || "{}");
        const nuevaSesion = { ...sesionActual, ...actualizado };
        sessionStorage.setItem("usuario", JSON.stringify(nuevaSesion));

        ui.aviso("Perfil actualizado correctamente", "exito");
        await cargarPerfil();
      } catch (err) {
        ui.aviso(err.message || "Error al actualizar perfil", "error");
      } finally {
        btnGuardarDatos.disabled = false;
        ui.cargando(false);
      }
    });

    // Eventos Formulario 2: Cambiar Contraseña
    const formClave = document.getElementById("form-clave");
    const inputActual = document.getElementById("campo-clave-actual");
    const errorActual = document.getElementById("error-clave-actual");
    const inputNueva = document.getElementById("campo-clave-nueva");
    const errorNueva = document.getElementById("error-clave-nueva");
    const inputRepetir = document.getElementById("campo-clave-repetir");
    const errorRepetir = document.getElementById("error-clave-repetir");
    const btnGuardarClave = document.getElementById("btn-guardar-clave");

    function validarClaveActual() {
      if (!inputActual.value) {
        errorActual.textContent = "Ingresa tu contraseña actual";
        inputActual.setAttribute("aria-invalid", "true");
        return false;
      }
      errorActual.textContent = "";
      inputActual.removeAttribute("aria-invalid");
      return true;
    }

    function validarClaveNueva() {
      const v = inputNueva.value;
      if (!v) {
        errorNueva.textContent = "Ingresa la nueva contraseña";
        inputNueva.setAttribute("aria-invalid", "true");
        return false;
      }
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v)) {
        errorNueva.textContent = "Mínimo 8 caracteres, con letras y números";
        inputNueva.setAttribute("aria-invalid", "true");
        return false;
      }
      errorNueva.textContent = "";
      inputNueva.removeAttribute("aria-invalid");
      return true;
    }

    function validarRepetir() {
      if (inputRepetir.value !== inputNueva.value) {
        errorRepetir.textContent = "Las contraseñas no coinciden";
        inputRepetir.setAttribute("aria-invalid", "true");
        return false;
      }
      errorRepetir.textContent = "";
      inputRepetir.removeAttribute("aria-invalid");
      return true;
    }

    inputActual.addEventListener("input", validarClaveActual);
    inputNueva.addEventListener("input", () => {
      validarClaveNueva();
      if (inputRepetir.value) validarRepetir();
    });
    inputRepetir.addEventListener("input", validarRepetir);

    formClave.addEventListener("submit", async (e) => {
      e.preventDefault();
      const actualOk = validarClaveActual();
      const nuevaOk = validarClaveNueva();
      const confirmarOk = validarRepetir();

      if (!actualOk || !nuevaOk || !confirmarOk) {
        ui.aviso("Verifica los errores en el formulario de contraseña", "error");
        return;
      }

      try {
        btnGuardarClave.disabled = true;
        ui.cargando(true);
        await api.llamar("POST", "/api/auth/clave", {
          actual: inputActual.value,
          nueva: inputNueva.value
        });

        ui.aviso("Contraseña actualizada con éxito", "exito");
        formClave.reset();
      } catch (err) {
        ui.aviso(err.message || "Error al cambiar la contraseña", "error");
      } finally {
        btnGuardarClave.disabled = false;
        ui.cargando(false);
      }
    });

    // Renderizar sección de logros para estudiantes (Sprint 5)
    await renderizarLogros(usuario);

  } catch (err) {
    ui.aviso(err.message || "Error al cargar la información del perfil", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la sección de logros, vitrina de insignias y certificado de cumplimiento para estudiantes.
 * @param {Object} usuario
 */
export async function renderizarLogros(usuario) {
  if (typeof document === "undefined") return;
  const seccionLogros = document.getElementById("logros");
  if (!seccionLogros) return;

  // Solo estudiantes
  if (!usuario || usuario.rol !== "estudiante") {
    seccionLogros.innerHTML = "";
    return;
  }

  try {
    // 1. Puntos totales (logrosDe())
    const datosLogros = await logrosDe("yo").catch(() => ({ puntos: 0, insignias: [] }));
    const puntosTotales = typeof datosLogros?.puntos === "number" ? datosLogros.puntos : 0;

    // 2. Insignias obtenidas y bloqueadas a partir de api.listar("insignias")
    const catalogoInsignias = await api.listar("insignias").catch(() => []);
    const insigniasUsuario = Array.isArray(datosLogros?.insignias) ? datosLogros.insignias : [];

    const obtenidasMap = new Map();
    for (const ins of insigniasUsuario) {
      if (typeof ins === "string") {
        obtenidasMap.set(ins, { id: ins, fecha: null });
      } else if (ins && ins.id) {
        obtenidasMap.set(ins.id, ins);
      }
    }

    // 3. Certificado de cumplimiento (GET /api/certificados/estado)
    const estadoCert = await api.llamar("GET", "/api/certificados/estado").catch(() => ({
      condiciones: [],
      cumple: false
    }));
    const condiciones = Array.isArray(estadoCert?.condiciones) ? estadoCert.condiciones : [];
    const cumple = Boolean(estadoCert?.cumple);

    seccionLogros.className = "pila logros-seccion";
    seccionLogros.innerHTML = `
      <!-- 1. Puntos totales -->
      <div class="tarjeta logros-puntos-contenedor" aria-labelledby="titulo-puntos">
        <div class="logros-puntos-info">
          <h3 id="titulo-puntos" style="margin: 0;">Puntos Totales</h3>
          <p class="color-texto-suave" style="margin: var(--espacio-xs) 0 0 0;">
            Puntos acumulados en actividades y evaluaciones del ecosistema
          </p>
        </div>
        <div class="logros-puntos-valor" aria-label="${puntosTotales} puntos">
          <span class="logros-puntos-icono" aria-hidden="true">🪙</span>
          <span class="logros-puntos-numero">${puntosTotales}</span>
          <span class="logros-puntos-sufijo">pts</span>
        </div>
      </div>

      <!-- 2. Vitrina de insignias -->
      <div class="tarjeta pila vitrina-contenedor" aria-labelledby="titulo-vitrina">
        <div class="fila" style="justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: var(--espacio-s);">
          <div>
            <h3 id="titulo-vitrina" style="margin: 0;">Vitrina de Insignias</h3>
            <p class="color-texto-suave" style="margin: var(--espacio-xs) 0 0 0;">
              Insignias obtenidas y retos pendientes
            </p>
          </div>
          <span class="insignia insignia--primario">
            ${obtenidasMap.size} de ${catalogoInsignias.length} obtenidas
          </span>
        </div>

        <div class="vitrina-grid" role="list">
          ${catalogoInsignias.map(ins => {
            const obtenida = obtenidasMap.get(ins.id);
            if (obtenida) {
              const fechaTexto = obtenida.fecha ? util.fechaLarga(obtenida.fecha) : 'Obtenida';
              return `
                <div class="insignia-card insignia-card--obtenida" role="listitem">
                  <div class="insignia-card__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏆')}</div>
                  <div class="insignia-card__info">
                    <strong class="insignia-card__nombre">${ui.escapar(ins.nombre)}</strong>
                    <span class="insignia-card__fecha">${ui.escapar(fechaTexto)}</span>
                  </div>
                  <span class="insignia insignia--exito">Obtenida</span>
                </div>
              `;
            } else {
              return `
                <div class="insignia-card insignia-card--bloqueada" role="listitem">
                  <div class="insignia-card__icono" aria-hidden="true">${ui.escapar(ins.icono || '🔒')}</div>
                  <div class="insignia-card__info">
                    <strong class="insignia-card__nombre">${ui.escapar(ins.nombre)}</strong>
                    <p class="insignia-card__condicion">${ui.escapar(ins.descripcion || 'Condición pendiente')}</p>
                  </div>
                  <span class="insignia">Bloqueada</span>
                </div>
              `;
            }
          }).join('')}
        </div>
      </div>

      <!-- 3. Certificado de cumplimiento -->
      <div class="tarjeta pila certificado-contenedor" aria-labelledby="titulo-cert-cumplimiento">
        <div class="fila" style="justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: var(--espacio-s);">
          <div>
            <h3 id="titulo-cert-cumplimiento" style="margin: 0;">Certificado de cumplimiento</h3>
            <p class="color-texto-suave" style="margin: var(--espacio-xs) 0 0 0;">
              Progreso de los requisitos académicos para la certificación
            </p>
          </div>
          <span class="insignia ${cumple ? 'insignia--exito' : 'insignia--advertencia'}">
            ${cumple ? 'Cumple requisitos' : 'En progreso'}
          </span>
        </div>

        <div class="certificado-condiciones pila" style="gap: var(--espacio-m);">
          ${condiciones.map(c => {
            const requerido = Number(c.requerido) || 1;
            const actual = Number(c.actual) || 0;
            const pct = Math.min(100, Math.max(0, Math.round((actual / requerido) * 100)));
            return `
              <div class="certificado-condicion-item pila" style="gap: var(--espacio-xs);">
                <div class="fila" style="justify-content: space-between; align-items: center;">
                  <span class="certificado-condicion-nombre">
                    <strong>${ui.escapar(c.nombre)}</strong>
                  </span>
                  <span class="color-texto-suave" style="font-size: var(--tamano-s);">
                    ${actual} / ${requerido} ${c.cumple ? '<span class="color-exito" aria-label="Cumplida">✓</span>' : ''}
                  </span>
                </div>
                <div class="progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${ui.escapar(c.nombre)}: ${pct}%">
                  <div class="progreso__barra ${c.cumple ? 'progreso__barra--acento' : ''}" style="width: ${pct}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="fila" style="justify-content: flex-end; align-items: center; margin-top: var(--espacio-s);">
          <button
            type="button"
            id="btn-descargar-certificado"
            class="btn btn--primario"
            ${cumple ? '' : 'disabled'}
          >
            Descargar certificado
          </button>
        </div>
      </div>
    `;

    // Evento del botón Descargar certificado
    const btnDescargar = document.getElementById("btn-descargar-certificado");
    if (btnDescargar) {
      btnDescargar.addEventListener("click", async () => {
        try {
          btnDescargar.disabled = true;
          ui.cargando(true);
          const res = await generarDiploma({ tipo: "cumplimiento" });
          ui.aviso(`Certificado emitido con éxito: ${res.codigo}`, "exito");
        } catch (err) {
          ui.aviso(err.message || "Error al descargar certificado", "error");
        } finally {
          btnDescargar.disabled = !cumple;
          ui.cargando(false);
        }
      });
    }
  } catch (err) {
    console.error("Error al renderizar logros:", err);
  }
}

if (typeof document !== "undefined") {
  await cargarPerfil();
}

