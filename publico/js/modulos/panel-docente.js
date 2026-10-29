// publico/js/modulos/panel-docente.js · Panel docente para seguimiento de grupos, estudiantes y exportación
import { montarPlantilla } from "../nucleo/plantilla.js";
import api from "../nucleo/api.js";
import ui from "../nucleo/ui.js";
import util from "../nucleo/util.js";

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
 * Genera el archivo CSV con separador punto y coma y BOM UTF-8 para Excel.
 * @param {Object} grupo - Objeto de grupo
 * @param {Array} estudiantes - Lista de estudiantes con sus métricas
 */
export function generarCSV(grupo, estudiantes = []) {
  const BOM = "\uFEFF";
  const cabeceras = [
    "ID",
    "Nombre",
    "Apellido",
    "Promedio",
    "Actividades",
    "% Temas Revisados",
    "Última Conexión",
    "Alertas Activas"
  ].join(";");

  const filas = estudiantes.map(e => [
    e.id,
    `"${(e.nombre || '').replace(/"/g, '""')}"`,
    `"${(e.apellido || '').replace(/"/g, '""')}"`,
    typeof e.promedio === 'number' ? e.promedio : 0,
    typeof e.actividades === 'number' ? e.actividades : 0,
    `${typeof e.pctTemas === 'number' ? e.pctTemas : 0}%`,
    `"${e.ultimaConexion ? util.fechaLarga(e.ultimaConexion) : 'Sin registro'}"`,
    typeof e.alertasActivas === 'number' ? e.alertasActivas : 0
  ].join(";"));

  const contenido = BOM + cabeceras + "\r\n" + filas.join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const nombreArchivo = `resumen-grupo-${grupo?.id || 'export'}.csv`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { contenido, nombreArchivo };
}

/**
 * Ordena la lista de estudiantes según la columna y dirección especificada.
 * @param {Array} lista
 * @param {string} columna
 * @param {boolean} ascendente
 * @returns {Array}
 */
export function ordenarEstudiantes(lista, columna = "nombre", ascendente = true) {
  const copia = [...lista];
  copia.sort((a, b) => {
    let valorA, valorB;
    switch (columna) {
      case "nombre":
        valorA = `${a.apellido || ''} ${a.nombre || ''}`.toLowerCase();
        valorB = `${b.apellido || ''} ${b.nombre || ''}`.toLowerCase();
        return ascendente ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
      case "promedio":
        valorA = typeof a.promedio === 'number' ? a.promedio : 0;
        valorB = typeof b.promedio === 'number' ? b.promedio : 0;
        break;
      case "actividades":
        valorA = typeof a.actividades === 'number' ? a.actividades : 0;
        valorB = typeof b.actividades === 'number' ? b.actividades : 0;
        break;
      case "pctTemas":
        valorA = typeof a.pctTemas === 'number' ? a.pctTemas : 0;
        valorB = typeof b.pctTemas === 'number' ? b.pctTemas : 0;
        break;
      case "ultimaConexion":
        valorA = a.ultimaConexion ? new Date(a.ultimaConexion).getTime() : 0;
        valorB = b.ultimaConexion ? new Date(b.ultimaConexion).getTime() : 0;
        break;
      case "alertas":
        valorA = typeof a.alertasActivas === 'number' ? a.alertasActivas : 0;
        valorB = typeof b.alertasActivas === 'number' ? b.alertasActivas : 0;
        break;
      default:
        return 0;
    }
    return ascendente ? valorA - valorB : valorB - valorA;
  });
  return copia;
}

// Estado del módulo en el cliente
let chartTemasInstancia = null;
let datosGrupoActual = null;
let estadoOrden = { columna: "nombre", ascendente: true };

/**
 * Abre un modal con el resumen detallado y los últimos 20 intentos del estudiante.
 * @param {string} estudianteId
 */
