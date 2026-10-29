// servidor/ganchos/progreso-temas.js · Reglas de seguridad para la colección "progreso-temas"
import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') {
    return lista;
  }
  if (usuario.rol === 'docente') {
    const estudiantesIds = await estudiantesDe(usuario.id);
    const permitidos = new Set(estudiantesIds);
    return lista.filter(item => item && permitidos.has(item.usuarioId));
  }
  if (usuario.rol === 'estudiante') {
    return lista.filter(item => item && item.usuarioId === usuario.id);
  }
  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  // Fija usuarioId = usuario.id
  const limpio = { ...(datos || {}), usuarioId: usuario.id };

  if (!limpio.temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Rechaza duplicados (usuarioId + temaId)
  const todos = await almacen.leer('progreso-temas');
  const yaExiste = todos.some(p => {
    if (!p) return false;
    const esMismoUsuario = p.usuarioId === limpio.usuarioId;
    const esMismoTema = p.temaId === limpio.temaId;
    if (anterior && anterior.id && p.id === anterior.id) {
      return false; // Es el mismo registro siendo editado
    }
    return esMismoUsuario && esMismoTema;
  });

  if (yaExiste) {
    const error = new Error('Ya se ha registrado el progreso para este tema');
    error.estado = 400;
    throw error;
  }

  return limpio;
}

export default { filtrarLista, antesDeGuardar };
