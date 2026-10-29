// pruebas/plantilla.test.js · Pruebas para Tarea P00.4 (menu, plantilla, páginas y diseño)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

// Entorno simulado ligero para probar montarPlantilla en Node
function setupDOMSimulado(pathname = '/index.html') {
  const document = {
    title: '',
    body: {
      children: [],
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector(selector) {
        if (selector === 'footer.pie') {
          return this.children.find(c => c.className?.includes('pie')) || null;
        }
        return null;
      }
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        querySelector(selector) {
          if (selector === 'p') {
            return { textContent: '' };
          }
          return null;
        }
      };
    },
    getElementById(id) {
      if (id === 'plantilla') return elPlantilla;
      if (id === 'btn-menu-movil') return elBtnMovil;
      if (id === 'menu-lateral') return elMenuLateral;
      return null;
    },
    querySelector(selector) {
      return this.body.querySelector(selector);
    },
    addEventListener() {}
  };

  const listeners = {};
  const elBtnMovil = {
    id: 'btn-menu-movil',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener(ev, fn) {
      listeners[ev] = fn;
    },
    click() {
      if (listeners['click']) listeners['click']({ stopPropagation() {} });
    }
  };

  const elMenuLateral = {
    id: 'menu-lateral',
    classList: {
      clases: new Set(['menu']),
      toggle(cls) {
        if (this.clases.has(cls)) {
          this.clases.delete(cls);
          return false;
        } else {
          this.clases.add(cls);
          return true;
        }
      },
      contains(cls) {
        return this.clases.has(cls);
      },
      remove(cls) {
        this.clases.delete(cls);
      }
    },
    contains() { return false; }
  };

  const elPlantilla = {
    id: 'plantilla',
    innerHTML: ''
  };

  const window = {
    location: {
      pathname
    }
  };

  const sessionStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };

  globalThis.document = document;
  globalThis.window = window;
  globalThis.sessionStorage = sessionStorage;

  return { document, window, elPlantilla, elBtnMovil, elMenuLateral };
}

test('1. menu.js exporta la lista de menú requerida', async () => {
  const { MENU } = await import('../publico/js/nucleo/menu.js');
  assert.ok(Array.isArray(MENU), 'MENU debe ser un array');
  assert.equal(MENU.length, 13, 'MENU debe contener 13 elementos');

  assert.deepEqual(MENU[0], { texto: 'Inicio', href: '/index.html', roles: ['publico'] });
  assert.deepEqual(MENU[1], { texto: 'Mi perfil', href: '/paginas/perfil.html', roles: ['sesion'] });
  assert.deepEqual(MENU[2], { texto: 'Usuarios', href: '/paginas/admin-usuarios.html', roles: ['admin'] });
  assert.deepEqual(MENU[3], { texto: 'Asignaturas', href: '/paginas/admin-asignaturas.html', roles: ['admin'] });
  assert.deepEqual(MENU[4], { texto: 'Distributivo', href: '/paginas/distributivo.html', roles: ['admin'] });
  assert.deepEqual(MENU[5], { texto: 'Contenidos', href: '/paginas/editor-contenidos.html', roles: ['docente', 'admin'] });
  assert.deepEqual(MENU[6], { texto: 'Mis asignaturas', href: '/paginas/asignaturas.html', roles: ['estudiante', 'docente'] });
  assert.deepEqual(MENU[7], { texto: 'Actividades', href: '/paginas/actividades.html', roles: ['estudiante', 'docente'] });
  assert.deepEqual(MENU[8], { texto: 'Noticias', href: '/paginas/noticias.html', roles: ['sesion'] });
  assert.deepEqual(MENU[9], { texto: 'Canciones', href: '/paginas/canciones.html', roles: ['sesion'] });
  assert.deepEqual(MENU[10], { texto: 'Mi progreso', href: '/paginas/mi-progreso.html', roles: ['estudiante'] });
  assert.deepEqual(MENU[11], { texto: 'Panel docente', href: '/paginas/panel-docente.html', roles: ['docente', 'admin'] });
  assert.deepEqual(MENU[12], { texto: 'Banco de preguntas', href: '/paginas/banco-preguntas.html', roles: ['docente', 'admin'] });
});



