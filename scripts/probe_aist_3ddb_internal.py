#!/usr/bin/env python3
"""Smoke probe for an *internal* AIST 3DDB endpoint.

Public probe (`probe_aist_3ddb_public.py`) stays unchanged with fixed hosts.
This script accepts only values that commonly differ for internal deployments:
  --base (required), credentials via Cookie/token env, optional API paths, point.

Does NOT embed internal hosts, cookies, or tokens in the repository.
Stdlib only — run inside a venv.

Example (PowerShell):
  .\\.venv\\Scripts\\python.exe .\\scripts\\probe_aist_3ddb_internal.py `
    --base https://YOUR-INTERNAL-HOST/3ddb `
    --lng 140.55 --lat 39.16 `
    --cookie-env AIST_3DDB_COOKIE `
    --out .\\artifacts\\aist-3ddb-internal-probe.json
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_FEATURES_PATH = "/api/v1/services/ALL/features"
# Confirmed on internal /3ddb (not the public demo path /api/v1/zipdata/{id}).
DEFAULT_ZIPDATA_PATH = "/api/v1/services/zipdata/{id}"
PUBLIC_BASES = {
    "https://gsvrg.ipri.aist.go.jp/3ddb_demo",
    "https://gsrt.digiarc.aist.go.jp/3ddb_demo",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def checked_base(raw: str) -> str:
    url = urllib.parse.urlparse(raw.strip())
    if url.scheme != "https" or url.username or url.password or url.query or url.fragment:
        raise SystemExit("base は認証情報・query・hash を含まない https URL にしてください。")
    if not url.netloc:
        raise SystemExit("base のホストが不正です。")
    path = url.path.rstrip("/")
    base = f"https://{url.netloc}{path}"
    if base in PUBLIC_BASES:
        raise SystemExit("公開版URLは --base に指定せず、probe_aist_3ddb_public.py を使ってください。")
    return base


def parse_header(raw: str) -> tuple[str, str]:
    if ":" not in raw:
        raise SystemExit(f"--header は 'Name: value' 形式にしてください: {raw!r}")
    name, value = raw.split(":", 1)
    name, value = name.strip(), value.strip()
    if not name:
        raise SystemExit(f"--header の名前が空です: {raw!r}")
    return name, value


def build_headers(args: argparse.Namespace) -> dict[str, str]:
    headers: dict[str, str] = {"Accept": "application/json"}
    for raw in args.header or []:
        name, value = parse_header(raw)
        headers[name] = value
    if args.token_env:
        token = os.environ.get(args.token_env)
        if not token:
            raise SystemExit(f"環境変数 {args.token_env} が空です（トークン値はリポに書かないでください）。")
        headers["Authorization"] = f"Bearer {token.strip()}"
    if args.cookie_env:
        cookie = os.environ.get(args.cookie_env)
        if not cookie:
            raise SystemExit(f"環境変数 {args.cookie_env} が空です（Cookie値はリポに書かないでください）。")
        headers["Cookie"] = cookie.strip()
    if args.origin:
        headers["Origin"] = args.origin.strip()
    return headers


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
    except Exception as e:  # noqa: BLE001
        return {
            "ok": False,
            "status": None,
            "final_url": url,
            "headers": {},
            "body": b"",
            "error": f"{type(e).__name__}: {e}",
        }


def extract_external_links(props: dict) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for row in props.get("external_links") or []:
        if not isinstance(row, dict):
            continue
        href = row.get("external_link")
        if not href or href in seen:
            continue
        seen.add(str(href))
        out.append(
            {
                "type": row.get("external_link_type") or "link",
                "url": href,
            }
        )
    if props.get("external_link"):
        href = str(props["external_link"])
        if href not in seen:
            out.append(
                {
                    "type": props.get("external_link_type") or "link",
                    "url": href,
                }
            )
    tiles = props.get("3dtiles_url")
    if tiles and str(tiles) not in seen:
        out.append({"type": "3dtiles", "url": tiles})
    return out


def search_point(
    *,
    base: str,
    features_path: str,
    lng: float,
    lat: float,
    limit: int,
    headers: dict[str, str],
) -> dict:
    q = urllib.parse.urlencode({"area": f"POINT({lng} {lat})", "limit": str(limit)})
    path = features_path if features_path.startswith("/") else f"/{features_path}"
    url = f"{base}{path}?{q}"
    result = http_request(url, headers=headers)
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
                    "external_links": extract_external_links(props),
                }
            )
    else:
        summary["body_preview"] = result["body"][:300].decode("utf-8", errors="replace")
    return summary


def probe_zipdata(
    *,
    base: str,
    zipdata_path: str,
    reg_id: int,
    headers: dict[str, str],
) -> dict:
    path = zipdata_path.replace("{id}", str(reg_id))
    if not path.startswith("/"):
        path = "/" + path
    url = f"{base}{path}"
    # Drop Accept: application/json for binary probe.
    hdrs = {k: v for k, v in headers.items() if k.lower() != "accept"}
    hdrs["Accept"] = "application/zip,*/*"
    head = http_request(url, method="HEAD", headers=hdrs, max_bytes=0)
    get = http_request(
        url,
        method="GET",
        headers={**hdrs, "Range": "bytes=0-3"},
        max_bytes=4,
    )
    looks_zip = get["body"][:2] == b"PK" or (
        get["status"] in (200, 206)
        and "zip" in (get["headers"].get("content-type") or "").lower()
    )
    return {
        "reg_id": reg_id,
        "request_url": url,
        "head_status": head["status"],
        "get_range_status": get["status"],
        "get_range_content_type": get["headers"].get("content-type"),
        "get_range_magic": get["body"][:4].hex() if get["body"] else "",
        "looks_like_zip": bool(looks_zip),
    }


def probe_external(url: str, headers: dict[str, str]) -> dict:
    hdrs = {k: v for k, v in headers.items() if k.lower() not in ("accept", "cookie", "authorization")}
    # External S3 etc. usually should not receive internal auth cookies.
    head = http_request(url, method="HEAD", headers=hdrs, max_bytes=0)
    return {
        "url": url,
        "head_status": head["status"],
        "content_type": head["headers"].get("content-type"),
        "content_length": head["headers"].get("content-length"),
        "error": head.get("error"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Internal 3DDB root URL (https, no secrets)")
    parser.add_argument("--lng", type=float, required=True, help="WGS84 longitude")
    parser.add_argument("--lat", type=float, required=True, help="WGS84 latitude")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument(
        "--features-path",
        default=DEFAULT_FEATURES_PATH,
        help=f"Search path (default {DEFAULT_FEATURES_PATH})",
    )
    parser.add_argument(
        "--zipdata-path",
        default=DEFAULT_ZIPDATA_PATH,
        help=f"ZIP path template with {{id}} (default {DEFAULT_ZIPDATA_PATH})",
    )
    parser.add_argument("--header", action="append", default=[], help="Extra header 'Name: value'")
    parser.add_argument("--token-env", help="Env var name whose value becomes Authorization: Bearer …")
    parser.add_argument("--cookie-env", help="Env var name whose value becomes Cookie: …")
    parser.add_argument("--origin", help="Optional Origin header (CORS observation)")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("artifacts/aist-3ddb-internal-probe.json"),
        help="JSON report path (avoid committing if it contains internal hostnames)",
    )
    parser.add_argument(
        "--probe-zipdata",
        action="store_true",
        help="Also HEAD/Range-probe zipdata for downloadable items without external archive links",
    )
    parser.add_argument(
        "--probe-external",
        action="store_true",
        default=True,
        help="HEAD-probe archive/copc external_links (default on)",
    )
    parser.add_argument(
        "--no-probe-external",
        action="store_false",
        dest="probe_external",
        help="Skip external_links HEAD probes",
    )
    args = parser.parse_args()

    if args.limit < 1 or args.limit > 400:
        raise SystemExit("--limit は 1～400 です。")
    if "{id}" not in args.zipdata_path:
        raise SystemExit("--zipdata-path には {id} が必要です。")

    base = checked_base(args.base)
    headers = build_headers(args)
    # Never write secrets into the report.
    safe_header_names = sorted(
        k for k in headers if k.lower() not in ("cookie", "authorization")
    )

    search = search_point(
        base=base,
        features_path=args.features_path,
        lng=args.lng,
        lat=args.lat,
        limit=args.limit,
        headers=headers,
    )

    external_probes: list[dict] = []
    zip_probes: list[dict] = []
    for item in search.get("items") or []:
        links = item.get("external_links") or []
        if args.probe_external:
            for link in links:
                if link.get("type") in ("archive", "copc") and str(link.get("url", "")).startswith(
                    "https://"
                ):
                    external_probes.append(
                        {
                            "reg_id": item.get("reg_id"),
                            "type": link.get("type"),
                            **probe_external(str(link["url"]), headers),
                        }
                    )
        has_archive = any(l.get("type") in ("archive", "copc") for l in links)
        if args.probe_zipdata and item.get("downloadable") and not has_archive and item.get("reg_id"):
            zip_probes.append(
                probe_zipdata(
                    base=base,
                    zipdata_path=args.zipdata_path,
                    reg_id=int(item["reg_id"]),
                    headers=headers,
                )
            )

    search_ok = search.get("status") == 200
    any_external_ok = any(p.get("head_status") == 200 for p in external_probes)
    any_zip_ok = any(p.get("looks_like_zip") for p in zip_probes)

    report = {
        "probed_at_utc": utc_now(),
        "kind": "internal",
        "environment": {
            "python": sys.version.split()[0],
            "base": base,
            "features_path": args.features_path,
            "zipdata_path": args.zipdata_path,
            "lng": args.lng,
            "lat": args.lat,
            "limit": args.limit,
            "request_header_names": safe_header_names,
            "used_token_env": bool(args.token_env),
            "used_cookie_env": bool(args.cookie_env),
        },
        "search": search,
        "external_link_probes": external_probes,
        "zipdata_probes": zip_probes,
        "summary": {
            "search_ok": search_ok,
            "returned": search.get("returned"),
            "api_total": search.get("api_total"),
            "any_external_archive_head_ok": any_external_ok,
            "any_zipdata_looks_like_zip": any_zip_ok,
            "notes": [
                "Secrets are not written to this report.",
                "Prefer external_links when present; zipdata is optional (--probe-zipdata).",
                "Do not commit reports that reveal internal hostnames if that is sensitive.",
            ],
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"wrote {args.out}")
    return 0 if search_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
