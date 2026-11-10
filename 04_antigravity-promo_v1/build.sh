#!/bin/sh
# One-command full rebuild of 《反重力 · ANTIGRAVITY》 (antigravity-promo.mp4, poster.jpg, antigravity-promo.srt)
set -e
LIB="${LIB:-$HOME/lemo-opuscar}"
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB

if [ -x "$LIB/.venv/Scripts/python.exe" ]; then
  PY="$LIB/.venv/Scripts/python.exe"
else
  PY="$LIB/.venv/bin/python"
fi

[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }

"$PY" "$HERE/tools/fetch_fonts.py"
node "$HERE/tools/dump_timeline.mjs"

cd "$LIB"
"$PY" core/tts/tts_zh.py "$HERE/lines.json" "$HERE/voices"
"$PY" core/tts/asr_check.py "$HERE/lines.json" "$HERE/voices" --lang zh
"$PY" "$HERE/music/score.py"
node core/render/events.mjs "$HERE"
node core/render/readcheck.mjs "$HERE"
"$PY" "$HERE/tools/cuecheck.py"
"$PY" "$HERE/mix.py"
"$PY" core/render/srt.py "$HERE/out/srt.json" "$HERE/antigravity-promo.srt"
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/antigravity-promo.mp4" 24 0
node core/render/still.mjs "$HERE" 0 --q scene=poster --out "$HERE/out" --prefix poster_
cp "$HERE/out/poster_0.jpg" "$HERE/poster.jpg"
echo "✓ Built $HERE/antigravity-promo.mp4, poster.jpg, and antigravity-promo.srt"
