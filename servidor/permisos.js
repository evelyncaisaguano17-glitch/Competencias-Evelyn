import { leerConfig } from './almacen.js';

export async function puede(usuario, accion, col, registro = null) {
  if (accion !== 'leer' && accion !== 'escribir') {
    return false;
  }

  const permisos = await leerConfig('permisos');
  const colBase = col.split('/')[0];
  const configCol = permisos[colBase];

  // Colección no listada → false
  if (!configCol) {
    return false;
  }

  const permitidos = configCol[accion];
  if (!Array.isArray(permitidos) || permitidos.length === 0) {
    return false;
  }

  for (const regla of permitidos) {
    // "servidor" nunca se permite desde la API
    if (regla === 'servidor') {
      continue;
    }

    if (regla === 'publico') {
      return true;
    }

    if (!usuario) {
      continue;
    }

    if (regla === 'sesion') {
      return true;
    }

    if (usuario.rol && regla === usuario.rol) {
      return true;
    }

    if (regla === 'propio') {
      if (!registro) {
        return true;
      }
      if (registro.usuarioId === usuario.id) {
        return true;
      }
      if (colBase === 'usuarios' && registro.id === usuario.id) {
        return true;
      }
    }
  }

  return false;
}
