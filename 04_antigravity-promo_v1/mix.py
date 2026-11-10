"""Master audio mixer for 《反重力 · ANTIGRAVITY》:
Combines music/score.wav + procedural foley (driven by events.json) + ambience + compressed Chinese voice-over,
with -8.5 dB music ducking / -4.5 dB foley ducking, J/L cuts, and the two dramatic silences.
Writes out/mix.wav (48 kHz stereo float32).
"""
import json, os, sys
import numpy as np
import soundfile as sf
import soxr

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB', os.path.join(os.path.expanduser('~'), 'lemo-opuscar'))
sys.path.insert(0, LIB)

from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, brown, norm, thump, whoosh, compress, add, limit

TL = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
EV_DATA = json.load(open(os.path.join(HERE, 'events.json'), encoding='utf-8'))
DUR = float(TL['dur'])
N = int(round(DUR * SR))
RNG = np.random.default_rng(108)

# F# Major Pentatonic frequencies for unified product sound family (STYLE.md §7)
PENTA_HZ = [739.99, 830.61, 932.33, 1108.73, 1479.98, 1661.22, 1864.66]


def felt_tick(freq=1108.73, v=0.5):
    d = 0.045
    tt = t_(d)
    tr = bp(noise(d), 1400, 4200) * env_exp(d, 0.0025) * 0.45
    tone = np.sin(2 * np.pi * freq * tt) * env_exp(d, 0.011)
    return norm(tr + tone) * v


def soft_key(v=0.45):
    d = 0.055
    tt = t_(d)
    tr = bp(noise(d), 900, 3400) * env_exp(d, 0.003) * 0.6
    body = np.sin(2 * np.pi * 240 * tt) * env_exp(d, 0.010) * 0.45
    return norm(tr + body) * v


def detuned_err_glass(idx=0, v=0.6):
    """Scattered problem family: detuned +/-45 cents, tense intervals."""
    d = 0.22
    tt = t_(d)
    det = 2 ** (RNG.uniform(-0.45, 0.45) / 12.0)
    f1 = (587.0 + (idx % 5) * 63.0) * det
    f2 = f1 * 1.414  # tritone tension
    sig = (
        0.65 * np.sin(2 * np.pi * f1 * tt) * env_exp(d, 0.055)
        + 0.40 * np.sin(2 * np.pi * f2 * tt) * env_exp(d, 0.035)
        + 0.35 * hp(noise(d), 2200) * env_exp(d, 0.004)
    )
    return norm(sig) * v


def prism_wake_sfx(v=0.85):
    """First sound after 1.25 s Digital Zero: crystalline F#5 + C#6 + F#6 shimmer."""
    d = 1.4
    tt = t_(d)
    sig = sum(
        a * np.sin(2 * np.pi * f * tt) * env_exp(d, tau)
        for f, a, tau in [(739.99, 0.7, 0.45), (1108.73, 0.55, 0.38), (1479.98, 0.45, 0.30), (2217.46, 0.22, 0.18)]
    )
    air = bp(noise(d), 2800, 7500) * np.sin(np.pi * np.minimum(1.0, tt / 0.35)) * env_exp(d, 0.22) * 0.18
    return norm(sig + air) * v


def exec_press_sfx(v=0.95):
    """Felt mallet click + 62->40 Hz sine drop ('doom' confirmation)."""
    d = 0.65
    tt = t_(d)
    f_curve = 62.0 - 22.0 * (tt / d)
    sub = np.sin(2 * np.pi * np.cumsum(f_curve) / SR) * env_exp(d, 0.19) * 0.85
    mallet = bp(noise(d), 600, 2600) * env_exp(d, 0.006) * 0.45
    tone = np.sin(2 * np.pi * 739.99 * tt) * env_exp(d, 0.06) * 0.35
    return norm(sub + mallet + tone) * v


