# Charging Session API: architecture

> **Synthetic / fictional.** This describes a fictional connected-vehicle cloud lab service. It is not real Lucid code, data, or policy.

## Purpose
Service-to-service query that returns a charging session record by ID. Nonproduction only. Data is an in-memory synthetic list.

## Trust boundary
- Callers are other internal services (hypothetical). Each caller carries an account scope (`Caller.accountId`), established upstream by the caller's authenticated service identity.
- `sessionId` is request input supplied by the caller.
- Each charging session belongs to exactly one account (`Session.accountId`). Account data is a tenant boundary.

## Data flow
1. A calling service sends its account scope and a session ID.
2. The service looks up the session in its store.
3. The service returns the session record or no result.

## Auth model
Tenant isolation and least privilege: a caller must not read another account's records.

## Downstream consumers (hypothetical)
- Fleet account portals and billing services that display or aggregate charging sessions for a single account.

## Data classification
Synthetic charging/customer account data, including `locationZone` (`data/inventory.json`). Owner: `connected-cloud`.
