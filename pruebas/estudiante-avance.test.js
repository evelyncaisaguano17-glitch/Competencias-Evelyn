// pruebas/estudiante-avance.test.js · Pruebas para Tarea P02.6 (Vista del estudiante y avance)
import test from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from '../servidor/almacen.js';
import { MENU } from '../publico/js/nucleo/menu.js';
import { ACTIVIDADES } from '../publico/js/nucleo/catalogo-actividades.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. catalogo-actividades.js y menu.js · Integridad y enlaces', () => {
  // catalogo-actividades
  assert.ok(Array.isArray(ACTIVIDADES), 'ACTIVIDADES debe ser un arreglo exportado');

  // menu.js
  const misAsig = MENU.find(m => m.texto === 'Mis asignaturas');
  assert.ok(misAsig, 'MENU debe incluir "Mis asignaturas"');
  assert.equal(misAsig.href, '/paginas/asignaturas.html');
  assert.deepEqual(misAsig.roles, ['estudiante', 'docente']);
});

test('2. paginas/asignaturas.html, asignatura.html y tema.html · Existencia e integridad', () => {
  const archivos = [
    'publico/paginas/asignaturas.html',
    'publico/css/modulos/asignaturas.css',
    'publico/js/modulos/asignaturas.js',
    'publico/paginas/asignatura.html',
    'publico/css/modulos/asignatura.css',
    'publico/js/modulos/asignatura.js',
    'publico/paginas/tema.html',
    'publico/css/modulos/tema.css',
    'publico/js/modulos/tema.js'
  ];

  for (const f of archivos) {
    assert.ok(fsSync.existsSync(path.join(raiz, f)), `${f} debe existir`);
  }

  const jsAsignaturas = fsSync.readFileSync(path.join(raiz, 'publico/js/modulos/asignaturas.js'), 'utf-8');
  assert.ok(jsAsignaturas.includes('export async function calcularAvance'), 'asignaturas.js debe exportar calcularAvance');
  assert.ok(jsAsignaturas.includes('roles: ["estudiante", "docente"]'), 'asignaturas.js debe exigir roles estudiante y docente');

  const jsAsignatura = fsSync.readFileSync(path.join(raiz, 'publico/js/modulos/asignatura.js'), 'utf-8');
  assert.ok(jsAsignatura.includes('roles: ["estudiante", "docente"]'), 'asignatura.js debe exigir roles estudiante y docente');
  assert.ok(jsAsignatura.includes('Revisado ✓'), 'asignatura.js debe contemplar estado Revisado ✓');
  assert.ok(jsAsignatura.includes('Pendiente'), 'asignatura.js debe contemplar estado Pendiente');

  const jsTema = fsSync.readFileSync(path.join(raiz, 'publico/js/modulos/tema.js'), 'utf-8');
  assert.ok(jsTema.includes('roles: ["estudiante", "docente"]'), 'tema.js debe exigir roles estudiante y docente');
  assert.ok(jsTema.includes('util.formatoBasico'), 'tema.js debe usar util.formatoBasico para el resumen');
  assert.ok(jsTema.includes('localStorage.setItem("ultimoTema"'), 'tema.js debe guardar ultimoTema en localStorage');
  assert.ok(jsTema.includes('btn-marcar-revisado'), 'tema.js debe incluir botón para marcar como revisado');
  assert.ok(jsTema.includes('Practica este tema'), 'tema.js debe incluir bloque Practica este tema');
  assert.ok(jsTema.includes('youtube.com') || jsTema.includes('youtu.be'), 'tema.js debe soportar incrustación de video');
});

test('3. asignaturas.js · Función calcularAvance()', async () => {
  // Simular api en entorno de prueba
  const { calcularAvance } = await import('../publico/js/modulos/asignaturas.js');
  assert.equal(typeof calcularAvance, 'function');

  // Sin asignaturaId retorna 0%
  const vacio = await calcularAvance(null);
  assert.equal(vacio.porcentaje, 0);
  assert.equal(Number(vacio), 0);
});
