// pruebas/noticias.test.js · Pruebas para Tarea P03.1 (Noticias y lecturas-noticias)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. permisos.json · Configuración de noticias y lecturas-noticias', () => {
  const permisosPath = path.join(raiz, 'datos', 'config', 'permisos.json');
  const permisos = JSON.parse(fs.readFileSync(permisosPath, 'utf-8'));

  assert.ok(permisos.noticias, 'Debe existir la colección noticias en permisos.json');
  assert.deepEqual(permisos.noticias.leer, ['sesion'], 'noticias.leer debe ser ["sesion"]');
  assert.deepEqual(permisos.noticias.escribir, ['docente', 'admin'], 'noticias.escribir debe ser ["docente", "admin"]');

  assert.ok(permisos['lecturas-noticias'], 'Debe existir lecturas-noticias en permisos.json');
  assert.deepEqual(permisos['lecturas-noticias'].leer, ['propio'], 'lecturas-noticias.leer debe ser ["propio"]');
  assert.deepEqual(permisos['lecturas-noticias'].escribir, ['sesion'], 'lecturas-noticias.escribir debe ser ["sesion"]');
});

test('2. servidor/ganchos/ · Reglas de noticias y lecturas-noticias', async () => {
  const { default: ganchosNoticias } = await import('../servidor/ganchos/noticias.js');
  const { default: ganchosLecturas } = await import('../servidor/ganchos/lecturas-noticias.js');

  // Ganchos noticias: antesDeGuardar
  assert.equal(typeof ganchosNoticias.antesDeGuardar, 'function');
  const usuarioDocente = { id: 'usr-doc-1', rol: 'docente' };

  // Crear noticia nueva (sin anterior)
  const noticiaNueva = { titulo: 'Prueba', resumen: 'Resumen', cuerpo: 'Cuerpo', estado: 'borrador' };
  const guardada1 = await ganchosNoticias.antesDeGuardar(noticiaNueva, usuarioDocente, null);
  assert.equal(guardada1.autorId, 'usr-doc-1', 'Debe fijar autorId al crear');
  assert.equal(guardada1.fechaPublicacion, undefined, 'No debe fijar fechaPublicacion si es borrador');

  // Publicar noticia
  const noticiaPublicada = { ...guardada1, estado: 'publicado' };
  const guardada2 = await ganchosNoticias.antesDeGuardar(noticiaPublicada, usuarioDocente, guardada1);
  assert.ok(guardada2.fechaPublicacion, 'Debe fijar fechaPublicacion cuando el estado pasa a publicado');

  // Ganchos noticias: filtrarLista
  assert.equal(typeof ganchosNoticias.filtrarLista, 'function');
  const lista = [
    { id: '1', estado: 'publicado' },
    { id: '2', estado: 'borrador' }
  ];
  const usuarioEstudiante = { id: 'usr-est-1', rol: 'estudiante' };
  const filtradasEstudiante = await ganchosNoticias.filtrarLista(lista, usuarioEstudiante);
  assert.equal(filtradasEstudiante.length, 1);
  assert.equal(filtradasEstudiante[0].id, '1', 'Estudiantes solo ven las publicadas');

  const filtradasDocente = await ganchosNoticias.filtrarLista(lista, usuarioDocente);
  assert.equal(filtradasDocente.length, 2, 'Docentes ven todas');

  // Ganchos lecturas-noticias: antesDeGuardar
  assert.equal(typeof ganchosLecturas.antesDeGuardar, 'function');
  const almacen = await import('../servidor/almacen.js');
  const lecturaPrevia = await almacen.agregar('lecturas-noticias', { usuarioId: 'usr-est-1', noticiaId: 'noticia-1' });

  // Evitar duplicados
  await assert.rejects(
    async () => {
      // Intentar crear de nuevo la misma lectura con el mismo usuario
      await ganchosLecturas.antesDeGuardar({ noticiaId: 'noticia-1' }, usuarioEstudiante, null);
    },
    (err) => err.estado === 400 || err.message.includes('ya registrada')
  );

  // Limpiar registro de prueba
  await almacen.eliminar('lecturas-noticias', lecturaPrevia.id);
});

