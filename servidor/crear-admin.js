// servidor/crear-admin.js · Script para crear usuarios con rol administrador
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

/**
 * Crea un usuario administrador validando los datos y registrándolo en la colección "usuarios".
 */
export async function crearAdmin({ nombre, apellido, correo, clave }) {
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    throw new Error('El nombre es obligatorio');
  }
  if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
    throw new Error('El apellido es obligatorio');
  }
  if (!correo || typeof correo !== 'string') {
    throw new Error('El correo es obligatorio');
  }

  const correoNormalizado = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) {
    throw new Error('El formato de correo no es válido');
  }

  if (!clave || typeof clave !== 'string' || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(clave)) {
    throw new Error('La contraseña debe tener al menos 8 caracteres, incluyendo letras y números');
  }

  const usuarios = await almacen.leer('usuarios');
  if (usuarios.some(u => u && u.correo && u.correo.toLowerCase() === correoNormalizado)) {
    throw new Error('Ya existe un usuario con este correo');
  }

  const claveHash = await bcrypt.hash(clave, 10);
  const nuevoAdmin = await almacen.agregar('usuarios', {
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    correo: correoNormalizado,
    claveHash,
    rol: 'admin',
    activo: true,
    consentimiento: {
      aceptado: true,
      fecha: new Date().toISOString()
    }
  });

  return nuevoAdmin;
}

// Ejecución interactiva por consola
const esPrincipal = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('crear-admin.js')
);

if (esPrincipal) {
  const rl = readline.createInterface({ input, output });
  try {
    console.log('=== Crear Usuario Administrador ===');
    const nombre = (await rl.question('Nombre: ')).trim();
    const apellido = (await rl.question('Apellido: ')).trim();
    const correo = (await rl.question('Correo: ')).trim();
    const clave = (await rl.question('Contraseña: ')).trim();

    const admin = await crearAdmin({ nombre, apellido, correo, clave });
    console.log(`\nAdministrador creado con éxito: ${admin.nombre} ${admin.apellido} (ID: ${admin.id}, Correo: ${admin.correo})`);
    process.exit(0);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}
