import type { DashboardData, Finding, Remediation } from '../types/data';

const REPO = 'https://github.com/riti-singh/lucid-connected-cloud-security-lab';

function finding(over: Partial<Finding> & Pick<Finding, 'ticket'>): Finding {
  return {
    kind: 'code',
    repository: 'diagnostics-document-api',
    language: 'Python',
    cwe: ['CWE-22'],
    title: `Synthetic finding ${over.ticket}`,
    severity: 'high',
    owner: 'support-cloud',
    owner_assigned: true,
    sla_days: 14,
    reported_at: '2026-10-01',
    due_at: '2026-10-15',
    source: 'synthetic-static-review',
    verification_status: 'reproduced_by_expected_failing_test',
    verification_notes: null,
    test_name: null,
    root_cause_group: 'shared-root-path-validation',
    triage_state: 'triaged',
    advisory_id: null,
    aliases: [],
    evidence: [],
    remediation_pr_numbers: [],
    status: 'open',
    blocked_reason: null,
    synthetic: true,
    actual_lucid_finding: false,
    requires_human_approval: true,
    ...over,
  };
}

function pr(over: Partial<Remediation> & Pick<Remediation, 'number' | 'title'>): Remediation {
  return {
    category: 'remediation',
    url: `${REPO}/pull/${over.number}`,
    tickets: [],
    root_cause_group: null,
    service: null,
    fixed_language: null,
    state: 'open',
    state_source: 'recorded',
    recorded_state: 'open',
    review_state: 'human-review',
    blocked_reason: null,
    created_at: '2026-10-16T16:00:00Z',
    merged_at: null,
    session_id: null,
    session_url: null,
    depends_on: [],
    validation: null,
    summary: '',
    github: null,
    ...over,
  };
}

export const BLOCKED_REASON =
  "telemetry-exporter owner is 'unassigned' in data/inventory.json; a human must assign an owner and reviewer before merge.";

export const fixtureFindings: Finding[] = [
  finding({ ticket: 'LAB-101', title: 'Path traversal via parent segment', remediation_pr_numbers: [9], status: 'fix-in-review' }),
  finding({ ticket: 'LAB-102', title: 'Absolute path bypasses document root', remediation_pr_numbers: [9], status: 'fix-in-review' }),
  finding({
    ticket: 'LAB-201', title: 'Charging session visible cross-tenant', repository: 'charging-session-api', language: 'TypeScript',
    cwe: ['CWE-639'], severity: 'critical', owner: 'connected-cloud', sla_days: 7, due_at: '2026-10-08',
    root_cause_group: 'tenant-authorization', remediation_pr_numbers: [1], status: 'fix-in-review',
  }),
  finding({
    ticket: 'LAB-401', title: 'Vehicle-linked location metadata in logs', repository: 'telemetry-exporter', language: 'Go',
    cwe: ['CWE-532'], owner: 'unassigned', owner_assigned: false, root_cause_group: 'telemetry-log-redaction',
    remediation_pr_numbers: [8], status: 'fix-blocked', blocked_reason: BLOCKED_REASON,
  }),
  finding({
    ticket: 'LAB-503', kind: 'intake', title: 'Export worker restarts with runtime panic during log sink rotation',
    repository: 'telemetry-exporter', language: 'Go', cwe: ['CWE-476'], severity: 'medium', owner: 'unassigned', owner_assigned: false,
    sla_days: 30, reported_at: '2026-10-12', due_at: '2026-11-11', source: 'synthetic-intake-queue',
    verification_status: 'not_reproduced_no_failing_test', root_cause_group: 'intake-unclassified', triage_state: 'untriaged',
    evidence: [{ path: 'data/evidence/LAB-503/', url: `${REPO}/tree/main/data/evidence/LAB-503`, bundle_id: 'LAB-503' }],
  }),
  finding({
    ticket: 'DEP-101', kind: 'dependency', title: 'Improper Input Validation in PyYAML', cwe: ['CWE-20'], severity: 'critical',
    sla_days: 7, reported_at: '2026-10-16', due_at: '2026-10-23', source: 'synthetic-dependency-pin-osv-match',
    verification_status: 'scanner_confirmed_version_match_reachability_not_demonstrated', root_cause_group: 'dependency-pyyaml',
    advisory_id: 'GHSA-8q59-q68h-6hv4', aliases: ['CVE-2020-14343', 'PYSEC-2021-142'], package: 'PyYAML', pinned_version: '5.3.1', fixed_version: '5.4',
  }),
];

