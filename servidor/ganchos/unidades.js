// servidor/ganchos/unidades.js · Reglas de seguridad y filtrado para la colección "unidades"
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  let filtradas = lista;

  if (usuario.rol !== 'admin') {
    const permitidas = await asignaturasDe(usuario);
    const permitidasIds = new Set(permitidas.map(a => a && a.id).filter(Boolean));
    filtradas = filtradas.filter(u => u && permitidasIds.has(u.asignaturaId));
  }

  // Estudiantes no ven unidades no visibles
  if (usuario.rol === 'estudiante') {
    filtradas = filtradas.filter(u => u && u.visible !== false);
  }

  return filtradas;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = (datos && datos.asignaturaId) || (anterior && anterior.asignaturaId);
  if (!asignaturaId) {
    const error = new Error('El campo asignaturaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default { filtrarLista, antesDeGuardar };
