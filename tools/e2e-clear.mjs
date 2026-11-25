// Верхняя панель учителя: «Очистить доску» (BrushCleaning, нейтральная, с подписью, подтверждение) и «Завершить урок».
// Hover, tooltip (мышь и клавиатура, края экрана), focus-visible только с клавиатуры.
// Очистка — одна операция истории: «Отменить» возвращает рисунки всех участников И изображение, без рассинхронизации
// с учеником; новое изображение, загруженное после очистки, отмена не затирает. Клавиатура и фокус. Иконки ученика и активный инструмент.
// Запуск: node server.js  →  node tools/e2e-clear.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const IMG = root + 'public/worksheet-true-false.png';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const ctr = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
const state = (P, id) => P.eval(`(()=>{const b=JSON.parse(localStorage.getItem('wb:board:${id}'));return {n:b.elements.length, authors:b.elements.map(e=>e.author).sort().join(','), img:b.image&&b.image.imgId||null, locked:!!(b.image&&b.image.locked)}})()`);
const draw = async (P, x0, y0) => { const f = await P.eval(`(()=>{const r=document.querySelector('canvas.live').getBoundingClientRect();return [r.left,r.top]})()`);
  await P.mouseDrag([[f[0] + x0, f[1] + y0], [f[0] + x0 + 60, f[1] + y0 + 20], [f[0] + x0 + 120, f[1] + y0 - 10]]); await sleep(250); };