export const fixtureRemediations: Remediation[] = [
  pr({ number: 1, title: 'LAB-201: enforce tenant scoping', tickets: ['LAB-201'], root_cause_group: 'tenant-authorization', service: 'charging-session-api', fixed_language: 'typescript',
    validation: { validated_head: 'bf08dc1', runner_args: '--fixed typescript', ci_workflow: 'lab-validation', ci_conclusion: 'success', ci_run_url: `${REPO}/actions/runs/1`, notes: null } }),
  pr({ number: 4, title: 'Dependency manifests with OSV evidence', category: 'dependency-evidence', tickets: ['DEP-101'], state: 'merged', recorded_state: 'merged', review_state: 'merged', merged_at: '2026-10-16T16:59:42Z' }),
  pr({ number: 8, title: 'LAB-401: redact vehicle-linked fields', tickets: ['LAB-401'], root_cause_group: 'telemetry-log-redaction', service: 'telemetry-exporter', fixed_language: 'go',
    review_state: 'blocked-owner-assignment', blocked_reason: BLOCKED_REASON,
    validation: { validated_head: 'aae7972', runner_args: '--fixed go', ci_workflow: 'lab-validation', ci_conclusion: 'success', ci_run_url: `${REPO}/actions/runs/8`, notes: null } }),
  pr({ number: 9, title: 'LAB-101/102: enforce path containment', tickets: ['LAB-101', 'LAB-102'], root_cause_group: 'shared-root-path-validation', service: 'diagnostics-document-api', fixed_language: 'python' }),
];

