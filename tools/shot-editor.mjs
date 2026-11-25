// Редактор учителя и ученика: 1440 / 1024 / 768 / 375 и iPad книжная (820×1180).
// Полные скриншоты, крупный план верхней панели, меню «Ещё» (если есть) и замеры высоты верхних элементов.
// Запуск: node server.js  →  node tools/shot-editor.mjs [папка]   (по умолчанию screenshots/editor)
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = root + (process.argv[2] || 'screenshots/editor') + '/'; mkdirSync(OUT, { recursive: true });
const U = 'http://localhost:5173/';
const SIZES = [[1440, 900, 2, '1440'], [1024, 768, 2, '1024'], [768, 1024, 2, '768'], [375, 812, 3, '375'], [820, 1180, 2, 'ipad-portrait']];
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const heights = `(()=>{const els=[...document.querySelectorAll('.topbar .icon-btn, .topbar .gbtn, .topbar .btn')].filter(e=>e.offsetParent&&!e.closest('.popover'));
  const R=els.map(e=>{const r=e.getBoundingClientRect();return {n:e.dataset.action||'back',h:Math.round(r.height),w:Math.round(r.width),t:Math.round(r.top)}});
  const g=document.querySelector('.tb-center .group');return {items:R,group:g?Math.round(g.getBoundingClientRect().height):null}})()`;
const shotHeader = async (P, w, s, name) => { const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: w < 768 ? 140 : 76, scale: s } }); writeFileSync(OUT + name, Buffer.from(data, 'base64')); };
const c = await launch({ port: 9521 });
try {
  for (const [w, h, s, tag] of SIZES) {
    const T = await c.newPage('', { width: w, height: h, scale: s, mobile: w < 768, touch: w <= 1024 });
    await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
    await T.goto(U + '#/?lang=ru'); await sleep(400);
    await T.eval(`document.querySelector('#f-task').value='Обведите правильный ответ'; document.querySelector('#create-form').requestSubmit(); true`); await sleep(1300);
    const link = await T.eval(`document.querySelector('.link-field').value`);
    await T.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); document.querySelectorAll('[aria-expanded=true]').forEach(b=>b.setAttribute('aria-expanded','false')); document.activeElement.blur(); true`); await sleep(200);
    // немного содержимого и выбранный инструмент «Ластик» не трогаем: выбрано перо
    const m = await T.eval(heights); console.log(tag, 'teacher', JSON.stringify(m));
    await T.shot(OUT + `teacher-${tag}.png`); await shotHeader(T, w, s, `teacher-header-${tag}.png`);
    const more = await T.eval(`!!document.querySelector('[data-action=more]')`);
    if (more) { await T.eval(`document.querySelector('[data-action=more]').click(); true`); await sleep(300); await T.shot(OUT + `teacher-menu-${tag}.png`); await T.eval(`document.querySelector('[data-action=more]').click(); true`); }
    const S = await c.newPage('', { width: w, height: h, scale: s, mobile: w < 768, touch: w <= 1024 });
    await S.goto(link.replace(/^https?:\/\/[^/]+\//, U)); await sleep(700);
    await S.eval(`(()=>{const i=document.querySelector('input');i.value='Аня';document.querySelector('form').requestSubmit();return true})()`); await sleep(1200);
    await S.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); document.querySelectorAll('[aria-expanded=true]').forEach(b=>b.setAttribute('aria-expanded','false')); true`); await sleep(200);
    console.log(tag, 'student', JSON.stringify(await S.eval(heights)));
    await S.shot(OUT + `student-${tag}.png`); await shotHeader(S, w, s, `student-header-${tag}.png`);
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
