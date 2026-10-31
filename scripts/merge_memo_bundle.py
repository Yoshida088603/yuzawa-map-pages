"""
Merge a phone-exported yuzawa-memo-bundle JSON into data/memos.geojson.

Windows:
  .\\.venv-scripts\\Scripts\\python.exe scripts\\merge_memo_bundle.py path\\to\\bundle.json

Photos (if present) go to data/memo-photos/ — only deploy behind Access.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMOS_PATH = ROOT / "data" / "memos.geojson"
PHOTOS_DIR = ROOT / "data" / "memo-photos"
MANIFEST_PATH = ROOT / "data" / "manifest.json"

DATA_URL_RE = re.compile(r"^data:([^;]+);base64,(.+)$", re.DOTALL)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def decode_data_url(data_url: str):
    m = DATA_URL_RE.match(data_url.strip())
    if not m:
        raise ValueError("invalid data URL")
    mime = m.group(1)
    raw = base64.b64decode(m.group(2))
    return mime, raw


def feature_id(f):
    p = f.get("properties") or {}
    if p.get("id") is not None:
        return str(p["id"])
    if f.get("id") is not None:
        return str(f["id"])
    return None


def ts(f):
    p = f.get("properties") or {}
    return p.get("updated_at") or p.get("created_at") or ""


def rev(f):
    p = f.get("properties") or {}
    try:
        return int(p.get("client_rev") or 0)
    except (TypeError, ValueError):
        return 0


def merge_features(shipped_feats, patch_feats):
    by_id = {}
    for f in shipped_feats:
        fid = feature_id(f)
        if fid:
            by_id[fid] = f
    for f in patch_feats:
        fid = feature_id(f)
        if not fid:
            continue
        props = f.get("properties") or {}
        status = props.get("local_status")
        if status == "deleted":
            by_id.pop(fid, None)
            continue
        # strip local-only fields for shipped file
        clean_props = {
            k: v
            for k, v in props.items()
            if k not in ("local_status",)
        }
        clean_props["id"] = fid
        # photos: keep metadata refs with relative paths if written
        clean = {
            "type": "Feature",
            "id": fid,
            "properties": clean_props,
            "geometry": f.get("geometry"),
        }
        prev = by_id.get(fid)
        if prev is None or rev(clean) >= rev(prev) or ts(clean) >= ts(prev):
            by_id[fid] = clean
    return list(by_id.values())


def bump_manifest():
    if not MANIFEST_PATH.is_file():
        return
    m = load_json(MANIFEST_PATH)
    v = str(m.get("version") or "0")
    # append -m if not already; always refresh by suffixing merge stamp lightly
    import datetime as dt

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    base = v.split("+")[0]
    m["version"] = f"{base}+merge{stamp}"
    save_json(MANIFEST_PATH, m)
    print(f"manifest version -> {m['version']}")


def main():
    ap = argparse.ArgumentParser(description="Merge yuzawa memo export bundle")
    ap.add_argument("bundle", type=Path, help="exported JSON bundle from the map app")
    ap.add_argument(
        "--photos",
        action="store_true",
        help="write photo binaries under data/memo-photos (Access-only deploy)",
    )
    args = ap.parse_args()
    bundle = load_json(args.bundle)
    if bundle.get("format") != "yuzawa-memo-bundle-v1":
        raise SystemExit(f"unexpected format: {bundle.get('format')}")

    patch = bundle.get("memos_patch") or {"features": []}
    shipped = load_json(MEMOS_PATH) if MEMOS_PATH.is_file() else {"type": "FeatureCollection", "features": []}
    merged = merge_features(shipped.get("features") or [], patch.get("features") or [])

    photo_index = {}
    if args.photos:
        PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
        for ph in bundle.get("photos") or []:
            pid = str(ph.get("id"))
            data_url = ph.get("data_url")
            if not data_url:
                continue
            mime, raw = decode_data_url(data_url)
            ext = ".jpg" if "jpeg" in mime else ".bin"
            rel = f"data/memo-photos/{pid}{ext}"
            out = ROOT / rel
            out.write_bytes(raw)
            photo_index[pid] = {
                "id": pid,
                "memo_id": ph.get("memo_id"),
                "path": rel.replace("\\", "/"),
                "mime": mime,
                "width": ph.get("width"),
                "height": ph.get("height"),
                "bytes": len(raw),
                "created_at": ph.get("created_at"),
            }
            print(f"photo {pid} -> {rel}")

    # attach photo path refs onto memo properties when merging photos
    if photo_index:
        by_memo = {}
        for meta in photo_index.values():
            by_memo.setdefault(str(meta["memo_id"]), []).append(
                {k: v for k, v in meta.items() if k != "memo_id"}
            )
        for f in merged:
            fid = feature_id(f)
            if fid in by_memo:
                props = f.setdefault("properties", {})
                # merge with any existing photo metas (prefer new paths)
                props["photos"] = by_memo[fid]

    out_fc = {"type": "FeatureCollection", "features": merged}
    save_json(MEMOS_PATH, out_fc)
    print(f"wrote {MEMOS_PATH} features={len(merged)}")
    bump_manifest()
    if not args.photos and bundle.get("photos"):
        print("note: photos present in bundle but --photos not set (kept device-only)")


if __name__ == "__main__":
    main()
