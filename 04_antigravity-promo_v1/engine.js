// engine.js — Custom Dark Tech Keynote Canvas 2D engine for 《反重力 · ANTIGRAVITY》
// Cool midnight neutral ladder, 48px hairline grid, Electric Violet (#8B7CFF) single brand accent,
// Twin-Chevron Levitation Prism mark, 2.5D camera, strip perspective, soft light-sweep reveal, scramble, and toast.

import { clamp, lerp, seg, ss, eo, ei, eio, back, spring, mulberry, hash, TAU } from '/core/lib.js';
export { clamp, lerp, seg, ss, eo, ei, eio, back, spring, mulberry, hash, TAU };

export const W = 1920, H = 1080;

export const PAL = {
  bg0:    '#06080E',
  bg1:    '#121726',
  surf:   '#0F131E',
  surf2:  '#161C2B',
  surf3:  '#1F273B',
  line:   'rgba(255,255,255,0.085)',
  hi:     'rgba(255,255,255,0.09)',
  text:   '#EEF2FA',
  dim:    '#929DB6',
  mute:   '#58637C',
  accent: '#8B7CFF', // The ONE brand accent: Electric Violet
  red:    '#FF4D5E', // Problem colour (strictly t < 12.25 s only!)
  cool:   '#3A48B8',
};

export const FONT = {
  ui:   '"Inter", "NotoSC", sans-serif',
  disp: '"InterTight", "Inter", "NotoSC", sans-serif',
  mono: '"JBMono", "NotoSC", monospace',
  zh:   '"NotoSC", "Inter", sans-serif',
};

export const font = (px, wt = 500, fam = 'ui') => `${wt} ${px}px ${FONT[fam] || fam}`;

export function rgba(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, clamp(t, 0, 1)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

const _pool = {};
export function buf(name, w = W, h = H) {
  let c = _pool[name];
  if (!c || c.width !== w || c.height !== h) {
    c = _pool[name] = document.createElement('canvas');
    c.width = w;
    c.height = h;
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.clearRect(0, 0, w, h);
  return [c, g];
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, Math.max(0.5, w), Math.max(0.5, h), Math.max(0, Math.min(r, w / 2, h / 2)));
}

// ───────────────────────── Stage, Hairline Grid & Vignette ─────────────────────────
export function bg(g, o = {}) {
  const { lift = 1, cool = 1, dark = 0, cx = W * 0.5, cy = H * 0.30, accentGlow = 0 } = o;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = PAL.bg0;
  g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.72);
  gr.addColorStop(0, rgba(PAL.bg1, 0.96 * lift));
  gr.addColorStop(1, rgba(PAL.bg0, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  if (cool > 0) glow(g, W * 0.76, H * 0.14, 920, PAL.cool, 0.075 * cool);
  if (accentGlow > 0) glow(g, cx, cy, 680, PAL.accent, 0.085 * accentGlow);
  if (dark > 0) {
    g.fillStyle = `rgba(3,4,8,${dark})`;
    g.fillRect(0, 0, W, H);
  }
  g.restore();
}

export function glow(g, x, y, r, color, a) {
  if (a <= 0 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a));
  gr.addColorStop(0.42, rgba(color, a * 0.34));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

export function grid(g, o = {}) {
  const { ox = W / 2, oy = H / 2, scale = 1, module = 48, alpha = 1, major = 4, rect = [0, 0, W, H], flash = 0 } = o;
  const step = module * scale;
  if (step < 5 || alpha <= 0) return;
  const [rx, ry, rw, rh] = rect;
  g.save();
  g.beginPath();
  g.rect(rx, ry, rw, rh);
  g.clip();
  g.lineWidth = 1;
  const i0 = Math.floor((rx - ox) / step), i1 = Math.ceil((rx + rw - ox) / step);
  const j0 = Math.floor((ry - oy) / step), j1 = Math.ceil((ry + rh - oy) / step);
  for (let pass = 0; pass < 2; pass++) {
    const baseA = (pass ? 0.062 : 0.030) * alpha + (pass ? 0.08 * flash : 0.03 * flash);
    g.strokeStyle = flash > 0.01 && pass ? rgba(PAL.accent, baseA * 1.15) : `rgba(255,255,255,${baseA})`;
    g.beginPath();
    for (let i = i0; i <= i1; i++) {
      if ((i % major === 0) !== !!pass) continue;
      const x = Math.round(ox + i * step) + 0.5;
      g.moveTo(x, ry);
      g.lineTo(x, ry + rh);
    }
    for (let j = j0; j <= j1; j++) {
      if ((j % major === 0) !== !!pass) continue;
      const y = Math.round(oy + j * step) + 0.5;
      g.moveTo(rx, y);
      g.lineTo(rx + rw, y);
    }
    g.stroke();
  }
  g.restore();
}

export function vignette(g, a = 0.53) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 1.04);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.restore();
}

