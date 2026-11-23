// Хранилище изображений: старые изображения из переполненного localStorage переносятся в IndexedDB,
// загрузка больших PNG работает многократно, ученик в другой вкладке видит изображение.
// Запуск: node server.js  →  node tools/e2e-storage.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const c = await launch({ port: 9403 });
try {
  const T = await c.newPage('', { width: 1440, height: 900, scale: 1 });
  await T.goto(U + 'storage-probe'); await sleep(300); // страница без приложения: IndexedDB не открыт
  // Состояние «как у пользователя»: localStorage почти заполнен старыми изображениями
  const filled = await T.eval(`(async()=>{ localStorage.clear(); sessionStorage.clear(); await new Promise(r=>{const q=indexedDB.deleteDatabase('wb-images'); q.onsuccess=q.onerror=q.onblocked=()=>r();});
    const b=await (await fetch('/worksheet-true-false.png')).blob(); const u=await new Promise(r=>{const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(b);});
    let n=0; try { for(;n<40;n++) localStorage.setItem('wb:img:old'+n, u); } catch(e) {}
    let free=true; try { localStorage.setItem('wb:probe', 'x'.repeat(400000)); localStorage.removeItem('wb:probe'); } catch(e) { free=false; }
    return {n, full:!free}; })()`);
  check('Воспроизведено: localStorage переполнен старыми изображениями', filled.full && filled.n > 0, `${filled.n} изображений`);
  await T.goto(U + '?#/?lang=ru'); await sleep(2500);
  const after = await T.eval(`(async()=>({left:Object.keys(localStorage).filter(k=>k.startsWith('wb:img:')).length, idb: await new Promise(r=>{const q=indexedDB.open('wb-images'); q.onsuccess=()=>{const tx=q.result.transaction('images'); const c=tx.objectStore('images').count(); c.onsuccess=()=>r(c.result);};})}))()`);
  check('При открытии старые изображения перенесены в IndexedDB, localStorage освобождён', after.left === 0 && after.idb === filled.n, JSON.stringify(after));
  await T.eval(`document.querySelector('#create-form').requestSubmit(); true`); await sleep(900);
  const id = await T.eval(`location.hash.split('/')[2]`);
  const invite = await T.eval(`document.querySelector('.link-field').value`);
  await T.eval(`document.querySelector('[data-action="invite"]').click(); true`);
  const S = await c.newPage('', { width: 1180, height: 820, scale: 1 });
  await S.goto(invite); await sleep(300); await S.eval(`document.querySelector('#f-name').value='Аня'; document.querySelector('#join').requestSubmit(); true`); await sleep(700);
  await T.bringToFront();
  const upload = async (file) => {
    const { root: d } = await T.send('DOM.getDocument', {});
    const { nodeId } = await T.send('DOM.querySelector', { nodeId: d.nodeId, selector: '#file' });
    await T.send('DOM.setFileInputFiles', { nodeId, files: [root + 'worksheet/' + file] }); await sleep(1800);
  };
  let okAll = true;
  for (let i = 0; i < 6; i++) {
    await upload(i % 2 ? 'worksheet-true-false.png' : 'worksheet-true-false-vertical.png');
    const st = await T.eval(`({img:!!JSON.parse(localStorage.getItem('wb:board:${id}')).image, full:[...document.querySelectorAll('.toast')].some(t=>/места|space/.test(t.textContent))})`);
    if (!st.img || st.full) { okAll = false; break; }
    await T.eval(`document.querySelector('[data-img="place"]').click(); true`); await sleep(300);
    await T.eval(`document.querySelector('[data-action="image"]').click(); true`); await sleep(200);
    await T.eval(`document.querySelector('.modal .btn-danger').click(); true`); await sleep(300);
  }
  check('Шесть загрузок больших PNG подряд — без «закончилось место»', okAll);
  await upload('worksheet-true-false-vertical.png');
  await T.eval(`document.querySelector('[data-img="place"]').click(); true`); await sleep(500);
  check('Состояние доски по-прежнему в localStorage и небольшое', await T.eval(`localStorage.getItem('wb:board:${id}').length < 20000`));
  await S.bringToFront(); await sleep(800);
  const seen = await S.eval(`(()=>{const c=document.querySelector('canvas.base'),g=c.getContext('2d'); const d=g.getImageData(Math.round(c.width/2),Math.round(c.height*0.25),1,1).data; return [...d].slice(0,3).join(',')})()`);
  check('Ученик в другой вкладке видит вставленное изображение', seen !== '255,255,255', seen);
  await T.bringToFront(); await T.goto(U + '#/x'); await sleep(200); await T.goto(U + '#/t/' + id); await sleep(1200);
  const kept = await T.eval(`(()=>{const c=document.querySelector('canvas.base'),g=c.getContext('2d'); return [...g.getImageData(Math.round(c.width/2),Math.round(c.height*0.25),1,1).data].slice(0,3).join(',')})()`);
  check('После перезагрузки изображение на месте', kept !== '255,255,255', kept);
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
