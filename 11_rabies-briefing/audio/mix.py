# -*- coding: utf-8 -*-
"""Score, procedural foley, and master mix for "rabies-briefing" → out/mix.wav (48 kHz stereo) + stems.
Reads scenes/film.json (dur, cues, synchronized visual/sound events) and audio/vo/*.wav.

Palette (100% CC0 1.0 sampled instruments via core/audio/sampler.py — zero piano, zero string pad):
- Bass: jazz_bass (Karoryfer Sneakybass), contrabass (VSCO2 CE)
- Groove & Clockwork: cajon, snare2, hihat, claves, woodblock, shaker, marimba (VCSL / VSCO2 CE)
- Brass & Symphonic Weight: trombone, trombone_stac, tuba, tuba_stac, horn, horn_stac, timpani, gran_cassa, sus_cymbal
- Pitched Bell Accents: vibraphone_hard, vibraphone, tubular_bells, glockenspiel
- Harmonic Arc: 120 BPM, C minor / Dorian clinical tension resolving to luminous C major at the whole-wall reveal.
"""
import json, os, sys
from pathlib import Path
import numpy as np
import soundfile as sf
import soxr
from scipy.ndimage import maximum_filter1d, uniform_filter1d

HERE = Path(__file__).resolve().parent
DEMO = HERE.parent
LIB = os.environ.get("LIB") or os.path.join(os.path.expanduser("~"), "lemo-opuscar")
sys.path.insert(0, LIB)

from core.audio import sampler as S
from core.audio.sfx import SR, add, bp, brown, clack, compress, env_exp, hp, lp, noise, norm, t_, thump, whoosh

S.seed(29)
rng = np.random.default_rng(17)

scene = json.loads((DEMO / "scenes" / "film.json").read_text(encoding="utf-8"))
DUR = float(scene["dur"])
EV = scene["ev"]
C = scene["cues"]
N = int((DUR + 1.5) * SR)
B = 0.5  # 120 BPM quarter-note beat = 0.500 s, bar = 2.000 s

SIL = [tuple(C["sil1"]), tuple(C["sil2"])]
STAMP1 = float(C["stamp1"])
STAMP2 = float(C["stamp2"])
VERDICT = float(C["verdict"])
REVEAL = float(C["reveal"])


def silent(t: float, pad: float = 0.0) -> bool:
    return any(a - pad <= t < b for a, b in SIL)


music = np.zeros((N, 2), np.float32)
fx = np.zeros((N, 2), np.float32)
amb = np.zeros((N, 2), np.float32)
vo = np.zeros((N, 2), np.float32)

# ================================================================= 1. SCORE
score_ev = []


def note(t: float, inst: str, p, d: float, v: float, pan: float = 0.0, **kw):
    if t < 0 or t >= DUR:
        return
    for a, b in SIL:
        if t < a < t + d:
            d = max(0.05, a - t - 0.03)
        if a <= t < b:
            return
    score_ev.append(dict(t=float(t), inst=inst, pitch=p, dur=float(d), vel=float(v), pan=float(pan), **kw))


def hit(t: float, inst: str, var, v: float, gain: float = 1.0, pan: float = 0.0):
    if silent(t) or t < 0 or t >= DUR:
        return
    x = S.hit(inst, var, float(v))
    add(music, x, float(t), float(gain), float(pan))


CHORDS = {
    "Cm": ["C3", "Eb3", "G3"],
    "Ab": ["Ab2", "C3", "Eb3"],
    "Bb": ["Bb2", "D3", "F3"],
    "Gm": ["G2", "Bb2", "D3"],
    "Fm": ["F2", "Ab2", "C3"],
    "Eb": ["Eb3", "G3", "Bb3"],
    "G":  ["G2", "B2", "D3"],
    "Gsus": ["G2", "C3", "D3"],
    "C":  ["C3", "E3", "G3"],
}

PROG_ACT1 = [
    ("C2", "Cm"), ("C2", "Cm"), ("Ab1", "Ab"), ("Bb1", "Bb"),
    ("C2", "Cm"), ("Eb2", "Eb"), ("Ab1", "Ab"), ("G1", "G"),
    ("C2", "Cm"), ("Bb1", "Bb"), ("Ab1", "Ab"), ("Gm1", "Gm"),
]
# Fix Gm1 root name -> G1
PROG_ACT1 = [(r.replace("Gm1", "G1"), ch) for r, ch in PROG_ACT1]

