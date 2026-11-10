// film.js — Minimalist 8-Shot Apple Cupertino 2K 60fps Launch Film for Google Antigravity
import * as E from './engine.js';
import { DUR, CUES, BENTO_ITEMS } from './timeline.js';

const { W, H, LIGHT, clamp, lerp, seg, ss, eo, ei, eio, appleSpring, TAU } = E;

// ───────────────────────── Sound / Foley Events for mix.py & cuecheck.py ─────────────────────────
export function buildEvents() {
  const ev = [];

  // S1 Particle liftoff shimmer & Official Lockup chime
  ev.push({ t: 0.15,           type: 'air_lift',    gain: 0.55 });
  ev.push({ t: CUES.logo_lock, type: 'glass_chime', pitch: 1.00, gain: 0.78 });

  // S2 Natural language Composer typing & click
  ev.push({ t: CUES.s2_cut,    type: 'card_glide',  pan: 0.10,  gain: 0.55 });
  for (let k = 0; k < 14; k++) {
    ev.push({
      t: +(8.10 + k * 0.165).toFixed(4),
      type: 'apple_key',
      pan: +((k / 13 - 0.5) * 0.25).toFixed(2),
      gain: 0.36,
    });
  }
  ev.push({ t: CUES.prompt_send, type: 'trackpad_click', gain: 0.82 });

  // S3 Antigravity IDE live Tab flow
  ev.push({ t: CUES.s3_cut,    type: 'whip_soft',  pan: -0.10, gain: 0.62 });
  ev.push({ t: CUES.tab_jump1, type: 'tab_spark',  pan: 0.12,  gain: 0.65 });
  ev.push({ t: CUES.tab_jump2, type: 'tab_spark',  pan: 0.18,  gain: 0.68 });

  // S4 Agent Manager parallel subagents & Scheduled Tasks
  ev.push({ t: CUES.s4_cut,      type: 'card_glide', pan: -0.20, gain: 0.60 });
  ev.push({ t: CUES.sub_spawn1,  type: 'pill_pop',   pan: -0.30, gain: 0.50 });
  ev.push({ t: CUES.sub_spawn2,  type: 'pill_pop',   pan: -0.20, gain: 0.54 });
  ev.push({ t: CUES.sub_spawn3,  type: 'pill_pop',   pan: -0.10, gain: 0.58 });
  ev.push({ t: 24.25,            type: 'card_glide', pan: 0.35,  gain: 0.55 });
  ev.push({ t: CUES.cron_toggle, type: 'toggle_tick', pan: 0.35, gain: 0.56 });

  // Midpoint Silence [29.50, 30.50] -> Pro Space Black Drop
  ev.push({ t: 29.20,          type: 'pre_silence_swell', gain: 0.62 });
  ev.push({ t: CUES.pro_drop,  type: 'pro_sub_bloom',     gain: 0.92 });

  // S5 Artifacts + Live Browser Agent
  ev.push({ t: CUES.browser_in,    type: 'card_glide',     pan: 0.28, gain: 0.65 });
  ev.push({ t: CUES.browser_click, type: 'trackpad_click', pan: 0.28, gain: 0.78 });
  ev.push({ t: 36.45,              type: 'glass_chime',    pitch: 1.25, gain: 0.62 });

  // S6 agy CLI + Python SDK + Marketplace
  ev.push({ t: CUES.s6_cut,      type: 'whip_soft',  pan: -0.22, gain: 0.60 });
  ev.push({ t: CUES.sdk_card_in, type: 'pill_pop',   pan: 0.32,  gain: 0.55 });
  ev.push({ t: CUES.mkt_card_in, type: 'pill_pop',   pan: 0.34,  gain: 0.55 });

  // S7 Apple 6-Card Bento Grid Snap Sequence
  ev.push({ t: CUES.bento_cut, type: 'air_lift', gain: 0.65 });
  [CUES.bento_1, CUES.bento_2, CUES.bento_3, CUES.bento_4, CUES.bento_5, CUES.bento_6].forEach((bt, i) => {
    ev.push({
      t: bt,
      type: 'bento_snap',
      pitch: +(1.0 + i * 0.08).toFixed(3),
      pan: +(((i % 3) - 1) * 0.35).toFixed(2),
      gain: 0.68,
    });
  });

  // S8 Clean Finale Lockup & Specular Glint
  ev.push({ t: CUES.finale_open,  type: 'air_lift',    gain: 0.52 });
  ev.push({ t: CUES.finale_glint, type: 'glass_chime', pitch: 1.50, gain: 0.75 });

  return ev.sort((a, b) => a.t - b.t);
}

