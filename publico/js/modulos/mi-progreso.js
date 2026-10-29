// publico/js/modulos/mi-progreso.js · Panel de progreso del estudiante con indicadores y gráficos
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";

/**
 * Asegura la carga de Chart.js desde CDN si no está en window.
 * @returns {Promise<Function>}
 */
export async function asegurarChartJs() {
  if (typeof window === "undefined") return null;
  if (window.Chart) return window.Chart;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error("No se pudo cargar Chart.js desde CDN"));
    document.head.appendChild(script);
  });
}

/**
 * Traduce y formatea nombres técnicos de actividades a nombres legibles.
 * @param {string} act
 * @returns {string}
 */
export function formatearActividad(act) {
  const nombres = {
    "ahorcado": "Ahorcado",
    "pareja": "Encuentra la pareja",
    "sopa-letras": "Sopa de letras",
    "crucigrama": "Crucigrama",
    "quiz": "Evaluación Quiz",
    "simulacion": "Simulación clínica",
    "foro": "Participación en foro"
  };
  return nombres[act] || act;
}

/**
 * Renderiza el panel principal con los datos del resumen.
 * @param {Object} resumen
 */
export async function renderizarPanel(resumen) {
  const contenido = document.getElementById("contenido");
  if (!contenido) return;

  const puntos = typeof resumen.puntos === "number" ? resumen.puntos : 0;
  const nivelQuizMax = typeof resumen.nivelQuizMax === "number" ? resumen.nivelQuizMax : 0;
  const pctTemas = typeof resumen.pctTemas === "number" ? resumen.pctTemas : 0;
  const promedio = typeof resumen.promedio === "number" ? resumen.promedio : 0;
  const pendientes = Array.isArray(resumen.pendientes) ? resumen.pendientes : [];
  const porActividad = Array.isArray(resumen.porActividad) ? resumen.porActividad : [];
  const evolucion = Array.isArray(resumen.evolucion) ? resumen.evolucion : [];

  contenido.innerHTML = `
    <div class="pila progreso-contenedor">
      <div class="progreso-encabezado">
        <div>
          <h2>Mi Progreso Académico</h2>
          <p class="color-texto-suave" style="margin: var(--espacio-xs) 0 0 0;">
            Monitorea tu rendimiento, constancia y temas pendientes por estudiar.
          </p>
        </div>
      </div>

      <!-- 1. Tarjetas de indicadores (KPIs) -->
      <section class="progreso-kpis" aria-label="Indicadores generales">
        <div class="tarjeta kpi-tarjeta">
          <div class="kpi-tarjeta__icono" aria-hidden="true">🪙</div>
          <div class="kpi-tarjeta__info">
            <span class="kpi-tarjeta__titulo">Puntos Totales</span>
            <strong class="kpi-tarjeta__valor">${puntos} <span class="kpi-tarjeta__sufijo">pts</span></strong>
          </div>
        </div>

        <div class="tarjeta kpi-tarjeta kpi-tarjeta--acento">
          <div class="kpi-tarjeta__icono" aria-hidden="true">🎯</div>
          <div class="kpi-tarjeta__info">
            <span class="kpi-tarjeta__titulo">Nivel de Quiz</span>
            <strong class="kpi-tarjeta__valor">${nivelQuizMax > 0 ? `Nivel ${nivelQuizMax}` : 'Sin nivel'}</strong>
          </div>
        </div>

        <div class="tarjeta kpi-tarjeta kpi-tarjeta--exito">
          <div class="kpi-tarjeta__icono" aria-hidden="true">📖</div>
          <div class="kpi-tarjeta__info">
            <span class="kpi-tarjeta__titulo">Temas Revisados</span>
            <strong class="kpi-tarjeta__valor">${pctTemas}%</strong>
          </div>
        </div>

        <div class="tarjeta kpi-tarjeta kpi-tarjeta--info">
          <div class="kpi-tarjeta__icono" aria-hidden="true">⭐</div>
          <div class="kpi-tarjeta__info">
            <span class="kpi-tarjeta__titulo">Promedio General</span>
            <strong class="kpi-tarjeta__valor">${promedio} <span class="kpi-tarjeta__sufijo">/ 10</span></strong>
          </div>
        </div>
      </section>

      <!-- 2. Gráficos de evolución y promedio por actividad -->
      <section class="graficos-grid" aria-label="Gráficos de rendimiento">
        <div class="tarjeta grafico-tarjeta" aria-labelledby="titulo-grafico-evolucion">
          <div class="grafico-tarjeta__cabecera">
            <h3 id="titulo-grafico-evolucion">Evolución del Rendimiento</h3>
            <p class="color-texto-suave" style="margin: 0; font-size: var(--tamano-s);">
              Promedio semanal en las últimas 8 semanas con actividad
            </p>
          </div>
          <div class="grafico-contenedor" id="contenedor-evolucion">
            <canvas id="grafico-evolucion" aria-label="Gráfico de líneas de evolución semanal" role="img"></canvas>
          </div>
        </div>

        <div class="tarjeta grafico-tarjeta" aria-labelledby="titulo-grafico-actividad">
          <div class="grafico-tarjeta__cabecera">
            <h3 id="titulo-grafico-actividad">Promedio por Actividad</h3>
            <p class="color-texto-suave" style="margin: 0; font-size: var(--tamano-s);">
              Calificación media obtenida en cada tipo de actividad (sobre 10)
            </p>
          </div>
          <div class="grafico-contenedor" id="contenedor-actividad">
            <canvas id="grafico-actividad" aria-label="Gráfico de barras de promedio por actividad" role="img"></canvas>
          </div>
        </div>
      </section>

      <!-- 3. Lista de temas pendientes -->
      <section class="tarjeta pila pendientes-seccion" aria-labelledby="titulo-pendientes">
        <div class="pendientes-seccion__cabecera fila" style="justify-content: space-between; align-items: baseline; flex-wrap: wrap;">
          <div>
            <h3 id="titulo-pendientes">Temas Pendientes</h3>
            <p class="color-texto-suave" style="margin: 0; font-size: var(--tamano-s);">
              Temas publicados de tus asignaturas que aún no has marcado como revisados
            </p>
          </div>
          <span class="insignia insignia--primario">${pendientes.length} pendientes</span>
        </div>

        <div id="contenedor-pendientes">
          ${pendientes.length === 0 ? `
            <div class="vacio">
              <div class="vacio__icono" aria-hidden="true">🎉</div>
              <h4 class="vacio__titulo">¡Estás al día!</h4>
              <p class="vacio__descripcion">Has revisado todos los temas publicados de tus asignaturas.</p>
            </div>
          ` : `
            <ul class="pendientes-lista" role="list">
              ${pendientes.map(p => `
                <li class="pendiente-item" role="listitem">
                  <div class="pendiente-item__info">
                    <span class="insignia insignia--advertencia">Pendiente</span>
                    <strong class="pendiente-item__titulo">${ui.escapar(p.titulo || p.temaId)}</strong>
                  </div>
                  <a href="/paginas/tema.html?id=${encodeURIComponent(p.temaId)}" class="btn btn--primario btn--pequeno">
                    Revisar tema →
                  </a>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </section>
    </div>
  `;

  // Renderizar gráficos con Chart.js y colores de tokens.css
  await montarGraficos({ evolucion, porActividad });
}

/**
 * Monta los gráficos de Chart.js utilizando los tokens de color del sistema.
 * @param {Object} datos
 */
export async function montarGraficos({ evolucion = [], porActividad = [] }) {
  if (typeof window === "undefined") return;

  const cs = getComputedStyle(document.documentElement);
  const colorPrimario = cs.getPropertyValue("--color-primario").trim() || "#002E45";
  const colorAcento = cs.getPropertyValue("--color-acento").trim() || "#FF6900";
  const colorTexto = cs.getPropertyValue("--color-texto").trim() || "#182D3E";
  const colorTextoSuave = cs.getPropertyValue("--color-texto-suave").trim() || "#627586";
  const colorBorde = cs.getPropertyValue("--color-borde").trim() || "#DFE7EC";

  let ChartCtor = null;
  try {
    ChartCtor = await asegurarChartJs();
  } catch (err) {
    console.error("Error al cargar Chart.js:", err);
  }

  // 1. Gráfico de evolución (líneas)
  const contEvolucion = document.getElementById("contenedor-evolucion");
  const canvasEvolucion = document.getElementById("grafico-evolucion");
  if (contEvolucion && canvasEvolucion) {
    if (!evolucion || evolucion.length === 0 || !ChartCtor) {
      contEvolucion.innerHTML = `
        <div class="vacio" style="border: none; padding: var(--espacio-l);">
          <div class="vacio__icono" aria-hidden="true">📈</div>
          <h4 class="vacio__titulo">Sin datos de evolución</h4>
          <p class="vacio__descripcion">Completa actividades para registrar tu avance semanal.</p>
        </div>
      `;
    } else {
      new ChartCtor(canvasEvolucion, {
        type: "line",
        data: {
          labels: evolucion.map(e => e.semana),
          datasets: [{
            label: "Promedio semanal",
            data: evolucion.map(e => e.promedio),
            borderColor: colorAcento,
            backgroundColor: "rgba(255, 105, 0, 0.15)",
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: colorPrimario,
            pointBorderColor: "#FFFFFF",
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              min: 0,
              max: 10,
              ticks: { color: colorTextoSuave, stepSize: 2 },
              grid: { color: colorBorde }
            },
            x: {
              ticks: { color: colorTextoSuave },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  // 2. Gráfico de promedio por actividad (barras)
  const contActividad = document.getElementById("contenedor-actividad");
  const canvasActividad = document.getElementById("grafico-actividad");
  if (contActividad && canvasActividad) {
    if (!porActividad || porActividad.length === 0 || !ChartCtor) {
      contActividad.innerHTML = `
        <div class="vacio" style="border: none; padding: var(--espacio-l);">
          <div class="vacio__icono" aria-hidden="true">📊</div>
          <h4 class="vacio__titulo">Sin actividades realizadas</h4>
          <p class="vacio__descripcion">Realiza juegos o evaluaciones para ver tus promedios por actividad.</p>
        </div>
      `;
    } else {
      new ChartCtor(canvasActividad, {
        type: "bar",
        data: {
          labels: porActividad.map(a => formatearActividad(a.actividad)),
          datasets: [{
            label: "Promedio (sobre 10)",
            data: porActividad.map(a => a.promedio),
            backgroundColor: colorPrimario,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              min: 0,
              max: 10,
              ticks: { color: colorTextoSuave, stepSize: 2 },
              grid: { color: colorBorde }
            },
            x: {
              ticks: { color: colorTextoSuave, maxRotation: 25, minRotation: 0 },
              grid: { display: false }
            }
          }
        }
      });
    }
  }
}

/**
 * Función principal de arranque del módulo
 */
export async function iniciar() {
  try {
    ui.cargando(true);
    const resumen = await api.llamar("GET", "/api/resumen/estudiante/yo");
    await renderizarPanel(resumen);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar tu resumen de progreso", "error");
    const contenido = document.getElementById("contenido");
    if (contenido) {
      contenido.innerHTML = `
        <div class="vacio">
          <div class="vacio__icono" aria-hidden="true">⚠️</div>
          <h3 class="vacio__titulo">No se pudo cargar la información</h3>
          <p class="vacio__descripcion">${ui.escapar(err.message || 'Error al conectar con el servidor')}</p>
        </div>
      `;
    }
  } finally {
    ui.cargando(false);
  }
}

if (typeof document !== "undefined") {
  await montarPlantilla({ titulo: "Mi Progreso", roles: ["estudiante"] });
  await iniciar();
}
