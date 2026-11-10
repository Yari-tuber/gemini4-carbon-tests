"""Original Cupertino Launch Film Score for 《Google Antigravity — 让创造，脱离引力》 (60.00 s, 120 BPM).
Uses CC0 sampled instruments (VSCO 2 CE upright piano, pizzicato & chamber strings; VCSL harp, vibraphone,
marimba, glockenspiel, hand chimes, hihat, claps, shaker; Karoryfer jazz_bass) + clean harmonic sub-bass.
"""
import json, os, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
LIB = os.environ.get('LIB', os.path.join(os.path.expanduser('~'), 'lemo-opuscar'))
if len(LIB) > 3 and LIB[0] == '/' and LIB[2] == '/':
    LIB = f'{LIB[1].upper()}:/{LIB[3:]}'
sys.path.insert(0, LIB)

from core.audio import sampler as S
from core.audio.sfx import SR, add, lp, hp

TL = json.load(open(os.path.join(PROJ, 'timeline.json'), encoding='utf-8'))
DUR = float(TL['dur'])
BEAT = float(TL['beat']) # 0.50 s
BAR = float(TL['bar'])   # 2.00 s
CUES = TL['cues']


def warm_sub(midi_pitch, dur, vel=0.5):
    f0 = 440.0 * (2.0 ** ((midi_pitch - 69.0) / 12.0))
    n = int(round((dur + 0.20) * SR))
    t = np.arange(n, dtype=np.float32) / SR
    att = np.minimum(1.0, t / 0.020)
    rel = np.exp(-np.maximum(0.0, t - dur * 0.70) / 0.24)
    tail = np.minimum(1.0, np.maximum(0.0, (dur + 0.20 - t) / 0.04))
    env = att * rel * tail
    sig = (
        0.55 * np.sin(2 * np.pi * f0 * t)
        + 0.35 * np.sin(2 * np.pi * (2 * f0) * t)
        + 0.16 * np.sin(2 * np.pi * (3 * f0) * t)
    )
    sig = lp(sig, min(850.0, f0 * 5.2))
    return (sig * env * vel * 0.21).astype(np.float32)


# 4-bar Apple uplifting progression: Fmaj9 -> G6 -> Am9 -> Cmaj9
PROG = [
    {'root': 'F2', 'sub': 41, 'voicing': ['F3', 'A3', 'C4', 'E4', 'G4'], 'arp': ['C5', 'E5', 'G5', 'A5']},
    {'root': 'G2', 'sub': 43, 'voicing': ['G3', 'B3', 'D4', 'E4', 'A4'], 'arp': ['D5', 'E5', 'G5', 'B5']},
    {'root': 'A2', 'sub': 45, 'voicing': ['A3', 'C4', 'E4', 'G4', 'B4'], 'arp': ['E5', 'G5', 'B5', 'C6']},
    {'root': 'C2', 'sub': 36, 'voicing': ['C3', 'G3', 'B3', 'D4', 'E4'], 'arp': ['E5', 'G5', 'B5', 'D6']},
]


