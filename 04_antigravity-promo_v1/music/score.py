"""Original score for 《反重力 · ANTIGRAVITY》 (48.00 s, 120 BPM).
Uses VCSL (CC0) sampled tuned percussion & bowed vibraphone + clean harmonic sub-bass synthesis.
Writes music/score.wav and music/score.json (exact cue timestamps for cuecheck.py).
"""
import json, os, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
LIB = os.environ.get('LIB', os.path.join(os.path.expanduser('~'), 'lemo-opuscar'))
sys.path.insert(0, LIB)

from core.audio import sampler as S
from core.audio.sfx import SR, add, lp, hp

TL = json.load(open(os.path.join(PROJ, 'timeline.json'), encoding='utf-8'))
DUR = float(TL['dur'])
BEAT = float(TL['beat'])
CUES = TL['cues']


def warm_sub(midi_pitch, dur, vel=0.5):
    """Clean keynote bass note with 2nd & 3rd harmonics so it speaks on small speakers without muddying 20-120 Hz."""
    f0 = 440.0 * (2.0 ** ((midi_pitch - 69.0) / 12.0))
    n = int(round((dur + 0.25) * SR))
    t = np.arange(n, dtype=np.float32) / SR
    att = np.minimum(1.0, t / 0.018)
    rel = np.exp(-np.maximum(0.0, t - dur * 0.65) / 0.28)
    tail = np.minimum(1.0, np.maximum(0.0, (dur + 0.25 - t) / 0.04))
    env = att * rel * tail
    sig = (
        0.58 * np.sin(2 * np.pi * f0 * t)
        + 0.36 * np.sin(2 * np.pi * (2 * f0) * t)
        + 0.16 * np.sin(2 * np.pi * (3 * f0) * t)
    )
    sig = lp(sig, min(900.0, f0 * 5.5))
    return (sig * env * vel * 0.22).astype(np.float32)


