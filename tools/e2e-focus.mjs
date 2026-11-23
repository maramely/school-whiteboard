// Единый фокус полей: одна непрерывная сиреневая граница 1 px (меняется только её цвет), без колец, теней и контура.
// «Задание для учеников» в панели на доске, задание на старте, имя ученика, «Имя файла» (граница вокруг блока с .png).
// Клик (MacBook), касание (iPad), Tab. Скриншот открытой панели «Задание» с курсором в поле.
// Запуск: node server.js  →  node tools/e2e-focus.mjs
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const ACC = 'rgb(117, 99, 202)';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
// box — элемент с границей (у «Имени файла» — обёртка .file-field), field — само поле
const st = (P, box, field) => P.eval(`(()=>{const b=document.querySelector('${box}'),f=document.querySelector('${field}'),s=getComputedStyle(b),fs=getComputedStyle(f),r=b.getBoundingClientRect();
  return {focused:document.activeElement===f, bw:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].join(), bc:[...new Set([s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor])].join('|'),
    radius:s.borderTopLeftRadius, shadow:s.boxShadow, outline:s.outlineStyle, fOutline:fs.outlineStyle, fShadow:fs.boxShadow, size:Math.round(r.width*10)/10+'×'+Math.round(r.height*10)/10}})()`);
const tab = async (P, shift) => { const m = shift ? 8 : 0; await P.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: m }); await P.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: m }); await sleep(300); };
const center = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+Math.min(40,r.width/2),r.top+r.height/2]})()`);
async function verify(P, name, box, field, nextSel, how) {
  await P.eval(`document.activeElement && document.activeElement.blur(); true`); await sleep(300);
  const idle = await st(P, box, field);
  const okFocus = (f) => f.focused && f.bc === ACC && f.bw === idle.bw && f.radius === idle.radius && f.size === idle.size && f.shadow === 'none' && f.outline === 'none' && f.fOutline === 'none' && f.fShadow === 'none';
  check(`${name}: в покое — одна нейтральная граница 1 px`, idle.bw === '1px,1px,1px,1px' && !idle.bc.includes('|') && idle.bc !== ACC && idle.shadow === 'none', `${idle.bc}, радиус ${idle.radius}`);
  const [x, y] = await center(P, field);
  if (how === 'touch') await P.tap(x, y); else await P.click(x, y);
  await sleep(300);
  let f = await st(P, box, field);
  check(`${name}: ${how === 'touch' ? 'касание' : 'клик'} — граница сиреневая 1 px, без колец и теней, размер и скругление прежние`, okFocus(f), JSON.stringify(f));
  await P.eval(`document.querySelector('${nextSel}').focus(); true`); await sleep(300);
  await tab(P, true);
  f = await st(P, box, field);
  check(`${name}: Tab (Shift+Tab с соседней кнопки) — тот же вид фокуса`, okFocus(f), JSON.stringify(f));
}
const c = await launch({ port: 9412 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  // Стартовый экран
  await T.goto(U + '#/?lang=ru'); await sleep(600);
  await verify(T, 'Задание на старте', '#f-task', '#f-task', '#create-form [type="submit"]', 'click');
  // Панель «Задание» на доске
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(1200);
  await T.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); document.querySelectorAll('[aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false')); true`);
  await T.click(...(await center(T, '[data-action="task"]'))); await sleep(300);
  await verify(T, 'Задание для учеников (панель на доске)', '#task-edit', '#task-edit', '.task-form [type="submit"]', 'click');
  await T.click(...(await center(T, '#task-edit'))); await sleep(400);
  { const r = await T.eval(`(()=>{const b=document.querySelector('#task-pop').getBoundingClientRect();return {x:b.left-24,y:0,width:b.width+48,height:b.bottom+24}})()`); const { data } = await T.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 2 } }); writeFileSync(root + 'screenshots/task-pop-focus.png', Buffer.from(data, 'base64')); }
  await T.shot(root + 'screenshots/macbook-task-pop-focus.png');
  const invite = await T.eval(`document.querySelector('.link-field').value`);
  // Касание на iPad: панель «Задание» и имя ученика
  const I = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await I.goto(T === null ? '' : (await T.eval(`location.href`))); await sleep(1200);
  await I.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`);
  await I.tap(...(await center(I, '[data-action="task"]'))); await sleep(300);
  await verify(I, 'iPad: задание для учеников', '#task-edit', '#task-edit', '.task-form [type="submit"]', 'touch');
  const S = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await S.goto(invite); await sleep(600);
  await verify(S, 'iPad: имя ученика', '#f-name', '#f-name', '#join [type="submit"]', 'touch');
  // Имя файла: граница вокруг блока с .png
  await T.bringToFront();
  await T.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(1200);
  await verify(T, 'Имя файла (блок с .png)', '.file-field', '#f-file', '#dl-form [type="submit"]', 'click');
  const inner = await T.eval(`(()=>{const i=getComputedStyle(document.querySelector('#f-file')),e=getComputedStyle(document.querySelector('.file-field .ext'));return {iBorder:i.borderTopWidth, sep:e.borderLeftWidth+' '+e.borderLeftColor}})()`);
  check('Имя файла: у внутреннего поля нет своей рамки, разделитель перед .png тонкий и нейтральный', inner.iBorder === '0px' && /^1px rgb\(225, 222, 238\)$/.test(inner.sep), JSON.stringify(inner));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
