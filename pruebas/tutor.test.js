// pruebas/tutor.test.js · Pruebas unitarias para el Tutor Virtual Socrático de IA
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sembrar } from '../servidor/semilla.js';
import * as almacen from '../servidor/almacen.js';
import { establecerProveedorMock } from '../servidor/ia.js';
import prepararTutor from '../servidor/preparadores/tutor.js';
import iaRouter from '../servidor/rutas/ia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test.before(async () => {
  await sembrar({ forzar: true });
});

test('1. Plantilla de prompt: servidor/prompts/tutor.txt', () => {
  const rutaPrompt = path.join(raiz, 'servidor/prompts/tutor.txt');
  assert.ok(fsSync.existsSync(rutaPrompt), 'tutor.txt debe existir');

  const contenido = fsSync.readFileSync(rutaPrompt, 'utf-8');
  assert.ok(contenido.includes('socrático'), 'Debe enfatizar metodología socrática');
  assert.ok(contenido.includes('### USUARIO'), 'Debe tener separador ### USUARIO');
  assert.ok(contenido.includes('{{asignatura}}'), 'Debe recibir clave asignatura');
  assert.ok(contenido.includes('{{contenidoCurricular}}'), 'Debe recibir contexto curricular');
  assert.ok(contenido.includes('{{historial}}'), 'Debe recibir historial');
  assert.ok(contenido.includes('{{mensaje}}'), 'Debe recibir mensaje del estudiante');
  assert.ok(contenido.includes('LÍMITE CURRICULAR ESTRICTO') || contenido.includes('CURRICULAR'), 'Debe establecer límite curricular estricto');
});

test('2. Preparador: servidor/preparadores/tutor.js valida acceso, contexto e historial', async () => {
  const estudianteValido = { id: 'usu_000004', rol: 'estudiante' }; // Estudiante en distributivo de asi_000001
  const estudianteSinAcceso = { id: 'usu_999999', rol: 'estudiante' };

  // 2.1 Requiere autenticación
  await assert.rejects(
    async () => await prepararTutor({ asignaturaId: 'asi_000001', mensaje: 'Hola' }, null),
    (err) => err.estado === 401
  );

  // 2.2 Requiere asignaturaId
  await assert.rejects(
    async () => await prepararTutor({ mensaje: 'Hola' }, estudianteValido),
    (err) => err.estado === 400
  );

  // 2.3 Rechaza mensaje vacío
  await assert.rejects(
    async () => await prepararTutor({ asignaturaId: 'asi_000001', mensaje: '   ' }, estudianteValido),
    (err) => err.estado === 400
  );

  // 2.4 Control de acceso estricto: rechaza estudiante sin la asignatura asignada
  await assert.rejects(
    async () => await prepararTutor({ asignaturaId: 'asi_000001', mensaje: '¿Qué es la asepsia?' }, estudianteSinAcceso),
    (err) => err.estado === 403
  );

  // 2.5 Preparación exitosa con contexto curricular enriquecido e historial
  const datos = await prepararTutor({
    asignaturaId: 'asi_000001',
    mensaje: '¿Cuál es la importancia de la técnica aséptica en cirugía?',
    historial: [
      { rol: 'estudiante', texto: 'Hola tutor' },
      { rol: 'tutor', texto: '¡Hola! ¿En qué tema deseas reflexionar?' }
    ]
  }, estudianteValido);

  assert.ok(datos.asignatura.includes('CIRUGÍA'), 'Debe incluir nombre de la asignatura');
  assert.ok(datos.contenidoCurricular.includes('Heridas'), 'Debe incluir unidades y temas del curso');
  assert.ok(datos.contenidoCurricular.includes('Manejo de heridas posquirúrgicas'), 'Debe incluir títulos de temas');
  assert.ok(datos.contenidoCurricular.includes('Objetivos') || datos.contenidoCurricular.includes('Resumen'), 'Debe incluir objetivos o resúmenes');
  assert.ok(datos.historial.includes('Estudiante: Hola tutor'), 'Debe formatear el historial');
  assert.ok(datos.historial.includes('Tutor Socrático:'), 'Debe etiquetar al tutor en el historial');
  assert.equal(datos.mensaje, '¿Cuál es la importancia de la técnica aséptica en cirugía?');

  // 2.6 Comprobar que registra la consulta en consultas-tutor
  const consultas = await almacen.leer('consultas-tutor');
  const registrada = consultas.find((c) => c && c.usuarioId === estudianteValido.id && c.asignaturaId === 'asi_000001');
  assert.ok(registrada, 'Debe registrar la consulta en consultas-tutor');
  assert.ok(registrada.mensajes >= 1, 'Debe contabilizar mensajes de consulta');
});

