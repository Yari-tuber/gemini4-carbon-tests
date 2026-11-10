// film.js — Scene choreography, deterministic renderFrame(g, t), window.EV sound events, and window.TEXTS(t) for readcheck.
import * as E from './engine.js';
import { DUR, CUES, DROP_BEATS, PILLARS, VOICES } from './timeline.js';

const { W, H, PAL, clamp, lerp, seg, ss, eo, ei, eio, back, spring, mulberry, hash, TAU } = E;

// ───────────────────────── Precomputed Deterministic World Layout ─────────────────────────
// Act I ground floor stack positions (4 columns above y = 784)
const COL_X = [310, 650, 990, 1330];
const CARD_W = 308, CARD_H = 66;
const colCounts = [0, 0, 0, 0];
export const DROPS = DROP_BEATS.map((d, i) => {
  const stackIdx = colCounts[d.col]++;
  const targetX = COL_X[d.col] + (hash(i * 7.3) - 0.5) * 14;
  const targetY = 782 - (stackIdx + 1) * (CARD_H + 8);
  const fg = i >= 14 && i % 3 === 2; // 2.5D foreground blurred overload cards in late S2
  return {
    ...d,
    x: targetX,
    yEnd: targetY,
    yStart: -110 - (i % 3) * 45,
    rotEnd: (hash(i * 19.1) - 0.5) * 0.045,
    z: fg ? 0.24 : 0,
  };
});

// Act II S4: 4 Pillars × 4 Modules = 16 Snap-Grid Tiles
// Cleanly positioned in y = 216..712 (well above bottom toast y = 890..970!)
export const MODULES = [];
const GRID_X0 = 256, GRID_Y0 = 224, TILE_W = 328, TILE_H = 104, GAP_X = 32, GAP_Y = 20;
PILLARS.forEach((p, col) => {
  p.items.forEach((label, row) => {
    const idx = col * 4 + row;
    const gx = GRID_X0 + col * (TILE_W + GAP_X);
    const gy = GRID_Y0 + row * (TILE_H + GAP_Y);
    // Start positions down near the floor before crane ascent
    const sx = 340 + col * 360 + (row - 1.5) * 34;
    const sy = 790 + row * 68 + col * 16;
    MODULES.push({
      idx,
      col,
      row,
      code: `${p.code}.${row + 1}`,
      pillarName: p.name,
      trailColor: p.trail,
      label,
      sx,
      sy,
      gx,
      gy,
      tLaunch: 16.98 + row * 0.22 + col * 0.07,
      durFlight: 2.35 + row * 0.18,
    });
  });
});

// Sound / Foley events exported via window.EV for mix.py & cuecheck.py
export function buildEvents() {
  const ev = [];
  // S1 '9.8' scramble grains & locks
  for (let t = 0.04; t < 0.50; t += 0.06) ev.push({ t: +t.toFixed(4), type: 'grain', gain: 0.45 });
  ev.push({ t: CUES.lock_9,    type: 'digit_lock', pitch: 0.9,  gain: 0.7 });
  ev.push({ t: CUES.lock_dot1, type: 'digit_lock', pitch: 1.0,  gain: 0.55 });
  ev.push({ t: CUES.lock_8,    type: 'digit_lock', pitch: 0.82, gain: 0.75 });
  ev.push({ t: CUES.s1_collapse, type: 'ui_whoosh', pitch: 0.85, gain: 0.7 });

  // Act I gravity drops
  DROPS.forEach((d, i) => {
    ev.push({
      t: d.tLand,
      type: d.sev ? 'drop_err' : 'drop_thud',
      pan: +(((d.col - 1.5) / 2.2)).toFixed(2),
      gain: +(0.48 + Math.min(0.42, i * 0.02)).toFixed(3),
      idx: i,
    });
  });

  // Freeze & Ignition
  ev.push({ t: CUES.freeze_start, type: 'freeze_cut', gain: 0.85 });
  ev.push({ t: CUES.ignite_chime, type: 'prism_wake', gain: 0.90 });
  ev.push({ t: CUES.console_open, type: 'ui_expand',  gain: 0.65 });

  // S3 Console caret ticks & keystrokes
  for (let k = 0; k < 6; k++) {
    ev.push({ t: +(12.75 + k * 0.50).toFixed(4), type: 'caret_tick', gain: 0.35 });
  }
  for (let k = 0; k < 11; k++) {
    ev.push({ t: +(12.62 + k * 0.14).toFixed(4), type: 'key_soft', pan: +((k / 10 - 0.5) * 0.25).toFixed(2), gain: 0.42 });
  }
  ev.push({ t: CUES.exec_press,   type: 'exec_press',   gain: 0.95 });
  ev.push({ t: 16.15,             type: 'horizon_sweep', gain: 0.78 });
  ev.push({ t: 16.70,             type: 'jcut_ascent',   gain: 0.65 }); // J-cut into S4!

  // S4 Crane ascent streams & 22.00s Snap Grid
  MODULES.forEach((m) => {
    ev.push({ t: +Math.max(17.02, m.tLaunch).toFixed(4), type: 'lift_stream', pan: +(((m.col - 1.5) / 2.2)).toFixed(2), gain: 0.34 });
  });
  ev.push({ t: CUES.snap_grid, type: 'snap_lock', gain: 1.0 });

  // S5 J-cut shimmer & Light Reveal & Dive
  ev.push({ t: 26.65,            type: 'jcut_shimmer', gain: 0.65 }); // J-cut into S5!
  ev.push({ t: CUES.studio_open, type: 'light_sweep',  gain: 0.85 });
  ev.push({ t: 29.50,            type: 'tab_predict',  gain: 0.55 });
  ev.push({ t: CUES.studio_dive, type: 'dive_whoosh',  gain: 0.82 });

  // S6 0.0 G scramble & locks (after 33.00-33.50 near-silence!)
  for (let t = 33.22; t < 33.74; t += 0.0625) ev.push({ t: +t.toFixed(4), type: 'grain', gain: 0.38 });
  ev.push({ t: CUES.lock_0a,   type: 'bell_lock', pitch: 1.00, gain: 0.82 });
  ev.push({ t: CUES.lock_dot2, type: 'bell_lock', pitch: 1.25, gain: 0.72 });
  ev.push({ t: CUES.lock_0b,   type: 'bell_lock', pitch: 1.50, gain: 0.90 });

  // S7 Orbital pull-out & Hero light sweep
  ev.push({ t: CUES.orbit_open, type: 'ui_expand',   gain: 0.65 });
  ev.push({ t: CUES.hero_sweep, type: 'hero_glint',  gain: 0.75 });

  return ev.sort((a, b) => a.t - b.t);
}

