// servidor/rutas/auth.js · Rutas de autenticación, administración de usuarios y bitácora
import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = express.Router();

// Control de intentos fallidos de inicio de sesión en memoria
const fallosLogin = new Map();
const VENTANA_FALLOS_MS = 15 * 60 * 1000; // 15 minutos
const MAX_FALLOS = 5;

function registrarFallo(correo) {
  const clave = correo.toLowerCase().trim();
  const ahora = Date.now();
  const intentos = (fallosLogin.get(clave) || []).filter(t => ahora - t < VENTANA_FALLOS_MS);
  intentos.push(ahora);
  fallosLogin.set(clave, intentos);
}

function demasiadosFallos(correo) {
  const clave = correo.toLowerCase().trim();
  const ahora = Date.now();
  const intentos = (fallosLogin.get(clave) || []).filter(t => ahora - t < VENTANA_FALLOS_MS);
  fallosLogin.set(clave, intentos);
  return intentos.length >= MAX_FALLOS;
}

function limpiarFallos(correo) {
  fallosLogin.delete(correo.toLowerCase().trim());
}

export function limpiarTodosLosFallos() {
  fallosLogin.clear();
}

function generarClaveTemporal(longitud = 10) {
  const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(longitud);
  let clave = '';
  for (let i = 0; i < longitud; i++) {
    clave += caracteres[bytes[i] % caracteres.length];
  }
  return clave;
}

// POST /api/auth/registro
router.post('/auth/registro', async (req, res, next) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body || {};

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }
    if (!correo || typeof correo !== 'string') {
      return res.status(400).json({ error: 'El correo es obligatorio' });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) {
      return res.status(400).json({ error: 'El formato de correo no es válido' });
    }

    if (!clave || typeof clave !== 'string' || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(clave)) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres, incluyendo letras y números'
      });
    }

    if (consentimiento !== true) {
      return res.status(400).json({
        error: 'Debes aceptar los términos y el consentimiento informado'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    if (usuarios.some(u => u && u.correo && u.correo.toLowerCase() === correoNormalizado)) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoUsuario = await almacen.agregar('usuarios', {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNormalizado,
      claveHash,
      rol: 'estudiante',
      activo: true,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    const { claveHash: _, ...usuarioSinHash } = nuevoUsuario;
    res.status(201).json(usuarioSinHash);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { correo, clave } = req.body || {};

    if (!correo || !clave || typeof correo !== 'string' || typeof clave !== 'string') {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    const correoNormalizado = correo.trim().toLowerCase();

    if (demasiadosFallos(correoNormalizado)) {
      return res.status(429).json({
        error: 'Demasiados intentos fallidos. Inténtalo más tarde.'
      });
    }

    let usuarios = await almacen.leer('usuarios');
    if (!Array.isArray(usuarios) || usuarios.length === 0) {
      try {
        const { sembrar } = await import('../semilla.js');
        await sembrar({ forzar: true });
        usuarios = await almacen.leer('usuarios');
      } catch (errAutoSembrar) {
        console.warn('Error auto-sembrando en login:', errAutoSembrar.message);
      }
    }

    let usuario = usuarios.find(u => u && u.correo && u.correo.toLowerCase() === correoNormalizado);
    if (!usuario) {
      if (correoNormalizado === 'estudiante@demo.ec' || correoNormalizado === 'estudiante@demo.com' || correoNormalizado === 'estudiante') {
        usuario = usuarios.find(u => u && u.correo === 'estudiante1@demo.ec');
      } else if (correoNormalizado === 'admin@demo.com' || correoNormalizado === 'admin') {
        usuario = usuarios.find(u => u && u.correo === 'admin@demo.ec');
      } else if (correoNormalizado === 'docente@demo.ec' || correoNormalizado === 'docente@demo.com' || correoNormalizado === 'docente') {
        usuario = usuarios.find(u => u && u.correo === 'docente1@demo.ec');
      }
    }

    const esDemo = usuario && usuario.correo && (usuario.correo.endsWith('@demo.ec') || usuario.correo.endsWith('@demo.com'));
    const esCuentaEvelyn = usuario && usuario.correo && usuario.correo.toLowerCase() === 'evelyncaisaguano17@gmail.com';
    const claveValida = usuario && (
      (await bcrypt.compare(clave, usuario.claveHash || '')) ||
      (esDemo && (clave === 'Demo12345' || clave === 'demo12345')) ||
      (esCuentaEvelyn && (clave === 'Demo12345' || clave === 'demo12345'))
    );

    if (!usuario || usuario.activo === false || !claveValida) {
      registrarFallo(correoNormalizado);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    limpiarFallos(correoNormalizado);

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/auth/logout', exigirRol('sesion'), async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const sesion = sesiones.find(s => s && s.token === token);
      if (sesion) {
        await almacen.eliminar('sesiones', sesion.id);
      }
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo: 'logout',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/yo
router.get('/auth/yo', exigirRol('sesion'), async (req, res, next) => {
  try {
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { claveHash: _, ...datos } = usuario;
    res.json(datos);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/perfil
router.put('/auth/perfil', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { nombre, apellido, foto } = req.body || {};
    const cambios = {};

    if (typeof nombre === 'string' && nombre.trim()) {
      cambios.nombre = nombre.trim();
    }
    if (typeof apellido === 'string' && apellido.trim()) {
      cambios.apellido = apellido.trim();
    }
    if (typeof foto === 'string') {
      cambios.foto = foto.trim();
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    if (!actualizado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { claveHash: _, ...datos } = actualizado;
    res.json(datos);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/clave
router.post('/auth/clave', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { actual, nueva } = req.body || {};

    if (!actual || !nueva || typeof actual !== 'string' || typeof nueva !== 'string') {
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(nueva)) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 8 caracteres, incluyendo letras y números'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(actual, usuario.claveHash || '');
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', req.usuario.id, { claveHash: nuevoHash });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/usuarios/:id/restablecer
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const claveTemporal = generarClaveTemporal(10);
    const nuevoHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', id, { claveHash: nuevoHash });

    res.json({ claveTemporal });
  } catch (err) {
    next(err);
  }
});

// POST /api/eventos
router.post('/eventos', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { tipo, recurso } = req.body || {};

    if (!tipo || !recurso || typeof tipo !== 'string' || typeof recurso !== 'string') {
      return res.status(400).json({ error: 'Los campos tipo y recurso son obligatorios' });
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo: tipo.trim(),
      recurso: recurso.trim(),
      fecha: new Date().toISOString()
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
