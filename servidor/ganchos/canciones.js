// servidor/ganchos/canciones.js · Reglas de seguridad y filtrado para la colección "canciones"
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await asignaturasDe(usuario);
  const permitidasIds = new Set(permitidas.map(a => a && a.id).filter(Boolean));

  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map(u => [u.id, u.asignaturaId]));
  const mapaTemas = new Map(temas.map(t => [t.id, mapaUnidades.get(t.unidadId)]));

  return lista.filter(c => {
    if (!c || !c.temaId) return false;
    const asigId = mapaTemas.get(c.temaId);
    return asigId && permitidasIds.has(asigId);
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = (datos && datos.temaId) || (anterior && anterior.temaId);
  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('Tema o asignatura no encontrada');
    error.estado = 404;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para gestionar canciones en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default { filtrarLista, antesDeGuardar };
