const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('paretoAISettings', {
  get: () => ipcRenderer.invoke('ai-settings:get'),
  save: settings => ipcRenderer.invoke('ai-settings:save', settings),
  reset: () => ipcRenderer.invoke('ai-settings:reset'),
});
