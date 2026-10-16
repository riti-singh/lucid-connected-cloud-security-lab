"""Synthetic dependency-scenario tests; run via tools/verify_dependency_scenario.py (not part of the baseline)."""
import unittest
from bundle_manifest import ManifestError, parse_bundle_manifest

VALID = """
bundle_id: synthetic-bundle-0001
collector_version: 2.4.0
artifact_count: 3
labels: [synthetic, fictional]
"""


class BundleManifestTests(unittest.TestCase):
    def test_parses_valid_manifest(self):
        data = parse_bundle_manifest(VALID)
        self.assertEqual(data["bundle_id"], "synthetic-bundle-0001")
        self.assertEqual(data["artifact_count"], 3)
        self.assertEqual(data["labels"], ["synthetic", "fictional"])

    def test_rejects_non_mapping(self):
        with self.assertRaises(ManifestError):
            parse_bundle_manifest("- just\n- a list\n")

    def test_rejects_missing_fields(self):
        with self.assertRaises(ManifestError):
            parse_bundle_manifest("bundle_id: synthetic-bundle-0002\n")

    def test_rejects_invalid_artifact_count(self):
        with self.assertRaises(ManifestError):
            parse_bundle_manifest(VALID.replace("artifact_count: 3", "artifact_count: many"))

    def test_rejects_malformed_yaml(self):
        with self.assertRaises(ManifestError):
            parse_bundle_manifest("bundle_id: [unterminated\n")

    def test_rejects_unknown_tag(self):
        with self.assertRaises(ManifestError):
            parse_bundle_manifest("bundle_id: !lab-custom-tag synthetic\n")


if __name__ == "__main__":
    unittest.main()
