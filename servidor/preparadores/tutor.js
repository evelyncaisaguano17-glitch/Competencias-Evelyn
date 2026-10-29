// servidor/preparadores/tutor.js · Preparador de contexto curricular y socrático para el Tutor IA
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Prepara el contexto curricular de la asignatura y el historial para el tutor socrático.
 * @param {Object} cuerpo - { asignaturaId, temaId, mensaje, historial }
 * @param {Object} usuario - Usuario autenticado
 * @returns {Promise<Object>} Datos interpolables en servidor/prompts/tutor.txt
 */
export default async function prepararTutor(cuerpo = {}, usuario = null) {
  let { asignaturaId, temaId, mensaje, historial } = cuerpo;

  if (!usuario) {
    const error = new Error('Sesión no iniciada');
    error.estado = 401;
    throw error;
  }

  // 1. Resolver asignaturaId si se proveyó temaId
  if (!asignaturaId && temaId) {
    asignaturaId = await acceso.asignaturaDeTema(temaId);
  }

  if (!asignaturaId) {
    const error = new Error('El parámetro asignaturaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // 2. Validar que la asignatura exista
  const asignaturas = await almacen.leer('asignaturas');
  const asignatura = asignaturas.find((a) => a && a.id === asignaturaId);
  if (!asignatura) {
    const error = new Error('Asignatura no encontrada');
    error.estado = 404;
    throw error;
  }

  // 3. Validar acceso a la asignatura según rol y grupos
  const asignaturasPermitidas = await acceso.asignaturasDe(usuario);
  const tieneAcceso = asignaturasPermitidas.some((a) => a && a.id === asignaturaId);
  if (!tieneAcceso) {
    const error = new Error('No tienes acceso a los contenidos de esta asignatura');
    error.estado = 403;
    throw error;
  }

  // 4. Validar mensaje del estudiante
  if (typeof mensaje !== 'string' || !mensaje.trim()) {
    const error = new Error('El mensaje no puede estar vacío');
    error.estado = 400;
    throw error;
  }
  const mensajeLimpio = mensaje.trim().slice(0, 1000);

  // 5. Construir contexto curricular estructurado de la asignatura
  const unidades = await almacen.leer('unidades');
  const unidadesAsignatura = unidades
    .filter((u) => u && u.asignaturaId === asignaturaId && u.visible !== false)
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const idsUnidades = new Set(unidadesAsignatura.map((u) => u.id));
  const temas = await almacen.leer('temas');
  const temasAsignatura = temas
    .filter((t) => t && idsUnidades.has(t.unidadId) && t.estado === 'publicado')
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const glosario = await almacen.leer('glosario');

  const bloquesCurriculares = [];
  bloquesCurriculares.push(`Asignatura: ${asignatura.nombre}`);
  if (asignatura.descripcion) {
    bloquesCurriculares.push(`Descripción general: ${asignatura.descripcion}`);
  }

  for (const unidad of unidadesAsignatura) {
    bloquesCurriculares.push(`\n--- UNIDAD ${unidad.orden || ''}: ${unidad.titulo} ---`);
    const temasDeUnidad = temasAsignatura.filter((t) => t.unidadId === unidad.id);

    for (const tema of temasDeUnidad) {
      const lineasTema = [];
      lineasTema.push(`* Tema: ${tema.titulo}`);
      if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
        lineasTema.push(`  Objetivos: ${tema.objetivos.join('; ')}`);
      }
      if (tema.resumen) {
        lineasTema.push(`  Resumen: ${tema.resumen}`);
      }
      if (Array.isArray(tema.preguntasGuia) && tema.preguntasGuia.length > 0) {
        lineasTema.push(`  Preguntas guía del tema: ${tema.preguntasGuia.join('; ')}`);
      }
      if (Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0) {
        lineasTema.push(`  Errores frecuentes a prevenir: ${tema.erroresFrecuentes.join('; ')}`);
      }

      // Términos del glosario asociados a este tema
      const terminosTema = glosario
        .filter((g) => g && g.temaId === tema.id && g.estado === 'aprobado')
        .slice(0, 8)
        .map((g) => `${g.termino} (${g.definicion || ''})`);
      if (terminosTema.length > 0) {
        lineasTema.push(`  Términos clave: ${terminosTema.join(' | ')}`);
      }

      bloquesCurriculares.push(lineasTema.join('\n'));
    }
  }

  const contenidoCurricular = bloquesCurriculares.join('\n');

  // 6. Procesar historial de la conversación
  let textoHistorial = 'Inicio del diálogo socrático.';
  if (Array.isArray(historial) && historial.length > 0) {
    // Tomar los últimos 8 mensajes para mantener el hilo sin sobrecargar tokens
    const ultimosTurnos = historial.slice(-8);
    const turnosFormateados = ultimosTurnos.map((m) => {
      const rolEtiqueta = (m.rol === 'estudiante' || m.rol === 'user') ? 'Estudiante' : 'Tutor Socrático';
      const texto = typeof m.texto === 'string' ? m.texto.trim() : (m.contenido || '');
      return `${rolEtiqueta}: ${texto}`;
    });
    textoHistorial = turnosFormateados.join('\n');
  }

  // 7. Registrar consulta en la colección consultas-tutor (para auditoría y bitácora)
  const hoy = new Date().toISOString().slice(0, 10);
  try {
    const consultas = await almacen.leer('consultas-tutor').catch(() => []);
    let registroExistente = consultas.find(
      (c) => c && c.usuarioId === usuario.id && c.asignaturaId === asignaturaId && c.dia === hoy
    );

    if (registroExistente) {
      registroExistente.mensajes = (Number(registroExistente.mensajes) || 0) + 1;
      registroExistente.ultimaConsulta = new Date().toISOString();
      await almacen.actualizar('consultas-tutor', registroExistente.id, registroExistente).catch(() => {});
    } else {
      await almacen.agregar('consultas-tutor', {
        usuarioId: usuario.id,
        asignaturaId,
        temaId: temaId || null,
        dia: hoy,
        mensajes: 1,
        ultimaConsulta: new Date().toISOString()
      }).catch(() => {});
    }
  } catch (errRegistro) {
    // Registro no bloqueante
    console.warn('Aviso: no se pudo registrar en consultas-tutor:', errRegistro.message);
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Educación Superior',
    contenidoCurricular,
    historial: textoHistorial,
    mensaje: mensajeLimpio
  };
}
