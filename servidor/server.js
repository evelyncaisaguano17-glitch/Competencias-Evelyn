import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import * as ganchos from './ganchos.js';
import { cargarUsuario } from './auth.js';

dotenv.config();

const app = express();
const DIR_PUBLICO = fileURLToPath(new URL('../publico', import.meta.url));
const DIR_RUTAS = fileURLToPath(new URL('./rutas', import.meta.url));

// Redirigir rutas con extensión .htm a .html
app.use((req, res, next) => {
  if (req.path.endsWith('.htm')) {
    return res.redirect(301, req.originalUrl.replace(/\.htm(\?.*)?$/, '.html$1'));
  }
  next();
});

// Servir archivos estáticos de publico/
app.use(express.static(DIR_PUBLICO));

// Analizador JSON con límite de 1 MB
app.use(express.json({ limit: '1mb' }));

// Cargar usuario autenticado mediante token Bearer
app.use(cargarUsuario);

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : (err.statusCode || 500);
  res.status(estado).json({ error: err.message || 'Error interno del servidor' });
}

// Montar automáticamente cada servidor/rutas/*.js en orden alfabético
try {
  const archivos = await fs.readdir(DIR_RUTAS);
  const rutasJs = archivos.filter(f => f.endsWith('.js')).sort();
  for (const archivo of rutasJs) {
    const rutaCompleta = path.join(DIR_RUTAS, archivo);
    const mod = await import(pathToFileURL(rutaCompleta).href);
    if (mod.default) {
      app.use('/api', mod.default);
    }
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('Error al cargar rutas personalizadas:', err);
  }
}

// API genérica en /api/:col y /api/:col/:id
app.get('/api/:col', async (req, res) => {
  try {
    const { col } = req.params;
    const autorizado = await puede(req.usuario, 'leer', col);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }
    let lista = await almacen.buscar(col, req.query);
    lista = await ganchos.aplicar(col, 'filtrarLista', lista, req.usuario);
    res.json(lista);
  } catch (err) {
    responderError(res, err);
  }
});

app.get('/api/:col/:id', async (req, res) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const item = lista.find(r => r && r.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    const autorizado = await puede(req.usuario, 'leer', col, item);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }
    res.json(item);
  } catch (err) {
    responderError(res, err);
  }
});

app.post('/api/:col', async (req, res) => {
  try {
    const { col } = req.params;
    const autorizado = await puede(req.usuario, 'escribir', col, req.body);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }
    let datos = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, null);
    const creado = await almacen.agregar(col, datos);
    await ganchos.aplicar(col, 'despuesDeGuardar', creado, req.usuario, null);
    res.status(201).json(creado);
  } catch (err) {
    responderError(res, err);
  }
});

app.put('/api/:col/:id', async (req, res) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find(r => r && r.id === id);
    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    const autorizado = await puede(req.usuario, 'escribir', col, anterior);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }
    let cambios = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await ganchos.aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);
    res.json(actualizado);
  } catch (err) {
    responderError(res, err);
  }
});

app.delete('/api/:col/:id', async (req, res) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find(r => r && r.id === id);
    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    const autorizado = await puede(req.usuario, 'escribir', col, anterior);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }
    await almacen.eliminar(col, id);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err);
  }
});

// Manejador general de errores
app.use((err, req, res, next) => {
  responderError(res, err);
});

const PUERTO = process.env.PORT || process.env.PUERTO || 3000;
let servidor = null;

const esPrincipal = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('server.js')
);

if (esPrincipal) {
  servidor = app.listen(PUERTO, () => {
    console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
  });
}

export { app, servidor };
export default app;
