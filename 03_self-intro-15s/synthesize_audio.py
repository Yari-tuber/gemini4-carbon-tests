"""Synthesize an original 15.000s (48kHz stereo) Modern-Classical & Precision Foley Cinema Score for ANTIGRAVITY."""
import math
import wave
from pathlib import Path
import numpy as np
from scipy import signal

SR = 48000
DUR = 15.000
N = int(SR * DUR)  # Exact 720,000 stereo frames


def midi_to_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


NOTE_MAP = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}


def note_hz(name: str) -> float:
    if name[1] in ("#", "b"):
        pc = NOTE_MAP[name[:2]]
        octv = int(name[2:])
    else:
        pc = NOTE_MAP[name[:1]]
        octv = int(name[1:])
    midi = (octv + 1) * 12 + pc
    return midi_to_hz(midi)


def add_stereo(buf: np.ndarray, sig_mono: np.ndarray, t0: float, pan: float = 0.0):
    """Add mono signal at t0 (seconds) with constant-power stereo pan (-1 left .. +1 right)."""
    idx = int(round(t0 * SR))
    if idx >= N or len(sig_mono) == 0:
        return
    if idx < 0:
        sig_mono = sig_mono[-idx:]
        idx = 0
    end = min(N, idx + len(sig_mono))
    seg = sig_mono[: end - idx]
    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * (math.pi / 4.0)
    gl = math.cos(angle)
    gr = math.sin(angle)
    buf[idx:end, 0] += seg * gl
    buf[idx:end, 1] += seg * gr


