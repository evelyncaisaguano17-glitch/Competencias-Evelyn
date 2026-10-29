// pruebas/nucleo.test.js · Pruebas unitarias para publico/js/nucleo (api, ui, util)
import test from 'node:test';
import assert from 'node:assert/strict';

// Configuración de entorno simulado de navegador (DOM, sessionStorage, location)
class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.className = '';
    this.id = '';
    this._textContent = '';
    this.onclick = null;
    this.disabled = false;
    this.tabIndex = 0;
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === 'id') this.id = String(v);
  }

  getAttribute(k) {
    return this.attributes.get(k) ?? null;
  }

  removeAttribute(k) {
    this.attributes.delete(k);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    return this.children.map(c => c.textContent || '').join('');
  }

  set textContent(val) {
    this._textContent = String(val);
    this.children = [];
  }

  querySelector(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this._find(el => el.className && el.className.split(' ').includes(cls));
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    this._collect(el => {
      if (selector.includes('button') && el.tagName === 'BUTTON') return true;
      if (selector.includes('[tabindex]') && el.tabIndex !== -1) return true;
      return false;
    }, results);
    return results;
  }

  _find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const found = child._find(predicate);
      if (found) return found;
    }
    return null;
  }

  _collect(predicate, list) {
    for (const child of this.children) {
      if (predicate(child)) list.push(child);
      child._collect(predicate, list);
    }
  }

  focus() {
    globalThis.document.activeElement = this;
  }

  contains(el) {
    let curr = el;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentElement;
    }
    return false;
  }
}

// Inicializar mocks globales
const storageMap = new Map();
globalThis.sessionStorage = {
  getItem: (k) => storageMap.get(k) ?? null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

globalThis.window = {
  location: {
    pathname: '/paginas/actividades.html',
    search: '?temaId=tem_000001&orden=asc',
    href: 'http://localhost:3000/paginas/actividades.html?temaId=tem_000001&orden=asc'
  }
};

const listeners = new Map();
globalThis.document = {
  body: new MockElement('body'),
  activeElement: null,
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => globalThis.document.body._find(el => el.id === id),
  querySelector: (sel) => globalThis.document.body.querySelector(sel),
  addEventListener: (event, handler) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  },
  removeEventListener: (event, handler) => {
    if (listeners.has(event)) {
      const arr = listeners.get(event);
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }
};

// Importar módulos bajo prueba
const { normalizar, barajar, fechaLarga, fechaRelativa, parametro, formatoBasico } =
  await import('../publico/js/nucleo/util.js');
const { escapar, limpiar, aviso, modal, confirmar, cargando } =
  await import('../publico/js/nucleo/ui.js');
const { listar, obtener, crear, actualizar, eliminar, llamar, subir, ia } =
  await import('../publico/js/nucleo/api.js');

// ==========================================
// PRUEBAS DE util.js
// ==========================================
test('util.js · normalizar() transforma a mayúsculas, quita acentos y conserva la Ñ', () => {
  assert.equal(normalizar('  Árbol Pingüino Éxito Ítalo Óptimo Útil  '), 'ARBOL PINGUINO EXITO ITALO OPTIMO UTIL');
  assert.equal(normalizar('  cañón niño ñandú ÑATO  '), 'CAÑON NIÑO ÑANDU ÑATO');
  assert.equal(normalizar(null), '');
  assert.equal(normalizar(undefined), '');
});

test('util.js · barajar() mezcla elementos con Fisher-Yates sin mutar el original', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const copia = [...original];
  const resultado = barajar(original);

  assert.equal(resultado.length, original.length);
  assert.deepEqual(original, copia, 'El arreglo original no debe haber sido mutado');
  assert.deepEqual([...resultado].sort((a, b) => a - b), original);
  assert.deepEqual(barajar([]), []);
  assert.deepEqual(barajar(null), []);
});

test('util.js · fechaLarga() formatea en español de Ecuador', () => {
  const fecha = fechaLarga('2026-10-24T12:00:00Z');
  assert.match(fecha, /24 de octubre de 2026/);
  assert.equal(fechaLarga(''), '');
  assert.equal(fechaLarga('fecha-invalida'), '');
});

