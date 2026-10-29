// publico/js/modulos/sopa-letras.js · Sopa de letras interactiva con Pointer Events
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

const ALFABETO = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
  'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q',
  'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

/**
 * Función pura que genera la matriz y coloca las palabras.
 * @param {string[]|Object[]} palabras - Lista de palabras o términos a colocar
 * @param {number} tamano - Dimensión de la grilla (ej. 10, 12, 15)
 * @param {Array} direcciones - Direcciones permitidas (vectores [dr, dc] o identificadores)
 * @returns {{ grilla: string[][], ubicaciones: Array }} Matriz con letras y datos de ubicación
 */
export function generarSopa(palabras, tamano = 10, direcciones = [[0, 1], [1, 0]]) {
  // Normalizar vectores de dirección
  const mapeoDirs = {
    horizontal: [0, 1],
    vertical: [1, 0],
    diagonal: [1, 1],
    'diagonal-arriba': [-1, 1],
    'horizontal-invertida': [0, -1],
    'vertical-invertida': [-1, 0],
    'diagonal-invertida': [-1, -1],
    'diagonal-arriba-invertida': [1, -1]
  };

  const dirsNormalizadas = (Array.isArray(direcciones) ? direcciones : [[0, 1], [1, 0]])
    .map(d => {
      if (Array.isArray(d) && d.length === 2) return d;
      if (typeof d === 'string' && mapeoDirs[d]) return mapeoDirs[d];
      return null;
    })
    .filter(Boolean);

  if (dirsNormalizadas.length === 0) {
    dirsNormalizadas.push([0, 1], [1, 0]);
  }

  // Filtrar y normalizar palabras de una sola palabra, de 3 letras hasta el tamaño
  const listaPalabras = (Array.isArray(palabras) ? palabras : [])
    .map(p => {
      if (typeof p === 'string') return util.normalizar(p);
      if (p && typeof p.termino === 'string') return util.normalizar(p.termino);
      if (p && typeof p.palabra === 'string') return util.normalizar(p.palabra);
      return '';
    })
    .filter(p => p.length >= 3 && p.length <= tamano && !p.includes(' '));

  // Ordenar de la más larga a la más corta
  const palabrasOrdenadas = [...listaPalabras].sort((a, b) => b.length - a.length);

  // Inicializar grilla vacía
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(''));
  const ubicaciones = [];

  // Colocar cada palabra con hasta 200 intentos
  for (const palabra of palabrasOrdenadas) {
    const len = palabra.length;
    let colocada = false;

    for (let intento = 0; intento < 200; intento++) {
      const dir = dirsNormalizadas[Math.floor(Math.random() * dirsNormalizadas.length)];
      const [dr, dc] = dir;

      const minR = dr < 0 ? len - 1 : 0;
      const maxR = dr > 0 ? tamano - len : tamano - 1;
      const minC = dc < 0 ? len - 1 : 0;
      const maxC = dc > 0 ? tamano - len : tamano - 1;

      if (maxR < minR || maxC < minC) continue;

      const r = minR + Math.floor(Math.random() * (maxR - minR + 1));
      const c = minC + Math.floor(Math.random() * (maxC - minC + 1));

      // Verificar si cabe y permite cruces con letras iguales
      let valida = true;
      const celdas = [];
      for (let k = 0; k < len; k++) {
        const cr = r + k * dr;
        const cc = c + k * dc;
        const celdaActual = grilla[cr][cc];
        if (celdaActual !== '' && celdaActual !== palabra[k]) {
          valida = false;
          break;
        }
        celdas.push({ r: cr, c: cc });
      }

      if (valida) {
        // Colocar palabra en la grilla
        for (let k = 0; k < len; k++) {
          grilla[r + k * dr][c + k * dc] = palabra[k];
        }
        ubicaciones.push({
          palabra,
          filaInicio: r,
          colInicio: c,
          filaFin: r + (len - 1) * dr,
          colFin: c + (len - 1) * dc,
          dr,
          dc,
          celdas
        });
        colocada = true;
        break;
      }
    }
    // Si no cabe en 200 intentos se descarta automáticamente
  }

  // Rellenar celdas vacías con letras aleatorias A-Z y Ñ
  for (let r = 0; r < tamano; r++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[r][c] === '') {
        grilla[r][c] = ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
    }
  }

  return { grilla, ubicaciones };
}

