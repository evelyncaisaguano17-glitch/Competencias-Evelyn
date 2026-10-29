// pruebas/auth.test.js · Pruebas unitarias y de integración para Tarea P01.1 (Autenticación y sesiones)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as almacen from '../servidor/almacen.js';
import { cargarUsuario, exigirRol, limpiarSesionesVencidas } from '../servidor/auth.js';
import * as ganchosUsuarios from '../servidor/ganchos/usuarios.js';
import { crearAdmin } from '../servidor/crear-admin.js';
import { app } from '../servidor/server.js';
import { limpiarTodosLosFallos } from '../servidor/rutas/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

// Helper para invocar endpoints en la app Express en memoria sin dependencias externas
async function llamarApp(metodo, ruta, { cuerpo = null, token = null } = {}) {
  const url = new URL(`http://localhost${ruta}`);
  const req = {
    method: metodo,
    url: ruta,
    originalUrl: ruta,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: {
      'content-type': 'application/json'
    },
    body: cuerpo || {}
  };

  if (token) {
    req.headers['authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve) => {
    let estado = 200;
    let cuerpoRespuesta = null;

    const res = {
      statusCode: 200,
      status(codigo) {
        estado = codigo;
        this.statusCode = codigo;
        return this;
      },
      json(datos) {
        cuerpoRespuesta = datos;
        resolve({ estado, cuerpo: cuerpoRespuesta });
      },
      send(datos) {
        cuerpoRespuesta = datos;
        resolve({ estado, cuerpo: cuerpoRespuesta });
      },
      setHeader() {},
      getHeader() { return null; }
    };

    app(req, res, () => {
      resolve({ estado: 404, cuerpo: { error: 'No encontrado' } });
    });
  });
}

let usuariosOriginales = [];
let sesionesOriginales = [];

test('1. servidor/auth.js · cargarUsuario y exigirRol', async (t) => {
  usuariosOriginales = await almacen.leer('usuarios');
  sesionesOriginales = await almacen.leer('sesiones');

  // Limpiar colecciones de prueba
  await almacen.escribir('usuarios', []);
  await almacen.escribir('sesiones', []);

  // Crear usuario activo
  const hash = await bcrypt.hash('clave123A', 10);
  const usuarioActivo = await almacen.agregar('usuarios', {
    nombre: 'Ana',
    apellido: 'Gómez',
    correo: 'ana@ejemplo.com',
    claveHash: hash,
    rol: 'estudiante',
    activo: true
  });

  // Crear usuario inactivo
  const usuarioInactivo = await almacen.agregar('usuarios', {
    nombre: 'Carlos',
    apellido: 'Pérez',
    correo: 'carlos@ejemplo.com',
    claveHash: hash,
    rol: 'docente',
    activo: false
  });

  // Sesión válida
  const tokenValido = 'token-valido-123';
  await almacen.agregar('sesiones', {
    token: tokenValido,
    usuarioId: usuarioActivo.id,
    expira: new Date(Date.now() + 60000).toISOString()
  });

  // Sesión vencida
  const tokenVencido = 'token-vencido-456';
  await almacen.agregar('sesiones', {
    token: tokenVencido,
    usuarioId: usuarioActivo.id,
    expira: new Date(Date.now() - 60000).toISOString()
  });

  // Sesión con usuario inactivo
  const tokenInactivo = 'token-inactivo-789';
  await almacen.agregar('sesiones', {
    token: tokenInactivo,
    usuarioId: usuarioInactivo.id,
    expira: new Date(Date.now() + 60000).toISOString()
  });

  await t.test('sin header Authorization asigna req.usuario = null', async () => {
    const req = { headers: {} };
    await cargarUsuario(req, {}, () => {});
    assert.equal(req.usuario, null);
  });

  await t.test('con token inexistente asigna req.usuario = null', async () => {
    const req = { headers: { authorization: 'Bearer no-existe' } };
    await cargarUsuario(req, {}, () => {});
    assert.equal(req.usuario, null);
  });

  await t.test('con sesión vencida asigna req.usuario = null', async () => {
    const req = { headers: { authorization: `Bearer ${tokenVencido}` } };
    await cargarUsuario(req, {}, () => {});
    assert.equal(req.usuario, null);
  });

  await t.test('con usuario inactivo asigna req.usuario = null', async () => {
    const req = { headers: { authorization: `Bearer ${tokenInactivo}` } };
    await cargarUsuario(req, {}, () => {});
    assert.equal(req.usuario, null);
  });

  await t.test('con sesión válida asigna req.usuario correctamente', async () => {
    const req = { headers: { authorization: `Bearer ${tokenValido}` } };
    await cargarUsuario(req, {}, () => {});
    assert.ok(req.usuario);
    assert.equal(req.usuario.id, usuarioActivo.id);
    assert.equal(req.usuario.nombre, 'Ana');
    assert.equal(req.usuario.apellido, 'Gómez');
    assert.equal(req.usuario.rol, 'estudiante');
  });

  await t.test('exigirRol rechaza con 401 si req.usuario es null', () => {
    const middleware = exigirRol('sesion');
    let estado = null;
    let respuesta = null;
    middleware(
      { usuario: null },
      { status: (c) => ({ json: (d) => { estado = c; respuesta = d; } }) },
      () => assert.fail('No debió llamar a next')
    );
    assert.equal(estado, 401);
    assert.ok(respuesta.error);
  });

  await t.test('exigirRol permite acceso con rol sesion a cualquier usuario autenticado', () => {
    const middleware = exigirRol('sesion');
    let nextLlamado = false;
    middleware({ usuario: { rol: 'estudiante' } }, {}, () => { nextLlamado = true; });
    assert.equal(nextLlamado, true);
  });

  await t.test('exigirRol rechaza con 403 si el rol no coincide', () => {
    const middleware = exigirRol('admin');
    let estado = null;
    middleware(
      { usuario: { rol: 'estudiante' } },
      { status: (c) => ({ json: () => { estado = c; } }) },
      () => assert.fail('No debió llamar a next')
    );
    assert.equal(estado, 403);
  });

  await t.test('limpiarSesionesVencidas remueve sesiones caducadas', async () => {
    await limpiarSesionesVencidas();
    const sesiones = await almacen.leer('sesiones');
    assert.ok(!sesiones.some(s => s.token === tokenVencido));
    assert.ok(sesiones.some(s => s.token === tokenValido));
  });
});

