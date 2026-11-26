// Подписи RU/EN: панель «Пригласить» (ссылка + «Копировать ссылку» → «Скопировано»), «Завершить» и диалог
// «Завершить сессию?», плейсхолдер задания.
// Запуск: node server.js  →  node tools/e2e-labels.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const L = {
  ru: { ph: 'Например: обведите правильный ответ', copy: 'Копировать ссылку', copied: 'Скопировано', end: 'Завершить урок', title: 'Завершить сессию?', btns: 'Отмена|Завершить сессию' },
  en: { ph: 'For example: circle the correct answer', copy: 'Copy link', copied: 'Copied', end: 'Finish lesson', title: 'Finish the lesson?', btns: 'Cancel|Finish lesson' },
};
const c = await launch({ port: 9402 });
try {
  await c.browser.send('Browser.grantPermissions', { origin: 'http://localhost:5173', permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  const P = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await P.goto(U + '#/'); await P.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  for (const lang of ['ru', 'en']) {
    const x = L[lang], up = lang.toUpperCase();
    await P.goto(U + '#/?lang=' + lang); await sleep(500);
    check(`${up}: плейсхолдер задания`, (await P.eval(`document.querySelector('#f-task').placeholder`)) === x.ph);
    await P.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
    // Панель «Пригласить» открылась сама после создания
    const inv = await P.eval(`(()=>{const p=document.querySelector('#invite-pop'),bs=[...p.querySelectorAll('.btn')],lf=p.querySelector('.link-field'),last=bs[bs.length-1].getBoundingClientRect(),pr=p.getBoundingClientRect();return {open:!p.hidden, btns:bs.map(b=>b.textContent.trim()), link:lf&&lf.value, linkVisible:lf&&lf.getBoundingClientRect().height>0, newTab:!!p.querySelector('a[target]'), bottomGap:Math.round(pr.bottom-last.bottom)}})()`);
    check(`${up}: «Пригласить» — видимая ссылка и одна кнопка «${x.copy}», без «Открыть во вкладке»`, inv.open && inv.linkVisible && /#\/join\//.test(inv.link) && inv.btns.join('|') === x.copy && !inv.newTab, JSON.stringify(inv.btns));
    check(`${up}: нижний отступ панели подтянут под кнопку (≤ 14 px)`, inv.bottomGap <= 14, `${inv.bottomGap}px`);
    const b = await P.eval(`(()=>{const r=document.querySelector('[data-copy-invite]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await P.click(b[0], b[1]); await sleep(250);
    check(`${up}: после копирования — «${x.copied}», в буфере ссылка`, (await P.eval(`document.querySelector('[data-copy-invite]').textContent.trim()`)) === x.copied && (await P.eval(`navigator.clipboard.readText()`)) === inv.link);
    if (lang === 'ru') await P.shot(root + 'screenshots/macbook-teacher-ru-invite.png');
    await P.eval(`document.querySelector('[data-action="invite"]').click(); true`); await sleep(150);
    // «Завершить» и диалог
    check(`${up}: кнопка в шапке — «${x.end}»`, (await P.eval(`document.querySelector('[data-action="end"]').innerText.trim()`)) === x.end);
    await P.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
    const m = await P.eval(`[document.querySelector('.modal h2').textContent, [...document.querySelectorAll('.modal .modal-actions .btn')].map(b=>b.textContent.trim()).join('|')]`);
    check(`${up}: диалог «${x.title}» с кнопками «${x.btns.replace('|', '» и «')}»`, m[0] === x.title && m[1] === x.btns, m.join(' / '));
    if (lang === 'ru') await P.shot(root + 'screenshots/macbook-teacher-ru-end-dialog.png');
    await P.eval(`document.querySelector('.modal .modal-actions .btn').click(); true`); await sleep(200);
    check(`${up}: «${x.btns.split('|')[0]}» закрывает диалог, сессия продолжается`, await P.eval(`!document.querySelector('.modal') && !!document.querySelector('canvas.live')`));
    // Плейсхолдер в «Задании» на доске
    await P.eval(`document.querySelector('[data-action="task"]').click(); true`); await sleep(200);
    check(`${up}: тот же плейсхолдер в «Задании» на доске`, (await P.eval(`document.querySelector('#task-edit').placeholder`)) === x.ph);
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
