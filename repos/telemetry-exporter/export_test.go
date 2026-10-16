package exporter
import (
 "bytes"
 "strings"
 "testing"
)
func TestValidExport(t *testing.T) {
 var b bytes.Buffer
 if Export(&b, Event{AssetID:"SYNTH-VIN-0001",LocationZone:"zone-east",Voltage:391.2}) != "accepted" { t.Fatal("should accept") }
}
func TestLogsExcludeSensitiveData(t *testing.T) {
 var b bytes.Buffer
 Export(&b, Event{AssetID:"SYNTH-VIN-0001",LocationZone:"zone-east",Voltage:391.2})
 if strings.Contains(b.String(), "SYNTH-VIN-0001") || strings.Contains(b.String(), "zone-east") { t.Fatal("log exposes linked asset/location values") }
}
