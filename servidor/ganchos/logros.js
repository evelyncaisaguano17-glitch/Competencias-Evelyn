// servidor/ganchos/logros.js · Reglas de acceso para la colección "logros"
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

export default { filtrarLista };
