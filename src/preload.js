// ════════════════════════════════════════════════════════════════════
//  BioSim — preload
//
//  Único puente entre la página y el proceso principal. Existe para una
//  sola cosa: que el botón Guardar pueda SOBRESCRIBIR el archivo del
//  proyecto sin abrir un diálogo cada vez.
//
//  Por qué hace falta. BioSim es una página web autocontenida, y una
//  página no puede escribir en una ruta del disco por su cuenta. La
//  File System Access API del navegador lo permite guardando un handle,
//  pero no funciona sobre file://, que es justo como Electron carga la
//  aplicación. Sin este puente, cada guardado tendría que pasar por el
//  diálogo del sistema.
//
//  Se expone lo mínimo: tres operaciones sobre archivos de proyecto y un
//  diagnóstico de entorno. No se expone `require`, ni `fs`, ni
//  `ipcRenderer` en crudo. contextIsolation y sandbox siguen activos.
// ════════════════════════════════════════════════════════════════════
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('biosimFS', {
  // Marca de que estamos dentro de la app de escritorio. La página la
  // comprueba para decidir si puede sobrescribir en silencio o si tiene
  // que recurrir a la File System Access API o a la descarga.
  disponible: true,

  // Sobrescribe una ruta ya conocida. Sin diálogo.
  // → { ok:true, ruta, nombre } | { ok:false, error }
  guardar: (ruta, texto) => ipcRenderer.invoke('biosim:guardar', { ruta, texto }),

  // Pide ubicación y guarda. Devuelve la ruta elegida para que la página
  // la recuerde y los siguientes guardados ya no pregunten.
  // → { ok:true, ruta, nombre } | { ok:false, cancelado:true } | { ok:false, error }
  guardarComo: (nombreSugerido, texto) =>
    ipcRenderer.invoke('biosim:guardarComo', { nombreSugerido, texto }),

  // Abre un .bio y devuelve su contenido Y su ruta, para que el primer
  // Ctrl+S después de abrir ya sobrescriba el archivo de origen.
  // → { ok:true, ruta, nombre, texto } | { ok:false, cancelado:true } | { ok:false, error }
  abrir: () => ipcRenderer.invoke('biosim:abrir'),

  // Estado de GPU/WebGL y rutas. Sustituye al «Diagnóstico» que vivía en
  // el menú nativo, ahora accesible desde el menú Ayuda de la propia app.
  diagnostico: () => ipcRenderer.invoke('biosim:diagnostico')
});
