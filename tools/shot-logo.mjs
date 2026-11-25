// Логотип в шапке на всех экранах с брендом: старт, вход ученика, результат, «Доска удалена».
// 1440 / 1024 / 768 / 375 px: полные скриншоты + крупный план шапки и проверка размера, места и чёткости.
// Запуск: node server.js  →  node tools/shot-logo.mjs [папка]   (по умолчанию screenshots/logo)
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = root + (process.argv[2] || 'screenshots/logo') + '/'; mkdirSync(OUT, { recursive: true });
const U = 'http://localhost:5173/';
const SIZES = [[1440, 900, 2], [1024, 768, 2], [768, 1024, 2], [375, 812, 3]];
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const c = await launch({ port: 9491 });
try {
  const P0 = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await P0.goto(U + '#/'); await P0.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await P0.goto(U + '#/?lang=ru'); await sleep(300);
  const mk = async () => { await P0.goto(U + '#/?lang=ru'); await sleep(300); await P0.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(700); return P0.eval(`location.hash.split('/')[2]`); };
  const live = await mk(), ended = await mk(), gone = await mk();
  await P0.eval(`(()=>{const k='wb:board:${ended}',b=JSON.parse(localStorage.getItem(k));b.status='ended';b.endedAt=Date.now();localStorage.setItem(k,JSON.stringify(b));
    localStorage.removeItem('wb:board:${gone}');localStorage.setItem('wb:gone:${gone}',JSON.stringify({reason:'manual',at:Date.now()}));return true})()`);
  const SCREENS = [['start', '#/?lang=ru'], ['join', `#/join/${live}`], ['result', `#/t/${ended}`], ['gone', `#/t/${gone}`]];
  for (const [w, h, s] of SIZES) {
    const P = await c.newPage('', { width: w, height: h, scale: s, mobile: w < 768, touch: w <= 1024 });
    for (const [name, hash] of SCREENS) {
      await P.goto(U + '#/x'); await sleep(100); await P.goto(U + hash); await sleep(name === 'start' ? 4800 : 700);
      const g = await P.eval(`(async()=>{const i=document.querySelector('.brand-mark'); if(i.decode) await i.decode().catch(()=>{});
        const r=i.getBoundingClientRect(),top=document.querySelector('.page-top').getBoundingClientRect(),card=document.querySelector('.page-main > .card, .page-main > section');
        const cr=card&&card.getBoundingClientRect();
        return {src:i.getAttribute('src'),alt:i.getAttribute('alt'),w:+r.width.toFixed(1),h:+r.height.toFixed(1),x:Math.round(r.left),y:Math.round(r.top),
          ratio:+(r.width/r.height).toFixed(3),nat:i.naturalWidth?+(i.naturalWidth/i.naturalHeight).toFixed(3):null,
          midTop:Math.abs((r.top+r.bottom)/2-(top.top+top.bottom)/2)<1, gapToCard:cr?Math.round(cr.top-r.bottom):null, over:r.right>innerWidth}})()`);
      check(`${w} ${name}: логотип на месте, пропорции целы, не выходит за край`, g.x <= 20 && g.y < 40 && !g.over && g.midTop && (g.nat == null || Math.abs(g.ratio - g.nat) < 0.02), JSON.stringify(g));
      if (name === 'start' || w === 1440) await P.shot(OUT + `${name}-${w}.png`);
      const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: Math.min(w, 400), height: 84, scale: s } });
      writeFileSync(OUT + `header-${name}-${w}.png`, Buffer.from(data, 'base64'));
    }
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
