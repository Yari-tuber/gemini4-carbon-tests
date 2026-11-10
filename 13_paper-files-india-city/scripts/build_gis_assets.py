"""
Build accurate, survey-grade GIS & raster assets for Paper Files 1:1 replication:
1. Delhi 3D Basin: OpenStreetMap official NCT of Delhi boundary (relation 1942586, 1,477.3 km^2)
   + 42,000 interior crowd points filling southern 49.4% (732 / 1,483 km^2).
2. Sikkim 3D Basin: OpenStreetMap official Sikkim boundary (relation 1791324, 7,090.2 km^2)
   + 48,000 interior crowd points filling southern 58.0% (4,116 / 7,096 km^2).
3. Orbital Globe:
   - Natural Earth 1:10m China-view (ne_10m_admin_0_countries_chn) IND border lines
     (strictly compliant with China standard map per DIRECTOR.md §13).
   - Natural Earth 1:10m physical coastlines.
   - Exact 4096x2048 equirectangular raster mask `assets/india_mask_4k.png`:
     R = exact IND polygon interior (anti-aliased, zero rectangular artifacts),
     G = organic Delhi NCR metropolitan light-retention mask.
4. High-res 4096px regional satellite terrain `assets/region_terrain_4k.jpg` (68E..96E, 20N..36N)
   fetched from NASA GIBS BlueMarble_NextGeneration, with realistic tilt-shift focus on Sikkim/Himalayas
   and smooth aerial field grading around Delhi.
5. Clean `assets/word_cues.json` (strip trailing periods, fix 8.2 token, exact yellow keyword highlights).
"""
import json
import math
import os
import random
import struct
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PROXY = os.environ.get("HTTPS_PROXY")  # 公开版：只从环境变量读代理，没设就直连
opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": PROXY, "https": PROXY} if PROXY else {}))
opener.addheaders = [("User-Agent", "PaperFilesGISBuilder/1.0")]
urllib.request.install_opener(opener)

ROOT = Path(__file__).resolve().parent.parent  # public repo: was an absolute path on the author's PC
ASSETS = ROOT / "assets"
RAW = ASSETS / "gis_raw"

# Origin at NCT of Delhi centroid
LON0 = 77.1157
LAT0 = 28.6549
KX = 111.320 * math.cos(math.radians(LAT0))  # ~97.694 km/deg lon
KZ = 110.574                                 # km/deg lat (world -Z = North, +Z = South)


def rdp(points, eps):
    """Ramer-Douglas-Peucker polyline simplification."""
    if len(points) < 3:
        return points
    x0, y0 = points[0]
    x1, y1 = points[-1]
    dx, dy = x1 - x0, y1 - y0
    denom = math.hypot(dx, dy)
    max_d = -1.0
    idx = 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if denom < 1e-12:
            d = math.hypot(px - x0, py - y0)
        else:
            d = abs(dy * px - dx * py + x1 * y0 - y1 * x0) / denom
        if d > max_d:
            max_d = d
            idx = i
    if max_d > eps:
        left = rdp(points[: idx + 1], eps)
        right = rdp(points[idx:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]


def simplify_closed_ring(ring_xy, eps, min_seg=0.08):
    """Simplify closed polygon ring without seam artifact, removing tiny micro-segments."""
    pts = ring_xy[:-1] if ring_xy[0] == ring_xy[-1] else list(ring_xy)
    # Split at farthest pair
    n = len(pts)
    i0 = 0
    i1 = max(range(n), key=lambda i: (pts[i][0] - pts[i0][0]) ** 2 + (pts[i][1] - pts[i0][1]) ** 2)
    half1 = rdp(pts[i0 : i1 + 1], eps)
    half2 = rdp(pts[i1:] + [pts[i0]], eps)
    merged = half1[:-1] + half2[:-1]
    # Filter overly short segments so 3D bevel walls have zero self-intersections
    clean = [merged[0]]
    for p in merged[1:]:
        if math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) >= min_seg:
            clean.append(p)
    if len(clean) > 3 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) < min_seg:
        clean.pop()
    # Ensure CCW in (wx, -wz) = (East, North)
    area2 = 0.0
    for i in range(len(clean)):
        x0, z0 = clean[i]
        x1, z1 = clean[(i + 1) % len(clean)]
        y0, y1 = -z0, -z1
        area2 += x0 * y1 - x1 * y0
    if area2 < 0:
        clean.reverse()
    return [[round(x, 3), round(z, 3)] for x, z in clean]


