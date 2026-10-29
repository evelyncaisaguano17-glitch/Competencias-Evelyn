// publico/js/modulos/pareja.js · Juego Encuentra la pareja con tarjetas 3D
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

let temaActual = null;
let glosarioTema = [];
let dificultadActual = 6;

let cartasEnJuego = [];
let primeraCarta = null;
let bloqueado = false;
let intentos = 0;
let parejasEncontradas = 0;
let numParejas = 0;
let tiempoInicio = 0;
let intervaloTiempo = null;
let juegoFinalizado = false;

async function iniciar() {
  await montarPlantilla({
    titulo: 'Encuentra la pareja',
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
      return item && item.termino && item.definicion;
    });
  } catch (err) {
    console.error('Error al cargar glosario:', err);
    glosarioTema = [];
  } finally {
    ui.cargando(false);
  }

  if (glosarioTema.length < 4) {
    mostrarPantallaTerminosInsuficientes(contenedor);
    return;
  }

  // Ajustar dificultad inicial según términos disponibles
  if (glosarioTema.length < 6) {
    dificultadActual = glosarioTema.length;
  }

  renderizarEstructura(contenedor);
  iniciarPartida();
}

function mostrarPantallaSinTema(contenedor) {
  contenedor.innerHTML = `
    <div class="vacio" role="alert">
      <div class="vacio__icono" aria-hidden="true">🃏</div>
      <h3 class="vacio__titulo">No se seleccionó un tema</h3>
      <p class="vacio__descripcion">Debes seleccionar un tema curricular para jugar y asociar conceptos con sus definiciones.</p>
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
          glosarioTema = (Array.isArray(lista) ? lista : []).filter(item => item && item.termino && item.definicion);
          if (glosarioTema.length < 4) {
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
    <section class="pareja-cabecera">
      <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span aria-hidden="true">/</span>
        <a href="${ui.escapar(enlaceTema)}">${ui.escapar(temaActual.titulo)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Encuentra la pareja</span>
      </nav>
    </section>

    <div class="vacio" role="alert">
      <div class="vacio__icono" aria-hidden="true">📖</div>
      <h3 class="vacio__titulo">Términos insuficientes</h3>
      <p class="vacio__descripcion">
        Este tema cuenta con ${glosarioTema.length} término(s) disponible(s). Se requiere un mínimo de 4 términos en el glosario para jugar.
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
  const totalDisponibles = glosarioTema.length;

  contenedor.innerHTML = `
    <div class="pareja-contenedor">
      <section class="pareja-cabecera">
        <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span aria-hidden="true">/</span>
          <a href="${ui.escapar(enlaceTema)}">${ui.escapar(temaActual.titulo)}</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Encuentra la pareja</span>
        </nav>

        <div class="fila fila--entre fila--centrada">
          <div>
            <h2>Encuentra la pareja</h2>
            <p class="texto-atenuado">
              Tema: <strong>${ui.escapar(temaActual.titulo)}</strong> · Voltea las tarjetas para relacionar cada concepto con su definición correcta.
            </p>
          </div>
          <a href="${ui.escapar(enlaceTema)}" class="btn btn--secundario btn--pequeno">← Volver al tema</a>
        </div>
      </section>

      <!-- Barra de controles y estadísticas -->
      <section class="pareja-barra-controles" aria-label="Estado y opciones de la partida">
        <div class="fila fila--centrada" style="gap: var(--espacio-s);">
          <label for="select-dificultad" class="texto-pequeno"><strong>Parejas:</strong></label>
          <select id="select-dificultad" class="input-select" style="min-width: 140px;">
            <option value="6" ${dificultadActual === 6 ? 'selected' : ''}>6 parejas ${totalDisponibles < 6 ? `(${totalDisponibles} disp.)` : ''}</option>
            ${totalDisponibles >= 8 ? `<option value="8" ${dificultadActual === 8 ? 'selected' : ''}>8 parejas</option>` : ''}
            ${totalDisponibles >= 10 ? `<option value="10" ${dificultadActual === 10 ? 'selected' : ''}>10 parejas</option>` : ''}
            ${totalDisponibles < 6 ? `<option value="${totalDisponibles}" ${dificultadActual === totalDisponibles ? 'selected' : ''}>${totalDisponibles} parejas (máx)</option>` : ''}
          </select>
          <button type="button" id="btn-reiniciar-juego" class="btn btn--secundario btn--pequeno" title="Reiniciar partida con nuevas tarjetas">
            🔄 Reiniciar
          </button>
        </div>

        <div class="pareja-estadisticas" role="status" aria-live="polite">
          <div class="pareja-estadistica">
            <span>Parejas:</span>
            <strong id="stat-parejas">0 / 0</strong>
          </div>
          <div class="pareja-estadistica">
            <span>Intentos:</span>
            <strong id="stat-intentos">0</strong>
          </div>
          <div class="pareja-estadistica">
            <span>Tiempo:</span>
            <strong id="stat-tiempo">00:00</strong>
          </div>
        </div>
      </section>

      <!-- Panel de retroalimentación inmediata -->
      <div id="pareja-retro" class="pareja-retro-contenedor" aria-live="polite"></div>

      <!-- Cuadrícula de tarjetas -->
      <main id="cuadricula-tarjetas" class="pareja-cuadricula" aria-label="Tablero de tarjetas"></main>
    </div>
  `;

  const selDificultad = document.getElementById('select-dificultad');
  if (selDificultad) {
    selDificultad.addEventListener('change', () => {
      dificultadActual = parseInt(selDificultad.value, 10) || 6;
      iniciarPartida();
    });
  }

  const btnReiniciar = document.getElementById('btn-reiniciar-juego');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      iniciarPartida();
    });
  }
}

function iniciarPartida() {
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }

  const totalDisponibles = glosarioTema.length;
  // Dificultad de 6, 8 o 10 parejas (si hay menos términos, usa los disponibles; mínimo 4)
  numParejas = Math.min(dificultadActual, totalDisponibles);
  if (numParejas < 4) numParejas = Math.min(4, totalDisponibles);

  // Seleccionar términos al azar
  const terminosElegidos = util.barajar(glosarioTema).slice(0, numParejas);

  // Crear tarjetas individuales (término y definición)
  const cartas = [];
  terminosElegidos.forEach((t) => {
    cartas.push({
      id: `term-${t.id}`,
      termId: t.id,
      tipo: 'Término',
      texto: t.termino,
      definicion: t.definicion
    });
    cartas.push({
      id: `def-${t.id}`,
      termId: t.id,
      tipo: 'Definición',
      texto: t.definicion,
      definicion: t.definicion
    });
  });

  // Barajar tarjetas con util.barajar
  cartasEnJuego = util.barajar(cartas);

  primeraCarta = null;
  bloqueado = false;
  intentos = 0;
  parejasEncontradas = 0;
  juegoFinalizado = false;
  tiempoInicio = Date.now();

  actualizarMarcadores();

  // Limpiar panel retro
  const panelRetro = document.getElementById('pareja-retro');
  if (panelRetro) panelRetro.innerHTML = '';

  renderizarTarjetas();

  // Iniciar cronómetro
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
  const elParejas = document.getElementById('stat-parejas');
  const elIntentos = document.getElementById('stat-intentos');

  if (elParejas) elParejas.textContent = `${parejasEncontradas} / ${numParejas}`;
  if (elIntentos) elIntentos.textContent = String(intentos);
}

function renderizarTarjetas() {
  const contenedor = document.getElementById('cuadricula-tarjetas');
  if (!contenedor) return;

  contenedor.innerHTML = cartasEnJuego.map((c, i) => `
    <button type="button"
            class="tarjeta-pareja"
            data-id="${ui.escapar(c.id)}"
            data-term-id="${ui.escapar(c.termId)}"
            data-indice="${i}"
            aria-label="Tarjeta ${i + 1} de ${cartasEnJuego.length}: boca abajo"
            aria-pressed="false">
      <div class="tarjeta-pareja__interno">
        <div class="tarjeta-pareja__dorso" aria-hidden="true">
          <span class="tarjeta-pareja__dorso-icono">🃏</span>
        </div>
        <div class="tarjeta-pareja__frente">
          <span class="tarjeta-pareja__tipo">${ui.escapar(c.tipo)}</span>
          <span class="tarjeta-pareja__texto">${ui.escapar(c.texto)}</span>
        </div>
      </div>
    </button>
  `).join('');

  contenedor.onclick = (e) => {
    const btn = e.target.closest('.tarjeta-pareja');
    if (!btn) return;
    manejarClickTarjeta(btn);
  };
}

async function manejarClickTarjeta(btn) {
  if (bloqueado || juegoFinalizado) return;
  if (btn.classList.contains('volteada') || btn.classList.contains('emparejada')) return;

  const indice = parseInt(btn.dataset.indice, 10);
  const dato = cartasEnJuego[indice];
  if (!dato) return;

  // Voltear tarjeta visualmente y actualizar accesibilidad
  btn.classList.add('volteada');
  btn.setAttribute('aria-pressed', 'true');
  btn.setAttribute('aria-label', `Tarjeta ${indice + 1}: ${dato.tipo} - ${dato.texto}`);

  if (!primeraCarta) {
    // Primera tarjeta volteada
    primeraCarta = { elemento: btn, dato, indice };
    return;
  }

  // Segunda tarjeta volteada
  if (primeraCarta.elemento === btn) return;

  intentos++;
  actualizarMarcadores();

  const esPareja = primeraCarta.dato.termId === dato.termId;

  if (esPareja) {
    // Si forman pareja quedan descubiertas
    const carta1 = primeraCarta.elemento;
    const carta2 = btn;

    carta1.classList.add('emparejada');
    carta2.classList.add('emparejada');
    carta1.disabled = true;
    carta2.disabled = true;

    carta1.setAttribute('aria-label', `Tarjeta ${primeraCarta.indice + 1}: ${primeraCarta.dato.tipo} - ${primeraCarta.dato.texto} (Emparejada)`);
    carta2.setAttribute('aria-label', `Tarjeta ${indice + 1}: ${dato.tipo} - ${dato.texto} (Emparejada)`);

    parejasEncontradas++;
    actualizarMarcadores();

    // Mostrar retroalimentación con la definición
    const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;
    mostrarRetro({
      correcto: true,
      explicacion: dato.definicion,
      enlaceTema,
      contenedor: '#pareja-retro'
    });

    primeraCarta = null;

    // Verificar si completó todas las parejas
    if (parejasEncontradas === numParejas) {
      await finalizarJuego();
    }
  } else {
    // Si no, se voltean a los 1,2 s
    bloqueado = true;
    const carta1 = primeraCarta.elemento;
    const carta2 = btn;

    setTimeout(() => {
      carta1.classList.remove('volteada');
      carta1.setAttribute('aria-pressed', 'false');
      carta1.setAttribute('aria-label', `Tarjeta ${primeraCarta.indice + 1}: boca abajo`);

      carta2.classList.remove('volteada');
      carta2.setAttribute('aria-pressed', 'false');
      carta2.setAttribute('aria-label', `Tarjeta ${indice + 1}: boca abajo`);

      primeraCarta = null;
      bloqueado = false;
    }, 1200);
  }
}

async function finalizarJuego() {
  juegoFinalizado = true;
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }

  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  // Puntaje: máximo entre 0 y 10 − (intentos − parejas)
  const errores = Math.max(0, intentos - numParejas);
  const puntaje = Math.max(0, 10 - errores);
  const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`;

  // Registrar intento en el servidor
  try {
    await registrarIntento({
      actividad: 'pareja',
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de pareja:', err);
  }

  // Mostrar modal de resumen accesible
  const accion = await mostrarResumen({
    titulo: '¡Completaste Encuentra la pareja!',
    aciertos: numParejas,
    errores,
    recomendaciones: `Has emparejado ${numParejas} conceptos y definiciones en ${duracionSeg} segundos con ${intentos} intentos.`,
    enlaceTema
  });

  if (accion === 'repetir') {
    iniciarPartida();
  }
}

await iniciar();
