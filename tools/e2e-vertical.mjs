// Длинный вертикальный PNG в размере iPad: предпросмотр → «Отмена» / «Вставить» → штрих → «Удалить изображение»
// → повторная загрузка → «Очистить доску»; подписи и подтверждения RU/EN; ученик пишет T; итоговый PNG.
// Запуск: node server.js  →  node tools/e2e-vertical.mjs [папка-для-артефактов]
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const OUT = process.argv[2] || root + 'tools/e2e-out';
const DL = OUT + '/downloads-vertical'; rmSync(DL, { recursive: true, force: true }); mkdirSync(DL, { recursive: true });
const SHOTS = root + 'screenshots';
const U = 'http://localhost:5173/';
const PNG = root + 'worksheet/worksheet-true-false-vertical.png';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
// Квадраты на вертикальном листе (1200×1700): x 960–1110, y = 800 + i·170, сторона 150
const SHEET = { w: 1200, h: 1700 }; const boxC = (i) => [1035, 875 + i * 170];

const c = await launch({ port: 9370, downloads: DL });
try {
  // Учитель — в размере iPad, касаниями
  const T = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); location.hash='#/?lang=ru'; true`); await sleep(500);
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const id = await T.eval(`location.hash.split('/')[2]`);
  const invite = await T.eval(`document.querySelector('.link-field').value`);
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`);
  const board = () => T.eval(`JSON.parse(localStorage.getItem('wb:board:${id}'))`);
  const imgBtn = () => T.eval(`(()=>{const b=document.querySelector('[data-action="image"]'),r=b.getBoundingClientRect();return {text:b.innerText.trim(),disabled:b.disabled,left:Math.round(r.left),width:Math.round(r.width)}})()`);
  const center = (sel) => T.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  const tapSel = async (sel) => { const p = await center(sel); await T.tap(p[0], p[1]); await sleep(250); };
  const upload = async () => {
    const { root: d } = await T.send('DOM.getDocument', {});
    const { nodeId } = await T.send('DOM.querySelector', { nodeId: d.nodeId, selector: '#file' });
    await T.send('DOM.setFileInputFiles', { nodeId, files: [PNG] }); await sleep(1800);
  };
  const modalText = () => T.eval(`(()=>{const m=document.querySelector('.modal');return m?[m.querySelector('h2').textContent,m.querySelector('p').textContent,[...m.querySelectorAll('.btn')].map(b=>b.textContent.trim()).join('|')].join(' / '):''})()`);
  const toFrame = async (P, bx, by) => { const f = await P.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`); return [f[0] + bx * f[2], f[1] + by * f[2]]; };
  const sheetToBoard = (im, sx, sy) => [im.x + sx * im.w / SHEET.w, im.y + sy * im.h / SHEET.h];

  check('Шапка: «Задание» и «Загрузить изображение»', (await T.eval(`document.querySelector('[data-action="task"]').innerText.trim()`)) === 'Задание' && (await imgBtn()).text === 'Загрузить изображение');
  const btn0 = await imgBtn();

  // 1. Предпросмотр → «Отмена»
  const before0 = (await board()).elements.length;
  await upload();
  const fit = (await board()).image;
  check('Предпросмотр: вертикальный лист целиком, пропорции сохранены', fit && !fit.locked && fit.y >= 0 && fit.y + fit.h <= 1000 && fit.x >= 0 && fit.x + fit.w <= 1600 && Math.abs(fit.w / fit.h - SHEET.w / SHEET.h) < 0.01, `${Math.round(fit.w)}×${Math.round(fit.h)}`);
  const bar = await T.eval(`(()=>{const bs=[...document.querySelectorAll('.place-bar .btn')]; return {labels:bs.map(b=>b.textContent.trim()).join('|'), visible:bs.every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&r.height>=44}), order: bs[0].getBoundingClientRect().left < bs[1].getBoundingClientRect().left, hint: !!document.querySelector('.place-hint,[data-img="fit"]')}})()`);
  check('iPad: под предпросмотром сразу видны «Отмена» (слева) и «Вставить» (справа)', bar.labels === 'Отмена|Вставить' && bar.visible && bar.order, JSON.stringify(bar));
  check('Нет «Вписать целиком» и подсказки', !bar.hint);
  const st = await T.eval(`(()=>{const i=getComputedStyle(document.querySelector('[data-img="place"]')),c=getComputedStyle(document.querySelector('[data-img="cancel"]'));return {ins:i.backgroundColor,insImg:i.backgroundImage,insShadow:i.boxShadow,insColor:i.color,can:c.backgroundColor}})()`);
  check('«Вставить» — однотонная холодная сиреневая заливка, тёмная подпись; «Отмена» — нейтральная', st.insImg === 'none' && st.insShadow === 'none' && st.insColor === 'rgb(54, 48, 82)' && st.ins !== st.can, JSON.stringify(st));
  await T.eval(`document.querySelector('[data-img="place"]').focus(); true`);
  check('Фокус с клавиатуры виден', (await T.eval(`getComputedStyle(document.querySelector('[data-img="place"]')).outlineStyle`)) === 'solid');
  await T.eval(`document.activeElement.blur(); true`);
  check('Во время предпросмотра кнопка загрузки недоступна', (await imgBtn()).disabled);
  await T.shot(SHOTS + '/ipad-teacher-insert-preview-ru.png');
  // размер за угол касанием
  const h = await center('.h-se');
  await T.touchPath([h, [h[0] - 30, h[1] - 30], [h[0] - 70, h[1] - 70]]); await sleep(300);
  const small = (await board()).image;
  check('Размер меняется за угол пальцем, пропорции сохранены', small.w < fit.w - 20 && Math.abs(small.w / small.h - fit.w / fit.h) < 0.01, `${Math.round(fit.w)}→${Math.round(small.w)}`);
  const m = await T.eval(`(()=>{const r=document.querySelector('.img-box').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  await T.touchPath([m, [m[0] + 20, m[1] + 10], [m[0] + 50, m[1] + 20]]); await sleep(300);
  check('Изображение перетаскивается пальцем', (await board()).image.x > small.x + 15);
  await tapSel('[data-img="cancel"]');
  const afterCancel = await board();
  check('«Отмена» возвращает прежнее состояние', !afterCancel.image && afterCancel.elements.length === before0 && (await imgBtn()).text === 'Загрузить изображение' && !(await imgBtn()).disabled);

  // 2. Вставка → штрих → «Удалить изображение»
  await upload(); await tapSel('[data-img="place"]');
  const placed = (await board()).image;
  const b1 = await imgBtn();
  check('«Вставить»: изображение закреплено, кнопка — «Удалить изображение» на том же месте', placed.locked && b1.text === 'Удалить изображение' && b1.left === btn0.left && b1.width === btn0.width, JSON.stringify(b1));
  check('Дублей удаления нет: справа только «Очистить доску» и «Завершить урок»', await T.eval(`[...document.querySelectorAll('.tb-right > .btn')].map(b=>b.dataset.action).join()==='clear,end' && document.querySelector('[data-action="clear"] [data-icon]').dataset.icon==='brushCleaning' && !document.querySelector('[data-action="more"]')`));
  { const [x1, y1] = sheetToBoard(placed, 100, 640), [x2, y2] = sheetToBoard(placed, 700, 640); const pts = []; for (let k = 0; k <= 12; k++) pts.push(await toFrame(T, x1 + (x2 - x1) * k / 12, y1 + 2)); await T.touchPath(pts); await sleep(300); }
  const withStroke = await board();
  check('Штрих поверх изображения', withStroke.elements.length === 1);
  await tapSel('[data-action="image"]');
  check('Подтверждение удаления (RU)', (await modalText()) === 'Удалить изображение? / Пометки останутся на доске. / Отмена|Удалить', await modalText());
  await T.eval(`document.querySelector('.modal .btn:not(.btn-danger)').click(); true`); await sleep(250);
  check('«Отмена» в подтверждении сохраняет изображение', !!(await board()).image);
  await tapSel('[data-action="image"]'); await T.eval(`document.querySelector('.modal .btn-danger').click(); true`); await sleep(400);
  const afterRemove = await board();
  check('Удалено только изображение, штрих остался на месте', !afterRemove.image && afterRemove.elements.length === 1 && JSON.stringify(afterRemove.elements[0].pts) === JSON.stringify(withStroke.elements[0].pts));
  const b2 = await imgBtn();
  check('Кнопка снова «Загрузить изображение» на том же месте', b2.text === 'Загрузить изображение' && b2.left === btn0.left, JSON.stringify(b2));
  await T.shot(SHOTS + '/ipad-teacher-after-remove-ru.png');

  // 3. Повторная загрузка → «Очистить доску»
  await upload(); await tapSel('[data-img="place"]');
  await tapSel('[data-action="clear"]');
  check('Подтверждение очистки (RU)', (await modalText()) === 'Очистить доску? / Изображение и все пометки будут удалены. / Отмена|Очистить', await modalText());
  await T.eval(`document.querySelector('.modal .btn-danger').click(); true`); await sleep(400);
  const cleared = await board();
  check('«Очистить доску» удаляет и изображение, и штрих', !cleared.image && cleared.elements.length === 0);
  check('После очистки снова «Загрузить изображение»', (await imgBtn()).text === 'Загрузить изображение');

  // 4. EN: подписи и подтверждения
  await T.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=en'; return true})()`); await sleep(700);
  check('EN: «Task» и «Upload image»', (await T.eval(`document.querySelector('[data-action="task"]').innerText.trim()`)) === 'Task' && (await imgBtn()).text === 'Upload image');
  await upload();
  check('EN: «Cancel» и «Insert»', (await T.eval(`[...document.querySelectorAll('.place-bar .btn')].map(b=>b.textContent.trim()).join('|')`)) === 'Cancel|Insert');
  await T.shot(SHOTS + '/ipad-teacher-insert-preview-en.png');
  await tapSel('[data-img="place"]');
  const placedEn = (await board()).image;
  check('EN: «Remove image» после вставки', (await imgBtn()).text === 'Remove image');
  await tapSel('[data-action="image"]');
  check('EN: подтверждение удаления', (await modalText()) === 'Remove the image? / Marks will stay on the board. / Cancel|Remove', await modalText());
  await T.eval(`document.querySelector('.modal .btn:not(.btn-danger)').click(); true`); await sleep(200);
  check('EN: «Clear board»', (await T.eval(`document.querySelector('[data-action="clear"]').getAttribute('aria-label')`)) === 'Clear board');
  await tapSel('[data-action="clear"]');
  check('EN: подтверждение очистки', (await modalText()) === 'Clear the board? / The image and all marks will be deleted. / Cancel|Clear', await modalText());
  await T.eval(`document.querySelector('.modal .btn:not(.btn-danger)').click(); true`); await sleep(200);
  check('Отмена очистки сохраняет изображение', !!(await board()).image);

  // 5. Ученик вписывает T, итоговый PNG
  const S = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await S.goto(invite); await sleep(400);
  await S.eval(`document.querySelector('#f-name').value='Аня'; document.querySelector('#join').requestSubmit(); true`); await sleep(800);
  await S.bringToFront();
  const [cx, cy] = boxC(0);
  const stroke = async (a, b) => { const pts = []; for (let k = 0; k <= 10; k++) { const [bx, by] = sheetToBoard(placedEn, a[0] + (b[0] - a[0]) * k / 10, a[1] + (b[1] - a[1]) * k / 10); pts.push(await toFrame(S, bx, by)); } await S.touchPath(pts); };
  await stroke([cx - 45, cy - 45], [cx + 45, cy - 45]); await stroke([cx, cy - 45], [cx, cy + 50]); await sleep(400);
  const els = (await board()).elements;
  const inBox = els.length === 2 && els.every((e) => { for (let i = 0; i < e.pts.length; i += 2) { const sx = (e.pts[i] - placedEn.x) * SHEET.w / placedEn.w, sy = (e.pts[i + 1] - placedEn.y) * SHEET.h / placedEn.h; if (sx < 955 || sx > 1115 || sy < 795 || sy > 955) return false; } return true; });
  check('Ученик вписал T в квадрат 1, изображение под штрихом не сдвинулось', inBox && JSON.stringify((await board()).image) === JSON.stringify(placedEn));
  await S.shot(SHOTS + '/ipad-student-vertical-ru.png');
  await T.bringToFront();
  await T.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(900);
  await T.eval(`document.querySelector('#f-file').value='True or False vertical'; document.querySelector('#dl-form').requestSubmit(); true`);
  let files = [];
  for (let i = 0; i < 40 && !(files = readdirSync(DL)).includes('True or False vertical.png'); i++) await sleep(250);
  check('Итоговый PNG скачан с заданным именем', files.includes('True or False vertical.png'), files.join(', '));
  if (files.includes('True or False vertical.png')) check('PNG содержит изображение и пометки', statSync(DL + '/True or False vertical.png').size > 100000);
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
