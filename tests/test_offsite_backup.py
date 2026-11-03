"""Offline tests for the offsite encrypted-archive verification helper.

Uses synthetic data and a disposable passphrase, never GitHub secrets or user backups.
"""
from pathlib import Path
import io
import os
import shutil
import subprocess
import tarfile
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify_offsite_backup.sh"


@unittest.skipUnless(
    all(shutil.which(t) for t in ("bash", "gpg", "tar", "sha256sum")),
    "CLI requirements unavailable",
)
class OffsiteBackupVerifierTests(unittest.TestCase):
    def test_archive_round_trip_and_wrong_passphrase(self):
        with tempfile.TemporaryDirectory(prefix="test-offsite-") as root:
            root = Path(root)
            archive = root / "synthetic.tar.gz"
            with tarfile.open(archive, "w:gz") as out:
                payload = b"synthetic-only\n"
                info = tarfile.TarInfo("synthetic.txt")
                info.size = len(payload)
                out.addfile(info, io.BytesIO(payload))
            encrypted = root / "synthetic.tar.gz.gpg"
            key = "synthetic-disposable-test-password"
            result = subprocess.run(
                [
                    "gpg", "--batch", "--yes", "--pinentry-mode", "loopback",
                    "--symmetric", "--cipher-algo", "AES256",
                    "--passphrase-fd", "0", "--output", str(encrypted),
                    str(archive),
                ],
                input=key + "\n", text=True, capture_output=True,
                timeout=30, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            success = subprocess.run(
                ["bash", str(SCRIPT), str(encrypted)],
                input=key + "\n", text=True, capture_output=True, timeout=30,
                check=False,
            )
            self.assertEqual(success.returncode, 0, success.stderr)
            self.assertIn("PASS:", success.stdout)
            self.assertNotIn(key, success.stdout + success.stderr)
            bad = subprocess.run(
                ["bash", str(SCRIPT), str(encrypted)],
                input="wrong\n", text=True, capture_output=True, timeout=30,
                check=False,
            )
            self.assertNotEqual(bad.returncode, 0)
            self.assertIn("FAIL:", bad.stderr)
            self.assertFalse((root / "synthetic.txt").exists())

    def test_missing_archive_fails_closed(self):
        result = subprocess.run(
            ["bash", str(SCRIPT), "/definitely/missing/backup.gpg"],
            input="test\n", text=True, capture_output=True, timeout=30,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
