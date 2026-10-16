---
name: security-validation
summary: Defensive validation of code-level remediation in synthetic enterprise repositories.
---
# Security Validation
1. Identify the claimed failure mode and the trust boundary: path, account, role, logging.
2. Record baseline behavior with exact commands; never modify tests to hide a failure.
3. Preserve legitimate behavior while rejecting unauthorized or unsafe behavior.
4. Re-run focused regression tests and relevant complete suite after patching.
5. If the finding alleges a third-party dependency issue, require an actual installed/versioned manifest plus source-recorded OSV advisory before asserting CVE applicability; never guess.
6. Write an evidence table with tests, results, code locations, and unresolved risk.
7. Stop at an unmerged reviewable PR; do not deploy or access real vehicle systems.
