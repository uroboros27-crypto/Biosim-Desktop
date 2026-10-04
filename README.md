# BioSim — Aplicación de escritorio para Windows

Empaqueta el simulador bioclimático **BioSim v6.8** (un único HTML autocontenido)
como aplicación nativa de Windows usando **Electron**.

Electron incluye su propio motor Chromium, por lo que el `.exe` resultante
**no depende de WebView2 ni de ningún runtime preinstalado**: funciona en
cualquier **Windows 10 o superior, x64**, tal cual.

---

## Estructura

```
biosim-desktop/
├─ app/
│  └─ BioSim_v6_8.html         ← la aplicación (intacta, zero-CDN)
├─ src/
│  └─ main.js                  ← proceso principal de Electron (la ventana)
├─ build/
│  ├─ icon.ico                 ← icono de la app
│  └─ icon.png
├─ .github/workflows/
│  └─ build-windows.yml        ← compilación automática en GitHub
├─ package.json                ← configuración de electron-builder
└─ .gitignore
```

---

## Compilar en GitHub (recomendado)

No necesitas instalar nada en tu equipo. Igual que con DaylightApp:

1. Crea un repositorio en GitHub y sube esta carpeta.
2. **Opción A — manual:** entra a la pestaña **Actions → "Build Windows" → Run workflow**.
3. **Opción B — por versión:** crea una etiqueta y empújala:
   ```bash
   git tag v6.8.0
   git push origin v6.8.0
   ```
   Esto compila *y* publica un **Release** con los `.exe` adjuntos.
4. Al terminar, descarga los artefactos desde la corrida de Actions (o desde el Release):
   - **`BioSim-6.8.0-portable.exe`** → ejecutable portátil, **se abre sin instalar** (cumple tu requisito).
   - **`BioSim-6.8.0-setup.exe`** → instalador clásico (permite elegir carpeta, crea acceso directo).

Ambos llevan Chromium embebido; pesan ~150–200 MB, como era de esperar para esta opción.

---

## Probar/compilar localmente (opcional)

Requiere [Node.js](https://nodejs.org) 18+ instalado.

```bash
npm install        # instala Electron + electron-builder
npm start          # abre BioSim en una ventana (modo desarrollo)
npm run dist       # genera dist/BioSim-*.exe (portable + instalador)
```

---

## Actualizar BioSim

Para subir a una versión futura del simulador, **reemplaza
`app/BioSim_v6_8.html`** por el HTML nuevo (ajustando la ruta en
`src/main.js` si cambia el nombre) y sube la versión en `package.json`.
El resto del andamiaje no cambia.

---

## Notas

- **Guardado de archivos** (.bio, CSV, PNG, informe PDF): BioSim detecta que
  corre sobre `file://` y usa su descarga de respaldo; Electron muestra el
  diálogo nativo **"Guardar como"**. Funciona sin configuración extra.
- **Informe PDF**: usa una ventana emergente + impresión; `main.js` ya la
  permite y abre el diálogo de impresión de Chromium.
- **Sin telemetría ni red**: la app es 100% offline (zero-CDN). `main.js`
  bloquea cualquier navegación fuera del archivo local por seguridad.
- **Lectura de EPW/OBJ/.bio**: el selector de archivos nativo funciona igual
  que en el navegador.

---

## Firma de código (opcional, más adelante)

El `.exe` sin firmar mostrará el aviso "SmartScreen" de Windows la primera
vez. Para evitarlo se necesita un certificado de firma de código (Authenticode);
electron-builder lo soporta vía `win.signtoolOptions` o Azure Trusted Signing.
No es necesario para uso interno/académico.