def point_in_poly_batch(xs, zs, poly):
    """Vectorized ray-casting point-in-polygon for numpy arrays xs, zs."""
    inside = np.zeros(len(xs), dtype=bool)
    n = len(poly)
    px = [p[0] for p in poly]
    pz = [p[1] for p in poly]
    j = n - 1
    for i in range(n):
        xi, zi = px[i], pz[i]
        xj, zj = px[j], pz[j]
        cond = ((zi > zs) != (zj > zs)) & (xs < (xj - xi) * (zs - zi) / ((zj - zi) + 1e-12) + xi)
        inside ^= cond
        j = i
    return inside


def sample_southern_fill(ring_xz, fill_fraction, target_count, seed, tilt_slope=0.05):
    """
    Generate `target_count` jittered grid points strictly inside the polygon (inset slightly from wall),
    then keep the southernmost `fill_fraction` of all interior points (matching the flat slightly-angled
    fill line in sec_01.jpg, sec_15.jpg, and sec_34.jpg!).
    """
    rng = np.random.default_rng(seed)
    xs_ring = [p[0] for p in ring_xz]
    zs_ring = [p[1] for p in ring_xz]
    min_x, max_x = min(xs_ring), max(xs_ring)
    min_z, max_z = min(zs_ring), max(zs_ring)

    # Oversample dense jittered grid so southern `fill_fraction` yields >= target_count points
    area_est = 0.5 * abs(
        sum(
            ring_xz[i][0] * ring_xz[(i + 1) % len(ring_xz)][1]
            - ring_xz[(i + 1) % len(ring_xz)][0] * ring_xz[i][1]
            for i in range(len(ring_xz))
        )
    )
    total_needed = int(target_count / fill_fraction * 1.18)
    step = math.sqrt(area_est / total_needed)
    gx = np.arange(min_x + step * 0.5, max_x, step)
    gz = np.arange(min_z + step * 0.5, max_z, step)
    xx, zz = np.meshgrid(gx, gz)
    xx = xx.ravel() + (rng.random(xx.size) - 0.5) * step * 0.72
    zz = zz.ravel() + (rng.random(zz.size) - 0.5) * step * 0.72

    mask = point_in_poly_batch(xx, zz, ring_xz)
    ix = xx[mask]
    iz = zz[mask]

    # Sort from South (+Z) to North (-Z) with subtle natural angle matching sec_01.jpg!
    # In sec_01.jpg, the fill line slopes slightly down from left (-X) to right (+X), i.e. slightly higher North (-Z) on West (-X):
    score = -iz - ix * tilt_slope  # smaller score = further South (+Z) -> fills first!
    order = np.argsort(score)
    keep_n = int(len(order) * fill_fraction)
    chosen = order[:keep_n]
    ix = ix[chosen]
    iz = iz[chosen]

    # Subsample or pad to exact target_count while preserving South->North order
    if len(ix) >= target_count:
        pick = np.linspace(0, len(ix) - 1, target_count, dtype=int)
        ix, iz = ix[pick], iz[pick]
    else:
        extra = rng.choice(len(ix), size=target_count - len(ix), replace=True)
        ix = np.concatenate([ix, ix[extra] + (rng.random(len(extra)) - 0.5) * step * 0.3])
        iz = np.concatenate([iz, iz[extra] + (rng.random(len(extra)) - 0.5) * step * 0.3])
        re_ord = np.argsort(-iz - ix * tilt_slope)
        ix, iz = ix[re_ord], iz[re_ord]

    pairs = np.empty(target_count * 2, dtype=np.float32)
    pairs[0::2] = ix
    pairs[1::2] = iz
    return pairs, area_est


print("1. Processing OpenStreetMap NCT of Delhi & Sikkim polygons...")
delhi_raw = json.loads((RAW / "osm_delhi.json").read_text(encoding="utf-8"))[0]["geojson"]["coordinates"][0]
sikkim_raw = json.loads((RAW / "osm_sikkim.json").read_text(encoding="utf-8"))[0]["geojson"]["coordinates"][0]

