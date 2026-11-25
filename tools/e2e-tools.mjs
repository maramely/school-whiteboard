// Шапка на одной оси с доком, счётчик учеников с отключением, выделение, текст, стикер, смайлики, PNG.
// Проверяется в размерах MacBook (1440×900) и iPad (1180×820), RU и EN.
// Запуск: node server.js  →  node tools/e2e-tools.mjs [папка-для-артефактов]
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = process.argv[2] || root + 'tools/e2e-out';
const DL = OUT + '/downloads-tools'; rmSync(DL, { recursive: true, force: true }); mkdirSync(DL, { recursive: true });
const SHOTS = root + 'screenshots';
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const setLang = (P, l) => P.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=${l}'; return true})()`);
const board = (P) => P.eval(`JSON.parse(localStorage.getItem('wb:board:true-false'))`);
const ctr = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
const geo = (P) => P.eval(`(()=>{const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return {l:b.left,r:b.right,t:b.top,b:b.bottom}}; return {vw:innerWidth, vh:innerHeight, left:r('.tb-left'), center:r('.tb-center .group'), right:r('.tb-right'), dock:r('.dock'), people:r('.people-dock')}})()`);

const c = await launch({ port: 9390, downloads: DL });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  // Доска без контекста урока: только дата и время
  await T.goto(U + '#/?lang=ru'); await sleep(400);
  check('Стартовая учителя: без полей предмета/темы и без RU/EN', await T.eval(`!document.querySelector('.lang') && document.querySelectorAll('#create-form input, #create-form textarea').length===1`));
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const plain = await T.eval(`[document.querySelector('.tb-title h1').textContent, !!document.querySelector('.tb-sub')]`);
  check('Без контекста урока — только дата и время, без слов «Доска» и «Учитель»', /^\d{1,2} [а-я]+, \d\d:\d\d$/.test(plain[0]) && !plain[1] && !(await T.eval(`/Доска|Учитель/.test(document.querySelector('.tb-left').innerText)`)), plain[0]);

  // Демо-урок: «Английский язык · дата, время» / «True or False»
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(1500);
  const lines = await T.eval(`[document.querySelector('.tb-title h1').textContent, document.querySelector('.tb-sub').textContent]`);
  check('Заголовок: «Английский язык · дата, время» и тема «True or False»', /^Английский язык · \d{1,2} [а-я]+, \d\d:\d\d$/.test(lines[0]) && lines[1] === 'True or False', lines.join(' / '));
  check('Центральная группа: Задание → Загрузить/Удалить изображение → Пригласить', await T.eval(`[...document.querySelectorAll('.tb-center .group .gbtn')].map(b=>b.dataset.action).join()==='task,image,invite'`));
  check('Справа «Очистить доску» (BrushCleaning) и «Завершить урок», RU/EN нет', await T.eval(`[...document.querySelectorAll('.tb-right > .btn')].map(b=>b.dataset.action).join()==='clear,end' && document.querySelector('[data-action="clear"] [data-icon]').dataset.icon==='brushCleaning' && !document.querySelector('[data-action="more"]') && !document.querySelector('.lang')`));

  const A = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await A.goto(U + '#/demo/student?name=Аня&lang=ru'); await sleep(1200);
  const M = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await M.goto(U + '#/demo/student?name=Миша&lang=ru'); await sleep(1200);
  await T.bringToFront(); await sleep(4500);

  // Ось и отсутствие перекрытий: MacBook и iPad, RU и EN
  for (const [w, h, name] of [[1440, 900, 'MacBook'], [1180, 820, 'iPad'], [820, 1180, 'iPad (книжная)']]) {
    await T.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
    for (const l of ['ru', 'en']) {
      await setLang(T, l); await sleep(600);
      const g = await geo(T);
      const cc = (g.center.l + g.center.r) / 2, dc = (g.dock.l + g.dock.r) / 2;
      // На MacBook и iPad альбомной группа строго по оси дока. На iPad книжной подписи «Очистить доску» и «Завершить урок»
      // важнее точной оси (на касании нет подсказок): правая часть шире, группа может сместиться не больше чем на 48 px
      const axisTol = w <= 900 ? 48 : 1.5;
      const ok = Math.abs(cc - g.vw / 2) < axisTol && Math.abs(dc - g.vw / 2) < 1.5 && g.left.r <= g.center.l && g.right.l >= g.center.r + 12 && g.people.l >= g.dock.r && g.right.r <= g.vw;
      check(`${name} ${l.toUpperCase()}: ${w <= 900 ? 'группа рядом с осью дока (подписи справа сохранены)' : 'группа вверху и док на одной оси'}, боковые блоки не перекрывают`, ok, `центр ${cc.toFixed(1)} / док ${dc.toFixed(1)} / экран ${g.vw / 2}; L ${Math.round(g.left.r)}≤${Math.round(g.center.l)}, R ${Math.round(g.right.l)}≥${Math.round(g.center.r)}`);
    }
  }
  await setLang(T, 'ru'); await T.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false }); await sleep(700);

  // Счётчик справа внизу → список вверх → отключить
  check('Счётчик учеников справа внизу', await T.eval(`(()=>{const p=document.querySelector('.people-dock').getBoundingClientRect(); return p.right>innerWidth-30 && p.bottom>innerHeight-30})()`) && (await T.eval(`document.querySelector('.people-count').textContent`)) === '2');
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(300);
  const pp = await T.eval(`(()=>{const p=document.querySelector('#people-pop').getBoundingClientRect(),b=document.querySelector('.people-btn').getBoundingClientRect();return {up:p.bottom<=b.top, fits:p.top>=0&&p.left>=0&&p.right<=innerWidth, kicks:[...document.querySelectorAll('.kick-btn')].map(k=>k.getAttribute('aria-label'))}})()`);
  check('Список имён раскрывается вверх и помещается на экране', pp.up && pp.fits);
  check('У каждого имени крестик «Отключить [имя]»', pp.kicks.includes('Отключить Аня') && pp.kicks.includes('Отключить Миша'), pp.kicks.join(', '));
  await T.shot(SHOTS + '/macbook-teacher-people-ru.png');
  await T.eval(`document.querySelector('[aria-label="Отключить Миша"]').click(); true`); await sleep(500);
  check('После отключения список и счётчик обновились', (await T.eval(`document.querySelector('.people-count').textContent`)) === '1' && !(await T.eval(`document.querySelector('.people-list').textContent.includes('Миша')`)));
  await M.bringToFront(); await sleep(600);
  check('Отключённый ученик видит «Вы отключены от урока»', /Вы отключены от урока/.test(await M.eval(`document.querySelector('h1').textContent`)));
  await M.eval(`document.querySelector('#rejoin').click(); true`); await sleep(400);
  check('Общая ссылка остаётся действующей: снова форма входа', await M.eval(`!!document.querySelector('#join')`));
  await M.eval(`document.querySelector('#f-name').value='Миша'; document.querySelector('#join').requestSubmit(); true`); await sleep(800);
  check('Ученик снова на доске', await M.eval(`!!document.querySelector('canvas.live')`));
  await T.bringToFront(); await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(5200);

  // Учитель — в размере iPad, касаниями
  await T.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 2, mobile: false });
  await T.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await sleep(600);
  check('Док учителя: отменить, повторить, перо, цвет, выделение, ластик, текст, стикер, штампы', (await T.eval(`[...document.querySelectorAll('.dock button')].map(b=>b.dataset.action||b.dataset.tool).join()`)) === 'undo,redo,pen,color,select,eraser,text,sticky,stamp');
  const small = await T.eval(`[...document.querySelectorAll('.dock button, .topbar button, .topbar a, .people-btn')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)}).filter(v=>v<44).length`);
  check('iPad: все цели в шапке, доке и счётчике ≥ 44×44', small === 0, String(small));
  check('Один набор иконок: одинаковая толщина линий', await T.eval(`new Set([...document.querySelectorAll('.dock .ic, .topbar .ic')].map(i=>getComputedStyle(i).strokeWidth)).size===1`));
  const f = await T.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
  const P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
  const n0 = (await board(T)).elements.length;

  // переключение выделение → перо → выделение: только один штрих от пера
  await T.tap(...(await ctr(T, '[data-tool="pen"]')));
  const s1 = P(300, 860), s2 = P(600, 880);
  await T.touchPath([s1, [(s1[0] + s2[0]) / 2, s1[1] + 4], s2]); await sleep(300);
  await T.tap(...(await ctr(T, '[data-tool="select"]')));
  await T.touchPath([P(700, 600), P(720, 620), P(760, 640)]); await sleep(300);
  check('Переключение между выделением и пером не оставляет случайных штрихов', (await board(T)).elements.length === n0 + 1);

  // Палитра пера раскрывается вверх и помещается
  await T.tap(...(await ctr(T, '.color-btn'))); await sleep(250);
  const fl = await T.eval(`(()=>{const f=document.querySelector('.flyout').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect();return {up:f.bottom<=d.top, fits:f.top>=0&&f.left>=0&&f.right<=innerWidth}})()`);
  check('Цвет и толщина: панель раскрывается вверх и помещается на iPad', fl.up && fl.fits, JSON.stringify(fl));
  await T.tap(...(await ctr(T, '.color-btn'))); await sleep(200);

  // Смайлики: вертикальная палитра вверх; выбор закрывает; касание вне — закрывает без смайлика
  await T.tap(...(await ctr(T, '[data-tool="stamp"]'))); await sleep(250);
  const em = await T.eval(`(()=>{const f=document.querySelector('.flyout'),r=f.getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect(),bs=[...f.querySelectorAll('.react-btn')].map(b=>b.getBoundingClientRect());return {mode:f.dataset.mode, open:!f.hidden, up:r.bottom<=d.top, fits:r.top>=0&&r.left>=0&&r.right<=innerWidth, vertical:bs.every(b=>Math.abs(b.left-bs[0].left)<1)&&bs[3].top>bs[0].top, n:bs.length, emoji:[...f.querySelectorAll('.react-btn')].map(b=>b.textContent.trim()).join(''), kinds:[...f.querySelectorAll('.react-btn')].map(b=>b.dataset.react).join(), checkSvg:!!f.querySelector('[data-react="check"] svg.react-check')}})()`);
  check('Штампы учителя: 👍 ❤️ галочка в мятном квадрате 🙂 — вертикальная палитра вверх, помещается', em.mode === 'react' && em.open && em.up && em.fits && em.vertical && em.n === 4 && em.kinds === 'like,heart,check,smile' && em.emoji === '👍❤️🙂' && em.checkSvg, JSON.stringify(em));
  const before = (await board(T)).elements.length;
  await T.tap(...P(1000, 150)); await sleep(250);
  check('Касание вне палитры закрывает её и ничего не ставит', await T.eval(`document.querySelector('.flyout').hidden`) && (await board(T)).elements.length === before);
  await T.tap(...(await ctr(T, '[data-tool="stamp"]'))); await sleep(250);
  if (await T.eval(`document.querySelector('.flyout').hidden`)) { await T.tap(...(await ctr(T, '[data-tool="stamp"]'))); await sleep(250); }
  await T.tap(...(await ctr(T, '[data-react="heart"]'))); await sleep(200);
  check('После выбора смайлика палитра закрывается', await T.eval(`document.querySelector('.flyout').hidden`));
  await T.tap(...P(1330, 440)); await sleep(300);
  let els = (await board(T)).elements;
  check('Следующее касание размещает смайлик', els[els.length - 1].type === 'stamp' && els[els.length - 1].kind === 'heart');

  // Текст: добавить → изменить → удалить
  await T.tap(...(await ctr(T, '[data-tool="text"]')));
  await T.tap(...P(760, 560)); await sleep(300);
  await T.send('Input.insertText', { text: 'Leo = brother' }); await T.eval(`document.activeElement.blur(); true`); await sleep(300);
  els = (await board(T)).elements; let tx = els.find((e) => e.type === 'text');
  check('Текст: подпись добавлена', tx && tx.text === 'Leo = brother');
  await T.tap(...P(tx.x + 20, tx.y + 15)); await sleep(300);
  check('Нажатие на подпись открывает редактирование и «Удалить»', await T.eval(`document.activeElement.classList.contains('text-editor') && !!document.querySelector('.edit-bar [data-edit="delete"]')`));
  await T.eval(`(()=>{const t=document.activeElement; t.value='Leo is her brother'; t.dispatchEvent(new Event('input')); t.blur(); return true})()`); await sleep(300);
  tx = (await board(T)).elements.find((e) => e.type === 'text');
  check('Подпись изменена', tx.text === 'Leo is her brother');
  // Стикер: добавить → изменить
  await T.tap(...(await ctr(T, '[data-tool="sticky"]')));
  await T.tap(...P(1000, 300)); await sleep(300);
  check('Стикер: редактор на пастельной подложке', await T.eval(`document.activeElement.classList.contains('sticky-editor')`));
  await T.send('Input.insertText', { text: 'Проверьте утверждение 2' }); await T.eval(`document.activeElement.blur(); true`); await sleep(300);
  let st = (await board(T)).elements.find((e) => e.type === 'sticky');
  check('Стикер добавлен', st && st.text === 'Проверьте утверждение 2');
  await T.tap(...P(st.x + 40, st.y + 40)); await sleep(300);
  await T.eval(`(()=>{const t=document.activeElement; t.value='Проверьте утверждение 2 ещё раз'; t.dispatchEvent(new Event('input')); t.blur(); return true})()`); await sleep(300);
  st = (await board(T)).elements.find((e) => e.type === 'sticky');
  check('Стикер изменён', st.text === 'Проверьте утверждение 2 ещё раз');
  // Временный стикер — удалить
  await T.tap(...P(150, 760)); await sleep(300);
  await T.send('Input.insertText', { text: 'временный' }); await T.eval(`document.activeElement.blur(); true`); await sleep(300);
  const tmp = (await board(T)).elements.find((e) => e.type === 'sticky' && e.text === 'временный');
  await T.tap(...P(tmp.x + 30, tmp.y + 30)); await sleep(300);
  await T.tap(...(await ctr(T, '.edit-bar [data-edit="delete"]'))); await sleep(300);
  check('Стикер удаляется', !(await board(T)).elements.some((e) => e.text === 'временный'));
  check('У ученика те же инструменты: выделение, текст, стикер, штампы', await A.eval(`['select','text','sticky','stamp'].every(t=>!!document.querySelector('[data-tool="'+t+'"]'))`));
  await T.tap(...(await ctr(T, '[data-tool="pen"]')));
  await sleep(300);
  await T.shot(SHOTS + '/ipad-teacher-tools-ru.png');
  await A.bringToFront(); await sleep(400); await A.shot(SHOTS + '/ipad-student-tools-ru.png'); await T.bringToFront();

  // Итоговый PNG: подписи, стикеры и смайлики
  await T.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(1200);
  const px = await T.eval(`(()=>{const c=document.querySelector('.result-preview canvas'),k=c.width/1600,g=c.getContext('2d'); const at=(x,y)=>[...g.getImageData(Math.round(x*k),Math.round(y*k),1,1).data].slice(0,3).join(','); return {sticky:at(${st.x + 12},${st.y + st.h - 10}), heart:at(1330,440)}})()`);
  check('Итог: стикер на пастельной подложке', px.sticky === '255,242,179', px.sticky);
  check('Итог: штамп ❤️ — полноцветный эмодзи', (([r, g, b]) => r > 180 && g < 90 && b < 110)(px.heart.split(',').map(Number)), px.heart);
  await T.eval(`document.querySelector('#f-file').value='True or False tools'; document.querySelector('#dl-form').requestSubmit(); true`);
  let files = [];
  for (let i = 0; i < 40 && !(files = readdirSync(DL)).includes('True or False tools.png'); i++) await sleep(250);
  check('PNG скачан', files.includes('True or False tools.png'), files.join(', '));
  if (files.includes('True or False tools.png')) check('PNG не пустой', statSync(DL + '/True or False tools.png').size > 100000);
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
