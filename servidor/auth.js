// servidor/auth.js · Middleware de autenticación, control de roles y limpieza de sesiones
import * as almacen from './almacen.js';

/**
 * Borra las sesiones vencidas de la colección "sesiones".
 */
export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date().toISOString();
    const validas = sesiones.filter(s => s && s.expira && s.expira > ahora);
    if (validas.length !== sesiones.length) {
      await almacen.escribir('sesiones', validas);
    }
  } catch (err) {
    // Silencioso si la colección aún no existe
  }
}

// Limpiar sesiones al cargarse el módulo
limpiarSesionesVencidas();

/**
 * Middleware que lee el token Bearer, valida su vigencia y adjunta req.usuario.
 */
export async function cargarUsuario(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      req.usuario = null;
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      req.usuario = null;
      return next();
    }

    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date().toISOString();
    const sesion = sesiones.find(s => s && s.token === token && s.expira && s.expira > ahora);

    if (!sesion || !sesion.usuarioId) {
      req.usuario = null;
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === sesion.usuarioId);

    if (!usuario || usuario.activo === false) {
      req.usuario = null;
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };

    next();
  } catch (err) {
    req.usuario = null;
    next();
  }
}

/**
 * Middleware que exige sesión y verifica roles permitidos.
 * Responde 401 si no hay sesión y 403 si el rol no coincide.
 * @param  {...string} roles - Roles permitidos ('sesion', 'estudiante', 'docente', 'admin')
 */
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    if (roles.length === 0 || roles.includes('sesion') || roles.includes(req.usuario.rol)) {
      return next();
    }

    return res.status(403).json({ error: 'Acceso no permitido' });
  };
}

export default { cargarUsuario, exigirRol, limpiarSesionesVencidas };
