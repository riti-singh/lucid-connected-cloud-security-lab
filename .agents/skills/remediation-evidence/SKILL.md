---
name: remediation-evidence
description: Assemble the evidence trail for an unmerged remediation PR in this lab (before/after per-test table, transcripts, scope check, signoffs).
---
# Remediation evidence
Required in every remediation PR body (owner preference, verified in PR #1):
1. Ticket IDs, CWE, service, owner (from `data/inventory.json`; `unassigned` → state that an escalation is required), severity, due date.
2. Baseline transcript captured BEFORE any edit (exact command + output).
3. Per-test before/after table: test | before | after | expected.
4. Full after-change transcripts: the language suite and `python3 tools/run_baselines.py` (note that the fixed language now prints MISMATCH in baseline mode, by design), `audit_findings.py`, `triage.py`.
5. Scope check: `git diff --name-only origin/main` lists only the service's source and test files.
6. Legitimate behavior retained (name the functional test that still passes).
7. Residual risks and limits (unit tests are not proof of production safety).
8. Signoffs needed: service owner + security reviewer per `devin/knowledge/pr-and-approval-policy.md`. Never merge; `requires_human_approval` is true for all LAB-* tickets.
