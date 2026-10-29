// pruebas/sesion.test.js · Pruebas unitarias para sesion.js, bitacora.js, plantilla.js y páginas P01.2
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

function configurarEntornoSimulado({ token = null, usuario = null, pathname = '/index.html' } = {}) {
  const store = new Map();
  if (token) store.set('token', token);
  if (usuario) store.set('usuario', JSON.stringify(usuario));

  const sessionStorage = {
    getItem(k) { return store.get(k) || null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); }
  };

  const window = {
    location: {
      href: pathname,
      pathname
    }
  };

  const document = {
    title: '',
    body: {
      children: [],
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector() { return null; }
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        querySelector() { return null; }
      };
    },
    getElementById(id) {
      if (id === 'plantilla') return elPlantilla;
      if (id === 'btn-salir') return elBtnSalir;
      if (id === 'btn-menu-movil') return elBtnMovil;
      if (id === 'menu-lateral') return elMenuLateral;
      return null;
    },
    querySelector() { return null; },
    addEventListener() {}
  };

  const elBtnSalir = {
    id: 'btn-salir',
    listeners: {},
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
    async click() { if (this.listeners.click) await this.listeners.click(); }
  };

  const elBtnMovil = {
    id: 'btn-menu-movil',
    listeners: {},
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener(ev, fn) { this.listeners[ev] = fn; }
  };

  const elMenuLateral = {
    id: 'menu-lateral',
    classList: {
      clases: new Set(),
      toggle(c) {
        if (this.clases.has(c)) { this.clases.delete(c); return false; }
        this.clases.add(c); return true;
      },
      contains(c) { return this.clases.has(c); },
      remove(c) { this.clases.delete(c); }
    },
    contains() { return false; }
  };

  const elPlantilla = {
    id: 'plantilla',
    innerHTML: ''
  };

  globalThis.sessionStorage = sessionStorage;
  globalThis.window = window;
  globalThis.document = document;

  return { store, window, document, elPlantilla, elBtnSalir };
}

test('1. sesion.js · token(), usuarioActual() y exigirRol()', async (t) => {
  const sesion = await import('../publico/js/nucleo/sesion.js');

  await t.test('token() y usuarioActual() devuelven valores o null', () => {
    configurarEntornoSimulado();
    assert.equal(sesion.token(), null);
    assert.equal(sesion.usuarioActual(), null);

    configurarEntornoSimulado({
      token: 'tok-abc',
      usuario: { id: 'usr_01', nombre: 'Juan', apellido: 'Paz', rol: 'estudiante' }
    });
    assert.equal(sesion.token(), 'tok-abc');
    assert.deepEqual(sesion.usuarioActual(), {
      id: 'usr_01',
      nombre: 'Juan',
      apellido: 'Paz',
      rol: 'estudiante'
    });
  });

  await t.test('exigirRol() redirige a /paginas/ingreso.html sin sesión', () => {
    const { window } = configurarEntornoSimulado();
    sesion.exigirRol(['estudiante']);
    assert.equal(window.location.href, '/paginas/ingreso.html');
  });

  await t.test('exigirRol() permite acceso con rol correspondiente', () => {
    const { window } = configurarEntornoSimulado({
      token: 'tok-docente',
      usuario: { id: 'usr_02', nombre: 'Dra.', apellido: 'Alba', rol: 'docente' },
      pathname: '/paginas/docente.html'
    });
    sesion.exigirRol(['docente']);
    assert.equal(window.location.href, '/paginas/docente.html');
  });

  await t.test('exigirRol() redirige a /index.html con aviso si el rol no es permitido', () => {
    const { window, store } = configurarEntornoSimulado({
      token: 'tok-estudiante',
      usuario: { id: 'usr_03', nombre: 'Luis', apellido: 'Mora', rol: 'estudiante' },
      pathname: '/paginas/panel-admin.html'
    });
    sesion.exigirRol(['admin']);
    assert.equal(window.location.href, '/index.html');
    assert.ok(store.has('aviso_pendiente'));
  });
});

