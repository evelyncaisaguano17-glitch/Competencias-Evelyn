// publico/js/modulos/crucigrama.js · Crucigrama interactivo educativo
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

/**
 * Valida si una palabra puede colocarse en el tablero sin solapamientos indebidos
 * ni tocar otras palabras en paralelo o en los extremos.
 */
function esColocacionValida(tablero, tipos, palabra, fila, col, direccion) {
  const len = palabra.length;
  let cruces = 0;

  // Extremos: la celda inmediatamente anterior y posterior deben estar vacías
  if (direccion === 'horizontal') {
    if (col - 1 >= 0 && tablero[fila][col - 1] !== '') return false;
    if (col + len < tablero[0].length && tablero[fila][col + len] !== '') return false;
  } else {
    if (fila - 1 >= 0 && tablero[fila - 1][col] !== '') return false;
    if (fila + len < tablero.length && tablero[fila + len][col] !== '') return false;
  }

  for (let i = 0; i < len; i++) {
    const r = direccion === 'horizontal' ? fila : fila + i;
    const c = direccion === 'horizontal' ? col + i : col;
    const celdaActual = tablero[r][c];

    if (celdaActual !== '') {
      // Coincidencia exacta de letra
      if (celdaActual !== palabra[i]) return false;
      // No solapar con una palabra en la misma dirección
      const tipoExistente = tipos[r][c];
      const dirCod = direccion === 'horizontal' ? 'H' : 'V';
      if (tipoExistente.includes(dirCod)) return false;
      cruces++;
    } else {
      // En celdas nuevas vacías, verificar que no toquen letras en paralelo
      if (direccion === 'horizontal') {
        if (r - 1 >= 0 && tablero[r - 1][c] !== '') return false;
        if (r + 1 < tablero.length && tablero[r + 1][c] !== '') return false;
      } else {
        if (c - 1 >= 0 && tablero[r][c - 1] !== '') return false;
        if (c + 1 < tablero[0].length && tablero[r][c + 1] !== '') return false;
      }
    }
  }

  return cruces >= 1;
}

/**
 * Función pura exportada que genera la disposición del crucigrama.
 * @param {Array<string|Object>} palabras - Candidatos a colocar
 * @returns {{ filas: number, columnas: number, entradas: Array<Object> }}
 */
