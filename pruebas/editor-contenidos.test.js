// pruebas/editor-contenidos.test.js · Pruebas unitarias para Tarea P02.4 (Editor de contenidos: unidades y temas)
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

test('1. menu.js · Contiene Contenidos con roles docente y admin', () => {
  const item = MENU.find(m => m.texto === 'Contenidos');
  assert.ok(item, 'MENU debe incluir "Contenidos"');
  assert.equal(item.href, '/paginas/editor-contenidos.html');
  assert.deepEqual(item.roles, ['docente', 'admin']);
});

test('2. paginas/editor-contenidos.html y editor-contenidos.js · Integridad y roles', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/editor-contenidos.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/editor-contenidos.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/editor-contenidos.css');

  assert.ok(fsSync.existsSync(rutaHtml), 'editor-contenidos.html debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'editor-contenidos.js debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'editor-contenidos.css debe existir');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["docente", "admin"]'), 'editor-contenidos.js debe exigir roles docente y admin');
  assert.ok(js.includes('api.listar("asignaturas")'), 'Debe listar asignaturas');
  assert.ok(js.includes('api.listar("unidades"'), 'Debe listar unidades');
  assert.ok(js.includes('api.listar("temas"'), 'Debe listar temas');
  assert.ok(js.includes('api.crear("unidades"'), 'Debe permitir crear unidades');
  assert.ok(js.includes('api.actualizar("unidades"'), 'Debe permitir actualizar unidades');
  assert.ok(js.includes('api.crear("temas"'), 'Debe permitir crear temas');
  assert.ok(js.includes('api.actualizar("temas"'), 'Debe permitir actualizar temas');
  assert.ok(js.includes('/paginas/editor-tema.html?id='), 'Debe incluir enlace a editor-tema.html con id del tema');
  assert.ok(js.includes('ui.modal'), 'Debe utilizar ui.modal para crear o editar');
});

test('3. API / datos · Operaciones de unidades y temas', async () => {
  // 1. Crear unidad de prueba
  const unidad = await almacen.agregar('unidades', {
    asignaturaId: 'asi_000001',
    titulo: 'Unidad de Prueba P02.4',
    orden: 99,
    visible: true
  });
  assert.ok(unidad.id);
  assert.equal(unidad.visible, true);
  assert.equal(unidad.orden, 99);

  // 2. Renombrar y cambiar visibilidad de unidad
  const unidadActualizada = await almacen.actualizar('unidades', unidad.id, {
    titulo: 'Unidad Renombrada P02.4',
    visible: false,
    orden: 100
  });
  assert.equal(unidadActualizada.titulo, 'Unidad Renombrada P02.4');
  assert.equal(unidadActualizada.visible, false);
  assert.equal(unidadActualizada.orden, 100);

  // 3. Crear tema de prueba con estado borrador
  const tema = await almacen.agregar('temas', {
    unidadId: unidad.id,
    titulo: 'Tema de Prueba P02.4',
    orden: 1,
    estado: 'borrador'
  });
  assert.ok(tema.id);
  assert.equal(tema.estado, 'borrador');

  // 4. Cambiar orden y estado del tema a publicado
  const temaActualizado = await almacen.actualizar('temas', tema.id, {
    orden: 2,
    estado: 'publicado'
  });
  assert.equal(temaActualizado.orden, 2);
  assert.equal(temaActualizado.estado, 'publicado');

  // Limpieza de registros de prueba
  await almacen.eliminar('temas', tema.id);
  await almacen.eliminar('unidades', unidad.id);
});
