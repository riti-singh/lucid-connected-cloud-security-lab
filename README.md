# Connected Cloud Security Remediation Lab — fictional Lucid customer exercise

**Not affiliated with Lucid Motors. No private Lucid code, vehicle records, VINs, or security findings.**

A four-repository, runnable engineering demo scoped to the **software supply chain and vulnerability remediation** scenario in Cognition's onsite guide. Java, TypeScript, Python, and Go are all represented. Service names and use cases are fictional but intentionally topical to a connected-vehicle/cloud architect.

## Why this exists
The interview scenario describes ~2,000 GitLab repositories, a Jira findings queue, weak test coverage, duplicate issues, unknown owners, and pressure to prove **safe remediation**, not just closure counts. Here we use **four separately runnable services** and an auditable synthetic backlog, not 2,000 fabricated repositories.

| Service / language | Hypothetical cloud responsibility | Deliberately introduced weakness | Validation |
|---|---|---|---|
| diagnostics-document-api / Python | Support download of diagnostic artifacts | Path traversal / absolute paths (CWE-22) | Python unittest |
| charging-session-api / TypeScript | Charging sessions tenant isolation | Cross-tenant read due to missing authorization (CWE-639) | tsc + node:test |
| ota-release-gateway / Java | Approve OTA staged release actions | Role check absent on deployment approval (CWE-862) | javac + Java test main |
| telemetry-exporter / Go | Export scoped telemetry batches | Logs unredacted location-linked identifiers (CWE-532) | go test |

**Every weakness is intentionally synthetic.** CWE describes a class of weaknesses, not a verified CVE. Vulnerability IDs `LAB-*` are invented scenario tickets. Do not describe them as Lucid issues, public advisories, or proven exploitable production flaws.

## 5-minute verification
From the project root:

```bash
python3 tools/run_baselines.py
python3 tools/audit_findings.py
python3 tools/triage.py
```

The initial security tests are designed to FAIL while functional tests PASS. The test runner exits zero when it confirms that expected baseline state, and prints a per-service summary. If local Java, Go, Node, or tsc is missing, install it rather than claiming a complete baseline.

## Devin workflow
1. Create four Git repos from `repos/*` if you want authentic cross-repo PRs; or use this monorepo first for fastest Devin setup. Instructions in `docs/GIT_SETUP.md`.
2. Use `devin/prompts/01-discovery.md`: no edits, inspect queue and root causes.
3. Use `devin/prompts/02-python-fix.md` for a first bounded PR.
4. Generalize using `devin/playbooks/security-remediation-v1.md` and `devin/skills/security-validation/SKILL.md`; replay on a second language.
5. Run `python3 tools/run_baselines.py --expect-fixed` when ALL four fixes have landed. This mode fails if tests fail.

## Data provenance
- `data/findings.json`: entirely synthetic Jira-like tickets, never real Lucid vulnerabilities.
- `data/inventory.json`: fictional ownership and criticality metadata.
- `data/source_manifest.json`: exact category/sourcing assumptions.
- `data/advisory_candidates.json`: deliberately vulnerable, synthetic third-party dependency pins backed by OSV records in `data/osv/`: PyYAML 5.3.1 in diagnostics-document-api (GHSA-8q59-q68h-6hv4 / PYSEC-2021-142, CVE-2020-14343), express 4.18.2 in charging-session-api (GHSA-rv95-896h-c2vc, GHSA-qw6h-vgh9-j6wx), and snakeyaml 1.33 in ota-release-gateway (GHSA-mjmj-j48q-9wg2). They are unrelated to the LAB-* code findings, which carry no CVEs. See `docs/synthetic-dependency-scenario.md`.
- `tools/fetch_osv.py`: fetches a current public OSV advisory by explicit advisory ID or queries a package/version, stores source JSON locally for a reproducible evidence trail. Requires network access and deliberate selection.
- `tools/verify_dependency_scenario.py`: installs the PyYAML pin and then its OSV fixed version into throwaway venvs, scans each with pinned pip-audit, runs `repos/diagnostics-document-api/dependency_tests/`, and writes evidence to `data/evidence/dependency-scenario/`. Requires network access.

## Safety and engineering scope
All fixtures are synthetic. No network server is started by the test commands. No vehicle control/ECU/production OTA systems are involved. There is no deployed cloud stack. Security tests are defensive and local. Do not auto-merge PRs. A passing unit test suite is not proof of production safety.

## Source references
- Cognition onsite candidate scenario (provided by interviewer): GitLab, Jira, languages, repository-scale challenge.
- OSV format and API: https://ossf.github.io/osv-schema/ , https://google.github.io/osv.dev/api/
- CISA KEV catalog: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- Lucid public disclosures and careers should inform conversation but are NOT evidence that these sample services exist.
