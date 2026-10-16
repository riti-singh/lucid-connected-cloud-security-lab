import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardData, Finding, WorkflowRun } from './types/data';
import { fetchLive, rateLimitMessage, type FetchLike, type LiveResult } from './lib/github';
import { applyFindingStatus, mergePrs, type EffectivePr, type PersistedState } from './lib/merge';
import { loadPersisted, loadPullsCache, savePersisted, savePullsCache } from './lib/storage';
import { fmtDateTime } from './lib/format';

export interface GithubBanner {
  tone: 'warning' | 'error' | 'info';
  text: string;
}

export interface DashboardModel {
  data: DashboardData;
  prs: EffectivePr[];
  findings: Finding[];
  persisted: PersistedState;
  live: LiveResult | null;
  labValidationMain: WorkflowRun | null;
  banner: GithubBanner | null;
  refreshing: boolean;
  refresh: () => void;
  now: Date;
}

export type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; model: DashboardModel };

async function loadData(fetchImpl: FetchLike, bust: boolean): Promise<DashboardData> {
  const url = bust ? `./data.json?t=${Date.now()}` : './data.json';
  const res = await fetchImpl(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`data.json returned HTTP ${res.status}`);
  return (await res.json()) as DashboardData;
}

const BUILD_GITHUB_TEXT: Record<'partial' | 'unavailable' | 'skipped', string> = {
  partial: 'Build-time GitHub data is partial',
  unavailable: 'GitHub was unavailable at build time',
  skipped: 'GitHub was not queried at build time',
};

export function bannerFor(live: LiveResult | null, data: DashboardData): GithubBanner | null {
  if (!live) {
    const gh = data.sources.github;
    if (gh.status === 'ok') return null;
    const detail = gh.error ? ` (${gh.error})` : '';
    return { tone: 'info', text: `${BUILD_GITHUB_TEXT[gh.status]}${detail}; PR states are the recorded values from ${data.generated_at}. Use Refresh to query GitHub.` };
  }
  if (live.status === 'rate-limited') return { tone: 'warning', text: rateLimitMessage(live.rateLimit?.reset ?? null, data.generated_at) };
  if (live.status === 'error') return { tone: 'error', text: `${live.message ?? 'GitHub request failed'}; showing build-time data from ${data.generated_at}` };
  if (live.status === 'partial') {
    const reset = live.rateLimit?.remaining === 0 || (live.rateLimit?.remaining ?? 99) < 5;
    return {
      tone: 'warning',
      text: reset
        ? `Live GitHub data is partial: ${rateLimitMessage(live.rateLimit?.reset ?? null, data.generated_at)}`
        : 'Live GitHub data is partial: some check-run or workflow requests failed; affected PRs show build-time or cached checks',
    };
  }
  return null;
}

const defaultFetch: FetchLike = (i, init) => fetch(i, init);

export function useDashboard(fetchImpl: FetchLike = defaultFetch): LoadState {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedState>(() => loadPersisted());
  const [live, setLive] = useState<LiveResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadData(fetchImpl, false)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [fetchImpl]);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      let current = data;
      try {
        current = await loadData(fetchImpl, true);
        setData(current);
      } catch {
        /* keep the data already loaded */
      }
      if (!current) return;
      const result = await fetchLive({
        owner: current.repository.owner,
        name: current.repository.name,
        fetchImpl,
        now: () => new Date(),
        cachedPulls: loadPullsCache(),
      });
      setLive(result);
      if (result.prs) {
        savePullsCache(result.etag, result.prs);
        const merged = mergePrs({
          baked: current.remediations,
          bakedFetchedAt: current.sources.github.fetched_at,
          live: result.prs,
          liveAt: result.fetchedAt,
          persisted: loadPersisted(),
        });
        savePersisted(merged.persisted);
        setPersisted(merged.persisted);
      }
    } finally {
      setNow(new Date());
      busy.current = false;
      setRefreshing(false);
    }
  }, [data, fetchImpl]);

  const model = useMemo<DashboardModel | null>(() => {
    if (!data) return null;
    const { prs } = mergePrs({
      baked: data.remediations,
      bakedFetchedAt: data.sources.github.fetched_at,
      live: null,
      liveAt: null,
      persisted,
    });
    const livePrs = live?.prs ? new Set(live.prs.map((p) => p.number)) : null;
    const effective = prs.map((p) =>
      p.origin === 'cached' && livePrs?.has(p.number) && p.observedAt === live?.fetchedAt ? { ...p, origin: 'live' as const } : p,
    );
    return {
      data,
      prs: effective,
      findings: applyFindingStatus(data.findings, effective),
      persisted,
      live,
      labValidationMain: live?.labValidationMain ?? data.ci.lab_validation_main,
      banner: bannerFor(live, data),
      refreshing,
      refresh: () => void refresh(),
      now,
    };
  }, [data, persisted, live, refreshing, refresh, now]);

  if (error && !data) return { kind: 'error', message: error };
  if (!model) return { kind: 'loading' };
  return { kind: 'ready', model };
}

export function liveRefreshedLabel(model: DashboardModel): string {
  const at = model.live?.prs ? model.live.fetchedAt : model.persisted.lastLiveAt;
  return at ? fmtDateTime(at) : 'never';
}
