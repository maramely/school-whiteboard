// Единый стиль иконок Lucide у учителя и ученика: 20 px, линия 1,75, currentColor; активный инструмент — сиреневая подложка;
// удаление — красный акцент; отключённое — приглушённый оттенок; цели ≥ 44×44; штампы — полноцветные эмодзи.
// Скриншоты доков и шапок: screenshots/icons-*.png
// Запуск: node server.js  →  node tools/e2e-icons.mjs
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const DOCK = 'undo,redo,pen,select,eraser,text,sticky,stamp';
const clipShot = async (P, sel, file, pad = 8) => {
  const r = await P.eval(`(()=>{const b=document.querySelector('${sel}').getBoundingClientRect();return {x:b.left-${pad},y:b.top-${pad},width:b.width+${pad * 2},height:b.height+${pad * 2}}})()`);
  const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } }); writeFileSync(file, Buffer.from(data, 'base64'));
};
const audit = (P, scope) => P.eval(`(()=>{const ink=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  const icons=[...document.querySelectorAll('${scope}')].filter(i=>i.getClientRects().length && getComputedStyle(i).visibility!=='hidden');
  const bad=icons.map(i=>{const s=getComputedStyle(i);return {n:i.dataset.icon, w:s.width, sw:s.strokeWidth, cur:s.stroke===s.color}}).filter(o=>o.w!=='20px'||o.sw!=='1.75px'||!o.cur);
  return {n:icons.length, bad}})()`);

