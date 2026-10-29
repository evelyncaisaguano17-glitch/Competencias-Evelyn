// publico/js/nucleo/sesion.js · Gestión de sesiones y autenticación en el cliente
import { llamar } from './api.js';

/**
 * Obtiene el token de la sesión activa desde sessionStorage.
 * @returns {string|null}
 */
export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('token') || null;
}

/**
 * Obtiene los datos del usuario actual desde sessionStorage.
 * @returns {{ id: string, nombre: string, apellido: string, rol: string }|null}
 */
export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem('usuario');
  if (!raw) return null;
  try {
    const usuario = JSON.parse(raw);
    if (!usuario || typeof usuario !== 'object') return null;
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };
  } catch {
    return null;
  }
}

/**
 * Registra un nuevo estudiante en el servidor.
 * @param {Object} datos
 * @returns {Promise<Object>}
 */
export async function registrar(datos) {
  return await llamar('POST', '/api/auth/registro', datos);
}

/**
 * Inicia sesión con correo y contraseña, almacenando token y usuario en sessionStorage.
 * @param {string} correo
 * @param {string} clave
 * @returns {Promise<Object>}
 */
export async function iniciar(correo, clave) {
  const respuesta = await llamar('POST', '/api/auth/login', { correo, clave });
  if (typeof sessionStorage !== 'undefined') {
    if (respuesta.token) {
      sessionStorage.setItem('token', respuesta.token);
    }
    if (respuesta.usuario) {
      sessionStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
    }
  }
  return respuesta;
}

/**
 * Cierra la sesión activa en el servidor y limpia sessionStorage.
 */
export async function cerrar() {
  try {
    if (token()) {
      await llamar('POST', '/api/auth/logout');
    }
  } catch {
    // Continúa con la eliminación local aunque la llamada de red falle
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

/**
 * Exige sesión y verifica roles permitidos.
 * Si no hay sesión redirige a /paginas/ingreso.html.
 * Si el rol no está permitido redirige a /index.html con un aviso.
 * @param {string[]|string} roles
 */
export function exigirRol(roles) {
  if (!roles) return;
  const listaRoles = Array.isArray(roles) ? roles : [roles];
  if (listaRoles.length === 0 || listaRoles.includes('publico')) {
    return;
  }

  const usuario = usuarioActual();
  const tok = token();

  if (!usuario || !tok) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
    return;
  }

  const permitido = listaRoles.includes('sesion') || listaRoles.includes(usuario.rol);
  if (!permitido) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: 'No tienes permisos para acceder a esta página',
        tipo: 'error'
      }));
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/index.html';
    }
  }
}

export default {
  token,
  usuarioActual,
  registrar,
  iniciar,
  cerrar,
  exigirRol
};
