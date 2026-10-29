// servidor/preparadores/generar-glosario.js · Preparador para generar términos de glosario con IA
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Prepara los datos del tema y la asignatura para la plantilla de prompt generar-glosario.
 * @param {Object} cuerpo - { temaId, cantidad }
 * @param {Object} usuario - Usuario autenticado
 * @returns {Promise<Object>} Datos interpolables en el prompt
 */
export default async function prepararGenerarGlosario(cuerpo = {}, usuario = null) {
  const { temaId } = cuerpo;
  const cantidadNum = parseInt(cuerpo.cantidad, 10) || 10;

  if (!temaId) {
    const error = new Error('El parámetro temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (cantidadNum < 5 || cantidadNum > 20) {
    const error = new Error('La cantidad debe estar entre 5 y 20');
    error.estado = 400;
    throw error;
  }

  // 1. Obtener tema y verificar existencia
  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t && t.id === temaId);
  if (!tema) {
    const error = new Error('Tema no encontrado');
    error.estado = 404;
    throw error;
  }

  // 2. Verificar permisos de edición del tema por el usuario
  const asignaturaId = await acceso.asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('No se pudo determinar la asignatura del tema');
    error.estado = 404;
    throw error;
  }

  const puedeEditar = await acceso.puedeEditarAsignatura(usuario, asignaturaId);
  if (!puedeEditar) {
    const error = new Error('No tienes permiso para editar este tema');
    error.estado = 403;
    throw error;
  }

  // 3. Obtener datos de la asignatura
  const asignaturas = await almacen.leer('asignaturas');
  const asignatura = asignaturas.find((a) => a && a.id === asignaturaId);
  const nombreAsignatura = asignatura?.nombre || 'Medicina';
  const nivel = asignatura?.nivel || 'Educación Superior';

  // 4. Estructurar contenido del tema (objetivos, resumen y ejemplos)
  const partesContenido = [];
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    partesContenido.push(`Objetivos de aprendizaje:\n- ${tema.objetivos.join('\n- ')}`);
  }
  if (tema.resumen) {
    partesContenido.push(`Resumen:\n${tema.resumen}`);
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    partesContenido.push(`Ejemplos y casos clínicos:\n- ${tema.ejemplos.join('\n- ')}`);
  }
  const contenido = partesContenido.join('\n\n') || tema.titulo;

  // 5. Términos existentes que no deben repetirse
  const glosario = await almacen.leer('glosario');
  const terminosExistentes = glosario
    .filter((g) => g && g.temaId === temaId && typeof g.termino === 'string')
    .map((g) => g.termino.trim())
    .filter(Boolean);

  const existentes = terminosExistentes.length > 0 ? terminosExistentes.join(', ') : 'Ninguno';

  return {
    asignatura: nombreAsignatura,
    nivel,
    tema: tema.titulo || 'Tema',
    contenido,
    existentes,
    cantidad: cantidadNum,
    minimoSeisLetras: 3
  };
}