export function generarCrucigrama(palabras) {
  // 1. Filtrar y normalizar candidatos de 3 a 12 letras, una sola palabra
  const candidatos = [];
  const vistos = new Set();

  const lista = Array.isArray(palabras) ? palabras : [];
  for (const item of lista) {
    let palabra = '';
    let pista = '';
    let definicion = '';

    if (typeof item === 'string') {
      palabra = util.normalizar(item).trim();
      pista = item;
      definicion = item;
    } else if (item && typeof item === 'object') {
      palabra = util.normalizar(item.palabra || item.termino || '').trim();
      pista = item.pista || item.definicion || palabra;
      definicion = item.definicion || item.pista || '';
    }

    if (palabra.length >= 3 && palabra.length <= 12 && !palabra.includes(' ') && !vistos.has(palabra)) {
      vistos.add(palabra);
      candidatos.push({ palabra, pista, definicion });
    }
  }

  if (candidatos.length === 0) {
    return { filas: 0, columnas: 0, entradas: [] };
  }

  if (candidatos.length === 1) {
    const p = candidatos[0];
    return {
      filas: 1,
      columnas: p.palabra.length,
      entradas: [{
        numero: 1,
        palabra: p.palabra,
        pista: p.pista,
        definicion: p.definicion,
        fila: 0,
        col: 0,
        direccion: 'horizontal'
      }]
    };
  }

  // Objetivo de 8 a 12 palabras
  const MAX_OBJETIVO = Math.min(12, candidatos.length);
  const candidatosPorLargo = [...candidatos].sort((a, b) => b.palabra.length - a.palabra.length);

  let mejorResultado = null;
  const TAMANO_TABLERO = 80;
  const CENTRO = Math.floor(TAMANO_TABLERO / 2);

  // 30 órdenes aleatorios para optimizar número de palabras y menor área
  const NUM_INTENTOS = 30;

  for (let intento = 0; intento < NUM_INTENTOS; intento++) {
    const tablero = Array.from({ length: TAMANO_TABLERO }, () => Array(TAMANO_TABLERO).fill(''));
    const tipos = Array.from({ length: TAMANO_TABLERO }, () => Array(TAMANO_TABLERO).fill(''));

    // Colocar la palabra más larga en el centro
    const copia = [...candidatosPorLargo];
    const idx0 = intento === 0 ? 0 : Math.floor(Math.random() * Math.min(3, copia.length));
    const primera = copia.splice(idx0, 1)[0];
    const cola = [primera, ...util.barajar(copia)];

    const colocadas = [];

    const fila0 = CENTRO;
    const col0 = CENTRO - Math.floor(primera.palabra.length / 2);

    for (let i = 0; i < primera.palabra.length; i++) {
      tablero[fila0][col0 + i] = primera.palabra[i];
      tipos[fila0][col0 + i] = 'H';
    }

    colocadas.push({
      ...primera,
      fila: fila0,
      col: col0,
      direccion: 'horizontal'
    });

    // Colocar las siguientes palabras buscando cruces válidos
    for (let pIdx = 1; pIdx < cola.length; pIdx++) {
      if (colocadas.length >= MAX_OBJETIVO) break;

      const cand = cola[pIdx];
      const palabra = cand.palabra;
      const len = palabra.length;
      const posibles = [];

      for (const ya of colocadas) {
        const dirNueva = ya.direccion === 'horizontal' ? 'vertical' : 'horizontal';

        for (let i = 0; i < len; i++) {
          const letra = palabra[i];

          for (let j = 0; j < ya.palabra.length; j++) {
            if (ya.palabra[j] === letra) {
              const fIni = dirNueva === 'vertical' ? ya.fila - i : ya.fila + j;
              const cIni = dirNueva === 'vertical' ? ya.col + j : ya.col - i;

              if (fIni < 1 || cIni < 1) continue;
              if (dirNueva === 'horizontal' && cIni + len >= TAMANO_TABLERO - 1) continue;
              if (dirNueva === 'vertical' && fIni + len >= TAMANO_TABLERO - 1) continue;

              if (esColocacionValida(tablero, tipos, palabra, fIni, cIni, dirNueva)) {
                let cruces = 0;
                for (let k = 0; k < len; k++) {
                  const r = dirNueva === 'horizontal' ? fIni : fIni + k;
                  const c = dirNueva === 'horizontal' ? cIni + k : cIni;
                  if (tablero[r][c] !== '') cruces++;
                }

                posibles.push({
                  fila: fIni,
                  col: cIni,
                  direccion: dirNueva,
                  cruces
                });
              }
            }
          }
        }
      }

      if (posibles.length > 0) {
        // Priorizar mayor número de cruces y cercanía al centro
        posibles.sort((a, b) => {
          if (b.cruces !== a.cruces) return b.cruces - a.cruces;
          const distA = Math.hypot(a.fila - CENTRO, a.col - CENTRO);
          const distB = Math.hypot(b.fila - CENTRO, b.col - CENTRO);
          return distA - distB;
        });

        const elegida = posibles[0];
        for (let k = 0; k < len; k++) {
          const r = elegida.direccion === 'horizontal' ? elegida.fila : elegida.fila + k;
          const c = elegida.direccion === 'horizontal' ? elegida.col + k : elegida.col;
          tablero[r][c] = palabra[k];
          tipos[r][c] = tipos[r][c] ? 'HV' : (elegida.direccion === 'horizontal' ? 'H' : 'V');
        }

        colocadas.push({
          ...cand,
          fila: elegida.fila,
          col: elegida.col,
          direccion: elegida.direccion
        });
      }
    }

    if (colocadas.length > 0) {
      let minR = TAMANO_TABLERO, maxR = 0, minC = TAMANO_TABLERO, maxC = 0;
      for (const c of colocadas) {
        minR = Math.min(minR, c.fila);
        minC = Math.min(minC, c.col);
        if (c.direccion === 'horizontal') {
          maxR = Math.max(maxR, c.fila);
          maxC = Math.max(maxC, c.col + c.palabra.length - 1);
        } else {
          maxR = Math.max(maxR, c.fila + c.palabra.length - 1);
          maxC = Math.max(maxC, c.col);
        }
      }

      const filas = maxR - minR + 1;
      const columnas = maxC - minC + 1;
      const area = filas * columnas;

      const res = {
        colocadas,
        minR,
        minC,
        maxR,
        maxC,
        filas,
        columnas,
        area,
        num: colocadas.length
      };

      if (!mejorResultado || res.num > mejorResultado.num || (res.num === mejorResultado.num && res.area < mejorResultado.area)) {
        mejorResultado = res;
      }
    }
  }

  // Recortar cuadrícula
  const { minR, minC, filas, columnas, colocadas } = mejorResultado;
  const recortadas = colocadas.map(c => ({
    ...c,
    fila: c.fila - minR,
    col: c.col - minC
  }));

  // Numeración estándar de crucigramas
  const iniciosMap = new Map();
  for (const e of recortadas) {
    const clave = `${e.fila},${e.col}`;
    if (!iniciosMap.has(clave)) {
      iniciosMap.set(clave, []);
    }
    iniciosMap.get(clave).push(e);
  }

  const celdasOrdenadas = Array.from(iniciosMap.keys()).sort((a, b) => {
    const [fa, ca] = a.split(',').map(Number);
    const [fb, cb] = b.split(',').map(Number);
    if (fa !== fb) return fa - fb;
    return ca - cb;
  });

  let numActual = 1;
  for (const clave of celdasOrdenadas) {
    const listaInicios = iniciosMap.get(clave);
    for (const e of listaInicios) {
      e.numero = numActual;
    }
    numActual++;
  }

  recortadas.sort((a, b) => {
    if (a.numero !== b.numero) return a.numero - b.numero;
    return a.direccion === 'horizontal' ? -1 : 1;
  });

  return {
    filas,
    columnas,
    entradas: recortadas.map(e => ({
      numero: e.numero,
      palabra: e.palabra,
      pista: e.pista,
      definicion: e.definicion,
      fila: e.fila,
      col: e.col,
      direccion: e.direccion
    }))
  };
}

