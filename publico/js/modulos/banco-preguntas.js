// publico/js/modulos/banco-preguntas.js · Gestión del banco de preguntas por nivel cognitivo
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({
  titulo: 'Banco de preguntas',
  roles: ['docente', 'admin']
});

const contenedor = document.getElementById('contenido');

const NIVELES_BLOOM = [
  { nivel: 1, nombre: 'Recordar' },
  { nivel: 2, nombre: 'Comprender' },
  { nivel: 3, nombre: 'Aplicar' },
  { nivel: 4, nombre: 'Analizar' },
  { nivel: 5, nombre: 'Evaluar' }
];

// Estado del módulo
let temasDisponibles = [];
let temaSeleccionadoId = util.parametro('temaId') || '';
let nivelActivo = 1;
let todasLasPreguntas = [];

async function cargarTemas() {
  try {
    ui.cargando(true);
    const temas = await api.listar('temas');
    temasDisponibles = Array.isArray(temas) ? temas : [];

    if (temasDisponibles.length === 0) {
      contenedor.innerHTML = `
        <div class="banco-preguntas">
          <div class="alerta alerta--advertencia">
            <p>No hay temas registrados o disponibles para gestionar preguntas.</p>
          </div>
          <p><a href="/paginas/editor-contenidos.html" class="btn btn--primario">Ir a Contenidos</a></p>
        </div>
      `;
      return false;
    }

    if (!temaSeleccionadoId || !temasDisponibles.some(t => t.id === temaSeleccionadoId)) {
      temaSeleccionadoId = temasDisponibles[0].id;
    }

    return true;
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar temas', 'error');
    return false;
  } finally {
    ui.cargando(false);
  }
}

async function cargarPreguntas() {
  if (!temaSeleccionadoId) return;
  try {
    ui.cargando(true);
    const preguntas = await api.listar('preguntas', { temaId: temaSeleccionadoId });
    todasLasPreguntas = Array.isArray(preguntas) ? preguntas : [];
    renderizarBanco();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar preguntas del tema', 'error');
  } finally {
    ui.cargando(false);
  }
}

function obtenerConteoAprobadas(nivel) {
  return todasLasPreguntas.filter(p => Number(p.nivel) === nivel && p.estado === 'aprobado').length;
}

function renderizarBanco() {
  const temaActual = temasDisponibles.find(t => t.id === temaSeleccionadoId);
  const preguntasNivel = todasLasPreguntas.filter(p => Number(p.nivel) === nivelActivo);
  const aprobadasNivel = obtenerConteoAprobadas(nivelActivo);
  const faltanPara20 = 20 - aprobadasNivel;

  contenedor.innerHTML = `
    <div class="banco-preguntas">
      <!-- Encabezado y Selector de tema -->
      <header class="banco-encabezado">
        <div class="banco-titulo-grupo">
          <h1>Banco de preguntas</h1>
          <span class="color-texto-suave">Gestión y generación de reactivos para evaluación formativa y sumativa</span>
        </div>
        <div class="banco-selector-tema-wrap">
          <label for="selector-tema-banco">Tema:</label>
          <select id="selector-tema-banco" class="banco-selector-tema" aria-label="Seleccionar tema">
            ${temasDisponibles.map(t => `
              <option value="${ui.escapar(t.id)}" ${t.id === temaSeleccionadoId ? 'selected' : ''}>
                ${ui.escapar(t.titulo)}
              </option>
            `).join('')}
          </select>
        </div>
      </header>

      <!-- Barra de herramientas: Nueva pregunta y Generar con IA -->
      <div class="banco-toolbar">
        <div class="banco-toolbar__acciones">
          <button type="button" class="btn btn--primario" id="btn-nueva-pregunta">
            + Nueva pregunta
          </button>
          <button type="button" class="btn btn--secundario" id="btn-generar-ia">
            ✨ Generar con IA
          </button>
        </div>
      </div>

      <!-- Pestañas de niveles (Bloom 1 a 5) -->
      <nav class="pestanas-niveles" aria-label="Niveles de preguntas">
        ${NIVELES_BLOOM.map(n => {
          const count = obtenerConteoAprobadas(n.nivel);
          const esActivo = n.nivel === nivelActivo;
          return `
            <button
              type="button"
              class="pestana-nivel ${esActivo ? 'pestana-nivel--activa' : ''}"
              data-nivel="${n.nivel}"
              role="tab"
              aria-selected="${esActivo}"
            >
              <span>Nivel ${n.nivel}: ${n.nombre}</span>
              <span class="insignia ${count >= 20 ? 'insignia--exito' : 'insignia--secundario'}">
                ${count}
              </span>
            </button>
          `;
        }).join('')}
      </nav>

      <!-- Aviso de menos de 20 preguntas aprobadas -->
      ${faltanPara20 > 0 ? `
        <div class="alerta alerta--advertencia" role="status">
          <p>
            El <strong>Nivel ${nivelActivo} (${NIVELES_BLOOM[nivelActivo - 1].nombre})</strong> cuenta con <strong>${aprobadasNivel}</strong> pregunta(s) aprobada(s). Se recomiendan al menos <strong>20</strong> preguntas aprobadas por nivel para alimentar adecuadamente el simulador y las evaluaciones.
          </p>
        </div>
      ` : `
        <div class="alerta alerta--exito" role="status">
          <p>
            ✓ Nivel completo con <strong>${aprobadasNivel}</strong> preguntas aprobadas.
          </p>
        </div>
      `}

      <!-- Lista de preguntas del nivel activo -->
      <section class="lista-preguntas" aria-label="Preguntas del nivel ${nivelActivo}">
        ${preguntasNivel.length === 0 ? `
          <div class="tarjeta-pregunta" style="text-align: center; padding: var(--espacio-xl);">
            <p class="color-texto-suave" style="margin-bottom: var(--espacio-m);">
              No hay preguntas registradas para el <strong>Nivel ${nivelActivo} (${NIVELES_BLOOM[nivelActivo - 1].nombre})</strong>.
            </p>
            <div>
              <button type="button" class="btn btn--primario btn--pequeno" id="btn-vacio-nueva">
                + Crear manualmente
              </button>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-vacio-ia">
                ✨ Generar con IA
              </button>
            </div>
          </div>
        ` : `
          ${preguntasNivel.map(p => renderTarjetaPregunta(p)).join('')}
        `}
      </section>
    </div>
  `;

  conectarEventosBanco();
}

