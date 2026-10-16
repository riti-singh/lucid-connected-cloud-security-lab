import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppContext, type AppContextValue } from './context';
import { parseHash, withParams, type View } from './lib/hash';
import { liveRefreshedLabel, useDashboard } from './useDashboard';
import type { FetchLike } from './lib/github';
import { Lozenge } from './components/ui';
import { fmtDateTime } from './lib/format';
import { DetailPanel } from './views/DetailPanel';
import { Overview } from './views/Overview';
import { Findings } from './views/Findings';
import { Remediations } from './views/Remediations';
import { Relationships } from './views/Relationships';
import { Services } from './views/Services';
import { Baselines } from './views/Baselines';
import { Activity } from './views/Activity';

const NAV: { view: View; label: string }[] = [
  { view: 'overview', label: 'Overview' },
  { view: 'findings', label: 'Findings' },
  { view: 'remediations', label: 'Remediations' },
  { view: 'relationships', label: 'Relationships' },
  { view: 'services', label: 'Services' },
  { view: 'baselines', label: 'Baselines & audits' },
  { view: 'activity', label: 'Activity' },
];

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((h: string) => {
    if (h !== window.location.hash) window.location.hash = h;
    setHash(h);
  }, []);
  return [hash, navigate] as const;
}

export function App({ fetchImpl }: { fetchImpl?: FetchLike }) {
  const state = useDashboard(fetchImpl);
  const [hash, navigate] = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);

  if (state.kind === 'loading') return <div className="boot" role="status">Loading data.json…</div>;
  if (state.kind === 'error')
    return (
      <div className="boot" role="alert">
        Could not load data.json: {state.message}
      </div>
    );

  const { model } = state;
  const ctx: AppContextValue = {
    model,
    route,
    navigate,
    openTicket: (ticket) => navigate(withParams(route, { ticket })),
  };
  const ticket = route.params.get('ticket');
  const label = NAV.find((n) => n.view === route.view)?.label ?? '';

  return (
    <AppContext.Provider value={ctx}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <div className="layout">
        <nav className="sidebar" aria-label="Views">
          <div className="sidebar-title">
            <span className="project-mark" aria-hidden="true">L</span>
            <div>
              <div className="project-name">{model.data.repository.name}</div>
              <div className="project-sub">Security operations</div>
            </div>
          </div>
          <ul>
            {NAV.map((n) => (
              <li key={n.view}>
                <a href={`#/${n.view}`} data-testid={`nav-${n.view}`} aria-current={route.view === n.view ? 'page' : undefined} className={route.view === n.view ? 'active' : undefined}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="main-col">
          <header className="topbar">
            <div className="topbar-left">
              <a className="repo-link" href={model.data.repository.url} target="_blank" rel="noreferrer noopener">
                {model.data.repository.owner}/{model.data.repository.name}
              </a>
              <Lozenge tone="new" bold>Synthetic lab data</Lozenge>
            </div>
            <div className="topbar-right">
              <span className="fresh">
                Built <time data-testid="data-generated-at" dateTime={model.data.generated_at}>{fmtDateTime(model.data.generated_at)}</time>
              </span>
              <span className="fresh">
                Live refresh <span data-testid="live-refreshed-at">{liveRefreshedLabel(model)}</span>
              </span>
              <button type="button" className="btn btn-primary" data-testid="refresh-button" onClick={model.refresh} disabled={model.refreshing} aria-busy={model.refreshing}>
                {model.refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </header>
          {model.banner && (
            <div className={`gh-banner gh-banner-${model.banner.tone}`} role="status" data-testid="github-status-banner">
              {model.banner.text}
            </div>
          )}
          <main id="main" tabIndex={-1} className="content" aria-label={label}>
            {route.view === 'overview' && <Overview />}
            {route.view === 'findings' && <Findings />}
            {route.view === 'remediations' && <Remediations />}
            {route.view === 'relationships' && <Relationships />}
            {route.view === 'services' && <Services />}
            {route.view === 'baselines' && <Baselines />}
            {route.view === 'activity' && <Activity />}
            <footer className="footer">
              {model.data.disclaimer ?? 'All tickets, owners, services, and timestamps are synthetic. They are not real Lucid findings.'}
              {model.data.repository.commit_sha && <> Built from <span className="mono">{model.data.repository.commit_sha.slice(0, 7)}</span>.</>}
            </footer>
          </main>
        </div>
        {ticket && <DetailPanel ticket={ticket} onClose={() => ctx.openTicket(null)} />}
      </div>
    </AppContext.Provider>
  );
}
