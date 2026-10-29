// publico/js/nucleo/menu.js · Menú de navegación principal con filtrado por rol
export const MENU = [
  { texto: "Inicio", href: "/index.html", roles: ["publico"] },
  { texto: "Mi perfil", href: "/paginas/perfil.html", roles: ["sesion"] },
  { texto: "Usuarios", href: "/paginas/admin-usuarios.html", roles: ["admin"] },
  { texto: "Asignaturas", href: "/paginas/admin-asignaturas.html", roles: ["admin"] },
  { texto: "Distributivo", href: "/paginas/distributivo.html", roles: ["admin"] },
  { texto: "Contenidos", href: "/paginas/editor-contenidos.html", roles: ["docente", "admin"] },
  { texto: "Mis asignaturas", href: "/paginas/asignaturas.html", roles: ["estudiante", "docente"] },
  { texto: "Actividades", href: "/paginas/actividades.html", roles: ["estudiante", "docente"] },
  { texto: "Noticias", href: "/paginas/noticias.html", roles: ["sesion"] },
  { texto: "Canciones", href: "/paginas/canciones.html", roles: ["sesion"] },
  { texto: "Mi progreso", href: "/paginas/mi-progreso.html", roles: ["estudiante"] },
  { texto: "Panel docente", href: "/paginas/panel-docente.html", roles: ["docente", "admin"] },
  { texto: "Banco de preguntas", href: "/paginas/banco-preguntas.html", roles: ["docente", "admin"] }
];



export default MENU;
