// servidor/ia.js · Motor de integración y ejecución de tareas de Inteligencia Artificial
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from './almacen.js';
import { validarEsquema } from './esquemas-ia.js';

const DIR_PROMPTS = fileURLToPath(new URL('./prompts', import.meta.url));

let mockProveedor = null;

/**
 * Permite inyectar un proveedor simulado para pruebas automatizadas.
 * @param {Function|null} fn
 */
export function establecerProveedorMock(fn) {
  mockProveedor = fn;
}

/**
 * Extrae el primer bloque JSON de una respuesta de texto (con o sin delimitadores markdown).
 * @param {string} texto
 * @returns {*|null}
 */
export function extraerJSON(texto) {
  if (typeof texto !== 'string') return null;

  // 1. Bloques de código markdown ```json ... ``` o ``` ... ```
  const matchBloque = texto.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchBloque) {
    try {
      return JSON.parse(matchBloque[1].trim());
    } catch {}
  }

  // 2. Primer bloque que comience con [ o { y termine con ] o }
  const matchEstructura = texto.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (matchEstructura) {
    try {
      return JSON.parse(matchEstructura[1].trim());
    } catch {}
  }

  // 3. Intento directo sobre texto completo
  try {
    return JSON.parse(texto.trim());
  } catch {}

  return null;
}

/**
 * Normaliza las preguntas devueltas por la IA para asegurar que cumplan el esquema
 * (por ejemplo tipos de datos en vf, completar u opciones de opción múltiple).
 */
function normalizarPreguntasIA(preguntas) {
  if (!Array.isArray(preguntas)) return preguntas;
  return preguntas.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copia = { ...item };
    const tipo = String(copia.tipo || 'opcion').toLowerCase().trim();
    copia.tipo = ['opcion', 'vf', 'completar'].includes(tipo) ? tipo : 'opcion';

    if (copia.tipo === 'vf') {
      if (!Array.isArray(copia.opciones) || copia.opciones.length < 2) {
        copia.opciones = ['Verdadero', 'Falso'];
      }
      if (typeof copia.correcta === 'string') {
        const cLower = copia.correcta.toLowerCase().trim();
        copia.correcta = (cLower === 'true' || cLower === 'verdadero' || cLower === 'v');
      } else if (typeof copia.correcta === 'number') {
        copia.correcta = (copia.correcta === 0);
      }
    } else if (copia.tipo === 'completar') {
      if (!Array.isArray(copia.opciones) || copia.opciones.length === 0) {
        copia.opciones = [String(copia.correcta || '')];
      }
      copia.correcta = String(copia.correcta || '').trim();
    } else if (copia.tipo === 'opcion') {
      if (!Array.isArray(copia.opciones)) {
        copia.opciones = [];
      }
      if (typeof copia.correcta === 'string' && isNaN(Number(copia.correcta))) {
        const idx = copia.opciones.findIndex(
          op => String(op).toLowerCase().trim() === copia.correcta.toLowerCase().trim()
        );
        if (idx !== -1) {
          copia.correcta = idx;
        } else {
          const letra = copia.correcta.toUpperCase().trim()[0];
          const mapaLetras = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
          copia.correcta = mapaLetras[letra] !== undefined ? mapaLetras[letra] : 0;
        }
      } else {
        copia.correcta = Number(copia.correcta) || 0;
      }
    }

    if (!copia.retroalimentacion || typeof copia.retroalimentacion !== 'string') {
      copia.retroalimentacion = 'Respuesta basada en los contenidos de la asignatura.';
    }

    return copia;
  });
}


/**
 * Obtiene la configuración actual de IA (desde ajustes.json o .env como respaldo).
 */
