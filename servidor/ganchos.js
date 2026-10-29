import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR_GANCHOS = fileURLToPath(new URL('./ganchos', import.meta.url));
const ganchos = new Map();

export async function cargarGanchos() {
  ganchos.clear();
  try {
    const archivos = await fs.readdir(DIR_GANCHOS);
    for (const archivo of archivos) {
      if (archivo.endsWith('.js')) {
        const col = path.basename(archivo, '.js');
        const rutaCompleta = path.join(DIR_GANCHOS, archivo);
        const mod = await import(pathToFileURL(rutaCompleta).href);
        ganchos.set(col, mod.default || mod);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error al cargar ganchos:', err);
    }
  }
}

// Cargar ganchos al inicializar el módulo
await cargarGanchos();

export async function aplicar(col, nombre, ...args) {
  const colBase = col.split('/')[0];
  const gancho = ganchos.get(colBase);
  if (gancho && typeof gancho[nombre] === 'function') {
    return await gancho[nombre](...args);
  }
  return args[0];
}
