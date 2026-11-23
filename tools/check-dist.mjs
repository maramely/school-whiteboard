// Проверка готовой сборки dist/site на стороннем статическом сервере (не server.js) или по опубликованному адресу.
// Запуск: (cd dist/site && python3 -m http.server 8099)  →  node tools/check-dist.mjs http://127.0.0.1:8099/
//         node tools/check-dist.mjs https://maramely.github.io/school-whiteboard/
import { launch, sleep } from './cdp.mjs';
const U = process.argv[2] || 'http://127.0.0.1:8099/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const c = await launch({ port: 9410 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  const errors = []; T.send('Log.enable').catch(() => {});
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/?lang=ru'); await sleep(1500);
  const home = await T.eval(`({h1:document.querySelector('h1').textContent, shiba:document.querySelector('.shiba').className, webm:performance.getEntriesByType('resource').some(e=>/shiba\\.webm/.test(e.name))})`);
  check('Стартовая страница открывается, шиба загружает ролик', /совместной работы/.test(home.h1) && home.webm, home.shiba);
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const inv = await T.eval(`document.querySelector('.link-field').value`);
  check('Приглашение использует адрес открытого сайта, не localhost:5173', inv.startsWith(U + '#/join/') && !/localhost:5173/.test(inv), inv);
  // Демо: учитель + ученик в двух вкладках
  await T.goto(U + '#/demo/teacher?reset=1&lang=ru'); await sleep(2000);
  check('Демо-урок учителя: лист True or False загружен', await T.eval(`(()=>{const c=document.querySelector('canvas.base'),g=c.getContext('2d'),k=c.width/1600;return [...g.getImageData(Math.round(300*k),Math.round(120*k),1,1).data].slice(0,3).join(',')!=='255,255,255'})()`));
  const demoInv = await T.eval(`document.querySelector('.link-field').value`);
  const S = await c.newPage('', { width: 1180, height: 820, scale: 1, touch: true });
  await S.goto(demoInv); await sleep(800);
  check('Ссылка из «Пригласить» открывает вход ученика', await S.eval(`!!document.querySelector('#join')`), demoInv);
  await S.eval(`document.querySelector('#f-name').value='Коллега'; document.querySelector('#join').requestSubmit(); true`); await sleep(1000);
  // у ученика при входе открыто задание; первое касание доски его только закрывает
  await S.eval(`document.querySelectorAll('.popover').forEach(p=>p.hidden=true); true`);
  const f = await S.eval(`(()=>{const r=document.querySelector('.frame').getBoundingClientRect();return [r.left,r.top,r.width/1600]})()`);
  await S.touchPath([[f[0] + 200 * f[2], f[1] + 940 * f[2]], [f[0] + 300 * f[2], f[1] + 950 * f[2]], [f[0] + 400 * f[2], f[1] + 940 * f[2]]]); await sleep(400);
  await T.bringToFront(); await sleep(600);
  const seen = await T.eval(`JSON.parse(localStorage.getItem('wb:board:true-false')).elements.some(e=>e.type==='pen'&&e.pts[0]>190&&e.pts[0]<210&&e.pts[1]>930)`);
  check('Штрих ученика виден во вкладке учителя', seen);
  check('Учитель видит ученика в счётчике', +(await T.eval(`document.querySelector('.people-count').textContent`)) >= 1);
  await T.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
  await T.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(1200);
  check('Экран результата с превью', await T.eval(`!!document.querySelector('.result-preview canvas') && /сохранить эту доску/.test(document.querySelector('.result-side h1').textContent)`));
  await T.eval(`document.querySelector('#del').click(); true`); await sleep(200); await T.eval(`document.querySelector('.modal .btn-danger').click(); true`); await sleep(800);
  await S.bringToFront(); await sleep(600);
  check('«Доска удалена» с иллюстрацией', await S.eval(`/Доска удалена/.test(document.querySelector('h1').textContent) && document.querySelector('.gone-art').naturalWidth===520`));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
