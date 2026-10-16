# Contributing

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

## Verification
From the lab workspace root (command from `devin/knowledge/repository-map.md`):

```
cd repos/charging-session-api && tsc -p tsconfig.json && node dist/charging.test.js
```

In a standalone export of this folder, run the part after the first `&&` from the folder root. Requires `tsc` and Node.js. Confirm the compile step succeeds and `dist/` exists before reading test results. Some tests are expected to fail at the lab baseline; `python3 tools/run_baselines.py` (lab workspace root) checks results against the expected baseline.

## Ownership
Synthetic owning team: `connected-cloud` (`data/inventory.json`). Review routing is defined in the monorepo root `.github/CODEOWNERS`.

## Norms
- Open a PR; do not merge your own PR. A human reviewer approves and merges.
- Record test output before and after a code change in the PR.
- Use synthetic data only. No production, customer, or vehicle data. Never deploy from this repository.
- Do not commit `dist/`.
