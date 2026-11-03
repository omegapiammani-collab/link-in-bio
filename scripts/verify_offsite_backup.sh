#!/usr/bin/env bash
# Verify an OFF-GITHUB encrypted backup locally without creating plaintext files.
# Usage: bash scripts/verify_offsite_backup.sh "/path/to/link-in-bio-backup.tar.gz.gpg"
set -euo pipefail
umask 077
if [[ "$#" -ne 1 ]]; then
  echo "Usage: bash scripts/verify_offsite_backup.sh /path/to/link-in-bio-backup.tar.gz.gpg" >&2
  exit 2
fi
archive="$1"
if [[ ! -f "$archive" || ! -s "$archive" ]]; then
  echo "Encrypted backup file not found or empty." >&2
  exit 1
fi
for tool in gpg tar sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required local command not installed: $tool" >&2
    exit 1
  fi
done
echo "File SHA-256 (encrypted file only, not the GitHub artifact ZIP):"
sha256sum "$archive"
echo "Enter the GPG recovery passphrase (input hidden, never logged):"
IFS= read -r -s passphrase
printf '\n'
if [[ -z "$passphrase" ]]; then
  echo "Empty recovery passphrase is not allowed." >&2
  exit 1
fi
# Only an in-memory decrypted stream reaches tar. Nothing is extracted to disk.
# Never echo the passphrase, print archive member names, or log file contents.
if gpg --batch --yes --quiet --pinentry-mode loopback \
     --passphrase-fd 3 --decrypt "$archive" 3<<<"$passphrase" \
     2>/dev/null | tar tzf - >/dev/null 2>&1; then
  unset passphrase
  echo "PASS: Off-GitHub encrypted archive can be decrypted and its tar structure is readable."
  echo "This does not prove a database restore. Preserve the archive and passphrase separately."
else
  unset passphrase
  echo "FAIL: Could not decrypt archive or tar content is invalid." >&2
  exit 1
fi
