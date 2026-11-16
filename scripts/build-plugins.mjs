/**
 * Vite plugins for the on-demand build and custom packs.
 */
import { readCatalog } from './registry-graph.mjs';

const norm = (id) => id.replace(/\\/g, '/').split('?')[0];

/** Styles ship once as dist/k3ux.css — secondary builds skip the stylesheet. */
export function skipStylesheet() {
  return {
    name: 'k3ux-skip-stylesheet',
    enforce: 'pre',
    load(id) {
      return /\/src\/styles\/k3ux\.scss$/.test(norm(id)) ? '' : null;
    },
  };
}

/**
 * Custom packs: catalog keeps every tag; excluded ones load a null stub so the
 * registry can name what is missing.
 */
export function filterCatalog(tags) {
  const keep = new Set(tags);
  return {
    name: 'k3ux-filter-catalog',
    enforce: 'pre',
    load(id) {
      if (!/\/src\/registry\/catalog\.ts$/.test(norm(id))) return null;
      const rows = readCatalog().map((c) =>
        keep.has(c.tag)
          ? `  { tag: '${c.tag}', load: () => import('../components/${c.file}.js') },`
          : `  { tag: '${c.tag}', load: excluded },`,
      );
      return (
        `const excluded = () => Promise.resolve({ default: null });\n` +
        `export const catalog = [\n${rows.join('\n')}\n];\n`
      );
    },
  };
}

/** Banner + `globalThis.K3UX_PACK`. */
export function packHeader({ name, version, components, builder }) {
  const info = { name, version, components, builder };
  const root = String(builder).split('#')[0] || 'https://k3ui-expressive.vercel.app/?product=k3ux';
  const tags = components.map((t) => t.slice(3)).join('+');
  const joiner = root.includes('?') ? '&' : '?';
  const url = `${root}${joiner}components=${tags}#/pack`;
  return {
    banner: `/*! K3UX ${version} — custom pack "${name}" (${components.length} components)\n * ${url} */`,
    intro: `globalThis.K3UX_PACK=${JSON.stringify(info)};`,
  };
}
