import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const banned: readonly { label: string; pattern: RegExp }[] = [
  { label: 'phaser import', pattern: /from\s+['"]phaser/ },
  { label: 'preact import', pattern: /from\s+['"]preact/ },
  { label: 'react import', pattern: /from\s+['"]react/ },
  { label: 'window', pattern: /\bwindow\b/ },
  { label: 'document', pattern: /\bdocument\b/ },
  { label: 'indexedDB', pattern: /\bindexedDB\b/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'fetch', pattern: /\bfetch\s*\(/ },
];

function productionFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...productionFiles(full));
      continue;
    }
    if (full.endsWith('.ts') && !full.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

describe('core boundary', () => {
  it('keeps the simulation core free of Phaser, UI, and browser IO', () => {
    const files = productionFiles(path.resolve('src/core'));
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const rule of banned) {
        if (rule.pattern.test(source)) hits.push(`${file}: ${rule.label}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
