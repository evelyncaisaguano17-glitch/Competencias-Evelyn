// servidor/acceso.js · Control de acceso académico por grupo, asignatura y usuario
import * as almacen from './almacen.js';

/**
 * Retorna los grupos del distributivo a los que tiene acceso el usuario.
 * - admin: ve todos los grupos.
 * - docente: grupos donde es docenteId.
 * - estudiante: grupos donde figura en estudiantes[].
 * @param {Object} usuario - { id, rol, ... }
 * @returns {Promise<Array>}
 */
export async function gruposDe(usuario) {
  if (!usuario) return [];
  const distributivo = await almacen.leer('distributivo');
  if (usuario.rol === 'admin') {
    return distributivo;
  }
  if (usuario.rol === 'docente') {
    return distributivo.filter(g => g && g.docenteId === usuario.id);
  }
  if (usuario.rol === 'estudiante') {
    return distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id));
  }
  return [];
}

/**
 * Retorna las asignaturas accesibles por el usuario.
 * - admin: ve todas.
 * - docente / estudiante: solo las correspondientes a sus grupos asignados.
 * @param {Object} usuario
 * @returns {Promise<Array>}
 */
export async function asignaturasDe(usuario) {
  if (!usuario) return [];
  const asignaturas = await almacen.leer('asignaturas');
  if (usuario.rol === 'admin') {
    return asignaturas;
  }
  const grupos = await gruposDe(usuario);
  const idsAsignaturas = new Set(grupos.map(g => g && g.asignaturaId).filter(Boolean));
  return asignaturas.filter(a => a && idsAsignaturas.has(a.id));
}

/**
 * Resuelve el ID de la asignatura correspondiente a un tema:
 * temaId -> unidadId -> asignaturaId
 * @param {string} temaId
 * @returns {Promise<string|null>}
 */
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;
  const temas = await almacen.leer('temas');
  const tema = temas.find(t => t && t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u && u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  return unidad.asignaturaId;
}

/**
 * Determina si un usuario puede editar contenidos de una asignatura.
 * - admin: siempre true.
 * - docente: true si tiene al menos un grupo en esa asignatura.
 * - estudiante: false.
 * @param {Object} usuario
 * @param {string} asignaturaId
 * @returns {Promise<boolean>}
 */
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;
  if (usuario.rol === 'admin') return true;
  if (usuario.rol === 'docente') {
    const distributivo = await almacen.leer('distributivo');
    return distributivo.some(g => g && g.docenteId === usuario.id && g.asignaturaId === asignaturaId);
  }
  return false;
}

/**
 * Obtiene los IDs únicos de los estudiantes a cargo de un docente.
 * @param {string|Object} docenteId
 * @returns {Promise<string[]>}
 */
export async function estudiantesDe(docenteId) {
  const idDoc = typeof docenteId === 'object' && docenteId ? docenteId.id : docenteId;
  if (!idDoc) return [];
  const distributivo = await almacen.leer('distributivo');
  const grupos = distributivo.filter(g => g && g.docenteId === idDoc);
  const ids = new Set();
  for (const g of grupos) {
    if (Array.isArray(g.estudiantes)) {
      for (const eId of g.estudiantes) {
        if (eId) ids.add(eId);
      }
    }
  }
  return Array.from(ids);
}

/**
 * Obtiene los IDs únicos de los docentes asignados a un estudiante.
 * @param {string|Object} estudianteId
 * @returns {Promise<string[]>}
 */
export async function docentesDe(estudianteId) {
  const idEst = typeof estudianteId === 'object' && estudianteId ? estudianteId.id : estudianteId;
  if (!idEst) return [];
  const distributivo = await almacen.leer('distributivo');
  const grupos = distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(idEst));
  const ids = new Set();
  for (const g of grupos) {
    if (g && g.docenteId) ids.add(g.docenteId);
  }
  return Array.from(ids);
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
