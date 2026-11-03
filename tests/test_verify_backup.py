"""Offline tests of the pre-encryption backup integrity checker."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from subprocess import CompletedProcess

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "verify_backup.py"
spec = importlib.util.spec_from_file_location("verify_backup", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class VerifyBackupTests(unittest.TestCase):
    def setup_data(self, root, content=b"tiny-image"):
        base = Path(root)
        (base / "database.dump").write_bytes(b"PGDMPmock")
        (base / "schema-migrations").mkdir()
        (base / "schema-migrations" / "0001.sql").write_text("-- schema")
        (base / "media" / "folder").mkdir(parents=True)
        (base / "media" / "folder" / "image.png").write_bytes(content)
        entry = {
            "path": "folder/image.png",
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        (base / "media-manifest.json").write_text(json.dumps([entry]))
        return base

    def test_complete_archive(self):
        with tempfile.TemporaryDirectory() as d:
            root = self.setup_data(d)
            with patch.object(mod.subprocess, "run", return_value=CompletedProcess([],0,"fake pg_restore listing","")):
                self.assertEqual(mod.check_archive_tree(root), (1, 10))

    def test_tampered_file_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = self.setup_data(d)
            (root / "media/folder/image.png").write_bytes(b"wrong file")
            with patch.object(mod.subprocess, "run", return_value=CompletedProcess([],0,"fake pg_restore listing","")):
                with self.assertRaisesRegex(ValueError, "Media byte count mismatch"):
                    mod.check_archive_tree(root)

    def test_undeclared_file_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = self.setup_data(d)
            (root / "media/extra.png").write_bytes(b"hidden")
            with patch.object(mod.subprocess, "run", return_value=CompletedProcess([],0,"fake pg_restore listing","")):
                with self.assertRaisesRegex(ValueError, "does not describe all"):
                    mod.check_archive_tree(root)

    def test_duplicate_manifest_path_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = self.setup_data(d)
            manifest_path = root / "media-manifest.json"
            entries = json.loads(manifest_path.read_text())
            manifest_path.write_text(json.dumps(entries + entries))
            with patch.object(mod.subprocess, "run", return_value=CompletedProcess([],0,"fake pg_restore listing","")):
                with self.assertRaisesRegex(ValueError, "duplicate"):
                    mod.check_archive_tree(root)

if __name__ == "__main__":
    unittest.main()
