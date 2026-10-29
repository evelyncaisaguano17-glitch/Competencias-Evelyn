// servidor/rutas/subidas.js · Subida de archivos con multer (imágenes, PDFs y audios)
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = express.Router();
const DIR_SUBIDAS = fileURLToPath(new URL('../../publico/recursos/subidas', import.meta.url));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(DIR_SUBIDAS, { recursive: true });
      cb(null, DIR_SUBIDAS);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString('hex');
    cb(null, `${aleatorio}${ext}`);
  }
});

// POST /api/subidas
router.post('/subidas', exigirRol('sesion'), async (req, res, next) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes').catch(() => ({ maxSubidaMB: 10 }));
    const esDocenteOAdmin = req.usuario && (req.usuario.rol === 'admin' || req.usuario.rol === 'docente');
    const maxMB = esDocenteOAdmin ? (ajustes.maxSubidaMB || 10) : 2;
    const maxBytes = maxMB * 1024 * 1024;

    const tiposPermitidos = esDocenteOAdmin
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/mp3']
      : ['image/jpeg', 'image/png', 'image/webp'];

    const extensionesPermitidas = esDocenteOAdmin
      ? ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp3']
      : ['.jpg', '.jpeg', '.png', '.webp'];

    const upload = multer({
      storage,
      limits: { fileSize: maxBytes },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (tiposPermitidos.includes(file.mimetype) && extensionesPermitidas.includes(ext)) {
          cb(null, true);
        } else {
          const mensaje = esDocenteOAdmin
            ? 'Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3'
            : 'Solo se permiten imágenes en formato JPG, PNG o WEBP';
          const error = new Error(mensaje);
          error.estado = 400;
          cb(error, false);
        }
      }
    });

    upload.single('archivo')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: `El archivo excede el límite máximo permitido de ${maxMB} MB`
          });
        }
        return res.status(err.estado || 400).json({
          error: err.message || 'Error al procesar el archivo'
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se envió ningún archivo en el campo "archivo"' });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.status(201).json({ url });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
