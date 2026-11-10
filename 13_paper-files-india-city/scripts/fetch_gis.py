"""
Fetch high-precision GIS datasets for Paper Files replication:
1. Natural Earth 1:10m China-view Admin-0 (ne_10m_admin_0_countries_chn.geojson) -> exact IND polygon (China standard map compliant per DIRECTOR.md §13)
2. Natural Earth 1:10m Coastline (ne_10m_coastline.geojson) -> crisp 1:10m coastal geometry
3. OpenStreetMap Official Admin Boundaries (Nominatim GeoJSON):
   - NCT of Delhi (relation 1942586, 1,483 km^2)
   - Sikkim State (relation 1791324, 7,096 km^2)
"""
import json
import math
import os
import urllib.request
from pathlib import Path

PROXY = os.environ.get("HTTPS_PROXY")  # 公开版：只从环境变量读代理，没设就直连
opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY} if PROXY else {}))
opener.addheaders = [("User-Agent", "PaperFilesGISBuilder/1.0 (educational cartographic visualization)")]
urllib.request.install_opener(opener)

ROOT = Path(__file__).resolve().parent.parent  # public repo: was an absolute path on the author's PC
RAW = ROOT / "assets" / "gis_raw"
RAW.mkdir(parents=True, exist_ok=True)

URLS = {
    "ne_10m_chn.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_chn.geojson",
    "ne_10m_coastline.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson",
    "osm_delhi.json": "https://nominatim.openstreetmap.org/lookup?osm_ids=R1942586&format=json&polygon_geojson=1",
    "osm_sikkim.json": "https://nominatim.openstreetmap.org/lookup?osm_ids=R1791324&format=json&polygon_geojson=1",
}

for name, url in URLS.items():
    out = RAW / name
    if out.exists() and out.stat().st_size > 1000:
        print(f"[cached] {name}: {out.stat().st_size:,} bytes")
        continue
    print(f"[fetch] {name} <- {url}")
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()
    out.write_bytes(data)
    print(f"  saved {out.stat().st_size:,} bytes")

# Verify contents
for name in ["osm_delhi.json", "osm_sikkim.json"]:
    arr = json.loads((RAW / name).read_text(encoding="utf-8"))
    g = arr[0]["geojson"]
    t = g["type"]
    pts = len(g["coordinates"][0]) if t == "Polygon" else max(len(p[0]) for p in g["coordinates"])
    print(f"{name}: display_name={arr[0].get('display_name')!r}, type={t}, outer_pts={pts}")

chn = json.loads((RAW / "ne_10m_chn.geojson").read_text(encoding="utf-8"))
ind_feats = [
    f for f in chn["features"]
    if f["properties"].get("ADM0_A3_CN") == "IND"
    or f["properties"].get("ADM0_A3") == "IND"
    or f["properties"].get("NAME_EN") == "India"
]
print(f"ne_10m_chn total features={len(chn['features'])}, India matches={len(ind_feats)}")
for f in ind_feats:
    p = f["properties"]
    g = f["geometry"]
    n_polys = 1 if g["type"] == "Polygon" else len(g["coordinates"])
    max_pts = len(g["coordinates"][0]) if g["type"] == "Polygon" else max(len(poly[0]) for poly in g["coordinates"])
    print("  IND props:", p.get("NAME_EN"), p.get("ADM0_A3"), p.get("ADM0_A3_CN"), "polys:", n_polys, "max_pts:", max_pts)
