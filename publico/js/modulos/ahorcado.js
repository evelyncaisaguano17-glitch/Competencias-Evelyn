// publico/js/modulos/ahorcado.js · Juego del ahorcado con globo desinflable (no violento)
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

// Alfabeto en español para el teclado en pantalla y físico
const LETRAS_ALFABETO = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q',
  'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

let temaActual = null;
let terminosTema = [];
const usados = new Set();

let palabraActual = null;
let terminoNormalizado = '';
let letrasProbadas = new Set();
let errores = 0;
let juegoTerminado = false;
let tiempoInicio = 0;

async function iniciar() {
  await montarPlantilla({
    titulo: 'Ahorcado',
    roles: ['estudiante', 'docente']
  });

  const contenedor = document.getElementById('contenido');
  if (!contenedor) return;

  ui.cargando(true);
  try {
    temaActual = await obtenerTemaActividad();
  } catch (err) {
    console.error('Error al obtener tema:', err);
  } finally {
    ui.cargando(false);
  }

  if (!temaActual) {
    mostrarPantallaSinTema(contenedor);
    return;
  }

  ui.cargando(true);
  try {
    const glosario = await api.listar('glosario', { temaId: temaActual.id });
    terminosTema = (Array.isArray(glosario) ? glosario : []).filter(item => {
      if (!item || !item.termino) return false;
      const normal = util.normalizar(item.termino);
      return normal.length === 6;
    });
  } catch (err) {
    console.error('Error al listar glosario:', err);
    terminosTema = [];
  } finally {
    ui.cargando(false);
  }

  iniciarSiguientePalabra();

  // Escuchar teclado físico
  window.addEventListener('keydown', manejarTecladoFisico);
}

function mostrarPantallaSinTema(contenedor) {
  contenedor.innerHTML = `
    <div class="vacio" role="alert">
      <div class="vacio__icono" aria-hidden="true">🎈</div>
      <h3 class="vacio__titulo">No se seleccionó un tema</h3>
      <p class="vacio__descripcion">Debes elegir un tema curricular para jugar y reforzar los términos del glosario.</p>
      <div class="fila fila--centrada" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <button type="button" id="btn-reintentar-tema" class="btn btn--primario">Elegir tema</button>
        <a href="/paginas/actividades.html" class="btn btn--secundario">Ir a Actividades</a>
      </div>
    </div>
  `;

  const btn = document.getElementById('btn-reintentar-tema');
  if (btn) {
    btn.addEventListener('click', async () => {
      const tema = await obtenerTemaActividad();
      if (tema) {
        temaActual = tema;
        ui.cargando(true);
        try {
          const glosario = await api.listar('glosario', { temaId: temaActual.id });
          terminosTema = (Array.isArray(glosario) ? glosario : []).filter(item => {
            return item && item.termino && util.normalizar(item.termino).length === 6;
          });
          iniciarSiguientePalabra();
        } finally {
          ui.cargando(false);
        }
      }
    });
  }
}

function iniciarSiguientePalabra() {
  const contenedor = document.getElementById('contenido');
  if (!contenedor || !temaActual) return;

  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  // Elegir al azar uno que no se haya usado en la partida actual
  const disponibles = terminosTema.filter(t => !usados.has(t.id || t.termino));

  if (disponibles.length === 0) {
    contenedor.innerHTML = `
      <section class="ahorcado-cabecera">
        <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span aria-hidden="true">/</span>
          <a href="${ui.escapar(enlaceTema)}">${ui.escapar(temaActual.titulo)}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Ahorcado</span>
        </nav>
      </section>

      <div class="vacio" role="alert">
        <div class="vacio__icono" aria-hidden="true">📖</div>
        <h3 class="vacio__titulo">No hay más términos de 6 letras</h3>
        <p class="vacio__descripcion">
          ${usados.size > 0
            ? '¡Excelente! Has completado todos los términos de 6 letras disponibles para este tema.'
            : 'Este tema no dispone de términos de exactamente 6 letras en su glosario.'}
        </p>
        <div class="fila fila--centrada" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
          <a href="${ui.escapar(enlaceTema)}" class="btn btn--primario">Volver al tema: ${ui.escapar(temaActual.titulo)}</a>
          <a href="/paginas/actividades.html" class="btn btn--secundario">Otras actividades</a>
        </div>
      </div>
    `;
    return;
  }

  // Selección al azar
  const indice = Math.floor(Math.random() * disponibles.length);
  palabraActual = disponibles[indice];
  usados.add(palabraActual.id || palabraActual.termino);

  terminoNormalizado = util.normalizar(palabraActual.termino);
  letrasProbadas = new Set();
  errores = 0;
  juegoTerminado = false;
  tiempoInicio = Date.now();

  renderizarInterfaz(contenedor, enlaceTema);
}

