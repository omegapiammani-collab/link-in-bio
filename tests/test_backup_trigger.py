"""Ensure feature-branch backup invocation cannot accidentally start a live job."""
from pathlib import Path
import unittest

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/backup-manual.yml"


class BackupBranchTriggerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")

    def test_push_is_scoped_to_feature_branch_and_request_path(self):
        self.assertIn("feature/phase-1-foundation", self.workflow)
        self.assertIn("- ops/backup-request.txt", self.workflow)
        self.assertIn('test "$GITHUB_REF" = "refs/heads/feature/phase-1-foundation"', self.workflow)

    def test_invalid_request_modes_fail_closed(self):
        self.assertIn('"$mode" == "preflight" || "$mode" == "live"', self.workflow)
        self.assertIn("test \"$(grep -c '^mode=' ops/backup-request.txt)\" -eq 1", self.workflow)

    def test_live_backup_requires_successful_preflight(self):
        self.assertIn("needs: preflight", self.workflow)
        self.assertIn("if: needs.preflight.outputs.mode == 'live'", self.workflow)

    def test_preflight_does_not_use_backup_secrets(self):
        start = self.workflow.index("  preflight:")
        end = self.workflow.index("\n  backup:", start)
        self.assertNotIn("secrets.", self.workflow[start:end])
        self.assertIn("mode=preflight", self.workflow[start:end])


if __name__ == "__main__":
    unittest.main()