// ───────────────────────── Helper UI Drawers ─────────────────────────
function drawErrorCard(g, x, y, w, h, d, landAge, allowRed = true) {
  const sq = landAge >= 0 && landAge < 0.14 ? 1 - 0.10 * Math.sin((landAge / 0.14) * Math.PI) : 1;
  const sx = 1 + (1 - sq) * 0.6;
  const cx = x + w / 2, cy = y + h;
  g.save();
  g.translate(cx, cy);
  g.scale(sx, sq);
  g.translate(-cx, -cy);

  E.panel(g, x, y, w, h, { r: 12, fill: '#141926', cheap: true, shadow: 0.9 });
  // Left status bar
  const barCol = allowRed && d.sev ? PAL.red : '#4B556E';
  g.fillStyle = barCol;
  E.rr(g, x + 12, y + 14, 4, h - 28, 2);
  g.fill();

  // Filename in mono
  g.fillStyle = PAL.text;
  g.font = E.font(15, 500, 'mono');
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillText(d.file.trim(), x + 28, y + 29);

  // Subtle code bar skeleton
  g.fillStyle = 'rgba(255,255,255,0.09)';
  g.fillRect(x + 28, y + 40, w * 0.44, 6);

  // Problem badge (strictly extinguished once allowRed is false!)
  const bw = 78, bh = 24, bx = x + w - bw - 12, by = y + (h - bh) / 2;
  if (allowRed && d.sev) {
    g.fillStyle = E.rgba(PAL.red, 0.18);
    E.rr(g, bx, by, bw, bh, 12);
    g.fill();
    g.strokeStyle = E.rgba(PAL.red, 0.65);
    g.lineWidth = 1;
    E.rr(g, bx + 0.5, by + 0.5, bw - 1, bh - 1, 12);
    g.stroke();
    g.fillStyle = '#FF8590';
  } else {
    g.fillStyle = 'rgba(255,255,255,0.06)';
    E.rr(g, bx, by, bw, bh, 12);
    g.fill();
    g.fillStyle = PAL.dim;
  }
  g.font = E.font(12, 500, 'zh');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(d.err, bx + bw / 2, by + bh / 2 + 0.5);
  g.restore();
}

function drawStudioSurface(g, w, h, t) {
  // Opaque studio panel (1240 x 640) — no system buttons, 100% original Antigravity UI
  g.fillStyle = '#0D111B';
  E.rr(g, 0, 0, w, h, 22);
  g.fill();
  E.panel(g, 0, 0, w, h, { r: 22, fill: '#0F1420', shadow: 0, hi: 1.2 });

  // Top Header Bar (58 px)
  g.fillStyle = 'rgba(255,255,255,0.028)';
  E.rr(g, 1, 1, w - 2, 58, 22);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 58, w, 1);

  E.agPrism(g, 38, 30, 15, { accent: true, glowMul: 0.7 });
  g.fillStyle = PAL.text;
  g.font = E.font(18, 600, 'zh');
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('反重力工作台', 66, 30);

  g.fillStyle = PAL.mute;
  g.font = E.font(13, 500, 'mono');
  g.fillText('WORKSPACE · SYNCED', 194, 30.5);

  // Top-right 0.0 G Status Pill (Target of the 32.75 s log-zoom dive!)
  const pw = 236, ph = 36, px = w - pw - 18, py = 11;
  g.fillStyle = '#090C14';
  E.rr(g, px, py, pw, ph, 18);
  g.fill();
  g.strokeStyle = E.rgba(PAL.accent, 0.72);
  g.lineWidth = 1.2;
  E.rr(g, px + 0.5, py + 0.5, pw - 1, ph - 1, 18);
  g.stroke();
  g.fillStyle = PAL.accent;
  g.shadowColor = E.rgba(PAL.accent, 0.8);
  g.shadowBlur = 10;
  g.beginPath();
  g.arc(px + 18, py + ph / 2, 4.5, 0, TAU);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = PAL.text;
  g.font = E.font(14, 500, 'zh');
  g.textAlign = 'left';
  g.fillText('零阻力轨道 · 0.0 G', px + 32, py + ph / 2 + 0.5);

  // Left Sidebar: 4 Autonomous Agent Lanes
  const sideW = 300;
  g.fillStyle = 'rgba(255,255,255,0.018)';
  g.fillRect(1, 59, sideW, h - 60);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(sideW, 59, 1, h - 60);

  PILLARS.forEach((p, i) => {
    const ry = 84 + i * 132;
    E.panel(g, 20, ry, sideW - 40, 114, { r: 14, fill: '#151B2B', cheap: true, shadow: 0.5 });
    g.fillStyle = PAL.dim;
    g.font = E.font(13, 500, 'mono');
    g.textAlign = 'left';
    g.fillText(`AGENT ${p.code}`, 38, ry + 26);

    g.fillStyle = PAL.text;
    g.font = E.font(18, 600, 'zh');
    g.fillText(p.name, 38, ry + 56);

    // Subtle accent ready dot (unified system state)
    g.fillStyle = PAL.accent;
    g.beginPath();
    g.arc(sideW - 44, ry + 26, 4, 0, TAU);
    g.fill();

    // Progress bar (100% locked)
    g.fillStyle = 'rgba(255,255,255,0.07)';
    E.rr(g, 38, ry + 84, sideW - 76, 6, 3);
    g.fill();
    g.fillStyle = 'rgba(238,242,250,0.45)';
    E.rr(g, 38, ry + 84, sideW - 76, 6, 3);
    g.fill();
  });

  // Right Main Code & Predictive Flow Canvas
  const cx0 = sideW + 36, cy0 = 90, cw = w - sideW - 72;
  const R = mulberry(77);
  const codeWidths = [0.42, 0.64, 0.51, 0.33, 0.72, 0.58, 0.46, 0.69, 0.38, 0.61, 0.53, 0.44];
  const indents =    [0,    1,    2,    2,    1,    2,    3,    2,    1,    1,    2,    0];

  for (let i = 0; i < 12; i++) {
    const ly = cy0 + i * 38;
    const isPred = i === 5 || i === 6;
    if (isPred) {
      g.fillStyle = E.rgba(PAL.accent, 0.085);
      E.rr(g, cx0 - 12, ly - 10, cw + 16, 32, 8);
      g.fill();
    }
    // Line number
    g.fillStyle = PAL.mute;
    g.font = E.font(13, 400, 'mono');
    g.textAlign = 'right';
    g.fillText(String(i + 18).padStart(2, '0'), cx0 + 18, ly + 6);

    // Procedural clean syntax bars
    const sx = cx0 + 40 + indents[i] * 28;
    const totW = (cw - 140) * codeWidths[i];
    const seg1 = totW * (0.28 + (R() * 0.18));
    g.fillStyle = isPred ? E.rgba(PAL.accent, 0.85) : 'rgba(238,242,250,0.28)';
    E.rr(g, sx, ly, seg1, 10, 5);
    g.fill();
    g.fillStyle = isPred ? 'rgba(238,242,250,0.65)' : 'rgba(146,157,182,0.22)';
    E.rr(g, sx + seg1 + 12, ly, Math.max(24, totW - seg1 - 12), 10, 5);
    g.fill();
  }

  // Predictive Tab-Jump Arc from line 2 to line 6!
  const arcP = ss(seg(t, 28.2, 29.6));
  if (arcP > 0) {
    const pts = [];
    const nPts = Math.max(2, Math.floor(28 * arcP));
    for (let k = 0; k <= nPts; k++) {
      const u = (k / 28);
      const ax = cx0 + 580 + Math.sin(u * Math.PI) * 96;
      const ay = (cy0 + 1 * 38 + 5) + u * (5 * 38);
      pts.push([ax, ay]);
    }
    E.trail(g, pts, { color: PAL.accent, width: 4, alpha: 0.9 });
    const [lx, ly] = pts[pts.length - 1];
    E.caret(g, lx, ly, 22, { glow: 0.9 });
  }

  // Bottom-right Predictive Status Card inside Studio
  const bx = w - 332, by = h - 86;
  E.panel(g, bx, by, 296, 54, { r: 14, fill: '#161D2E', cheap: true, accentRim: 0.45 });
  E.caret(g, bx + 24, by + 27, 20, { glow: 0.7 });
  g.fillStyle = PAL.text;
  g.font = E.font(16, 500, 'zh');
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('脉络预判已激活', bx + 44, by + 27.5);
  g.fillStyle = PAL.dim;
  g.font = E.font(13, 500, 'mono');
  g.textAlign = 'right';
  g.fillText('TAB · 12ms', bx + 276, by + 28);
}

