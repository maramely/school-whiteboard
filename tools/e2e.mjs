// Сквозная проверка основного сценария: учитель (MacBook) + 2 ученика (iPad, касания).
// Запуск: node server.js  →  node tools/e2e.mjs [папка-для-артефактов]
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = process.argv[2] || root + 'tools/e2e-out';
mkdirSync(OUT, { recursive: true });
const DL = OUT + '/downloads'; rmSync(DL, { recursive: true, force: true }); mkdirSync(DL, { recursive: true });
const URL0 = 'http://localhost:5173/';
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); console.log(ok ? 'PASS' : 'FAIL', '-', name, extra); };

const c = await launch({ port: 9340, downloads: DL });
try {
  // 1. Учитель создаёт доску
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await T.goto(URL0 + '#/');
  await T.eval(`localStorage.clear(); sessionStorage.clear(); location.hash = '#/'; true`); await sleep(500);
  check('Стартовая: только необязательное поле задания и кнопка', await T.eval(`!document.querySelector('input') && !!document.querySelector('#f-task') && document.querySelectorAll('main button').length===1`));
  check('Название сервиса: «Интерактивная доска»', /Интерактивная доска/.test(await T.eval(`document.querySelector('.brand').textContent`)));
  await T.eval(`document.querySelector('#f-task').value='Выберите True or False'; document.querySelector('#create-form').requestSubmit(); true`);
  await sleep(900);
  const boardId = await T.eval(`location.hash.split('/')[2]`);
  check('Учитель создал доску', !!boardId, boardId);
  check('Приглашение открылось само — компактной панелью у кнопки, без затемнения', await T.eval(`!document.querySelector('#invite-pop').hidden && !document.querySelector('.modal-backdrop')`));
  const invite = await T.eval(`document.querySelector('#invite-pop .link-field').value`);
  check('Ссылка уникальная и ведёт на вход ученика', invite.includes('#/join/' + boardId), invite);
  check('Панель «Пригласить»: видимая ссылка и только «Копировать ссылку»', await T.eval(`[...document.querySelectorAll('#invite-pop .btn')].map(b=>b.textContent.trim()).join('|')`) === 'Копировать ссылку' && await T.eval(`!!document.querySelector('#invite-pop .link-field') && !document.querySelector('#invite-pop a[target]')`));
  await c.browser.send('Browser.grantPermissions', { origin: 'http://localhost:5173', permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  { const b = await T.eval(`(()=>{const r=document.querySelector('[data-copy-invite]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); await T.click(b[0], b[1]); await sleep(250); }
  check('В буфере — ссылка-приглашение', (await T.eval(`navigator.clipboard.readText()`)) === invite);
  check('После копирования — «Скопировано»', await T.eval(`document.querySelector('[data-copy-invite]').textContent.trim()`) === 'Скопировано');
  { const r = await T.eval(`(()=>{const p=document.querySelector('#invite-pop').getBoundingClientRect();return {l:p.left,r:p.right,w:innerWidth}})()`);
    check('Панель приглашения помещается на экране', r.l >= 0 && r.r <= r.w, JSON.stringify(r)); }
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`); await sleep(150);

  // 2. Загрузка PNG
  const { root: docRoot } = await T.send('DOM.getDocument', {});
  const { nodeId } = await T.send('DOM.querySelector', { nodeId: docRoot.nodeId, selector: '#file' });
  await T.send('DOM.setFileInputFiles', { nodeId, files: [root + 'worksheet/worksheet-true-false.png'] });
  await sleep(1500);
  check('PNG на доске', await T.eval(`!!JSON.parse(localStorage.getItem('wb:board:${boardId}')).image`));
  check('При загрузке нет всплывающего сообщения', await T.eval(`![...document.querySelectorAll('.toast')].some(t=>/картинк|изображ/i.test(t.textContent))`));
  check('Картинку можно расположить: рамка с углами и «Разместить»', await T.eval(`!!document.querySelector('.img-box .h-se') && !!document.querySelector('[data-img="place"]')`));
  { const before = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).image`);
    const h = await T.eval(`(()=>{const r=document.querySelector('.h-se').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await T.mouseDrag([h, [h[0] + 40, h[1] + 20], [h[0] + 80, h[1] + 50]]); await sleep(300);
    const after = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).image`);
    check('Картинка масштабируется за угол, пропорции сохранены', after.w > before.w && Math.abs(after.w / after.h - before.w / before.h) < 0.01, `${before.w.toFixed(0)}→${after.w.toFixed(0)}`);
    const mid = await T.eval(`(()=>{const r=document.querySelector('.img-box').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height*0.7]})()`);
    await T.mouseDrag([mid, [mid[0] - 20, mid[1] - 10], [mid[0] - 40, mid[1] - 20]]); await sleep(300);
    const moved = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).image`);
    check('Картинку можно перетащить', moved.x < after.x - 15, `${after.x.toFixed(0)}→${moved.x.toFixed(0)}`);
    // для следующих шагов — лист на всё полотно, затем «Разместить»
    await T.eval(`(()=>{const k='wb:board:${boardId}', b=JSON.parse(localStorage.getItem(k)); Object.assign(b.image, {x:0,y:0,w:1600,h:1000}); localStorage.setItem(k, JSON.stringify(b)); location.reload(); return true})()`); await sleep(1200);
    await T.eval(`document.querySelector('[data-img="place"]').click(); true`); await sleep(300);
    check('«Разместить» закрепляет лист навсегда (рамки больше нет)', await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).image.locked === true && !document.querySelector('.img-box')`));
    // удалить через «Ещё» → тост «Картинка удалена» → «Вернуть»
    check('Меню «⋯» нет; «Очистить доску» и «Завершить» рядом справа', await T.eval(`!document.querySelector('[data-action="menu"]') && [...document.querySelectorAll('.tb-right > .btn')].map(b=>b.dataset.action).join()==='clear,end'`));
    check('Кнопка в шапке после вставки — «Удалить изображение»', await T.eval(`document.querySelector('[data-action="image"]').innerText.trim()`) === 'Удалить изображение');
    await T.eval(`document.querySelector('[data-action="image"]').click(); true`); await sleep(250);
    await T.eval(`document.querySelector('.modal .btn-danger').click(); true`); await sleep(300);
    check('После удаления — тост с «Вернуть»', await T.eval(`!JSON.parse(localStorage.getItem('wb:board:${boardId}')).image && [...document.querySelectorAll('.toast')].some(t=>/Изображение удалено/.test(t.textContent) && t.querySelector('.toast-btn'))`));
    await T.eval(`document.querySelector('.toast .toast-btn').click(); true`); await sleep(300);
    check('«Вернуть» возвращает лист на место', await T.eval(`(()=>{const i=JSON.parse(localStorage.getItem('wb:board:${boardId}')).image; return !!i && i.locked && i.w===1600})()`));
  }

  // 3. Два ученика входят по ссылке (iPad 1180×820, касания)
  const students = [];
  for (const name of ['Аня', 'Миша']) {
    const S = await c.newPage('', { width: 1180, height: 820, scale: 2, mobile: false, touch: true });
    await S.goto(invite); await sleep(400);
    await S.eval(`document.querySelector('#f-name').value='${name}'; document.querySelector('#join').requestSubmit(); true`);
    await sleep(900);
    check(`${name}: вошла/вошёл и видит доску`, await S.eval(`!!document.querySelector('canvas.live')`));
    check(`${name}: видит задание учителя`, /True or False/.test(await S.eval(`document.querySelector('.task-text').textContent`)));
    await S.eval(`document.querySelector('[data-action="task"]').click(); true`); await sleep(150);
    students.push(S);
  }
  await sleep(5200);
  const cnt = await T.eval(`document.querySelector('.people-count').textContent`);
  check('Учитель видит число подключённых', /2/.test(cnt), cnt);
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(200);
  const names = await T.eval(`document.querySelector('.people-list').textContent`);
  check('Учитель видит имена', names.includes('Аня') && names.includes('Миша'));
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`);

  // Учитель меняет задание — ученики видят новое
  await T.bringToFront();
  await T.eval(`document.querySelector('[data-action="task"]').click(); document.querySelector('#task-edit').value='Выберите True or False. Номер скажет учитель.'; document.querySelector('.task-form').requestSubmit(); true`); await sleep(500);
  check('Изменённое задание у ученика + отметка на кнопке', await students[0].eval(`document.querySelector('.task-text').textContent.includes('Номер скажет') && !document.querySelector('.new-dot').hidden`));
  // RU/EN не сдвигает меню учителя
  check('У учителя нет переключателя RU/EN', await T.eval(`!document.querySelector('.lang')`));
  { const pos = `[...document.querySelectorAll('.tb-center .group > *, .tb-right > *')].map(e=>Math.round(e.getBoundingClientRect().left)).join(',')`;
    const ru = await T.eval(pos); await T.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=en'; return true})()`); await sleep(600);
    const en = await T.eval(pos); const lbl = await T.eval(`document.querySelector('[data-action="end"]').innerText.trim()`);
    check('Язык платформы RU/EN не сдвигает меню', ru === en, ru + ' / ' + en);
    check('EN: «End»', lbl === 'End', lbl);
    await T.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=ru'; return true})()`); await sleep(600); }

  // Геометрия: док не перекрывает лист
  const geo = await students[0].eval(`(()=>{const f=document.querySelector('.frame').getBoundingClientRect(), d=document.querySelector('.dock').getBoundingClientRect(); return {f:[f.left,f.top,f.width,f.height], d:[d.left,d.top,d.width,d.height], overlap: d.top < f.bottom}})()`);
  check('iPad: док не перекрывает лист', !geo.overlap, JSON.stringify(geo));
  const sizes = await students[0].eval(`[...document.querySelectorAll('.dock .tool:not([hidden]), .topbar .btn, .people, .task-chip, .lang button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect(); return Math.min(r.width,r.height)})`);
  check('iPad: все видимые кнопки ≥ 44 px', sizes.every((s) => s >= 44 - 0.01), 'min=' + Math.min(...sizes).toFixed(1));
  const boxCss = await students[0].eval(`(document.querySelector('.frame').getBoundingClientRect().width/1600*120).toFixed(1)`);
  check('iPad: квадрат для буквы ≥ 70 CSS px', +boxCss >= 70, boxCss + 'px');

  // 4. Ученики пишут T и F пальцем
  const toScreen = async (P, bx, by) => { const f = await P.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect(); return [r.left,r.top,r.width/1600]})()`); return [f[0] + bx * f[2], f[1] + by * f[2]]; };
  const boxCenter = (i) => [1388 + 60, 262 + i * 142 + 60];
  const line = async (P, a, b, n = 10) => { const pts = []; for (let k = 0; k <= n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); const s = []; for (const p of pts) s.push(await toScreen(P, p[0], p[1])); await P.touchPath(s); };
  // Миша → F в квадрат 1
  { const [cx, cy] = boxCenter(0); const M = students[1];
    await line(M, [cx - 20, cy - 36], [cx - 20, cy + 38]); await line(M, [cx - 20, cy - 36], [cx + 30, cy - 36]); await line(M, [cx - 20, cy], [cx + 20, cy]); }
  // Аня → T в квадрат 2
  { const [cx, cy] = boxCenter(1); const A = students[0];
    await line(A, [cx - 32, cy - 34], [cx + 32, cy - 34]); await line(A, [cx, cy - 34], [cx, cy + 38]); }
  await sleep(500);
  const els = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.map(e=>e.type+':'+e.author)`);
  check('Ответы на общем полотне (5 штрихов от двух учеников)', els.length === 5 && new Set(els).size === 2, els.join(','));

  // Живой штрих виден другим в процессе (именная метка)
  { const A = students[0]; const s1 = await toScreen(A, 1448, 262 + 2 * 142 + 20);
    await A.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s1[0], y: s1[1] }] });
    for (let k = 1; k < 6; k++) { await A.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s1[0] + k * 6, y: s1[1] + k * 4 }] }); await sleep(30); }
    await sleep(250);
    const tag = await T.eval(`[...document.querySelectorAll('.name-tag')].map(n=>n.textContent).join(',')`);
    check('Учитель видит живой штрих с именем автора', tag.includes('Аня'), tag);
    await A.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
    // отменить этот лишний штрих
    await A.eval(`document.querySelector('[data-action="undo"]').click(); true`); await sleep(300);
    const n2 = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
    check('Отмена у ученика убирает его штрих', n2 === 5, String(n2));
    await A.eval(`document.querySelector('[data-action="redo"]').click(); true`); await sleep(300);
    const n3 = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
    check('Повтор возвращает штрих', n3 === 6, String(n3));
    await A.eval(`document.querySelector('[data-action="undo"]').click(); true`); await sleep(300);
  }

  // Док: только перо, цвет, ластик, отменить, повторить; цвет — у пера
  { const A = students[0];
    check('Док ученика как у учителя: отменить, повторить, перо, цвет, выделение, ластик, текст, стикер, штампы', await A.eval(`[...document.querySelectorAll('.dock button')].map(b=>b.dataset.action||b.dataset.tool).join(',')`) === 'undo,redo,pen,color,select,eraser,text,sticky,stamp');
    const cb = await A.eval(`(()=>{const r=document.querySelector('.color-btn').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await A.tap(cb[0], cb[1]); await sleep(250);
    check('Касание кружка цвета открывает цвет и толщину', await A.eval(`!document.querySelector('.flyout').hidden && document.querySelector('.flyout').dataset.mode==='style'`));
    const sw = await A.eval(`(()=>{const r=document.querySelector('[data-color="#34C759"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await A.tap(sw[0], sw[1]); await sleep(150);
    check('Цвет у пера меняется одним касанием', await A.eval(`getComputedStyle(document.querySelector('.color-dot')).backgroundColor === 'rgb(52, 199, 89)'`));
    const er = await A.eval(`(()=>{const r=document.querySelector('[data-tool="eraser"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await A.tap(er[0], er[1]); await sleep(150);
    check('Касание по ластику переключает инструмент', await A.eval(`document.querySelector('[data-tool="eraser"]').getAttribute('aria-pressed')==='true'`));
    const pn = await A.eval(`(()=>{const r=document.querySelector('[data-tool="pen"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await A.tap(pn[0], pn[1]); await sleep(150);
    await A.eval(`(()=>{ if(!document.querySelector('.flyout').hidden) document.querySelector('.color-btn').click(); document.querySelector('.color-btn').click(); document.querySelector('[data-color="#007AFF"]').click(); document.querySelector('.color-btn').click(); return true})()`); await sleep(150);
  }

  // Ластик «закрашиванием»: Аня стирает середину своей вертикальной черты T — черта делится на две
  { const A = students[0]; const [cx, cy] = boxCenter(1);
    const before = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.filter(e=>e.author!=='teacher').length`);
    await A.eval(`document.querySelector('[data-tool="eraser"]').click(); true`);
    await line(A, [cx - 15, cy + 5], [cx + 15, cy + 5], 6); await sleep(300);
    const after = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
    check('Ластик стирает часть штриха (черта разрезана)', after === before + 1, `${before}→${after}`);
    await A.eval(`document.querySelector('[data-action="undo"]').click(); true`); await sleep(300);
    const back = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
    check('Отмена возвращает штрих целиком', back === before, String(back));
  }

  // 5. Права ластика: Аня пытается стереть F Миши
  { const A = students[0];
    await A.eval(`document.querySelector('[data-tool="eraser"]').click(); true`);
    const [cx, cy] = boxCenter(0); await line(A, [cx - 20, cy - 10], [cx - 20, cy + 10], 4); await sleep(300);
    const n = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
    const toastTxt = await A.eval(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|')`);
    check('Ученик не может стереть чужой штрих', n === 5 && /свои/.test(toastTxt), toastTxt);
    await A.eval(`document.querySelector('[data-tool="pen"]').click(); document.querySelector('[data-tool="pen"]').click(); true`); // вернуть перо
  }

  // 6. Учитель подчёркивает фразу (мышь) и пробует ластик на чужом
  await T.bringToFront();
  { const s = []; for (let k = 0; k <= 12; k++) s.push(await toScreen(T, 100 + k * 31.5, 372)); await T.mouseDrag(s); await sleep(300); }
  let n = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
  check('Учитель подчеркнул фразу', n === 6, String(n));
  const anyaIds = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.map(e=>e.id).join()`);
  await T.eval(`document.querySelector('[data-tool="eraser"]').click(); true`);
  { const [cx, cy] = boxCenter(1); const p1 = await toScreen(T, cx, cy - 34), p2 = await toScreen(T, cx + 4, cy - 34); await T.mouseDrag([p1, p2]); await sleep(300); }
  n = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.length`);
  const anyaIdsAfter = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.map(e=>e.id).join()`);
  check('Учитель может стирать штрихи ученика', anyaIdsAfter !== anyaIds, 'изменено');
  await T.eval(`document.querySelector('[data-action="undo"]').click(); true`); await sleep(300);
  const idsBack = await T.eval(`JSON.parse(localStorage.getItem('wb:board:${boardId}')).elements.map(e=>e.id).join()`);
  check('Отмена учителя возвращает стёртое', idsBack === anyaIds);
  await T.eval(`document.querySelector('[data-tool="pen"]').click(); true`);
  await sleep(400);
  await students[0].shot(OUT + '/e2e-student-ipad.png');
  await T.shot(OUT + '/e2e-teacher-mac.png');

  // 7. Завершить урок → экран результата у учителя
  await T.bringToFront();
  await T.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(900);
  check('Учитель сразу видит превью итогового листа', await T.eval(`!!document.querySelector('.result-preview canvas.thumb')`));
  const defName = await T.eval(`document.querySelector('#f-file').value`);
  check('Имя файла предложено по дате и времени', /^доска-\d{4}-\d\d-\d\d-\d\d-\d\d$/.test(defName), defName);
  check('Расширение .png показано отдельно', await T.eval(`document.querySelector('.file-field .ext').textContent==='.png'`));
  const delTxt = await T.eval(`document.querySelector('.result-side .hint').textContent`);
  check('Показано время автоудаления', /удалится автоматически в \d\d:\d\d/.test(delTxt), delTxt);
  await T.eval(`window.__dl=[]; const oc=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(this.download) window.__dl.push(this.download); return oc.call(this); }; true`);
  await T.eval(`document.querySelector('#f-file').value='6Б True or False.png'; document.querySelector('#dl-form').requestSubmit(); true`); await sleep(2500);
  await T.eval(`document.querySelector('#dl-form').requestSubmit(); true`); await sleep(2500);
  const files = readdirSync(DL).filter((f) => f.endsWith('.png'));
  check('PNG скачан с именем учителя, .png добавлен один раз', files.includes('6Б True or False.png'), files.join(' | '));
  const dls = await T.eval(`window.__dl`);
  check('Скачивание можно повторить (2 скачивания, имя сохранилось)', dls.length === 2 && dls.every((n) => n === '6Б True or False.png'), JSON.stringify(dls));
  if (files.includes('6Б True or False.png')) check('PNG не пустой', statSync(DL + '/6Б True or False.png').size > 50000, statSync(DL + '/6Б True or False.png').size + ' bytes');
  await T.shot(OUT + '/e2e-teacher-result.png');

  // 8. Ученики после завершения
  await sleep(400);
  const thanks = await students[1].eval(`document.querySelector('h1') && document.querySelector('h1').textContent`);
  check('Ученик в своей вкладке видит «Спасибо! Урок завершён»', /Спасибо/.test(thanks || ''), thanks);
  check('У ученика есть кнопка скачать финальный PNG', await students[1].eval(`!!document.querySelector('#dl')`));
  const N = await c.newPage('', { width: 1180, height: 820 });
  await N.goto(invite); await sleep(600);
  const ended = await N.eval(`document.querySelector('h1').textContent`);
  check('Приглашение после урока → «Урок завершён», без живой доски', /Урок завершён/.test(ended) && await N.eval(`!document.querySelector('canvas.live')`), ended);

  // 9. Удалить доску вручную
  await T.bringToFront();
  await T.eval(`document.querySelector('#del').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-danger').click(); true`); await sleep(700);
  check('Учитель видит «Доска удалена»', /Доска удалена/.test(await T.eval(`document.querySelector('h1').textContent`)));
  const left = await T.eval(`Object.keys(localStorage).filter(k=>/^wb:(img|snap|board|pres):/.test(k))`);
  check('Картинка, штрихи и результат удалены из хранилища', left.length === 0, JSON.stringify(left));
  await N.goto(invite.replace('#', '?r=1#')); await sleep(600);
  check('Приглашение после удаления → «Доска удалена»', /Доска удалена/.test(await N.eval(`document.querySelector('h1').textContent`)));
  await students[1].bringToFront(); await sleep(800);
  { const h = await students[1].eval(`document.querySelector('h1') ? document.querySelector('h1').textContent : document.body.innerText.slice(0,80)`); check('Вкладка ученика тоже переключилась', /удалена/.test(h), h); }

  // 10. Автоудаление через час (перемотка для демо)
  await T.bringToFront(); await T.goto(URL0 + '#/'); await sleep(500);
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  await T.eval(`document.querySelector('.modal .btn-primary') && document.querySelector('.modal .btn-primary').click(); true`);
  const id2 = await T.eval(`location.hash.split('/')[2]`);
  await T.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(800);
  check('На экране результата нет демо-перемотки', await T.eval(`!document.querySelector('#demo-expire')`));
  await T.eval(`(()=>{const k='wb:board:'+location.hash.split('/')[2], b=JSON.parse(localStorage.getItem(k)); b.endedAt-=61*60*1000; localStorage.setItem(k, JSON.stringify(b)); location.reload(); return true})()`); await sleep(1200);
  check('Через час: учитель видит «Срок хранения истёк»', /Срок хранения истёк/.test(await T.eval(`document.querySelector('h1').textContent`)));
  await N.goto(URL0 + '?r=2#/join/' + id2); await sleep(600);
  check('Через час: приглашение → «Срок хранения истёк»', /Срок хранения истёк/.test(await N.eval(`document.querySelector('h1').textContent`)));
  // переключателя RU/EN на экране нет: язык приходит из платформы (?lang=)
  await N.goto(URL0 + '?r=3#/join/' + id2 + '?lang=en'); await sleep(600);
  check('EN: «Storage period has ended»', /Storage period has ended/.test(await N.eval(`document.querySelector('h1').textContent`)));
} catch (e) { console.error('ERROR', e); results.push(['FAIL', 'exception', String(e)]); }
finally { await c.close(); }
const fails = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
