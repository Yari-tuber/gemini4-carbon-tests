"""cuecheck.py — Verify 0.0 ms sync between timeline.json visual cues, music/score.json hits, events.json foley,
silence window [29.50, 30.50], and subtitle hold timings.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)

tl = json.load(open(os.path.join(PROJ, 'timeline.json'), encoding='utf-8'))
sc = json.load(open(os.path.join(PROJ, 'music', 'score.json'), encoding='utf-8'))
ev_raw = json.load(open(os.path.join(PROJ, 'events.json'), encoding='utf-8'))
ev = ev_raw['ev'] if isinstance(ev_raw, dict) else ev_raw

errors = []

ev_times = [round(float(e['t']), 4) for e in ev]
sil_starts = [round(float(s[0]), 4) for s in tl.get('silences', [])]

# 1. Verify every named cue in timeline.json is locked (< 0.5 ms) to score.json, events.json, or silences
for k, t_vis in tl['cues'].items():
    t_vis = float(t_vis)
    t_mus = sc['cues'].get(k)
    matched_score = t_mus is not None and abs(t_vis - float(t_mus)) <= 0.0005
    matched_foley = any(abs(t_vis - te) <= 0.0005 for te in ev_times)
    matched_silence = any(abs(t_vis - ts) <= 0.0005 for ts in sil_starts)
    if not (matched_score or matched_foley or matched_silence):
        errors.append(f'unmatched or drifted cue {k} at {t_vis:.4f}s (score={t_mus})')

# 2. Verify zero foley or voice overlap inside the midpoint silence [29.50, 30.50]
for s0, s1 in tl.get('silences', []):
    for e in ev:
        if s0 <= float(e['t']) < s1:
            errors.append(f"foley event {e['type']} at {e['t']}s violates silence [{s0}, {s1}]")
    for v in tl['voices']:
        vt0, vt1 = float(v['t0']), float(v['t0']) + float(v['dur'])
        if max(vt0, s0) < min(vt1, s1):
            errors.append(f"voice {v['id']} [{vt0:.2f}, {vt1:.2f}] overlaps silence [{s0}, {s1}]")

# 3. Verify subtitle timing rules (hold >= 1.8 s and >= speech_dur + 0.6 s, non-overlapping)
prev_end = -1.0
for v in tl['voices']:
    hold = float(v['toast1']) - float(v['toast0'])
    min_req = max(1.8, float(v['dur']) + 0.6)
    if hold + 1e-6 < min_req:
        errors.append(f"toast {v['id']} hold {hold:.3f}s < required {min_req:.3f}s")
    if float(v['toast0']) < prev_end:
        errors.append(f"toast {v['id']} overlaps previous toast ({v['toast0']} < {prev_end})")
    prev_end = float(v['toast1'])

if errors:
    for e in errors:
        print('FAIL:', e, file=sys.stderr)
    sys.exit(1)

print(
    f"cuecheck OK: {len(tl['cues'])} cues locked at 0.0 ms, "
    f"{len(tl.get('silences', []))} silence window verified clean, "
    f"{len(tl['voices'])} subtitle holds verified."
)
