const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waveSpeedDesktop', {
  isElectron: true,
  platform: process.platform,
  selectOutputsFolder: (currentDir) => ipcRenderer.invoke('studio:select-outputs-folder', currentDir)
});
