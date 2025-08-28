import { app, BrowserWindow, shell, ipcMain, session, Notification } from 'electron';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

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
let stopPollingNotifications = null;

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

  // IPC handlers
  ipcMain.handle('ping', async () => 'pong');
  ipcMain.handle('notify', async (_evt, payload) => {
    try {
      const title = typeof payload?.title === 'string' ? payload.title : '';
      const body = typeof payload?.body === 'string' ? payload.body : '';
      if (!title && !body) return false;
      const note = new Notification({ title: title || 'Bildirim', body });
      note.show();
      return true;
    } catch {
      return false;
    }
  });

  // Start optional notification feed polling
  if (baseConfig?.notifications?.enabled && baseConfig?.notifications?.feedUrl) {
    stopPollingNotifications = startNotificationPolling({
      feedUrl: String(baseConfig.notifications.feedUrl),
      intervalMs: Number(baseConfig.notifications.pollIntervalMs || 60000)
    });
  }

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

function startNotificationPolling({ feedUrl, intervalMs }) {
  const seenIds = new Set();
  let cancelled = false;

  async function tick() {
    if (cancelled) return;
    try {
      const res = await fetch(feedUrl, { headers: { 'accept': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      for (const item of data) {
        const id = String(item?.id ?? `${item?.title ?? ''}-${item?.body ?? ''}`);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const title = typeof item?.title === 'string' ? item.title.slice(0, 120) : 'Bildirim';
        const body = typeof item?.body === 'string' ? item.body.slice(0, 500) : '';
        if (!title && !body) continue;
        new Notification({ title, body }).show();
      }
    } catch {}
  }

  const handle = setInterval(tick, Math.max(10_000, intervalMs || 60_000));
  // Kick off immediately
  tick();

  return () => {
    cancelled = true;
    try { clearInterval(handle); } catch {}
  };
}
