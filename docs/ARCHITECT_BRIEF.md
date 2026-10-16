# Chief Architect technical discussion
The demo is tied to four cloud trust boundaries relevant to a connected-vehicle platform:

1. **Diagnostics/support data isolation**: document path resolution, symlink escape prevention, access scopes; production questions: object-store keys, service identities, signed URLs, audit logs.
2. **Charging sessions**: account authorization must be enforced server-side even when a record ID is known; production questions: service authn/authz, tenant tagging, caches, downstream queries.
3. **OTA release approval**: only authorized release managers can approve a staged release; production questions: separation of duties, immutable evidence, rollback, HIL/vehicle gating, change approvals. Prototype has NO device control.
4. **Telemetry**: vehicle-associated location identifiers should not be sprayed into logs; production questions: redaction at ingress, retention, incident response, privacy review, observability cardinality. Prototype has NO Kafka ordering/exactly-once test.

For each, describe code-level remediation as necessary but insufficient for production rollout. Important scope boundaries: GitLab/Jira are scenario facts, Kubernetes is a topical deployment context; specific cloud architecture, service contracts, and ownership are UNKNOWN until discovered.
