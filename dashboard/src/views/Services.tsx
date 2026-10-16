import { useApp } from '../context';
import { buildHash } from '../lib/hash';
import { Ext, Lozenge } from '../components/ui';
import type { Severity } from '../types/data';

const SEVS: Severity[] = ['critical', 'high', 'medium', 'low'];

export function Services() {
  const { model } = useApp();
  const { data, findings } = model;
  return (
    <div className="stack">
      <h1 className="page-title">Services</h1>
      <div className="table-wrap">
        <table className="table" data-testid="services-table">
          <thead>
            <tr>
              <th scope="col">Service</th><th scope="col">Owner</th><th scope="col">Criticality</th><th scope="col">Language</th>
              <th scope="col">Data classification</th><th scope="col">Deployment</th>
              {SEVS.map((s) => <th key={s} scope="col" className="num">{s}</th>)}
              <th scope="col" className="num">Open</th><th scope="col" className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.services.map((s) => {
              const fs = findings.filter((f) => f.repository === s.repo);
              return (
                <tr key={s.repo} data-testid={`service-row-${s.repo}`}>
                  <td><Ext href={s.source_url}><span className="mono">{s.repo}</span></Ext></td>
                  <td>{s.owner_assigned ? s.owner : <><Lozenge tone="removed" bold>Unassigned</Lozenge> <span className="danger-text small">escalation</span></>}</td>
                  <td>{s.criticality}</td>
                  <td>{s.language}</td>
                  <td className="small">{s.data_classification}</td>
                  <td className="small muted">{s.deployment}</td>
                  {SEVS.map((sev) => <td key={sev} className="num">{fs.filter((f) => f.severity === sev).length || ''}</td>)}
                  <td className="num">{fs.filter((f) => f.status !== 'fix-merged').length}</td>
                  <td className="num"><a href={buildHash('findings', { service: s.repo })}>{fs.length}</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
