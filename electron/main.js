const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');

const IS_SMOKE_TEST = process.argv.includes('--smoke-test');
const PREFERRED_PORT = Number(process.env.WAVESPEED_ELECTRON_PORT || 38442);

// Configure writable data & outputs paths BEFORE loading server.js so
// Program Files installation never causes read-only EACCES/EPERM errors.
const appRoot = path.resolve(__dirname, '..');
const unpackedPublic = path.join(path.dirname(appRoot), 'app.asar.unpacked', 'public');
process.env.WAVESPEED_RESOURCES_DIR = appRoot;
process.env.WAVESPEED_PUBLIC_DIR = fs.existsSync(unpackedPublic)
  ? unpackedPublic
  : path.join(appRoot, 'public');
if (!process.env.WAVESPEED_USER_DATA_DIR) {
  process.env.WAVESPEED_USER_DATA_DIR = app.getPath('userData');
}
if (!process.env.WAVESPEED_OUTPUTS_DIR) {
  process.env.WAVESPEED_OUTPUTS_DIR = path.join(app.getPath('documents'), 'WaveSpeed Studio', 'outputs');
}

const { startServer, stopServer, getOutputsDir, USER_DATA_DIR } = require('../server');

let mainWindow = null;
let serverUrl = null;
let serverStopCalled = false;

const gotLock = IS_SMOKE_TEST ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function getWindowIconPath() {
  const pngPath = path.join(appRoot, 'assets', 'icon.png');
  const icoPath = path.join(appRoot, 'assets', 'icon.ico');
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(icoPath)) return icoPath;
  return undefined;
}

function buildAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Outputs Folder',
          click: () => shell.openPath(getOutputsDir())
        },
        {
          label: 'Open App Data Folder',
          click: () => shell.openPath(USER_DATA_DIR)
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Get WaveSpeed API Key',
          click: () => shell.openExternal('https://wavespeed.ai/accesskey')
        },
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/Cameldroid/wavespeed-studio')
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'WaveSpeed Studio',
    backgroundColor: '#0b0f19',
    icon: getWindowIconPath(),
    show: !IS_SMOKE_TEST,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Route external browser links (like https://wavespeed.ai/accesskey) to default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl)) {
      if (serverUrl && targetUrl.startsWith(serverUrl + '/outputs/')) {
        shell.openPath(getOutputsDir());
      } else {
        shell.openExternal(targetUrl);
      }
    }
    return { action: 'deny' };
  });

  // Prevent unintended full-page navigation away from the studio SPA
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (serverUrl && targetUrl.startsWith(serverUrl)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(targetUrl)) {
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    ipcMain.handle('studio:select-outputs-folder', async (_event, currentDir) => {
      const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      const result = await dialog.showOpenDialog(targetWindow, {
        title: 'Select Outputs Save Folder',
        defaultPath: (typeof currentDir === 'string' && currentDir.trim()) ? currentDir.trim() : getOutputsDir(),
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }
      return { canceled: false, path: result.filePaths[0] };
    });

    buildAppMenu();
    const { port } = await startServer({
      host: '127.0.0.1',
      port: IS_SMOKE_TEST ? 0 : PREFERRED_PORT,
      fallbackEphemeral: true
    });
    serverUrl = `http://127.0.0.1:${port}`;
    createWindow(serverUrl);

    if (IS_SMOKE_TEST && mainWindow) {
      mainWindow.webContents.once('did-finish-load', async () => {
        try {
          const resp = await fetch(`${serverUrl}/api/config`);
          const cfg = await resp.json();
          const title = mainWindow.getTitle();
          console.log(`[ELECTRON_SMOKE_OK] port=${port} title="${title}" outputsDir="${cfg.outputsDir}"`);
          await shutdownCleanly();
          app.exit(0);
        } catch (err) {
          console.error('[ELECTRON_SMOKE_FAILED]', err);
          await shutdownCleanly();
          app.exit(1);
        }
      });
    }
  } catch (err) {
    dialog.showErrorBox('WaveSpeed Studio Startup Error', err.message || String(err));
    app.quit();
  }
});

async function shutdownCleanly() {
  if (serverStopCalled) return;
  serverStopCalled = true;
  try {
    await stopServer();
  } catch (e) {}
}

app.on('before-quit', async (event) => {
  if (!serverStopCalled) {
    event.preventDefault();
    await shutdownCleanly();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
