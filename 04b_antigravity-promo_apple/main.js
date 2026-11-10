import { DUR } from './timeline.js';
import { renderFrame, renderPoster, buildEvents, visibleTexts } from './film.js';

const canvas = document.getElementById('c');
canvas.width = window.innerWidth || 2560;
canvas.height = window.innerHeight || 1440;

const g = canvas.getContext('2d');
g.imageSmoothingEnabled = true;
g.imageSmoothingQuality = 'high';

const params = new URLSearchParams(location.search);
const scene = params.get('scene') || '';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = async () => {
      try { if (im.decode) await im.decode(); } catch {}
      resolve(im);
    };
    im.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    im.src = src;
  });
}

async function rasterizeSvg(src, targetW) {
  const im = await loadImage(src);
  const ratio = (im.naturalHeight || 217) / (im.naturalWidth || 1687);
  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = Math.max(16, Math.round(targetW * ratio));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, 0, 0, c.width, c.height);
  return c;
}

const IMG = {};
const SEQ_CACHE = new Map();
const MAX_CACHE = 72;

async function getSeq(seqName, idx) {
  const pad = String(idx).padStart(3, '0');
  const key = `${seqName}/${pad}`;
  if (SEQ_CACHE.has(key)) {
    const v = SEQ_CACHE.get(key);
    SEQ_CACHE.delete(key);
    SEQ_CACHE.set(key, v);
    return v;
  }
  const im = await loadImage(`assets/seq/${seqName}/f_${pad}.jpg`);
  SEQ_CACHE.set(key, im);
  if (SEQ_CACHE.size > MAX_CACHE) {
    const oldest = SEQ_CACHE.keys().next().value;
    SEQ_CACHE.delete(oldest);
  }
  return im;
}

const assets = { IMG, getSeq };

window.DUR = DUR;
window.EV = buildEvents();
window.TEXTS = (t) => (scene === 'poster' ? [] : visibleTexts(t, canvas.width, canvas.height));
window.render = async (t) => {
  if (canvas.width !== (window.innerWidth || 2560) || canvas.height !== (window.innerHeight || 1440)) {
    canvas.width = window.innerWidth || 2560;
    canvas.height = window.innerHeight || 1440;
  }
  if (scene === 'poster') {
    await renderPoster(g, assets);
  } else {
    await renderFrame(g, t, assets);
  }
};

async function init() {
  await Promise.all([
    document.fonts.load('400 28px Inter'),
    document.fonts.load('500 28px Inter'),
    document.fonts.load('600 28px Inter'),
    document.fonts.load('600 64px InterTight'),
    document.fonts.load('700 64px InterTight'),
    document.fonts.load('500 20px JBMono'),
    document.fonts.load('500 28px NotoSC'),
    document.fonts.load('600 52px NotoSC'),
    document.fonts.load('700 64px NotoSC'),
  ]);
  await document.fonts.ready;

  const entries = [
    ['new_chat',      'assets/product/new-chat.png'],
    ['ide_agent',     'assets/product/ide-agent.jpg'],
    ['ide_editor',    'assets/product/ide-editor.jpg'],
    ['ide_artifacts', 'assets/product/ide-artifacts.jpg'],
    ['subagents',     'assets/product/subagents.png'],
    ['scheduled',     'assets/product/scheduled.png'],
    ['artifacts_app', 'assets/product/artifacts-app.png'],
    ['marketplace',   'assets/product/marketplace.png'],
    ['cli_sub',       'assets/product/cli-subagents.jpg'],
  ];

  const loaded = await Promise.all(entries.map(async ([k, u]) => [k, await loadImage(u)]));
  for (const [k, im] of loaded) IMG[k] = im;

  IMG.lockup_light = await rasterizeSvg('assets/brand/lockup-light.svg', 2800);
  IMG.icon_color   = await rasterizeSvg('assets/brand/icon-color.svg', 800);

  await window.render(0);
  window.READY = true;
}

init();
