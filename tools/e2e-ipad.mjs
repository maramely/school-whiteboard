// iPad: поворот и экранная клавиатура (эмуляция в Chrome).
// Сценарий: вход по имени → стикер → редактирование → поворот во время набора → «Готово» → рисование.
// Клавиатура эмулируется хуком window.__wbKeyboard (высота в px) + событием resize у visualViewport:
// CDP не умеет показывать настоящую экранную клавиатуру Safari. Поворот — сменой размеров окна 1180×820 ↔ 820×1180.
// Запуск: node server.js  →  node tools/e2e-ipad.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const SHOTS = root + 'screenshots';
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const board = (P) => P.eval(`JSON.parse(localStorage.getItem('wb:board:true-false'))`);
const ctr = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
const frameOf = (P) => P.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
const LAND = [1180, 820], PORT = [820, 1180];
const rotate = async (P, [w, h]) => { await P.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await sleep(500); };
const keyboard = async (P, px) => { await P.eval(`window.__wbKeyboard=${px}; visualViewport.dispatchEvent(new Event('resize')); true`); await sleep(350); };
const kbState = (P) => P.eval(`(()=>{const ta=document.querySelector('.text-editor'),bar=document.querySelector('.edit-bar'),done=bar&&bar.querySelector('[data-edit="done"]'),d=document.querySelector('.dock'),kb=window.__wbKeyboard||0,vis=innerHeight-kb;
  const r=ta&&ta.getBoundingClientRect(),dr=done&&done.getBoundingClientRect();
  return {open:document.querySelector('.board-app').classList.contains('kb-open'), ta:!!ta, value:ta&&ta.value, taTop:r&&Math.round(r.top), taBottom:r&&Math.round(r.bottom), vis, doneTop:dr&&Math.round(dr.top), doneBottom:dr&&Math.round(dr.bottom), doneText:done&&done.textContent.trim(),
    dockVis:getComputedStyle(d).visibility, shift:document.querySelector('.frame').style.transform||'', scroll:scrollY, active:document.activeElement===ta}})()`);

