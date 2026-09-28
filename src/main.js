// ════════════════════════════════════════════════════════════════════
//  BioSim — proceso principal de Electron
//  Envuelve la aplicación HTML autocontenida en una ventana de escritorio.
//  Electron empaqueta su propio Chromium, así que NO depende de WebView2
//  ni de ningún runtime preinstalado: corre en cualquier Windows 10+ x64.
//
//  v7.2.1 — CAMBIOS FRENTE A LA VERSIÓN ANTERIOR
//   1. La ruta del HTML ya NO está escrita a mano. Se descubre en tiempo
//      de ejecución cualquier archivo «BioSim*.html» de la raíz. Así,
//      renombrar o subir una versión nueva del simulador nunca vuelve a
//      romper el ejecutable.
//   2. Si no se encuentra ningún HTML, se muestra un diálogo explícito en
//      vez de una ventana en blanco.
//   3. Se añaden los switches de GPU: sin ellos, Chromium moderno se niega
//      a crear contexto WebGL en equipos sin GPU compatible y BioSim se
//      queda sin visor 3D ni geometría.
// ════════════════════════════════════════════════════════════════════
'use strict';

const { app, BrowserWindow, Menu, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// v8.0 — Icono de la ventana. electron-builder incrusta build/icon.ico en el
// .exe y lo usa en el instalador, pero la VENTANA usa este otro: sin él,
// Windows muestra el icono por defecto de Electron en la barra de tareas
// durante la ejecución. Se busca junto al código y en resources/ para que
// funcione tanto en desarrollo como empaquetado.
function findIcon(){
  const cands = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico')
  ];
  for(const c of cands){ try{ if(fs.existsSync(c)) return c; }catch(e){} }
  return null;
}
const ICON_PATH = findIcon();

// ── GPU / WebGL ──────────────────────────────────────────────────────
// BioSim es una app Three.js: sin WebGL no hay nada que mostrar. Estos
// switches permiten usar GPUs que Chromium tiene en lista negra y, como
// último recurso, caer al renderizador por software (SwiftShader), que
// desde Chromium 136 ya no se activa solo.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// ── Localización del HTML de la aplicación ───────────────────────────
const ROOT = path.join(__dirname, '..');

function findAppHtml() {
  // 1) Nombre canónico, si existe.
  const canonical = path.join(ROOT, 'BioSim.html');
  if (fs.existsSync(canonical)) return canonical;

  // 2) Cualquier BioSim*.html; si hay varios, el de nombre mayor
  //    (BioSim_v7_2 gana a BioSim_v6_8) para no servir una versión vieja.
  let files = [];
  try {
    files = fs.readdirSync(ROOT).filter(f => /^BioSim.*\.html$/i.test(f));
  } catch (e) { /* directorio ilegible */ }

  if (files.length === 0) return null;
  files.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
  return path.join(ROOT, files[0]);
}

const APP_HTML = findAppHtml();
const APP_VERSION = app.getVersion();

// Una sola instancia (evita abrir varias ventanas si se relanza el .exe)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0d2145',   // v8.0: azul del logo, evita el fogonazo blanco al abrir
    title: 'BioSim ' + APP_VERSION,
    icon: ICON_PATH || undefined,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // BioSim es una app de navegador pura y autocontenida: no necesita
      // acceso a Node, por lo que se mantienen los valores seguros por defecto.
      backgroundThrottling: false   // no frenar la simulación si la ventana pierde foco
    }
  });

  win.once('ready-to-show', () => win.show());

  // Si la carga del archivo falla, decirlo en vez de dejar la ventana muda.
  win.webContents.on('did-fail-load', (e, code, desc, url) => {
    dialog.showErrorBox(
      'No se pudo cargar BioSim',
      'Fallo al abrir:\n' + url + '\n\nCódigo ' + code + ': ' + desc
    );
  });

  win.loadFile(APP_HTML);

  // ── Manejo de ventanas emergentes ──────────────────────────────────
  // El generador de informe PDF de BioSim usa window.open('') +
  // document.write() + window.print(). Hay que permitir ese popup en
  // blanco. Cualquier enlace http(s) real (no debería haber, es zero-CDN)
  // se abre en el navegador del sistema, nunca dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === '' || url === 'about:blank' || url.startsWith('about:')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 900,
          height: 1000,
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
        }
      };
    }
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Bloquear navegación fuera del archivo local (la app no navega a ningún
  // sitio; esto evita que un enlace accidental saque al usuario de BioSim).
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  return win;
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Diagnóstico',
          click: () => {
            const gpu = app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : {};
            dialog.showMessageBox({
              type: 'info',
              title: 'Diagnóstico de BioSim',
              message: 'Estado del entorno',
              detail:
                'HTML cargado:\n' + (APP_HTML || '(ninguno)') + '\n\n' +
                'Electron ' + process.versions.electron +
                ' · Chromium ' + process.versions.chrome + '\n\n' +
                'WebGL: ' + (gpu.webgl || 'desconocido') + '\n' +
                'Aceleración 2D: ' + (gpu['2d_canvas'] || 'desconocido'),
              buttons: ['Cerrar']
            });
          }
        },
        {
          label: 'Acerca de BioSim',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Acerca de BioSim',
              message: 'BioSim ' + APP_VERSION,
              icon: ICON_PATH ? nativeImage.createFromPath(ICON_PATH) : undefined,
              detail:
                'Simulador bioclimático autocontenido.\n' +
                'Universidad de San Buenaventura — Pasto.\n\n' +
                'Motor: Three.js r128 + Chart.js 4.4 (embebidos).\n' +
                'Empaquetado de escritorio: Electron ' + process.versions.electron + '.',
              buttons: ['Cerrar']
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  if (!APP_HTML) {
    dialog.showErrorBox(
      'BioSim — archivo de aplicación no encontrado',
      'No se encontró ningún archivo «BioSim*.html» junto al ejecutable.\n\n' +
      'Buscado en:\n' + ROOT + '\n\n' +
      'Revisa la lista "files" de package.json: debe incluir el HTML que ' +
      'realmente está en el repositorio.'
    );
    app.quit();
    return;
  }

  buildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
