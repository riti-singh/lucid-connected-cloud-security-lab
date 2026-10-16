from pathlib import Path

def read_diagnostic_document(storage_root: str, document_name: str) -> str:
    """Read one authorized diagnostic artifact (intentionally insecure baseline)."""
    candidate = Path(storage_root) / document_name
    return candidate.read_text(encoding="utf-8")