// ───────────────────────── Elevated Dark Surfaces & Lit Shapes ─────────────────────────
export function panel(g, x, y, w, h, o = {}) {
  const { r = 14, fill = PAL.surf, stroke = PAL.line, shadow = 1, cheap = false, hi = 1, alpha = 1, accentRim = 0 } = o;
  g.save();
  g.globalAlpha *= alpha;
  if (shadow > 0) {
    if (cheap) {
      g.fillStyle = `rgba(0,0,0,${0.36 * shadow})`;
      rr(g, x + 2, y + 6, w, h, r);
      g.fill();
    } else {
      g.shadowColor = `rgba(0,0,0,${0.58 * shadow})`;
      g.shadowBlur = Math.min(84, 20 + h * 0.16);
      g.shadowOffsetY = Math.min(36, 8 + h * 0.05);
      g.fillStyle = fill;
      rr(g, x, y, w, h, r);
      g.fill();
      g.shadowColor = 'transparent';
    }
  }
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, mix(fill.startsWith('#') ? fill : '#121622', '#2B334A', 0.24));
  gr.addColorStop(Math.min(1, 64 / Math.max(h, 1)), fill);
  gr.addColorStop(1, fill);
  g.fillStyle = gr;
  rr(g, x, y, w, h, r);
  g.fill();

  g.lineWidth = 1;
  g.strokeStyle = accentRim > 0 ? rgba(PAL.accent, lerp(0.12, 0.65, accentRim)) : stroke;
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
  g.stroke();

  if (hi > 0) {
    g.strokeStyle = accentRim > 0 ? rgba(PAL.accent, 0.35 * accentRim + 0.08) : `rgba(255,255,255,${0.08 * hi})`;
    g.beginPath();
    g.moveTo(x + r, y + 1.5);
    g.lineTo(x + w - r, y + 1.5);
    g.stroke();
  }
  g.restore();
}

export function litShape(g, path, o = {}) {
  const { accent = false, color = null, glowR = accent ? 30 : 0, alpha = 1, sweep = null, bbox = [0, 0, W, H], stroke = true } = o;
  const [bx, by, bw, bh] = bbox;
  const c = color || (accent ? PAL.accent : null);
  g.save();
  g.globalAlpha *= alpha;
  if (c) {
    if (glowR > 0) {
      g.shadowColor = rgba(c, 0.72);
      g.shadowBlur = glowR;
    }
    g.fillStyle = c;
    g.fill(path);
    g.shadowColor = 'transparent';
    const gr = g.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, 'rgba(255,255,255,0.34)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fill(path);
  } else {
    g.shadowColor = 'rgba(0,0,0,0.52)';
    g.shadowBlur = 36;
    g.shadowOffsetY = 12;
    const gr = g.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, '#272E42');
    gr.addColorStop(0.4, PAL.surf2);
    gr.addColorStop(1, PAL.surf);
    g.fillStyle = gr;
    g.fill(path);
    g.shadowColor = 'transparent';
  }
  if (stroke) {
    g.lineWidth = 1;
    g.strokeStyle = c ? rgba('#ffffff', 0.38) : 'rgba(255,255,255,0.13)';
    g.stroke(path);
  }
  if (sweep != null && sweep > 0 && sweep < 1) {
    g.save();
    g.clip(path);
    const d = Math.hypot(bw, bh), sx = bx - d * 0.3 + sweep * d * 1.6;
    const gr = g.createLinearGradient(sx - 90, by, sx + 90, by + bh * 0.45);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.20)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gr;
    g.fillRect(bx, by, bw, bh);
    g.restore();
  }
  g.restore();
}

// ───────────────────────── Antigravity Original Geometric Mark & Living Caret ─────────────────────────
/**
 * Antigravity Twin-Chevron Levitation Prism:
 * An original geometric emblem — an upward-pointing architectural chevron wing over a floating luminous core diamond.
 */
