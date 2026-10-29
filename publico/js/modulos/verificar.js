// publico/js/modulos/verificar.js · Verificación pública de certificados y diplomas
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

async function iniciar() {
  await montarPlantilla({
    titulo: 'Verificación de Certificados',
    roles: ['publico']
  });

  const contenedor = document.getElementById('contenido');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <section class="verificar-seccion">
      <div class="verificar-tarjeta">
        <h2>Verificación de Autenticidad de Certificados</h2>
        <p class="texto-atenuado">
          Ingresa el código único del diploma o certificado emitido por la institución para validar su autenticidad y datos de emisión.
        </p>

        <form id="form-verificar" class="verificar-formulario" role="search" aria-label="Búsqueda de certificado">
          <div class="campo">
            <label for="input-codigo" class="sr-only">Código del certificado</label>
            <input type="text"
                   id="input-codigo"
                   class="input-texto"
                   placeholder="Ej. EE-2026-ABC123"
                   autocomplete="off"
                   required>
          </div>
          <button type="submit" id="btn-verificar" class="btn btn--primario">
            Verificar
          </button>
        </form>

        <div id="contenedor-resultado" aria-live="polite"></div>
      </div>
    </section>
  `;

  const form = document.getElementById('form-verificar');
  const input = document.getElementById('input-codigo');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = input.value.trim();
    if (codigo) {
      await consultarCertificado(codigo);
    }
  });

  // Si viene en los parámetros de la URL (?codigo=...)
  const codigoUrl = util.parametro('codigo');
  if (codigoUrl) {
    input.value = codigoUrl.trim();
    consultarCertificado(codigoUrl.trim());
  }
}

async function consultarCertificado(codigo) {
  const contenedorResultado = document.getElementById('contenedor-resultado');
  if (!contenedorResultado) return;

  ui.cargando(true);
  contenedorResultado.innerHTML = '';

  try {
    const res = await api.llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

    if (res && res.valido) {
      const fechaFormateada = util.fechaLarga(res.fecha) || 'Fecha no registrada';
      contenedorResultado.innerHTML = `
        <div class="verificar-resultado verificar-resultado--valido" role="region" aria-label="Certificado válido">
          <div class="verificar-encabezado-resultado">
            <span class="verificar-icono" style="color: var(--color-exito);" aria-hidden="true">✓</span>
            <div>
              <h3 style="color: var(--color-exito); margin: 0;">Certificado Oficial y Válido</h3>
              <small class="texto-atenuado">Código verificado: <strong>${ui.escapar(codigo.toUpperCase())}</strong></small>
            </div>
          </div>

          <div class="verificar-detalles">
            <p><strong>Otorgado a:</strong> ${ui.escapar(res.nombreCompleto)}</p>
            <p><strong>Logro académico:</strong> ${ui.escapar(res.detalle)}</p>
            <p><strong>Fecha de emisión:</strong> ${ui.escapar(fechaFormateada)}</p>
            <p class="texto-pequeno texto-atenuado" style="margin-top: var(--espacio-s);">
              Este documento cuenta con validez oficial registrada en el Ecosistema Educativo Digital.
            </p>
          </div>
        </div>
      `;
    } else {
      contenedorResultado.innerHTML = `
        <div class="verificar-resultado verificar-resultado--invalido" role="region" aria-label="Certificado no válido">
          <div class="verificar-encabezado-resultado">
            <span class="verificar-icono" style="color: var(--color-error);" aria-hidden="true">✗</span>
            <div>
              <h3 style="color: var(--color-error); margin: 0;">Certificado No Encontrado</h3>
              <small class="texto-atenuado">Código consultado: <strong>${ui.escapar(codigo.toUpperCase())}</strong></small>
            </div>
          </div>

          <p class="texto-atenuado">
            El código ingresado no corresponde a ningún certificado válido emitido por la plataforma.
            Por favor, revisa que no haya errores de digitación en el código consultado.
          </p>
        </div>
      `;
    }
  } catch (err) {
    contenedorResultado.innerHTML = `
      <div class="alerta alerta--peligro margen-t-3">
        <p>Ocurrió un error al intentar verificar el certificado: ${ui.escapar(err.message || 'Error de conexión')}</p>
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

if (typeof document !== 'undefined') {
  await iniciar();
}