// ───────────────────────── Current Altitude Curve ─────────────────────────
function altitudeAt(t) {
  if (t < 12.25) return 0;
  if (t < 17.00) return lerp(0, 120, eio(seg(t, 12.25, 17.00)));
  if (t < 22.00) return lerp(120, 600, eio(seg(t, 17.00, 22.00)));
  if (t < 27.00) return 600;
  if (t < 33.00) return lerp(600, 800, eio(seg(t, 27.00, 32.50)));
  return lerp(800, 900, eo(seg(t, 33.00, 34.25)));
}

// ───────────────────────── Main Deterministic Frame Renderer ─────────────────────────
export function renderFrame(g, t, opts = {}) {
  const { noSub = false } = opts;
  const alt = altitudeAt(t);

  // ═══════════════════ S1 (0.00 – 4.50 s) & S2 + Freeze + S3 (4.50 – 17.00 s) ═══════════════════
  if (t < 17.00) {
    const ignited = t >= CUES.ignite_chime;
    const allowRed = !ignited;

    // Camera choreography across S1 -> S2 -> Freeze Push-in -> S3 Console
    const s2In = eio(seg(t, 4.28, 4.62));
    const freezeP = eio(seg(t, 11.00, 12.45));
    const consoleP = eio(seg(t, 12.42, 12.66));

    // Subtle overload tilt & tremble ONLY in 5.5..11.0 s, frozen cleanly at 11.0 s!
    const tOver = Math.min(t, 11.00);
    const tiltBuild = ss(seg(tOver, 5.2, 10.6)) * (1 - freezeP);
    const rot = -0.032 * tiltBuild * s2In;
    const tremble = t < 11.00 ? ss(seg(t, 9.1, 10.95)) * 2.4 : 0;
    const jx = tremble * Math.sin(t * 97.3), jy = tremble * Math.cos(t * 83.7);

    const camZoom = lerp(1.0, lerp(1.08, 1.55, freezeP), s2In) * lerp(1.0, 1 / 1.55, consoleP);
    const camX = 960;
    const camY = lerp(540, lerp(560, 700, freezeP), s2In) * (1 - consoleP) + 540 * consoleP;
    const cam = E.camera({ x: camX, y: camY, zoom: camZoom, rot, sx: jx, sy: jy });

    E.bg(g, { lift: lerp(0.95, 1.05, consoleP), cool: 1, accentGlow: ignited ? 0.65 : 0 });
    const c0 = cam.proj(960, 540, 0);
    E.grid(g, { ox: c0.x, oy: c0.y, scale: c0.s, alpha: lerp(0.7, 0.9, consoleP) });

    // Draw Ground Floor & Falling Blocks (fading back cleanly as S3 Console expands at 12.50 s)
    const worldAlpha = 1 - eo(seg(t, 12.38, 12.68));
    if (worldAlpha > 0.005) {
      g.save();
      g.globalAlpha = worldAlpha;
      cam.apply(g, 0);

      // Ground Floor Rail at y = 790
      const loadFrac = clamp(0.14 + 0.84 * ss(seg(tOver, 1.5, 10.8)), 0, 0.98);
      E.panel(g, 260, 788, 1400, 64, { r: 14, fill: '#111623', cheap: false, shadow: 1 });
      g.fillStyle = PAL.text;
      g.font = E.font(16, 600, 'zh');
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('地面负载 · 阻塞', 292, 820);

      // Load gauge bar
      const gx = 468, gw = 1060, gy = 813, gh = 14;
      g.fillStyle = 'rgba(255,255,255,0.06)';
      E.rr(g, gx, gy, gw, gh, 7);
      g.fill();
      g.fillStyle = allowRed ? E.mix('#6E7A94', PAL.red, ss(seg(loadFrac, 0.2, 0.75))) : PAL.dim;
      E.rr(g, gx, gy, gw * loadFrac, gh, 7);
      g.fill();

      g.fillStyle = allowRed && loadFrac > 0.6 ? '#FF808C' : PAL.dim;
      g.font = E.font(14, 600, 'mono');
      g.textAlign = 'right';
      g.fillText(`${Math.round(loadFrac * 100)}%`, 1628, 820.5);

      // Background / Plane z=0 falling & stacked cards
      DROPS.filter(d => d.z === 0).forEach(d => {
        if (tOver < d.tSpawn) return;
        const p = clamp((tOver - d.tSpawn) / (d.tLand - d.tSpawn), 0, 1);
        const y = p < 1 ? lerp(d.yStart, d.yEnd, p * p) : d.yEnd;
        const landAge = p >= 1 ? tOver - d.tLand : -1;
        g.save();
        g.translate(d.x + CARD_W / 2, y + CARD_H / 2);
        g.rotate(d.rotEnd * p);
        g.translate(-(d.x + CARD_W / 2), -(y + CARD_H / 2));
        drawErrorCard(g, d.x, y, CARD_W, CARD_H, d, landAge, allowRed);
        g.restore();
      });

      // Foreground z=0.24 blurred overload cards (depth of field!)
      const fgCards = DROPS.filter(d => d.z > 0 && tOver >= d.tSpawn);
      if (fgCards.length) {
        g.save();
        cam.apply(g, 0.24);
        g.filter = 'blur(3.5px)';
        g.globalAlpha = worldAlpha * 0.72;
        fgCards.forEach(d => {
          const p = clamp((tOver - d.tSpawn) / (d.tLand - d.tSpawn), 0, 1);
          const y = p < 1 ? lerp(d.yStart, d.yEnd + 40, p * p) : d.yEnd + 40;
          drawErrorCard(g, d.x, y, CARD_W, CARD_H, d, -1, allowRed);
        });
        g.restore();
      }
      g.restore();
    }

    // S1 Hero Monolith ('9.8 m/s²') — collapses cleanly into the Ground Floor Rail at 4.28..4.56 s!
    if (t < 4.58) {
      const colP = eio(seg(t, 4.26, 4.54));
      const mw = lerp(760, 1400, colP);
      const mh = lerp(330, 64, colP);
      const mx = 960 - mw / 2;
      const my = lerp(290, 788, colP);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      E.panel(g, mx, my, mw, mh, { r: lerp(24, 14, colP), fill: '#101522', shadow: 1.1 });
      const contentA = 1 - eo(seg(t, 4.22, 4.44));
      if (contentA > 0.01) {
        g.globalAlpha = contentA;
        E.scramble(g, '9.8', 960, my + 216, t, [CUES.lock_9, CUES.lock_dot1, CUES.lock_8], {
          px: 224,
          wt: 600,
          fam: 'disp',
          color: '#DCE3F2',
          align: 'center',
          start: 0.0,
        });
        g.fillStyle = PAL.dim;
        g.font = E.font(22, 500, 'zh');
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('m/s² · 工程引力常数', 960, my + 278);
      }
      g.restore();
    }

    // Ignition Prism Awakening (12.25 s) -> Expands into S3 Intent Console (12.42 s -> 17.00 s)
    if (t >= CUES.ignite_chime) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const wakeP = eo(seg(t, 12.25, 12.52));
      const openP = back(seg(t, 12.42, 12.74), 1.18);
      // Transition out at 16.88..17.00 s: Console expands into the 4-Pillar Ascent Frame!
      const outP = eio(seg(t, 16.86, 17.00));

      // Ignition radial shockwave ring
      if (t < 13.4) {
        const rp = eo(seg(t, 12.25, 13.35));
        g.save();
        g.strokeStyle = E.rgba(PAL.accent, (1 - rp) * 0.55);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(960, lerp(700, 456, openP), 24 + rp * 520, 0, TAU);
        g.stroke();
        g.restore();
      }

      const cw = lerp(92, lerp(1180, 1520, outP), clamp(openP, 0, 1.06));
      const ch = lerp(92, lerp(124, 620, outP), clamp(openP, 0, 1.06));
      const cx = 960 - cw / 2;
      const cy = lerp(660, lerp(394, 180, outP), clamp(openP, 0, 1.04));

      const pressFlash = Math.exp(-Math.max(0, t - CUES.exec_press) * 4.5) * (t >= CUES.exec_press ? 1 : 0);
      E.panel(g, cx, cy, cw, ch, {
        r: lerp(26, 22, clamp(openP, 0, 1)),
        fill: '#111624',
        shadow: 1.2,
        accentRim: 0.35 + 0.65 * pressFlash,
      });

      // Console interior (12.50 – 16.92 s)
      const innerA = ss(seg(t, 12.50, 12.66)) * (1 - eo(seg(t, 16.84, 16.98)));
      if (innerA > 0.01) {
        g.save();
        g.globalAlpha = innerA;
        const midY = cy + ch / 2;
        E.agPrism(g, cx + 64, midY, 22, { accent: true, lift: pressFlash * 0.6, glowMul: 0.9 + pressFlash });

        // Crisp full command text (held steady 12.50..16.92s = 4.42s for comfortable reading & readcheck!)
        const cmdText = '重构认证架构并自动部署';
        g.font = E.font(34, 500, 'zh');
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        // Subtle sweep brighten over first 0.45 s while full text is already legible
        const litP = ss(seg(t, 12.52, 13.85));
        g.fillStyle = E.mix('#7C87A2', PAL.text, litP);
        const tx = cx + 112;
        g.fillText(cmdText, tx, midY + 1);
        const cmdW = g.measureText(cmdText).width;

        // Execute Pill Button on the right
        const bw = 176, bh = 68, bx = cx + cw - bw - 28, by = midY - bh / 2;
        const pressed = t >= CUES.exec_press;
        if (pressed) {
          const btnPath = new Path2D();
          btnPath.roundRect(bx, by, bw, bh, 16);
          E.litShape(g, btnPath, { accent: true, glowR: 28, bbox: [bx, by, bw, bh] });
        } else {
          E.panel(g, bx, by, bw, bh, { r: 16, fill: '#1A2236', cheap: true, accentRim: 0.5 });
        }
        g.fillStyle = pressed ? '#080A12' : PAL.text;
        g.font = E.font(22, 600, 'zh');
        g.textAlign = 'center';
        g.fillText('升空执行', bx + bw / 2, midY + 1);

        // Living Caret Performance: blinks on 120 BPM beat -> 12-frame wind-up -> 2-frame squash press -> spring!
        const moveP = eio(seg(t, 15.40, 15.96));
        const caretX = lerp(tx + cmdW + 22, bx - 22, moveP);
        let csx = 1, csy = 1, blinkOn = 1;
        if (t < 15.40) {
          const beatPhase = ((t - 12.50) / 0.5) % 1;
          blinkOn = beatPhase < 0.68 ? 1 : 0.22;
        } else if (t < CUES.exec_press) {
          // 12-frame anticipation stretch!
          const wu = ei(seg(t, 15.50, CUES.exec_press));
          csy = 1 + 0.38 * wu;
          csx = 1 - 0.22 * wu;
        } else if (t < CUES.exec_press + 2 / 24) {
          // 2-frame contact squash!
          csy = 0.34;
          csx = 2.25;
        } else {
          const sp = spring((t - CUES.exec_press - 2 / 24) * 1.8, 11, 0.42);
          csy = lerp(0.34, 1.0, clamp(sp, 0, 1.2));
          csx = lerp(2.25, 1.0, clamp(sp, 0, 1.2));
        }
        E.caret(g, caretX, midY, 44, { sx: csx, sy: csy, on: blinkOn, glow: 1.1 });
        g.restore();
      } else if (wakeP > 0 && openP < 0.2) {
        E.agPrism(g, 960, cy + ch / 2, 28 * wakeP, { accent: true, glowMul: 1.4 });
      }

      // Rising Horizontal Light-Horizon Plane (16.00 – 17.00 s: sweeps bottom to top!)
      if (t >= CUES.exec_press) {
        const hp = eio(seg(t, CUES.exec_press, 16.96));
        const hy = lerp(940, 60, hp);
        const lgr = g.createLinearGradient(0, hy - 70, 0, hy + 110);
        lgr.addColorStop(0, 'rgba(139,124,255,0)');
        lgr.addColorStop(0.45, E.rgba(PAL.accent, 0.22 * (1 - hp * 0.4)));
        lgr.addColorStop(1, 'rgba(139,124,255,0)');
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = lgr;
        g.fillRect(0, hy - 70, W, 180);
        g.restore();
      }
      g.restore();
    }
  }

  // ═══════════════════ S4 (17.00 – 27.00 s): Vertical Crane Ascent & 22.00 s Snap Grid ═══════════════════
  else if (t < 27.00) {
    // Log-space zoom pull-back (1.16 -> 1.00) + vertical crane climb over 17.00..22.00 s
    const climbP = eio(seg(t, 17.00, 21.85));
    const snapHit = t >= CUES.snap_grid ? Math.exp(-(t - CUES.snap_grid) * 3.8) : 0;
    const zoom = Math.exp(lerp(Math.log(1.16), 0, climbP));
    const camY = lerp(690, 540, climbP);
    const cam = E.camera({ x: 960, y: camY, zoom });

    E.bg(g, { lift: 1.05, cool: 1, accentGlow: 0.25 + 0.55 * snapHit });
    const c0 = cam.proj(960, 540, 0);
    // Grid stays subtle until 22.00 s Snap Grid, when it flashes into crisp architectural lock!
    const gridA = t < CUES.snap_grid ? lerp(0.22, 0.38, climbP) : 0.95;
    E.grid(g, { ox: c0.x, oy: c0.y, scale: c0.s, alpha: gridA, flash: snapHit });

    // UI Collapse at end of S4 (26.80 -> 27.00 s) into S5 Studio Panel!
    const collapseP = eio(seg(t, 26.80, 27.00));

    g.save();
    cam.apply(g, 0);

    // Top Synchronized Status Banner (locks in on 22.00 s Snap Grid!)
    if (t >= 21.92) {
      const bp = eo(seg(t, 21.92, 22.18)) * (1 - collapseP);
      if (bp > 0.01) {
        const bw = 264, bh = 40, bx = 960 - bw / 2, by = 84;
        E.panel(g, bx, by, bw, bh, { r: 20, fill: '#13192A', cheap: true, alpha: bp, accentRim: 0.65 });
        g.save();
        g.globalAlpha = bp;
        g.fillStyle = PAL.accent;
        g.shadowColor = E.rgba(PAL.accent, 0.85);
        g.shadowBlur = 10;
        g.beginPath();
        g.arc(bx + 24, by + bh / 2, 4.5, 0, TAU);
        g.fill();
        g.shadowColor = 'transparent';
        g.fillStyle = PAL.text;
        g.font = E.font(15, 600, 'zh');
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('四轨同步就绪 · 16/16', bx + 40, by + bh / 2 + 0.5);
        g.restore();
      }
    }

    // 4 Pillar Column Headers (01 感知 .. 04 验证)
    const hdrA = ss(seg(t, 16.98, 17.22)) * (1 - collapseP);
    if (hdrA > 0.01) {
      PILLARS.forEach((p, col) => {
        const hx = GRID_X0 + col * (TILE_W + GAP_X);
        const hy = 152;
        g.save();
        g.globalAlpha = hdrA;
        g.fillStyle = PAL.mute;
        g.font = E.font(14, 600, 'mono');
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText(p.code, hx + 6, hy);
        g.fillStyle = PAL.text;
        g.font = E.font(21, 600, 'zh');
        g.fillText(p.name, hx + 38, hy);
        g.fillStyle = t >= CUES.snap_grid ? E.rgba(PAL.accent, 0.55) : 'rgba(255,255,255,0.10)';
        g.fillRect(hx, hy + 24, TILE_W, 1);
        g.restore();
      });
    }

    // Bezier helper for upward S-curve flight + Snap Grid lock at 22.00 s
    const posAt = (m, time) => {
      // Phase 1 (tLaunch .. 21.65 s): Graceful upward Bezier levitation into hover near slot
      const fp = eo(clamp((time - m.tLaunch) / m.durFlight, 0, 1));
      const hoverX = m.gx + (m.col - 1.5) * 18;
      const hoverY = m.gy + 26 + Math.sin(m.idx * 1.7) * 14;
      const u = fp;
      const bend = (m.col - 1.5) * 54 * Math.sin(u * Math.PI);
      let x = lerp(m.sx, hoverX, u) + bend;
      let y = lerp(m.sy, hoverY, u);

      // Phase 2 (21.72 .. 22.00 s): Single-beat SNAP GRID with crisp back(1.32) overshoot!
      if (time >= 21.72) {
        const sp = back(clamp((time - 21.72) / 0.28, 0, 1), 1.32);
        x = lerp(hoverX, m.gx, sp);
        y = lerp(hoverY, m.gy, sp);
      }

      // Phase 3 (26.80 .. 27.00 s): UI Collapse into S5 centre Studio Surface!
      if (collapseP > 0) {
        x = lerp(x, 960 - TILE_W / 2, collapseP);
        y = lerp(y, 462 - TILE_H / 2, collapseP);
      }
      return [x, y];
    };

    // Desaturated category trails ONLY while in upward motion (17.05 .. 22.05 s)
    if (t < 22.15) {
      const trailFade = 1 - ss(seg(t, 21.85, 22.15));
      MODULES.forEach(m => {
        if (t <= m.tLaunch + 0.05) return;
        const pts = [];
        for (let k = 10; k >= 0; k--) {
          const tk = Math.max(m.tLaunch, t - k * 0.038);
          const [px, py] = posAt(m, tk);
          pts.push([px + TILE_W / 2, py + TILE_H / 2]);
        }
        E.trail(g, pts, { color: m.trailColor, width: 4.5, alpha: 0.52 * trailFade });
      });
    }

    // Draw all 16 Modular Tiles
    const snapped = t >= CUES.snap_grid;
    MODULES.forEach(m => {
      const appear = ss(seg(t, m.tLaunch - 0.10, m.tLaunch + 0.14));
      if (appear <= 0.01) return;
      const [x, y] = posAt(m, t);
      E.panel(g, x, y, TILE_W, TILE_H, {
        r: 14,
        fill: snapped ? '#141A29' : '#111623',
        cheap: false,
        shadow: 0.85,
        alpha: appear,
        accentRim: snapped ? 0.22 + 0.65 * snapHit : 0,
      });

      g.save();
      g.globalAlpha = appear * (1 - collapseP * 0.85);
      // Mono index code
      g.fillStyle = PAL.mute;
      g.font = E.font(13, 500, 'mono');
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(m.code, x + 22, y + 34);

      // Crisp Chinese module title
      g.fillStyle = PAL.text;
      g.font = E.font(21, 600, 'zh');
      g.fillText(m.label, x + 22, y + 72);

      // Unified Accent Check Dot once snapped into the grid!
      if (snapped) {
        g.fillStyle = PAL.accent;
        g.shadowColor = E.rgba(PAL.accent, 0.8);
        g.shadowBlur = 8 + 10 * snapHit;
        g.beginPath();
        g.arc(x + TILE_W - 26, y + 30, 4.5, 0, TAU);
        g.fill();
        g.shadowColor = 'transparent';
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x + TILE_W - 26, y + 30, 4.5, 0, TAU);
        g.stroke();
      }
      g.restore();
    });

    g.restore();
  }

  // ═══════════════════ S5 (27.00 – 33.00 s): 2.5D Studio Light Reveal + Log-Zoom Dive ═══════════════════
  else if (t < 33.00) {
    E.bg(g, { lift: 1.0, cool: 1, accentGlow: 0.35 });
    E.grid(g, { ox: 960, oy: 540, scale: 1, alpha: 0.45 });

    const sw = 1240, sh = 640;
    // 1. Render opaque studio surface
    const [sc, sg] = E.buf('studio_opaque', sw, sh);
    drawStudioSurface(sg, sw, sh, t);

    // 2. Apply soft diagonal Light-Sweep Reveal onto an offscreen lit buffer (1.25 s sweep, glint <= 0.17)
    const [lc, lg] = E.buf('studio_lit', sw, sh);
    const sweepP = eio(seg(t, 27.00, 28.25));
    E.lightReveal(lg, sc, 0, 0, sw, sh, sweepP, {
      base: 0.14,
      angle: -0.55,
      soft: 280,
      band: 110,
      glint: 0.17,
    });

    // 3. UI Expand entrance (27.00..27.18 s) + 2.5D Strip-Perspective rotation (+19° -> +3°)
    const openScale = lerp(0.84, 1.0, back(seg(t, 26.96, 27.22), 1.15));
    const rotY = lerp(0.33, 0.055, eio(seg(t, 27.00, 31.80)));

    // 4. Exponential Log-Zoom Dive (32.68 -> 33.00 s) straight into the top-right '0.0 G' pill!
    const diveP = ei(seg(t, 32.68, 33.00));
    const diveZoom = Math.exp(lerp(0, Math.log(18.0), diveP));

    // Compute exact screen anchor of the '0.0 G' pill via the same perspective map!
    const baseCx = 960, baseCy = 454; // Lifted cleanly above bottom toast!
    const [ dummyC, dummyG ] = E.buf('dummy_map', 4, 4);
    const map0 = E.perspective(dummyG, dummyC, baseCx, baseCy, sw * openScale, sh * openScale, rotY, { slices: 4, alpha: 0 });
    const [pillX, pillY] = map0(0.89, 0.045);

    g.save();
    g.translate(pillX, pillY);
    g.scale(diveZoom, diveZoom);
    g.translate(-pillX, -pillY);
    E.perspective(g, lc, baseCx, baseCy, sw * openScale, sh * openScale, rotY, { slices: 96, alpha: 1 });
    g.restore();

    // Match-cut darken inside the pill interior in final 3 frames so 33.00 s lands seamlessly on dark stage
    if (diveP > 0.72) {
      g.save();
      g.fillStyle = E.rgba(PAL.bg0, ss(seg(diveP, 0.72, 1.0)));
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  }

  // ═══════════════════ S6 (33.00 – 38.00 s): Giant '0.0 G' Bookend (NO Bottom Toast!) ═══════════════════
  else if (t < 38.00) {
    const lockGlow = ss(seg(t, CUES.lock_0a, CUES.lock_0b + 0.35));
    const outP = eio(seg(t, 37.82, 38.00));
    E.bg(g, { lift: 0.85, cool: 0.7, dark: 0.18 * (1 - outP), accentGlow: 0.75 * lockGlow });
    E.grid(g, { ox: 960, oy: 540, scale: lerp(1.0, 1.0, outP), alpha: lerp(0.32, 0.75, outP) });

    g.save();
    const sc = lerp(1.0, 0.24, outP);
    const ty = lerp(520, 305, outP);
    g.translate(960, ty);
    g.scale(sc, sc);
    g.translate(-960, -ty);
    g.globalAlpha = 1 - outP * 0.85;

    E.scramble(g, '0.0 G', 960, 540, t, [CUES.lock_0a, CUES.lock_dot2, CUES.lock_0b, CUES.lock_0b, CUES.lock_0b], {
      px: 288,
      wt: 600,
      fam: 'disp',
      color: PAL.accent,
      glowCol: PAL.accent,
      align: 'center',
      tracking: -0.042,
      start: 33.00,
    });

    const subA = ss(seg(t, CUES.lock_0a, CUES.lock_0a + 0.14)) * (1 - eo(seg(t, 37.82, 37.96)));
    if (subA > 0.01) {
      g.globalAlpha = subA;
      g.fillStyle = PAL.dim;
      g.font = E.font(30, 500, 'zh');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('零工程阻力 · 全自动协同', 960, 656);
    }
    g.restore();
  }

  // ═══════════════════ S7 (38.00 – 48.00 s): Panoramic Zero-G Orbital Studio & Hero End Card ═══════════════════
  else {
    const inP = eo(seg(t, 38.00, 38.45));
    const sweepP = eio(seg(t, 38.30, 39.55));
    E.bg(g, { lift: 1.0, cool: 1.0, accentGlow: 0.55 });
    E.grid(g, { ox: 960, oy: 540, scale: 1.0, alpha: 0.82 });

    // Flanking Left & Right Quiet Autonomous Orbital Tiles (4 left + 4 right, running serenely in wide shot!)
    const orbitTitles = [
      '01 感知 · 实时脉络', '02 规划 · 架构图谱', '03 编码 · 多路并发', '04 验证 · 零感回归',
      '05 终端 · 沙箱守护', '06 记忆 · 全局索引', '07 协同 · 子体编排', '08 轨道 · 持续就绪',
    ];
    for (let i = 0; i < 8; i++) {
      const left = i < 4;
      const row = i % 4;
      const tw = 304, th = 102;
      const baseX = left ? 196 : W - 196 - tw;
      const baseY = 188 + row * 136;
      const floatY = Math.sin(t * 0.9 + i * 0.85) * 4.5;
      const slideX = (1 - back(seg(t, 38.02 + row * 0.06, 38.42 + row * 0.06), 1.15)) * (left ? -80 : 80);
      const x = baseX + slideX, y = baseY + floatY;

      E.panel(g, x, y, tw, th, { r: 14, fill: '#111624', cheap: true, shadow: 0.75, alpha: 0.86 * inP });
      g.save();
      g.globalAlpha = 0.86 * inP;
      g.fillStyle = PAL.dim;
      g.font = E.font(15, 500, 'zh');
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(orbitTitles[i], x + 22, y + 40);

      // Quiet breathing neutral status bar + tiny accent dot
      const pulseW = 0.62 + 0.16 * Math.sin(t * 1.4 + i * 1.1);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      E.rr(g, x + 22, y + 62, tw - 68, 6, 3);
      g.fill();
      g.fillStyle = 'rgba(238,242,250,0.28)';
      E.rr(g, x + 22, y + 62, (tw - 68) * pulseW, 6, 3);
      g.fill();

      g.fillStyle = PAL.accent;
      g.beginPath();
      g.arc(x + tw - 24, y + 34, 4, 0, TAU);
      g.fill();
      g.restore();
    }

    // Central Weightless Antigravity Emblem + Light-Revealed Hero Title Card
    const breath = Math.sin((t - 38.0) * 1.25) * 0.35;
    E.agPrism(g, 960, 296 + breath * 8, 56 * lerp(0.65, 1.0, inP), {
      accent: true,
      lift: breath * 0.4,
      sweep: seg(t, 38.45, 39.55),
      glowMul: 1.25,
    });

    // Render Hero Title + Tagline onto offscreen buffer for silky lightReveal!
    const hw = 780, hh = 240, hx = 960 - hw / 2, hy = 396;
    const [hc, hg] = E.buf('hero_title', hw, hh);
    hg.fillStyle = PAL.text;
    hg.font = E.font(96, 700, 'zh');
    hg.textAlign = 'center';
    hg.textBaseline = 'alphabetic';
    hg.fillText('反重力', hw / 2, 108);

    hg.fillStyle = PAL.dim;
    hg.font = E.font(23, 500, 'zh');
    if (hg.letterSpacing !== undefined) hg.letterSpacing = '2.5px';
    hg.fillText('ANTIGRAVITY · 让创造脱离引力', hw / 2, 168);
    if (hg.letterSpacing !== undefined) hg.letterSpacing = '0px';

    E.lightReveal(g, hc, hx, hy, hw, hh, sweepP, {
      base: 0.18,
      angle: -0.45,
      soft: 220,
      band: 95,
      glint: 0.18,
    });
  }

  // Left-margin Altitude Telemetry Scale + Cinematic Corner Vignette
  E.drawAltitudeRuler(g, alt, {
    alpha: t >= 33.00 && t < 38.00 ? 0.42 : 0.72,
    accentLock: ss(seg(t, 21.95, 22.30)),
  });
  E.vignette(g, 0.53);

  // Bottom-Centre Toast Captions (never shown over S1 '9.8' or S6 '0.0 G'!)
  if (!noSub) {
    for (const v of VOICES) {
      if (t >= v.toast0 && t <= v.toast1) {
        const aIn = clamp((t - v.toast0) / 0.16, 0, 1);
        const aOut = clamp((v.toast1 - t) / 0.18, 0, 1);
        const speaking = t <= v.t0 + v.dur ? 0.5 + 0.5 * Math.sin(t * 14) : 0.2;
        E.toast(g, v.text, Math.min(aIn, aOut), { dense: v.dense, pulse: speaking });
      }
    }
  }
}

