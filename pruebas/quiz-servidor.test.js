// pruebas/quiz-servidor.test.js · Pruebas para Tarea P08.2 (Motor del quiz - servidor)
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sembrar } from '../servidor/semilla.js';
import * as almacen from '../servidor/almacen.js';
import quizRouter from '../servidor/rutas/quiz.js';

test.before(async () => {
  await sembrar({ forzar: true });
  await almacen.escribir('logros', [
    { id: 'log_000001', usuarioId: 'usu_000004', puntos: 0, insignias: [], nivelQuiz: {} }
  ]);
  await almacen.escribir('quiz-sesiones', []);
  await almacen.escribir('intentos', []);

  // Asegurar que preguntas.json contenga preguntas de prueba para tem_000001
  const preguntasExistentes = await almacen.leer('preguntas').catch(() => []);
  if (preguntasExistentes.length === 0) {
    const preguntasDemo = [];
    for (let i = 1; i <= 10; i++) {
      preguntasDemo.push({
        id: `pre_${String(i).padStart(6, '0')}`,
        temaId: 'tem_000001',
        nivel: 1,
        tipo: i <= 5 ? 'opcion' : (i <= 8 ? 'vf' : 'completar'),
        enunciado: `Pregunta de prueba ${i}`,
        opciones: i <= 5 ? ['Opción A', 'Opción B', 'Opción C', 'Opción D'] : ['Verdadero', 'Falso'],
        correcta: i <= 5 ? 1 : (i <= 8 ? true : 'sutura'),
        retroalimentacion: `Retroalimentación de prueba ${i}`,
        origen: 'docente',
        estado: 'aprobado'
      });
    }
    await almacen.escribir('preguntas', preguntasDemo);
  }
});

function crearAppQuiz(usuario) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.usuario = usuario;
    next();
  });
  app.use('/api', quizRouter);
  return app;
}

test('1. permisos.json: quiz-sesiones tiene permisos exclusivos de servidor', async () => {
  const permisos = await almacen.leerConfig('permisos');
  assert.ok(permisos['quiz-sesiones'], 'quiz-sesiones debe existir en permisos.json');
  assert.deepEqual(permisos['quiz-sesiones'].leer, ['servidor']);
  assert.deepEqual(permisos['quiz-sesiones'].escribir, ['servidor']);
});

test('2. Control de rol y acceso a tema: solo estudiantes con acceso', async () => {
  const docente = { id: 'usu_000002', rol: 'docente' };
  const appDocente = crearAppQuiz(docente);
  const serverDocente = appDocente.listen(0);
  const puertoDoc = serverDocente.address().port;

  try {
    const res = await fetch(`http://localhost:${puertoDoc}/api/quiz/estado?temaId=tem_000001`);
    assert.equal(res.status, 403, 'Docente debe recibir 403');
  } finally {
    serverDocente.close();
  }

  // Estudiante sin acceso a la asignatura
  const estudiante = { id: 'usu_000004', rol: 'estudiante' };
  const appEst = crearAppQuiz(estudiante);
  const serverEst = appEst.listen(0);
  const puertoEst = serverEst.address().port;

  try {
    const resNoAcceso = await fetch(`http://localhost:${puertoEst}/api/quiz/estado?temaId=tema_inexistente_999`);
    assert.equal(resNoAcceso.status, 404);
  } finally {
    serverEst.close();
  }
});

test('3. GET /api/quiz/estado?temaId= devuelve niveles 1 a 5 con disponibilidad progresiva', async () => {
  const estudiante = { id: 'usu_000004', rol: 'estudiante' };
  const app = crearAppQuiz(estudiante);
  const server = app.listen(0);
  const puerto = server.address().port;

  try {
    // Al inicio, nivel 1 disponible, niveles 2-5 bloqueados
    const res1 = await fetch(`http://localhost:${puerto}/api/quiz/estado?temaId=tem_000001`);
    assert.equal(res1.status, 200);
    const json1 = await res1.json();
    assert.ok(Array.isArray(json1.niveles));
    assert.equal(json1.niveles.length, 5);
    assert.equal(json1.niveles[0].nivel, 1);
    assert.equal(json1.niveles[0].nombre, 'Recordar');
    assert.equal(json1.niveles[0].estado, 'disponible');
    assert.equal(json1.niveles[1].estado, 'bloqueado');

    // Simular que aprobó nivel 1 en logros
    const logros = await almacen.leer('logros');
    let logro = logros.find(l => l && l.usuarioId === estudiante.id);
    if (!logro) {
      logro = await almacen.agregar('logros', { usuarioId: estudiante.id, puntos: 0, insignias: [], nivelQuiz: {} });
    }
    if (!logro.nivelQuiz) logro.nivelQuiz = {};
    logro.nivelQuiz['tem_000001'] = 1;
    await almacen.actualizar('logros', logro.id, { nivelQuiz: logro.nivelQuiz });

    const res2 = await fetch(`http://localhost:${puerto}/api/quiz/estado?temaId=tem_000001`);
    const json2 = await res2.json();
    assert.equal(json2.niveles[0].estado, 'aprobado');
    assert.equal(json2.niveles[1].estado, 'disponible');
    assert.equal(json2.niveles[2].estado, 'bloqueado');
  } finally {
    server.close();
  }
});

