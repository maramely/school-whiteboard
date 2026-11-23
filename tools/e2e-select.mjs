// Инструмент «Выделение»: стикер — создать, перетащить, исправить текст (мышью на MacBook и касанием на iPad);
// подпись — выделить стрелкой и поменять цвет букв. Изменения видны ученику и попадают в скачанный PNG,
// а рамка выделения и панель редактирования — нет. Штрихи не выделяются, картинка закреплена.
// Запуск: node server.js  →  node tools/e2e-select.mjs
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, readdirSync, rmSync, readFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const DL = root + 'tools/e2e-out/downloads-select'; rmSync(DL, { recursive: true, force: true }); mkdirSync(DL, { recursive: true });
const SHOTS = root + 'screenshots';
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const board = (P) => P.eval(`JSON.parse(localStorage.getItem('wb:board:true-false'))`);
const ctr = (P, sel) => P.eval(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
const frameOf = (P) => P.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
const dblclick = async (P, x, y) => {
  await P.send('Page.bringToFront');
  for (const n of [1, 2]) { await P.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: n }); await P.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: n }); await sleep(60); }
  await sleep(200);
};
const doubleTap = async (P, x, y) => { await P.tap(x, y); await sleep(60); await P.tap(x, y); await sleep(250); };
// пиксели рамки выделения (#9A8CE6) в кольце вокруг прямоугольника на живом слое
const selRing = (P, b) => P.eval(`(()=>{const c=document.querySelector('canvas.live'),k=c.width/1600,g=c.getContext('2d');
  const d=g.getImageData(Math.round((${b.x}-20)*k),Math.round((${b.y}-20)*k),Math.round((${b.w}+40)*k),Math.round((${b.h}+40)*k)).data; let n=0;
  for(let i=0;i<d.length;i+=4) if(d[i+3]>150 && Math.abs(d[i]-154)<30 && Math.abs(d[i+1]-140)<30 && Math.abs(d[i+2]-230)<30) n++; return n})()`);
const selbar = (P) => P.eval(`(()=>{const s=document.querySelector('.selbar'); if(!s) return null; return {edit:!!s.querySelector('[data-action="sel-edit"]'), editText:(s.querySelector('[data-action="sel-edit"]')||{}).textContent, colors:s.querySelectorAll('[data-text-color]').length, del:!!s.querySelector('[data-action="sel-delete"]')}})()`);
const bbText = (e) => ({ x: e.x - 4, y: e.y - 4, w: e.bw + 8, h: e.bh + 8 });

