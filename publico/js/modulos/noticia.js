// publico/js/modulos/noticia.js · Detalle de noticia y registro automático de lectura
import { montarPlantilla, actualizarContadorNoticias } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import api from "../nucleo/api.js";
import * as util from "../nucleo/util.js";
import * as ui from "../nucleo/ui.js";

let noticia = null;

export async function inicializarNoticia() {
  await montarPlantilla({ titulo: "Noticia", roles: ["sesion"] });

  const id = util.parametro("id");
  if (!id) {
    ui.aviso("No se indicó una noticia válida", "advertencia");
    window.location.href = "/paginas/noticias.html";
    return;
  }

  const elCargando = document.getElementById("cargando-noticia");
  const elArticulo = document.getElementById("articulo-noticia");
  const usuario = usuarioActual();

  try {
    noticia = await api.obtener("noticias", id);
    if (!noticia) {
      ui.aviso("La noticia no existe o no tienes permiso para verla", "error");
      setTimeout(() => { window.location.href = "/paginas/noticias.html"; }, 1000);
      return;
    }

    // Registrar lectura automáticamente si no existe para este usuario
    try {
      const lecturas = await api.listar("lecturas-noticias");
      const yaLeida = (lecturas || []).some(l => l.noticiaId === id);
      if (!yaLeida) {
        await api.crear("lecturas-noticias", { noticiaId: id });
        // Actualizar contador del menú
        await actualizarContadorNoticias();
      }
    } catch (errLectura) {
      console.warn("No se pudo registrar la lectura:", errLectura);
    }

    // Actualizar título y migas
    document.title = `${noticia.titulo || 'Noticia'} · Ecosistema Educativo`;
    const elMiga = document.getElementById("miga-noticia");
    if (elMiga) elMiga.textContent = noticia.titulo || "Detalle";

    // Llenar contenido
    const elCategoria = document.getElementById("noticia-categoria");
    const elDestacada = document.getElementById("noticia-destacada");
    const elTemaTag = document.getElementById("noticia-tema-tag");
    const elTitulo = document.getElementById("noticia-titulo");
    const elFecha = document.getElementById("noticia-fecha");
    const elAutor = document.getElementById("noticia-autor");
    const elResumen = document.getElementById("noticia-resumen");
    const elImgWrap = document.getElementById("noticia-imagen-wrap");
    const elImg = document.getElementById("noticia-imagen");
    const elCuerpo = document.getElementById("noticia-cuerpo");
    const accionesEdicion = document.getElementById("acciones-edicion");
    const btnEditar = document.getElementById("btn-editar-noticia");

    if (elCategoria) elCategoria.textContent = noticia.categoria || "Institucional";
    if (elDestacada) elDestacada.style.display = noticia.destacada ? "inline-block" : "none";

    // Si tiene tema relacionado, consultar su nombre
    if (noticia.temaId && elTemaTag) {
      api.obtener("temas", noticia.temaId).then(t => {
        if (t && t.titulo) {
          elTemaTag.textContent = `Tema: ${t.titulo}`;
          elTemaTag.style.display = "inline-block";
        }
      }).catch(() => {});
    }

    if (elTitulo) elTitulo.textContent = noticia.titulo || "";

    const fechaBase = noticia.fechaPublicacion || noticia.creado;
    if (elFecha && fechaBase) {
      elFecha.textContent = util.fechaLarga(fechaBase);
      elFecha.setAttribute("datetime", fechaBase);
    }

    // Nombre de autor si existe
    if (elAutor) {
      if (noticia.autorId) {
        api.obtener("usuarios", noticia.autorId).then(u => {
          if (u && (u.nombre || u.apellido)) {
            elAutor.textContent = `Por ${u.nombre || ''} ${u.apellido || ''}`.trim();
          }
        }).catch(() => {
          elAutor.textContent = "Autor institucional";
        });
      } else {
        elAutor.textContent = "Autor institucional";
      }
    }

    if (elResumen) elResumen.textContent = noticia.resumen || "";

    if (noticia.imagen && elImg && elImgWrap) {
      elImg.src = noticia.imagen;
      elImg.alt = noticia.titulo || "Imagen de la noticia";
      elImgWrap.style.display = "block";
    }

    if (elCuerpo && noticia.cuerpo) {
      elCuerpo.innerHTML = util.formatoBasico(noticia.cuerpo);
    }

    // Botón de editar para docentes o admin
    if (accionesEdicion && btnEditar && (usuario?.rol === "docente" || usuario?.rol === "admin")) {
      btnEditar.href = `/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}`;
      accionesEdicion.style.display = "block";
    }

    if (elCargando) elCargando.style.display = "none";
    if (elArticulo) elArticulo.style.display = "block";

  } catch (err) {
    ui.aviso("Error al cargar la noticia: " + err.message, "error");
    if (elCargando) {
      elCargando.innerHTML = `<p class="alerta alerta--peligro">Error al cargar la noticia: ${ui.escapar(err.message)}</p>`;
    }
  }
}

if (typeof document !== "undefined") {
  inicializarNoticia();
}

export default { inicializarNoticia };
