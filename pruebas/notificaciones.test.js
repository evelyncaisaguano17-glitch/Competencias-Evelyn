// pruebas/notificaciones.test.js · Pruebas para Tarea P06.4 (Centro de notificaciones)
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sembrar } from '../servidor/semilla.js';
import * as almacen from '../servidor/almacen.js';
import { notificar } from '../servidor/notificar.js';
import notificacionesRouter from '../servidor/rutas/notificaciones.js';
import { despuesDeGuardar } from '../servidor/ganchos/noticias.js';
import { noLeidas, montarCampana } from '../publico/js/nucleo/notificaciones.js';

test.before(async () => {
  await sembrar({ forzar: true });
  await almacen.escribir('notificaciones', []);
});

test('1. Permisos de notificaciones en permisos.json', async () => {
  const permisos = await almacen.leerConfig('permisos');
  assert.ok(permisos.notificaciones, 'Debe existir la colección notificaciones en permisos.json');
  assert.deepEqual(permisos.notificaciones.leer, ['propio'], 'Lectura restringida a propio');
  assert.deepEqual(permisos.notificaciones.escribir, ['servidor'], 'Escritura restringida a servidor');
});

test('2. servidor/notificar.js: crea registro con leida: false y valida usuarioId', async () => {
  await assert.rejects(
    async () => await notificar('', { mensaje: 'Prueba' }),
    (err) => err.estado === 400,
    'Debe rechazar con 400 si no hay usuarioId'
  );

  const notif = await notificar('usu_000003', {
    tipo: 'general',
    mensaje: 'Hola estudiante',
    enlace: '/paginas/tema.html?id=tem_000001'
  });

  assert.ok(notif.id, 'Debe asignar ID');
  assert.equal(notif.usuarioId, 'usu_000003');
  assert.equal(notif.mensaje, 'Hola estudiante');
  assert.equal(notif.enlace, '/paginas/tema.html?id=tem_000001');
  assert.equal(notif.leida, false, 'leida debe ser false');
  assert.ok(notif.fecha, 'Debe asignar fecha ISO');
});

function crearApp(usuario) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.usuario = usuario;
    next();
  });
  app.use('/api', notificacionesRouter);
  return app;
}

test('3. GET /api/notificaciones: lista 30 más recientes y totalSinLeer', async () => {
  const usuario = { id: 'usu_test_get', rol: 'estudiante' };
  const app = crearApp(usuario);
  const server = app.listen(0);
  const puerto = server.address().port;

  try {
    // Insertar varias notificaciones para el usuario
    for (let i = 1; i <= 35; i++) {
      await notificar(usuario.id, {
        tipo: 'general',
        mensaje: `Notificación ${i}`,
        enlace: `/enlace/${i}`
      });
    }

    // Insertar una para otro usuario
    await notificar('usu_otro', { mensaje: 'Para otro' });

    const res = await fetch(`http://localhost:${puerto}/api/notificaciones`);
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(typeof json.totalSinLeer, 'number');
    assert.equal(json.totalSinLeer, 35, 'Total sin leer debe ser 35');
    assert.equal(json.notificaciones.length, 30, 'Debe limitar a las 30 más recientes');
    // La más reciente debe estar primera
    assert.equal(json.notificaciones[0].mensaje, 'Notificación 35');
  } finally {
    server.close();
  }
});

test('4. POST /api/notificaciones: docente a sus estudiantes y admin a cualquiera', async () => {
  const distributivo = await almacen.leer('distributivo');
  const grupo = distributivo.find((g) => g && g.docenteId && g.estudiantes?.length > 0);
  assert.ok(grupo, 'Debe existir un grupo con docente y estudiantes');

  const docenteId = grupo.docenteId;
  const estudianteAsignado = grupo.estudiantes[0];

  const appDocente = crearApp({ id: docenteId, rol: 'docente' });
  const serverDocente = appDocente.listen(0);
  const puertoDoc = serverDocente.address().port;

  try {
    // 4.1 Docente envía a estudiante asignado
    const resOk = await fetch(`http://localhost:${puertoDoc}/api/notificaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: estudianteAsignado,
        mensaje: 'Revisa tu tarea de cirugía',
        enlace: '/paginas/actividades.html'
      })
    });
    assert.equal(resOk.status, 201);
    const notif = await resOk.json();
    assert.equal(notif.tipo, 'mensaje-docente');
    assert.equal(notif.usuarioId, estudianteAsignado);
    assert.equal(notif.leida, false);

    // 4.2 Docente intenta enviar a estudiante no asignado
    const resProhibido = await fetch(`http://localhost:${puertoDoc}/api/notificaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: 'usu_no_existe_o_no_asignado',
        mensaje: 'Hola'
      })
    });
    assert.equal(resProhibido.status, 403);

    // 4.3 Validación de campos obligatorios
    const resBad = await fetch(`http://localhost:${puertoDoc}/api/notificaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: estudianteAsignado })
    });
    assert.equal(resBad.status, 400);
  } finally {
    serverDocente.close();
  }

  // 4.4 Admin puede notificar a cualquiera
  const appAdmin = crearApp({ id: 'usu_000001', rol: 'admin' });
  const serverAdmin = appAdmin.listen(0);
  const puertoAdmin = serverAdmin.address().port;

  try {
    const resAdmin = await fetch(`http://localhost:${puertoAdmin}/api/notificaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId: 'cualquier_usuario',
        mensaje: 'Aviso del administrador'
      })
    });
    assert.equal(resAdmin.status, 201);
    const notifAdmin = await resAdmin.json();
    assert.equal(notifAdmin.tipo, 'mensaje-docente');
  } finally {
    serverAdmin.close();
  }
});

