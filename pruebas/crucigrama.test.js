// pruebas/crucigrama.test.js · Pruebas unitarias para Tarea P07.3 (Crucigrama)
import test from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVIDADES } from '../publico/js/nucleo/catalogo-actividades.js';
import { generarCrucigrama } from '../publico/js/modulos/crucigrama.js';
import * as util from '../publico/js/nucleo/util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. catalogo-actividades.js · Contiene actividad crucigrama', () => {
  const crucigrama = ACTIVIDADES.find((a) => a.id === 'crucigrama');
  assert.ok(crucigrama, 'Debe existir la actividad crucigrama en ACTIVIDADES');
  assert.equal(crucigrama.texto, 'Crucigrama');
  assert.equal(crucigrama.descripcion, 'Completa las palabras con sus pistas');
  assert.equal(crucigrama.href, '/paginas/crucigrama.html');
});

test('2. Integridad de archivos de interfaz: crucigrama.html, crucigrama.css y crucigrama.js', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/crucigrama.html');
  const rutaCss = path.join(raiz, 'publico/css/modulos/crucigrama.css');
  const rutaJs = path.join(raiz, 'publico/js/modulos/crucigrama.js');

  assert.ok(fsSync.existsSync(rutaHtml), 'crucigrama.html debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'crucigrama.css debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'crucigrama.js debe existir');

  const html = fsSync.readFileSync(rutaHtml, 'utf-8');
  assert.ok(html.includes('/css/tokens.css'), 'HTML debe incluir tokens.css');
  assert.ok(html.includes('/css/base.css'), 'HTML debe incluir base.css');
  assert.ok(html.includes('/css/componentes.css'), 'HTML debe incluir componentes.css');
  assert.ok(html.includes('/css/modulos/crucigrama.css'), 'HTML debe incluir crucigrama.css');
  assert.ok(html.includes('/js/modulos/crucigrama.js'), 'HTML debe incluir crucigrama.js');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: [\'estudiante\', \'docente\', \'admin\']') || js.includes('roles: ["estudiante", "docente", "admin"]'), 'Debe admitir estudiante, docente y admin');
  assert.ok(js.includes('obtenerTemaActividad'), 'Debe invocar obtenerTemaActividad()');
  assert.ok(js.includes('export function generarCrucigrama'), 'Debe exportar generarCrucigrama');
  assert.ok(js.includes('mostrarRetro'), 'Debe invocar mostrarRetro()');
  assert.ok(js.includes('mostrarResumen'), 'Debe invocar mostrarResumen()');
  assert.ok(js.includes('registrarIntento'), 'Debe invocar registrarIntento()');
  assert.ok(js.includes('actividad: \'crucigrama\'') || js.includes('actividad: "crucigrama"'), 'Debe registrar con actividad crucigrama');
});