export async function obtenerConfigIA() {
  const ajustes = await almacen.leerConfig('ajustes').catch(() => ({}));
  const proveedor = (ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').toLowerCase().trim();
  const clave = (typeof ajustes.iaClave === 'string' && ajustes.iaClave.trim() !== '')
    ? ajustes.iaClave.trim()
    : (process.env.IA_CLAVE || '').trim();
  const modelo = (ajustes.iaModelo || process.env.IA_MODELO || (proveedor === 'gemini' || proveedor === 'google' ? 'gemini-1.5-flash' : 'gpt-4o-mini')).trim();

  let mock = false;
  if (ajustes.iaMock !== undefined) {
    mock = Boolean(ajustes.iaMock);
  } else if (process.env.IA_MOCK === 'true' && (!clave || clave === 'tu-clave-aqui')) {
    mock = true;
  }

  return { proveedor, clave, modelo, mock };
}

/**
 * Guarda la configuración de IA de forma persistente en ajustes.json y actualiza memoria.
 */
export async function actualizarConfigIA(nuevosAjustes = {}) {
  const ajustesActuales = await almacen.leerConfig('ajustes').catch(() => ({}));

  if (nuevosAjustes.iaProveedor !== undefined) {
    ajustesActuales.iaProveedor = String(nuevosAjustes.iaProveedor).toLowerCase().trim();
    process.env.IA_PROVEEDOR = ajustesActuales.iaProveedor;
  }
  if (nuevosAjustes.iaClave !== undefined) {
    ajustesActuales.iaClave = String(nuevosAjustes.iaClave).trim();
    process.env.IA_CLAVE = ajustesActuales.iaClave;
  }
  if (nuevosAjustes.iaModelo !== undefined) {
    ajustesActuales.iaModelo = String(nuevosAjustes.iaModelo).trim();
    process.env.IA_MODELO = ajustesActuales.iaModelo;
  }
  if (nuevosAjustes.iaMock !== undefined) {
    ajustesActuales.iaMock = Boolean(nuevosAjustes.iaMock);
    process.env.IA_MOCK = ajustesActuales.iaMock ? 'true' : 'false';
  }
  if (typeof nuevosAjustes.limiteIADiario === 'number') {
    ajustesActuales.limiteIADiario = nuevosAjustes.limiteIADiario;
  }
  if (typeof nuevosAjustes.limiteTutorDiario === 'number') {
    ajustesActuales.limiteTutorDiario = nuevosAjustes.limiteTutorDiario;
  }

  await almacen.escribirConfig('ajustes', ajustesActuales);
  return await obtenerConfigIA();
}

/**
 * Envía una petición al proveedor de IA configurado (ajustes.json o .env).
 * Soporta Google Gemini y OpenAI usando fetch nativo con timeout de 60s.
 */
async function invocarProveedor({ instruccionSistema, mensajeUsuario, temperatura }) {
  if (typeof mockProveedor === 'function') {
    return await mockProveedor({ instruccionSistema, mensajeUsuario, temperatura });
  }

  const { proveedor, clave, modelo, mock } = await obtenerConfigIA();

  if (mock) {
    if (instruccionSistema?.includes('evaluación') || mensajeUsuario?.includes('preguntas') || mensajeUsuario?.includes('Bloom')) {
      return JSON.stringify([
        {
          tipo: "opcion",
          enunciado: "¿Cuál es la solución antiséptica de primera línea recomendada para la desinfección de la piel en una incisión quirúrgica?",
          opciones: [
            "Clorhexidina con base alcohólica al 2%",
            "Agua destilada estéril",
            "Suero fisiológico al 0.9%",
            "Jabón neutro no bactericida"
          ],
          correcta: 0,
          retroalimentacion: "La clorhexidina al 2% con base alcohólica ofrece una acción residual superior y reduce significativamente las infecciones de herida operatoria."
        },
        {
          tipo: "vf",
          enunciado: "La técnica aséptica se limita exclusivamente al lavado quirúrgico de manos antes de entrar al quirófano.",
          opciones: ["Verdadero", "Falso"],
          correcta: false,
          retroalimentacion: "La asepsia abarca la esterilización del instrumental, preparación del campo y mantenimiento de barreras durante toda la intervención."
        },
        {
          tipo: "completar",
          enunciado: "El material de sutura degradado por hidrólisis o enzimas tisulares que no requiere ser retirado se clasifica como sutura ____.",
          opciones: ["absorbible", "no absorbible"],
          correcta: "absorbible",
          retroalimentacion: "Las suturas absorbibles como el poliglactina o vicryl pierden fuerza tensil y son reabsorbidas progresivamente por el organismo."
        },
        {
          tipo: "opcion",
          enunciado: "En el cuidado postoperatorio de una herida limpia, ¿cuál es el signo clínico que sugiere presencia de hematoma?",
          opciones: [
            "Aumento de volumen fluctuante y coloración violácea bajo la sutura",
            "Secreción purulenta con mal olor",
            "Fiebre mayor a 39 grados en las primeras 2 horas",
            "Apertura completa de todos los planos tisulares"
          ],
          correcta: 0,
          retroalimentacion: "El hematoma se manifiesta como una colección fluctuante de sangre que puede comprometer la tensión de la herida."
        },
        {
          tipo: "vf",
          enunciado: "El uso de drenajes quirúrgicos cerrados previene la acumulación de líquidos en el espacio muerto quirúrgico.",
          opciones: ["Verdadero", "Falso"],
          correcta: true,
          retroalimentacion: "Los drenajes con aspiración cerrada permiten evacuar sangre o seroma minimizando el riesgo de contaminación externa."
        }
      ]);
    }

    if (instruccionSistema?.includes('socrático') || instruccionSistema?.includes('tutor') || mensajeUsuario?.includes('socrático') || mensajeUsuario?.includes('Tutor')) {
      const mensajeLower = (mensajeUsuario || '').toLowerCase();
      if (mensajeLower.includes('receta') || mensajeLower.includes('fútbol') || mensajeLower.includes('futbol') || mensajeLower.includes('pizza') || mensajeLower.includes('película') || mensajeLower.includes('cancion') || mensajeLower.includes('musica')) {
        return 'Como tu tutor socrático en esta asignatura, mi objetivo pedagógico es acompañarte en el dominio de los contenidos curriculares de este curso. Por favor, enfoquémonos en los temas y conceptos de nuestra materia. ¿Qué aspecto de las unidades te genera mayor curiosidad o duda?';
      }
      if (mensajeLower.includes('asepsia') || mensajeLower.includes('esteril') || mensajeLower.includes('estéril') || mensajeLower.includes('limpieza')) {
        return '¡Excelente pregunta! Para comprender la esencia de la asepsia quirúrgica, analicemos primero: ¿cuál es la diferencia fundamental entre un área simplemente limpia y una estrictamente estéril? ¿Qué riesgos microbianos específicos busca prevenir el equipo quirúrgico al mantener el campo estéril?';
      }
      if (mensajeLower.includes('herida') || mensajeLower.includes('infeccion') || mensajeLower.includes('infección') || mensajeLower.includes('cicatriz')) {
        return 'Muy buen punto de partida para reflexionar. Antes de llegar a una conclusión clínica: si observas enrojecimiento y leve calor en los bordes de una incisión en las primeras 24 horas, ¿lo considerarías de inmediato una infección o parte normal de la fase inflamatoria? ¿Qué otros signos clínicos evaluarías para salir de dudas?';
      }
      if (mensajeLower.includes('sutura') || mensajeLower.includes('puntos') || mensajeLower.includes('aguja')) {
        return 'La sutura es una habilidad esencial basada en principios biológicos. Pensemos: ¿de qué factores tisulares depende que elijas un hilo absorbible versus uno no absorbible? ¿Qué consecuencias tendría utilizar una sutura permanente en una capa tisular interna?';
      }
      return 'Interesante inquietud. Para construir tu propio razonamiento sobre este concepto: ¿qué elementos o principios de los que hemos revisado en esta asignatura crees que se relacionan directamente con lo que preguntas? ¿Cómo lo explicarías con tus propias palabras?';
    }

    return JSON.stringify([
      {
        termino: "ASEPSIA",
        definicion: "Método para prevenir la infección por gérmenes.",
        pista: "Sin infección",
        retroalimentacion: "Técnica fundamental en el quirófano."
      },
      {
        termino: "SUTURA",
        definicion: "Hilo o grapa para unir tejidos seccionados.",
        pista: "Cierre de piel",
        retroalimentacion: "Facilita la cicatrización primaria."
      },
      {
        termino: "HERIDA",
        definicion: "Pérdida de continuidad de la piel o mucosas.",
        pista: "Lesión dérmica",
        retroalimentacion: "Requiere valoración de profundidad e infección."
      },
      {
        termino: "DRENAJE",
        definicion: "Canalización para evacuar líquidos o colecciones orgánicas.",
        pista: "Evacuar líquidos",
        retroalimentacion: "Evita hematomas o seromas posquirúrgicos."
      },
      {
        termino: "HEMOSTASIA",
        definicion: "Conjunto de mecanismos para detener una hemorragia.",
        pista: "Control de sangrado",
        retroalimentacion: "Indispensable durante cualquier acto operatorio."
      }
    ]);
  }

  if (!clave || clave === 'tu-clave-aqui') {
    const error = new Error('IA_CLAVE no configurada. Configure la clave de API desde el panel de administración o en .env');
    error.estado = 503;
    throw error;
  }

  const senal = AbortSignal.timeout(60000);

  if (proveedor === 'gemini' || proveedor === 'google') {
    const modeloLimpio = modelo.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloLimpio}:generateContent?key=${encodeURIComponent(clave)}`;
    const cuerpo = {
      contents: [{ role: 'user', parts: [{ text: mensajeUsuario }] }],
      generationConfig: { temperature: temperatura }
    };

    if (instruccionSistema) {
      cuerpo.systemInstruction = { parts: [{ text: instruccionSistema }] };
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': clave
      },
      body: JSON.stringify(cuerpo),
      signal: senal
    });

    if (!resp.ok) {
      const errTexto = await resp.text().catch(() => '');
      let mensajeDetalle = errTexto;
      try {
        const errJson = JSON.parse(errTexto);
        if (errJson.error?.message) {
          mensajeDetalle = errJson.error.message;
        }
      } catch {}
      const err = new Error(`Error de Google Gemini (${resp.status}): ${mensajeDetalle}`);
      err.estado = resp.status >= 500 ? 502 : resp.status;
      throw err;
    }

    const data = await resp.json();
    if (!data.candidates || data.candidates.length === 0) {
      const razonBloqueo = data.promptFeedback?.blockReason || 'Respuesta vacía o bloqueada por filtros de seguridad del proveedor';
      const err = new Error(`Gemini no generó contenido (${razonBloqueo})`);
      err.estado = 502;
      throw err;
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Por defecto: API compatible con OpenAI
  const url = process.env.IA_URL || 'https://api.openai.com/v1/chat/completions';
  const mensajes = [];
  if (instruccionSistema) {
    mensajes.push({ role: 'system', content: instruccionSistema });
  }
  mensajes.push({ role: 'user', content: mensajeUsuario });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clave}`
    },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      temperature: temperatura
    }),
    signal: senal
  });

  if (!resp.ok) {
    const errTexto = await resp.text().catch(() => '');
    const err = new Error(`Error del proveedor de IA (${resp.status}): ${errTexto}`);
    err.estado = resp.status >= 500 ? 502 : resp.status;
    throw err;
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Prueba la conectividad con el proveedor de IA enviando "Responde solo: OK".
 * @returns {Promise<string>}
 */
export async function probarConexion() {
  return await invocarProveedor({
    instruccionSistema: 'Eres un comprobador de estado del sistema.',
    mensajeUsuario: 'Responde solo: OK',
    temperatura: 0.1
  });
}

/**
 * Ejecuta una tarea de Inteligencia Artificial aplicando plantillas, cuotas, reintentos y esquemas.
 * @param {string} tarea - Nombre de la tarea (letras minúsculas y guiones)
 * @param {Object} datos - Parámetros para interpolar en el prompt
 * @param {Object} usuario - Usuario que realiza la petición
 * @param {Object} opciones - { formato: 'json' | 'texto' }
 * @returns {Promise<*>}
 */
export async function ejecutarTarea(tarea, datos = {}, usuario = null, { formato = 'json' } = {}) {
  // 1. Validar nombre de tarea
  if (typeof tarea !== 'string' || !/^[a-z0-9-]+$/.test(tarea)) {
    const err = new Error('Nombre de tarea de IA no válido');
    err.estado = 400;
    throw err;
  }

  const usuarioId = usuario?.id || 'anonimo';
  const esGenerar = tarea.startsWith('generar-');
  const esTutorORol = tarea === 'tutor' || tarea === 'rol-simulacion';

  // 2. Control de límite diario de consumo
  const ajustes = await almacen.leerConfig('ajustes');
  const limiteDiario = esTutorORol
    ? (typeof ajustes.limiteTutorDiario === 'number' ? ajustes.limiteTutorDiario : 40)
    : (typeof ajustes.limiteIADiario === 'number' ? ajustes.limiteIADiario : 30);

  const consumo = await almacen.leerLineas('consumo-ia.jsonl').catch(() => []);
  const hoy = new Date().toISOString().slice(0, 10);
  const usosHoy = consumo.filter(
    (c) =>
      c &&
      c.usuarioId === usuarioId &&
      typeof c.fecha === 'string' &&
      c.fecha.startsWith(hoy) &&
      (esTutorORol ? (c.tarea === 'tutor' || c.tarea === 'rol-simulacion') : c.tarea.startsWith('generar-'))
  ).length;

  if (usosHoy >= limiteDiario) {
    const err = new Error('Has alcanzado el límite diario de consultas de IA. Vuelve mañana para continuar.');
    err.estado = 429;
    throw err;
  }

  // 3. Cargar plantilla de prompt
  const rutaPrompt = path.join(DIR_PROMPTS, `${tarea}.txt`);
  let plantillaRaw = '';
  try {
    plantillaRaw = await fs.readFile(rutaPrompt, 'utf-8');
  } catch (err) {
    const error404 = new Error(`Plantilla de prompt no encontrada: ${tarea}`);
    error404.estado = 404;
    throw error404;
  }

  // 4. Reemplazar variables {{clave}} con recorte a 6.000 caracteres
  let plantillaInterpolada = plantillaRaw;
  for (const [clave, valor] of Object.entries(datos || {})) {
    let textoValor = '';
    if (Array.isArray(valor)) {
      textoValor = valor.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('\n');
    } else if (valor !== null && valor !== undefined) {
      textoValor = String(valor);
    }
    const recortado = textoValor.slice(0, 6000);
    plantillaInterpolada = plantillaInterpolada.replaceAll(`{{${clave}}}`, recortado);
  }
  // Limpiar variables no provistas
  plantillaInterpolada = plantillaInterpolada.replace(/\{\{[a-zA-Z0-9_-]+\}\}/g, '');

  // 5. Separar instrucción de sistema y mensaje de usuario
  const partes = plantillaInterpolada.split(/\r?\n### USUARIO\r?\n/);
  const instruccionSistema = partes[0]?.trim() || '';
  const mensajeUsuario = partes[1]?.trim() || '';

  const temperatura = esTutorORol ? 0.7 : 0.4;
  const longitudEntrada = instruccionSistema.length + mensajeUsuario.length;

  // 6. Invocar al proveedor
  let respuestaTexto = '';
  try {
    respuestaTexto = await invocarProveedor({ instruccionSistema, mensajeUsuario, temperatura });
  } catch (err) {
    await almacen.anexarLinea('consumo-ia.jsonl', {
      usuarioId,
      tarea,
      entrada: longitudEntrada,
      salida: 0,
      ok: false,
      fecha: new Date().toISOString()
    }).catch(() => {});
    throw err;
  }

  // 7. Procesar según formato solicitado
  if (formato === 'json') {
    let parsed = extraerJSON(respuestaTexto);
    if (tarea === 'generar-preguntas' && Array.isArray(parsed)) {
      parsed = normalizarPreguntasIA(parsed);
    }
    let valido = parsed ? validarEsquema(tarea, parsed) : false;

    // Reintento si falló el parseo o validación
    if (!valido) {
      try {
        const reintentoMensaje = `${mensajeUsuario}\n\nIMPORTANTE: Tu respuesta anterior no fue válida. Responde SOLO con JSON válido según el esquema solicitado.`;
        respuestaTexto = await invocarProveedor({
          instruccionSistema,
          mensajeUsuario: reintentoMensaje,
          temperatura: 0.1
        });
        parsed = extraerJSON(respuestaTexto);
        if (tarea === 'generar-preguntas' && Array.isArray(parsed)) {
          parsed = normalizarPreguntasIA(parsed);
        }
        valido = parsed ? validarEsquema(tarea, parsed) : false;
      } catch {}
    }

    if (!valido || parsed === null) {
      await almacen.anexarLinea('consumo-ia.jsonl', {
        usuarioId,
        tarea,
        entrada: longitudEntrada,
        salida: respuestaTexto ? respuestaTexto.length : 0,
        ok: false,
        fecha: new Date().toISOString()
      }).catch(() => {});

      const errFormato = new Error('La IA no devolvió un formato válido');
      errFormato.estado = 502;
      throw errFormato;
    }

    const longitudSalida = JSON.stringify(parsed).length;
    await almacen.anexarLinea('consumo-ia.jsonl', {
      usuarioId,
      tarea,
      entrada: longitudEntrada,
      salida: longitudSalida,
      ok: true,
      fecha: new Date().toISOString()
    }).catch(() => {});

    return parsed;
  }

  // Formato texto
  const longitudSalida = respuestaTexto.length;
  await almacen.anexarLinea('consumo-ia.jsonl', {
    usuarioId,
    tarea,
    entrada: longitudEntrada,
    salida: longitudSalida,
    ok: true,
    fecha: new Date().toISOString()
  }).catch(() => {});

  return respuestaTexto;
}

export default {
  ejecutarTarea,
  extraerJSON,
  establecerProveedorMock,
  probarConexion
};
