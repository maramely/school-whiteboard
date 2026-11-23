// Рендер учебных листов → PNG:
//   worksheet/worksheet.html          → worksheet-true-false.png          (2400×1500, горизонтальный)
//   worksheet/worksheet-vertical.html → worksheet-true-false-vertical.png (2400×3400, вертикальный)
import { launch, sleep } from './cdp.mjs';
import { copyFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const c = await launch({ port: 9335 });
for (const [src, out, w, h, k] of [['worksheet.html', 'worksheet-true-false.png', 1600, 1000, 1.5], ['worksheet-vertical.html', 'worksheet-true-false-vertical.png', 1200, 1700, 2]]) {
  const p = await c.newPage('', { width: w, height: h, scale: k });
  await p.goto('file://' + root + 'worksheet/' + src);
  await p.eval('document.fonts.ready.then(()=>true)'); await sleep(300);
  await p.shot(root + 'worksheet/' + out);
  copyFileSync(root + 'worksheet/' + out, root + 'public/' + out);
}
await c.close();
console.log('ok');
