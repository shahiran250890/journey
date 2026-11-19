import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vitest/config';

const basePath = process.env.BASE_PATH;
const base = basePath && basePath.length > 0 ? basePath : './';

function tiledJson(): Plugin {
  return {
    name: 'tiled-json',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0] ?? id;
      if (!file.endsWith('.tmj') && !file.endsWith('.tsj')) return null;
      return `export default ${readFileSync(file, 'utf8')}`;
    },
  };
}

export default defineConfig({
  base,
  plugins: [tiledJson(), preact()],
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
    // Tile art is small enough to inline by default. Emit real files so the
    // URLs pick up `base` (`./` locally and on Vercel, `/journey/` on Pages).
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
