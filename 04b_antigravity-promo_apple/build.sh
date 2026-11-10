#!/bin/sh
# One-command full rebuild of 《Google Antigravity — 让创造，脱离引力》
# Outputs: antigravity-apple-promo.mp4 (60.00 s, 2560x1440 @ 60 fps), poster.jpg (2560x1440), antigravity-apple-promo.srt
set -e
LIB=${LIB:-$HOME/lemo-opuscar}
HERE=$(cd "$(dirname "$0")" && pwd)
for d in "/c/Program Files/nodejs"; do
  [ -d "$d" ] && PATH="$d:$PATH"
done
export LIB PATH

if [ -x "$LIB/.venv/Scripts/python.exe" ]; then
  PY="$LIB/.venv/Scripts/python.exe"
else
  PY="$LIB/.venv/bin/python"
fi

[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }

[ -f "$HERE/assets/seq/manifest.json" ] || "$PY" "$HERE/tools/prepare_assets.py"
"$PY" "$HERE/tools/fetch_fonts.py"

cd "$LIB"
"$PY" core/tts/tts_zh.py "$HERE/lines.json" "$HERE/voices"
"$PY" core/tts/asr_check.py "$HERE/lines.json" "$HERE/voices" --lang zh
node "$HERE/tools/dump_timeline.mjs"

"$PY" "$HERE/music/score.py"
node core/render/events.mjs "$HERE"
node core/render/readcheck.mjs "$HERE" --size 2560x1440
"$PY" "$HERE/tools/cuecheck.py"
"$PY" "$HERE/mix.py"
"$PY" core/render/srt.py "$HERE/out/srt.json" "$HERE/antigravity-apple-promo.srt"

node core/render/video.mjs "$HERE" --size 2560x1440 --fps 60 --workers 4 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/antigravity-apple-promo.mp4" 60 0

node core/render/still.mjs "$HERE" 0 --size 2560x1440 --q scene=poster --out "$HERE/out" --prefix poster_
cp "$HERE/out/poster_0.jpg" "$HERE/poster.jpg"
echo "✓ Built $HERE/antigravity-apple-promo.mp4, poster.jpg, and antigravity-apple-promo.srt"
