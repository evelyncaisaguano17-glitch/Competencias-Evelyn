// servidor/rutas/ia.js · Rutas de ejecución de tareas de Inteligencia Artificial
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exigirRol } from '../auth.js';
import { ejecutarTarea, probarConexion, obtenerConfigIA, actualizarConfigIA } from '../ia.js';

const router = express.Router();
const DIR_PREPARADORES = fileURLToPath(new URL('../preparadores', import.meta.url));

/**
 * GET /api/ia/config
 * Consulta la configuración de IA actual (solo administradores).
 */
router.get('/ia/config', exigirRol('admin'), async (req, res) => {
  try {
    const config = await obtenerConfigIA();
    return res.json({
      proveedor: config.proveedor,
      modelo: config.modelo,
      clave: config.clave,
      claveConfigurada: Boolean(config.clave && config.clave !== 'tu-clave-aqui'),
      mock: config.mock
    });
  } catch (err) {
    console.error('Error en GET /api/ia/config:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener configuración de IA' });
  }
});

/**
 * PUT /api/ia/config y POST /api/ia/config
 * Guarda la configuración de IA (proveedor, modelo, clave, mock) (solo administradores).
 */
const guardarConfigHandler = async (req, res) => {
  try {
    const { proveedor, modelo, clave, mock, limiteIADiario, limiteTutorDiario } = req.body || {};
    const nuevaConfig = await actualizarConfigIA({
      iaProveedor: proveedor,
      iaModelo: modelo,
      iaClave: clave,
      iaMock: mock,
      limiteIADiario,
      limiteTutorDiario
    });
    return res.json({
      ok: true,
      mensaje: 'Configuración de IA guardada correctamente',
      config: {
        proveedor: nuevaConfig.proveedor,
        modelo: nuevaConfig.modelo,
        claveConfigurada: Boolean(nuevaConfig.clave && nuevaConfig.clave !== 'tu-clave-aqui'),
        mock: nuevaConfig.mock
      }
    });
  } catch (err) {
    console.error('Error al guardar configuración de IA:', err);
    return res.status(500).json({ error: err.message || 'Error al guardar la configuración de IA' });
  }
};

router.put('/ia/config', exigirRol('admin'), guardarConfigHandler);
router.post('/ia/config', exigirRol('admin'), guardarConfigHandler);

/**
 * GET /api/ia/prueba
 * Comprobación de estado del servicio de IA (solo administradores).
 * Envía "Responde solo: OK". La clave nunca sale del servidor.
 */
router.get('/ia/prueba', exigirRol('admin'), async (req, res) => {
  try {
    const respuesta = await probarConexion();
    return res.json({ ok: true, respuesta: String(respuesta).trim() });
  } catch (err) {
    console.error('Error en GET /api/ia/prueba:', err);
    const estado = err.estado || 502;
    return res.status(estado).json({ error: err.message || 'Error al conectar con la IA' });
  }
});


/**
 * POST /api/ia/:tarea
 * Carga el preparador correspondiente, valida permisos y ejecuta la tarea de IA.
 * - generar-* solo para docente y admin.
 * - tutor, rol-simulacion y evaluar-rol con cualquier rol en sesión.
 * - formato "json" en generar-* y evaluar-rol; "texto" en tutor y rol-simulacion.
 */
router.post('/ia/:tarea', async (req, res) => {
  try {
    const { tarea } = req.params;

    if (!tarea || !/^[a-z0-9-]+$/.test(tarea)) {
      return res.status(400).json({ error: 'Nombre de tarea de IA no válido' });
    }

    // 1. Control de acceso por rol
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    if (tarea.startsWith('generar-')) {
      if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo docentes y administradores pueden generar contenido con IA' });
      }
    } else if (['tutor', 'rol-simulacion', 'evaluar-rol'].includes(tarea)) {
      if (!['estudiante', 'docente', 'admin'].includes(usuario.rol)) {
        return res.status(403).json({ error: 'Rol no autorizado para esta tarea de IA' });
      }
    } else {
      if (!['docente', 'admin'].includes(usuario.rol)) {
        return res.status(403).json({ error: 'No tienes permiso para ejecutar esta tarea de IA' });
      }
    }

    // 2. Cargar preparador
    const rutaPreparador = path.join(DIR_PREPARADORES, `${tarea}.js`);
    try {
      await fs.access(rutaPreparador);
    } catch {
      return res.status(404).json({ error: `Tarea de IA no encontrada: ${tarea}` });
    }

    const modPreparador = await import(pathToFileURL(rutaPreparador).href);
    const preparador = modPreparador.default || modPreparador;

    if (typeof preparador !== 'function') {
      return res.status(500).json({ error: `El preparador de la tarea ${tarea} no es válido` });
    }

    // 3. Ejecutar preparador (el navegador solo envía datos, nunca instrucciones)
    const datosPreparados = await preparador(req.body || {}, usuario);

    // 4. Formato de la tarea
    const formato = (tarea.startsWith('generar-') || tarea === 'evaluar-rol') ? 'json' : 'texto';

    // 5. Ejecutar la tarea de IA
    const resultado = await ejecutarTarea(tarea, datosPreparados, usuario, { formato });

    if (typeof resultado === 'string') {
      return res.json({ respuesta: resultado, texto: resultado });
    }
    return res.json(resultado);
  } catch (err) {
    console.error('Error en POST /api/ia/:tarea:', err);
    const estado = err.estado || 500;
    return res.status(estado).json({ error: err.message || 'Error al procesar la tarea de IA' });
  }
});

export default router;