test('util.js · fechaRelativa() calcula diferencia de tiempo en español de Ecuador', () => {
  const ahora = new Date().toISOString();
  assert.equal(fechaRelativa(ahora), 'hace un momento');

  const hace10Min = new Date(Date.now() - 1000 * 60 * 10).toISOString();
  assert.equal(fechaRelativa(hace10Min), 'hace 10 minutos');

  const hace3Horas = new Date(Date.now() - 1000 * 3600 * 3).toISOString();
  assert.equal(fechaRelativa(hace3Horas), 'hace 3 horas');

  assert.equal(fechaRelativa(''), '');
  assert.equal(fechaRelativa('invalida'), '');
});

test('util.js · parametro() extrae valores de la URL actual', () => {
  assert.equal(parametro('temaId'), 'tem_000001');
  assert.equal(parametro('orden'), 'asc');
  assert.equal(parametro('noExiste'), null);
});

test('util.js · formatoBasico() convierte negrita, listas y párrafos con escape de seguridad', () => {
  const texto = 'Hola **mundo** <script>alert(1)</script>\n\n- Elemento 1\n- Elemento 2 con **negrita**\n\nSegundo párrafo';
  const html = formatoBasico(texto);

  assert.ok(!html.includes('<script>'), 'Debe escapar etiquetas HTML');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('<strong>mundo</strong>'));
  assert.ok(html.includes('<ul><li>Elemento 1</li><li>Elemento 2 con <strong>negrita</strong></li></ul>'));
  assert.ok(html.includes('<p>Segundo párrafo</p>'));
  assert.equal(formatoBasico(''), '');
});

// ==========================================
// PRUEBAS DE ui.js
// ==========================================
test('ui.js · escapar() neutraliza caracteres especiales de HTML', () => {
  assert.equal(escapar('<div class="box">&\'</div>'), '&lt;div class=&quot;box&quot;&gt;&amp;&#39;&lt;/div&gt;');
  assert.equal(escapar(null), '');
  assert.equal(escapar(undefined), '');
});

test('ui.js · limpiar() utiliza window.DOMPurify si existe o escapar() si no', () => {
  assert.equal(limpiar('<b>Hola</b>'), '&lt;b&gt;Hola&lt;/b&gt;');

  globalThis.window.DOMPurify = {
    sanitize: (html) => html.replace(/<script.*?>.*?<\/script>/gi, '')
  };
  assert.equal(limpiar('<b>Hola</b><script>malo</script>'), '<b>Hola</b>');
  delete globalThis.window.DOMPurify;
});

test('ui.js · aviso() crea toast en contenedor con aria-live', () => {
  globalThis.document.body.children = [];
  aviso('Operación completada', 'exito');

  const contenedor = globalThis.document.getElementById('contenedor-avisos');
  assert.ok(contenedor, 'Debe existir contenedor-avisos');
  assert.equal(contenedor.getAttribute('aria-live'), 'polite');

  const toast = contenedor.children[0];
  assert.ok(toast);
  assert.ok(toast.className.includes('aviso-exito'));
  assert.ok(toast.textContent.includes('Operación completada'));
});

