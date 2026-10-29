import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_DATOS = fileURLToPath(new URL('../datos', import.meta.url));

// Colas de escritura por ruta de archivo
const colas = new Map();

function encolar(ruta, tarea) {
  const previa = colas.get(ruta) || Promise.resolve();
  const siguiente = previa.catch(() => {}).then(tarea);
  colas.set(ruta, siguiente);
  siguiente.finally(() => {
    if (colas.get(ruta) === siguiente) {
      colas.delete(ruta);
    }
  });
  return siguiente;
}

function validarNombreColeccion(col) {
  if (typeof col !== 'string' || !/^[a-z0-9-]+(?:\/[a-z0-9_-]+)?$/.test(col)) {
    const error = new Error(`Nombre de colección no válido: ${col}`);
    error.estado = 400;
    throw error;
  }
}

function validarNombreArchivo(archivo) {
  if (typeof archivo !== 'string' || !/^[a-z0-9-_.]+(?:\/[a-z0-9-_.]+)?$/.test(archivo)) {
    const error = new Error(`Nombre de archivo no válido: ${archivo}`);
    error.estado = 400;
    throw error;
  }
}

let fechaUltimoRespaldo = null;
let promesaRespaldo = null;

async function verificarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (fechaUltimoRespaldo === hoy) return;
  if (promesaRespaldo) return promesaRespaldo;

  promesaRespaldo = (async () => {
    try {
      const dirRespaldos = path.join(DIR_DATOS, 'respaldos');
      const dirDestino = path.join(dirRespaldos, hoy);

      try {
        await fs.access(dirDestino);
        fechaUltimoRespaldo = hoy;
        return;
      } catch {
        // Carpeta no existe, se procede al respaldo
      }

      await fs.mkdir(dirDestino, { recursive: true });

      const entradasDatos = await fs.readdir(DIR_DATOS, { withFileTypes: true });
      for (const entrada of entradasDatos) {
        if (entrada.name === 'respaldos' || entrada.name.endsWith('.tmp')) {
          continue;
        }
        const origen = path.join(DIR_DATOS, entrada.name);
        const destino = path.join(dirDestino, entrada.name);
        await fs.cp(origen, destino, { recursive: true });
      }

      // Conservar solo los 14 más recientes
      const entradas = await fs.readdir(dirRespaldos, { withFileTypes: true });
      const carpetas = entradas
        .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
        .map(e => e.name)
        .sort();

      if (carpetas.length > 14) {
        const sobrantes = carpetas.slice(0, carpetas.length - 14);
        for (const carpeta of sobrantes) {
          await fs.rm(path.join(dirRespaldos, carpeta), { recursive: true, force: true });
        }
      }

      fechaUltimoRespaldo = hoy;
    } catch (err) {
      console.error('Error al realizar respaldo diario:', err);
    } finally {
      promesaRespaldo = null;
    }
  })();

  return promesaRespaldo;
}

function generarId(col, lista) {
  const base = col.split('/')[0];
  const letras = (base.replace(/[^a-z]/g, '').slice(0, 3) || 'reg').toLowerCase();
  let mayor = 0;
  for (const item of lista) {
    if (item && typeof item.id === 'string') {
      const match = item.id.match(/^([a-z]{3})_(\d+)$/);
      if (match && match[1] === letras) {
        const num = parseInt(match[2], 10);
        if (num > mayor) mayor = num;
      }
    }
  }
  const siguiente = mayor + 1;
  return `${letras}_${String(siguiente).padStart(6, '0')}`;
}

export async function leer(col) {
  validarNombreColeccion(col);
  const ruta = path.join(DIR_DATOS, `${col}.json`);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function escribir(col, lista) {
  validarNombreColeccion(col);
  await verificarRespaldoDiario();
  const ruta = path.join(DIR_DATOS, `${col}.json`);
  return encolar(ruta, async () => {
    const dir = path.dirname(ruta);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${ruta}.${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(lista, null, 2), 'utf-8');
    let reintentos = 10;
    while (true) {
      try {
        await fs.rename(tmp, ruta);
        break;
      } catch (err) {
        if ((err.code === 'EPERM' || err.code === 'EBUSY') && reintentos > 0) {
          reintentos--;
          await new Promise((r) => setTimeout(r, 25));
        } else {
          throw err;
        }
      }
    }
  });
}

export async function agregar(col, reg) {
  validarNombreColeccion(col);
  const lista = await leer(col);
  const id = generarId(col, lista);
  const fecha = new Date().toISOString();
  const nuevo = { ...reg, id, fecha };
  lista.push(nuevo);
  await escribir(col, lista);
  return nuevo;
}

export async function actualizar(col, id, cambios) {
  validarNombreColeccion(col);
  const lista = await leer(col);
  const indice = lista.findIndex(item => item && item.id === id);
  if (indice === -1) {
    return null;
  }
  const actualizado = { ...lista[indice], ...cambios, id };
  lista[indice] = actualizado;
  await escribir(col, lista);
  return actualizado;
}

export async function eliminar(col, id) {
  validarNombreColeccion(col);
  const lista = await leer(col);
  const indice = lista.findIndex(item => item && item.id === id);
  if (indice === -1) {
    return false;
  }
  lista.splice(indice, 1);
  await escribir(col, lista);
  return true;
}

export async function buscar(col, filtro = {}) {
  validarNombreColeccion(col);
  const lista = await leer(col);
  const claves = Object.keys(filtro);
  if (claves.length === 0) return lista;
  return lista.filter(item => {
    return claves.every(k => {
      if (!item || item[k] === undefined) return false;
      return String(item[k]) === String(filtro[k]);
    });
  });
}

export async function anexarLinea(archivo, obj) {
  validarNombreArchivo(archivo);
  await verificarRespaldoDiario();
  const ruta = archivo.includes('.') ? path.join(DIR_DATOS, archivo) : path.join(DIR_DATOS, `${archivo}.jsonl`);
  return encolar(ruta, async () => {
    const dir = path.dirname(ruta);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(ruta, JSON.stringify(obj) + '\n', 'utf-8');
  });
}

export async function leerLineas(archivo) {
  validarNombreArchivo(archivo);
  const ruta = archivo.includes('.') ? path.join(DIR_DATOS, archivo) : path.join(DIR_DATOS, `${archivo}.jsonl`);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return contenido
      .split('\n')
      .map(linea => linea.trim())
      .filter(Boolean)
      .map(linea => JSON.parse(linea));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function leerConfig(nombre) {
  validarNombreColeccion(nombre);
  const ruta = path.join(DIR_DATOS, 'config', `${nombre}.json`);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function escribirConfig(nombre, datos) {
  validarNombreColeccion(nombre);
  const ruta = path.join(DIR_DATOS, 'config', `${nombre}.json`);
  return encolar(ruta, async () => {
    await fs.writeFile(ruta, JSON.stringify(datos, null, 2), 'utf-8');
    return datos;
  });
}

