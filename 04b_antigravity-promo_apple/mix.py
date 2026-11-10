"""mix.py — Synthesise subtle Cupertino UI foley, duck score under warm narration, enforce digital silence [29.50, 30.50],
and write out/mix.wav for mux.sh (-14 LUFS target).
"""
import json, os, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB', os.path.join(os.path.expanduser('~'), 'lemo-opuscar'))
if len(LIB) > 3 and LIB[0] == '/' and LIB[2] == '/':
    LIB = f'{LIB[1].upper()}:/{LIB[3:]}'
sys.path.insert(0, LIB)

from core.audio.sfx import SR, add, lp, hp, bp, limit

TL = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
DUR = float(TL['dur'])
N = int(round(DUR * SR))
RNG = np.random.default_rng(2026)


def env_exp(n, att_s, tau_s):
    t = np.arange(n, dtype=np.float32) / SR
    a = np.minimum(1.0, t / max(1e-4, att_s))
    d = np.exp(-np.maximum(0.0, t - att_s) / tau_s)
    tail = np.minimum(1.0, np.maximum(0.0, (n / SR - t) / 0.008))
    return a * d * tail


def synth_event(ev):
    tp = ev['type']
    pitch = float(ev.get('pitch', 1.0))

    if tp == 'apple_key':
        # Soft MacBook scissor-magic keyboard thock
        n = int(0.045 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        body = np.sin(2 * np.pi * 240 * t) * np.exp(-t / 0.009)
        click = bp(RNG.standard_normal(n).astype(np.float32), 1600, 3600) * np.exp(-t / 0.003)
        return (0.32 * body + 0.18 * click).astype(np.float32)

    if tp == 'trackpad_click':
        # Crisp Force-Touch haptic click
        n = int(0.065 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        snap1 = np.sin(2 * np.pi * 1150 * t) * np.exp(-t / 0.0025)
        thump = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.012)
        return (0.38 * snap1 + 0.34 * thump).astype(np.float32)

    if tp in ('pill_pop', 'toggle_tick'):
        n = int(0.09 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        f = np.linspace(520, 880, n) * pitch
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.002, 0.022)
        return (sig * 0.24).astype(np.float32)

    if tp == 'tab_spark':
        n = int(0.22 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        sig = (
            0.55 * np.sin(2 * np.pi * 1046.5 * t)
            + 0.35 * np.sin(2 * np.pi * 1568.0 * t)
        ) * env_exp(n, 0.004, 0.065)
        return (sig * 0.22).astype(np.float32)

    if tp in ('card_glide', 'whip_soft', 'air_lift'):
        n = int(0.36 * SR)
        nz = RNG.standard_normal(n).astype(np.float32)
        sig = bp(nz, 320, 1200) * np.hanning(n).astype(np.float32)
        return (sig * 0.14).astype(np.float32)

    if tp == 'pre_silence_swell':
        n = int(0.28 * SR)
        nz = bp(RNG.standard_normal(n).astype(np.float32), 550, 1600)
        ramp = np.linspace(0.0, 1.0, n, dtype=np.float32) ** 2.2
        ramp[-int(0.012 * SR):] *= np.linspace(1.0, 0.0, int(0.012 * SR), dtype=np.float32)
        return (nz * ramp * 0.18).astype(np.float32)

    if tp == 'pro_sub_bloom':
        n = int(0.95 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        f = 87.31 * (1.0 + 0.35 * np.exp(-t / 0.04))
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.35 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        return (sig * env_exp(n, 0.006, 0.32) * 0.36).astype(np.float32)

    if tp == 'bento_snap':
        n = int(0.14 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        click = np.sin(2 * np.pi * 1480 * pitch * t) * np.exp(-t / 0.003)
        bell = np.sin(2 * np.pi * 880 * pitch * t) * env_exp(n, 0.002, 0.045)
        return (0.28 * click + 0.24 * bell).astype(np.float32)

    if tp == 'glass_chime':
        n = int(0.55 * SR)
        t = np.arange(n, dtype=np.float32) / SR
        f0 = 1046.5 * pitch
        sig = (0.65 * np.sin(2 * np.pi * f0 * t) + 0.28 * np.sin(2 * np.pi * f0 * 2.0 * t)) * env_exp(n, 0.004, 0.18)
        return (sig * 0.24).astype(np.float32)

    return np.zeros(256, dtype=np.float32)


def main():
    score, sr_s = sf.read(os.path.join(HERE, 'music', 'score.wav'), dtype='float32', always_2d=True)
    assert sr_s == SR
    if len(score) < N:
        score = np.vstack([score, np.zeros((N - len(score), 2), dtype=np.float32)])
    score = score[:N]

    # 1. Build Foley bus from events.json
    evs_raw = json.load(open(os.path.join(HERE, 'events.json'), encoding='utf-8'))
    evs = evs_raw['ev'] if isinstance(evs_raw, dict) else evs_raw
    foley = np.zeros((N, 2), dtype=np.float32)
    for ev in evs:
        t0 = float(ev['t'])
        if 29.50 <= t0 < 30.50:
            continue
        wav = synth_event(ev)
        add(foley, wav, t0, gain=float(ev.get('gain', 0.5)) * 0.55, pan=float(ev.get('pan', 0.0)))

    # 2. Build Voice bus + smooth sidechain ducking envelope
    vo_bus = np.zeros((N, 2), dtype=np.float32)
    duck_mask = np.zeros(N, dtype=np.float32)

    for v in TL['voices']:
        vp = os.path.join(HERE, 'voices', f"{v['id']}.wav")
        vx, vsr = sf.read(vp, dtype='float32')
        if vx.ndim > 1:
            vx = vx.mean(axis=1)
        if vsr != SR:
            import math
            from scipy.signal import resample_poly
            g_sr = math.gcd(int(SR), int(vsr))
            vx = resample_poly(vx, int(SR) // g_sr, int(vsr) // g_sr).astype(np.float32)
        # Gentle broadcast high-pass & presence leveling
        vx = hp(vx, 85.0)
        peak_v = float(np.max(np.abs(vx))) + 1e-6
        vx = (vx / peak_v) * 0.76
        s_idx = int(round(float(v['t0']) * SR))
        e_idx = min(N, s_idx + len(vx))
        seg_len = e_idx - s_idx
        vo_bus[s_idx:e_idx, 0] += vx[:seg_len]
        vo_bus[s_idx:e_idx, 1] += vx[:seg_len]

        pad_pre = int(0.18 * SR)
        pad_post = int(0.28 * SR)
        d0 = max(0, s_idx - pad_pre)
        d1 = min(N, e_idx + pad_post)
        duck_mask[d0:d1] = 1.0

    # Smooth ducking envelope with 140 ms cosine window
    win_n = int(0.14 * SR)
    kern = np.hanning(win_n * 2 + 1).astype(np.float32)
    kern /= kern.sum()
    duck_env = np.convolve(duck_mask, kern, mode='same')

    # Duck music ~9.5 dB (0.335x) and foley ~5 dB (0.56x) during speech so voice leads cleanly
    music_gain = 1.0 - 0.665 * duck_env[:, None]
    foley_gain = 1.0 - 0.440 * duck_env[:, None]

    master = score * music_gain * 0.86 + foley * foley_gain + vo_bus * 1.06

    # Hard digital zero in midpoint silence [29.50, 30.50]
    s0, s1 = int(round(29.50 * SR)), int(round(30.50 * SR))
    fn = int(0.03 * SR)
    master[s0 - fn:s0] *= np.linspace(1.0, 0.0, fn, dtype=np.float32)[:, None]
    master[s0:s1] = 0.0

    # Per-channel transparent peak limiter
    for ch in range(2):
        master[:, ch] = limit(master[:, ch], ceil=0.88)
    master[s0:s1] = 0.0

    sil_pk = float(np.max(np.abs(master[s0:s1])))
    assert sil_pk == 0.0, f'Silence peak not zero: {sil_pk}'

    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    out_p = os.path.join(HERE, 'out', 'mix.wav')
    sf.write(out_p, master, SR)
    print(f'mix verified: silence_peak={sil_pk:.6f} (digital zero), master_peak={float(np.max(np.abs(master))):.3f}')
    print(f'wrote {out_p}')


if __name__ == '__main__':
    main()