function renderTarjetaPregunta(p) {
  const tipoLabel = {
    opcion: 'Opción múltiple',
    vf: 'Verdadero / Falso',
    completar: 'Completar'
  }[p.tipo] || p.tipo;

  const estadoBadge = p.estado === 'aprobado'
    ? '<span class="insignia insignia--exito">Aprobado</span>'
    : '<span class="insignia insignia--advertencia">Borrador</span>';

  const origenBadge = p.origen === 'ia'
    ? '<span class="insignia insignia--secundario">IA</span>'
    : '<span class="insignia insignia--secundario">Docente</span>';

  // Opciones con respuesta correcta resaltada
  let opcionesHtml = '';
  if (p.tipo === 'opcion' && Array.isArray(p.opciones)) {
    opcionesHtml = `
      <ul class="tarjeta-pregunta__opciones">
        ${p.opciones.map((op, idx) => {
          const esCorrecta = Number(p.correcta) === idx;
          return `
            <li class="opcion-item ${esCorrecta ? 'opcion-item--correcta' : ''}">
              <span>${esCorrecta ? '✓' : '•'}</span>
              <span>${ui.escapar(op)}</span>
              ${esCorrecta ? '<small style="margin-left: auto;">(Correcta)</small>' : ''}
            </li>
          `;
        }).join('')}
      </ul>
    `;
  } else if (p.tipo === 'vf') {
    const esV = p.correcta === true || p.correcta === 'true' || Number(p.correcta) === 0;
    opcionesHtml = `
      <ul class="tarjeta-pregunta__opciones">
        <li class="opcion-item ${esV ? 'opcion-item--correcta' : ''}">
          <span>${esV ? '✓' : '•'}</span>
          <span>Verdadero</span>
          ${esV ? '<small style="margin-left: auto;">(Correcta)</small>' : ''}
        </li>
        <li class="opcion-item ${!esV ? 'opcion-item--correcta' : ''}">
          <span>${!esV ? '✓' : '•'}</span>
          <span>Falso</span>
          ${!esV ? '<small style="margin-left: auto;">(Correcta)</small>' : ''}
        </li>
      </ul>
    `;
  } else if (p.tipo === 'completar') {
    opcionesHtml = `
      <div class="opcion-item opcion-item--correcta">
        <span>✓ Respuesta esperada:</span>
        <strong>${ui.escapar(String(p.correcta))}</strong>
      </div>
    `;
  }

  return `
    <article class="tarjeta-pregunta" data-id="${ui.escapar(p.id)}">
      <div class="tarjeta-pregunta__cabecera">
        <div class="tarjeta-pregunta__insignias">
          <span class="insignia insignia--primario">${tipoLabel}</span>
          ${estadoBadge}
          ${origenBadge}
        </div>
        <div class="tarjeta-pregunta__acciones">
          <button type="button" class="btn btn--secundario btn--pequeno btn-editar-pregunta" data-id="${ui.escapar(p.id)}">
            Editar
          </button>
          <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-pregunta" data-id="${ui.escapar(p.id)}">
            Eliminar
          </button>
        </div>
      </div>

      <div class="tarjeta-pregunta__enunciado">
        ${ui.escapar(p.enunciado)}
      </div>

      ${opcionesHtml}

      ${p.retroalimentacion ? `
        <div class="tarjeta-pregunta__retro">
          <strong>Retroalimentación:</strong> ${ui.escapar(p.retroalimentacion)}
        </div>
      ` : ''}
    </article>
  `;
}

