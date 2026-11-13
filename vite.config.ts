import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  define: { __K3UX_LIB__: 'true' },
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist',
      /* Ambient peer `k3ui` typings break api-extractor rollup. */
      rollupTypes: false,
      entryRoot: 'src',
      insertTypesEntry: true,
      exclude: ['types/**'],
    }),
  ],
  resolve: {
    alias: {
      '@k3ux': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'K3UX',
      formats: ['es'],
      fileName: () => 'k3ux.js',
    },
    cssCodeSplit: false,
    assetsInlineLimit: 0,
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
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'k3ux.css';
          return assetInfo.name ?? 'asset';
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2022',
  },
});
