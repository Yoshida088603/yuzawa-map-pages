#!/usr/bin/env python3
"""Live smoke probe for the public AIST 3DDB search and ZIP endpoints.

Records datetime, endpoints, HTTP status, and (on ZIP 200) size / SHA-256 / listing.
Does NOT treat ZIP failure as success. Stdlib only — run inside a venv.

Example:
  python3 -m venv .venv
  .venv/bin/pip install -r scripts/requirements-aist-probe.txt
  .venv/bin/python scripts/probe_aist_3ddb_public.py
  .venv/bin/python scripts/probe_aist_3ddb_public.py --out /tmp/aist-3ddb-probe.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import ssl
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DOCUMENTED_BASE = "https://gsrt.digiarc.aist.go.jp/3ddb_demo"
# Browser CORS cannot follow the 301 to a different host; clients must use this.
CLIENT_BASE = "https://gsvrg.ipri.aist.go.jp/3ddb_demo"
PAGES_ORIGIN = "https://yoshida088603.github.io"
YUZAWA = (140.55, 39.16)
TSUKUBA = (140.135, 36.062)
EXAMPLE_REG_IDS = (423, 338, 12)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def http_request(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    max_bytes: int | None = None,
) -> dict:
    req = urllib.request.Request(url, method=method, headers=headers or {})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            raw = resp.read() if max_bytes is None else resp.read(max_bytes)
            return {
                "ok": True,
                "status": resp.status,
                "final_url": resp.geturl(),
                "headers": {k.lower(): v for k, v in resp.headers.items()},
                "body": raw,
            }
    except urllib.error.HTTPError as e:
        body = e.read() if max_bytes is None else e.read(max_bytes)
        return {
            "ok": False,
            "status": e.code,
            "final_url": e.geturl() if hasattr(e, "geturl") else url,
            "headers": {k.lower(): v for k, v in (e.headers.items() if e.headers else [])},
            "body": body,
            "error": str(e),
        }
    except Exception as e:  # noqa: BLE001 — probe must record network failures
        return {
            "ok": False,
            "status": None,
            "final_url": url,
            "headers": {},
            "body": b"",
            "error": f"{type(e).__name__}: {e}",
        }


def search_point(lng: float, lat: float, limit: int = 5, *, base: str = CLIENT_BASE) -> dict:
    q = urllib.parse.urlencode({"area": f"POINT({lng} {lat})", "limit": str(limit)})
    url = f"{base}/api/v1/services/ALL/features?{q}"
    result = http_request(
        url,
        headers={
            "Accept": "application/json",
            "Origin": PAGES_ORIGIN,
        },
    )
    summary: dict = {
        "request_url": url,
        "status": result["status"],
        "final_url": result["final_url"],
        "cors_acao": result["headers"].get("access-control-allow-origin"),
        "error": result.get("error"),
    }
    if result["status"] == 200:
        payload = json.loads(result["body"].decode("utf-8"))
        features = payload.get("features") or []
        summary["api_total"] = (payload.get("properties") or {}).get("all")
        summary["returned"] = len(features)
        summary["items"] = []
        for feat in features:
            props = feat.get("properties") or {}
            summary["items"].append(
                {
                    "reg_id": props.get("reg_id"),
                    "title": props.get("title"),
                    "service_name": props.get("service_name"),
                    "license": props.get("license"),
                    "downloadable": props.get("downloadable"),
                }
            )
    else:
        summary["body_preview"] = result["body"][:200].decode("utf-8", errors="replace")
    return summary


def probe_zip(reg_id: int, *, download_if_ok: bool, base: str = CLIENT_BASE) -> dict:
    url = f"{base}/api/v1/zipdata/{reg_id}"
    head = http_request(url, method="HEAD", headers={"Origin": PAGES_ORIGIN}, max_bytes=0)
    entry: dict = {
        "reg_id": reg_id,
        "request_url": url,
        "head_status": head["status"],
        "head_final_url": head["final_url"],
        "head_cors_acao": head["headers"].get("access-control-allow-origin"),
        "head_content_type": head["headers"].get("content-type"),
        "zip_ok": False,
        "passed_as_success": False,
    }
    # Always also GET a tiny prefix to classify ZIP vs HTML error pages.
    get = http_request(
        url,
        method="GET",
        headers={
            "Origin": PAGES_ORIGIN,
            "Accept": "application/zip,*/*",
            "Range": "bytes=0-3",
        },
        max_bytes=4,
    )
    entry["get_range_status"] = get["status"]
    entry["get_range_final_url"] = get["final_url"]
    entry["get_range_content_type"] = get["headers"].get("content-type")
    entry["get_range_magic"] = get["body"][:4].hex() if get["body"] else ""
    looks_zip = get["body"][:2] == b"PK" or (
        get["status"] in (200, 206)
        and "zip" in (get["headers"].get("content-type") or "").lower()
    )
    entry["looks_like_zip"] = bool(looks_zip)

    if download_if_ok and get["status"] in (200, 206) and looks_zip:
        full = http_request(url, headers={"Accept": "application/zip,*/*"})
        entry["download_status"] = full["status"]
        entry["download_final_url"] = full["final_url"]
        entry["download_content_type"] = full["headers"].get("content-type")
        if full["status"] == 200 and full["body"][:2] == b"PK":
            data = full["body"]
            entry["zip_ok"] = True
            entry["passed_as_success"] = True
            entry["size_bytes"] = len(data)
            entry["sha256"] = hashlib.sha256(data).hexdigest()
            with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
                tmp.write(data)
                tmp.flush()
                with zipfile.ZipFile(tmp.name) as zf:
                    names = zf.namelist()
                    entry["zip_entry_count"] = len(names)
                    entry["zip_entries_sample"] = names[:30]
        else:
            entry["download_error"] = full.get("error") or f"HTTP {full['status']} not a ZIP body"
    elif get["status"] not in (200, 206):
        entry["failure_reason"] = f"ZIP endpoint HTTP {get['status']}"
    else:
        entry["failure_reason"] = "Response did not look like a ZIP archive"

    return entry


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("artifacts/aist-3ddb-public-probe.json"),
        help="JSON report path",
    )
    parser.add_argument(
        "--download-zip",
        action="store_true",
        help="If ZIP probe looks healthy, download full archive and hash it",
    )
    args = parser.parse_args()

    report = {
        "probed_at_utc": utc_now(),
        "environment": {
            "python": sys.version.split()[0],
            "documented_base": DOCUMENTED_BASE,
            "client_base": CLIENT_BASE,
            "pages_origin": PAGES_ORIGIN,
        },
        "phase1_complete": False,
        "redirect_check": {},
        "searches": {
            "yuzawa": search_point(*YUZAWA),
            "tsukuba": search_point(*TSUKUBA),
            "tsukuba_via_documented_host": search_point(*TSUKUBA, base=DOCUMENTED_BASE),
        },
        "zips": [],
        "summary": {},
    }

    # Record that documented host redirects (browser CORS cannot follow this).
    redirect_probe = http_request(
        f"{DOCUMENTED_BASE}/api/v1/services/ALL/features?limit=1",
        headers={"Accept": "application/json"},
        max_bytes=64,
    )
    report["redirect_check"] = {
        "documented_request": f"{DOCUMENTED_BASE}/api/v1/services/ALL/features?limit=1",
        "status": redirect_probe["status"],
        "final_url": redirect_probe["final_url"],
        "note": "Use client_base in browsers to avoid cross-origin redirect during CORS fetch.",
    }

    reg_ids: list[int] = []
    for item in report["searches"]["tsukuba"].get("items") or []:
        if item.get("downloadable") and item.get("reg_id") is not None:
            reg_ids.append(int(item["reg_id"]))
    for rid in EXAMPLE_REG_IDS:
        if rid not in reg_ids:
            reg_ids.append(rid)

    for rid in reg_ids[:5]:
        report["zips"].append(probe_zip(rid, download_if_ok=args.download_zip))

    search_ok = report["searches"]["tsukuba"].get("status") == 200 and (
        report["searches"]["tsukuba"].get("returned") or 0
    ) > 0
    any_zip_ok = any(z.get("passed_as_success") for z in report["zips"])
    report["summary"] = {
        "search_tsukuba_ok": search_ok,
        "search_yuzawa_count": report["searches"]["yuzawa"].get("returned"),
        "any_zip_download_ok": any_zip_ok,
        "zip_statuses": [
            {"reg_id": z["reg_id"], "get_range_status": z.get("get_range_status"), "zip_ok": z.get("zip_ok")}
            for z in report["zips"]
        ],
        "notes": [
            "ZIP failure must not be treated as Phase 1 success.",
            "CORS ACAO on search is recorded under searches.*.cors_acao.",
        ],
    }
    report["phase1_complete"] = bool(search_ok and any_zip_ok)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"wrote {args.out}")
    print(f"phase1_complete={report['phase1_complete']}")
    return 0 if search_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
