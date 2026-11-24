// Шапка: знак-карандаш + «Magic Board» (Bricolage Grotesque 600, 20px, #363052). Скриншоты MacBook и iPad (обе ориентации),
// RU и EN, плюс экран входа ученика. Проверка: шрифт загрузился, одна строка, знак по центру строки, без плашки.
// Запуск: node server.js  →  node tools/shot-brand.mjs
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const c = await launch({ port: 9415 });
let ok = true;
try {
  for (const [w, h, s, name] of [[1440, 900, 2, 'macbook'], [1180, 820, 2, 'ipad'], [820, 1180, 2, 'ipad-portrait'], [375, 812, 3, 'narrow']]) {
    for (const lang of ['ru', 'en']) {
      const P = await c.newPage('', { width: w, height: h, scale: s });
      await P.goto(U + `#/?lang=${lang}`); await sleep(900);
      const g = await P.eval(`(async()=>{await document.fonts.ready;const i=document.querySelector('.brand-mark'),n=document.querySelector('.brand-name'),r=i.getBoundingClientRect(),t=n.getBoundingClientRect(),cs=getComputedStyle(n);
        return {src:i.getAttribute('src'),nat:i.naturalWidth,w:r.width,h:r.height,x:Math.round(r.left),gap:Math.round(t.left-r.right),
          dy:+Math.abs((r.top+r.bottom)/2-(t.top+t.bottom)/2).toFixed(2),text:n.textContent,lines:Math.round(t.height/parseFloat(cs.lineHeight)),
          font:document.fonts.check('600 20px "Bricolage Grotesque"'),fam:cs.fontFamily.split(',')[0],size:cs.fontSize,weight:cs.fontWeight,color:cs.color,
          bodyFont:getComputedStyle(document.querySelector('h1')||document.body).fontFamily.includes('Bricolage'),title:document.title,bg:getComputedStyle(i).backgroundColor}})()`);
      const good = g.src === 'brand-logo.png' && g.nat === 132 && g.w === 44 && g.h === 32 && g.dy <= 1 && g.text === 'Magic Board' && g.lines === 1
        && g.font && g.size === '20px' && g.weight === '600' && g.color === 'rgb(54, 48, 82)' && !g.bodyFont && g.bg === 'rgba(0, 0, 0, 0)' && g.title === 'Magic Board';
      ok = ok && good; console.log(good ? 'PASS' : 'FAIL', name, lang, JSON.stringify(g));
      if (lang === 'ru') {
        const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: Math.min(w, 420), height: 72, scale: s } });
        writeFileSync(root + `screenshots/brand-${name}.png`, Buffer.from(data, 'base64'));
        await P.shot(root + `screenshots/brand-${name}-full.png`);
      }
      await P.close?.();
    }
  }
} finally { await c.close(); }
process.exit(ok ? 0 : 1);
