import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { sitePlugin } from './vite-plugin-site';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/outsider-01/' : '/',
  plugins: [sitePlugin()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
