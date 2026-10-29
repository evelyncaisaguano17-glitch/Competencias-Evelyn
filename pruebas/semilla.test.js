// pruebas/semilla.test.js · Pruebas unitarias para Tarea P02.2 (Datos de prueba - semilla)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { sembrar } from '../servidor/semilla.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_SEMILLA = path.resolve(__dirname, '../datos/semilla');

test('1. datos/semilla/ · Estructura e integridad de archivos semilla', async () => {
  const archivos = ['usuarios.json', 'asignaturas.json', 'distributivo.json', 'unidades.json', 'temas.json', 'glosario.json'];
  for (const archivo of archivos) {
    const ruta = path.join(DIR_SEMILLA, archivo);
    assert.ok(fsSync.existsSync(ruta), `${archivo} debe existir en datos/semilla/`);
  }

  // 1. usuarios.json
  const usuarios = JSON.parse(await fs.readFile(path.join(DIR_SEMILLA, 'usuarios.json'), 'utf-8'));
  assert.equal(usuarios.length, 9, 'Debe contener 9 usuarios');
  assert.ok(usuarios.every(u => !u.claveHash), 'Los usuarios de semilla deben venir sin claveHash');
  assert.equal(usuarios[0].correo, 'admin@demo.ec');
  assert.equal(usuarios[0].rol, 'admin');
  assert.equal(usuarios[1].correo, 'docente1@demo.ec');
  assert.equal(usuarios[1].rol, 'docente');
  assert.equal(usuarios[2].correo, 'docente2@demo.ec');
  assert.equal(usuarios[2].rol, 'docente');
  for (let i = 1; i <= 6; i++) {
    assert.equal(usuarios[i + 2].correo, `estudiante${i}@demo.ec`);
    assert.equal(usuarios[i + 2].rol, 'estudiante');
  }

  // 2. asignaturas.json
  const asignaturas = JSON.parse(await fs.readFile(path.join(DIR_SEMILLA, 'asignaturas.json'), 'utf-8'));
  assert.equal(asignaturas.length, 1);
  assert.equal(asignaturas[0].id, 'asi_000001');
  assert.equal(asignaturas[0].nombre, 'CIRUGÍA');
  assert.equal(asignaturas[0].nivel, 'PREGRADO');

  // 3. distributivo.json
  const distributivo = JSON.parse(await fs.readFile(path.join(DIR_SEMILLA, 'distributivo.json'), 'utf-8'));
  assert.equal(distributivo.length, 1);
  assert.equal(distributivo[0].paralelo, 'A');
  assert.equal(distributivo[0].periodo, '2026-2027');
  assert.equal(distributivo[0].docenteId, 'usu_000002');
  assert.equal(distributivo[0].estudiantes.length, 6);
  assert.deepEqual(distributivo[0].estudiantes, [
    'usu_000004', 'usu_000005', 'usu_000006', 'usu_000007', 'usu_000008', 'usu_000009'
  ]);

  // 4. unidades.json
  const unidades = JSON.parse(await fs.readFile(path.join(DIR_SEMILLA, 'unidades.json'), 'utf-8'));
  assert.equal(unidades.length, 1);
  assert.equal(unidades[0].id, 'uni_000001');
  assert.equal(unidades[0].visible, true);

  // 5. temas.json
  const temas = JSON.parse(await fs.readFile(path.join(DIR_SEMILLA, 'temas.json'), 'utf-8'));
  assert.equal(temas.length, 2);
  for (const t of temas) {
    assert.equal(t.unidadId, 'uni_000001');
    assert.equal(t.estado, 'publicado');
    assert.ok(Array.isArray(t.objetivos) && t.objetivos.length > 0);
    assert.ok(Array.isArray(t.ejemplos) && t.ejemplos.length > 0);
    assert.ok(Array.isArray(t.erroresFrecuentes) && t.erroresFrecuentes.length > 0);
    assert.ok(Array.isArray(t.preguntasGuia) && t.preguntasGuia.length > 0);
    assert.ok(Array.isArray(t.recursos) && t.recursos.length > 0);
    assert.ok(Array.isArray(t.palabrasClave) && t.palabrasClave.length > 0);
    assert.ok(t.resumen && t.dificultad && t.fuentes);
  }

  // 6. glosario.json
  const glosario = JSON.parse(await fs.readFile(path.join(DIR_SEMILLA, 'glosario.json'), 'utf-8'));
  assert.equal(glosario.length, 24, 'Debe contener 24 términos en total');

  const temasIds = ['tem_000001', 'tem_000002'];
  for (const temaId of temasIds) {
    const terminosTema = glosario.filter(g => g.temaId === temaId);
    assert.equal(terminosTema.length, 12, `Tema ${temaId} debe tener 12 términos`);
    assert.ok(terminosTema.every(g => g.estado === 'aprobado'));
    assert.ok(terminosTema.every(g => g.termino.trim().indexOf(' ') === -1), 'Cada término debe ser de una sola palabra');

    const exactamente6 = terminosTema.filter(g => g.termino.trim().length === 6);
    assert.ok(exactamente6.length >= 3, `Tema ${temaId} debe tener al menos 3 términos de 6 letras (tiene ${exactamente6.length})`);

    assert.ok(terminosTema.every(g => g.definicion && g.pista && g.retroalimentacion));
  }
});

test('2. servidor/semilla.js · Inyección de clave Demo12345 y control con forzar', async () => {
  const { leer, escribir } = await import('../servidor/almacen.js');
  const usuariosPrevios = await leer('usuarios');

  // Ejecutar sembrado forzado
  const res = await sembrar({ forzar: true });
  assert.ok(res.usuarios.includes('Demo12345'));
  assert.ok(res.asignaturas.includes('1 registros'));
  assert.ok(res.glosario.includes('24 registros'));

  // Verificar en datos/usuarios.json
  const usuarios = await leer('usuarios');
  const admin = usuarios.find(u => u.correo === 'admin@demo.ec');
  assert.ok(admin);
  assert.ok(await bcrypt.compare('Demo12345', admin.claveHash));

  // Segunda ejecución sin forzar debe omitir
  const resOmitido = await sembrar({ forzar: false });
  assert.equal(resOmitido.usuarios, 'omitido (ya existe)');
  assert.equal(resOmitido.asignaturas, 'omitido (ya existe)');

  // Restaurar usuarios previos preservando cuentas personalizadas
  const combinados = await leer('usuarios');
  for (const u of usuariosPrevios) {
    if (u && u.correo && !combinados.some(c => c && c.correo && c.correo.toLowerCase() === u.correo.toLowerCase())) {
      combinados.push(u);
    }
  }
  await escribir('usuarios', combinados);
});
