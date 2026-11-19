import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

const basePath = process.env.BASE_PATH;
const base = basePath && basePath.length > 0 ? basePath : './';

export default defineConfig({
  base,
  plugins: [preact()],
  server: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: true,
  },
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
