// publico/js/nucleo/pdf.js · Generación y descarga accesible de diplomas en PDF
import * as api from './api.js';
import * as util from './util.js';

/**
 * Asegura la disponibilidad de jsPDF cargándolo dinámicamente si no está presente.
 * @returns {Promise<Function>} Constructor jsPDF
 */
async function cargarJsPDF() {
  if (typeof window === 'undefined') {
    throw new Error('jsPDF solo puede ejecutarse en el navegador');
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }
  if (window.jsPDF) {
    return window.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const scriptExistente = document.querySelector('script[src*="jspdf"]');
    if (scriptExistente) {
      scriptExistente.addEventListener('load', () => {
        const ctor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        if (ctor) resolve(ctor);
        else reject(new Error('jsPDF no se inicializó correctamente'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      const ctor = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      if (ctor) resolve(ctor);
      else reject(new Error('jsPDF no se inicializó'));
    };
    script.onerror = () => reject(new Error('No se pudo cargar la librería jsPDF desde CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Convierte un color hexadecimal o RGB a objeto { r, g, b }
 */
function parsearColor(str, fallback = { r: 0, g: 46, b: 69 }) {
  if (!str) return fallback;
  const s = str.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    }
  }
  const rgbMatch = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }
  return fallback;
}

/**
 * Genera y descarga el diploma en formato PDF A4 horizontal.
 * @param {Object} opciones
 * @param {"cumplimiento"|"nivel-quiz"} [opciones.tipo="cumplimiento"]
 * @param {string} [opciones.temaId]
 * @param {number} [opciones.nivel]
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = 'cumplimiento', temaId, nivel } = {}) {
  // 1. Solicitar emisión o recuperación del certificado en el servidor
  const certificado = await api.llamar('POST', '/api/certificados', { tipo, temaId, nivel });
  if (!certificado || !certificado.codigo) {
    throw new Error('No se pudo emitir el certificado');
  }

  const { codigo, nombreCompleto, detalle, fecha } = certificado;

  // 2. Cargar jsPDF
  const jsPDF = await cargarJsPDF();

  // 3. Leer tokens de color desde tokens.css mediante getComputedStyle
  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const cPrimario = parsearColor(cs?.getPropertyValue('--color-primario'), { r: 0, g: 46, b: 69 });
  const cSecundario = parsearColor(cs?.getPropertyValue('--color-secundario'), { r: 38, g: 71, b: 99 });
  const cAcento = parsearColor(cs?.getPropertyValue('--color-acento'), { r: 255, g: 105, b: 0 });
  const cTexto = parsearColor(cs?.getPropertyValue('--color-texto'), { r: 24, g: 45, b: 62 });
  const cTextoSuave = parsearColor(cs?.getPropertyValue('--color-texto-suave'), { r: 98, g: 117, b: 134 });

  // 4. Crear documento A4 horizontal (297 mm de ancho x 210 mm de alto)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const ancho = 297;
  const alto = 210;

  // Marco exterior
  doc.setDrawColor(cPrimario.r, cPrimario.g, cPrimario.b);
  doc.setLineWidth(2.5);
  doc.rect(12, 12, ancho - 24, alto - 24);

  // Marco interior fino
  doc.setDrawColor(cAcento.r, cAcento.g, cAcento.b);
  doc.setLineWidth(0.8);
  doc.rect(16, 16, ancho - 32, alto - 32);

  // Esquinas decorativas
  doc.setFillColor(cSecundario.r, cSecundario.g, cSecundario.b);
  doc.rect(16, 16, 4, 4, 'F');
  doc.rect(ancho - 20, 16, 4, 4, 'F');
  doc.rect(16, alto - 20, 4, 4, 'F');
  doc.rect(ancho - 20, alto - 20, 4, 4, 'F');

  // Encabezado: Nombre de la plataforma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(cAcento.r, cAcento.g, cAcento.b);
  doc.text('ECOSISTEMA EDUCATIVO DIGITAL', ancho / 2, 34, { align: 'center' });

  // Título del diploma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(cPrimario.r, cPrimario.g, cPrimario.b);
  doc.text('CERTIFICADO DE RECONOCIMIENTO', ancho / 2, 48, { align: 'center' });

  // Línea divisoria elegante
  doc.setDrawColor(cAcento.r, cAcento.g, cAcento.b);
  doc.setLineWidth(0.5);
  doc.line(ancho / 2 - 40, 53, ancho / 2 + 40, 53);

  // "Otorgado a"
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(13);
  doc.setTextColor(cTextoSuave.r, cTextoSuave.g, cTextoSuave.b);
  doc.text('El presente diploma se confiere con honor y distinción a:', ancho / 2, 65, { align: 'center' });

  // Nombre completo del estudiante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(cPrimario.r, cPrimario.g, cPrimario.b);
  doc.text(nombreCompleto.toUpperCase(), ancho / 2, 82, { align: 'center' });

  // Detalle del logro
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(cTexto.r, cTexto.g, cTexto.b);
  const lineasDetalle = doc.splitTextToSize(detalle, 200);
  doc.text(lineasDetalle, ancho / 2, 98, { align: 'center' });

  // Fecha de emisión
  const fechaTexto = util.fechaLarga(fecha) || 'Ecuador';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(cTextoSuave.r, cTextoSuave.g, cTextoSuave.b);
  doc.text(`Emitido el ${fechaTexto}`, ancho / 2, 130, { align: 'center' });

  // Línea de firma
  doc.setDrawColor(cTextoSuave.r, cTextoSuave.g, cTextoSuave.b);
  doc.setLineWidth(0.4);
  doc.line(ancho / 2 - 45, 155, ancho / 2 + 45, 155);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(cPrimario.r, cPrimario.g, cPrimario.b);
  doc.text('Comité Académico de Cirugía', ancho / 2, 161, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(cTextoSuave.r, cTextoSuave.g, cTextoSuave.b);
  doc.text('Ecosistema Educativo', ancho / 2, 166, { align: 'center' });

  // Pie: Código y Enlace de verificación
  const origen = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
  const urlVerificacion = `${origen}/paginas/verificar.html?codigo=${encodeURIComponent(codigo)}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(cPrimario.r, cPrimario.g, cPrimario.b);
  doc.text(`Código: ${codigo}`, 22, 190);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(cTextoSuave.r, cTextoSuave.g, cTextoSuave.b);
  doc.text(`Verificación en línea: ${urlVerificacion}`, ancho - 22, 190, { align: 'right' });

  // 5. Descargar PDF con el nombre exigido
  doc.save(`diploma-${codigo}.pdf`);

  return { codigo };
}

export default { generarDiploma };