const c = await launch({ port: 9411 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(1500);
  const S = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await S.goto(U + '#/demo/student?name=Аня&lang=ru'); await sleep(1300);
  await S.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`);
  for (const [P, who] of [[T, 'Учитель'], [S, 'Ученик']]) {
    await P.bringToFront(); await sleep(200);
    const dock = await P.eval(`[...document.querySelectorAll('.dock .tool .ic')].map(i=>i.dataset.icon).join()`);
    check(`${who}: док — Undo2, Redo2, Pencil, MousePointer2, Eraser, Type, StickyNote, Smile`, dock === DOCK, dock);
    const a = await audit(P, '.topbar .ic, .dock .ic, .people-dock .ic');
    check(`${who}: все иконки шапки, дока и счётчика — 20 px, линия 1,75, currentColor`, a.n > 8 && a.bad.length === 0, `${a.n} иконок ${JSON.stringify(a.bad)}`);
    const st = await P.eval(`(()=>{const cs=(s)=>getComputedStyle(document.querySelector(s)); const root=getComputedStyle(document.documentElement);
      return {pen:cs('[data-tool="pen"]').color, eraser:cs('[data-tool="eraser"]').color, sel:cs('[data-tool="select"]').color, task:cs('[data-action="task"]').color, ink:cs('.dock').color,
        activeBg:cs('[data-tool="pen"][aria-pressed="true"]').backgroundColor, undoDisabled:document.querySelector('[data-action="undo"]').disabled, undo:cs('[data-action="undo"]').color,
        danger:(document.querySelector('[data-action="erase-mine"] .ic')?getComputedStyle(document.querySelector('[data-action="erase-mine"] .ic')).color:null), clearItem:(document.querySelector('[data-action="clear"] .ic')?getComputedStyle(document.querySelector('[data-action="clear"] .ic')).color:null), activeIc:cs('[data-tool="pen"][aria-pressed="true"]').color,
        small:[...document.querySelectorAll('.dock button, .topbar button, .topbar a, .people-btn')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>Math.min(r.width,r.height)<44).length}})()`);
    check(`${who}: один цвет иконок по умолчанию (неактивные инструменты и кнопки шапки)`, st.eraser === st.sel && st.sel === st.task, `${st.eraser} / ${st.sel} / ${st.task}`);
    check(`${who}: активный инструмент — сиреневая подложка и иконка #6A57C2`, st.activeBg === 'rgb(228, 223, 253)' && st.activeIc === 'rgb(106, 87, 194)', st.activeBg + ' / ' + st.activeIc);
    check(`${who}: отключённая «Отменить» — приглушённый оттенок`, st.undoDisabled && st.undo === 'rgb(185, 181, 204)', st.undo);
    check(`${who}: «Стереть мои записи» — красный акцент; «Очистить доску» — нейтральная`, who === 'Учитель' ? st.clearItem === st.task : /^rgb\(1[6-9]\d|^rgb\(2\d\d/.test(st.danger), who === 'Учитель' ? st.clearItem : st.danger);
    check(`${who}: цели касания ≥ 44×44`, st.small === 0, String(st.small));
    await P.eval(`document.querySelector('[data-tool="stamp"]').click(); true`); await sleep(300);
    const pal = await P.eval(`(()=>{const f=document.querySelector('.flyout');return {open:!f.hidden, emoji:[...f.querySelectorAll('.react-emoji')].length, lucide:f.querySelectorAll('.ic').length}})()`);
    check(`${who}: Smile открывает палитру, штампы — полноцветные эмодзи, а не контуры`, pal.open && pal.emoji >= 3 && pal.lucide === 0, JSON.stringify(pal));
    await P.eval(`document.querySelector('[data-tool="stamp"]').click(); document.querySelector('[data-tool="pen"]').click(); true`); await sleep(200);
    const tag = who === 'Учитель' ? 'teacher' : 'student';
    await clipShot(P, '.dock', root + `screenshots/icons-dock-${tag}.png`);
    await clipShot(P, '.topbar', root + `screenshots/icons-topbar-${tag}.png`, 0);
  }
  // Список участников и диалог
  await T.bringToFront(); await sleep(5200);
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(400);
  let a = await audit(T, '#people-pop .ic');
  check('Список участников: «Отключить» и «Копировать» — те же 20 px и 1,75', a.n >= 2 && a.bad.length === 0, `${a.n} ${JSON.stringify(a.bad)}`);
  const kick = await T.eval(`(()=>{const r=document.querySelector('.kick-btn').getBoundingClientRect();return Math.min(r.width,r.height)})()`);
  check('Кнопка «Отключить» ≥ 44×44', kick >= 44, String(kick));
  await clipShot(T, '#people-pop', root + 'screenshots/icons-people.png');
  await T.eval(`document.querySelector('[data-action="people"]').click(); document.querySelector('[data-action="clear"]').click(); true`); await sleep(300);
  a = await audit(T, '.modal .ic, .topbar .ic');
  check('Диалог открыт поверх шапки, иконки не разъехались', !!(await T.eval(`document.querySelector('.modal')`)) && a.bad.length === 0, JSON.stringify(a.bad));
  await T.eval(`document.querySelector('.modal .modal-actions .btn').click(); true`); await sleep(200);
  // Панель выделения и редактор
  await T.eval(`document.querySelector('[data-tool="sticky"]').click(); true`);
  const f = await T.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
  await T.click(f[0] + 1300 * f[2], f[1] + 700 * f[2]); await sleep(300);
  a = await audit(T, '.edit-bar .ic');
  check('Редактор: «Готово» — те же 20 px и 1,75', a.n >= 1 && a.bad.length === 0, JSON.stringify(a.bad));
  await T.send('Input.insertText', { text: 'Иконки' }); await T.eval(`document.activeElement.blur(); true`); await sleep(300);
  await T.eval(`document.querySelector('[data-tool="select"]').click(); true`);
  await T.click(f[0] + 1340 * f[2], f[1] + 740 * f[2]); await sleep(300);
  a = await audit(T, '.selbar .ic');
  const del = await T.eval(`getComputedStyle(document.querySelector('.selbar [data-action="sel-delete"] .ic')).color`);
  check('Панель выделения: «Редактировать» и «Удалить» — 20 px, 1,75; удаление красным', a.n === 2 && a.bad.length === 0 && del === 'rgb(196, 50, 39)' || (a.n === 2 && a.bad.length === 0 && /^rgb\(1[6-9]\d|^rgb\(2\d\d/.test(del)), `${a.n} ${del}`);
  await clipShot(T, '.selbar', root + 'screenshots/icons-selbar.png');
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
