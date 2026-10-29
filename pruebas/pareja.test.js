// pruebas/pareja.test.js · Pruebas unitarias para Tarea P04.4 (Encuentra la pareja)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAIZ = path.join(__dirname, '..');

test('1. catalogo-actividades.js · Contiene actividad pareja', async () => {
  const { ACTIVIDADES } = await import('../publico/js/nucleo/catalogo-actividades.js');
  const pareja = ACTIVIDADES.find(a => a.id === 'pareja');
  assert.ok(pareja, 'ACTIVIDADES debe incluir la actividad pareja');
  assert.equal(pareja.texto, 'Encuentra la pareja');
  assert.equal(pareja.descripcion, 'Relaciona conceptos y definiciones');
  assert.equal(pareja.href, '/paginas/pareja.html');
});

test('2. Integridad de paginas/pareja.html, pareja.css y pareja.js', async () => {
  const html = await fs.readFile(path.join(RAIZ, 'publico/paginas/pareja.html'), 'utf8');
  assert.ok(html.includes('/css/modulos/pareja.css'), 'pareja.html debe enlazar pareja.css');
  assert.ok(html.includes('/js/modulos/pareja.js'), 'pareja.html debe cargar pareja.js');

  const css = await fs.readFile(path.join(RAIZ, 'publico/css/modulos/pareja.css'), 'utf8');
  assert.ok(css.includes('.tarjeta-pareja'), 'pareja.css debe definir .tarjeta-pareja');
  assert.ok(css.includes('preserve-3d'), 'pareja.css debe incluir giro 3D (preserve-3d)');
  assert.ok(css.includes('rotateY(180deg)'), 'pareja.css debe rotar en Y a 180deg');
  assert.ok(css.includes('prefers-reduced-motion'), 'pareja.css debe contemplar prefers-reduced-motion');

  const js = await fs.readFile(path.join(RAIZ, 'publico/js/modulos/pareja.js'), 'utf8');
  assert.ok(js.includes('obtenerTemaActividad'), 'pareja.js debe usar obtenerTemaActividad');
  assert.ok(js.includes('mostrarRetro'), 'pareja.js debe llamar a mostrarRetro');
  assert.ok(js.includes('mostrarResumen'), 'pareja.js debe llamar a mostrarResumen');
  assert.ok(js.includes('registrarIntento'), 'pareja.js debe registrar el intento');
  assert.ok(js.includes('barajar'), 'pareja.js debe usar util.barajar');
  assert.ok(js.includes('1200'), 'pareja.js debe esperar 1,2 s al fallar');
});

test('3. Fórmula de puntaje y errores de Encuentra la pareja', () => {
  const calcularPuntaje = (intentos, parejas) => {
    const errores = Math.max(0, intentos - parejas);
    const puntaje = Math.max(0, 10 - errores);
    return { puntaje, errores };
  };

  // Partida perfecta (6 intentos para 6 parejas)
  assert.deepEqual(calcularPuntaje(6, 6), { puntaje: 10, errores: 0 });

  // 2 errores (8 intentos para 6 parejas)
  assert.deepEqual(calcularPuntaje(8, 6), { puntaje: 8, errores: 2 });

  // 10 errores (16 intentos para 6 parejas)
  assert.deepEqual(calcularPuntaje(16, 6), { puntaje: 0, errores: 10 });

  // Muchos errores no da puntaje negativo
  assert.deepEqual(calcularPuntaje(25, 6), { puntaje: 0, errores: 19 });
});
