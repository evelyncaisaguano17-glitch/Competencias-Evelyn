// pruebas/ia.test.js · Pruebas automatizadas para Tarea P07.1 (Servicio de IA)
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sembrar } from '../servidor/semilla.js';
import * as almacen from '../servidor/almacen.js';
import { validarEsquema } from '../servidor/esquemas-ia.js';
import { ejecutarTarea, extraerJSON, establecerProveedorMock, probarConexion } from '../servidor/ia.js';
import prepararGenerarGlosario from '../servidor/preparadores/generar-glosario.js';
import iaRouter from '../servidor/rutas/ia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test.before(async () => {
  await sembrar({ forzar: true });
  const rutaConsumo = path.join(raiz, 'datos/consumo-ia.jsonl');
  if (fsSync.existsSync(rutaConsumo)) {
    await fsSync.promises.writeFile(rutaConsumo, '');
  }
});

test('1. servidor/esquemas-ia.js: validación de esquemas estructurados', () => {
  // 1.1 generar-glosario
  const glosarioValido = [
    {
      termino: 'Asepsia',
      definicion: 'Conjunto de métodos para evitar la infección',
      pista: 'Evita gérmenes',
      retroalimentacion: 'Fundamental en todo acto quirúrgico'
    }
  ];
  assert.equal(validarEsquema('generar-glosario', glosarioValido), true);
  assert.equal(validarEsquema('generar-glosario', []), false);
  assert.equal(validarEsquema('generar-glosario', [{ termino: 'Solo termino' }]), false);

  // 1.2 generar-preguntas
  const preguntasValidas = [
    {
      tipo: 'opcion',
      enunciado: '¿Cuál es la primera fase de la cicatrización?',
      opciones: ['Inflamatoria', 'Proliferativa', 'Remodelación'],
      correcta: 0,
      retroalimentacion: 'La fase inflamatoria se inicia inmediatamente.'
    }
  ];
  assert.equal(validarEsquema('generar-preguntas', preguntasValidas), true);
  assert.equal(validarEsquema('generar-preguntas', [{ tipo: 'opcion' }]), false);

  // 1.3 generar-escenario
  const escenarioValido = {
    titulo: 'Manejo de herida infectada',
    escenaInicial: 'esc_1',
    escenas: [{ id: 'esc_1', texto: 'El paciente llega con eritema.' }]
  };
  assert.equal(validarEsquema('generar-escenario', escenarioValido), true);
  assert.equal(validarEsquema('generar-escenario', { titulo: '' }), false);

  // 1.4 evaluar-rol
  const evaluacionValida = {
    puntaje: 8,
    maximo: 10,
    criterios: [{ nombre: 'Diagnóstico', puntos: 4 }],
    comentarioGeneral: 'Buen manejo clínico del caso.'
  };
  assert.equal(validarEsquema('evaluar-rol', evaluacionValida), true);
  assert.equal(validarEsquema('evaluar-rol', { puntaje: 8 }), false);
});

test('2. servidor/ia.js: extraerJSON parsea markdown y texto directo', () => {
  assert.deepEqual(extraerJSON('```json\n[{"clave": "valor"}]\n```'), [{ clave: 'valor' }]);
  assert.deepEqual(extraerJSON('Texto previo ```{"a": 1}``` texto posterior'), { a: 1 });
  assert.deepEqual(extraerJSON('{"mensaje": "hola"}'), { mensaje: 'hola' });
  assert.equal(extraerJSON('no es json'), null);
});

test('3. servidor/ia.js: ejecutarTarea con mock, esquemas, límites y registro en consumo-ia.jsonl', async () => {
  const usuario = { id: 'usu_000002', rol: 'docente' };

  // 3.1 Respuesta válida de generar-glosario
  const mockRespuesta = JSON.stringify([
    {
      termino: 'Sutura',
      definicion: 'Material empleado para aproximar bordes',
      pista: 'Hilo quirúrgico',
      retroalimentacion: 'Favorece el cierre por primera intención'
    }
  ]);

  establecerProveedorMock(async () => mockRespuesta);

  const resultado = await ejecutarTarea('generar-glosario', {
    asignatura: 'Cirugía',
    nivel: 'Quinto',
    tema: 'Heridas',
    contenido: 'Contenido de prueba',
    existentes: 'Ninguno',
    cantidad: 1,
    minimoSeisLetras: 1
  }, usuario, { formato: 'json' });

  assert.ok(Array.isArray(resultado));
  assert.equal(resultado[0].termino, 'Sutura');

  // Verificar registro en consumo-ia.jsonl (sin textos personales, solo caracteres)
  const lineasConsumo = await almacen.leerLineas('consumo-ia.jsonl');
  const ultimoConsumo = lineasConsumo[lineasConsumo.length - 1];
  assert.equal(ultimoConsumo.usuarioId, usuario.id);
  assert.equal(ultimoConsumo.tarea, 'generar-glosario');
  assert.equal(typeof ultimoConsumo.entrada, 'number');
  assert.equal(typeof ultimoConsumo.salida, 'number');
  assert.equal(ultimoConsumo.ok, true);

  // 3.2 Error 502 cuando la IA no devuelve formato válido ni en reintento
  establecerProveedorMock(async () => 'Texto plano sin formato json');
  await assert.rejects(
    async () => await ejecutarTarea('generar-glosario', {}, usuario, { formato: 'json' }),
    (err) => err.estado === 502
  );

  // 3.3 Validación de nombre de tarea inválido
  await assert.rejects(
    async () => await ejecutarTarea('tarea_invalida_con_mayusculas_O_simbolos!', {}, usuario),
    (err) => err.estado === 400
  );
});