// --------------------------------------------------------------------
// ESTADO Y LÓGICA DE INTERFAZ DEL CRUCIGRAMA
// --------------------------------------------------------------------
let temaActual = null;
let crucigramaActual = null;
let palabraSeleccionada = null;
let celdaFoco = null; // { fila, col }
let palabrasResueltas = new Set(); // clave: `${numero}-${direccion}`
let letrasReveladasRestantes = 3;
let letrasReveladasTotal = 0;
let tiempoInicio = 0;
let temporizadorId = null;
let partidaFinalizada = false;

// Retorna las entradas que contienen la celda (fila, col)
function entradasEnCelda(fila, col) {
  if (!crucigramaActual) return [];
  return crucigramaActual.entradas.filter(e => {
    if (e.direccion === 'horizontal') {
      return e.fila === fila && col >= e.col && col < e.col + e.palabra.length;
    }
    return e.col === col && fila >= e.fila && fila < e.fila + e.palabra.length;
  });
}

// Retorna la letra esperada en (fila, col)
function letraEsperadaEnCelda(fila, col) {
  const entradas = entradasEnCelda(fila, col);
  if (entradas.length === 0) return '';
  const e = entradas[0];
  const idx = e.direccion === 'horizontal' ? col - e.col : fila - e.fila;
  return e.palabra[idx] || '';
}