// ───────────────────────── Minimalist SDK Dark Titanium Card ─────────────────────────
function drawSdkCard(g, cx, cy, w, h, alpha = 1, sweep = -1) {
  if (alpha <= 0.01) return;
  const dpr = E.getDpr(g);
  const x = cx - w / 2, y = cy - h / 2;
  g.save();
  g.globalAlpha = alpha;
  g.shadowColor = 'rgba(0,0,0,0.68)';
  g.shadowBlur = 56 * dpr;
  g.shadowOffsetY = 20 * dpr;
  g.fillStyle = '#12141C';
  E.rr(g, x, y, w, h, 24);
  g.fill();
  g.shadowColor = 'transparent';

  const tgr = g.createLinearGradient(x, y, x + w, y + h);
  tgr.addColorStop(0, 'rgba(49,134,255,0.11)');
  tgr.addColorStop(1, 'rgba(20,22,30,0.0)');
  g.fillStyle = tgr;
  E.rr(g, x, y, w, h, 24);
  g.fill();

  g.lineWidth = 1.4;
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  E.rr(g, x + 0.7, y + 0.7, w - 1.4, h - 1.4, 23);
  g.stroke();

  // Three clean, large, syntax-highlighted Python lines — zero small clutter badges
  const lines = [
    [['#FF7B72', 'from '], ['#E6EDF3', 'google.antigravity '], ['#FF7B72', 'import '], ['#79C0FF', 'Agent']],
    [['#FF7B72', 'async with '], ['#79C0FF', 'Agent'], ['#E6EDF3', '() '], ['#FF7B72', 'as '], ['#E6EDF3', 'agent:']],
    [['#E6EDF3', '    '], ['#FF7B72', 'await '], ['#E6EDF3', 'agent.chat('], ['#A5D6FF', '"Verify & ship"'], ['#E6EDF3', ')']],
  ];
  g.font = E.font(20, 500, 'mono');
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  lines.forEach((segs, idx) => {
    let lx = x + 44;
    const ly = y + 76 + idx * 52;
    segs.forEach(([col, str]) => {
      g.fillStyle = col;
      g.fillText(str, lx, ly);
      lx += g.measureText(str).width;
    });
  });

  if (sweep >= 0 && sweep <= 1) {
    g.save();
    E.rr(g, x, y, w, h, 24);
    g.clip();
    const sx0 = lerp(x - w * 0.4, x + w * 1.2, sweep);
    const sgr = g.createLinearGradient(sx0, y, sx0 + 180, y + h);
    sgr.addColorStop(0, 'rgba(255,255,255,0)');
    sgr.addColorStop(0.5, 'rgba(255,255,255,0.11)');
    sgr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sgr;
    g.fillRect(x, y, w, h);
    g.restore();
  }
  g.restore();
}

