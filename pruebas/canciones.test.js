// pruebas/canciones.test.js · Pruebas para Tarea P03.2 (Canciones educativas)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. permisos.json · Configuración de canciones', () => {
  const permisosPath = path.join(raiz, 'datos', 'config', 'permisos.json');
  const permisos = JSON.parse(fs.readFileSync(permisosPath, 'utf-8'));

  assert.ok(permisos.canciones, 'Debe existir la colección canciones en permisos.json');
  assert.deepEqual(permisos.canciones.leer, ['sesion'], 'canciones.leer debe ser ["sesion"]');
  assert.deepEqual(permisos.canciones.escribir, ['docente', 'admin'], 'canciones.escribir debe ser ["docente", "admin"]');
});

test('2. servidor/ganchos/canciones.js · Reglas de acceso y edición', async () => {
  const { default: ganchosCanciones } = await import('../servidor/ganchos/canciones.js');
  const almacen = await import('../servidor/almacen.js');

  assert.equal(typeof ganchosCanciones.filtrarLista, 'function');
  assert.equal(typeof ganchosCanciones.antesDeGuardar, 'function');

  // Crear asignatura, unidad y tema de prueba
  const asig = await almacen.agregar('asignaturas', { nombre: 'Música Test', nivel: 'BÁSICA' });
  const uni = await almacen.agregar('unidades', { asignaturaId: asig.id, titulo: 'Unidad Musical', orden: 1 });
  const tema = await almacen.agregar('temas', { unidadId: uni.id, titulo: 'Tema Canción', orden: 1 });

  // Crear distributivo para vincular a un docente
  const dist = await almacen.agregar('distributivo', {
    asignaturaId: asig.id,
    paralelo: 'M',
    periodo: '2026-2027',
    docenteId: 'usu_docente_musica',
    estudiantes: ['usu_estudiante_musica']
  });

  const usuarioDocente = { id: 'usu_docente_musica', rol: 'docente' };
  const usuarioOtroDocente = { id: 'usu_otro_docente', rol: 'docente' };
  const usuarioAdmin = { id: 'usu_admin_musica', rol: 'admin' };
  const usuarioEstudiante = { id: 'usu_estudiante_musica', rol: 'estudiante' };

  // 1. antesDeGuardar permite al docente de la asignatura
  const cancionDatos = {
    titulo: 'Canción de prueba',
    temaId: tema.id,
    audio: '/subidas/audio.mp3',
    autoria: 'Profesor Música',
    licencia: 'CC BY'
  };

  const guardadoDoc = await ganchosCanciones.antesDeGuardar(cancionDatos, usuarioDocente, null);
  assert.equal(guardadoDoc.titulo, 'Canción de prueba');

  // 2. antesDeGuardar rechaza a docente no asignado
  await assert.rejects(
    async () => {
      await ganchosCanciones.antesDeGuardar(cancionDatos, usuarioOtroDocente, null);
    },
    (err) => err.estado === 403
  );

  // 3. filtrarLista para estudiante devuelve solo canciones de sus asignaturas
  const listaCanciones = [
    { id: 'c1', temaId: tema.id, titulo: 'Canción accesible' },
    { id: 'c2', temaId: 'tema_inexistente', titulo: 'Canción ajena' }
  ];

  const filtradasEst = await ganchosCanciones.filtrarLista(listaCanciones, usuarioEstudiante);
  assert.equal(filtradasEst.length, 1);
  assert.equal(filtradasEst[0].id, 'c1');

  // 4. Admin ve todas las canciones
  const filtradasAdmin = await ganchosCanciones.filtrarLista(listaCanciones, usuarioAdmin);
  assert.equal(filtradasAdmin.length, 2);

  // Limpiar datos de prueba
  await almacen.eliminar('distributivo', dist.id);
  await almacen.eliminar('temas', tema.id);
  await almacen.eliminar('unidades', uni.id);
  await almacen.eliminar('asignaturas', asig.id);
});

test('3. Integridad de páginas y módulos de Canciones', () => {
  const archivos = [
    'publico/paginas/editor-cancion.html',
    'publico/css/modulos/editor-cancion.css',
    'publico/js/modulos/editor-cancion.js',
    'publico/paginas/canciones.html',
    'publico/css/modulos/canciones.css',
    'publico/js/modulos/canciones.js'
  ];

  for (const f of archivos) {
    assert.ok(fs.existsSync(path.join(raiz, f)), `${f} debe existir`);
  }

  const editorHtml = fs.readFileSync(path.join(raiz, 'publico/paginas/editor-cancion.html'), 'utf-8');
  assert.ok(editorHtml.includes('id="cancion-titulo"'), 'editor debe tener título');
  assert.ok(editorHtml.includes('id="cancion-tema"'), 'editor debe tener tema');
  assert.ok(editorHtml.includes('id="cancion-audio"'), 'editor debe tener audio');
  assert.ok(editorHtml.includes('id="cancion-autoria"'), 'editor debe tener autoría');
  assert.ok(editorHtml.includes('id="cancion-licencia"'), 'editor debe tener licencia');
  assert.ok(editorHtml.includes('id="cancion-lrc"'), 'editor debe tener LRC opcional');

  const cancionesHtml = fs.readFileSync(path.join(raiz, 'publico/paginas/canciones.html'), 'utf-8');
  assert.ok(cancionesHtml.includes('id="filtro-asignatura"'), 'canciones.html debe tener filtro por asignatura');
  assert.ok(cancionesHtml.includes('id="filtro-tema"'), 'canciones.html debe tener filtro por tema');
  assert.ok(cancionesHtml.includes('id="audio-elemento"'), 'canciones.html debe tener audio elemento');
  assert.ok(cancionesHtml.includes('id="barra-progreso"'), 'canciones.html debe tener barra de progreso');
  assert.ok(cancionesHtml.includes('id="contenedor-letras"'), 'canciones.html debe tener contenedor de letras');
});

test('4. Funciones utilitarias de canciones.js (LRC y tiempo)', async () => {
  const { parsearLRC, formatoTiempo } = await import('../publico/js/modulos/canciones.js');

  assert.equal(formatoTiempo(0), '00:00');
  assert.equal(formatoTiempo(65), '01:05');
  assert.equal(formatoTiempo(135.8), '02:15');

  const lrcMuestra = `
[00:04.50] Primera estrofa
[00:10.20] Segunda línea
[01:02.00] Coro principal
  `;
  const lineas = parsearLRC(lrcMuestra);
  assert.equal(lineas.length, 3);
  assert.equal(lineas[0].tiempo, 4.5);
  assert.equal(lineas[0].texto, 'Primera estrofa');
  assert.equal(lineas[1].tiempo, 10.2);
  assert.equal(lineas[2].tiempo, 62);
  assert.equal(lineas[2].texto, 'Coro principal');
});

test('5. menu.js y catalogo-actividades.js · Registro de actividad y menú', async () => {
  const { MENU } = await import('../publico/js/nucleo/menu.js');
  const item = MENU.find(m => m.texto === 'Canciones');
  assert.ok(item, 'menu.js debe incluir Canciones');
  assert.equal(item.href, '/paginas/canciones.html');
  assert.deepEqual(item.roles, ['sesion']);

  const { ACTIVIDADES } = await import('../publico/js/nucleo/catalogo-actividades.js');
  const act = ACTIVIDADES.find(a => a.id === 'canciones');
  assert.ok(act, 'catalogo-actividades debe incluir actividad canciones');
  assert.equal(act.texto, 'Canciones del tema');
  assert.equal(act.descripcion, 'Aprende con música');
  assert.equal(act.href, '/paginas/canciones.html');
});
