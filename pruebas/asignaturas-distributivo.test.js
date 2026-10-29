// pruebas/asignaturas-distributivo.test.js · Pruebas unitarias para Tarea P02.3 (Asignaturas y distributivo)
import test from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from '../servidor/almacen.js';
import { MENU } from '../publico/js/nucleo/menu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. menu.js · Contiene Asignaturas y Distributivo con rol admin', () => {
  const asig = MENU.find(m => m.texto === 'Asignaturas');
  assert.ok(asig, 'MENU debe incluir "Asignaturas"');
  assert.equal(asig.href, '/paginas/admin-asignaturas.html');
  assert.deepEqual(asig.roles, ['admin']);

  const dist = MENU.find(m => m.texto === 'Distributivo');
  assert.ok(dist, 'MENU debe incluir "Distributivo"');
  assert.equal(dist.href, '/paginas/distributivo.html');
  assert.deepEqual(dist.roles, ['admin']);
});

test('2. paginas/admin-asignaturas.html y admin-asignaturas.js · Integridad y roles', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/admin-asignaturas.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/admin-asignaturas.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/admin-asignaturas.css');

  assert.ok(fsSync.existsSync(rutaHtml), 'admin-asignaturas.html debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'admin-asignaturas.js debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'admin-asignaturas.css debe existir');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["admin"]'), 'admin-asignaturas.js debe exigir rol admin');
  assert.ok(js.includes('api.listar("asignaturas")'), 'Debe listar asignaturas');
  assert.ok(js.includes('ui.modal'), 'Debe utilizar ui.modal para crear o editar');
  assert.ok(js.includes('ui.confirmar'), 'Debe utilizar ui.confirmar antes de eliminar');
  assert.ok(js.includes('api.eliminar("asignaturas"'), 'Debe llamar a api.eliminar');
});

test('3. paginas/distributivo.html y distributivo.js · Integridad y roles', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/distributivo.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/distributivo.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/distributivo.css');

  assert.ok(fsSync.existsSync(rutaHtml), 'distributivo.html debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'distributivo.js debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'distributivo.css debe existir');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["admin"]'), 'distributivo.js debe exigir rol admin');
  assert.ok(js.includes('api.listar("distributivo")'), 'Debe listar distributivo');
  assert.ok(js.includes('modal-contador-estudiantes'), 'Debe incluir contador de estudiantes en modal');
  assert.ok(js.includes('chk-estudiante-modal'), 'Debe incluir casillas de selección para estudiantes');
  assert.ok(js.includes('ui.modal'), 'Debe utilizar ui.modal para crear o editar grupos');
  assert.ok(js.includes('ui.confirmar'), 'Debe solicitar confirmación antes de eliminar');
});

test('4. API / datos · Operaciones sobre asignaturas y distributivo', async () => {
  // Crear asignatura de prueba
  const asigPrueba = await almacen.agregar('asignaturas', {
    nombre: 'Asignatura Test Unit',
    nivel: 'MAESTRÍA',
    descripcion: 'Materia para prueba automatizada'
  });
  assert.ok(asigPrueba.id);

  // Crear grupo vinculado en distributivo
  const grupoPrueba = await almacen.agregar('distributivo', {
    asignaturaId: asigPrueba.id,
    paralelo: 'Z',
    periodo: '2026-2027',
    docenteId: 'usu_000002',
    estudiantes: ['usu_000004', 'usu_000005']
  });
  assert.ok(grupoPrueba.id);

  // Verificar que el grupo referencia la asignatura
  const grupos = await almacen.leer('distributivo');
  const tieneGrupos = grupos.some(g => g.asignaturaId === asigPrueba.id);
  assert.equal(tieneGrupos, true, 'La asignatura debe tener grupos vinculados');

  // Limpiar grupo de prueba y asignatura de prueba
  await almacen.eliminar('distributivo', grupoPrueba.id);
  await almacen.eliminar('asignaturas', asigPrueba.id);
});
