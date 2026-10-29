// servidor/rutas/notificaciones.js · Rutas de gestión y consulta de notificaciones
import express from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

const router = express.Router();

/**
 * GET /api/notificaciones
 * Obtiene las notificaciones del usuario autenticado (hasta 30 más recientes)
 * y el conteo total de notificaciones no leídas.
 */
router.get('/notificaciones', exigirRol('estudiante', 'docente', 'admin'), async (req, res) => {
  try {
    const todas = await almacen.leer('notificaciones');
    const mias = todas.filter((n) => n && n.usuarioId === req.usuario.id);
    const totalSinLeer = mias.filter((n) => !n.leida).length;

    mias.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
    const notificaciones = mias.slice(0, 30);

    return res.json({ notificaciones, totalSinLeer });
  } catch (err) {
    console.error('Error al obtener notificaciones:', err);
    return res.status(500).json({ error: 'Error interno al consultar notificaciones' });
  }
});

/**
 * POST /api/notificaciones
 * Envío de notificación tipo "mensaje-docente":
 * - docente: solo a estudiantes asignados en sus grupos.
 * - admin: a cualquier usuario.
 */
router.post('/notificaciones', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const { usuarioId, mensaje, enlace } = req.body || {};

    if (!usuarioId || !mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return res.status(400).json({ error: 'usuarioId y mensaje son obligatorios' });
    }

    if (req.usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(req.usuario.id);
      if (!estudiantes.includes(usuarioId)) {
        return res.status(403).json({ error: 'Solo puedes notificar a tus estudiantes asignados' });
      }
    }

    const creada = await notificar(usuarioId, {
      tipo: 'mensaje-docente',
      mensaje: mensaje.trim(),
      enlace: enlace || null
    });

    return res.status(201).json(creada);
  } catch (err) {
    console.error('Error al crear notificación:', err);
    const estado = err.estado || 500;
    return res.status(estado).json({ error: err.message || 'Error al crear notificación' });
  }
});

/**
 * POST /api/notificaciones/:id/leida
 * Marca una notificación individual como leída.
 */
router.post('/notificaciones/:id/leida', exigirRol('estudiante', 'docente', 'admin'), async (req, res) => {
  try {
    const notificaciones = await almacen.leer('notificaciones');
    const notif = notificaciones.find((n) => n && n.id === req.params.id);

    if (!notif) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (notif.usuarioId !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta notificación' });
    }

    const actualizada = await almacen.actualizar('notificaciones', req.params.id, { leida: true });
    return res.json(actualizada);
  } catch (err) {
    console.error('Error al marcar notificación como leída:', err);
    return res.status(500).json({ error: 'Error interno al actualizar notificación' });
  }
});

/**
 * POST /api/notificaciones/leidas
 * Marca todas las notificaciones del usuario autenticado como leídas.
 */
router.post('/notificaciones/leidas', exigirRol('estudiante', 'docente', 'admin'), async (req, res) => {
  try {
    const notificaciones = await almacen.leer('notificaciones');
    let actualizadas = 0;

    for (const n of notificaciones) {
      if (n && n.usuarioId === req.usuario.id && !n.leida) {
        n.leida = true;
        actualizadas++;
      }
    }

    if (actualizadas > 0) {
      await almacen.escribir('notificaciones', notificaciones);
    }

    return res.json({ ok: true, actualizadas });
  } catch (err) {
    console.error('Error al marcar todas las notificaciones como leídas:', err);
    return res.status(500).json({ error: 'Error interno al marcar notificaciones' });
  }
});

export default router;