// ==========================================================================
// Estado del módulo en el navegador
// ==========================================================================
let temaActual = null;
let glosarioTema = [];
let dificultadActual = 'facil'; // facil | media | dificil

let sopaActual = null; // { grilla, ubicaciones }
let palabrasEncontradas = new Set();
let seleccionInicio = null;
let celdasSeleccionadas = [];
let isPointerDown = false;

let tiempoInicio = 0;
let intervaloTiempo = null;
let juegoFinalizado = false;

async function iniciar() {
  await montarPlantilla({
    titulo: 'Sopa de letras',
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
    const lista = await api.listar('glosario', { temaId: temaActual.id });
    glosarioTema = (Array.isArray(lista) ? lista : []).filter(item => {
      return item && item.termino && typeof item.termino === 'string';
    });
  } catch (err) {
    console.error('Error al cargar glosario:', err);
    glosarioTema = [];
  } finally {
    ui.cargando(false);
  }

  if (glosarioTema.length < 3) {
    mostrarPantallaTerminosInsuficientes(contenedor);
    return;
  }

  renderizarEstructura(contenedor);
  iniciarPartida();
}

function mostrarPantallaSinTema(contenedor) {
  contenedor.innerHTML = `
    <div class="vacio" role="alert">
      <div class="vacio__icono" aria-hidden="true">🔍</div>
      <h3 class="vacio__titulo">No se seleccionó un tema</h3>
      <p class="vacio__descripcion">Debes elegir un tema curricular para generar la sopa de letras con sus conceptos.</p>
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
          const lista = await api.listar('glosario', { temaId: temaActual.id });
          glosarioTema = (Array.isArray(lista) ? lista : []).filter(i => i && i.termino);
          if (glosarioTema.length < 3) {
            mostrarPantallaTerminosInsuficientes(contenedor);
          } else {
            renderizarEstructura(contenedor);
            iniciarPartida();
          }
        } finally {
          ui.cargando(false);
        }
      }
    });
  }
}

function mostrarPantallaTerminosInsuficientes(contenedor) {
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;
  contenedor.innerHTML = `
    <section class="sopa-cabecera">
      <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span aria-hidden="true">/</span>
        <a href="${ui.escapar(enlaceTema)}">${ui.escapar(temaActual.titulo)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Sopa de letras</span>
      </nav>
    </section>

    <div class="vacio" role="alert">
      <div class="vacio__icono" aria-hidden="true">📖</div>
      <h3 class="vacio__titulo">Términos insuficientes</h3>
      <p class="vacio__descripcion">
        Este tema cuenta con ${glosarioTema.length} término(s) disponible(s). Se requieren al menos 3 términos para generar una sopa de letras.
      </p>
      <div class="fila fila--centrada" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <a href="${ui.escapar(enlaceTema)}" class="btn btn--primario">Volver al tema: ${ui.escapar(temaActual.titulo)}</a>
        <a href="/paginas/actividades.html" class="btn btn--secundario">Otras actividades</a>
      </div>
    </div>
  `;
}

function renderizarEstructura(contenedor) {
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  contenedor.innerHTML = `
    <div class="sopa-contenedor">
      <section class="sopa-cabecera">
        <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span aria-hidden="true">/</span>
          <a href="${ui.escapar(enlaceTema)}">${ui.escapar(temaActual.titulo)}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Sopa de letras</span>
        </nav>

        <div class="fila fila--entre fila--centrada">
          <div>
            <h2>Sopa de Letras</h2>
            <p class="texto-atenuado">
              Tema: <strong>${ui.escapar(temaActual.titulo)}</strong> · Desliza o arrastra para encontrar las palabras en línea recta.
            </p>
          </div>
          <a href="${ui.escapar(enlaceTema)}" class="btn btn--secundario btn--pequeno">← Volver al tema</a>
        </div>
      </section>

      <!-- Barra de controles y estadísticas -->
      <section class="sopa-barra-controles" aria-label="Opciones y progreso de la partida">
        <div class="fila fila--centrada" style="gap: var(--espacio-s);">
          <label for="select-dificultad" class="texto-pequeno"><strong>Dificultad:</strong></label>
          <select id="select-dificultad" class="input-select" style="min-width: 150px;">
            <option value="facil" ${dificultadActual === 'facil' ? 'selected' : ''}>Fácil (10×10, 8 pal.)</option>
            <option value="media" ${dificultadActual === 'media' ? 'selected' : ''}>Media (12×12, 10 pal.)</option>
            <option value="dificil" ${dificultadActual === 'dificil' ? 'selected' : ''}>Difícil (15×15, 12 pal.)</option>
          </select>
          <button type="button" id="btn-nueva-sopa" class="btn btn--secundario btn--pequeno">
            🔄 Nueva sopa
          </button>
        </div>

        <div class="sopa-estadisticas" role="status" aria-live="polite">
          <div class="sopa-estadistica">
            <span>Encontradas:</span>
            <strong id="stat-encontradas">0 / 0</strong>
          </div>
          <div class="sopa-estadistica">
            <span>Tiempo:</span>
            <strong id="stat-tiempo">00:00</strong>
          </div>
          <button type="button" id="btn-rendirse" class="btn btn--peligro btn--pequeno">
            Rendirse
          </button>
        </div>
      </section>

      <!-- Retroalimentación inmediata -->
      <div id="sopa-retro" class="sopa-retro-contenedor" aria-live="polite"></div>

      <!-- Disposición principal -->
      <div class="sopa-layout">
        <div class="sopa-tablero-wrapper">
          <div id="tablero-sopa" class="sopa-grilla" aria-label="Cuadrícula de sopa de letras"></div>
        </div>

        <aside class="sopa-panel-palabras" aria-label="Palabras por encontrar">
          <h3>Palabras a buscar:</h3>
          <ul id="lista-palabras" class="sopa-lista-palabras"></ul>
        </aside>
      </div>
    </div>
  `;

  const selDificultad = document.getElementById('select-dificultad');
  if (selDificultad) {
    selDificultad.addEventListener('change', () => {
      dificultadActual = selDificultad.value;
      iniciarPartida();
    });
  }

  const btnNueva = document.getElementById('btn-nueva-sopa');
  if (btnNueva) {
    btnNueva.addEventListener('click', () => {
      iniciarPartida();
    });
  }

  const btnRendirse = document.getElementById('btn-rendirse');
  if (btnRendirse) {
    btnRendirse.addEventListener('click', () => {
      rendirse();
    });
  }
}

function iniciarPartida() {
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }

  // Parámetros según dificultad:
  // fácil: 8 palabras en 10×10 (horizontal y vertical)
  // media: 10 en 12×12 (más diagonales)
  // difícil: 12 en 15×15 (más invertidas)
  let tamano = 10;
  let maxPalabras = 8;
  let direcciones = [[0, 1], [1, 0]];

  if (dificultadActual === 'media') {
    tamano = 12;
    maxPalabras = 10;
    direcciones = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  } else if (dificultadActual === 'dificil') {
    tamano = 15;
    maxPalabras = 12;
    direcciones = [
      [0, 1], [1, 0], [1, 1], [-1, 1],
      [0, -1], [-1, 0], [1, -1], [-1, -1]
    ];
  }

  // Tomar palabras del glosario barajadas
  const terminosValidos = glosarioTema
    .map(g => util.normalizar(g.termino))
    .filter(t => t.length >= 3 && t.length <= tamano && !t.includes(' '));

  const seleccionPalabras = util.barajar(terminosValidos).slice(0, maxPalabras);

  sopaActual = generarSopa(seleccionPalabras, tamano, direcciones);
  palabrasEncontradas = new Set();
  juegoFinalizado = false;
  seleccionInicio = null;
  celdasSeleccionadas = [];
  isPointerDown = false;
  tiempoInicio = Date.now();

  const tablero = document.getElementById('tablero-sopa');
  if (tablero) {
    tablero.style.setProperty('--sopa-columnas', String(tamano));
  }

  const panelRetro = document.getElementById('sopa-retro');
  if (panelRetro) panelRetro.innerHTML = '';

  actualizarMarcadores();
  renderizarTablero();
  renderizarListaPalabras();
  iniciarCronometro();
}

function iniciarCronometro() {
  if (intervaloTiempo) clearInterval(intervaloTiempo);
  const elTiempo = document.getElementById('stat-tiempo');

  intervaloTiempo = setInterval(() => {
    if (juegoFinalizado) return;
    const transcurrido = Math.floor((Date.now() - tiempoInicio) / 1000);
    const mins = String(Math.floor(transcurrido / 60)).padStart(2, '0');
    const segs = String(transcurrido % 60).padStart(2, '0');
    if (elTiempo) {
      elTiempo.textContent = `${mins}:${segs}`;
    }
  }, 1000);
}

function actualizarMarcadores() {
  const elEncontradas = document.getElementById('stat-encontradas');
  const total = sopaActual?.ubicaciones?.length || 0;
  if (elEncontradas) {
    elEncontradas.textContent = `${palabrasEncontradas.size} / ${total}`;
  }
}

function renderizarTablero() {
  const tablero = document.getElementById('tablero-sopa');
  if (!tablero || !sopaActual) return;

  const { grilla } = sopaActual;
  const filas = grilla.length;
  const cols = grilla[0].length;

  let html = '';
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < cols; c++) {
      const letra = grilla[r][c];
      html += `
        <div class="sopa-celda"
             data-r="${r}"
             data-c="${c}"
             aria-label="Fila ${r + 1}, Columna ${c + 1}: ${letra}">
          ${letra}
        </div>
      `;
    }
  }

  tablero.innerHTML = html;

  // Conectar Pointer Events
  conectarPointerEvents(tablero);
}

function conectarPointerEvents(tablero) {
  tablero.onpointerdown = (e) => {
    if (juegoFinalizado) return;
    const celda = e.target.closest('.sopa-celda');
    if (!celda) return;

    isPointerDown = true;
    try {
      tablero.setPointerCapture(e.pointerId);
    } catch {}

    const r = parseInt(celda.dataset.r, 10);
    const c = parseInt(celda.dataset.c, 10);
    seleccionInicio = { r, c };
    actualizarSeleccion(r, c);
  };

  tablero.onpointermove = (e) => {
    if (!isPointerDown || !seleccionInicio || juegoFinalizado) return;

    const elemento = document.elementFromPoint(e.clientX, e.clientY);
    const celda = elemento ? elemento.closest('.sopa-celda') : null;
    if (!celda) return;

    const r = parseInt(celda.dataset.r, 10);
    const c = parseInt(celda.dataset.c, 10);
    actualizarSeleccion(r, c);
  };

  const finalizarSeleccion = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (e && e.pointerId) {
      try {
        tablero.releasePointerCapture(e.pointerId);
      } catch {}
    }

    evaluarSeleccion();
    limpiarResaltadoTemporal();
    seleccionInicio = null;
    celdasSeleccionadas = [];
  };

  tablero.onpointerup = finalizarSeleccion;
  tablero.onpointercancel = finalizarSeleccion;
}

function actualizarSeleccion(rFin, cFin) {
  const rIni = seleccionInicio.r;
  const cIni = seleccionInicio.c;

  const dr = rFin - rIni;
  const dc = cFin - cIni;

  const esHorizontal = dr === 0;
  const esVertical = dc === 0;
  const esDiagonal = Math.abs(dr) === Math.abs(dc);

  limpiarResaltadoTemporal();

  if (esHorizontal || esVertical || esDiagonal) {
    const pasos = Math.max(Math.abs(dr), Math.abs(dc));
    const stepR = dr === 0 ? 0 : Math.sign(dr);
    const stepC = dc === 0 ? 0 : Math.sign(dc);

    celdasSeleccionadas = [];
    for (let k = 0; k <= pasos; k++) {
      const r = rIni + k * stepR;
      const c = cIni + k * stepC;
      celdasSeleccionadas.push({ r, c });

      const el = document.querySelector(`.sopa-celda[data-r="${r}"][data-c="${c}"]`);
      if (el) el.classList.add('celda--resaltada');
    }
  } else {
    // Si no está en línea recta, solo marcar la celda inicial
    celdasSeleccionadas = [{ r: rIni, c: cIni }];
    const el = document.querySelector(`.sopa-celda[data-r="${rIni}"][data-c="${cIni}"]`);
    if (el) el.classList.add('celda--resaltada');
  }
}

function limpiarResaltadoTemporal() {
  const resaltadas = document.querySelectorAll('.sopa-celda.celda--resaltada');
  resaltadas.forEach(el => el.classList.remove('celda--resaltada'));
}

function evaluarSeleccion() {
  if (!sopaActual || celdasSeleccionadas.length < 2) return;

  const palabraSeleccionada = celdasSeleccionadas
    .map(p => sopaActual.grilla[p.r][p.c])
    .join('');
  const palabraInvertida = [...palabraSeleccionada].reverse().join('');

  // Buscar coincidencia en las ubicaciones aún no encontradas
  const coincidencia = sopaActual.ubicaciones.find(u => {
    if (palabrasEncontradas.has(u.palabra)) return false;
    return u.palabra === palabraSeleccionada || u.palabra === palabraInvertida;
  });

  if (coincidencia) {
    // Coincidencia acertada
    palabrasEncontradas.add(coincidencia.palabra);

    // Marcar celdas permanentemente
    for (const celda of coincidencia.celdas) {
      const el = document.querySelector(`.sopa-celda[data-r="${celda.r}"][data-c="${celda.c}"]`);
      if (el) el.classList.add('celda--encontrada');
    }

    // Tachar en la lista lateral
    const itemLista = document.getElementById(`palabra-${coincidencia.palabra}`);
    if (itemLista) {
      itemLista.classList.add('tachada');
    }

    // Buscar definición en el glosario
    const glosarioItem = glosarioTema.find(g => util.normalizar(g.termino) === coincidencia.palabra);
    const definicion = glosarioItem?.definicion || `Término clave: ${coincidencia.palabra}`;
    const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

    mostrarRetro({
      correcto: true,
      explicacion: `<strong>${coincidencia.palabra}:</strong> ${definicion}`,
      enlaceTema,
      contenedor: '#sopa-retro'
    });

    actualizarMarcadores();

    // Comprobar si se encontraron todas
    if (palabrasEncontradas.size === sopaActual.ubicaciones.length) {
      finalizarJuego(false);
    }
  }
}

function renderizarListaPalabras() {
  const lista = document.getElementById('lista-palabras');
  if (!lista || !sopaActual) return;

  lista.innerHTML = sopaActual.ubicaciones.map(u => `
    <li id="palabra-${ui.escapar(u.palabra)}" class="palabra-item ${palabrasEncontradas.has(u.palabra) ? 'tachada' : ''}">
      <span>${ui.escapar(u.palabra)}</span>
    </li>
  `).join('');
}

function rendirse() {
  if (juegoFinalizado || !sopaActual) return;

  // Revelar todas las palabras restantes
  for (const u of sopaActual.ubicaciones) {
    if (!palabrasEncontradas.has(u.palabra)) {
      for (const celda of u.celdas) {
        const el = document.querySelector(`.sopa-celda[data-r="${celda.r}"][data-c="${celda.c}"]`);
        if (el && !el.classList.contains('celda--encontrada')) {
          el.classList.add('celda--revelada');
        }
      }
      const item = document.getElementById(`palabra-${u.palabra}`);
      if (item) item.classList.add('revelada');
    }
  }

  finalizarJuego(true);
}

async function finalizarJuego(seRindio = false) {
  juegoFinalizado = true;
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }

  const total = sopaActual?.ubicaciones?.length || 0;
  const encontradas = palabrasEncontradas.size;
  const errores = Math.max(0, total - encontradas);
  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  // Registrar intento en el servidor:
  // puntaje: encontradas, maximo: total, errores: total − encontradas, duracionSeg
  try {
    await registrarIntento({
      actividad: 'sopa-letras',
      temaId: temaActual.id,
      puntaje: encontradas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de sopa-letras:', err);
  }

  // Mostrar modal de resumen
  const accion = await mostrarResumen({
    titulo: seRindio ? 'Juego finalizado' : '¡Felicitaciones! Has completado la sopa de letras',
    aciertos: encontradas,
    errores,
    recomendaciones: encontradas === total
      ? '¡Excelente dominio de los conceptos quirúrgicos y gran agilidad visual!'
      : 'Repasa el glosario de términos para memorizar y reconocer con facilidad todos los conceptos.',
    enlaceTema
  });

  if (accion === 'repetir') {
    iniciarPartida();
  }
}

if (typeof document !== 'undefined') {
  await iniciar();
}
