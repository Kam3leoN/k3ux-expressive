import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@k3ux': resolve(__dirname, 'src'),
      /* Thin peer surface — not the full k3ui catalog. */
      k3ui: resolve(__dirname, 'tests/k3ui-shim.ts'),
      /* One Lit copy for k3ux + shimmed k3ui sources. */
      lit: resolve(__dirname, 'node_modules/lit'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    css: true,
    server: {
      deps: {
        inline: [/@material\/material-color-utilities/],
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
});
