// pruebas/gamificacion-servidor.test.js · Pruebas unitarias para Tarea P04.1 (Motor de gamificación)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. permisos.json · Configuración de intentos, logros e insignias', () => {
  const permisosPath = path.join(raiz, 'datos', 'config', 'permisos.json');
  const permisos = JSON.parse(fs.readFileSync(permisosPath, 'utf-8'));

  assert.ok(permisos.intentos, 'intentos debe existir en permisos.json');
  assert.deepEqual(permisos.intentos.leer, ['propio', 'docente', 'admin']);
  assert.deepEqual(permisos.intentos.escribir, ['servidor']);

  assert.ok(permisos.logros, 'logros debe existir en permisos.json');
  assert.deepEqual(permisos.logros.leer, ['propio', 'docente', 'admin']);
  assert.deepEqual(permisos.logros.escribir, ['servidor']);

  assert.ok(permisos.insignias, 'insignias debe existir en permisos.json');
  assert.deepEqual(permisos.insignias.leer, ['sesion']);
  assert.deepEqual(permisos.insignias.escribir, ['admin']);
});

test('2. servidor/ganchos/ · Filtrado de lista en intentos y logros', async () => {
  const ganchosIntentos = await import('../servidor/ganchos/intentos.js');
  const ganchosLogros = await import('../servidor/ganchos/logros.js');
  const almacen = await import('../servidor/almacen.js');

  assert.equal(typeof ganchosIntentos.filtrarLista, 'function');
  assert.equal(typeof ganchosLogros.filtrarLista, 'function');

  // Crear un distributivo de prueba
  const asig = await almacen.agregar('asignaturas', { nombre: 'Gamif Asig', nivel: 'MEDIA' });
  const docId = 'usu_doc_gamif_' + Date.now();
  const est1Id = 'usu_est1_gamif_' + Date.now();
  const est2Id = 'usu_est2_gamif_' + Date.now();
  const estAjenoId = 'usu_est_ajeno_' + Date.now();

  const dist = await almacen.agregar('distributivo', {
    asignaturaId: asig.id,
    paralelo: 'G',
    periodo: '2026-2027',
    docenteId: docId,
    estudiantes: [est1Id, est2Id]
  });

  const listaMock = [
    { id: '1', usuarioId: est1Id, puntos: 10 },
    { id: '2', usuarioId: est2Id, puntos: 20 },
    { id: '3', usuarioId: estAjenoId, puntos: 30 }
  ];

  // Admin ve todo
  const adminRes = await ganchosIntentos.filtrarLista(listaMock, { id: 'admin', rol: 'admin' });
  assert.equal(adminRes.length, 3);

  // Docente ve solo los de sus estudiantes
  const docRes = await ganchosIntentos.filtrarLista(listaMock, { id: docId, rol: 'docente' });
  assert.equal(docRes.length, 2);
  assert.ok(docRes.some(i => i.usuarioId === est1Id));
  assert.ok(docRes.some(i => i.usuarioId === est2Id));
  assert.ok(!docRes.some(i => i.usuarioId === estAjenoId));

  // Estudiante ve solo el propio
  const estRes = await ganchosIntentos.filtrarLista(listaMock, { id: est1Id, rol: 'estudiante' });
  assert.equal(estRes.length, 1);
  assert.equal(estRes[0].usuarioId, est1Id);

  // Mismo comportamiento para logros
  const docLogros = await ganchosLogros.filtrarLista(listaMock, { id: docId, rol: 'docente' });
  assert.equal(docLogros.length, 2);

  // Limpieza
  await almacen.eliminar('asignaturas', asig.id);
  await almacen.eliminar('distributivo', dist.id);
});

test('3. servidor/gamificacion.js · Validaciones y control de tasa (429)', async () => {
  const { procesarIntento, limpiarLimiteHora } = await import('../servidor/gamificacion.js');
  const usuario = { id: 'usu_val_' + Date.now(), rol: 'estudiante' };

  // 1. Actividad no válida
  await assert.rejects(
    async () => {
      await procesarIntento(usuario, { actividad: 'invalida', puntaje: 10, maximo: 10 });
    },
    err => err.estado === 400
  );

  // 2. Puntaje inválido
  await assert.rejects(
    async () => {
      await procesarIntento(usuario, { actividad: 'ahorcado', puntaje: -1, maximo: 10 });
    },
    err => err.estado === 400
  );
  await assert.rejects(
    async () => {
      await procesarIntento(usuario, { actividad: 'ahorcado', puntaje: 15, maximo: 10 });
    },
    err => err.estado === 400
  );
  await assert.rejects(
    async () => {
      await procesarIntento(usuario, { actividad: 'ahorcado', puntaje: 5, maximo: 0 });
    },
    err => err.estado === 400
  );

  // 3. Tema sin acceso
  await assert.rejects(
    async () => {
      await procesarIntento(usuario, { actividad: 'ahorcado', puntaje: 10, maximo: 10, temaId: 'tema_inexistente' });
    },
    err => err.estado === 404
  );

  // 4. Límite de intentos por hora (429)
  limpiarLimiteHora();
  const testUser = { id: 'usu_rate_' + Date.now(), rol: 'admin' };
  for (let i = 0; i < 60; i++) {
    await procesarIntento(testUser, { actividad: 'foro', puntaje: 1, maximo: 1 });
  }
  await assert.rejects(
    async () => {
      await procesarIntento(testUser, { actividad: 'foro', puntaje: 1, maximo: 1 });
    },
    err => err.estado === 429
  );
  limpiarLimiteHora();
});

