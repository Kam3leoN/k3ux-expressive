import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

/**
 * Optional holo foils for <k3-holo-card> (GPL-3.0 add-on, outside k3ux.js):
 * addons/holo-effects → dist/holo-effects/{k3ux-holo-effects.css, img/, LICENSE}
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'addons/holo-effects');
const out = path.join(root, 'dist/holo-effects');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'img'), { recursive: true });

const { css } = sass.compile(path.join(src, 'holo-effects.scss'), { style: 'compressed' });
fs.writeFileSync(path.join(out, 'k3ux-holo-effects.css'), css);
for (const file of fs.readdirSync(path.join(src, 'img'))) {
  fs.copyFileSync(path.join(src, 'img', file), path.join(out, 'img', file));
}
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE'));

const kb = (fs.statSync(path.join(out, 'k3ux-holo-effects.css')).size / 1024).toFixed(1);
console.log(
  `dist/holo-effects written (${kb} kB CSS + ${fs.readdirSync(path.join(out, 'img')).length} images, GPL-3.0)`,
);
