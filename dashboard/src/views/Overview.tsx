import { useApp } from '../context';
import { buildHash } from '../lib/hash';
import { computeSla } from '../lib/sla';
import { Callout, Card, ChecksLozenge, Ext, Lozenge, PrStateLozenge, SeverityBadge, StatusLozenge, TicketLink } from '../components/ui';
import type { FindingStatus, Severity } from '../types/data';
import { fmtDateTime, shortSha } from '../lib/format';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const STATUSES: FindingStatus[] = ['open', 'fix-in-review', 'fix-blocked', 'fix-merged'];

function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: 'danger' | 'warn' }) {
  const body = (
    <>
      <span className={`stat-value${tone ? ` stat-${tone}` : ''}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return href ? <a className="stat" href={href}>{body}</a> : <div className="stat">{body}</div>;
}

export function Overview() {
  const { model } = useApp();
  const { data, findings, prs, now } = model;
  const f = (p: Record<string, string>) => buildHash('findings', p);
  const overdue = findings.filter((x) => computeSla(x, now).state === 'overdue');
  const remediationPrs = prs.filter((p) => p.category === 'remediation');
  const openRem = remediationPrs.filter((p) => p.state === 'open');
  const mergedRem = remediationPrs.filter((p) => p.state === 'merged');
  const mergedAll = prs.filter((p) => p.state === 'merged');
  const jobs = data.baselines.jobs;
  const jobState = (j: (typeof jobs)[number]) => (j.result === 'ERROR' ? 'ERROR' : j.match ? 'MATCH' : 'MISMATCH');
  const run = model.labValidationMain;

  return (
    <div className="stack">
      <h1 className="page-title">Overview</h1>
      {data.escalations.map((e) => (
        <Callout key={e.id} tone="error" title={`Escalation: ${e.service} has no assigned owner`} testId={`escalation-${e.id}`}>
          <p>{e.reason}</p>
          <p>
            Tickets: {e.tickets.map((t, i) => <span key={t}>{i > 0 && ', '}<TicketLink ticket={t} /></span>)}. PRs:{' '}
            {e.pr_numbers.map((n) => {
              const pr = prs.find((p) => p.number === n);
              return (
                <span key={n}>
                  <Ext href={pr?.url}>#{n}</Ext> {pr && <PrStateLozenge state={pr.state} />} {pr?.review_state === 'blocked-owner-assignment' && pr.state === 'open' && <Lozenge tone="removed">Blocked: owner assignment</Lozenge>}
                </span>
              );
            })}
          </p>
          {e.open_questions?.length ? <p>Open questions: {e.open_questions.join(' ')}</p> : null}
        </Callout>
      ))}

      <div className="grid-3">
        <Card title="Findings by severity">
          <div className="stats">
            {SEVERITIES.map((s) => (
              <a key={s} className="stat" href={f({ severity: s })}>
                <span className="stat-value">{findings.filter((x) => x.severity === s).length}</span>
                <span className="stat-label"><SeverityBadge severity={s} /></span>
              </a>
            ))}
          </div>
        </Card>
        <Card title="Findings by status">
          <div className="stats">
            {STATUSES.map((s) => (
              <a key={s} className="stat" href={f({ status: s })}>
                <span className="stat-value">{findings.filter((x) => x.status === s).length}</span>
                <span className="stat-label"><StatusLozenge status={s} /></span>
              </a>
            ))}
          </div>
        </Card>
        <Card title="Attention">
          <div className="stats">
            <Stat label="Overdue (SLA)" value={overdue.length} href={f({ overdue: '1' })} tone={overdue.length ? 'danger' : undefined} />
            <Stat label="Fix blocked" value={findings.filter((x) => x.status === 'fix-blocked').length} href={f({ status: 'fix-blocked' })} tone="danger" />
            <Stat label="Unassigned owner" value={findings.filter((x) => !x.owner_assigned).length} href={f({ owner: 'unassigned' })} tone="warn" />
            <Stat label="Untriaged intake" value={findings.filter((x) => x.triage_state === 'untriaged').length} href={f({ untriaged: '1' })} tone="warn" />
          </div>
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Remediation PRs" actions={<a href={buildHash('remediations')}>View all</a>}>
          <div className="stats">
            <Stat label="Open remediation PRs" value={openRem.length} href={buildHash('remediations')} />
            <Stat label="Merged remediation PRs" value={mergedRem.length} href={buildHash('remediations')} />
            <Stat label="Merged PRs (all categories)" value={mergedAll.length} href={buildHash('remediations')} />
          </div>
        </Card>
        <Card title="Baselines & audits" actions={<a href={buildHash('baselines')}>Details</a>}>
          <div className="stats">
            {(['MATCH', 'MISMATCH', 'ERROR'] as const).map((s) => (
              <Stat key={s} label={`Baseline ${s}`} value={jobs.filter((j) => jobState(j) === s).length} tone={s !== 'MATCH' && jobs.some((j) => jobState(j) === s) ? 'danger' : undefined} />
            ))}
            <div className="stat">
              <span className="stat-value">
                <Lozenge tone={data.audits.audit_findings.passed ? 'success' : 'removed'} bold>{data.audits.audit_findings.passed ? 'PASS' : 'FAIL'}</Lozenge>
              </span>
              <span className="stat-label">audit_findings.py</span>
            </div>
          </div>
        </Card>
        <Card title="Latest lab-validation run on main">
          {run ? (
            <div className="kv-inline">
              <ChecksLozenge conclusion={run.conclusion ?? run.status} />{' '}
              <Ext href={run.html_url}>{run.event} · {shortSha(run.head_sha)}</Ext>
              <div className="muted">{fmtDateTime(run.created_at)} · {model.live?.labValidationMain ? 'live' : 'build-time'}</div>
            </div>
          ) : (
            <p className="muted">Not in build data. Use Refresh to query GitHub.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
