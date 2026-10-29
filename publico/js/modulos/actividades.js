// publico/js/modulos/actividades.js · Módulo para la página de actividades lúdicas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

async function iniciar() {
  await montarPlantilla({
    titulo: 'Actividades',
    roles: ['estudiante', 'docente']
  });

  const contenedor = document.getElementById('contenido');
  if (!contenedor) return;

  const temaId = util.parametro('temaId');
  let tema = null;

  if (temaId) {
    try {
      tema = await api.obtener('temas', temaId);
    } catch {
      tema = null;
    }
  }

  const iconos = {
    ahorcado: '🎈',
    canciones: '🎵',
    pareja: '🃏',
    'sopa-letras': '🔍',
    crucigrama: '✏️',
    quiz: '❓',
    simulacion: '🚀'
  };

  const listaActividades = Array.isArray(ACTIVIDADES) ? ACTIVIDADES : [];

  contenedor.innerHTML = `
    <section class="actividades-encabezado">
      <nav class="migas-pan margen-b-2" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span aria-hidden="true">/</span>
        ${tema ? `<a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}">${ui.escapar(tema.titulo)}</a><span aria-hidden="true">/</span>` : ''}
        <span aria-current="page">Actividades</span>
      </nav>

      <div class="fila fila--entre fila--centrada">
        <div>
          <h2>Actividades Lúdicas</h2>
          <p class="texto-atenuado">
            ${tema ? `Practica y refuerza tus conocimientos del tema: <strong>${ui.escapar(tema.titulo)}</strong>` : 'Selecciona una actividad para aprender y ganar puntos mientras juegas.'}
          </p>
        </div>
        ${tema ? `<a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--secundario btn--pequeno">← Volver al tema</a>` : ''}
      </div>
    </section>

    <section aria-label="Catálogo de actividades disponibles">
      <div class="actividades-cuadricula">
        ${listaActividades.map(act => {
          const icono = iconos[act.id] || '🎮';
          const enlace = temaId ? `${act.href}?temaId=${encodeURIComponent(temaId)}` : act.href;
          return `
            <article class="tarjeta-actividad" aria-labelledby="titulo-act-${ui.escapar(act.id)}">
              <div class="tarjeta-actividad__icono" aria-hidden="true">${icono}</div>
              <h3 id="titulo-act-${ui.escapar(act.id)}" class="tarjeta-actividad__titulo">${ui.escapar(act.texto)}</h3>
              <p class="tarjeta-actividad__descripcion">${ui.escapar(act.descripcion)}</p>
              <div class="tarjeta-actividad__pie">
                <a href="${ui.escapar(enlace)}" class="btn btn--primario" style="width: 100%;">
                  Jugar
                </a>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

await iniciar();
