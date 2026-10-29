// servidor/ganchos/asignaturas.js · Reglas de filtrado para la colección "asignaturas"
import { asignaturasDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') {
    return lista;
  }
  const permitidas = await asignaturasDe(usuario);
  const permitidasIds = new Set(permitidas.map(a => a && a.id).filter(Boolean));
  return lista.filter(item => item && permitidasIds.has(item.id));
}

export default { filtrarLista };
