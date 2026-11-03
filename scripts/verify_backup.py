#!/usr/bin/env python3
"""Verify an unencrypted staging backup BEFORE encrypting it.

This is an integrity check, not a disaster-recovery restore test. All input
must be in the ephemeral CI work directory, never in a public repository.
"""
import hashlib
import json
import os
import sys
from pathlib import Path


def check_archive_tree(root: Path) -> tuple[int, int]:
    root = root.resolve(strict=True)
    dump = root / "database.dump"
    manifest = root / "media-manifest.json"
    migrations = root / "schema-migrations"

    if not dump.is_file() or dump.stat().st_size <= 0:
        raise ValueError("Database dump is absent or empty")
    if not migrations.is_dir() or not list(migrations.glob("*.sql")):
        raise ValueError("Missing schema migration files")
    if not manifest.is_file():
        raise ValueError("Missing media manifest")

    with dump.open("rb") as archive:
        signature = archive.read(5)
    if signature != b"PGDMP":
        raise ValueError("Invalid PostgreSQL custom archive header")

    data = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Media manifest must contain an array")

    media = (root / "media").resolve(strict=True)
    paths = set()
    total = 0
    for entry in data:
        if not isinstance(entry, dict):
            raise ValueError("Invalid manifest entry")
        name = entry.get("path")
        size = entry.get("bytes")
        checksum = entry.get("sha256")
        if not isinstance(name, str) or not name or name in paths:
            raise ValueError("Missing or duplicate media path")
        paths.add(name)
        parts = name.split("/")
        if (
            name.startswith("/") or any(p in ("", ".", "..") for p in parts)
            or chr(92) in name
        ):
            raise ValueError("Unsafe media path")
        target = (media / name).resolve()
        if not target.is_relative_to(media) or not target.is_file():
            raise ValueError("Manifest media file is missing or invalid")
        if type(size) is not int or size < 0 or target.stat().st_size != size:
            raise ValueError("Media byte count mismatch")
        if (
            not isinstance(checksum, str) or len(checksum) != 64
            or not all(c in "0123456789abcdef" for c in checksum)
        ):
            raise ValueError("Invalid SHA256 checksum")
        digest = hashlib.sha256()
        with target.open("rb") as handle:
            while chunk := handle.read(1024 * 1024):
                digest.update(chunk)
        if digest.hexdigest() != checksum:
            raise ValueError("Media content checksum mismatch")
        total += size

    actual_files = {
        str(p.relative_to(media))
        for p in media.rglob("*") if p.is_file()
    }
    if actual_files != paths:
        raise ValueError("Media manifest does not describe all backup files")
    return len(paths), total


if __name__ == "__main__":
    try:
        count, bytes_checked = check_archive_tree(
            Path(os.environ.get("BACKUP_DIR", "backup"))
        )
        print(f"Staged backup integrity OK: {count} image(s), {bytes_checked} media bytes")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print("Staged backup integrity verification FAILED", file=sys.stderr)
        raise SystemExit(1) from exc
