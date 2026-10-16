import { describe, expect, it, vi } from 'vitest';
import { fixtureData } from '../__fixtures__/data';
import { fetchLive, parseRateLimit, rateLimitMessage, summarizeChecks, type FetchLike } from './github';
import { EMPTY_PERSISTED, mergePrs } from './merge';

const now = () => new Date('2026-10-17T10:00:00Z');
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const pull = (n: number, over: Record<string, unknown> = {}) => ({
  number: n, title: `PR ${n}`, state: 'open', merged_at: null, closed_at: null, created_at: '2026-10-16T16:00:00Z',
  updated_at: '2026-10-16T17:00:00Z', html_url: `https://github.com/o/r/pull/${n}`, head: { sha: `sha${n}` }, requested_reviewers: [], ...over,
});

function router(routes: Record<string, () => Response>): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected ${url}`);
    return routes[key]();
  };
  return { fetchImpl, calls };
}

const rl = (remaining: number, reset = 1792180000) => json({ resources: { core: { remaining, limit: 60, reset } } });

describe('parseRateLimit', () => {
  it('reads X-RateLimit headers', () => {
    const h = new Headers({ 'X-RateLimit-Remaining': '7', 'X-RateLimit-Limit': '60', 'X-RateLimit-Reset': '1792180000' });
    expect(parseRateLimit(h)).toEqual({ remaining: 7, limit: 60, reset: 1792180000 });
    expect(parseRateLimit(new Headers())).toBeNull();
  });
});

describe('fetchLive', () => {
  it('skips all live calls when too few requests remain, and baked data is kept', async () => {
    const { fetchImpl, calls } = router({ '/rate_limit': () => rl(2) });
    const res = await fetchLive({ owner: 'o', name: 'r', fetchImpl, now });
    expect(res.status).toBe('rate-limited');
    expect(res.prs).toBeNull();
    expect(res.rateLimit?.reset).toBe(1792180000);
    expect(calls).toHaveLength(1);
    const merged = mergePrs({ baked: fixtureData.remediations, bakedFetchedAt: null, live: res.prs, liveAt: null, persisted: EMPTY_PERSISTED });
    expect(merged.prs.map((p) => [p.number, p.state, p.origin])).toEqual(fixtureData.remediations.map((p) => [p.number, p.state, 'build']));
  });

  it('treats 403 and 429 on pulls as rate-limited', async () => {
    for (const status of [403, 429]) {
      const { fetchImpl } = router({
        '/rate_limit': () => rl(60),
        '/pulls': () => json({ message: 'API rate limit exceeded' }, status, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1792181111' }),
      });
      const res = await fetchLive({ owner: 'o', name: 'r', fetchImpl, now });
      expect(res.status).toBe('rate-limited');
      expect(res.prs).toBeNull();
      expect(res.rateLimit?.reset).toBe(1792181111);
    }
  });

  it('returns error (not throw) on network failure', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const res = await fetchLive({ owner: 'o', name: 'r', fetchImpl, now });
    expect(res.status).toBe('error');
    expect(res.prs).toBeNull();
    expect(res.message).toContain('Failed to fetch');
  });

  it('fetches pulls, check runs for open PRs only, and the latest lab-validation run', async () => {
    const hdr = { 'x-ratelimit-remaining': '50', 'x-ratelimit-reset': '1792180000', etag: 'W/"abc"' };
    const { fetchImpl, calls } = router({
      '/rate_limit': () => rl(55),
      '/pulls': () => json([pull(1), pull(2, { state: 'closed', merged_at: '2026-10-16T17:00:00Z', closed_at: '2026-10-16T17:00:00Z' })], 200, hdr),
      '/commits/sha1/check-runs': () => json({ check_runs: [{ name: 'validate', status: 'completed', conclusion: 'success', html_url: 'u', completed_at: null }] }, 200, hdr),
      '/actions/workflows/lab-validation.yml/runs': () => json({ workflow_runs: [{ name: 'lab-validation', status: 'completed', conclusion: 'success', html_url: 'run', head_sha: 'm', event: 'push', created_at: '2026-10-16T17:00:00Z' }] }, 200, hdr),
    });
    const res = await fetchLive({ owner: 'o', name: 'r', fetchImpl, now });
    expect(res.status).toBe('ok');
    expect(res.etag).toBe('W/"abc"');
    expect(res.prs?.find((p) => p.number === 1)?.checks_conclusion).toBe('success');
    expect(res.prs?.find((p) => p.number === 2)?.merged).toBe(true);
    expect(calls.some((c) => c.includes('sha2'))).toBe(false);
    expect(res.labValidationMain?.conclusion).toBe('success');
  });

  it('sends If-None-Match and reuses cached pulls on 304', async () => {
    let sent: HeadersInit | undefined;
    const fetchImpl: FetchLike = async (url, init) => {
      if (url.includes('/rate_limit')) return rl(55);
      if (url.includes('/pulls')) { sent = init?.headers; return new Response(null, { status: 304, headers: { 'x-ratelimit-remaining': '55' } }); }
      if (url.includes('check-runs')) return json({ check_runs: [] });
      return json({ workflow_runs: [] });
    };
    const cached = { etag: 'W/"abc"', prs: [{ ...pull(3), merged: false, head_sha: 'sha3', draft: false, requested_reviewers: [], checks: null, checks_conclusion: 'unknown' as const }] };
    const res = await fetchLive({ owner: 'o', name: 'r', fetchImpl, now, cachedPulls: cached as never });
    expect((sent as Record<string, string>)['If-None-Match']).toBe('W/"abc"');
    expect(res.prs?.map((p) => p.number)).toEqual([3]);
    expect(res.prs?.[0].checks_conclusion).toBe('none');
  });

  it('stops check-run calls and reports partial when remaining drops below the reserve', async () => {
    const { fetchImpl, calls } = router({
      '/rate_limit': () => rl(10),
      '/pulls': () => json([pull(1), pull(2)], 200, { 'x-ratelimit-remaining': '3' }),
    });
    const res = await fetchLive({ owner: 'o', name: 'r', fetchImpl, now });
    expect(res.status).toBe('partial');
    expect(res.prs).toHaveLength(2);
    expect(calls.filter((c) => c.includes('check-runs'))).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('summarizes check runs', () => {
    expect(summarizeChecks([])).toBe('none');
    expect(summarizeChecks([{ name: 'a', status: 'in_progress', conclusion: null, html_url: null }])).toBe('pending');
    expect(summarizeChecks([{ name: 'a', status: 'completed', conclusion: 'failure', html_url: null }])).toBe('failure');
    expect(summarizeChecks([{ name: 'a', status: 'completed', conclusion: 'skipped', html_url: null }])).toBe('success');
  });

  it('formats the rate-limit banner', () => {
    const reset = Math.floor(new Date(2026, 9, 17, 14, 5).getTime() / 1000);
    expect(rateLimitMessage(reset, '2026-10-16T18:00:00Z')).toBe('GitHub rate limit reached until 14:05; showing build-time data from 2026-10-16T18:00:00Z');
  });
});
