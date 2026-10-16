# PR and Approval Policy (fictional organization)
Synthetic connected-cloud exercise only. This is a fictional policy; no real Lucid policy is asserted. The step-by-step workflow is defined in [`devin/playbooks/security-remediation-v1.md`](../playbooks/security-remediation-v1.md); this policy states the requirements a PR must meet and defers to the playbook for the process.

## Merge and deploy
- Remediation PRs are opened unmerged. No auto-merge and no deploy by an agent.
- All work is nonproduction. Privileged production actions are out of scope and require escalation.

## Required signoffs
- Service owner: the `owner` team listed for the repository in `data/inventory.json`.
- Security reviewer.
- If the owner is unknown or `unassigned`, escalate before requesting merge; do not substitute another team's signoff.

## Evidence trail
A PR must record evidence for each playbook step:
1. **Intake**: ticket IDs, owning team, affected service, security boundary, severity, due date (see [Vulnerability SLA policy](vulnerability-sla-policy.md)), advisory provenance, and reproducibility.
2. **Baseline**: exact test commands and output recorded before any edit.
3. **Investigate**: data/control-flow findings, the code evidence for any root-cause grouping, and behavior that must be preserved.
4. **Approval gate**: the proposed minimal change and test plan, plus any escalations raised.
5. **Implement**: a scoped diff with regression tests; no disabled or weakened checks (see [Secure coding policy](secure-coding-policy.md)).
6. **Validate**: rerun commands and exact output, applicable scanner/advisory checks, and stated limitations. Passing tests do not alone prove a secure production deployment.
7. **Review**: issue IDs, diff, reproduction, test results, security boundaries, residual risks, and required signoffs.
8. **Measure**: start/finish time and human review time; no ROI claims from synthetic data.

## Definition of done
As defined in the playbook: relevant tests pass, finding evidence addressed, legitimate behavior retained, reviewer assigned, PR unmerged, audit trail complete. If any condition is not met, report the work as blocked, not resolved.