function renderizarInterfaz(contenedor, enlaceTema) {
  contenedor.innerHTML = `
    <section class="ahorcado-cabecera">
      <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span aria-hidden="true">/</span>
        <a href="${ui.escapar(enlaceTema)}">${ui.escapar(temaActual.titulo)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Ahorcado</span>
      </nav>

      <div class="fila fila--entre fila--centrada">
        <div>
          <h2>Ahorcado: Globo aerostático</h2>
          <p class="texto-atenuado">
            Tema: <strong>${ui.escapar(temaActual.titulo)}</strong> · Adivina la palabra antes de que el globo se desinfle (máx. 3 errores permitidos).
          </p>
        </div>
        <a href="${ui.escapar(enlaceTema)}" class="btn btn--secundario btn--pequeno">← Volver al tema</a>
      </div>
    </section>

    <div class="ahorcado-juego">
      <div class="ahorcado-panel">
        <!-- Figura no violenta de 4 estados (globo que se desinfla) -->
        <div class="globo-contenedor" aria-live="polite">
          <svg id="globo-svg" class="globo-svg estado-0" viewBox="0 0 200 240" role="img" aria-label="Globo inflado: 0 errores">
            <g class="globo-grupo">
              <path class="globo-cuerda" d="M100 150 Q92 180 106 205 T100 235" fill="none" />
              <polygon class="globo-nudo" points="93 148 107 148 100 156" />
              <ellipse class="globo-cuerpo" cx="100" cy="85" rx="55" ry="65" />
              <ellipse class="globo-brillo" cx="80" cy="60" rx="10" ry="16" transform="rotate(-20 80 60)" />
              <g class="globo-aire">
                <path class="aire-onda" d="M85 160 Q75 170 68 172" fill="none" />
                <path class="aire-onda" d="M115 160 Q125 170 132 172" fill="none" />
              </g>
            </g>
          </svg>
          <div id="globo-contador">
            <span class="insignia insignia--secundario" id="texto-vidas">Oportunidades: 3 permitidas</span>
          </div>
        </div>

        <!-- Pista de la palabra -->
        <div class="ahorcado-pista" id="ahorcado-pista">
          <strong>Pista:</strong> ${ui.escapar(palabraActual.pista || 'Palabra clave del tema.')}
        </div>

        <!-- 6 casillas para las letras -->
        <div class="ahorcado-palabra" id="casillas-palabra" aria-live="polite" aria-label="Letras de la palabra">
          ${renderCasillas()}
        </div>

        <!-- Teclado en pantalla (A-Z con Ñ) -->
        <div class="ahorcado-teclado" id="teclado-pantalla" role="group" aria-label="Teclado de letras">
          ${LETRAS_ALFABETO.map(letra => `
            <button type="button" class="tecla" data-letra="${letra}" aria-label="Letra ${letra}">
              ${letra}
            </button>
          `).join('')}
        </div>

        <!-- Contenedor para retroalimentación y acciones -->
        <div id="contenedor-retro" style="width: 100%;"></div>

        <div id="contenedor-acciones" class="ahorcado-acciones" style="display: none;">
          <button type="button" id="btn-otra-palabra" class="btn btn--primario">
            Otra palabra →
          </button>
        </div>
      </div>
    </div>
  `;

  // Asignar eventos de clic a las teclas
  const teclado = document.getElementById('teclado-pantalla');
  if (teclado) {
    teclado.addEventListener('click', (e) => {
      const boton = e.target.closest('.tecla');
      if (!boton || boton.disabled || juegoTerminado) return;
      const letra = boton.dataset.letra;
      if (letra) {
        probarLetra(letra);
      }
    });
  }

  // Evento botón Otra palabra
  const btnOtra = document.getElementById('btn-otra-palabra');
  if (btnOtra) {
    btnOtra.addEventListener('click', () => {
      iniciarSiguientePalabra();
    });
  }
}

function renderCasillas(revelarTodo = false) {
  const chars = terminoNormalizado.split('');
  return chars.map((letra, i) => {
    const descubierta = letrasProbadas.has(letra);
    if (descubierta) {
      return `<div class="ahorcado-casilla revelada" aria-label="Letra ${i + 1}: ${letra}">${letra}</div>`;
    }
    if (revelarTodo) {
      return `<div class="ahorcado-casilla no-adivinada" aria-label="Letra ${i + 1} no adivinada: ${letra}">${letra}</div>`;
    }
    return `<div class="ahorcado-casilla" aria-label="Letra ${i + 1}: oculta">_</div>`;
  }).join('');
}

