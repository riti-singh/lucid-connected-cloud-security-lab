import { describe, expect, it } from 'vitest';
import { bannerFor } from './useDashboard';
import { advisoryMatchesFinding } from './lib/format';
import { fixtureData } from './__fixtures__/data';
import type { DashboardData } from './types/data';
import type { LiveResult } from './lib/github';

const withGithub = (status: DashboardData['sources']['github']['status'], error: string | null = null): DashboardData => ({
  ...fixtureData,
  sources: { ...fixtureData.sources, github: { ...fixtureData.sources.github, status, error } },
});

const live = (over: Partial<LiveResult>): LiveResult => ({
  status: 'ok', fetchedAt: '2026-10-16T12:00:00Z', prs: [], labValidationMain: null, rateLimit: null, message: null, etag: null, ...over,
});

describe('bannerFor', () => {
  it('shows nothing before refresh when the build fetched GitHub successfully', () => {
    expect(bannerFor(null, withGithub('ok'))).toBeNull();
  });

  it.each(['skipped', 'unavailable', 'partial'] as const)('explains build-time github status %s before refresh', (status) => {
    const b = bannerFor(null, withGithub(status, status === 'unavailable' ? 'HTTP 403' : null));
    expect(b?.tone).toBe('info');
    expect(b?.text).toContain(fixtureData.generated_at);
    if (status === 'unavailable') expect(b?.text).toContain('HTTP 403');
  });

  it('uses the rate-limit wording after a rate-limited refresh', () => {
    const b = bannerFor(live({ status: 'rate-limited', prs: null, rateLimit: { remaining: 0, limit: 60, reset: null } }), withGithub('skipped'));
    expect(b?.tone).toBe('warning');
    expect(b?.text).toMatch(/^GitHub rate limit reached until .+; showing build-time data from /);
  });

  it('clears the banner after a successful live refresh', () => {
    expect(bannerFor(live({}), withGithub('skipped'))).toBeNull();
  });
});

describe('advisoryMatchesFinding', () => {
  const dep101 = { advisory_id: 'GHSA-8q59-q68h-6hv4', aliases: ['CVE-2020-14343', 'PYSEC-2021-142'] };
  it('links the primary advisory and alias records', () => {
    expect(advisoryMatchesFinding({ id: 'GHSA-8q59-q68h-6hv4', aliases: [] }, dep101)).toBe(true);
    expect(advisoryMatchesFinding({ id: 'PYSEC-2021-142', aliases: ['CVE-2020-14343', 'GHSA-8q59-q68h-6hv4'] }, dep101)).toBe(true);
    expect(advisoryMatchesFinding({ id: 'GHSA-rv95-896h-c2vc', aliases: ['CVE-2024-29041'] }, dep101)).toBe(false);
  });
  it('never links an advisory to a LAB-* finding', () => {
    expect(advisoryMatchesFinding({ id: 'PYSEC-2021-142', aliases: [] }, { advisory_id: null, aliases: [] })).toBe(false);
  });
});
