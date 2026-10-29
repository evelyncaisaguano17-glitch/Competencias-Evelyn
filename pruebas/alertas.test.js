// pruebas/alertas.test.js · Pruebas automatizadas para Tarea P06.5 (Alertas tempranas)
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sembrar } from '../servidor/semilla.js';
import * as almacen from '../servidor/almacen.js';
import { evaluarAlertas, evaluarInactividad } from '../servidor/alertas.js';
import alertasRouter from '../servidor/rutas/alertas.js';
import { filtrarLista, antesDeGuardar } from '../servidor/ganchos/alertas.js';
import { abrirModalAlertasEstudiante } from '../publico/js/modulos/panel-docente.js';

test.before(async () => {
  await sembrar({ forzar: true });
  await almacen.escribir('alertas', []);
  await almacen.escribir('notificaciones', []);
});

test('1. Permisos de alertas en permisos.json', async () => {
  const permisos = await almacen.leerConfig('permisos');
  assert.ok(permisos.alertas, 'Debe existir la colección alertas en permisos.json');
  assert.deepEqual(permisos.alertas.leer, ['docente', 'admin'], 'Lectura para docente y admin');
  assert.deepEqual(permisos.alertas.escribir, ['docente', 'admin'], 'Escritura para docente y admin');
});

test('2. servidor/alertas.js: regla promedioBajo genera alerta y evita duplicados', async () => {
  await almacen.escribir('alertas', []);
  await almacen.escribir('notificaciones', []);
  await almacen.escribir('intentos', []);

  const estudianteId = 'usu_000005';
  const temaId = 'tem_000001';

  // 3 intentos con promedio bajo (5, 6, 6) -> 17/3 = 5.67 < 7
  await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'ahorcado', temaId, puntaje: 5, maximo: 10 });
  await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'pareja', temaId, puntaje: 6, maximo: 10 });
  const ultimoIntento = await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'sopa-letras', temaId, puntaje: 6, maximo: 10 });

  const generadas = await evaluarAlertas(ultimoIntento, { id: estudianteId, rol: 'estudiante' });
  assert.equal(generadas.length, 1, 'Debe generar alerta de promedioBajo');
  assert.equal(generadas[0].regla, 'promedioBajo');
  assert.equal(generadas[0].estado, 'activa');

  // Verificar que se haya notificado al docente
  const notifs = await almacen.leer('notificaciones');
  assert.ok(notifs.length >= 1, 'Debe notificar al docente');
  assert.equal(notifs[0].tipo, 'alerta');
  assert.match(notifs[0].mensaje, /Alerta de apoyo/);

  // Evaluar de nuevo: no debe duplicar la alerta activa
  const segundoIntento = await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'ahorcado', temaId, puntaje: 4, maximo: 10 });
  const generadas2 = await evaluarAlertas(segundoIntento, { id: estudianteId, rol: 'estudiante' });
  assert.equal(generadas2.length, 0, 'No debe duplicar alerta activa');
});

test('3. servidor/alertas.js: regla fallosQuiz genera alerta tras N intentos no aprobados seguidos', async () => {
  await almacen.escribir('alertas', []);
  await almacen.escribir('notificaciones', []);
  await almacen.escribir('intentos', []);

  const estudianteId = 'usu_000005';
  const temaId = 'tem_000001';

  // 3 intentos seguidos de quiz fallados (puntaje 3/10 < 70%)
  await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'quiz', temaId, nivel: 1, puntaje: 3, maximo: 10, detalle: { aprobado: false } });
  await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'quiz', temaId, nivel: 1, puntaje: 4, maximo: 10, detalle: { aprobado: false } });
  const intento3 = await almacen.agregar('intentos', { usuarioId: estudianteId, actividad: 'quiz', temaId, nivel: 1, puntaje: 2, maximo: 10, detalle: { aprobado: false } });

  const generadas = await evaluarAlertas(intento3, { id: estudianteId, rol: 'estudiante' });
  assert.ok(generadas.some((a) => a.regla === 'fallosQuiz'), 'Debe generar alerta fallosQuiz');

  const alertas = await almacen.leer('alertas');
  const alertaQuiz = alertas.find((a) => a.regla === 'fallosQuiz' && a.estudianteId === estudianteId);
  assert.ok(alertaQuiz, 'La alerta debe quedar guardada en la colección');
  assert.equal(alertaQuiz.estado, 'activa');
});