test('2. menu.js · Verifica que "Prueba de datos" fue removido', async () => {
  const { MENU } = await import('../publico/js/nucleo/menu.js');
  assert.ok(!MENU.some(item => item.texto.includes('Prueba de datos')));
  assert.ok(MENU.some(item => item.texto === 'Inicio' && item.href === '/index.html'));
});

test('3. plantilla.js · Renderiza botones de sesión en encabezado y filtra MENU', async (t) => {
  const { montarPlantilla } = await import('../publico/js/nucleo/plantilla.js');

  await t.test('sin sesión muestra enlaces "Ingresar" y "Registrarse"', async () => {
    const { elPlantilla } = configurarEntornoSimulado();
    await montarPlantilla({ titulo: 'Inicio' });

    assert.ok(elPlantilla.innerHTML.includes('/paginas/ingreso.html'), 'Debe incluir enlace de ingreso');
    assert.ok(elPlantilla.innerHTML.includes('/paginas/registro.html'), 'Debe incluir enlace de registro');
    assert.ok(!elPlantilla.innerHTML.includes('id="btn-salir"'), 'No debe mostrar botón de salir');
  });

  await t.test('con sesión muestra nombre, rol y botón "Salir"', async () => {
    const { elPlantilla, elBtnSalir, store } = configurarEntornoSimulado({
      token: 'tok-activo',
      usuario: { id: 'usr_05', nombre: 'Valeria', apellido: 'Rios', rol: 'estudiante' }
    });
    await montarPlantilla({ titulo: 'Inicio' });

    assert.ok(elPlantilla.innerHTML.includes('Valeria Rios'), 'Debe incluir el nombre del usuario');
    assert.ok(elPlantilla.innerHTML.includes('estudiante'), 'Debe incluir la insignia del rol');
    assert.ok(elPlantilla.innerHTML.includes('/paginas/perfil.html'), 'Debe incluir enlace a perfil');
    assert.ok(elPlantilla.innerHTML.includes('id="btn-salir"'), 'Debe incluir botón de salir');

    // Probar clic en salir
    await elBtnSalir.click();
    assert.equal(store.has('token'), false, 'Debe limpiar token de sesión');
  });
});

test('4. Integridad de páginas y módulos: privacidad, ingreso y registro', () => {
  const paginas = [
    {
      html: 'publico/paginas/privacidad.html',
      css: 'publico/css/modulos/privacidad.css',
      js: 'publico/js/modulos/privacidad.js',
      buscar: ['LOPDP', 'finalidad', 'acceso', 'eliminación']
    },
    {
      html: 'publico/paginas/ingreso.html',
      css: 'publico/css/modulos/ingreso.css',
      js: 'publico/js/modulos/ingreso.js',
      buscar: ['campo__error', 'form-ingreso', 'sesion.iniciar']
    },
    {
      html: 'publico/paginas/registro.html',
      css: 'publico/css/modulos/registro.css',
      js: 'publico/js/modulos/registro.js',
      buscar: ['campo__error', 'form-registro', 'campo-consentimiento', 'sesion.registrar', 'sesion.iniciar']
    }
  ];

  for (const p of paginas) {
    const rutaHtml = path.join(raiz, p.html);
    const rutaCss = path.join(raiz, p.css);
    const rutaJs = path.join(raiz, p.js);

    assert.ok(fs.existsSync(rutaHtml), `${p.html} debe existir`);
    assert.ok(fs.existsSync(rutaCss), `${p.css} debe existir`);
    assert.ok(fs.existsSync(rutaJs), `${p.js} debe existir`);

    const contenidoJs = fs.readFileSync(rutaJs, 'utf-8');
    for (const b of p.buscar) {
      assert.ok(
        contenidoJs.toLowerCase().includes(b.toLowerCase()) ||
        fs.readFileSync(rutaHtml, 'utf-8').toLowerCase().includes(b.toLowerCase()),
        `${p.html}/${p.js} debe contemplar '${b}'`
      );
    }
  }
});