test('3. Integridad de páginas y módulos de Noticias', () => {
  const archivos = [
    'publico/paginas/editor-noticia.html',
    'publico/css/modulos/editor-noticia.css',
    'publico/js/modulos/editor-noticia.js',
    'publico/paginas/noticias.html',
    'publico/css/modulos/noticias.css',
    'publico/js/modulos/noticias.js',
    'publico/paginas/noticia.html',
    'publico/css/modulos/noticia.css',
    'publico/js/modulos/noticia.js'
  ];

  for (const arch of archivos) {
    const ruta = path.join(raiz, arch);
    assert.ok(fs.existsSync(ruta), `${arch} debe existir`);
  }

  const editorHtml = fs.readFileSync(path.join(raiz, 'publico/paginas/editor-noticia.html'), 'utf-8');
  assert.ok(editorHtml.includes('id="noticia-titulo"'), 'editor-noticia debe tener campo de título');
  assert.ok(editorHtml.includes('id="noticia-resumen"'), 'editor-noticia debe tener campo de resumen');
  assert.ok(editorHtml.includes('id="noticia-categoria"'), 'editor-noticia debe tener selector de categoría');
  assert.ok(editorHtml.includes('id="noticia-cuerpo"'), 'editor-noticia debe tener textarea de cuerpo');
  assert.ok(editorHtml.includes('id="panel-vista-previa"'), 'editor-noticia debe tener panel de vista previa');

  const noticiasHtml = fs.readFileSync(path.join(raiz, 'publico/paginas/noticias.html'), 'utf-8');
  assert.ok(noticiasHtml.includes('id="lista-noticias"'), 'noticias.html debe tener contenedor de noticias');
  assert.ok(noticiasHtml.includes('id="filtro-categoria"'), 'noticias.html debe tener filtro por categoría');
  assert.ok(noticiasHtml.includes('id="filtro-tema"'), 'noticias.html debe tener filtro por tema');
  assert.ok(noticiasHtml.includes('id="paginacion-noticias"'), 'noticias.html debe tener paginación');

  const noticiaHtml = fs.readFileSync(path.join(raiz, 'publico/paginas/noticia.html'), 'utf-8');
  assert.ok(noticiaHtml.includes('id="noticia-titulo"'), 'noticia.html debe tener título');
  assert.ok(noticiaHtml.includes('id="noticia-cuerpo"'), 'noticia.html debe tener cuerpo');
});

test('4. menu.js y plantilla.js · Enlace y contador de noticias sin leer', async () => {
  const { MENU } = await import('../publico/js/nucleo/menu.js');
  const itemNoticias = MENU.find(m => m.href === '/paginas/noticias.html');
  assert.ok(itemNoticias, 'menu.js debe contener /paginas/noticias.html');
  assert.deepEqual(itemNoticias.roles, ['sesion'], 'Noticias debe requerir rol sesion');

  const { actualizarContadorNoticias } = await import('../publico/js/nucleo/plantilla.js');
  assert.equal(typeof actualizarContadorNoticias, 'function', 'plantilla.js debe exportar actualizarContadorNoticias');
});

test('5. API / datos · Operaciones sobre noticias y lecturas-noticias', async () => {
  const almacen = await import('../servidor/almacen.js');

  const noticiaPrueba = await almacen.agregar('noticias', {
    titulo: 'Noticia de Prueba',
    resumen: 'Breve resumen',
    cuerpo: 'Contenido detallado con *formato*',
    categoria: 'Institucional',
    destacada: true,
    estado: 'publicado',
    autorId: 'usu_000002',
    fechaPublicacion: new Date().toISOString()
  });
  assert.ok(noticiaPrueba.id);

  const lecturaPrueba = await almacen.agregar('lecturas-noticias', {
    usuarioId: 'usu_000003',
    noticiaId: noticiaPrueba.id
  });
  assert.ok(lecturaPrueba.id);

  // Verificar consulta
  const lecturas = await almacen.buscar('lecturas-noticias', { noticiaId: noticiaPrueba.id });
  assert.equal(lecturas.length, 1);
  assert.equal(lecturas[0].usuarioId, 'usu_000003');

  // Limpiar
  await almacen.eliminar('lecturas-noticias', lecturaPrueba.id);
  await almacen.eliminar('noticias', noticiaPrueba.id);
});
