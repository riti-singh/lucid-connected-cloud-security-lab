import { describe, expect, it } from 'vitest';
import { fixtureFindings } from '../__fixtures__/data';
import { COLUMNS, DEFAULT_FILTERS, filtersFromParams, queryFindings } from './findingsQuery';

const now = new Date(2026, 9, 16, 12);
const q = (over: Partial<typeof DEFAULT_FILTERS>) => queryFindings(fixtureFindings, { ...DEFAULT_FILTERS, ...over }, now).map((f) => f.ticket);

describe('queryFindings', () => {
  it('filters by owner unassigned', () => {
    expect(q({ owner: 'unassigned' })).toEqual(['LAB-401', 'LAB-503']);
  });
  it('filters untriaged and overdue', () => {
    expect(q({ untriaged: true })).toEqual(['LAB-503']);
    expect(q({ overdue: true, sort: 'ticket' })).toEqual(['LAB-101', 'LAB-102', 'LAB-201', 'LAB-401']);
  });
  it('filters by severity, kind, service, status and text', () => {
    expect(q({ severity: 'critical', sort: 'ticket' })).toEqual(['DEP-101', 'LAB-201']);
    expect(q({ kind: 'dependency' })).toEqual(['DEP-101']);
    expect(q({ service: 'telemetry-exporter', sort: 'ticket' })).toEqual(['LAB-401', 'LAB-503']);
    expect(q({ status: 'fix-blocked' })).toEqual(['LAB-401']);
    expect(q({ q: 'cve-2020-14343' })).toEqual(['DEP-101']);
    expect(q({ q: 'cwe-639' })).toEqual(['LAB-201']);
  });
  it('sorts by every column in both directions without throwing', () => {
    for (const sort of COLUMNS) {
      const asc = q({ sort, dir: 'asc' });
      const desc = q({ sort, dir: 'desc' });
      expect(asc).toHaveLength(fixtureFindings.length);
      expect(desc).toHaveLength(fixtureFindings.length);
    }
    expect(q({ sort: 'severity' }).slice(0, 2)).toEqual(['DEP-101', 'LAB-201']);
    expect(q({ sort: 'due', dir: 'asc' })[0]).toBe('LAB-201');
  });
  it('round-trips filters through URL params', () => {
    const f = filtersFromParams(new URLSearchParams('severity=high&owner=unassigned&overdue=1&sort=severity&dir=desc&q=log'));
    expect(f).toMatchObject({ severity: 'high', owner: 'unassigned', overdue: true, untriaged: false, sort: 'severity', dir: 'desc', q: 'log' });
    expect(filtersFromParams(new URLSearchParams('sort=bogus')).sort).toBe('due');
  });
});
