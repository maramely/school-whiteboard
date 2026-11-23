// Экран ученика: шапка (дата и время · «Задание» · «Стереть мои записи» и «Выйти»), без RU/EN;
// все инструменты учителя, свои объекты — выделить, двигать, править; ластик только по своим штрихам;
// штампы 👍 🙂 ❤️ 🔥 и галочка в мятном квадрате. Две ученические вкладки: стирание только своей работы, выход сохраняет вклад.
// Запуск: node server.js  →  node tools/e2e-student.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const SHOTS = root + 'screenshots';
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const board = (P) => P.eval(`JSON.parse(localStorage.getItem('wb:board:true-false'))`);
const ctr = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
const frameOf = (P) => P.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
const mine = (b, pid) => b.elements.filter((e) => e.author === pid);
const header = (P) => P.eval(`(()=>{const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return {l:b.left,r:b.right,t:b.top,b:b.bottom}};
  return {vw:innerWidth, vh:innerHeight, left:r('.tb-left'), center:r('.tb-center .group'), right:r('.tb-right'), dock:r('.dock'), title:document.querySelector('.tb-title h1').textContent,
  center_btns:[...document.querySelectorAll('.tb-center .gbtn')].filter(b=>b.offsetParent).map(b=>b.dataset.action).join(), right_btns:[...document.querySelectorAll('.tb-right .btn')].map(b=>b.dataset.action+':'+b.innerText.trim()).join('|'),
  lang:!!document.querySelector('.lang,[data-lang]'), small:[...document.querySelectorAll('.topbar button, .dock button')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(q=>Math.min(q.width,q.height)<44).length}})()`);

