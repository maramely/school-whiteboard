// Экран входа ученика по приглашению: шиба → заголовок → дата и время сессии → «Ваше имя» → «Войти».
// RU и EN (язык из настроек демо, без переключателя), фокус поля при касании и по Tab, iPad с экранной клавиатурой.
// Запуск: node server.js  →  node tools/e2e-join.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const X = {
  ru: { h1: 'Вас пригласили в пространство для совместной работы', label: 'Ваше имя', ph: 'Введите имя', btn: 'Войти', date: /^\d{1,2} [а-я]+, \d\d:\d\d$/, loc: 'ru-RU' },
  en: { h1: 'You’ve been invited to a shared workspace', label: 'Your name', ph: 'Enter your name', btn: 'Join', date: /^\d{1,2} [A-Z][a-z]+, \d\d:\d\d$/, loc: 'en-GB' },
};
const view = (P) => P.eval(`(()=>{const c=document.querySelector('.join-card'); if(!c) return null; const kids=[...c.children].map(e=>e.matches('.shiba')?'shiba':e.tagName==='H1'?'h1':e.matches('.join-when')?'when':e.tagName==='FORM'?'form':e.className);
  const s=c.querySelector('.shiba').getBoundingClientRect(), i=document.querySelector('#f-name');
  return {kids:kids.join(','), h1:c.querySelector('h1').textContent, when:c.querySelector('.join-when').textContent, label:c.querySelector('label[for="f-name"]').textContent, ph:i.placeholder, btn:c.querySelector('[type="submit"]').textContent.trim(),
    lang:[...document.querySelectorAll('.page-top .lang [data-lang]')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':'')).join('|'), help:!!c.querySelector('.help'), text:document.body.innerText, shiba:[Math.round(s.width),Math.round(s.height)], shibaCls:c.querySelector('.shiba').className}})()`);
const focusStyle = (P) => P.eval(`(()=>{const i=document.querySelector('#f-name'),s=getComputedStyle(i);return {focused:document.activeElement===i, bw:s.borderTopWidth, bc:s.borderTopColor, shadow:s.boxShadow, outline:s.outlineStyle}})()`);
const ACC = 'rgb(117, 99, 202)';

