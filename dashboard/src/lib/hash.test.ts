import { describe, expect, it } from 'vitest';
import { buildHash, parseHash, withParams } from './hash';

describe('hash routing', () => {
  it('parses view and params', () => {
    const s = parseHash('#/findings?severity=high&ticket=LAB-401');
    expect(s.view).toBe('findings');
    expect(s.params.get('ticket')).toBe('LAB-401');
    expect(parseHash('').view).toBe('overview');
    expect(parseHash('#/nope').view).toBe('overview');
  });
  it('builds and updates hashes', () => {
    expect(buildHash('remediations')).toBe('#/remediations');
    expect(buildHash('findings', { severity: 'high', q: null })).toBe('#/findings?severity=high');
    const s = parseHash('#/findings?severity=high');
    expect(withParams(s, { severity: null, ticket: 'LAB-503' })).toBe('#/findings?ticket=LAB-503');
  });
});
