// Сборка статического сайта (GitHub Pages, Netlify Drop): копия public/ без служебных и неиспользуемых файлов.
// Все пути в приложении относительные, поэтому сборка работает и в корне домена, и по подпути /school-whiteboard/.
// Запуск: npm run build  (или node tools/build.mjs [папка])  →  dist/site
import { cpSync, rmSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const SRC = join(root, 'public'), OUT = process.argv[2] ? join(root, process.argv[2]) : join(root, 'dist/site');
const SKIP = new Set(['.DS_Store', 'shiba-final.png', 'mascot-placeholder.svg']); // не используются приложением
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true, filter: (p) => !SKIP.has(basename(p)) });
// Заголовки Netlify: страницу и код не кэшировать (после повторной выкладки сразу новая версия), видео — правильный тип
writeFileSync(join(OUT, '.nojekyll'), ''); // GitHub Pages: отдавать файлы как есть
writeFileSync(join(OUT, '_headers'), `/*
  Cache-Control: no-cache
/animations/*.webm
  Content-Type: video/webm
`);
const list = (d, pre = '') => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? list(p, pre + f + '/') : [[pre + f, statSync(p).size]]; });
const files = list(OUT);
console.log(`Готово: ${OUT}`);
files.forEach(([f, s]) => console.log(`  ${f.padEnd(40)} ${(s / 1024).toFixed(0).padStart(6)} КБ`));
console.log(`  итого: ${files.length} файлов, ${(files.reduce((a, [, s]) => a + s, 0) / 1048576).toFixed(1)} МБ`);
