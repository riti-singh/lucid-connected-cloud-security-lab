# Telemetry Exporter: interface

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

Go package `exporter` (`export.go`, module `example.com/connected-cloud/telemetry-exporter`).

## Types
```go
type Event struct { AssetID string; LocationZone string; Voltage float64 }
```

## `func Export(w io.Writer, e Event) string`

| Input | Type | Description |
| --- | --- | --- |
| `w` | `io.Writer` | Destination for operational log output. |
| `e` | `Event` | Telemetry event to export. |

**Returns:** `"accepted"`.

**Contract:**
- Output written to `w` is operational logging and must not expose vehicle-linked identifiers or location fields.
- Log output must not contain the event's `AssetID` or `LocationZone` values.
