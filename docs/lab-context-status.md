# Lab context status (final report)

Synthetic / fictional lab. LAB-* and DEP-* tickets are not real Lucid findings. Status as of main `73b87ee` (2026-10-16).

## Pull requests

| PR | Scope | State |
|---|---|---|
| [#2](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/2) | Policy corpus: secure-coding, vulnerability SLA, PR/approval policies | merged |
| [#3](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/3) | Service architecture/API/CONTRIBUTING docs; root `.github/CODEOWNERS` | merged |
| [#4](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/4) | Pinned vulnerable dependency manifests, OSV evidence, executable PyYAML scenario, README | merged |
| [#5](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/5) | Repo skills under `.agents/skills/` | merged |
| [#6](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/6) | LAB-501..504 intake tickets with evidence | merged |
| [#10](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/10) | `run_baselines.py` toolchain ERRORs and `--fixed <lang>`; `lab-validation` GitHub Actions workflow | merged |
| [#11](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/11) | DEP-* dependency tickets; audit scopes advisory IDs by ticket prefix | merged |
| [#1](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/1) | LAB-201 fix (TypeScript tenant scoping) | open, human review |
| [#7](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/7) | LAB-301 fix (Java release-manager check) | open, human review |
| [#8](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/8) | LAB-401 fix (Go log redaction) | open, blocked on owner assignment |
| [#9](https://github.com/riti-singh/lucid-connected-cloud-security-lab/pull/9) | LAB-101/102/103 fix (Python path containment, one root cause) | open, human review |

## Validation on main `73b87ee`

```
$ python3 tools/run_baselines.py; echo "exit=$?"
Python: FAIL; expected FAIL; MATCH
TypeScript compile: PASS; expected PASS; MATCH
TypeScript tests: FAIL; expected FAIL; MATCH
Java compile: PASS; expected PASS; MATCH
Java tests: FAIL; expected FAIL; MATCH
Go: FAIL; expected FAIL; MATCH
PASS all expected outcomes; baseline weaknesses remain
exit=0
$ python3 tools/audit_findings.py; echo "exit=$?"
PASS schema/provenance audit: 14 synthetic findings (10 LAB-*, 4 DEP-*), 4 represented languages, no advisory IDs on LAB-* findings, 4 DEP-* advisory IDs matched to data/osv records, 4 LAB-5xx tickets with evidence directories
exit=0
$ python3 tools/triage.py; echo "exit=$?"
14 synthetic findings across 4 repositories / 8 candidate root causes
...
exit=0
```

Remediation PRs, checked against main's runner (each PR's service directory applied onto main):

| Check | Exit |
|---|---|
| PR #1 `--fixed typescript` | 0 |
| PR #7 `--fixed java` | 0 |
| PR #8 `--fixed go` | 0 |
| PR #9 `--fixed python` | 0 |
| All four together, `--expect-fixed` (6/6 `PASS; expected PASS; MATCH`, "PASS all remediations verified") | 0 |

Negative audit checks (on #11's head): a LAB-* ticket with an advisory ID exits 1; a DEP-* ID without a `data/osv/` record exits 1. With PATH stripped of node, `run_baselines.py` prints `ERROR ... required toolchain not found on PATH: tsc` and exits 2 instead of a false MATCH.

`lab-validation` workflow: success on #10's pull_request run and on the push to main.

## Pinned advisories (OSV, `data/osv/`)

| Service | Pin | Advisory | Retrieved (UTC) | Ticket |
|---|---|---|---|---|
| diagnostics-document-api | PyYAML 5.3.1 | GHSA-8q59-q68h-6hv4 / PYSEC-2021-142 | 2026-10-16T16:26:38Z | DEP-101 |
| charging-session-api | express 4.18.2 | GHSA-rv95-896h-c2vc | 2026-10-16T16:26:39Z | DEP-201 |
| charging-session-api | express 4.18.2 | GHSA-qw6h-vgh9-j6wx | 2026-10-16T16:26:39Z | DEP-202 |
| ota-release-gateway | snakeyaml 1.33 | GHSA-mjmj-j48q-9wg2 | 2026-10-16T16:26:39Z | DEP-301 |

Only PyYAML is installed and exercised (`bundle_manifest.py`, `tools/verify_dependency_scenario.py`): pip-audit 2.10.1 reports the advisory at 5.3.1 and none at 5.4, and the scenario tests pass on both. The code uses `yaml.safe_load`, not the `full_load` path the advisory describes, so DEP-101 is version exposure, not a demonstrated exploit. express and snakeyaml are manifest pins matched to OSV only; they are not installed, scanned, or assessed for reachability.

## Findings status

| Tickets | Status |
|---|---|
| LAB-101/102/103 | Fixed in PR #9 (one shared root cause); awaiting review |
| LAB-201 | Fixed in PR #1; awaiting review |
| LAB-301 | Fixed in PR #7; awaiting review |
| LAB-401 | Fixed in PR #8; escalated: telemetry-exporter owner is `unassigned`, so a human must assign an owner and reviewer before merge |
| LAB-501..504 | Intake tickets for triage practice (duplicate, false positive, needs-reproduction, severity conflict). Triaged by the enrichment session; the classifications are deliberately not committed. `root_cause_group` stays `intake-unclassified` |
| DEP-101, DEP-201, DEP-202, DEP-301 | Open dependency-hygiene tickets; no upgrade PRs opened |

SLA note: LAB-201 and LAB-301 (critical, reported 2026-10-01) were due 2026-10-08. LAB-101..103 and LAB-401 (high) were due 2026-10-15. All are past due on the synthetic calendar.

## Reusable Devin capabilities and evidence of use

| Capability | Where | Evidence of use |
|---|---|---|
| Skills: `security-validation`, `lab-baseline-verification`, `finding-triage`, `advisory-verification`, `remediation-evidence` | `.agents/skills/` (repo, auto-discovered) | `skill_activated` events: LAB-101..103, LAB-301 and LAB-401 sessions, 4 skills each; enrichment session 3; dependency-ticket session 3 (including `advisory-verification`); CI session 1 |
| Playbook: Lab security remediation | Devin org playbook | Attached (`playbook_id`) to all three remediation sessions; their PRs follow its evidence format |
| Playbook: Lab multi-session coordination | Devin org playbook | Used by the coordinating session; updated with the skill-mount retry and answer-key rules found during this work |
| Knowledge: `lab-tooling-gotchas`, `lab-baseline-interpretation`, `lab-ownership-and-provenance`, `lab-remediation-evidence` | Personal plugin rules (owner's sessions only) | Active; they load only in sessions started after they were saved, so these sessions do not show their use |

`devin/skills/`, `devin/knowledge/` and `devin/playbooks/` are not loaded automatically. Sessions read them as files when the prompt or a skill points to them.

## Unresolved risks and gaps

- telemetry-exporter has no owner. PR #8 cannot merge until a human assigns one. Whether voltage counts as sensitive is still open.
- After any remediation PR merges, push-to-main CI runs in baseline mode and reports MISMATCH for that language. `expected_outcomes` must be updated in the same change, or the workflow taught which languages are fixed.
- PRs #1 and #7–#9 were opened before the workflow existed. CI runs on them only after a new push or reopen.
- PR #9 edits `documents.py` at the service root because diagnostics-document-api has no `src/`. TOCTOU and hard-link cases are out of scope.
- express and snakeyaml exposure is manifest-only. Dependency checks used OSV queries on the direct packages only; transitive dependencies were not checked.
- DEP-* `cwe` is a list (OSV `cwe_ids`) while LAB-* `cwe` is a string. DEP-* `reported_at` is the OSV retrieval date.

## Recommended future work (not started)

- Upgrade PRs for DEP-* tickets (PyYAML 5.4 is already demonstrated).
- Teach the workflow which languages are fixed on main.
- Make express or snakeyaml executable with scanner evidence, as was done for PyYAML.
- Add `actionlint` to the environment blueprint.
