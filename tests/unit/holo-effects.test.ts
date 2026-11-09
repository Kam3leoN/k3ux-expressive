import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as sass from 'sass';

/**
 * addons/holo-effects — optional GPL-3.0 foils for k3-holo-card, painted from
 * outside through ::part(). Must stay out of the MIT bundle (src/).
 */
const root = process.cwd();
const addon = path.join(root, 'addons/holo-effects');
const EFFECTS = [
  'holo',
  'reverse',
  'cosmos',
  'rainbow',
  'rainbow-alt',
  'secret',
  'v',
  'vmax',
  'vstar',
  'full-art',
  'shiny',
  'radiant',
  'full-art-wave',
];

const css = sass.compile(path.join(addon, 'holo-effects.scss'), { style: 'expanded' }).css;

describe('holo effects add-on', () => {
  it('keeps its GPL-3.0 notice and license file', () => {
    expect(css).toContain('pokemon-cards-css');
    expect(css).toContain('GNU GPL v3');
    expect(fs.readFileSync(path.join(addon, 'LICENSE'), 'utf8')).toMatch(/GNU GENERAL PUBLIC LICENSE\s+Version 3/);
  });

  it('paints the shine part of every foil', () => {
    for (const effect of EFFECTS) {
      expect(css, effect).toContain(`k3-holo-card[effect=${effect}]::part(shine)`);
    }
  });

  it('targets the component parts directly (no descendant ::part)', () => {
    expect(css).not.toMatch(/\s::part\(/);
    expect(css).not.toMatch(/\.holo-card|data-effect/);
  });

  it('only reads the --k3-holo-* variables', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!));
    expect([...used].filter((name) => !name.startsWith('--k3-holo-'))).toEqual([]);
  });

  it('ships every image it references', () => {
    const files = [...css.matchAll(/url\("\.\/img\/([^"]+)"\)/g)].map((m) => m[1]!);
    expect(files.length).toBeGreaterThan(0);
    for (const file of new Set(files)) expect(fs.existsSync(path.join(addon, 'img', file)), file).toBe(true);
  });

  it('is never imported by the MIT library', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|scss|css)$/.test(entry.name)) {
          /* Mentions in comments are fine (docs, examples) — imports are not */
          const code = fs
            .readFileSync(full, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
          if (/^\s*(?:import|@use|@import)\s[^;\n]*holo-effects/m.test(code)) offenders.push(path.relative(root, full));
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(offenders).toEqual([]);
  });
});
