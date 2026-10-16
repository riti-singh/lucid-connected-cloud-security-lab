import { describe, expect, it } from 'vitest';
import { addDays, computeSla, slaLabel, SLA_POLICY_DAYS } from './sla';

// Fixed clock: local noon avoids time-zone edge effects in CI.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('SLA policy', () => {
  it('uses critical 7 / high 14 / medium 30 / low 90 days', () => {
    expect(SLA_POLICY_DAYS).toEqual({ critical: 7, high: 14, medium: 30, low: 90 });
  });

  it('computes due date from reported_at', () => {
    expect(addDays('2026-10-01', 14)).toBe('2026-10-15');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('marks a high finding overdue after 14 days', () => {
    const f = { severity: 'high' as const, reported_at: '2026-10-01', due_at: '2026-10-15', status: 'open' as const };
    const sla = computeSla(f, at(2026, 10, 16));
    expect(sla.dueDate).toBe('2026-10-15');
    expect(sla.daysRemaining).toBe(-1);
    expect(sla.state).toBe('overdue');
    expect(slaLabel(sla)).toBe('1d overdue');
    expect(sla.recordedDueMismatch).toBe(false);
  });

  it('due date itself is not overdue', () => {
    const f = { severity: 'critical' as const, reported_at: '2026-10-09', due_at: '2026-10-16', status: 'open' as const };
    const sla = computeSla(f, at(2026, 10, 16));
    expect(sla.daysRemaining).toBe(0);
    expect(sla.state).toBe('due-soon');
    expect(slaLabel(sla)).toBe('Due today');
  });

  it('medium and low budgets', () => {
    expect(computeSla({ severity: 'medium', reported_at: '2026-10-12', due_at: '', status: 'open' }, at(2026, 10, 16)).daysRemaining).toBe(26);
    const low = computeSla({ severity: 'low', reported_at: '2026-10-16', due_at: '2027-01-14', status: 'open' }, at(2026, 10, 16));
    expect(low.dueDate).toBe('2027-01-14');
    expect(low.state).toBe('on-track');
  });

  it('flags a recorded due_at that disagrees with the policy', () => {
    const sla = computeSla({ severity: 'high', reported_at: '2026-10-01', due_at: '2026-10-20', status: 'open' }, at(2026, 10, 2));
    expect(sla.recordedDueMismatch).toBe(true);
  });

  it('merged fixes are not reported overdue', () => {
    const sla = computeSla({ severity: 'high', reported_at: '2026-10-01', due_at: '2026-10-15', status: 'fix-merged' }, at(2026, 11, 1));
    expect(sla.state).toBe('met');
  });
});
