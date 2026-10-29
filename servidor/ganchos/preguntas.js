// servidor/ganchos/preguntas.js · Reglas de seguridad y filtrado para la colección "preguntas"
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Filtra las preguntas visibles según el rol del usuario.
 * Los estudiantes nunca tienen acceso de lectura a esta colección.
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  // Los estudiantes nunca leen el banco de preguntas
  if (usuario.rol === 'estudiante') {
    return [];
  }

  // Los administradores ven todas las preguntas
  if (usuario.rol === 'admin') {
    return lista;
  }

  // Los docentes solo ven preguntas de asignaturas a las que tienen acceso
  const permitidas = await asignaturasDe(usuario);
  const permitidasIds = new Set(permitidas.map(a => a && a.id).filter(Boolean));

  const conAsignatura = await Promise.all(
    lista.map(async (item) => {
      if (!item || !item.temaId) return null;
      const asigId = await asignaturaDeTema(item.temaId);
      return permitidasIds.has(asigId) ? item : null;
    })
  );

  return conAsignatura.filter(Boolean);
}

/**
 * Valida los permisos de edición sobre la asignatura del tema antes de guardar una pregunta.
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario || (usuario.rol !== 'docente' && usuario.rol !== 'admin')) {
    const error = new Error('Solo docentes y administradores pueden gestionar preguntas');
    error.estado = 403;
    throw error;
  }

  const temaId = (datos && datos.temaId) || (anterior && anterior.temaId);
  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('Tema o asignatura no encontrado');
    error.estado = 404;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar preguntas de esta asignatura');
    error.estado = 403;
    throw error;
  }

  // Normalizar nivel (1 a 5)
  if (datos.nivel !== undefined) {
    const n = parseInt(datos.nivel, 10);
    if (isNaN(n) || n < 1 || n > 5) {
      const error = new Error('El nivel de la pregunta debe ser un número entre 1 y 5');
      error.estado = 400;
      throw error;
    }
    datos.nivel = n;
  }

  // Normalizar estado y origen por defecto
  if (!datos.estado && !anterior?.estado) {
    datos.estado = 'aprobado';
  }
  if (!datos.origen && !anterior?.origen) {
    datos.origen = 'docente';
  }

  return datos;
}

export default { filtrarLista, antesDeGuardar };
