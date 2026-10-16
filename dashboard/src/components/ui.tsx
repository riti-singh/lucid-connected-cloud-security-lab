import type { ReactNode } from 'react';
import type { ChecksConclusion, Finding, FindingStatus, PrState, Remediation, Severity } from '../types/data';
import type { EffectivePr, PrOrigin } from '../lib/merge';
import { computeSla, slaLabel, type SlaState } from '../lib/sla';
import { fmtDate } from '../lib/format';
import { useApp } from '../context';

export type Tone = 'default' | 'success' | 'inprogress' | 'removed' | 'moved' | 'new';

export function Lozenge({ tone = 'default', children, bold, testId, title }: { tone?: Tone; children: ReactNode; bold?: boolean; testId?: string; title?: string }) {
  return (
    <span className={`lozenge lozenge-${tone}${bold ? ' lozenge-bold' : ''}`} data-testid={testId} title={title}>
      {children}
    </span>
  );
}

const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`sev sev-${severity}`}>
      <span className="sev-mark" aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const STATUS: Record<FindingStatus, [Tone, string]> = {
  open: ['default', 'Open'],
  'fix-in-review': ['inprogress', 'Fix in review'],
  'fix-blocked': ['removed', 'Fix blocked'],
  'fix-merged': ['success', 'Fix merged'],
};

export function StatusLozenge({ status }: { status: FindingStatus }) {
  const [tone, label] = STATUS[status];
  return <Lozenge tone={tone}>{label}</Lozenge>;
}

const PR_STATE_TONE: Record<PrState, Tone> = { open: 'inprogress', merged: 'success', closed: 'default' };

export function PrStateLozenge({ state, testId }: { state: PrState; testId?: string }) {
  return (
    <Lozenge tone={PR_STATE_TONE[state]} bold testId={testId}>
      {state}
    </Lozenge>
  );
}

export function reviewStateLabel(r: Remediation['review_state']): string {
  switch (r) {
    case 'blocked-owner-assignment': return 'Blocked: owner assignment';
    case 'human-review': return 'Awaiting human review';
    case 'merged': return 'Merged';
    case 'closed': return 'Closed';
  }
}

export function ReviewStateLozenge({ review, testId }: { review: Remediation['review_state']; testId?: string }) {
  const tone: Tone = review === 'blocked-owner-assignment' ? 'removed' : review === 'human-review' ? 'moved' : review === 'merged' ? 'success' : 'default';
  return <Lozenge tone={tone} testId={testId}>{reviewStateLabel(review)}</Lozenge>;
}

const ORIGIN_LABEL: Record<PrOrigin, string> = { build: 'build-time', live: 'live', cached: 'cached' };
const ORIGIN_HELP: Record<PrOrigin, string> = {
  build: 'State from data.json (GitHub at build time, or recorded state)',
  live: 'State from GitHub in this browser session',
  cached: 'State from an earlier refresh in this browser (localStorage)',
};

export function OriginTag({ pr }: { pr: EffectivePr }) {
  const src = pr.origin === 'build' ? `${ORIGIN_LABEL.build}${pr.state_source === 'recorded' ? ' (recorded)' : ''}` : ORIGIN_LABEL[pr.origin];
  return (
    <span className={`origin origin-${pr.origin}`} title={ORIGIN_HELP[pr.origin]} data-testid={`pr-origin-${pr.number}`}>
      {src}
    </span>
  );
}

export function ChecksLozenge({ conclusion }: { conclusion: ChecksConclusion | string | null }) {
  const c = conclusion ?? 'unknown';
  const tone: Tone = c === 'success' ? 'success' : c === 'failure' ? 'removed' : c === 'pending' ? 'inprogress' : 'default';
  return <Lozenge tone={tone}>{c}</Lozenge>;
}

const SLA_TONE: Record<SlaState, Tone> = { overdue: 'removed', 'due-soon': 'moved', 'on-track': 'default', met: 'success' };

export function SlaCell({ finding, now }: { finding: Finding; now: Date }) {
  const sla = computeSla(finding, now);
  return (
    <span className="sla">
      <span className="mono">{fmtDate(sla.dueDate)}</span> <Lozenge tone={SLA_TONE[sla.state]}>{slaLabel(sla)}</Lozenge>
    </span>
  );
}

export function Ext({ href, children, className }: { href: string | null | undefined; children: ReactNode; className?: string }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}

export function TicketLink({ ticket }: { ticket: string }) {
  const { openTicket } = useApp();
  return (
    <button type="button" className="link-button mono" onClick={() => openTicket(ticket)} aria-label={`Open ${ticket} details`}>
      {ticket}
    </button>
  );
}

export function PrInline({ pr }: { pr: EffectivePr }) {
  return (
    <span className="pr-inline">
      <Ext href={pr.url}>#{pr.number}</Ext> <PrStateLozenge state={pr.state} />
      {pr.state === 'open' && pr.review_state === 'blocked-owner-assignment' && <Lozenge tone="removed">blocked</Lozenge>}
      <OriginTagSmall pr={pr} />
    </span>
  );
}

function OriginTagSmall({ pr }: { pr: EffectivePr }) {
  return <span className={`origin origin-${pr.origin}`} title={ORIGIN_HELP[pr.origin]}>{ORIGIN_LABEL[pr.origin]}</span>;
}

export function Card({ title, children, className, testId, actions }: { title?: ReactNode; children: ReactNode; className?: string; testId?: string; actions?: ReactNode }) {
  return (
    <section className={`card ${className ?? ''}`} data-testid={testId}>
      {title && (
        <header className="card-header">
          <h3>{title}</h3>
          {actions}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Callout({ tone, title, children, testId }: { tone: 'error' | 'warning' | 'info'; title: ReactNode; children?: ReactNode; testId?: string }) {
  return (
    <div className={`callout callout-${tone}`} role={tone === 'info' ? 'note' : 'alert'} data-testid={testId}>
      <strong className="callout-title">{title}</strong>
      {children && <div className="callout-body">{children}</div>}
    </div>
  );
}

export function Pre({ children, label }: { children: string; label: string }) {
  return (
    <pre className="pre" tabIndex={0} aria-label={label}>
      {children}
    </pre>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
