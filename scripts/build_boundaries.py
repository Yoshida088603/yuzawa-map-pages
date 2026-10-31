"""
Simplify koaza polygons into line + label-point GeoJSON for the map.
Windows:  .\\.venv-scripts\\Scripts\\python.exe scripts\\build_boundaries.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "yuzawa_NInI_henkan" / "temp" / "data" / "koaza" / "r2ka05207.geojson"
OUT = ROOT / "data" / "boundaries" / "boundaries.geojson"
TOL_DEG = 0.00025  # ~25m


def dist2(a, b):
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return dx * dx + dy * dy


def perpendicular_dist(p, a, b):
    if a[0] == b[0] and a[1] == b[1]:
        return math.sqrt(dist2(p, a))
    t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / dist2(a, b)
    t = max(0.0, min(1.0, t))
    proj = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    return math.sqrt(dist2(p, proj))


def douglas_peucker(points, tol):
    if len(points) < 3:
        return points
    dmax = 0.0
    idx = 0
    for i in range(1, len(points) - 1):
        d = perpendicular_dist(points[i], points[0], points[-1])
        if d > dmax:
            idx = i
            dmax = d
    if dmax > tol:
        left = douglas_peucker(points[: idx + 1], tol)
        right = douglas_peucker(points[idx:], tol)
        return left[:-1] + right
    return [points[0], points[-1]]


def ring_centroid(ring):
    # area-weighted for simple polygon ring
    if len(ring) < 3:
        return ring[0]
    a = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-18:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return [sum(xs) / len(xs), sum(ys) / len(ys)]
    a *= 0.5
    return [cx / (6 * a), cy / (6 * a)]


def name_of(props: dict) -> str:
    for k in ("S_NAME", "KEY_CODE", "name", "NAME"):
        v = props.get(k)
        if v:
            return str(v)
    return ""


def main():
    if not SRC.is_file():
        raise SystemExit(f"source not found: {SRC}")
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    out_features = []
    for f in raw.get("features") or []:
        geom = f.get("geometry") or {}
        props = f.get("properties") or {}
        name = name_of(props)
        gtype = geom.get("type")
        coords = geom.get("coordinates")
        rings = []
        if gtype == "Polygon":
            rings = [coords[0]] if coords else []
        elif gtype == "MultiPolygon":
            rings = [poly[0] for poly in (coords or []) if poly]
        for ring in rings:
            pts = [(float(p[0]), float(p[1])) for p in ring]
            if len(pts) < 4:
                continue
            simplified = douglas_peucker(pts, TOL_DEG)
            if len(simplified) < 2:
                continue
            # close ring for line display optional — keep open line of boundary
            line = [[p[0], p[1]] for p in simplified]
            out_features.append(
                {
                    "type": "Feature",
                    "properties": {"name": name, "kind": "boundary"},
                    "geometry": {"type": "LineString", "coordinates": line},
                }
            )
            c = ring_centroid(pts)
            if name:
                out_features.append(
                    {
                        "type": "Feature",
                        "properties": {"name": name, "kind": "label"},
                        "geometry": {"type": "Point", "coordinates": [c[0], c[1]]},
                    }
                )
    fc = {
        "type": "FeatureCollection",
        "features": out_features,
        "properties": {
            "source": "r2ka05207 (令和2年国勢調査 小地域)",
            "note": "simplified lines + label points; default OFF on map",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} features={len(out_features)} size={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
