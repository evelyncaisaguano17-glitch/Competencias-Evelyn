// pruebas/perfil-logros.test.js · Pruebas para la vitrina de insignias y certificado de cumplimiento en el perfil
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. Integridad de archivos de vitrina y certificado en perfil', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/perfil.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/perfil.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/perfil.css');

  assert.ok(fs.existsSync(rutaHtml), 'perfil.html debe existir');
  assert.ok(fs.existsSync(rutaJs), 'perfil.js debe existir');
  assert.ok(fs.existsSync(rutaCss), 'perfil.css debe existir');

  const html = fs.readFileSync(rutaHtml, 'utf8');
  assert.ok(html.includes('id="logros"'), 'perfil.html debe incluir <section id="logros">');
  assert.ok(html.includes('/css/tokens.css'), 'perfil.html debe enlazar tokens.css');
  assert.ok(html.includes('/css/base.css'), 'perfil.html debe enlazar base.css');
  assert.ok(html.includes('/css/componentes.css'), 'perfil.html debe enlazar componentes.css');
  assert.ok(html.includes('/css/modulos/perfil.css'), 'perfil.html debe enlazar perfil.css');
  assert.ok(html.includes('/js/modulos/perfil.js'), 'perfil.html debe cargar perfil.js como módulo');
});

test('2. perfil.js · Lógica de puntos, insignias y certificados', () => {
  const js = fs.readFileSync(path.join(raiz, 'publico/js/modulos/perfil.js'), 'utf8');

  // Imports
  assert.ok(js.includes('logrosDe'), 'perfil.js debe importar logrosDe');
  assert.ok(js.includes('generarDiploma'), 'perfil.js debe importar generarDiploma');

  // Restricción a estudiantes
  assert.ok(
    js.includes('estudiante'),
    'perfil.js debe verificar que el usuario tenga rol de estudiante'
  );

  // Consulta de datos de gamificación
  assert.ok(
    js.includes("logrosDe('yo')") || js.includes('logrosDe("yo")'),
    'perfil.js debe llamar a logrosDe("yo")'
  );
  assert.ok(
    js.includes("api.listar('insignias')") || js.includes('api.listar("insignias")'),
    'perfil.js debe consultar las insignias disponibles con api.listar'
  );
  assert.ok(
    js.includes('/api/certificados/estado'),
    'perfil.js debe consultar el estado de cumplimiento en /api/certificados/estado'
  );

  // Barra de progreso y botón de descarga
  assert.ok(js.includes('progreso'), 'perfil.js debe renderizar barras con clase progreso');
  assert.ok(js.includes('btn-descargar-certificado'), 'perfil.js debe incluir botón con id btn-descargar-certificado');
  assert.ok(js.includes('Descargar certificado'), 'perfil.js debe contener texto "Descargar certificado"');
  assert.ok(
    js.includes("tipo: 'cumplimiento'") || js.includes('tipo: "cumplimiento"'),
    'perfil.js debe llamar a generarDiploma con tipo: "cumplimiento"'
  );
});

test('3. perfil.css · Estilos para insignias y certificado con variables CSS', () => {
  const css = fs.readFileSync(path.join(raiz, 'publico/css/modulos/perfil.css'), 'utf8');

  assert.ok(css.includes('.logros-seccion'), 'perfil.css debe definir .logros-seccion');
  assert.ok(css.includes('.logros-puntos-contenedor'), 'perfil.css debe definir .logros-puntos-contenedor');
  assert.ok(css.includes('.vitrina-grid'), 'perfil.css debe definir .vitrina-grid');
  assert.ok(css.includes('.insignia-card--obtenida'), 'perfil.css debe definir .insignia-card--obtenida');
  assert.ok(css.includes('.insignia-card--bloqueada'), 'perfil.css debe definir .insignia-card--bloqueada');
  assert.ok(css.includes('.certificado-contenedor'), 'perfil.css debe definir .certificado-contenedor');

  // Verificación de tokens y no colores fijos prohibidos
  assert.ok(css.includes('var(--color-primario)'), 'perfil.css debe usar tokens de color');
  assert.ok(css.includes('var(--espacio-'), 'perfil.css debe usar tokens de espaciado');
});