// ───────────────────────── Poster Scene (?scene=poster) ─────────────────────────
export function renderPoster(g) {
  E.bg(g, { lift: 1.05, cool: 1.0, accentGlow: 0.7 });
  E.grid(g, { ox: 960, oy: 540, scale: 1.0, alpha: 0.85, flash: 0.35 });

  // Subtle flanking levitating modules rising in clean columns
  for (let i = 0; i < 8; i++) {
    const left = i < 4, row = i % 4;
    const tw = 288, th = 94;
    const x = left ? 196 : W - 196 - tw;
    const y = 210 + row * 142;
    E.panel(g, x, y, tw, th, { r: 14, fill: '#121828', cheap: true, alpha: 0.78, accentRim: 0.25 });
    g.fillStyle = PAL.mute;
    g.font = E.font(13, 500, 'mono');
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(`0${i + 1}`, x + 22, y + 36);
    g.fillStyle = PAL.dim;
    g.font = E.font(18, 500, 'zh');
    g.fillText(['上下文索引', '架构推演', '核心重构', '回归校验', '沙箱守护', '并发补全', '脉络预判', '零感签发'][i], x + 22, y + 68);
    g.fillStyle = PAL.accent;
    g.beginPath();
    g.arc(x + tw - 24, y + 32, 4, 0, TAU);
    g.fill();
  }

  E.agPrism(g, 960, 340, 68, { accent: true, sweep: 0.52, glowMul: 1.45 });

  g.fillStyle = PAL.text;
  g.font = E.font(108, 700, 'zh');
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText('反重力', 960, 548);

  g.fillStyle = PAL.dim;
  g.font = E.font(24, 500, 'zh');
  if (g.letterSpacing !== undefined) g.letterSpacing = '3px';
  g.fillText('ANTIGRAVITY · 让创造脱离引力', 960, 614);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';

  E.drawAltitudeRuler(g, 900, { alpha: 0.65, accentLock: 1 });
  E.vignette(g, 0.52);
}