// ───────────────────────── Minimalist Apple Bento Card (One Clean Title + Visual) ─────────────────────────
function drawBentoCard(g, x, y, w, h, item, previewImg, previewCrop, p, idx) {
  if (p <= 0.01) return;
  const dpr = E.getDpr(g);
  const sc = lerp(0.90, 1.0, p);
  const liftY = (1 - p) * 30;
  const cx = x + w / 2, cy = y + h / 2 + liftY;

  g.save();
  g.globalAlpha = clamp(p * 1.25, 0, 1);
  g.translate(cx, cy);
  g.scale(sc, sc);
  g.translate(-w / 2, -h / 2);

  g.shadowColor = 'rgba(15,20,35,0.075)';
  g.shadowBlur = 38 * dpr;
  g.shadowOffsetY = 14 * dpr;
  g.fillStyle = '#FFFFFF';
  E.rr(g, 0, 0, w, h, 28);
  g.fill();
  g.shadowColor = 'transparent';

  g.lineWidth = 1;
  g.strokeStyle = 'rgba(0,0,0,0.055)';
  E.rr(g, 0.5, 0.5, w - 1, h - 1, 27.5);
  g.stroke();

  // Single restrained title — zero small kickers or sub-lines
  g.fillStyle = LIGHT.ink;
  g.font = E.font(26, 700, 'zh');
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  if (g.letterSpacing !== undefined) g.letterSpacing = '-0.5px';
  g.fillText(item.title, 30, 52);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';

  if (previewImg) {
    const px = 22, py = 76, pw = w - 44, ph = h - 98;
    g.save();
    E.rr(g, px, py, pw, ph, 18);
    g.clip();
    g.fillStyle = idx === 2 || idx === 4 || idx === 5 ? '#10121A' : '#F6F7FA';
    g.fillRect(px, py, pw, ph);

    const sx = previewCrop ? previewCrop[0] : 0;
    const sy = previewCrop ? previewCrop[1] : 0;
    const sw = previewCrop ? previewCrop[2] : previewImg.width;
    const sh = previewCrop ? previewCrop[3] : previewImg.height;
    const s = Math.max(pw / sw, ph / sh);
    const dw = sw * s, dh = sh * s;
    g.drawImage(previewImg, sx, sy, sw, sh, px + (pw - dw) / 2, py + (ph - dh) * 0.22, dw, dh);
    g.restore();

    g.strokeStyle = 'rgba(0,0,0,0.06)';
    g.lineWidth = 1;
    E.rr(g, px + 0.5, py + 0.5, pw - 1, ph - 1, 17.5);
    g.stroke();
  }

  g.restore();
}

