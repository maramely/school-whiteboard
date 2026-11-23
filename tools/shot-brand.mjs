// Значок в шапке рядом с «Интерактивная доска»: скриншоты MacBook и iPad (обе ориентации) + проверка размера и места.
// Запуск: node server.js  →  node tools/shot-brand.mjs
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const c = await launch({ port: 9415 });
let ok = true;
try {
  for (const [w, h, s, name] of [[1440, 900, 2, 'macbook'], [1180, 820, 2, 'ipad'], [820, 1180, 2, 'ipad-portrait']]) {
    const P = await c.newPage('', { width: w, height: h, scale: s });
    await P.goto(U + '#/?lang=ru'); await sleep(900);
    const g = await P.eval(`(()=>{const i=document.querySelector('.brand-mark'),r=i.getBoundingClientRect(),t=document.querySelector('.brand span').getBoundingClientRect();return {src:i.getAttribute('src'),nat:i.naturalWidth,w:r.width,h:r.height,x:Math.round(r.left),y:Math.round(r.top),gap:Math.round(t.left-r.right),mid:Math.abs((r.top+r.bottom)/2-(t.top+t.bottom)/2)<1.5}})()`);
    const good = g.src === 'brand-logo.png' && g.nat === 132 && g.w === 44 && g.h === 32 && g.gap === 10 && g.mid;
    ok = ok && good; console.log(good ? 'PASS' : 'FAIL', name, JSON.stringify(g));
    const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: Math.min(w, 420), height: 72, scale: s } });
    writeFileSync(root + `screenshots/brand-${name}.png`, Buffer.from(data, 'base64'));
    await P.shot(root + `screenshots/brand-${name}-full.png`);
  }
} finally { await c.close(); }
process.exit(ok ? 0 : 1);
