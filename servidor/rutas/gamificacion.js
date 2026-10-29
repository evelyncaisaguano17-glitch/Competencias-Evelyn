// servidor/rutas/gamificacion.js · Rutas de gamificación (intentos y logros)
import express from 'express';
import { exigirRol } from '../auth.js';
import { procesarIntento } from '../gamificacion.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = express.Router();

/**
 * POST /api/intentos
 * Registra un intento de actividad, calcula puntos, otorga insignias y actualiza logros.
 */
router.post('/intentos', exigirRol('sesion'), async (req, res) => {
  try {
    const resultado = await procesarIntento(req.usuario, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 500;
    res.status(estado).json({ error: err.message || 'Error al procesar intento' });
  }
});

/**
 * GET /api/logros/:usuarioId
 * Consulta los logros de un usuario ("yo" = usuario autenticado).
 * Permitido al propio estudiante, a un docente de sus grupos o al admin.
 */
router.get('/logros/:usuarioId', exigirRol('sesion'), async (req, res) => {
  try {
    const targetId = req.params.usuarioId === 'yo' ? req.usuario.id : req.params.usuarioId;

    let permitido = false;
    if (req.usuario.rol === 'admin') {
      permitido = true;
    } else if (req.usuario.id === targetId) {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(req.usuario.id);
      if (estudiantes.includes(targetId)) {
        permitido = true;
      }
    }

    if (!permitido) {
      return res.status(403).json({ error: 'No tienes permisos para consultar estos logros' });
    }

    const lista = await almacen.leer('logros').catch(() => []);
    const logro = lista.find(l => l && l.usuarioId === targetId);

    if (logro) {
      res.json(logro);
    } else {
      res.json({
        usuarioId: targetId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      });
    }
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 500;
    res.status(estado).json({ error: err.message || 'Error al obtener logros' });
  }
});

export default router;