test('4. Flujo completo de sesión: POST /iniciar, POST /responder y POST /finalizar', async () => {
  const estudiante = { id: 'usu_000004', rol: 'estudiante' };
  const app = crearAppQuiz(estudiante);
  const server = app.listen(0);
  const puerto = server.address().port;

  try {
    // 4.1 Iniciar sesión de quiz para nivel 1
    const resIniciar = await fetch(`http://localhost:${puerto}/api/quiz/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temaId: 'tem_000001', nivel: 1 })
    });

    assert.equal(resIniciar.status, 200);
    const datosSesion = await resIniciar.json();
    assert.ok(datosSesion.sesionId, 'Debe devolver sesionId');
    assert.ok(Array.isArray(datosSesion.preguntas), 'Debe devolver preguntas');
    assert.ok(datosSesion.preguntas.length > 0);

    // Verificar que las preguntas no expongan respuestas ni retroalimentación
    const p1 = datosSesion.preguntas[0];
    assert.ok(p1.id);
    assert.ok(p1.tipo);
    assert.ok(p1.enunciado);
    assert.equal(p1.correcta, undefined, 'No debe incluir campo correcta');
    assert.equal(p1.retroalimentacion, undefined, 'No debe incluir campo retroalimentacion');

    // Intentar iniciar nivel bloqueado (ej. nivel 5)
    const resBloqueado = await fetch(`http://localhost:${puerto}/api/quiz/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temaId: 'tem_000001', nivel: 5 })
    });
    assert.equal(resBloqueado.status, 400);

    // 4.2 Responder preguntas
    // Responder la primera pregunta
    const preguntasDb = await almacen.leer('preguntas');
    const pDb1 = preguntasDb.find(p => p.id === p1.id);

    const resResp1 = await fetch(`http://localhost:${puerto}/api/quiz/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sesionId: datosSesion.sesionId,
        preguntaId: p1.id,
        respuesta: pDb1.correcta
      })
    });

    assert.equal(resResp1.status, 200);
    const datosResp1 = await resResp1.json();
    assert.equal(datosResp1.correcto, true);
    assert.ok(datosResp1.retroalimentacion);
    assert.ok(datosResp1.correcta);

    // Intentar responder la misma pregunta de nuevo debe fallar con 400
    const resDuplicada = await fetch(`http://localhost:${puerto}/api/quiz/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sesionId: datosSesion.sesionId,
        preguntaId: p1.id,
        respuesta: pDb1.correcta
      })
    });
    assert.equal(resDuplicada.status, 400);

    // Responder las restantes para tener al menos 70%
    for (let i = 1; i < datosSesion.preguntas.length; i++) {
      const p = datosSesion.preguntas[i];
      const pDb = preguntasDb.find(x => x.id === p.id);
      await fetch(`http://localhost:${puerto}/api/quiz/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sesionId: datosSesion.sesionId,
          preguntaId: p.id,
          // Responder correctamente
          respuesta: pDb.correcta
        })
      });
    }

    // 4.3 Finalizar quiz
    const resFin = await fetch(`http://localhost:${puerto}/api/quiz/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesionId: datosSesion.sesionId })
    });

    assert.equal(resFin.status, 200);
    const fin = await resFin.json();
    assert.equal(fin.aprobado, true);
    assert.equal(fin.porcentaje, 100);
    assert.equal(fin.aciertos, datosSesion.preguntas.length);
    assert.ok(Array.isArray(fin.repasar));
    assert.ok(typeof fin.puntosGanados === 'number');

    // Comprobar que logros.nivelQuiz se actualizó al nivel 1
    const logrosActualizados = await almacen.leer('logros');
    const miLogroFin = logrosActualizados.find(l => l && l.usuarioId === estudiante.id);
    assert.ok(miLogroFin.nivelQuiz['tem_000001'] >= 1);

    // No se puede finalizar dos veces
    const resFin2 = await fetch(`http://localhost:${puerto}/api/quiz/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesionId: datosSesion.sesionId })
    });
    assert.equal(resFin2.status, 400);
  } finally {
    server.close();
  }
});