function manejarTecladoFisico(e) {
  if (juegoTerminado || !palabraActual) return;
  // Si hay un modal abierto o foco en un input, ignorar
  if (document.querySelector('.modal-capa') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    return;
  }

  const letra = util.normalizar(e.key);
  if (letra.length === 1 && LETRAS_ALFABETO.includes(letra)) {
    e.preventDefault();
    probarLetra(letra);
  }
}

async function probarLetra(letra) {
  if (juegoTerminado || letrasProbadas.has(letra)) return;

  letrasProbadas.add(letra);

  const boton = document.querySelector(`.tecla[data-letra="${letra}"]`);
  const acierto = terminoNormalizado.includes(letra);

  if (boton) {
    boton.disabled = true;
    boton.classList.add(acierto ? 'tecla--acierto' : 'tecla--error');
  }

  if (acierto) {
    // Actualizar casillas
    const contenedorCasillas = document.getElementById('casillas-palabra');
    if (contenedorCasillas) {
      contenedorCasillas.innerHTML = renderCasillas();
    }

    // Comprobar si ganó
    const todasAdivinadas = terminoNormalizado.split('').every(c => letrasProbadas.has(c));
    if (todasAdivinadas) {
      await finalizarPartida(true);
    }
  } else {
    // Error
    errores++;
    actualizarGlobo();

    // Se permiten 3 errores: el juego termina en el cuarto
    if (errores >= 4) {
      await finalizarPartida(false);
    }
  }
}

function actualizarGlobo() {
  const globo = document.getElementById('globo-svg');
  const contador = document.getElementById('texto-vidas');
  if (!globo) return;

  globo.className = `globo-svg estado-${Math.min(errores, 4)}`;

  if (contador) {
    if (errores === 0) {
      contador.className = 'insignia insignia--secundario';
      contador.textContent = 'Oportunidades: 3 permitidas';
      globo.setAttribute('aria-label', 'Globo inflado: 0 errores');
    } else if (errores === 1) {
      contador.className = 'insignia insignia--advertencia';
      contador.textContent = 'Oportunidades restantes: 2';
      globo.setAttribute('aria-label', 'Globo desinflándose: 1 error');
    } else if (errores === 2) {
      contador.className = 'insignia insignia--advertencia';
      contador.textContent = 'Oportunidades restantes: 1';
      globo.setAttribute('aria-label', 'Globo a la mitad: 2 errores');
    } else if (errores === 3) {
      contador.className = 'insignia insignia--peligro';
      contador.textContent = '¡Última oportunidad! (3 errores)';
      globo.setAttribute('aria-label', 'Globo casi desinflado: 3 errores');
    } else {
      contador.className = 'insignia insignia--peligro';
      contador.textContent = 'Globo desinflado (4 errores)';
      globo.setAttribute('aria-label', 'Globo completamente desinflado: 4 errores');
    }
  }
}

async function finalizarPartida(gano) {
  juegoTerminado = true;

  // Revelar la palabra completa
  const contenedorCasillas = document.getElementById('casillas-palabra');
  if (contenedorCasillas) {
    contenedorCasillas.innerHTML = renderCasillas(true);
  }

  // Deshabilitar todas las teclas
  const teclas = document.querySelectorAll('.tecla');
  teclas.forEach(t => {
    t.disabled = true;
  });

  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  // Mostrar retroalimentación
  const retroHtml = mostrarRetro({
    correcto: gano,
    explicacion: palabraActual.definicion || `La palabra correcta era "${palabraActual.termino}".`,
    sugerencia: palabraActual.retroalimentacion || 'Repasa los términos del glosario para dominar el vocabulario.',
    enlaceTema
  });

  const contenedorRetro = document.getElementById('contenedor-retro');
  if (contenedorRetro) {
    contenedorRetro.innerHTML = retroHtml;
  }

  // Mostrar botón Otra palabra
  const contenedorAcciones = document.getElementById('contenedor-acciones');
  if (contenedorAcciones) {
    contenedorAcciones.style.display = 'flex';
  }

  // Registrar intento en el servidor
  try {
    await registrarIntento({
      actividad: 'ahorcado',
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de ahorcado:', err);
  }
}

await iniciar();
