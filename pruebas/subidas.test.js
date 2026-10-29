// pruebas/subidas.test.js · Pruebas unitarias para subida de imágenes y módulos de P01.3
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from '../servidor/almacen.js';
import { app } from '../servidor/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

import { Readable } from 'node:stream';

// Helper para crear un token de sesión temporal en pruebas
async function crearSesionPrueba(rol = 'estudiante') {
  const usuario = await almacen.agregar('usuarios', {
    nombre: 'Test',
    apellido: 'Subidas',
    correo: `test.${Date.now()}_${Math.random().toString(36).slice(2)}@ejemplo.com`,
    rol,
    activo: true
  });

  const token = `tok_subida_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await almacen.agregar('sesiones', {
    token,
    usuarioId: usuario.id,
    expira: new Date(Date.now() + 60000).toISOString()
  });

  return { usuario, token };
}

// Helper para simular petición multipart/form-data a Express
async function subirImagenSimulada(token, { nombreArchivo, contenido, tipoMime }) {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const bodyBuffer = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="archivo"; filename="${nombreArchivo}"\r\n` +
      `Content-Type: ${tipoMime}\r\n\r\n`
    ),
    Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const req = Readable.from([bodyBuffer]);
  req.method = 'POST';
  req.url = '/api/subidas';
  req.originalUrl = '/api/subidas';
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(bodyBuffer.length)
  };

  if (token) {
    req.headers['authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve) => {
    let estado = 200;
    let cuerpoRespuesta = null;

    const res = {
      statusCode: 200,
      status(code) {
        estado = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        cuerpoRespuesta = data;
        resolve({ estado, cuerpo: cuerpoRespuesta });
      },
      send(data) {
        cuerpoRespuesta = data;
        resolve({ estado, cuerpo: cuerpoRespuesta });
      },
      setHeader() {},
      getHeader() { return null; }
    };

    app(req, res, () => {
      resolve({ estado: 404, cuerpo: { error: 'No encontrado' } });
    });
  });
}

test('1. servidor/rutas/subidas.js · Validación y almacenamiento de imágenes con multer', async (t) => {
  const { token } = await crearSesionPrueba('estudiante');

  await t.test('rechaza subida sin sesión con 401', async () => {
    const res = await subirImagenSimulada(null, {
      nombreArchivo: 'foto.png',
      contenido: 'datos',
      tipoMime: 'image/png'
    });
    assert.equal(res.estado, 401);
  });

  await t.test('rechaza archivo con formato no permitido (ej. .txt o .pdf)', async () => {
    const res = await subirImagenSimulada(token, {
      nombreArchivo: 'documento.pdf',
      contenido: '%PDF-1.4',
      tipoMime: 'application/pdf'
    });
    assert.equal(res.estado, 400);
    assert.ok(res.cuerpo.error.includes('JPG, PNG o WEBP'));
  });

  await t.test('acepta y guarda imagen PNG válida respondiendo { url }', async () => {
    // 1x1 PNG transparente mínimo
    const pngMinimo = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');

    const res = await subirImagenSimulada(token, {
      nombreArchivo: 'foto-perfil.png',
      contenido: pngMinimo,
      tipoMime: 'image/png'
    });

    assert.equal(res.estado, 201);
    assert.ok(res.cuerpo.url);
    assert.ok(res.cuerpo.url.startsWith('/recursos/subidas/'));
    assert.ok(res.cuerpo.url.endsWith('.png'));

    // Verificar que el archivo existe físicamente en publico/recursos/subidas/
    const rutaFisica = path.join(raiz, 'publico', res.cuerpo.url);
    assert.ok(fsSync.existsSync(rutaFisica), 'El archivo físico debe haberse guardado en publico/recursos/subidas/');

    // Limpiar archivo creado
    await fs.unlink(rutaFisica).catch(() => {});
  });
});

test('2. menu.js · Contiene enlaces y roles acordados en Tarea P01.3', async () => {
  const { MENU } = await import('../publico/js/nucleo/menu.js');

  const miPerfil = MENU.find(m => m.texto === 'Mi perfil');
  assert.ok(miPerfil, 'MENU debe incluir "Mi perfil"');
  assert.equal(miPerfil.href, '/paginas/perfil.html');
  assert.deepEqual(miPerfil.roles, ['sesion']);

  const usuarios = MENU.find(m => m.texto === 'Usuarios');
  assert.ok(usuarios, 'MENU debe incluir "Usuarios"');
  assert.equal(usuarios.href, '/paginas/admin-usuarios.html');
  assert.deepEqual(usuarios.roles, ['admin']);
});

test('3. paginas/perfil.html y perfil.js · Contempla <section id="logros"></section> vacía y roles sesion', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/perfil.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/perfil.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/perfil.css');

  assert.ok(fsSync.existsSync(rutaHtml), 'perfil.html debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'perfil.js debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'perfil.css debe existir');

  const html = fsSync.readFileSync(rutaHtml, 'utf-8');
  assert.ok(html.includes('id="logros"'), 'perfil.html debe contener <section id="logros">');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["sesion"]'), 'perfil.js debe exigir rol sesion');
  assert.ok(js.includes('api.subir'), 'perfil.js debe invocar api.subir');
  assert.ok(js.includes('/api/auth/perfil'), 'perfil.js debe llamar a PUT /api/auth/perfil');
  assert.ok(js.includes('/api/auth/clave'), 'perfil.js debe llamar a POST /api/auth/clave');
});

test('4. paginas/admin-usuarios.html y admin-usuarios.js · Contempla roles admin, tabla, buscador y modal', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/admin-usuarios.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/admin-usuarios.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/admin-usuarios.css');

  assert.ok(fsSync.existsSync(rutaHtml), 'admin-usuarios.html debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'admin-usuarios.js debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'admin-usuarios.css debe existir');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["admin"]'), 'admin-usuarios.js debe exigir rol admin');
  assert.ok(js.includes('api.listar("usuarios")'), 'admin-usuarios.js debe listar usuarios');
  assert.ok(js.includes('api.actualizar("usuarios"'), 'admin-usuarios.js debe actualizar rol o activo');
  assert.ok(js.includes('/api/admin/usuarios/'), 'admin-usuarios.js debe llamar a restablecer clave');
  assert.ok(js.includes('ui.confirmar'), 'admin-usuarios.js debe usar ui.confirmar');
  assert.ok(js.includes('ui.modal'), 'admin-usuarios.js debe abrir modal con la clave');
});