// ───────────────────────── On-Screen Text Boxes for readcheck.mjs ─────────────────────────
export function visibleTexts(t) {
  const out = [];
  // Altitude ruler is a continuous telemetry scale (not meant to be read word-for-word)
  out.push({ id: 'alt_scale', text: 'ALT', x0: 60, y0: 180, x1: 185, y1: 860, pass: true });

  if (t >= 0.50 && t <= 4.22) {
    out.push({ id: 's1_num',  text: '9.8',             x0: 760, y0: 320, x1: 1160, y1: 520 });
    out.push({ id: 's1_unit', text: 'm/s² · 工程引力常数', x0: 740, y0: 545, x1: 1180, y1: 590 });
  }
  if (t >= 4.62 && t <= 12.35) {
    out.push({ id: 's2_gauge', text: '地面负载 · 阻塞', x0: 280, y0: 790, x1: 460, y1: 850 });
    out.push({ id: 's2_debris', text: 'legacy_auth.ts', x0: 260, y0: 120, x1: 1660, y1: 785, pass: true });
  }
  if (t >= 12.50 && t <= 16.84) {
    out.push({ id: 's3_cmd', text: '重构认证架构并自动部署', x0: 480, y0: 420, x1: 960, y1: 490 });
    out.push({ id: 's3_btn', text: '升空执行',             x0: 1340, y0: 420, x1: 1520, y1: 490 });
  }
  if (t >= 17.45 && t <= 26.80) {
    PILLARS.forEach((p, col) => {
      const hx = GRID_X0 + col * (TILE_W + GAP_X);
      out.push({ id: `s4_p${col}`, text: `${p.code} ${p.name}`, x0: hx, y0: 136, x1: hx + 160, y1: 174 });
    });
  }
  if (t >= 19.60 && t <= 26.80) {
    MODULES.forEach(m => {
      out.push({ id: `s4_m${m.idx}`, text: m.label, x0: m.gx, y0: m.gy, x1: m.gx + TILE_W, y1: m.gy + TILE_H });
    });
  }
  if (t >= 22.18 && t <= 26.80) {
    out.push({ id: 's4_sync', text: '四轨同步就绪 · 16/16', x0: 828, y0: 84, x1: 1092, y1: 124 });
  }
  if (t >= 27.25 && t <= 32.65) {
    out.push({ id: 's5_hdr',  text: '反重力工作台',       x0: 380, y0: 140, x1: 620,  y1: 195 });
    out.push({ id: 's5_pill', text: '零阻力轨道 · 0.0 G', x0: 1300, y0: 140, x1: 1560, y1: 195 });
    out.push({ id: 's5_pred', text: '脉络预判已激活',     x0: 1220, y0: 680, x1: 1540, y1: 745 });
  }
  if (t >= 33.75 && t <= 37.80) {
    out.push({ id: 's6_num', text: '0.0 G',              x0: 640, y0: 310, x1: 1280, y1: 560 });
    out.push({ id: 's6_sub', text: '零工程阻力 · 全自动协同', x0: 720, y0: 630, x1: 1200, y1: 685 });
  }
  if (t >= 39.55 && t <= DUR) {
    out.push({ id: 's7_title', text: '反重力',                      x0: 780, y0: 410, x1: 1140, y1: 520 });
    out.push({ id: 's7_tag',   text: 'ANTIGRAVITY · 让创造脱离引力', x0: 660, y0: 535, x1: 1260, y1: 585 });
    out.push({ id: 's7_tiles', text: 'orbit_tiles',                 x0: 148, y0: 188, x1: 1772, y1: 740, pass: true });
  }
  return out;
}