function crearAppTutor(usuario) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.usuario = usuario;
    next();
  });
  app.use('/api', iaRouter);
  return app;
}

test('3. Endpoint POST /api/ia/tutor: diálogo socrático y límite curricular', async () => {
  const estudiante = { id: 'usu_000004', rol: 'estudiante' };
  const app = crearAppTutor(estudiante);
  const server = app.listen(0);
  const puerto = server.address().port;

  try {
    // 3.1 Respuesta socrática a una consulta curricular
    const resCurricular = await fetch(`http://localhost:${puerto}/api/ia/tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asignaturaId: 'asi_000001',
        mensaje: '¿Qué es la asepsia quirúrgica y por qué no basta con limpiar?',
        historial: []
      })
    });

    assert.equal(resCurricular.status, 200);
    const jsonCurricular = await resCurricular.json();
    const textoCurricular = jsonCurricular.respuesta || jsonCurricular.texto || '';
    assert.ok(textoCurricular.length > 20, 'Debe devolver respuesta de texto');
    assert.ok(
      textoCurricular.includes('?') || textoCurricular.includes('¿'),
      'La metodología socrática debe formular preguntas reflexivas'
    );

    // 3.2 Límite curricular: reconduce preguntas ajenas a la materia
    const resAjeno = await fetch(`http://localhost:${puerto}/api/ia/tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asignaturaId: 'asi_000001',
        mensaje: 'Dame una receta para preparar una pizza de champiñones y el resultado del fútbol',
        historial: []
      })
    });

    assert.equal(resAjeno.status, 200);
    const jsonAjeno = await resAjeno.json();
    const textoAjeno = jsonAjeno.respuesta || jsonAjeno.texto || '';
    assert.ok(
      textoAjeno.toLowerCase().includes('asignatura') || textoAjeno.toLowerCase().includes('curso') || textoAjeno.toLowerCase().includes('materia'),
      'Debe redirigir al estudiante a los contenidos de la asignatura'
    );
  } finally {
    server.close();
  }
});

test('4. Integridad de la interfaz en cliente: asignatura.html, asignatura.css y asignatura.js', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/asignatura.html');
  const rutaCss = path.join(raiz, 'publico/css/modulos/asignatura.css');
  const rutaJs = path.join(raiz, 'publico/js/modulos/asignatura.js');

  assert.ok(fsSync.existsSync(rutaHtml), 'asignatura.html debe existir');
  assert.ok(fsSync.existsSync(rutaCss), 'asignatura.css debe existir');
  assert.ok(fsSync.existsSync(rutaJs), 'asignatura.js debe existir');

  const css = fsSync.readFileSync(rutaCss, 'utf-8');
  assert.ok(css.includes('.tutor-panel'), 'CSS debe definir .tutor-panel');
  assert.ok(css.includes('.tutor-mensaje--tutor'), 'CSS debe definir burbuja del tutor');
  assert.ok(css.includes('.tutor-mensaje--estudiante'), 'CSS debe definir burbuja del estudiante');
  assert.ok(css.includes('.tutor-pensando'), 'CSS debe definir indicador animado de pensamiento');

  const js = fsSync.readFileSync(rutaJs, 'utf-8');
  assert.ok(js.includes('api.ia("tutor"'), 'Debe invocar api.ia("tutor", ...)');
  assert.ok(js.includes('Tutor Virtual Socrático'), 'Debe presentar al tutor socrático');
  assert.ok(js.includes('sessionStorage'), 'Debe mantener el contexto de sesión en sessionStorage');
  assert.ok(js.includes('btn-limpiar-chat') || js.includes('reiniciar'), 'Debe permitir reiniciar la conversación');
});
