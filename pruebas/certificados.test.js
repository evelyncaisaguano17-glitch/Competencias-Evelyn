// pruebas/certificados.test.js · Pruebas unitarias para Tarea P05.2 (Certificados y verificación)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAIZ = path.join(__dirname, '..');

test('1. permisos.json · Configuración de certificados', async () => {
  const permisosRaw = await fs.readFile(path.join(RAIZ, 'datos/config/permisos.json'), 'utf8');
  const permisos = JSON.parse(permisosRaw);

  assert.ok(permisos.certificados, 'certificados debe estar definido en permisos.json');
  assert.deepEqual(permisos.certificados.leer, ['propio', 'admin'], 'leer debe permitir propio y admin');
  assert.deepEqual(permisos.certificados.escribir, ['servidor'], 'escribir debe ser exclusivo de servidor');
});

test('2. servidor/rutas/certificados.js · Integridad de rutas de certificados', async () => {
  const { default: router } = await import('../servidor/rutas/certificados.js');
  assert.ok(router, 'router de certificados debe exportarse por defecto');

  const rutas = router.stack.map(layer => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {})
  }));

  assert.ok(rutas.some(r => r.path === '/certificados/verificar/:codigo' && r.methods.includes('get')), 'Debe existir GET /certificados/verificar/:codigo');
  assert.ok(rutas.some(r => r.path === '/certificados/estado' && r.methods.includes('get')), 'Debe existir GET /certificados/estado');
  assert.ok(rutas.some(r => r.path === '/certificados' && r.methods.includes('post')), 'Debe existir POST /certificados');
});

test('3. Verificación de certificados y creación de código único', async () => {
  const almacen = await import('../servidor/almacen.js');

  const codigoTest = 'EE-' + new Date().getFullYear() + '-TEST01';
  const nuevoCert = await almacen.agregar('certificados', {
    codigo: codigoTest,
    usuarioId: 'usu_test_cert',
    tipo: 'cumplimiento',
    detalle: 'Por haber completado el programa de Cirugía',
    nombreCompleto: 'Dr. Test Cirujano'
  });

  assert.ok(nuevoCert.id, 'Debe haber creado el certificado');

  // Comprobar búsqueda
  const todos = await almacen.leer('certificados');
  const encontrado = todos.find(c => c && c.codigo === codigoTest);
  assert.ok(encontrado, 'Debe encontrarse el certificado por código');
  assert.equal(encontrado.nombreCompleto, 'Dr. Test Cirujano');
  assert.equal(encontrado.valido !== false, true);

  // Limpiar
  await almacen.eliminar('certificados', nuevoCert.id);
});

test('4. Integridad de pdf.js, paginas/verificar.html, verificar.css y verificar.js', async () => {
  const { generarDiploma } = await import('../publico/js/nucleo/pdf.js');
  assert.equal(typeof generarDiploma, 'function', 'pdf.js debe exportar generarDiploma()');

  const pdfJsRaw = await fs.readFile(path.join(RAIZ, 'publico/js/nucleo/pdf.js'), 'utf8');
  assert.ok(pdfJsRaw.includes('getComputedStyle'), 'pdf.js debe leer tokens con getComputedStyle');
  assert.ok(pdfJsRaw.includes('/paginas/verificar.html?codigo='), 'pdf.js debe incluir URL de verificación');
  assert.ok(pdfJsRaw.includes('diploma-'), 'pdf.js debe nombrar el archivo diploma-<codigo>.pdf');

  const html = await fs.readFile(path.join(RAIZ, 'publico/paginas/verificar.html'), 'utf8');
  assert.ok(html.includes('/css/modulos/verificar.css'), 'verificar.html debe enlazar su CSS');
  assert.ok(html.includes('/js/modulos/verificar.js'), 'verificar.html debe cargar su JS');

  const css = await fs.readFile(path.join(RAIZ, 'publico/css/modulos/verificar.css'), 'utf8');
  assert.ok(css.includes('.verificar-tarjeta'), 'verificar.css debe definir .verificar-tarjeta');

  const js = await fs.readFile(path.join(RAIZ, 'publico/js/modulos/verificar.js'), 'utf8');
  assert.ok(js.includes('/api/certificados/verificar/'), 'verificar.js debe consultar la API pública');
});