def main():
    S.seed(2026)
    events = []
    sub_events = []
    cue_hits = {}

    def rec(cue_name, t_val):
        cue_hits[cue_name] = round(float(t_val), 4)

    # ── S1 (0.00 – 6.50 s, Bars 0..2): Airy Harp + Bowed Vibraphone + Felt Upright Piano ──
    for b in range(3):
        t0 = b * BAR
        ch = PROG[b % 4]
        events.append(dict(t=t0, inst='vibraphone_bowed', pitch=ch['voicing'][2], dur=1.85, vel=0.38, pan=-0.25, attack=0.25))
        for i, p in enumerate(ch['voicing']):
            events.append((t0 + i * 0.035, 'upright', p, 1.75, 0.46, -0.10 + i * 0.05))
        for step, p in enumerate(ch['arp']):
            events.append((t0 + step * BEAT, 'harp', p, 1.10, 0.44, 0.25 if step % 2 else -0.25))

    # Official Lockup Chime at CUES['logo_lock'] (2.00 s)
    events.append((CUES['logo_lock'], 'hand_chimes', 'C6', 2.2, 0.58, 0.0))
    events.append((CUES['logo_lock'] + 0.06, 'glockenspiel', 'G6', 1.8, 0.42, 0.15))
    rec('logo_lock', CUES['logo_lock'])

    # ── S2 & S3 (6.50 – 21.50 s): Crisp Apple Pizzicato + Upright Piano + Vibraphone Groove ──
    rec('s2_cut', CUES['s2_cut'])
    rec('s3_cut', CUES['s3_cut'])
    bar_starts_day = np.arange(6.50, 21.50, BAR)
    for idx, t0 in enumerate(bar_starts_day):
        bar_end = min(21.50, t0 + BAR)
        ch = PROG[idx % 4]
        # Warm upright chord on beat 1 & syncopated beat 2.5
        for i, p in enumerate(ch['voicing'][:4]):
            events.append((t0 + i * 0.02, 'upright', p, 1.15, 0.48, -0.12 + i * 0.08))
        if t0 + 1.25 < bar_end:
            events.append((t0 + 1.25, 'upright', ch['voicing'][3], 0.65, 0.40, 0.12))
            events.append((t0 + 1.25, 'upright', ch['voicing'][4], 0.65, 0.40, 0.18))

        # Jazz pizzicato bass on beats 1 and 3
        events.append((t0, 'jazz_bass', ch['root'], 0.85, 0.52, 0.0))
        if t0 + 1.0 < bar_end:
            events.append((t0 + 1.0, 'jazz_bass', ch['root'], 0.75, 0.46, 0.0))

        # Buoyant Apple chamber pizzicato & vibraphone 8th-note pulse
        n_eighths = int(round((bar_end - t0) / 0.25))
        for e in range(n_eighths):
            te = t0 + e * 0.25
            p_note = ch['voicing'][(e * 2) % len(ch['voicing'])]
            if e % 2 == 0:
                events.append((te, 'violins_pizz', p_note, 0.35, 0.42, -0.28 if (e // 2) % 2 == 0 else 0.28))
            else:
                events.append((te, 'vibraphone', ch['arp'][e % 4], 0.55, 0.34, 0.20))
            # Pocket hi-hat & shaker starting in S3 (13.50 s)
            if te >= 13.50:
                events.append((te, 'shaker', 'down' if e % 2 == 0 else 'up', None, 0.24, 0.18))
                if e % 2 == 0:
                    events.append((te, 'hihat', 'closed', None, 0.28, -0.15))
                if e == 6: # crisp rim tap on beat 4
                    events.append((te, 'snare2', 'taps', None, 0.34, 0.05))

    # Tab jump bell sparkles in S3
    events.append((CUES['tab_jump1'], 'glockenspiel', 'E6', 1.1, 0.46, 0.2))
    events.append((CUES['tab_jump2'], 'glockenspiel', 'G6', 1.1, 0.48, 0.25))
    rec('tab_jump1', CUES['tab_jump1'])
    rec('tab_jump2', CUES['tab_jump2'])

    # ── S4 (21.50 – 29.50 s): Multi-Agent Polyphonic Lift (Marimba + Strings + Upright) ──
    rec('s4_cut', CUES['s4_cut'])
    for idx, t0 in enumerate(np.arange(21.50, 29.50, BAR)):
        ch = PROG[idx % 4]
        dur_hold = min(1.80, 29.38 - t0)
        if dur_hold <= 0.2:
            continue
        events.append(dict(t=t0, inst='violins', pitch=ch['voicing'][3], dur=dur_hold, vel=0.36, pan=-0.30, attack=0.30, release=0.08))
        events.append(dict(t=t0, inst='cellos',  pitch=ch['voicing'][0], dur=dur_hold, vel=0.38, pan=0.30,  attack=0.25, release=0.08))
        sub_events.append((t0, ch['sub'], min(1.6, dur_hold), 0.45))

        for e in range(8):
            te = t0 + e * 0.25
            if te >= 29.25:
                break
            events.append((te, 'marimba', ch['voicing'][e % 5], 0.35, 0.46, -0.25 + (e % 4) * 0.16))
            if e % 2 == 0:
                events.append((te, 'hihat', 'closed', None, 0.30, -0.15))
            if e in (2, 6):
                events.append((te, 'snare2', 'taps', None, 0.36, 0.06))

    # Subagent spawn chimes
    for nm, pt in [('sub_spawn1', 'C6'), ('sub_spawn2', 'E6'), ('sub_spawn3', 'G6')]:
        events.append((CUES[nm], 'hand_chimes', pt, 0.9, 0.46, -0.15))
        rec(nm, CUES[nm])

    # ── SILENCE [29.50, 30.50]: Zero notes! Followed by Pro Space Black Drop at 30.50 s! ──
    rec('pro_drop', CUES['pro_drop'])
    events.append((CUES['pro_drop'], 'vibraphone_hard', 'F4', 2.0, 0.64, -0.15))
    events.append((CUES['pro_drop'], 'vibraphone_hard', 'C5', 2.0, 0.62, 0.15))
    events.append((CUES['pro_drop'], 'upright', 'F2', 2.0, 0.65, 0.0))

    # ── S5 & S6 (30.50 – 46.50 s): Sleek Space Black Pro Groove ──
    rec('browser_in', CUES['browser_in'])
    rec('s6_cut', CUES['s6_cut'])
    for idx, t0 in enumerate(np.arange(30.50, 46.50, BAR)):
        ch = PROG[idx % 4]
        sub_events.append((t0, ch['sub'], 1.75, 0.62))
        events.append(dict(t=t0, inst='cellos', pitch=ch['voicing'][0], dur=1.80, vel=0.38, pan=0.22, attack=0.22))
        for i, p in enumerate(ch['voicing'][:4]):
            events.append((t0 + i * 0.02, 'vibraphone', p, 1.35, 0.44, -0.18 + i * 0.12))

        for e in range(8):
            te = t0 + e * 0.25
            if te >= 46.42:
                break
            events.append((te, 'hihat', 'closed', None, 0.30 if e % 2 == 0 else 0.20, -0.16))
            if e in (2, 6):
                events.append((te, 'claps', 'solo', None, 0.34, 0.08))
            if e % 2 == 1:
                events.append((te, 'marimba', ch['arp'][(e // 2) % 4], 0.40, 0.36, 0.22))

    # Browser verification chime at 36.00 s
    events.append((CUES['browser_click'], 'hand_chimes', 'A5', 1.4, 0.52, 0.25))
    rec('browser_click', CUES['browser_click'])

    # ── S7 (46.50 – 53.50 s): Sunlit Apple Bento Grid Resolution ──
    rec('bento_cut', CUES['bento_cut'])
    bento_notes = ['F5', 'G5', 'A5', 'C6', 'D6', 'E6']
    for i, nm in enumerate(['bento_1', 'bento_2', 'bento_3', 'bento_4', 'bento_5', 'bento_6']):
        tb = CUES[nm]
        events.append((tb, 'glockenspiel', bento_notes[i], 1.3, 0.52, -0.25 + i * 0.10))
        events.append((tb, 'vibraphone_hard', bento_notes[i], 1.2, 0.48, -0.20 + i * 0.08))
        rec(nm, tb)

    for idx, t0 in enumerate(np.arange(46.50, 53.50, BAR)):
        bar_end = min(53.50, t0 + BAR)
        ch = PROG[idx % 4]
        dur_h = bar_end - t0 - 0.05
        if dur_h <= 0.3:
            continue
        sub_events.append((t0, ch['sub'], dur_h, 0.55))
        events.append(dict(t=t0, inst='violins', pitch=ch['voicing'][4], dur=dur_h, vel=0.44, pan=-0.32, attack=0.25))
        events.append(dict(t=t0, inst='cellos',  pitch=ch['voicing'][0], dur=dur_h, vel=0.44, pan=0.32,  attack=0.22))
        for i, p in enumerate(ch['voicing']):
            events.append((t0 + i * 0.025, 'upright', p, dur_h, 0.54, -0.15 + i * 0.07))
        for step in range(int(dur_h / 0.25)):
            ts = t0 + step * 0.25
            events.append((ts, 'harp', ch['arp'][step % 4], 0.9, 0.40, -0.22 if step % 2 else 0.22))

    # ── S8 (53.50 – 60.00 s): Warm Cmaj9 Gallery Finale Decay ──
    rec('finale_open', CUES['finale_open'])
    rec('finale_glint', CUES['finale_glint'])
    fin_chord = ['C3', 'G3', 'B3', 'D4', 'E4', 'G4']
    for i, p in enumerate(fin_chord):
        events.append((53.50 + i * 0.045, 'upright', p, 5.6, 0.56, -0.18 + i * 0.07))
        events.append((53.55 + i * 0.060, 'harp',    p, 5.2, 0.46, 0.20 - i * 0.06))
    events.append(dict(t=53.50, inst='vibraphone_bowed', pitch='E5', dur=4.8, vel=0.40, pan=-0.20, attack=0.35))
    events.append(dict(t=53.50, inst='cellos', pitch='C3', dur=5.0, vel=0.38, pan=0.20, attack=0.30))
    sub_events.append((53.50, 36, 4.6, 0.48))

    # Specular glint shimmer at 55.00 s
    events.append((CUES['finale_glint'], 'hand_chimes', 'E6', 3.5, 0.52, -0.10))
    events.append((CUES['finale_glint'] + 0.08, 'glockenspiel', 'B6', 3.2, 0.44, 0.15))

    # Render sampled score + room reverb
    mix = S.render(events, dur=DUR, master=False)
    mix = S.room(mix, size=0.52, mix=0.20, predelay=0.018, damp=0.45)

    # Add clean harmonic sub-bass
    for ts, midi_p, dur_s, vel in sub_events:
        add(mix, warm_sub(midi_p, dur_s, vel), ts, gain=1.0, pan=0.0)

    # Enforce hard digital zero in midpoint silence [29.50, 30.50] with smooth 35ms pre-fade
    s0, s1 = int(round(29.50 * SR)), int(round(30.50 * SR))
    fade_n = int(round(0.035 * SR))
    ramp = np.linspace(1.0, 0.0, fade_n, dtype=np.float32)[:, None]
    mix[s0 - fade_n:s0] *= ramp
    mix[s0:s1] = 0.0

    # Gentle 0.8s fade-out at 59.20..60.00 s
    f_end = int(round(0.80 * SR))
    mix[-f_end:] *= np.linspace(1.0, 0.0, f_end, dtype=np.float32)[:, None]

    pk = float(np.max(np.abs(mix)))
    if pk > 0.92:
        mix *= (0.92 / pk)

    # Check 20-120 Hz vs >120 Hz balance
    mono = mix.mean(axis=1)
    lo = hp(lp(mono, 120.0), 20.0)
    hi = hp(mono, 120.0)
    db_lo = 20 * np.log10(np.sqrt(np.mean(lo ** 2)) + 1e-9)
    db_hi = 20 * np.log10(np.sqrt(np.mean(hi ** 2)) + 1e-9)
    print(f'score band check: 20-120Hz = {db_lo:.1f} dB, >120Hz = {db_hi:.1f} dB (diff = {db_lo - db_hi:.1f} dB)')

    os.makedirs(HERE, exist_ok=True)
    out_wav = os.path.join(HERE, 'score.wav')
    sf.write(out_wav, mix, SR)
    with open(os.path.join(HERE, 'score.json'), 'w', encoding='utf-8') as f:
        json.dump({'cues': cue_hits, 'instruments': ['upright', 'harp', 'vibraphone', 'vibraphone_hard', 'vibraphone_bowed', 'marimba', 'glockenspiel', 'hand_chimes', 'violins', 'violins_pizz', 'cellos', 'jazz_bass', 'hihat', 'snare2', 'claps', 'shaker']}, f, indent=2)
    print(f'wrote {out_wav} ({DUR:.2f}s, peak={float(np.max(np.abs(mix))):.3f})')


if __name__ == '__main__':
    main()
