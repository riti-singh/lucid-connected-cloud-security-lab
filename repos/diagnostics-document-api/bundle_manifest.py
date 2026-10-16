"""Synthetic/fictional: parse a diagnostic bundle manifest (YAML metadata) with PyYAML's safe loader."""
import yaml

REQUIRED_FIELDS = ("bundle_id", "collector_version", "artifact_count")


class ManifestError(ValueError):
    pass


def parse_bundle_manifest(text: str) -> dict:
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ManifestError(f"invalid manifest YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise ManifestError("manifest must be a mapping")
    missing = [field for field in REQUIRED_FIELDS if field not in data]
    if missing:
        raise ManifestError(f"missing fields: {', '.join(missing)}")
    count = data["artifact_count"]
    if isinstance(count, bool) or not isinstance(count, int) or count < 0:
        raise ManifestError("artifact_count must be a non-negative integer")
    return data
