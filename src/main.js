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

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
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
    autoHideMenuBar: true,   // sin barra de menú; Alt tampoco la reaparece
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

  // ── Atajos de teclado sin barra de menú ────────────────────────────
  // La barra Archivo/Ver/Ayuda se eliminó: duplicaba el menú de la propia
  // aplicación y sus entradas no hacían nada que BioSim no haga ya. Pero
  // en Electron los atajos de recarga, zoom, pantalla completa y
  // herramientas de desarrollo venían DE ese menú, así que al quitarlo se
  // habrían perdido también. Se registran aquí para conservarlos.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const k = (input.key || '').toLowerCase();
    const wc = win.webContents;
    const acciones = {
      'f12':          () => wc.toggleDevTools(),
      'f11':          () => win.setFullScreen(!win.isFullScreen()),
      'ctrl+r':       () => wc.reload(),
      'ctrl+shift+r': () => wc.reloadIgnoringCache(),
      'ctrl+shift+i': () => wc.toggleDevTools(),
      'ctrl+0':       () => wc.setZoomLevel(0),
      'ctrl++':       () => wc.setZoomLevel(Math.min(5, wc.getZoomLevel() + 0.5)),
      'ctrl+=':       () => wc.setZoomLevel(Math.min(5, wc.getZoomLevel() + 0.5)),
      'ctrl+-':       () => wc.setZoomLevel(Math.max(-5, wc.getZoomLevel() - 0.5))
    };
    const clave = ctrl ? ('ctrl+' + (input.shift ? 'shift+' : '') + k) : k;
    const fn = acciones[clave];
    if (fn) { e.preventDefault(); fn(); }
  });

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

// ══════════════════════════════════════════════════════════════════════
//  Archivos de proyecto (.bio)
//
//  La página no puede escribir en el disco por su cuenta, y la File
//  System Access API del navegador —que sería la vía natural— no está
//  disponible sobre file://, que es como se carga la aplicación aquí.
//  Estos manejadores son los que permiten que el botón Guardar
//  sobrescriba el archivo sin volver a preguntar la ubicación.
//
//  Solo se aceptan rutas con extensión .bio: el renderer no debe poder
//  pedir la escritura de un ejecutable o de un archivo de sistema.
// ══════════════════════════════════════════════════════════════════════
const FILTRO_BIO = [{ name: 'Proyecto BioSim', extensions: ['bio'] }];

function rutaValida(ruta) {
  return typeof ruta === 'string' && ruta.length > 0 && /\.bio$/i.test(ruta);
}

function escribir(ruta, texto) {
  // Escritura en dos tiempos: primero a un temporal junto al destino y
  // después un rename atómico. Si la aplicación muere a mitad de la
  // escritura, el proyecto anterior sigue intacto en vez de quedar
  // truncado — y un .bio truncado es trabajo perdido.
  const tmp = ruta + '.tmp';
  fs.writeFileSync(tmp, texto, 'utf8');
  fs.renameSync(tmp, ruta);
  return { ok: true, ruta, nombre: path.basename(ruta) };
}

ipcMain.handle('biosim:guardar', (evt, { ruta, texto }) => {
  try {
    if (!rutaValida(ruta)) return { ok: false, error: 'Ruta de proyecto no válida.' };
    if (typeof texto !== 'string') return { ok: false, error: 'Contenido no válido.' };
    return escribir(ruta, texto);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('biosim:guardarComo', async (evt, { nombreSugerido, texto }) => {
  try {
    if (typeof texto !== 'string') return { ok: false, error: 'Contenido no válido.' };
    const win = BrowserWindow.fromWebContents(evt.sender);
    const r = await dialog.showSaveDialog(win, {
      title: 'Guardar proyecto BioSim',
      defaultPath: nombreSugerido || 'biosim_proyecto.bio',
      filters: FILTRO_BIO,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });
    if (r.canceled || !r.filePath) return { ok: false, cancelado: true };
    const ruta = /\.bio$/i.test(r.filePath) ? r.filePath : r.filePath + '.bio';
    return escribir(ruta, texto);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('biosim:abrir', async (evt) => {
  try {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Abrir proyecto BioSim',
      filters: FILTRO_BIO,
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return { ok: false, cancelado: true };
    const ruta = r.filePaths[0];
    const texto = fs.readFileSync(ruta, 'utf8');
    return { ok: true, ruta, nombre: path.basename(ruta), texto };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('biosim:diagnostico', () => {
  const gpu = app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : {};
  return {
    html: APP_HTML || '(ninguno)',
    version: APP_VERSION,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    webgl: gpu.webgl || 'desconocido',
    canvas2d: gpu['2d_canvas'] || 'desconocido'
  };
});

// ══════════════════════════════════════════════════════════════════════
//  Sin barra de menú
//
//  Hasta v12.8 había una barra nativa Archivo / Ver / Ayuda. Se eliminó
//  por petición de uso: no hacía nada que la aplicación no haga ya por su
//  cuenta —BioSim tiene su propio menú Archivo, su propio Acerca de y su
//  propio manual— y tener dos barras de menú apiladas, una encima de la
//  otra y con los mismos nombres, confundía más de lo que ayudaba.
//
//  Lo que SÍ aportaba se conservó en otro sitio:
//    · recargar, zoom, pantalla completa y herramientas de desarrollo →
//      atajos de teclado registrados en before-input-event;
//    · el Diagnóstico de GPU/WebGL → expuesto por el preload y accesible
//      desde el menú Ayuda de la propia aplicación.
// ══════════════════════════════════════════════════════════════════════
function quitarMenu() {
  Menu.setApplicationMenu(null);
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

  quitarMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