delhi_xz_raw = [((lon - LON0) * KX, -(lat - LAT0) * KZ) for lon, lat in delhi_raw]
# Preserve exact metric scale at Sikkim's latitude (27.50N) around Sikkim's centroid so area = 7,090 km^2 exact!
sik_lon_c = sum(p[0] for p in sikkim_raw) / len(sikkim_raw)
sik_lat_c = sum(p[1] for p in sikkim_raw) / len(sikkim_raw)
sik_cx_world = (sik_lon_c - LON0) * KX
sik_cz_world = -(sik_lat_c - LAT0) * KZ
KX_SIK = 111.320 * math.cos(math.radians(sik_lat_c))
sikkim_xz_raw = [
    (sik_cx_world + (lon - sik_lon_c) * KX_SIK, sik_cz_world - (lat - sik_lat_c) * KZ)
    for lon, lat in sikkim_raw
]

delhi_ring = simplify_closed_ring(delhi_xz_raw, eps=0.055, min_seg=0.14)
sikkim_ring = simplify_closed_ring(sikkim_xz_raw, eps=0.11, min_seg=0.24)

dcx = round(sum(p[0] for p in delhi_ring) / len(delhi_ring), 2)
dcz = round(sum(p[1] for p in delhi_ring) / len(delhi_ring), 2)
scx = round(sum(p[0] for p in sikkim_ring) / len(sikkim_ring), 2)
scz = round(sum(p[1] for p in sikkim_ring) / len(sikkim_ring), 2)

N_DELHI = 42000
N_SIKKIM = 48000
delhi_pairs, d_area = sample_southern_fill(delhi_ring, fill_fraction=0.494, target_count=N_DELHI, seed=101, tilt_slope=-0.075)
sikkim_pairs, s_area = sample_southern_fill(sikkim_ring, fill_fraction=0.580, target_count=N_SIKKIM, seed=202, tilt_slope=-0.04)

print(f"  Delhi: {len(delhi_ring)} crisp GIS pts, area={d_area:.1f} km^2, center=({dcx}, {dcz}), crowd={N_DELHI}")
print(f"  Sikkim: {len(sikkim_ring)} crisp GIS pts, area={s_area:.1f} km^2, center=({scx}, {scz}), crowd={N_SIKKIM}")

targets_bin = np.concatenate([delhi_pairs, sikkim_pairs]).astype(np.float32)
(ASSETS / "crowd_targets.bin").write_bytes(targets_bin.tobytes())
print(f"  Wrote crowd_targets.bin ({targets_bin.nbytes:,} bytes)")

print("2. Processing Natural Earth 1:10m China-view India polygon & 4K blackout mask...")
chn_fc = json.loads((RAW / "ne_10m_chn.geojson").read_text(encoding="utf-8"))
ind_feat = [f for f in chn_fc["features"] if f["properties"].get("ADM0_A3_CN") == "IND"][0]
ind_polys = ind_feat["geometry"]["coordinates"]
if ind_feat["geometry"]["type"] == "Polygon":
    ind_polys = [ind_polys]

# Build 4096x2048 equirectangular India mask (R = exact India polygon, G = Delhi metro cluster)
MW, MH = 4096, 2048
mask_r = Image.new("L", (MW, MH), 0)
draw_r = ImageDraw.Draw(mask_r)

india_border_lines = []
for poly in ind_polys:
    outer = poly[0]
    if len(outer) < 6:
        continue
    # Rasterize onto 4096x2048 equirectangular (u = (lon+180)/360, y_top = (90-lat)/180)
    pix = [((lon + 180.0) / 360.0 * MW, (90.0 - lat) / 180.0 * MH) for lon, lat in outer]
    draw_r.polygon(pix, fill=255)
    for hole in poly[1:]:
        if len(hole) >= 4:
            hpix = [((lon + 180.0) / 360.0 * MW, (90.0 - lat) / 180.0 * MH) for lon, lat in hole]
            draw_r.polygon(hpix, fill=0)

    # Simplify border line for 3D globe glowing vector outline (skip tiny coral islets < 12 vertices)
    if len(outer) >= 18:
        simp = rdp(outer, 0.022)
        india_border_lines.append([[round(lon, 3), round(lat, 3)] for lon, lat in simp])

# Anti-alias polygon edge by 1.2px so zero stair-stepping on 3D sphere
mask_r_blur = mask_r.filter(ImageFilter.GaussianBlur(radius=1.1))
r_arr = np.array(mask_r_blur, dtype=np.uint8)