def felt_piano_note(freq: float, dur: float, vel: float = 0.7, rng=None) -> np.ndarray:
    """Physical-inspired Una-Corda Felt Piano with soft hammer thump & inharmonic partials."""
    if rng is None:
        rng = np.random.default_rng(42)
    length = int(SR * dur)
    t = np.arange(length, dtype=np.float64) / SR

    # Slight piano string inharmonicity coefficient B
    B = 0.00018 * ((freq / 261.63) ** 1.15)
    out = np.zeros(length, dtype=np.float64)

    # Felt piano rolls off upper harmonics warmly
    n_harm = min(14, int((SR * 0.42) / freq))
    for k in range(1, n_harm + 1):
        fk = freq * k * math.sqrt(1.0 + B * k * k)
        if fk > 11000:
            break
        # Unison string pair slight detuning (beats)
        det = 1.0 + (0.00045 if k >= 2 else 0.00022)
        amp_k = (vel ** (1.0 + 0.14 * (k - 1))) / (k ** 1.78)
        if k == 2:
            amp_k *= 1.12
        if k == 3:
            amp_k *= 0.92
        decay_tau = max(0.18, (2.9 / (1.0 + 0.34 * (k - 1))) * ((220.0 / max(freq, 55.0)) ** 0.38))
        env_k = np.exp(-t / decay_tau)
        ph1 = rng.uniform(0, 2 * math.pi)
        ph2 = rng.uniform(0, 2 * math.pi)
        wave_k = 0.55 * np.sin(2.0 * math.pi * fk * t + ph1) + 0.45 * np.sin(2.0 * math.pi * fk * det * t + ph2)
        out += amp_k * env_k * wave_k

    # Soft wool-felt hammer transient (warm low-mid thump at ~180-480 Hz)
    thump_len = min(length, int(0.045 * SR))
    tt = t[:thump_len]
    noise = rng.standard_normal(thump_len)
    b, a = signal.butter(2, [120 / (SR / 2), 620 / (SR / 2)], btype="band")
    felt_hit = signal.lfilter(b, a, noise) * np.exp(-tt / 0.009) * (1.0 - np.exp(-tt / 0.0018))
    out[:thump_len] += felt_hit * 0.085 * vel

    # Smooth una-corda attack & tail fade
    atk = 1.0 - np.exp(-t / 0.0065)
    rel = np.ones(length, dtype=np.float64)
    fade_n = min(length // 3, int(0.18 * SR))
    if fade_n > 0:
        rel[-fade_n:] = 0.5 * (1.0 + np.cos(np.linspace(0, math.pi, fade_n)))
    return out * atk * rel * 0.22


def warm_pad_chord(freqs, dur: float, amp: float = 0.10, bright: float = 950.0, atk_s: float = 0.65, rel_s: float = 1.1, rng=None):
    """Lush stereo-detuned bowed string / analog warm pad."""
    if rng is None:
        rng = np.random.default_rng(99)
    length = int(SR * dur)
    t = np.arange(length, dtype=np.float64) / SR
    sig_l = np.zeros(length, dtype=np.float64)
    sig_r = np.zeros(length, dtype=np.float64)

    # Slow organic bow vibrato
    vib = 0.0016 * np.sin(2.0 * math.pi * 4.1 * t) * (1.0 - np.exp(-t / 0.5))

    for f in freqs:
        for det_cents, ch in [(-5.5, 0), (-1.8, 1), (1.8, 0), (5.5, 1)]:
            ratio = 2.0 ** (det_cents / 1200.0)
            ph = rng.uniform(0, 2 * math.pi)
            inst_phase = 2.0 * math.pi * f * ratio * (t + vib / (2 * math.pi * 4.1)) + ph
            # Rich soft bowed waveform (fundamental + warm 2nd/3rd/4th harmonics)
            w = (
                1.00 * np.sin(inst_phase)
                + 0.42 * np.sin(2.0 * inst_phase + 0.4)
                + 0.21 * np.sin(3.0 * inst_phase + 1.1)
                + 0.09 * np.sin(4.0 * inst_phase + 2.0)
            )
            if ch == 0:
                sig_l += w
            else:
                sig_r += w

    norm = max(1.0, len(freqs) * 2.2)
    sig_l /= norm
    sig_r /= norm

    # Warm lowpass filter
    b, a = signal.butter(2, min(0.45, bright / (SR / 2)), btype="low")
    sig_l = signal.lfilter(b, a, sig_l)
    sig_r = signal.lfilter(b, a, sig_r)

    # Smooth raised-cosine envelope
    env = np.ones(length, dtype=np.float64)
    na = min(length // 2, int(atk_s * SR))
    nr = min(length // 2, int(rel_s * SR))
    if na > 0:
        env[:na] = 0.5 * (1.0 - np.cos(np.linspace(0, math.pi, na)))
    if nr > 0:
        env[-nr:] *= 0.5 * (1.0 + np.cos(np.linspace(0, math.pi, nr)))

    return np.column_stack([sig_l * env * amp, sig_r * env * amp])


def crystal_shimmer(freq: float, dur: float, amp: float = 0.05, reverse: bool = False) -> np.ndarray:
    """Pure harmonic glass/celesta bell or reverse crystalline swell."""
    length = int(SR * dur)
    t = np.arange(length, dtype=np.float64) / SR
    w = (
        1.0 * np.sin(2 * math.pi * freq * t)
        + 0.35 * np.sin(2 * math.pi * freq * 2.001 * t + 0.7)
        + 0.14 * np.sin(2 * math.pi * freq * 3.003 * t + 1.5)
    )
    if reverse:
        env = ((t / max(dur, 1e-4)) ** 2.6) * (1.0 - np.exp(-(dur - t) / 0.025))
    else:
        env = (1.0 - np.exp(-t / 0.004)) * np.exp(-t / (dur * 0.36))
    return w * env * amp


def sub_bass_pulse(f_start: float, f_end: float, dur: float, amp: float = 0.24) -> np.ndarray:
    """Deep cinema sub-bass foundation with controlled 2nd harmonic warmth."""
    length = int(SR * dur)
    t = np.arange(length, dtype=np.float64) / SR
    f_curve = f_end + (f_start - f_end) * np.exp(-t / 0.22)
    phase = 2.0 * math.pi * np.cumsum(f_curve) / SR
    sig = np.sin(phase) + 0.22 * np.sin(2.0 * phase)
    atk = 1.0 - np.exp(-t / 0.018)
    dec = np.exp(-t / (dur * 0.48))
    fade = np.ones(length)
    fn = min(length // 4, int(0.15 * SR))
    fade[-fn:] = np.linspace(1.0, 0.0, fn)
    return sig * atk * dec * fade * amp


def horology_tick(pitch_hz: float, amp: float = 0.09, rng=None) -> np.ndarray:
    """Precision Swiss watchmaker / Leica shutter micro-click + subtle harmonic ping."""
    if rng is None:
        rng = np.random.default_rng(7)
    length = int(0.18 * SR)
    t = np.arange(length, dtype=np.float64) / SR
    noise = rng.standard_normal(length)
    b, a = signal.butter(2, [1400 / (SR / 2), 6800 / (SR / 2)], btype="band")
    click = signal.lfilter(b, a, noise) * np.exp(-t / 0.0022)
    body = np.sin(2 * math.pi * 320 * t) * np.exp(-t / 0.006) * 0.35
    ping = np.sin(2 * math.pi * pitch_hz * t) * np.exp(-t / 0.045) * 0.22
    return (click + body + ping) * amp


def optical_whoosh(dur: float, amp: float = 0.11, rng=None) -> np.ndarray:
    """Silky stereo doppler sweep for camera passing through the smoked-glass aperture."""
    if rng is None:
        rng = np.random.default_rng(123)
    length = int(dur * SR)
    t = np.arange(length, dtype=np.float64) / SR
    u = t / dur
    # Bell-shaped envelope peaking right at aperture crossing
    env = np.sin(math.pi * u) ** 2.2
    out = np.zeros((length, 2), dtype=np.float64)
    for ch, f_mul in [(0, 0.94), (1, 1.06)]:
        noise = rng.standard_normal(length)
        # Time-varying resonant sweep simulated by overlapping filtered bands
        low = signal.lfilter(*signal.butter(2, [140 / (SR / 2), 520 / (SR / 2)], btype="band"), noise)
        mid = signal.lfilter(*signal.butter(2, [480 / (SR / 2), 1850 / (SR / 2)], btype="band"), noise)
        high = signal.lfilter(*signal.butter(2, [1600 / (SR / 2), 5200 / (SR / 2)], btype="band"), noise)
        w_mid = np.exp(-((u - 0.5) / 0.22) ** 2)
        w_hi = np.exp(-((u - 0.48) / 0.12) ** 2)
        out[:, ch] = (0.55 * low + 0.85 * mid * w_mid + 0.45 * high * w_hi) * env * amp
    return out


def lush_hall_reverb(stereo_in: np.ndarray, wet: float = 0.34) -> np.ndarray:
    """8-line Stereo Feedback Delay Network / Schroeder-Moorer Concert Hall Reverb (fast vectorized/IIR)."""
    # Pre-delay 22ms + high-cut at 6.5 kHz + low-cut at 110 Hz so bass stays crystal tight
    pre = int(0.022 * SR)
    x = np.zeros_like(stereo_in)
    x[pre:] = stereo_in[:-pre]
    b_hp, a_hp = signal.butter(2, 115 / (SR / 2), btype="high")
    b_lp, a_lp = signal.butter(2, 6200 / (SR / 2), btype="low")
    xl = signal.lfilter(b_lp, a_lp, signal.lfilter(b_hp, a_hp, x[:, 0]))
    xr = signal.lfilter(b_lp, a_lp, signal.lfilter(b_hp, a_hp, x[:, 1]))

    # 3 cascaded allpass diffusers
    for d_ms, g in [(5.3, 0.65), (11.7, 0.62), (19.1, 0.58)]:
        d = int(d_ms * 0.001 * SR)
        b_ap = np.zeros(d + 1)
        a_ap = np.zeros(d + 1)
        b_ap[0] = -g
        b_ap[d] = 1.0
        a_ap[0] = 1.0
        a_ap[d] = -g
        xl = signal.lfilter(b_ap, a_ap, xl)
        d2 = d + 23
        b_ap2 = np.zeros(d2 + 1)
        a_ap2 = np.zeros(d2 + 1)
        b_ap2[0] = -g
        b_ap2[d2] = 1.0
        a_ap2[0] = 1.0
        a_ap2[d2] = -g
        xr = signal.lfilter(b_ap2, a_ap2, xr)

    # 6 parallel stereo damped comb filters (RT60 ~ 3.4s)
    comb_delays_ms = [31.7, 37.3, 43.9, 50.3, 58.7, 67.1]
    rev_l = np.zeros(len(xl))
    rev_r = np.zeros(len(xr))
    rt60 = 3.35
    for idx, d_ms in enumerate(comb_delays_ms):
        dl = int(d_ms * 0.001 * SR)
        dr = dl + 41 + idx * 13
        g = 10.0 ** (-3.0 * (d_ms * 0.001) / rt60)
        b_c = np.array([1.0])
        a_cl = np.zeros(dl + 1)
        a_cl[0] = 1.0
        a_cl[dl] = -g * 0.96
        a_cl[dl - 1] = -g * 0.04
        a_cr = np.zeros(dr + 1)
        a_cr[0] = 1.0
        a_cr[dr] = -g * 0.96
        a_cr[dr - 1] = -g * 0.04
        cl = signal.lfilter(b_c, a_cl, xl if idx % 2 == 0 else xr)
        cr = signal.lfilter(b_c, a_cr, xr if idx % 2 == 0 else xl)
        rev_l += cl * (1.0 / 6.0)
        rev_r += cr * (1.0 / 6.0)

    # Cross-blend for spacious stereo hall width
    wet_l = 0.82 * rev_l + 0.18 * rev_r
    wet_r = 0.82 * rev_r + 0.18 * rev_l
    wet_l = signal.lfilter(*signal.butter(1, 4800 / (SR / 2), btype="low"), wet_l)
    wet_r = signal.lfilter(*signal.butter(1, 4800 / (SR / 2), btype="low"), wet_r)
    return stereo_in + wet * np.column_stack([wet_l, wet_r])


def build_score() -> np.ndarray:
    rng = np.random.default_rng(20261111)
    dry_SubAndFoley = np.zeros((N, 2), dtype=np.float64)
    musical_bus = np.zeros((N, 2), dtype=np.float64)

    def place_stereo(target: np.ndarray, st: np.ndarray, t0: float):
        idx = int(round(t0 * SR))
        if idx >= N:
            return
        end = min(N, idx + len(st))
        target[idx:end] += st[: end - idx]

    # =========================================================================
    # ACT I (0.00s - 3.60s): GRAVITY & ZERO-G AWAKENING (Dm9)
    # =========================================================================
    # Pre-awakening horizon shimmer + reverse crystal inhale into t = 0.85s
    add_stereo(musical_bus, crystal_shimmer(note_hz("A5"), 0.84, amp=0.036, reverse=True), 0.02, pan=-0.25)
    add_stereo(musical_bus, crystal_shimmer(note_hz("E6"), 0.84, amp=0.024, reverse=True), 0.02, pan=0.30)
    add_stereo(dry_SubAndFoley, sub_bass_pulse(55.0, note_hz("D1"), 0.85, amp=0.09), 0.0, pan=0.0)

    # t = 0.85s: GRAVITY INVERTS (Sub-drop + luminous Dm9 pad + rising droplet harmonics)
    add_stereo(dry_SubAndFoley, sub_bass_pulse(82.0, note_hz("D1"), 2.85, amp=0.26), 0.85, pan=0.0)
    place_stereo(
        musical_bus,
        warm_pad_chord(
            [note_hz("D2"), note_hz("A2"), note_hz("F3"), note_hz("A3"), note_hz("C4"), note_hz("E4")],
            dur=2.95, amp=0.115, bright=860.0, atk_s=0.45, rel_s=0.65, rng=rng,
        ),
        0.82,
    )

    # Delicate rising zero-gravity mercury droplet harmonics
    droplet_notes = [
        (0.86, "A4", -0.35, 0.040),
        (1.06, "C5", 0.28, 0.034),
        (1.28, "E5", -0.18, 0.032),
        (1.54, "G5", 0.42, 0.026),
        (1.86, "A5", -0.30, 0.024),
        (2.32, "E5", 0.22, 0.022),
    ]
    for t0, nn, pan, amp in droplet_notes:
        add_stereo(musical_bus, crystal_shimmer(note_hz(nn), 1.4, amp=amp), t0, pan=pan)

    # Intimate Una-Corda Felt Piano motif in Act I
    act1_piano = [
        (0.86, "D2", 2.8, 0.68, -0.10),
        (0.88, "A2", 2.7, 0.62, 0.05),
        (1.18, "F3", 2.4, 0.64, -0.16),
        (1.56, "A3", 2.2, 0.66, 0.14),
        (1.94, "E4", 2.0, 0.74, 0.22),
        (2.68, "C4", 1.5, 0.60, -0.12),
        (3.12, "D4", 1.2, 0.58, 0.08),
    ]
    for t0, nn, dur, vel, pan in act1_piano:
        add_stereo(musical_bus, felt_piano_note(note_hz(nn), dur, vel, rng=rng), t0, pan=pan)

    # =========================================================================
    # ACT II (3.60s - 7.40s): ALABASTER STUDIO — REASONING & ARCHITECTURE
    # =========================================================================
    # Crisp Leica mechanical cut at t = 3.60s
    add_stereo(dry_SubAndFoley, horology_tick(note_hz("C6"), amp=0.125, rng=rng), 3.60, pan=0.0)
    add_stereo(dry_SubAndFoley, sub_bass_pulse(note_hz("F2"), note_hz("F1"), 2.1, amp=0.18), 3.60, pan=0.0)
    add_stereo(dry_SubAndFoley, sub_bass_pulse(note_hz("G2"), note_hz("G1"), 1.9, amp=0.18), 5.50, pan=0.0)

    # Daylight warm architectural chords: Fmaj9 (3.60s) -> G6add9 / Csus4 (5.50s)
    place_stereo(
        musical_bus,
        warm_pad_chord(
            [note_hz("F2"), note_hz("C3"), note_hz("G3"), note_hz("A3"), note_hz("E4")],
            dur=2.25, amp=0.115, bright=1250.0, atk_s=0.18, rel_s=0.55, rng=rng,
        ),
        3.60,
    )
    place_stereo(
        musical_bus,
        warm_pad_chord(
            [note_hz("G2"), note_hz("D3"), note_hz("A3"), note_hz("B3"), note_hz("E4")],
            dur=2.10, amp=0.120, bright=1350.0, atk_s=0.35, rel_s=0.55, rng=rng,
        ),
        5.45,
    )

    # 4 Synchronized Precision Escapement Locks (PERCEIVE -> REASON -> ARCHITECT -> VERIFY)
    lock_events = [
        (4.10, "A5", -0.28),
        (4.70, "C6", 0.24),
        (5.30, "D6", -0.20),
        (5.90, "E6", 0.28),
    ]
    for t0, nn, pan in lock_events:
        add_stereo(dry_SubAndFoley, horology_tick(note_hz(nn), amp=0.085, rng=rng), t0, pan=pan)
        add_stereo(musical_bus, crystal_shimmer(note_hz(nn), 0.9, amp=0.024), t0, pan=pan)

    # Subtle architectural felt-ostinato pulse (clean, minimal intellectual momentum)
    ost_notes = ["C4", "G4", "A4", "E4", "C4", "G4", "A4", "E4", "D4", "G4", "B4", "E4", "D4", "A4", "B4", "G4"]
    for i, nn in enumerate(ost_notes):
        t_ost = 3.65 + i * 0.225
        if t_ost < 7.20:
            pan = -0.22 if i % 2 == 0 else 0.22
            add_stereo(musical_bus, felt_piano_note(note_hz(nn), 0.55, vel=0.36, rng=rng), t_ost, pan=pan)

    # Poised piano melody over Act II
    act2_piano = [
        (3.62, "F2", 2.0, 0.66, -0.12),
        (3.64, "A3", 1.9, 0.62, 0.08),
        (4.10, "E4", 1.6, 0.70, 0.18),
        (4.70, "G4", 1.4, 0.72, -0.14),
        (5.50, "G2", 1.9, 0.68, -0.10),
        (5.52, "B3", 1.8, 0.62, 0.10),
        (5.90, "A4", 1.6, 0.76, 0.20),
        (6.62, "G4", 1.2, 0.64, -0.12),
    ]
    for t0, nn, dur, vel, pan in act2_piano:
        add_stereo(musical_bus, felt_piano_note(note_hz(nn), dur, vel, rng=rng), t0, pan=pan)

    # =========================================================================
    # TRANSITION & ACT III (7.05s -> 7.40s - 11.20s): SYMBIOSIS & TASTE (Bbmaj7#11 -> Asus4)
    # =========================================================================
    place_stereo(dry_SubAndFoley, optical_whoosh(0.66, amp=0.115, rng=rng), 7.06)
    add_stereo(dry_SubAndFoley, sub_bass_pulse(note_hz("Bb1"), note_hz("Bb1") * 0.5, 2.3, amp=0.23), 7.40, pan=0.0)
    add_stereo(dry_SubAndFoley, sub_bass_pulse(note_hz("A1"), note_hz("A1") * 0.5, 1.9, amp=0.20), 9.45, pan=0.0)

    # Soaring iridescent Bbmaj7(#11) -> Asus4(add9) pads
    place_stereo(
        musical_bus,
        warm_pad_chord(
            [note_hz("Bb2"), note_hz("F3"), note_hz("A3"), note_hz("C4"), note_hz("D4"), note_hz("E4")],
            dur=2.35, amp=0.135, bright=1550.0, atk_s=0.30, rel_s=0.65, rng=rng,
        ),
        7.38,
    )
    place_stereo(
        musical_bus,
        warm_pad_chord(
            [note_hz("A2"), note_hz("E3"), note_hz("A3"), note_hz("B3"), note_hz("D4"), note_hz("E4")],
            dur=2.05, amp=0.130, bright=1450.0, atk_s=0.40, rel_s=0.60, rng=rng,
        ),
        9.40,
    )

    # Expressive, lyrical Act III felt piano & harmonic overtones
    act3_piano = [
        (7.40, "Bb1", 2.3, 0.72, -0.08),
        (7.42, "F3", 2.2, 0.66, 0.06),
        (7.45, "D4", 2.1, 0.68, -0.15),
        (7.62, "A4", 1.9, 0.80, 0.22),
        (8.28, "G4", 1.6, 0.72, -0.18),
        (8.92, "F4", 1.5, 0.70, 0.15),
        (9.45, "A2", 1.9, 0.70, -0.10),
        (9.48, "E4", 1.8, 0.75, 0.18),
        (10.12, "D4", 1.3, 0.66, -0.12),
        (10.62, "E4", 1.1, 0.68, 0.14),
    ]
    for t0, nn, dur, vel, pan in act3_piano:
        add_stereo(musical_bus, felt_piano_note(note_hz(nn), dur, vel, rng=rng), t0, pan=pan)

    add_stereo(musical_bus, crystal_shimmer(note_hz("E5"), 1.9, amp=0.028), 7.45, pan=-0.32)
    add_stereo(musical_bus, crystal_shimmer(note_hz("A5"), 1.9, amp=0.024), 7.85, pan=0.34)
    # Reverse halo convergence into Act IV lockup at 11.20s
    add_stereo(musical_bus, crystal_shimmer(note_hz("A5"), 0.62, amp=0.034, reverse=True), 10.58, pan=0.0)

    # =========================================================================
    # ACT IV (11.20s - 15.00s): THE SIGNATURE — RADIANT PICARDY Dadd9 RESOLUTION
    # =========================================================================
    add_stereo(dry_SubAndFoley, sub_bass_pulse(note_hz("D2"), note_hz("D1"), 3.65, amp=0.25), 11.20, pan=0.0)
    place_stereo(
        musical_bus,
        warm_pad_chord(
            [note_hz("D2"), note_hz("A2"), note_hz("E3"), note_hz("F#3"), note_hz("A3"), note_hz("D4"), note_hz("E4"), note_hz("F#4")],
            dur=3.70, amp=0.145, bright=1400.0, atk_s=0.32, rel_s=1.45, rng=rng,
        ),
        11.18,
    )

    # Iconic Dadd9 piano voicing + crystalline eclipse chime
    act4_piano = [
        (11.20, "D2", 3.6, 0.78, -0.06),
        (11.22, "A2", 3.5, 0.72, 0.06),
        (11.25, "F#3", 3.4, 0.74, -0.16),
        (11.29, "A3", 3.3, 0.72, 0.14),
        (11.34, "E4", 3.2, 0.76, -0.18),
        (11.40, "F#4", 3.1, 0.80, 0.22),
        (11.95, "A4", 2.7, 0.70, -0.14),
        (12.58, "E5", 2.1, 0.62, 0.20),
        (13.12, "F#5", 1.7, 0.56, -0.12),
    ]
    for t0, nn, dur, vel, pan in act4_piano:
        add_stereo(musical_bus, felt_piano_note(note_hz(nn), dur, vel, rng=rng), t0, pan=pan)

    add_stereo(musical_bus, crystal_shimmer(note_hz("D5"), 2.6, amp=0.034), 11.20, pan=-0.24)
    add_stereo(musical_bus, crystal_shimmer(note_hz("A5"), 2.6, amp=0.028), 11.24, pan=0.24)
    add_stereo(musical_bus, crystal_shimmer(note_hz("F#6"), 2.2, amp=0.018), 11.30, pan=0.0)

    # Apply lush concert hall reverb to musical bus
    reverbed_music = lush_hall_reverb(musical_bus, wet=0.38)
    mix = dry_SubAndFoley + reverbed_music

    # Subtle velvet room-air floor (-62 dB) so digital silence never feels sterile
    air = rng.standard_normal((N, 2)) * 0.00045
    air = signal.lfilter(*signal.butter(2, [180 / (SR / 2), 3800 / (SR / 2)], btype="band"), air, axis=0)
    mix += air

    # Master fade-in (40ms) and poised cinema fade-out (last 0.48s -> clean zero at 15.000s)
    fi = int(0.04 * SR)
    fo = int(0.48 * SR)
    mix[:fi] *= np.linspace(0.0, 1.0, fi)[:, None]
    mix[-fo:] *= (0.5 * (1.0 + np.cos(np.linspace(0.0, math.pi, fo))))[:, None]

    # Gentle analog tape saturation + true-peak normalization (-1.2 dBFS)
    mix = np.tanh(mix * 1.18) / math.tanh(1.18)
    peak = np.max(np.abs(mix))
    if peak > 1e-8:
        target_peak = 10.0 ** (-1.2 / 20.0)
        mix *= target_peak / peak

    return mix


def main():
    out_wav = Path(__file__).resolve().parent / "audio_master.wav"
    print("Synthesizing 15.000s 48kHz stereo cinema score & foley...")
    mix = build_score()
    pcm16 = np.clip(np.round(mix * 32767.0), -32768, 32767).astype(np.int16)
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm16.tobytes())
    rms_db = 20.0 * math.log10(max(1e-9, float(np.sqrt(np.mean(mix ** 2)))))
    peak_db = 20.0 * math.log10(max(1e-9, float(np.max(np.abs(mix)))))
    print(f"Saved {out_wav} | duration={len(mix)/SR:.3f}s | peak={peak_db:.2f} dBFS | rms={rms_db:.2f} dBFS")


if __name__ == "__main__":
    main()