// ───────────────────────── Main Deterministic 2K 60fps Frame Renderer ─────────────────────────
export async function renderFrame(g, t, assets) {
  const { IMG, getSeq } = assets;
  E.beginFrame(g);

  // ═══════════════════ S1 (0.00 – 6.50 s): Pure Gallery Porcelain Liftoff -> Official Lockup ═══════════════════
  if (t < 6.50) {
    const outFade = 1 - eio(seg(t, 6.20, 6.50));
    E.studioBg(g, { dark: 0, pureWhite: 1, aura: ss(seg(t, 1.5, 3.2)) * 0.65 * outFade, t });

    // 1. Smooth 60fps cross-blended particle liftoff sequence (0.00 -> 2.45 s)
    const seqFade = 1 - ss(seg(t, 1.72, 2.42));
    if (seqFade > 0.01) {
      const exactF = clamp((t / 2.42) * 120 + 1, 1, 156);
      const f0 = Math.floor(exactF);
      const f1 = Math.min(156, f0 + 1);
      const frac = exactF - f0;
      const logoA = await getSeq('logo', f0);
      if (logoA) {
        g.save();
        g.globalAlpha = seqFade * outFade;
        g.drawImage(logoA, 0, 0, W, H);
        if (frac > 0.02 && f1 !== f0) {
          const logoB = await getSeq('logo', f1);
          if (logoB) {
            g.globalAlpha = seqFade * outFade * frac;
            g.drawImage(logoB, 0, 0, W, H);
          }
        }
        g.restore();
      }
    }

    // 2. Pure Official Vector Lockup alone in white space — zero small text underneath
    const lockIn = ss(seg(t, 1.48, 2.25));
    if (lockIn > 0.01 && IMG.lockup_light) {
      const sp = appleSpring(Math.max(0, t - 1.48), 11.5, 0.85);
      const sc = lerp(0.92, 1.0, clamp(sp, 0, 1.04)) * lerp(1.0, 1.035, seg(t, 2.25, 6.50));
      const lw = 900, lh = lw * (IMG.lockup_light.height / IMG.lockup_light.width);
      g.save();
      g.globalAlpha = lockIn * outFade;
      g.translate(960, 528);
      g.scale(sc, sc);
      g.drawImage(IMG.lockup_light, -lw / 2, -lh / 2, lw, lh);
      g.restore();
    }
  }

  // ═══════════════════ S2 (6.50 – 13.50 s): One Prompt. Global Action ═══════════════════
  else if (t < 13.50) {
    const enterP = clamp(appleSpring(t - 6.50, 13.5, 0.84), 0, 1.03);
    const exitP = eio(seg(t, 13.15, 13.50));
    E.studioBg(g, { dark: 0, aura: 0.72 * (1 - exitP), t, auraCx: 1120, auraCy: 585 });

    E.drawHeroTitle(g, '一句意图，全局行动。', {
      x: 960,
      y: 146,
      progress: ss(seg(t, 6.55, 7.20)) * (1 - exitP),
      px: 56,
    });

    // Left-back secondary window: Official `new-chat.png`
    E.drawRetinaWindow(g, IMG.new_chat, 495 - exitP * 70, 596 + (1 - enterP) * 52, 600, 520, {
      r: 26,
      rotY: lerp(0.20, 0.13, seg(t, 6.50, 12.50)),
      alpha: clamp(enterP, 0, 1) * 0.92 * (1 - exitP),
      crop: [114, 248, 1272, 1100],
      bufKey: 's2_back',
      shadowMul: 0.85,
    });

    // Right-front Hero window: Official `ide-agent.jpg` Composer
    const pushZoom = lerp(1.0, 1.045, eio(seg(t, 7.80, 11.60)));
    const hCx = 1160 - exitP * 55, hCy = 586 + (1 - enterP) * 42;
    const hW = 900 * pushZoom, hH = 522 * pushZoom;
    const rotY = lerp(-0.11, -0.02, eio(seg(t, 6.50, 11.50)));

    E.drawRetinaWindow(g, IMG.ide_agent, hCx, hCy, hW, hH, {
      r: 28,
      rotY,
      alpha: clamp(enterP, 0, 1) * (1 - exitP),
      rainbowRim: 0.90,
      sweep: seg(t, 6.80, 8.20),
      crop: [128, 250, 1180, 684],
      bufKey: 's2_hero',
    });

    // Live Typed Prompt Overlay inside the white input field
    const typeP = seg(t, 8.05, 10.60);
    if (typeP > 0 && exitP < 0.85) {
      const fullPrompt = '重构全栈认证模块，并行编写单元测试并在浏览器实机验证';
      const nChars = Math.max(1, Math.floor(fullPrompt.length * typeP));
      const shown = fullPrompt.slice(0, nChars);

      g.save();
      g.globalAlpha = (1 - exitP) * ss(seg(t, 8.00, 8.15));
      const cosR = Math.cos(rotY);
      const tx = hCx - hW * 0.342 * cosR;
      const ty = hCy + hH * 0.012;
      g.fillStyle = '#FFFFFF';
      g.fillRect(tx - 16, ty - 28, hW * 0.72 * cosR, 56);

      g.fillStyle = '#1D1D1F';
      g.font = E.font(Math.round(22 * pushZoom), 500, 'zh');
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(shown, tx, ty);

      const cw = g.measureText(shown).width;
      const blink = t < 10.65 || Math.sin(t * 10) > -0.2 ? 1 : 0.2;
      g.fillStyle = `rgba(0,113,227,${blink})`;
      g.fillRect(tx + cw + 4, ty - 13, 2.5, 26);
      g.restore();
    }

    // Smooth 60fps Cursor Glide & Click on Blue Send Arrow
    if (t >= 10.40) {
      const cp = eio(seg(t, 10.40, 11.45));
      const cosR = Math.cos(rotY);
      const sendX = hCx + hW * 0.373 * cosR, sendY = hCy + hH * 0.171;
      const curX = lerp(hCx + 40, sendX, cp);
      const curY = lerp(hCy + 150, sendY, cp);
      const press = t >= CUES.prompt_send ? clamp((t - CUES.prompt_send) / 0.45, 0, 1) : 0;
      E.drawCursor(g, curX, curY, { press, scale: 1.25, alpha: 1 - exitP });
    }
  }

  // ═══════════════════ S3 (13.50 – 21.50 s): Monumental Centered Antigravity IDE (`editor.mp4`) ═══════════════════
  else if (t < 21.50) {
    const enterP = clamp(appleSpring(t - 13.50, 13.5, 0.84), 0, 1.03);
    const exitP = eio(seg(t, 21.15, 21.50));
    E.studioBg(g, { dark: 0, pureWhite: 0.45, aura: 0.80 * (1 - exitP), t, auraCx: 960, auraCy: 600 });

    E.drawHeroTitle(g, '行云流水，先你一步。', {
      x: 960,
      y: 138,
      progress: ss(seg(t, 13.55, 14.20)) * (1 - exitP),
      px: 56,
    });

    const localT = clamp(t - 13.50, 0, 8.0);
    const fIdx = clamp(Math.floor((localT / 8.0) * 245) + 1, 1, 246);
    const edFrame = await getSeq('editor', fIdx);

    const guidedZoom = lerp(1.02, 1.10, eio(seg(t, 14.20, 19.80)));
    E.drawRetinaWindow(g, edFrame || IMG.ide_editor, 960, 598 + (1 - enterP) * 56, 1240, 742, {
      r: 30,
      rotY: lerp(-0.08, 0.02, eio(seg(t, 13.50, 20.50))),
      alpha: clamp(enterP, 0, 1) * (1 - exitP),
      rainbowRim: 0.92,
      padBg: '#FFFFFF',
      crop: [85, 160, 1080, 675],
      innerZoom: guidedZoom,
      innerPanX: lerp(-0.015, 0.015, seg(t, 14.0, 20.0)),
      bufKey: 's3_editor',
    });
  }

  // ═══════════════════ S4 (21.50 – 29.50 s): Agent Manager & Scheduled Tasks ═══════════════════
  else if (t < 29.50) {
    const enterP = clamp(appleSpring(t - 21.50, 13.5, 0.84), 0, 1.03);
    E.studioBg(g, { dark: 0, aura: 0.76, t, auraCx: 960, auraCy: 590 });

    E.drawHeroTitle(g, '多路智能体，并行升空。', {
      x: 960,
      y: 138,
      progress: ss(seg(t, 21.55, 22.20)),
      px: 56,
    });

    const splitP = eio(seg(t, 24.00, 25.10));
    const subCx = lerp(960, 598, splitP);
    const subW = lerp(900, 800, splitP);
    const subH = lerp(630, 590, splitP);

    E.drawRetinaWindow(g, IMG.subagents, subCx, 592 + (1 - enterP) * 50, subW, subH, {
      r: 28,
      rotY: lerp(0.0, 0.08, splitP),
      alpha: clamp(enterP, 0, 1),
      rainbowRim: 0.80,
      sweep: seg(t, 21.80, 23.10),
      crop: [114, 248, 1272, 950],
      bufKey: 's4_subagents',
    });

    if (t >= 24.10) {
      const schP = clamp(appleSpring(t - 24.10, 14.0, 0.84), 0, 1.03);
      E.drawRetinaWindow(g, IMG.scheduled, 1392 + (1 - schP) * 85, 596, 730, 575, {
        r: 28,
        rotY: -0.09,
        alpha: clamp(schP, 0, 1),
        rainbowRim: 0.50,
        sweep: seg(t, 24.50, 25.80),
        crop: [114, 248, 1272, 1010],
        bufKey: 's4_sched',
      });
    }
  }

  // ═══════════════════ TURN (29.50 – 30.50 s): Pure 1.00s Silence & Space Black Optical Iris ═══════════════════
  else if (t < 30.50) {
    const p = eio(seg(t, 29.50, 30.42));
    E.studioBg(g, { dark: 0, aura: 0.45 * (1 - p), t });

    const maxR = Math.hypot(W / 2, H / 2) + 60;
    const rad = p * maxR;
    g.save();
    g.beginPath();
    g.arc(960, 540, Math.max(1, rad), 0, TAU);
    g.fillStyle = '#000000';
    g.fill();

    if (p > 0.02 && p < 0.98) {
      g.lineWidth = 3.5;
      g.strokeStyle = 'rgba(90,200,250,0.55)';
      g.stroke();
    }
    g.restore();
  }

  // ═══════════════════ S5 (30.50 – 39.00 s): Pro Space Black — Artifacts & Live Browser Agent ═══════════════════
  else if (t < 39.00) {
    const enterP = clamp(appleSpring(t - 30.50, 13.5, 0.84), 0, 1.03);
    const exitP = eio(seg(t, 38.65, 39.00));
    E.studioBg(g, { dark: 1, aura: 0.60 * (1 - exitP), t, auraCx: 1240, auraCy: 590 });

    E.drawHeroTitle(g, '计划、构建、实机自检。', {
      x: 960,
      y: 138,
      dark: true,
      progress: ss(seg(t, 30.55, 31.20)) * (1 - exitP),
      px: 56,
    });

    const splitB = eio(seg(t, CUES.browser_in - 0.15, CUES.browser_in + 0.85));
    const artCx = lerp(960, 542, splitB);
    const artW = lerp(890, 750, splitB);
    const artH = lerp(635, 585, splitB);

    E.drawRetinaWindow(g, IMG.artifacts_app, artCx, 592 + (1 - enterP) * 48, artW, artH, {
      r: 26,
      rotY: lerp(0.02, 0.10, splitB),
      alpha: clamp(enterP, 0, 1) * (1 - exitP),
      dark: true,
      sweep: seg(t, 30.80, 32.20),
      crop: [90, 58, 1410, 1360],
      bufKey: 's5_artifacts',
    });

    if (t >= CUES.browser_in) {
      const brP = clamp(appleSpring(t - CUES.browser_in, 14.0, 0.84), 0, 1.03);
      const localBt = clamp(t - CUES.browser_in, 0, 4.90);
      const bfIdx = clamp(Math.floor((localBt / 4.90) * 169) + 1, 1, 170);
      const brFrame = await getSeq('browser', bfIdx);

      E.drawRetinaWindow(g, brFrame, 1315 + (1 - brP) * 85, 592, 880, 625, {
        r: 24,
        rotY: lerp(-0.13, -0.04, eio(seg(t, CUES.browser_in, 37.80))),
        alpha: clamp(brP, 0, 1) * (1 - exitP),
        dark: true,
        blueRim: 0.95,
        padBg: '#0B0E17',
        innerZoom: lerp(1.0, 1.05, eio(seg(t, 34.80, 38.20))),
        bufKey: 's5_browser',
      });
    }
  }

  // ═══════════════════ S6 (39.00 – 46.50 s): Pro Space Black — agy CLI, Python SDK & Marketplace ═══════════════════
  else if (t < 46.50) {
    const enterP = clamp(appleSpring(t - 39.00, 13.5, 0.84), 0, 1.03);
    const exitP = eio(seg(t, 46.15, 46.50));
    E.studioBg(g, { dark: 1, aura: 0.58 * (1 - exitP), t, auraCx: 620, auraCy: 590 });

    E.drawHeroTitle(g, '终端、SDK 与开放生态。', {
      x: 960,
      y: 138,
      dark: true,
      progress: ss(seg(t, 39.05, 39.70)) * (1 - exitP),
      px: 56,
    });

    const localCt = clamp(t - 39.00, 0, 7.45);
    const cfIdx = clamp(Math.floor((localCt / 7.45) * 227) + 1, 1, 228);
    const cliFrame = await getSeq('cli', cfIdx);

    E.drawRetinaWindow(g, cliFrame || IMG.cli_sub, 588 - exitP * 55, 592 + (1 - enterP) * 45, 865, 608, {
      r: 24,
      rotY: lerp(0.11, 0.04, eio(seg(t, 39.00, 44.50))),
      alpha: clamp(enterP, 0, 1) * (1 - exitP),
      dark: true,
      padBg: '#1F2128',
      sweep: seg(t, 39.30, 40.70),
      bufKey: 's6_cli',
    });

    if (t >= CUES.sdk_card_in) {
      const sdkP = clamp(appleSpring(t - CUES.sdk_card_in, 14.0, 0.84), 0, 1) * (1 - exitP);
      drawSdkCard(g, 1425 + (1 - sdkP) * 55, 434, 650, 260, sdkP, seg(t, CUES.sdk_card_in + 0.30, CUES.sdk_card_in + 1.50));
    }

    if (t >= CUES.mkt_card_in) {
      const mP = clamp(appleSpring(t - CUES.mkt_card_in, 14.0, 0.84), 0, 1) * (1 - exitP);
      E.drawRetinaWindow(g, IMG.marketplace, 1425 + (1 - mP) * 55, 748, 650, 286, {
        r: 24,
        rotY: -0.05,
        alpha: mP,
        dark: true,
        crop: [20, 155, 680, 385],
        bufKey: 's6_mkt',
      });
    }
  }

  // ═══════════════════ S7 (46.50 – 53.50 s): Minimalist Apple 6-Card Bento Grid ═══════════════════
  else if (t < 53.50) {
    const dissolveOut = eio(seg(t, 52.95, 53.50));
    E.studioBg(g, { dark: 0, pureWhite: dissolveOut, aura: 0.50 * (1 - dissolveOut), t });

    E.drawHeroTitle(g, '全栈体验，一屏尽览。', {
      x: 960,
      y: 108,
      progress: ss(seg(t, 46.52, 47.05)) * (1 - dissolveOut),
      px: 48,
    });

    const brSnap = await getSeq('browser', 155);
    const cliSnap = await getSeq('cli', 18);
    const previews = [
      [IMG.subagents,     [114, 255, 1272, 780]],
      [IMG.ide_editor,    [180, 160, 1180, 760]],
      [brSnap,            null],
      [IMG.ide_artifacts, [332, 108, 1258, 780]],
      [cliSnap || IMG.cli_sub, null],
      [IMG.marketplace,   [40, 160, 640, 410]],
    ];
    const bentoTimes = [CUES.bento_1, CUES.bento_2, CUES.bento_3, CUES.bento_4, CUES.bento_5, CUES.bento_6];

    const gx0 = 144, gy0 = 162, cw = 520, ch = 392, gapX = 36, gapY = 30;
    BENTO_ITEMS.forEach((item, idx) => {
      const col = idx % 3, row = Math.floor(idx / 3);
      const bx = gx0 + col * (cw + gapX);
      const by = gy0 + row * (ch + gapY);
      const bp = clamp(appleSpring(t - bentoTimes[idx], 15.0, 0.82), 0, 1.03) * (1 - dissolveOut);
      const [pImg, pCrop] = previews[idx];
      drawBentoCard(g, bx, by, cw, ch, item, pImg, pCrop, bp, idx);
    });
  }

  // ═══════════════════ S8 (53.50 – 60.00 s): Pure Gallery White Finale Lockup ═══════════════════
  else {
    const inP = clamp(appleSpring(t - 53.55, 11.5, 0.86), 0, 1.02);
    E.studioBg(g, { dark: 0, pureWhite: 1, aura: 0.62 * inP, t });

    if (IMG.lockup_light) {
      const lw = 880, lh = lw * (IMG.lockup_light.height / IMG.lockup_light.width);
      const sc = lerp(0.93, 1.0, inP);
      g.save();
      g.globalAlpha = clamp(inP, 0, 1);
      g.translate(960, 446);
      g.scale(sc, sc);
      g.drawImage(IMG.lockup_light, -lw / 2, -lh / 2, lw, lh);

      const swp = seg(t, 54.75, 56.25);
      if (swp > 0 && swp < 1) {
        const starA = Math.sin(swp * Math.PI) * 0.50;
        const gx = -lw * 0.432 + (swp - 0.5) * 44;
        const rgr = g.createRadialGradient(gx, -4, 0, gx, -4, 95);
        rgr.addColorStop(0, `rgba(255,255,255,${starA})`);
        rgr.addColorStop(0.45, `rgba(49,134,255,${starA * 0.30})`);
        rgr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rgr;
        g.beginPath();
        g.arc(gx, -4, 95, 0, TAU);
        g.fill();
      }
      g.restore();
    }

    const subP = ss(seg(t, 54.05, 54.80));
    if (subP > 0.01) {
      g.save();
      g.globalAlpha = subP;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';

      g.fillStyle = LIGHT.ink;
      g.font = E.font(48, 700, 'zh');
      if (g.letterSpacing !== undefined) g.letterSpacing = '-1.0px';
      g.fillText('让创造，脱离引力。', 960, 594 + (1 - subP) * 14);
      if (g.letterSpacing !== undefined) g.letterSpacing = '0px';

      g.fillStyle = LIGHT.mute;
      g.font = E.font(24, 500, 'disp');
      g.fillText('antigravity.google', 960, 656 + (1 - subP) * 14);
      g.restore();
    }
  }
}

