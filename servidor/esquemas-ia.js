// servidor/esquemas-ia.js · Validación de esquemas estructurados para respuestas de IA

/**
 * Valida que los datos devueltos por la IA cumplan con el esquema obligatorio de la tarea.
 * - generar-glosario → lista de { termino, definicion, pista, retroalimentacion }
 * - generar-preguntas → lista de { tipo, enunciado, opciones, correcta, retroalimentacion }
 * - generar-escenario → { titulo, escenaInicial, escenas }
 * - evaluar-rol → { puntaje, maximo, criterios, comentarioGeneral }
 * @param {string} tarea
 * @param {*} datos
 * @returns {boolean}
 */
export function validarEsquema(tarea, datos) {
  if (!datos) return false;

  switch (tarea) {
    case 'generar-glosario': {
      if (!Array.isArray(datos) || datos.length === 0) return false;
      return datos.every(
        (item) =>
          item &&
          typeof item.termino === 'string' &&
          item.termino.trim() !== '' &&
          typeof item.definicion === 'string' &&
          item.definicion.trim() !== '' &&
          typeof item.pista === 'string' &&
          item.pista.trim() !== '' &&
          typeof item.retroalimentacion === 'string' &&
          item.retroalimentacion.trim() !== ''
      );
    }

    case 'generar-preguntas': {
      if (!Array.isArray(datos) || datos.length === 0) return false;
      return datos.every((item) => {
        if (!item || typeof item !== 'object') return false;
        if (typeof item.tipo !== 'string' || !item.tipo.trim()) return false;
        if (typeof item.enunciado !== 'string' || !item.enunciado.trim()) return false;
        if (item.correcta === undefined || item.correcta === null) return false;
        if (typeof item.retroalimentacion !== 'string' || !item.retroalimentacion.trim()) return false;

        const tipo = item.tipo.toLowerCase().trim();
        if (tipo === 'opcion') {
          return Array.isArray(item.opciones) && item.opciones.length >= 2;
        }
        if (tipo === 'vf') {
          return !item.opciones || Array.isArray(item.opciones);
        }
        if (tipo === 'completar') {
          return !item.opciones || Array.isArray(item.opciones);
        }
        return true;
      });
    }

    case 'generar-escenario': {
      if (typeof datos !== 'object' || Array.isArray(datos)) return false;
      return (
        typeof datos.titulo === 'string' &&
        datos.titulo.trim() !== '' &&
        datos.escenaInicial !== undefined &&
        (Array.isArray(datos.escenas) || (typeof datos.escenas === 'object' && datos.escenas !== null))
      );
    }

    case 'evaluar-rol': {
      if (typeof datos !== 'object' || Array.isArray(datos)) return false;
      return (
        typeof datos.puntaje === 'number' &&
        typeof datos.maximo === 'number' &&
        datos.criterios !== undefined &&
        typeof datos.comentarioGeneral === 'string'
      );
    }

    default:
      return true;
  }
}

export default { validarEsquema };
