import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as T from '../timeline.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
fs.mkdirSync(path.join(root, 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'timeline.json'), JSON.stringify({
  fps: T.FPS,
  bpm: T.BPM,
  beat: T.BEAT,
  bar: T.BAR,
  dur: T.DUR,
  shots: T.SHOTS,
  cues: T.CUES,
  silences: T.SILENCES,
  drops: T.DROP_BEATS,
  pillars: T.PILLARS,
  voices: T.VOICES,
  srt: T.SRT_CUES,
}, null, 2));
fs.writeFileSync(path.join(root, 'out', 'srt.json'), JSON.stringify(T.SRT_CUES, null, 2));
console.log('wrote timeline.json and out/srt.json');
