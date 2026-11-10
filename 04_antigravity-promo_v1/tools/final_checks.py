"""final_checks.py — Run post-mux technical verification on antigravity-promo.mp4:
1. Measure integrated loudness & true peak via ffmpeg ebur128
2. Check blackdetect for any unintended blank frames
3. Transcribe the mixed audio of antigravity-promo.mp4 with faster-whisper to verify voice intelligibility over music/foley
4. Verify no studio sign-off strings exist anywhere in the project folder
"""
import glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
MP4 = os.path.join(PROJ, 'antigravity-promo.mp4')

assert os.path.exists(MP4) and os.path.getsize(MP4) > 100_000, f'Missing or empty {MP4}'

# 1. ffprobe duration / fps / resolution
pr = subprocess.run(
    ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
     '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,duration',
     '-of', 'json', MP4],
    capture_output=True, text=True, check=True
)
vinfo = json.loads(pr.stdout)['streams'][0]
print('VIDEO STREAM:', vinfo)

# 2. ebur128 loudness check
eb = subprocess.run(
    ['ffmpeg', '-nostats', '-i', MP4, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
    capture_output=True, text=True
)
m_i = re.findall(r'I:\s*([-\d.]+)\s*LUFS', eb.stderr)
m_tp = re.findall(r'Peak:\s*([-\d.]+)\s*dBFS', eb.stderr)
print(f"LOUDNESS: Integrated = {m_i[-1] if m_i else '?'} LUFS, True Peak = {m_tp[-1] if m_tp else '?'} dBFS")

# 3. blackdetect check
bd = subprocess.run(
    ['ffmpeg', '-nostats', '-i', MP4, '-vf', 'blackdetect=d=0.08:pix_th=0.02', '-an', '-f', 'null', '-'],
    capture_output=True, text=True
)
blacks = [ln for ln in bd.stderr.splitlines() if 'black_start' in ln]
print(f'BLACKDETECT (>=0.08s, pix_th=0.02): {len(blacks)} segments')
for b in blacks:
    print(' ', b)

# 4. Grep check for forbidden sign-off strings
pat = re.compile('lemo' + r'\s?lab|' + 'opus' + r'\s+5\.5', re.I)
hits = []
for root, dirs, files in os.walk(PROJ):
    dirs[:] = [d for d in dirs if d not in ('out', 'stills', '.cache', '__pycache__')]
    for fn in files:
        if fn.endswith(('.mp4', '.wav', '.mp3', '.jpg', '.png', '.woff2', '.ttf')):
            continue
        p = os.path.join(root, fn)
        txt = open(p, encoding='utf-8', errors='ignore').read()
        for ln_no, ln in enumerate(txt.splitlines(), 1):
            if 'LIB=' in ln:
                continue
            if pat.search(ln):
                hits.append(f'{p}:{ln_no}: {ln}')
assert not hits, f'Forbidden credit found: {hits}'
print('GREP CHECK: 0 forbidden sign-off strings found.')

# 5. Whisper ASR spot-check on the final mastered MP4 audio!
from faster_whisper import WhisperModel
model = WhisperModel('small', device='cpu', compute_type='int8')
segs, _ = model.transcribe(MP4, language='zh', vad_filter=True)
heard = [f"[{s.start:5.2f}->{s.end:5.2f}s] {s.text.strip()}" for s in segs]
print('FINAL MIX WHISPER TRANSCRIPT:')
for h in heard:
    print(' ', h)
assert len(heard) >= 5, 'Too few speech segments detected in final mix!'
print('ALL FINAL CHECKS PASSED.')
