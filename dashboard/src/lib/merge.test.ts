import { describe, expect, it } from 'vitest';
import { fixtureFindings, fixtureRemediations } from '../__fixtures__/data';
import type { LivePr } from './github';
import { applyFindingStatus, EMPTY_PERSISTED, mergePrs, type PersistedState } from './merge';

const live = (n: number, over: Partial<LivePr> = {}): LivePr => ({
  number: n, title: `PR ${n}`, state: 'open', merged: false, merged_at: null, closed_at: null,
  created_at: '2026-10-16T16:00:00Z', updated_at: '2026-10-16T18:00:00Z', head_sha: `sha${n}`,
  html_url: `https://github.com/x/y/pull/${n}`, draft: false, requested_reviewers: [], checks: null, checks_conclusion: 'unknown', ...over,
});

const base = { baked: fixtureRemediations, bakedFetchedAt: '2026-10-16T18:00:00Z' };

describe('mergePrs', () => {
  it('without live data returns baked PRs with build origin', () => {
    const out = mergePrs({ ...base, live: null, liveAt: null, persisted: EMPTY_PERSISTED });
    expect(out.prs.map((p) => p.number)).toEqual([1, 4, 8, 9]);
    expect(out.prs.every((p) => p.origin === 'build')).toBe(true);
    expect(out.newEvents).toEqual([]);
  });

  it('live merged overrides baked open and records the transition', () => {
    const out = mergePrs({ ...base, live: [live(1, { state: 'closed', merged: true, merged_at: '2026-10-17T09:00:00Z' })], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    const pr1 = out.prs.find((p) => p.number === 1)!;
    expect(pr1.state).toBe('merged');
    expect(pr1.review_state).toBe('merged');
    expect(pr1.origin).toBe('live');
    expect(out.newEvents).toEqual([expect.objectContaining({ pr: 1, from: 'open', to: 'merged', at: '2026-10-17T10:00:00Z' })]);
    expect(out.persisted.snapshots['1'].state).toBe('merged');
  });

  it('never drops a baked PR missing from the live response', () => {
    const out = mergePrs({ ...base, live: [live(1)], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    expect(out.prs.map((p) => p.number)).toEqual([1, 4, 8, 9]);
    expect(out.prs.find((p) => p.number === 4)!.state).toBe('merged');
    expect(out.prs.find((p) => p.number === 8)!.origin).toBe('build');
  });

  it('preserves history: cached merged state survives a later refresh without live data', () => {
    const first = mergePrs({ ...base, live: [live(9, { state: 'closed', merged: true, merged_at: '2026-10-17T09:00:00Z' })], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    const persisted: PersistedState = JSON.parse(JSON.stringify(first.persisted));
    const second = mergePrs({ ...base, live: null, liveAt: null, persisted });
    const pr9 = second.prs.find((p) => p.number === 9)!;
    expect(pr9.state).toBe('merged');
    expect(pr9.origin).toBe('cached');
    expect(second.persisted.events).toHaveLength(1);
    expect(second.persisted.lastLiveAt).toBe('2026-10-17T10:00:00Z');
  });

  it('merged is terminal: a stale open response does not revert it, and events are not duplicated', () => {
    const first = mergePrs({ ...base, live: [live(9, { state: 'closed', merged: true, merged_at: '2026-10-17T09:00:00Z' })], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    const second = mergePrs({ ...base, live: [live(9, { state: 'open' })], liveAt: '2026-10-17T11:00:00Z', persisted: first.persisted });
    expect(second.prs.find((p) => p.number === 9)!.state).toBe('merged');
    expect(second.persisted.events.filter((e) => e.pr === 9)).toHaveLength(1);
    const third = mergePrs({ ...base, live: [live(9, { state: 'closed', merged: true })], liveAt: '2026-10-17T12:00:00Z', persisted: second.persisted });
    expect(third.newEvents).toEqual([]);
  });

  it('keeps blocked-owner-assignment review state for open PR #8 and live checks', () => {
    const checks = [{ name: 'validate', status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/y/runs/1' }];
    const out = mergePrs({ ...base, live: [live(8, { checks, checks_conclusion: 'success' })], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    const pr8 = out.prs.find((p) => p.number === 8)!;
    expect(pr8.state).toBe('open');
    expect(pr8.review_state).toBe('blocked-owner-assignment');
    expect(pr8.checksConclusion).toBe('success');
    expect(pr8.headSha).toBe('sha8');
  });

  it('records transitions for live PRs not in the baked list once previously observed', () => {
    const first = mergePrs({ ...base, live: [live(20)], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    expect(first.prs.some((p) => p.number === 20)).toBe(false);
    const second = mergePrs({ ...base, live: [live(20, { state: 'closed', merged: true })], liveAt: '2026-10-17T11:00:00Z', persisted: first.persisted });
    expect(second.newEvents).toEqual([expect.objectContaining({ pr: 20, from: 'open', to: 'merged' })]);
  });
});

describe('applyFindingStatus', () => {
  it('derives fix-merged / fix-blocked / fix-in-review from effective PR state', () => {
    const { prs } = mergePrs({ ...base, live: [live(1, { state: 'closed', merged: true })], liveAt: '2026-10-17T10:00:00Z', persisted: EMPTY_PERSISTED });
    const byTicket = Object.fromEntries(applyFindingStatus(fixtureFindings, prs).map((f) => [f.ticket, f]));
    expect(byTicket['LAB-201'].status).toBe('fix-merged');
    expect(byTicket['LAB-401'].status).toBe('fix-blocked');
    expect(byTicket['LAB-401'].blocked_reason).toContain('unassigned');
    expect(byTicket['LAB-101'].status).toBe('fix-in-review');
    expect(byTicket['LAB-503'].status).toBe('open');
    expect(byTicket['LAB-503'].root_cause_group).toBe('intake-unclassified');
  });
});
