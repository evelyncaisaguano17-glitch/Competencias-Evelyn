// pruebas/resumen-servidor.test.js · Pruebas para rutas de resumen de progreso
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sembrar } from '../servidor/semilla.js';
import {
  calcularPromedio,
  obtenerSemanaISO,
  obtenerUltimaConexion
} from '../servidor/rutas/resumen.js';
import resumenRouter from '../servidor/rutas/resumen.js';
import * as almacen from '../servidor/almacen.js';

test.before(async () => {
  await sembrar({ forzar: true });
});


test('1. Funciones auxiliares de resumen: calcularPromedio, obtenerSemanaISO, obtenerUltimaConexion', () => {
  // calcularPromedio
  assert.equal(calcularPromedio([]), 0, 'Lista vacía da promedio 0');
  assert.equal(
    calcularPromedio([{ actividad: 'tema-revisado', puntaje: 10, maximo: 10 }]),
    0,
    'tema-revisado no cuenta para promedio'
  );

  const intentosTest = [
    { actividad: 'ahorcado', puntaje: 8, maximo: 10 }, // 8.0
    { actividad: 'pareja', puntaje: 2, maximo: 3 },     // 6.666...
    { actividad: 'tema-revisado', puntaje: 10, maximo: 10 } // excluido
  ];
  // (8 + 6.6666...) / 2 = 14.6666... / 2 = 7.3333... -> 7.3
  assert.equal(calcularPromedio(intentosTest), 7.3, 'Promedio con 1 decimal correcto');

  // obtenerSemanaISO
  assert.equal(obtenerSemanaISO('2026-10-26T12:00:00Z'), '2026-W44');
  assert.equal(obtenerSemanaISO('2026-01-01T00:00:00Z'), '2026-W01');
  assert.equal(obtenerSemanaISO('invalido'), null);

  // obtenerUltimaConexion
  const bitacoraMock = [
    { usuarioId: 'usu_1', tipo: 'login', fecha: '2026-10-20T10:00:00Z' },
    { usuarioId: 'usu_1', tipo: 'navegacion', fecha: '2026-10-20T10:05:00Z' },
    { usuarioId: 'usu_2', tipo: 'login', fecha: '2026-10-22T08:00:00Z' },
    { usuarioId: 'usu_1', tipo: 'login', fecha: '2026-10-25T14:30:00Z' }
  ];
  assert.equal(
    obtenerUltimaConexion('usu_1', bitacoraMock),
    '2026-10-25T14:30:00Z',
    'Debe obtener el login más reciente'
  );
  assert.equal(
    obtenerUltimaConexion('usu_inexistente', bitacoraMock),
    null,
    'Retorna null si no hay registros'
  );
});

// Helper para crear app de express en memoria con usuario simulado
function crearAppConUsuario(usuarioSimulado) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (usuarioSimulado) {
      req.usuario = usuarioSimulado;
    }
    next();
  });
  app.use('/api', resumenRouter);
  return app;
}