test('3. Función pura generarCrucigrama · Generación de cuadrícula y numeración', () => {
  const palabrasPrueba = [
    { termino: 'SUTURA', pista: 'Cierre de tejidos' },
    { termino: 'ASEPSIA', pista: 'Ausencia de gérmenes' },
    { termino: 'HERIDA', pista: 'Lesión dérmica' },
    { termino: 'DRENAJE', pista: 'Evacuar líquidos' },
    { termino: 'HEMOSTASIA', pista: 'Detención del sangrado' },
    { termino: 'LAVADO', pista: 'Limpieza de zona' },
    { termino: 'PARCHE', pista: 'Apósito protector' },
    { termino: 'CURADO', pista: 'Tratamiento de lesión' },
    { termino: 'SEROMA', pista: 'Acumulación serosa' },
    { termino: 'PUNTOS', pista: 'Hilos anudados' }
  ];

  const resultado = generarCrucigrama(palabrasPrueba);

  assert.ok(resultado, 'El resultado no debe ser nulo');
  assert.ok(resultado.filas > 0, 'Debe tener al menos 1 fila');
  assert.ok(resultado.columnas > 0, 'Debe tener al menos 1 columna');
  assert.ok(Array.isArray(resultado.entradas), 'Debe devolver un arreglo de entradas');
  assert.ok(resultado.entradas.length >= 2, 'Debe haber colocado al menos 2 palabras');

  // Verificar estructura de cada entrada
  for (const entrada of resultado.entradas) {
    assert.ok(typeof entrada.numero === 'number' && entrada.numero >= 1, 'Cada entrada debe tener número >= 1');
    assert.ok(typeof entrada.palabra === 'string' && entrada.palabra.length >= 3, 'Palabra debe ser string válido');
    assert.ok(typeof entrada.pista === 'string', 'Pista debe ser string');
    assert.ok(typeof entrada.fila === 'number' && entrada.fila >= 0 && entrada.fila < resultado.filas, 'Fila debe estar dentro de límites');
    assert.ok(typeof entrada.col === 'number' && entrada.col >= 0 && entrada.col < resultado.columnas, 'Col debe estar dentro de límites');
    assert.ok(entrada.direccion === 'horizontal' || entrada.direccion === 'vertical', 'Dirección debe ser horizontal o vertical');

    // Comprobar que cabe dentro de filas y columnas recortadas
    if (entrada.direccion === 'horizontal') {
      assert.ok(entrada.col + entrada.palabra.length <= resultado.columnas, 'Palabra horizontal no debe desbordar columnas');
    } else {
      assert.ok(entrada.fila + entrada.palabra.length <= resultado.filas, 'Palabra vertical no debe desbordar filas');
    }
  }

  // Verificar que la cuadrícula está recortada (al menos una celda toca fila 0, col 0, max fila y max col)
  let tocaFila0 = false;
  let tocaCol0 = false;
  let tocaMaxFila = false;
  let tocaMaxCol = false;

  for (const e of resultado.entradas) {
    if (e.fila === 0) tocaFila0 = true;
    if (e.col === 0) tocaCol0 = true;
    const finFila = e.direccion === 'vertical' ? e.fila + e.palabra.length - 1 : e.fila;
    const finCol = e.direccion === 'horizontal' ? e.col + e.palabra.length - 1 : e.col;
    if (finFila === resultado.filas - 1) tocaMaxFila = true;
    if (finCol === resultado.columnas - 1) tocaMaxCol = true;
  }

  assert.ok(tocaFila0, 'La cuadrícula debe estar recortada arriba (fila 0)');
  assert.ok(tocaCol0, 'La cuadrícula debe estar recortada a la izquierda (col 0)');
  assert.ok(tocaMaxFila, 'La cuadrícula debe estar recortada abajo');
  assert.ok(tocaMaxCol, 'La cuadrícula debe estar recortada a la derecha');
});

test('4. generarCrucigrama · Valida coherencia de cruces de letras entre palabras perpendiculares', () => {
  const palabrasPrueba = [
    { termino: 'ASEPSIA', pista: 'Pista 1' },
    { termino: 'SUTURA', pista: 'Pista 2' },
    { termino: 'DRENAJE', pista: 'Pista 3' },
    { termino: 'HERIDA', pista: 'Pista 4' },
    { termino: 'HEMOSTASIA', pista: 'Pista 5' }
  ];

  const resultado = generarCrucigrama(palabrasPrueba);
  const mapaLetras = new Map();

  for (const e of resultado.entradas) {
    for (let i = 0; i < e.palabra.length; i++) {
      const r = e.direccion === 'horizontal' ? e.fila : e.fila + i;
      const c = e.direccion === 'horizontal' ? e.col + i : e.col;
      const clave = `${r},${c}`;
      const letra = e.palabra[i];

      if (mapaLetras.has(clave)) {
        // En cruces la letra debe coincidir exactamente
        assert.equal(mapaLetras.get(clave), letra, `La celda (${r},${c}) en cruce debe tener la misma letra`);
      } else {
        mapaLetras.set(clave, letra);
      }
    }
  }
});

test('5. Crucigrama · Manejo de casos borde (sin palabras o una sola)', () => {
  const vacio = generarCrucigrama([]);
  assert.equal(vacio.filas, 0);
  assert.equal(vacio.columnas, 0);
  assert.equal(vacio.entradas.length, 0);

  const soloUna = generarCrucigrama(['CIRUGIA']);
  assert.equal(soloUna.filas, 1);
  assert.equal(soloUna.columnas, 7);
  assert.equal(soloUna.entradas.length, 1);
  assert.equal(soloUna.entradas[0].palabra, 'CIRUGIA');
  assert.equal(soloUna.entradas[0].direccion, 'horizontal');
});
