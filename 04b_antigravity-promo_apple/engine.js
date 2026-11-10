// engine.js — Minimalist Apple Cupertino 2K Retina Spatial Glass Engine for Google Antigravity
export const W = 1920, H = 1080, TAU = Math.PI * 2;

export const LIGHT = {
  bg0: '#FFFFFF',
  bg1: '#F5F5F7',
  card: '#FFFFFF',
  ink: '#1D1D1F',
  sub: '#6E6E73',
  mute: '#86868B',
  line: 'rgba(0,0,0,0.065)',
  blue: '#0071E3',
};

export const DARK = {
  bg0: '#000000',
  bg1: '#090B12',
  card: '#14151A',
  ink: '#F5F5F7',
  sub: '#A1A1A6',
  mute: '#6E6E73',
  line: 'rgba(255,255,255,0.13)',
  blue: '#2997FF',
};

// ───────────────────────── Math & Apple Spring Curves ─────────────────────────
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, t0, t1) => (t1 <= t0 ? (t >= t1 ? 1 : 0) : clamp((t - t0) / (t1 - t0), 0, 1));
export const ss = x => { const u = clamp(x); return u * u * (3 - 2 * u); };
export const eo = x => 1 - Math.pow(1 - clamp(x), 3.2);
export const ei = x => Math.pow(clamp(x), 3.0);
export const eio = x => { const u = clamp(x); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };

export function appleSpring(dt, omega = 14.0, zeta = 0.84) {
  if (dt <= 0) return 0;
  if (zeta >= 1) return 1 - (1 + omega * dt) * Math.exp(-omega * dt);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * dt) * (Math.cos(wd * dt) + (zeta * omega / wd) * Math.sin(wd * dt));
}

export function font(px, wt = 600, fam = 'zh') {
  if (fam === 'mono') return `${wt} ${px}px JBMono, NotoSC, monospace`;
  if (fam === 'disp') return `${wt} ${px}px InterTight, Inter, NotoSC, sans-serif`;
  return `${wt} ${px}px Inter, NotoSC, sans-serif`;
}

// ───────────────────────── Native 2K (2560x1440) Coordinate Scaling ─────────────────────────
export function beginFrame(g) {
  const sx = g.canvas.width / W;
  const sy = g.canvas.height / H;
  g.setTransform(sx, 0, 0, sy, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  return sx;
}

export const getDpr = g => g.canvas.width / W;

// ───────────────────────── Reusable Offscreen Retina Buffers ─────────────────────────
const BUFS = new Map();
export function buf(key, w, h) {
  let b = BUFS.get(key);
  if (!b || b.c.width !== w || b.c.height !== h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    b = { c, g };
    BUFS.set(key, b);
  }
  b.g.setTransform(1, 0, 0, 1, 0, 0);
  b.g.globalAlpha = 1;
  b.g.globalCompositeOperation = 'source-over';
  b.g.filter = 'none';
  b.g.clearRect(0, 0, w, h);
  return [b.c, b.g];
}

export function rr(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.roundRect(x, y, w, h, rad);
}

// ───────────────────────── Minimalist Studio Background & Spectrum Aura ─────────────────────────
export function studioBg(g, { dark = 0, pureWhite = 0, aura = 0, t = 0, auraCx = W / 2, auraCy = H / 2 } = {}) {
  if (dark < 0.999) {
    const grd = g.createRadialGradient(W * 0.5, H * 0.24, 60, W * 0.5, H * 0.55, W * 0.78);
    grd.addColorStop(0, '#FFFFFF');
    grd.addColorStop(1, pureWhite > 0.5 ? lerpColor('#F5F5F7', '#FFFFFF', pureWhite) : '#F4F5F7');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }
  if (dark > 0.001) {
    g.save();
    g.globalAlpha = dark;
    const dgrd = g.createRadialGradient(W * 0.5, H * 0.36, 80, W * 0.5, H * 0.55, W * 0.75);
    dgrd.addColorStop(0, '#090D18');
    dgrd.addColorStop(0.58, '#020306');
    dgrd.addColorStop(1, '#000000');
    g.fillStyle = dgrd;
    g.fillRect(0, 0, W, H);
    g.restore();
  }
  if (aura > 0.005) {
    drawSpectrumAura(g, auraCx, auraCy, 560, 340, aura, t, dark > 0.5);
  }
}

function lerpColor(c1, c2, t) {
  const p1 = parseInt(c1.slice(1), 16), p2 = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp((p1 >> 16) & 255, (p2 >> 16) & 255, t));
  const gg = Math.round(lerp((p1 >> 8) & 255, (p2 >> 8) & 255, t));
  const b = Math.round(lerp(p1 & 255, p2 & 255, t));
  return `rgb(${r},${gg},${b})`;
}