PROG_ACT2 = [
    ("F1", "Fm"), ("C2", "Cm"), ("Ab1", "Ab"), ("Bb1", "Bb"),
    ("C2", "Cm"), ("Ab1", "Ab"), ("Fm1", "Fm"), ("G1", "G"),
]
PROG_ACT2 = [(r.replace("Fm1", "F1"), ch) for r, ch in PROG_ACT2]

PROG_ACT3 = [
    ("C2", "Cm"), ("Eb2", "Eb"), ("Ab1", "Ab"), ("Bb1", "Bb"),
    ("F1", "Fm"), ("C2", "Cm"), ("Ab1", "Ab"), ("G1", "Gsus"),
]

NBARS = int(DUR // 2.0) + 1


def bar_harmony(b_idx: int) -> tuple[str, str]:
    t0 = b_idx * 2.0
    if t0 >= REVEAL - 0.25:
        return ("C2", "C")
    if t0 < SIL[0][0]:
        return PROG_ACT1[b_idx % len(PROG_ACT1)]
    if t0 < 60.0:
        return PROG_ACT2[(b_idx - 18) % len(PROG_ACT2)]
    return PROG_ACT3[(b_idx - 30) % len(PROG_ACT3)]


# --- Bass & Clockwork Marimba / Groove ---
BASS_FIG = [0, 0, 12, 0, 0, 7, 12, 10]
CRAWL_START = float(C["L06"])
CRAWL_END = SIL[0][0]

for b_idx in range(NBARS):
    t0 = b_idx * 2.0
    if t0 >= SIL[1][0]:
        break
    root, ch = bar_harmony(b_idx)
    # Post-Stamp1 hush (36.5 .. 42.5 s): sparse ominous whole notes
    if SIL[0][1] <= t0 < 42.5:
        note(t0, "contrabass", root, 1.8, 0.44, 0.0, attack=0.06)
        note(t0, "jazz_bass", root, 0.9, 0.52, 0.0)
        if b_idx % 2 == 1:
            hit(t0 + 1.0, "toms", "low_mallet", 0.48, 0.65, -0.2)
        continue

    # Retrograde axonal crawl (L06..SIL1): chromatic creeping bass + marimba 16th pulse
    if CRAWL_START <= t0 < CRAWL_END:
        climb = ["C2", "C#2", "D2", "Eb2", "E2", "F2", "F#2", "G2"]
        for k in range(8):
            tk = t0 + k * 0.25
            if tk >= CRAWL_END:
                break
            p_cr = climb[(b_idx * 2 + k) % len(climb)]
            note(tk, "jazz_bass", p_cr, 0.20, 0.54, -0.05)
            note(tk, "marimba", S.midi(p_cr) + 24, 0.14, 0.36 if k % 2 == 0 else 0.24, 0.22 if k % 2 == 0 else -0.22)
            hit(tk, "shaker", "down" if k % 2 == 0 else "up", 0.26, 0.35, 0.35)
            if k in (2, 6):
                hit(tk, "woodblock", "a" if k == 2 else "b", 0.38, 0.28, -0.25)
        continue

    # Standard briefing room groove (Act I reservoirs, Act II judgement staircase, Act III PEP protocol)
    act3 = t0 >= 60.0
    act2 = 42.5 <= t0 < 60.0
    for k, iv in enumerate(BASS_FIG):
        tk = t0 + k * 0.25
        if tk >= SIL[1][0] or silent(tk):
            continue
        if act2 and k not in (0, 3, 4, 6):
            continue
        vel = (0.58 if k % 2 == 0 else 0.44) * (0.82 if tk < 4.0 else 1.0)
        note(tk, "jazz_bass", S.midi(root) + iv, 0.22 if k % 2 else 0.30, vel, 0.0)

    # Unpitched CC0 percussion groove (cajon + snare2 + hihat + claves/woodblock)
    for s in range(16):
        ts = t0 + s * 0.125
        if ts >= SIL[1][0] or silent(ts):
            continue
        if act2:
            if s in (0, 8):
                hit(ts, "cajon", "bass", 0.52, 0.72, 0.0)
            if s in (4, 12):
                hit(ts, "woodblock", "b", 0.40, 0.30, -0.2)
            if s % 4 == 0:
                hit(ts, "hihat", "closed", 0.26, 0.24, 0.32)
        elif act3:
            if s in (0, 6, 8, 10):
                hit(ts, "cajon", "bass", 0.64, 0.82, 0.0)
            if s in (4, 12):
                hit(ts, "snare2", "stick", 0.52, 0.46, -0.08)
            if s % 2 == 0:
                hit(ts, "hihat", "closed", 0.34 if s % 4 == 0 else 0.22, 0.28, 0.34)
            if s in (0, 3, 6, 10, 12):
                tone = CHORDS[ch][s % 3]
                note(ts, "marimba", S.midi(tone) + 12, 0.16, 0.30, -0.2 if s % 2 else 0.2)
        else:
            if s in (0, 6, 8):
                hit(ts, "cajon", "bass", 0.54, 0.75, 0.0)
            if s in (3, 7, 11, 14) and ts >= 1.0:
                hit(ts, "claves", None, 0.42, 0.30, 0.28)
            if ts >= 4.0 and s % 2 == 0:
                hit(ts, "hihat", "closed", 0.28 if s % 4 == 0 else 0.18, 0.25, 0.34)


def stab(t: float, ch_name: str, v: float = 0.58, root: str | None = None):
    for j, p in enumerate(CHORDS[ch_name]):
        note(t + j * 0.008, "trombone_stac", p, 0.28, v, -0.25 + 0.25 * j)
    if root:
        note(t, "tuba_stac", root, 0.34, v, 0.0)


# Opening 100% hook accent (t = 0.250 s)
stab(0.250, "Cm", 0.68, "C2")
hit(0.250, "toms", "low_mallet", 0.68, 0.75, -0.1)

# Synchronize brass/bell accents to visual events in scenes/film.json
for e in EV:
    et, ty, eid = float(e["t"]), e["type"], e.get("id", "")
    if ty == "land":
        r_b, c_b = bar_harmony(int(et // 2.0))
        stab(et, c_b, 0.48, r_b)
    elif ty == "strike":
        # Sour half-step low brass blat on struck-out "血液传播"
        note(et, "trombone_stac", "C3", 0.25, 0.60, -0.2)
        note(et + 0.01, "trombone_stac", "Db3", 0.25, 0.48, 0.2)
        note(et, "tuba_stac", "C2", 0.30, 0.52, 0.0)
    elif ty == "magnet" and eid.startswith("m_pep_"):
        # 5 ascending PEP vaccine schedule magnets (D0, D3, D7, D14, D28) -> pentatonic climb!
        k_idx = int(eid.split("_")[-1])
        p_climb = ["C5", "D5", "E5", "G5", "C6"][k_idx % 5]
        note(et, "vibraphone_hard", p_climb, 0.65, 0.42 + 0.03 * k_idx, -0.25 + 0.12 * k_idx)

# Silence 1 Climax: Heavy Blood-Brain Barrier Stamp ("发病无药可救")
stab(STAMP1, "Cm", 0.86, "C2")
hit(STAMP1, "timpani", "drum1", 0.85, 0.92, 0.0)
hit(STAMP1, "gran_cassa", "hit", 0.75, 0.82, 0.0)

# Category III Stamp ("加打球蛋白")
stab(STAMP2, "G", 0.76, "G1")
hit(STAMP2, "timpani", "drum3", 0.76, 0.80, 0.08)

# Silence 2 Resolution: Final Verdict Ring ("规范阻断 ≈100% 可防")
note(VERDICT, "vibraphone_hard", "C5", 1.1, 0.48, -0.18)
note(VERDICT + 0.125, "vibraphone_hard", "G5", 1.2, 0.44, 0.18)
note(VERDICT + 0.500, "horn", "G4", 2.4, 0.42, 0.0, attack=0.12)

# Pre-reveal warm bridge under L18 (95.5 .. 98.5 s)
for j, p in enumerate(["F2", "C3"]):
    note(float(C["L18"]) + j * 0.02, "trombone", p, 1.4, 0.34, -0.2 + 0.4 * j)
for j, p in enumerate(["G2", "D3"]):
    note(float(C["L18"]) + 1.5 + j * 0.02, "trombone", p, 1.4, 0.38, -0.2 + 0.4 * j)

# THE WHOLE-WALL REVEAL (98.500 s -> DUR): Luminous C Major Brass, Timpani & Bells
R = REVEAL
note(R, "tuba", "C2", 5.8, 0.68, 0.0)
note(R, "contrabass", "C2", 5.8, 0.50, 0.0, attack=0.20)
for j, p in enumerate(["C3", "G3"]):
    note(R + 0.02, "trombone", p, 5.4, 0.60, -0.35 + 0.70 * j)
for j, p in enumerate(["E4", "G4", "C5"]):
    note(R + 0.05 + j * 0.03, "horn", p, 5.2, 0.54, -0.30 + 0.30 * j, attack=0.22)
note(R, "tubular_bells", "C5", 4.2, 0.52, 0.22)
note(R + 1.0, "tubular_bells", "G4", 3.8, 0.36, -0.22)
hit(R, "timpani", "drum1", 0.82, 0.88, 0.0)
hit(R, "sus_cymbal", "cresc", 0.42, 0.34, 0.10)
for k, (dt, p) in enumerate([(2.0, "E6"), (2.5, "G6"), (3.25, "C6"), (4.0, "E6"), (4.75, "G6"), (5.5, "C7")]):
    if R + dt < DUR - 0.5:
        note(R + dt, "glockenspiel", p, 1.8, 0.22 - 0.015 * k, (-0.28, 0.28)[k % 2])
note(R + 3.0, "vibraphone", "G4", 2.4, 0.26, -0.20)
note(R + 4.25, "vibraphone", "C5", 2.2, 0.24, 0.20)

rendered_notes = [
    (e["t"], e["inst"], e["pitch"], e["dur"], e["vel"], e["pan"])
    if "attack" not in e
    else dict(t=e["t"], inst=e["inst"], pitch=e["pitch"], dur=e["dur"], vel=e["vel"], pan=e["pan"], attack=e["attack"])
    for e in score_ev
]
mus_buf = S.render(rendered_notes, dur=N / SR, master=False)
music[: len(mus_buf)] += mus_buf[:N]
music = S.room(music, size=0.36, mix=0.15)


def lp_sweep(x: np.ndarray, t0: float, t1: float, f0: float, f1: float):
    a, b = int(t0 * SR), int(t1 * SR)
    seg = x[a:b].copy()
    n = b - a
    if n <= 0:
        return
    out = np.zeros_like(seg)
    blk = 1024
    for i in range(0, n, blk):
        f = f0 * (f1 / f0) ** (i / n)
        chunk = seg[max(0, i - 4096) : i + blk]
        out[i : i + blk] = lp(chunk.T, f).T[-len(seg[i : i + blk]) :]
    x[a:b] = out


# Filter dive into Silence 1 right before the Blood-Brain Barrier Stamp
lp_sweep(music, SIL[0][0] - 1.75, SIL[0][0], 9000.0, 250.0)
for a, b in SIL:
    music[int(a * SR) : int(b * SR)] *= 0.0


# ================================================================= 2. PROCEDURAL FOLEY
def marker_sfx(d: float, kind: str = "line", seed: int = 0, v: float = 1.0) -> np.ndarray:
    d = max(0.08, float(d))
    r = np.random.default_rng(abs(int(seed)) + 1)
    n = int(d * SR)
    tt = np.arange(n) / SR
    bed = bp(r.standard_normal(n), 1800, 6400) * (0.5 + 0.5 * np.sin(2 * np.pi * (7 + r.random() * 5) * tt)) * 0.34
    x = bed.copy()
    count = int(d * (9 if kind == "write" else 4)) + 1
    for _ in range(count):
        st = r.uniform(0, max(0.01, d - 0.08))
        ln = r.uniform(0.035, min(0.12, d * 0.8))
        m = max(8, int(ln * SR))
        s0 = int(st * SR)
        f0 = r.uniform(1950, 3350)
        f = f0 * (1 + 0.16 * np.sin(np.linspace(0, np.pi * r.uniform(1, 3), m)))
        ph = 2 * np.pi * np.cumsum(f) / SR
        sq = (np.sin(ph) + 0.32 * np.sin(2 * ph) + 0.14 * np.sin(3 * ph)) * np.sin(np.linspace(0, np.pi, m)) ** 1.5
        take = max(0, min(m, n - s0))
        if take > 0:
            x[s0 : s0 + take] += sq[:take] * r.uniform(0.24, 0.56)
    fade = np.minimum(1.0, np.minimum(tt / 0.015, (d - tt) / 0.025))
    return (x * np.clip(fade, 0, 1) * v).astype(np.float32)


def nib_tap(v: float = 1.0, f: float = 1.0) -> np.ndarray:
    d = 0.06
    tt = t_(d)
    x = hp(noise(d), 2500) * env_exp(d, 0.002) + np.sin(2 * np.pi * 920 * f * tt) * env_exp(d, 0.008) * 0.6 + np.sin(2 * np.pi * 185 * tt) * env_exp(d, 0.02) * 0.4
    return (norm(x) * v).astype(np.float32)


def magnet_snap(v: float = 1.0, heavy: bool = False, pitch: float = 1.0) -> np.ndarray:
    d = 0.14
    tt = t_(d)
    tr = hp(noise(d), 3000) * env_exp(d, 0.0012)
    ring = sum(a * np.sin(2 * np.pi * f * pitch * tt) * env_exp(d, tau) for f, a, tau in [(3400, 0.35, 0.006), (1880, 0.30, 0.010)])
    body = np.sin(2 * np.pi * (145 if heavy else 215) * pitch * tt) * env_exp(d, 0.025) * (0.9 if heavy else 0.45)
    return (norm(tr + ring + body) * v).astype(np.float32)


def landing_sfx(v: float = 1.0, size: str = "mid") -> np.ndarray:
    d = 0.75
    tt = t_(d)
    f = 50 if size == "big" else 68
    low = np.sin(2 * np.pi * f * tt * (1 - 0.25 * tt)) * env_exp(d, 0.12 if size == "big" else 0.08)
    board = bp(noise(d), 150, 520) * env_exp(d, 0.06) * 0.8
    slap = hp(noise(d), 1200) * env_exp(d, 0.006) * 0.55
    return (norm(low * 1.15 + board + slap) * v).astype(np.float32)


def eraser_swipe(d: float) -> np.ndarray:
    d = max(0.2, float(d))
    n = len(t_(d))
    tt = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 550, 3800) * (0.65 + 0.35 * np.sin(2 * np.pi * 12 * tt))
    return (norm(x) * (np.sin(np.pi * tt / d) ** 0.7) * 0.65).astype(np.float32)


def steel_ruler_sfx(v: float = 1.0) -> np.ndarray:
    d = 1.05
    tt = t_(d)
    ring = sum(
        a * np.sin(2 * np.pi * f * tt + p) * env_exp(d, tau)
        for f, a, tau, p in [(528, 0.5, 0.34, 0), (1402, 0.4, 0.22, 1), (2730, 0.3, 0.14, 2), (4120, 0.2, 0.08, 0.5)]
    )
    ld = landing_sfx(1.0, "mid")
    ld = np.pad(ld, (0, max(0, len(tt) - len(ld))))[: len(tt)]
    out = norm(ring * 0.58 + ld * 0.82) * v
    m2 = magnet_snap(0.7, True)
    i0 = int(0.035 * SR)
    out[i0 : i0 + len(m2)] += m2[: len(out) - i0]
    return out.astype(np.float32)


def stamp_sfx(v: float = 1.0) -> np.ndarray:
    d = 0.62
    tt = t_(d)
    low = np.sin(2 * np.pi * 56 * tt * (1 - 0.3 * tt)) * env_exp(d, 0.095)
    squish = lp(noise(d), 920) * env_exp(d, 0.026) * 0.92
    slap = hp(noise(d), 1500) * env_exp(d, 0.004) * 0.72
    return (norm(low * 1.25 + squish + slap) * v).astype(np.float32)


def tap_water_sfx(d: float, v: float = 1.0) -> np.ndarray:
    """Running faucet stream + soapy splash droplets for the 15-minute wound irrigation J-cut."""
    n = int(d * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(73)
    stream = bp(r.standard_normal(n), 450, 3600) * 0.42 + bp(r.standard_normal(n), 1200, 6200) * 0.26
    t_cur = 0.05
    while t_cur < d - 0.15:
        ln = r.uniform(0.06, 0.22)
        m = int(ln * SR)
        s0 = int(t_cur * SR)
        splash = bp(r.standard_normal(m), r.uniform(600, 1100), r.uniform(2200, 4800)) * (np.sin(np.linspace(0, np.pi, m)) ** 1.8)
        stream[s0 : s0 + m] += splash[: n - s0] * r.uniform(0.35, 0.75)
        t_cur += r.uniform(0.08, 0.24)
    env = np.minimum(1.0, tt / 0.32) * np.minimum(1.0, (d - tt) / 0.55)
    return (norm(stream) * np.clip(env, 0, 1) * v).astype(np.float32)


def glass_clink_sfx(v: float = 1.0) -> np.ndarray:
    """Clinical glass vaccine vial / syringe subtle metallic-glass clink (J-cut into Zone 4B)."""
    d = 0.42
    tt = t_(d)
    modes = sum(
        a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau)
        for f, a, tau in [(2480, 0.65, 0.075), (3940, 0.45, 0.052), (5820, 0.30, 0.032), (8120, 0.16, 0.018)]
    )
    tick = hp(noise(d), 4500) * env_exp(d, 0.0015) * 0.45
    out = norm(modes + tick) * v
    # Tiny double-clink 95 ms later
    i2 = int(0.095 * SR)
    c2 = out[: len(out) - i2] * 0.48
    out2 = out.copy()
    out2[i2:] += c2
    return out2.astype(np.float32)


def room_tone(d: float) -> tuple[np.ndarray, np.ndarray]:
    d = round(d * SR) / SR
    n = len(t_(d))
    tt = np.arange(n) / SR
    hvac = bp(rng.standard_normal(n), 120, 1450) * 0.50 + lp(brown(d), 290) * 0.30 + (np.sin(2 * np.pi * 118 * tt) + 0.38 * np.sin(2 * np.pi * 236 * tt)) * 0.055
    traffic = lp(brown(d), 250) * 0.44
    r = np.random.default_rng(41)
    tc = 1.0
    while tc < d - 2.5:
        ln = r.uniform(2.2, 3.8)
        m = int(ln * SR)
        s0 = int(tc * SR)
        sw = bp(r.standard_normal(m), r.uniform(160, 270), r.uniform(1050, 2100)) * (np.sin(np.linspace(0, np.pi, m)) ** 2) * r.uniform(0.55, 1.05)
        take = max(0, min(m, n - s0))
        if take > 0:
            traffic[s0 : s0 + take] += sw[:take]
        tc += r.uniform(3.5, 6.5)
    return hvac.astype(np.float32), traffic.astype(np.float32)


for e in EV:
    et, ty = float(e["t"]), e["type"]
    eid = e.get("id", "")
    if ty == "write":
        add(fx, marker_sfx(e.get("d", 0.5), "write", int(et * 100) + 3), et, 0.16, pan=0.08)
    elif ty in ("stroke", "ring"):
        add(fx, marker_sfx(e.get("d", 0.5), "line", int(et * 100) + 7), et, 0.13, pan=-0.06)
    elif ty == "arrow":
        add(fx, nib_tap(1.0), et, 0.28, pan=0.10)
    elif ty == "magnet":
        # Slight pitch progression on rapid magnet tallies
        p_k = 1.0
        if eid.startswith("m_dog_") or eid.startswith("m_pep_"):
            p_k = 0.96 + 0.05 * int(eid.split("_")[-1])
        add(fx, magnet_snap(0.95, eid == "m_verdict_red", p_k), et, 0.34, pan=float(rng.uniform(-0.22, 0.22)))
    elif ty == "tag":
        add(fx, magnet_snap(0.9, False, 1.04), et, 0.34, pan=float(rng.uniform(-0.2, 0.2)))
    elif ty == "land":
        add(fx, landing_sfx(1.0, "big" if eid in ("p_em_niaid", "p_bat") else "mid"), max(0.0, et - 0.01), 0.58)
    elif ty == "ruler":
        add(fx, steel_ruler_sfx(1.0), max(0.0, et - 0.01), 0.48)
    elif ty == "erase":
        add(fx, eraser_swipe(e.get("d", 0.375)), et, 0.36)
    elif ty == "strike":
        add(fx, marker_sfx(0.24, "line", 77, 1.35), et, 0.22)
    elif ty == "stamp":
        add(fx, stamp_sfx(1.0), et, 0.88)
    elif ty == "water":
        add(amb, tap_water_sfx(e.get("d", 4.5), 1.0), et, 0.22, pan=-0.18)
    elif ty == "clink":
        add(fx, glass_clink_sfx(1.0), et, 0.42, pan=0.16)
    elif ty == "reveal":
        add(fx, thump(0.9, 42), et, 0.48)
        add(fx, whoosh(1.1, 0.65), et, 0.14)

# Gate foley & active ambience inside the two silences right UP TO the impact (STAMP1 / VERDICT)
gate = np.ones(N, np.float32)
for a, b in SIL:
    i0, i1, f = int(a * SR), int((b - 0.015) * SR), int(0.04 * SR)
    if i1 > i0:
        gate[i0:i1] = 0.03
        gate[max(0, i0 - f) : i0] = np.linspace(1.0, 0.03, i0 - max(0, i0 - f))
fx *= gate[:, None]
amb *= gate[:, None]

# ================================================================= 3. VOICE & MASTER BUS
for e in EV:
    if e["type"] != "vo":
        continue
    wav_p = HERE / "vo" / f"{e['id']}.wav"
    x, sr = sf.read(str(wav_p), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = soxr.resample(x, sr, SR)
    x = hp(x, 80)
    x = compress(x / (np.abs(x).max() + 1e-9), thr=0.30, ratio=3.0)
    add(vo, x, float(e["t"]), 1.0, 0.0)


def rms(arr: np.ndarray) -> float:
    return float(np.sqrt(np.mean(arr ** 2) + 1e-12))


vmask = np.abs(vo).max(axis=1) > 1e-4
v_rms = rms(vo[vmask])

# Continuous briefing room tone (~20 dB below voice): HVAC right (+0.25), window traffic left (-0.45)
hv_, tr_ = room_tone(DUR + 0.5)
room = np.zeros_like(amb)
add(room, hv_, 0.0, 1.0, 0.25)
add(room, tr_, 0.0, 1.0, -0.45)
room *= v_rms * (10.0 ** (-20.0 / 20.0)) / rms(room)
amb += room

# Balance music ~9.0 dB under voice RMS, plus smooth sidechain ducking under active speech
mmask = np.abs(music).max(axis=1) > 1e-4
music *= (v_rms / rms(music[mmask])) * (10.0 ** (-9.0 / 20.0))
win = int(0.12 * SR)
venv = np.convolve(np.abs(vo).max(axis=1), np.ones(win) / win, mode="same")
duck = 1.0 - 0.42 * np.clip(venv / (venv.max() * 0.25 + 1e-9), 0.0, 1.0)
music *= duck[:, None]
fx *= (1.0 - 0.28 * (1.0 - duck))[:, None]

music = hp(music.T, 36).T.astype(np.float32)
mix = music + fx * 0.78 + amb + vo
mix = hp(mix.T, 30).T.astype(np.float32)


def bus_limit(x: np.ndarray, ceil: float, look: float = 0.006, rel: float = 0.06) -> np.ndarray:
    n = int(look * SR)
    pk = np.abs(x).max(axis=1)
    m = maximum_filter1d(pk, size=2 * n + 1)
    g_arr = np.minimum(1.0, ceil / np.maximum(m, 1e-9))
    g_arr = uniform_filter1d(g_arr, size=n)
    g_arr = np.minimum(g_arr, uniform_filter1d(g_arr, size=int(rel * SR)))
    return (x * g_arr[:, None]).astype(np.float32)


peak_rms = float(np.sqrt(np.mean(mix[np.abs(mix).max(axis=1) > 1e-4] ** 2)))
mix = bus_limit(mix, peak_rms * 4.5)
mix = (mix / (np.abs(mix).max() + 1e-9) * 0.72).astype(np.float32)

end = int(round(DUR * SR))
fo = int(1.3 * SR)
mix[end - fo : end] *= (np.linspace(1.0, 0.0, fo, dtype=np.float32)[:, None] ** 1.5)

(DEMO / "out").mkdir(parents=True, exist_ok=True)
sf.write(str(DEMO / "out" / "mix.wav"), mix[:end], SR)

stems_dir = HERE / "stems"
stems_dir.mkdir(parents=True, exist_ok=True)
for nm, st_buf in (("music", music), ("fx", fx), ("amb", amb), ("vo", vo)):
    sf.write(str(stems_dir / f"{nm}.wav"), st_buf[:end], SR)

print(f"out/mix.wav ready: {DUR:.2f} s · {len(score_ev)} score notes · peak={np.abs(mix[:end]).max():.3f}")