test('4. servidor/preparadores/generar-glosario.js: valida tema, permisos y arma datos', async () => {
  const docente = { id: 'usu_000002', rol: 'docente' };

  // 4.1 Preparación exitosa
  const datos = await prepararGenerarGlosario({ temaId: 'tem_000001', cantidad: 8 }, docente);
  assert.ok(datos.asignatura, 'Debe incluir asignatura');
  assert.ok(datos.tema, 'Debe incluir título del tema');
  assert.ok(datos.contenido, 'Debe incluir objetivos/resumen');
  assert.equal(datos.cantidad, 8);
  assert.equal(datos.minimoSeisLetras, 3);

  // 4.2 Cantidad fuera de rango (5-20)
  await assert.rejects(
    async () => await prepararGenerarGlosario({ temaId: 'tem_000001', cantidad: 3 }, docente),
    (err) => err.estado === 400
  );

  // 4.3 Tema inexistente
  await assert.rejects(
    async () => await prepararGenerarGlosario({ temaId: 'tem_inexistente', cantidad: 10 }, docente),
    (err) => err.estado === 404
  );
});

function crearAppIA(usuario) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.usuario = usuario;
    next();
  });
  app.use('/api', iaRouter);
  return app;
}

test('5. servidor/rutas/ia.js: POST /api/ia/:tarea y GET /api/ia/prueba', async () => {
  const mockGlosario = [
    {
      termino: 'Drenaje',
      definicion: 'Tubo para evacuar colecciones líquidas',
      pista: 'Evacua fluidos',
      retroalimentacion: 'Previene hematomas e infecciones'
    }
  ];

  establecerProveedorMock(async ({ mensajeUsuario }) => {
    if (mensajeUsuario.includes('OK')) return 'OK';
    return JSON.stringify(mockGlosario);
  });

  const docente = { id: 'usu_000002', rol: 'docente' };
  const estudiante = { id: 'usu_000004', rol: 'estudiante' };
  const admin = { id: 'usu_000001', rol: 'admin' };

  const appDocente = crearAppIA(docente);
  const server = appDocente.listen(0);
  const puerto = server.address().port;

  try {
    // 5.1 Docente ejecuta POST /api/ia/generar-glosario con éxito
    const resPost = await fetch(`http://localhost:${puerto}/api/ia/generar-glosario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temaId: 'tem_000001', cantidad: 5 })
    });
    assert.equal(resPost.status, 200);
    const json = await resPost.json();
    assert.ok(Array.isArray(json));
    assert.equal(json[0].termino, 'Drenaje');

    // 5.2 Tarea sin preparador devuelve 404
    const res404 = await fetch(`http://localhost:${puerto}/api/ia/tarea-que-no-existe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res404.status, 404);
  } finally {
    server.close();
  }

  // 5.3 Estudiante rechazado en generar-* con 403
  const appEstudiante = crearAppIA(estudiante);
  const serverEst = appEstudiante.listen(0);
  const puertoEst = serverEst.address().port;

  try {
    const resProhibido = await fetch(`http://localhost:${puertoEst}/api/ia/generar-glosario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temaId: 'tem_000001' })
    });
    assert.equal(resProhibido.status, 403);
  } finally {
    serverEst.close();
  }

  // 5.4 GET /api/ia/prueba: admin OK, docente 403
  const appAdmin = crearAppIA(admin);
  const serverAdmin = appAdmin.listen(0);
  const puertoAdmin = serverAdmin.address().port;

  try {
    const resPrueba = await fetch(`http://localhost:${puertoAdmin}/api/ia/prueba`);
    assert.equal(resPrueba.status, 200);
    const jsonPrueba = await resPrueba.json();
    assert.equal(jsonPrueba.ok, true);
    assert.equal(jsonPrueba.respuesta, 'OK');
  } finally {
    serverAdmin.close();
  }

  // Restablecer mock
  establecerProveedorMock(null);
});
