package exporter

import (
	"bytes"
	"strings"
	"testing"
)

func TestLogsRedactVehicleLinkedFieldsKeepOperationalContext(t *testing.T) {
	e := Event{AssetID: "SYNTH-VIN-0042", LocationZone: "zone-west-7", Voltage: 402.5}
	var b bytes.Buffer
	if got := Export(&b, e); got != "accepted" {
		t.Fatalf("Export returned %q, want accepted", got)
	}
	out := b.String()
	for _, v := range []string{e.AssetID, e.LocationZone, "asset=", "zone="} {
		if strings.Contains(out, v) {
			t.Fatalf("log %q exposes vehicle-linked field %q", out, v)
		}
	}
	if !strings.Contains(out, "voltage=402.5") {
		t.Fatalf("log %q missing operational voltage context", out)
	}
}
