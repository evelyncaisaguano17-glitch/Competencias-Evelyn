// servidor/preparadores/generar-preguntas.js · Preparador para generar preguntas con IA
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const MAPEO_BLOOM = {
  1: '1 Recordar',
  2: '2 Comprender',
  3: '3 Aplicar',
  4: '4 Analizar',
  5: '5 Evaluar'
};

/**
 * Prepara los datos del tema, nivel cognitivo y glosario para la plantilla de prompt generar-preguntas.
 * @param {Object} cuerpo - { temaId, nivel, cantidad }
 * @param {Object} usuario - Usuario autenticado
 * @returns {Promise<Object>} Datos interpolables en el prompt
 */
export default async function prepararGenerarPreguntas(cuerpo = {}, usuario = null) {
  const { temaId } = cuerpo;
  const nivelNum = parseInt(cuerpo.nivel, 10);
  const cantidadNum = parseInt(cuerpo.cantidad, 10) || 10;

  if (!temaId) {
    const error = new Error('El parámetro temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
    const error = new Error('El nivel cognitivo debe ser un número entero entre 1 y 5');
    error.estado = 400;
    throw error;
  }

  if (cantidadNum < 5 || cantidadNum > 15) {
    const error = new Error('La cantidad debe estar entre 5 y 15');
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
    const error = new Error('No tienes permiso para editar preguntas de este tema');
    error.estado = 403;
    throw error;
  }

  // 3. Obtener datos de la asignatura
  const asignaturas = await almacen.leer('asignaturas');
  const asignatura = asignaturas.find((a) => a && a.id === asignaturaId);
  const nombreAsignatura = asignatura?.nombre || 'Medicina';
  const nivelEducativo = asignatura?.nivel || 'Educación Superior';

  // 4. Estructurar contenido del tema
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

  // 5. Glosario del tema en formato "término: definición"
  const listaGlosario = await almacen.leer('glosario');
  const entradasGlosario = listaGlosario
    .filter((g) => g && g.temaId === temaId && g.termino && g.definicion)
    .map((g) => `${g.termino.trim()}: ${g.definicion.trim()}`);
  const glosario = entradasGlosario.length > 0 ? entradasGlosario.join('\n') : 'Ninguno';

  // 6. Nivel Bloom mapeado
  const nivelBloom = MAPEO_BLOOM[nivelNum] || `${nivelNum} Aplicar`;

  // 7. Preguntas que ya existen de ese nivel
  const todasPreguntas = await almacen.leer('preguntas').catch(() => []);
  const enunciadosExistentes = todasPreguntas
    .filter((p) => p && p.temaId === temaId && Number(p.nivel) === nivelNum && typeof p.enunciado === 'string')
    .map((p) => `- ${p.enunciado.trim()}`)
    .filter(Boolean);
  const existentes = enunciadosExistentes.length > 0 ? enunciadosExistentes.join('\n') : 'Ninguna';

  return {
    asignatura: nombreAsignatura,
    nivel: nivelEducativo,
    tema: tema.titulo || 'Tema',
    contenido,
    glosario,
    nivelBloom,
    cantidad: cantidadNum,
    existentes
  };
}
