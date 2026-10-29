// publico/js/nucleo/bitacora.js · Registro de eventos en la bitácora del servidor
import { llamar } from './api.js';

/**
 * Registra un evento en la bitácora del servidor.
 * @param {string} tipo - Tipo de evento (ej. 'pagina', 'actividad', 'clic')
 * @param {string} recurso - Recurso o ruta asociada (ej. location.pathname)
 * @returns {Promise<void>}
 */
export async function registrarEvento(tipo, recurso) {
  try {
    await llamar('POST', '/api/eventos', { tipo, recurso });
  } catch {
    // Falla silenciosa para no bloquear la experiencia de usuario
  }
}

export default { registrarEvento };