const c = await launch({ port: 9409 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(1500);

  /* ---------- Вход по имени ---------- */
  const S = await c.newPage('', { width: LAND[0], height: LAND[1], scale: 2, touch: true });
  await S.goto(U + '#/join/true-false'); await sleep(600);
  await S.tap(...(await ctr(S, '#f-name'))); await keyboard(S, 360);
  const jv = await S.eval(`(()=>{const i=document.querySelector('#f-name').getBoundingClientRect(),b=document.querySelector('#join [type="submit"]').getBoundingClientRect();return {i:i.top>=0, b:b.bottom}})()`);
  await S.send('Input.insertText', { text: 'Вика' });
  await S.tap(...(await ctr(S, '#join [type="submit"]'))); await sleep(900); await keyboard(S, 0);
  check('Вход по имени касанием', await S.eval(`!!document.querySelector('canvas.live') && JSON.parse(sessionStorage.getItem('wb:me:true-false')).name==='Вика'`));
  await S.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`);

  /* ---------- Стикер у нижнего края: клавиатура ---------- */
  let f = await frameOf(S); let P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
  await S.tap(...(await ctr(S, '[data-tool="sticky"]')));
  await S.tap(...P(300, 860)); await sleep(300);
  await keyboard(S, 360);
  let k = await kbState(S);
  check('Клавиатура: редактор стикера над клавиатурой (доска временно сдвинута)', k.ta && k.active && k.open && k.taBottom <= k.vis && k.taTop >= 0 && /translateY\(-\d+px\)/.test(k.shift), JSON.stringify({ taTop: k.taTop, taBottom: k.taBottom, vis: k.vis, shift: k.shift }));
  check('Кнопка «Готово» видна над клавиатурой', k.doneText === 'Готово' && k.doneTop >= 0 && k.doneBottom <= k.vis, `${k.doneTop}–${k.doneBottom} / ${k.vis}`);
  check('Панель инструментов спрятана, пока открыта клавиатура', k.dockVis === 'hidden');
  await S.send('Input.insertText', { text: 'Первая часть' }); await sleep(150);
  await S.shot(SHOTS + '/ipad-keyboard-sticky-landscape.png');

  /* ---------- Поворот во время набора ---------- */
  await rotate(S, PORT); await keyboard(S, 300);
  k = await kbState(S);
  f = await frameOf(S); P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
  const taPos = await S.eval(`(()=>{const r=document.querySelector('.text-editor').getBoundingClientRect(),fr=document.querySelector('.frame').getBoundingClientRect();return [(r.left-fr.left)/(fr.width/1600),(r.top-fr.top)/(fr.width/1600)]})()`);
  check('Поворот с открытой клавиатурой: набранный текст сохранён, фокус в редакторе', k.ta && k.value === 'Первая часть' && k.active, k.value);
  check('После поворота редактор на месте стикера и над клавиатурой', Math.abs(taPos[0] - 150) < 3 && k.taBottom <= k.vis && k.taTop >= 0, `доска ${taPos.map(Math.round).join(',')}; ${k.taTop}–${k.taBottom} / ${k.vis}`);
  await S.send('Input.insertText', { text: ' и вторая' }); await sleep(150);
  await S.shot(SHOTS + '/ipad-keyboard-sticky-portrait.png');
  await S.tap(...(await ctr(S, '.edit-bar [data-edit="done"]'))); await sleep(300);
  await keyboard(S, 0);
  k = await kbState(S);
  const st = (await board(S)).elements.find((e) => e.type === 'sticky' && e.text.startsWith('Первая'));
  check('«Готово» сохраняет весь текст стикера', st && st.text === 'Первая часть и вторая', st && st.text);
  check('Клавиатура закрыта: панель снова доступна, сдвиг и прокрутка сброшены', !k.ta && !k.open && k.dockVis === 'visible' && k.shift === '' && k.scroll === 0, JSON.stringify(k));

  /* ---------- Рисование после клавиатуры: точность касания ---------- */
  const stroke = async (bx, by) => {
    f = await frameOf(S); P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
    const n0 = (await board(S)).elements.length;
    await S.touchPath([P(bx, by), P(bx + 40, by + 5), P(bx + 80, by + 10), P(bx + 120, by)]); await sleep(300);
    const el = (await board(S)).elements.slice(-1)[0];
    return { added: (await board(S)).elements.length === n0 + 1, dx: Math.abs(el.pts[0] - bx), dy: Math.abs(el.pts[1] - by), lx: Math.abs(el.pts[el.pts.length - 2] - (bx + 120)), ly: Math.abs(el.pts[el.pts.length - 1] - by) };
  };
  await S.tap(...(await ctr(S, '[data-tool="pen"]')));
  let s1 = await stroke(1150, 900);
  check('Книжная: штрих ложится точно под пальцем', s1.added && Math.max(s1.dx, s1.dy, s1.lx, s1.ly) < 1.5, JSON.stringify(s1));
  await rotate(S, LAND);
  s1 = await stroke(1150, 960);
  check('Альбомная: штрих ложится точно под пальцем', s1.added && Math.max(s1.dx, s1.dy, s1.lx, s1.ly) < 1.5, JSON.stringify(s1));
  const stickyPx = await S.eval(`(()=>{const c=document.querySelector('canvas.base'),k=c.width/1600;return [...c.getContext('2d').getImageData(Math.round(${st.x + 12}*k),Math.round(${st.y + st.h - 10}*k),1,1).data].slice(0,3).join(',')})()`);
  check('Стикер и изображение сохранили взаимное положение после поворотов', stickyPx === '255,242,179' && (await board(S)).elements.find((e) => e.id === st.id).x === st.x, stickyPx);

  /* ---------- Поворот сохраняет инструмент и выделение ---------- */
  await S.tap(...(await ctr(S, '[data-tool="select"]')));
  f = await frameOf(S); P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
  await S.tap(...P(st.x + 40, st.y + 30)); await sleep(250);
  for (const dim of [PORT, LAND]) {
    await rotate(S, dim);
    const sel = await S.eval(`(()=>{const sb=document.querySelector('.selbar'); if(!sb) return null; const r=sb.getBoundingClientRect(),fr=document.querySelector('.frame').getBoundingClientRect(),k=fr.width/1600;
      return {tool:document.querySelector('[data-tool="select"]').getAttribute('aria-pressed'), near:Math.abs((r.left+r.width/2)-(fr.left+(${st.x}+${st.w}/2)*k))<${st.w}*k/2+120, inView:r.left>=0&&r.right<=innerWidth&&r.top>=0}})()`);
    check(`Поворот в ${dim[0] > dim[1] ? 'альбомную' : 'книжную'}: инструмент «Выделение» и выделенный стикер сохранены, панель рядом`, sel && sel.tool === 'true' && sel.near && sel.inView, JSON.stringify(sel));
  }
  await S.shot(SHOTS + '/ipad-landscape-selected.png');

  /* ---------- Шапка в книжной: компактно, «Задание» доступно ---------- */
  for (const [P2, who] of [[S, 'ученик']]) {
    await rotate(P2, PORT);
    const g = await P2.eval(`(()=>{const t=document.querySelector('[data-action="task"]').getBoundingClientRect(),c=document.querySelector('.tb-center .group').getBoundingClientRect(),l=document.querySelector('.tb-left').getBoundingClientRect(),r=document.querySelector('.tb-right').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect();
      return {task:t.width>=44&&t.height>=44&&t.left>=0&&t.right<=innerWidth, noOverlap:l.right<=c.left&&r.left>=c.right&&r.right<=innerWidth, dockCenter:Math.abs((d.left+d.right)/2-innerWidth/2)<1.5, dockFits:d.left>=0&&d.right<=innerWidth}})()`);
    check(`Книжная (${who}): «Задание» видно, верхние блоки не перекрываются, нижняя панель по центру`, g.task && g.noOverlap && g.dockCenter && g.dockFits, JSON.stringify(g));
    await P2.shot(SHOTS + '/ipad-portrait-student-ru.png');
  }
  const TI = await c.newPage('', { width: PORT[0], height: PORT[1], scale: 2, touch: true });
  await TI.goto(U + '#/demo/teacher?lang=ru'); await sleep(1400);
  const tg = await TI.eval(`(()=>{const t=document.querySelector('[data-action="task"]').getBoundingClientRect(),c=document.querySelector('.tb-center .group').getBoundingClientRect(),l=document.querySelector('.tb-left').getBoundingClientRect(),r=document.querySelector('.tb-right').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect();
    return {task:t.width>=44&&t.left>=0, compact:[...document.querySelectorAll('.tb-center .gbtn')].every(b=>b.getBoundingClientRect().width<=48), noOverlap:l.right<=c.left&&r.left>=c.right&&r.right<=innerWidth, dockCenter:Math.abs((d.left+d.right)/2-innerWidth/2)<1.5, dockFits:d.left>=0&&d.right<=innerWidth}})()`);
  check('Книжная (учитель): действия сгруппированы иконками, «Задание» видно, док по центру', tg.task && tg.compact && tg.noOverlap && tg.dockCenter && tg.dockFits, JSON.stringify(tg));
  await TI.shot(SHOTS + '/ipad-portrait-teacher-ru.png');
  // Задание учителя с клавиатурой
  await TI.tap(...(await ctr(TI, '[data-action="task"]'))); await sleep(250);
  await TI.tap(...(await ctr(TI, '#task-edit'))); await keyboard(TI, 300);
  const tk = await TI.eval(`(()=>{const r=document.querySelector('#task-edit').getBoundingClientRect(),b=document.querySelector('.task-form [type="submit"]').getBoundingClientRect();return {ta:r.bottom<=innerHeight-300&&r.top>=0, btn:b.bottom<=innerHeight-300, active:document.activeElement.id==='task-edit'}})()`);
  check('Задание учителя: поле и «Сохранить» видны над клавиатурой', tk.ta && tk.btn && tk.active, JSON.stringify(tk));
  // Текст учителя у нижнего края в книжной
  await keyboard(TI, 0); await TI.tap(...(await ctr(TI, '[data-action="task"]'))); await sleep(200);
  await TI.tap(...(await ctr(TI, '[data-tool="text"]')));
  let tf = await frameOf(TI);
  await TI.tap(tf[0] + 900 * tf[2], tf[1] + 950 * tf[2]); await sleep(300);
  await keyboard(TI, 300);
  k = await kbState(TI);
  check('Подпись у нижнего края (книжная): редактор и «Готово» над клавиатурой', k.ta && k.taBottom <= k.vis && k.doneBottom <= k.vis && k.doneTop >= 0, `${k.taTop}–${k.taBottom}, «Готово» ${k.doneTop}–${k.doneBottom} / ${k.vis}`);
  await TI.send('Input.insertText', { text: 'Good job' });
  await rotate(TI, LAND); await keyboard(TI, 360);
  k = await kbState(TI);
  check('Подпись: поворот с клавиатурой сохраняет текст, редактор над клавиатурой', k.value === 'Good job' && k.taBottom <= k.vis, `${k.value}; ${k.taBottom} / ${k.vis}`);
  await TI.tap(...(await ctr(TI, '.edit-bar [data-edit="done"]'))); await sleep(300); await keyboard(TI, 0);
  check('«Готово» сохраняет подпись', (await board(TI)).elements.some((e) => e.type === 'text' && e.text === 'Good job'));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
