# -*- coding: utf-8 -*-
"""Synthesize narration lines via Google AI Studio Gemini 3.8 Flash TTS (`models/gemini-3.8-flash-tts`).
Applies crisp briefing-room tempo (1.14x WSOLA via FFmpeg atempo) and trims silence into 48 kHz mono WAVs.
"""
import base64, hashlib, io, json, os, subprocess, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import numpy as np
import soundfile as sf
import soxr

HERE = Path(__file__).resolve().parent
VO_DIR = HERE / "vo"
RAW_VO_DIR = HERE / "vo_raw"
VO_DIR.mkdir(parents=True, exist_ok=True)
RAW_VO_DIR.mkdir(parents=True, exist_ok=True)
LINES = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))

# public repo: the original read the keys from a private file on the author's PC.
# Now: set the environment variable GEMINI_API_KEY (several keys: separate them with commas).
KEYS = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
if not KEYS:
    raise SystemExit("Set the GEMINI_API_KEY environment variable (Google AI Studio key)")

MODEL = "gemini-3.8-flash-tts"
VOICE = "Charon"
TEMPO = 1.18  # Brisk, confident CDC engineering briefing cadence (~5.0 chars/sec)
SR_OUT = 48000
BAD_KEYS = set()
FFMPEG = "ffmpeg"  # public repo: was an absolute path to ffmpeg on the author's PC, falling back to "ffmpeg"


def trim_silence(x: np.ndarray, sr: int, thr_db: float = -42.0, pad_start: float = 0.02, pad_end: float = 0.045) -> np.ndarray:
    if x.ndim > 1:
        x = x.mean(axis=1)
    peak = float(np.max(np.abs(x))) + 1e-9
    x = x / peak * 0.85
    win = max(1, int(0.01 * sr))
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same") + 1e-12)
    thr = 10.0 ** (thr_db / 20.0)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    i0 = max(0, int(idx[0] - pad_start * sr))
    i1 = min(len(x), int(idx[-1] + pad_end * sr))
    out = x[i0:i1].copy()
    fi = min(len(out) // 4, int(0.012 * sr))
    fo = min(len(out) // 4, int(0.022 * sr))
    if fi > 0:
        out[:fi] *= np.linspace(0.0, 1.0, fi)
    if fo > 0:
        out[-fo:] *= np.linspace(1.0, 0.0, fo)
    return out.astype(np.float32)


def synth_one(idx: int, item: dict) -> tuple[str, float]:
    lid = item["id"]
    h = hashlib.md5((VOICE + "|" + item["text"]).encode("utf-8")).hexdigest()[:12]
    cache_wav = RAW_VO_DIR / f"{lid}_{h}.wav"
    out_wav = VO_DIR / f"{lid}.wav"

    if not cache_wav.exists():
        body = {
            "contents": [{"parts": [{"text": item["text"]}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}
                },
            },
        }
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        last_err = None
        for attempt in range(len(KEYS)):
            good_keys = [k for k in KEYS if k not in BAD_KEYS] or KEYS
            key = good_keys[(idx + attempt) % len(good_keys)]
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                part = res["candidates"][0]["content"]["parts"][0]["inlineData"]
                raw = base64.b64decode(part["data"])
                audio, sr = sf.read(io.BytesIO(raw), dtype="float32")
                if sr != SR_OUT:
                    audio = soxr.resample(audio, sr, SR_OUT)
                sf.write(str(cache_wav), audio, SR_OUT)
                break
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code in (400, 401, 403):
                    BAD_KEYS.add(key)
                else:
                    time.sleep(0.8)
            except Exception as e:
                last_err = e
                time.sleep(0.8)
        else:
            raise RuntimeError(f"Failed {lid}: {last_err}")

    tmp_tempo = RAW_VO_DIR / f"{lid}_tempo.wav"
    subprocess.run(
        [FFMPEG, "-y", "-loglevel", "error", "-i", str(cache_wav), "-af", f"atempo={TEMPO}", "-ar", str(SR_OUT), "-ac", "1", str(tmp_tempo)],
        check=True,
    )
    sped, sr = sf.read(str(tmp_tempo), dtype="float32")
    trimmed = trim_silence(sped, sr)
    dur = round(len(trimmed) / SR_OUT, 4)
    sf.write(str(out_wav), trimmed, SR_OUT)
    return lid, dur


def main():
    durs = {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(synth_one, i, item): item for i, item in enumerate(LINES)}
        for f in as_completed(futs):
            lid, dur = f.result()
            durs[lid] = dur
            print(f"  {lid}: {dur:.3f} s")
    ordered = {item["id"]: durs[item["id"]] for item in LINES}
    (VO_DIR / "dur.json").write_text(json.dumps(ordered, indent=2), encoding="utf-8")
    print(f"Total net speech: {sum(ordered.values()):.2f} s across {len(ordered)} lines")


if __name__ == "__main__":
    main()