test('2. servidor/rutas/auth.js · Registro, login, yo, perfil, clave, bitácora y admin', async (t) => {
  await almacen.escribir('usuarios', []);
  await almacen.escribir('sesiones', []);
  limpiarTodosLosFallos();

  let tokenEstudiante = null;
  let idEstudiante = null;

  await t.test('POST /api/auth/registro valida campos y crea estudiante', async () => {
    // Falla por falta de consentimiento
    const resSinCons = await llamarApp('POST', '/api/auth/registro', {
      cuerpo: {
        nombre: 'María',
        apellido: 'Lopez',
        correo: 'maria@ejemplo.com',
        clave: 'ClaveSegura1',
        consentimiento: false
      }
    });
    assert.equal(resSinCons.estado, 400);

    // Registro exitoso
    const resExito = await llamarApp('POST', '/api/auth/registro', {
      cuerpo: {
        nombre: 'María',
        apellido: 'Lopez',
        correo: 'MARIA@ejemplo.com',
        clave: 'ClaveSegura1',
        consentimiento: true
      }
    });
    assert.equal(resExito.estado, 201);
    assert.equal(resExito.cuerpo.correo, 'maria@ejemplo.com');
    assert.equal(resExito.cuerpo.rol, 'estudiante');
    assert.equal(resExito.cuerpo.activo, true);
    assert.equal(resExito.cuerpo.claveHash, undefined);
    idEstudiante = resExito.cuerpo.id;

    // Falla si el correo ya existe
    const resDuplicado = await llamarApp('POST', '/api/auth/registro', {
      cuerpo: {
        nombre: 'Otra',
        apellido: 'Persona',
        correo: 'maria@ejemplo.com',
        clave: 'ClaveSegura1',
        consentimiento: true
      }
    });
    assert.equal(resDuplicado.estado, 400);
  });

  await t.test('POST /api/auth/login valida credenciales y limita intentos', async () => {
    // Contraseña errónea (401)
    for (let i = 0; i < 4; i++) {
      const resFallo = await llamarApp('POST', '/api/auth/login', {
        cuerpo: { correo: 'maria@ejemplo.com', clave: 'incorrecta' }
      });
      assert.equal(resFallo.estado, 401);
    }

    // 5to fallo
    const resQuintoFallo = await llamarApp('POST', '/api/auth/login', {
      cuerpo: { correo: 'maria@ejemplo.com', clave: 'incorrecta' }
    });
    assert.equal(resQuintoFallo.estado, 401);

    // 6to intento dentro de 15 min debe ser 429
    const res429 = await llamarApp('POST', '/api/auth/login', {
      cuerpo: { correo: 'maria@ejemplo.com', clave: 'ClaveSegura1' }
    });
    assert.equal(res429.estado, 429);

    // Limpiar fallos y realizar login correcto
    limpiarTodosLosFallos();
    const resLogin = await llamarApp('POST', '/api/auth/login', {
      cuerpo: { correo: 'maria@ejemplo.com', clave: 'ClaveSegura1' }
    });
    assert.equal(resLogin.estado, 200);
    assert.ok(resLogin.cuerpo.token);
    assert.equal(resLogin.cuerpo.usuario.id, idEstudiante);
    tokenEstudiante = resLogin.cuerpo.token;

    // Verificar bitácora de login
    const bitacora = await almacen.leerLineas('bitacora.jsonl');
    const eventoLogin = bitacora.find(e => e.tipo === 'login' && e.usuarioId === idEstudiante);
    assert.ok(eventoLogin, 'Debe haberse registrado el login en bitacora.jsonl');
  });

  await t.test('GET /api/auth/yo y PUT /api/auth/perfil', async () => {
    const resYo = await llamarApp('GET', '/api/auth/yo', { token: tokenEstudiante });
    assert.equal(resYo.estado, 200);
    assert.equal(resYo.cuerpo.id, idEstudiante);
    assert.equal(resYo.cuerpo.claveHash, undefined);

    const resPerfil = await llamarApp('PUT', '/api/auth/perfil', {
      token: tokenEstudiante,
      cuerpo: { nombre: 'María Elena', apellido: 'López Castro', foto: 'avatar.png' }
    });
    assert.equal(resPerfil.estado, 200);
    assert.equal(resPerfil.cuerpo.nombre, 'María Elena');
    assert.equal(resPerfil.cuerpo.foto, 'avatar.png');
  });

  await t.test('POST /api/auth/clave cambia la contraseña', async () => {
    // Contraseña actual errónea
    const resFallo = await llamarApp('POST', '/api/auth/clave', {
      token: tokenEstudiante,
      cuerpo: { actual: 'ClaveFalsa99', nueva: 'NuevaClave2' }
    });
    assert.equal(resFallo.estado, 400);

    // Cambio exitoso
    const resExito = await llamarApp('POST', '/api/auth/clave', {
      token: tokenEstudiante,
      cuerpo: { actual: 'ClaveSegura1', nueva: 'NuevaClave2' }
    });
    assert.equal(resExito.estado, 200);
    assert.equal(resExito.cuerpo.ok, true);

    // Login con la nueva clave
    const resLoginNuevo = await llamarApp('POST', '/api/auth/login', {
      cuerpo: { correo: 'maria@ejemplo.com', clave: 'NuevaClave2' }
    });
    assert.equal(resLoginNuevo.estado, 200);
  });

  await t.test('POST /api/eventos registra eventos en la bitácora', async () => {
    const resEvento = await llamarApp('POST', '/api/eventos', {
      token: tokenEstudiante,
      cuerpo: { tipo: 'navegacion', recurso: 'inicio' }
    });
    assert.equal(resEvento.estado, 201);
    assert.equal(resEvento.cuerpo.ok, true);

    const bitacora = await almacen.leerLineas('bitacora.jsonl');
    const evento = bitacora.find(e => e.tipo === 'navegacion' && e.recurso === 'inicio');
    assert.ok(evento);
    assert.equal(evento.usuarioId, idEstudiante);
  });

  await t.test('POST /api/admin/usuarios/:id/restablecer exige admin y restablece clave', async () => {
    // Crear un usuario admin
    const admin = await crearAdmin({
      nombre: 'Super',
      apellido: 'Admin',
      correo: 'admin@ejemplo.com',
      clave: 'AdminClave1'
    });

    // Login del admin
    const loginAdmin = await llamarApp('POST', '/api/auth/login', {
      cuerpo: { correo: 'admin@ejemplo.com', clave: 'AdminClave1' }
    });
    const tokenAdmin = loginAdmin.cuerpo.token;

    // Intentar con token de estudiante (debe fallar 403)
    const resEstudiante = await llamarApp('POST', `/api/admin/usuarios/${idEstudiante}/restablecer`, {
      token: tokenEstudiante
    });
    assert.equal(resEstudiante.estado, 403);

    // Con token de admin debe tener éxito
    const resAdmin = await llamarApp('POST', `/api/admin/usuarios/${idEstudiante}/restablecer`, {
      token: tokenAdmin
    });
    assert.equal(resAdmin.estado, 200);
    assert.ok(resAdmin.cuerpo.claveTemporal);
    assert.equal(resAdmin.cuerpo.claveTemporal.length, 10);

    // Iniciar sesión con la clave temporal restablecida
    const loginTemporal = await llamarApp('POST', '/api/auth/login', {
      cuerpo: { correo: 'maria@ejemplo.com', clave: resAdmin.cuerpo.claveTemporal }
    });
    assert.equal(loginTemporal.estado, 200);
  });

  await t.test('POST /api/auth/logout elimina sesión y registra en bitácora', async () => {
    const resLogout = await llamarApp('POST', '/api/auth/logout', { token: tokenEstudiante });
    assert.equal(resLogout.estado, 200);
    assert.equal(resLogout.cuerpo.ok, true);

    // Token estudiante ya no debe tener acceso
    const resYo = await llamarApp('GET', '/api/auth/yo', { token: tokenEstudiante });
    assert.equal(resYo.estado, 401);

    const bitacora = await almacen.leerLineas('bitacora.jsonl');
    const eventoLogout = bitacora.find(e => e.tipo === 'logout' && e.usuarioId === idEstudiante);
    assert.ok(eventoLogout);
  });
});

