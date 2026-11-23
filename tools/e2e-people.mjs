// Счётчик учеников справа внизу и панель «Ученики на доске»: вход, одновременный вход, отключение,
// акцент на числе при закрытой панели, «Скопировать ссылку», размеры iPad, prefers-reduced-motion.
// Запуск: node server.js  →  node tools/e2e-people.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };

const c = await launch({ port: 9398 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/?lang=ru'); await sleep(300);
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const id = await T.eval(`location.hash.split('/')[2]`);
  const invite = await T.eval(`document.querySelector('.link-field').value`);
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`); await sleep(200);
  const count = () => T.eval(`document.querySelector('.people-count').textContent`);
  const rows = () => T.eval(`[...document.querySelectorAll('#people-pop li[data-pid]:not(.leaving)')].map(l=>l.querySelector('.pname').textContent)`);
  const join = async (name) => { const S = await c.newPage('', { width: 1180, height: 820, scale: 1, touch: true }); await S.goto(invite); await sleep(300); await S.eval(`document.querySelector('#f-name').value=${JSON.stringify(name)}; document.querySelector('#join').requestSubmit(); true`); return S; };

  check('«Пригласить» остаётся вверху', await T.eval(`!!document.querySelector('.tb-center [data-action="invite"]')`));
  check('Счётчик справа внизу: 0', (await count()) === '0');
  await T.bringToFront();
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(350);
  const head = await T.eval(`[document.querySelector('#pp-title').textContent, document.querySelector('[data-copy-link]').textContent.trim(), document.querySelector('#people-pop li.empty')?.textContent || '']`);
  check('Панель «Ученики на доске» раскрывается по нажатию учителя', head[0] === 'Ученики на доске' && !(await T.eval(`document.querySelector('#people-pop').hidden`)));
  check('Внизу панели — «Скопировать ссылку»', head[1] === 'Скопировать ссылку');
  const anim = await T.eval(`getComputedStyle(document.querySelector('#people-pop')).animationName`);
  check('Панель появляется с анимацией', anim === 'pp-open', anim);

  // Вход при открытой панели → строка плавно добавляется, счётчик обновляется
  const A = await join('Аня'); await T.bringToFront(); await sleep(500);
  check('Вход при открытой панели: строка добавлена, число обновлено', (await count()) === '1' && JSON.stringify(await rows()) === '["Аня"]');
  check('Новая строка появляется плавно', await T.eval(`document.querySelector('#people-pop li[data-pid]').classList.contains('entering') && getComputedStyle(document.querySelector('#people-pop li[data-pid]')).animationName==='pp-enter'`));
  check('У строки крестик «Отключить Аня»', await T.eval(`!!document.querySelector('[aria-label="Отключить Аня"]')`));

  // Одновременный вход нескольких учеников → список сразу
  const pages = await Promise.all(['Миша', 'Лиза', 'Тимур'].map(join));
  await T.bringToFront(); await sleep(700);
  check('Одновременный вход трёх учеников: список обновлён сразу', (await count()) === '4' && (await rows()).length === 4, (await rows()).join(', '));
  const pp = await T.eval(`(()=>{const p=document.querySelector('#people-pop').getBoundingClientRect(),b=document.querySelector('.people-btn').getBoundingClientRect();return {up:p.bottom<=b.top, fits:p.top>=0&&p.left>=0&&p.right<=innerWidth}})()`);
  check('MacBook: панель раскрывается вверх и помещается', pp.up && pp.fits);
  await T.shot(root + 'screenshots/macbook-teacher-people-panel-ru.png');

  // «Скопировать ссылку» → «Скопировано»
  await c.browser.send('Browser.grantPermissions', { origin: 'http://localhost:5173', permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  { const b = await T.eval(`(()=>{const r=document.querySelector('[data-copy-link]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); await T.click(b[0], b[1]); await sleep(250); }
  check('«Скопировать ссылку» → «Скопировано», в буфере ссылка-приглашение', (await T.eval(`document.querySelector('[data-copy-link]').textContent.trim()`)) === 'Скопировано' && (await T.eval(`navigator.clipboard.readText()`)) === invite);

  // Отключение из панели
  await T.eval(`document.querySelector('[aria-label="Отключить Миша"]').click(); true`); await sleep(80);
  check('Отключение: строка плавно убирается', await T.eval(`!!document.querySelector('#people-pop li.leaving')`));
  await sleep(400);
  check('После отключения список и число обновлены', (await count()) === '3' && !(await rows()).includes('Миша'));
  const M = pages[0]; await M.bringToFront(); await sleep(500);
  check('Отключённый ученик видит «Вы отключены от урока»', /Вы отключены от урока/.test(await M.eval(`document.querySelector('h1').textContent`)));
  await M.eval(`document.querySelector('#rejoin').click(); true`); await sleep(300);
  await M.eval(`document.querySelector('#f-name').value='Миша'; document.querySelector('#join').requestSubmit(); true`); await sleep(700);
  check('Ссылка действует: ученик снова вошёл и сразу на доске', await M.eval(`!!document.querySelector('canvas.live')`));
  await T.bringToFront(); await sleep(500);
  check('Счётчик учителя снова 4', (await count()) === '4');

  // Панель закрыта → обновляется только число с коротким акцентом
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(200);
  const N = await join('Оля'); await T.bringToFront(); await sleep(250);
  check('Панель закрыта: число обновилось с акцентом', (await count()) === '5' && await T.eval(`document.querySelector('.people-count').classList.contains('bump') && document.querySelector('#people-pop').hidden`));
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(400);
  check('Открытие после этого: в списке все пятеро', (await rows()).length === 5);
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(200);

  // Ученик: тот же счётчик, без крестиков и без копирования
  await N.bringToFront(); await sleep(300);
  await N.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(300);
  check('У ученика список без крестиков и без «Скопировать ссылку»', await N.eval(`!document.querySelector('.kick-btn') && !document.querySelector('[data-copy-link]') && document.querySelectorAll('#people-pop li[data-pid]').length===5`));

  // iPad: альбомная и книжная
  await T.bringToFront();
  for (const [w, h] of [[1180, 820], [820, 1180]]) {
    await T.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false }); await sleep(400);
    await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(350);
    const r = await T.eval(`(()=>{const p=document.querySelector('#people-pop').getBoundingClientRect(),b=document.querySelector('.people-btn').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect();return {up:p.bottom<=b.top, fits:p.top>=0&&p.left>=0&&p.right<=innerWidth, noDockOverlap:b.left>=d.right}})()`);
    check(`iPad ${w}×${h}: панель вверх, помещается, счётчик не перекрывает док`, r.up && r.fits && r.noDockOverlap, JSON.stringify(r));
    if (w === 1180) await T.shot(root + 'screenshots/ipad-teacher-people-panel-ru.png');
    await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(200);
  }

  // prefers-reduced-motion: без движения, изменения применяются сразу
  await T.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(100);
  const dur = await T.eval(`getComputedStyle(document.querySelector('#people-pop')).animationDuration`);
  await join('Петя'); await T.bringToFront(); await sleep(400);
  check('Reduced motion: панель без анимации, новая строка без «плавного» класса', parseFloat(dur) < 0.01 && !(await T.eval(`!!document.querySelector('#people-pop li.entering')`)) && (await rows()).includes('Петя'), dur);
  await T.eval(`document.querySelector('[aria-label="Отключить Петя"]').click(); true`); await sleep(50);
  check('Reduced motion: строка убирается сразу', !(await rows()).includes('Петя') && !(await T.eval(`!!document.querySelector('#people-pop li.leaving')`)));
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(100);
  await join('Ваня'); await T.bringToFront(); await sleep(300);
  check('Reduced motion: число обновляется без акцента', (await count()) === '6' && !(await T.eval(`document.querySelector('.people-count').classList.contains('bump')`)));

  // EN
  await T.send('Emulation.setEmulatedMedia', { features: [] });
  await T.eval(`(()=>{location.hash=location.hash.split('?')[0]+'?lang=en'; return true})()`); await sleep(700);
  await T.eval(`document.querySelector('[data-action="people"]').click(); true`); await sleep(300);
  check('EN: «Students on the board», «Copy link», «Disconnect Аня»', (await T.eval(`document.querySelector('#pp-title').textContent`)) === 'Students on the board' && (await T.eval(`document.querySelector('[data-copy-link]').textContent.trim()`)) === 'Copy link' && await T.eval(`!!document.querySelector('[aria-label="Disconnect Аня"]')`));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
