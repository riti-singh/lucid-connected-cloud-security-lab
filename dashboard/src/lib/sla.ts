import type { Finding, Severity } from '../types/data';

export const SLA_POLICY_DAYS: Record<Severity, number> = { critical: 7, high: 14, medium: 30, low: 90 };
export const DUE_SOON_DAYS = 3;
const DAY_MS = 86_400_000;

export type SlaState = 'overdue' | 'due-soon' | 'on-track' | 'met';

export interface SlaInfo {
  policyDays: number;
  dueDate: string;
  daysRemaining: number;
  state: SlaState;
  recordedDueMismatch: boolean;
}

function parseDateUtc(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar date of `now` in the browser's local time zone, as UTC midnight ms. */
export function localToday(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: string, days: number): string {
  return toIsoDate(parseDateUtc(date) + days * DAY_MS);
}

export function computeSla(
  finding: Pick<Finding, 'severity' | 'reported_at' | 'due_at' | 'status'>,
  now: Date,
): SlaInfo {
  const policyDays = SLA_POLICY_DAYS[finding.severity];
  const dueDate = addDays(finding.reported_at, policyDays);
  const daysRemaining = Math.round((parseDateUtc(dueDate) - localToday(now)) / DAY_MS);
  let state: SlaState;
  if (finding.status === 'fix-merged') state = 'met';
  else if (daysRemaining < 0) state = 'overdue';
  else if (daysRemaining <= DUE_SOON_DAYS) state = 'due-soon';
  else state = 'on-track';
  return { policyDays, dueDate, daysRemaining, state, recordedDueMismatch: Boolean(finding.due_at) && finding.due_at !== dueDate };
}

export function slaLabel(info: SlaInfo): string {
  if (info.state === 'met') return 'Fix merged';
  if (info.daysRemaining < 0) return `${-info.daysRemaining}d overdue`;
  if (info.daysRemaining === 0) return 'Due today';
  return `${info.daysRemaining}d left`;
}
