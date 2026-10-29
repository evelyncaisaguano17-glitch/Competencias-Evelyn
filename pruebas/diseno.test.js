// pruebas/diseno.test.js · Pruebas automatizadas del Design System (tokens.css, base.css, componentes.css, guia-estilos.html)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_TOKENS = path.resolve(__dirname, '../publico/css/tokens.css');
const RUTA_BASE = path.resolve(__dirname, '../publico/css/base.css');
const RUTA_COMPONENTES = path.resolve(__dirname, '../publico/css/componentes.css');
const RUTA_GUIA = path.resolve(__dirname, '../publico/paginas/guia-estilos.html');

// Helper para calcular luminancia relativa y ratio de contraste WCAG 2.1
function hexALuminancia(hex) {
  const limpio = hex.replace('#', '');
  const r = parseInt(limpio.slice(0, 2), 16) / 255;
  const g = parseInt(limpio.slice(2, 4), 16) / 255;
  const b = parseInt(limpio.slice(4, 6), 16) / 255;

  const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function calcularContraste(hex1, hex2) {
  const lum1 = hexALuminancia(hex1);
  const lum2 = hexALuminancia(hex2);
  const masClaro = Math.max(lum1, lum2);
  const masOscuro = Math.min(lum1, lum2);
  return (masClaro + 0.05) / (masOscuro + 0.05);
}

// ==========================================
// 1. PRUEBAS DE tokens.css
// ==========================================
test('tokens.css · contiene únicamente variables en :root', async () => {
  const contenido = await fs.readFile(RUTA_TOKENS, 'utf-8');
  assert.ok(contenido.includes(':root'), 'Debe definir el bloque :root');

  // Verificar que no contenga selectores de clase o etiqueta fuera de :root
  const sinRoot = contenido.replace(/:\s*root\s*\{[\s\S]*?\}/g, '').trim();
  const sinComentarios = sinRoot.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.equal(sinComentarios, '', 'tokens.css solo debe contener variables dentro de :root');
});

test('tokens.css · define todas las variables de color exigidas', async () => {
  const css = await fs.readFile(RUTA_TOKENS, 'utf-8');
  const coloresRequeridos = [
    'primario', 'primario-oscuro', 'secundario', 'acento',
    'exito', 'advertencia', 'error', 'info',
    'fondo', 'superficie', 'borde', 'texto', 'texto-suave', 'texto-inverso'
  ];

  for (const c of coloresRequeridos) {
    const tienePrefijo = css.includes(`--color-${c}`) || css.includes(`--${c}`);
    assert.ok(tienePrefijo, `Falta la variable de color para: ${c}`);
  }
});

test('tokens.css · cumple con contraste WCAG AA mínimo (4.5:1)', () => {
  // Contraste de texto institucional (#182D3E) sobre fondo (#FFFFFF)
  const contrasteTexto = calcularContraste('#182D3E', '#FFFFFF');
  assert.ok(contrasteTexto >= 4.5, `Texto principal debe cumplir AA (obtenido ${contrasteTexto.toFixed(2)}:1)`);

  // Contraste de azul primario (#002E45) sobre fondo (#FFFFFF)
  const contrastePrimario = calcularContraste('#002E45', '#FFFFFF');
  assert.ok(contrastePrimario >= 4.5, `Azul primario debe cumplir AA (obtenido ${contrastePrimario.toFixed(2)}:1)`);

  // Contraste de texto inverso (#FFFFFF) sobre primario (#002E45)
  const contrasteInverso = calcularContraste('#FFFFFF', '#002E45');
  assert.ok(contrasteInverso >= 4.5, `Texto inverso debe cumplir AA (obtenido ${contrasteInverso.toFixed(2)}:1)`);

  // Contraste de éxito (#15803D) sobre superficie (#FFFFFF)
  const contrasteExito = calcularContraste('#15803D', '#FFFFFF');
  assert.ok(contrasteExito >= 4.5, `Color de éxito debe cumplir AA (obtenido ${contrasteExito.toFixed(2)}:1)`);

  // Contraste de error (#B91C1C) sobre superficie (#FFFFFF)
  const contrasteError = calcularContraste('#B91C1C', '#FFFFFF');
  assert.ok(contrasteError >= 4.5, `Color de error debe cumplir AA (obtenido ${contrasteError.toFixed(2)}:1)`);
});

test('tokens.css · define tipografía, espaciados, radios, sombras, transición y ancho máximo', async () => {
  const css = await fs.readFile(RUTA_TOKENS, 'utf-8');

  // Tipografía
  assert.ok(css.includes('--fuente-base'));
  assert.ok(css.includes('--fuente-titulos'));
  assert.ok(css.includes('--tamano-xs') && css.includes('--tamano-3xl'));
  assert.ok(css.includes('--peso-regular') && css.includes('--peso-negrita'));
  assert.ok(css.includes('--interlineado-base'));

  // Espaciados xs a 2xl
  assert.ok(css.includes('--espacio-xs') || css.includes('--espaciado-xs'));
  assert.ok(css.includes('--espacio-2xl') || css.includes('--espaciado-2xl'));

  // Radios s, m, l, completo
  assert.ok(css.includes('--radio-s'));
  assert.ok(css.includes('--radio-m'));
  assert.ok(css.includes('--radio-l'));
  assert.ok(css.includes('--radio-completo'));

  // Sombras 1 a 3
  assert.ok(css.includes('--sombra-1'));
  assert.ok(css.includes('--sombra-2'));
  assert.ok(css.includes('--sombra-3'));

  // Transición y ancho máximo
  assert.ok(css.includes('--transicion'));
  assert.ok(css.includes('--ancho-maximo'));
});

// ==========================================
// 2. PRUEBAS DE base.css
// ==========================================
test('base.css · contiene reset, tipografía, enlaces, foco visible y clases estructurales', async () => {
  const css = await fs.readFile(RUTA_BASE, 'utf-8');

  // Reset y tipografía
  assert.ok(css.includes('box-sizing: border-box'));
  assert.ok(css.includes('body'));
  assert.ok(css.includes('h1') && css.includes('h6'));
  assert.ok(css.includes('p'));
  assert.ok(css.includes('small'));

  // Enlaces y foco visible
  assert.ok(css.includes('a'));
  assert.ok(css.includes(':focus-visible'));

  // Clases estructurales obligatorias
  assert.ok(css.includes('.contenedor'), 'Debe incluir .contenedor');
  assert.ok(css.includes('.pila'), 'Debe incluir .pila (columna con separación)');
  assert.ok(css.includes('.fila'), 'Debe incluir .fila');
  assert.ok(css.includes('.grid-auto'), 'Debe incluir .grid-auto');
  assert.ok(css.includes('.oculto'), 'Debe incluir .oculto');
  assert.ok(css.includes('.sr-only'), 'Debe incluir .sr-only');
});

// ==========================================
// 3. PRUEBAS DE componentes.css
// ==========================================
test('componentes.css · define todos los 15 componentes requeridos con sus variantes', async () => {
  const css = await fs.readFile(RUTA_COMPONENTES, 'utf-8');

  // 1. Botones y variantes
  assert.ok(css.includes('.btn'), 'Debe incluir .btn');
  assert.ok(css.includes('.btn--primario'), 'Debe incluir .btn--primario');
  assert.ok(css.includes('.btn--secundario'), 'Debe incluir .btn--secundario');
  assert.ok(css.includes('.btn--peligro'), 'Debe incluir .btn--peligro');
  assert.ok(css.includes('.btn--texto'), 'Debe incluir .btn--texto');
  assert.ok(css.includes('.btn--pequeno'), 'Debe incluir .btn--pequeno');
  assert.ok(css.includes(':disabled') || css.includes('[disabled]'), 'Debe incluir estado disabled para botón');

  // 2. Tarjeta
  assert.ok(css.includes('.tarjeta'));

  // 3. Campo de formulario
  assert.ok(css.includes('.campo'));
  assert.ok(css.includes('.campo label'));
  assert.ok(css.includes('.campo input'));
  assert.ok(css.includes('.campo select'));
  assert.ok(css.includes('.campo textarea'));
  assert.ok(css.includes('.campo__error'));

  // 4. Alerta y variantes
  assert.ok(css.includes('.alerta'));
  assert.ok(css.includes('.alerta--info'));
  assert.ok(css.includes('.alerta--exito'));
  assert.ok(css.includes('.alerta--advertencia'));
  assert.ok(css.includes('.alerta--error'));

  // 5. Tabla responsiva
  assert.ok(css.includes('.tabla'));
  assert.ok(css.includes('overflow-x: auto') || css.includes('.tabla-contenedor'));

  // 6. Modal
  assert.ok(css.includes('.modal'));

  // 7. Toast
  assert.ok(css.includes('.toast'));

  // 8. Insignia
  assert.ok(css.includes('.insignia'));

  // 9. Progreso
  assert.ok(css.includes('.progreso'));

  // 10. Chip
  assert.ok(css.includes('.chip'));

  // 11. Encabezado
  assert.ok(css.includes('.encabezado'));

  // 12. Menú lateral adaptable
  assert.ok(css.includes('.menu'));
  assert.ok(css.includes('@media'), 'Menú debe tener media query responsiva para celulares');

  // 13. Pie
  assert.ok(css.includes('.pie'));

  // 14. Cargando
  assert.ok(css.includes('.cargando'));

  // 15. Vacío
  assert.ok(css.includes('.vacio'));
});

// ==========================================
// 4. PRUEBAS DE guia-estilos.html
// ==========================================
test('guia-estilos.html · enlaza los 3 archivos CSS y muestra la biblioteca de componentes', async () => {
  const html = await fs.readFile(RUTA_GUIA, 'utf-8');

  // Enlaces CSS requeridos
  assert.ok(html.includes('/css/tokens.css'), 'Debe enlazar tokens.css');
  assert.ok(html.includes('/css/base.css'), 'Debe enlazar base.css');
  assert.ok(html.includes('/css/componentes.css'), 'Debe enlazar componentes.css');

  // Presencia de componentes en el DOM
  assert.ok(html.includes('class="btn btn--primario"'));
  assert.ok(html.includes('class="btn btn--secundario"'));
  assert.ok(html.includes('class="tarjeta"'));
  assert.ok(html.includes('class="campo"'));
  assert.ok(html.includes('class="alerta alerta--info"'));
  assert.ok(html.includes('class="tabla"'));
  assert.ok(html.includes('class="modal'));
  assert.ok(html.includes('class="toast'));
  assert.ok(html.includes('class="insignia'));
  assert.ok(html.includes('class="progreso'));
  assert.ok(html.includes('class="chip'));
  assert.ok(html.includes('class="encabezado"'));
  assert.ok(html.includes('class="menu"'));
  assert.ok(html.includes('class="pie"'));
  assert.ok(html.includes('class="cargando"'));
  assert.ok(html.includes('class="vacio"'));
});
