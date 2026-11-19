import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*'],
              message: 'The simulation core must not import Phaser.',
            },
            {
              group: ['preact', 'preact/*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'The simulation core must not import a UI library.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'The simulation core must not touch the DOM.' },
        { name: 'document', message: 'The simulation core must not touch the DOM.' },
        {
          name: 'indexedDB',
          message: 'IndexedDB belongs in src/platform, not the simulation core.',
        },
        { name: 'localStorage', message: 'The simulation core must not touch browser storage.' },
        {
          name: 'sessionStorage',
          message: 'The simulation core must not touch browser storage.',
        },
        { name: 'fetch', message: 'The simulation core must not perform IO.' },
      ],
    },
  },
);
