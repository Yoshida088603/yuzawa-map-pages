#!/usr/bin/env python3
"""Convert A-SurveyAdB SIMA (plane rectangular CS) to WGS84 GeoJSON.

Uses the same GRS80 / EPSG:6678 formulas as app/plane.js (zone 10).
Run inside a venv if you add deps later; this script is stdlib-only.

Example (Windows):
  .\\.venv-scripts\\Scripts\\python.exe scripts\\sima_to_geojson.py data\\survey\\20261107_yuzawa.sim -o data\\survey\\points.geojson
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

A = 6378137.0
F = 1 / 298.257222101
B = A * (1 - F)
E2 = (A * A - B * B) / (A * A)
E_P2 = E2 / (1 - E2)
K0 = 0.9999
PHI0 = 40 * math.pi / 180
LAM0 = (140 + 50 / 60) * math.pi / 180


def meridional_distance(phi: float) -> float:
    e2, e4, e6, e8 = E2, E2**2, E2**3, E2**4
    return A * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256 - 175 * e8 / 16384) * phi
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024 + 105 * e8 / 4096) * math.sin(2 * phi)
        + (15 * e4 / 256 + 45 * e6 / 1024 + 525 * e8 / 16384) * math.sin(4 * phi)
        - (35 * e6 / 3072 + 175 * e8 / 12288) * math.sin(6 * phi)
        + (315 * e8 / 131072) * math.sin(8 * phi)
    )


def plane10_to_lnglat(x: float, y: float) -> tuple[float, float]:
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    m = meridional_distance(PHI0) + x / K0
    mu = m / (
        A
        * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256 - 175 * E2**4 / 16384)
    )
    e1_2, e1_3, e1_4 = e1**2, e1**3, e1**4
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1_3 / 32) * math.sin(2 * mu)
        + (21 * e1_2 / 16 - 55 * e1_4 / 32) * math.sin(4 * mu)
        + (151 * e1_3 / 96) * math.sin(6 * mu)
        + (1097 * e1_4 / 512) * math.sin(8 * mu)
    )
    sin_p = math.sin(phi1)
    cos_p = math.cos(phi1)
    tan_p = math.tan(phi1)
    n1 = A / math.sqrt(1 - E2 * sin_p * sin_p)
    r1 = (A * (1 - E2)) / (1 - E2 * sin_p * sin_p) ** 1.5
    t1 = tan_p * tan_p
    c1 = E_P2 * cos_p * cos_p
    d = y / (n1 * K0)
    d2, d3, d4, d5, d6 = d**2, d**3, d**4, d**5, d**6
    phi = phi1 - (n1 * tan_p / r1) * (
        d2 / 2
        - (d4 / 24) * (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * E_P2)
        + (d6 / 720) * (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * E_P2 - 3 * c1 * c1)
    )
    lam = LAM0 + (
        d
        - (d3 / 6) * (1 + 2 * t1 + c1)
        + (d5 / 120) * (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * E_P2 + 24 * t1 * t1)
    ) / cos_p
    return lam * 180 / math.pi, phi * 180 / math.pi


def parse_sima(text: str) -> list[dict]:
    points = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line.startswith("A01,"):
            continue
        parts = line.split(",")
        # A01,id,name,X,Y,Z,
        if len(parts) < 6:
            continue
        try:
            sid = int(parts[1])
            name = parts[2].strip()
            x = float(parts[3])
            y = float(parts[4])
            z = float(parts[5]) if parts[5] not in ("",) else None
        except ValueError:
            continue
        points.append({"id": sid, "name": name, "x": x, "y": y, "z": z})
    return points


def to_feature_collection(points: list[dict], source: str) -> dict:
    features = []
    for p in points:
        lng, lat = plane10_to_lnglat(p["x"], p["y"])
        props = {
            "id": f"sv-{p['id']}",
            "name": p["name"],
            "sima_id": p["id"],
            "x": p["x"],
            "y": p["y"],
            "z": p["z"],
            "crs": "EPSG:6678",
            "source": source,
        }
        features.append(
            {
                "type": "Feature",
                "id": props["id"],
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
            }
        )
    return {
        "type": "FeatureCollection",
        "properties": {
            "crs": "EPSG:4326",
            "plane_crs": "EPSG:6678",
            "source": source,
            "count": len(features),
        },
        "features": features,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("sima", type=Path, help="Input .sim (cp932 / utf-8)")
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()

    raw = args.sima.read_bytes()
    for enc in ("cp932", "utf-8-sig", "utf-8"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            text = None
    else:
        print("cannot decode SIMA", file=sys.stderr)
        return 1

    points = parse_sima(text)
    if not points:
        print("no A01 points found", file=sys.stderr)
        return 1

    fc = to_feature_collection(points, source=args.sima.name)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(points)} points → {args.output}")
    # sanity: first point round-ish near Yuzawa
    f0 = fc["features"][0]
    lng, lat = f0["geometry"]["coordinates"]
    print(f"sample {f0['properties']['name']}: lng={lng:.6f} lat={lat:.6f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
