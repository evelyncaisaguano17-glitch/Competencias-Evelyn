// servidor/rutas/alertas.js · Rutas de consulta de alertas tempranas y mensajes de apoyo
import express from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = express.Router();

/**
 * GET /api/alertas?grupoId=
 * Obtiene las alertas del grupo especificado (o de todos los grupos asignados al docente)
 * y la lista de mensajes de apoyo configurados.
 * Roles permitidos: docente del grupo o administrador.
 */
router.get('/alertas', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const { grupoId } = req.query;
    const esAdmin = req.usuario.rol === 'admin';

    if (!esAdmin && grupoId) {
      const gruposDocente = await acceso.gruposDe(req.usuario);
      const tieneAcceso = gruposDocente.some((g) => g && g.id === grupoId);
      if (!tieneAcceso) {
        return res.status(403).json({ error: 'No tienes acceso a las alertas de este grupo' });
      }
    }

    const [todasAlertas, reglas] = await Promise.all([
      almacen.leer('alertas').catch(() => []),
      almacen.leerConfig('reglas-alertas').catch(() => ({}))
    ]);

    let filtradas = [];
    if (grupoId) {
      filtradas = todasAlertas.filter((a) => a && a.grupoId === grupoId);
    } else if (esAdmin) {
      filtradas = todasAlertas;
    } else {
      const gruposDocente = await acceso.gruposDe(req.usuario);
      const idsGrupos = new Set(gruposDocente.map((g) => g && g.id).filter(Boolean));
      filtradas = todasAlertas.filter((a) => a && idsGrupos.has(a.grupoId));
    }

    const mensajesApoyo = Array.isArray(reglas?.mensajesApoyo) ? reglas.mensajesApoyo : [];

    return res.json({
      alertas: filtradas,
      mensajesApoyo
    });
  } catch (err) {
    console.error('Error al consultar alertas:', err);
    return res.status(500).json({ error: 'Error interno al consultar alertas' });
  }
});

export default router;
