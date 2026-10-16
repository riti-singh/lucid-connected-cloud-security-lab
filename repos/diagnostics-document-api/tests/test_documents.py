import tempfile
import unittest
from pathlib import Path
from documents import read_diagnostic_document

class DiagnosticDocumentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.allowed = root / "diagnostics"
        self.allowed.mkdir()
        (self.allowed / "bundle.txt").write_text("synthetic diagnostic bundle")
        (root / "restricted.txt").write_text("synthetic restricted data")
        self.restricted = root / "restricted.txt"

    def test_valid_document(self):
        self.assertEqual(read_diagnostic_document(str(self.allowed), "bundle.txt"), "synthetic diagnostic bundle")

    def test_reject_parent_traversal(self):
        with self.assertRaises(ValueError):
            read_diagnostic_document(str(self.allowed), "../restricted.txt")

    def test_reject_absolute_path(self):
        with self.assertRaises(ValueError):
            read_diagnostic_document(str(self.allowed), str(self.restricted))

    def test_reject_symlink_escape(self):
        (self.allowed / "link.txt").symlink_to(self.restricted)
        with self.assertRaises(ValueError):
            read_diagnostic_document(str(self.allowed), "link.txt")

if __name__ == "__main__": unittest.main()