const c = await launch({ port: 9405 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await T.goto(U + '#/'); await T.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  await T.goto(U + '#/?lang=ru'); await sleep(400);
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const invite = await T.eval(`document.querySelector('.link-field').value`);
  const created = await T.eval(`JSON.parse(localStorage.getItem('wb:board:'+location.hash.split('/')[2])).createdAt`);

  for (const l of ['ru', 'en']) {
    const x = X[l], up = l.toUpperCase();
    await T.eval(`localStorage.setItem('wb:demo:lang','${l}'); true`); // настройки демо
    const S = await c.newPage('', { width: 1180, height: 820, scale: 2, touch: true });
    await S.goto(invite); await sleep(500);
    const v = await view(S);
    const expDate = await S.eval(`(()=>{const d=new Date(${created});return d.toLocaleDateString('${x.loc}',{day:'numeric',month:'long'})+', '+d.toLocaleTimeString('${x.loc}',{hour:'2-digit',minute:'2-digit'})})()`);
    check(`${up}: порядок — шиба, заголовок, дата и время, поле, кнопка`, v.kids === 'shiba,h1,when,form', v.kids);
    check(`${up}: заголовок «${x.h1}»`, v.h1 === x.h1, v.h1);
    check(`${up}: дата и время создания отдельной строкой — «${expDate}»`, v.when === expDate && x.date.test(v.when), v.when);
    check(`${up}: подпись «${x.label}», плейсхолдер «${x.ph}», кнопка «${x.btn}»`, v.label === x.label && v.ph === x.ph && v.btn === x.btn, `${v.label} / ${v.ph} / ${v.btn}`);
    check(`${up}: справа вверху EN | RU (активен ${up}), нет «Доска · …», «Вас пригласили на доску» и подсказки под полем`, v.lang === (up === 'EN' ? 'EN*|RU' : 'EN|RU*') && !v.help && !/Доска ·|Вас пригласили на доску|You’re invited to the board|Имя увидят|will see this name/.test(v.text));
    check(`${up}: компактная шиба над заголовком`, v.shiba[0] === 88 && v.shiba[1] === 88, v.shiba.join('×'));
    if (l === 'ru') {
      for (let i = 0; i < 24 && !(await S.eval(`document.querySelector('.shiba').classList.contains('is-ended')`)); i++) await sleep(250);
      const sh = await S.eval(`(()=>{const v=document.querySelector('.shiba-video');return {cls:document.querySelector('.shiba').className, muted:v.muted, controls:v.controls, loop:v.loop, ended:v.ended, vis:getComputedStyle(v).visibility}})()`);
      check('Шиба: ролик без звука и элементов управления проигран один раз, остался последний кадр', sh.cls.includes('is-ended') && sh.ended && sh.muted && !sh.controls && !sh.loop && sh.vis === 'visible', JSON.stringify(sh));
    }
    // Фокус касанием
    await S.eval(`document.activeElement && document.activeElement.blur(); true`);
    await S.tap(...(await S.eval(`(()=>{const r=document.querySelector('#f-name').getBoundingClientRect();return [r.left+20,r.top+r.height/2]})()`))); await sleep(250);
    let fs = await focusStyle(S);
    check(`${up}: фокус касанием — граница 1 px сиреневая, без кольца и тени`, fs.focused && fs.bw === '1px' && fs.bc === ACC && fs.shadow === 'none' && fs.outline === 'none', JSON.stringify(fs));
    // Фокус по Tab
    // с кнопки «Войти» Shift+Tab возвращает на поле (клавиатурная навигация)
    await S.eval(`document.querySelector('#join [type="submit"]').focus(); true`); await sleep(300);
    const unf = await focusStyle(S);
    await S.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await S.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await sleep(300);
    fs = await focusStyle(S);
    check(`${up}: фокус по Tab — та же сиреневая граница, заметно отличается от покоя`, fs.focused && fs.bw === '1px' && fs.bc === ACC && fs.shadow === 'none' && fs.outline === 'none' && unf.bc !== ACC, `${unf.bc} → ${fs.bc}`);
    if (l === 'ru') await S.shot(root + 'screenshots/ipad-join-ru.png'); else await S.shot(root + 'screenshots/ipad-join-en.png');
    // Пустое имя
    await S.eval(`document.querySelector('#join').requestSubmit(); true`); await sleep(150);
    check(`${up}: без имени — сообщение об ошибке, вход не выполнен`, await S.eval(`document.querySelector('#f-name').getAttribute('aria-invalid')==='true' && !!document.querySelector('#f-name-err').textContent && !document.querySelector('canvas.live')`));
    // Экранная клавиатура: видимая область ~420 px
    await S.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 420, deviceScaleFactor: 2, mobile: false }); await sleep(500);
    await S.tap(...(await S.eval(`(()=>{const r=document.querySelector('#f-name').getBoundingClientRect();return [r.left+20,Math.min(r.top+r.height/2, innerHeight-10)]})()`))); await sleep(500);
    const kb = await S.eval(`(()=>{const i=document.querySelector('#f-name').getBoundingClientRect(),b=document.querySelector('#join [type="submit"]').getBoundingClientRect();return {compact:document.querySelector('.page').classList.contains('kb-compact'), input:[Math.round(i.top),Math.round(i.bottom)], btn:[Math.round(b.top),Math.round(b.bottom)], vh:innerHeight}})()`);
    check(`${up}: с клавиатурой (видно 420 px) поле и «${x.btn}» в зоне видимости`, kb.compact && kb.input[0] >= 0 && kb.btn[1] <= kb.vh && kb.btn[1] - kb.btn[0] >= 44, JSON.stringify(kb));
    if (l === 'ru') await S.shot(root + 'screenshots/ipad-join-keyboard-ru.png');
    await S.send('Input.insertText', { text: l === 'ru' ? 'Аня' : 'Anya' });
    await S.tap(...(await S.eval(`(()=>{const r=document.querySelector('#join [type="submit"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`))); await sleep(900);
    await S.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 2, mobile: false }); await sleep(400);
    check(`${up}: касание «${x.btn}» — ученик на доске, интерфейс на ${up}`, await S.eval(`!!document.querySelector('canvas.live') && document.documentElement.lang==='${l}'`));
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