def shimmer_sweep(d=1.25, v=0.75, upward=True):
    """Soft light-band shimmer: swept bandpass + in-key F# Lydian harmonic dust."""
    tt = t_(d)
    n = noise(d)
    out = np.zeros_like(n)
    for i in range(0, len(n), 480):
        hi = min(len(n), i + 480)
        u = i / max(1, len(n))
        fc = (1100 + 3600 * u) if upward else (4200 - 2800 * u)
        seg_x = bp(n[max(0, i - 1600):hi], fc * 0.75, min(12000, fc * 1.28))[-(hi - i):]
        out[i:hi] = seg_x
    env = np.sin(np.pi * tt / d) ** 1.6
    harm = sum(
        0.16 * np.sin(2 * np.pi * f * tt) * env
        for f in [1479.98, 1864.66, 2217.46, 2959.96]
    )
    return norm(out * env * 0.55 + harm) * v


def snap_shimmer_cluster(v=0.95):
    """16 in-key glass/felt taps landing within 40 ms on F# Maj9 pentatonic -> one unified shimmer!"""
    d = 0.55
    buf = np.zeros(int(round(d * SR)), dtype=np.float32)
    for k in range(16):
        off = int(round(RNG.uniform(0.0, 0.036) * SR))
        tk = felt_tick(PENTA_HZ[k % len(PENTA_HZ)], 0.38)
        end = min(len(buf), off + len(tk))
        buf[off:end] += tk[:end - off]
    # Subtle low lock body
    th = thump(0.45, 58)
    buf[:min(len(buf), len(th))] += th[:min(len(buf), len(th))] * 0.45
    return norm(buf) * v


def digit_grain(v=0.35):
    d = 0.028
    tt = t_(d)
    f = RNG.choice([1480.0, 1661.0, 1865.0, 2217.0])
    return norm(np.sin(2 * np.pi * f * tt) * env_exp(d, 0.006) + hp(noise(d), 3500) * env_exp(d, 0.002) * 0.4) * v


def freeze_brake(v=0.8):
    """Crisp vacuum intake right BEFORE 11.00 s so 11.00 s hits hard digital zero."""
    d = 0.22
    tt = t_(d)
    f = 420.0 * (1.0 - 0.72 * (tt / d))
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / d) ** 2
    air = bp(noise(d), 800, 3800) * (tt / d) ** 2.5 * 0.45
    out = norm(sig + air) * v
    out[-120:] *= np.linspace(1.0, 0.0, 120)
    return out


