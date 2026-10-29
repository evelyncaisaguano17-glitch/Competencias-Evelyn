// servidor/ganchos/glosario.js · Reglas de seguridad y filtrado para la colección "glosario"
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  let filtrados = lista;

  if (usuario.rol !== 'admin') {
    const permitidas = await asignaturasDe(usuario);
    const permitidasIds = new Set(permitidas.map(a => a && a.id).filter(Boolean));

    const conAsignatura = await Promise.all(
      filtrados.map(async (item) => {
        if (!item || !item.temaId) return null;
        const asigId = await asignaturaDeTema(item.temaId);
        return permitidasIds.has(asigId) ? item : null;
      })
    );
    filtrados = conAsignatura.filter(Boolean);
  }

  // Estudiantes no ven términos no aprobados
  if (usuario.rol === 'estudiante') {
    filtrados = filtrados.filter(item => item && item.estado === 'aprobado');
  }

  return filtrados;
}

export async function antesDeGuardar(datos, usuario, anterior) {
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
    const error = new Error('No tienes permiso para editar en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default { filtrarLista, antesDeGuardar };
