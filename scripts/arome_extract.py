#!/usr/bin/env python3
"""
Extract AROME netCDF slices for the OpenAirMap POC.

Commands:
  dates  — list available YYYY-MM-DD files for a domain
  wind   — wind-js JSON (u10/v10) for leaflet-velocity
  field  — colour PNG for a scalar variable + JSON meta on stdout

Layout expected:
  <data-root>/<domain>/<year>/arome_YYYY-MM-DD.nc
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import xarray as xr

DOMAIN_DEFAULT = "Marseille"
# Shared archive on the VM (CIFS). Override with --data-root / AROME_DATA_ROOT.
DEFAULT_DATA_ROOT = Path("/mnt/partage_stomod2/AROME_DATA")

# Multi-level domain archives only (PACA surface excluded from POC).
ALLOWED_DOMAINS = ("Marseille", "Nice", "Toulon", "Fos")

DOMAIN_BBOX = {
    "Marseille": [5.15, 43.15, 5.60, 43.45],
    "Nice": [7.05, 43.55, 7.45, 43.85],
    "Toulon": [5.70, 42.95, 6.20, 43.25],
    "Fos": [4.75, 43.35, 5.15, 43.60],
}


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def assert_domain(domain: str) -> str:
    if domain not in ALLOWED_DOMAINS:
        die(
            f"Domaine invalide: {domain}. "
            f"Attendu: {', '.join(ALLOWED_DOMAINS)}"
        )
    return domain


def resolve_nc(data_root: Path, domain: str, date: str) -> Path:
    assert_domain(domain)
    year = date.split("-")[0]
    path = data_root / domain / year / f"arome_{date}.nc"
    if not path.is_file():
        die(f"Fichier introuvable: {path}")
    return path


def open_slice(path: Path, hour: int) -> tuple[xr.Dataset, int]:
    ds = xr.open_dataset(path)
    if "time" not in ds.dims:
        die(f"Pas de dimension time dans {path}")
    times = ds["time"].values
    n = len(times)
    if hour < 0 or hour >= n:
        die(
            f"Heure {hour:02d} hors plage pour {path.name} "
            f"(disponible: 0..{n - 1}, n={n})"
        )
    return ds.isel(time=hour), n


def cmd_dates(args: argparse.Namespace) -> None:
    domain = assert_domain(args.domain)
    root = Path(args.data_root) / domain
    dates: list[str] = []
    if root.is_dir():
        for year_dir in sorted(root.iterdir()):
            if not year_dir.is_dir():
                continue
            for nc in sorted(year_dir.glob("arome_*.nc")):
                # arome_YYYY-MM-DD.nc
                stem = nc.stem  # arome_YYYY-MM-DD
                if stem.startswith("arome_"):
                    dates.append(stem[len("arome_") :])
    print(json.dumps({"domain": domain, "dates": dates}, ensure_ascii=False))


def cmd_domains(args: argparse.Namespace) -> None:
    print(
        json.dumps(
            {
                "dataRoot": str(Path(args.data_root)),
                "domains": [
                    {"id": d, "bbox": DOMAIN_BBOX[d]} for d in ALLOWED_DOMAINS
                ],
            },
            ensure_ascii=False,
        )
    )


def cmd_wind(args: argparse.Namespace) -> None:
    path = resolve_nc(Path(args.data_root), args.domain, args.date)
    sl, _ = open_slice(path, args.hour)
    for name in ("u10", "v10"):
        if name not in sl:
            die(f"Variable {name} absente de {path.name}")

    lats = np.asarray(sl["lat"].values, dtype=float)
    lons = np.asarray(sl["lon"].values, dtype=float)
    u = np.asarray(sl["u10"].values, dtype=float)
    v = np.asarray(sl["v10"].values, dtype=float)

    # wind-js expects north→south rows. Our files already have lat descending.
    if lats[0] < lats[-1]:
        lats = lats[::-1]
        u = u[::-1, :]
        v = v[::-1, :]

    ny, nx = u.shape
    la1, la2 = float(lats[0]), float(lats[-1])
    lo1, lo2 = float(lons[0]), float(lons[-1])
    dx = (lo2 - lo1) / max(nx - 1, 1)
    dy = (la1 - la2) / max(ny - 1, 1)
    ref_time = f"{args.date} {args.hour:02d}:00:00"

    def header(parameter_number: int, name: str) -> dict:
        return {
            "parameterCategory": 2,
            "parameterNumber": parameter_number,
            "parameterNumberName": name,
            "parameterUnit": "m.s-1",
            "la1": la1,
            "la2": la2,
            "lo1": lo1,
            "lo2": lo2,
            "nx": int(nx),
            "ny": int(ny),
            "dx": float(dx),
            "dy": float(dy),
            "refTime": ref_time,
        }

    payload = [
        {
            "header": header(2, "eastward_wind"),
            "data": np.nan_to_num(u, nan=0.0).astype(float).ravel().tolist(),
        },
        {
            "header": header(3, "northward_wind"),
            "data": np.nan_to_num(v, nan=0.0).astype(float).ravel().tolist(),
        },
    ]
    print(json.dumps(payload))


def _temp_color_celsius(values_c: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    """Return RGBA uint8 image (ny, nx, 4). Blue→cyan→yellow→red."""
    from PIL import Image

    t = np.clip((values_c - vmin) / max(vmax - vmin, 1e-6), 0.0, 1.0)
    # piecewise RGB
    r = np.zeros_like(t)
    g = np.zeros_like(t)
    b = np.zeros_like(t)
    # 0–0.33 blue→cyan
    m0 = t <= 1 / 3
    x = t[m0] * 3
    r[m0] = 0
    g[m0] = x
    b[m0] = 1
    # 0.33–0.66 cyan→yellow
    m1 = (t > 1 / 3) & (t <= 2 / 3)
    x = (t[m1] - 1 / 3) * 3
    r[m1] = x
    g[m1] = 1
    b[m1] = 1 - x
    # 0.66–1 yellow→red
    m2 = t > 2 / 3
    x = (t[m2] - 2 / 3) * 3
    r[m2] = 1
    g[m2] = 1 - x
    b[m2] = 0

    alpha = np.where(np.isnan(values_c), 0.0, 0.72)
    rgba = np.stack(
        [
            (r * 255).astype(np.uint8),
            (g * 255).astype(np.uint8),
            (b * 255).astype(np.uint8),
            (alpha * 255).astype(np.uint8),
        ],
        axis=-1,
    )
    # silence unused import warning path — Image used by caller
    _ = Image
    return rgba


def cmd_field(args: argparse.Namespace) -> None:
    from PIL import Image

    path = resolve_nc(Path(args.data_root), args.domain, args.date)
    sl, _ = open_slice(path, args.hour)
    var = args.var
    if var not in sl:
        die(f"Variable {var} absente de {path.name}")

    lats = np.asarray(sl["lat"].values, dtype=float)
    lons = np.asarray(sl["lon"].values, dtype=float)
    data = np.asarray(sl[var].values, dtype=float)

    # Image top = north for Leaflet ImageOverlay
    if lats[0] < lats[-1]:
        lats = lats[::-1]
        data = data[::-1, :]

    south, north = float(min(lats[0], lats[-1])), float(max(lats[0], lats[-1]))
    west, east = float(lons[0]), float(lons[-1])

    units = str(sl[var].attrs.get("units", ""))
    display = data.copy()
    out_units = units
    if var == "t2m" and units in ("K", "kelvin"):
        display = data - 273.15
        out_units = "°C"

    finite = display[np.isfinite(display)]
    if finite.size == 0:
        die(f"Aucune valeur valide pour {var} @ {args.date} {args.hour:02d}h")

    vmin = float(args.vmin) if args.vmin is not None else float(np.nanpercentile(finite, 2))
    vmax = float(args.vmax) if args.vmax is not None else float(np.nanpercentile(finite, 98))
    if var == "t2m":
        vmin = float(args.vmin) if args.vmin is not None else min(vmin, 5.0)
        vmax = float(args.vmax) if args.vmax is not None else max(vmax, 30.0)

    rgba = _temp_color_celsius(display, vmin, vmax)
    img = Image.fromarray(rgba, mode="RGBA")
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")

    meta = {
        "var": var,
        "units": out_units,
        "bounds": [south, west, north, east],
        "min": vmin,
        "max": vmax,
        "date": args.date,
        "hour": args.hour,
        "domain": args.domain,
        "out": str(out_path),
    }
    print(json.dumps(meta, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="AROME netCDF extractor for OpenAirMap POC")
    p.add_argument(
        "--data-root",
        default=str(DEFAULT_DATA_ROOT),
        help="Root of AROME_DATA tree",
    )
    p.add_argument("--domain", default=DOMAIN_DEFAULT)

    sub = p.add_subparsers(dest="cmd", required=True)

    p_domains = sub.add_parser("domains", help="List allowed domains + bboxes")
    p_domains.set_defaults(func=cmd_domains)

    p_dates = sub.add_parser("dates", help="List available dates")
    p_dates.set_defaults(func=cmd_dates)

    p_wind = sub.add_parser("wind", help="Emit wind-js JSON for u10/v10")
    p_wind.add_argument("--date", required=True)
    p_wind.add_argument("--hour", type=int, required=True)
    p_wind.set_defaults(func=cmd_wind)

    p_field = sub.add_parser("field", help="Emit colour PNG for a scalar field")
    p_field.add_argument("--date", required=True)
    p_field.add_argument("--hour", type=int, required=True)
    p_field.add_argument("--var", default="t2m")
    p_field.add_argument("--out", required=True)
    p_field.add_argument("--vmin", type=float, default=None)
    p_field.add_argument("--vmax", type=float, default=None)
    p_field.set_defaults(func=cmd_field)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
