# Diagnostics Document API: interface

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

Python module `documents.py` (no HTTP layer is implemented).

## `read_diagnostic_document(storage_root: str, document_name: str) -> str`

| Input | Type | Description |
| --- | --- | --- |
| `storage_root` | `str` | Approved diagnostic root directory (service configuration). |
| `document_name` | `str` | Name of the requested document, supplied by the caller. |

**Returns:** the document contents as a `str`, decoded as UTF-8.

**Contract:**
- Only files under the approved diagnostic root may be read.
- If the document cannot be read, an exception is raised; no partial content is returned.
