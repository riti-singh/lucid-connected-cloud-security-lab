# Contributing

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

## Verification
From the lab workspace root (command from `devin/knowledge/repository-map.md`):

```
cd repos/telemetry-exporter && go test ./... -v
```

In a standalone export of this folder, run `go test ./... -v` from the folder root. Requires Go 1.22+. Some tests are expected to fail at the lab baseline; `python3 tools/run_baselines.py` (lab workspace root) checks results against the expected baseline.

## Ownership
Owner is unassigned (see `CODEOWNERS`). Escalate to a human for an owner before requesting review.

## Norms
- Open a PR; do not merge your own PR. A human reviewer approves and merges.
- Record test output before and after a code change in the PR.
- Use synthetic data only. No production, customer, or vehicle data. Never deploy from this repository.
