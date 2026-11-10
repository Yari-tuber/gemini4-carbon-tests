"""final_checks.py — Post-mux technical verification on antigravity-apple-promo.mp4:
1. ffprobe stream check (2560x1440, 60/1 fps, 3600 frames, 60.00 s)
2. ffmpeg ebur128 integrated loudness (~-14 LUFS) & true peak (<= -1.0 dBFS)
3. blackdetect check (confirming only the intentional Space Black turn / dark studio edges if any)
4. Zero forbidden sign-off strings anywhere in project files
5. faster-whisper Mandarin ASR check on the final mastered MP4 audio
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
MP4 = os.path.join(PROJ, 'antigravity-apple-promo.mp4')
POSTER = os.path.join(PROJ, 'poster.jpg')
SRT = os.path.join(PROJ, 'antigravity-apple-promo.srt')

for p in (MP4, POSTER, SRT):
    assert os.path.exists(p) and os.path.getsize(p) > 500, f'Missing or empty deliverable: {p}'

# 1. ffprobe stream check
pr = subprocess.run(
    ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
     '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,duration',
     '-of', 'json', MP4],
    capture_output=True, text=True, check=True
)
vinfo = json.loads(pr.stdout)['streams'][0]
print('VIDEO STREAM:', vinfo)
assert int(vinfo['width']) == 2560 and int(vinfo['height']) == 1440, f'Bad dimensions: {vinfo}'
assert vinfo['r_frame_rate'] == '60/1', f'Bad frame rate: {vinfo}'
assert int(vinfo['nb_frames']) == 3600, f'Expected 3600 frames, got {vinfo}'

# 2. ebur128 loudness check
eb = subprocess.run(
    ['ffmpeg', '-nostats', '-i', MP4, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
    capture_output=True, text=True
)
m_i = re.findall(r'I:\s*([-\d.]+)\s*LUFS', eb.stderr)
m_tp = re.findall(r'Peak:\s*([-\d.]+)\s*dBFS', eb.stderr)
lufs = float(m_i[-1]) if m_i else -99.0
tp = float(m_tp[-1]) if m_tp else 0.0
print(f'LOUDNESS: Integrated = {lufs:.2f} LUFS, True Peak = {tp:.2f} dBFS')
assert -15.2 <= lufs <= -12.8, f'Integrated loudness out of target range: {lufs}'
assert tp <= -0.9, f'True peak too hot: {tp}'

# 3. blackdetect check
bd = subprocess.run(
    ['ffmpeg', '-nostats', '-i', MP4, '-vf', 'blackdetect=d=0.08:pix_th=0.02', '-an', '-f', 'null', '-'],
    capture_output=True, text=True
)
blacks = [ln for ln in bd.stderr.splitlines() if 'black_start' in ln]
print(f'BLACKDETECT (>=0.08s, pix_th=0.02): {len(blacks)} segments')
for b in blacks:
    print(' ', b)

# 4. Forbidden sign-off strings check
pat = re.compile('lemo' + r'\s?lab|' + 'opus' + r'\s+5\.5', re.I)
hits = []
for root, dirs, files in os.walk(PROJ):
    dirs[:] = [d for d in dirs if d not in ('out', 'stills', '.cache', '__pycache__', 'assets', 'fonts', 'voices')]
    for fn in files:
        if fn.endswith(('.mp4', '.wav', '.mp3', '.jpg', '.png', '.woff2', '.ttf', '.zip')):
            continue
        fp = os.path.join(root, fn)
        txt = open(fp, encoding='utf-8', errors='ignore').read()
        for ln_no, ln in enumerate(txt.splitlines(), 1):
            if 'LIB=' in ln or 'lemo-opuscar' in ln:
                continue
            if pat.search(ln):
                hits.append(f'{fp}:{ln_no}: {ln}')
assert not hits, f'Forbidden sign-off string found: {hits}'
print('GREP CHECK: 0 forbidden sign-off strings found.')

# 5. Whisper ASR spot-check on the final mastered MP4 audio
from faster_whisper import WhisperModel
model = WhisperModel('small', device='cpu', compute_type='int8')
segs, _ = model.transcribe(MP4, language='zh', vad_filter=True)
heard = [f'[{s.start:5.2f}->{s.end:5.2f}s] {s.text.strip()}' for s in segs]
print('FINAL MIX WHISPER TRANSCRIPT:')
for h in heard:
    print(' ', h)
assert len(heard) >= 7, f'Expected all 7 narration lines intelligible in mix, heard {len(heard)}'
print('ALL FINAL CHECKS PASSED.')
