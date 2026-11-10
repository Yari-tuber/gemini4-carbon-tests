// tools/dump_timeline.mjs — Export timeline.js (+ measured voices/dur.json if present) to timeline.json & out/srt.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FPS, BPM, BEAT, BAR, BARS, DUR, SHOTS, CUES, SILENCES, VOICES, BENTO_ITEMS } from '../timeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.dirname(HERE);

const durPath = path.join(PROJ, 'voices', 'dur.json');
let durs = {};
if (fs.existsSync(durPath)) {
  durs = JSON.parse(fs.readFileSync(durPath, 'utf8'));
}

const voices = VOICES.map(v => {
  const realDur = durs[v.id] ? +durs[v.id] : v.dur;
  const minEnd = +(v.t0 + Math.max(1.8, realDur + 0.62)).toFixed(3);
  const toast1 = Math.max(v.toast1, minEnd);
  return { ...v, dur: realDur, toast1 };
});

const tl = {
  fps: FPS,
  bpm: BPM,
  beat: BEAT,
  bar: BAR,
  bars: BARS,
  dur: DUR,
  shots: SHOTS,
  cues: CUES,
  silences: SILENCES,
  voices,
  bento: BENTO_ITEMS,
};

fs.writeFileSync(path.join(PROJ, 'timeline.json'), JSON.stringify(tl, null, 2));
fs.mkdirSync(path.join(PROJ, 'out'), { recursive: true });
fs.writeFileSync(
  path.join(PROJ, 'out', 'srt.json'),
  JSON.stringify(voices.map(v => ({ t0: v.toast0, t1: v.toast1, text: v.text })), null, 2)
);
console.log('wrote timeline.json and out/srt.json');
