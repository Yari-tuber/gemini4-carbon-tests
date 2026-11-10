#!/bin/sh
# Engineering Briefing Board — "死线之前：狂犬病暴露后阻断简报" (rabies-briefing)
# One-command reproducible build:
#   objects/prints -> voice + ASR check -> scene + SRT + fonts -> 5 QA checks -> audio mix -> 24fps video -> loudnorm mux -> poster.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB="${LIB:-$HOME/lemo-opuscar}"
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "Error: set LIB to the lemo-opuscar folder (currently $LIB)"; exit 1; }

if [ -x "$LIB/.venv/Scripts/python.exe" ]; then
  PY="$LIB/.venv/Scripts/python.exe"
else
  PY="$LIB/.venv/bin/python"
fi

if [ -x "$HERE/.venv/Scripts/python.exe" ]; then
  OBJ_PY="$HERE/.venv/Scripts/python.exe"
else
  OBJ_PY="$PY"
fi

NAME="rabies-briefing"
cd "$HERE"

# 1. Cut-out objects & scientific micrograph prints (cached unless missing)
for j in dog cat bat tap soap iodine syringe vial em_niaid print_phil_em print_negri; do
  [ -f "kit/objects/$j.png" ] || { "$OBJ_PY" kit/tools/build_all_objects.py; break; }
done

# 2. Gemini 3.8 Flash TTS voiceover & Whisper ASR verification
[ -f "audio/vo/L18.wav" ] || "$PY" audio/gen_tts_gemini.py
"$PY" "$LIB/core/tts/asr_check.py" audio/lines.json audio/vo --lang zh

# 3. Scene world, audio cues, SRT subtitles, and subsetted OFL fonts
"$PY" scenes/_gen_film.py
"$PY" "$LIB/core/render/srt.py" "$HERE/audio/cues.json" "$HERE/$NAME.srt"
for f in Archivo-VF.ttf IBMPlexMono-Medium.ttf IBMPlexMono-SemiBold.ttf LXGWMarkerGothic-sub.woff2 NotoSansSC-500-sub.woff2 NotoSansSC-700-sub.woff2 NotoSansSC-900-sub.woff2; do
  [ -f "kit/fonts/$f" ] || { "$PY" kit/tools/fetch_fonts.py; break; }
done

# 4. Five automated quality gates (beat grid, subtitles, camera framing, photo resolution, reading holds)
"$PY" tools/cuecheck.py
cd "$LIB"
node "$HERE/tools/subcheck.mjs" "$HERE/$NAME.srt"
node "$HERE/tools/camcheck.mjs"
node "$HERE/tools/rescheck.mjs"
node core/render/readcheck.mjs "$HERE" --step 0.05
node core/render/events.mjs "$HERE"

# 5. Score + procedural foley mix, 2K 60fps picture render, EBU R128 loudnorm master mux, and 2K poster
"$PY" "$HERE/audio/mix.py"
node core/render/video.mjs "$HERE" --size 2560x1440 --fps 60 --workers "${WORKERS:-6}" --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/$NAME.mp4" 60 1
node core/render/still.mjs "$HERE" 104.5 --size 2560x1440 --prefix poster_ --out "$HERE/stills"
cp "$HERE/stills/poster_104.5.jpg" "$HERE/poster.jpg"
mv "$HERE/stills/poster_104.5.jpg" "$HERE/stills/styleframe.jpg"
echo "done: $HERE/$NAME.mp4"
