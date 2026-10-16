# Secure Coding Policy (fictional organization)
Synthetic connected-cloud exercise only. This is a fictional policy; no real Lucid policy is asserted. Requirements apply to every service written in the named language, not to any single repository.

## Python services: document and file handling
- Any filesystem path that is influenced by a caller (request parameter, header, stored metadata) must stay within an approved root directory.
- Containment must hold after path normalization and resolution. This covers parent-directory segments, absolute paths, and symbolic or other links that resolve outside the root.
- Requests that would resolve outside the approved root are rejected, not silently rewritten.

## TypeScript services: tenant isolation
- Every data access performed on behalf of a caller must verify that the caller's tenant/account owns the requested record.
- Ownership checks apply to reads as well as writes, including list, lookup-by-ID, and export paths.
- A valid identifier for a record is not proof of ownership.

## Java services: role-based access control
- Privileged and state-changing actions require an explicit role check for the acting principal before the action takes effect.
- Apply least privilege: grant the minimum role needed, and default to deny when a role is missing or unrecognized.
- Approval of an OTA release is an authorization decision on the release record only; it never implies access to vehicles.

## Go services: log redaction
- Logs must not contain vehicle-linked identifiers or location fields (for example, coordinates or other location metadata).
- This applies to all log levels and to structured and unstructured log output.
- Operational context needed for debugging must be logged without those fields.

## Cross-cutting requirements
- Security behavior is covered by automated tests; a security fix ships with a regression test.
- Never disable, skip, or weaken a security check or its test to make a build pass.
- Use synthetic or nonproduction data only. No production customer or vehicle data in code, tests, fixtures, or logs.

Related: [Vulnerability SLA policy](vulnerability-sla-policy.md), [PR and approval policy](pr-and-approval-policy.md).
