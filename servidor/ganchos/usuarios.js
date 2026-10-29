// servidor/ganchos/usuarios.js · Ganchos de validación y seguridad para la colección "usuarios"

/**
 * Elimina claveHash de la lista de usuarios devuelta por la API genérica.
 */
export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) {
    if (lista && typeof lista === 'object') {
      const { claveHash, ...resto } = lista;
      return resto;
    }
    return lista;
  }
  return lista.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const { claveHash, ...resto } = item;
    return resto;
  });
}

/**
 * Filtra campos sensibles (claveHash, correo) y protege la cuenta del propio admin.
 */
export function antesDeGuardar(datos, usuario, anterior) {
  const limpio = { ...(datos || {}) };
  delete limpio.claveHash;
  delete limpio.correo;

  // Evitar que un admin se quite el rol o se desactive a sí mismo
  if (anterior && usuario && anterior.id === usuario.id) {
    if (limpio.rol !== undefined && limpio.rol !== anterior.rol) {
      const error = new Error('No puedes cambiar tu propio rol');
      error.estado = 403;
      throw error;
    }
    if (limpio.activo === false && anterior.activo !== false) {
      const error = new Error('No puedes desactivar tu propia cuenta');
      error.estado = 403;
      throw error;
    }
  }

  return limpio;
}

export default { filtrarLista, antesDeGuardar };
