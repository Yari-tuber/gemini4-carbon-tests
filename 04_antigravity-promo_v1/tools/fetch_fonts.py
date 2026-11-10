"""Fetch self-hosted OFL fonts (Inter, Inter Tight, JetBrains Mono, and subsetted Noto Sans SC) into ../fonts/.
Automatically scans ../film.js, ../timeline.js, and ../lines.json so every CJK/symbol glyph in the film is embedded!
"""
import glob, os, re, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
FONTS_DIR = os.path.join(PROJ, 'fonts')
os.makedirs(FONTS_DIR, exist_ok=True)

UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
)

GF = 'https://raw.githubusercontent.com/google/fonts/86aced91de05cd4f96a06838124cca45be337b2b'

DIRECT = [
    ('Inter.ttf', f'{GF}/ofl/inter/Inter[opsz,wght].ttf'),
    ('Inter-OFL.txt', f'{GF}/ofl/inter/OFL.txt'),
    ('InterTight-var.woff2', 'https://fonts.gstatic.com/s/intertight/v9/NGSwv5HMAFg6IuGlBNMjxLsH8ahuQ2e8.woff2'),
    ('JetBrainsMono-var.ttf', 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/19371302b95d218af43299bce79ddbddd0bc364d/fonts/variable/JetBrainsMono[wght].ttf'),
]


def collect_chars():
    pool = set('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz·.,:;+-/%()[]<>#?!²')
    for fn in ('film.js', 'timeline.js', 'lines.json'):
        p = os.path.join(PROJ, fn)
        if os.path.exists(p):
            txt = open(p, encoding='utf-8').read()
            for ch in txt:
                if not ch.isspace() and ord(ch) >= 32:
                    pool.add(ch)
    return ''.join(sorted(pool))


def dl(url, dst):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    tmp = dst + '.part'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, dst)
    print(f'  saved {os.path.basename(dst)} ({len(data):,} bytes)')


def fetch_noto_subset(weight, chars):
    out_name = f'NotoSansSC-{weight}.woff2'
    dst = os.path.join(FONTS_DIR, out_name)
    q = urllib.parse.quote(chars, safe='')
    css_url = f'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@{weight}&text={q}'
    req = urllib.request.Request(css_url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        css = r.read().decode('utf-8')
    m = re.search(r'url\((https://[^)]+)\)', css)
    if not m:
        raise RuntimeError(f'No font URL found in CSS for weight {weight}')
    dl(m.group(1), dst)


def main():
    for name, url in DIRECT:
        dst = os.path.join(FONTS_DIR, name)
        if os.path.exists(dst) and os.path.getsize(dst) > 100:
            print(f'  cached {name}')
        else:
            dl(url, dst)

    chars = collect_chars()
    print(f'  subsetting {len(chars)} unique glyphs across film source files...')
    for wt in (400, 500, 700):
        fetch_noto_subset(wt, chars)

    css_path = os.path.join(FONTS_DIR, 'fonts.css')
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(
            "@font-face{font-family:Inter;src:url(Inter.ttf) format('truetype');font-weight:100 900;font-display:block}\n"
            "@font-face{font-family:InterTight;src:url(InterTight-var.woff2) format('woff2');font-weight:100 900;font-display:block}\n"
            "@font-face{font-family:JBMono;src:url(JetBrainsMono-var.ttf) format('truetype');font-weight:100 800;font-display:block}\n"
            "@font-face{font-family:NotoSC;src:url(NotoSansSC-400.woff2) format('woff2');font-weight:400;font-display:block}\n"
            "@font-face{font-family:NotoSC;src:url(NotoSansSC-500.woff2) format('woff2');font-weight:500;font-display:block}\n"
            "@font-face{font-family:NotoSC;src:url(NotoSansSC-700.woff2) format('woff2');font-weight:700;font-display:block}\n"
        )
    print('  wrote fonts.css')


if __name__ == '__main__':
    main()
