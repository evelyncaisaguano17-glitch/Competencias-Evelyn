// publico/js/modulos/editor-noticia.js · Editor y creador de noticias para docentes y admin
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import * as util from "../nucleo/util.js";
import * as ui from "../nucleo/ui.js";

let noticiaId = null;
let noticiaActual = null;

export async function inicializarEditorNoticia() {
  await montarPlantilla({ titulo: "Editor de noticia", roles: ["docente", "admin"] });

  noticiaId = util.parametro("id");
  const elTituloPagina = document.getElementById("editor-titulo-pagina");
  const form = document.getElementById("form-noticia");
  const inputTitulo = document.getElementById("noticia-titulo");
  const inputResumen = document.getElementById("noticia-resumen");
  const contadorResumen = document.getElementById("contador-resumen");
  const selectCategoria = document.getElementById("noticia-categoria");
  const selectTema = document.getElementById("noticia-tema");
  const inputImagen = document.getElementById("noticia-imagen");
  const inputSubirImagen = document.getElementById("input-subir-imagen");
  const inputCuerpo = document.getElementById("noticia-cuerpo");
  const checkDestacada = document.getElementById("noticia-destacada");
  const selectEstado = document.getElementById("noticia-estado");
  const btnGuardar = document.getElementById("btn-guardar");
  const btnTogglePrevia = document.getElementById("btn-toggle-previa");
  const panelPrevia = document.getElementById("panel-vista-previa");

  // Cargar temas disponibles para relacionar
  try {
    const temas = await api.listar("temas");
    if (selectTema && Array.isArray(temas)) {
      temas.forEach(tema => {
        const opt = document.createElement("option");
        opt.value = tema.id;
        opt.textContent = tema.titulo || `Tema ${tema.id}`;
        selectTema.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error al cargar temas:", err);
  }

  // Si hay ID, cargar noticia existente
  if (noticiaId) {
    if (elTituloPagina) elTituloPagina.textContent = "Editar noticia";
    ui.cargando(true);
    try {
      noticiaActual = await api.obtener("noticias", noticiaId);
      if (!noticiaActual) {
        ui.aviso("Noticia no encontrada", "error");
        setTimeout(() => { window.location.href = "/paginas/noticias.html"; }, 1000);
        return;
      }
      inputTitulo.value = noticiaActual.titulo || "";
      inputResumen.value = noticiaActual.resumen || "";
      selectCategoria.value = noticiaActual.categoria || "Institucional";
      if (noticiaActual.temaId) selectTema.value = noticiaActual.temaId;
      inputImagen.value = noticiaActual.imagen || "";
      inputCuerpo.value = noticiaActual.cuerpo || "";
      checkDestacada.checked = !!noticiaActual.destacada;
      selectEstado.value = noticiaActual.estado || "borrador";
    } catch (err) {
      ui.aviso("Error al cargar noticia: " + err.message, "error");
    } finally {
      ui.cargando(false);
    }
  }

  // Actualizar contador y vista previa
  function actualizarContador() {
    const len = inputResumen.value.length;
    contadorResumen.textContent = `${len} / 200`;
    if (len > 200) {
      contadorResumen.classList.add("texto-peligro");
    } else {
      contadorResumen.classList.remove("texto-peligro");
    }
  }

  function actualizarVistaPrevia() {
    const prevCat = document.getElementById("prev-categoria");
    const prevDest = document.getElementById("prev-destacada");
    const prevTit = document.getElementById("prev-titulo");
    const prevRes = document.getElementById("prev-resumen");
    const prevImgWrap = document.getElementById("prev-img-container");
    const prevImg = document.getElementById("prev-imagen");
    const prevCuerpo = document.getElementById("prev-cuerpo");
    const thumbWrap = document.getElementById("vista-previa-img-wrap");
    const thumbImg = document.getElementById("vista-previa-img-thumb");

    if (prevCat) prevCat.textContent = selectCategoria.value || "Institucional";
    if (prevDest) prevDest.style.display = checkDestacada.checked ? "inline-block" : "none";
    if (prevTit) prevTit.textContent = inputTitulo.value.trim() || "Título de la noticia";
    if (prevRes) prevRes.textContent = inputResumen.value.trim() || "Resumen de la noticia...";

    const imgUrl = inputImagen.value.trim();
    if (imgUrl) {
      if (prevImg) {
        prevImg.src = imgUrl;
        prevImg.alt = inputTitulo.value.trim() || "Imagen de la noticia";
      }
      if (prevImgWrap) prevImgWrap.style.display = "block";
      if (thumbImg) thumbImg.src = imgUrl;
      if (thumbWrap) thumbWrap.style.display = "block";
    } else {
      if (prevImgWrap) prevImgWrap.style.display = "none";
      if (thumbWrap) thumbWrap.style.display = "none";
    }

    if (prevCuerpo) {
      const cuerpoTexto = inputCuerpo.value.trim();
      prevCuerpo.innerHTML = cuerpoTexto ? util.formatoBasico(cuerpoTexto) : "<p class='texto-atenuado'>El cuerpo formateado aparecerá aquí...</p>";
    }
  }

  inputResumen.addEventListener("input", () => {
    actualizarContador();
    actualizarVistaPrevia();
  });

  inputTitulo.addEventListener("input", actualizarVistaPrevia);
  selectCategoria.addEventListener("change", actualizarVistaPrevia);
  checkDestacada.addEventListener("change", actualizarVistaPrevia);
  inputImagen.addEventListener("input", actualizarVistaPrevia);
  inputCuerpo.addEventListener("input", actualizarVistaPrevia);

  // Subida de imagen
  inputSubirImagen.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    ui.cargando(true);
    try {
      const resultado = await api.subir(archivo);
      if (resultado && resultado.url) {
        inputImagen.value = resultado.url;
        actualizarVistaPrevia();
        ui.aviso("Imagen subida con éxito", "exito");
      }
    } catch (err) {
      ui.aviso("Error al subir imagen: " + err.message, "error");
    } finally {
      ui.cargando(false);
      inputSubirImagen.value = "";
    }
  });

  // Toggle vista previa en móviles
  if (btnTogglePrevia && panelPrevia) {
    btnTogglePrevia.addEventListener("click", () => {
      const estaOculto = window.getComputedStyle(panelPrevia).display === "none";
      panelPrevia.style.display = estaOculto ? "block" : "none";
      btnTogglePrevia.textContent = estaOculto ? "Ocultar previa" : "Vista previa";
    });
  }

  // Guardar noticia
  btnGuardar.addEventListener("click", async () => {
    // Validaciones
    const titulo = inputTitulo.value.trim();
    const resumen = inputResumen.value.trim();
    const cuerpo = inputCuerpo.value.trim();
    const categoria = selectCategoria.value;
    const temaId = selectTema.value || null;
    const imagen = inputImagen.value.trim() || null;
    const destacada = checkDestacada.checked;
    const estado = selectEstado.value;

    let hayError = false;
    document.getElementById("error-titulo").textContent = "";
    document.getElementById("error-resumen").textContent = "";
    document.getElementById("error-cuerpo").textContent = "";

    if (!titulo) {
      document.getElementById("error-titulo").textContent = "El título es obligatorio.";
      hayError = true;
    }
    if (!resumen) {
      document.getElementById("error-resumen").textContent = "El resumen es obligatorio.";
      hayError = true;
    } else if (resumen.length > 200) {
      document.getElementById("error-resumen").textContent = "El resumen no puede superar 200 caracteres.";
      hayError = true;
    }
    if (!cuerpo) {
      document.getElementById("error-cuerpo").textContent = "El cuerpo de la noticia es obligatorio.";
      hayError = true;
    }

    if (hayError) {
      ui.aviso("Por favor revisa los campos obligatorios", "error");
      return;
    }

    const payload = {
      titulo,
      resumen,
      cuerpo,
      categoria,
      temaId,
      imagen,
      destacada,
      estado
    };

    ui.cargando(true);
    try {
      if (noticiaId) {
        await api.actualizar("noticias", noticiaId, payload);
        ui.aviso("Noticia actualizada correctamente", "exito");
      } else {
        await api.crear("noticias", payload);
        ui.aviso("Noticia creada correctamente", "exito");
      }
      setTimeout(() => {
        window.location.href = "/paginas/noticias.html";
      }, 700);
    } catch (err) {
      ui.aviso("Error al guardar noticia: " + err.message, "error");
    } finally {
      ui.cargando(false);
    }
  });

  // Ejecución inicial
  actualizarContador();
  actualizarVistaPrevia();
}

if (typeof document !== "undefined") {
  inicializarEditorNoticia();
}

export default { inicializarEditorNoticia };
