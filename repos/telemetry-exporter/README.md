# Telemetry Exporter (Go)
Synthetic vehicle-to-cloud batch exporter. Operational logs must not expose VIN-linked location identifiers. Starter logs an unredacted VIN-like synthetic identifier and zone. `go test ./... -v`. No Kafka connection or exact-once guarantee is implemented.
