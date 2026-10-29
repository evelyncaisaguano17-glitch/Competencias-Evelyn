// pruebas/panel-docente.test.js · Pruebas para el panel docente y exportación (Tarea P06.3)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU } from '../publico/js/nucleo/menu.js';
import { generarCSV, ordenarEstudiantes } from '../publico/js/modulos/panel-docente.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

test('1. Integridad de archivos de interfaz: panel-docente.html, panel-docente.css y panel-docente.js', () => {
  const rutaHtml = path.join(raiz, 'publico/paginas/panel-docente.html');
  const rutaCss = path.join(raiz, 'publico/css/modulos/panel-docente.css');
  const rutaJs = path.join(raiz, 'publico/js/modulos/panel-docente.js');

  assert.ok(fs.existsSync(rutaHtml), 'panel-docente.html debe existir');
  assert.ok(fs.existsSync(rutaCss), 'panel-docente.css debe existir');
  assert.ok(fs.existsSync(rutaJs), 'panel-docente.js debe existir');

  const html = fs.readFileSync(rutaHtml, 'utf8');
  assert.ok(html.includes('/css/tokens.css'), 'Debe enlazar tokens.css');
  assert.ok(html.includes('/css/base.css'), 'Debe enlazar base.css');
  assert.ok(html.includes('/css/componentes.css'), 'Debe enlazar componentes.css');
  assert.ok(html.includes('/css/modulos/panel-docente.css'), 'Debe enlazar panel-docente.css');
  assert.ok(html.includes('chart'), 'Debe incluir script de Chart.js');
  assert.ok(html.includes('/js/modulos/panel-docente.js'), 'Debe cargar panel-docente.js');
});

test('2. menu.js · Contiene el enlace a Panel docente para docente y admin', () => {
  const item = MENU.find(m => m.href === '/paginas/panel-docente.html');
  assert.ok(item, 'MENU debe contener un elemento con href /paginas/panel-docente.html');
  assert.equal(item.texto, 'Panel docente');
  assert.deepEqual(item.roles, ['docente', 'admin']);
});

test('3. panel-docente.js · Lógica de ordenamiento y generación de CSV', () => {
  const estudiantesMock = [
    { id: 'est_2', nombre: 'Carlos', apellido: 'Zapata', promedio: 6.5, actividades: 3, pctTemas: 40, ultimaConexion: '2026-10-20T10:00:00Z', alertasActivas: 2 },
    { id: 'est_1', nombre: 'Ana', apellido: 'Alvarado', promedio: 9.0, actividades: 8, pctTemas: 90, ultimaConexion: '2026-10-25T12:00:00Z', alertasActivas: 0 }
  ];

  // Ordenar por nombre (apellido + nombre)
  const ordNombreAsc = ordenarEstudiantes(estudiantesMock, 'nombre', true);
  assert.equal(ordNombreAsc[0].id, 'est_1', 'Alvarado debe ir primero asc');
  const ordNombreDesc = ordenarEstudiantes(estudiantesMock, 'nombre', false);
  assert.equal(ordNombreDesc[0].id, 'est_2', 'Zapata debe ir primero desc');

  // Ordenar por promedio
  const ordPromDesc = ordenarEstudiantes(estudiantesMock, 'promedio', false);
  assert.equal(ordPromDesc[0].id, 'est_1', 'Promedio 9.0 debe ir primero desc');

  // Ordenar por alertas
  const ordAlertasDesc = ordenarEstudiantes(estudiantesMock, 'alertas', false);
  assert.equal(ordAlertasDesc[0].id, 'est_2', 'Mayor número de alertas primero desc');

  // Generación de CSV: separador punto y coma, BOM UTF-8
  const { contenido, nombreArchivo } = generarCSV({ id: 'dis_prueba' }, estudiantesMock);
  assert.ok(contenido.startsWith('\uFEFF'), 'Debe empezar con BOM UTF-8');
  assert.ok(contenido.includes(';'), 'Debe usar punto y coma como separador');
  assert.ok(contenido.includes('ID;Nombre;Apellido;Promedio;Actividades;% Temas Revisados;Última Conexión;Alertas Activas'));
  assert.ok(contenido.includes('"Alvarado"'));
  assert.ok(contenido.includes('"Zapata"'));
  assert.equal(nombreArchivo, 'resumen-grupo-dis_prueba.csv');
});

test('4. panel-docente.js y css · Integridad de componentes, modal y alertas', () => {
  const js = fs.readFileSync(path.join(raiz, 'publico/js/modulos/panel-docente.js'), 'utf8');
  const css = fs.readFileSync(path.join(raiz, 'publico/css/modulos/panel-docente.css'), 'utf8');

  // Roles exigidos
  assert.ok(js.includes('roles: ["docente", "admin"]') || js.includes("roles: ['docente', 'admin']"));

  // Rutas y llamadas
  assert.ok(js.includes('/api/resumen/grupo/'), 'Debe consultar resumen de grupo');
  assert.ok(js.includes('/api/resumen/estudiante/'), 'Debe consultar resumen de estudiante');
  assert.ok(js.includes('distributivo'), 'Debe listar distributivo');
  assert.ok(js.includes('btn-exportar-csv'), 'Debe incluir botón de exportar CSV');
  assert.ok(js.includes('fila--alerta'), 'Debe aplicar clase fila--alerta a filas con alertas');

  // CSS de alertas y ordenamiento
  assert.ok(css.includes('.fila--alerta'), 'CSS debe definir .fila--alerta');
  assert.ok(css.includes('.th-ordenable'), 'CSS debe definir .th-ordenable');
  assert.ok(css.includes('var(--color-primario)'), 'CSS debe usar variables de color');
});