def main():
    S.seed(42)
    events = []
    cue_hits = {}

    # ── 1. S1–S2 (0.00 – 11.00 s): Earthbound low-register scattered drops ──
    # Opening '9.8' glyph locks (0.25, 0.375, 0.50 s)
    for key, pitch, pan in [
        ('lock_9', 49, -0.15),      # C#3
        ('lock_dot1', 44, 0.0),     # G#2
        ('lock_8', 42, 0.15),       # F#2
    ]:
        t = CUES[key]
        events.append((t, 'marimba', pitch, 0.35, 0.56, pan))
        cue_hits[key] = t

    # Every falling block in Act I spawns on a slightly detuned low marimba/woodblock note
    rng = np.random.default_rng(19)
    low_pool = [42, 44, 45, 47, 49, 50]  # F#2 G#2 A2 B2 C#3 D3 (Phrygian/minor weight)
    drop_note_times = []
    for i, d in enumerate(TL['drops']):
        t = float(d['tLand'])
        detune = float(rng.uniform(-0.32, 0.32))
        pan = float(rng.uniform(-0.55, 0.55))
        base_m = low_pool[i % len(low_pool)] + (2 if i > 13 else 0)
        vel = min(0.72, 0.42 + i * 0.014)
        events.append((t, 'marimba', base_m + detune, 0.24, vel, pan))
        if d['sev'] and i >= 6:
            events.append((t, 'woodblock', 'b', 0.12, vel * 0.38, -pan * 0.7))
        drop_note_times.append(round(t, 4))

    # Transition collapse at 4.50 s
    cue_hits['s1_collapse'] = CUES['s1_collapse']
    events.append((CUES['s1_collapse'], 'marimba', 42, 0.45, 0.62, 0.0))

    # ── 2. S3 (11.00 – 17.00 s): Digital Zero Freeze -> Ignition -> Intent ──
    cue_hits['freeze_start'] = CUES['freeze_start']

    # 12.25 s: First musical sound after 1.25 s of Digital Zero!
    t_ig = CUES['ignite_chime']
    cue_hits['ignite_chime'] = t_ig
    events.append((t_ig, 'vibraphone', 'F#4', 2.4, 0.68, 0.0))
    events.append((t_ig, 'hand_chimes', 'C#5', 2.2, 0.42, 0.08))

    # 12.50 s: Console open soft confirmation
    cue_hits['console_open'] = CUES['console_open']
    events.append((CUES['console_open'], 'vibraphone', 'C#5', 1.4, 0.44, -0.1))

    # 13.00 – 15.75 s: Clean centred 8th-note marimba focus pulse (F#3 - C#4 - G#4 - A#4)
    focus_notes = ['F#3', 'C#4', 'G#4', 'C#4', 'A#4', 'C#4', 'G#4', 'C#4']
    for k in range(12):
        tt = 13.00 + k * 0.25
        events.append((tt, 'marimba', focus_notes[k % len(focus_notes)], 0.22, 0.42 + 0.01 * k, (-0.12 if k % 2 == 0 else 0.12)))

    # 16.00 s: Execute press -> Warm F# add9 chord + ascending 16th pickup into S4!
    t_ex = CUES['exec_press']
    cue_hits['exec_press'] = t_ex
    for p, v, pn in [('F#4', 0.72, -0.2), ('A#4', 0.66, 0.15), ('C#5', 0.68, -0.1), ('G#5', 0.56, 0.22)]:
        events.append((t_ex, 'vibraphone', p, 1.8, v, pn))
    events.append((t_ex, 'glockenspiel', 'F#6', 1.6, 0.36, 0.0))
    for k, p in enumerate(['F#4', 'G#4', 'A#4', 'C#5']):
        events.append((16.50 + k * 0.125, 'marimba', p, 0.25, 0.52 + k * 0.04, -0.2 + k * 0.13))

    # ── 3. S4 (17.00 – 27.00 s): Vertical Crane Ascent & 22.00 s Snap Grid ──
    cue_hits['crane_ascent'] = CUES['crane_ascent']
    # Rising octave arpeggios from 17.00 to 21.75 s (20 eighth-note steps -> climbing register!)
    ascent_arp = [
        # Bar 1 (17.0 - 19.0): Octave 3-4
        'F#3', 'C#4', 'F#4', 'G#4', 'A#4', 'C#5', 'G#4', 'A#4',
        # Bar 2 (19.0 - 21.0): Octave 4-5
        'B3',  'F#4', 'A#4', 'C#5', 'D#5', 'F#5', 'C#5', 'D#5',
        # Half-bar (21.0 - 22.0): Climax climb to Octave 5-6
        'C#4', 'G#4', 'C#5', 'F#5',
    ]
    for k, p in enumerate(ascent_arp):
        tt = 17.00 + k * 0.25
        events.append((tt, 'marimba', p, 0.28, 0.56 + 0.008 * k, -0.22 if k % 2 == 0 else 0.22))
        if k % 2 == 1:
            events.append((tt, 'vibraphone', p, 0.55, 0.44, 0.18 if k % 4 == 1 else -0.18))
        events.append((tt, 'shaker', 'up' if k % 2 else 'down', 0.12, 0.18, 0.08))

    # 22.00 s (Beat 44): THE SNAP GRID — Full radiant F# Maj9 (#11) ensemble lock!
    t_snap = CUES['snap_grid']
    cue_hits['snap_grid'] = t_snap
    for p, v, pn in [
        ('F#3', 0.72, 0.0),
        ('C#4', 0.70, -0.25),
        ('F#4', 0.74, 0.25),
        ('A#4', 0.68, -0.18),
        ('C#5', 0.70, 0.18),
        ('G#5', 0.64, 0.0),
    ]:
        events.append((t_snap, 'vibraphone', p, 2.8, v, pn))
    events.append((t_snap, 'marimba', 'F#4', 0.6, 0.76, -0.1))
    events.append((t_snap, 'marimba', 'C#5', 0.6, 0.74, 0.1))
    events.append((t_snap, 'glockenspiel', 'F#6', 2.5, 0.48, 0.05))
    events.append((t_snap, 'hand_chimes', 'C#6', 2.4, 0.44, -0.08))
    events.append(dict(t=t_snap, inst='vibraphone_bowed', pitch='A#4', dur=3.6, vel=0.45, pan=-0.25, attack=0.25))
    events.append(dict(t=t_snap, inst='vibraphone_bowed', pitch='F#5', dur=3.6, vel=0.42, pan=0.25, attack=0.25))

    # 22.50 – 26.75 s: Weightless ordered Lydian pulse
    lydian_loop = ['F#4', 'C#5', 'G#5', 'A#4', 'D#5', 'C#5', 'A#4', 'G#4']
    for k in range(17):
        tt = 22.50 + k * 0.25
        p = lydian_loop[k % len(lydian_loop)]
        events.append((tt, 'marimba', p, 0.24, 0.44, -0.15 if k % 2 == 0 else 0.15))
        if k % 4 == 0:
            events.append((tt, 'vibraphone', p, 0.9, 0.42, 0.0))

    # ── 4. S5 (27.00 – 33.00 s): 2.5D Studio Light Reveal (with 26.65 s J-cut!) ──
    cue_hits['studio_open'] = CUES['studio_open']
    cue_hits['studio_dive'] = CUES['studio_dive']
    # J-cut bowed vibraphone entering 0.35 s early at 26.65 s
    events.append(dict(t=26.65, inst='vibraphone_bowed', pitch='F#4', dur=5.6, vel=0.50, pan=-0.28, attack=0.35))
    events.append(dict(t=26.65, inst='vibraphone_bowed', pitch='C#5', dur=5.6, vel=0.46, pan=0.28, attack=0.35))
    events.append(dict(t=27.00, inst='vibraphone_bowed', pitch='G#5', dur=5.0, vel=0.38, pan=0.0, attack=0.40))

    studio_bells = [
        (27.00, 'vibraphone', 'A#4', 1.8, 0.52, -0.15),
        (27.50, 'vibraphone', 'C#5', 1.8, 0.48, 0.15),
        (28.00, 'hand_chimes', 'F#5', 2.0, 0.40, 0.0),
        (29.00, 'vibraphone', 'G#4', 1.8, 0.46, -0.2),
        (29.50, 'vibraphone', 'D#5', 1.8, 0.46, 0.2),
        (30.00, 'glockenspiel', 'C#6', 1.8, 0.34, 0.1),
        (31.00, 'vibraphone', 'A#4', 1.5, 0.44, -0.1),
        (31.50, 'vibraphone', 'F#5', 1.2, 0.46, 0.1),
    ]
    events.extend(studio_bells)

    # ── 5. S6 (33.00 – 38.00 s): Near-Silence #2 -> Giant '0.0 G' Bell Locks ──
    cue_hits['zerog_silence'] = CUES['zerog_silence']
    for key, gl_p, vb_p, pn in [
        ('lock_0a',   'C#6', 'F#4', -0.16),
        ('lock_dot2', 'F#6', 'A#4',  0.00),
        ('lock_0b',   'G#6', 'C#5',  0.16),
    ]:
        t = CUES[key]
        cue_hits[key] = t
        events.append((t, 'glockenspiel', gl_p, 2.8, 0.50, pn))
        events.append((t, 'vibraphone', vb_p, 3.4, 0.60, -pn))

    # L-cut harmonic bridge from 34.25 s across 38.00 s into S7
    events.append(dict(t=34.25, inst='vibraphone_bowed', pitch='F#4', dur=4.5, vel=0.44, pan=-0.22, attack=0.5))
    events.append(dict(t=34.25, inst='vibraphone_bowed', pitch='C#5', dur=4.5, vel=0.40, pan=0.22, attack=0.5))

    # ── 6. S7 (38.00 – 48.00 s): Panoramic Orbital Wide & Serene Resolution ──
    cue_hits['orbit_open'] = CUES['orbit_open']
    cue_hits['hero_sweep'] = CUES['hero_sweep']

    events.append(dict(t=37.80, inst='vibraphone_bowed', pitch='F#4', dur=8.2, vel=0.48, pan=-0.30, attack=0.45))
    events.append(dict(t=37.80, inst='vibraphone_bowed', pitch='A#4', dur=8.2, vel=0.42, pan=0.30, attack=0.45))
    events.append(dict(t=38.50, inst='vibraphone_bowed', pitch='F#5', dur=7.2, vel=0.38, pan=0.0, attack=0.50))

    # Sparse crystalline orbital breath notes
    finale_notes = [
        (38.00, 'vibraphone', 'F#4', 2.6, 0.52, -0.15),
        (38.50, 'glockenspiel', 'C#6', 2.8, 0.40, 0.12),
        (39.50, 'vibraphone', 'C#5', 2.4, 0.46, 0.15),
        (40.50, 'hand_chimes', 'G#5', 2.6, 0.38, -0.10),
        (42.00, 'vibraphone', 'A#4', 2.8, 0.44, -0.18),
        (43.50, 'vibraphone', 'F#4', 3.8, 0.50, -0.12),
        (43.50, 'vibraphone', 'C#5', 3.8, 0.48, 0.12),
        (43.50, 'hand_chimes', 'F#5', 3.8, 0.42, 0.0),
        (44.00, 'glockenspiel', 'F#6', 3.6, 0.38, 0.0),
    ]
    events.extend(finale_notes)

    # Render sampled instruments + airy room
    mix = S.render(events, dur=DUR, master=False)
    mix = S.room(mix, size=0.48, mix=0.20, predelay=0.018, damp=0.45)

    # Add clean harmonic sub-bass notes (with 2nd/3rd harmonics, balanced low end)
    bass_notes = [
        (16.00, 42, 1.0, 0.62),  # F#2 execute
        (17.00, 42, 1.9, 0.54),  # F#2 ascent bar 1
        (19.00, 47, 1.9, 0.54),  # B2  ascent bar 2
        (21.00, 49, 0.9, 0.56),  # C#3 ascent pre-snap
        (22.00, 42, 2.4, 0.68),  # F#2 SNAP GRID
        (24.50, 47, 2.2, 0.50),  # B2
        (27.00, 42, 2.8, 0.52),  # F#2 studio reveal
        (30.00, 49, 2.5, 0.46),  # C#3
        (34.25, 42, 3.4, 0.56),  # F#2 0.0 G lock
        (38.00, 42, 3.8, 0.52),  # F#2 orbital open
        (43.50, 42, 3.8, 0.48),  # F#2 final resolution
    ]
    for bt, bm, bdur, bvel in bass_notes:
        add(mix, warm_sub(bm, bdur, bvel), bt, gain=1.0, pan=0.0)

    # Enforce hard Digital Zero in [11.00, 12.25] and clean Score Silence in [33.00, 33.50]
    for s0, s1 in [(11.00, 12.25), (33.00, 33.50)]:
        i0, i1 = int(round(s0 * SR)), int(round(s1 * SR))
        fade = int(round(0.012 * SR))
        if i0 - fade >= 0:
            ramp = np.linspace(1.0, 0.0, fade, dtype=np.float32)[:, None]
            mix[i0 - fade:i0] *= ramp
        mix[i0:i1] = 0.0

    # Gentle fade-out over the final 0.5 s to digital zero at 48.00 s
    f_end = int(round(0.55 * SR))
    mix[-f_end:] *= np.linspace(1.0, 0.0, f_end, dtype=np.float32)[:, None]

    # Measure low-end balance (20-120 Hz vs >120 Hz)
    mono = mix.mean(axis=1)
    lo = lp(hp(mono, 20), 120)
    hi = hp(mono, 120)
    lo_db = 20 * np.log10(np.sqrt(np.mean(lo ** 2)) + 1e-9)
    hi_db = 20 * np.log10(np.sqrt(np.mean(hi ** 2)) + 1e-9)
    print(f'score band check: 20-120Hz = {lo_db:.1f} dB, >120Hz = {hi_db:.1f} dB (diff = {lo_db - hi_db:+.1f} dB)')

    peak = float(np.abs(mix).max())
    if peak > 0.92:
        mix *= (0.92 / peak)

    out_wav = os.path.join(HERE, 'score.wav')
    sf.write(out_wav, mix, SR)
    with open(os.path.join(HERE, 'score.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'cues': cue_hits,
            'drop_notes': drop_note_times,
            'instruments_used': ['marimba', 'vibraphone', 'vibraphone_bowed', 'glockenspiel', 'hand_chimes', 'shaker', 'woodblock'],
        }, f, indent=2)
    print(f'wrote {out_wav} ({DUR:.2f}s, peak={float(np.abs(mix).max()):.3f})')


if __name__ == '__main__':
    main()
