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

## Frontend

React 19 + TypeScript + Vite 7 static app. Node 22, npm, `package-lock.json` committed.

```bash
cd dashboard
python3 build_data.py --no-github   # writes public/data.json (gitignored); needs requirements.txt
npm ci
npm run dev        # http://localhost:5173
npm run typecheck
npm test           # vitest: pure modules in src/lib plus banner logic
npm run build      # typecheck + vite build -> dist/ (includes dist/data.json copied from public/)
npm run preview -- --base /lucid-connected-cloud-security-lab/
```

- `base: './'` and `fetch('./data.json')`, so the build works under any sub-path. Views use hash routes (`#/findings?severity=high&ticket=LAB-101`); filter, sort, and the open detail panel are stored in the hash.
- Views: Overview, Findings (+ detail drawer), Remediations, Relationships (hand-written SVG), Services, Baselines & audits, Activity.
- Refresh re-fetches `./data.json?t=<now>` with `cache: 'no-store'`, then queries the public GitHub API without auth: `/rate_limit`, `/pulls?state=all&per_page=100` (with `If-None-Match`), check runs for open PR heads, and the latest `lab-validation.yml` run on main. If the remaining quota drops below 5, or a request returns 403/429, it stops making live calls and shows the rate-limit banner. Network errors also leave the build-time data in place.
- Live PR state is merged over the baked state by PR number (`src/lib/merge.ts`). PRs missing from the live response are kept, and `merged` is never reverted to `open`. Observed snapshots and transitions persist in localStorage (`lab-dashboard:v1:observed`) and appear in Activity. Each PR is labeled `build-time`, `live`, or `cached`.
- SLA (`src/lib/sla.ts`) is computed in the browser from `reported_at` (critical 7, high 14, medium 30, low 90 days). `fix-merged` counts as met.
- Stable `data-testid` hooks: `refresh-button`, `data-generated-at`, `live-refreshed-at`, `github-status-banner`, `findings-table`, `finding-row-<TICKET>`, `finding-detail`, `pr-card-<N>`, `pr-state-<N>`, `pr-review-state-<N>`, `open-remediations`, `historical-remediations`, `relationship-graph`, `nav-<view>`.
