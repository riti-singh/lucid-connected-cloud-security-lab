import os
import tempfile
import unittest
from pathlib import Path
from documents import read_diagnostic_document

class PathContainmentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.allowed = self.base / "diagnostics"
        (self.allowed / "vehicle-a").mkdir(parents=True)
        (self.allowed / "bundle.txt").write_text("synthetic diagnostic bundle")
        (self.allowed / "vehicle-a" / "nested.txt").write_text("synthetic nested bundle")

    def test_nested_document_allowed(self):
        self.assertEqual(read_diagnostic_document(str(self.allowed), "vehicle-a/nested.txt"), "synthetic nested bundle")

    def test_parent_segment_resolving_inside_root_allowed(self):
        self.assertEqual(read_diagnostic_document(str(self.allowed), "vehicle-a/../bundle.txt"), "synthetic diagnostic bundle")

    def test_symlink_inside_root_allowed(self):
        (self.allowed / "alias.txt").symlink_to(self.allowed / "vehicle-a" / "nested.txt")
        self.assertEqual(read_diagnostic_document(str(self.allowed), "alias.txt"), "synthetic nested bundle")

    def test_symlinked_storage_root_allowed(self):
        root_link = self.base / "root-link"
        root_link.symlink_to(self.allowed, target_is_directory=True)
        self.assertEqual(read_diagnostic_document(str(root_link), "bundle.txt"), "synthetic diagnostic bundle")

    def test_reject_sibling_directory_with_shared_prefix(self):
        sibling = self.base / "diagnostics-other"
        sibling.mkdir()
        (sibling / "bundle.txt").write_text("synthetic other bundle")
        with self.assertRaises(ValueError):
            read_diagnostic_document(str(self.allowed), "../diagnostics-other/bundle.txt")

    def test_reject_symlinked_directory_escape(self):
        outside = self.base / "outside"
        outside.mkdir()
        (outside / "secret.txt").write_text("synthetic restricted data")
        (self.allowed / "dir-link").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            read_diagnostic_document(str(self.allowed), "dir-link/secret.txt")

    def test_missing_document_raises_file_not_found(self):
        with self.assertRaises(FileNotFoundError):
            read_diagnostic_document(str(self.allowed), "missing.txt")

if __name__ == "__main__": unittest.main()
