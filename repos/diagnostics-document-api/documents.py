from pathlib import Path

def read_diagnostic_document(storage_root: str, document_name: str) -> str:
    """Read one diagnostic artifact that resolves inside the approved root."""
    root = Path(storage_root).resolve()
    candidate = (root / document_name).resolve()
    if not candidate.is_relative_to(root):
        raise ValueError("document resolves outside the approved diagnostic root")
    return candidate.read_text(encoding="utf-8")
