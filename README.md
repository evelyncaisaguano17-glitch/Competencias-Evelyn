# Ecosistema Educativo Digital

Plataforma web educativa para el desarrollo y evaluación de competencias digitales.

## Requisitos previos

- Node.js 20 o superior (versión LTS recomendada).
  - Verificar versión: `node -v` y `npm -v`
  - Descarga disponible en: [https://nodejs.org/](https://nodejs.org/)

## Instalación y puesta en marcha

1. Instalar dependencias del proyecto:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.ejemplo .env
   # O en Unix/macOS:
   cp .env.ejemplo .env
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```

El servidor quedará disponible en `http://localhost:3000`.
