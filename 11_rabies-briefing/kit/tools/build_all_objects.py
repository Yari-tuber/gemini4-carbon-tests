# -*- coding: utf-8 -*-
"""Reproducibly prepare all cut-out objects and micrograph prints for rabies-briefing.
1. Pre-cleans commercial brand/drug text on soap_bar, syringe_frax, and vial_cortisol using feathered local texture cloning.
2. Runs kit/tools/prep_object.py (BiRefNet ONNX + edge decontamination + shared board grade) for all 8 cut-out objects.
3. Runs kit/tools/make_print.py for the 3 scientific micrograph prints (NIAID CC0 & CDC PHIL Public Domain).
4. Renders sources/objects_check_sheet.jpg on warm enamel (#F3F1EB) + dark slate checkerboard to inspect alpha edges & label removal.
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

PROJ = Path(__file__).resolve().parents[2]
RAW = PROJ / "sources" / "raw"
CLEAN = PROJ / "sources" / "cleaned"
CRED_DIR = PROJ / "sources" / "credits"
OBJ_DIR = PROJ / "kit" / "objects"
CLEAN.mkdir(parents=True, exist_ok=True)
CRED_DIR.mkdir(parents=True, exist_ok=True)
OBJ_DIR.mkdir(parents=True, exist_ok=True)

PY = sys.executable
PREP = str(PROJ / "kit" / "tools" / "prep_object.py")
MAKE_PRINT = str(PROJ / "kit" / "tools" / "make_print.py")


def feathered_clone(arr: np.ndarray, dst_box: tuple[int, int, int, int], src_xy: tuple[int, int], blur_r: int = 14) -> np.ndarray:
    x0, y0, x1, y1 = dst_box
    sx, sy = src_xy
    w, h = x1 - x0, y1 - y0
    out = arr.copy()
    patch = arr[sy : sy + h, sx : sx + w].copy()
    mask = Image.new("L", (w, h), 0)
    pad = max(2, min(w, h) // 8)
    ImageDraw.Draw(mask).rectangle([pad, pad, w - pad, h - pad], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(blur_r))
    m = (np.asarray(mask, np.float32) / 255.0)[..., None]
    out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1.0 - m) + patch * m
    return out


def clean_soap() -> Path:
    dst = CLEAN / "soap_bar_clean.jpg"
    im = ImageOps.exif_transpose(Image.open(RAW / "soap_bar.jpg")).convert("RGB")
    arr = np.asarray(im, np.float32)
    # 1) Wipe embossed "Nature Bar" [1450, 2110, 2060, 2315] by smooth vertical interpolation between clean foam above & below
    x0, y0, x1, y1 = 1445, 2105, 2065, 2320
    top_strip = arr[y0 - 24 : y0, x0:x1].mean(axis=0, keepdims=True)
    bot_strip = arr[y1 : y1 + 24, x0:x1].mean(axis=0, keepdims=True)
    t_col = np.linspace(0.0, 1.0, y1 - y0, dtype=np.float32)[:, None, None]
    rng = np.random.default_rng(19)
    foam_fill = top_strip * (1.0 - t_col) + bot_strip * t_col + rng.normal(0.0, 2.2, size=(y1 - y0, x1 - x0, 1)).astype(np.float32)
    mask = Image.new("L", (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(mask).rectangle([14, 14, x1 - x0 - 14, y1 - y0 - 14], fill=255)
    m = (np.asarray(mask.filter(ImageFilter.GaussianBlur(14)), np.float32) / 255.0)[..., None]
    arr[y0:y1, x0:x1] = arr[y0:y1, x0:x1] * (1.0 - m) + np.clip(foam_fill, 0, 255) * m
    # 2) Wipe lower-right botanical stamp [1750, 3220, 2360, 3830] using clean soap block on the left [1290, 3220]
    arr = feathered_clone(arr, (1750, 3220, 2360, 3830), (1290, 3220), blur_r=22)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(dst, quality=95)
    return dst


def clean_syringe() -> Path:
    dst = CLEAN / "syringe_frax_clean.jpg"
    im = ImageOps.exif_transpose(Image.open(RAW / "syringe_frax.jpg")).convert("RGB")
    arr = np.asarray(im, np.float32)
    # Wipe tiny vertical text "parine" at [1295, 445, 1365, 650] from clean adjacent inner barrel [1225, 445]
    arr = feathered_clone(arr, (1292, 445, 1368, 655), (1215, 445), blur_r=8)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(dst, quality=95)
    return dst


def clean_vial() -> Path:
    dst = CLEAN / "vial_cortisol_clean.jpg"
    im = ImageOps.exif_transpose(Image.open(RAW / "vial_cortisol.jpg")).convert("RGB")
    arr = np.asarray(im, np.float32)
    # Replace ALL printed drug text on the white paper label [780, 1570, 1945, 2995] with smooth cylindrical shading
    y0, y1 = 1570, 2995
    x0, x1 = 780, 1945
    # Sample clean paper strip near bottom of label (y = 2990..3025) across x0..x1 for true cylindrical illumination profile
    prof_x = arr[2992:3020, x0:x1].mean(axis=0, keepdims=True)  # (1, W, 3)
    # Add subtle vertical lighting gradient & fine paper grain
    H_lbl, W_lbl = y1 - y0, x1 - x0
    v_grad = np.linspace(1.018, 0.985, H_lbl, dtype=np.float32)[:, None, None]
    rng = np.random.default_rng(42)
    grain = rng.normal(0.0, 1.6, size=(H_lbl, W_lbl, 1)).astype(np.float32)
    blank_label = np.clip(prof_x * v_grad + grain, 0, 255)
    mask = Image.new("L", (W_lbl, H_lbl), 0)
    ImageDraw.Draw(mask).rectangle([10, 12, W_lbl - 10, H_lbl - 12], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(10))
    m = (np.asarray(mask, np.float32) / 255.0)[..., None]
    arr[y0:y1, x0:x1] = arr[y0:y1, x0:x1] * (1.0 - m) + blank_label * m
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(dst, quality=95)
    return dst


CREDITS_DATA = {
    "dog": {
        "title": "Yellow labrador retr.JPG",
        "author": "Ezhuttukari / Thachan.makan (Wikimedia Commons)",
        "licence": "CC BY-SA 3.0",
        "source": "https://commons.wikimedia.org/wiki/File:Yellow_labrador_retr.JPG",
    },
    "cat": {
        "title": "Cat August 2010-2.jpg",
        "author": "Alvesgaspar (Wikimedia Commons)",
        "licence": "CC BY-SA 3.0",
        "source": "https://commons.wikimedia.org/wiki/File:Cat_August_2010-2.jpg",
    },
    "bat": {
        "title": "Subic Flying Fox.jpg",
        "author": "Emman Asuncion Foronda (Wikimedia Commons)",
        "licence": "CC BY-SA 4.0",
        "source": "https://commons.wikimedia.org/wiki/File:Subic_Flying_Fox.jpg",
    },
    "tap": {
        "title": "Benasque - Anciles - Grifo 01.jpg",
        "author": "Basotxerri (Wikimedia Commons)",
        "licence": "CC BY-SA 4.0",
        "source": "https://commons.wikimedia.org/wiki/File:Benasque_-_Anciles_-_Grifo_01.jpg",
    },
    "soap": {
        "title": "Nature Bar natural soap bar.jpg (brand embossing removed)",
        "author": "MarliesVH (Wikimedia Commons)",
        "licence": "CC BY 4.0",
        "source": "https://commons.wikimedia.org/wiki/File:Nature_Bar_natural_soap_bar.jpg",
    },
    "iodine": {
        "title": "Antique Amber Medicine Bottle (42378014251).jpg",
        "author": "Cindy Shebley (Wikimedia Commons)",
        "licence": "CC BY 2.0",
        "source": "https://commons.wikimedia.org/wiki/File:Antique_Amber_Medicine_Bottle_(42378014251).jpg",
    },
    "syringe": {
        "title": "Fraxiparine 0,6ml white background.jpg (label text removed)",
        "author": "Wesalius (Wikimedia Commons)",
        "licence": "CC BY 4.0",
        "source": "https://commons.wikimedia.org/wiki/File:Fraxiparine_0,6ml_white_background.jpg",
    },
    "vial": {
        "title": "Cortisol for injection.jpg (drug label text removed)",
        "author": "LHcheM (Wikimedia Commons)",
        "licence": "CC BY-SA 3.0",
        "source": "https://commons.wikimedia.org/wiki/File:Cortisol_for_injection.jpg",
    },
    "em_niaid": {
        "title": "Rabies Virus 09282024.jpg (Colorized TEM of rabies virus particles)",
        "author": "NIAID / Visualspecialist",
        "licence": "CC0 1.0 Public Domain",
        "source": "https://commons.wikimedia.org/wiki/File:Rabies_Virus_09282024.jpg",
    },
    "print_phil_em": {
        "title": "Rabies Virus EM PHIL 1876.JPG",
        "author": "CDC / Dr. Fred Murphy (Public Health Image Library #1876)",
        "licence": "Public Domain",
        "source": "https://commons.wikimedia.org/wiki/File:Rabies_Virus_EM_PHIL_1876.JPG",
    },
    "print_negri": {
        "title": "Rabies encephalitis Negri bodies PHIL 3377 lores.jpg",
        "author": "CDC / Dr. Daniel P. Perl (Public Health Image Library #3377)",
        "licence": "Public Domain",
        "source": "https://commons.wikimedia.org/wiki/File:Rabies_encephalitis_Negri_bodies_PHIL_3377_lores.jpg",
    },
}


def write_credit(oid: str) -> str:
    p = CRED_DIR / f"{oid}.json"
    p.write_text(json.dumps(CREDITS_DATA[oid], ensure_ascii=False, indent=2), encoding="utf-8")
    return str(p)


def run_prep(src: Path, oid: str, extra_args: list[str]):
    cred = write_credit(oid)
    cmd = [
        PY, PREP, str(src), oid,
        "--sat", "0.88", "--contrast", "1.06", "--warm", "0.015",
        "--credit", cred,
        *extra_args,
    ]
    print(">>", " ".join(cmd))
    subprocess.run(cmd, check=True)


def run_print(src: Path, oid: str, crop: str, w: int, sat: float = 0.86):
    cred = CREDITS_DATA[oid]
    cmd = [PY, MAKE_PRINT, str(src), oid, "--crop", crop, "--w", str(w), "--sat", str(sat)]
    print(">>", " ".join(cmd))
    subprocess.run(cmd, check=True)
    meta_p = OBJ_DIR / f"{oid}.json"
    meta = json.loads(meta_p.read_text(encoding="utf-8"))
    meta["credit"] = cred
    meta_p.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    soap_src = clean_soap()
    syr_src = clean_syringe()
    vial_src = clean_vial()

    # 8 physical cut-out objects
    run_prep(RAW / "dog_white.jpg", "dog", ["--keep-largest", "--max", "2300", "--anchor", "nose=0.06,0.28", "--anchor", "back=0.55,0.28"])
    run_prep(RAW / "cat_white.jpg", "cat", ["--keep-largest", "--max", "2200"])
    run_prep(RAW / "bat_fox.jpg", "bat", ["--keep-largest", "--max", "2600", "--anchor", "wing=0.18,0.35"])
    run_prep(
        RAW / "tap_brass.jpg",
        "tap",
        [
            "--crop", "810,540,2320,2520",
            "--poly", "50,780 350,780 420,20 1180,20 1480,1520 1480,1850 50,1940",
            "--keep-largest",
            "--max", "2000",
            "--anchor", "spout=0.88,0.86",
        ],
    )
    run_prep(soap_src, "soap", ["--crop", "1050,1520,2480,3920", "--keep-largest", "--max", "2200", "--anchor", "top=0.50,0.12"])
    run_prep(RAW / "amber_bottle.jpg", "iodine", ["--keep-largest", "--max", "2200", "--anchor", "neck=0.50,0.08"])
    run_prep(syr_src, "syringe", ["--crop", "210,280,2680,820", "--keep-largest", "--max", "2400", "--anchor", "tip=0.98,0.52", "--anchor", "plunger=0.03,0.50"])
    run_prep(vial_src, "vial", ["--crop", "680,250,2020,3380", "--keep-largest", "--max", "2200", "--anchor", "cap=0.50,0.05"])

    # 3 scientific micrograph prints
    run_print(RAW / "em_niaid.jpg", "em_niaid", "920,240,3280,2680", w=2200, sat=0.90)
    run_print(RAW / "em_bullet.jpg", "print_phil_em", "60,60,1775,2330", w=1500, sat=0.85)
    run_print(RAW / "negri_cdc.jpg", "print_negri", "40,40,1760,1155", w=1500, sat=0.84)

    # Build visual check sheet over warm enamel (#F3F1EB) + subtle grid to verify edges & text removal
    ids = ["dog", "cat", "bat", "tap", "soap", "iodine", "syringe", "vial", "em_niaid", "print_phil_em", "print_negri"]
    cols, rows = 4, 3
    CW, CH = 620, 500
    sheet = Image.new("RGBA", (cols * CW, rows * CH), (243, 241, 235, 255))
    dr = ImageDraw.Draw(sheet)
    for gy in range(0, rows * CH, 40):
        dr.line([(0, gy), (cols * CW, gy)], fill=(226, 223, 215, 255), width=1)
    for gx in range(0, cols * CW, 40):
        dr.line([(gx, 0), (gx, rows * CH)], fill=(226, 223, 215, 255), width=1)

    for idx, oid in enumerate(ids):
        im = Image.open(OBJ_DIR / f"{oid}.png").convert("RGBA")
        ow, oh = im.size
        im.thumbnail((CW - 60, CH - 80), Image.LANCZOS)
        ox = (idx % cols) * CW + (CW - im.width) // 2
        oy = (idx // cols) * CH + 48 + (CH - 60 - im.height) // 2
        sheet.alpha_composite(im, (ox, oy))
        dr.text(((idx % cols) * CW + 18, (idx // cols) * CH + 14), f"{oid}.png ({ow}x{oh})", fill=(35, 39, 46, 255))

    out_jpg = PROJ / "sources" / "objects_check_sheet.jpg"
    sheet.convert("RGB").save(out_jpg, quality=92)
    print(f"Saved {out_jpg}")


if __name__ == "__main__":
    main()