def main():
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)

    # 1. Load original score (48 kHz stereo)
    score, sr_s = sf.read(os.path.join(HERE, 'music', 'score.wav'), dtype='float32')
    assert sr_s == SR
    if len(score) < N:
        score = np.pad(score, ((0, N - len(score)), (0, 0)))
    else:
        score = score[:N]

    # 2. Build Ambience Track
    amb = np.zeros((N, 2), dtype=np.float32)
    room_L = lp(hp(brown(DUR), 45), 420) * 0.0032
    room_R = lp(hp(brown(DUR), 45), 420) * 0.0032
    amb[:, 0] += room_L[:N]
    amb[:, 1] += room_R[:N]

    # Subtle high coil whine + fan ONLY in 9.05..10.99 s (strictly after L1 voice ends at 8.26 s!)
    i_w0, i_w1 = int(9.05 * SR), int(10.99 * SR)
    tw = np.arange(i_w1 - i_w0) / SR
    whine_env = (tw / tw[-1]) ** 1.8
    whine = (
        0.0065 * np.sin(2 * np.pi * 6240.0 * tw) * whine_env
        + 0.0080 * bp(noise(len(tw) / SR), 280, 950)[:len(tw)] * whine_env
    ).astype(np.float32)
    amb[i_w0:i_w1, 0] += whine
    amb[i_w0:i_w1, 1] += whine * 0.92

    # Zero-G airy stereo sheen in 17.0..47.2 s
    i_a0, i_a1 = int(17.0 * SR), int(47.2 * SR)
    ta = np.arange(i_a1 - i_a0) / SR
    air_env = np.minimum(1.0, ta / 1.5) * np.minimum(1.0, (ta[-1] - ta) / 2.0)
    amb[i_a0:i_a1, 0] += (bp(noise(len(ta) / SR), 1200, 4200)[:len(ta)] * 0.0018 * air_env).astype(np.float32)
    amb[i_a0:i_a1, 1] += (bp(noise(len(ta) / SR), 1200, 4200)[:len(ta)] * 0.0018 * air_env).astype(np.float32)

    # 3. Build Procedural Foley Track from events.json
    foley = np.zeros((N, 2), dtype=np.float32)
    for ev in EV_DATA['ev']:
        t = float(ev['t'])
        tp = ev['type']
        gain = float(ev.get('gain', 0.5)) * 0.22
        pan = float(ev.get('pan', 0.0))

        if tp == 'grain':
            add(foley, digit_grain(1.0), t, gain * 0.55, RNG.uniform(-0.2, 0.2))
        elif tp == 'digit_lock':
            p = float(ev.get('pitch', 1.0))
            add(foley, felt_tick(880.0 * p, 1.0), t, gain * 0.9, 0.0)
            add(foley, thump(0.6, 65 * p), t, gain * 0.55, 0.0)
        elif tp == 'drop_thud':
            add(foley, thump(0.85, 62), t, gain * 0.95, pan)
        elif tp == 'drop_err':
            add(foley, thump(0.75, 58), t, gain * 0.80, pan)
            add(foley, detuned_err_glass(int(ev.get('idx', 0)), 0.75), t, gain * 0.68, pan)
        elif tp == 'freeze_cut':
            # Ends strictly at 10.998 s so [11.00, 12.25] stays 100% digital zero!
            add(foley, freeze_brake(1.0), max(0.0, t - 0.222), gain * 1.1, 0.0)
        elif tp == 'prism_wake':
            add(foley, prism_wake_sfx(1.0), t, gain * 1.15, 0.0)
        elif tp == 'ui_expand' or tp == 'ui_whoosh':
            add(foley, whoosh(0.28, 0.8), max(0.0, t - 0.04), gain * 0.75, 0.0)
        elif tp == 'caret_tick':
            add(foley, felt_tick(1479.98, 0.5), t, gain * 0.45, 0.0)
        elif tp == 'key_soft':
            add(foley, soft_key(0.8), t, gain * 0.62, pan)
        elif tp == 'exec_press':
            add(foley, exec_press_sfx(1.0), t, gain * 1.35, 0.0)
        elif tp == 'horizon_sweep':
            add(foley, shimmer_sweep(0.82, 0.85, True), t, gain * 0.95, 0.0)
        elif tp == 'jcut_ascent':
            add(foley, whoosh(0.55, 0.75), t, gain * 0.75, 0.0)
        elif tp == 'lift_stream':
            add(foley, whoosh(0.32, 0.55), t, gain * 0.42, pan)
        elif tp == 'snap_lock':
            add(foley, snap_shimmer_cluster(1.0), t, gain * 1.30, 0.0)
        elif tp == 'jcut_shimmer':
            add(foley, shimmer_sweep(0.45, 0.65, True), t, gain * 0.70, -0.15)
        elif tp == 'light_sweep':
            add(foley, shimmer_sweep(1.25, 0.90, True), t, gain * 0.95, 0.1)
        elif tp == 'tab_predict':
            add(foley, felt_tick(1479.98, 0.7), t, gain * 0.65, 0.12)
            add(foley, felt_tick(1864.66, 0.7), t + 0.09, gain * 0.65, 0.18)
        elif tp == 'dive_whoosh':
            add(foley, freeze_brake(0.95), t, gain * 1.05, 0.15)
        elif tp == 'bell_lock':
            p = float(ev.get('pitch', 1.0))
            add(foley, felt_tick(1108.73 * p, 0.95), t, gain * 0.95, 0.0)
        elif tp == 'hero_glint':
            add(foley, shimmer_sweep(1.15, 0.75, True), t, gain * 0.80, 0.0)

    # 4. Load & Process Voice-Over + Build Smooth Ducking Envelope
    voice_bus = np.zeros((N, 2), dtype=np.float32)
    duck_env = np.zeros(N, dtype=np.float32)  # 0 = no voice, 1 = voice active

    for v in TL['voices']:
        vid = v['id']
        t0 = float(v['t0'])
        wav_path = os.path.join(HERE, 'voices', f'{vid}.wav')
        x, sr_v = sf.read(wav_path, dtype='float32')
        if x.ndim > 1:
            x = x.mean(axis=1)
        if sr_v != SR:
            x = soxr.resample(x, sr_v, SR, quality='HQ')
        # Clean sub-rumble, gentle compression, consistent RMS (-17.5 dBFS pre-master -> ~10 dB above ducked score!)
        x = hp(x, 80)
        x = compress(x, thr=0.22, ratio=3.2, att=0.004, rel=0.085)
        rms = float(np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2) + 1e-9))
        target_rms = 0.135
        x = (x * (target_rms / rms)).astype(np.float32)
        # 12 ms edge fades
        fd = min(int(0.012 * SR), len(x) // 4)
        x[:fd] *= np.linspace(0, 1, fd, dtype=np.float32)
        x[-fd:] *= np.linspace(1, 0, fd, dtype=np.float32)

        add(voice_bus, x, t0, gain=1.0, pan=0.0)

        # Smooth ducking window [t0 - 0.14, t0 + len/SR + 0.22]
        vdur = len(x) / SR
        i0 = max(0, int((t0 - 0.14) * SR))
        i1 = min(N, int((t0 + vdur + 0.22) * SR))
        duck_env[i0:i1] = 1.0

    # Smooth ducking transitions with a 120 ms moving-average window
    win = int(0.12 * SR)
    duck_smooth = np.convolve(duck_env, np.ones(win, dtype=np.float32) / win, mode='same')

    # Music ducks -8.5 dB (0.376x), Foley/Ambience duck -4.5 dB (0.595x) under voice
    music_gain = (1.0 - (1.0 - 0.376) * duck_smooth)[:, None]
    foley_gain = (1.0 - (1.0 - 0.595) * duck_smooth)[:, None]

    master = score * 0.76 * music_gain + (foley + amb) * foley_gain + voice_bus

    # 5. Enforce the TWO Dramatic Silences strictly!
    # Silence #1 [11.00, 12.25]: HARD DIGITAL ZERO on all tracks!
    z0, z1 = int(round(11.00 * SR)), int(round(12.25 * SR))
    zf = int(round(0.010 * SR))
    master[z0 - zf:z0] *= np.linspace(1.0, 0.0, zf, dtype=np.float32)[:, None]
    master[z0:z1] = 0.0

    # Silence #2 [33.00, 33.20]: -60 dB quiet room breath before the digit grains begin!
    b0, b1 = int(round(33.00 * SR)), int(round(33.20 * SR))
    bf = int(round(0.015 * SR))
    master[b0 - bf:b0] *= np.linspace(1.0, 0.02, bf, dtype=np.float32)[:, None]
    master[b0:b1] = amb[b0:b1] * 0.28  # ~ -60 dB room tone

    # Final soft fade to zero at 48.00 s
    ef = int(round(0.45 * SR))
    master[-ef:] *= np.linspace(1.0, 0.0, ef, dtype=np.float32)[:, None]

    # Clean true-peak headroom per channel before mux.sh two-pass loudnorm (-14 LUFS)
    master[:, 0] = limit(master[:, 0], ceil=0.88)
    master[:, 1] = limit(master[:, 1], ceil=0.88)
    master[z0:z1] = 0.0
    assert not np.isnan(master).any() and not np.isinf(master).any(), 'NaN/Inf in master mix!'

    # Verify Digital Zero silence #1 is truly 0.0
    sil1_peak = float(np.abs(master[z0 + 10:z1 - 10]).max())
    sil2_rms_db = 20 * np.log10(float(np.sqrt(np.mean(master[b0 + 10:b1 - 10] ** 2))) + 1e-9)
    print(f'mix verified: silence1_peak={sil1_peak:.6f} (digital zero), silence2_rms={sil2_rms_db:.1f} dBFS, master_peak={float(np.abs(master).max()):.3f}')

    out_wav = os.path.join(HERE, 'out', 'mix.wav')
    sf.write(out_wav, master, SR)
    print(f'wrote {out_wav}')


if __name__ == '__main__':
    main()