test('2. plantilla.js define NOMBRE y montarPlantilla según el contrato', async () => {
  const { NOMBRE, montarPlantilla } = await import('../publico/js/nucleo/plantilla.js');
  assert.equal(NOMBRE, 'Ecosistema Educativo');
  assert.equal(typeof montarPlantilla, 'function');

  // Simular página de inicio
  const { document, elPlantilla, elBtnMovil, elMenuLateral } = setupDOMSimulado('/index.html');
  await montarPlantilla({ titulo: 'Inicio' });

  // Comprobar título del documento
  assert.equal(document.title, 'Inicio · Ecosistema Educativo');

  // Comprobar contenido inyectado en #plantilla
  assert.ok(elPlantilla.innerHTML.includes('Ecosistema Educativo'), 'Debe incluir el nombre del sistema');
  assert.ok(elPlantilla.innerHTML.includes('Inicio'), 'Debe incluir el título de la página');
  assert.ok(elPlantilla.innerHTML.includes('btn-menu-movil'), 'Debe incluir el botón de menú móvil');
  assert.ok(elPlantilla.innerHTML.includes('menu-lateral'), 'Debe incluir el menú lateral');
  assert.ok(elPlantilla.innerHTML.includes('aria-current="page"'), 'Debe marcar la página activa');

  // Comprobar botón móvil
  assert.equal(elMenuLateral.classList.contains('menu--abierto'), false);
  elBtnMovil.click();
  assert.equal(elMenuLateral.classList.contains('menu--abierto'), true);
  assert.equal(elBtnMovil.getAttribute('aria-expanded'), 'true');
  elBtnMovil.click();
  assert.equal(elMenuLateral.classList.contains('menu--abierto'), false);
  assert.equal(elBtnMovil.getAttribute('aria-expanded'), 'false');

  // Comprobar pie al final del body
  const pie = document.body.children.find(c => c.className?.includes('pie'));
  assert.ok(pie, 'Debe haber insertado un pie en body');
  const anioActual = String(new Date().getFullYear());
  assert.ok(pie.innerHTML.includes(anioActual), 'El pie debe contener el año actual');
  assert.ok(pie.innerHTML.includes('Ecosistema Educativo'), 'El pie debe contener el nombre de la plataforma');
});

test('3. base.css incluye las reglas del diseño general (layout)', () => {
  const baseCss = fs.readFileSync(path.join(raiz, 'publico', 'css', 'base.css'), 'utf-8');

  assert.ok(baseCss.includes('#plantilla'), 'Debe incluir estilo para #plantilla');
  assert.ok(baseCss.includes('grid-template-areas'), 'Debe definir cuadrícula del diseño general');
  assert.ok(baseCss.includes('encabezado'), 'Debe posicionar encabezado');
  assert.ok(baseCss.includes('menu'), 'Debe posicionar menu');
  assert.ok(baseCss.includes('#contenido'), 'Debe posicionar #contenido');
  assert.ok(baseCss.includes('pie'), 'Debe posicionar pie');
  assert.ok(baseCss.includes('@media (max-width: 768px)'), 'Debe incluir media query a 768px');
  assert.ok(baseCss.includes('.menu--abierto'), 'Debe soportar menu abierto');
});

test('4. index.html y módulo inicio existen y siguen las reglas', () => {
  const indexPath = path.join(raiz, 'publico', 'index.html');
  const inicioCssPath = path.join(raiz, 'publico', 'css', 'modulos', 'inicio.css');
  const inicioJsPath = path.join(raiz, 'publico', 'js', 'modulos', 'inicio.js');

  assert.ok(fs.existsSync(indexPath), 'publico/index.html debe existir');
  assert.ok(fs.existsSync(inicioCssPath), 'publico/css/modulos/inicio.css debe existir');
  assert.ok(fs.existsSync(inicioJsPath), 'publico/js/modulos/inicio.js debe existir');

  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(indexHtml.includes('id="plantilla"'), 'index.html debe contener #plantilla');
  assert.ok(indexHtml.includes('id="contenido"'), 'index.html debe contener #contenido');
  assert.ok(indexHtml.includes('/js/modulos/inicio.js'), 'index.html debe enlazar inicio.js');

  const inicioJs = fs.readFileSync(inicioJsPath, 'utf-8');
  assert.ok(inicioJs.includes('montarPlantilla'), 'inicio.js debe llamar a montarPlantilla');
});

test('5. prueba-datos.html y módulo prueba-datos existen y siguen el contrato', () => {
  const pruebaHtmlPath = path.join(raiz, 'publico', 'paginas', 'prueba-datos.html');
  const pruebaCssPath = path.join(raiz, 'publico', 'css', 'modulos', 'prueba-datos.css');
  const pruebaJsPath = path.join(raiz, 'publico', 'js', 'modulos', 'prueba-datos.js');

  assert.ok(fs.existsSync(pruebaHtmlPath), 'prueba-datos.html debe existir');
  assert.ok(fs.existsSync(pruebaCssPath), 'prueba-datos.css debe existir');
  assert.ok(fs.existsSync(pruebaJsPath), 'prueba-datos.js debe existir');

  const pruebaHtml = fs.readFileSync(pruebaHtmlPath, 'utf-8');
  assert.ok(pruebaHtml.includes('id="plantilla"'), 'prueba-datos.html debe contener #plantilla');
  assert.ok(pruebaHtml.includes('id="contenido"'), 'prueba-datos.html debe contener #contenido');
  assert.ok(pruebaHtml.includes('/js/modulos/prueba-datos.js'), 'prueba-datos.html debe enlazar prueba-datos.js');

  const pruebaJs = fs.readFileSync(pruebaJsPath, 'utf-8');
  assert.ok(pruebaJs.includes('montarPlantilla'), 'prueba-datos.js debe llamar a montarPlantilla');
  assert.ok(pruebaJs.includes('api.crear'), 'prueba-datos.js debe invocar api.crear');
  assert.ok(pruebaJs.includes('api.listar'), 'prueba-datos.js debe invocar api.listar');
  assert.ok(pruebaJs.includes('ui.aviso'), 'prueba-datos.js debe invocar ui.aviso');
});
