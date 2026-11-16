/*
 * On-demand build → dist/lazy/
 *   k3ux.js                 base (init, registry)
 *   components/k3-*.js      one entry per element
 *   chunks/*.js             shared code
 *   pack.js                 entry re-bundled by the pack builder page
 *   components.json         tag → files / deps / sizes
 */
import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { posix, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { skipStylesheet } from './scripts/build-plugins.mjs';
import { closure, readCatalog, readDeps, sourceFile } from './scripts/registry-graph.mjs';

const catalog = readCatalog();
const deps = readDeps();
const byTag = new Map(catalog.map((c) => [c.tag, c]));

const ENTRY_DIR = resolve(__dirname, '.temp/lazy-entries');
mkdirSync(ENTRY_DIR, { recursive: true });
for (const { tag } of catalog) {
  const spec = (t: string): string =>
    JSON.stringify(relative(ENTRY_DIR, sourceFile(byTag.get(t)!)).replace(/\\/g, '/'));
  const children = closure([tag], catalog, deps)
    .filter((t) => t !== tag)
    .map((t) => `import ${spec(t)};`);
  writeFileSync(
    resolve(ENTRY_DIR, `${tag}.ts`),
    `${children.join('\n')}\nexport * from ${spec(tag)};\nexport { default } from ${spec(tag)};\n`,
  );
}

const LAZY_ENTRY = resolve(__dirname, 'src/lazy.ts');
const ENTRY_ID = LAZY_ENTRY.replace(/\\/g, '/');
let baseModules: Set<string> | null = null;

function chunkOf(
  id: string,
  getModuleInfo: (id: string) => { importedIds: readonly string[] } | null,
): string | undefined {
  if (!baseModules) {
    baseModules = new Set();
    const walk = (mod: string): void => {
      if (baseModules!.has(mod)) return;
      baseModules!.add(mod);
      for (const next of getModuleInfo(mod)?.importedIds ?? []) walk(next);
    };
    walk(ENTRY_ID);
  }
  const file = id.replace(/\\/g, '/');
  if (file === ENTRY_ID || file.endsWith('/src/pack.ts')) return undefined;
  if (baseModules.has(file)) return 'base';
  if (file.includes('/.temp/lazy-entries/')) return undefined;
  if (!file.includes('/src/components/') || file.endsWith('/src/components/_shared.ts')) return 'kit';
  return undefined;
}

function componentsManifest(): Plugin {
  return {
    name: 'k3ux-components-manifest',
    writeBundle(options, bundle) {
      const outDir = options.dir!;
      const chunks = new Map<string, { imports: string[]; gzip: number; size: number }>();
      const chunkOfModule = new Map<string, string>();
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        const code = readFileSync(resolve(outDir, item.fileName), 'utf8');
        const imports = [...code.matchAll(/(?:from|import)\s*["'](\.{1,2}\/[^"']+)["']/g)].map((m) =>
          posix.join(posix.dirname(item.fileName), m[1]!),
        );
        chunks.set(item.fileName, { imports, gzip: gzipSync(code).length, size: Buffer.byteLength(code) });
        for (const mid of Object.keys(item.modules)) {
          chunkOfModule.set(mid.replace(/\\/g, '/'), item.fileName);
        }
      }
      const reach = (file: string, seen = new Set<string>()): Set<string> => {
        if (seen.has(file) || !chunks.has(file)) return seen;
        seen.add(file);
        for (const next of chunks.get(file)!.imports) reach(next, seen);
        return seen;
      };
      const size = (files: Iterable<string>): number =>
        [...files].reduce((sum, f) => sum + (chunks.get(f)?.gzip ?? 0), 0);
      const base = reach('k3ux.js');
      const own = new Map(
        catalog.map((c) => [c.tag, chunkOfModule.get(sourceFile(c).replace(/\\/g, '/'))!]),
      );
      const componentChunks = new Set([...own.values()].filter(Boolean));
      const components = Object.fromEntries(
        catalog.map((c) => {
          const { tag } = c;
          const file = `components/${tag}.js`;
          const extra = [...reach(file)].filter((f) => !base.has(f) && f !== file);
          return [
            tag,
            {
              file,
              group: c.file.split('/')[0],
              chunk: own.get(tag),
              shared: extra.filter((f) => !componentChunks.has(f)),
              deps: deps[tag] ?? [],
              requires: closure([tag], catalog, deps).filter((t) => t !== tag),
              gzip: size(extra),
            },
          ];
        }),
      );
      const files = Object.fromEntries(
        [...chunks]
          .filter(([f]) => f.startsWith('chunks/'))
          .map(([f, c]) => [f, { gzip: c.gzip, size: c.size }]),
      );
      const version = (
        JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
      ).version;
      writeFileSync(
        resolve(outDir, 'components.json'),
        `${JSON.stringify(
          {
            version,
            base: {
              file: 'k3ux.js',
              pack: 'pack.js',
              gzip: size(base),
              files: [...base].filter((f) => f !== 'k3ux.js'),
            },
            components,
            files,
          },
          null,
          2,
        )}\n`,
      );
    },
  };
}

const peerExternal = [
  'k3ui',
  'lit',
  'lit/decorators.js',
  /^lit\//,
  'chart.js',
  /^chart\.js\//,
  '@material/material-color-utilities',
];

export default defineConfig({
  define: { __K3UX_LIB__: 'true' },
  plugins: [skipStylesheet(), componentsManifest()],
  resolve: {
    alias: {
      '@k3ux': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/lazy',
    emptyOutDir: true,
    lib: {
      entry: {
        k3ux: LAZY_ENTRY,
        pack: resolve(__dirname, 'src/pack.ts'),
        ...Object.fromEntries(catalog.map(({ tag }) => [`components/${tag}`, resolve(ENTRY_DIR, `${tag}.ts`)])),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    assetsInlineLimit: 0,
    rollupOptions: {
      external: peerExternal,
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        manualChunks: (id, { getModuleInfo }) => chunkOf(id, getModuleInfo),
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2022',
  },
});
