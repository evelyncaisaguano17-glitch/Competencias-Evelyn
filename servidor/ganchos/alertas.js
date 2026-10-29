// servidor/ganchos/alertas.js · Reglas de seguridad y ciclo de vida para alertas tempranas
import * as acceso from '../acceso.js';

/**
 * Filtra las alertas para que los docentes solo vean las de sus grupos asignados.
 * Los administradores ven todas.
 * @param {Array} lista
 * @param {Object} usuario
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol === 'docente') {
    const grupos = await acceso.gruposDe(usuario);
    const grupoIds = new Set(grupos.map((g) => g && g.id).filter(Boolean));
    return lista.filter((a) => a && grupoIds.has(a.grupoId));
  }
  return [];
}

/**
 * Controla que en modificaciones solo se actualice el campo "estado" (activa | atendida)
 * y que el docente pertenezca al grupo de la alerta.
 * @param {Object} datos
 * @param {Object} usuario
 * @param {Object} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const err = new Error('Sesión requerida');
    err.estado = 401;
    throw err;
  }

  // Modificación de alerta existente
  if (anterior) {
    if (usuario.rol === 'docente') {
      const grupos = await acceso.gruposDe(usuario);
      const tieneAcceso = grupos.some((g) => g && g.id === anterior.grupoId);
      if (!tieneAcceso) {
        const err = new Error('No tienes permiso para modificar esta alerta');
        err.estado = 403;
        throw err;
      }
    } else if (usuario.rol !== 'admin') {
      const err = new Error('No tienes permiso para modificar alertas');
      err.estado = 403;
      throw err;
    }

    const estadoNuevo = datos.estado !== undefined ? datos.estado : anterior.estado;
    if (!['activa', 'atendida'].includes(estadoNuevo)) {
      const err = new Error('Estado de alerta no válido. Debe ser "activa" o "atendida"');
      err.estado = 400;
      throw err;
    }

    // Solo permite cambiar el campo estado manteniendo intactos los demás
    return {
      ...anterior,
      estado: estadoNuevo
    };
  }

  // Creación de nueva alerta
  const estado = datos.estado || 'activa';
  if (!['activa', 'atendida'].includes(estado)) {
    const err = new Error('Estado de alerta no válido');
    err.estado = 400;
    throw err;
  }

  return {
    ...datos,
    estado
  };
}

export default {
  filtrarLista,
  antesDeGuardar
};
