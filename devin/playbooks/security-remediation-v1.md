# Playbook: Connected-cloud finding → verified PR (draft for Devin configuration)
**Trigger:** Assigned LAB finding with approved repository and permitted nonproduction scope.

1. **Intake** — Establish ticket, owning team, affected service, security boundary, severity, due date, advisory provenance, and whether it's actually reproducible. Do not treat synthetic severity as official CVSS.
2. **Baseline** — Run tests in the correct language, record exact failures and functional baseline. No editing before baseline.
3. **Investigate** — Trace data/control flow and group findings only when code evidence establishes a common root cause; identify behavior that must be preserved.
4. **Approval gate** — Present minimal fix and test plan. Escalate unknown ownership, missing evidence, safety-critical scope, privileged production actions, or possible breaking behavior.
5. **Implement** — Smallest safe scoped change with regression tests; do not disable checks.
6. **Validate** — Rerun baseline/added tests and any applicable scanner/advisory checks; record limitations. Tests passing do not alone prove secure production deployment.
7. **Review** — Produce an unmerged PR including issue IDs, code diff, reproduction, test commands/results, security boundaries, residual risks, and owner signoff needs.
8. **Measure** — Capture start/finish, human review time, accepted fixes, escaped regressions; avoid claiming ROI from synthetic data.

**Definition of done:** Relevant tests pass, finding evidence addressed, legitimate behavior retained, reviewer assigned, PR unmerged, audit trail complete. If conditions fail, report blocked, not resolved.
