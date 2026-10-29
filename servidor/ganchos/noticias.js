// servidor/ganchos/noticias.js · Reglas de seguridad y ciclo de vida para noticias
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

export async function antesDeGuardar(datos, usuario, anterior) {
  const limpio = { ...(datos || {}) };

  // Fija autorId al crear
  if (!anterior && usuario) {
    limpio.autorId = usuario.id;
  } else if (anterior && anterior.autorId) {
    limpio.autorId = anterior.autorId;
  }

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  const estadoNuevo = limpio.estado !== undefined ? limpio.estado : anterior?.estado;
  const estadoAnterior = anterior?.estado;

  if (estadoNuevo === "publicado") {
    if (!anterior || estadoAnterior !== "publicado" || !anterior.fechaPublicacion) {
      limpio.fechaPublicacion = new Date().toISOString();
    } else {
      limpio.fechaPublicacion = anterior.fechaPublicacion;
    }
  }

  return limpio;
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  // Los estudiantes solo ven las noticias publicadas
  if (usuario.rol === "estudiante") {
    return lista.filter((n) => n && n.estado === "publicado");
  }

  // Docentes y administradores ven todas (borradores y publicadas)
  return lista;
}

export async function despuesDeGuardar(reg, usuario, anterior) {
  if (!reg || reg.estado !== "publicado") return reg;
  if (anterior && anterior.estado === "publicado") return reg;

  try {
    const enlace = `/paginas/noticia.html?id=${reg.id}`;
    const mensaje = `Nueva noticia publicada: ${reg.titulo}`;
    const tipo = "noticia";

    let estudiantesIds = [];

    if (reg.temaId) {
      const asignaturaId = await acceso.asignaturaDeTema(reg.temaId);
      if (asignaturaId) {
        const distributivo = await almacen.leer("distributivo");
        const setIds = new Set();
        for (const g of distributivo) {
          if (g && g.asignaturaId === asignaturaId && Array.isArray(g.estudiantes)) {
            for (const eId of g.estudiantes) {
              if (eId) setIds.add(eId);
            }
          }
        }
        estudiantesIds = Array.from(setIds);
      }
    }

    // Si no tiene tema (o no se resolvieron estudiantes de la asignatura), notifica a todos los estudiantes
    if (!reg.temaId || estudiantesIds.length === 0) {
      const usuarios = await almacen.leer("usuarios");
      estudiantesIds = usuarios
        .filter((u) => u && u.rol === "estudiante" && u.activo !== false)
        .map((u) => u.id);
    }

    for (const estId of estudiantesIds) {
      await notificar(estId, { tipo, mensaje, enlace });
    }
  } catch (err) {
    console.error("Error al notificar noticia publicada:", err);
  }

  return reg;
}

export default { antesDeGuardar, filtrarLista, despuesDeGuardar };
