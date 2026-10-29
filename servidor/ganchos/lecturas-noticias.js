// servidor/ganchos/lecturas-noticias.js · Reglas de seguridad para lecturas de noticias
import * as almacen from '../almacen.js';

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  const limpio = { ...(datos || {}), usuarioId: usuario.id };

  if (!limpio.noticiaId) {
    const error = new Error('El campo noticiaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Evita duplicados (usuarioId + noticiaId)
  const todas = await almacen.leer('lecturas-noticias');
  const yaExiste = todas.some((l) => {
    if (!l) return false;
    const mismoUsuario = l.usuarioId === limpio.usuarioId;
    const mismaNoticia = l.noticiaId === limpio.noticiaId;
    if (anterior && anterior.id && l.id === anterior.id) {
      return false;
    }
    return mismoUsuario && mismaNoticia;
  });

  if (yaExiste) {
    const error = new Error('Lectura ya registrada');
    error.estado = 400;
    throw error;
  }

  return limpio;
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  return lista.filter((l) => l && l.usuarioId === usuario.id);
}

export default { antesDeGuardar, filtrarLista };
