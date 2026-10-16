import { useApp } from '../context';
import { Callout, Card, ChecksLozenge, Ext, KV, Lozenge, OriginTag, PrStateLozenge, ReviewStateLozenge, TicketLink } from '../components/ui';
import { fmtDateTime, shortSha } from '../lib/format';
import type { EffectivePr } from '../lib/merge';

function OpenPrCard({ pr }: { pr: EffectivePr }) {
  const { model } = useApp();
  const session = pr.session_url ?? model.data.sessions.find((s) => s.id === pr.session_id)?.url;
  const v = pr.validation;
  const headMoved = v?.validated_head && pr.headSha && !pr.headSha.startsWith(v.validated_head) && !v.validated_head.startsWith(pr.headSha);
  const blocked = pr.review_state === 'blocked-owner-assignment';
  return (
    <article className={`pr-card${blocked ? ' pr-card-blocked' : ''}`} data-testid={`pr-card-${pr.number}`} aria-labelledby={`pr-title-${pr.number}`}>
      <header className="pr-card-head">
        <h3 id={`pr-title-${pr.number}`}><Ext href={pr.url}>#{pr.number}</Ext> {pr.title}</h3>
        <div className="pr-meta">
          <PrStateLozenge state={pr.state} testId={`pr-state-${pr.number}`} />
          <ReviewStateLozenge review={pr.review_state} testId={`pr-review-state-${pr.number}`} />
          <OriginTag pr={pr} />
        </div>
      </header>
      {blocked && pr.state === 'open' && (
        <Callout tone="error" title="Blocked: owner assignment">{pr.blocked_reason}</Callout>
      )}
      <KV items={[
        ['Tickets', pr.tickets.length ? pr.tickets.map((t, i) => <span key={t}>{i > 0 && ', '}<TicketLink ticket={t} /></span>) : '—'],
        ['Service', <span className="mono">{pr.service ?? '—'}</span>],
        ['Root-cause group', <span className="mono">{pr.root_cause_group ?? '—'}</span>],
        ['Validated head', <span className="mono">{shortSha(v?.validated_head)}</span>],
        ['Runner args', v?.runner_args ? <span className="mono">{v.runner_args}</span> : '—'],
        ['CI', v ? <span><ChecksLozenge conclusion={v.ci_conclusion} /> {v.ci_workflow} {v.ci_run_url && <Ext href={v.ci_run_url}>run</Ext>}</span> : '—'],
        ['Current head', <span className="mono">{shortSha(pr.headSha)}{headMoved ? ' (differs from validated head)' : ''}</span>],
        ['Live checks', pr.checks ? (
          <span><ChecksLozenge conclusion={pr.checksConclusion} /> {pr.checks.map((c) => <span key={c.name} className="small"><Ext href={c.html_url}>{c.name}</Ext>: {c.conclusion ?? c.status} </span>)}</span>
        ) : <span className="muted">not fetched; use Refresh</span>],
        ['Session', session ? <Ext href={session}>Devin session</Ext> : '—'],
        ['Opened', fmtDateTime(pr.created_at)],
      ]} />
      {v?.notes && <p className="small muted">{v.notes}</p>}
    </article>
  );
}

