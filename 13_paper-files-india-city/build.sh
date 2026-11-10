#!/usr/bin/env sh
# One-command reproducible build for "Every Indian Could Stand Inside One City" (1080x1920 @ 30fps, -14 LUFS)
set -eu

DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
LIB="${LIB:-$HOME/lemo-opuscar}"
PY="$LIB/.venv/Scripts/python.exe"

mkdir -p "$DIR/out"

echo "[1/7] Building high-precision GIS polygons & 4K satellite masks..."
"$PY" "$DIR/scripts/build_gis_assets.py"

echo "[2/7] Synthesizing & verifying English narration..."
"$PY" "$LIB/core/tts/tts.py" "$DIR/lines.json" "$DIR/voices" --voice am_michael
"$PY" "$LIB/core/tts/asr_check.py" "$DIR/lines.json" "$DIR/voices" --lang en --model base.en
"$PY" "$LIB/core/render/srt.py" "$DIR/cues.json" "$DIR/voices/dur.json" "$DIR/paper-files-india-city.srt"

echo "[3/7] Exporting picture-locked events & checking on-screen reading speed..."
node "$LIB/core/render/events.mjs" "$DIR" --size 1080x1920 --out "$DIR/events.json"
node "$LIB/core/render/readcheck.mjs" "$DIR" --size 1080x1920

echo "[4/7] Rendering 1080x1920 @ 30fps WebGL + 2D HUD master frames..."
node "$LIB/core/render/video.mjs" "$DIR" --fps 30 --workers 4 --size 1080x1920 --out "$DIR/out/video.mp4"

echo "[5/7] Synthesizing 128 BPM electronic score, foley & broadcast voice mix..."
"$PY" "$DIR/mix.py"

echo "[6/7] Mastering & muxing to -14 LUFS with subtle film grain..."
sh "$LIB/core/render/mux.sh" "$DIR/out/video.mp4" "$DIR/out/mix.wav" "$DIR/paper-files-india-city.mp4" 30 1

echo "[7/7] Rendering signature poster.jpg..."
node "$LIB/core/render/still.mjs" "$DIR" 1.2 --size 1080x1920 --out "$DIR/out"
cp "$DIR/out/t_1.2.jpg" "$DIR/poster.jpg"

echo "Done -> $DIR/paper-files-india-city.mp4"
