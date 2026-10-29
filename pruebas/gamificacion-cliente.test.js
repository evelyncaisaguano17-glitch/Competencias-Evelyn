// pruebas/gamificacion-cliente.test.js · Pruebas unitarias para Tarea P04.2 (Gamificación, retroalimentación y selector de tema en cliente)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. componentes.css · Estilos para .retro, .celebracion y .puntos-usuario', () => {
  const css = fs.readFileSync(path.join(raiz, 'publico', 'css', 'componentes.css'), 'utf-8');

  assert.ok(css.includes('.retro'), 'componentes.css debe definir .retro');
  assert.ok(css.includes('.retro--correcto'), 'componentes.css debe definir .retro--correcto');
  assert.ok(css.includes('.retro--incorrecto'), 'componentes.css debe definir .retro--incorrecto');
  assert.ok(css.includes('.celebracion'), 'componentes.css debe definir .celebracion');
  assert.ok(css.includes('.puntos-usuario'), 'componentes.css debe definir .puntos-usuario');
  assert.ok(css.includes('prefers-reduced-motion'), 'componentes.css debe contemplar prefers-reduced-motion para la animación');
});

test('2. gamificacion.js · Funciones registrarIntento, mostrarLogros y logrosDe', async () => {
  const gamifJs = fs.readFileSync(path.join(raiz, 'publico', 'js', 'nucleo', 'gamificacion.js'), 'utf-8');

  assert.ok(gamifJs.includes('export async function registrarIntento'), 'gamificacion.js debe exportar registrarIntento');
  assert.ok(gamifJs.includes('export async function mostrarLogros'), 'gamificacion.js debe exportar mostrarLogros');
  assert.ok(gamifJs.includes('export async function logrosDe'), 'gamificacion.js debe exportar logrosDe');
  assert.ok(gamifJs.includes('/api/intentos'), 'registrarIntento debe invocar /api/intentos');
  assert.ok(gamifJs.includes('puntos-usuario'), 'mostrarLogros debe actualizar #puntos-usuario');
  assert.ok(gamifJs.includes('celebracion'), 'mostrarLogros debe incluir modal con clase .celebracion');
});

test('3. retroalimentacion.js · Funciones mostrarRetro y mostrarResumen', async () => {
  const retroJs = fs.readFileSync(path.join(raiz, 'publico', 'js', 'nucleo', 'retroalimentacion.js'), 'utf-8');

  assert.ok(retroJs.includes('export function mostrarRetro'), 'retroalimentacion.js debe exportar mostrarRetro');
  assert.ok(retroJs.includes('export async function mostrarResumen'), 'retroalimentacion.js debe exportar mostrarResumen');
  assert.ok(retroJs.includes('retro--correcto'), 'mostrarRetro debe usar modificador correcto');
  assert.ok(retroJs.includes('retro--incorrecto'), 'mostrarRetro debe usar modificador incorrecto');
  assert.ok(retroJs.includes('aria-live'), 'mostrarRetro debe incluir aria-live');
  assert.ok(retroJs.includes('Repasar el tema'), 'mostrarResumen y mostrarRetro deben incluir opción Repasar el tema');
  assert.ok(retroJs.includes('Jugar de nuevo'), 'mostrarResumen debe incluir botón Jugar de nuevo');
  assert.ok(retroJs.includes('repetir'), 'mostrarResumen debe resolver repetir o salir');
});

test('4. selector-tema.js · Función obtenerTemaActividad', async () => {
  const selJs = fs.readFileSync(path.join(raiz, 'publico', 'js', 'nucleo', 'selector-tema.js'), 'utf-8');

  assert.ok(selJs.includes('export async function obtenerTemaActividad'), 'selector-tema.js debe exportar obtenerTemaActividad');
  assert.ok(selJs.includes('temaId'), 'obtenerTemaActividad debe comprobar temaId');
  assert.ok(selJs.includes('asignaturas'), 'obtenerTemaActividad debe cargar asignaturas');
  assert.ok(selJs.includes('unidades'), 'obtenerTemaActividad debe cargar unidades');
  assert.ok(selJs.includes('temas'), 'obtenerTemaActividad debe cargar temas');
});

test('5. plantilla.js y tema.js · Integración de puntos e intentos de gamificación', () => {
  const plantillaJs = fs.readFileSync(path.join(raiz, 'publico', 'js', 'nucleo', 'plantilla.js'), 'utf-8');
  assert.ok(plantillaJs.includes('puntos-usuario'), 'plantilla.js debe renderizar #puntos-usuario');
  assert.ok(plantillaJs.includes('logrosDe'), 'plantilla.js debe llamar a logrosDe');

  const temaJs = fs.readFileSync(path.join(raiz, 'publico', 'js', 'modulos', 'tema.js'), 'utf-8');
  assert.ok(temaJs.includes('registrarIntento'), 'tema.js debe importar y llamar a registrarIntento');
  assert.ok(temaJs.includes('tema-revisado'), 'tema.js debe registrar la actividad tema-revisado');
});
