// ShibaMascot на экране создания доски: shiba.webm проигрывается один раз, без звука и элементов управления,
// после окончания остаётся последний кадр самого видео. Запасной вариант — shiba-last.png (тот же последний кадр):
// ошибка загрузки, отказ автозапуска, prefers-reduced-motion.
// Запуск: node server.js  →  node tools/e2e-shiba.mjs
import { launch, sleep } from './cdp.mjs';
const root = new URL('..', import.meta.url).pathname;
const U = 'http://localhost:5173/';
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', '-', n, x); };
const state = (P) => P.eval(`(()=>{const w=document.querySelector('.shiba'),i=w.querySelector('img'),v=w.querySelector('video'),r=w.getBoundingClientRect();
  return {cls:w.className, w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.left), y:Math.round(r.top), fit:getComputedStyle(i).objectFit, bg:getComputedStyle(w).backgroundColor,
  stillVis:getComputedStyle(i).visibility, still:i.getAttribute('src'),
  v: v && {src:v.currentSrc, vis:getComputedStyle(v).visibility, muted:v.muted, controls:v.controls, loop:v.loop, ended:v.ended, paused:v.paused, t:v.currentTime, dur:v.duration, plays:window.__plays||0}}})()`);

const c = await launch({ port: 9397 });
try {
  const P = await c.newPage('', { width: 1440, height: 900, scale: 2 });
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__plays=0; document.addEventListener('play', e=>{ if(e.target.classList&&e.target.classList.contains('shiba-video')) window.__plays++; }, true);` });
  await P.goto(U + '#/?lang=ru'); await sleep(300);
  let s = await state(P);
  check('Ролик shiba.webm запущен: без звука, без элементов управления, без повтора', s.v && /shiba\.webm$/.test(s.v.src) && s.cls.includes('is-playing') && s.v.muted && !s.v.controls && !s.v.loop, JSON.stringify(s.v));
  check('Прежний размер и место: 132×132, object-fit: contain, прозрачный фон', s.w === 132 && s.h === 132 && s.fit === 'contain' && s.bg === 'rgba(0, 0, 0, 0)', `${s.w}×${s.h}`);
  const box = [s.x, s.y, s.w, s.h].join();
  await P.shot(root + 'screenshots/shiba-playing.png');
  // ждём окончания (ролик ~4 с)
  for (let i = 0; i < 40 && !(s.v && s.v.ended); i++) { await sleep(250); s = await state(P); }
  check('Ролик доиграл до конца', s.v.ended && Math.abs(s.v.t - s.v.dur) < 0.05, `${s.v.t.toFixed(2)} / ${s.v.dur.toFixed(2)} c`);
  check('После окончания на экране последний кадр самого видео (видео видно, PNG скрыт)', s.cls.includes('is-ended') && !s.cls.includes('is-still') && s.v.vis === 'visible' && s.stillVis === 'hidden' && !!s.v.src, s.cls);
  const px = await P.eval(`(()=>{const v=document.querySelector('.shiba-video'),c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.drawImage(v,0,0,64,64);const d=g.getImageData(0,0,64,64).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n})()`);
  check('Последний кадр не пустой', px > 200, `${px} непрозрачных пикселей из 4096`);
  await sleep(2500); const s2 = await state(P);
  check('Ролик проигрывается один раз: через 2,5 с не перезапустился, кадр на месте', s2.v.plays === 1 && s2.v.ended && s2.v.paused && s2.v.t === s.v.t && [s2.x, s2.y, s2.w, s2.h].join() === box, `запусков: ${s2.v.plays}`);
  await P.shot(root + 'screenshots/shiba-ended.png');
  // Запасной кадр — последний кадр этого же ролика
  const same = await P.eval(`(async()=>{const v=document.querySelector('.shiba-video'),im=new Image();im.src='/animations/shiba-last.png';await im.decode();
    const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=a.height=b.width=b.height=48;a.getContext('2d').drawImage(v,0,0,48,48);b.getContext('2d').drawImage(im,0,0,48,48);
    const x=a.getContext('2d').getImageData(0,0,48,48).data,y=b.getContext('2d').getImageData(0,0,48,48).data;let d=0;for(let i=0;i<x.length;i++)d+=Math.abs(x[i]-y[i]);return d/x.length})()`);
  check('Запасной PNG совпадает с последним кадром ролика', same < 6, `среднее расхождение ${same.toFixed(2)}`);

  // Ошибка загрузки видео → статичный кадр
  await P.send('Network.enable'); await P.send('Network.setBlockedURLs', { urls: ['*shiba.webm*'] });
  await P.goto(U + '#/x'); await sleep(200); await P.goto(U + '#/?lang=ru'); await sleep(600);
  s = await state(P);
  check('Видео не загрузилось → статичный кадр shiba-last.png на том же месте', s.cls.includes('is-still') && s.stillVis === 'visible' && /shiba-last\.png$/.test(s.still) && [s.x, s.y, s.w, s.h].join() === box, s.cls);
  await P.send('Network.setBlockedURLs', { urls: [] });

  // Автозапуск недоступен → статичный кадр
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.search.includes('noautoplay')) HTMLMediaElement.prototype.play = function(){ return Promise.reject(new DOMException('blocked','NotAllowedError')); };` });
  await P.goto(U + '?noautoplay#/?lang=ru'); await sleep(900);
  s = await state(P);
  check('Автозапуск запрещён → статичный кадр', s.cls.includes('is-still') && s.stillVis === 'visible' && [s.x, s.y, s.w, s.h].join() === box, s.cls);

  // Уменьшение движения → статичный кадр, видео не запускается
  await P.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await P.goto(U + '#/x'); await sleep(200); await P.goto(U + '#/?lang=ru'); await sleep(500);
  s = await state(P);
  check('prefers-reduced-motion → статичный кадр, ролик не играет', s.cls.includes('is-still') && s.stillVis === 'visible' && (!s.v.src || s.v.paused) && [s.x, s.y, s.w, s.h].join() === box);
  await P.send('Emulation.setEmulatedMedia', { features: [] });

  // iPad
  await P.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 820, deviceScaleFactor: 2, mobile: false });
  await P.goto(U + '#/x'); await sleep(200); await P.goto(U + '#/?lang=ru'); await sleep(5200);
  s = await state(P);
  check('iPad: 132×132, ролик доиграл, последний кадр на экране', s.w === 132 && s.h === 132 && s.fit === 'contain' && s.cls.includes('is-ended') && s.v.vis === 'visible');
  await P.shot(root + 'screenshots/ipad-start-shiba-ru.png');
} catch (e) { console.error(e); res.push(false); } finally { await c.close(); }
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
