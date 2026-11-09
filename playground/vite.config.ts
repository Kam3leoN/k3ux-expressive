import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      '@k3ux': resolve(__dirname, '../src'),
      /* Dev: peer from sibling package source + CSS entry. */
      k3ui: resolve(__dirname, '../../K3ui/src/index.ts'),
      'k3ui/k3ui.css': resolve(__dirname, '../../K3ui/src/styles/k3ui.scss'),
      lit: resolve(__dirname, '../node_modules/lit'),
    },
  },
  server: {
    port: 5180,
    open: false,
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  build: {
    outDir: resolve(__dirname, '../dist-playground'),
    emptyOutDir: true,
  },
});
