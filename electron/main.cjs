// Electron main process for the SellSignal desktop app.
//
// Loads the Vite-built static frontend (dist/) over file:// and exposes a
// single IPC channel ("fetch-json") that performs HTTP requests through
// Electron's `net` module — Chromium's own network stack. This buys us two
// things the browser build can't have:
//
//   1. No CORS. The request is made from the main process, so there is no
//      browser same-origin policy to satisfy and no public CORS proxy chain.
//   2. The Referer header MIS requires for live intraday data. Without
//      `Referer: mis.twse.com.tw/...`, TWSE MIS returns stale previous-close
//      data even during market hours (see vite.config.js for the long story).
//
// The renderer (src/lib/fetchPrice.js) detects window.electronAPI and routes
// every external fetch through here, so the desktop app gets reliable live
// quotes without depending on corsproxy.io & friends.

const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');

// Hosts the renderer is allowed to reach through the fetch-json bridge.
// The Electron path skips the public CORS-proxy chain entirely, so these
// three upstreams are the only legitimate destinations. Anything else is
// rejected — defense in depth for the IPC surface.
const ALLOWED_HOSTS = new Set([
  'mis.twse.com.tw',
  'openapi.twse.com.tw',
  'query1.finance.yahoo.com',
]);

// Native JSON fetch via Chromium's network stack. Adds the MIS Referer when
// the target host needs it; other hosts (Yahoo, TWSE OpenAPI) are sent plain.
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    if (!ALLOWED_HOSTS.has(hostname)) {
      reject(new Error(`Host not allowed: ${hostname}`));
      return;
    }
    let request;
    try {
      request = net.request({ method: 'GET', url });
    } catch (e) {
      reject(e);
      return;
    }
    request.setHeader('Accept', 'application/json, text/plain, */*');
    if (hostname === 'mis.twse.com.tw') {
      request.setHeader('Referer', 'https://mis.twse.com.tw/stock/fibest.jsp?stock=2330');
    }

    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON from ${url}`));
        }
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

ipcMain.handle('fetch-json', (_event, url) => fetchJson(String(url)));

function createWindow() {
  const win = new BrowserWindow({
    width: 430,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    title: 'SellSignal',
    backgroundColor: '#0A0A0B',
    icon: path.join(__dirname, '..', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Any window.open / target=_blank (e.g. font CDN, external links) opens in
  // the user's real browser instead of a bare Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Single-instance: focus the existing window instead of spawning a second.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
