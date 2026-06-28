# ▶️ CONTINUAR AQUÍ — Guía para mudar el proyecto y compilar la Build Local

Este documento guía al nuevo agente para mudar el proyecto a una ruta limpia (sin espacios ni tildes) y realizar la compilación local (`eas build --local`) de la versión de producción de **Kuanto** (Android `.aab` de producción).

## ⚠️ Estado actual
Todo el código está **completamente listo, verificado y subido a GitHub (rama `main`)**.
* Se implementó el botón para compartir tasas históricas desde el calendario.
* Se integró `expo-store-review` para calificación integrada (con bypass en Expo Go y redirección a Play Store como fallback).
* Se creó `.easignore` para permitir que el compilador local o en EAS suba `google-services.json` sin tener que trackearlo en Git.

## 📋 Pasos para mudar el proyecto y compilar localmente

Sigue estos pasos en la nueva conversación desde la carpeta con la ruta limpia (por ejemplo, `C:\dev\kuanto`):

### Paso 1: Configurar la carpeta limpia
Elige una de las siguientes opciones:

* **Opción A (Copiar la carpeta completa — RECOMENDADA):**
  Copia toda la carpeta `Kuanto new try` y pégala en la nueva ubicación limpia (por ejemplo, `C:\dev\kuanto`). Al copiar la carpeta completa, **se trasladarán automáticamente los archivos secretos/ignorados por Git** (`.env`, `*.keystore`, `google-services.json`, etc.), por lo que no tendrás que realizar el Paso 2.
* **Opción B (Clonar desde Git):**
  Si prefieres hacer un clon limpio desde GitHub, abre la terminal en la carpeta limpia y ejecuta:
  ```bash
  git clone https://github.com/Aleneytor/kuanto-rn .
  # O si ya la tenías inicializada:
  git pull origin main
  ```

### Paso 2: Copiar archivos sensibles ignorados (Solo para Opción B)
Si elegiste clonar desde Git (Opción B), debes copiar manualmente desde la ruta vieja (`C:\Users\Alejandro Pérez\Documents\Apps\Kuanto new try` o de la carpeta de respaldos `C:\Users\Alejandro Pérez\Documents\Kuanto-CLAVES-RESPALDO\`) los siguientes archivos a la raíz de tu nueva carpeta limpia:
* `.env` (credenciales públicas de Supabase)
* `google-services.json` (configuración de Firebase para notificaciones Android)
* `kuanto-upload.keystore` (clave de subida para firmar el build de producción)
* `kuanto-d73e7-firebase-adminsdk-fbsvc-bd10e22a43.json` (service account para credenciales EAS)

### Paso 3: Instalar dependencias
Instala todas las dependencias (incluyendo la nueva `expo-store-review`):
```bash
npm install
```

### Paso 4: Ejecutar Typecheck y verificación
Asegúrate de que todo siga compilando sin errores de tipos:
```bash
npm run typecheck
```

### Paso 5: Lanzar la compilación local
Ejecuta el comando para construir la versión final firmada en tu máquina local (evitando las colas de la nube de EAS):
```bash
eas build --local -p android --profile production
```
*Esto generará el archivo `.aab` final de producción en tu disco duro listo para subir a la Play Console.*

---

## 🔑 Firma, EAS y Credenciales
* **EAS projectId:** `3b9fa157-395c-47fd-bf5d-66b44aa51d5f`
* **EAS owner:** `aoraestudio` (ya configurado en `app.json`)
* **Package Name:** `com.aleneytor.app` (versionCode `17` ya configurado, superior al `16` anterior)
* **Clave de subida (Keystore):** `kuanto-upload.keystore`
  * **Contraseña:** `KuantoUpload2026!`
  * **Alias:** `kuanto-upload`
  * *Nota:* El reset de claves de subida en Google Play entró en vigencia el **19 de junio de 2026**, por lo que esta clave ya es válida para firmar y subir actualizaciones.
* **Respaldo de Claves:** `C:\Users\Alejandro Pérez\Documents\Kuanto-CLAVES-RESPALDO\`
