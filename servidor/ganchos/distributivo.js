// servidor/ganchos/distributivo.js · Reglas de filtrado para la colección "distributivo"
import { gruposDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') {
    return lista;
  }
  const permitidos = await gruposDe(usuario);
  const permitidosIds = new Set(permitidos.map(g => g && g.id).filter(Boolean));
  return lista.filter(item => item && permitidosIds.has(item.id));
}

export default { filtrarLista };