test('4. servidor/gamificacion.js · Cálculo de puntos, bono y reglas de exclusión', async () => {
  const { procesarIntento, limpiarLimiteHora } = await import('../servidor/gamificacion.js');
  limpiarLimiteHora();
  const usuario = { id: 'usu_puntos_' + Date.now(), rol: 'admin' };

  // Ahorcado base: 10 puntos. Sin errores y maximo: +5 bono = 15 puntos
  const res1 = await procesarIntento(usuario, {
    actividad: 'ahorcado',
    puntaje: 10,
    maximo: 10,
    errores: 0
  });
  assert.equal(res1.puntosGanados, 15);
  assert.equal(res1.puntosTotales, 15);

  // Con errores: 50% de puntaje sin bono -> Math.round(10 * 5 / 10) = 5
  const res2 = await procesarIntento(usuario, {
    actividad: 'ahorcado',
    puntaje: 5,
    maximo: 10,
    errores: 2
  });
  assert.equal(res2.puntosGanados, 5);
  assert.equal(res2.puntosTotales, 20);

  // Actividad requiereAprobado (quiz): si detalle.aprobado !== true -> 0 puntos
  const resQuizReprobado = await procesarIntento(usuario, {
    actividad: 'quiz',
    puntaje: 5,
    maximo: 10,
    errores: 5,
    detalle: { aprobado: false }
  });
  assert.equal(resQuizReprobado.puntosGanados, 0);

  // Actividad requiereAprobado (quiz): aprobado true -> obtiene puntos
  const resQuizAprobado = await procesarIntento(usuario, {
    actividad: 'quiz',
    temaId: null,
    nivel: 1,
    puntaje: 10,
    maximo: 10,
    errores: 0,
    detalle: { aprobado: true }
  });
  assert.equal(resQuizAprobado.puntosGanados, 55); // 50 base + 5 bono

  // Actividad única (quiz con mismo temaId y nivel ya completado con puntos) -> 0 puntos
  const resQuizDuplicado = await procesarIntento(usuario, {
    actividad: 'quiz',
    temaId: null,
    nivel: 1,
    puntaje: 10,
    maximo: 10,
    errores: 0,
    detalle: { aprobado: true }
  });
  assert.equal(resQuizDuplicado.puntosGanados, 0, 'Intento único repetido debe dar 0 puntos');
});

test('5. servidor/gamificacion.js · Evaluación de insignias y alertas', async () => {
  const { procesarIntento, limpiarLimiteHora } = await import('../servidor/gamificacion.js');
  limpiarLimiteHora();
  const usuario = { id: 'usu_insignias_' + Date.now(), rol: 'admin' };

  // Ahorcado sin errores otorga 'palabra-perfecta'
  const resAhorcado = await procesarIntento(usuario, {
    actividad: 'ahorcado',
    puntaje: 10,
    maximo: 10,
    errores: 0
  });
  assert.ok(resAhorcado.insigniasNuevas.some(ins => ins.id === 'palabra-perfecta'));

  // Aprobar nivel 1 del quiz otorga 'nivel-1'
  const resNivel1 = await procesarIntento(usuario, {
    actividad: 'quiz',
    nivel: 1,
    puntaje: 10,
    maximo: 10,
    errores: 0,
    detalle: { aprobado: true }
  });
  assert.ok(resNivel1.insigniasNuevas.some(ins => ins.id === 'nivel-1'));

  // Completar simulación otorga 'en-la-practica'
  const resSim = await procesarIntento(usuario, {
    actividad: 'simulacion',
    puntaje: 10,
    maximo: 10,
    detalle: { simulacionId: 'sim_001' }
  });
  assert.ok(resSim.insigniasNuevas.some(ins => ins.id === 'en-la-practica'));
});

test('6. servidor/rutas/gamificacion.js · Integridad de rutas POST /intentos y GET /logros/:usuarioId', async () => {
  const { default: router } = await import('../servidor/rutas/gamificacion.js');
  assert.ok(router, 'El router de gamificacion debe exportarse por defecto');

  // Verificar que existen las capas de ruta registradas
  const rutasRegistradas = router.stack.map(layer => ({
    path: layer.route?.path,
    methods: Object.keys(layer.route?.methods || {})
  }));

  assert.ok(rutasRegistradas.some(r => r.path === '/intentos' && r.methods.includes('post')));
  assert.ok(rutasRegistradas.some(r => r.path === '/logros/:usuarioId' && r.methods.includes('get')));
});
