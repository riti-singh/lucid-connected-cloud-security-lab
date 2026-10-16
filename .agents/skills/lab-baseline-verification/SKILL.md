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
- `TypeScript tests: ... MATCH` is meaningless unless `TypeScript compile: PASS` printed first and `repos/charging-session-api/dist/` exists; a missing `tsc` makes node fail and still reports MATCH.
- On a remediation branch, fixing a language makes that language print `MISMATCH` and exit 1 in baseline mode. That is expected; report it explicitly with the job output. `--expect-fixed` only passes when all four languages are fixed.
- In charging-session-api, PASS lines go to stdout and FAIL lines to stderr, so output order may differ from source order.
- Toolchain: python3, tsc 5.x, node, javac/java, go >= 1.22. If one is missing, install it rather than reporting a baseline.
- Remove generated `build/` and `dist/` before committing (gitignored).
- Report exact command output, not paraphrase.
