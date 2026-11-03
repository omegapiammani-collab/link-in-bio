"""Offline regression tests for encrypted backup's Storage traversal.

Uses only mocked HTTP and disposable temp directories. No live credentials.
"""
import io
import json
import os
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class BackupStorageTests(unittest.TestCase):
    def test_nested_folders_and_files(self):
        png = b"phase1-test-image"
        images = {
            "https://example.invalid/storage/v1/object/authenticated/link-in-bio-media/root.png": b"root",
            "https://example.invalid/storage/v1/object/authenticated/link-in-bio-media/folder/nested.png": png,
        }

        def fake_urlopen(req, timeout=0):
            url = req.full_url
            if "/object/list/" in url:
                query = json.loads(req.data)
                self.assertEqual(query["offset"], 0)
                if query["prefix"] == "":
                    return io.BytesIO(json.dumps([
                        {"name": "folder", "id": None},
                        {"name": "root.png", "id": "file-1"},
                    ]).encode())
                if query["prefix"] == "folder/":
                    return io.BytesIO(json.dumps([
                        {"name": "nested.png", "id": "file-2"},
                    ]).encode())
                self.fail("Unexpected Storage prefix")
            return io.BytesIO(images[url])

        with tempfile.TemporaryDirectory() as directory:
            env = {
                "SUPABASE_URL": "https://example.invalid",
                "SUPABASE_SERVICE_ROLE_KEY": "fake-test-only",
                "BACKUP_MEDIA_DIR": str(Path(directory) / "media"),
                "BACKUP_MANIFEST_PATH": str(Path(directory) / "manifest.json"),
            }
            with patch.dict(os.environ, env), patch(
                "urllib.request.urlopen", side_effect=fake_urlopen
            ):
                runpy.run_path(
                    str(Path(__file__).parents[1] / "scripts" / "backup_storage.py"),
                    run_name="__main__",
                )
            actual = json.loads((Path(directory) / "manifest.json").read_text())
            self.assertEqual(len(actual), 2)
            self.assertEqual({f["path"] for f in actual}, {
                "root.png", "folder/nested.png"
            })
            self.assertEqual(
                (Path(directory) / "media/folder/nested.png").read_bytes(), png
            )

    def test_rejects_path_traversal(self):
        def fake_urlopen(req, timeout=0):
            return io.BytesIO(json.dumps([{
                "name": "../escaped.png", "id": "bad"
            }]).encode())

        with tempfile.TemporaryDirectory() as directory:
            env = {
                "SUPABASE_URL": "https://example.invalid",
                "SUPABASE_SERVICE_ROLE_KEY": "fake-test-only",
                "BACKUP_MEDIA_DIR": str(Path(directory) / "media"),
                "BACKUP_MANIFEST_PATH": str(Path(directory) / "manifest.json"),
            }
            with patch.dict(os.environ, env), patch(
                "urllib.request.urlopen", side_effect=fake_urlopen
            ):
                with self.assertRaisesRegex(RuntimeError, "Unsafe Storage"):
                    runpy.run_path(
                        str(Path(__file__).parents[1] / "scripts" / "backup_storage.py"),
                        run_name="__main__",
                    )


if __name__ == "__main__":
    unittest.main()