function iniciarTemporizador() {
  if (temporizadorId) clearInterval(temporizadorId);
  tiempoInicio = Date.now();
  const el = document.getElementById('crucigrama-tiempo');

  temporizadorId = setInterval(() => {
    if (partidaFinalizada) return;
    const segs = Math.floor((Date.now() - tiempoInicio) / 1000);
    const m = String(Math.floor(segs / 60)).padStart(2, '0');
    const s = String(segs % 60).padStart(2, '0');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

function actualizarContadores() {
  const elPuntaje = document.getElementById('crucigrama-puntaje-contador');
  const elReveladas = document.getElementById('crucigrama-reveladas-contador');
  const btnRevelar = document.getElementById('btn-revelar-letra');

  if (elPuntaje && crucigramaActual) {
    elPuntaje.textContent = `${palabrasResueltas.size} / ${crucigramaActual.entradas.length}`;
  }

  if (elReveladas) {
    elReveladas.textContent = `${letrasReveladasRestantes} / 3`;
  }

  if (btnRevelar) {
    btnRevelar.innerHTML = `💡 Revelar letra (${letrasReveladasRestantes} rest.)`;
    btnRevelar.disabled = letrasReveladasRestantes <= 0 || partidaFinalizada;
  }
}

function seleccionarPalabra(entrada, filaPreferida = null, colPreferida = null) {
  if (!entrada) return;
  palabraSeleccionada = entrada;

  // Determinar celda con foco
  if (filaPreferida !== null && colPreferida !== null) {
    celdaFoco = { fila: filaPreferida, col: colPreferida };
  } else {
    // Primera celda vacía o la inicial
    let primeraVacia = null;
    for (let i = 0; i < entrada.palabra.length; i++) {
      const r = entrada.direccion === 'horizontal' ? entrada.fila : entrada.fila + i;
      const c = entrada.direccion === 'horizontal' ? entrada.col + i : entrada.col;
      const input = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c}"]`);
      if (input && input.value.trim() === '') {
        primeraVacia = { fila: r, col: c };
        break;
      }
    }
    celdaFoco = primeraVacia || { fila: entrada.fila, col: entrada.col };
  }

  resaltarPalabraYFoco();

  // Foco en el input
  if (celdaFoco) {
    const input = document.querySelector(`.celda-input[data-fila="${celdaFoco.fila}"][data-col="${celdaFoco.col}"]`);
    if (input) input.focus();
  }
}

function resaltarPalabraYFoco() {
  // Limpiar clases previas
  document.querySelectorAll('.crucigrama-celda--palabra-activa').forEach(c => c.classList.remove('crucigrama-celda--palabra-activa'));
  document.querySelectorAll('.crucigrama-celda--foco').forEach(c => c.classList.remove('crucigrama-celda--foco'));
  document.querySelectorAll('.pista-item--activa').forEach(p => p.classList.remove('pista-item--activa'));

  if (!palabraSeleccionada) return;

  // Resaltar celdas de la palabra seleccionada
  for (let i = 0; i < palabraSeleccionada.palabra.length; i++) {
    const r = palabraSeleccionada.direccion === 'horizontal' ? palabraSeleccionada.fila : palabraSeleccionada.fila + i;
    const c = palabraSeleccionada.direccion === 'horizontal' ? palabraSeleccionada.col + i : palabraSeleccionada.col;
    const celdaEl = document.querySelector(`.crucigrama-celda[data-fila="${r}"][data-col="${c}"]`);
    if (celdaEl) celdaEl.classList.add('crucigrama-celda--palabra-activa');
  }

  // Resaltar celda foco
  if (celdaFoco) {
    const focoEl = document.querySelector(`.crucigrama-celda[data-fila="${celdaFoco.fila}"][data-col="${celdaFoco.col}"]`);
    if (focoEl) focoEl.classList.add('crucigrama-celda--foco');
  }

  // Resaltar pista activa en la lista correspondiente
  const pistaEl = document.querySelector(`.pista-item[data-numero="${palabraSeleccionada.numero}"][data-direccion="${palabraSeleccionada.direccion}"]`);
  if (pistaEl) {
    pistaEl.classList.add('pista-item--activa');
    pistaEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function cambiarDireccionEnCeldaActual() {
  if (!celdaFoco) return;
  const entradas = entradasEnCelda(celdaFoco.fila, celdaFoco.col);
  if (entradas.length <= 1) return;

  // Alternar entre horizontal y vertical
  const otra = entradas.find(e => e.direccion !== palabraSeleccionada?.direccion) || entradas[0];
  seleccionarPalabra(otra, celdaFoco.fila, celdaFoco.col);
}

function avanzarCelda() {
  if (!palabraSeleccionada || !celdaFoco) return;
  const len = palabraSeleccionada.palabra.length;
  const idx = palabraSeleccionada.direccion === 'horizontal'
    ? celdaFoco.col - palabraSeleccionada.col
    : celdaFoco.fila - palabraSeleccionada.fila;

  if (idx < len - 1) {
    const sigFila = palabraSeleccionada.direccion === 'horizontal' ? celdaFoco.fila : celdaFoco.fila + 1;
    const sigCol = palabraSeleccionada.direccion === 'horizontal' ? celdaFoco.col + 1 : celdaFoco.col;
    celdaFoco = { fila: sigFila, col: sigCol };
    resaltarPalabraYFoco();
    const sigInput = document.querySelector(`.celda-input[data-fila="${sigFila}"][data-col="${sigCol}"]`);
    if (sigInput) sigInput.focus();
  }
}

function retrocederCelda() {
  if (!palabraSeleccionada || !celdaFoco) return;
  const idx = palabraSeleccionada.direccion === 'horizontal'
    ? celdaFoco.col - palabraSeleccionada.col
    : celdaFoco.fila - palabraSeleccionada.fila;

  if (idx > 0) {
    const prevFila = palabraSeleccionada.direccion === 'horizontal' ? celdaFoco.fila : celdaFoco.fila - 1;
    const prevCol = palabraSeleccionada.direccion === 'horizontal' ? celdaFoco.col - 1 : celdaFoco.col;
    celdaFoco = { fila: prevFila, col: prevCol };
    resaltarPalabraYFoco();
    const prevInput = document.querySelector(`.celda-input[data-fila="${prevFila}"][data-col="${prevCol}"]`);
    if (prevInput) {
      prevInput.focus();
      prevInput.value = '';
    }
  }
}

// Comprueba la palabra actualmente seleccionada
async function comprobarPalabraSeleccionada() {
  if (!palabraSeleccionada || partidaFinalizada) {
    ui.aviso('Selecciona una palabra para comprobar', 'info');
    return;
  }

  const { palabra, pista, definicion, numero, direccion } = palabraSeleccionada;
  let palabraEscrita = '';
  const inputsPalabra = [];

  for (let i = 0; i < palabra.length; i++) {
    const r = direccion === 'horizontal' ? palabraSeleccionada.fila : palabraSeleccionada.fila + i;
    const c = direccion === 'horizontal' ? palabraSeleccionada.col + i : palabraSeleccionada.col;
    const input = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c}"]`);
    const val = input ? input.value.trim().toUpperCase() : '';
    palabraEscrita += val;
    if (input) inputsPalabra.push(input);
  }

  const claveRes = `${numero}-${direccion}`;
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  if (palabraEscrita === palabra) {
    // Palabra correcta
    palabrasResueltas.add(claveRes);

    for (const inp of inputsPalabra) {
      const celda = inp.closest('.crucigrama-celda');
      if (celda) celda.classList.add('crucigrama-celda--correcta');
    }

    const pistaEl = document.querySelector(`.pista-item[data-numero="${numero}"][data-direccion="${direccion}"]`);
    if (pistaEl) {
      pistaEl.classList.add('pista-item--resuelta');
      const checkEl = pistaEl.querySelector('.pista-check');
      if (checkEl) checkEl.textContent = ' ✓';
    }

    actualizarContadores();

    await mostrarRetro({
      correcto: true,
      explicacion: definicion || `"${palabra}": ${pista}`,
      sugerencia: '¡Muy bien! Sigue completando el crucigrama.',
      enlaceTema
    });

    // Si completó todas las palabras
    if (palabrasResueltas.size === crucigramaActual.entradas.length) {
      await finalizarPartida();
    }
  } else {
    // Palabra incorrecta o incompleta
    for (const inp of inputsPalabra) {
      const celda = inp.closest('.crucigrama-celda');
      if (celda) {
        celda.classList.add('crucigrama-celda--error');
        setTimeout(() => celda.classList.remove('crucigrama-celda--error'), 600);
      }
    }

    await mostrarRetro({
      correcto: false,
      explicacion: `Aún no es correcta. Pista: ${pista}`,
      sugerencia: 'Revisa las letras que se cruzan con otras palabras.',
      enlaceTema
    });
  }
}

// Revela una letra (máximo 3 por partida)
function revelarLetra() {
  if (partidaFinalizada || letrasReveladasRestantes <= 0) {
    ui.aviso('Ya has utilizado el límite de 3 letras reveladas', 'advertencia');
    return;
  }

  // Buscar celda a revelar
  let celdaObjetivo = null;

  // 1. Si hay una celda foco vacía o incorrecta en la palabra seleccionada
  if (celdaFoco && palabraSeleccionada) {
    const inputFoco = document.querySelector(`.celda-input[data-fila="${celdaFoco.fila}"][data-col="${celdaFoco.col}"]`);
    const esperada = letraEsperadaEnCelda(celdaFoco.fila, celdaFoco.col);
    if (inputFoco && inputFoco.value.trim().toUpperCase() !== esperada) {
      celdaObjetivo = { fila: celdaFoco.fila, col: celdaFoco.col, input: inputFoco, esperada };
    }
  }

  // 2. Si no, buscar la primera vacía o incorrecta en la palabra seleccionada
  if (!celdaObjetivo && palabraSeleccionada) {
    for (let i = 0; i < palabraSeleccionada.palabra.length; i++) {
      const r = palabraSeleccionada.direccion === 'horizontal' ? palabraSeleccionada.fila : palabraSeleccionada.fila + i;
      const c = palabraSeleccionada.direccion === 'horizontal' ? palabraSeleccionada.col + i : palabraSeleccionada.col;
      const input = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c}"]`);
      const esperada = letraEsperadaEnCelda(r, c);
      if (input && input.value.trim().toUpperCase() !== esperada) {
        celdaObjetivo = { fila: r, col: c, input, esperada };
        break;
      }
    }
  }

  // 3. Si aún no, buscar en todo el crucigrama
  if (!celdaObjetivo && crucigramaActual) {
    for (const ent of crucigramaActual.entradas) {
      for (let i = 0; i < ent.palabra.length; i++) {
        const r = ent.direccion === 'horizontal' ? ent.fila : ent.fila + i;
        const c = ent.direccion === 'horizontal' ? ent.col + i : ent.col;
        const input = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c}"]`);
        const esperada = letraEsperadaEnCelda(r, c);
        if (input && input.value.trim().toUpperCase() !== esperada) {
          celdaObjetivo = { fila: r, col: c, input, esperada };
          break;
        }
      }
      if (celdaObjetivo) break;
    }
  }

  if (!celdaObjetivo) {
    ui.aviso('Todas las letras del crucigrama ya están correctamente completadas', 'info');
    return;
  }

  celdaObjetivo.input.value = celdaObjetivo.esperada;
  const contenedorCelda = celdaObjetivo.input.closest('.crucigrama-celda');
  if (contenedorCelda) {
    contenedorCelda.classList.add('crucigrama-celda--revelada');
  }

  letrasReveladasRestantes--;
  letrasReveladasTotal++;
  actualizarContadores();
  ui.aviso(`Letra revelada: ${celdaObjetivo.esperada}`, 'info');

  // Si estaba enfocada, avanzar
  avanzarCelda();
}

async function finalizarPartida() {
  if (partidaFinalizada) return;

  const total = crucigramaActual?.entradas?.length || 0;
  const pendientes = total - palabrasResueltas.size;

  if (pendientes > 0) {
    const confirmar = await ui.confirmar(`Tienes ${pendientes} palabra(s) pendiente(s). ¿Deseas terminar la partida ahora?`);
    if (!confirmar) return;
  }

  partidaFinalizada = true;
  if (temporizadorId) {
    clearInterval(temporizadorId);
    temporizadorId = null;
  }

  // Evaluar palabras correctas
  let correctas = 0;
  if (crucigramaActual) {
    for (const e of crucigramaActual.entradas) {
      let escrita = '';
      for (let i = 0; i < e.palabra.length; i++) {
        const r = e.direccion === 'horizontal' ? e.fila : e.fila + i;
        const c = e.direccion === 'horizontal' ? e.col + i : e.col;
        const input = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c}"]`);
        escrita += input ? input.value.trim().toUpperCase() : '';
      }
      if (escrita === e.palabra) {
        correctas++;
      }
    }
  }

  const puntaje = correctas;
  const maximo = total;
  const incorrectas = Math.max(0, maximo - puntaje);
  const errores = incorrectas + letrasReveladasTotal;
  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  // Registrar intento en gamificación
  try {
    await registrarIntento({
      actividad: 'crucigrama',
      temaId: temaActual.id,
      puntaje,
      maximo,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de crucigrama:', err);
  }

  const accion = await mostrarResumen({
    titulo: puntaje === maximo ? '¡Excelente trabajo en el Crucigrama!' : 'Crucigrama finalizado',
    aciertos: puntaje,
    errores,
    recomendaciones: puntaje === maximo
      ? '¡Dominio impecable del vocabulario quirúrgico y las pistas temáticas!'
      : 'Repasa el glosario de términos para afianzar los conceptos que te faltaron.',
    enlaceTema
  });

  if (accion === 'repetir') {
    await iniciarPartida();
  }
}

// --------------------------------------------------------------------
// RENDERIZADO DEL JUEGO
// --------------------------------------------------------------------
function renderizarCrucigrama() {
  const contenedor = document.getElementById('contenido');
  if (!contenedor || !crucigramaActual) return;

  const horizontales = crucigramaActual.entradas.filter(e => e.direccion === 'horizontal');
  const verticales = crucigramaActual.entradas.filter(e => e.direccion === 'vertical');

  // Mapa de inicios de número por celda (fila, col)
  const iniciosNumeros = new Map();
  for (const e of crucigramaActual.entradas) {
    const k = `${e.fila},${e.col}`;
    if (!iniciosNumeros.has(k)) {
      iniciosNumeros.set(k, e.numero);
    }
  }

  // Mapa de celdas activas
  const celdasActivas = new Map();
  for (const e of crucigramaActual.entradas) {
    for (let i = 0; i < e.palabra.length; i++) {
      const r = e.direccion === 'horizontal' ? e.fila : e.fila + i;
      const c = e.direccion === 'horizontal' ? e.col + i : e.col;
      const k = `${r},${c}`;
      if (!celdasActivas.has(k)) {
        celdasActivas.set(k, true);
      }
    }
  }

  // Generar HTML de la grilla
  let celdasHtml = '';
  for (let r = 0; r < crucigramaActual.filas; r++) {
    for (let c = 0; c < crucigramaActual.columnas; c++) {
      const k = `${r},${c}`;
      const esActiva = celdasActivas.has(k);

      if (esActiva) {
        const num = iniciosNumeros.get(k);
        celdasHtml += `
          <div class="crucigrama-celda" data-fila="${r}" data-col="${c}">
            ${num ? `<span class="celda-numero">${num}</span>` : ''}
            <input
              type="text"
              class="celda-input"
              data-fila="${r}"
              data-col="${c}"
              maxlength="1"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="characters"
              spellcheck="false"
              aria-label="Fila ${r + 1}, columna ${c + 1}"
            >
          </div>
        `;
      } else {
        celdasHtml += `<div class="crucigrama-celda crucigrama-celda--bloque" aria-hidden="true"></div>`;
      }
    }
  }

  contenedor.innerHTML = `
    <div class="crucigrama-pagina">
      <!-- Encabezado y estadísticas -->
      <header class="crucigrama-encabezado">
        <div class="crucigrama-titulo-grupo">
          <h1>Crucigrama</h1>
          <span class="crucigrama-tema-nombre">Tema: <strong>${ui.escapar(temaActual.titulo)}</strong></span>
        </div>
        <div class="crucigrama-estadisticas">
          <div class="crucigrama-stat" title="Tiempo transcurrido">
            ⏱️ <span id="crucigrama-tiempo">00:00</span>
          </div>
          <div class="crucigrama-stat" title="Palabras resueltas">
            Palabras: <strong id="crucigrama-puntaje-contador">0 / ${crucigramaActual.entradas.length}</strong>
          </div>
          <div class="crucigrama-stat" title="Letras reveladas disponibles">
            Ayudas: <strong id="crucigrama-reveladas-contador">3 / 3</strong>
          </div>
        </div>
      </header>

      <!-- Barra de herramientas -->
      <div class="crucigrama-toolbar">
        <div class="crucigrama-toolbar__acciones">
          <button type="button" class="btn btn--primario" id="btn-comprobar-palabra">
            ✓ Comprobar palabra
          </button>
          <button type="button" class="btn btn--secundario" id="btn-revelar-letra">
            💡 Revelar letra (3 rest.)
          </button>
          <button type="button" class="btn btn--peligro" id="btn-terminar-crucigrama">
            Terminar
          </button>
        </div>
        <div class="crucigrama-toolbar__ayuda">
          <span>Doble clic o barra espaciadora para cambiar de dirección (H/V)</span>
        </div>
      </div>

      <!-- Tablero y Pistas -->
      <div class="crucigrama-cuerpo">
        <!-- Tablero -->
        <section class="crucigrama-tablero-area" aria-label="Cuadrícula del crucigrama">
          <div class="crucigrama-scroll">
            <div
              class="crucigrama-grilla"
              id="crucigrama-grilla"
              style="grid-template-columns: repeat(${crucigramaActual.columnas}, 1fr); grid-template-rows: repeat(${crucigramaActual.filas}, 1fr);"
            >
              ${celdasHtml}
            </div>
          </div>
        </section>

        <!-- Pistas -->
        <aside class="crucigrama-pistas-area" aria-label="Pistas del crucigrama">
          <!-- Horizontales -->
          <div class="crucigrama-seccion-pistas">
            <h2>Horizontales (${horizontales.length})</h2>
            <ul class="crucigrama-lista-pistas" id="lista-horizontales">
              ${horizontales.map(h => `
                <li
                  class="pista-item"
                  data-numero="${h.numero}"
                  data-direccion="horizontal"
                  tabindex="0"
                  role="button"
                  aria-label="Pista horizontal ${h.numero}"
                >
                  <strong>${h.numero}.</strong>
                  <span>${ui.escapar(h.pista)}</span>
                  <span class="pista-check"></span>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Verticales -->
          <div class="crucigrama-seccion-pistas">
            <h2>Verticales (${verticales.length})</h2>
            <ul class="crucigrama-lista-pistas" id="lista-verticales">
              ${verticales.map(v => `
                <li
                  class="pista-item"
                  data-numero="${v.numero}"
                  data-direccion="vertical"
                  tabindex="0"
                  role="button"
                  aria-label="Pista vertical ${v.numero}"
                >
                  <strong>${v.numero}.</strong>
                  <span>${ui.escapar(v.pista)}</span>
                  <span class="pista-check"></span>
                </li>
              `).join('')}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  `;

  conectarEventosCrucigrama();
}

function conectarEventosCrucigrama() {
  const grilla = document.getElementById('crucigrama-grilla');
  const btnComprobar = document.getElementById('btn-comprobar-palabra');
  const btnRevelar = document.getElementById('btn-revelar-letra');
  const btnTerminar = document.getElementById('btn-terminar-crucigrama');

  if (btnComprobar) btnComprobar.addEventListener('click', () => comprobarPalabraSeleccionada());
  if (btnRevelar) btnRevelar.addEventListener('click', () => revelarLetra());
  if (btnTerminar) btnTerminar.addEventListener('click', () => finalizarPartida());

  // Click en pistas
  document.querySelectorAll('.pista-item').forEach(item => {
    const num = parseInt(item.getAttribute('data-numero'), 10);
    const dir = item.getAttribute('data-direccion');
    const entrada = crucigramaActual.entradas.find(e => e.numero === num && e.direccion === dir);

    const activarPista = () => {
      if (entrada) seleccionarPalabra(entrada);
    };

    item.addEventListener('click', activarPista);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activarPista();
      }
    });
  });

  if (!grilla) return;

  // Click y doble click en celdas
  grilla.addEventListener('click', (e) => {
    const celda = e.target.closest('.crucigrama-celda');
    if (!celda || celda.classList.contains('crucigrama-celda--bloque')) return;

    const r = parseInt(celda.getAttribute('data-fila'), 10);
    const c = parseInt(celda.getAttribute('data-col'), 10);
    const candidatas = entradasEnCelda(r, c);

    if (candidatas.length === 0) return;

    if (candidatas.length === 1) {
      seleccionarPalabra(candidatas[0], r, c);
    } else {
      // Si la celda actual ya pertenece a la palabra seleccionada, alternar dirección
      if (palabraSeleccionada && candidatas.some(ent => ent.numero === palabraSeleccionada.numero && ent.direccion === palabraSeleccionada.direccion)) {
        const otra = candidatas.find(ent => ent.direccion !== palabraSeleccionada.direccion) || candidatas[0];
        seleccionarPalabra(otra, r, c);
      } else {
        seleccionarPalabra(candidatas[0], r, c);
      }
    }
  });

  grilla.addEventListener('dblclick', (e) => {
    const celda = e.target.closest('.crucigrama-celda');
    if (!celda || celda.classList.contains('crucigrama-celda--bloque')) return;
    cambiarDireccionEnCeldaActual();
  });

  // Manejo de teclado en inputs
  grilla.addEventListener('keydown', (e) => {
    const input = e.target;
    if (!input.classList.contains('celda-input')) return;

    const r = parseInt(input.getAttribute('data-fila'), 10);
    const c = parseInt(input.getAttribute('data-col'), 10);

    // Barra espaciadora: cambiar dirección
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      cambiarDireccionEnCeldaActual();
      return;
    }

    // Enter: comprobar palabra
    if (e.key === 'Enter') {
      e.preventDefault();
      comprobarPalabraSeleccionada();
      return;
    }

    // Retroceso
    if (e.key === 'Backspace') {
      if (input.value === '') {
        e.preventDefault();
        retrocederCelda();
      } else {
        input.value = '';
      }
      return;
    }

    // Flechas de navegación
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (palabraSeleccionada?.direccion !== 'horizontal') {
        const h = entradasEnCelda(r, c).find(ent => ent.direccion === 'horizontal');
        if (h) { seleccionarPalabra(h, r, c); return; }
      }
      const sig = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c + 1}"]`);
      if (sig) { celdaFoco = { fila: r, col: c + 1 }; sig.focus(); resaltarPalabraYFoco(); }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const ant = document.querySelector(`.celda-input[data-fila="${r}"][data-col="${c - 1}"]`);
      if (ant) { celdaFoco = { fila: r, col: c - 1 }; ant.focus(); resaltarPalabraYFoco(); }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (palabraSeleccionada?.direccion !== 'vertical') {
        const v = entradasEnCelda(r, c).find(ent => ent.direccion === 'vertical');
        if (v) { seleccionarPalabra(v, r, c); return; }
      }
      const sig = document.querySelector(`.celda-input[data-fila="${r + 1}"][data-col="${c}"]`);
      if (sig) { celdaFoco = { fila: r + 1, col: c }; sig.focus(); resaltarPalabraYFoco(); }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const ant = document.querySelector(`.celda-input[data-fila="${r - 1}"][data-col="${c}"]`);
      if (ant) { celdaFoco = { fila: r - 1, col: c }; ant.focus(); resaltarPalabraYFoco(); }
      return;
    }
  });

  // Entrada de texto (letras A-Z, Ñ)
  grilla.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList.contains('celda-input')) return;

    const val = util.normalizar(input.value).trim().toUpperCase();
    if (val.length > 0) {
      input.value = val.slice(-1);
      avanzarCelda();
    } else {
      input.value = '';
    }
  });
}

