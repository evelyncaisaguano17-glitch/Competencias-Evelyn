// servidor/notificar.js · Envío y registro de notificaciones en el ecosistema
import * as almacen from './almacen.js';

/**
 * Crea una notificación para un usuario específico con leida: false.
 * @param {string} usuarioId
 * @param {Object} datos - { tipo, mensaje, enlace }
 * @returns {Promise<Object>} Registro creado con id y fecha
 */
export async function notificar(usuarioId, { tipo = 'general', mensaje = '', enlace = null } = {}) {
  if (!usuarioId) {
    const error = new Error('usuarioId es obligatorio para notificar');
    error.estado = 400;
    throw error;
  }

  const registro = {
    usuarioId,
    tipo: tipo || 'general',
    mensaje: mensaje || '',
    enlace: enlace || null,
    leida: false
  };

  return await almacen.agregar('notificaciones', registro);
}

export default { notificar };
