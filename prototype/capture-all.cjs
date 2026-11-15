const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const ROOT = path.resolve(__dirname);
const URL_BASE = 'file:///' + path.join(ROOT, 'encarregado-preview.html').replace(/\\/g, '/');
const OUT_DIR = path.join(ROOT, 'shots') + path.sep;

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };

const SHOTS = [
  ['01-admin-encarregados.png', 'admin', DESKTOP],
  ['02-admin-novo.png', 'admin-novo', DESKTOP],
  ['03-admin-editar.png', 'admin-editar', DESKTOP],
  ['03c-admin-empresa-nova.png', 'admin-empresa-nova', DESKTOP],
  ['03d-admin-relatorios.png', 'admin-relatorios', DESKTOP],
  ['04-encarregado-desktop.png', 'lider', DESKTOP],
  ['05-encarregado-horarios.png', 'lider-horarios', DESKTOP],
  ['05b-horarios-sem-almoco.png', 'lider-horarios-sem-almoco', DESKTOP],
  ['05c-encarregado-pagamentos.png', 'lider-pagamentos', DESKTOP],
  ['06-empresa-encarregado.png', 'empresa', DESKTOP],
  ['07-mobile-painel.png', 'mobile', MOBILE],
  ['08-mobile-horarios.png', 'mobile-horarios', MOBILE],
  ['08b-mobile-horarios-sem-almoco.png', 'mobile-horarios-sem-almoco', MOBILE],
  ['08c-mobile-pagamentos.png', 'mobile-pagamentos', MOBILE],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=C:\\Users\\User2026\\AppData\\Local\\Temp\\farilog-cdp-profile-2',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

async function waitChrome() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome CDP did not start');
}

async function main() {
  await waitChrome();
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const waitEvent = (method, timeout = 25000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout: ' + method)), timeout);
    const handler = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === method) {
        clearTimeout(timer);
        ws.removeEventListener('message', handler);
        resolve(m.params);
      }
    };
    ws.addEventListener('message', handler);
  });

  await send('Page.enable');

  for (const [file, view, metrics] of SHOTS) {
    await send('Emulation.setDeviceMetricsOverride', metrics);
    const loaded = waitEvent('Page.loadEventFired');
    await send('Page.navigate', { url: `${URL_BASE}?view=${view}` });
    await loaded;
    await sleep(2600);
    const shot = await send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    });
    fs.writeFileSync(OUT_DIR + file, Buffer.from(shot.data, 'base64'));
    console.log('saved', file);
  }

  ws.close();
  chrome.kill();
}

main().catch((err) => { console.error(err); chrome.kill(); process.exit(1); });