test('5. POST /api/notificaciones/:id/leida y POST /api/notificaciones/leidas', async () => {
  const usuario = { id: 'usu_leidas_test', rol: 'estudiante' };
  const app = crearApp(usuario);
  const server = app.listen(0);
  const puerto = server.address().port;

  try {
    const n1 = await notificar(usuario.id, { mensaje: 'Noticia 1' });
    const n2 = await notificar(usuario.id, { mensaje: 'Noticia 2' });
    const nAjena = await notificar('otro_user', { mensaje: 'Ajena' });

    // 5.1 Marcar individual como leída
    const res1 = await fetch(`http://localhost:${puerto}/api/notificaciones/${n1.id}/leida`, {
      method: 'POST'
    });
    assert.equal(res1.status, 200);
    const actual1 = await res1.json();
    assert.equal(actual1.leida, true);

    // 5.2 Intentar marcar ajena
    const resAjena = await fetch(`http://localhost:${puerto}/api/notificaciones/${nAjena.id}/leida`, {
      method: 'POST'
    });
    assert.equal(resAjena.status, 403);

    // 5.3 Marcar inexistente
    const res404 = await fetch(`http://localhost:${puerto}/api/notificaciones/not_inexistente/leida`, {
      method: 'POST'
    });
    assert.equal(res404.status, 404);

    // 5.4 Marcar todas como leídas
    const resTodas = await fetch(`http://localhost:${puerto}/api/notificaciones/leidas`, {
      method: 'POST'
    });
    assert.equal(resTodas.status, 200);
    const resultadoTodas = await resTodas.json();
    assert.equal(resultadoTodas.ok, true);
    assert.ok(resultadoTodas.actualizadas >= 1);

    // Verificar en base de datos
    const todas = await almacen.leer('notificaciones');
    const m2 = todas.find((n) => n.id === n2.id);
    assert.equal(m2.leida, true);
  } finally {
    server.close();
  }
});

test('6. servidor/ganchos/noticias.js: notifica a estudiantes al publicar', async () => {
  await almacen.escribir('notificaciones', []);

  // Noticia publicada con temaId
  const noticiaConTema = {
    id: 'not_noticia_test',
    titulo: 'Nueva técnica quirúrgica',
    estado: 'publicado',
    temaId: 'tem_000001'
  };

  await despuesDeGuardar(noticiaConTema, { id: 'doc_1', rol: 'docente' }, { estado: 'borrador' });

  let notifs = await almacen.leer('notificaciones');
  assert.ok(notifs.length > 0, 'Debe haber creado notificaciones para estudiantes de la asignatura');
  assert.equal(notifs[0].tipo, 'noticia');
  assert.match(notifs[0].mensaje, /Nueva técnica quirúrgica/);
  assert.equal(notifs[0].enlace, '/paginas/noticia.html?id=not_noticia_test');

  // Si ya estaba publicado, no debe renotificar
  const anteriorPublicada = { ...noticiaConTema };
  const antesLen = notifs.length;
  await despuesDeGuardar(noticiaConTema, { id: 'doc_1', rol: 'docente' }, anteriorPublicada);
  notifs = await almacen.leer('notificaciones');
  assert.equal(notifs.length, antesLen, 'No debe notificar si el estado anterior ya era publicado');

  // Noticia general sin tema
  await almacen.escribir('notificaciones', []);
  const noticiaGeneral = {
    id: 'not_general',
    titulo: 'Mantenimiento del campus',
    estado: 'publicado'
  };
  await despuesDeGuardar(noticiaGeneral, { id: 'adm_1', rol: 'admin' }, null);
  notifs = await almacen.leer('notificaciones');
  assert.ok(notifs.length > 0, 'Debe haber notificado a todos los estudiantes');
});

test('7. publico/js/nucleo/notificaciones.js: exports válidos', () => {
  assert.equal(typeof noLeidas, 'function');
  assert.equal(typeof montarCampana, 'function');
});