export async function verDetalleEstudiante(estudianteId) {
  try {
    ui.cargando(true);
    const est = await api.llamar("GET", `/api/resumen/estudiante/${encodeURIComponent(estudianteId)}`);

    const ultimos = Array.isArray(est.ultimosIntentos) ? est.ultimosIntentos : [];
    const htmlModal = `
      <div class="modal-estudiante">
        <!-- Indicadores -->
        <div class="modal-kpis">
          <div class="modal-kpi-card">
            <span class="modal-kpi-card__label">Puntos Totales</span>
            <strong class="modal-kpi-card__valor">${est.puntos || 0} pts</strong>
          </div>
          <div class="modal-kpi-card">
            <span class="modal-kpi-card__label">Nivel Quiz</span>
            <strong class="modal-kpi-card__valor">${est.nivelQuizMax ? `Nivel ${est.nivelQuizMax}` : '-'}</strong>
          </div>
          <div class="modal-kpi-card">
            <span class="modal-kpi-card__label">% Temas Revisados</span>
            <strong class="modal-kpi-card__valor">${est.pctTemas || 0}%</strong>
          </div>
          <div class="modal-kpi-card">
            <span class="modal-kpi-card__label">Promedio General</span>
            <strong class="modal-kpi-card__valor">${est.promedio || 0} / 10</strong>
          </div>
          <div class="modal-kpi-card">
            <span class="modal-kpi-card__label">Tiempo Dedicado</span>
            <strong class="modal-kpi-card__valor">${est.tiempoMin || 0} min</strong>
          </div>
          <div class="modal-kpi-card">
            <span class="modal-kpi-card__label">Última Conexión</span>
            <strong class="modal-kpi-card__valor" style="font-size: var(--tamano-s);">
              ${est.ultimaConexion ? util.fechaRelativa(est.ultimaConexion) : 'Sin registro'}
            </strong>
          </div>
        </div>

        <!-- Tabla de últimos 20 intentos -->
        <div class="pila" style="gap: var(--espacio-xs);">
          <h4 style="margin: 0; color: var(--color-primario);">Últimos 20 Intentos</h4>
          ${ultimos.length === 0 ? `
            <div class="vacio" style="padding: var(--espacio-m);">
              <p class="vacio__descripcion">El estudiante aún no registra intentos en actividades.</p>
            </div>
          ` : `
            <div style="overflow-x: auto; max-height: 260px;">
              <table class="tabla modal-intentos-tabla">
                <thead>
                  <tr>
                    <th>Actividad</th>
                    <th>Puntaje</th>
                    <th>Puntos</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  ${ultimos.map(i => {
                    const fechaTxt = i.fecha ? util.fechaLarga(i.fecha) : '-';
                    return `
                      <tr>
                        <td><strong>${ui.escapar(i.actividad || '-')}</strong></td>
                        <td>${i.puntaje ?? '-'}/${i.maximo ?? '-'}</td>
                        <td><span class="insignia insignia--acento">+${i.puntos || 0}</span></td>
                        <td><small class="color-texto-suave">${ui.escapar(fechaTxt)}</small></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    await ui.modal({
      titulo: `Resumen de Estudiante (${estudianteId})`,
      contenido: htmlModal,
      acciones: [{ texto: "Cerrar", valor: true, clase: "btn btn--secundario" }]
    });
  } catch (err) {
    ui.aviso(err.message || "Error al cargar resumen del estudiante", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Abre un modal con las alertas del estudiante y permite enviar mensaje de apoyo o marcarlas como atendidas.
 * @param {string} estudianteId
 */
export async function abrirModalAlertasEstudiante(estudianteId) {
  try {
    ui.cargando(true);
    const grupoId = datosGrupoActual?.grupo?.id;
    const estudiante = datosGrupoActual?.estudiantes?.find(e => e.id === estudianteId) || { id: estudianteId, nombre: 'Estudiante', apellido: '' };
    const nombreCompleto = `${estudiante.nombre || ''} ${estudiante.apellido || ''}`.trim() || estudianteId;

    const resAlertas = await api.llamar("GET", `/api/alertas?grupoId=${encodeURIComponent(grupoId)}`);
    const todasAlertas = Array.isArray(resAlertas?.alertas) ? resAlertas.alertas : [];
    const mensajesApoyo = Array.isArray(resAlertas?.mensajesApoyo) ? resAlertas.mensajesApoyo : [];

    const alertasEst = todasAlertas.filter(a => a && a.estudianteId === estudianteId);
    const alertasActivas = alertasEst.filter(a => a.estado === 'activa');

    const cont = document.createElement("div");
    cont.className = "modal-alertas-contenedor pila";
    cont.style.gap = "var(--espacio-m)";

    let htmlAlertas = "";
    if (alertasActivas.length === 0) {
      htmlAlertas = `
        <div class="vacio" style="padding: var(--espacio-m);">
          <p class="vacio__descripcion">El estudiante no registra alertas activas actualmente.</p>
        </div>
      `;
    } else {
      htmlAlertas = `
        <div class="pila" style="gap: var(--espacio-s);">
          <h4 style="margin: 0; color: var(--color-primario);">Alertas Activas (${alertasActivas.length})</h4>
          ${alertasActivas.map(a => `
            <div class="tarjeta tarjeta--alerta-item" style="padding: var(--espacio-s); border-left: 4px solid var(--color-advertencia); background-color: var(--color-superficie-alt);">
              <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-xs);">
                <span class="insignia insignia--advertencia">⚠️ ${ui.escapar(a.regla)}</span>
                <span class="color-texto-suave" style="font-size: var(--tamano-xs);">${a.fecha ? util.fechaRelativa(a.fecha) : ''}</span>
              </div>
              <p style="margin: 0 0 var(--espacio-s) 0; font-size: var(--tamano-s);">${ui.escapar(a.detalle || '')}</p>
              <div style="text-align: right;">
                <button type="button" class="btn btn--secundario btn--pequeno btn-atender" data-alerta-id="${ui.escapar(a.id)}">
                  Marcar como atendida
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const htmlMensaje = `
      <div class="pila" style="gap: var(--espacio-xs); border-top: 1px solid var(--color-borde); padding-top: var(--espacio-m);">
        <h4 style="margin: 0; color: var(--color-primario);">Enviar mensaje de apoyo</h4>
        <p class="color-texto-suave" style="margin: 0 0 var(--espacio-xs) 0; font-size: var(--tamano-xs);">
          Selecciona una plantilla o escribe un mensaje personalizado que se enviará al centro de notificaciones del estudiante.
        </p>
        <div class="campo">
          <label for="select-plantilla-apoyo" style="font-size: var(--tamano-xs);">Plantillas de apoyo:</label>
          <select id="select-plantilla-apoyo" class="campo__input" style="font-size: var(--tamano-s);">
            <option value="">-- Elige una plantilla de apoyo --</option>
            ${mensajesApoyo.map(m => `<option value="${ui.escapar(m)}">${ui.escapar(m)}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="txt-mensaje-apoyo" style="font-size: var(--tamano-xs);">Mensaje a enviar:</label>
          <textarea id="txt-mensaje-apoyo" class="campo__input" rows="3" placeholder="Escribe tu mensaje de apoyo aquí..." style="font-size: var(--tamano-s);"></textarea>
        </div>
        <div style="text-align: right; margin-top: var(--espacio-xs);">
          <button type="button" id="btn-enviar-mensaje-apoyo" class="btn btn--primario btn--pequeno">
            Enviar mensaje de apoyo
          </button>
        </div>
      </div>
    `;

    cont.innerHTML = htmlAlertas + htmlMensaje;

    // Vincular botones "Marcar como atendida"
    cont.querySelectorAll(".btn-atender").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idAlerta = btn.dataset.alertaId;
        try {
          ui.cargando(true);
          await api.actualizar("alertas", idAlerta, { estado: "atendida" });
          ui.aviso("Alerta marcada como atendida", "exito");
          const backdrop = document.querySelector(".modal-backdrop");
          if (backdrop) backdrop.remove();
          if (grupoId) await cargarGrupo(grupoId);
        } catch (err) {
          ui.aviso(err.message || "Error al actualizar alerta", "error");
        } finally {
          ui.cargando(false);
        }
      });
    });

    // Vincular selector y botón de mensaje de apoyo
    const selectPlantilla = cont.querySelector("#select-plantilla-apoyo");
    const txtMensaje = cont.querySelector("#txt-mensaje-apoyo");
    const btnEnviar = cont.querySelector("#btn-enviar-mensaje-apoyo");

    if (selectPlantilla && txtMensaje) {
      selectPlantilla.addEventListener("change", (e) => {
        if (e.target.value) {
          txtMensaje.value = e.target.value;
        }
      });
    }

    if (btnEnviar && txtMensaje) {
      btnEnviar.addEventListener("click", async () => {
        const mensajeTexto = txtMensaje.value.trim();
        if (!mensajeTexto) {
          ui.aviso("Por favor escribe o selecciona un mensaje de apoyo", "error");
          return;
        }
        try {
          ui.cargando(true);
          await api.llamar("POST", "/api/notificaciones", {
            usuarioId: estudianteId,
            mensaje: mensajeTexto,
            enlace: null
          });
          ui.aviso("Mensaje de apoyo enviado al estudiante", "exito");
          txtMensaje.value = "";
        } catch (err) {
          ui.aviso(err.message || "Error al enviar mensaje de apoyo", "error");
        } finally {
          ui.cargando(false);
        }
      });
    }

    await ui.modal({
      titulo: `Alertas de ${nombreCompleto}`,
      contenido: cont,
      acciones: [{ texto: "Cerrar", valor: true, clase: "btn btn--secundario" }]
    });
  } catch (err) {
    ui.aviso(err.message || "Error al abrir alertas del estudiante", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la tabla de estudiantes con ordenamiento y resaltado de alertas.
 * @param {Array} estudiantes
 */
function renderizarTablaEstudiantes(estudiantes) {
  const tbody = document.getElementById("tbody-estudiantes");
  if (!tbody) return;

  const ordenados = ordenarEstudiantes(estudiantes, estadoOrden.columna, estadoOrden.ascendente);

  if (ordenados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--espacio-l);">
          <p class="color-texto-suave" style="margin: 0;">No hay estudiantes asignados en este grupo.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ordenados.map(e => {
    const tieneAlertas = typeof e.alertasActivas === 'number' && e.alertasActivas > 0;
    const claseFila = tieneAlertas ? "fila-estudiante fila--alerta" : "fila-estudiante";
    const fechaTxt = e.ultimaConexion ? util.fechaRelativa(e.ultimaConexion) : "Sin registro";

    return `
      <tr class="${claseFila}" data-id="${ui.escapar(e.id)}" tabindex="0" role="button" aria-label="Ver ficha de ${ui.escapar(e.nombre || '')} ${ui.escapar(e.apellido || '')}">
        <td>
          <strong>${ui.escapar(e.apellido || '')} ${ui.escapar(e.nombre || '')}</strong>
          <br><small class="color-texto-suave">${ui.escapar(e.id)}</small>
        </td>
        <td><strong>${typeof e.promedio === 'number' ? e.promedio : 0}</strong> / 10</td>
        <td>${typeof e.actividades === 'number' ? e.actividades : 0}</td>
        <td>
          <span class="insignia insignia--primario">${typeof e.pctTemas === 'number' ? e.pctTemas : 0}%</span>
        </td>
        <td><small class="color-texto-suave">${ui.escapar(fechaTxt)}</small></td>
        <td>
          ${tieneAlertas ? `
            <button type="button" class="chip--alerta btn-chip-alertas" data-id="${ui.escapar(e.id)}" aria-label="Ver ${e.alertasActivas} alerta${e.alertasActivas > 1 ? 's' : ''} activas">
              ⚠️ ${e.alertasActivas} activa${e.alertasActivas > 1 ? 's' : ''}
            </button>
          ` : `
            <span class="insignia insignia--exito">Al día</span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  // Eventos de clic en filas
  tbody.querySelectorAll(".fila-estudiante").forEach(tr => {
    const id = tr.dataset.id;
    tr.addEventListener("click", () => verDetalleEstudiante(id));
    tr.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        verDetalleEstudiante(id);
      }
    });
  });

  // Eventos de clic en chips de alerta
  tbody.querySelectorAll(".btn-chip-alertas").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      abrirModalAlertasEstudiante(id);
    });
  });

  // Actualizar indicadores de orden en cabecera
  document.querySelectorAll(".th-ordenable").forEach(th => {
    const col = th.dataset.columna;
    const flecha = th.querySelector(".th-ordenable__flecha");
    if (flecha) {
      if (col === estadoOrden.columna) {
        flecha.textContent = estadoOrden.ascendente ? "▲" : "▼";
      } else {
        flecha.textContent = "⇅";
      }
    }
  });
}

/**
 * Renderiza el gráfico de barras de promedio por tema con Chart.js.
 * @param {Array} porTema
 */
async function renderizarGraficoTemas(porTema = []) {
  const contenedor = document.getElementById("contenedor-grafico-temas");
  const canvas = document.getElementById("grafico-temas-grupo");
  if (!contenedor || !canvas) return;

  if (chartTemasInstancia) {
    chartTemasInstancia.destroy();
    chartTemasInstancia = null;
  }

  let ChartCtor = null;
  try {
    ChartCtor = await asegurarChartJs();
  } catch (err) {
    console.error("Error cargando Chart.js:", err);
  }

  if (!porTema || porTema.length === 0 || !ChartCtor) {
    contenedor.innerHTML = `
      <div class="vacio" style="border: none; padding: var(--espacio-l);">
        <div class="vacio__icono" aria-hidden="true">📊</div>
        <h4 class="vacio__titulo">Sin datos de temas</h4>
        <p class="vacio__descripcion">No se registran actividades evaluadas en los temas de este grupo.</p>
      </div>
    `;
    return;
  }

  const cs = getComputedStyle(document.documentElement);
  const colorPrimario = cs.getPropertyValue("--color-primario").trim() || "#002E45";
  const colorAcento = cs.getPropertyValue("--color-acento").trim() || "#FF6900";
  const colorTextoSuave = cs.getPropertyValue("--color-texto-suave").trim() || "#627586";
  const colorBorde = cs.getPropertyValue("--color-borde").trim() || "#DFE7EC";

  chartTemasInstancia = new ChartCtor(canvas, {
    type: "bar",
    data: {
      labels: porTema.map(t => t.titulo || t.temaId),
      datasets: [{
        label: "Promedio del grupo (sobre 10)",
        data: porTema.map(t => t.promedio),
        backgroundColor: colorAcento,
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

/**
 * Carga y actualiza los datos del grupo seleccionado.
 * @param {string} grupoId
 */
export async function cargarGrupo(grupoId) {
  if (!grupoId) return;

  try {
    ui.cargando(true);
    datosGrupoActual = await api.llamar("GET", `/api/resumen/grupo/${encodeURIComponent(grupoId)}`);

    const estudiantes = Array.isArray(datosGrupoActual.estudiantes) ? datosGrupoActual.estudiantes : [];
    const porTema = Array.isArray(datosGrupoActual.porTema) ? datosGrupoActual.porTema : [];

    // Renderizar gráfico y tabla
    await renderizarGraficoTemas(porTema);
    renderizarTablaEstudiantes(estudiantes);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar información del grupo", "error");
  } finally {
    ui.cargando(false);
  }
}

/**
 * Inicializa la página del panel docente.
 */
export async function iniciar() {
  const contenido = document.getElementById("contenido");
  if (!contenido) return;

  try {
    ui.cargando(true);

    // 1. Cargar grupos del distributivo y asignaturas
    const [misGrupos, asignaturas] = await Promise.all([
      api.listar("distributivo").catch(() => []),
      api.listar("asignaturas").catch(() => [])
    ]);

    if (!Array.isArray(misGrupos) || misGrupos.length === 0) {
      contenido.innerHTML = `
        <div class="vacio" style="margin-top: var(--espacio-xl);">
          <div class="vacio__icono" aria-hidden="true">📋</div>
          <h3 class="vacio__titulo">Sin grupos asignados</h3>
          <p class="vacio__descripcion">No tienes grupos activos asignados en el distributivo académico.</p>
        </div>
      `;
      return;
    }

    const mapaAsignaturas = new Map(asignaturas.map(a => [a.id, a.nombre]));

    contenido.innerHTML = `
      <div class="pila panel-contenedor">
        <!-- Cabecera y selector de grupo -->
        <div class="panel-cabecera">
          <div class="panel-cabecera__titulos">
            <h2>Panel de Seguimiento Docente</h2>
            <p class="color-texto-suave" style="margin: var(--espacio-xs) 0 0 0;">
              Supervisión de calificaciones, actividad académica y alertas de estudiantes.
            </p>
          </div>

          <div class="panel-controles">
            <div class="panel-selector">
              <label for="selector-grupo">Grupo:</label>
              <select id="selector-grupo" class="campo__input">
                ${misGrupos.map(g => {
                  const nombreAsig = mapaAsignaturas.get(g.asignaturaId) || "Asignatura";
                  const texto = `${nombreAsig} · Paralelo ${g.paralelo || 'A'} (${g.periodo || ''})`;
                  return `<option value="${ui.escapar(g.id)}">${ui.escapar(texto)}</option>`;
                }).join('')}
              </select>
            </div>

            <button type="button" id="btn-exportar-csv" class="btn btn--secundario">
              Exportar CSV
            </button>
          </div>
        </div>

        <!-- Gráfico de barras por tema -->
        <section class="tarjeta pila panel-grafico-seccion" aria-labelledby="titulo-grafico-grupo">
          <div class="fila" style="justify-content: space-between; align-items: baseline;">
            <h3 id="titulo-grafico-grupo" style="margin: 0; color: var(--color-primario);">Promedio por Tema</h3>
            <span class="color-texto-suave" style="font-size: var(--tamano-s);">Rendimiento colectivo del curso</span>
          </div>
          <div class="panel-grafico-contenedor" id="contenedor-grafico-temas">
            <canvas id="grafico-temas-grupo" aria-label="Gráfico de rendimiento por tema" role="img"></canvas>
          </div>
        </section>

        <!-- Tabla ordenable de estudiantes -->
        <section class="tarjeta pila" aria-labelledby="titulo-tabla-estudiantes">
          <div class="fila" style="justify-content: space-between; align-items: baseline; flex-wrap: wrap;">
            <div>
              <h3 id="titulo-tabla-estudiantes" style="margin: 0; color: var(--color-primario);">Estudiantes del Grupo</h3>
              <p class="color-texto-suave" style="margin: var(--espacio-xs) 0 0 0; font-size: var(--tamano-s);">
                Haz clic en cualquier columna para ordenar o en una fila para ver el detalle del estudiante.
              </p>
            </div>
          </div>

          <div class="tabla-contenedor-panel">
            <table class="tabla" style="margin: 0;">
              <thead>
                <tr>
                  <th class="th-ordenable" data-columna="nombre">
                    <span class="th-ordenable__contenido">Estudiante <span class="th-ordenable__flecha">▲</span></span>
                  </th>
                  <th class="th-ordenable" data-columna="promedio">
                    <span class="th-ordenable__contenido">Promedio <span class="th-ordenable__flecha">⇅</span></span>
                  </th>
                  <th class="th-ordenable" data-columna="actividades">
                    <span class="th-ordenable__contenido">Actividades <span class="th-ordenable__flecha">⇅</span></span>
                  </th>
                  <th class="th-ordenable" data-columna="pctTemas">
                    <span class="th-ordenable__contenido">% Temas <span class="th-ordenable__flecha">⇅</span></span>
                  </th>
                  <th class="th-ordenable" data-columna="ultimaConexion">
                    <span class="th-ordenable__contenido">Última conexión <span class="th-ordenable__flecha">⇅</span></span>
                  </th>
                  <th class="th-ordenable" data-columna="alertas">
                    <span class="th-ordenable__contenido">Alertas <span class="th-ordenable__flecha">⇅</span></span>
                  </th>
                </tr>
              </thead>
              <tbody id="tbody-estudiantes"></tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    // Evento selector de grupo
    const selectorGrupo = document.getElementById("selector-grupo");
    if (selectorGrupo) {
      selectorGrupo.addEventListener("change", (e) => {
        cargarGrupo(e.target.value);
      });
    }

    // Evento botón Exportar CSV
    const btnCSV = document.getElementById("btn-exportar-csv");
    if (btnCSV) {
      btnCSV.addEventListener("click", () => {
        if (!datosGrupoActual || !datosGrupoActual.grupo) {
          ui.aviso("No hay información del grupo para exportar", "error");
          return;
        }
        generarCSV(datosGrupoActual.grupo, datosGrupoActual.estudiantes);
        ui.aviso("Reporte CSV descargado correctamente", "exito");
      });
    }

    // Eventos cabeceras ordenables
    document.querySelectorAll(".th-ordenable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.columna;
        if (estadoOrden.columna === col) {
          estadoOrden.ascendente = !estadoOrden.ascendente;
        } else {
          estadoOrden.columna = col;
          estadoOrden.ascendente = true;
        }
        if (datosGrupoActual && Array.isArray(datosGrupoActual.estudiantes)) {
          renderizarTablaEstudiantes(datosGrupoActual.estudiantes);
        }
      });
    });

    // Cargar primer grupo por defecto
    const primerGrupoId = misGrupos[0]?.id;
    if (primerGrupoId) {
      await cargarGrupo(primerGrupoId);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al inicializar panel docente", "error");
  } finally {
    ui.cargando(false);
  }
}

if (typeof document !== "undefined") {
  await montarPlantilla({ titulo: "Panel Docente", roles: ["docente", "admin"] });
  await iniciar();
}
