import { useMemo, useState, type KeyboardEvent } from 'react';
import { useApp } from '../context';
import { Ext, Lozenge } from '../components/ui';
import { advisoryMatchesFinding } from '../lib/format';
import type { Severity } from '../types/data';

interface GNode { id: string; col: number; label: string; sub?: string; kind: 'group' | 'finding' | 'pr' | 'advisory' | 'service'; ticket?: string; url?: string; severity?: Severity; tone?: 'blocked' | 'merged' | 'open' }
interface GEdge { from: string; to: string }

const COL_X = [16, 316, 616];
const NODE_W = 260;
const NODE_H = 34;
const GAP = 10;

function layout(nodes: GNode[]): Map<string, number> {
  const y = new Map<string, number>();
  const cols = [0, 1, 2].map((c) => nodes.filter((n) => n.col === c));
  cols.forEach((col) => col.forEach((n, i) => y.set(n.id, 12 + i * (NODE_H + GAP))));
  return y;
}

function connected(id: string | null, edges: GEdge[]): Set<string> {
  const out = new Set<string>();
  if (!id) return out;
  out.add(id);
  const walk = (start: string, dir: 'down' | 'up') => {
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of edges) {
        const next = dir === 'down' ? (e.from === cur ? e.to : null) : e.to === cur ? e.from : null;
        if (next && !out.has(next)) { out.add(next); stack.push(next); }
      }
    }
  };
  walk(id, 'down');
  walk(id, 'up');
  return out;
}

