import { describe, expect, it } from 'vitest';
import { debugEnabledFromSearch } from './debugQuery.ts';

describe('debug query', () => {
  it('opens the panel only when debug=1', () => {
    expect(debugEnabledFromSearch('')).toBe(false);
    expect(debugEnabledFromSearch('?debug=1')).toBe(true);
    expect(debugEnabledFromSearch('?foo=1&debug=1')).toBe(true);
    expect(debugEnabledFromSearch('?debug=0')).toBe(false);
    expect(debugEnabledFromSearch('?debug=true')).toBe(false);
    expect(debugEnabledFromSearch('?Debug=1')).toBe(false);
  });
});
