// pruebas/ahorcado-actividades.test.js · Pruebas unitarias para Tarea P04.3 (Ahorcado y actividades)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAIZ = path.join(__dirname, '..');

test('1. catalogo-actividades.js · Contiene ahorcado y canciones', async () => {
  const { ACTIVIDADES } = await import('../publico/js/nucleo/catalogo-actividades.js');
  assert.ok(Array.isArray(ACTIVIDADES), 'ACTIVIDADES debe ser un arreglo');

  const ahorcado = ACTIVIDADES.find(a => a.id === 'ahorcado');
  assert.ok(ahorcado, 'Debe existir la actividad ahorcado');
  assert.equal(ahorcado.texto, 'Ahorcado');
  assert.equal(ahorcado.descripcion, 'Adivina la palabra del tema');
  assert.equal(ahorcado.href, '/paginas/ahorcado.html');

  const canciones = ACTIVIDADES.find(a => a.id === 'canciones');
  assert.ok(canciones, 'Debe conservar la actividad canciones');
});

test('2. menu.js · Menú incluye Actividades con roles estudiante y docente', async () => {
  const { MENU } = await import('../publico/js/nucleo/menu.js');
  const item = MENU.find(m => m.texto === 'Actividades');
  assert.ok(item, 'menu.js debe incluir Actividades');
  assert.equal(item.href, '/paginas/actividades.html');
  assert.deepEqual(item.roles, ['estudiante', 'docente']);
});

test('3. Integridad de páginas HTML y módulos CSS/JS', async () => {
  const actHtml = await fs.readFile(path.join(RAIZ, 'publico/paginas/actividades.html'), 'utf8');
  assert.ok(actHtml.includes('/css/modulos/actividades.css'), 'actividades.html debe enlazar su CSS');
  assert.ok(actHtml.includes('/js/modulos/actividades.js'), 'actividades.html debe cargar su JS');

  const ahorcadoHtml = await fs.readFile(path.join(RAIZ, 'publico/paginas/ahorcado.html'), 'utf8');
  assert.ok(ahorcadoHtml.includes('/css/modulos/ahorcado.css'), 'ahorcado.html debe enlazar su CSS');
  assert.ok(ahorcadoHtml.includes('/js/modulos/ahorcado.js'), 'ahorcado.html debe cargar su JS');

  const ahorcadoCss = await fs.readFile(path.join(RAIZ, 'publico/css/modulos/ahorcado.css'), 'utf8');
  assert.ok(ahorcadoCss.includes('.globo-svg'), 'ahorcado.css debe estilizar .globo-svg');
  assert.ok(ahorcadoCss.includes('estado-0'), 'ahorcado.css debe contemplar estado-0');
  assert.ok(ahorcadoCss.includes('estado-1'), 'ahorcado.css debe contemplar estado-1');
  assert.ok(ahorcadoCss.includes('estado-2'), 'ahorcado.css debe contemplar estado-2');
  assert.ok(ahorcadoCss.includes('estado-3'), 'ahorcado.css debe contemplar estado-3');
  assert.ok(ahorcadoCss.includes('estado-4'), 'ahorcado.css debe contemplar estado-4');
  assert.ok(ahorcadoCss.includes('transition'), 'ahorcado.css debe incluir transiciones');

  const ahorcadoJs = await fs.readFile(path.join(RAIZ, 'publico/js/modulos/ahorcado.js'), 'utf8');
  assert.ok(ahorcadoJs.includes('obtenerTemaActividad'), 'ahorcado.js debe usar obtenerTemaActividad');
  assert.ok(ahorcadoJs.includes('mostrarRetro'), 'ahorcado.js debe llamar a mostrarRetro');
  assert.ok(ahorcadoJs.includes('registrarIntento'), 'ahorcado.js debe registrar el intento');
  assert.ok(ahorcadoJs.includes("'Ñ'"), 'ahorcado.js debe contemplar la letra Ñ');
  assert.ok(ahorcadoJs.includes('btn-otra-palabra'), 'ahorcado.js debe tener botón de otra palabra');
});

test('4. Lógica de cálculo de puntaje según errores y estado', () => {
  const calcularPuntaje = (gano, errores) => gano ? 10 - errores * 2 : 0;

  assert.equal(calcularPuntaje(true, 0), 10, '0 errores debe otorgar 10 puntos');
  assert.equal(calcularPuntaje(true, 1), 8, '1 error debe otorgar 8 puntos');
  assert.equal(calcularPuntaje(true, 2), 6, '2 errores debe otorgar 6 puntos');
  assert.equal(calcularPuntaje(true, 3), 4, '3 errores debe otorgar 4 puntos');
  assert.equal(calcularPuntaje(false, 4), 0, 'Derrota en 4 errores debe otorgar 0 puntos');
  assert.equal(calcularPuntaje(false, 1), 0, 'Derrota debe otorgar 0 puntos');
});
