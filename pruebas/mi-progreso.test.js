// pruebas/mi-progreso.test.js · Pruebas para el panel del estudiante (Tarea P06.2)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU } from '../publico/js/nucleo/menu.js';
import { formatearActividad } from '../publico/js/modulos/mi-progreso.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. Integridad de archivos de interfaz: mi-progreso.html, mi-progreso.css y mi-progreso.js', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/mi-progreso.html');
  const rutaCss = path.join(raiz, 'publico/css/modulos/mi-progreso.css');
  const rutaJs = path.join(raiz, 'publico/js/modulos/mi-progreso.js');

  assert.ok(fs.existsSync(rutaHtml), 'mi-progreso.html debe existir');
  assert.ok(fs.existsSync(rutaCss), 'mi-progreso.css debe existir');
  assert.ok(fs.existsSync(rutaJs), 'mi-progreso.js debe existir');

  const html = fs.readFileSync(rutaHtml, 'utf8');
  assert.ok(html.includes('/css/tokens.css'), 'Debe enlazar tokens.css');
  assert.ok(html.includes('/css/base.css'), 'Debe enlazar base.css');
  assert.ok(html.includes('/css/componentes.css'), 'Debe enlazar componentes.css');
  assert.ok(html.includes('/css/modulos/mi-progreso.css'), 'Debe enlazar mi-progreso.css');
  assert.ok(html.includes('chart'), 'Debe incluir script de Chart.js desde CDN');
  assert.ok(html.includes('/js/modulos/mi-progreso.js'), 'Debe cargar mi-progreso.js');
});

test('2. menu.js · Contiene el enlace a Mi progreso para estudiantes', () => {
  const item = MENU.find(m => m.href === '/paginas/mi-progreso.html');
  assert.ok(item, 'MENU debe contener un elemento con href /paginas/mi-progreso.html');
  assert.equal(item.texto, 'Mi progreso');
  assert.deepEqual(item.roles, ['estudiante']);
});

test('3. mi-progreso.js · Lógica de panel, tarjetas, gráficos y pendientes', () => {
  const js = fs.readFileSync(path.join(raiz, 'publico/js/modulos/mi-progreso.js'), 'utf8');

  // Rol estudiante
  assert.ok(js.includes('roles: ["estudiante"]') || js.includes("roles: ['estudiante']"), 'Debe exigir rol estudiante');

  // Consulta API
  assert.ok(js.includes('/api/resumen/estudiante/yo'), 'Debe consultar /api/resumen/estudiante/yo');

  // Tarjetas y elementos
  assert.ok(js.includes('kpi-tarjeta'), 'Debe incluir tarjetas KPI');
  assert.ok(js.includes('puntos'), 'Debe mostrar puntos');
  assert.ok(js.includes('nivelQuizMax'), 'Debe mostrar nivel de quiz');
  assert.ok(js.includes('pctTemas'), 'Debe mostrar porcentaje de temas revisados');
  assert.ok(js.includes('promedio'), 'Debe mostrar promedio sobre 10');

  // Gráficos y Chart.js
  assert.ok(js.includes('grafico-evolucion'), 'Debe incluir canvas de evolución');
  assert.ok(js.includes('grafico-actividad'), 'Debe incluir canvas de actividad');
  assert.ok(js.includes('getPropertyValue'), 'Debe leer colores de tokens.css');

  // Lista de pendientes y enlace
  assert.ok(js.includes('pendientes'), 'Debe procesar lista de pendientes');
  assert.ok(js.includes('/paginas/tema.html?id='), 'Debe enlazar a cada tema pendiente');
  assert.ok(js.includes('vacio'), 'Debe contemplar estado .vacio');

  // Helper formatearActividad
  assert.equal(formatearActividad('ahorcado'), 'Ahorcado');
  assert.equal(formatearActividad('sopa-letras'), 'Sopa de letras');
  assert.equal(formatearActividad('pareja'), 'Encuentra la pareja');
});

test('4. mi-progreso.css · Estilos con tokens de diseño', () => {
  const css = fs.readFileSync(path.join(raiz, 'publico/css/modulos/mi-progreso.css'), 'utf8');

  assert.ok(css.includes('.progreso-kpis'), 'Debe definir .progreso-kpis');
  assert.ok(css.includes('.kpi-tarjeta'), 'Debe definir .kpi-tarjeta');
  assert.ok(css.includes('.graficos-grid'), 'Debe definir .graficos-grid');
  assert.ok(css.includes('.pendientes-lista'), 'Debe definir .pendientes-lista');
  assert.ok(css.includes('var(--color-primario)'), 'Debe usar tokens CSS de color');
  assert.ok(css.includes('var(--espacio-'), 'Debe usar tokens CSS de espaciado');
});