async function simularPeticion(app, metodo, ruta) {
  const { createServer } = await import('node:http');
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        const respuesta = await fetch(`http://localhost:${port}${ruta}`, {
          method: metodo,
          headers: { 'Content-Type': 'application/json' }
        });
        const cuerpo = await respuesta.json().catch(() => ({}));
        server.close(() => resolve({ estado: respuesta.status, cuerpo }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('2. GET /api/resumen/estudiante/:id · Control de acceso y respuestas', async () => {
  // Sin sesión -> 401
  const appSinSesion = crearAppConUsuario(null);
  const res401 = await simularPeticion(appSinSesion, 'GET', '/api/resumen/estudiante/usu_000004');
  assert.equal(res401.estado, 401, 'Sin sesión debe responder 401');

  // Estudiante consultando su propio perfil con "yo"
  const appPropio = crearAppConUsuario({
    id: 'usu_000004',
    nombre: 'Ana',
    apellido: 'Estudiante',
    rol: 'estudiante'
  });
  const resYo = await simularPeticion(appPropio, 'GET', '/api/resumen/estudiante/yo');
  assert.equal(resYo.estado, 200, 'Estudiante propio debe poder consultar con /yo');
  assert.ok('puntos' in resYo.cuerpo, 'Debe incluir puntos');
  assert.ok('nivelQuizMax' in resYo.cuerpo, 'Debe incluir nivelQuizMax');
  assert.ok('pctTemas' in resYo.cuerpo, 'Debe incluir pctTemas');
  assert.ok('promedio' in resYo.cuerpo, 'Debe incluir promedio');
  assert.ok(Array.isArray(resYo.cuerpo.porActividad), 'porActividad debe ser un Array');
  assert.ok(Array.isArray(resYo.cuerpo.porTema), 'porTema debe ser un Array');
  assert.ok(Array.isArray(resYo.cuerpo.evolucion), 'evolucion debe ser un Array');
  assert.ok(Array.isArray(resYo.cuerpo.pendientes), 'pendientes debe ser un Array');
  assert.ok('ultimaConexion' in resYo.cuerpo, 'Debe incluir ultimaConexion');
  assert.ok('tiempoMin' in resYo.cuerpo, 'Debe incluir tiempoMin');
  assert.ok(Array.isArray(resYo.cuerpo.ultimosIntentos), 'ultimosIntentos debe ser un Array');
  assert.ok(resYo.cuerpo.ultimosIntentos.length <= 20, 'ultimosIntentos no debe superar 20');
  assert.ok(resYo.cuerpo.evolucion.length <= 8, 'evolucion no debe superar 8 semanas');

  // Estudiante intentando consultar a otro estudiante -> 403
  const resOtroEst = await simularPeticion(appPropio, 'GET', '/api/resumen/estudiante/usu_000005');
  assert.equal(resOtroEst.estado, 403, 'Estudiante no puede consultar a otro estudiante');

  // Admin consultando cualquier estudiante -> 200
  const appAdmin = crearAppConUsuario({
    id: 'usu_000001',
    nombre: 'Admin',
    rol: 'admin'
  });
  const resAdmin = await simularPeticion(appAdmin, 'GET', '/api/resumen/estudiante/usu_000004');
  assert.equal(resAdmin.estado, 200, 'Admin debe poder consultar cualquier estudiante');

  // Docente del grupo del estudiante -> 200 (carlos.docente usu_000002 tiene grupo con usu_000004)
  const appDocente = crearAppConUsuario({
    id: 'usu_000002',
    nombre: 'Carlos',
    rol: 'docente'
  });
  const resDocente = await simularPeticion(appDocente, 'GET', '/api/resumen/estudiante/usu_000004');
  assert.equal(resDocente.estado, 200, 'Docente de su grupo debe poder consultar');
});

test('3. GET /api/resumen/grupo/:grupoId · Control de acceso y estructura', async () => {
  // Obtener un grupo existente del distributivo
  const distributivo = await almacen.leer('distributivo');
  assert.ok(distributivo.length > 0, 'Debe haber grupos en distributivo');
  const grupoPrueba = distributivo[0];

  // Sin sesión -> 401
  const appSinSesion = crearAppConUsuario(null);
  const res401 = await simularPeticion(appSinSesion, 'GET', `/api/resumen/grupo/${grupoPrueba.id}`);
  assert.equal(res401.estado, 401);

  // Estudiante -> 403
  const appEstudiante = crearAppConUsuario({ id: 'usu_000004', rol: 'estudiante' });
  const resEstudiante = await simularPeticion(appEstudiante, 'GET', `/api/resumen/grupo/${grupoPrueba.id}`);
  assert.equal(resEstudiante.estado, 403, 'Estudiante no puede ver resumen de grupo');

  // Docente que NO es del grupo -> 403
  const appDocenteAjeno = crearAppConUsuario({ id: 'usu_docente_ajeno', rol: 'docente' });
  const resDocenteAjeno = await simularPeticion(appDocenteAjeno, 'GET', `/api/resumen/grupo/${grupoPrueba.id}`);
  assert.equal(resDocenteAjeno.estado, 403, 'Docente ajeno no puede ver resumen del grupo');

  // Docente asignado al grupo -> 200
  const appDocenteGrupo = crearAppConUsuario({ id: grupoPrueba.docenteId, rol: 'docente' });
  const resDocente = await simularPeticion(appDocenteGrupo, 'GET', `/api/resumen/grupo/${grupoPrueba.id}`);
  assert.equal(resDocente.estado, 200, 'Docente del grupo puede ver el resumen');
  assert.ok('grupo' in resDocente.cuerpo, 'Debe incluir grupo');
  assert.ok(Array.isArray(resDocente.cuerpo.estudiantes), 'estudiantes debe ser Array');
  assert.ok(Array.isArray(resDocente.cuerpo.porTema), 'porTema debe ser Array');

  if (resDocente.cuerpo.estudiantes.length > 0) {
    const est = resDocente.cuerpo.estudiantes[0];
    assert.ok('id' in est, 'Estudiante debe tener id');
    assert.ok('nombre' in est, 'Estudiante debe tener nombre');
    assert.ok('apellido' in est, 'Estudiante debe tener apellido');
    assert.ok('promedio' in est, 'Estudiante debe tener promedio');
    assert.ok('actividades' in est, 'Estudiante debe tener actividades');
    assert.ok('pctTemas' in est, 'Estudiante debe tener pctTemas');
    assert.ok('ultimaConexion' in est, 'Estudiante debe tener ultimaConexion');
    assert.ok('alertasActivas' in est, 'Estudiante debe tener alertasActivas');
  }

  // Admin -> 200
  const appAdmin = crearAppConUsuario({ id: 'usu_000001', rol: 'admin' });
  const resAdmin = await simularPeticion(appAdmin, 'GET', `/api/resumen/grupo/${grupoPrueba.id}`);
  assert.equal(resAdmin.estado, 200, 'Admin puede ver resumen de cualquier grupo');
});