export function drawSpectrumAura(g, cx, cy, rx, ry, alpha, t = 0, isDark = false) {
  const cols = [
    [50, 134, 255],
    [52, 168, 83],
    [251, 188, 5],
    [234, 67, 53],
  ];
  g.save();
  g.globalCompositeOperation = isDark ? 'screen' : 'source-over';
  for (let i = 0; i < 4; i++) {
    const ang = t * 0.40 + i * (Math.PI / 2);
    const ox = cx + Math.cos(ang) * rx * 0.50;
    const oy = cy + Math.sin(ang) * ry * 0.46;
    const rad = Math.max(rx, ry) * 0.78;
    const gr = g.createRadialGradient(ox, oy, 0, ox, oy, rad);
    const [r, gg, b] = cols[i];
    const pk = (isDark ? 0.14 : 0.095) * alpha;
    gr.addColorStop(0, `rgba(${r},${gg},${b},${pk.toFixed(4)})`);
    gr.addColorStop(0.55, `rgba(${r},${gg},${b},${(pk * 0.35).toFixed(4)})`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  g.restore();
}

// ───────────────────────── 128-Slice 2K 2.5D Strip-Perspective Projection ─────────────────────────
export function perspective(g, srcCanvas, cx, cy, w, h, rotY = 0, { fov = 1550, slices = 128, alpha = 1 } = {}) {
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  const project = (u, v) => {
    const lx = (u - 0.5) * w;
    const ly = (v - 0.5) * h;
    const x3 = lx * cos;
    const z3 = lx * sin;
    const s = fov / Math.max(180, fov + z3);
    return [cx + x3 * s, cy + ly * s, s];
  };
  if (alpha <= 0.002) return project;

  g.save();
  g.globalAlpha *= alpha;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';

  if (Math.abs(rotY) < 0.002) {
    g.drawImage(srcCanvas, cx - w / 2, cy - h / 2, w, h);
    g.restore();
    return project;
  }

  const sw = srcCanvas.width, sh = srcCanvas.height;
  for (let i = 0; i < slices; i++) {
    const u0 = i / slices, u1 = (i + 1) / slices;
    const [x0, , s0] = project(u0, 0.5);
    const [x1, , s1] = project(u1, 0.5);
    const sm = 0.5 * (s0 + s1);
    const dh = h * sm;
    const dx = Math.min(x0, x1);
    const dw = Math.abs(x1 - x0) + 0.65;
    const sx = u0 * sw;
    const ssw = Math.max(1, (u1 - u0) * sw);
    g.drawImage(srcCanvas, sx, 0, ssw, sh, dx, cy - dh / 2, dw, dh);
  }
  g.restore();
  return project;
}

// ───────────────────────── Apple Floating 2K Retina Window ─────────────────────────
export function drawRetinaWindow(g, img, cx, cy, w, h, {
  r = 26,
  rotY = 0,
  alpha = 1,
  dark = false,
  rainbowRim = 0,
  blueRim = 0,
  sweep = -1,
  crop = null,
  innerZoom = 1,
  innerPanX = 0,
  innerPanY = 0,
  padBg = null,
  bufKey = 'win_main',
  shadowMul = 1,
} = {}) {
  if (!img || alpha <= 0.005) return;
  const dpr = getDpr(g);

  // 1. Physical multi-layer Apple shadow + optional subtle spectrum/blue rim glow
  g.save();
  g.globalAlpha = alpha;
  const cos = Math.cos(rotY);
  const effW = w * cos;

  if (rainbowRim > 0.01) {
    drawSpectrumAura(g, cx, cy, effW * 0.70, h * 0.70, rainbowRim, sweep * 2.0, dark);
  }
  if (blueRim > 0.01) {
    g.save();
    const bgr = g.createRadialGradient(cx, cy, effW * 0.15, cx, cy, Math.max(effW, h) * 0.65);
    bgr.addColorStop(0, `rgba(49,134,255,${(0.24 * blueRim).toFixed(3)})`);
    bgr.addColorStop(1, 'rgba(49,134,255,0)');
    g.fillStyle = bgr;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  if (shadowMul > 0.01) {
    g.save();
    g.shadowColor = dark ? `rgba(0,0,0,${0.72 * shadowMul})` : `rgba(15,20,35,${0.10 * shadowMul})`;
    g.shadowBlur = (dark ? 78 : 70) * dpr;
    g.shadowOffsetY = (dark ? 28 : 26) * dpr;
    g.fillStyle = dark ? '#0D0E13' : '#FFFFFF';
    rr(g, cx - effW / 2 + 4, cy - h / 2 + 4, Math.max(20, effW - 8), h - 8, r);
    g.fill();

    if (!dark) {
      g.shadowColor = `rgba(15,20,35,${0.05 * shadowMul})`;
      g.shadowBlur = 20 * dpr;
      g.shadowOffsetY = 8 * dpr;
      g.fill();
    }
    g.restore();
  }
  g.restore();

  // 2. Render full native 2K resolution buffer
  const bw = Math.max(16, Math.round(w * dpr));
  const bh = Math.max(16, Math.round(h * dpr));
  const [wc, wg] = buf(bufKey, bw, bh);
  wg.scale(dpr, dpr);

  wg.save();
  rr(wg, 0, 0, w, h, r);
  wg.clip();

  wg.fillStyle = padBg || (dark ? '#14151B' : '#FFFFFF');
  wg.fillRect(0, 0, w, h);

  const sx = crop ? crop[0] : 0;
  const sy = crop ? crop[1] : 0;
  const sw = crop ? crop[2] : img.width;
  const sh = crop ? crop[3] : img.height;

  const scale = Math.max(w / sw, h / sh) * innerZoom;
  const dw = sw * scale, dh = sh * scale;
  const dx = (w - dw) * 0.5 - innerPanX * dw;
  const dy = (h - dh) * 0.5 - innerPanY * dh;
  wg.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

  if (sweep >= 0 && sweep <= 1) {
    const gx0 = lerp(-w * 0.6, w * 1.4, sweep);
    const lgr = wg.createLinearGradient(gx0, 0, gx0 + w * 0.35, h * 0.65);
    const pk = dark ? 0.12 : 0.22;
    lgr.addColorStop(0, 'rgba(255,255,255,0)');
    lgr.addColorStop(0.5, `rgba(255,255,255,${pk})`);
    lgr.addColorStop(1, 'rgba(255,255,255,0)');
    wg.fillStyle = lgr;
    wg.fillRect(0, 0, w, h);
  }
  wg.restore();

  wg.save();
  wg.lineWidth = rainbowRim > 0.05 ? 2.0 : 1.3;
  if (rainbowRim > 0.05) {
    const rgr = wg.createLinearGradient(0, 0, w, h);
    rgr.addColorStop(0.00, `rgba(49,134,255,${0.62 * rainbowRim})`);
    rgr.addColorStop(0.35, `rgba(52,168,83,${0.52 * rainbowRim})`);
    rgr.addColorStop(0.70, `rgba(251,188,5,${0.52 * rainbowRim})`);
    rgr.addColorStop(1.00, `rgba(234,67,53,${0.62 * rainbowRim})`);
    wg.strokeStyle = rgr;
  } else if (blueRim > 0.05) {
    wg.strokeStyle = `rgba(49,134,255,${0.72 * blueRim})`;
    wg.lineWidth = 2.0;
  } else {
    wg.strokeStyle = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.07)';
  }
  rr(wg, 1, 1, w - 2, h - 2, r - 1);
  wg.stroke();
  wg.restore();

  return perspective(g, wc, cx, cy, w, h, rotY, { slices: 128, alpha });
}

// ───────────────────────── Minimalist Single-Line Apple Headline ─────────────────────────
export function drawHeroTitle(g, title, {
  x = 960,
  y = 132,
  dark = false,
  progress = 1,
  px = 54,
} = {}) {
  if (!title || progress <= 0.01) return;
  const p = eo(clamp(progress, 0, 1));
  g.save();
  g.globalAlpha = p;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  if (dark) {
    const tgr = g.createLinearGradient(x - 320, y - px, x + 320, y + 8);
    tgr.addColorStop(0, '#FFFFFF');
    tgr.addColorStop(0.68, '#F5F5F7');
    tgr.addColorStop(1, '#B4B8C2');
    g.fillStyle = tgr;
  } else {
    g.fillStyle = LIGHT.ink;
  }
  g.font = font(px, 700, 'zh');
  if (g.letterSpacing !== undefined) g.letterSpacing = '-1.2px';
  g.fillText(title, x, y + (1 - p) * 18);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  g.restore();
}

// ───────────────────────── Crisp Vector Pointer Cursor ─────────────────────────
export function drawCursor(g, x, y, { press = 0, scale = 1.25, alpha = 1 } = {}) {
  if (alpha <= 0.01) return;
  const dpr = getDpr(g);
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);

  if (press > 0.01) {
    const rp = clamp(press, 0, 1);
    g.strokeStyle = `rgba(0,113,227,${(1 - rp) * 0.62})`;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(0, 0, 8 + rp * 34, 0, TAU);
    g.stroke();
  }

  const sc = scale * (1 - 0.14 * Math.sin(clamp(press * 2.2, 0, 1) * Math.PI));
  g.scale(sc, sc);
  g.shadowColor = 'rgba(0,0,0,0.26)';
  g.shadowBlur = 8 * dpr;
  g.shadowOffsetY = 3 * dpr;

  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 22);
  g.lineTo(5.8, 17.2);
  g.lineTo(9.8, 25.5);
  g.lineTo(13.2, 23.8);
  g.lineTo(9.2, 15.6);
  g.lineTo(16.2, 15.6);
  g.closePath();
  g.fillStyle = '#1D1D1F';
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 1.8;
  g.strokeStyle = '#FFFFFF';
  g.stroke();
  g.restore();
}
