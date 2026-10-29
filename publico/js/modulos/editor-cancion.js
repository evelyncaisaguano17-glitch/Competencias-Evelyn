// publico/js/modulos/editor-cancion.js · Editor de canciones educativas para docentes y admin
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import * as util from "../nucleo/util.js";
import * as ui from "../nucleo/ui.js";

let cancionId = null;
let cancionActual = null;

export async function inicializarEditorCancion() {
  await montarPlantilla({ titulo: "Editor de canción", roles: ["docente", "admin"] });

  cancionId = util.parametro("id");
  const elTituloPagina = document.getElementById("editor-titulo-pagina");
  const inputTitulo = document.getElementById("cancion-titulo");
  const selectTema = document.getElementById("cancion-tema");
  const inputAudio = document.getElementById("cancion-audio");
  const inputSubirMp3 = document.getElementById("input-subir-mp3");
  const previewAudioContainer = document.getElementById("preview-audio-container");
  const previewAudio = document.getElementById("preview-audio");
  const inputAutoria = document.getElementById("cancion-autoria");
  const selectLicencia = document.getElementById("cancion-licencia");
  const campoLicenciaOtra = document.getElementById("campo-licencia-otra");
  const inputLicenciaOtra = document.getElementById("cancion-licencia-otra");
  const inputLetra = document.getElementById("cancion-letra");
  const inputLrc = document.getElementById("cancion-lrc");
  const btnGuardar = document.getElementById("btn-guardar-cancion");

  function actualizarAudioPreview() {
    const url = inputAudio.value.trim();
    if (url) {
      previewAudio.src = url;
      previewAudioContainer.style.display = "block";
    } else {
      previewAudio.removeAttribute("src");
      previewAudioContainer.style.display = "none";
    }
  }

  inputAudio.addEventListener("input", actualizarAudioPreview);

  // Subida de MP3
  inputSubirMp3.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    ui.cargando(true);
    try {
      const res = await api.subir(archivo);
      if (res && res.url) {
        inputAudio.value = res.url;
        actualizarAudioPreview();
        ui.aviso("Audio MP3 subido con éxito", "exito");
      }
    } catch (err) {
      ui.aviso("Error al subir audio: " + err.message, "error");
    } finally {
      ui.cargando(false);
      inputSubirMp3.value = "";
    }
  });

  // Selector de licencia
  selectLicencia.addEventListener("change", () => {
    if (selectLicencia.value === "Otra") {
      campoLicenciaOtra.style.display = "block";
    } else {
      campoLicenciaOtra.style.display = "none";
    }
  });

  // Cargar mis temas disponibles
  try {
    const temas = await api.listar("temas");
    if (selectTema && Array.isArray(temas)) {
      temas.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.titulo || `Tema ${t.id}`;
        selectTema.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error al cargar temas:", err);
  }

  // Cargar canción si estamos editando
  if (cancionId) {
    if (elTituloPagina) elTituloPagina.textContent = "Editar canción educativa";
    ui.cargando(true);
    try {
      cancionActual = await api.obtener("canciones", cancionId);
      if (!cancionActual) {
        ui.aviso("Canción no encontrada", "error");
        setTimeout(() => { window.location.href = "/paginas/canciones.html"; }, 1000);
        return;
      }
      inputTitulo.value = cancionActual.titulo || "";
      if (cancionActual.temaId) selectTema.value = cancionActual.temaId;
      inputAudio.value = cancionActual.audio || "";
      inputAutoria.value = cancionActual.autoria || "";

      // Licencia
      const lic = cancionActual.licencia || "Propia";
      if (lic.startsWith("Otra") || !["Propia", "CC BY", "CC BY-SA"].includes(lic)) {
        selectLicencia.value = "Otra";
        campoLicenciaOtra.style.display = "block";
        inputLicenciaOtra.value = lic.startsWith("Otra: ") ? lic.slice(6) : lic;
      } else {
        selectLicencia.value = lic;
        campoLicenciaOtra.style.display = "none";
      }

      inputLetra.value = cancionActual.letra || "";
      inputLrc.value = cancionActual.lrc || "";

      actualizarAudioPreview();
    } catch (err) {
      ui.aviso("Error al cargar canción: " + err.message, "error");
    } finally {
      ui.cargando(false);
    }
  }

  // Guardar canción
  btnGuardar.addEventListener("click", async () => {
    const titulo = inputTitulo.value.trim();
    const temaId = selectTema.value;
    const audio = inputAudio.value.trim();
    const autoria = inputAutoria.value.trim();
    let licencia = selectLicencia.value;
    const licenciaOtra = inputLicenciaOtra.value.trim();
    const letra = inputLetra.value.trim();
    const lrc = inputLrc.value.trim();

    let hayError = false;
    document.getElementById("error-titulo").textContent = "";
    document.getElementById("error-tema").textContent = "";
    document.getElementById("error-audio").textContent = "";
    document.getElementById("error-autoria").textContent = "";
    document.getElementById("error-licencia").textContent = "";
    document.getElementById("error-licencia-otra").textContent = "";

    if (!titulo) {
      document.getElementById("error-titulo").textContent = "El título es obligatorio.";
      hayError = true;
    }
    if (!temaId) {
      document.getElementById("error-tema").textContent = "Debes seleccionar un tema curricular.";
      hayError = true;
    }
    if (!audio) {
      document.getElementById("error-audio").textContent = "El archivo o enlace de audio MP3 es obligatorio.";
      hayError = true;
    }
    if (!autoria) {
      document.getElementById("error-autoria").textContent = "La autoría es obligatoria.";
      hayError = true;
    }
    if (!licencia) {
      document.getElementById("error-licencia").textContent = "La licencia es obligatoria.";
      hayError = true;
    } else if (licencia === "Otra") {
      if (!licenciaOtra) {
        document.getElementById("error-licencia-otra").textContent = "Debes describir la licencia cuando eliges 'Otra'.";
        hayError = true;
      } else {
        licencia = `Otra: ${licenciaOtra}`;
      }
    }

    if (hayError) {
      ui.aviso("Por favor completa los campos obligatorios", "error");
      return;
    }

    const payload = {
      titulo,
      temaId,
      audio,
      autoria,
      licencia,
      letra,
      lrc
    };

    ui.cargando(true);
    try {
      if (cancionId) {
        await api.actualizar("canciones", cancionId, payload);
        ui.aviso("Canción actualizada con éxito", "exito");
      } else {
        await api.crear("canciones", payload);
        ui.aviso("Canción creada con éxito", "exito");
      }
      setTimeout(() => {
        window.location.href = "/paginas/canciones.html";
      }, 700);
    } catch (err) {
      ui.aviso("Error al guardar canción: " + err.message, "error");
    } finally {
      ui.cargando(false);
    }
  });
}

if (typeof document !== "undefined") {
  inicializarEditorCancion();
}

export default { inicializarEditorCancion };
