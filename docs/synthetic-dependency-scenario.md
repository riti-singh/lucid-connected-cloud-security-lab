# Synthetic dependency scenario

All services, data, and findings in this lab are synthetic and fictional. This is not Lucid code or data.

## What is pinned

Three services carry a minimal dependency manifest that deliberately pins a real package at a version that OSV reports as vulnerable:

| Repository | Manifest | Pin | OSV advisories (CVE alias) | Fixed version per OSV |
|---|---|---|---|---|
| diagnostics-document-api | `repos/diagnostics-document-api/requirements.txt` | PyPI `PyYAML==5.3.1` | GHSA-8q59-q68h-6hv4 / PYSEC-2021-142 (CVE-2020-14343) | 5.4 |
| charging-session-api | `repos/charging-session-api/package.json` | npm `express@4.18.2` | GHSA-rv95-896h-c2vc (CVE-2024-29041), GHSA-qw6h-vgh9-j6wx (CVE-2024-43796) | 4.19.2, 4.20.0 |
| ota-release-gateway | `repos/ota-release-gateway/pom.xml` | Maven `org.yaml:snakeyaml:1.33` | GHSA-mjmj-j48q-9wg2 (CVE-2022-1471) | 2.0 |

`data/advisory_candidates.json` is the structured record (CWE IDs, summaries, evidence paths, `retrieved_utc`).

## Scope and limits

- The pins are deliberate and synthetic. The lab never installs, resolves, imports, or executes these packages. No source file references them, and `tools/run_baselines.py` does not read the manifests (`tsc`, `javac`, and `unittest` run as before).
- `package.json` has no `type` field and no scripts, so it does not change TypeScript compile or Node runtime behavior. No lockfile or `node_modules/` is committed.
- These dependency advisories are separate from and unrelated to the LAB-* code findings. Their CWEs were chosen not to overlap the code findings. No CVE is assigned to any LAB-* finding.
- Only the direct package was queried. Transitive dependencies were not evaluated.
- The evidence is a point-in-time snapshot. OSV can add or amend records later.
- `repos/telemetry-exporter/go.mod` was intentionally left without dependencies. Adding `require` lines without a matching `go.sum` would break `go test`, which would make the Go baseline fail for the wrong reason.

## Evidence files

`data/osv/` holds raw `tools/fetch_osv.py` output, including its `retrieved_utc` field:

- `<ecosystem>-<package>-<version>.query.json`: the package/version query (`/v1/query`). For Maven, `:` in the coordinate is written as `-`.
- `<ADVISORY_ID>.json`: the full advisory record (`/v1/vulns/<id>`).

## Re-fetching evidence

This requires network access. `tools/fetch_osv.py` always writes to `data/advisories/osv-response.json`, so copy the output after each run. Do not commit `data/advisories/`.

```sh
python3 tools/fetch_osv.py --package PyPI:PyYAML --version 5.3.1
cp data/advisories/osv-response.json data/osv/pypi-PyYAML-5.3.1.query.json
python3 tools/fetch_osv.py --id GHSA-8q59-q68h-6hv4
cp data/advisories/osv-response.json data/osv/GHSA-8q59-q68h-6hv4.json
```

Repeat the same steps for `npm:express` 4.18.2, `Maven:org.yaml:snakeyaml` 1.33, and the other advisory IDs. After re-fetching, check that each record's `affected` ranges still include the pinned version, then update `fixed_version` and `retrieved_utc` in `data/advisory_candidates.json`.
