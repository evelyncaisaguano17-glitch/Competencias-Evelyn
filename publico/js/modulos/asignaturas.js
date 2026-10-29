// publico/js/modulos/asignaturas.js · Mis Asignaturas con avance curricular
import { montarPlantilla } from "../nucleo/plantilla.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";

/**
 * Calcula el avance del usuario actual en una asignatura.
 * Porcentaje de temas publicados de unidades visibles que han sido marcados en progreso-temas.
 * @param {string} asignaturaId
 * @returns {Promise<{ total: number, revisados: number, porcentaje: number }>}
 */
export async function calcularAvance(asignaturaId) {
  if (!asignaturaId) {
    return { total: 0, revisados: 0, porcentaje: 0, valueOf() { return 0; } };
  }

  try {
    // 1. Obtener unidades visibles de la asignatura
    const todasUnidades = await api.listar("unidades", { asignaturaId });
    const unidadesVisibles = Array.isArray(todasUnidades)
      ? todasUnidades.filter((u) => u && u.visible !== false)
      : [];

    if (unidadesVisibles.length === 0) {
      return { total: 0, revisados: 0, porcentaje: 0, valueOf() { return 0; } };
    }

    const setUnidadesIds = new Set(unidadesVisibles.map((u) => u.id));

    // 2. Obtener temas publicados de esas unidades
    const todosTemas = await api.listar("temas");
    const temasPublicados = Array.isArray(todosTemas)
      ? todosTemas.filter(
          (t) => t && t.unidadId && setUnidadesIds.has(t.unidadId) && t.estado === "publicado"
        )
      : [];

    const totalTemas = temasPublicados.length;
    if (totalTemas === 0) {
      return { total: 0, revisados: 0, porcentaje: 0, valueOf() { return 0; } };
    }

    // 3. Obtener progreso de temas revisados por el usuario
    const progreso = await api.listar("progreso-temas");
    const revisadosSet = new Set(
      Array.isArray(progreso) ? progreso.map((p) => p && p.temaId).filter(Boolean) : []
    );

    const temasRevisados = temasPublicados.filter((t) => revisadosSet.has(t.id)).length;
    const porcentaje = Math.round((temasRevisados / totalTemas) * 100);

    return {
      total: totalTemas,
      revisados: temasRevisados,
      porcentaje,
      valueOf() {
        return porcentaje;
      },
      toString() {
        return String(porcentaje);
      }
    };
  } catch (err) {
    console.warn("Error al calcular avance de asignatura:", err);
    return { total: 0, revisados: 0, porcentaje: 0, valueOf() { return 0; } };
  }
}

// Inicialización de la página (solo cuando se carga directamente en asignaturas.html)
if (typeof window !== "undefined" && window.location && window.location.pathname.includes("asignaturas.html")) {
  await montarPlantilla({
    titulo: "Mis Asignaturas",
    roles: ["estudiante", "docente"]
  });

  await iniciar();
}

async function iniciar() {
  const contenedor = document.getElementById("contenido");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="seccion-mis-asignaturas">
      <header class="mis-asignaturas__cabecera">
        <h2>Mis Asignaturas</h2>
        <p class="color-texto-suave">Explora los contenidos de tus materias y consulta tu avance formativo.</p>
      </header>

      <div id="grid-mis-asignaturas" class="tarjetas-grid">
        <p class="color-texto-suave">Cargando tus asignaturas...</p>
      </div>
    </div>
  `;

  const grid = document.getElementById("grid-mis-asignaturas");

  try {
    ui.cargando(true);
    const asignaturas = await api.listar("asignaturas");

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      grid.innerHTML = `
        <div class="alerta alerta--info" style="grid-column: 1 / -1;">
          <p>Actualmente no tienes asignaturas matriculadas o asignadas.</p>
        </div>
      `;
      return;
    }

    // Calcular avance para cada asignatura en paralelo
    const avances = await Promise.all(
      asignaturas.map((a) => calcularAvance(a.id))
    );

    grid.innerHTML = asignaturas
      .map((a, i) => {
        const avance = avances[i] || { total: 0, revisados: 0, porcentaje: 0 };
        const descHtml = a.descripcion
          ? `<p>${ui.escapar(a.descripcion)}</p>`
          : `<p><em>Sin descripción disponible.</em></p>`;

        const pct = avance.porcentaje || 0;
        const esCompleto = pct >= 100;

        return `
          <article class="tarjeta-asig" data-id="${ui.escapar(a.id)}">
            <div class="tarjeta-asig__cuerpo">
              <span class="insignia insignia--primario tarjeta-asig__nivel">
                ${ui.escapar(a.nivel || "General")}
              </span>
              <h3>${ui.escapar(a.nombre || "Sin título")}</h3>
              ${descHtml}
            </div>

            <div class="pila" style="gap: var(--espacio-s);">
              <div class="contenedor-avance">
                <div class="contenedor-avance__meta">
                  <strong>Avance: ${pct}%</strong>
                  <span>${avance.revisados} de ${avance.total} temas</span>
                </div>
                <div class="barra-avance" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso en ${ui.escapar(a.nombre)}">
                  <div class="barra-avance__relleno ${esCompleto ? 'barra-avance__relleno--completo' : ''}" style="width: ${pct}%;"></div>
                </div>
              </div>

              <a
                href="/paginas/asignatura.html?id=${encodeURIComponent(a.id)}"
                class="btn btn--primario"
                style="text-align: center; margin-top: var(--espacio-xs);"
              >
                Entrar a la materia →
              </a>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las asignaturas", "error");
    if (grid) {
      grid.innerHTML = `
        <div class="alerta alerta--peligro" style="grid-column: 1 / -1;">
          <p>${ui.escapar(err.message || "Error al cargar asignaturas")}</p>
        </div>
      `;
    }
  } finally {
    ui.cargando(false);
  }
}
