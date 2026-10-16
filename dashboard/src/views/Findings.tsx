import { useApp } from '../context';
import { withParams } from '../lib/hash';
import { COLUMNS, DEFAULT_FILTERS, filtersFromParams, queryFindings, type Column } from '../lib/findingsQuery';
import { Lozenge, PrInline, SeverityBadge, SlaCell, StatusLozenge } from '../components/ui';

const HEADERS: Record<Column, string> = {
  ticket: 'Ticket', title: 'Title', kind: 'Kind', severity: 'Severity', status: 'Status', service: 'Service',
  owner: 'Owner', cwe: 'CWE', due: 'Due / SLA', group: 'Root-cause group', prs: 'Linked PRs',
};

const KIND_LABEL: Record<string, string> = { code: 'Code', intake: 'Untriaged intake', dependency: 'Dependency' };

export function Findings() {
  const { model, route, navigate, openTicket } = useApp();
  const filters = filtersFromParams(route.params);
  const rows = queryFindings(model.findings, filters, model.now, model.prs);
  const set = (changes: Record<string, string | null>) => navigate(withParams(route, changes));
  const services = [...new Set(model.findings.map((f) => f.repository))].sort();
  const owners = [...new Set(model.findings.map((f) => f.owner))].filter((o) => o !== 'unassigned').sort();
  const active = route.params.get('ticket');

  const sortBy = (c: Column) => {
    const dir = filters.sort === c && filters.dir === 'asc' ? 'desc' : 'asc';
    set({ sort: c === DEFAULT_FILTERS.sort && dir === 'asc' ? null : c, dir: dir === 'asc' ? null : dir });
  };

  const select = (key: string, label: string, options: [string, string][]) => (
    <label className="filter">
      <span>{label}</span>
      <select value={route.params.get(key) ?? ''} onChange={(e) => set({ [key]: e.target.value || null })}>
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className="stack">
      <h1 className="page-title">Findings</h1>
      <div className="filters" role="search" aria-label="Filter findings">
        <label className="filter filter-search">
          <span>Search</span>
          <input type="search" value={filters.q} placeholder="Ticket, title, CWE, advisory, PR…" onChange={(e) => set({ q: e.target.value || null })} />
        </label>
        {select('severity', 'Severity', [['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']])}
        {select('status', 'Status', [['open', 'Open'], ['fix-in-review', 'Fix in review'], ['fix-blocked', 'Fix blocked'], ['fix-merged', 'Fix merged']])}
        {select('kind', 'Kind', [['code', 'Code'], ['intake', 'Untriaged intake'], ['dependency', 'Dependency']])}
        {select('service', 'Service', services.map((s) => [s, s]))}
        {select('owner', 'Owner', [['unassigned', 'Unassigned'], ...owners.map((o): [string, string] => [o, o])])}
        <label className="filter-check"><input type="checkbox" checked={filters.overdue} onChange={(e) => set({ overdue: e.target.checked ? '1' : null })} /> Overdue only</label>
        <label className="filter-check"><input type="checkbox" checked={filters.untriaged} onChange={(e) => set({ untriaged: e.target.checked ? '1' : null })} /> Untriaged only</label>
        <button type="button" className="btn" onClick={() => navigate(withParams(route, Object.fromEntries([...route.params.keys()].filter((k) => k !== 'ticket').map((k) => [k, null]))))}>Clear</button>
      </div>
      <div className="muted" aria-live="polite">{rows.length} of {model.findings.length} findings</div>
      <div className="table-wrap">
        <table className="table" data-testid="findings-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const sorted = filters.sort === c;
                return (
                  <th key={c} scope="col" aria-sort={sorted ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="th-sort" onClick={() => sortBy(c)}>
                      {HEADERS[c]}
                      <span className="sort-ind" aria-hidden="true">{sorted ? (filters.dir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const linked = model.prs.filter((p) => f.remediation_pr_numbers.includes(p.number));
              return (
                <tr key={f.ticket} data-testid={`finding-row-${f.ticket}`} className={active === f.ticket ? 'row-active' : undefined}>
                  <td>
                    <button type="button" className="link-button mono" onClick={() => openTicket(f.ticket)} aria-label={`Open ${f.ticket} details`}>{f.ticket}</button>
                  </td>
                  <td className="cell-title">{f.title}</td>
                  <td>{f.kind === 'intake' ? <Lozenge tone="moved">Untriaged intake</Lozenge> : KIND_LABEL[f.kind]}</td>
                  <td><SeverityBadge severity={f.severity} /></td>
                  <td><StatusLozenge status={f.status} /></td>
                  <td className="mono small">{f.repository}</td>
                  <td>{f.owner_assigned ? f.owner : <Lozenge tone="removed">Unassigned</Lozenge>}</td>
                  <td className="mono small">{f.cwe.join(', ')}</td>
                  <td className="nowrap"><SlaCell finding={f} now={model.now} /></td>
                  <td className="small">{f.root_cause_group === 'intake-unclassified' ? <span className="muted">intake-unclassified (not a root cause)</span> : <span className="mono">{f.root_cause_group}</span>}</td>
                  <td className="nowrap">{linked.length ? linked.map((p) => <div key={p.number}><PrInline pr={p} /></div>) : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={COLUMNS.length} className="muted">No findings match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
