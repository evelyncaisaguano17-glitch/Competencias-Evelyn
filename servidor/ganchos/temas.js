// servidor/ganchos/temas.js · Reglas de seguridad y filtrado para la colección "temas"
import * as almacen from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  let filtrados = lista;

  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));

  if (usuario.rol !== 'admin') {
    const permitidas = await asignaturasDe(usuario);
    const permitidasIds = new Set(permitidas.map(a => a && a.id).filter(Boolean));
    filtrados = filtrados.filter(t => {
      if (!t || !t.unidadId) return false;
      const unidad = mapaUnidades.get(t.unidadId);
      return unidad && permitidasIds.has(unidad.asignaturaId);
    });
  }

  // Estudiantes solo ven temas publicados y de unidades visibles
  if (usuario.rol === 'estudiante') {
    filtrados = filtrados.filter(t => {
      if (!t || t.estado !== 'publicado') return false;
      const unidad = mapaUnidades.get(t.unidadId);
      return !unidad || unidad.visible !== false;
    });
  }

  return filtrados;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = (datos && datos.unidadId) || (anterior && anterior.unidadId);
  if (!unidadId) {
    const error = new Error('El campo unidadId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u && u.id === unidadId);
  if (!unidad || !unidad.asignaturaId) {
    const error = new Error('Unidad no encontrada');
    error.estado = 404;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, unidad.asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default { filtrarLista, antesDeGuardar };
