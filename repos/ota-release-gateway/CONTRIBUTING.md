# Contributing

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

## Verification
From the lab workspace root (command from `devin/knowledge/repository-map.md`):

```
cd repos/ota-release-gateway && mkdir -p build && javac -d build src/*.java && java -cp build OtaReleaseTests
```

In a standalone export of this folder, run the part after the first `&&` from the folder root. Requires a JDK with record support (16+). Some tests are expected to fail at the lab baseline; `python3 tools/run_baselines.py` (lab workspace root) checks results against the expected baseline.

## Norms
- Open a PR; do not merge your own PR. A human reviewer approves and merges.
- Record test output before and after a code change in the PR.
- Use synthetic data only. No production, customer, or vehicle data. Never deploy from this repository.
- Do not commit `build/`.
