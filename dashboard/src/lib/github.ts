import type { CheckRun, ChecksConclusion, WorkflowRun } from '../types/data';

export const GITHUB_API = 'https://api.github.com';
/** Keep this many core requests in reserve; below it live calls are skipped. */
export const MIN_REMAINING = 5;

export interface RateLimit {
  remaining: number | null;
  limit: number | null;
  reset: number | null; // epoch seconds
}

export interface LivePr {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  head_sha: string;
  html_url: string;
  draft: boolean;
  requested_reviewers: string[];
  checks: CheckRun[] | null;
  checks_conclusion: ChecksConclusion;
}

export type LiveStatus = 'ok' | 'partial' | 'rate-limited' | 'error';

export interface LiveResult {
  status: LiveStatus;
  fetchedAt: string;
  prs: LivePr[] | null;
  labValidationMain: WorkflowRun | null;
  rateLimit: RateLimit | null;
  message: string | null;
  etag: string | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface LiveOptions {
  owner: string;
  name: string;
  fetchImpl: FetchLike;
  now: () => Date;
  /** ETag and PR list from the previous successful pulls call, for If-None-Match. */
  cachedPulls?: { etag: string; prs: LivePr[] } | null;
  minRemaining?: number;
}

export function parseRateLimit(headers: Headers): RateLimit | null {
  const num = (k: string) => {
    const v = headers.get(k);
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const rl = { remaining: num('x-ratelimit-remaining'), limit: num('x-ratelimit-limit'), reset: num('x-ratelimit-reset') };
  return rl.remaining === null && rl.reset === null ? null : rl;
}

export function isRateLimited(res: Response): boolean {
  if (res.status === 429) return true;
  if (res.status !== 403) return false;
  // GitHub returns 403 for primary and secondary limits; treat any unauthenticated 403 as a limit.
  return true;
}

function resetFromResponse(res: Response, now: Date): number | null {
  const rl = parseRateLimit(res.headers);
  if (rl?.reset) return rl.reset;
  const retry = Number(res.headers.get('retry-after'));
  return Number.isFinite(retry) && retry > 0 ? Math.floor(now.getTime() / 1000) + retry : null;
}

export function formatClock(epochSeconds: number | null): string {
  if (!epochSeconds) return 'later';
  const d = new Date(epochSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function rateLimitMessage(reset: number | null, generatedAt: string): string {
  return `GitHub rate limit reached until ${formatClock(reset)}; showing build-time data from ${generatedAt}`;
}

export function summarizeChecks(checks: CheckRun[]): ChecksConclusion {
  if (checks.length === 0) return 'none';
  if (checks.some((c) => c.status !== 'completed')) return 'pending';
  const bad = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale'];
  if (checks.some((c) => c.conclusion && bad.includes(c.conclusion))) return 'failure';
  return 'success';
}

interface ApiPull {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  draft?: boolean;
  head: { sha: string };
  requested_reviewers?: { login: string }[];
}

export function toLivePr(p: ApiPull): LivePr {
  return {
    number: p.number,
    title: p.title,
    state: p.state,
    merged: Boolean(p.merged_at),
    merged_at: p.merged_at,
    closed_at: p.closed_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
    head_sha: p.head.sha,
    html_url: p.html_url,
    draft: Boolean(p.draft),
    requested_reviewers: (p.requested_reviewers ?? []).map((r) => r.login),
    checks: null,
    checks_conclusion: 'unknown',
  };
}

const ACCEPT = { Accept: 'application/vnd.github+json' };

/**
 * Fetch live PR state, check runs for open PRs, and the latest lab-validation run on main.
 * Never throws: failures come back as status 'rate-limited' or 'error' with prs: null,
 * so the caller keeps the build-time data.
 */
export async function fetchLive(opts: LiveOptions): Promise<LiveResult> {
  const { owner, name, fetchImpl, now } = opts;
  const minRemaining = opts.minRemaining ?? MIN_REMAINING;
  const base = `${GITHUB_API}/repos/${owner}/${name}`;
  const result: LiveResult = {
    status: 'ok',
    fetchedAt: now().toISOString(),
    prs: null,
    labValidationMain: null,
    rateLimit: null,
    message: null,
    etag: null,
  };
  const limited = (reset: number | null): LiveResult => ({
    ...result,
    status: 'rate-limited',
    prs: null,
    labValidationMain: null,
    rateLimit: { remaining: 0, limit: result.rateLimit?.limit ?? null, reset },
  });

  try {
    // /rate_limit does not count against the core limit.
    const rlRes = await fetchImpl(`${GITHUB_API}/rate_limit`, { headers: ACCEPT, cache: 'no-store' });
    if (rlRes.ok) {
      const body = (await rlRes.json()) as { resources?: { core?: { remaining: number; limit: number; reset: number } } };
      const core = body.resources?.core;
      if (core) {
        result.rateLimit = { remaining: core.remaining, limit: core.limit, reset: core.reset };
        if (core.remaining < minRemaining) return limited(core.reset);
      }
    } else if (isRateLimited(rlRes)) {
      return limited(resetFromResponse(rlRes, now()));
    }

    const pullHeaders: Record<string, string> = { ...ACCEPT };
    if (opts.cachedPulls?.etag) pullHeaders['If-None-Match'] = opts.cachedPulls.etag;
    const pullsRes = await fetchImpl(`${base}/pulls?state=all&per_page=100`, { headers: pullHeaders, cache: 'no-store' });
    result.rateLimit = parseRateLimit(pullsRes.headers) ?? result.rateLimit;
    if (pullsRes.status === 304 && opts.cachedPulls) {
      result.prs = opts.cachedPulls.prs.map((p) => ({ ...p, checks: null, checks_conclusion: 'unknown' as const }));
      result.etag = opts.cachedPulls.etag;
    } else if (pullsRes.ok) {
      result.prs = ((await pullsRes.json()) as ApiPull[]).map(toLivePr);
      result.etag = pullsRes.headers.get('etag');
    } else if (isRateLimited(pullsRes)) {
      return limited(resetFromResponse(pullsRes, now()));
    } else {
      return { ...result, status: 'error', message: `GitHub API returned ${pullsRes.status} for pulls` };
    }

    const open = result.prs.filter((p) => p.state === 'open');
    for (const pr of open) {
      const remaining = result.rateLimit?.remaining;
      if (remaining !== null && remaining !== undefined && remaining < minRemaining) {
        result.status = 'partial';
        result.message = rateLimitMessage(result.rateLimit?.reset ?? null, 'build time');
        break;
      }
      const res = await fetchImpl(`${base}/commits/${pr.head_sha}/check-runs?per_page=100`, { headers: ACCEPT, cache: 'no-store' });
      result.rateLimit = parseRateLimit(res.headers) ?? result.rateLimit;
      if (res.ok) {
        const body = (await res.json()) as { check_runs: { name: string; status: string; conclusion: string | null; html_url: string | null; completed_at: string | null }[] };
        pr.checks = body.check_runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion, html_url: c.html_url, completed_at: c.completed_at }));
        pr.checks_conclusion = summarizeChecks(pr.checks);
      } else {
        result.status = 'partial';
        if (isRateLimited(res)) {
          result.rateLimit = { remaining: 0, limit: result.rateLimit?.limit ?? null, reset: resetFromResponse(res, now()) };
          break;
        }
      }
    }

    const remaining = result.rateLimit?.remaining;
    if (remaining === null || remaining === undefined || remaining >= minRemaining) {
      const runRes = await fetchImpl(`${base}/actions/workflows/lab-validation.yml/runs?branch=main&per_page=1`, { headers: ACCEPT, cache: 'no-store' });
      result.rateLimit = parseRateLimit(runRes.headers) ?? result.rateLimit;
      if (runRes.ok) {
        const body = (await runRes.json()) as { workflow_runs: { name: string; status: string; conclusion: string | null; html_url: string; head_sha: string; event: string; created_at: string }[] };
        const r = body.workflow_runs[0];
        if (r) result.labValidationMain = { name: r.name, status: r.status, conclusion: r.conclusion, html_url: r.html_url, head_sha: r.head_sha, event: r.event, created_at: r.created_at };
      } else {
        result.status = 'partial';
      }
    } else {
      result.status = 'partial';
    }
    return result;
  } catch (err) {
    return { ...result, status: 'error', prs: null, labValidationMain: null, message: `GitHub request failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