# Green channel: organic high-detail Delhi NCR cluster centered at (77.12E, 28.65N)
lons = (np.arange(MW) + 0.5) / MW * 360.0 - 180.0
lats = 90.0 - (np.arange(MH) + 0.5) / MH * 180.0
# Local patch around Delhi for fast computation
g_arr = np.zeros((MH, MW), dtype=np.uint8)
x_idx = np.where((lons > 74.5) & (lons < 79.8))[0]
y_idx = np.where((lats > 26.5) & (lats < 30.8))[0]
sub_lon, sub_lat = np.meshgrid(lons[x_idx], lats[y_idx])
dx = (sub_lon - 77.12) * math.cos(math.radians(28.65))
dy = sub_lat - 28.65
dist = np.sqrt(dx * dx + dy * dy)
ang = np.arctan2(dy, dx)
# Starburst radial highway spokes + core so Delhi looks like a real blazing city cluster (like sec_19.jpg!)
spokes = 1.0 + 0.22 * np.cos(ang * 5.0 + 0.4) + 0.16 * np.sin(ang * 9.0 - 1.1) + 0.10 * np.cos(ang * 15.0)
eff_d = dist / spokes
cluster = np.exp(-((eff_d / 0.46) ** 2)) * 0.95 + np.exp(-((eff_d / 0.19) ** 2)) * 0.55
g_arr[np.ix_(y_idx, x_idx)] = np.clip(cluster * 255.0, 0, 255).astype(np.uint8)

b_blur1 = np.array(mask_r.filter(ImageFilter.GaussianBlur(radius=1.4)), dtype=np.float32) / 255.0
b_blur3 = np.array(mask_r.filter(ImageFilter.GaussianBlur(radius=4.0)), dtype=np.float32) / 255.0
r_float = r_arr.astype(np.float32) / 255.0
b_glow = np.clip(np.clip(np.abs(r_float - b_blur1) * 5.2, 0, 1) * 0.95 + np.clip(np.abs(r_float - b_blur3) * 2.8, 0, 1) * 0.55, 0, 1)
b_arr = (b_glow * 255.0).astype(np.uint8)
mask_rgb = Image.fromarray(np.stack([r_arr, g_arr, b_arr], axis=-1), mode="RGB")
mask_rgb.save(ASSETS / "india_mask_4k.png", optimize=True)
print(f"  Wrote india_mask_4k.png ({(ASSETS / 'india_mask_4k.png').stat().st_size:,} bytes), indiaBorder rings={len(india_border_lines)}")

