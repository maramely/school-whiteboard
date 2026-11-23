// Последний кадр видео → PNG с прозрачностью (для статичной позы ShibaMascot).
// Запуск при работающем сервере (npm start):
//   node tools/shiba-last-frame.mjs animations/shiba-creation.webm public/animations/shiba-final.png
// Первый аргумент — путь к видео внутри public/, второй — куда сохранить PNG.
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const [, , video = 'animations/shiba-creation.webm', out = new URL('../public/animations/shiba-final.png', import.meta.url).pathname] = process.argv;
const c = await launch({ port: 9399 });
try {
  const P = await c.newPage('', { width: 400, height: 300 });
  await P.goto('http://localhost:5173/last-frame-probe'); await sleep(300);
  const r = await P.eval(`(async()=>{
    const v=document.createElement('video'); v.muted=true; v.playsInline=true; v.preload='auto'; v.src=${JSON.stringify('/' + video)};
    document.documentElement.appendChild(v);
    await new Promise((res,rej)=>{ v.onloadeddata=res; v.onerror=()=>rej(new Error('Видео не загрузилось: ' + v.src)); });
    // проигрываем до конца: на событии ended в видео остаётся именно последний кадр (надёжнее, чем перемотка WebM)
    v.playbackRate = 4; await v.play(); await new Promise((res)=>{ v.onended=res; }); await new Promise((res)=>setTimeout(res, 200));
    const cv=document.createElement('canvas'); cv.width=v.videoWidth; cv.height=v.videoHeight;
    const g=cv.getContext('2d'); g.drawImage(v,0,0);
    const corner=g.getImageData(0,0,1,1).data[3];
    return { w:v.videoWidth, h:v.videoHeight, t:v.currentTime, dur:v.duration, transparentCorner: corner===0, data: cv.toDataURL('image/png').split(',')[1] };
  })()`);
  writeFileSync(out, Buffer.from(r.data, 'base64'));
  console.log(`Сохранено: ${out}\n${r.w}×${r.h}, кадр ${r.t.toFixed(3)} из ${r.dur.toFixed(3)} c, прозрачный фон: ${r.transparentCorner ? 'да' : 'НЕТ — проверьте альфа-канал'}`);
} finally { await c.close(); }
