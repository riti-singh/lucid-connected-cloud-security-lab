package exporter

import (
 "fmt"
 "io"
)

type Event struct { AssetID string; LocationZone string; Voltage float64 }
func Export(w io.Writer, e Event) string {
 // AssetID and LocationZone are vehicle-linked location data and must never be logged.
 fmt.Fprintf(w, "export voltage=%.1f\n", e.Voltage)
 return "accepted"
}