print("3. Processing 1:10m physical coastlines...")
coast_fc = json.loads((RAW / "ne_10m_coastline.geojson").read_text(encoding="utf-8"))
coastlines_out = []
for feat in coast_fc["features"]:
    geom = feat["geometry"]
    lines = [geom["coordinates"]] if geom["type"] == "LineString" else geom["coordinates"]
    for line in lines:
        if len(line) < 5:
            continue
        # Higher detail near South Asia (50E..110E, -5S..40N), lighter detail elsewhere
        lon_mid, lat_mid = line[len(line) // 2]
        tol = 0.032 if (48 <= lon_mid <= 112 and -8 <= lat_mid <= 42) else 0.11
        simp = rdp(line, tol)
        if len(simp) >= 3:
            coastlines_out.append({"type": "LineString", "coordinates": [[round(p[0], 3), round(p[1], 3)] for p in simp]})

print(f"  Coastline segments: {len(coastlines_out)}")

scene_geo = {
    "lat0": LAT0,
    "lon0": LON0,
    "kx": round(KX, 4),
    "kz": round(KZ, 4),
    "nDelhi": N_DELHI,
    "nSikkim": N_SIKKIM,
    "delhiCenter": [dcx, dcz],
    "sikkimCenter": [scx, scz],
    "delhiRing": delhi_ring,
    "sikkimRing": sikkim_ring,
    "indiaBorder": india_border_lines,
    "coastlines": coastlines_out,
}
(ASSETS / "scene_geo.json").write_text(json.dumps(scene_geo, separators=(",", ":")), encoding="utf-8")
print(f"  Wrote scene_geo.json ({(ASSETS / 'scene_geo.json').stat().st_size:,} bytes)")

print("4. Building 4096x2340 regional satellite terrain (68E..96E, 20N..36N)...")
# Composite from local NASA GIBS earth_day_4k.jpg (global) + high-res region_himalaya_2k.jpg (72..94E, 21..35N)
TW, TH = 4096, 2340
day_global = Image.open(ASSETS / "earth_day_4k.jpg").convert("RGB")
gw, gh = day_global.size
# Crop 68E..96E, 20N..36N from earth_day_4k
cx0 = (68.0 + 180.0) / 360.0 * gw
cx1 = (96.0 + 180.0) / 360.0 * gw
cy0 = (90.0 - 36.0) / 180.0 * gh
cy1 = (90.0 - 20.0) / 180.0 * gh
base_reg = day_global.crop((cx0, cy0, cx1, cy1)).resize((TW, TH), Image.Resampling.BICUBIC)

# Paste higher-res NASA GIBS BlueMarble_NextGeneration (72..94E, 21..35N) seamlessly with feathered border
him_2k = Image.open(ASSETS / "region_himalaya_2k.jpg").convert("RGB")
px0 = int(round((72.0 - 68.0) / 28.0 * TW))
px1 = int(round((94.0 - 68.0) / 28.0 * TW))
py0 = int(round((36.0 - 35.0) / 16.0 * TH))
py1 = int(round((36.0 - 21.0) / 16.0 * TH))
him_resized = him_2k.resize((px1 - px0, py1 - py0), Image.Resampling.BICUBIC)
feather = Image.new("L", (px1 - px0, py1 - py0), 0)
fdraw = ImageDraw.Draw(feather)
fdraw.rectangle([48, 48, (px1 - px0) - 48, (py1 - py0) - 48], fill=255)
feather = feather.filter(ImageFilter.GaussianBlur(radius=32))
base_reg.paste(him_resized, (px0, py0), feather)

arr_lift = np.power(np.clip(np.array(base_reg, dtype=np.float32) / 255.0, 0.0, 1.0), 0.68) * 1.18
arr_lift[..., 0] *= 1.04
arr_lift[..., 1] *= 1.08
arr_lift[..., 2] *= 0.90
base_lifted = Image.fromarray((np.clip(arr_lift, 0.0, 1.0) * 255.0).astype(np.uint8))
reg_blur = base_lifted.filter(ImageFilter.GaussianBlur(radius=5.5))
arr_sharp = np.array(base_lifted, dtype=np.float32)
arr_blur = np.array(reg_blur, dtype=np.float32)
y_norm = np.linspace(0.0, 1.0, TH)[:, None, None]  # 0 = 36N (Himalayas/Tibet), 1 = 20N (Plains)
blur_w = np.clip(0.28 + 0.46 * y_norm, 0.28, 0.74)
graded = arr_sharp * (1.0 - blur_w) + arr_blur * blur_w
Image.fromarray(np.clip(graded, 0, 255).astype(np.uint8)).save(ASSETS / "region_terrain_4k.jpg", quality=92)
print(f"  Wrote region_terrain_4k.jpg ({(ASSETS / 'region_terrain_4k.jpg').stat().st_size:,} bytes)")

print("5. Cleaning word_cues.json punctuation & yellow highlights...")
YELLOW_SET = {
    "ONE", "1.4", "BILLION", "TWO", "SAFE", "CONCERT",
    "27", "TWENTY-SEVEN", "KILOMETRES", "DELHI", "HALF",
    "EMPTY", "MUMBAI", "KOLKATA", "CHENNAI", "SOUL",
    "8.2", "EIGHT", "64", "SIXTY-FOUR", "SIKKIM", "LEAST",
    "FITS", "SPARE", "CROWDED", "TELL", "THEM",
}
wc = json.loads((ASSETS / "word_cues.json").read_text(encoding="utf-8"))
cleaned_wc = []
i = 0
while i < len(wc):
    item = dict(wc[i])
    w = item["w"].strip().rstrip(".,;:")
    # Normalize US -> British/original spelling where reference uses KILOMETRES / METRE
    if w == "KILOMETERS":
        w = "KILOMETRES"
    if w == "METER":
        w = "METRE"
    # Merge adjacent "EIGHT" + "8.2" into clean "8.2" (22.57 -> 23.21)
    if w == "EIGHT" and i + 1 < len(wc) and wc[i + 1]["w"].strip().rstrip(".,") == "8.2":
        w = "8.2"
        item["t1"] = wc[i + 1]["t1"]
        i += 1
    item["w"] = w
    key = w.rstrip("?")
    item["yellow"] = (w in YELLOW_SET) or (key in YELLOW_SET)
    cleaned_wc.append(item)
    i += 1

(ASSETS / "word_cues.json").write_text(json.dumps(cleaned_wc, indent=2), encoding="utf-8")
print(f"  Cleaned word_cues.json: {len(cleaned_wc)} cues")
