// «Доска удалена»: шапка сверху, карточка по центру видимой области под шапкой (по горизонтали и вертикали).
// MacBook и iPad в обеих ориентациях; при нехватке высоты — безопасные отступы и прокрутка.
// Запуск: node server.js  →  node tools/e2e-gone.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const geo = (P) => P.eval(`(()=>{const h=document.querySelector('.page-top').getBoundingClientRect(),c=document.querySelector('.card').getBoundingClientRect(),se=document.scrollingElement;
  return {vw:innerWidth, vh:innerHeight, hTop:h.top, hBot:h.bottom, l:c.left, r:c.right, t:c.top, b:c.bottom, title:document.querySelector('.card h1').textContent, art:(()=>{const i=document.querySelector('.card .gone-art'); if(!i) return null; const r=i.getBoundingClientRect(),h1=document.querySelector('.card h1').getBoundingClientRect(),cr=document.querySelector('.card').getBoundingClientRect(); return {w:Math.round(r.width), loaded:i.complete&&i.naturalWidth===520, ratio:+(r.width/r.height).toFixed(3), nat:+(i.naturalWidth/i.naturalHeight).toFixed(3), above:r.bottom<=h1.top, centered:Math.abs((r.left+r.right)/2-(cr.left+cr.right)/2)<1, trash:!!document.querySelector('.card .badge-ic')}})(), btn:!!document.querySelector('.card .btn'), visible:(()=>{const h=document.querySelector('.card h1').getBoundingClientRect(),b=document.querySelector('.card .btn'); const r=b&&b.getBoundingClientRect(); return h.top>=0&&h.bottom<=innerHeight&&(!r||(r.top>=0&&r.bottom<=innerHeight))})(), sh:se.scrollHeight, ch:se.clientHeight}})()`);
const c = await launch({ port: 9407 });
try {
  const P = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await P.goto(U + '#/'); await P.eval(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('wb:demo:lang','ru'); true`);
  await P.goto(U + '#/?lang=ru'); await sleep(300);
  await P.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const id = await P.eval(`location.hash.split('/')[2]`);
  await P.eval(`localStorage.removeItem('wb:board:${id}'); localStorage.setItem('wb:gone:${id}', JSON.stringify({reason:'manual', at:Date.now()})); true`);
  for (const [who, hash] of [['учитель', '#/t/' + id], ['ученик', '#/join/' + id]]) {
    for (const [w, h, name] of [[1440, 900, 'MacBook'], [1180, 820, 'iPad альбомная'], [820, 1180, 'iPad книжная']]) {
      await P.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
      await P.goto(U + '#/x'); await sleep(150); await P.goto(U + hash); await sleep(400);
      const g = await geo(P);
      const dx = Math.abs((g.l + g.r) / 2 - g.vw / 2), dy = Math.abs((g.t + g.b) / 2 - g.vh / 2);
      check(`${who}, ${name}: карточка по центру по горизонтали, центр у середины экрана, не заходит на шапку; заголовок и «Создать доску» видны`, g.title === 'Доска удалена' && g.visible && g.hTop === 0 && dx < 1.5 && dy < 4 && g.t >= g.hBot + 8 && g.sh <= g.ch + 1, `Δx ${dx.toFixed(1)}, Δy от середины экрана ${dy.toFixed(1)}, верх карточки ${Math.round(g.t)} ≥ шапка ${Math.round(g.hBot)}+8`);
      check(`${who}, ${name}: шиба с корзиной 160 px (−20%) по центру над заголовком, пропорции сохранены, без старой иконки`, g.art && g.art.w === 160 && g.art.loaded && g.art.above && g.art.centered && Math.abs(g.art.ratio - g.art.nat) < 0.01 && !g.art.trash, JSON.stringify(g.art));
      if (who === 'учитель') await P.shot(root + `screenshots/gone-${w}x${h}.png`);
    }
  }
  // Низкая область (напр. iPad с клавиатурой или узкое окно): прокрутка, ничего не обрезано
  await P.send('Emulation.setDeviceMetricsOverride', { width: 820, height: 300, deviceScaleFactor: 2, mobile: false });
  await P.goto(U + '#/x'); await sleep(150); await P.goto(U + '#/t/' + id); await sleep(400);
  let g = await geo(P);
  check('Низкая область: карточка начинается под шапкой с отступом, страница прокручивается', g.t >= g.hBot + 12 && g.sh > g.ch, `top ${Math.round(g.t)} ≥ ${Math.round(g.hBot)}+12, ${g.sh}>${g.ch}`);
  await P.eval(`window.scrollTo(0, document.scrollingElement.scrollHeight); true`); await sleep(150);
  const btn = await P.eval(`(()=>{const r=document.querySelector('.card .btn').getBoundingClientRect(),c=document.querySelector('.card').getBoundingClientRect();return {b:r.bottom,vh:innerHeight,cb:c.bottom}})()`);
  check('…прокрутка до конца: кнопка и весь текст доступны, снизу безопасный отступ', btn.b <= btn.vh && btn.cb <= btn.vh - 12, JSON.stringify(btn));
  // Прозрачность: угол картинки прозрачный, фон карточки виден сквозь неё
  const alpha = await P.eval(`(async()=>{const i=document.querySelector('.gone-art'); await i.decode(); const c=document.createElement('canvas'); c.width=i.naturalWidth; c.height=i.naturalHeight; const g=c.getContext('2d'); g.drawImage(i,0,0); return [g.getImageData(0,0,1,1).data[3], g.getImageData(c.width/2|0,c.height/2|0,1,1).data[3]]})()`);
  check('Иллюстрация с прозрачным фоном', alpha[0] === 0 && alpha[1] > 200, alpha.join(','));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
