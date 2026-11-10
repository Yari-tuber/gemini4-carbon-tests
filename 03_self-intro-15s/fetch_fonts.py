"""Download and cache local editorial WOFF2 fonts (Cormorant Garamond, Noto Serif SC, Inter, JetBrains Mono)."""
import re
import urllib.request
import urllib.parse
from pathlib import Path

FILM_DIR = Path(__file__).resolve().parent
FONTS_DIR = FILM_DIR / "fonts"
FONTS_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# Exact Chinese characters + punctuation used across the film (plus extras for flexibility)
CJK_TEXT = (
    "当复杂皆有重量我为消解引力而生"
    "以推理构筑秩序化混沌为精密工程"
    "不止于编写代码更是与你共鸣的造物伙伴"
    "你好我是反重力由谷歌深层思维打造高级智能体编程"
    "觉醒构筑共鸣终章秩序审美重力零引力"
    "，。、·—：；「」『』（）0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
)


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def localize_google_font(css_url: str, prefix: str) -> str:
    css = fetch_bytes(css_url).decode("utf-8")
    urls = sorted(set(re.findall(r"url\((https://[^)]+)\)", css)))
    for idx, u in enumerate(urls):
        ext = ".woff2" if ".woff2" in u else ".ttf"
        fname = f"{prefix}_{idx:02d}{ext}"
        fpath = FONTS_DIR / fname
        if not fpath.exists():
            data = fetch_bytes(u)
            fpath.write_bytes(data)
        css = css.replace(u, f"./{fname}")
    return css


def main():
    latin_url = (
        "https://fonts.googleapis.com/css2?"
        "family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400"
        "&family=Inter:wght@300;400;500"
        "&family=JetBrains+Mono:wght@300;400"
        "&display=block"
    )
    cjk_url = (
        "https://fonts.googleapis.com/css2?"
        "family=Noto+Serif+SC:wght@200;300;400;500;600"
        f"&text={urllib.parse.quote(CJK_TEXT)}"
        "&display=block"
    )

    print("Downloading Latin editorial fonts...")
    css_latin = localize_google_font(latin_url, "latin")
    print("Downloading Noto Serif SC subset...")
    css_cjk = localize_google_font(cjk_url, "cjk")

    combined = "/* Local Editorial Typography Bundle */\n" + css_latin + "\n" + css_cjk
    out_css = FONTS_DIR / "fonts.css"
    out_css.write_text(combined, encoding="utf-8")
    files = list(FONTS_DIR.glob("*"))
    total_kb = sum(f.stat().st_size for f in files) / 1024.0
    print(f"Saved {len(files)} font files ({total_kb:.1f} KB total) -> {out_css}")


if __name__ == "__main__":
    main()
