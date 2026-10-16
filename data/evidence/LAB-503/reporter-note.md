# Reporter note (synthetic)

> Synthetic lab evidence. Fictional on-call engineer and worker; not a real Lucid finding.

- Reporter: on-call engineer for the hypothetical export pipeline, filed on 2026-10-12.
- Symptom: the export worker exited twice with a runtime panic during log sink rotation, and a batch was re-queued (see `crash-log.txt`).
- Reporter's assessment: availability impact only; `medium`. No data exposure observed.
- The crash was not reproduced on demand. The worker source shown in the trace is not in this lab. No test in `repos/telemetry-exporter` was run against this scenario.
- Ownership: the service has no owning team in the inventory.
