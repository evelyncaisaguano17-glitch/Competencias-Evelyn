// pruebas/academico.test.js · Pruebas unitarias para Tarea P02.1 (Colecciones académicas y acceso por grupo)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as almacen from '../servidor/almacen.js';
import * as acceso from '../servidor/acceso.js';
import * as ganchosUnidades from '../servidor/ganchos/unidades.js';
import * as ganchosTemas from '../servidor/ganchos/temas.js';
import * as ganchosGlosario from '../servidor/ganchos/glosario.js';
import * as ganchosProgreso from '../servidor/ganchos/progreso-temas.js';
import { app } from '../servidor/server.js';
import { Readable } from 'node:stream';

async function subirSimulado(token, { nombreArchivo, contenido, tipoMime }) {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const bodyBuffer = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="archivo"; filename="${nombreArchivo}"\r\n` +
      `Content-Type: ${tipoMime}\r\n\r\n`
    ),
    Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const req = Readable.from([bodyBuffer]);
  req.method = 'POST';
  req.url = '/api/subidas';
  req.originalUrl = '/api/subidas';
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(bodyBuffer.length)
  };

  if (token) {
    req.headers['authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve) => {
    let estado = 200;
    let cuerpoRespuesta = null;

    const res = {
      statusCode: 200,
      status(code) {
        estado = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        cuerpoRespuesta = data;
        resolve({ estado, cuerpo: cuerpoRespuesta });
      },
      send(data) {
        cuerpoRespuesta = data;
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

test('1. servidor/acceso.js · Funciones de acceso académico', async () => {
  // Datos de prueba en memoria
  const asignaturasPrueba = [
    { id: 'asig_01', nombre: 'Matemáticas' },
    { id: 'asig_02', nombre: 'Lengua' }
  ];
  const distributivoPrueba = [
    { id: 'dis_01', asignaturaId: 'asig_01', paralelo: 'A', docenteId: 'doc_1', estudiantes: ['est_1', 'est_2'] },
    { id: 'dis_02', asignaturaId: 'asig_02', paralelo: 'B', docenteId: 'doc_2', estudiantes: ['est_2', 'est_3'] }
  ];
  const unidadesPrueba = [
    { id: 'uni_01', asignaturaId: 'asig_01', titulo: 'Álgebra', visible: true },
    { id: 'uni_02', asignaturaId: 'asig_01', titulo: 'Geometría oculta', visible: false },
    { id: 'uni_03', asignaturaId: 'asig_02', titulo: 'Gramática', visible: true }
  ];
  const temasPrueba = [
    { id: 'tem_01', unidadId: 'uni_01', titulo: 'Ecuaciones', estado: 'publicado' },
    { id: 'tem_02', unidadId: 'uni_01', titulo: 'Borrador', estado: 'borrador' }
  ];

  await almacen.escribir('asignaturas', asignaturasPrueba);
  await almacen.escribir('distributivo', distributivoPrueba);
  await almacen.escribir('unidades', unidadesPrueba);
  await almacen.escribir('temas', temasPrueba);

  const admin = { id: 'admin_1', rol: 'admin' };
  const docente1 = { id: 'doc_1', rol: 'docente' };
  const estudiante1 = { id: 'est_1', rol: 'estudiante' };
  const estudiante2 = { id: 'est_2', rol: 'estudiante' };

  // gruposDe
  assert.equal((await acceso.gruposDe(admin)).length, 2);
  const gruposDoc1 = await acceso.gruposDe(docente1);
  assert.equal(gruposDoc1.length, 1);
  assert.equal(gruposDoc1[0].id, 'dis_01');

  const gruposEst1 = await acceso.gruposDe(estudiante1);
  assert.equal(gruposEst1.length, 1);
  assert.equal(gruposEst1[0].id, 'dis_01');

  const gruposEst2 = await acceso.gruposDe(estudiante2);
  assert.equal(gruposEst2.length, 2);

  // asignaturasDe
  assert.equal((await acceso.asignaturasDe(admin)).length, 2);
  const asigDoc1 = await acceso.asignaturasDe(docente1);
  assert.equal(asigDoc1.length, 1);
  assert.equal(asigDoc1[0].id, 'asig_01');

  // asignaturaDeTema
  assert.equal(await acceso.asignaturaDeTema('tem_01'), 'asig_01');
  assert.equal(await acceso.asignaturaDeTema('no_existe'), null);

  // puedeEditarAsignatura
  assert.equal(await acceso.puedeEditarAsignatura(admin, 'asig_01'), true);
  assert.equal(await acceso.puedeEditarAsignatura(docente1, 'asig_01'), true);
  assert.equal(await acceso.puedeEditarAsignatura(docente1, 'asig_02'), false);
  assert.equal(await acceso.puedeEditarAsignatura(estudiante1, 'asig_01'), false);

  // estudiantesDe y docentesDe
  const estsDeDoc1 = await acceso.estudiantesDe('doc_1');
  assert.deepEqual(estsDeDoc1.sort(), ['est_1', 'est_2']);

  const docsDeEst2 = await acceso.docentesDe('est_2');
  assert.deepEqual(docsDeEst2.sort(), ['doc_1', 'doc_2']);
});

test('2. permisos.json · Configuración de colecciones académicas', async () => {
  const permisos = await almacen.leerConfig('permisos');

  assert.deepEqual(permisos.asignaturas, { leer: ['sesion'], escribir: ['admin'] });
  assert.deepEqual(permisos.distributivo, { leer: ['sesion'], escribir: ['admin'] });
  assert.deepEqual(permisos.unidades, { leer: ['sesion'], escribir: ['docente', 'admin'] });
  assert.deepEqual(permisos.temas, { leer: ['sesion'], escribir: ['docente', 'admin'] });
  assert.deepEqual(permisos.glosario, { leer: ['sesion'], escribir: ['docente', 'admin'] });
  assert.deepEqual(permisos['progreso-temas'], { leer: ['propio', 'docente', 'admin'], escribir: ['estudiante'] });
});

test('3. servidor/ganchos/ · Reglas de filtrado y antesDeGuardar', async () => {
  const admin = { id: 'admin_1', rol: 'admin' };
  const docente1 = { id: 'doc_1', rol: 'docente' };
  const docente2 = { id: 'doc_2', rol: 'docente' };
  const estudiante1 = { id: 'est_1', rol: 'estudiante' };

  // Ganchos Unidades
  const unidades = await almacen.leer('unidades');
  const visEstudiante = await ganchosUnidades.filtrarLista(unidades, estudiante1);
  assert.ok(!visEstudiante.some(u => u.visible === false), 'Estudiante no debe ver unidades invisibles');

  // antesDeGuardar en unidades: docente2 no tiene permiso en asig_01
  await assert.rejects(
    async () => await ganchosUnidades.antesDeGuardar({ asignaturaId: 'asig_01' }, docente2, null),
    (err) => err.estado === 403
  );

  // Ganchos Temas
  const temas = await almacen.leer('temas');
  const temasEst = await ganchosTemas.filtrarLista(temas, estudiante1);
  assert.ok(temasEst.every(t => t.estado === 'publicado'), 'Estudiante solo debe ver temas publicados');

  // antesDeGuardar en temas: docente2 no puede en unidad de asig_01
  await assert.rejects(
    async () => await ganchosTemas.antesDeGuardar({ unidadId: 'uni_01' }, docente2, null),
    (err) => err.estado === 403
  );

  // Ganchos Glosario
  const glosarioPrueba = [
    { id: 'glo_01', temaId: 'tem_01', termino: 'Incógnita', estado: 'aprobado' },
    { id: 'glo_02', temaId: 'tem_01', termino: 'Pendiente', estado: 'pendiente' }
  ];
  await almacen.escribir('glosario', glosarioPrueba);
  const gloEst = await ganchosGlosario.filtrarLista(glosarioPrueba, estudiante1);
  assert.equal(gloEst.length, 1);
  assert.equal(gloEst[0].estado, 'aprobado');

  // Ganchos Progreso-temas
  await almacen.escribir('progreso-temas', []);
  const prog1 = await ganchosProgreso.antesDeGuardar({ temaId: 'tem_01' }, estudiante1, null);
  assert.equal(prog1.usuarioId, 'est_1');
  await almacen.agregar('progreso-temas', prog1);

  // Duplicado debe ser rechazado
  await assert.rejects(
    async () => await ganchosProgreso.antesDeGuardar({ temaId: 'tem_01' }, estudiante1, null),
    (err) => err.estado === 400
  );

  // Docente en progreso-temas solo ve a sus estudiantes
  const todosProg = await almacen.leer('progreso-temas');
  const progDoc1 = await ganchosProgreso.filtrarLista(todosProg, docente1);
  assert.equal(progDoc1.length, 1);
  const progDoc2 = await ganchosProgreso.filtrarLista(todosProg, docente2);
  assert.equal(progDoc2.length, 0); // est_1 no es estudiante de doc_2
});

test('4. servidor/rutas/subidas.js · PDFs y MP3 para docentes y admin hasta maxSubidaMB', async () => {
  // Crear usuarios de prueba
  const uDocente = await almacen.agregar('usuarios', {
    nombre: 'Prof',
    apellido: 'Doc',
    correo: `prof.${Date.now()}@ejemplo.com`,
    rol: 'docente',
    activo: true
  });
  const tokDocente = `tok_doc_${Date.now()}`;
  await almacen.agregar('sesiones', {
    token: tokDocente,
    usuarioId: uDocente.id,
    expira: new Date(Date.now() + 60000).toISOString()
  });

  const uEst = await almacen.agregar('usuarios', {
    nombre: 'Est',
    apellido: 'Est',
    correo: `est.${Date.now()}@ejemplo.com`,
    rol: 'estudiante',
    activo: true
  });
  const tokEst = `tok_est_${Date.now()}`;
  await almacen.agregar('sesiones', {
    token: tokEst,
    usuarioId: uEst.id,
    expira: new Date(Date.now() + 60000).toISOString()
  });

  // Docente sube PDF
  const resPdf = await subirSimulado(tokDocente, {
    nombreArchivo: 'guia.pdf',
    contenido: '%PDF-1.4 prueba',
    tipoMime: 'application/pdf'
  });
  assert.equal(resPdf.estado, 201);
  assert.ok(resPdf.cuerpo.url.endsWith('.pdf'));

  // Docente sube MP3
  const resMp3 = await subirSimulado(tokDocente, {
    nombreArchivo: 'cancion.mp3',
    contenido: 'ID3audio',
    tipoMime: 'audio/mpeg'
  });
  assert.equal(resMp3.estado, 201);
  assert.ok(resMp3.cuerpo.url.endsWith('.mp3'));

  // Estudiante intenta subir PDF -> debe ser rechazado
  const resEstPdf = await subirSimulado(tokEst, {
    nombreArchivo: 'documento.pdf',
    contenido: '%PDF-1.4',
    tipoMime: 'application/pdf'
  });
  assert.equal(resEstPdf.estado, 400);
  assert.ok(resEstPdf.cuerpo.error.includes('JPG, PNG o WEBP'));
});
