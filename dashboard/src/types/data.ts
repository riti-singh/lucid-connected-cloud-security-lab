// Mirrors dashboard/schema/data.schema.json (schema_version 1.0). Keep in sync.

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Language = 'Python' | 'TypeScript' | 'Java' | 'Go';
export type FixedLanguage = 'python' | 'typescript' | 'java' | 'go';

export interface Repository {
  owner: string;
  name: string;
  url: string;
  default_branch: string;
  commit_sha: string | null;
  pages_url?: string | null;
}

export interface Sources {
  github: {
    status: 'ok' | 'partial' | 'unavailable' | 'skipped';
    authenticated: boolean;
    fetched_at: string | null;
    error: string | null;
    rate_limit_remaining?: number | null;
  };
  baselines: { source: 'run_baselines.py' | 'baseline-results.txt'; note?: string | null };
  inputs: string[];
}

export interface Service {
  repo: string;
  owner: string;
  owner_assigned: boolean;
  criticality: string;
  deployment: string;
  data_classification: string;
  language: Language;
  finding_ids: string[];
  source_url: string;
}

export interface EvidenceRef {
  path: string;
  url: string;
  bundle_id?: string | null;
}

export type FindingKind = 'code' | 'intake' | 'dependency';
export type FindingStatus = 'open' | 'fix-in-review' | 'fix-blocked' | 'fix-merged';

export interface Finding {
  ticket: string;
  kind: FindingKind;
  repository: string;
  language: Language;
  cwe: string[];
  title: string;
  severity: Severity;
  owner: string;
  owner_assigned: boolean;
  sla_days: number;
  reported_at: string;
  due_at: string;
  source: string;
  verification_status: string;
  verification_notes?: string | null;
  test_name: string | null;
  root_cause_group: string;
  triage_state: 'triaged' | 'untriaged';
  advisory_id: string | null;
  aliases: string[];
  ecosystem?: string | null;
  package?: string | null;
  pinned_version?: string | null;
  fixed_version?: string | null;
  severity_source?: string | null;
  evidence: EvidenceRef[];
  remediation_pr_numbers: number[];
  status: FindingStatus;
  blocked_reason: string | null;
  synthetic: true;
  actual_lucid_finding: false;
  requires_human_approval: boolean;
}

export interface RootCauseGroup {
  id: string;
  classification: 'code-root-cause' | 'dependency-advisory' | 'untriaged-intake';
  verified: boolean;
  finding_ids: string[];
  source: string;
  triage_line: string;
  remediation_pr_numbers: number[];
  advisory_ids: string[];
}

export interface Advisory {
  id: string;
  aliases: string[];
  summary: string;
  details: string;
  severity: string | null;
  cwe_ids: string[];
  published: string | null;
  modified: string | null;
  retrieved_utc: string;
  ecosystem: string | null;
  package: string | null;
  fixed_version: string | null;
  references: { type: string; url: string }[];
  finding_ids: string[];
  osv_path: string;
  osv_url: string;
}

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
  completed_at?: string | null;
}

export type ChecksConclusion = 'success' | 'failure' | 'pending' | 'none' | 'unknown';

export interface GithubPr {
  state: 'open' | 'closed';
  merged: boolean;
  draft?: boolean;
  merged_at: string | null;
  closed_at: string | null;
  head_sha: string;
  updated_at: string;
  html_url: string;
  requested_reviewers: string[];
  checks: CheckRun[];
  checks_conclusion?: ChecksConclusion;
  fetched_at: string;
}

export type RemediationCategory =
  | 'remediation'
  | 'policy'
  | 'docs'
  | 'dependency-evidence'
  | 'devin-capabilities'
  | 'intake-data'
  | 'ci-validation'
  | 'dependency-tickets'
  | 'report'
  | 'dashboard';

export type PrState = 'open' | 'merged' | 'closed';

export interface RemediationValidation {
  validated_head: string | null;
  runner_args: string | null;
  ci_workflow: string | null;
  ci_conclusion: string | null;
  ci_run_url: string | null;
  notes: string | null;
}

export interface Remediation {
  number: number;
  title: string;
  category: RemediationCategory;
  url: string;
  tickets: string[];
  root_cause_group: string | null;
  service: string | null;
  fixed_language: FixedLanguage | null;
  state: PrState;
  state_source: 'github' | 'recorded';
  recorded_state: PrState;
  review_state: 'human-review' | 'blocked-owner-assignment' | 'merged' | 'closed';
  blocked_reason: string | null;
  created_at: string | null;
  merged_at: string | null;
  session_id: string | null;
  session_url: string | null;
  depends_on: number[];
  validation: RemediationValidation | null;
  summary: string;
  github: GithubPr | null;
}

export interface DemonstratedRemediation {
  id: string;
  tickets: string[];
  kind: string;
  status: string;
  summary: string;
  reachability?: string;
  evidence: EvidenceRef[];
  tool?: string;
  pr_numbers?: number[];
}

export interface Escalation {
  id: string;
  service: string;
  tickets: string[];
  pr_numbers: number[];
  reason: string;
  open_questions?: string[];
}

export interface Session {
  id: string;
  url: string;
  role: string;
  pr_numbers: number[];
}

export interface EvidenceFile {
  path: string;
  url: string;
  size_bytes: number;
  media_type: string;
  preview: string | null;
  truncated: boolean;
}

export interface EvidenceBundle {
  id: string;
  kind: 'intake-evidence' | 'dependency-scenario';
  path: string;
  tickets: string[];
  summary?: Record<string, unknown> | null;
  files: EvidenceFile[];
}

export interface BaselineJob {
  name: string;
  language?: FixedLanguage | null;
  result: 'PASS' | 'FAIL' | 'ERROR';
  expected: 'PASS' | 'FAIL' | null;
  match: boolean;
}

export interface Baselines {
  source: 'run_baselines.py' | 'baseline-results.txt';
  command: string;
  exit_code: number | null;
  jobs: BaselineJob[];
  summary_line: string | null;
  raw: string;
  captured_at: string | null;
}

export interface CommandResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr?: string;
  passed: boolean;
}

export interface WorkflowRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
  event: string;
  created_at: string;
}

export interface HistoryEvent {
  at: string;
  type: 'pr-opened' | 'pr-merged' | 'pr-closed' | 'finding-reported' | 'advisory-retrieved' | 'evidence-captured' | 'ci-run';
  summary: string;
  ref: string | null;
  url?: string | null;
}

export interface DashboardData {
  schema_version: '1.0';
  generated_at: string;
  synthetic: true;
  disclaimer?: string;
  repository: Repository;
  sources: Sources;
  services: Service[];
  findings: Finding[];
  root_cause_groups: RootCauseGroup[];
  advisories: Advisory[];
  remediations: Remediation[];
  demonstrated_remediations: DemonstratedRemediation[];
  combined_validations: Record<string, unknown>[];
  escalations: Escalation[];
  sessions: Session[];
  evidence_bundles: EvidenceBundle[];
  baselines: Baselines;
  audits: { audit_findings: CommandResult; triage: CommandResult };
  ci: { lab_validation_main: WorkflowRun | null; deploy_dashboard_main?: WorkflowRun | null };
  history: HistoryEvent[];
}
