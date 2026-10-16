---
name: lab-baseline-verification
description: Run and correctly interpret the lab's multi-language baseline (run_baselines.py, audit_findings.py, triage.py), including known false-MATCH traps.
---
# Lab baseline verification
From the repo root:
```bash
python3 tools/run_baselines.py ; echo "exit=$?"   # baseline mode: security tests must FAIL, compiles PASS
python3 tools/audit_findings.py
python3 tools/triage.py
```
Per-language commands are in `devin/knowledge/repository-map.md`.

Interpretation (verified in prior sessions):
- Baseline on main prints MATCH for 6 jobs and exits 0. That means the intentional weaknesses still exist; it is not a pass of the security tests.
- A missing toolchain (python3, tsc, node, javac, java, go), or a compile step that did not produce `dist/charging.test.js` / `build/OtaReleaseTests.class`, prints `ERROR <job>: ...` for that job and its dependent test job, and the runner exits 2. Any `ERROR` line means the run is not a valid baseline. (Older runners printed a false `TypeScript tests: ... MATCH` when `tsc` was missing.)
- On a remediation branch, fixing a language makes that language print `MISMATCH` and exit 1 in baseline mode. That is expected; report it explicitly with the job output. Assert exactly what the PR fixed with `--fixed <lang>` (repeatable; `python`, `typescript`, `java`, `go`): listed languages must PASS, all others must still FAIL. `--expect-fixed` only passes when all four languages are fixed.
- CI (`.github/workflows/lab-validation.yml`) passes `--fixed <lang>` for each service whose source files (`.py`/`.ts`/`.java`/`.go` under `repos/<service>/`) a PR changes; docs and dependency manifests do not count. Pushes to main run baseline mode.
- In charging-session-api, PASS lines go to stdout and FAIL lines to stderr, so output order may differ from source order.
- Toolchain: python3, tsc 5.x, node, javac/java, go >= 1.22. If one is missing, install it rather than reporting a baseline.
- Remove generated `build/` and `dist/` before committing (gitignored).
- Report exact command output, not paraphrase.
