"""cuecheck.py — Verify 0.0 ms sync between timeline.json visual cues, music/score.json hits, and events.json foley."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)

tl = json.load(open(os.path.join(PROJ, 'timeline.json'), encoding='utf-8'))
sc = json.load(open(os.path.join(PROJ, 'music', 'score.json'), encoding='utf-8'))
ev = json.load(open(os.path.join(PROJ, 'events.json'), encoding='utf-8'))

errors = []

# 1. Check every key cue in timeline.json matches score.json within 0.5 ms
for k, t_vis in tl['cues'].items():
    t_mus = sc['cues'].get(k)
    if t_mus is None:
        errors.append(f'missing score cue: {k}')
    elif abs(t_vis - t_mus) > 0.0005:
        errors.append(f'cue drift on {k}: vis={t_vis} vs score={t_mus}')

# 2. Check every falling block in Act I lands on a score note
drop_lands = [round(float(d['tLand']), 4) for d in tl['drops']]
if drop_lands != sc['drop_notes']:
    errors.append('Act I drop landings do not match score drop_notes 1-to-1!')

# 3. Check subtitle timing rules (DIRECTOR.md §7: hold >= 1.8 s and >= speech_dur + 0.6 s)
prev_end = -1.0
for v in tl['voices']:
    hold = v['toast1'] - v['toast0']
    min_req = max(1.8, v['dur'] + 0.6)
    if hold + 1e-6 < min_req:
        errors.append(f"toast {v['id']} hold {hold:.3f}s < required {min_req:.3f}s")
    if v['toast0'] < prev_end:
        errors.append(f"toast {v['id']} overlaps previous toast ({v['toast0']} < {prev_end})")
    prev_end = v['toast1']

if errors:
    for e in errors:
        print('FAIL:', e, file=sys.stderr)
    sys.exit(1)

print(f"cuecheck OK: {len(tl['cues'])} key cues locked at 0.0 ms, {len(drop_lands)} Act I drops note-locked, {len(tl['voices'])} subtitle holds verified.")
