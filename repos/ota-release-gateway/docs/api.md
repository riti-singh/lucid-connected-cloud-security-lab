# OTA Release Gateway: interface

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

Java class `src/OtaReleaseService.java` (no HTTP layer is implemented).

## Types
```java
record Operator(String id, String role)
record Release(String id, String stage, boolean approved)
```

## `Release approve(Operator actor, Release release)`

| Input | Type | Description |
| --- | --- | --- |
| `actor` | `Operator` | Operator requesting the approval. |
| `release` | `Release` | Staged release metadata to approve. |

**Returns:** a new `Release` with the same `id` and `stage` and `approved == true`. The input record is not modified.

**Contract:** only release managers may approve. Approval does not grant vehicle access.
