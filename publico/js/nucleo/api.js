// publico/js/nucleo/api.js · Cliente HTTP para la API del ecosistema educativo

// Realiza una petición HTTP con autenticación por Bearer token y control de errores
export async function llamar(metodo, ruta, cuerpo = null) {
  const headers = {};
  const token = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opciones = {
    method: metodo.toUpperCase(),
    headers
  };

  if (cuerpo !== null && cuerpo !== undefined) {
    if (typeof FormData !== 'undefined' && cuerpo instanceof FormData) {
      opciones.body = cuerpo;
    } else {
      headers['Content-Type'] = 'application/json';
      opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    }
  }

  const url = ruta.startsWith('http://') || ruta.startsWith('https://')
    ? ruta
    : (ruta.startsWith('/') ? ruta : `/${ruta}`);

  const respuesta = await fetch(url, opciones);

  // Parsear respuesta
  let datos;
  const contentType = respuesta.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    datos = await respuesta.json();
  } else {
    const texto = await respuesta.text();
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  // Manejo de sesión expirada o no autorizada
  if (respuesta.status === 401) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      const rutaActual = window.location.pathname || '';
      if (!rutaActual.endsWith('ingreso.html') && !rutaActual.endsWith('registro.html')) {
        window.location.href = '/paginas/ingreso.html';
      }
    }
    // Si la llamada fue de autenticación (/auth/login), mostrar el error real devuelto
    if (ruta.includes('/auth/login') && datos && typeof datos === 'object' && datos.error) {
      throw new Error(datos.error);
    }
    throw new Error('Sesión no autorizada o expirada');
  }

  // Si la respuesta trae { error }, lanzar Error con ese texto
  if (datos && typeof datos === 'object' && datos.error) {
    throw new Error(datos.error);
  }

  if (!respuesta.ok) {
    const mensaje = typeof datos === 'string' && datos
      ? datos
      : `Error en la solicitud: ${respuesta.status} ${respuesta.statusText}`;
    throw new Error(mensaje);
  }

  return datos;
}

// Lista registros de una colección con filtros opcionales
export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.append(clave, String(valor));
    }
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return llamar('GET', `/api/${col}${query}`);
}

// Obtiene un registro por su id
export async function obtener(col, id) {
  return llamar('GET', `/api/${col}/${id}`);
}

// Crea un nuevo registro en una colección
export async function crear(col, datos) {
  return llamar('POST', `/api/${col}`, datos);
}

// Actualiza un registro fusionando campos
export async function actualizar(col, id, cambios) {
  return llamar('PUT', `/api/${col}/${id}`, cambios);
}

// Elimina un registro por su id
export async function eliminar(col, id) {
  return llamar('DELETE', `/api/${col}/${id}`);
}

// Sube un archivo mediante FormData con el campo 'archivo'
export async function subir(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return llamar('POST', '/api/subidas', formData);
}

// Ejecuta una tarea del módulo de Inteligencia Artificial
export async function ia(tarea, datos) {
  return llamar('POST', `/api/ia/${tarea}`, datos);
}

export default {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  llamar,
  subir,
  ia
};
