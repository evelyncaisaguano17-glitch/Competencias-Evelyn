// publico/js/nucleo/selector-tema.js · Selección contextual o modal de tema curricular para actividades
import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

/**
 * Obtiene el tema para una actividad interactiva:
 * - Si existe el parámetro ?temaId= en la URL, lo recupera directamente desde la API.
 * - Si no, despliega un modal accesible con selects encadenados (Asignatura -> Unidad -> Tema publicado).
 * @returns {Promise<Object|null>} Objeto tema seleccionado o null si se cancela
 */
export async function obtenerTemaActividad() {
  const temaIdUrl = util.parametro('temaId');

  if (temaIdUrl) {
    try {
      const tema = await api.obtener('temas', temaIdUrl);
      if (tema && tema.id) {
        return tema;
      }
    } catch (err) {
      console.warn('No se pudo cargar el tema indicado en la URL:', err);
    }
  }

  // Si no hay tema en URL, mostrar modal con selects encadenados
  return new Promise(async (resolve) => {
    let asignaturas = [];
    try {
      asignaturas = await api.listar('asignaturas');
    } catch {
      asignaturas = [];
    }

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      ui.aviso('No hay asignaturas disponibles para practicar.', 'error');
      resolve(null);
      return;
    }

    // Contenedor del selector encadenado
    const contenedor = document.createElement('div');
    contenedor.className = 'selector-tema-modal pila';

    contenedor.innerHTML = `
      <p class="texto-pequeno color-texto-suave">Selecciona la materia, unidad y tema curricular que deseas practicar:</p>

      <div class="campo">
        <label for="sel-modal-asig">Asignatura:</label>
        <select id="sel-modal-asig" class="input-select">
          <option value="">-- Elige una asignatura --</option>
          ${asignaturas.map(a => `<option value="${a.id}">${ui.escapar(a.nombre)}</option>`).join('')}
        </select>
      </div>

      <div class="campo">
        <label for="sel-modal-uni">Unidad temática:</label>
        <select id="sel-modal-uni" class="input-select" disabled>
          <option value="">-- Selecciona primero la asignatura --</option>
        </select>
      </div>

      <div class="campo">
        <label for="sel-modal-tema">Tema de estudio:</label>
        <select id="sel-modal-tema" class="input-select" disabled>
          <option value="">-- Selecciona primero la unidad --</option>
        </select>
      </div>
    `;

    const selAsig = contenedor.querySelector('#sel-modal-asig');
    const selUni = contenedor.querySelector('#sel-modal-uni');
    const selTema = contenedor.querySelector('#sel-modal-tema');

    let temasCargados = [];

    // Manejar cambio de asignatura
    selAsig.addEventListener('change', async () => {
      const asigId = selAsig.value;
      selUni.innerHTML = '<option value="">Cargando unidades...</option>';
      selUni.disabled = true;
      selTema.innerHTML = '<option value="">-- Selecciona primero la unidad --</option>';
      selTema.disabled = true;
      temasCargados = [];

      if (!asigId) {
        selUni.innerHTML = '<option value="">-- Selecciona primero la asignatura --</option>';
        return;
      }

      try {
        const todasUnidades = await api.listar('unidades', { asignaturaId: asigId });
        const unidadesVisibles = (Array.isArray(todasUnidades) ? todasUnidades : [])
          .filter(u => u && u.visible !== false);

        if (unidadesVisibles.length === 0) {
          selUni.innerHTML = '<option value="">No hay unidades visibles</option>';
          return;
        }

        selUni.innerHTML = '<option value="">-- Elige una unidad --</option>' +
          unidadesVisibles.map(u => `<option value="${u.id}">${ui.escapar(u.titulo)}</option>`).join('');
        selUni.disabled = false;
      } catch (err) {
        selUni.innerHTML = '<option value="">Error al cargar unidades</option>';
      }
    });

    // Manejar cambio de unidad
    selUni.addEventListener('change', async () => {
      const uniId = selUni.value;
      selTema.innerHTML = '<option value="">Cargando temas...</option>';
      selTema.disabled = true;
      temasCargados = [];

      if (!uniId) {
        selTema.innerHTML = '<option value="">-- Selecciona primero la unidad --</option>';
        return;
      }

      try {
        const todosTemas = await api.listar('temas', { unidadId: uniId });
        temasCargados = (Array.isArray(todosTemas) ? todosTemas : [])
          .filter(t => t && t.estado === 'publicado');

        if (temasCargados.length === 0) {
          selTema.innerHTML = '<option value="">No hay temas publicados en esta unidad</option>';
          return;
        }

        selTema.innerHTML = '<option value="">-- Elige un tema --</option>' +
          temasCargados.map(t => `<option value="${t.id}">${ui.escapar(t.titulo)}</option>`).join('');
        selTema.disabled = false;
      } catch (err) {
        selTema.innerHTML = '<option value="">Error al cargar temas</option>';
      }
    });

    // Abrir diálogo modal
    const respuestaModal = await ui.modal({
      titulo: 'Elegir Tema de Estudio',
      contenido: contenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
        { texto: 'Comenzar actividad', valor: 'elegir', clase: 'btn btn--primario' }
      ]
    });

    if (respuestaModal === 'elegir') {
      const temaIdSeleccionado = selTema.value;
      const temaElegido = temasCargados.find(t => t && t.id === temaIdSeleccionado);
      if (temaElegido) {
        resolve(temaElegido);
        return;
      }
      ui.aviso('Debes seleccionar un tema publicado para continuar', 'error');
      resolve(null);
    } else {
      resolve(null);
    }
  });
}

export default {
  obtenerTemaActividad
};
