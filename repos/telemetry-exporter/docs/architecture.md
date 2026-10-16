# Telemetry Exporter: architecture

> **Synthetic / fictional.** This describes a fictional connected-vehicle cloud lab service. It is not real Lucid code, data, or policy.

## Purpose
Vehicle-to-cloud batch exporter that accepts telemetry events and writes operational log output. Nonproduction only. No Kafka connection or exactly-once guarantee is implemented.

## Trust boundary
- Events (`AssetID`, `LocationZone`, `Voltage`) arrive from a hypothetical vehicle-to-cloud ingestion path.
- `AssetID` is a VIN-like synthetic identifier. `AssetID` and `LocationZone` together are vehicle-linked location data.
- Operational logs leave the service boundary: they are read by operators and log tooling that are not authorized for vehicle-linked location data.

## Data flow
1. An event is passed to the exporter.
2. The exporter writes an operational log line to the supplied writer.
3. The exporter returns an acceptance status.

## Auth model
No caller authentication is in scope; the exporter is invoked in-process. Logging contract: operational logs must not expose vehicle-linked identifiers or location fields.

## Downstream consumers (hypothetical)
- Log aggregation and operator dashboards.
- A future telemetry sink (not implemented).

## Data classification
Synthetic asset-location metadata (`data/inventory.json`). Owner: unassigned; see the root `.github/CODEOWNERS`.
