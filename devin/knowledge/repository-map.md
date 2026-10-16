# Repository Knowledge
- Python diagnostic documents: `cd repos/diagnostics-document-api && python3 -m unittest discover -s tests -v`
- TypeScript charging sessions: `cd repos/charging-session-api && tsc -p tsconfig.json && node dist/charging.test.js`
- Java OTA approvals: `cd repos/ota-release-gateway && mkdir -p build && javac -d build src/*.java && java -cp build OtaReleaseTests`
- Go telemetry export: `cd repos/telemetry-exporter && go test ./... -v`
- Cross-repo: `python3 tools/audit_findings.py` and `python3 tools/run_baselines.py` (baseline mode expects failures until fixed; `--expect-fixed` checks all pass).
