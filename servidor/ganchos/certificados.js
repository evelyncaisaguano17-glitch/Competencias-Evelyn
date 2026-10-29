// servidor/ganchos/certificados.js · Reglas de seguridad para la colección "certificados"
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') {
    return lista;
  }
  return lista.filter(item => item && item.usuarioId === usuario.id);
}

export default { filtrarLista };