export function agPrism(g, cx, cy, r, o = {}) {
  const { alpha = 1, accent = true, lift = 0, sweep = null, glowMul = 1 } = o;
  if (alpha <= 0.001) return;
  g.save();
  g.globalAlpha *= alpha;
  if (accent && glowMul > 0) {
    glow(g, cx, cy, r * 2.2 * glowMul, PAL.accent, 0.20 * glowMul);
  }
  // Outer upward levitation chevron
  const wing = new Path2D();
  const wy = cy - lift * r * 0.16;
  wing.moveTo(cx, wy - r * 0.92);
  wing.lineTo(cx + r * 0.86, wy + r * 0.18);
  wing.lineTo(cx + r * 0.52, wy + r * 0.18);
  wing.lineTo(cx, wy - r * 0.46);
  wing.lineTo(cx - r * 0.52, wy + r * 0.18);
  wing.lineTo(cx - r * 0.86, wy + r * 0.18);
  wing.closePath();
  litShape(g, wing, {
    accent,
    glowR: accent ? r * 0.55 * glowMul : 0,
    sweep,
    bbox: [cx - r, wy - r, r * 2, r * 1.4],
  });

  // Floating weightless core diamond beneath the chevron apex
  const core = new Path2D();
  const dy = cy + r * 0.34 + lift * r * 0.08;
  const dr = r * 0.30;
  core.moveTo(cx, dy - dr * 1.15);
  core.lineTo(cx + dr * 0.92, dy);
  core.lineTo(cx, dy + dr * 1.15);
  core.lineTo(cx - dr * 0.92, dy);
  core.closePath();
  litShape(g, core, {
    accent,
    glowR: accent ? r * 0.45 * glowMul : 0,
    sweep,
    bbox: [cx - dr, dy - dr * 1.2, dr * 2, dr * 2.4],
  });
  g.restore();
}

export function caret(g, x, y, h, o = {}) {
  const { sx = 1, sy = 1, on = 1, glow: gl = 1, color = PAL.accent, alpha = 1, wr = 1 / 11 } = o;
  if (on <= 0.001 || alpha <= 0) return;
  const w = Math.max(2.5, h * wr) * sx, hh = h * sy;
  g.save();
  g.globalAlpha *= alpha * on;
  if (gl > 0) {
    glow(g, x, y, hh * 0.95 * gl, color, 0.22 * gl);
    g.shadowColor = rgba(color, 0.88);
    g.shadowBlur = hh * 0.24 * gl;
  }
  g.fillStyle = color;
  rr(g, x - w / 2, y - hh / 2, w, hh, w / 2);
  g.fill();
  g.shadowColor = 'transparent';
  g.restore();
}

export function trail(g, pts, o = {}) {
  const { color = PAL.accent, width = 5, alpha = 1 } = o;
  if (pts.length < 2 || alpha <= 0.001) return;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const u = i / (pts.length - 1);
    g.strokeStyle = rgba(color, alpha * u * u * 0.82);
    g.lineWidth = width * (0.2 + 0.8 * u);
    g.shadowColor = rgba(color, 0.48 * u * alpha);
    g.shadowBlur = 14 * u;
    g.beginPath();
    g.moveTo(pts[i - 1][0], pts[i - 1][1]);
    g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
  g.restore();
}

// ───────────────────────── Altitude Telemetry Scale (Left Margin) ─────────────────────────
export function drawAltitudeRuler(g, altMeters, o = {}) {
  const { alpha = 0.72, accentLock = 0 } = o;
  if (alpha <= 0.01) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = alpha;
  const x = 44, y0 = 180, y1 = 860, h = y1 - y0;
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x + 0.5, y0);
  g.lineTo(x + 0.5, y1);
  g.stroke();

  const stepPx = 36;
  const scrollPx = (altMeters / 50) * stepPx;
  g.save();
  g.beginPath();
  g.rect(14, y0, 160, h);
  g.clip();
  for (let k = -6; k <= 26; k++) {
    const yy = Math.round(y1 - k * stepPx + (scrollPx % stepPx)) + 0.5;
    if (yy < y0 - 10 || yy > y1 + 10) continue;
    const major = k % 4 === 0;
    g.strokeStyle = major ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.moveTo(x - (major ? 10 : 5), yy);
    g.lineTo(x, yy);
    g.stroke();
  }
  g.restore();

  // Current altitude indicator marker
  const my = lerp(y1 - 24, y0 + 54, clamp(altMeters / 900, 0, 1));
  const col = accentLock > 0 ? mix('#929DB6', PAL.accent, accentLock) : PAL.dim;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x + 5, my);
  g.lineTo(x + 11, my - 3.5);
  g.lineTo(x + 11, my + 3.5);
  g.closePath();
  g.fill();

  g.font = font(11, 500, 'mono');
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const label = altMeters >= 895 ? 'ORBIT 0.0G' : `ALT ${String(Math.round(altMeters)).padStart(3, '0')}m`;
  g.fillText(label, x + 16, my + 0.5);
  g.restore();
}

