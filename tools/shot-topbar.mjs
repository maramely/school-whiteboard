// Верхняя панель учителя и ученика на 1440 / 1280 / 1180 / 1024 / 820 / 768 / 375:
// крупный план шапки, какие подписи видны, наложения, обрезанный текст, горизонтальный скролл, цели ≥ 44×44.
// Запуск: node server.js  →  node tools/shot-topbar.mjs [папка]   (по умолчанию screenshots/topbar)
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = root + (process.argv[2] || 'screenshots/topbar') + '/'; mkdirSync(OUT, { recursive: true });
const U = 'http://localhost:5173/';
const W = [[1440, 900], [1280, 800], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [375, 812]];
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const audit = `(()=>{const vw=innerWidth;const els=[...document.querySelectorAll('.topbar a, .topbar button, .topbar .tb-title, .dock button, .people-btn')].filter(e=>e.offsetParent&&!e.closest('.popover'));
  const R=els.map(e=>{const r=e.getBoundingClientRect();const lbl=e.querySelector('.lbl-stack');return {n:e.dataset.action||e.dataset.tool||(e.classList.contains('tb-title')?'title':'back'),l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height,
    text:!!lbl&&lbl.offsetWidth>0, clip:!e.classList.contains('tb-title')&&e.scrollWidth>e.clientWidth+1, inTop:!!e.closest('.topbar'), title:e.classList.contains('tb-title')}});
  const bad=[];R.forEach((a,i)=>{const dk=document.querySelector('.dock');const scrollDock=dk&&dk.scrollWidth>dk.clientWidth+1;if((a.l<-0.5||a.r>vw+0.5)&&!(scrollDock&&!a.inTop&&a.n!=='people'))bad.push('out:'+a.n);if(a.clip)bad.push('clip:'+a.n);if(!a.title&&(a.w<44-0.5||a.h<44-0.5))bad.push('small:'+a.n+' '+Math.round(a.w)+'×'+Math.round(a.h));
    R.slice(i+1).forEach(b=>{if(a.l<b.r-0.5&&b.l<a.r-0.5&&a.t<b.b-0.5&&b.t<a.b-0.5)bad.push(a.n+'×'+b.n)})});
  const top=R.filter(x=>x.inTop&&!x.title);const ce=document.querySelector('[data-action=clear]'),en=document.querySelector('[data-action=end]');
  return {bad, hscroll:document.scrollingElement.scrollWidth>vw, labels:Object.fromEntries(top.map(x=>[x.n,x.text])), gap:ce&&en?Math.round(en.getBoundingClientRect().left-ce.getBoundingClientRect().right):null,
    heights:[...new Set(top.map(x=>Math.round(x.h)))]}})()`;
const c = await launch({ port: 9541 });
try {
  for (const [w, h] of W) {
    const s = w <= 400 ? 3 : 2;
    const T = await c.newPage('', { width: w, height: h, scale: s, mobile: w < 768, touch: w <= 1180 });
    await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
    await T.goto(U + '#/?lang=ru'); await sleep(400);
    await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(1300);
    const link = await T.eval(`document.querySelector('.link-field').value`);
    await T.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); document.querySelectorAll('[aria-expanded=true]').forEach(b=>b.setAttribute('aria-expanded','false')); document.activeElement.blur(); true`); await sleep(200);
    const a = await T.eval(audit);
    check(`${w} учитель: без наложений, обрезаний, скролла, цели ≥ 44`, !a.bad.length && !a.hscroll, JSON.stringify(a));
    const { data } = await T.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: w < 641 ? 120 : 72, scale: s } });
    writeFileSync(OUT + `teacher-${w}.png`, Buffer.from(data, 'base64'));
    const S = await c.newPage('', { width: w, height: h, scale: s, mobile: w < 768, touch: w <= 1180 });
    await S.goto(link.replace(/^https?:\/\/[^/]+\//, U)); await sleep(700);
    await S.eval(`(()=>{const i=document.querySelector('input');i.value='Аня';document.querySelector('form').requestSubmit();return true})()`); await sleep(1200);
    await S.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`); await sleep(200);
    const b = await S.eval(audit);
    check(`${w} ученик: без наложений, обрезаний, скролла, цели ≥ 44`, !b.bad.length && !b.hscroll, JSON.stringify(b));
    const r2 = await S.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: w < 641 ? 120 : 72, scale: s } });
    writeFileSync(OUT + `student-${w}.png`, Buffer.from(r2.data, 'base64'));
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
