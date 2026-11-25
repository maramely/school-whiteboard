// Стартовый экран: скриншоты на 1440/1024/768/375 (RU и EN) + проверки читаемости и раскладки.
// Запуск: node server.js  →  node tools/shot-home.mjs [папка]   (по умолчанию screenshots/home)
import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = root + (process.argv[2] || 'screenshots/home') + '/'; mkdirSync(OUT, { recursive: true });
const U = 'http://localhost:5173/';
const SIZES = [[1440, 900, 2], [1024, 768, 2], [768, 1024, 2], [375, 812, 3]];
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const c = await launch({ port: 9447 });
try {
  for (const [w, h, s] of SIZES) {
    for (const lang of ['ru', 'en']) {
      const P = await c.newPage('', { width: w, height: h, scale: s, mobile: w < 768, touch: w <= 1024 });
      await P.goto(U + `#/?lang=${lang}`); await sleep(lang === 'ru' ? 4800 : 900);
      const m = await P.eval(`(async()=>{await document.fonts.ready;const q=s=>document.querySelector(s);const r=e=>e.getBoundingClientRect();
        const els=[...document.querySelectorAll('.page-top, .mascot, .card.hero h1, .card.hero .lead, .hero-form label, #f-task, #f-task-help, .hero-form button')];
        const out=els.filter(e=>{const b=r(e);return b.left<-0.5||b.right>innerWidth+0.5}).map(e=>e.id||e.className||e.tagName);
        const clip=els.filter(e=>e.scrollWidth>e.clientWidth+1&&e.tagName!=='TEXTAREA').map(e=>e.className||e.tagName);
        const btn=r(q('.hero-form button')),ta=r(q('#f-task')),h1=q('.card.hero h1');
        return {out,clip,overflowX:document.scrollingElement.scrollWidth>innerWidth,btnH:Math.round(btn.height),btnW:Math.round(btn.width),taW:Math.round(ta.width),
          h1Size:getComputedStyle(h1).fontSize,h1Font:getComputedStyle(h1).fontFamily.split(',')[0],btnBottom:Math.round(btn.bottom),vh:innerHeight}})()`);
      check(`${w} ${lang}: ничего не выходит за край и не обрезается`, !m.out.length && !m.clip.length && !m.overflowX, JSON.stringify(m));
      check(`${w} ${lang}: кнопка ≥ 48 px, поле не уже 280 px`, m.btnH >= 48 && m.taW >= 280);
      if (w >= 1024) check(`${w} ${lang}: кнопка видна без прокрутки`, m.btnBottom <= m.vh, `${m.btnBottom}/${m.vh}`);
      if (lang === 'ru') await P.shot(OUT + `start-${w}.png`);
    }
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
