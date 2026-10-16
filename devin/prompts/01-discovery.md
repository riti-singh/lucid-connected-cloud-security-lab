# Investigation-only Devin session
You are working in an **entirely synthetic** automotive connected-cloud security exercise. No real Lucid source code or private data. Do not modify files yet.

1. Read README.md, data/findings.json, data/inventory.json and data/source_manifest.json.
2. Run tools/audit_findings.py and tools/run_baselines.py. Note baseline tests that intentionally fail.
3. Examine each of four language services and tie each LAB finding to code and an exact test.
4. Propose whether LAB-101/102/103 share a root cause. Do not merely trust the grouping field.
5. Identify threats and operational consequences important to a connected vehicle/cloud architect: tenant isolation, privileged OTA approval, diagnostic file access, sensitive event logging.
6. Identify which repo to remediate first and justify against severity, evidence, scope, and blast radius.
7. Present a testable scoped plan for approval. Do not claim safety-critical vehicle-control behavior or actual Lucid integration.
