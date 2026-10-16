# Security-operations dashboard (synthetic lab)

Static React + TypeScript + Vite app deployed to GitHub Pages. All data is synthetic; LAB-* and DEP-* tickets are not real Lucid findings.

## Data contract

`dashboard/public/data.json` is the only input the app reads. Its shape is defined by
`dashboard/schema/data.schema.json` (JSON Schema 2020-12) and mirrored in `dashboard/src/types/data.ts`.
Change all three together (schema, types, `build_data.py`) and bump `schema_version` on breaking changes.

Inputs merged by `dashboard/build_data.py`:

| Input | Used for |
|---|---|
| `data/findings.json` | findings (`cwe` normalized to a list) |
| `data/inventory.json` | services, owners, `owner_assigned` |
| `data/osv/*.json` | advisories (records with a top-level `response.id`; `*.query.json` are query transcripts) |
| `data/evidence/` | evidence bundles with text previews |
| `data/remediations.json` | PR/remediation history, validation evidence, sessions, escalations (migrated from `docs/lab-context-status.md`) |
| `tools/run_baselines.py` output, else `baseline-results.txt` | baselines |
| `tools/audit_findings.py`, `tools/triage.py` output | audits, root-cause groups (verbatim triage lines) |
| GitHub REST API (`GITHUB_TOKEN` optional) | live PR state, head, reviewers, check runs; latest `lab-validation` run on main |

Invariants enforced by `dashboard/validate_data.py` (in addition to the schema):

- `intake-unclassified` findings (LAB-501..504) are `triage_state: untriaged`, and their group is `untriaged-intake` with `verified: false`. No verified group contains an intake finding.
- LAB-* findings have `advisory_id: null` and no aliases; every DEP-* `advisory_id` is present in `advisories`.
- A remediation linked to a finding whose owner is unassigned is `review_state: blocked-owner-assignment` while open (PR #8 / telemetry-exporter).
- Effective PR `state` comes from GitHub when enrichment succeeded, else `recorded_state`.