function Graph({ title, nodes, edges, columns, testId }: { title: string; nodes: GNode[]; edges: GEdge[]; columns: string[]; testId: string }) {
  const { openTicket } = useApp();
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hover ?? pinned;
  const lit = useMemo(() => connected(active, edges), [active, edges]);
  const ys = layout(nodes);
  const rows = Math.max(...[0, 1, 2].map((c) => nodes.filter((n) => n.col === c).length), 1);
  const height = 24 + rows * (NODE_H + GAP);
  const width = COL_X[2] + NODE_W + 16;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const selected = pinned ? byId.get(pinned) : undefined;

  const activate = (n: GNode) => {
    setPinned((p) => (p === n.id ? null : n.id));
    if (n.ticket) openTicket(n.ticket);
  };
  const onKey = (e: KeyboardEvent, n: GNode) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(n); }
  };

  return (
    <figure className="graph" data-testid={testId}>
      <figcaption className="graph-title">{title}</figcaption>
      <div className="graph-cols" aria-hidden="true">{columns.map((c, i) => <span key={c} style={{ left: COL_X[i] }}>{c}</span>)}</div>
      <div className="graph-scroll">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title}>
          {edges.map((e) => {
            const a = byId.get(e.from)!; const b = byId.get(e.to)!;
            const x1 = COL_X[a.col] + NODE_W; const y1 = ys.get(a.id)! + NODE_H / 2;
            const x2 = COL_X[b.col]; const y2 = ys.get(b.id)! + NODE_H / 2;
            const on = active ? lit.has(e.from) && lit.has(e.to) : false;
            return <path key={`${e.from}-${e.to}`} d={`M${x1},${y1} C${x1 + 20},${y1} ${x2 - 20},${y2} ${x2},${y2}`} className={`edge${on ? ' edge-on' : active ? ' edge-dim' : ''}`} />;
          })}
          {nodes.map((n) => {
            const on = lit.has(n.id);
            return (
              <g key={n.id} transform={`translate(${COL_X[n.col]},${ys.get(n.id)})`} className={`node node-${n.kind}${n.tone ? ` node-${n.tone}` : ''}${on ? ' node-on' : active ? ' node-dim' : ''}${pinned === n.id ? ' node-pinned' : ''}`}
                tabIndex={0} role="button" aria-pressed={pinned === n.id} aria-label={`${n.label}${n.sub ? `, ${n.sub}` : ''}`} data-testid={`rel-node-${n.id}`}
                onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
                onClick={() => activate(n)} onKeyDown={(e) => onKey(e, n)}>
                <rect width={NODE_W} height={NODE_H} rx={3} />
                {n.severity && <rect className={`sev-bar sev-fill-${n.severity}`} width={4} height={NODE_H} rx={1} />}
                <text x={12} y={14} className="node-label">{n.label}</text>
                {n.sub && <text x={12} y={27} className="node-sub">{n.sub.length > 40 ? `${n.sub.slice(0, 39)}…` : n.sub}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="graph-selected" aria-live="polite">
        {selected ? <>Selected: <strong>{selected.label}</strong>{selected.sub ? ` · ${selected.sub}` : ''} {selected.url && <Ext href={selected.url}>open</Ext>}</> : <span className="muted">Hover or focus a node to highlight its path; click to pin. Clicking a finding opens its detail panel.</span>}
      </div>
    </figure>
  );
}

export function Relationships() {
  const { model, openTicket } = useApp();
  const { data, findings, prs } = model;

  const codeGraph = useMemo(() => {
    const nodes: GNode[] = []; const edges: GEdge[] = [];
    const groups = data.root_cause_groups.filter((g) => g.classification === 'code-root-cause');
    const prSeen = new Set<number>();
    for (const g of groups) {
      nodes.push({ id: `g:${g.id}`, col: 0, kind: 'group', label: g.id, sub: `${g.verified ? 'verified' : 'unverified'} · ${g.finding_ids.length} finding(s)` });
      for (const t of g.finding_ids) {
        const f = findings.find((x) => x.ticket === t);
        if (!f || f.kind === 'intake') continue;
        nodes.push({ id: `f:${t}`, col: 1, kind: 'finding', ticket: t, label: t, sub: f.title, severity: f.severity });
        edges.push({ from: `g:${g.id}`, to: `f:${t}` });
        for (const n of f.remediation_pr_numbers) {
          const p = prs.find((x) => x.number === n);
          if (!p) continue;
          if (!prSeen.has(n)) {
            prSeen.add(n);
            const blocked = p.state === 'open' && p.review_state === 'blocked-owner-assignment';
            nodes.push({ id: `p:${n}`, col: 2, kind: 'pr', label: `PR #${n} · ${p.state}${blocked ? ' · blocked' : ''}`, sub: p.title, url: p.url, tone: blocked ? 'blocked' : p.state === 'merged' ? 'merged' : 'open' });
          }
          edges.push({ from: `f:${t}`, to: `p:${n}` });
        }
      }
    }
    return { nodes, edges };
  }, [data.root_cause_groups, findings, prs]);

  const depGraph = useMemo(() => {
    const nodes: GNode[] = []; const edges: GEdge[] = [];
    const svcSeen = new Set<string>();
    for (const a of data.advisories) {
      const fs = findings.filter((f) => advisoryMatchesFinding(a, f));
      if (!fs.length) continue;
      nodes.push({ id: `a:${a.id}`, col: 0, kind: 'advisory', label: a.id, sub: `${a.package ?? ''} · aliases ${a.aliases.join(', ')}`, url: a.osv_url });
      for (const f of fs) {
        if (!nodes.some((n) => n.id === `f:${f.ticket}`)) nodes.push({ id: `f:${f.ticket}`, col: 1, kind: 'finding', ticket: f.ticket, label: f.ticket, sub: `${f.package} ${f.pinned_version} · ${f.title}`, severity: f.severity });
        edges.push({ from: `a:${a.id}`, to: `f:${f.ticket}` });
        const svc = data.services.find((s) => s.repo === f.repository);
        if (!svcSeen.has(f.repository)) {
          svcSeen.add(f.repository);
          nodes.push({ id: `s:${f.repository}`, col: 2, kind: 'service', label: f.repository, sub: svc ? `owner ${svc.owner}` : undefined, url: svc?.source_url });
        }
        if (!edges.some((e) => e.from === `f:${f.ticket}` && e.to === `s:${f.repository}`)) edges.push({ from: `f:${f.ticket}`, to: `s:${f.repository}` });
      }
    }
    return { nodes, edges };
  }, [data.advisories, data.services, findings]);

  const intake = findings.filter((f) => f.root_cause_group === 'intake-unclassified');

  return (
    <div className="stack" data-testid="relationship-graph">
      <h1 className="page-title">Relationships</h1>
      <Graph title="Root-cause group → findings → remediation PRs" nodes={codeGraph.nodes} edges={codeGraph.edges} columns={['Root-cause group', 'Finding', 'Pull request']} testId="graph-root-cause" />
      <Graph title="Dependency advisory → affected findings → service" nodes={depGraph.nodes} edges={depGraph.edges} columns={['Advisory (OSV)', 'Finding', 'Service']} testId="graph-dependency" />
      <section className="intake-box" data-testid="intake-group" aria-labelledby="intake-h">
        <h2 id="intake-h">Untriaged intake (not a verified root cause)</h2>
        <p className="muted small">
          These tickets share the holding bucket <span className="mono">intake-unclassified</span> only because they have not been triaged. They are not grouped by a shared root cause.
        </p>
        <ul className="intake-list">
          {intake.map((f) => (
            <li key={f.ticket}>
              <button type="button" className="intake-item" onClick={() => openTicket(f.ticket)} data-testid={`rel-node-f:${f.ticket}`} aria-label={`${f.ticket}, untriaged intake: ${f.title}`}>
                <span className="mono">{f.ticket}</span> <Lozenge tone="moved">untriaged</Lozenge>
                <span className="small">{f.title}</span>
                <span className="muted small mono">{f.repository}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