const c = await launch({ port: 9404, downloads: DL });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(1500);
  const S = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await S.goto(U + '#/demo/student?name=Аня&lang=ru'); await sleep(1200);
  await T.bringToFront(); await sleep(300);
  let f = await frameOf(T); let P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];

  check('Стрелка «Выделение» стоит рядом с пером, руки и указки нет', await T.eval(`(()=>{const ids=[...document.querySelectorAll('.dock button')].map(b=>b.dataset.tool||b.dataset.action); const b=document.querySelector('[data-tool="select"]'); return ids.indexOf('select')===ids.indexOf('pen')+2 && ids[ids.indexOf('pen')+1]==='color' && !document.querySelector('[data-tool="pointer"]') && b.getAttribute('aria-label')==='Выделение'})()`));
  check('EN: подпись «Select»', await T.eval(`(async()=>{location.hash='#/demo/teacher?lang=en'; await new Promise(r=>setTimeout(r,500)); const l=document.querySelector('[data-tool="select"]').getAttribute('aria-label'); location.hash='#/demo/teacher?lang=ru'; await new Promise(r=>setTimeout(r,500)); return l==='Select'})()`));
  f = await frameOf(T); P = (x, y) => [f[0] + x * f[2], f[1] + y * f[2]];
  const penColor0 = await T.eval(`getComputedStyle(document.querySelector('.color-dot')).backgroundColor`);

  /* ---------- MacBook, мышь: стикер ---------- */
  await T.click(...(await ctr(T, '[data-tool="sticky"]')));
  await T.click(...P(1300, 140)); await sleep(300);
  await T.send('Input.insertText', { text: 'Проверьте 3' }); await T.eval(`document.activeElement.blur(); true`); await sleep(300);
  let st = (await board(T)).elements.find((e) => e.type === 'sticky');
  check('Мышь: стикер создан', st && st.text === 'Проверьте 3');
  await T.click(...(await ctr(T, '[data-tool="select"]')));
  const from = P(st.x + 60, st.y + 40), to = P(st.x + 60 - 180, st.y + 40 + 120);
  await T.mouseDrag([from, ...Array.from({ length: 8 }, (_, i) => [from[0] + (to[0] - from[0]) * (i + 1) / 8, from[1] + (to[1] - from[1]) * (i + 1) / 8])]); await sleep(300);
  const st2 = (await board(T)).elements.find((e) => e.id === st.id);
  check('Мышь: стикер перетащен', Math.abs(st2.x - (st.x - 180)) < 2 && Math.abs(st2.y - (st.y + 120)) < 2, `${st.x},${st.y} → ${Math.round(st2.x)},${Math.round(st2.y)}`);
  const ring = await selRing(T, { x: st2.x, y: st2.y, w: st2.w, h: st2.h });
  const sb = await selbar(T);
  check('Тонкая сиреневая рамка вокруг выбранного стикера', ring > 100, `${ring} px`);
  check('Рядом — компактная кнопка «Редактировать» (без цветов у стикера)', sb && sb.edit && sb.editText.trim() === 'Редактировать' && sb.colors === 0, JSON.stringify(sb));
  await T.shot(SHOTS + '/macbook-select-sticky-ru.png');
  await dblclick(T, ...P(st2.x + 60, st2.y + 40));
  check('Двойной клик открывает текст стикера', await T.eval(`document.activeElement.classList.contains('sticky-editor') && document.activeElement.value==='Проверьте 3'`));
  await T.eval(`(()=>{const t=document.activeElement; t.value='Проверьте утверждение 3'; t.dispatchEvent(new Event('input')); t.blur(); return true})()`); await sleep(300);
  check('Мышь: текст стикера исправлен', (await board(T)).elements.find((e) => e.id === st.id).text === 'Проверьте утверждение 3');
  check('После правки стикер снова выделен', !!(await selbar(T)));
  await T.click(...(await ctr(T, '.selbar [data-action="sel-edit"]'))); await sleep(250);
  check('Кнопка «Редактировать» тоже открывает текст', await T.eval(`document.activeElement.classList.contains('sticky-editor')`));
  await T.eval(`document.activeElement.blur(); true`); await sleep(250);

  /* ---------- Подпись: выделить стрелкой и поменять цвет ---------- */
  await T.click(...(await ctr(T, '[data-tool="text"]')));
  await T.click(...P(1230, 520)); await sleep(300);
  await T.send('Input.insertText', { text: 'Well done' }); await T.eval(`document.activeElement.blur(); true`); await sleep(300);
  let tx = (await board(T)).elements.find((e) => e.type === 'text' && e.text === 'Well done');
  check('Отдельная подпись добавлена цветом пера', tx && tx.color.toUpperCase() === '#FF3B30', tx && tx.color);
  await T.click(...(await ctr(T, '[data-tool="select"]')));
  await T.click(...P(tx.x + 20, tx.y + tx.bh / 2)); await sleep(250);
  const sbt = await selbar(T);
  check('Подпись выделена стрелкой: рамка, «Редактировать» и цвета букв', (await selRing(T, bbText(tx))) > 60 && sbt && sbt.edit && sbt.colors === 6, JSON.stringify(sbt));
  await T.shot(SHOTS + '/macbook-select-text-ru.png');
  await T.click(...(await ctr(T, '.selbar [data-text-color="#007AFF"]'))); await sleep(300);
  tx = (await board(T)).elements.find((e) => e.id === tx.id);
  check('Цвет подписи поменялся на синий', tx.color === '#007AFF');
  check('Цвет пера сохранился', (await T.eval(`getComputedStyle(document.querySelector('.color-dot')).backgroundColor`)) === penColor0, penColor0);
  check('Выбранный цвет отмечен в панели', await T.eval(`document.querySelector('.selbar [data-text-color="#007AFF"]').getAttribute('aria-checked')==='true'`));
  await T.click(...(await ctr(T, '[data-tool="pen"]'))); await sleep(150);
  await T.click(...(await ctr(T, '[data-tool="select"]')));
  // Двойной клик по подписи — редактирование
  await dblclick(T, ...P(tx.x + 20, tx.y + tx.bh / 2));
  check('Двойной клик открывает подпись', await T.eval(`document.activeElement.classList.contains('text-editor') && document.activeElement.value==='Well done'`));
  await T.eval(`document.activeElement.blur(); true`); await sleep(250);

  /* ---------- Пустое место, штрихи, картинка ---------- */
  await T.click(...P(tx.x + 20, tx.y + tx.bh / 2)); await sleep(150);
  await T.click(...P(60, 960)); await sleep(200);
  check('Клик по пустому месту снимает выделение', !(await selbar(T)) && (await selRing(T, bbText(tx))) === 0);
  await T.click(...(await ctr(T, '[data-tool="pen"]')));
  await T.mouseDrag([P(80, 900), P(140, 905), P(200, 910), P(260, 905)]); await sleep(250);
  const nStrokes = (await board(T)).elements.filter((e) => e.type === 'pen').length;
  await T.click(...(await ctr(T, '[data-tool="select"]')));
  await T.click(...P(170, 907)); await sleep(150);
  check('Рукописный штрих стрелкой не выделяется', !(await selbar(T)));
  const img0 = JSON.stringify((await board(T)).image), els0 = JSON.stringify((await board(T)).elements);
  await T.mouseDrag([P(500, 380), P(540, 400), P(600, 430)]); await sleep(250);
  check('Изображение закреплено: стрелка его не двигает и не выделяет', JSON.stringify((await board(T)).image) === img0 && JSON.stringify((await board(T)).elements) === els0 && !(await selbar(T)));
  await T.click(...(await ctr(T, '[data-tool="eraser"]')));
  await T.mouseDrag([P(170, 880), P(170, 907), P(170, 935)]); await sleep(250);
  check('Штрих по-прежнему правится ластиком', (await board(T)).elements.filter((e) => e.type === 'pen').length !== nStrokes || JSON.stringify((await board(T)).elements) !== els0);

  /* ---------- Штамп выделяется и двигается ---------- */
  await T.click(...(await ctr(T, '[data-tool="stamp"]'))); await sleep(200);
  await T.click(...(await ctr(T, '[data-react="check"]'))); await sleep(150);
  await T.click(...P(1500, 900)); await sleep(250);
  let sp = (await board(T)).elements.filter((e) => e.type === 'stamp').pop();
  await T.click(...(await ctr(T, '[data-tool="select"]')));
  await T.mouseDrag([P(1500, 900), P(1480, 880), P(1460, 860)]); await sleep(250);
  const sp2 = (await board(T)).elements.find((e) => e.id === sp.id);
  const sbs = await selbar(T);
  check('Штамп ✅ выделяется и перетаскивается', sp.kind === 'check' && Math.abs(sp2.x - 1460) < 2 && Math.abs(sp2.y - 860) < 2 && sbs && !sbs.edit && sbs.del, JSON.stringify(sbs));

  /* ---------- iPad, касание ---------- */
  const I = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
  await I.goto(U + '#/demo/teacher?lang=ru'); await sleep(1500);
  let g = await frameOf(I); const Q = (x, y) => [g[0] + x * g[2], g[1] + y * g[2]];
  await I.tap(...(await ctr(I, '[data-tool="sticky"]')));
  await I.tap(...Q(500, 300)); await sleep(300);
  await I.send('Input.insertText', { text: 'Касание' }); await I.eval(`document.activeElement.blur(); true`); await sleep(300);
  let ts = (await board(I)).elements.find((e) => e.type === 'sticky' && e.text === 'Касание');
  check('Касание: стикер создан', !!ts);
  await I.tap(...(await ctr(I, '[data-tool="select"]')));
  const a0 = Q(ts.x + 50, ts.y + 40);
  await I.touchPath(Array.from({ length: 10 }, (_, i) => [a0[0] - i * 12, a0[1] + i * 8]));
  await sleep(300);
  const ts2 = (await board(I)).elements.find((e) => e.id === ts.id);
  check('Касание: стикер перетащен пальцем', ts2.x < ts.x - 50 && ts2.y > ts.y + 30, `${ts.x},${ts.y} → ${Math.round(ts2.x)},${Math.round(ts2.y)}`);
  await doubleTap(I, ...Q(ts2.x + 50, ts2.y + 40));
  check('Двойное касание открывает текст стикера', await I.eval(`document.activeElement.classList.contains('sticky-editor')`));
  await I.eval(`(()=>{const t=document.activeElement; t.value='Касание: исправлено'; t.dispatchEvent(new Event('input')); t.blur(); return true})()`); await sleep(300);
  check('Касание: текст стикера исправлен', (await board(I)).elements.find((e) => e.id === ts.id).text === 'Касание: исправлено');
  const tx2 = (await board(I)).elements.find((e) => e.id === tx.id);
  await I.tap(...Q(tx2.x + 20, tx2.y + tx2.bh / 2)); await sleep(250);
  await I.tap(...(await ctr(I, '.selbar [data-text-color="#34C759"]'))); await sleep(300);
  check('Касание: цвет подписи поменялся на зелёный', (await board(I)).elements.find((e) => e.id === tx.id).color === '#34C759');
  const small = await I.eval(`[...document.querySelectorAll('.selbar button')].map(b=>b.getBoundingClientRect()).filter(r=>r.height<44).length`);
  check('iPad: кнопки панели выделения высотой ≥ 44', small === 0, String(small));
  await I.shot(SHOTS + '/ipad-select-text-ru.png');
  // вернём синий — его проверяем у ученика и в PNG
  await I.tap(...(await ctr(I, '.selbar [data-text-color="#007AFF"]'))); await sleep(300);
  await c.browser.send('Target.closeTarget', { targetId: I.targetId }).catch(() => {});

  /* ---------- Ученик видит изменения ---------- */
  await S.bringToFront(); await sleep(800);
  const fin = await board(S);
  const sS = fin.elements.find((e) => e.id === st.id), tS = fin.elements.find((e) => e.id === tx.id);
  const studentPx = await S.eval(`(()=>{const c=document.querySelector('canvas.base'),k=c.width/1600,g=c.getContext('2d');
    const at=(x,y)=>[...g.getImageData(Math.round(x*k),Math.round(y*k),1,1).data].slice(0,3).join(',');
    const d=g.getImageData(Math.round(${tS.x}*k),Math.round(${tS.y}*k),Math.round(${tS.bw}*k),Math.round(${tS.bh}*k)).data; let blue=0;
    for(let i=0;i<d.length;i+=4) if(d[i]<60&&d[i+1]>90&&d[i+1]<160&&d[i+2]>220) blue++;
    return {sticky:at(${sS.x + 10},${sS.y + sS.h - 8}), blue, live:(()=>{const l=document.querySelector('canvas.live').getContext('2d').getImageData(0,0,10,10); return true})(), selbar:!!document.querySelector('.selbar')}})()`);
  check('Ученик видит стикер на новом месте с исправленным текстом', sS.text === 'Проверьте утверждение 3' && studentPx.sticky === '255,242,179', studentPx.sticky);
  check('Ученик видит подпись синим цветом', tS.color === '#007AFF' && studentPx.blue > 30, `${studentPx.blue} синих px`);
  check('У ученика нет рамки и панели выделения', !studentPx.selbar && (await selRing(S, bbText(tS))) === 0);
  await S.shot(SHOTS + '/ipad-student-after-select-ru.png');

  /* ---------- PNG: изменения есть, рамки и панели нет ---------- */
  await T.bringToFront(); await sleep(300);
  await T.click(...(await ctr(T, '[data-tool="select"]')));
  const tT = (await board(T)).elements.find((e) => e.id === tx.id);
  await T.click(...P(tT.x + 20, tT.y + tT.bh / 2)); await sleep(250);
  check('Перед экспортом подпись выделена', !!(await selbar(T)) && (await selRing(T, bbText(tT))) > 60);
  await T.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(1200);
  await T.eval(`document.querySelector('#f-file').value='select-check'; document.querySelector('#dl-form').requestSubmit(); true`);
  let files = [];
  for (let i = 0; i < 40 && !(files = readdirSync(DL)).includes('select-check.png'); i++) await sleep(250);
  check('PNG скачан', files.includes('select-check.png'), files.join(', '));
  const b64 = readFileSync(DL + '/select-check.png').toString('base64');
  const png = await T.eval(`(async()=>{const im=new Image(); im.src='data:image/png;base64,${b64}'; await im.decode();
    const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d'); g.drawImage(im,0,0); const k=im.width/1600;
    const at=(x,y)=>[...g.getImageData(Math.round(x*k),Math.round(y*k),1,1).data].slice(0,3).join(',');
    const reg=(x,y,w,h)=>g.getImageData(Math.round(x*k),Math.round(y*k),Math.round(w*k),Math.round(h*k)).data;
    let blue=0; const d=reg(${tT.x},${tT.y},${tT.bw},${tT.bh}); for(let i=0;i<d.length;i+=4) if(d[i]<60&&d[i+1]>90&&d[i+1]<160&&d[i+2]>220) blue++;
    let lav=0; const r=reg(${tT.x - 24},${tT.y - 80},${tT.bw + 48},${tT.bh + 104}); for(let i=0;i<r.length;i+=4) if(Math.abs(r[i]-154)<26&&Math.abs(r[i+1]-140)<26&&Math.abs(r[i+2]-230)<26) lav++;
    let green=0; const s=reg(${sp2.x - 30},${sp2.y - 30},60,60); for(let i=0;i<s.length;i+=4) if(s[i+1]>150&&s[i]<140&&s[i+2]<140) green++;
    return {w:im.width, sticky:at(${sS.x + 10},${sS.y + sS.h - 8}), blue, lav, green}})()`);
  check('PNG: стикер на новом месте', png.sticky === '255,242,179', png.sticky);
  check('PNG: подпись синим цветом', png.blue > 60, `${png.blue} px`);
  check('PNG: штамп ✅ — полноцветный эмодзи', png.green > 200, `${png.green} px`);
  check('PNG: нет рамки выделения и панели редактирования', png.lav === 0, `${png.lav} сиреневых px`);
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