// ───────────────────────── Minimalist 2K Poster Scene (?scene=poster) ─────────────────────────
export async function renderPoster(g, assets) {
  const { IMG, getSeq } = assets;
  E.beginFrame(g);
  E.studioBg(g, { dark: 0, pureWhite: 0.55, aura: 0.80, t: 2.4 });

  E.drawRetinaWindow(g, IMG.subagents, 255, 548, 470, 365, {
    r: 24, rotY: 0.20, alpha: 0.88, rainbowRim: 0.55, crop: [95, 248, 1290, 960], bufKey: 'p_left',
  });
  const edSnap = await getSeq('editor', 190);
  E.drawRetinaWindow(g, edSnap || IMG.ide_editor, 1665, 548, 470, 365, {
    r: 24, rotY: -0.20, alpha: 0.88, rainbowRim: 0.55, padBg: '#FFFFFF', crop: [65, 155, 1080, 780], bufKey: 'p_right',
  });

  if (IMG.lockup_light) {
    const lw = 780, lh = lw * (IMG.lockup_light.height / IMG.lockup_light.width);
    g.drawImage(IMG.lockup_light, 960 - lw / 2, 468 - lh / 2, lw, lh);
  }

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = LIGHT.ink;
  g.font = E.font(52, 700, 'zh');
  if (g.letterSpacing !== undefined) g.letterSpacing = '-1.0px';
  g.fillText('让创造，脱离引力。', 960, 622);
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
}