const upload = async (P) => { const { root: d } = await P.send('DOM.getDocument'); const { nodeId } = await P.send('DOM.querySelector', { nodeId: d.nodeId, selector: '#file' });
  await P.send('DOM.setFileInputFiles', { nodeId, files: [IMG] });
  for (let i = 0; i < 40 && !(await P.eval(`(()=>{const b=document.querySelector('[data-img="place"]');return !!b&&!!b.offsetParent})()`)); i++) await sleep(150);
  // «Разместить», пока изображение не закрепится (кнопка становится активной не сразу)
  for (let i = 0; i < 10 && !(await P.eval(`(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('wb:board:'));const b=JSON.parse(localStorage.getItem(k));return !!(b.image&&b.image.locked)})()`)); i++) { await sleep(250); const b = await P.eval(`(()=>{const b=document.querySelector('[data-img="place"]');if(!b||!b.offsetParent)return null;const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); if (b) await P.click(...b); }
  await sleep(300); };
const OUT = root + 'screenshots/topbar-after/'; (await import('node:fs')).mkdirSync(OUT, { recursive: true });
const shotTop = async (P, name) => { const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 120, scale: 2 } }); (await import('node:fs')).writeFileSync(OUT + name, Buffer.from(data, 'base64')); };
const shotDock = async (P, name) => { const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 360, y: 760, width: 1080, height: 140, scale: 2 } }); (await import('node:fs')).writeFileSync(OUT + name, Buffer.from(data, 'base64')); };
const c = await launch({ port: 9531 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/?lang=ru'); await sleep(300);
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(1200);
  const id = await T.eval(`location.hash.split('/')[2]`);
  const link = await T.eval(`document.querySelector('.link-field').value`);
  await T.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); document.querySelectorAll('[aria-expanded=true]').forEach(b=>b.setAttribute('aria-expanded','false')); document.activeElement.blur(); true`);

  // Разметка панели
  const bar = await T.eval(`(()=>{const q=s=>document.querySelector(s);const c=q('[data-action=clear]'),e=q('[data-action=end]'),cs=getComputedStyle(c),ci=getComputedStyle(c.querySelector('.ic'));
    const lbl=c.querySelector('.lbl-stack > span:not([data-off])');
    return {inBar:c.parentElement.classList.contains('tb-right'), icon:c.querySelector('[data-icon]').dataset.icon, label:lbl&&lbl.offsetWidth>0?lbl.textContent:null, color:cs.color, icColor:ci.color, bg:cs.backgroundColor, shadow:cs.boxShadow.includes('225, 222, 238'),
      more:!!q('[data-action=more]'), end:e.textContent.replace(/\\s+/g,' ').includes('Завершить урок')&&e.querySelector('[data-icon]').dataset.icon==='flag', endBg:getComputedStyle(e).backgroundColor, endColor:getComputedStyle(e).color,
      gap:Math.round(e.getBoundingClientRect().left-c.getBoundingClientRect().right),
      heights:[...document.querySelectorAll('.topbar .icon-btn, .topbar .group, .topbar .btn')].filter(x=>x.offsetParent&&!x.closest('.popover')).map(x=>Math.round(x.getBoundingClientRect().height))}})()`);
  check('«Очистить доску» в панели: BrushCleaning + полная подпись, меню «Ещё» нет', bar.inBar && bar.icon === 'brushCleaning' && bar.label === 'Очистить доску' && !bar.more, JSON.stringify(bar));
  check('«Очистить доску» нейтральная: тёмные текст и иконка, белый фон, тонкая рамка', bar.color === 'rgb(54, 48, 82)' && bar.icColor === 'rgb(54, 48, 82)' && bar.bg === 'rgb(255, 255, 255)' && bar.shadow);
  check('«Завершить урок» с флажком, светло-лавандовая заливка, тёмный текст', bar.end && bar.endBg === 'rgb(238, 235, 255)' && bar.endColor === 'rgb(54, 48, 82)', `${bar.endBg} / ${bar.endColor}`);
  check('Между «Очистить доску» и «Завершить урок» 12 px', bar.gap === 12, bar.gap + ' px');
  check('Все элементы верхней панели одной высоты 44 px', bar.heights.every((v) => v === 44), bar.heights.join(','));

  // Ученик рисует, учитель рисует и кладёт изображение
  const S = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await S.goto(link.replace(/^https?:\/\/[^/]+\//, U)); await sleep(700);
  await S.eval(`(()=>{const i=document.querySelector('input');i.value='Аня';document.querySelector('form').requestSubmit();return true})()`); await sleep(1200);
  await S.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`);
  const sIcons = await S.eval(`({erase:document.querySelector('[data-action=erase-mine] [data-icon]').dataset.icon, tool:document.querySelector('[data-tool=eraser] [data-icon]').dataset.icon})`);
  check('Ученик: «Стереть мои записи» — BrushCleaning, инструмент «Ластик» — Eraser', sIcons.erase === 'brushCleaning' && sIcons.tool === 'eraser', JSON.stringify(sIcons));
  await draw(S, 200, 300);
  await T.send('Page.bringToFront'); await draw(T, 300, 150);
  await upload(T);
  let st = await state(T, id);
  check('До очистки: 2 штриха (учитель и ученик) и закреплённое изображение', st.n === 2 && st.authors.includes('teacher') && !!st.img && st.locked, JSON.stringify(st));
  const img1 = st.img;
  const act = await T.eval(`(()=>{const b=document.querySelector('.tool[aria-pressed=true]');return {tool:b.dataset.tool,color:getComputedStyle(b).color,bg:getComputedStyle(b).backgroundColor}})()`);
  check('Активный инструмент: иконка #6A57C2 на лавандовой подложке', act.color === 'rgb(106, 87, 194)' && act.bg === 'rgb(228, 223, 253)', JSON.stringify(act));

  // Наведение мышью: лёгкая лавандовая подложка, без кольца и без подсказки (подпись видна)
  await T.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (await ctr(T, '[data-action=clear]'))[0], y: (await ctr(T, '[data-action=clear]'))[1] }); await sleep(700);
  let hv = await T.eval(`(()=>{const c=document.querySelector('[data-action=clear]');const t=document.querySelector('.tip');return {bg:getComputedStyle(c).backgroundColor, outline:getComputedStyle(c).outlineStyle, tip:!!t&&!t.hidden}})()`);
  check('Hover «Очистить доску»: лавандовая подложка, без фиолетовой рамки и без лишней подсказки', hv.bg === 'rgb(238, 235, 255)' && hv.outline === 'none' && !hv.tip, JSON.stringify(hv));
  await shotTop(T, 'state-hover-clear.png');

  // Клик мышью → подтверждение → «Отмена» мышью: доска не изменилась, фокус на кнопке без кольца
  await T.click(...(await ctr(T, '[data-action=clear]'))); await sleep(300);
  const dlg = await T.eval(`(()=>{const m=document.querySelector('.modal');return m&&{title:m.querySelector('#m-title').textContent, danger:!!m.querySelector('.btn-danger'), primaryRing:getComputedStyle(document.activeElement).outlineStyle}})()`);
  check('Подтверждение очистки сохранено: «Очистить доску?», красная кнопка только в диалоге; после клика мышью без кольца', dlg && dlg.title === 'Очистить доску?' && dlg.danger && dlg.primaryRing === 'none', JSON.stringify(dlg));
  await T.click(...(await ctr(T, '.modal .btn:not(.btn-danger)'))); await sleep(250);
  st = await state(T, id);
  const fq = await T.eval(`({on:document.activeElement.dataset.action, outline:getComputedStyle(document.activeElement).outlineStyle})`);
  check('«Отмена» мышью: доска не изменилась, фокус на «Очистить доску» без фиолетовой рамки', st.n === 2 && st.img === img1 && fq.on === 'clear' && fq.outline === 'none', JSON.stringify({ st, fq }));

  // Очистка
  const doClear = async () => { await T.click(...(await ctr(T, '[data-action=clear]'))); await sleep(300); await T.click(...(await ctr(T, '.modal .btn-danger'))); await sleep(400); };
  await doClear();
  st = await state(T, id);
  const toast = await T.eval(`(()=>{const t=[...document.querySelectorAll('.toast')].pop();return t&&{text:t.textContent, btn:!!t.querySelector('.toast-btn')}})()`);
  check('Очистить: штрихов нет, изображения нет; подсказка «Доска очищена» с «Вернуть»', st.n === 0 && !st.img && toast && toast.text.includes('Доска очищена') && toast.btn, JSON.stringify({ st, toast }));
  await sleep(400);
  let ss = await state(S, id);
  check('Ученик видит очищенную доску (то же состояние)', ss.n === 0 && !ss.img, JSON.stringify(ss));
  await S.send('Page.bringToFront'); await draw(S, 500, 400);
  st = await state(T, id);
  check('Новый штрих ученика после очистки сохранён', st.n === 1, JSON.stringify(st));
  await T.send('Page.bringToFront'); await T.click(...(await ctr(T, '[data-action=undo]'))); await sleep(400);
  st = await state(T, id); ss = await state(S, id);
  check('«Отменить» вернуло рисунки всех и изображение; новый штрих ученика не пропал', st.n === 3 && st.img === img1 && st.locked, JSON.stringify(st));
  check('У ученика то же состояние — без рассинхронизации', JSON.stringify(ss) === JSON.stringify(st), JSON.stringify(ss));
  await sleep(300);
  const pix = await T.eval(`(()=>{const c=document.querySelector('canvas:not(.live)');const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4*97)if(d[i]<240||d[i+1]<240||d[i+2]<240)n++;return n})()`);
  check('Изображение снова нарисовано на холсте', pix > 200, `${pix} непустых точек`);
  await T.click(...(await ctr(T, '[data-action=redo]'))); await sleep(300);
  st = await state(T, id);
  check('«Повторить» снова очищает (новый штрих ученика остаётся)', st.n === 1 && !st.img, JSON.stringify(st));
  await T.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', modifiers: 4, windowsVirtualKeyCode: 90 }); await T.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', modifiers: 4, windowsVirtualKeyCode: 90 }); await sleep(300);
  st = await state(T, id);
  check('⌘Z тоже возвращает рисунки и изображение', st.n === 3 && st.img === img1, JSON.stringify(st));
  await doClear();
  await T.eval(`(()=>{const b=[...document.querySelectorAll('.toast .toast-btn')].pop();b.click();return true})()`); await sleep(300);
  st = await state(T, id);
  check('«Вернуть» в подсказке восстанавливает рисунки и изображение', st.n === 3 && st.img === img1, JSON.stringify(st));
  await doClear();
  await upload(T);
  const img2 = (await state(T, id)).img;
  await T.click(...(await ctr(T, '[data-action=undo]'))); await sleep(300);
  st = await state(T, id);
  check('Изображение, загруженное после очистки, отмена очистки не затирает; рисунки вернулись', !!img2 && img2 !== img1 && st.img === img2 && st.n === 3, JSON.stringify({ st, img1, img2 }));

  // Подсказки мышью: кнопки без подписи — да; у края экрана не обрезаются
  const tipAt = async (P, sel) => { await P.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 450 }); await sleep(150); const [x, y] = await ctr(P, sel); await P.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(700);
    return P.eval(`(()=>{const t=document.querySelector('.tip');if(!t||t.hidden)return null;const r=t.getBoundingClientRect(),b=document.querySelector('${sel}').getBoundingClientRect();return {text:t.textContent,l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),vw:innerWidth,vh:innerHeight,side:t.dataset.side,above:r.bottom<=b.top,below:r.top>=b.bottom}})()`); };
  let tp = await tipAt(T, '[data-action=undo]');
  check('Tooltip «Отменить (⌘Z)» у кнопки дока: над панелью, в пределах экрана', tp && tp.text === 'Отменить (⌘Z)' && tp.above && tp.l >= 0 && tp.r <= tp.vw, JSON.stringify(tp));
  await shotDock(T, 'state-tooltip-undo.png');
  tp = await tipAt(T, '[data-action=people]');
  check('Tooltip «Ученики на доске: N учеников» у счётчика в правом углу не выходит за край', tp && /^Ученики на доске: \d+ учени/.test(tp.text) && tp.r <= tp.vw - 8 && tp.above, JSON.stringify(tp));
  tp = await tipAt(T, '.tb-left .icon-btn');
  check('Tooltip у «назад» (только иконка): под кнопкой, у левого края не обрезан', tp && tp.below && tp.l >= 8, JSON.stringify(tp));
  tp = await tipAt(T, '[data-action=end]');
  check('У кнопок с видимой подписью дублирующего tooltip нет', tp === null);
  await T.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 450 }); await sleep(200);
  { const q = await T.eval(`({tip:!!document.querySelector('.tip')&&!document.querySelector('.tip').hidden, tipText:document.querySelector('.tip')?.textContent, titled:[...document.querySelectorAll('.topbar button[title], .dock [title], .people-dock [title]')].map(e=>e.dataset.action||e.dataset.tool||e.className)})`);
  check('Уход курсора скрывает подсказку; нативных title у кнопок панелей нет', !q.tip && !q.titled.length, JSON.stringify(q)); }

  // Клавиатура: Tab до «Очистить доску» — кольцо; Enter — подтверждение; Esc — фокус вернулся с кольцом
  const key = async (P, k, code, vk, text) => { await P.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await P.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); await sleep(60); };
  await T.eval(`document.activeElement.blur(); true`);
  let guard = 0; do { await key(T, 'Tab', 'Tab', 9); } while (guard++ < 30 && !(await T.eval(`document.activeElement.dataset.action==='clear'`)));
  let kf = await T.eval(`({on:document.activeElement.dataset.action, ring:document.activeElement.matches(':focus-visible'), outline:getComputedStyle(document.activeElement).outlineStyle, tip:!!document.querySelector('.tip')&&!document.querySelector('.tip').hidden})`);
  check('Tab до «Очистить доску»: заметное кольцо focus-visible, без дублирующей подсказки', kf.on === 'clear' && kf.ring && kf.outline === 'solid' && !kf.tip, JSON.stringify(kf));
  await shotTop(T, 'state-focus-clear.png');
  await key(T, 'Enter', 'Enter', 13, '\r'); await sleep(250);
  check('Enter открывает подтверждение очистки', await T.eval(`document.querySelector('#m-title')?.textContent==='Очистить доску?'`));
  await key(T, 'Escape', 'Escape', 27); await sleep(250);
  kf = await T.eval(`({modal:!!document.querySelector('.modal'), on:document.activeElement.dataset.action, outline:getComputedStyle(document.activeElement).outlineStyle})`);
  check('Esc закрывает подтверждение, фокус вернулся на «Очистить доску» с кольцом', !kf.modal && kf.on === 'clear' && kf.outline === 'solid', JSON.stringify(kf));
  // Tab назад к «назад» (только иконка): кольцо + tooltip
  await T.eval(`document.querySelector('.tb-left .icon-btn').focus(); true`); await key(T, 'Tab', 'Tab', 9); await T.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await T.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await sleep(200);
  kf = await T.eval(`({cls:document.activeElement.className, ring:document.activeElement.matches(':focus-visible'), tip:document.querySelector('.tip')&&!document.querySelector('.tip').hidden?document.querySelector('.tip').textContent:null})`);
  check('Клавиатурный фокус на кнопке без подписи показывает tooltip', kf.cls.includes('icon-btn') && kf.ring && !!kf.tip, JSON.stringify(kf));
  await shotTop(T, 'state-focus-tooltip-back.png');

  // Завершить урок
  await T.click(...(await ctr(T, '[data-action=end]'))); await sleep(300);
  const endDlg = await T.eval(`document.querySelector('.modal #m-title').textContent`);
  await T.click(...(await ctr(T, '.modal .btn-primary, .modal .btn-danger'))); await sleep(900);
  const ended = await T.eval(`({status:JSON.parse(localStorage.getItem('wb:board:${id}')).status, result:!!document.querySelector('.card.result')})`);
  check('«Завершить урок» → подтверждение «Завершить сессию?» → экран результата', endDlg === 'Завершить сессию?' && ended.status === 'ended' && ended.result, JSON.stringify({ endDlg, ended }));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