test('4. servidor/alertas.js: evaluarInactividad detecta estudiantes sin actividad en X días', async () => {
  await almacen.escribir('alertas', []);
  const estudianteId = 'usu_inactivo_prueba';

  // Bitácora antigua (hace 10 días)
  const hace10Dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  await almacen.anexarLinea('bitacora.jsonl', {
    usuarioId: estudianteId,
    tipo: 'login',
    fecha: hace10Dias
  });

  const distributivo = await almacen.leer('distributivo');
  const grupoPrueba = {
    id: 'gru_inactividad_test',
    docenteId: 'usu_000002',
    estudiantes: [estudianteId]
  };
  distributivo.push(grupoPrueba);
  await almacen.escribir('distributivo', distributivo);

  const generadas = await evaluarInactividad(grupoPrueba.id);
  assert.ok(generadas.length >= 1, 'Debe generar alerta de inactividad');
  assert.equal(generadas[0].regla, 'inactividad');
  assert.equal(generadas[0].estado, 'activa');

  // Segunda llamada no debe duplicar
  const segunda = await evaluarInactividad(grupoPrueba.id);
  assert.equal(segunda.length, 0, 'No debe duplicar alerta de inactividad');
});

function crearAppAlertas(usuario) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.usuario = usuario;
    next();
  });
  app.use('/api', alertasRouter);
  return app;
}

test('5. servidor/rutas/alertas.js: GET /api/alertas?grupoId= (docente y admin)', async () => {
  const distributivo = await almacen.leer('distributivo');
  const grupo = distributivo[0];

  const appDocente = crearAppAlertas({ id: grupo.docenteId, rol: 'docente' });
  const server = appDocente.listen(0);
  const puerto = server.address().port;

  try {
    // 5.1 Docente consulta su grupo
    const res = await fetch(`http://localhost:${puerto}/api/alertas?grupoId=${grupo.id}`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.alertas), 'alertas debe ser Array');
    assert.ok(Array.isArray(json.mensajesApoyo), 'mensajesApoyo debe ser Array');
    assert.ok(json.mensajesApoyo.length >= 3, 'Debe incluir los mensajes de apoyo configurados');

    // 5.2 Docente intenta consultar grupo ajeno
    const resAjeno = await fetch(`http://localhost:${puerto}/api/alertas?grupoId=gru_inexistente`);
    assert.equal(resAjeno.status, 403);
  } finally {
    server.close();
  }
});

test('6. servidor/ganchos/alertas.js: filtra por grupos y solo permite cambiar campo estado', async () => {
  const distributivo = await almacen.leer('distributivo');
  const grupoDocente = distributivo[0];
  const docente = { id: grupoDocente.docenteId, rol: 'docente' };

  const alertaMuestra = [
    { id: 'ale_1', grupoId: grupoDocente.id, estado: 'activa' },
    { id: 'ale_2', grupoId: 'gru_ajeno', estado: 'activa' }
  ];

  // 6.1 filtrarLista
  const filtradas = await filtrarLista(alertaMuestra, docente);
  assert.equal(filtradas.length, 1);
  assert.equal(filtradas[0].id, 'ale_1');

  // 6.2 antesDeGuardar: permite cambiar estado a "atendida"
  const anterior = { id: 'ale_1', grupoId: grupoDocente.id, regla: 'inactividad', detalle: 'Detalle original', estado: 'activa' };
  const actualizado = await antesDeGuardar({ estado: 'atendida', detalle: 'Intento de cambio' }, docente, anterior);
  assert.equal(actualizado.estado, 'atendida');
  assert.equal(actualizado.detalle, 'Detalle original', 'No debe permitir cambiar campos distintos de estado');

  // 6.3 antesDeGuardar: rechaza si docente no pertenece al grupo
  await assert.rejects(
    async () => await antesDeGuardar({ estado: 'atendida' }, docente, { id: 'ale_2', grupoId: 'gru_ajeno', estado: 'activa' }),
    (err) => err.estado === 403
  );

  // 6.4 antesDeGuardar: rechaza estado inválido
  await assert.rejects(
    async () => await antesDeGuardar({ estado: 'invalido' }, docente, anterior),
    (err) => err.estado === 400
  );
});

test('7. publico/js/modulos/panel-docente.js: exporta abrirModalAlertasEstudiante', () => {
  assert.equal(typeof abrirModalAlertasEstudiante, 'function');
});