export const fixtureData: DashboardData = {
  schema_version: '1.0',
  generated_at: '2026-10-16T18:00:00Z',
  synthetic: true,
  repository: { owner: 'riti-singh', name: 'lucid-connected-cloud-security-lab', url: REPO, default_branch: 'main', commit_sha: 'abc1234' },
  sources: { github: { status: 'skipped', authenticated: false, fetched_at: null, error: null }, baselines: { source: 'baseline-results.txt' }, inputs: [] },
  services: [
    { repo: 'diagnostics-document-api', owner: 'support-cloud', owner_assigned: true, criticality: 'medium', deployment: 'hypothetical', data_classification: 'synthetic diagnostics', language: 'Python', finding_ids: ['LAB-101', 'LAB-102', 'DEP-101'], source_url: `${REPO}/tree/main/repos/diagnostics-document-api` },
    { repo: 'charging-session-api', owner: 'connected-cloud', owner_assigned: true, criticality: 'high', deployment: 'hypothetical', data_classification: 'synthetic charging', language: 'TypeScript', finding_ids: ['LAB-201'], source_url: `${REPO}/tree/main/repos/charging-session-api` },
    { repo: 'telemetry-exporter', owner: 'unassigned', owner_assigned: false, criticality: 'high', deployment: 'hypothetical', data_classification: 'synthetic asset-location metadata', language: 'Go', finding_ids: ['LAB-401', 'LAB-503'], source_url: `${REPO}/tree/main/repos/telemetry-exporter` },
  ],
  findings: fixtureFindings,
  root_cause_groups: [
    { id: 'shared-root-path-validation', classification: 'code-root-cause', verified: true, finding_ids: ['LAB-101', 'LAB-102'], source: 'synthetic-static-review', triage_line: 'shared-root-path-validation: LAB-101, LAB-102', remediation_pr_numbers: [9], advisory_ids: [] },
    { id: 'tenant-authorization', classification: 'code-root-cause', verified: true, finding_ids: ['LAB-201'], source: 'synthetic-static-review', triage_line: 'tenant-authorization: LAB-201', remediation_pr_numbers: [1], advisory_ids: [] },
    { id: 'telemetry-log-redaction', classification: 'code-root-cause', verified: true, finding_ids: ['LAB-401'], source: 'synthetic-static-review', triage_line: 'telemetry-log-redaction: LAB-401', remediation_pr_numbers: [8], advisory_ids: [] },
    { id: 'intake-unclassified', classification: 'untriaged-intake', verified: false, finding_ids: ['LAB-503'], source: 'synthetic-intake-queue', triage_line: 'intake-unclassified: LAB-503', remediation_pr_numbers: [], advisory_ids: [] },
    { id: 'dependency-pyyaml', classification: 'dependency-advisory', verified: false, finding_ids: ['DEP-101'], source: 'synthetic-dependency-pin-osv-match', triage_line: 'dependency-pyyaml: DEP-101', remediation_pr_numbers: [], advisory_ids: ['GHSA-8q59-q68h-6hv4'] },
  ],
  advisories: [
    { id: 'GHSA-8q59-q68h-6hv4', aliases: ['CVE-2020-14343', 'PYSEC-2021-142'], summary: 'Improper Input Validation in PyYAML', details: '', severity: 'CRITICAL', cwe_ids: ['CWE-20'], published: '2021-03-25T21:26:26Z', modified: null, retrieved_utc: '2026-10-16T16:40:00Z', ecosystem: 'PyPI', package: 'pyyaml', fixed_version: '5.4', references: [], finding_ids: ['DEP-101'], osv_path: 'data/osv/GHSA-8q59-q68h-6hv4.json', osv_url: 'https://osv.dev/vulnerability/GHSA-8q59-q68h-6hv4' },
  ],
  remediations: fixtureRemediations,
  demonstrated_remediations: [
    { id: 'DEMO-DEP-101-PYYAML-5.4', tickets: ['DEP-101'], kind: 'dependency-upgrade-scenario', status: 'demonstrated-not-merged', summary: 'pip-audit reports the advisory at 5.3.1 and none at 5.4.', reachability: 'bundle_manifest.py uses yaml.safe_load, not full_load.', evidence: [{ path: 'data/evidence/dependency-scenario/summary.json', url: `${REPO}/blob/main/data/evidence/dependency-scenario/summary.json`, bundle_id: 'dependency-scenario' }], pr_numbers: [4] },
  ],
  combined_validations: [{ id: 'all-fix-prs-expect-fixed', pr_numbers: [1, 7, 8, 9], command: 'python3 tools/run_baselines.py --expect-fixed', result: '6/6 MATCH (exit 0)' }],
  escalations: [{ id: 'telemetry-exporter-owner', service: 'telemetry-exporter', tickets: ['LAB-401', 'LAB-503'], pr_numbers: [8], reason: 'telemetry-exporter has no owner.' }],
  sessions: [{ id: 's8', url: 'https://app.devin.ai/sessions/s8', role: 'LAB-401 remediation', pr_numbers: [8] }],
  evidence_bundles: [
    { id: 'LAB-503', kind: 'intake-evidence', path: 'data/evidence/LAB-503/', tickets: ['LAB-503'], files: [
      { path: 'data/evidence/LAB-503/crash-log.txt', url: `${REPO}/blob/main/data/evidence/LAB-503/crash-log.txt`, size_bytes: 20, media_type: 'text/plain', preview: 'synthetic crash log', truncated: false },
    ] },
  ],
  baselines: {
    source: 'baseline-results.txt', command: 'python3 tools/run_baselines.py', exit_code: 0, captured_at: null,
    jobs: [
      { name: 'Python', language: 'python', result: 'FAIL', expected: 'FAIL', match: true },
      { name: 'Go', language: 'go', result: 'FAIL', expected: 'FAIL', match: true },
    ],
    summary_line: 'PASS all expected outcomes; baseline weaknesses remain', raw: 'Python: FAIL; expected FAIL; MATCH\nGo: FAIL; expected FAIL; MATCH\n',
  },
  audits: {
    audit_findings: { command: 'python3 tools/audit_findings.py', exit_code: 0, stdout: 'PASS schema/provenance audit', passed: true },
    triage: { command: 'python3 tools/triage.py', exit_code: 0, stdout: 'intake-unclassified: LAB-503', passed: true },
  },
  ci: { lab_validation_main: null },
  history: [{ at: '2026-10-16T16:59:42Z', type: 'pr-merged', summary: 'PR #4 merged', ref: '#4', url: `${REPO}/pull/4` }],
};
