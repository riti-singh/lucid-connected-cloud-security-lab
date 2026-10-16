import type { Finding, FindingStatus, Severity } from '../types/data';
import type { EffectivePr } from './merge';
import { computeSla } from './sla';

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const STATUS_ORDER: Record<FindingStatus, number> = { 'fix-blocked': 0, open: 1, 'fix-in-review': 2, 'fix-merged': 3 };

export const COLUMNS = ['ticket', 'title', 'kind', 'severity', 'status', 'service', 'owner', 'cwe', 'due', 'group', 'prs'] as const;
export type Column = (typeof COLUMNS)[number];

export interface FindingFilters {
  severity: string;
  status: string;
  kind: string;
  service: string;
  owner: string;
  overdue: boolean;
  untriaged: boolean;
  q: string;
  sort: Column;
  dir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: FindingFilters = {
  severity: '', status: '', kind: '', service: '', owner: '', overdue: false, untriaged: false, q: '', sort: 'due', dir: 'asc',
};

export function filtersFromParams(p: URLSearchParams): FindingFilters {
  const sort = p.get('sort');
  return {
    severity: p.get('severity') ?? '',
    status: p.get('status') ?? '',
    kind: p.get('kind') ?? '',
    service: p.get('service') ?? '',
    owner: p.get('owner') ?? '',
    overdue: p.get('overdue') === '1',
    untriaged: p.get('untriaged') === '1',
    q: p.get('q') ?? '',
    sort: (COLUMNS as readonly string[]).includes(sort ?? '') ? (sort as Column) : DEFAULT_FILTERS.sort,
    dir: p.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

function sortKey(f: Finding, col: Column, now: Date): string | number {
  switch (col) {
    case 'ticket': return f.ticket;
    case 'title': return f.title.toLowerCase();
    case 'kind': return f.kind;
    case 'severity': return SEVERITY_ORDER[f.severity];
    case 'status': return STATUS_ORDER[f.status];
    case 'service': return f.repository;
    case 'owner': return f.owner;
    case 'cwe': return f.cwe.map((c) => Number(c.replace('CWE-', ''))).sort((a, b) => a - b)[0] ?? 0;
    case 'due': return computeSla(f, now).daysRemaining;
    case 'group': return f.root_cause_group;
    case 'prs': return f.remediation_pr_numbers.length ? Math.min(...f.remediation_pr_numbers) : Number.MAX_SAFE_INTEGER;
  }
}

export function queryFindings(findings: Finding[], filters: FindingFilters, now: Date, prs: EffectivePr[] = []): Finding[] {
  const q = filters.q.trim().toLowerCase();
  const out = findings.filter((f) => {
    if (filters.severity && f.severity !== filters.severity) return false;
    if (filters.status && f.status !== filters.status) return false;
    if (filters.kind && f.kind !== filters.kind) return false;
    if (filters.service && f.repository !== filters.service) return false;
    if (filters.owner === 'unassigned' ? f.owner_assigned : filters.owner && f.owner !== filters.owner) return false;
    if (filters.untriaged && f.triage_state !== 'untriaged') return false;
    if (filters.overdue && computeSla(f, now).state !== 'overdue') return false;
    if (q) {
      const prTitles = prs.filter((p) => f.remediation_pr_numbers.includes(p.number)).map((p) => `#${p.number} ${p.title}`);
      const hay = [f.ticket, f.title, f.repository, f.owner, f.root_cause_group, f.advisory_id ?? '', f.package ?? '', ...f.cwe, ...f.aliases, ...prTitles]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sign = filters.dir === 'desc' ? -1 : 1;
  return out.sort((a, b) => {
    const ka = sortKey(a, filters.sort, now);
    const kb = sortKey(b, filters.sort, now);
    const c = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb));
    return c !== 0 ? sign * c : a.ticket.localeCompare(b.ticket);
  });
}