function conectarEventosBanco() {
  const selectorTema = document.getElementById('selector-tema-banco');
  if (selectorTema) {
    selectorTema.addEventListener('change', async (e) => {
      temaSeleccionadoId = e.target.value;
      await cargarPreguntas();
    });
  }

  // Pestañas de niveles
  document.querySelectorAll('.pestana-nivel').forEach(btn => {
    btn.addEventListener('click', () => {
      nivelActivo = parseInt(btn.getAttribute('data-nivel'), 10);
      renderizarBanco();
    });
  });

  // Botones Nueva pregunta
  const btnNueva = document.getElementById('btn-nueva-pregunta');
  const btnVacioNueva = document.getElementById('btn-vacio-nueva');
  if (btnNueva) btnNueva.addEventListener('click', () => abrirModalPregunta());
  if (btnVacioNueva) btnVacioNueva.addEventListener('click', () => abrirModalPregunta());

  // Botones Generar con IA
  const btnIA = document.getElementById('btn-generar-ia');
  const btnVacioIA = document.getElementById('btn-vacio-ia');
  if (btnIA) btnIA.addEventListener('click', () => iniciarGeneracionPreguntasIA());
  if (btnVacioIA) btnVacioIA.addEventListener('click', () => iniciarGeneracionPreguntasIA());

  // Delegación de edición y eliminación
  document.querySelectorAll('.btn-editar-pregunta').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const pregunta = todasLasPreguntas.find(p => p.id === id);
      if (pregunta) abrirModalPregunta(pregunta);
    });
  });

  document.querySelectorAll('.btn-eliminar-pregunta').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const seguro = await ui.confirmar('¿Estás seguro de que deseas eliminar esta pregunta del banco?');
      if (seguro) {
        try {
          ui.cargando(true);
          await api.eliminar('preguntas', id);
          todasLasPreguntas = todasLasPreguntas.filter(p => p.id !== id);
          ui.aviso('Pregunta eliminada con éxito', 'exito');
          renderizarBanco();
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar la pregunta', 'error');
        } finally {
          ui.cargando(false);
        }
      }
    });
  });
}

