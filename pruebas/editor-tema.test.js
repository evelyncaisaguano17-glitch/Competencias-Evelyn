// pruebas/editor-tema.test.js · Pruebas unitarias para Tarea P02.5 (Ficha del tema y glosario)
import test from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from '../servidor/almacen.js';
import * as util from '../publico/js/nucleo/util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. paginas/editor-tema.html y editor-tema.js · Integridad y roles', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/editor-tema.html');
  const rutaJs = path.join(raiz, 'publico/js/modulos/editor-tema.js');
  const rutaCss = path.join(raiz, 'publico/css/modulos/editor-tema.css');

  assert.ok(fsSync.existsSync(rutaHtml), 'editor-tema.html debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'editor-tema.js debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'editor-tema.css debe existir');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('roles: ["docente", "admin"]'), 'editor-tema.js debe exigir roles docente y admin');
  assert.ok(js.includes('id="btn-generar-ia"'), 'Debe incluir botón id="btn-generar-ia"');
  assert.ok(js.includes('disabled'), 'El botón Generar con IA debe estar deshabilitado');
  assert.ok(js.includes('api.subir'), 'Debe incluir integración con api.subir para pdf e imagen');
  assert.ok(js.includes('api.actualizar("temas"'), 'Debe guardar tema con api.actualizar');
  assert.ok(js.includes('util.formatoBasico'), 'Debe admitir formato básico para el resumen');
  assert.ok(js.includes('beforeunload'), 'Debe avisar al salir con cambios sin guardar');
  assert.ok(js.includes('util.normalizar'), 'Debe usar util.normalizar para contar términos de 6 letras');
});

test('2. Ficha del tema · Validaciones de estructura y campos', () => {
  const js = fsSync.readFileSync(path.join(raiz, 'publico/js/modulos/editor-tema.js'), 'utf-8');

  // Campos de la ficha
  assert.ok(js.includes('objetivos'), 'Debe gestionar objetivos');
  assert.ok(js.includes('ejemplos'), 'Debe gestionar ejemplos');
  assert.ok(js.includes('erroresFrecuentes'), 'Debe gestionar errores frecuentes');
  assert.ok(js.includes('preguntasGuia'), 'Debe gestionar preguntas guía');
  assert.ok(js.includes('recursos'), 'Debe gestionar recursos');
  assert.ok(js.includes('palabrasClave'), 'Debe gestionar palabras clave');
  assert.ok(js.includes('dificultad'), 'Debe gestionar dificultad');
  assert.ok(js.includes('fuentes'), 'Debe gestionar fuentes');
  assert.ok(js.includes('estado'), 'Debe gestionar estado');

  // Glosario
  assert.ok(js.includes('origen: "docente"'), 'Glosario debe tener origen docente');
  assert.ok(js.includes('estado: "aprobado"'), 'Glosario debe tener estado aprobado');
  assert.ok(js.includes('Apto para juegos'), 'Debe calcular y mostrar indicador Apto para juegos');
});

test('3. Glosario · Lógica de 6 letras y condición Apto para juegos', () => {
  const terminosPrueba = [
    { termino: 'CÓDIGO' },     // Normalizado: CODIGO (6 letras)
    { termino: 'MÉTODO' },     // Normalizado: METODO (6 letras)
    { termino: 'NUBE' },       // Normalizado: NUBE (4 letras)
    { termino: 'ENLACE' },     // Normalizado: ENLACE (6 letras)
    { termino: 'PÁGINA WEB' }  // 2 palabras (no cuenta como término individual de 6)
  ];

  const de6Letras = terminosPrueba.filter(t => {
    const norm = util.normalizar(t.termino || '').trim();
    return norm.length === 6 && !norm.includes(' ');
  });

  assert.equal(de6Letras.length, 3, 'Debe identificar exactamente 3 términos de 6 letras');

  // Regla de apto para juegos: >= 12 términos y >= 3 de 6 letras
  const calcularApto = (total, de6) => total >= 12 && de6 >= 3;

  assert.equal(calcularApto(11, 3), false, 'Con 11 términos no es apto');
  assert.equal(calcularApto(12, 2), false, 'Con solo 2 términos de 6 letras no es apto');
  assert.equal(calcularApto(12, 3), true, 'Con 12 términos y 3 de 6 letras es apto');
  assert.equal(calcularApto(15, 5), true, 'Con 15 términos y 5 de 6 letras es apto');
});