const c = await launch({ port: 9406 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(1500);
  const teacherTitle = await T.eval(`document.querySelector('.tb-title h1').textContent`);
  const A = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await A.goto(U + '#/demo/student?name=Аня'); await sleep(1300);
  const B = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await B.goto(U + '#/demo/student?name=Миша'); await sleep(1300);
  const pidA = await A.eval(`JSON.parse(sessionStorage.getItem('wb:me:true-false')).pid`), pidB = await B.eval(`JSON.parse(sessionStorage.getItem('wb:me:true-false')).pid`);
  await A.bringToFront(); await A.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`);

  /* ---------- Шапка ---------- */
  for (const [w, h, name] of [[1180, 820, 'iPad альбомная'], [820, 1180, 'iPad книжная']]) {
    await A.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await sleep(500);
    const g = await header(A);
    if (w === 1180) {
      check('Слева дата и время сессии в формате учителя', g.title === teacherTitle, g.title);
      check('По центру «Задание», справа «Стереть мои записи» и «Выйти», без RU/EN', g.center_btns === 'task' && g.right_btns === 'erase-mine:Стереть мои записи|leave:Выйти' && !g.lang, g.right_btns);
    }
    const cc = (g.center.l + g.center.r) / 2, dc = (g.dock.l + g.dock.r) / 2;
    check(`${name}: «Задание» и нижняя панель по центру, блоки не перекрываются, всё на экране`, Math.abs(cc - g.vw / 2) < 1.5 && Math.abs(dc - g.vw / 2) < 1.5 && g.left.r <= g.center.l && g.right.l >= g.center.r && g.right.r <= g.vw && g.dock.l >= 0 && g.dock.r <= g.vw && g.dock.b <= g.vh, `центр ${cc} док ${dc} / ${g.vw / 2}; L ${Math.round(g.left.r)}≤${Math.round(g.center.l)} R ${Math.round(g.right.l)}≥${Math.round(g.center.r)}, док ${Math.round(g.dock.l)}–${Math.round(g.dock.r)}`);
    check(`${name}: все цели ≥ 44×44`, g.small === 0, String(g.small));
    // Палитра штампов
    await A.tap(...(await ctr(A, '[data-tool="stamp"]'))); await sleep(300);
    const pal = await A.eval(`(()=>{const f=document.querySelector('.flyout'),r=f.getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect(),bs=[...f.querySelectorAll('.react-btn')],rs=bs.map(b=>b.getBoundingClientRect());
      return {open:!f.hidden, up:r.bottom<=d.top, fits:r.top>=0&&r.left>=0&&r.right<=innerWidth, vertical:rs.every(q=>Math.abs(q.left-rs[0].left)<1)&&rs[4].top>rs[3].top, kinds:bs.map(b=>b.dataset.react).join(), emoji:bs.map(b=>b.textContent.trim()).join(''), svg:!!bs[4].querySelector('svg.react-check'), circles:!!f.querySelector('.react-ic, circle')}})()`);
    check(`${name}: вертикальная палитра штампов раскрывается вверх и помещается`, pal.open && pal.up && pal.fits && pal.vertical, JSON.stringify(pal));
    if (w === 1180) {
      check('Ученику 5 штампов: 👍 🙂 ❤️ 🔥 и галочка в мятном квадрате, без 💯 и круглых подложек', pal.kinds === 'like,smile,heart,fire,check' && pal.emoji === '👍🙂❤️🔥' && pal.svg && !pal.circles, pal.kinds + ' ' + pal.emoji);
      await A.shot(SHOTS + '/ipad-student-stamps-ru.png');
    } else await A.shot(SHOTS + '/ipad-portrait-student-stamps-ru.png');
    await A.tap(...(await ctr(A, '[data-tool="stamp"]'))); await sleep(200);
  }
  await A.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 2, mobile: false }); await sleep(500);
  check('Нижняя панель как у учителя: отмена, повтор, перо, цвет, выделение, ластик, текст, стикер, штампы', (await A.eval(`[...document.querySelectorAll('.dock button')].map(b=>b.dataset.action||b.dataset.tool).join()`)) === 'undo,redo,pen,color,select,eraser,text,sticky,stamp');
  const tStyle = await T.eval(`(()=>{const b=document.querySelector('.dock [data-tool="pen"]'),s=getComputedStyle(b);return [s.width,s.height,s.borderRadius,getComputedStyle(document.querySelector('.dock')).borderRadius].join()})()`);
  const aStyle = await A.eval(`(()=>{const b=document.querySelector('.dock [data-tool="pen"]'),s=getComputedStyle(b);return [s.width,s.height,s.borderRadius,getComputedStyle(document.querySelector('.dock')).borderRadius].join()})()`);
  check('Те же размеры и состояния кнопок, что у учителя', tStyle === aStyle, aStyle);

  /* ---------- Задание касанием ---------- */
  await A.tap(...(await ctr(A, '[data-action="task"]'))); await sleep(300);
  check('Касание «Задание» открывает текст учителя', await A.eval(`!document.querySelector('#task-pop').hidden && document.querySelector('.task-text').textContent.startsWith('Read the text about Mia')`));
  await A.shot(SHOTS + '/ipad-student-task-ru.png');
  await A.tap(...(await ctr(A, '[data-action="task"]'))); await sleep(200);

  /* ---------- Работа Ани и Миши ---------- */
  let f = await frameOf(A); const PA = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
  await A.tap(...(await ctr(A, '[data-tool="pen"]')));
  await A.touchPath([PA(120, 900), PA(200, 910), PA(280, 900)]); await sleep(200);
  await A.tap(...(await ctr(A, '[data-tool="text"]')));
  await A.tap(...PA(700, 960)); await sleep(300);
  await A.send('Input.insertText', { text: 'Аня: готово' }); await A.eval(`document.activeElement.blur(); true`); await sleep(300);
  await A.tap(...(await ctr(A, '[data-tool="sticky"]')));
  await A.tap(...PA(400, 40 + 75)); await sleep(300);
  await A.send('Input.insertText', { text: 'Вопрос к 4' }); await A.eval(`document.activeElement.blur(); true`); await sleep(300);
  await A.tap(...(await ctr(A, '[data-tool="stamp"]'))); await sleep(250);
  await A.tap(...(await ctr(A, '[data-react="fire"]'))); await sleep(150);
  await A.tap(...PA(1540, 960)); await sleep(300);
  await A.tap(...(await ctr(A, '[data-tool="stamp"]'))); await sleep(250);
  await A.tap(...(await ctr(A, '[data-react="check"]'))); await sleep(150);
  await A.tap(...PA(1540, 860)); await sleep(300);
  let b = await board(A);
  const aTypes = mine(b, pidA).map((e) => e.type + (e.kind ? ':' + e.kind : '')).sort().join();
  check('Аня: штрих, подпись, стикер и штампы 🔥 и галочка', ['pen', 'text', 'sticky', 'stamp:fire', 'stamp:check'].every((k) => aTypes.includes(k)), aTypes);

  await B.bringToFront(); await sleep(400);
  let g2 = await frameOf(B); const PB = (x, y) => [g2[0] + x * g2[2], g2[1] + y * g2[2]];
  await B.tap(...(await ctr(B, '[data-tool="pen"]')));
  await B.touchPath([PB(120, 960), PB(200, 965), PB(300, 960)]); await sleep(200);
  await B.tap(...(await ctr(B, '[data-tool="stamp"]'))); await sleep(250);
  await B.tap(...(await ctr(B, '[data-react="like"]'))); await sleep(150);
  await B.tap(...PB(1460, 960)); await sleep(300);
  b = await board(B);
  const bStroke = mine(b, pidB).find((e) => e.type === 'pen' && e.pts[0] > 110 && e.pts[0] < 130 && e.pts[1] > 950);
  const bLike = mine(b, pidB).find((e) => e.type === 'stamp');
  check('Миша: штрих и штамп 👍', !!bStroke && bLike && bLike.kind === 'like');

  /* ---------- Аня: выделение своих объектов, чужие не трогаются ---------- */
  await A.bringToFront(); await sleep(500);
  b = await board(A);
  const aSticky = mine(b, pidA).find((e) => e.type === 'sticky'), aText = mine(b, pidA).find((e) => e.type === 'text');
  await A.tap(...(await ctr(A, '[data-tool="select"]')));
  const s0 = PA(aSticky.x + 40, aSticky.y + 30);
  await A.touchPath(Array.from({ length: 8 }, (_, i) => [s0[0] + i * 10, s0[1] + i * 6])); await sleep(300);
  const moved = (await board(A)).elements.find((e) => e.id === aSticky.id);
  check('Аня двигает свой стикер', moved.x > aSticky.x + 30 && moved.y > aSticky.y + 20, `${aSticky.x},${aSticky.y} → ${Math.round(moved.x)},${Math.round(moved.y)}`);
  await A.tap(...PA(1460, 960)); await sleep(250);
  check('Чужой штамп Миши стрелкой не выделяется', !(await A.eval(`!!document.querySelector('.selbar')`)));
  await A.touchPath([PA(1460, 960), PA(1420, 930), PA(1380, 900)]); await sleep(250);
  check('…и не сдвигается', (await board(A)).elements.find((e) => e.id === bLike.id).x === bLike.x);
  await A.tap(...PA(aText.x + 20, aText.y + aText.bh / 2)); await sleep(250);
  check('Своя подпись: «Редактировать» и цвета букв', await A.eval(`!!document.querySelector('.selbar [data-action="sel-edit"]') && document.querySelectorAll('.selbar [data-text-color]').length===6`));
  await A.tap(...(await ctr(A, '.selbar [data-text-color="#AF52DE"]'))); await sleep(300);
  check('Аня меняет цвет своей подписи', (await board(A)).elements.find((e) => e.id === aText.id).color === '#AF52DE');
  await A.tap(...(await ctr(A, '.selbar [data-action="sel-edit"]'))); await sleep(300);
  await A.eval(`(()=>{const t=document.activeElement; t.value='Аня: всё готово'; t.dispatchEvent(new Event('input')); t.blur(); return true})()`); await sleep(300);
  check('Аня правит текст своей подписи', (await board(A)).elements.find((e) => e.id === aText.id).text === 'Аня: всё готово');
  // Ластик Ани по штриху Миши
  await A.tap(...(await ctr(A, '[data-tool="eraser"]')));
  const bBefore = JSON.stringify(mine(await board(A), pidB));
  await A.touchPath([PA(200, 940), PA(200, 965), PA(200, 990)]); await sleep(300);
  check('Ластик Ани не стирает штрихи Миши', JSON.stringify(mine(await board(A), pidB)) === bBefore);

  /* ---------- Стереть мои записи ---------- */
  b = await board(A);
  const teacherBefore = b.elements.filter((e) => e.author === 'teacher').length, imgBefore = JSON.stringify(b.image), bCount = mine(b, pidB).length, aCount = mine(b, pidA).length;
  await A.tap(...(await ctr(A, '[data-action="erase-mine"]'))); await sleep(300);
  const em = await A.eval(`[document.querySelector('.modal h2').textContent, [...document.querySelectorAll('.modal .modal-actions .btn')].map(b=>b.textContent.trim()).join('|')]`);
  check('Подтверждение «Стереть все твои записи на доске?» — «Отмена» и «Стереть»', em[0] === 'Стереть все твои записи на доске?' && em[1] === 'Отмена|Стереть', em.join(' / '));
  await A.shot(SHOTS + '/ipad-student-erase-confirm-ru.png');
  await A.tap(...(await ctr(A, '.modal .modal-actions .btn'))); await sleep(250);
  check('«Отмена» ничего не стирает', mine(await board(A), pidA).length === aCount);
  await A.tap(...(await ctr(A, '[data-action="erase-mine"]'))); await sleep(300);
  await A.tap(...(await ctr(A, '.modal .btn-danger'))); await sleep(400);
  b = await board(A);
  check('Стёрта только работа Ани', aCount > 0 && mine(b, pidA).length === 0, `было ${aCount}`);
  check('Работа Миши, учителя и изображение на месте', mine(b, pidB).length === bCount && b.elements.filter((e) => e.author === 'teacher').length === teacherBefore && JSON.stringify(b.image) === imgBefore, `Миша ${bCount}, учитель ${teacherBefore}`);
  await B.bringToFront(); await sleep(500);
  check('Вкладка Миши: его работа видна, работы Ани нет', mine(await board(B), pidB).length === bCount && mine(await board(B), pidA).length === 0);

  /* ---------- Выйти ---------- */
  await T.bringToFront(); await sleep(5200);
  const before = await T.eval(`document.querySelector('.people-count').textContent`);
  await B.bringToFront();
  await B.tap(...(await ctr(B, '[data-action="leave"]'))); await sleep(300);
  const lm = await B.eval(`[document.querySelector('.modal h2').textContent, [...document.querySelectorAll('.modal .modal-actions .btn')].map(b=>b.textContent.trim()).join('|')]`);
  check('Подтверждение «Ты уверен, что хочешь выйти?» — «Отмена» и «Выйти»', lm[0] === 'Ты уверен, что хочешь выйти?' && lm[1] === 'Отмена|Выйти', lm.join(' / '));
  await B.tap(...(await ctr(B, '.modal .modal-actions .btn'))); await sleep(250);
  check('«Отмена» оставляет ученика на доске', await B.eval(`!!document.querySelector('canvas.live')`));
  await B.tap(...(await ctr(B, '[data-action="leave"]'))); await sleep(300);
  await B.tap(...(await ctr(B, '.modal .btn-primary'))); await sleep(600);
  check('После выхода — экран «Вы вышли из сессии» с «Войти снова»', await B.eval(`/Вы вышли из сессии/.test(document.querySelector('h1').textContent) && !!document.querySelector('#rejoin') && !document.querySelector('canvas.live')`));
  check('Вклад Миши остался на доске', mine(await board(B), pidB).length === bCount);
  await T.bringToFront(); await sleep(5600);
  const after = await T.eval(`document.querySelector('.people-count').textContent`);
  check('Учитель видит, что ученик вышел', +after === +before - 1, `${before} → ${after}`);
  const tPx = await T.eval(`(()=>{const c=document.querySelector('canvas.base'),k=c.width/1600,g=c.getContext('2d');let n=0;const d=g.getImageData(Math.round(1430*k),Math.round(930*k),Math.round(60*k),Math.round(60*k)).data;for(let i=0;i<d.length;i+=4) if(d[i]>200&&d[i+1]>150&&d[i+1]<220&&d[i+2]<90) n++;return n})()`);
  check('На доске учителя штамп 👍 Миши по-прежнему виден (полноцветный эмодзи)', tPx > 50, `${tPx} жёлтых px`);
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
