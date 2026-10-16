import { EMPTY_PERSISTED, type PersistedState } from './merge';
import type { LivePr } from './github';

const KEY = 'lab-dashboard:v1:observed';
const PULLS_KEY = 'lab-dashboard:v1:pulls-etag';

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadPersisted(): PersistedState {
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return EMPTY_PERSISTED;
    const v = JSON.parse(raw) as PersistedState;
    if (v?.version !== 1 || typeof v.snapshots !== 'object' || !Array.isArray(v.events)) return EMPTY_PERSISTED;
    return v;
  } catch {
    return EMPTY_PERSISTED;
  }
}

export function savePersisted(state: PersistedState): void {
  try {
    store()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or disabled storage: keep in memory only */
  }
}

export function loadPullsCache(): { etag: string; prs: LivePr[] } | null {
  try {
    const raw = store()?.getItem(PULLS_KEY);
    return raw ? (JSON.parse(raw) as { etag: string; prs: LivePr[] }) : null;
  } catch {
    return null;
  }
}

export function savePullsCache(etag: string | null, prs: LivePr[] | null): void {
  if (!etag || !prs) return;
  try {
    store()?.setItem(PULLS_KEY, JSON.stringify({ etag, prs: prs.map((p) => ({ ...p, checks: null, checks_conclusion: 'unknown' })) }));
  } catch {
    /* ignore */
  }
}
