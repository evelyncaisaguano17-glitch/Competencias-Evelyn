// pruebas/banco-preguntas.test.js · Pruebas unitarias para Tarea P08.1 (Banco de preguntas)
import test from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU } from '../publico/js/nucleo/menu.js';
import * as almacen from '../servidor/almacen.js';
import { sembrar } from '../servidor/semilla.js';
import prepararGenerarPreguntas from '../servidor/preparadores/generar-preguntas.js';
import ganchosPreguntas from '../servidor/ganchos/preguntas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test.before(async () => {
  await sembrar({ forzar: true });
});

test('1. menu.js y permisos.json · Integridad de rutas y permisos para Banco de preguntas', () => {
  // menu.js
  const itemMenu = MENU.find((m) => m.texto === 'Banco de preguntas');
  assert.ok(itemMenu, 'Debe existir "Banco de preguntas" en MENU');
  assert.equal(itemMenu.href, '/paginas/banco-preguntas.html');
  assert.deepEqual(itemMenu.roles, ['docente', 'admin']);

  // permisos.json
  const permisos = JSON.parse(fsSync.readFileSync(path.join(raiz, 'datos/config/permisos.json'), 'utf-8'));
  assert.ok(permisos.preguntas, 'Debe existir la colección preguntas en permisos.json');
  assert.deepEqual(permisos.preguntas.leer, ['docente', 'admin'], 'Lectura solo para docente y admin');
  assert.deepEqual(permisos.preguntas.escribir, ['docente', 'admin'], 'Escritura solo para docente y admin');
});

test('2. servidor/ganchos/preguntas.js · Control de acceso por rol y asignatura', async () => {
  const usuarios = await almacen.leer('usuarios');
  const docente = usuarios.find((u) => u.rol === 'docente');
  const estudiante = usuarios.find((u) => u.rol === 'estudiante');
  const admin = usuarios.find((u) => u.rol === 'admin');

  // Estudiantes nunca leen preguntas
  const listaPrueba = [
    { id: 'pre_000001', temaId: 'tem_000001', nivel: 1, enunciado: 'Pregunta 1' },
    { id: 'pre_000002', temaId: 'tem_000002', nivel: 2, enunciado: 'Pregunta 2' }
  ];

  const resultadoEstudiante = await ganchosPreguntas.filtrarLista(listaPrueba, estudiante);
  assert.deepEqual(resultadoEstudiante, [], 'Estudiantes deben recibir lista vacía');

  const resultadoAdmin = await ganchosPreguntas.filtrarLista(listaPrueba, admin);
  assert.equal(resultadoAdmin.length, 2, 'Admin debe ver todas las preguntas');

  const resultadoDocente = await ganchosPreguntas.filtrarLista(listaPrueba, docente);
  assert.ok(Array.isArray(resultadoDocente), 'Docente debe recibir un arreglo filtrado');

  // Rechazo antes de guardar para estudiantes
  await assert.rejects(
    async () => {
      await ganchosPreguntas.antesDeGuardar({ temaId: 'tem_000001' }, estudiante);
    },
    (err) => err.estado === 403,
    'Debe rechazar guardado con 403 si el usuario es estudiante'
  );

  // Validación de temaId obligatorio
  await assert.rejects(
    async () => {
      await ganchosPreguntas.antesDeGuardar({}, docente);
    },
    (err) => err.estado === 400,
    'Debe rechazar con 400 si falta temaId'
  );
});

