---
name: advisory-verification
description: Verify a third-party dependency advisory against OSV with tools/fetch_osv.py and record reproducible evidence; never assign CVEs to synthetic LAB-* code findings.
---
# Advisory verification
1. Confirm a real manifest pins the package and version (`requirements.txt`, `package.json`, `pom.xml`, `go.mod`).
2. Query OSV:
   ```bash
   python3 tools/fetch_osv.py --package <Ecosystem>:<name> --version <v>
   python3 tools/fetch_osv.py --id <OSV-or-GHSA-ID>
   ```
   Gotcha: the script always writes `data/advisories/osv-response.json` (fixed path). Copy each result into `data/osv/` (`<ecosystem>-<pkg>-<version>.query.json` or `<ID>.json`) before the next call; keep `retrieved_utc`.
3. Check the record's `affected[].ranges`/`versions` actually include the pinned version, and record the fixed version from the record.
4. Record ID, aliases (CVE as reported by OSV), CWE, fixed version, evidence path, and timestamp in `data/advisory_candidates.json`.
5. LAB-* tickets are synthetic code-level CWE findings: their `advisory_id` stays null. Only dependency tickets may reference advisory IDs, and only IDs that have a file in `data/osv/`.