export function Remediations() {
  const { model } = useApp();
  const { data, prs } = model;
  const rem = prs.filter((p) => p.category === 'remediation');
  const open = rem.filter((p) => p.state === 'open');
  const mergedRem = rem.filter((p) => p.state !== 'open');
  const supporting = prs.filter((p) => p.category !== 'remediation').sort((a, b) => b.number - a.number);
  const bundle = data.evidence_bundles.find((b) => b.kind === 'dependency-scenario');

  return (
    <div className="stack">
      <h1 className="page-title">Remediations</h1>
      <section className="section" data-testid="open-remediations" aria-labelledby="open-rem-h">
        <h2 id="open-rem-h">Open remediation PRs <span className="count">{open.length}</span></h2>
        <p className="muted small">Unmerged fix PRs awaiting human review. Each was validated in CI with the listed runner arguments.</p>
        {open.length === 0 && <p className="muted">No open remediation PRs.</p>}
        <div className="pr-grid">{open.map((p) => <OpenPrCard key={p.number} pr={p} />)}</div>
      </section>

      <section className="section" data-testid="historical-remediations" aria-labelledby="hist-rem-h">
        <h2 id="hist-rem-h">Merged and historical</h2>
        {mergedRem.length > 0 && (
          <div className="pr-grid">{mergedRem.map((p) => <OpenPrCard key={p.number} pr={p} />)}</div>
        )}
        {data.demonstrated_remediations.map((d) => (
          <Card key={d.id} title={<>Demonstrated: {d.id}</>} actions={<Lozenge tone="moved" bold>{d.status}</Lozenge>} testId={`demo-${d.id}`}>
            <p>{d.summary}</p>
            {d.reachability && <Callout tone="info" title="Reachability">{d.reachability}</Callout>}
            <KV items={[
              ['Tickets', d.tickets.map((t) => <TicketLink key={t} ticket={t} />)],
              ['Kind', d.kind],
              ['Tool', d.tool ? <span className="mono">{d.tool}</span> : '—'],
              ['PRs', d.pr_numbers?.map((n) => <Ext key={n} href={prs.find((p) => p.number === n)?.url}>#{n} </Ext>) ?? '—'],
            ]} />
            {bundle?.summary && <ScenarioPhases summary={bundle.summary} />}
            <h4>Evidence</h4>
            <ul className="plain">{d.evidence.map((e) => <li key={e.path}><Ext href={e.url}><span className="mono small">{e.path}</span></Ext></li>)}</ul>
          </Card>
        ))}
        {data.combined_validations.map((c, i) => {
          const r = c as Record<string, unknown>;
          return (
            <Card key={String(r.id ?? i)} title={<>Combined validation: {String(r.id ?? '')}</>} testId={`combined-${String(r.id ?? i)}`}>
              <KV items={[
                ['PRs', Array.isArray(r.pr_numbers) ? (r.pr_numbers as number[]).map((n) => <Ext key={n} href={prs.find((p) => p.number === n)?.url}>#{n} </Ext>) : '—'],
                ['Command', <span className="mono">{String(r.command ?? '')}</span>],
                ['Result', String(r.result ?? '')],
                ['Context', String(r.context ?? '—')],
              ]} />
            </Card>
          );
        })}
        <Card title="Merged supporting PRs">
          <table className="table">
            <thead><tr><th scope="col">PR</th><th scope="col">Title</th><th scope="col">Category</th><th scope="col">State</th><th scope="col">Merged</th><th scope="col">Source</th></tr></thead>
            <tbody>
              {supporting.map((p) => (
                <tr key={p.number} data-testid={`pr-card-${p.number}`}>
                  <td><Ext href={p.url}>#{p.number}</Ext></td>
                  <td className="cell-title">{p.title}</td>
                  <td className="small">{p.category}</td>
                  <td><PrStateLozenge state={p.state} testId={`pr-state-${p.number}`} /> <span className="sr-only" data-testid={`pr-review-state-${p.number}`}>{p.review_state}</span></td>
                  <td className="small">{fmtDateTime(p.merged_at)}</td>
                  <td><OriginTag pr={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function ScenarioPhases({ summary }: { summary: Record<string, unknown> }) {
  const phases = (summary.phases ?? {}) as Record<string, Record<string, unknown>>;
  const names = Object.keys(phases);
  if (!names.length) return null;
  return (
    <table className="table">
      <thead><tr><th scope="col">Phase</th><th scope="col">Installed</th><th scope="col">Scanner exit</th><th scope="col">Advisories reported</th><th scope="col">Tests exit</th></tr></thead>
      <tbody>
        {names.map((n) => {
          const p = phases[n];
          const ids = Array.isArray(p.scanner_ids_and_aliases) ? (p.scanner_ids_and_aliases as string[]) : [];
          return (
            <tr key={n}>
              <td>{n}</td><td className="mono">{String(p.installed ?? '—')}</td><td className="mono">{String(p.scanner_exit ?? '—')}</td>
              <td className="mono small">{ids.length ? ids.join(', ') : 'none'}</td><td className="mono">{String(p.tests_exit ?? '—')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
