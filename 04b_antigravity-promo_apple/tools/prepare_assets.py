"""prepare_assets.py — Extract clean cropped 30fps JPEG sequences from official Google Antigravity videos
and clean up temporary probe files so index.html / engine.js can render 100% deterministically.
"""
import glob, json, os, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
ASSETS = os.path.join(PROJ, 'assets')
VIDS = os.path.join(ASSETS, 'video')
SEQ = os.path.join(ASSETS, 'seq')

JOBS = [
    # (name, src_mp4, start_s, dur_s, fps, vf_filter)
    ('logo',    'logo_blue.mp4',      0.20, 5.20, 30, 'scale=1920:1080'),
    ('editor',  'editor.mp4',         0.60, 8.20, 30, 'scale=1248:1000'),
    ('browser', 'flight_tracker.mp4', 0.00, 5.65, 30, 'crop=1110:846:301:65,scale=1110:846'),
    ('cli',     'cli_prompt.mp4',     1.00, 9.50, 24, 'crop=1130:792:106:275,scale=1130:792'),
]

meta = {}
for name, fn, ss, dur, fps, vf in JOBS:
    out_dir = os.path.join(SEQ, name)
    os.makedirs(out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(out_dir, '*.jpg')):
        os.remove(old)
    src = os.path.join(VIDS, fn)
    cmd = [
        'ffmpeg', '-y', '-v', 'error',
        '-ss', str(ss), '-t', str(dur), '-i', src,
        '-vf', f'fps={fps},{vf}',
        '-q:v', '2',
        os.path.join(out_dir, 'f_%03d.jpg')
    ]
    subprocess.run(cmd, check=True)
    frames = sorted(glob.glob(os.path.join(out_dir, 'f_*.jpg')))
    im0 = Image.open(frames[0])
    meta[name] = {
        'count': len(frames),
        'w': im0.size[0],
        'h': im0.size[1],
        'fps': fps,
    }
    print(f'SEQ {name:10s}: {len(frames):3d} frames @ {im0.size[0]}x{im0.size[1]}')

with open(os.path.join(SEQ, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2)

# Clean temporary contact sheets / probe PNGs
for pat in ('*_sheet.jpg', 'probe_*.png'):
    for p in glob.glob(os.path.join(VIDS, pat)):
        os.remove(p)

print('Wrote assets/seq/manifest.json cleanly.')
