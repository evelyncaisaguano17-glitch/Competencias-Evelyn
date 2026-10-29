// pruebas/quiz.test.js · Pruebas unitarias para Tarea P08.3 (Quiz por niveles)
import test from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVIDADES } from '../publico/js/nucleo/catalogo-actividades.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. catalogo-actividades.js · Contiene actividad quiz con sus propiedades', () => {
  const quiz = ACTIVIDADES.find((a) => a.id === 'quiz');
  assert.ok(quiz, 'Debe existir la actividad quiz en ACTIVIDADES');
  assert.equal(quiz.texto, 'Quiz por niveles');
  assert.equal(quiz.descripcion, 'Supera 5 niveles y gana diplomas');
  assert.equal(quiz.href, '/paginas/quiz.html');
});

test('2. Integridad de archivos de interfaz: quiz.html, quiz.css y quiz.js', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/quiz.html');
  const rutaCss = path.join(raiz, 'publico/css/modulos/quiz.css');
  const rutaJs = path.join(raiz, 'publico/js/modulos/quiz.js');

  assert.ok(fsSync.existsSync(rutaHtml), 'quiz.html debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'quiz.css debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'quiz.js debe existir');

  const html = fsSync.readFileSync(rutaHtml, 'utf-8');
  assert.ok(html.includes('/css/tokens.css'), 'HTML debe incluir tokens.css');
  assert.ok(html.includes('/css/base.css'), 'HTML debe incluir base.css');
  assert.ok(html.includes('/css/componentes.css'), 'HTML debe incluir componentes.css');
  assert.ok(html.includes('/css/modulos/quiz.css'), 'HTML debe incluir quiz.css');
  assert.ok(html.includes('/js/modulos/quiz.js'), 'HTML debe incluir quiz.js');

  const css = fsSync.readFileSync(rutaCss, 'utf-8');
  assert.ok(css.includes('.quiz-niveles-grid'), 'CSS debe definir la cuadrícula de niveles');
  assert.ok(css.includes('.tarjeta-nivel'), 'CSS debe estilizar las tarjetas de nivel');
  assert.ok(css.includes('.quiz-vf-btn'), 'CSS debe definir botones V/F');
  assert.ok(css.includes('.quiz-opcion-item'), 'CSS debe definir opciones de radio grandes');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["estudiante"]') || js.includes("roles: ['estudiante']"), 'Debe admitir rol estudiante');
  assert.ok(js.includes('obtenerTemaActividad'), 'Debe invocar obtenerTemaActividad()');
  assert.ok(js.includes('/api/quiz/estado'), 'Debe consultar GET /api/quiz/estado');
  assert.ok(js.includes('/api/quiz/iniciar'), 'Debe invocar POST /api/quiz/iniciar');
  assert.ok(js.includes('/api/quiz/responder'), 'Debe invocar POST /api/quiz/responder');
  assert.ok(js.includes('/api/quiz/finalizar'), 'Debe invocar POST /api/quiz/finalizar');
  assert.ok(js.includes('mostrarRetro'), 'Debe invocar mostrarRetro()');
  assert.ok(js.includes('mostrarResumen'), 'Debe invocar mostrarResumen()');
  assert.ok(js.includes('mostrarLogros'), 'Debe invocar mostrarLogros()');
  assert.ok(js.includes('generarDiploma'), 'Debe invocar generarDiploma()');
});