test('ui.js · modal() crea diálogo accesible y resuelve el valor de la acción', async () => {
  globalThis.document.body.children = [];

  const promesaModal = modal({
    titulo: 'Atención',
    contenido: '¿Deseas continuar?',
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-cancelar' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });

  const overlay = globalThis.document.body.children[0];
  assert.ok(overlay);
  const dialogo = overlay.children[0];
  assert.equal(dialogo.getAttribute('role'), 'dialog');
  assert.equal(dialogo.getAttribute('aria-modal'), 'true');

  // Pulsar el botón aceptar
  const btnAceptar = dialogo.querySelectorAll('button').find(b => b.textContent === 'Aceptar');
  assert.ok(btnAceptar);
  btnAceptar.onclick();

  const resultado = await promesaModal;
  assert.equal(resultado, true);
  assert.equal(globalThis.document.body.children.length, 0, 'Debe removerse el modal al cerrar');
});

test('ui.js · confirmar() utiliza modal() y devuelve booleano', async () => {
  globalThis.document.body.children = [];
  const promesaConfirmar = confirmar('¿Eliminar registro?');

  const overlay = globalThis.document.body.children[0];
  const dialogo = overlay.children[0];
  const btnCancelar = dialogo.querySelectorAll('button').find(b => b.textContent === 'Cancelar');
  btnCancelar.onclick();

  const res = await promesaConfirmar;
  assert.equal(res, false);
});

test('ui.js · cargando() gestiona el indicador .cargando', () => {
  globalThis.document.body.children = [];
  cargando(true);
  const el = globalThis.document.querySelector('.cargando');
  assert.ok(el);
  assert.equal(el.getAttribute('role'), 'status');
  assert.equal(el.style.display, undefined); // Visible por defecto

  cargando(false);
  assert.equal(el.style.display, 'none');
});

// ==========================================
// PRUEBAS DE api.js
// ==========================================
test('api.js · llamar() incluye token de sessionStorage e invoca fetch', async () => {
  sessionStorage.setItem('token', 'mi-token-secreto');

  let fetchLlamado = false;
  let headersEnviados = null;
  globalThis.fetch = async (url, opciones) => {
    fetchLlamado = true;
    headersEnviados = opciones.headers;
    return {
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, datos: [1, 2] })
    };
  };

  const res = await llamar('GET', '/api/prueba');
  assert.ok(fetchLlamado);
  assert.equal(headersEnviados['Authorization'], 'Bearer mi-token-secreto');
  assert.deepEqual(res, { ok: true, datos: [1, 2] });
});

test('api.js · respuesta 401 borra token y usuario de sessionStorage y redirige', async () => {
  sessionStorage.setItem('token', 'token-invalido');
  sessionStorage.setItem('usuario', JSON.stringify({ id: 'u1' }));
  globalThis.window.location.pathname = '/paginas/dashboard.html';

  globalThis.fetch = async () => ({
    status: 401,
    ok: false,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'No autorizado' })
  });

  await assert.rejects(
    async () => await llamar('GET', '/api/privado'),
    /Sesión no autorizada o expirada/
  );

  assert.equal(sessionStorage.getItem('token'), null);
  assert.equal(sessionStorage.getItem('usuario'), null);
  assert.equal(globalThis.window.location.href, '/paginas/ingreso.html');
});

test('api.js · respuesta con { error } lanza Error con ese mensaje', async () => {
  globalThis.fetch = async () => ({
    status: 400,
    ok: false,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'El campo nombre es requerido' })
  });

  await assert.rejects(
    async () => await llamar('POST', '/api/prueba', {}),
    /El campo nombre es requerido/
  );
});

test('api.js · wrappers listar, obtener, crear, actualizar, eliminar, subir e ia', async () => {
  const llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, metodo: opciones.method, cuerpo: opciones.body });
    return {
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ exito: true, url })
    };
  };

  await listar('usuarios', { rol: 'estudiante', activo: 'true' });
  assert.equal(llamadas[0].url, '/api/usuarios?rol=estudiante&activo=true');
  assert.equal(llamadas[0].metodo, 'GET');

  await obtener('usuarios', 'usu_000001');
  assert.equal(llamadas[1].url, '/api/usuarios/usu_000001');

  await crear('usuarios', { nombre: 'Ana' });
  assert.equal(llamadas[2].url, '/api/usuarios');
  assert.equal(llamadas[2].metodo, 'POST');
  assert.equal(llamadas[2].cuerpo, JSON.stringify({ nombre: 'Ana' }));

  await actualizar('usuarios', 'usu_000001', { nombre: 'Ana María' });
  assert.equal(llamadas[3].url, '/api/usuarios/usu_000001');
  assert.equal(llamadas[3].metodo, 'PUT');

  await eliminar('usuarios', 'usu_000001');
  assert.equal(llamadas[4].url, '/api/usuarios/usu_000001');
  assert.equal(llamadas[4].metodo, 'DELETE');

  await subir('dummy-file');
  assert.equal(llamadas[5].url, '/api/subidas');
  assert.equal(llamadas[5].metodo, 'POST');

  await ia('generar-preguntas', { tema: 'redes' });
  assert.equal(llamadas[6].url, '/api/ia/generar-preguntas');
  assert.equal(llamadas[6].metodo, 'POST');
});