// --------------------------------------------------------------------
// INICIALIZACIÓN DE LA ACTIVIDAD
// --------------------------------------------------------------------
async function iniciarPartida() {
  partidaFinalizada = false;
  palabrasResueltas.clear();
  letrasReveladasRestantes = 3;
  letrasReveladasTotal = 0;
  palabraSeleccionada = null;
  celdaFoco = null;

  try {
    ui.cargando(true);

    // Obtener glosario del tema
    const terminos = await api.listar('glosario', { temaId: temaActual.id });
    const aprobados = Array.isArray(terminos)
      ? terminos.filter(t => t && (t.estado === 'aprobado' || !t.estado))
      : [];

    // Candidatos de una sola palabra, de 3 a 12 letras
    const candidatos = aprobados.filter(t => {
      const norm = util.normalizar(t.termino || '').trim();
      return norm.length >= 3 && norm.length <= 12 && !norm.includes(' ');
    });

    if (candidatos.length < 3) {
      const contenedor = document.getElementById('contenido');
      if (contenedor) {
        contenedor.innerHTML = `
          <div class="crucigrama-pagina">
            <div class="alerta alerta--advertencia">
              <p>Este tema no dispone de suficientes términos aprobados en el glosario (mínimo 3 de 3 a 12 letras) para generar un crucigrama.</p>
            </div>
            <p><a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--primario">Volver al tema</a></p>
          </div>
        `;
      }
      return;
    }

    // Hasta 15 candidatos al azar
    const seleccionados = util.barajar(candidatos).slice(0, 15);
    crucigramaActual = generarCrucigrama(seleccionados);

    if (!crucigramaActual || crucigramaActual.entradas.length === 0) {
      ui.aviso('No se pudo generar una cuadrícula con los términos disponibles', 'error');
      return;
    }

    renderizarCrucigrama();
    actualizarContadores();
    iniciarTemporizador();

    // Seleccionar la primera palabra por defecto
    if (crucigramaActual.entradas.length > 0) {
      seleccionarPalabra(crucigramaActual.entradas[0]);
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar crucigrama', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function iniciar() {
  await montarPlantilla({
    titulo: 'Crucigrama',
    roles: ['estudiante', 'docente', 'admin']
  });

  temaActual = await obtenerTemaActividad();
  if (!temaActual) return;

  await iniciarPartida();
}

if (typeof document !== 'undefined') {
  await iniciar();
}
