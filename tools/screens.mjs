// Скриншоты демо-состояния (True or False, середина упражнения) + проверки удобства на iPad и MacBook.
// Запуск: node server.js  →  node tools/screens.mjs
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = root + 'screenshots'; mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.png')) rmSync(OUT + '/' + f);
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };

// WCAG contrast of the palette
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [n, f, b, min] of [
  ['Текст #363052 на фоне #FAFAFD', '#363052', '#FAFAFD', 4.5],
  ['Вторичный текст на белом', '#625C80', '#FFFFFF', 4.5],
  ['Подпись кнопки на #EEEBFF', '#363052', '#EEEBFF', 4.5],
  ['Подпись кнопки при нажатии', '#363052', '#D9D2FA', 4.5],
  ['Иконка на выбранной подложке', '#363052', '#E4DFFD', 3],
  ['Фокус #7563CA на белом', '#7563CA', '#FFFFFF', 3],
  ['Текст «Удалить» на белом', '#B8433C', '#FFFFFF', 4.5]])
  check(`Контраст: ${n}`, cr(f, b) >= min, cr(f, b).toFixed(2) + ':1');

const c = await launch({ port: 9341 });
const box = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(1500);
  const A = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await A.goto(U + '#/demo/student?name=Аня&lang=ru'); await sleep(1500);
  const M = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await M.goto(U + '#/demo/student?name=Миша&lang=ru'); await sleep(1500);
  await sleep(4500);

  // --- iPad (ученица Аня) ---
  await A.bringToFront(); await sleep(300);
  check('iPad: инструкция открыта при входе', await A.eval(`!document.querySelector('#task-pop').hidden`));
  const p0 = await box(A, '.frame'); await A.tap(p0[0], p0[1]); await sleep(200);
  check('iPad: первое касание закрывает инструкцию и не рисует', await A.eval(`document.querySelector('#task-pop').hidden && JSON.parse(localStorage.getItem('wb:board:true-false')).elements.length===6`));
  check('iPad: ученику доступны только его действия', await A.eval(`!document.querySelector('[data-action="invite"],[data-action="image"],[data-action="menu"],[data-action="end"]')`));
  const g = await A.eval(`(()=>{const f=document.querySelector('.frame').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect(),s=f.width/1600; return {dockTop:d.top, lastBoxBottom:f.top+(830+120)*s, frameBottom:f.bottom}})()`);
  check('iPad: док ниже нижнего квадрата задания', g.dockTop > g.lastBoxBottom && g.dockTop >= g.frameBottom, JSON.stringify(g));
  const small = await A.eval(`[...document.querySelectorAll('button, a.btn, a.icon-btn')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return [b.getAttribute('aria-label')||b.textContent.trim(), Math.round(Math.min(r.width,r.height))]}).filter(x=>x[1]<44)`);
  check('iPad: все видимые цели ≥ 44×44', small.length === 0, JSON.stringify(small));
  // перо → цвет → рисовать
  const cbtn = await box(A, '.color-btn'); await A.tap(...cbtn); await sleep(250);
  check('Касание по цвету у пера открывает цвет и толщину', await A.eval(`!document.querySelector('.flyout').hidden`));
  check('Панель цвета над доком', await A.eval(`document.querySelector('.flyout').getBoundingClientRect().bottom <= document.querySelector('.dock').getBoundingClientRect().top`));
  await A.shot(OUT + '/ipad-student-ru-colors.png');
  const sw = await box(A, '[data-color="#AF52DE"]'); await A.tap(...sw); await sleep(150);
  check('Цвет выбран одним касанием и виден рядом с пером', await A.eval(`getComputedStyle(document.querySelector('.color-dot')).backgroundColor==='rgb(175, 82, 222)'`));
  const f = await A.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
  const s0 = [f[0] + 1448 * f[2], f[1] + (262 + 3 * 142 + 25) * f[2]];
  await A.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s0[0], y: s0[1] }] });
  await A.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s0[0] + 10, y: s0[1] + 12 }] });
  const inked = await A.eval(`(()=>{const c=document.querySelector('canvas.live'),x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<x.length;i+=4)if(x[i])n++;return n})()`);
  check('Штрих появляется сразу, до отрыва пальца', inked > 0, `${inked} px`);
  check('Панель цвета закрылась с началом штриха', await A.eval(`document.querySelector('.flyout').hidden`));
  await A.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
  await A.eval(`document.querySelector('[data-action="undo"]').click(); true`); await sleep(200);
  await A.eval(`(()=>{document.querySelector('.color-btn').click(); document.querySelector('[data-color="#007AFF"]').click(); document.querySelector('.color-btn').click(); return true})()`); await sleep(200);
  await A.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  check('prefers-reduced-motion отключает анимации', (await A.eval(`getComputedStyle(document.documentElement).getPropertyValue('--dur-base').trim()`)) === '0ms');
  await A.send('Emulation.setEmulatedMedia', { features: [] });
  await A.shot(OUT + '/ipad-student-ru.png');
  // переключателя RU/EN у ученика нет — язык приходит из платформы (?lang=)
  await A.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=en'; return true})()`); await sleep(600);
  await A.shot(OUT + '/ipad-student-en.png');
  await A.send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 2, mobile: false }); await sleep(600);
  const gp = await A.eval(`(()=>{const f=document.querySelector('.frame').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect(),t=document.querySelector('.topbar');return {gap:Math.round(d.top-f.bottom), hscroll: document.documentElement.scrollWidth>innerWidth || t.scrollWidth>t.clientWidth+1}})()`);
  check('iPad портрет: док не перекрывает лист, без горизонтального скролла', gp.gap >= 0 && !gp.hscroll, JSON.stringify(gp));
  await A.shot(OUT + '/ipad-student-en-portrait.png');

  // --- MacBook (учитель) ---
  await T.bringToFront(); await sleep(400);
  { const H = await c.newPage('', { width: 1440, height: 900, scale: 2 });
    await H.goto(U + '#/?lang=ru'); await sleep(800);
    const st = await H.eval(`(()=>{const b=document.querySelector('#create-form .btn-primary'),cs=getComputedStyle(b),ic=b.querySelector('svg'),ir=ic.getBoundingClientRect(),br=b.getBoundingClientRect(),tx=b.lastChild; return {bg:cs.backgroundColor, img:cs.backgroundImage, shadow:cs.boxShadow, color:cs.color, icon:Math.round(ir.width), iconColor:getComputedStyle(ic).stroke, centered: Math.abs((ir.top+ir.height/2)-(br.top+br.height/2))<1.5}})()`);
    check('«Создать доску»: заливка #EEEBFF, без градиента и тени, тёмная подпись', st.bg === 'rgb(238, 235, 255)' && st.img === 'none' && st.shadow === 'none' && st.color === 'rgb(54, 48, 82)', JSON.stringify(st));
    check('Карандаш ~20 px в цвет текста, по центру строки', st.icon === 20 && st.iconColor === 'rgb(54, 48, 82)' && st.centered);
    await H.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await H.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await H.eval(`document.querySelector('#create-form .btn-primary').focus(); true`);
    const fo = await H.eval(`getComputedStyle(document.querySelector('#create-form .btn-primary')).outlineStyle`);
    check('Видимый фокус с клавиатуры', fo === 'solid', fo);
    await H.eval(`document.activeElement.blur(); true`);
    await H.shot(OUT + '/macbook-start-ru.png');
    await H.eval(`location.hash='#/?lang=en'; true`); await sleep(500); await H.shot(OUT + '/macbook-start-en.png');
    await H.eval(`location.hash='#/?lang=ru'; true`); await sleep(300); }
  const pos = `[...document.querySelectorAll('.tb-center .group > *, .tb-right > *')].map(e=>Math.round(e.getBoundingClientRect().left)).join(',')`;
  const ru = await T.eval(pos);
  await T.shot(OUT + '/macbook-teacher-ru.png');
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`); await sleep(800);
  await T.shot(OUT + '/macbook-teacher-ru-invite.png');
  const ip = await T.eval(`(()=>{const p=document.querySelector('#invite-pop').getBoundingClientRect(), l=document.querySelector('.link-field'); return {inView: p.left>=0 && p.right<=innerWidth, linkClipped: l.scrollWidth>l.clientWidth}})()`);
  check('Приглашение помещается у кнопки; длинная ссылка обрезается многоточием', ip.inView, JSON.stringify(ip));
  await T.eval(`document.querySelector('[data-action="invite"]').click(); (()=>{location.hash=location.hash.split('?')[0]+'?lang=en'; return true})()`); await sleep(700);
  const en = await T.eval(pos);
  check('MacBook: RU/EN не сдвигает шапку', ru === en, `${ru} / ${en}`);
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`); await sleep(300);
  const ipEn = await T.eval(`(()=>{const p=document.querySelector('#invite-pop').getBoundingClientRect(); return p.left>=0 && p.right<=innerWidth && [...document.querySelectorAll('#invite-pop .btn')].every(b=>b.scrollWidth<=b.clientWidth+1)})()`);
  check('EN: приглашение помещается, подписи не обрезаны', ipEn);
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`); await sleep(200);
  await T.shot(OUT + '/macbook-teacher-en.png');
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(400);
  await T.shot(OUT + '/macbook-teacher-en-people.png');
  await T.eval(`document.querySelector('[data-action="people"]').click(); (()=>{location.hash=location.hash.split('?')[0]+'?lang=ru'; return true})()`); await sleep(600);
  const tsmall = await T.eval(`[...document.querySelectorAll('.topbar button, .topbar a, .dock button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)}).filter(v=>v<44).length`);
  check('MacBook: цели в шапке и доке ≥ 44 px', tsmall === 0, String(tsmall));
  await T.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 2, mobile: false }); await sleep(500);
  check('Учительская шапка помещается на ширине iPad (RU)', await T.eval(`(()=>{const t=document.querySelector('.topbar');return t.scrollWidth<=t.clientWidth+1})()`));
  await T.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=en'; return true})()`); await sleep(600);
  check('Учительская шапка помещается на ширине iPad (EN)', await T.eval(`(()=>{const t=document.querySelector('.topbar');return t.scrollWidth<=t.clientWidth+1})()`));
  await T.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=ru'; return true})()`); await sleep(600);
  await T.shot(OUT + '/ipad-teacher-ru.png');
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
