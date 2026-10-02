import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/outsider-01/' : '/',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
