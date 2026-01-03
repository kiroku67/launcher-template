const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  authenticate: (token) => ipcRenderer.invoke('authenticate', token),
  uploadMod: (modData) => ipcRenderer.invoke('upload-mod', modData),
  deleteMod: (modPath) => ipcRenderer.invoke('delete-mod', modPath),
  listMods: () => ipcRenderer.invoke('list-mods')
});
