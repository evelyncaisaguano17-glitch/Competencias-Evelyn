// publico/js/modulos/privacidad.js · Aviso de privacidad conforme a la LOPDP del Ecuador
import { montarPlantilla } from "../nucleo/plantilla.js";

await montarPlantilla({ titulo: "Aviso de Privacidad", roles: ["publico"] });

const contenido = document.getElementById("contenido");
if (contenido) {
  contenido.innerHTML = `
    <article class="tarjeta privacidad-tarjeta pila">
      <header>
        <h1>Aviso de Privacidad y Protección de Datos</h1>
        <p class="color-texto-suave">Ecosistema Educativo Digital · República del Ecuador</p>
      </header>

      <section class="privacidad-seccion">
        <h2>1. Finalidad del tratamiento</h2>
        <p>
          Los datos personales recopilados tienen como finalidad exclusiva la gestión académica, la autenticación y seguridad en la plataforma, el seguimiento pedagógico personalizado, la gamificación de actividades formativas y la emisión de reconocimientos o diplomas de competencias digitales.
        </p>
      </section>

      <section class="privacidad-seccion">
        <h2>2. Datos tratados</h2>
        <p>Tratamos únicamente los datos necesarios para brindar los servicios educativos:</p>
        <ul>
          <li><strong>Datos de identificación:</strong> Nombres y apellidos.</li>
          <li><strong>Datos de contacto:</strong> Correo electrónico institucional o personal.</li>
          <li><strong>Actividad en la plataforma:</strong> Registros de navegación, intentos en actividades, evaluaciones y participación en los módulos educativos.</li>
        </ul>
      </section>

      <section class="privacidad-seccion">
        <h2>3. Derechos de los titulares (LOPDP Ecuador)</h2>
        <p>
          De conformidad con la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador, los titulares tienen derecho a:
        </p>
        <ul>
          <li><strong>Acceso:</strong> Conocer los datos personales que reposan en nuestros registros.</li>
          <li><strong>Rectificación y actualización:</strong> Modificar información inexacta o desactualizada desde su perfil.</li>
          <li><strong>Eliminación:</strong> Solicitar la supresión de sus datos personales cuando hayan dejado de ser necesarios para la finalidad educativa informada.</li>
        </ul>
      </section>

      <section class="privacidad-seccion">
        <h2>4. Contacto</h2>
        <p>
          Para ejercer sus derechos o resolver dudas sobre este aviso, puede comunicarse con el responsable de privacidad a través de:
        </p>
        <p>
          <a href="mailto:privacidad@ecosistemaeducativo.ec" class="btn btn--secundario btn--pequeno">
            privacidad@ecosistemaeducativo.ec
          </a>
        </p>
      </section>

      <footer class="fila">
        <a href="/paginas/registro.html" class="btn btn--primario">Volver al Registro</a>
        <a href="/index.html" class="btn btn--texto">Ir al Inicio</a>
      </footer>
    </article>
  `;
}
