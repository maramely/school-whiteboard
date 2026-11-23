// Экран результата учителя: статус «Урок завершён» с иконкой салюта, заголовок «Вы можете сохранить эту доску»,
// строка с датой и временем, фактическое время автоудаления; превью, имя файла и кнопки на месте. RU и EN.
// Запуск: node server.js  →  node tools/e2e-result.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const X = {
  ru: { status: 'Урок завершён', h1: 'Вы можете сохранить эту доску', hint: (t) => `Доска хранится в этом браузере до ${t}. Если вы закроете сайт, она удалится при следующем открытии после этого времени. Скачанный файл останется у вас.`, btns: 'Скачать PNG|Удалить доску|Новая доска', loc: 'ru-RU' },
  en: { status: 'Lesson finished', h1: 'You can save this board', hint: (t) => `The board is kept in this browser until ${t}. If you close the site, it will be deleted the next time you open it after that time. Your downloaded file stays with you.`, btns: 'Download PNG|Delete board|New board', loc: 'en-GB' },
};
const c = await launch({ port: 9408 });
try {
  const P = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await P.goto(U + '#/'); await P.eval(`localStorage.clear(); sessionStorage.clear(); true`);
  for (const l of ['ru', 'en']) {
    const x = X[l], up = l.toUpperCase();
    await P.goto(U + `#/demo/teacher?reset=1&lang=${l}`); await sleep(1500);
    await P.eval(`document.querySelector('[data-action="end"]').click(); true`); await sleep(300);
    await P.eval(`document.querySelector('.modal .btn-primary').click(); true`); await sleep(1200);
    const r = await P.eval(`(()=>{const s=document.querySelector('.result-side'), st=s.querySelector('.status'), b=JSON.parse(localStorage.getItem('wb:board:true-false'));
      const exp=new Date(b.endedAt+60*60*1000).toLocaleTimeString('${x.loc}',{hour:'2-digit',minute:'2-digit'});
      return {status:st.textContent.trim(), icon:!!st.querySelector('svg.ic'), dot:getComputedStyle(st,'::before').display, h1:s.querySelector('h1').textContent, lead:s.querySelector('.lead').textContent,
        endedLine:new Date(b.endedAt).toLocaleDateString('${x.loc}',{day:'numeric',month:'long'})+', '+new Date(b.endedAt).toLocaleTimeString('${x.loc}',{hour:'2-digit',minute:'2-digit'}), hint:s.querySelector('.hint span').textContent, exp,
        preview:!!document.querySelector('.result-preview canvas'), file:!!document.querySelector('#f-file'), btns:[...s.querySelectorAll('.btn')].map(b=>b.textContent.trim()).join('|')}})()`);
    check(`${up}: статус — иконка салюта и только «${x.status}», без точки`, r.status === x.status && r.icon && r.dot === 'none', r.status);
    check(`${up}: заголовок «${x.h1}»`, r.h1 === x.h1, r.h1);
    check(`${up}: под заголовком только дата и время завершения (${r.endedLine}), без предмета и темы`, r.lead === r.endedLine && !/Английский|English|True or False|·/.test(r.lead), r.lead);
    check(`${up}: инфоблок с фактическим временем удаления (${r.exp})`, r.hint === x.hint(r.exp), r.hint);
    check(`${up}: превью, имя файла и кнопки на месте`, r.preview && r.file && r.btns === x.btns, r.btns);
    // «Имя файла» + «.png»: один блок, общая граница 1 px; при фокусе меняется только её цвет
    const ff = () => P.eval(`(()=>{const b=document.querySelector('.file-field'),i=b.querySelector('.input'),e=b.querySelector('.ext'),sb=getComputedStyle(b),si=getComputedStyle(i),se=getComputedStyle(e),r=b.getBoundingClientRect();
      return {focused:document.activeElement===i, bw:[sb.borderTopWidth,sb.borderRightWidth,sb.borderBottomWidth,sb.borderLeftWidth].join(), bc:[sb.borderTopColor,sb.borderRightColor,sb.borderBottomColor,sb.borderLeftColor], shadow:sb.boxShadow, radius:sb.borderTopLeftRadius, outline:si.outlineStyle, ishadow:si.boxShadow, iborder:si.borderTopWidth, sep:se.borderLeftWidth+' '+se.borderLeftColor, size:[Math.round(r.width*100)/100,Math.round(r.height*100)/100].join('×')}})()`);
    await P.eval(`document.activeElement && document.activeElement.blur(); true`); await sleep(300);
    const idle = await ff();
    check(`${up}: поле и «.png» — один блок с общей скруглённой границей 1 px, разделитель тонкий и нейтральный`, idle.bw === '1px,1px,1px,1px' && new Set(idle.bc).size === 1 && idle.radius !== '0px' && idle.sep === '1px ' + idle.bc[0] && idle.shadow === 'none', `${idle.bc[0]}, радиус ${idle.radius}, разделитель ${idle.sep}`);
    const ACC = 'rgb(117, 99, 202)';
    const fr = await P.eval(`(()=>{const r=document.querySelector('#f-file').getBoundingClientRect();return [r.left+40,r.top+r.height/2]})()`);
    await P.click(fr[0], fr[1]); await sleep(300);
    let fc = await ff();
    check(`${up}: клик — меняется только цвет общей границы (сиреневый), без кольца и внутреннего контура, размер прежний`, fc.focused && fc.bc.every((x) => x === ACC) && fc.bw === idle.bw && fc.shadow === 'none' && fc.outline === 'none' && fc.ishadow === 'none' && fc.iborder === '0px' && fc.size === idle.size, `${idle.size} → ${fc.size}`);
    if (l === 'ru') { const r = await P.eval(`(()=>{const b=document.querySelector('.file-field').getBoundingClientRect();return {x:b.left-12,y:b.top-12,width:b.width+24,height:b.height+24}})()`); const { data } = await P.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 2 } }); (await import('node:fs')).writeFileSync(root + 'screenshots/result-file-field-focus.png', Buffer.from(data, 'base64')); }
    // Tab: с кнопки «Скачать PNG» Shift+Tab возвращает фокус в поле
    await P.eval(`document.querySelector('#dl-form [type="submit"]').focus(); true`); await sleep(300);
    const away = await ff();
    await P.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await P.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await sleep(300);
    fc = await ff();
    check(`${up}: Tab — та же сиреневая граница, заметна на фоне покоя, рамка непрерывная, размер прежний`, !away.focused && away.bc[0] !== ACC && fc.focused && fc.bc.every((x) => x === ACC) && fc.outline === 'none' && fc.shadow === 'none' && fc.size === idle.size, `${away.bc[0]} → ${fc.bc[0]}`);
    await P.eval(`document.activeElement.blur(); true`); await sleep(200);
    await P.shot(root + `screenshots/macbook-result-${l}.png`);
  }
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