// ───────────────────────── On-Screen Text Boxes for readcheck.mjs (2K-scaled) ─────────────────────────
export function visibleTexts(t, vw = 2560, vh = 1440) {
  const sx = vw / W, sy = vh / H;
  const box = (id, text, x0, y0, x1, y1) => ({
    id, text,
    x0: x0 * sx, y0: y0 * sy,
    x1: x1 * sx, y1: y1 * sy,
  });
  const out = [];

  if (t >= 7.20 && t <= 13.15) {
    out.push(box('s2_hdr', '一句意图，全局行动。', 660, 90, 1260, 165));
  }
  if (t >= 14.20 && t <= 21.15) {
    out.push(box('s3_hdr', '行云流水，先你一步。', 660, 82, 1260, 158));
  }
  if (t >= 22.20 && t <= 29.35) {
    out.push(box('s4_hdr', '多路智能体，并行升空。', 640, 82, 1280, 158));
  }
  if (t >= 31.20 && t <= 38.65) {
    out.push(box('s5_hdr', '计划、构建、实机自检。', 640, 82, 1280, 158));
  }
  if (t >= 39.70 && t <= 46.15) {
    out.push(box('s6_hdr', '终端、SDK 与开放生态。', 620, 82, 1300, 158));
  }
  if (t >= 48.05 && t <= 52.95) {
    out.push(box('s7_hdr', '全栈体验，一屏尽览。', 660, 56, 1260, 124));
    BENTO_ITEMS.forEach((b, idx) => {
      const col = idx % 3, row = Math.floor(idx / 3);
      const bx = 144 + col * 556, by = 162 + row * 422;
      out.push(box(`bento_${idx}`, b.title, bx, by, bx + 520, by + 76));
    });
  }
  if (t >= 54.80 && t <= DUR) {
    out.push(box('s8_tag', '让创造，脱离引力。', 700, 540, 1220, 610));
    out.push(box('s8_url', 'antigravity.google', 760, 624, 1160, 672));
  }
  return out;
}
