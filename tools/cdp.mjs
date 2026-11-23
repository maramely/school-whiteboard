// Мини-драйвер Chrome DevTools Protocol без зависимостей (Node 24+: встроенный WebSocket).
// Используется для автопроверки сценария и скриншотов.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, headless = true, downloads } = {}) {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'wb-chrome-'));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu', 'about:blank'];
  if (headless) args.unshift('--headless=new');
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(200); } }
  const browser = await connect(ver.webSocketDebuggerUrl);
  if (downloads) await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  return {
    browser, port,
    async newPage(url, { width = 1440, height = 900, scale = 1, mobile = false, touch = false } = {}) {
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const t = list.find((x) => x.id === targetId);
      const page = await connect(t.webSocketDebuggerUrl);
      await page.send('Page.enable'); await page.send('Runtime.enable');
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
      if (touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      page.targetId = targetId;
      page.eval = async (expr) => { const r = await page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
      page.goto = async (u) => { await page.send('Page.navigate', { url: u }); await sleep(900); };
      page.shot = async (file) => { const { data } = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(data, 'base64')); };
      page.bringToFront = () => page.send('Page.bringToFront');
      // Рисование пальцем: последовательность touch-событий
      page.touchPath = async (pts, step = 12) => {
        await page.send('Page.bringToFront');
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
        for (let i = 1; i < pts.length; i++) { await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pts[i][0], y: pts[i][1] }] }); await sleep(step); }
        await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(60);
      };
      page.tap = async (x, y) => { await page.send('Page.bringToFront'); await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(40); await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(120); };
      page.mouseDrag = async (pts) => {
        await page.send('Page.bringToFront');
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', clickCount: 1 });
        for (const [x, y] of pts.slice(1)) { await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }); await sleep(10); }
        const l = pts[pts.length - 1];
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: l[0], y: l[1], button: 'left', clickCount: 1 });
        await sleep(60);
      };
      page.click = async (x, y) => { await page.send('Page.bringToFront'); await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(150); };
      return page;
    },
    async close() { try { await browser.send('Browser.close'); } catch { /* noop */ } proc.kill(); },
  };
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let id = 0; const pending = new Map(); const listeners = [];
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else listeners.forEach((f) => f(m)); };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; const to = setTimeout(() => { pending.delete(i); rej(new Error('CDP timeout: ' + method)); }, 15000); pending.set(i, { res: (v) => { clearTimeout(to); res(v); }, rej: (e) => { clearTimeout(to); rej(e); } }); ws.send(JSON.stringify({ id: i, method, params })); }),
      on: (f) => listeners.push(f), close: () => ws.close(),
    });
  });
}
export { sleep };
