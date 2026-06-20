// ════════════════════════════════════════════════════════════════════
//  BioSim — proceso principal de Electron
//  Envuelve la aplicación HTML autocontenida (app/BioSim_v6_8.html) en
//  una ventana de escritorio. Electron empaqueta su propio Chromium, así
//  que NO depende de WebView2 ni de ningún runtime preinstalado: corre en
//  cualquier Windows 10+ x64 tal cual.
// ════════════════════════════════════════════════════════════════════
'use strict';

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

const APP_HTML = path.join(__dirname, '..', 'BioSim_v6_8.html');
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
    backgroundColor: '#f0f2f6',
    title: 'BioSim ' + APP_VERSION,
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
          label: 'Acerca de BioSim',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Acerca de BioSim',
              message: 'BioSim ' + APP_VERSION,
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
  buildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
