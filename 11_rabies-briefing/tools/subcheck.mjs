// Subtitle check: one line per language (pure Chinese or bilingual), measured with the real fonts in the page.
//   node tools/subcheck.mjs [path/to/rabies-briefing.srt]
import path from 'path'; import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DEMO = path.resolve(HERE, '..');
const LIB = process.env.LIB || (process.env.HOME || process.env.USERPROFILE || '.') + '/lemo-opuscar';
const { openDemo, closeServer } = await import(pathToFileURL(path.join(LIB, 'core/render/page.mjs')).href);
const { browser, page } = await openDemo(DEMO, { w: 1920, h: 1080 });
const rows = await page.evaluate(() => window.SUBCHECK());
await browser.close(); closeServer();
let bad = 0;
for (const r of rows) {
  const ok = r.ok; if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} #${String(r.i + 1).padStart(2)}  zh ${String(r.wz).padStart(4)} px  en ${String(r.we).padStart(4)} px  (safe ${r.safe})  ${r.zh}${r.en ? ' | ' + r.en : ''}`);
}
const scene = JSON.parse(fs.readFileSync(path.join(DEMO, 'scenes/film.json'), 'utf8'));
for (const [i, s] of (scene.subs || []).entries()) {
  const d = s.t1 - s.t0, need = Math.max(1.8, (s.speech || 0) + .6);
  if (d + 1e-6 < need) { bad++; console.log(`BAD #${i + 1} on screen ${d.toFixed(2)} s, needs ${need.toFixed(2)} s`); }
}
const srt = process.argv[2] || path.join(DEMO, 'rabies-briefing.srt');
if (fs.existsSync(srt)) {
  const blocks = fs.readFileSync(srt, 'utf8').trim().split(/\r?\n\r?\n/);
  for (const b of blocks) {
    const L = b.split(/\r?\n/), text = L.slice(2);
    const han = s => /\p{Script=Han}/u.test(s);
    if (text.length !== 1 || !han(text[0])) { bad++; console.log(`BAD srt cue ${L[0]}: expected 1 single Chinese line, got ${JSON.stringify(text)}`); }
  }
  console.log(`srt: ${blocks.length} cues checked (${srt})`);
} else console.log(`srt not found yet: ${srt}`);
console.log(bad ? `subcheck: ${bad} problems` : `subcheck: OK (${rows.length} cues, each on one line)`);
process.exit(bad ? 1 : 0);
