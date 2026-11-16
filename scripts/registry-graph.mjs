/**
 * Component graph from sources — shared by vite.lazy.config.ts and build-pack.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACK_BUILDER_URL = 'https://k3ui-expressive.vercel.app/?product=k3ux';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readCatalog() {
  const src = fs.readFileSync(path.join(root, 'src/registry/catalog.ts'), 'utf8');
  const re =
    /tag:\s*'(k3-[a-z0-9-]+)',\s*load:\s*\(\)\s*=>\s*import\('\.\.\/components\/([\w/.-]+?)\.js'\)/g;
  return [...src.matchAll(re)].map((m) => ({ tag: m[1], file: m[2] }));
}

export function readDeps() {
  const src = fs.readFileSync(path.join(root, 'src/registry/deps.ts'), 'utf8');
  const deps = {};
  for (const m of src.matchAll(/^\s*'(k3-[a-z0-9-]+)':\s*\[([^\]]*)\]/gm)) {
    deps[m[1]] = [...m[2].matchAll(/'(k3-[a-z0-9-]+)'/g)].map((d) => d[1]);
  }
  return deps;
}

export function normalizeTag(name) {
  const tag = String(name).trim().toLowerCase();
  return tag.startsWith('k3-') ? tag : `k3-${tag}`;
}

export function closure(tags, catalog = readCatalog(), deps = readDeps()) {
  const known = new Set(catalog.map((c) => c.tag));
  const out = new Set();
  const visit = (tag) => {
    if (out.has(tag)) return;
    if (!known.has(tag)) throw new Error(`Unknown component: ${tag}`);
    out.add(tag);
    for (const dep of deps[tag] ?? []) visit(dep);
  };
  for (const tag of tags) visit(normalizeTag(tag));
  return catalog.map((c) => c.tag).filter((t) => out.has(t));
}

export function sourceFile(entry) {
  return path.join(root, 'src/components', `${entry.file}.ts`);
}