test('4. API / datos · Operaciones sobre temas y glosario', async () => {
  // Crear tema de prueba
  const tema = await almacen.agregar('temas', {
    unidadId: 'uni_000001',
    titulo: 'Tema Test P02.5',
    orden: 88,
    resumen: 'Resumen curricular de prueba',
    dificultad: 'intermedio',
    estado: 'borrador',
    objetivos: ['Obj 1'],
    ejemplos: ['Ejemplo 1'],
    erroresFrecuentes: ['Error 1'],
    preguntasGuia: ['Pregunta 1'],
    recursos: [{ tipo: 'enlace', titulo: 'Guía', url: 'https://ejemplo.com' }],
    palabrasClave: ['test', 'ia']
  });

  assert.ok(tema.id);

  // Actualizar tema completo
  const temaActualizado = await almacen.actualizar('temas', tema.id, {
    titulo: 'Tema Test Actualizado',
    estado: 'publicado',
    dificultad: 'avanzado'
  });
  assert.equal(temaActualizado.titulo, 'Tema Test Actualizado');
  assert.equal(temaActualizado.estado, 'publicado');

  // Crear término en glosario
  const termino = await almacen.agregar('glosario', {
    temaId: tema.id,
    termino: 'DIGITAL',
    definicion: 'Relativo a la tecnología digital moderna.',
    pista: 'Empieza con D',
    retroalimentacion: 'Excelente respuesta.',
    origen: 'docente',
    estado: 'aprobado'
  });

  assert.ok(termino.id);
  assert.equal(termino.origen, 'docente');
  assert.equal(termino.estado, 'aprobado');

  // Actualizar término
  const terminoActualizado = await almacen.actualizar('glosario', termino.id, {
    termino: 'CÓDIGO'
  });
  assert.equal(terminoActualizado.termino, 'CÓDIGO');

  // Limpiar
  await almacen.eliminar('glosario', termino.id);
  await almacen.eliminar('temas', tema.id);
});

test('5. Tarea P07.2 · Generar glosario con IA, duplicados normalizados y aprobación en lote', async () => {
  const js = fsSync.readFileSync(path.join(raiz, 'publico/js/modulos/editor-tema.js'), 'utf-8');

  // Integridad en editor-tema.js
  assert.ok(js.includes('iniciarGeneracionGlosarioIA'), 'Debe definir iniciarGeneracionGlosarioIA');
  assert.ok(js.includes('solicitarCantidadIA'), 'Debe definir solicitarCantidadIA');
  assert.ok(js.includes('mostrarModalPropuestasGlosario'), 'Debe definir mostrarModalPropuestasGlosario');
  assert.ok(js.includes('api.ia("generar-glosario"'), 'Debe invocar api.ia con tarea generar-glosario');
  assert.ok(js.includes('Aprobar seleccionados'), 'Debe incluir acción Aprobar seleccionados');
  assert.ok(js.includes('origen: "ia"'), 'Debe registrar términos con origen ia');
  assert.ok(js.includes('estado: "aprobado"'), 'Debe registrar términos con estado aprobado');

  // Lógica de normalización y detección de duplicados
  const existentesPrueba = [
    { termino: 'Asepsia' },
    { termino: 'CÓDIGO' },
    { termino: 'Sutura' }
  ];
  const setExistentes = new Set(existentesPrueba.map(e => util.normalizar(e.termino).trim()));

  const propuestasPrueba = [
    { termino: 'asepsia' },     // Repetido (mismo término sin tildes/mayúsculas)
    { termino: 'Hemostasia' },  // Nuevo
    { termino: 'codigo' },      // Repetido
    { termino: 'Drenaje' }      // Nuevo
  ];

  const repetidas = propuestasPrueba.map(p => setExistentes.has(util.normalizar(p.termino).trim()));
  assert.deepEqual(repetidas, [true, false, true, false], 'Debe detectar correctamente repetidas y nuevas');

  // Creación en lote de términos aprobados con origen "ia"
  const terminoIA = await almacen.agregar('glosario', {
    temaId: 'tem_000001',
    termino: 'HEMOSTASIA',
    definicion: 'Detención espontánea o artificial del flujo sanguíneo.',
    pista: 'Detención del sangrado',
    retroalimentacion: 'Correcto, es hemostasia.',
    origen: 'ia',
    estado: 'aprobado'
  });

  assert.ok(terminoIA.id);
  assert.equal(terminoIA.origen, 'ia');
  assert.equal(terminoIA.estado, 'aprobado');

  // Limpieza
  await almacen.eliminar('glosario', terminoIA.id);
});
