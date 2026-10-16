---
name: finding-triage
description: Classify LAB-* tickets in data/findings.json (true positive, duplicate, false positive, needs reproduction, severity conflict, unowned) using code evidence, not ticket labels.
---
# Finding triage
Inputs: `data/findings.json`, `data/inventory.json`, `data/evidence/<ticket>/` (if present), the service code and tests, and the policies in `devin/knowledge/` (secure-coding, vulnerability-sla, pr-and-approval).

For each ticket:
1. Read the evidence artifact and the ticket, then read the code path it names. Do not trust `root_cause_group`, `severity`, or `verification_status` on their own; confirm against code and tests.
2. Classify with a cited code location and command output:
   - reproduced: an existing test fails for the stated reason;
   - duplicate: same root cause as another ticket, proven by the same code location/data flow (not by similar titles);
   - false positive: the code does not behave as the evidence claims (show the code and a command that demonstrates it);
   - needs reproduction: plausible but no failing test; propose a test, do not write a fix first;
   - severity conflict: apply `devin/knowledge/vulnerability-sla-policy.md` and record both assessments.
3. Owner: from `data/inventory.json`; `unassigned` means escalate, do not invent an owner.
4. SLA: compute due date from `reported_at` per the SLA policy.
5. Output a table: ticket | classification | evidence (file:line, command) | owner | due date | next action. Do not edit findings.json during triage unless explicitly asked.
`python3 tools/triage.py` only groups by the `root_cause_group` field; it is a starting point, not a classification.
