// servidor/semilla.js · Carga de datos de prueba desde datos/semilla/ a datos/
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

const DIR_SEMILLA = fileURLToPath(new URL('../datos/semilla', import.meta.url));
const COLECCIONES = ['usuarios', 'asignaturas', 'distributivo', 'unidades', 'temas', 'glosario', 'insignias'];

/**
 * Copia los archivos de datos/semilla/ a datos/.
 * - Si forzar es false: solo copia si la colección no existe o está vacía.
 * - Si forzar es true: reemplaza las colecciones.
 * - Para usuarios genera claveHash de "Demo12345" para todos.
 * @param {Object} opciones
 * @param {boolean} opciones.forzar
 * @returns {Promise<Object>} Resumen de colecciones procesadas
 */
export async function sembrar({ forzar = false } = {}) {
  const hashClaveDemo = await bcrypt.hash('Demo12345', 10);
  const resultado = {};

  for (const col of COLECCIONES) {
    const rutaSemilla = path.join(DIR_SEMILLA, `${col}.json`);
    if (!fsSync.existsSync(rutaSemilla)) {
      continue;
    }

    const existeDestino = await almacen.leer(col).catch(() => []);
    const yaTieneDatos = Array.isArray(existeDestino) && existeDestino.length > 0;

    if (yaTieneDatos && !forzar) {
      resultado[col] = 'omitido (ya existe)';
      continue;
    }

    const contenidoRaw = await fs.readFile(rutaSemilla, 'utf-8');
    const datos = JSON.parse(contenidoRaw);

    if (col === 'usuarios') {
      const usuariosExistentes = await almacen.leer('usuarios').catch(() => []);
      const personalizados = Array.isArray(usuariosExistentes)
        ? usuariosExistentes.filter(u => u && u.correo && !u.correo.toLowerCase().endsWith('@demo.ec'))
        : [];
      const usuariosConHash = datos.map(u => ({
        ...u,
        claveHash: hashClaveDemo
      }));
      // Preservar cuentas reales no demo (ej. administradora registrada)
      for (const pers of personalizados) {
        if (!usuariosConHash.some(u => u.correo && u.correo.toLowerCase() === pers.correo.toLowerCase())) {
          usuariosConHash.push(pers);
        }
      }
      await almacen.escribir('usuarios', usuariosConHash);
      resultado[col] = `sembrado (${usuariosConHash.length} usuarios con clave Demo12345 y personalizados)`;
    } else {
      await almacen.escribir(col, datos);
      resultado[col] = `sembrado (${datos.length} registros)`;
    }
  }

  return resultado;
}

// Ejecución directa por CLI
const esPrincipal = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('semilla.js')
);

if (esPrincipal) {
  const args = process.argv.slice(2);
  const tieneForzar = args.includes('--forzar');
  const tieneSi = args.includes('--si') || args.includes('-y');

  let continuar = true;

  if (tieneForzar && !tieneSi) {
    const rl = readline.createInterface({ input, output });
    try {
      const respuesta = await rl.question('¿Estás seguro de que deseas reemplazar las colecciones de datos con la semilla? (s/N): ');
      const respNorm = respuesta.trim().toLowerCase();
      continuar = respNorm === 's' || respNorm === 'si' || respNorm === 'y' || respNorm === 'yes';
    } finally {
      rl.close();
    }
  }

  if (!continuar) {
    console.log('Operación cancelada.');
    process.exit(0);
  }

  const res = await sembrar({ forzar: tieneForzar });
  console.log(JSON.stringify(res));
  process.exit(0);
}
