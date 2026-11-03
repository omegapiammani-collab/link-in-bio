#!/usr/bin/env python3
"""Back up bytes from the private Supabase Storage bucket.

Requires protected GitHub Actions environment secrets. No API key, object path,
or object contents are written to workflow logs.
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
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
records = []
pending = [""]
visited = set()


def request_json(prefix: str, offset: int) -> list:
    payload = json.dumps({
        "prefix": prefix, "limit": 1000, "offset": offset,
        "sortBy": {"column": "name", "order": "asc"},
    }).encode()
    req = Request(
        f"{BASE}/storage/v1/object/list/{BUCKET}",
        data=payload,
        headers={**HEADERS, "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=45) as response:
        result = json.load(response)
    if not isinstance(result, list):
        raise RuntimeError("Unexpected Storage listing format")
    return result


while pending:
    prefix = pending.pop()
    if prefix in visited:
        continue
    visited.add(prefix)
    offset = 0
    while True:
        batch = request_json(prefix, offset)
        if not batch:
            break
        for obj in batch:
            full_name = prefix + obj["name"]
            # Supabase lists virtual folder entries as objects with null id.
            if obj.get("id") is None:
                pending.append(full_name.rstrip("/") + "/")
                continue

            parts = full_name.split("/")
            if (
                not full_name or full_name.startswith("/")
                or any(part in ("", ".", "..") for part in parts)
                or chr(92) in full_name
            ):
                raise RuntimeError("Unsafe Storage object path")
            destination = (ROOT / full_name).resolve()
            if not destination.is_relative_to(ROOT):
                raise RuntimeError("Storage path traversal detected")
            destination.parent.mkdir(parents=True, exist_ok=True)

            url = (
                f"{BASE}/storage/v1/object/authenticated/"
                f"{BUCKET}/{quote(full_name, safe='/')}"
            )
            req = Request(url, headers=HEADERS, method="GET")
            digest = hashlib.sha256()
            length = 0
            try:
                with urlopen(req, timeout=120) as response, destination.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
                        digest.update(chunk)
                        length += len(chunk)
            except HTTPError as exc:
                raise RuntimeError(f"Storage download failed (HTTP {exc.code})") from None
            records.append({
                "path": full_name,
                "bytes": length,
                "sha256": digest.hexdigest(),
            })
        offset += len(batch)
        if len(batch) < 1000:
            break

manifest = Path(os.environ.get("BACKUP_MANIFEST_PATH", "backup/media-manifest.json"))
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Storage export finished: {len(records)} file(s)")
