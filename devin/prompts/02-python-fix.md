# First remediation PR
Fix the Python diagnostics-document-api findings LAB-101/102/103. Work only in that service and supporting evidence docs.
- Record baseline failures first.
- Implement safe containment against parent traversals, absolute path escapes, and symlinks resolving outside the root; explicitly decide behavior for valid nested files.
- Preserve legitimate document reads and create regression tests.
- Do not weaken or delete tests, merge, deploy, or access external credentials.
- Run the service tests and audit command. Document exact commands, results, and any gaps in reports/first-remediation.md.
- Make a PR/commit with linked LAB IDs and reviewer checklist.