test('3. servidor/ganchos/usuarios.js · Filtrado de lista y validación antes de guardar', () => {
  const lista = [
    { id: 'usr_000001', nombre: 'Juan', claveHash: 'hash-secreto', rol: 'estudiante' },
    { id: 'usr_000002', nombre: 'Ana', claveHash: 'otro-hash', rol: 'docente' }
  ];

  const filtrada = ganchosUsuarios.filtrarLista(lista, null);
  assert.equal(filtrada[0].claveHash, undefined);
  assert.equal(filtrada[1].claveHash, undefined);
  assert.equal(filtrada[0].nombre, 'Juan');

  // antesDeGuardar ignora claveHash y correo
  const cambios = { nombre: 'Juan Modificado', claveHash: 'nuevo-hash', correo: 'hacker@ejemplo.com' };
  const limpios = ganchosUsuarios.antesDeGuardar(cambios, { id: 'usr_000002', rol: 'admin' }, lista[0]);
  assert.equal(limpios.claveHash, undefined);
  assert.equal(limpios.correo, undefined);
  assert.equal(limpios.nombre, 'Juan Modificado');

  // Un admin no puede cambiar su propio rol
  assert.throws(
    () => {
      ganchosUsuarios.antesDeGuardar(
        { rol: 'estudiante' },
        { id: 'usr_000001', rol: 'admin' },
        { id: 'usr_000001', rol: 'admin', activo: true }
      );
    },
    (err) => err.estado === 403
  );

  // Un admin no puede desactivarse a sí mismo
  assert.throws(
    () => {
      ganchosUsuarios.antesDeGuardar(
        { activo: false },
        { id: 'usr_000001', rol: 'admin' },
        { id: 'usr_000001', rol: 'admin', activo: true }
      );
    },
    (err) => err.estado === 403
  );
});

test('4. permisos.json · Configuración correcta de usuarios y sesiones sin prueba', async () => {
  const permisos = await almacen.leerConfig('permisos');
  assert.deepEqual(permisos.usuarios, { leer: ['admin'], escribir: ['admin'] });
  assert.deepEqual(permisos.sesiones, { leer: ['servidor'], escribir: ['servidor'] });
  assert.equal(permisos.prueba, undefined, 'La colección "prueba" debió eliminarse');

  // Restaurar usuarios y sesiones originales preservando los que se hayan creado
  const actuales = await almacen.leer('usuarios');
  const combinados = [...usuariosOriginales];
  for (const u of actuales) {
    if (!combinados.some(c => c && c.correo && u && u.correo && c.correo.toLowerCase() === u.correo.toLowerCase())) {
      combinados.push(u);
    }
  }
  await almacen.escribir('usuarios', combinados);
  await almacen.escribir('sesiones', sesionesOriginales);
});