test('3. servidor/preparadores/generar-preguntas.js · Validaciones y armado de payload para el prompt', async () => {
  const usuarios = await almacen.leer('usuarios');
  const docente1 = usuarios.find((u) => u.correo === 'docente1@demo.ec');
  const docente2 = usuarios.find((u) => u.correo === 'docente2@demo.ec');

  // Validación de temaId
  await assert.rejects(
    async () => {
      await prepararGenerarPreguntas({ nivel: 1, cantidad: 10 }, docente1);
    },
    (err) => err.estado === 400,
    'Debe rechazar si falta temaId'
  );

  // Validación de nivel (1 a 5)
  await assert.rejects(
    async () => {
      await prepararGenerarPreguntas({ temaId: 'tem_000001', nivel: 0, cantidad: 10 }, docente1);
    },
    (err) => err.estado === 400,
    'Debe rechazar nivel 0'
  );
  await assert.rejects(
    async () => {
      await prepararGenerarPreguntas({ temaId: 'tem_000001', nivel: 6, cantidad: 10 }, docente1);
    },
    (err) => err.estado === 400,
    'Debe rechazar nivel 6'
  );

  // Validación de cantidad (5 a 15)
  await assert.rejects(
    async () => {
      await prepararGenerarPreguntas({ temaId: 'tem_000001', nivel: 2, cantidad: 4 }, docente1);
    },
    (err) => err.estado === 400,
    'Debe rechazar cantidad menor a 5'
  );
  await assert.rejects(
    async () => {
      await prepararGenerarPreguntas({ temaId: 'tem_000001', nivel: 2, cantidad: 16 }, docente1);
    },
    (err) => err.estado === 400,
    'Debe rechazar cantidad mayor a 15'
  );

  // Docente con permiso sobre tem_000001 (Cirugía)
  const datos = await prepararGenerarPreguntas(
    { temaId: 'tem_000001', nivel: 3, cantidad: 10 },
    docente1
  );

  assert.ok(datos, 'Debe devolver datos preparados');
  assert.equal(datos.asignatura, 'CIRUGÍA');
  assert.equal(datos.nivel, 'PREGRADO');
  assert.ok(datos.tema.includes('Heridas') || datos.tema.length > 0);
  assert.ok(datos.contenido.length > 0);
  assert.equal(datos.nivelBloom, '3 Aplicar');
  assert.equal(datos.cantidad, 10);
  assert.ok(typeof datos.glosario === 'string');
  assert.ok(typeof datos.existentes === 'string');
});

test('4. Integridad de archivos de interfaz: banco-preguntas.html, banco-preguntas.css y banco-preguntas.js', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/banco-preguntas.html');
  const rutaCss = path.join(raiz, 'publico/css/modulos/banco-preguntas.css');
  const rutaJs = path.join(raiz, 'publico/js/modulos/banco-preguntas.js');

  assert.ok(fsSync.existsSync(rutaHtml), 'banco-preguntas.html debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'banco-preguntas.css debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'banco-preguntas.js debe existir');

  const html = fsSync.readFileSync(rutaHtml, 'utf-8');
  assert.ok(html.includes('/css/tokens.css'), 'HTML debe enlazar tokens.css');
  assert.ok(html.includes('/css/componentes.css'), 'HTML debe enlazar componentes.css');
  assert.ok(html.includes('/css/modulos/banco-preguntas.css'), 'HTML debe enlazar banco-preguntas.css');
  assert.ok(html.includes('/js/modulos/banco-preguntas.js'), 'HTML debe cargar banco-preguntas.js');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: [\'docente\', \'admin\']') || js.includes('roles: ["docente", "admin"]'), 'Debe exigir roles docente y admin');
  assert.ok(js.includes('api.listar(\'preguntas\'') || js.includes('api.listar("preguntas"'), 'Debe listar preguntas con api');
  assert.ok(js.includes('api.ia(\'generar-preguntas\'') || js.includes('api.ia("generar-preguntas"'), 'Debe llamar api.ia con generar-preguntas');
  assert.ok(js.includes('origen: \'ia\'') || js.includes('origen: "ia"'), 'Debe registrar con origen ia');
  assert.ok(js.includes('estado: \'aprobado\'') || js.includes('estado: "aprobado"'), 'Debe registrar con estado aprobado');
  assert.ok(js.includes('Nivel 1') || js.includes('Recordar'), 'Debe incluir taxonomía de Bloom');
});
