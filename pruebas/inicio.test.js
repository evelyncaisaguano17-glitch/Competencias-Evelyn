// pruebas/inicio.test.js · Pruebas para Tarea P03.3 (Página de inicio pública y privada)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. index.html · Estructura, enlaces CSS y módulo JS', () => {
  const indexPath = path.join(raiz, 'publico', 'index.html');
  assert.ok(fs.existsSync(indexPath), 'publico/index.html debe existir');

  const html = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(html.includes('id="plantilla"'), 'index.html debe contener #plantilla');
  assert.ok(html.includes('id="contenido"'), 'index.html debe contener #contenido');
  assert.ok(html.includes('/css/tokens.css'), 'index.html debe enlazar tokens.css');
  assert.ok(html.includes('/css/base.css'), 'index.html debe enlazar base.css');
  assert.ok(html.includes('/css/componentes.css'), 'index.html debe enlazar componentes.css');
  assert.ok(html.includes('/css/modulos/inicio.css'), 'index.html debe enlazar inicio.css');
  assert.ok(html.includes('/js/modulos/inicio.js'), 'index.html debe enlazar inicio.js');
});

test('2. inicio.js · Integridad y dependencias requeridas', () => {
  const inicioJsPath = path.join(raiz, 'publico', 'js', 'modulos', 'inicio.js');
  assert.ok(fs.existsSync(inicioJsPath), 'publico/js/modulos/inicio.js debe existir');

  const codigo = fs.readFileSync(inicioJsPath, 'utf-8');
  assert.ok(codigo.includes('calcularAvance'), 'inicio.js debe importar o usar calcularAvance');
  assert.ok(codigo.includes('ultimoTema'), 'inicio.js debe consultar ultimoTema en localStorage');
  assert.ok(codigo.includes('Continuar donde te quedaste'), 'inicio.js debe contemplar bloque Continuar donde te quedaste');
  assert.ok(codigo.includes('Ingresar'), 'inicio.js debe contemplar botón Ingresar para vista pública');
  assert.ok(codigo.includes('Registrarse'), 'inicio.js debe contemplar botón Registrarse para vista pública');
  assert.ok(codigo.includes('editor-contenidos'), 'inicio.js debe contemplar acceso rápido a contenidos para docentes/admin');
});

test('3. inicio.css · Estilos de cuadrículas, barras de progreso y tarjetas', () => {
  const inicioCssPath = path.join(raiz, 'publico', 'css', 'modulos', 'inicio.css');
  assert.ok(fs.existsSync(inicioCssPath), 'publico/css/modulos/inicio.css debe existir');

  const css = fs.readFileSync(inicioCssPath, 'utf-8');
  assert.ok(css.includes('.inicio-hero'), 'inicio.css debe definir .inicio-hero');
  assert.ok(css.includes('.inicio-asignaturas-grid'), 'inicio.css debe definir .inicio-asignaturas-grid');
  assert.ok(css.includes('.barra-progreso'), 'inicio.css debe definir .barra-progreso');
  assert.ok(css.includes('.inicio-noticias-grid'), 'inicio.css debe definir .inicio-noticias-grid');
});
