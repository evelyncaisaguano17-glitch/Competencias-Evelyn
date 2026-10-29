// publico/js/nucleo/util.js · Utilidades generales del navegador
import { escapar } from './ui.js';

// Normaliza texto a mayúsculas, sin tildes ni diéresis, conservando la Ñ y sin espacios a los lados
export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  const recortado = String(texto).trim().toUpperCase();
  // Conservar la Ñ reemplazándola temporalmente por un marcador seguro
  const conMarcador = recortado.replace(/Ñ/g, '\uE000');
  // Quitar diacríticos (tildes, diéresis)
  const sinTildes = conMarcador.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Restaurar la Ñ
  return sinTildes.replace(/\uE000/g, 'Ñ');
}

// Baraja una lista utilizando el algoritmo Fisher-Yates sin mutar el arreglo original
export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Formatea una fecha ISO a formato largo en español de Ecuador
export function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';

  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeZone: 'America/Guayaquil'
  }).format(fecha);
}

// Formatea una fecha ISO a tiempo relativo en español de Ecuador
export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';

  const diffSeg = Math.round((fecha.getTime() - Date.now()) / 1000);
  const absSeg = Math.abs(diffSeg);

  if (absSeg < 45) {
    return diffSeg <= 0 ? 'hace un momento' : 'en un momento';
  }

  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });

  if (absSeg < 3600) {
    return rtf.format(Math.round(diffSeg / 60), 'minute');
  }
  if (absSeg < 86400) {
    return rtf.format(Math.round(diffSeg / 3600), 'hour');
  }
  if (absSeg < 2592000) {
    return rtf.format(Math.round(diffSeg / 86400), 'day');
  }
  if (absSeg < 31536000) {
    return rtf.format(Math.round(diffSeg / 2592000), 'month');
  }
  return rtf.format(Math.round(diffSeg / 31536000), 'year');
}

// Obtiene el valor de un parámetro de consulta de la URL actual
export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

// Convierte texto en HTML seguro con negritas, listas y párrafos
export function formatoBasico(texto) {
  if (!texto) return '';

  // 1. Escapar todo el contenido HTML
  const escapado = escapar(texto);

  // 2. Convertir **texto** en <strong>texto</strong>
  const conNegrita = escapado.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 3. Dividir por bloques separados por líneas en blanco
  const bloques = conNegrita.trim().split(/\n\s*\n/);

  const htmlBloques = bloques.map((bloque) => {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) return '';

    const todasListas = lineas.every((l) => l.startsWith('- '));
    if (todasListas) {
      const items = lineas.map((l) => `<li>${l.slice(2).trim()}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    const partes = [];
    let bufferTexto = [];
    let bufferLista = [];

    const vaciarLista = () => {
      if (bufferLista.length > 0) {
        partes.push(`<ul>${bufferLista.map((it) => `<li>${it}</li>`).join('')}</ul>`);
        bufferLista = [];
      }
    };

    const vaciarTexto = () => {
      if (bufferTexto.length > 0) {
        partes.push(`<p>${bufferTexto.join('<br>')}</p>`);
        bufferTexto = [];
      }
    };

    for (const linea of lineas) {
      if (linea.startsWith('- ')) {
        vaciarTexto();
        bufferLista.push(linea.slice(2).trim());
      } else {
        vaciarLista();
        bufferTexto.push(linea);
      }
    }
    vaciarTexto();
    vaciarLista();

    return partes.join('');
  });

  return htmlBloques.filter(Boolean).join('');
}

export default {
  normalizar,
  barajar,
  fechaLarga,
  fechaRelativa,
  parametro,
  formatoBasico
};
