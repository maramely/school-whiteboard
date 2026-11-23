// Автоочистка не зависит от списка последних 50 досок: срок проверяется для всех сохранённых досок.
// Сроки: завершённая — час после урока; незавершённая — 30 дней после последнего изменения.
// Запуск: node server.js  →  node tools/e2e-expiry.mjs
import { launch, sleep } from './cdp.mjs';
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const c = await launch({ port: 9414 });
try {
  const P = await c.newPage('', { width: 1200, height: 800, scale: 1 });
  // Готовим состояние на странице без приложения (как будто сайт был закрыт)
  await P.goto(U + 'expiry-probe'); await sleep(300);
  const setup = await P.eval(`(async()=>{ localStorage.clear(); sessionStorage.clear();
    await new Promise(r=>{const q=indexedDB.deleteDatabase('wb-images'); q.onsuccess=q.onerror=q.onblocked=()=>r();});
    const now=Date.now(), H=3600e3, D=24*H;
    const mk=(id,o)=>localStorage.setItem('wb:board:'+id, JSON.stringify(Object.assign({id, title:id, status:'active', createdAt:now-40*D, updatedAt:now, image:null, imgIds:[], elements:[], snapshots:[]}, o)));
    // 50 свежих досок заполняют список последних
    const recent=[]; for(let i=0;i<50;i++){ const id='recent'+i; mk(id,{updatedAt:now-i*60e3}); recent.push(id); }
    localStorage.setItem('wb:boards', JSON.stringify(recent));
    // Доски вне списка последних 50
    const blob=await (await fetch('/worksheet-true-false.png')).blob();
    await new Promise((res,rej)=>{const r=indexedDB.open('wb-images',1); r.onupgradeneeded=()=>r.result.createObjectStore('images'); r.onsuccess=()=>{const tx=r.result.transaction('images','readwrite'); tx.objectStore('images').put(blob,'img-old'); tx.oncomplete=()=>{r.result.close();res();}; tx.onerror=rej;}; r.onerror=rej;});
    mk('old-ended', {status:'ended', endedAt:now-61*60e3, image:{imgId:'img-old',x:0,y:0,w:10,h:10,locked:true}, imgIds:['img-old']});
    mk('old-idle',  {updatedAt:now-31*D});
    mk('fresh-ended', {status:'ended', endedAt:now-30*60e3});
    mk('fresh-idle',  {updatedAt:now-29*D});
    return {boards:Object.keys(localStorage).filter(k=>k.startsWith('wb:board:')).length, list:JSON.parse(localStorage.getItem('wb:boards')).length};
  })()`);
  check('Состояние: 50 досок в списке последних + 4 доски вне списка', setup.boards === 54 && setup.list === 50, JSON.stringify(setup));
  // Повторное открытие сайта
  await P.goto(U + '#/'); await sleep(1500);
  const after = await P.eval(`(async()=>{ const has=(id)=>!!localStorage.getItem('wb:board:'+id), gone=(id)=>JSON.parse(localStorage.getItem('wb:gone:'+id)||'null');
    const img=await new Promise(r=>{const q=indexedDB.open('wb-images'); q.onsuccess=()=>{const g=q.result.transaction('images').objectStore('images').get('img-old'); g.onsuccess=()=>r(!!g.result);};});
    return {oldEnded:has('old-ended'), oldIdle:has('old-idle'), freshEnded:has('fresh-ended'), freshIdle:has('fresh-idle'), goneEnded:gone('old-ended'), goneIdle:gone('old-idle'), img, recent:Array.from({length:50},(_, i)=>has('recent'+i)).every(Boolean), list:JSON.parse(localStorage.getItem('wb:boards')).length}})()`);
  check('Завершённая больше часа назад доска вне списка 50 удалена при открытии сайта', !after.oldEnded && after.goneEnded && after.goneEnded.reason === 'expired', JSON.stringify(after.goneEnded));
  check('…вместе с изображением в IndexedDB', !after.img);
  check('Незавершённая доска без изменений 31 день (вне списка 50) удалена', !after.oldIdle && after.goneIdle && after.goneIdle.reason === 'expired');
  check('Сроки не сдвинулись: завершённая 30 минут назад и неизменённая 29 дней — на месте', after.freshEnded && after.freshIdle);
  check('Доски из списка последних 50 не тронуты', after.recent && after.list === 50);
  // Ссылка на удалённую доску вне списка показывает «Срок хранения истёк»
  await P.goto(U + '#/x'); await sleep(150); await P.goto(U + '#/t/old-ended'); await sleep(500);
  check('Открытие удалённой доски — «Срок хранения истёк»', /Срок хранения истёк/.test(await P.eval(`document.querySelector('h1').textContent`)));
  // Срок наступил, пока сайт был закрыт: свежая доска стареет «на закрытом сайте» и удаляется при следующем открытии
  await P.goto(U + 'expiry-probe'); await sleep(200);
  await P.eval(`(()=>{const k='wb:board:fresh-ended',b=JSON.parse(localStorage.getItem(k)); b.endedAt-=31*60e3; localStorage.setItem(k,JSON.stringify(b)); return true})()`);
  await P.goto(U + '#/'); await sleep(1200);
  check('Доска, у которой срок истёк при закрытом сайте, удалена при следующем открытии', !(await P.eval(`!!localStorage.getItem('wb:board:fresh-ended')`)));
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
