# BioSim — Aplicación de escritorio para Windows

Empaqueta el simulador bioclimático **BioSim v8.0** (un único HTML autocontenido,
zero-CDN) como aplicación nativa de Windows usando **Electron**.

Electron incluye su propio Chromium, así que el `.exe` **no depende de WebView2
ni de ningún runtime preinstalado**: funciona en cualquier **Windows 10+ x64**.

---

## Estructura

```
Biosim-Desktop/
├─ BioSim.html                 ← la aplicación (autocontenida, sin recursos externos)
├─ src/
│  └─ main.js                  ← proceso principal de Electron (la ventana)
├─ build/
│  └─ icon.ico                 ← icono (.exe, instalador y ventana)
├─ .github/workflows/
│  └─ build-windows.yml        ← compilación automática en GitHub
├─ package.json                ← configuración de electron-builder
└─ .gitignore
```

---

## Compilar en GitHub (recomendado)

1. **Versión estable:** sube la versión en `package.json` y empuja una etiqueta:
   ```bash
   git tag v8.0.1
   git push origin v8.0.1
   ```
   Compila y publica un **Release** con los `.exe` adjuntos.
2. **Build de prueba:** Actions → "Build Windows" → *Run workflow*. Publica un
   pre-release con la etiqueta fija `dev-build`, que se sobrescribe en cada corrida.

Binarios generados:
- **`BioSim-<versión>-portable.exe`** → se abre sin instalar.
- **`BioSim-<versión>-setup.exe`** → instalador (elige carpeta, crea accesos directos).

No se usan *artifacts* de Actions: consumían la cuota de 500 MB del plan gratuito.
Los binarios de un Release no cuentan para esa cuota.

---

## Probar/compilar localmente (opcional)

Requiere [Node.js](https://nodejs.org) 18+.

```bash
npm install        # instala Electron + electron-builder
npm start          # abre BioSim en una ventana (modo desarrollo)
npm run dist       # genera dist/BioSim-*.exe (portable + instalador)
```

---

## Actualizar BioSim

1. Reemplaza `BioSim.html` por la versión nueva **conservando ese nombre**.
2. Sube `version` en `package.json` (es la que aparece en el título de la ventana
   y en el nombre de los `.exe`).
3. Crea la etiqueta `v<versión>` y empújala.

El workflow falla con un mensaje claro si falta el HTML, si este referencia
recursos externos, o si el icono no quedó dentro del paquete.

---

## Icono

`build/icon.ico` (16–256 px) se usa de dos formas:
- electron-builder lo **incrusta** en el `.exe` y en el instalador (`win.icon`).
- Se copia a `resources/icon.ico` mediante `extraResources` para que la
  **ventana** lo use en tiempo de ejecución. Esto es necesario porque
  electron-builder no empaqueta la carpeta `build/` (`buildResources`).

Si Windows sigue mostrando un icono viejo tras actualizar, es la caché de
iconos del Explorador, no la app.

---

## Notas

- **Guardado de archivos** (.bio, CSV, PNG): BioSim detecta `file://` y usa su
  descarga de respaldo; Electron muestra el diálogo nativo "Guardar como".
- **Informe PDF**: usa ventana emergente + impresión; `main.js` la permite.
- **Sin red**: la app es 100% offline. `main.js` bloquea cualquier navegación
  fuera del archivo local.
- **WebGL**: `main.js` activa `ignore-gpu-blocklist` y SwiftShader como respaldo
  para equipos sin GPU compatible. *Ayuda → Diagnóstico* muestra el estado.

---

## Firma de código (opcional)

El `.exe` sin firmar muestra el aviso SmartScreen la primera vez. Para evitarlo
hace falta un certificado Authenticode (`win.signtoolOptions` o Azure Trusted
Signing en electron-builder). No es necesario para uso interno/académico.
