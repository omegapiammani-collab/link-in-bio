#!/usr/bin/env python3
"""Download all bytes in the private Link-in-Bio bucket for an encrypted backup.

This script runs only inside GitHub Actions with protected secrets. It never
prints response bodies, auth tokens or object names to workflow logs.
"""
import hashlib
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "link-in-bio-media"
ROOT = Path(os.environ.get("BACKUP_MEDIA_DIR", "backup/media")).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
}
records = []
offset = 0

while True:
    payload = json.dumps({
        "prefix": "", "limit": 1000, "offset": offset,
        "sortBy": {"column": "name", "order": "asc"}
    }).encode()
    req = Request(
        f"{BASE}/storage/v1/object/list/{BUCKET}",
        data=payload,
        headers={**HEADERS, "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=45) as response:
        batch = json.load(response)
    if not isinstance(batch, list):
        raise RuntimeError("Unexpected Storage list response")
    if not batch:
        break
    for obj in batch:
        name = obj["name"]
        # Reject traversal and ambiguous paths; preserve folder hierarchy.
        parts = name.split("/")
        if (
            not name or name.startswith("/")
            or any(part in ("", ".", "..") for part in parts)
            or "\\" in name
        ):
            raise RuntimeError("Unsafe Storage object path")
        target = (ROOT / name).resolve()
        if not target.is_relative_to(ROOT):
            raise RuntimeError("Storage object escapes backup root")
        target.parent.mkdir(parents=True, exist_ok=True)
        safe_name = quote(name, safe="/")
        get = Request(
            f"{BASE}/storage/v1/object/authenticated/{BUCKET}/{safe_name}",
            headers=HEADERS, method="GET"
        )
        sha = hashlib.sha256()
        total = 0
        try:
            with urlopen(get, timeout=120) as resp, target.open("wb") as out:
                while chunk := resp.read(1024 * 1024):
                    out.write(chunk)
                    sha.update(chunk)
                    total += len(chunk)
        except HTTPError as e:
            raise RuntimeError(f"Failed to fetch media: HTTP {e.code}") from None
        records.append({"path": name, "bytes": total, "sha256": sha.hexdigest()})
    offset += len(batch)
    if len(batch) < 1000:
        break

(Path(os.environ.get("BACKUP_MANIFEST_PATH", "backup/media-manifest.json"))
    .write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"))
print(f"Storage backup completed: {len(records)} file(s), no filenames logged")
