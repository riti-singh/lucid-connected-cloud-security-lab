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

- The pins are deliberate and synthetic. `tools/run_baselines.py` never installs these packages or reads the manifests (`tsc`, `javac`, and `unittest discover -s tests` run as before, with or without PyYAML installed).
- Only the PyYAML pin is exercised (see below). The express and snakeyaml pins are manifest-only: no source file imports them, and nothing installs or resolves them.
- `package.json` has no `type` field and no scripts, so it does not change TypeScript compile or Node runtime behavior. No lockfile or `node_modules/` is committed.
- These dependency advisories are separate from and unrelated to the LAB-* code findings. Their CWEs were chosen not to overlap the code findings. No CVE is assigned to any LAB-* finding.
- Only the direct package was queried. Transitive dependencies were not evaluated.
- The evidence is a point-in-time snapshot. OSV can add or amend records later.
- `repos/telemetry-exporter/go.mod` was intentionally left without dependencies. Adding `require` lines without a matching `go.sum` would break `go test`, which would make the Go baseline fail for the wrong reason.

## Executable scenario: PyYAML in diagnostics-document-api

- `repos/diagnostics-document-api/bundle_manifest.py` parses a synthetic diagnostic bundle manifest with `yaml.safe_load`. The baseline tests do not import it.
- `repos/diagnostics-document-api/dependency_tests/` holds the scenario tests. The baseline only discovers `tests/`, so these never run there.
- `repos/diagnostics-document-api/requirements-upgrade.txt` pins `PyYAML==5.4`, the OSV fixed version. `requirements.txt` keeps the vulnerable pin as lab state. The upgrade is only demonstrated, not applied.

`tools/verify_dependency_scenario.py` needs network access and Python 3.10+ with `venv`. It:

1. Creates a scanner venv in a temp dir with `pip==25.2` and `pip-audit==2.10.1`.
2. Before: installs `requirements.txt` into a separate `--without-pip` venv. It then runs `pip-audit --path <site-packages> --vulnerability-service osv` and expects every advisory ID recorded for this pin in `data/advisory_candidates.json` to appear. Finally it runs `python -m unittest discover -s dependency_tests -v` and expects it to pass.
3. After: repeats step 2 with `requirements-upgrade.txt`. It expects none of those advisory IDs, and the tests must still pass. It also checks that the upgrade pin equals the OSV `fixed_version`.
4. Writes evidence to `data/evidence/dependency-scenario/`, replacing any previous run:
   - `summary.json`: checks, scanner version, UTC timestamps, and result.
   - `commands.json`: exact commands, environment overrides, exit codes, timestamps, and output. Temp paths are shown as `$WORKDIR` and repo paths as `$REPO`.
   - `scanner-freeze.txt`.
   - `before/` and `after/`: raw `pip-audit.json`, `pip-freeze.txt`, and `tests.txt` for each phase.
5. Deletes the temp dir (`--keep-workdir` keeps it) and exits non-zero if any check fails.

Nothing is installed globally or into the repo.

### Build constraint

PyYAML 5.4 is the exact OSV fixed version. It has no prebuilt wheel for Python 3.10, and its sdist fails to build with Cython 3. The script therefore sets `PIP_CONSTRAINT` to a temp file containing `Cython<3` for both installs. That constraint affects only the build of the throwaway venv. It does not change the pinned versions or anything outside the temp dir.

### Reachability

The scan is version-based: pip-audit matches the installed PyYAML version against OSV. GHSA-8q59-q68h-6hv4 / PYSEC-2021-142 is reported because 5.3.1 falls inside the affected range. According to the OSV text, the flaw is reached through `full_load` / `FullLoader`. `bundle_manifest.py` uses `yaml.safe_load`, which is not that loader. This is a dependency-hygiene finding (a vulnerable version is pinned), not a demonstrated exploitable path. The lab contains no exploit code.

```sh
python3 tools/verify_dependency_scenario.py ; echo "exit=$?"
python3 tools/run_baselines.py ; echo "exit=$?"   # unaffected
```

## Evidence files

`data/osv/` holds the raw `tools/fetch_osv.py` output, including its `retrieved_utc` field:

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
