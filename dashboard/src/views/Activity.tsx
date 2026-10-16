import { useApp } from '../context';
import { Ext, Lozenge, type Tone } from '../components/ui';
import { fmtDateTime } from '../lib/format';

interface Item { at: string; type: string; summary: string; url: string | null; observed: boolean; key: string }

const TONE: Record<string, Tone> = { 'pr-merged': 'success', 'pr-opened': 'inprogress', 'pr-closed': 'default', 'finding-reported': 'moved', 'advisory-retrieved': 'new', 'evidence-captured': 'default', 'ci-run': 'default', observed: 'success' };

export function Activity() {
  const { model } = useApp();
  const items: Item[] = [
    ...model.persisted.events.map((e) => ({
      at: e.at, type: e.to === 'merged' ? 'pr-merged' : e.to === 'closed' ? 'pr-closed' : 'pr-opened',
      summary: `PR #${e.pr} ${e.from ?? 'unseen'} → ${e.to}${e.title ? `: ${e.title}` : ''}`, url: e.url, observed: true, key: `o-${e.pr}-${e.from}-${e.to}`,
    })),
    ...model.data.history.map((h, i) => ({ at: h.at, type: h.type, summary: h.summary, url: h.url ?? null, observed: false, key: `h-${i}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="stack">
      <h1 className="page-title">Activity</h1>
      <p className="muted small">Build-time history from data.json, plus PR state transitions observed by this browser during Refresh (stored in localStorage).</p>
      <ol className="timeline" data-testid="activity-timeline">
        {items.map((it) => (
          <li key={it.key} className="timeline-item">
            <time dateTime={it.at} className="timeline-time">{fmtDateTime(it.at)}</time>
            <Lozenge tone={TONE[it.type] ?? 'default'}>{it.type}</Lozenge>
            {it.observed && <Lozenge tone="new">observed in browser</Lozenge>}
            <span className="timeline-summary">{it.url ? <Ext href={it.url}>{it.summary}</Ext> : it.summary}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
