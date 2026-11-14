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

function readSoftwareGraphicsPref(userDataDir) {
  try {
    const cfgPath = path.join(userDataDir, '.studio-config.json');
    if (!fs.existsSync(cfgPath)) return false;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) || {};
    return Boolean(cfg.softwareGraphicsMode);
  } catch (e) {
    return false;
  }
}

// Mitigate Chromium D3D11VideoDecoder & Skia GPU-rasterization rainbow block corruption
// seen on hybrid/Intel iGPU drivers while keeping UI compositing responsive.
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-gpu-rasterization');
if (readSoftwareGraphicsPref(process.env.WAVESPEED_USER_DATA_DIR)) {
  app.disableHardwareAcceleration();
}

const { startServer, stopServer, getOutputsDir, saveStudioConfig, USER_DATA_DIR } = require('../server');

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

const RELEASES_URL = 'https://github.com/Cameldroid/wavespeed-studio/releases';
const LATEST_RELEASE_API = 'https://api.github.com/repos/Cameldroid/wavespeed-studio/releases/latest';

function isNewerVersion(latestTag, currentVersion) {
  const parse = (v) => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(latestTag);
  const b = parse(currentVersion);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

async function checkForUpdates() {
  const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  const currentVersion = app.getVersion();
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `WaveSpeed-Studio/${currentVersion}`
      }
    });
    if (!res.ok) {
      const choice = await dialog.showMessageBox(targetWindow, {
        type: 'info',
        title: 'Check for Updates',
        message: `Current version: v${currentVersion}`,
        detail: `Could not read public GitHub release metadata (HTTP ${res.status} — expected while the repository is Private). Open the Releases page in your signed-in browser to download the latest installer; it will automatically update your existing install folder and preserve your API key & database.`,
        buttons: ['Open Releases Page', 'Close'],
        defaultId: 0
      });
      if (choice.response === 0) shell.openExternal(RELEASES_URL);
      return;
    }
    const release = await res.json();
    const latestTag = release.tag_name || release.name || '';
    const releaseUrl = release.html_url || RELEASES_URL;
    if (isNewerVersion(latestTag, currentVersion)) {
      const choice = await dialog.showMessageBox(targetWindow, {
        type: 'info',
        title: 'Update Available',
        message: `WaveSpeed Studio ${latestTag} is available (you have v${currentVersion}).`,
        detail: 'Download and run the Setup .exe — it detects your existing installation folder automatically and keeps your API key, history database, and outputs intact.',
        buttons: ['Download Update', 'Later'],
        defaultId: 0
      });
      if (choice.response === 0) shell.openExternal(releaseUrl);
    } else {
      await dialog.showMessageBox(targetWindow, {
        type: 'info',
        title: 'Up to Date',
        message: `You are on the latest version (v${currentVersion}).`,
        detail: 'Running a newer Setup .exe from Releases will upgrade in place and preserve all local data.'
      });
    }
  } catch (err) {
    const choice = await dialog.showMessageBox(targetWindow, {
      type: 'warning',
      title: 'Update Check Failed',
      message: `Current version: v${currentVersion}`,
      detail: `Network error checking GitHub Releases: ${err.message}`,
      buttons: ['Open Releases Page', 'Close'],
      defaultId: 0
    });
    if (choice.response === 0) shell.openExternal(RELEASES_URL);
  }
}

async function showGraphicsDiagnostics() {
  const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  const status = app.getGPUFeatureStatus();
  let gpuLines = 'Unavailable';
  try {
    const info = await app.getGPUInfo('basic');
    if (Array.isArray(info?.gpuDevice) && info.gpuDevice.length > 0) {
      gpuLines = info.gpuDevice.map((g, i) => `GPU ${i + 1}: vendor=0x${Number(g.vendorId || 0).toString(16)} device=0x${Number(g.deviceId || 0).toString(16)}${g.driverVersion ? ` driver=${g.driverVersion}` : ''}${g.active ? ' [active]' : ''}`).join('\n');
    }
  } catch (e) {}

  await dialog.showMessageBox(targetWindow, {
    type: 'info',
    title: 'Graphics & Decoder Diagnostics',
    message: `WaveSpeed Studio v${app.getVersion()} Rendering Status`,
    detail: [
      `Software Graphics Mode (Menu): ${readSoftwareGraphicsPref(USER_DATA_DIR) ? 'ON (Full CPU)' : 'OFF (Default safe flags)'}`,
      `video_decode: ${status.video_decode || 'unknown'}`,
      `rasterization: ${status.rasterization || 'unknown'}`,
      `gpu_compositing: ${status.gpu_compositing || 'unknown'}`,
      `2d_canvas: ${status['2d_canvas'] || 'unknown'}`,
      '',
      gpuLines,
      '',
      'Default startup forces software video_decode and software rasterization to prevent Intel/hybrid GPU rainbow blocks. If artifacts ever occur after window focus changes, enable View -> Software Graphics Mode.'
    ].join('\n')
  });
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
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Software Graphics Mode (Fix GPU Artifacts / Restart)',
          type: 'checkbox',
          checked: readSoftwareGraphicsPref(USER_DATA_DIR),
          click: async (menuItem) => {
            saveStudioConfig({ softwareGraphicsMode: Boolean(menuItem.checked) });
            await shutdownCleanly();
            app.relaunch();
            app.exit(0);
          }
        }
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
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates()
        },
        {
          label: 'Graphics & Decoder Diagnostics',
          click: () => showGraphicsDiagnostics()
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
