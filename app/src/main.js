import { app, BrowserWindow, shell, ipcMain, session } from 'electron';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readConfig() {
  try {
    const configPath = join(__dirname, '..', 'app.config.json');
    const raw = readFileSync(configPath, 'utf-8');
    const conf = JSON.parse(raw);
    return conf;
  } catch (error) {
    return {};
  }
}

const baseConfig = readConfig();
const targetUrl = process.env.APP_TARGET_URL || baseConfig.targetUrl || 'https://example.com';
const appTitle = baseConfig.title || 'SiteWrapper';

let mainWindow;

function createWindow() {
  const window = new BrowserWindow({
    width: Number(baseConfig.width || 1200),
    height: Number(baseConfig.height || 800),
    backgroundColor: baseConfig.backgroundColor || '#111111',
    title: appTitle,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  mainWindow = window;

  const userAgentSuffix = baseConfig.userAgentSuffix || '';
  const baseUA = window.webContents.getUserAgent() + userAgentSuffix;

  window.loadURL(targetUrl, { userAgent: baseUA });

  window.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only whitelisted domains to open in-app; others open externally
    const whitelist = (baseConfig.safeNavigationWhitelist || []).map((d) => d.toLowerCase());
    try {
      const { hostname } = new URL(url);
      const inWhitelist = whitelist.some((rule) => {
        if (rule.startsWith('*.')) {
          const suffix = rule.slice(2);
          return hostname === suffix || hostname.endsWith('.' + suffix);
        }
        return hostname === rule;
      });
      if (inWhitelist) {
        return { action: 'allow' };
      }
    } catch {}
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  window.on('closed', () => {
    mainWindow = null;
  });
}

function isAllowedNavigation(url) {
  const whitelist = (baseConfig.safeNavigationWhitelist || []).map((d) => d.toLowerCase());
  try {
    const { hostname } = new URL(url);
    const inWhitelist = whitelist.some((rule) => {
      if (rule.startsWith('*.')) {
        const suffix = rule.slice(2);
        return hostname === suffix || hostname.endsWith('.' + suffix);
      }
      return hostname === rule;
    });
    return inWhitelist;
  } catch {
    return false;
  }
}

app.on('ready', async () => {
  // Single instance lock
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.example.sitewrapper');
  }
  // Security hardening
  const ses = session.defaultSession;
  await ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = new Set(['media', 'geolocation', 'notifications', 'midiSysex', 'pointerLock', 'fullscreen', 'openExternal']);
    callback(allowed.has(permission));
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
