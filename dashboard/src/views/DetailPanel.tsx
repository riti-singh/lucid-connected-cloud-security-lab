import { useEffect, useRef } from 'react';
import { useApp } from '../context';
import { computeSla, slaLabel } from '../lib/sla';
import { advisoryMatchesFinding, fmtDate, fmtDateTime, osvUrl, shortSha } from '../lib/format';
import { Callout, ChecksLozenge, Ext, KV, Lozenge, OriginTag, PrStateLozenge, ReviewStateLozenge, SeverityBadge, StatusLozenge } from '../components/ui';
import type { EvidenceFile } from '../types/data';

function EvidenceFileView({ file }: { file: EvidenceFile }) {
  return (
    <details className="evidence-file">
      <summary>
        <span className="mono small">{file.path}</span> <span className="muted small">{file.size_bytes} B</span>
      </summary>
      <div className="evidence-actions"><Ext href={file.url}>View on GitHub</Ext></div>
      {file.preview !== null ? (
        <pre className="pre" tabIndex={0} aria-label={`Preview of ${file.path}`}>{file.preview}{file.truncated ? '\n… (truncated)' : ''}</pre>
      ) : (
        <p className="muted">No text preview.</p>
      )}
    </details>
  );
}

export function DetailPanel({ ticket, onClose }: { ticket: string; onClose: () => void }) {
  const { model } = useApp();
  const { data, findings, prs, now } = model;
  const heading = useRef<HTMLHeadingElement>(null);
  const f = findings.find((x) => x.ticket === ticket);

  useEffect(() => {
    heading.current?.focus();
  }, [ticket]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!f) {
    return (
      <aside className="drawer" role="dialog" aria-label="Finding detail" data-testid="finding-detail">
        <div className="drawer-head"><h2 ref={heading} tabIndex={-1}>{ticket}</h2><button type="button" className="btn" onClick={onClose}>Close</button></div>
        <p>Ticket not found in data.json.</p>
      </aside>
    );
  }

  const sla = computeSla(f, now);
  const group = data.root_cause_groups.find((g) => g.id === f.root_cause_group);
  const advisories = data.advisories.filter((a) => advisoryMatchesFinding(a, f));
  const related = prs.filter((p) => f.remediation_pr_numbers.includes(p.number) || p.tickets.includes(f.ticket));
  const sessionIds = new Set(related.map((p) => p.session_id).filter(Boolean));
  const sessions = data.sessions.filter((s) => sessionIds.has(s.id) || s.pr_numbers.some((n) => related.some((p) => p.number === n)));
  const service = data.services.find((s) => s.repo === f.repository);
  const escalation = data.escalations.find((e) => e.tickets.includes(f.ticket) || e.service === f.repository);
  const demos = data.demonstrated_remediations.filter((d) => d.tickets.includes(f.ticket));
  const intake = f.kind === 'intake';

  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-labelledby="detail-title" data-testid="finding-detail">
      <div className="drawer-head">
        <div>
          <div className="drawer-kicker">
            <span className="mono">{f.ticket}</span>
            {intake && <Lozenge tone="moved" bold testId="intake-label">Untriaged intake</Lozenge>}
            {f.kind === 'dependency' && <Lozenge tone="default">Dependency</Lozenge>}
            <Lozenge tone="new">Synthetic</Lozenge>
          </div>
          <h2 id="detail-title" ref={heading} tabIndex={-1}>{f.title}</h2>
        </div>
        <button type="button" className="btn" onClick={onClose} aria-label="Close detail panel">Close</button>
      </div>
      <div className="drawer-body">
        {(f.status === 'fix-blocked' || !f.owner_assigned) && (
          <Callout tone="error" title={f.status === 'fix-blocked' ? 'Fix blocked: owner assignment required' : 'Unassigned owner: escalation required'} testId="blocked-banner">
            <p>{f.blocked_reason ?? escalation?.reason ?? `${f.repository} has no assigned owner.`}</p>
            {escalation && f.blocked_reason !== escalation.reason && <p>{escalation.reason}</p>}
          </Callout>
        )}
        {intake && (
          <Callout tone="warning" title="Untriaged intake">
            <p>Reported through the synthetic intake queue and not yet triaged. <span className="mono">intake-unclassified</span> is a holding bucket, not a verified shared root cause.</p>
          </Callout>
        )}

        <section className="drawer-section">
          <h3>Fields</h3>
          <KV items={[
            ['Severity', <SeverityBadge severity={f.severity} />],
            ['Status', <StatusLozenge status={f.status} />],
            ['Service', <Ext href={service?.source_url}>{f.repository}</Ext>],
            ['Language', f.language],
            ['Owner', f.owner_assigned ? f.owner : <Lozenge tone="removed">Unassigned</Lozenge>],
            ['CWE', f.cwe.map((c) => <span key={c} className="mono">{c} </span>)],
            ['Test', f.test_name ? <span className="mono">{f.test_name}</span> : <span className="muted">No linked test</span>],
            ['Triage state', f.triage_state],
            ['Requires human approval', f.requires_human_approval ? 'yes' : 'no'],
            ...(f.package ? [['Package', <span className="mono">{f.ecosystem} {f.package} {f.pinned_version} → fixed {f.fixed_version ?? '—'}</span>] as [string, React.ReactNode]] : []),
          ]} />
        </section>

        <section className="drawer-section">
          <h3>SLA</h3>
          <KV items={[
            ['Reported', fmtDate(f.reported_at)],
            ['Policy', `${f.severity} = ${sla.policyDays} days from reported_at`],
            ['Due', <span><span className="mono">{sla.dueDate}</span> <Lozenge tone={sla.state === 'overdue' ? 'removed' : sla.state === 'due-soon' ? 'moved' : sla.state === 'met' ? 'success' : 'default'}>{slaLabel(sla)}</Lozenge></span>],
            ...(sla.recordedDueMismatch ? [['Recorded due_at', <span className="mono">{f.due_at} (differs from policy)</span>] as [string, React.ReactNode]] : []),
          ]} />
          <p className="muted small">Days computed against today ({now.toLocaleDateString()}) in this browser.</p>
        </section>

        <section className="drawer-section">
          <h3>Provenance</h3>
          <KV items={[
            ['Source', <span className="mono">{f.source}</span>],
            ['Verification status', <span className="mono">{f.verification_status}</span>],
            ['Verification notes', f.verification_notes ?? <span className="muted">—</span>],
            ['Severity source', f.severity_source ?? <span className="muted">synthetic rating</span>],
            ['Synthetic', `synthetic: ${String(f.synthetic)}, actual_lucid_finding: ${String(f.actual_lucid_finding)}`],
            ['Advisory', f.advisory_id ? <Ext href={osvUrl(f.advisory_id)}>{f.advisory_id}</Ext> : <span className="muted">None (LAB-* findings carry no advisory IDs)</span>],
            ...(f.aliases.length ? [['Aliases', <span>{f.aliases.map((a) => <span key={a}><Ext href={osvUrl(a)}>{a}</Ext> </span>)}</span>] as [string, React.ReactNode]] : []),
          ]} />
          {advisories.map((advisory) => (
            <div key={advisory.id} className="sub-card" data-testid={`advisory-${advisory.id}`}>
              <div><strong>{advisory.id}</strong>{advisory.id !== f.advisory_id && <span className="muted small"> (alias record of {f.advisory_id})</span>}: {advisory.summary}</div>
              <div className="muted small">
                OSV severity {advisory.severity ?? '—'} · CWE {advisory.cwe_ids.join(', ') || '—'} · aliases {advisory.aliases.join(', ') || '—'} · published {fmtDate(advisory.published)} · retrieved {fmtDateTime(advisory.retrieved_utc)}
              </div>
              <div className="small"><Ext href={advisory.osv_url}>OSV record</Ext> · <span className="mono">{advisory.osv_path}</span></div>
            </div>
          ))}
        </section>

        <section className="drawer-section">
          <h3>Root-cause group</h3>
          {group ? (
            <div>
              <span className="mono">{group.id}</span>{' '}
              {group.classification === 'untriaged-intake' ? <Lozenge tone="moved">Untriaged intake (not a verified root cause)</Lozenge>
                : group.verified ? <Lozenge tone="success">verified</Lozenge> : <Lozenge>{group.classification}</Lozenge>}
              <pre className="pre small" tabIndex={0} aria-label="triage.py line">{group.triage_line}</pre>
              {group.classification !== 'untriaged-intake' && group.finding_ids.length > 1 && (
                <div className="small">Shared with: {group.finding_ids.filter((t) => t !== f.ticket).join(', ')}</div>
              )}
            </div>
          ) : <span className="mono">{f.root_cause_group}</span>}
        </section>

        <section className="drawer-section">
          <h3>Evidence</h3>
          {f.evidence.length === 0 && <p className="muted">No evidence files linked.</p>}
          <ul className="plain">
            {f.evidence.map((e) => {
              const bundle = e.bundle_id ? data.evidence_bundles.find((b) => b.id === e.bundle_id) : undefined;
              const files = bundle ? bundle.files.filter((x) => x.path === e.path || (e.path.endsWith('/') && x.path.startsWith(e.path))) : [];
              return (
                <li key={e.path}>
                  <Ext href={e.url}><span className="mono small">{e.path}</span></Ext>
                  {files.map((file) => <EvidenceFileView key={file.path} file={file} />)}
                </li>
              );
            })}
          </ul>
          {demos.map((d) => (
            <div key={d.id} className="sub-card">
              <strong>{d.id}</strong> <Lozenge>{d.status}</Lozenge>
              <p>{d.summary}</p>
              {d.reachability && <p><strong>Reachability:</strong> {d.reachability}</p>}
            </div>
          ))}
        </section>

        <section className="drawer-section">
          <h3>Related PRs</h3>
          {related.length === 0 && <p className="muted">No PRs reference this ticket.</p>}
          {related.map((p) => (
            <div key={p.number} className="sub-card">
              <div><Ext href={p.url}>#{p.number} {p.title}</Ext></div>
              <div className="pr-meta">
                <PrStateLozenge state={p.state} /> <ReviewStateLozenge review={p.review_state} /> <OriginTag pr={p} />
                <span className="muted small">{p.category}</span>
              </div>
              {p.state === 'open' && p.blocked_reason && <p className="small danger-text">{p.blocked_reason}</p>}
              {p.validation && (
                <div className="small">
                  Validated head <span className="mono">{shortSha(p.validation.validated_head)}</span>
                  {p.validation.runner_args && <> · <span className="mono">{p.validation.runner_args}</span></>}
                  {p.validation.ci_conclusion && <> · CI <ChecksLozenge conclusion={p.validation.ci_conclusion} /></>}
                  {p.validation.ci_run_url && <> · <Ext href={p.validation.ci_run_url}>CI run</Ext></>}
                </div>
              )}
              {p.checks && p.checks.length > 0 && (
                <div className="small">Checks <ChecksLozenge conclusion={p.checksConclusion} /> {p.checks.map((c) => <Ext key={c.name} href={c.html_url}>{c.name} </Ext>)}</div>
              )}
            </div>
          ))}
        </section>

        <section className="drawer-section">
          <h3>Sessions</h3>
          {sessions.length === 0 ? <p className="muted">None recorded.</p> : (
            <ul className="plain">
              {sessions.map((s) => <li key={s.id}><Ext href={s.url}>{s.role}</Ext> <span className="muted small">PRs {s.pr_numbers.map((n) => `#${n}`).join(', ')}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
