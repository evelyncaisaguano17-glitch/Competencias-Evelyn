// pruebas/sopa-letras.test.js · Pruebas unitarias para Tarea P05.1 (Sopa de letras)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAIZ = path.join(__dirname, '..');

test('1. catalogo-actividades.js · Contiene actividad sopa-letras', async () => {
  const { ACTIVIDADES } = await import('../publico/js/nucleo/catalogo-actividades.js');
  const act = ACTIVIDADES.find(a => a.id === 'sopa-letras');
  assert.ok(act, 'ACTIVIDADES debe incluir la actividad sopa-letras');
  assert.equal(act.texto, 'Sopa de letras');
  assert.equal(act.descripcion, 'Encuentra los conceptos del tema');
  assert.equal(act.href, '/paginas/sopa-letras.html');
});

test('2. Función pura exportada generarSopa()', async () => {
  const { generarSopa } = await import('../publico/js/modulos/sopa-letras.js');
  assert.equal(typeof generarSopa, 'function', 'generarSopa debe ser una función exportada');

  const palabrasMuestra = ['HERIDA', 'SUTURA', 'SEROMA', 'LAVADO', 'PUNTOS'];
  const resultado = generarSopa(palabrasMuestra, 10, [[0, 1], [1, 0]]);

  assert.ok(resultado, 'generarSopa debe retornar un objeto');
  assert.ok(Array.isArray(resultado.grilla), 'grilla debe ser un arreglo bidimensional');
  assert.equal(resultado.grilla.length, 10, 'grilla debe tener 10 filas');
  assert.equal(resultado.grilla[0].length, 10, 'cada fila debe tener 10 columnas');

  // Verificar que todas las celdas estén rellenas con letras
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const letra = resultado.grilla[r][c];
      assert.ok(typeof letra === 'string' && letra.length === 1, `Celda [${r}][${c}] debe tener una letra`);
    }
  }

  // Verificar ubicaciones
  assert.ok(Array.isArray(resultado.ubicaciones), 'ubicaciones debe ser un arreglo');
  assert.ok(resultado.ubicaciones.length > 0, 'Debe haber colocado palabras');

  for (const ub of resultado.ubicaciones) {
    assert.ok(ub.palabra, 'Cada ubicación debe tener la palabra');
    assert.ok(Array.isArray(ub.celdas), 'Debe incluir lista de celdas');
    // Verificar que la palabra esté efectivamente en la grilla en esas celdas
    const leida = ub.celdas.map(p => resultado.grilla[p.r][p.c]).join('');
    assert.equal(leida, ub.palabra, `La palabra ${ub.palabra} debe coincidir con las celdas en la grilla`);
  }
});

test('3. generarSopa descarta palabras que no caben y tolera diagonales e invertidas', async () => {
  const { generarSopa } = await import('../publico/js/modulos/sopa-letras.js');

  // Palabra que excede el tamaño (15 letras en grilla de 10)
  const palabras = ['PALABRADEMASIADOLARGAQUENOCABE', 'HERIDA'];
  const res = generarSopa(palabras, 10, [[0, 1], [1, 0]]);

  const ubicaciones = res.ubicaciones.map(u => u.palabra);
  assert.ok(!ubicaciones.includes('PALABRADEMASIADOLARGAQUENOCABE'), 'Debe descartar palabras que excedan el tamaño');
  assert.ok(ubicaciones.includes('HERIDA'), 'Debe colocar la palabra que sí cabe');

  // Con todas las direcciones (diagonales e invertidas)
  const resDificil = generarSopa(['FIEBRE', 'SEPSIS', 'TEJIDO'], 12, [
    [0, 1], [1, 0], [1, 1], [-1, 1],
    [0, -1], [-1, 0], [1, -1], [-1, -1]
  ]);
  assert.ok(resDificil.ubicaciones.length > 0, 'Debe colocar palabras con direcciones múltiples');
});

test('4. Integridad de archivos de interfaz: sopa-letras.html, sopa-letras.css y sopa-letras.js', async () => {
  const html = await fs.readFile(path.join(RAIZ, 'publico/paginas/sopa-letras.html'), 'utf8');
  assert.ok(html.includes('/css/modulos/sopa-letras.css'), 'sopa-letras.html debe enlazar su CSS');
  assert.ok(html.includes('/js/modulos/sopa-letras.js'), 'sopa-letras.html debe cargar su JS');

  const css = await fs.readFile(path.join(RAIZ, 'publico/css/modulos/sopa-letras.css'), 'utf8');
  assert.ok(css.includes('touch-action: none'), 'sopa-letras.css debe incluir touch-action: none');
  assert.ok(css.includes('.sopa-celda'), 'sopa-letras.css debe definir .sopa-celda');
  assert.ok(css.includes('.celda--resaltada'), 'sopa-letras.css debe definir .celda--resaltada');
  assert.ok(css.includes('.celda--encontrada'), 'sopa-letras.css debe definir .celda--encontrada');

  const js = await fs.readFile(path.join(RAIZ, 'publico/js/modulos/sopa-letras.js'), 'utf8');
  assert.ok(js.includes('obtenerTemaActividad'), 'sopa-letras.js debe usar obtenerTemaActividad');
  assert.ok(js.includes('mostrarRetro'), 'sopa-letras.js debe llamar a mostrarRetro');
  assert.ok(js.includes('mostrarResumen'), 'sopa-letras.js debe llamar a mostrarResumen');
  assert.ok(js.includes('registrarIntento'), 'sopa-letras.js debe llamar a registrarIntento');
  assert.ok(js.includes('pointerdown'), 'sopa-letras.js debe usar Pointer Events');
  assert.ok(js.includes('btn-rendirse'), 'sopa-letras.js debe incluir botón de rendirse');
});
