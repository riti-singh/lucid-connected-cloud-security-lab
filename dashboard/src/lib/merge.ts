import type { CheckRun, ChecksConclusion, Finding, FindingStatus, PrState, Remediation } from '../types/data';
import type { LivePr } from './github';

export type PrOrigin = 'build' | 'live' | 'cached';

export interface PrSnapshot {
  number: number;
  state: PrState;
  merged_at: string | null;
  closed_at: string | null;
  head_sha: string | null;
  checks: CheckRun[] | null;
  checks_conclusion: ChecksConclusion;
  title: string | null;
  html_url: string | null;
  observed_at: string;
}

export interface ObservedEvent {
  at: string;
  pr: number;
  from: PrState | null;
  to: PrState;
  title: string | null;
  url: string | null;
}

export interface PersistedState {
  version: 1;
  snapshots: Record<string, PrSnapshot>;
  events: ObservedEvent[];
  lastLiveAt: string | null;
}

export const EMPTY_PERSISTED: PersistedState = { version: 1, snapshots: {}, events: [], lastLiveAt: null };

export interface EffectivePr extends Remediation {
  origin: PrOrigin;
  observedAt: string | null;
  headSha: string | null;
  checks: CheckRun[] | null;
  checksConclusion: ChecksConclusion;
}

export function livePrState(p: Pick<LivePr, 'state' | 'merged'>): PrState {
  return p.merged ? 'merged' : p.state === 'open' ? 'open' : 'closed';
}

function stateRank(s: PrState): number {
  return s === 'merged' ? 2 : s === 'closed' ? 1 : 0;
}

/** Merged is terminal: a later or stale 'open' never overrides an observed 'merged'. */
export function resolveState(current: PrState, incoming: PrState): PrState {
  if (current === 'merged') return 'merged';
  if (incoming === 'merged') return 'merged';
  return incoming;
}

function reviewStateFor(pr: Remediation, state: PrState): Remediation['review_state'] {
  if (state === 'merged') return 'merged';
  if (state === 'closed') return 'closed';
  return pr.review_state === 'merged' || pr.review_state === 'closed' ? 'human-review' : pr.review_state;
}

function fromBuild(pr: Remediation): EffectivePr {
  return {
    ...pr,
    origin: 'build',
    observedAt: pr.github?.fetched_at ?? null,
    headSha: pr.github?.head_sha ?? pr.validation?.validated_head ?? null,
    checks: pr.github?.checks ?? null,
    checksConclusion: pr.github?.checks_conclusion ?? 'unknown',
  };
}

function applySnapshot(pr: EffectivePr, snap: PrSnapshot, origin: PrOrigin): EffectivePr {
  const state = resolveState(pr.state, snap.state);
  return {
    ...pr,
    state,
    review_state: reviewStateFor(pr, state),
    merged_at: snap.merged_at ?? pr.merged_at,
    origin,
    observedAt: snap.observed_at,
    headSha: snap.head_sha ?? pr.headSha,
    checks: snap.checks ?? pr.checks,
    checksConclusion: snap.checks ? snap.checks_conclusion : pr.checksConclusion,
  };
}

export function snapshotFromLive(p: LivePr, observedAt: string, previous?: PrSnapshot): PrSnapshot {
  return {
    number: p.number,
    state: previous ? resolveState(previous.state, livePrState(p)) : livePrState(p),
    merged_at: p.merged_at,
    closed_at: p.closed_at,
    head_sha: p.head_sha,
    checks: p.checks ?? previous?.checks ?? null,
    checks_conclusion: p.checks ? p.checks_conclusion : previous?.checks_conclusion ?? 'unknown',
    title: p.title,
    html_url: p.html_url,
    observed_at: observedAt,
  };
}

export interface MergeInput {
  baked: Remediation[];
  bakedFetchedAt: string | null;
  live: LivePr[] | null;
  liveAt: string | null;
  persisted: PersistedState;
}

export interface MergeOutput {
  prs: EffectivePr[];
  persisted: PersistedState;
  newEvents: ObservedEvent[];
}

/**
 * Overlay cached and live PR state onto the baked remediations, keyed by PR number.
 * Every baked PR is kept, even when the live response omits it. Merged never reverts.
 * State transitions seen on the client are appended to persisted.events.
 */
export function mergePrs(input: MergeInput): MergeOutput {
  const snapshots: Record<string, PrSnapshot> = { ...input.persisted.snapshots };
  const events = [...input.persisted.events];
  const newEvents: ObservedEvent[] = [];
  const bakedTime = input.bakedFetchedAt ? Date.parse(input.bakedFetchedAt) : 0;

  const record = (pr: number, from: PrState | null, to: PrState, at: string, title: string | null, url: string | null) => {
    if (from === to) return;
    if (events.some((e) => e.pr === pr && e.from === from && e.to === to)) return;
    const ev = { at, pr, from, to, title, url };
    events.push(ev);
    newEvents.push(ev);
  };

  const prs = input.baked.map((b) => {
    let pr = fromBuild(b);
    const snap = snapshots[String(b.number)];
    if (snap && (Date.parse(snap.observed_at) >= bakedTime || stateRank(snap.state) > stateRank(pr.state))) {
      pr = applySnapshot(pr, snap, 'cached');
    }
    return pr;
  });

  if (input.live && input.liveAt) {
    const byNumber = new Map(prs.map((p, i) => [p.number, i]));
    for (const lp of input.live) {
      const key = String(lp.number);
      const prev = snapshots[key];
      const snap = snapshotFromLive(lp, input.liveAt, prev);
      snapshots[key] = snap;
      const idx = byNumber.get(lp.number);
      if (idx !== undefined) {
        const before = prs[idx].state;
        prs[idx] = applySnapshot(prs[idx], snap, 'live');
        record(lp.number, before, prs[idx].state, input.liveAt, prs[idx].title, prs[idx].url);
      } else if (prev) {
        record(lp.number, prev.state, snap.state, input.liveAt, snap.title, snap.html_url);
      }
    }
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  return {
    prs,
    persisted: { version: 1, snapshots, events, lastLiveAt: input.liveAt ?? input.persisted.lastLiveAt },
    newEvents,
  };
}

/** Recompute finding status from effective remediation PR state (same rules as build_data.py). */
export function deriveFindingStatus(finding: Finding, prs: EffectivePr[]): { status: FindingStatus; blocked_reason: string | null } {
  const linked = prs.filter((p) => finding.remediation_pr_numbers.includes(p.number));
  if (linked.length === 0) return { status: finding.status, blocked_reason: finding.blocked_reason };
  if (linked.some((p) => p.state === 'merged')) return { status: 'fix-merged', blocked_reason: finding.blocked_reason };
  const blocked = linked.find((p) => p.state === 'open' && p.review_state === 'blocked-owner-assignment');
  if (blocked) return { status: 'fix-blocked', blocked_reason: finding.blocked_reason ?? blocked.blocked_reason };
  if (linked.some((p) => p.state === 'open')) return { status: 'fix-in-review', blocked_reason: finding.blocked_reason };
  return { status: 'open', blocked_reason: finding.blocked_reason };
}

export function applyFindingStatus(findings: Finding[], prs: EffectivePr[]): Finding[] {
  return findings.map((f) => ({ ...f, ...deriveFindingStatus(f, prs) }));
}