// ───────────────────────── Light-Sweep Reveal (glint <= 0.18 per STYLE.md §8) ─────────────────────────
export function lightReveal(g, src, dx, dy, dw, dh, p, o = {}) {
  const { base = 0.08, angle = -0.58, soft = 280, band = 110, glint = 0.17, keep = 1 } = o;
  const [c, t] = buf('reveal', Math.ceil(dw), Math.ceil(dh));
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const L = Math.abs(dw * ca) + Math.abs(dh * sa);
  const front = -soft + p * (L + soft * 2.1);
  const cx = dw / 2, cy = dh / 2;
  const p0 = [cx - (ca * L) / 2, cy - (sa * L) / 2];
  const at = d => [p0[0] + ca * d, p0[1] + sa * d];

  t.drawImage(src, 0, 0, dw, dh);
  t.globalCompositeOperation = 'destination-in';
  const A = at(front - soft), B = at(front);
  const gr = t.createLinearGradient(A[0], A[1], B[0], B[1]);
  gr.addColorStop(0, `rgba(0,0,0,${keep})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = gr;
  t.fillRect(0, 0, dw, dh);

  g.save();
  g.globalAlpha = base;
  g.drawImage(src, dx, dy, dw, dh);
  g.globalAlpha = 1;
  g.drawImage(c, dx, dy);
  g.restore();

  if (glint > 0 && p > 0.01 && p < 0.99) {
    const [c2, t2] = buf('reveal2', Math.ceil(dw), Math.ceil(dh));
    t2.drawImage(src, 0, 0, dw, dh);
    t2.globalCompositeOperation = 'source-in';
    const A2 = at(front - band * 1.7), B2 = at(front + band * 0.45);
    const g2 = t2.createLinearGradient(A2[0], A2[1], B2[0], B2[1]);
    g2.addColorStop(0, 'rgba(255,255,255,0)');
    g2.addColorStop(0.65, rgba('#EDE9FF', glint));
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    t2.fillStyle = g2;
    t2.fillRect(0, 0, dw, dh);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.drawImage(c2, dx, dy);
    g.restore();
  }
}

// ───────────────────────── Strip-Rendered 2.5D Y-Perspective (Opaque Surface) ─────────────────────────
export function perspective(g, src, cx, cy, w, h, rotY, o = {}) {
  const { slices = 96, dist = 2.35, alpha = 1 } = o;
  const D = dist * w, cs = Math.cos(rotY), sn = Math.sin(rotY);
  const map = (u, v) => {
    const X = (u - 0.5) * w, Z = X * sn, f = D / (D + Z);
    return [cx + X * cs * f, cy + (v - 0.5) * h * f, f];
  };
  g.save();
  g.globalAlpha *= alpha;
  const sw = src.width / slices;
  for (let i = 0; i < slices; i++) {
    const u0 = i / slices, u1 = (i + 1) / slices;
    const [x0] = map(u0, 0.5), [x1] = map(u1, 0.5);
    const X = ((u0 + u1) / 2 - 0.5) * w, f = D / (D + X * sn), hh = h * f;
    g.drawImage(src, i * sw, 0, sw, src.height, Math.min(x0, x1) - 0.4, cy - hh / 2, Math.abs(x1 - x0) + 0.8, hh);
  }
  g.restore();
  return map;
}

// ───────────────────────── Glyph-Noise Rolling Scramble ─────────────────────────
const GLYPH = '0123456789#%+<>?ABCDEFGHXYZ';
export function scramble(g, text, x, y, t, locks, o = {}) {
  const { px = 260, wt = 600, fam = 'disp', color = PAL.text, align = 'center', tracking = -0.045, start = -1e9, fps = 24, glowCol = null } = o;
  g.save();
  g.font = font(px, wt, fam);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const chars = [...text];
  const tw = chars.map(c => g.measureText(c).width);
  const adv = tw.map((w, i) => (c => (c === ' ' ? w * 0.75 : w + tracking * px))(chars[i]));
  const total = adv.reduce((a, b) => a + b, 0) - tracking * px;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const f = Math.floor(t * fps);

  chars.forEach((ch, i) => {
    if (ch === ' ') {
      cx += adv[i];
      return;
    }
    const lk = locks[i] ?? locks[locks.length - 1];
    if (t < start) {
      cx += adv[i];
      return;
    }
    const rollable = /[0-9A-Z]/.test(ch);
    if (t < lk && rollable) {
      const gch = GLYPH[Math.floor(hash(f * 17.3 + i * 83.1) * GLYPH.length)];
      g.fillStyle = color;
      for (let k = 0; k < 3; k++) {
        g.globalAlpha = [0.78, 0.28, 0.12][k];
        g.fillText(gch, cx + (tw[i] - g.measureText(gch).width) / 2, y - k * px * 0.08);
      }
      g.globalAlpha = 1;
    } else if (t >= lk) {
      const d = t - lk;
      const dy = d < 0.28 ? -px * 0.09 * Math.exp(-d * 15) * Math.cos(d * 38) : 0;
      if (glowCol) {
        g.shadowColor = rgba(glowCol, 0.55 * clamp(d * 5, 0, 1));
        g.shadowBlur = px * 0.22;
      }
      g.fillStyle = color;
      g.globalAlpha = clamp(d * 24 + 0.35, 0, 1);
      g.fillText(ch, cx, y + dy);
      g.shadowColor = 'transparent';
      g.globalAlpha = 1;
    }
    cx += adv[i];
  });
  g.restore();
  return { x0: align === 'center' ? x - total / 2 : x, x1: (align === 'center' ? x - total / 2 : x) + total, y0: y - px * 0.85, y1: y + px * 0.12 };
}

// ───────────────────────── Bottom-Centre Toast Subtitle UI Component ─────────────────────────
export function toast(g, text, a, o = {}) {
  if (a <= 0.001) return;
  const { y = H - 56, px = 38, dense = 0, pulse = 1 } = o;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = font(px, 500, 'zh');
  const tw = g.measureText(text).width;
  const h = Math.round(px * 1.88);
  const w = Math.round(tw + px * 2.55);
  const x = Math.round(W / 2 - w / 2);
  const yy = Math.round(y - h + (1 - eo(a)) * 11);

  g.globalAlpha = eo(a);
  g.shadowColor = 'rgba(0,0,0,0.56)';
  g.shadowBlur = 38;
  g.shadowOffsetY = 10;
  g.fillStyle = `rgba(11,14,22,${0.82 + 0.12 * dense})`;
  rr(g, x, yy, w, h, h / 2);
  g.fill();
  g.shadowColor = 'transparent';

  g.strokeStyle = 'rgba(255,255,255,0.11)';
  g.lineWidth = 1;
  rr(g, x + 0.5, yy + 0.5, w - 1, h - 1, h / 2);
  g.stroke();

  const dotR = px * 0.135 * (0.92 + 0.14 * pulse);
  g.fillStyle = PAL.accent;
  g.shadowColor = rgba(PAL.accent, 0.85);
  g.shadowBlur = 12;
  g.beginPath();
  g.arc(x + px * 0.96, yy + h / 2, dotR, 0, TAU);
  g.fill();
  g.shadowColor = 'transparent';

  g.fillStyle = PAL.text;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x + px * 1.52, yy + h / 2 + 1);
  g.restore();
}

// ───────────────────────── 2.5D Camera ─────────────────────────
export function camera(c = {}) {
  const { x = W / 2, y = H / 2, zoom = 1, rot = 0, sx = 0, sy = 0 } = c;
  const inv = 1 / zoom;
  const proj = (px, py, z = 0) => {
    const d = inv - z;
    if (d <= 0.02) return null;
    const s = 1 / d;
    const X = (px - x) * s, Y = (py - y) * s;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    return { x: W / 2 + X * cr - Y * sr + sx, y: H / 2 + X * sr + Y * cr + sy, s };
  };
  const apply = (g, z = 0) => {
    const d = inv - z, s = 1 / Math.max(d, 0.02);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(W / 2 + sx, H / 2 + sy);
    g.rotate(rot);
    g.scale(s, s);
    g.translate(-x, -y);
    return s;
  };
  return { x, y, zoom, rot, sx, sy, proj, apply };
}
