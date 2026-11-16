/**
 * Custom k3ux pack — one file with the base + selected components.
 *
 *   npm run build:pack -- confetti snow
 *   npm run build:pack -- --list
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { PACK_BUILDER_URL, closure, normalizeTag, readCatalog, readDeps, root } from './registry-graph.mjs';

export function parseArgs(argv) {
  const opts = { tags: [], name: 'k3ux.pack', out: 'dist/packs', list: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') opts.list = true;
    else if (arg === '--name' || arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} needs a value`);
      opts[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else opts.tags.push(...arg.split(',').filter(Boolean).map(normalizeTag));
  }
  if (!/^[\w.-]+$/.test(opts.name)) throw new Error(`Invalid pack name: ${opts.name}`);
  return opts;
}

export function resolvePack(tags, catalog = readCatalog(), deps = readDeps()) {
  const requested = [...new Set(tags.map(normalizeTag))];
  const all = closure(requested, catalog, deps);
  return { requested, added: all.filter((t) => !requested.includes(t)), tags: all };
}

export async function buildPack({ tags, name = 'k3ux.pack', out = 'dist/packs' }) {
  const pack = resolvePack(tags);
  if (!pack.tags.length) throw new Error('No component selected — pass tags or use --list');
  const { build } = await import('vite');
  const { filterCatalog, packHeader, skipStylesheet } = await import('./build-plugins.mjs');
  const outDir = path.resolve(root, out);
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const header = packHeader({ name, version, components: pack.tags, builder: PACK_BUILDER_URL });
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    define: { __K3UX_LIB__: 'true' },
    plugins: [skipStylesheet(), filterCatalog(pack.tags)],
    resolve: { alias: { '@k3ux': path.join(root, 'src') } },
    build: {
      outDir,
      emptyOutDir: false,
      lib: { entry: path.join(root, 'src/pack.ts'), formats: ['es'], fileName: () => `${name}.js` },
      rollupOptions: {
        external: [
          'k3ui',
          'lit',
          'lit/decorators.js',
          /^lit\//,
          'chart.js',
          /^chart\.js\//,
          '@material/material-color-utilities',
        ],
        output: { inlineDynamicImports: true, ...header },
      },
      sourcemap: true,
      minify: 'esbuild',
      target: 'es2022',
    },
  });
  const file = path.join(outDir, `${name}.js`);
  const gzip = zlib.gzipSync(fs.readFileSync(file)).length;
  const manifest = { name, version, file: `${name}.js`, gzip, ...pack };
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function printList() {
  for (const { tag } of readCatalog()) {
    const needs = closure([tag]).filter((t) => t !== tag);
    console.log(needs.length ? `${tag}  → ${needs.join(', ')}` : tag);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.list) printList();
    else {
      const m = await buildPack(opts);
      console.log(`Pack ${m.file}: ${m.tags.length} components, ${(m.gzip / 1024).toFixed(1)} kB gzip`);
      console.log(`  requested: ${m.requested.join(', ')}`);
      if (m.added.length) console.log(`  added (dependencies): ${m.added.join(', ')}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