// --------------------------------------------------------------------
// MODAL DE CREACIÓN / EDICIÓN MANUAL DE PREGUNTA
// --------------------------------------------------------------------
async function abrirModalPregunta(preguntaObj = null) {
  const esEdicion = Boolean(preguntaObj);
  const tipoInicial = preguntaObj?.tipo || 'opcion';
  const nivelInicial = preguntaObj ? Number(preguntaObj.nivel) : nivelActivo;
  const enunciadoInicial = preguntaObj?.enunciado || '';
  const opcionesIniciales = Array.isArray(preguntaObj?.opciones) ? preguntaObj.opciones : ['', '', '', ''];
  const correctaInicial = preguntaObj?.correcta !== undefined ? preguntaObj.correcta : 0;
  const retroInicial = preguntaObj?.retroalimentacion || '';
  const estadoInicial = preguntaObj?.estado || 'aprobado';

  const formHtml = `
    <form id="form-pregunta" class="form-pregunta" onsubmit="return false;" style="display:flex; flex-direction:column; gap:var(--espacio-s);">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--espacio-s);">
        <div class="campo">
          <label for="pregunta-tipo"><strong>Tipo de pregunta</strong></label>
          <select id="pregunta-tipo" required>
            <option value="opcion" ${tipoInicial === 'opcion' ? 'selected' : ''}>Opción múltiple (4 opciones)</option>
            <option value="vf" ${tipoInicial === 'vf' ? 'selected' : ''}>Verdadero / Falso</option>
            <option value="completar" ${tipoInicial === 'completar' ? 'selected' : ''}>Completar espacio (____)</option>
          </select>
        </div>
        <div class="campo">
          <label for="pregunta-nivel"><strong>Nivel cognitivo (Bloom)</strong></label>
          <select id="pregunta-nivel" required>
            ${NIVELES_BLOOM.map(n => `
              <option value="${n.nivel}" ${n.nivel === nivelInicial ? 'selected' : ''}>
                Nivel ${n.nivel}: ${n.nombre}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="campo">
        <label for="pregunta-enunciado"><strong>Enunciado de la pregunta</strong></label>
        <textarea id="pregunta-enunciado" rows="3" required placeholder="Escribe el enunciado aquí...">${ui.escapar(enunciadoInicial)}</textarea>
        <small class="color-texto-suave" id="ayuda-enunciado">
          ${tipoInicial === 'completar' ? 'Usa "____" (cuatro guiones bajos) para indicar el espacio a completar.' : ''}
        </small>
      </div>

      <!-- Contenedor dinámico de opciones según tipo -->
      <div id="contenedor-dinamico-opciones" class="campo">
        <!-- Rellenado por JS -->
      </div>

      <div class="campo">
        <label for="pregunta-retro"><strong>Retroalimentación formativa</strong></label>
        <textarea id="pregunta-retro" rows="2" placeholder="Explica brevemente por qué la respuesta es correcta...">${ui.escapar(retroInicial)}</textarea>
      </div>

      <div class="campo" style="max-width: 200px;">
        <label for="pregunta-estado"><strong>Estado</strong></label>
        <select id="pregunta-estado">
          <option value="aprobado" ${estadoInicial === 'aprobado' ? 'selected' : ''}>Aprobado</option>
          <option value="borrador" ${estadoInicial === 'borrador' ? 'selected' : ''}>Borrador</option>
        </select>
      </div>
    </form>
  `;

  // Renderizador de opciones según el tipo seleccionado
  function renderOpcionesSegunTipo(tipo, opts = ['', '', '', ''], corr = 0) {
    const contenedorOpts = document.getElementById('contenedor-dinamico-opciones');
    const ayudaEnunciado = document.getElementById('ayuda-enunciado');
    if (!contenedorOpts) return;

    if (ayudaEnunciado) {
      ayudaEnunciado.textContent = tipo === 'completar'
        ? 'Usa "____" (cuatro guiones bajos) para indicar el espacio a completar.'
        : '';
    }

    if (tipo === 'opcion') {
      const idxCorrecta = Number(corr) || 0;
      contenedorOpts.innerHTML = `
        <label><strong>Opciones y respuesta correcta:</strong></label>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${[0, 1, 2, 3].map(i => `
            <div style="display:flex; align-items:center; gap:var(--espacio-s);">
              <input type="radio" name="opcion-correcta-radio" value="${i}" id="radio-opt-${i}" ${i === idxCorrecta ? 'checked' : ''} aria-label="Opción ${i + 1} correcta">
              <input type="text" class="input-opcion-item" data-idx="${i}" value="${ui.escapar(opts[i] || '')}" placeholder="Opción ${i + 1}" required style="flex:1;">
            </div>
          `).join('')}
        </div>
      `;
    } else if (tipo === 'vf') {
      const esV = corr === true || corr === 'true' || Number(corr) === 0;
      contenedorOpts.innerHTML = `
        <label><strong>Respuesta correcta:</strong></label>
        <div style="display:flex; gap:var(--espacio-l); padding:var(--espacio-xs) 0;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="radio" name="vf-correcta-radio" value="true" ${esV ? 'checked' : ''}>
            <span>Verdadero</span>
          </label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="radio" name="vf-correcta-radio" value="false" ${!esV ? 'checked' : ''}>
            <span>Falso</span>
          </label>
        </div>
      `;
    } else if (tipo === 'completar') {
      const valCorr = String(corr || opts[0] || '');
      contenedorOpts.innerHTML = `
        <label for="input-completar-correcta"><strong>Palabra o frase corta correcta:</strong></label>
        <input type="text" id="input-completar-correcta" value="${ui.escapar(valCorr)}" placeholder="Ej. absorbible" required style="width:100%;">
      `;
    }
  }

  setTimeout(() => {
    const selectTipo = document.getElementById('pregunta-tipo');
    renderOpcionesSegunTipo(tipoInicial, opcionesIniciales, correctaInicial);

    if (selectTipo) {
      selectTipo.addEventListener('change', (e) => {
        renderOpcionesSegunTipo(e.target.value);
      });
    }
  }, 10);

  await ui.modal({
    titulo: esEdicion ? 'Editar pregunta' : 'Nueva pregunta',
    contenido: formHtml,
    acciones: [
      { texto: 'Cancelar', valor: false },
      {
        texto: esEdicion ? 'Actualizar' : 'Guardar',
        primario: true,
        alHacer: async (dialogo, cuerpoModal) => {
          const tipo = cuerpoModal.querySelector('#pregunta-tipo')?.value || 'opcion';
          const nivel = parseInt(cuerpoModal.querySelector('#pregunta-nivel')?.value, 10) || 1;
          const enunciado = cuerpoModal.querySelector('#pregunta-enunciado')?.value.trim();
          const retro = cuerpoModal.querySelector('#pregunta-retro')?.value.trim() || '';
          const estado = cuerpoModal.querySelector('#pregunta-estado')?.value || 'aprobado';

          if (!enunciado) {
            ui.aviso('El enunciado de la pregunta es obligatorio', 'error');
            return false;
          }

          let opciones = [];
          let correcta = null;

          if (tipo === 'opcion') {
            const inputs = Array.from(cuerpoModal.querySelectorAll('.input-opcion-item'));
            opciones = inputs.map(inp => inp.value.trim());
            if (opciones.some(o => !o)) {
              ui.aviso('Debes completar las 4 opciones de respuesta', 'error');
              return false;
            }
            const radio = cuerpoModal.querySelector('input[name="opcion-correcta-radio"]:checked');
            correcta = radio ? parseInt(radio.value, 10) : 0;
          } else if (tipo === 'vf') {
            opciones = ['Verdadero', 'Falso'];
            const radio = cuerpoModal.querySelector('input[name="vf-correcta-radio"]:checked');
            correcta = radio ? radio.value === 'true' : true;
          } else if (tipo === 'completar') {
            const inp = cuerpoModal.querySelector('#input-completar-correcta');
            const val = inp ? inp.value.trim() : '';
            if (!val) {
              ui.aviso('Debes indicar la palabra correcta para completar el espacio', 'error');
              return false;
            }
            correcta = val;
            opciones = [val];
          }

          const datosPregunta = {
            temaId: temaSeleccionadoId,
            nivel,
            tipo,
            enunciado,
            opciones,
            correcta,
            retroalimentacion: retro,
            estado,
            origen: preguntaObj?.origen || 'docente'
          };

          try {
            ui.cargando(true);
            if (esEdicion) {
              const actualizada = await api.actualizar('preguntas', preguntaObj.id, datosPregunta);
              const idx = todasLasPreguntas.findIndex(p => p.id === preguntaObj.id);
              if (idx !== -1) todasLasPreguntas[idx] = { ...todasLasPreguntas[idx], ...actualizada };
              ui.aviso('Pregunta actualizada con éxito', 'exito');
            } else {
              const creada = await api.crear('preguntas', datosPregunta);
              todasLasPreguntas.push(creada);
              ui.aviso('Pregunta añadida al banco con éxito', 'exito');
            }
            renderizarBanco();
            return true;
          } catch (err) {
            ui.aviso(err.message || 'Error al guardar la pregunta', 'error');
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

// --------------------------------------------------------------------
// GENERACIÓN DE PREGUNTAS CON IA
// --------------------------------------------------------------------
async function iniciarGeneracionPreguntasIA() {
  const formHtml = `
    <div style="display:flex; flex-direction:column; gap:var(--espacio-s);">
      <p class="color-texto-suave">
        La Inteligencia Artificial generará preguntas por competencias a partir de los objetivos, resumen y glosario del tema.
      </p>
      <div class="campo">
        <label for="ia-nivel-preguntas"><strong>Nivel cognitivo (Taxonomía de Bloom):</strong></label>
        <select id="ia-nivel-preguntas">
          <option value="todos">🌟 Todos los niveles (Nivel 1 al 5 · Banco completo)</option>
          ${NIVELES_BLOOM.map(n => `
            <option value="${n.nivel}" ${n.nivel === nivelActivo ? 'selected' : ''}>
              Nivel ${n.nivel}: ${n.nombre}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="campo">
        <label for="ia-cantidad-preguntas"><strong>Cantidad a generar:</strong></label>
        <input type="number" id="ia-cantidad-preguntas" min="5" max="25" value="10" style="max-width: 120px;" required>
        <small class="color-texto-suave">
          Para un solo nivel: entre 5 y 15 preguntas. Para todos los niveles: se distribuirán automáticamente entre los 5 niveles.
        </small>
      </div>
    </div>
  `;

  const config = await ui.modal({
    titulo: 'Generar preguntas con IA',
    contenido: formHtml,
    acciones: [
      { texto: 'Cancelar', valor: null },
      {
        texto: 'Generar preguntas',
        primario: true,
        alHacer: (dialogo, cuerpo) => {
          const valNivel = cuerpo.querySelector('#ia-nivel-preguntas')?.value || '1';
          const cantidad = parseInt(cuerpo.querySelector('#ia-cantidad-preguntas')?.value, 10);
          if (isNaN(cantidad) || cantidad < 5) {
            ui.aviso('La cantidad debe ser de al menos 5 preguntas', 'error');
            return false;
          }
          return { nivel: valNivel, cantidad };
        }
      }
    ]
  });

  if (!config) return;

  const propuestas = [];
  try {
    ui.cargando(true);

    if (config.nivel === 'todos') {
      const cantPorNivel = Math.max(2, Math.min(5, Math.round(config.cantidad / 5)));
      for (let n = 1; n <= 5; n++) {
        try {
          const lote = await api.ia('generar-preguntas', {
            temaId: temaSeleccionadoId,
            nivel: n,
            cantidad: cantPorNivel
          });
          if (Array.isArray(lote)) {
            for (const p of lote) {
              propuestas.push({ ...p, nivel: n });
            }
          }
        } catch (errNivel) {
          console.error(`Error al generar nivel ${n}:`, errNivel);
        }
      }
    } else {
      const nivelNum = parseInt(config.nivel, 10) || 1;
      const lote = await api.ia('generar-preguntas', {
        temaId: temaSeleccionadoId,
        nivel: nivelNum,
        cantidad: Math.min(15, Math.max(5, config.cantidad))
      });
      if (Array.isArray(lote)) {
        for (const p of lote) {
          propuestas.push({ ...p, nivel: nivelNum });
        }
      }
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al generar preguntas con IA', 'error');
    return;
  } finally {
    ui.cargando(false);
  }

  if (!Array.isArray(propuestas) || propuestas.length === 0) {
    ui.aviso('La IA no devolvió preguntas válidas. Verifica la clave y modelo en Administrador > Configurar IA.', 'error');
    return;
  }

  await mostrarModalPropuestasPreguntas(propuestas, config.nivel === 'todos' ? null : parseInt(config.nivel, 10));
}

async function mostrarModalPropuestasPreguntas(propuestas, nivelSeleccionado) {
  const analizadas = propuestas.map((p, idx) => ({
    ...p,
    idx,
    descartada: false
  }));

  const contenidoHtml = `
    <div class="modal-propuestas-preguntas">
      <p class="color-texto-suave">
        Revisa, edita o descarta las propuestas de la IA. Las preguntas aprobadas se incorporarán con origen "ia" y estado "aprobado".
      </p>
      <div class="modal-propuestas-preguntas__scroll" id="contenedor-cards-propuestas">
        ${analizadas.map(p => `
          <div class="propuesta-card" id="propuesta-card-${p.idx}" data-idx="${p.idx}">
            <div class="propuesta-card__top">
              <label style="display:flex; align-items:center; gap:var(--espacio-xs); cursor:pointer;">
                <input type="checkbox" class="check-aprobar-propuesta" data-idx="${p.idx}" checked>
                <strong>Pregunta #${p.idx + 1} · Nivel ${p.nivel || nivelSeleccionado || 1} (${p.tipo})</strong>
              </label>
              <button type="button" class="btn btn--peligro btn--pequeno btn-descartar-propuesta" data-idx="${p.idx}">
                Descartar
              </button>
            </div>

            <div class="campo" style="margin-top:4px;">
              <textarea class="propuesta-enunciado" rows="2" style="width:100%; box-sizing:border-box;">${ui.escapar(p.enunciado || '')}</textarea>
            </div>

            ${p.tipo === 'opcion' && Array.isArray(p.opciones) ? `
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                ${p.opciones.map((op, oIdx) => `
                  <input type="text" class="propuesta-opcion" data-oidx="${oIdx}" value="${ui.escapar(op)}" style="font-size:var(--tamano-s);">
                `).join('')}
              </div>
            ` : ''}

            <div class="campo" style="margin-top:4px;">
              <input type="text" class="propuesta-retro" value="${ui.escapar(p.retroalimentacion || '')}" placeholder="Retroalimentación" style="width:100%; font-size:var(--tamano-s);">
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  setTimeout(() => {
    // Conectar botones de descarte individual
    document.querySelectorAll('.btn-descartar-propuesta').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.getAttribute('data-idx');
        const card = document.getElementById(`propuesta-card-${idx}`);
        const chk = card?.querySelector('.check-aprobar-propuesta');
        if (chk) chk.checked = false;
        if (card) card.classList.add('propuesta-card--descartada');
      });
    });

    document.querySelectorAll('.check-aprobar-propuesta').forEach(chk => {
      chk.addEventListener('change', () => {
        const idx = chk.getAttribute('data-idx');
        const card = document.getElementById(`propuesta-card-${idx}`);
        if (card) {
          if (chk.checked) card.classList.remove('propuesta-card--descartada');
          else card.classList.add('propuesta-card--descartada');
        }
      });
    });
  }, 10);

  await ui.modal({
    titulo: 'Propuestas de preguntas con IA',
    contenido: contenidoHtml,
    acciones: [
      { texto: 'Cancelar', valor: false },
      {
        texto: 'Aprobar seleccionadas',
        primario: true,
        alHacer: async (dialogo, cuerpo) => {
          const cards = Array.from(cuerpo.querySelectorAll('.propuesta-card'));
          const seleccionadas = [];

          for (const card of cards) {
            const chk = card.querySelector('.check-aprobar-propuesta');
            if (!chk || !chk.checked) continue;

            const idx = parseInt(card.getAttribute('data-idx'), 10);
            const original = analizadas[idx];
            const inputEnunciado = card.querySelector('.propuesta-enunciado');
            const inputRetro = card.querySelector('.propuesta-retro');
            const inputsOpciones = Array.from(card.querySelectorAll('.propuesta-opcion'));

            const enunciado = inputEnunciado ? inputEnunciado.value.trim() : original.enunciado;
            const retro = inputRetro ? inputRetro.value.trim() : original.retroalimentacion;
            const opciones = inputsOpciones.length > 0
              ? inputsOpciones.map(inp => inp.value.trim())
              : (Array.isArray(original.opciones) ? original.opciones : []);

            if (!enunciado) {
              ui.aviso('Todas las preguntas aprobadas deben tener un enunciado', 'error');
              return false;
            }

            seleccionadas.push({
              temaId: temaSeleccionadoId,
              nivel: original.nivel || nivelSeleccionado || 1,
              tipo: original.tipo || 'opcion',
              enunciado,
              opciones,
              correcta: original.correcta,
              retroalimentacion: retro,
              origen: 'ia',
              estado: 'aprobado'
            });
          }

          if (seleccionadas.length === 0) {
            ui.aviso('Selecciona al menos una propuesta para aprobar', 'advertencia');
            return false;
          }

          try {
            ui.cargando(true);
            const guardadas = [];
            for (const item of seleccionadas) {
              const creada = await api.crear('preguntas', item);
              guardadas.push(creada);
              todasLasPreguntas.push(creada);
            }

            if (nivelSeleccionado) {
              nivelActivo = nivelSeleccionado;
            }
            renderizarBanco();
            ui.aviso(`Se aprobaron y crearon ${guardadas.length} pregunta(s) en el banco`, 'exito');
            return true;
          } catch (err) {
            ui.aviso(err.message || 'Error al guardar preguntas aprobadas', 'error');
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

// Inicialización del módulo
const ok = await cargarTemas();
if (ok) {
  await cargarPreguntas();
}
