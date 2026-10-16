package exporter

import (
 "fmt"
 "io"
)

type Event struct { AssetID string; LocationZone string; Voltage float64 }
func Export(w io.Writer, e Event) string {
 // Vulnerable baseline: raw vehicle-linked identifiers in diagnostic logs.
 fmt.Fprintf(w, "export asset=%s zone=%s voltage=%.1f\n", e.AssetID, e.LocationZone, e.Voltage)
 return "accepted"
}
