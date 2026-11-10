"""
Master Sound Design & Mix for "Every Indian Could Stand Inside One City" (37.50s, 48 kHz Stereo).
Implements every layer from TREATMENT.md:
1. Broadcast-processed Kokoro narration (`voices/l01.wav`..`l12.wav`) placed at exact `timeline.js` timestamps.
2. Original 128.0 BPM (exact 80-beat seamless loop) documentary electronic pulse score:
   - Warm sub-bass with 2nd & 3rd harmonics (phone-speaker audible per TECHNIQUE.md §5)
   - 16th-note muted synth pluck arpeggiator with stereo Haas width
   - Tight soft kick + crisp off-beat rim ticks
   - Eerie blackout pad in Scene 5 + radiant harmonic lift in Scenes 6-7
   - Two engineered -25 dB suck-outs (15.55s before "Empty", 31.65s before "It fits")
   - Smooth sidechain ducking under voiceover (~10 dB voice-to-score headroom)
3. Deterministic procedural foley driven by `events.json` (`core/audio/sfx.py` + stereo granular crowd cascade).
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

LIB = Path(__import__("os").environ.get("LIB") or Path.home() / "lemo-opuscar")
sys.path.insert(0, str(LIB / "core" / "audio"))
import sfx  # noqa: E402

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SR = sfx.SR  # 48000 Hz
DUR = 37.50
N_SAMPLES = int(round(DUR * SR))
BPM = 128.0
BEAT = 60.0 / BPM          # 0.46875s (80 beats = 37.500s exact!)
STEP16 = BEAT / 4.0        # 0.1171875s

LINE_STARTS = [
    ("l01", 0.04),
    ("l02", 3.15),
    ("l03", 9.12),
    ("l04", 12.24),
    ("l05", 15.62),
    ("l06", 17.75),
    ("l07", 20.65),
    ("l08", 24.18),
    ("l09", 27.05),
    ("l10", 30.22),
    ("l11", 32.12),
    ("l12", 34.06),
]


def midi_to_hz(m):
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def make_chime(freqs, dur=0.8, amp=0.14):
    tt = sfx.t_(dur)
    sig = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * (3.2 + 0.8 * i)) for i, f in enumerate(freqs))
    return (sfx.norm(sig) * amp).astype(np.float32)


def make_riser(dur=2.0, f0=200.0, f1=1300.0, amp=0.14):
    tt = sfx.t_(dur)
    f = f0 + (f1 - f0) * (tt / dur) ** 1.6
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.45
    air = sfx.bp(sfx.noise(dur), max(120.0, f0), min(6000.0, f1 * 1.4)) * 0.55
    env = np.sin(np.pi * tt / dur) ** 1.2
    return (sfx.norm((tone + air) * env) * amp).astype(np.float32)


def resample_to_sr(wav, orig_sr):
    if orig_sr == SR:
        return wav.astype(np.float32)
    g = math.gcd(int(orig_sr), int(SR))
    return signal.resample_poly(wav, SR // g, orig_sr // g).astype(np.float32)


def process_voice(mono):
    """Broadcast voice chain: 85 Hz HPF + +2 dB 3.5 kHz presence + gentle 2.8:1 soft-knee compression."""
    sos_hp = signal.butter(2, 85.0 / (SR * 0.5), btype="highpass", output="sos")
    x = signal.sosfilt(sos_hp, mono)
    # Subtle 3.5 kHz clarity shelf via peaking biquad
    b, a = signal.iirpeak(3500.0 / (SR * 0.5), Q=1.2)
    x = x + 0.24 * signal.lfilter(b, a, x)
    # Envelope follower soft compressor
    env = np.abs(x)
    sos_env = signal.butter(1, 25.0 / (SR * 0.5), btype="lowpass", output="sos")
    env_s = signal.sosfilt(sos_env, env) + 1e-6
    thresh = 0.16
    gain = np.where(env_s > thresh, (thresh + (env_s - thresh) / 2.8) / env_s, 1.0)
    y = x * gain
    # Normalize RMS cleanly
    rms = np.sqrt(np.mean(y * y) + 1e-9)
    return (y * (0.21 / rms)).astype(np.float32)


def build_voice_stem():
    stem = np.zeros((N_SAMPLES, 2), dtype=np.float32)
    env_track = np.zeros(N_SAMPLES, dtype=np.float32)
    for lid, t0 in LINE_STARTS:
        wav_p = ROOT / "voices" / f"{lid}.wav"
        data, vsr = sf.read(wav_p, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)
        v = process_voice(resample_to_sr(data, vsr))
        # Tiny 8ms fade in/out to prevent clicks
        fi = min(int(0.008 * SR), len(v) // 4)
        v[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
        v[-fi:] *= np.linspace(1, 0, fi, dtype=np.float32)

        idx = int(round(t0 * SR))
        end = min(N_SAMPLES, idx + len(v))
        seg_len = end - idx
        if seg_len > 0:
            stem[idx:end, 0] += v[:seg_len]
            stem[idx:end, 1] += v[:seg_len]
            env_track[idx:end] = np.maximum(env_track[idx:end], np.abs(v[:seg_len]))

    # Smooth sidechain detector (attack ~20ms, release ~220ms)
    sos_sc = signal.butter(1, 5.5 / (SR * 0.5), btype="lowpass", output="sos")
    sc = np.clip(signal.sosfilt(sos_sc, env_track) * 6.5, 0.0, 1.0)
    return stem, sc


def synth_score():
    """Synthesize original 80-beat (20-bar) 128 BPM documentary electronic pulse score."""
    score = np.zeros((N_SAMPLES, 2), dtype=np.float32)
    rng = np.random.default_rng(2026)

    # 4-bar chord cycle repeated 5x = 20 bars exact (Cm9 -> Abmaj7 -> Fm9 -> G7sus4 -> seamless loop to Cm9!)
    prog_bass = [36, 32, 29, 31]  # C2, Ab1, F1, G1
    prog_arp = [
        [60, 63, 67, 74, 67, 63, 72, 67],  # Cm9
        [56, 60, 63, 70, 67, 63, 68, 63],  # Abmaj7
        [53, 56, 60, 67, 63, 60, 65, 60],  # Fm9
        [55, 60, 62, 67, 65, 62, 67, 62],  # G7sus4
    ]

    total_beats = 80
    total_steps = total_beats * 4  # 320 16th-notes

    for step in range(total_steps):
        t_step = step * STEP16
        bar = step // 16
        chord_idx = bar % 4
        in_blackout = 15.80 <= t_step < 20.55
        in_lift = 20.65 <= t_step < 34.40

        # 1. 16th-note documentary pluck arpeggio (muted during blackout for stark contrast!)
        if not in_blackout:
            arp_notes = prog_arp[chord_idx]
            midi_n = arp_notes[step % 8] + (12 if (in_lift and step % 4 == 2) else 0)
            freq = midi_to_hz(midi_n)
            dur_n = int(0.19 * SR)
            tt = np.arange(dur_n, dtype=np.float32) / SR
            # Warm triangle + 2nd harmonic pluck with fast filter-like decay
            env = np.exp(-tt * 22.0) * (1.0 - np.exp(-tt * 420.0))
            tone = (np.sin(2 * np.pi * freq * tt) * 0.72 + np.sin(4 * np.pi * freq * tt) * 0.28 * np.exp(-tt * 35.0)) * env
            vel = 0.085 if (step % 4 == 0) else (0.058 if (step % 2 == 0) else 0.042)
            if in_lift:
                vel *= 1.18
            pan = 0.28 * math.sin(step * 0.85)
            sfx.add(score, tone * vel, t_step, pan=pan)

        # 2. Driving pulse bass + soft electronic kick on every beat (muted during S5 blackout)
        if step % 4 == 0 and not in_blackout:
            b_midi = prog_bass[chord_idx]
            bf = midi_to_hz(b_midi)
            bdur = int(BEAT * 0.92 * SR)
            bt = np.arange(bdur, dtype=np.float32) / SR
            b_env = np.exp(-bt * 5.8) * (1.0 - np.exp(-bt * 180.0))
            # Fundamental + 2nd + 3rd harmonics so laptop & phone speakers hear tight warm bass!
            bass = (
                0.56 * np.sin(2 * np.pi * bf * bt)
                + 0.32 * np.sin(4 * np.pi * bf * bt)
                + 0.14 * np.sin(6 * np.pi * bf * bt)
            ) * b_env * 0.145
            sfx.add(score, bass, t_step, pan=0.0)

            # Tight soft documentary pulse kick
            kt = np.arange(int(0.12 * SR), dtype=np.float32) / SR
            k_freq = 54.0 + 95.0 * np.exp(-kt * 48.0)
            k_phase = 2 * np.pi * np.cumsum(k_freq) / SR
            kick = np.sin(k_phase) * np.exp(-kt * 26.0) * 0.155
            sfx.add(score, kick, t_step, pan=0.0)

        # 3. Crisp subtle hi-hat / rim tick on off-beats
        if step % 2 == 1 and not in_blackout:
            ht = np.arange(int(0.035 * SR), dtype=np.float32) / SR
            noise = rng.standard_normal(len(ht)).astype(np.float32)
            sos_h = signal.butter(2, 6500.0 / (SR * 0.5), btype="highpass", output="sos")
            hat = signal.sosfilt(sos_h, noise) * np.exp(-ht * 95.0) * (0.036 if step % 4 == 2 else 0.024)
            sfx.add(score, hat, t_step, pan=-0.15 if step % 4 == 1 else 0.15)

    # 4. Eerie dark atmospheric sub-pad during Scene 5 Empty India Blackout (16.10s -> 20.55s)
    pad_dur = int(4.50 * SR)
    pt = np.arange(pad_dur, dtype=np.float32) / SR
    pad_env = np.sin(np.clip(pt / 4.50, 0, 1) * np.pi) ** 0.7
    f_c2, f_g2, f_eb3 = midi_to_hz(36), midi_to_hz(43), midi_to_hz(51)
    pad_l = (0.45 * np.sin(2 * np.pi * f_c2 * pt) + 0.30 * np.sin(2 * np.pi * (f_g2 * 1.002) * pt) + 0.22 * np.sin(2 * np.pi * f_eb3 * pt)) * pad_env * 0.095
    pad_r = (0.45 * np.sin(2 * np.pi * f_c2 * pt) + 0.30 * np.sin(2 * np.pi * (f_g2 * 0.998) * pt) + 0.22 * np.sin(2 * np.pi * (f_eb3 * 1.003) * pt)) * pad_env * 0.095
    i0 = int(16.08 * SR)
    score[i0 : i0 + pad_dur, 0] += pad_l
    score[i0 : i0 + pad_dur, 1] += pad_r

    # 5. Warm shimmering pad lift in Scene 6a-7 (20.65s -> 34.20s)
    lift_dur = int(13.55 * SR)
    lt = np.arange(lift_dur, dtype=np.float32) / SR
    l_env = np.minimum(1.0, lt / 1.2) * np.minimum(1.0, (13.55 - lt) / 1.5)
    shimmer_l = (np.sin(2 * np.pi * midi_to_hz(60) * lt) + 0.7 * np.sin(2 * np.pi * midi_to_hz(67.01) * lt) + 0.5 * np.sin(2 * np.pi * midi_to_hz(74) * lt)) * l_env * 0.032
    shimmer_r = (np.sin(2 * np.pi * midi_to_hz(60.02) * lt) + 0.7 * np.sin(2 * np.pi * midi_to_hz(67) * lt) + 0.5 * np.sin(2 * np.pi * midi_to_hz(74.02) * lt)) * l_env * 0.032
    il = int(20.65 * SR)
    score[il : il + lift_dur, 0] += shimmer_l
    score[il : il + lift_dur, 1] += shimmer_r

    return score


def synth_granular_pour(dur_s, seed=55):
    """Rich tactile stereo cascade of thousands of miniature architectural pins/grains pouring onto sand."""
    rng = np.random.default_rng(seed)
    n = int(dur_s * SR)
    out = np.zeros((n, 2), dtype=np.float32)
    t = np.arange(n, dtype=np.float32) / SR
    swell = np.sin(np.clip(t / dur_s, 0, 1) * np.pi) ** 0.65

    # Filtered velvet sand rush bed
    white = rng.standard_normal(n).astype(np.float32)
    sos_bp = signal.butter(2, [900.0 / (SR * 0.5), 5200.0 / (SR * 0.5)], btype="bandpass", output="sos")
    bed = signal.sosfilt(sos_bp, white) * swell * 0.055
    out[:, 0] += bed
    out[:, 1] += np.roll(bed, 19)

    # 240 discrete micro-grain impacts cascading left-to-right across stereo field
    for _ in range(240):
        gt = rng.uniform(0.04, dur_s - 0.06)
        gi = int(gt * SR)
        glen = int(0.014 * SR)
        if gi + glen >= n:
            continue
        g_tt = np.arange(glen, dtype=np.float32) / SR
        gf = rng.uniform(1400.0, 4600.0)
        grain = np.sin(2 * np.pi * gf * g_tt) * np.exp(-g_tt * 260.0) * rng.uniform(0.012, 0.032) * swell[gi]
        pan = rng.uniform(-0.45, 0.55)
        gl = grain * math.sqrt(0.5 * (1.0 - pan))
        gr = grain * math.sqrt(0.5 * (1.0 + pan))
        out[gi : gi + glen, 0] += gl
        out[gi : gi + glen, 1] += gr
    return out


def build_foley_and_suckouts(events):
    foley = np.zeros((N_SAMPLES, 2), dtype=np.float32)
    suck_mask = np.ones(N_SAMPLES, dtype=np.float32)
    rng = np.random.default_rng(909)

    # Subtle open-air concert crowd murmur bed during Scene 3 (6.20s -> 9.45s)
    c_dur = int(3.25 * SR)
    ct = np.arange(c_dur, dtype=np.float32) / SR
    c_env = np.sin(np.clip(ct / 3.25, 0, 1) * np.pi) ** 0.8
    murmur = rng.standard_normal(c_dur).astype(np.float32)
    sos_m = signal.butter(2, [280.0 / (SR * 0.5), 1650.0 / (SR * 0.5)], btype="bandpass", output="sos")
    m_sig = signal.sosfilt(sos_m, murmur) * c_env * 0.028
    ic = int(6.20 * SR)
    foley[ic : ic + c_dur, 0] += m_sig
    foley[ic : ic + c_dur, 1] += np.roll(m_sig, 37)

    for ev in events:
        t = float(ev["t"])
        etype = ev["type"]
        gain = float(ev.get("gain", 0.65))

        if etype == "suckout":
            # Engineered -25 dB (0.056 linear) suck-out dip on score before dramatic reveals!
            d_dur = float(ev.get("dur", 0.50))
            i0 = max(0, int(t * SR))
            i1 = min(N_SAMPLES, int((t + d_dur) * SR))
            if i1 > i0:
                u = np.linspace(0.0, 1.0, i1 - i0, dtype=np.float32)
                dip = 1.0 - 0.944 * (np.maximum(0.0, np.sin(u * np.pi)) ** 0.85)
                suck_mask[i0:i1] = np.minimum(suck_mask[i0:i1], dip)

        elif etype == "sub_hit":
            sfx.add(foley, sfx.thump(v=0.22 * gain, f=56), t, pan=0.0)

        elif etype == "zoom_out":
            sfx.add(foley, sfx.whoosh(d=float(ev.get("dur", 0.65)), v=0.18 * gain), t, pan=0.0)

        elif etype == "shimmer":
            sfx.add(foley, make_chime((1046.5, 1318.5, 1568.0), dur=0.85, amp=0.11 * gain), t, pan=0.1)

        elif etype == "dive_in":
            sfx.add(foley, sfx.whoosh(d=float(ev.get("dur", 0.45)), v=0.20 * gain), t, pan=0.0)

        elif etype == "neon_snap":
            sfx.add(foley, sfx.click(pitch=1.25, v=0.20 * gain), t, pan=0.0)
            sfx.add(foley, make_chime((880.0, 1760.0), dur=0.28, amp=0.09 * gain), t + 0.01, pan=0.0)

        elif etype == "crane_rise":
            sfx.add(foley, make_riser(dur=float(ev.get("dur", 2.10)), f0=180, f1=1250, amp=0.13 * gain), t, pan=0.0)

        elif etype == "tray_lock":
            sfx.add(foley, sfx.click(pitch=0.95, v=0.17 * gain), t, pan=0.0)
            sfx.add(foley, sfx.thump(v=0.14 * gain, f=88), t, pan=0.0)

        elif etype == "pour_sand":
            p_dur = float(ev.get("dur", 2.35))
            pour_st = synth_granular_pour(p_dur, seed=int(t * 100)) * gain
            ip = int(t * SR)
            end = min(N_SAMPLES, ip + len(pour_st))
            foley[ip:end] += pour_st[: end - ip]

        elif etype == "fill_thump":
            sfx.add(foley, sfx.thump(v=0.20 * gain, f=68), t, pan=0.05)

        elif etype == "power_down":
            pd_n = int(0.85 * SR)
            pt = np.arange(pd_n, dtype=np.float32) / SR
            pf = 34.0 + 155.0 * np.exp(-pt * 5.2)
            p_sig = np.sin(2 * np.pi * np.cumsum(pf) / SR) * np.exp(-pt * 2.8) * 0.26 * gain
            sfx.add(foley, p_sig, t, pan=0.0)

        elif etype == "city_ping":
            pitch = float(ev.get("pitch", 1.0))
            pan = float(ev.get("pan", 0.0))
            sfx.add(foley, make_chime((987.77 * pitch, 1480.0 * pitch), dur=0.38, amp=0.13 * gain), t, pan=pan)

        elif etype == "arc_launch":
            sfx.add(foley, make_riser(dur=float(ev.get("dur", 2.6)), f0=240, f1=1680, amp=0.12 * gain), t, pan=0.0)
            sfx.add(foley, make_chime((523.25, 783.99, 1174.66), dur=1.2, amp=0.10 * gain), t + 0.15, pan=0.0)

        elif etype == "heavy_drop":
            sfx.add(foley, sfx.thump(v=0.26 * gain, f=48), t, pan=0.0)
            sfx.add(foley, sfx.click(pitch=0.75, v=0.14 * gain), t, pan=0.0)

        elif etype == "fly_east":
            sfx.add(foley, sfx.whoosh(d=float(ev.get("dur", 2.15)), v=0.18 * gain), t, pan=0.2)

        elif etype == "fit_chime":
            sfx.add(foley, make_chime((523.25, 659.25, 783.99, 1174.66), dur=1.45, amp=0.16 * gain), t, pan=0.0)

        elif etype == "whip_west":
            sfx.add(foley, sfx.whoosh(d=float(ev.get("dur", 2.75)), v=0.17 * gain), t, pan=-0.18)

    return foley, suck_mask


def main():
    events_path = ROOT / "events.json"
    raw_ev = json.loads(events_path.read_text(encoding="utf-8"))
    events = raw_ev["ev"] if isinstance(raw_ev, dict) and "ev" in raw_ev else raw_ev

    print("1. Building compressed broadcast voice stem...")
    voice, sc_duck = build_voice_stem()

    print("2. Synthesizing 80-beat 128 BPM documentary synth-pulse score...")
    score = synth_score()

    print(f"3. Synthesizing procedural foley for {len(events)} picture-locked events...")
    foley, suck_mask = build_foley_and_suckouts(events)

    # Apply sidechain voice ducking (-5.2 dB when voice speaks) + -25 dB suck-outs to score (~+11.5 dB speech-over-score headroom)
    duck_gain = (1.0 - 0.45 * sc_duck) * suck_mask
    score_ducked = score * 2.15 * duck_gain[:, None]
    foley_ducked = foley * 1.15 * (1.0 - 0.22 * sc_duck)[:, None]

    # Add subtle studio room glue on non-voice bus
    bus = score_ducked + foley_ducked
    mix = voice + bus

    # Gentle master soft-clipper ceiling at -1.2 dBFS (mux.sh loudnorm brings exact integrated loudness to -14 LUFS)
    peak = np.max(np.abs(mix)) + 1e-9
    if peak > 0.86:
        mix = np.tanh(mix / 0.86) * 0.86

    out_wav = OUT_DIR / "mix.wav"
    sf.write(out_wav, mix, SR, subtype="PCM_16")

    # Verify voice-to-score headroom
    v_rms = math.sqrt(float(np.mean(voice[sc_duck > 0.15] ** 2)) + 1e-12)
    s_rms = math.sqrt(float(np.mean(score_ducked[sc_duck > 0.15] ** 2)) + 1e-12)
    snr_db = 20.0 * math.log10(v_rms / s_rms)
    print(f"Wrote {out_wav} ({N_SAMPLES / SR:.2f}s @ {SR} Hz), speech-over-score headroom = +{snr_db:.1f} dB")


if __name__ == "__main__":
    main()
