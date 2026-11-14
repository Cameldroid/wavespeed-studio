const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('waveSpeedDesktop', {
  isElectron: true,
  platform: process.platform
});
