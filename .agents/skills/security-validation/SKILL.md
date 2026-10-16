---
name: security-validation
description: Defensive validation of a code-level remediation in this synthetic connected-cloud lab (trust boundary, baseline, regression, evidence, unmerged PR).
---
# Security Validation
Canonical copy of `devin/skills/security-validation/SKILL.md`, in a path Devin auto-discovers.
1. Identify the claimed failure mode and the trust boundary: path, account, role, logging.
2. Record baseline behavior with exact commands before editing (use the `lab-baseline-verification` skill); never modify tests to hide a failure.
3. Preserve legitimate behavior while rejecting unauthorized or unsafe behavior.
4. Re-run focused regression tests and the complete language suite after patching.
5. If the finding alleges a third-party dependency issue, require a versioned manifest plus a source-recorded OSV advisory before asserting applicability (use `advisory-verification`); never guess.
6. Write an evidence table with tests, results, code locations, and unresolved risk (use `remediation-evidence`).
7. Stop at an unmerged reviewable PR; do not deploy or access real vehicle systems.
