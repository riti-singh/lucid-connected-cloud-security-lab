import { useApp } from '../context';
import { Card, ChecksLozenge, Ext, KV, Lozenge, Pre } from '../components/ui';
import { fmtDateTime, shortSha } from '../lib/format';
import type { CommandResult } from '../types/data';

function CommandCard({ title, r }: { title: string; r: CommandResult }) {
  return (
    <Card title={title} actions={<Lozenge tone={r.passed ? 'success' : 'removed'} bold>{r.passed ? 'PASS' : 'FAIL'}</Lozenge>}>
      <div className="muted small"><span className="mono">$ {r.command}</span> · exit {r.exit_code}</div>
      <Pre label={`${title} stdout`}>{r.stdout || '(no stdout)'}</Pre>
      {r.stderr ? <Pre label={`${title} stderr`}>{r.stderr}</Pre> : null}
    </Card>
  );
}

export function Baselines() {
  const { model } = useApp();
  const { baselines, audits, sources } = model.data;
  const run = model.labValidationMain;
  return (
    <div className="stack">
      <h1 className="page-title">Baselines &amp; audits</h1>
      <Card title="Baseline jobs" actions={<span className="muted small">source: {baselines.source}{baselines.captured_at ? ` · ${fmtDateTime(baselines.captured_at)}` : ''}</span>}>
        <table className="table" data-testid="baseline-table">
          <thead><tr><th scope="col">Job</th><th scope="col">Language</th><th scope="col">Result</th><th scope="col">Expected</th><th scope="col">Outcome</th></tr></thead>
          <tbody>
            {baselines.jobs.map((j) => {
              const outcome = j.result === 'ERROR' ? 'ERROR' : j.match ? 'MATCH' : 'MISMATCH';
              return (
                <tr key={j.name}>
                  <td>{j.name}</td><td className="mono small">{j.language ?? '—'}</td>
                  <td className="mono">{j.result}</td><td className="mono">{j.expected ?? '—'}</td>
                  <td><Lozenge tone={outcome === 'MATCH' ? 'success' : 'removed'} bold>{outcome}</Lozenge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="small muted">In baseline mode the security tests are expected to FAIL; MATCH means the intentional weaknesses are still present on the built commit.</p>
        <KV items={[
          ['Command', <span className="mono">{baselines.command}</span>],
          ['Exit code', baselines.exit_code ?? '—'],
          ['Summary', baselines.summary_line ?? '—'],
          ...(sources.baselines.note ? [['Note', sources.baselines.note] as [string, string]] : []),
        ]} />
        <Pre label="run_baselines output">{baselines.raw}</Pre>
      </Card>
      <div className="grid-2">
        <CommandCard title="audit_findings.py" r={audits.audit_findings} />
        <CommandCard title="triage.py" r={audits.triage} />
      </div>
      <Card title="Latest lab-validation run on main">
        {run ? (
          <KV items={[
            ['Conclusion', <ChecksLozenge conclusion={run.conclusion ?? run.status} />],
            ['Run', <Ext href={run.html_url}>{run.name}</Ext>],
            ['Head', <span className="mono">{shortSha(run.head_sha)}</span>],
            ['Event', run.event],
            ['Created', fmtDateTime(run.created_at)],
            ['Source', model.live?.labValidationMain ? 'live' : 'build-time'],
          ]} />
        ) : <p className="muted">No run in build data. Use Refresh to query GitHub.</p>}
      </Card>
    </div>
  );
}
