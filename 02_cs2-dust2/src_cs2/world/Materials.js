// Counter-Strike: Dust II — High-Resolution Procedural PBR Material & Decal Library
import * as THREE from 'three';

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Convert a grayscale height canvas into a tangent-space Normal Map Texture
function heightCanvasToNormalTexture(heightCanvas, strength = 2.2) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t  = sample(x,     y - 1);
      const tr = sample(x + 1, y - 1);
      const l  = sample(x - 1, y);
      const r  = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b  = sample(x,     y + 1);
      const br = sample(x + 1, y + 1);

      const dx = ((tr + 2 * r + br) - (tl + 2 * l + bl)) * strength;
      const dy = ((bl + 2 * b + br) - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      dst[idx]     = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);

  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function finalizeColorTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// World-space UV projection for BoxGeometry so textures NEVER stretch regardless of wall size!
export function applyWorldBoxUVs(geo, w, h, d, uvScale = 0.28) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + w * 0.5;
    const py = pos.getY(i) + h * 0.5;
    const pz = pos.getZ(i) + d * 0.5;
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));

    if (ny > 0.5) {
      uv.setXY(i, px * uvScale, pz * uvScale);
    } else if (nx > 0.5) {
      uv.setXY(i, pz * uvScale, py * uvScale);
    } else {
      uv.setXY(i, px * uvScale, py * uvScale);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function createWorldBox(w, h, d, material, uvScale = 0.28) {
  const geo = new THREE.BoxGeometry(w, h, d);
  applyWorldBoxUVs(geo, w, h, d, uvScale);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class MaterialLibrary {
  constructor() {
    this.mats = {};
    this._buildAll();
  }

  _buildAll() {
    this.mats.sandstonePlaster = this._makeSandstonePlaster('#e2cca7', '#cbb086', 101);
    this.mats.sandstoneWarm    = this._makeSandstonePlaster('#dfc094', '#c59e6d', 202);
    this.mats.sandstoneTrim    = this._makeStoneBlock('#c9ac82', '#a8895e', 303);
    this.mats.tunnelMasonry    = this._makeStoneBlock('#aba08e', '#857b6b', 404);
    this.mats.desertSand       = this._makeDesertSand();
    this.mats.cobblePaving     = this._makeCobblePaving();
    this.mats.heavyWoodDoor    = this._makeHeavyWoodDoor();
    this.mats.woodCrate        = this._makeWoodCrate();
    this.mats.militaryCrate    = this._makeMilitaryCrate();
    this.mats.blueContainer    = this._makeBlueContainer();
    this.mats.awningCloth      = this._makeAwningCloth();
    this.mats.darkIron         = new THREE.MeshStandardMaterial({
      color: 0x2b2e33, roughness: 0.42, metalness: 0.82
    });
    this.mats.rustedMetal      = new THREE.MeshStandardMaterial({
      color: 0x5c4638, roughness: 0.68, metalness: 0.65
    });
    this.mats.concreteGrey     = this._makeSandstonePlaster('#b8b4aa', '#969186', 505);
  }

  _makeSandstonePlaster(baseHex, accentHex, seed) {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(seed);

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#888888';
    hctx.fillRect(0, 0, size, size);

    // Subtle stucco mottling
    for (let i = 0; i < 1600; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 4 + rng() * 26;
      const bright = rng() > 0.5;
      ctx.fillStyle = bright ? 'rgba(255,248,232,0.045)' : 'rgba(115,86,52,0.05)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      hctx.fillStyle = bright ? 'rgba(205,205,205,0.08)' : 'rgba(60,60,60,0.08)';
      hctx.beginPath();
      hctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      hctx.fill();
    }

    // Horizontal subtle architectural course seams
    ctx.strokeStyle = 'rgba(110,82,50,0.16)';
    hctx.strokeStyle = 'rgba(35,35,35,0.45)';
    ctx.lineWidth = 2;
    hctx.lineWidth = 3;
    for (let row = 0; row < 4; row++) {
      const y = row * (size / 4) + 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      hctx.beginPath(); hctx.moveTo(0, y); hctx.lineTo(size, y); hctx.stroke();
    }

    // Subtle plaster variation & natural limestoneblocks seam lines (no harsh repeating blotches)
    for (let p = 0; p < 18; p++) {
      const px = rng() * size;
      const py = rng() * size;
      const pw = 50 + rng() * 110;
      const ph = 30 + rng() * 70;
      ctx.fillStyle = p % 2 === 0 ? 'rgba(255, 246, 228, 0.06)' : 'rgba(168, 132, 88, 0.065)';
      ctx.fillRect(px, py, pw, ph);
      hctx.fillStyle = p % 2 === 0 ? 'rgba(155,155,155,0.08)' : 'rgba(115,115,115,0.08)';
      hctx.fillRect(px, py, pw, ph);
    }

    // Subtle vertical mortar joints staggered per course
    ctx.strokeStyle = 'rgba(120, 90, 56, 0.11)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) {
      const y0 = row * (size / 4);
      const shift = (row % 2) * (size / 4);
      for (let col = 0; col < 2; col++) {
        const vx = ((col * (size / 2) + shift) % size);
        ctx.beginPath();
        ctx.moveTo(vx, y0);
        ctx.lineTo(vx, y0 + size / 4);
        ctx.stroke();
      }
    }

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 1.8),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.88,
      metalness: 0.02
    });
  }

  _makeStoneBlock(baseHex, mortarHex, seed) {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(seed);

    ctx.fillStyle = mortarHex;
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#252525';
    hctx.fillRect(0, 0, size, size);

    const rows = 8;
    const cols = 4;
    const bh = size / rows;
    const bw = size / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw * 0.5);
      for (let col = -1; col <= cols; col++) {
        const x = col * bw + offset + 3;
        const y = r * bh + 3;
        const w = bw - 6;
        const h = bh - 6;
        const shade = (rng() - 0.5) * 24;

        ctx.fillStyle = baseHex;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = shade > 0 ? `rgba(255,248,230,${shade / 255})` : `rgba(50,38,24,${-shade / 255})`;
        ctx.fillRect(x, y, w, h);

        hctx.fillStyle = `rgb(${165 + Math.round(shade)},${165 + Math.round(shade)},${165 + Math.round(shade)})`;
        hctx.fillRect(x, y, w, h);
      }
    }

    // Fine stone grain
    for (let i = 0; i < 1800; i++) {
      const x = rng() * size;
      const y = rng() * size;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(30,24,18,0.06)';
      ctx.fillRect(x, y, 3, 3);
    }

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 2.6),
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.86,
      metalness: 0.03
    });
  }

  _makeDesertSand() {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(777);

    ctx.fillStyle = '#dec396';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, size, size);

    // Wind-blown sand ripples
    for (let y = 0; y < size; y += 2) {
      const wave = Math.sin((y / size) * Math.PI * 16) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(182,146,96,${wave * 0.14})`;
      ctx.fillRect(0, y, size, 2);
      const hv = Math.round(110 + wave * 45);
      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fillRect(0, y, size, 2);
    }

    // Pebbles & sand speckles
    for (let i = 0; i < 3500; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const s = 1 + rng() * 3;
      ctx.fillStyle = rng() > 0.45 ? 'rgba(250,236,208,0.22)' : 'rgba(138,105,66,0.20)';
      ctx.fillRect(x, y, s, s);
    }

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 1.5),
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.95,
      metalness: 0.0
    });
  }

  _makeCobblePaving() {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(888);

    // Sandy grout between stone tiles
    ctx.fillStyle = '#c8ae84';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#404040';
    hctx.fillRect(0, 0, size, size);

    const grid = 8;
    const step = size / grid;
    for (let gy = 0; gy < grid; gy++) {
      const shift = (gy % 2) * (step * 0.5);
      for (let gx = -1; gx <= grid; gx++) {
        const x = gx * step + shift + 3;
        const y = gy * step + 3;
        const v = Math.round((rng() - 0.5) * 20);
        ctx.fillStyle = `rgb(${206 + v}, ${184 + v}, ${148 + v})`;
        ctx.fillRect(x, y, step - 6, step - 6);

        hctx.fillStyle = `rgb(${175 + v}, ${175 + v}, ${175 + v})`;
        hctx.fillRect(x, y, step - 6, step - 6);
      }
    }

    // Dust accumulation patches
    for (let i = 0; i < 400; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 6 + rng() * 24;
      ctx.fillStyle = 'rgba(222,195,150,0.09)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 2.2),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.88,
      metalness: 0.02
    });
  }

  _makeHeavyWoodDoor() {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(909);

    ctx.fillStyle = '#7e5533';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#909090';
    hctx.fillRect(0, 0, size, size);

    // Vertical planks
    const planks = 6;
    const pw = size / planks;
    for (let p = 0; p < planks; p++) {
      const x = p * pw;
      const tone = (rng() - 0.5) * 24;
      ctx.fillStyle = `rgb(${128 + tone}, ${86 + tone * 0.7}, ${52 + tone * 0.5})`;
      ctx.fillRect(x + 2, 0, pw - 4, size);
      hctx.fillStyle = '#b4b4b4';
      hctx.fillRect(x + 2, 0, pw - 4, size);

      // Wood grain streaks
      for (let g = 0; g < 45; g++) {
        const gx = x + 4 + rng() * (pw - 8);
        ctx.fillStyle = rng() > 0.5 ? 'rgba(55,32,16,0.22)' : 'rgba(175,126,80,0.14)';
        ctx.fillRect(gx, rng() * size, 2, 35 + rng() * 90);
      }

      // Plank gap
      ctx.fillStyle = '#382210';
      ctx.fillRect(x, 0, 3, size);
      hctx.fillStyle = '#282828';
      hctx.fillRect(x, 0, 3, size);
    }

    // Iron cross-straps + rivets (iconic Dust2 Mid Doors!)
    for (const barY of [90, 400]) {
      ctx.fillStyle = '#3a3d40';
      ctx.fillRect(0, barY, size, 32);
      hctx.fillStyle = '#f0f0f0';
      hctx.fillRect(0, barY, size, 32);

      for (let rx = 28; rx < size; rx += pw) {
        ctx.fillStyle = '#1f2124';
        ctx.beginPath(); ctx.arc(rx, barY + 16, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6c7178';
        ctx.beginPath(); ctx.arc(rx - 1, barY + 15, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 2.5),
      roughness: 0.78,
      metalness: 0.12
    });
  }

  _makeWoodCrate() {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(1212);

    ctx.fillStyle = '#b98c56';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#909090';
    hctx.fillRect(0, 0, size, size);

    // Inner horizontal slats
    for (let y = 36; y < size - 36; y += 54) {
      const d = (rng() - 0.5) * 18;
      ctx.fillStyle = `rgb(${182 + d}, ${136 + d}, ${82 + d})`;
      ctx.fillRect(36, y, size - 72, 50);
      ctx.fillStyle = '#6f4e27';
      ctx.fillRect(36, y + 50, size - 72, 4);
      hctx.fillStyle = '#505050';
      hctx.fillRect(36, y + 50, size - 72, 4);
    }

    // Outer frame border & diagonal brace
    ctx.strokeStyle = '#9d713f';
    ctx.lineWidth = 38;
    ctx.strokeRect(19, 19, size - 38, size - 38);
    hctx.strokeStyle = '#e5e5e5';
    hctx.lineWidth = 38;
    hctx.strokeRect(19, 19, size - 38, size - 38);

    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(size - 32, size - 32);
    ctx.lineWidth = 30;
    ctx.stroke();
    hctx.beginPath();
    hctx.moveTo(32, 32);
    hctx.lineTo(size - 32, size - 32);
    hctx.lineWidth = 30;
    hctx.stroke();

    // Stenciled cargo text
    ctx.fillStyle = 'rgba(42,28,16,0.58)';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('LOT-735 // FRAGILE', 72, 92);

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 2.4),
      roughness: 0.82,
      metalness: 0.04
    });
  }

  _makeMilitaryCrate() {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');

    ctx.fillStyle = '#4c593e';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#888888';
    hctx.fillRect(0, 0, size, size);

    // Ribbed recessed panel
    ctx.fillStyle = '#3f4b33';
    ctx.fillRect(42, 42, size - 84, size - 84);
    hctx.fillStyle = '#555555';
    hctx.fillRect(42, 42, size - 84, size - 84);

    for (let x = 68; x < size - 68; x += 36) {
      ctx.fillStyle = '#556346';
      ctx.fillRect(x, 58, 18, size - 116);
      hctx.fillStyle = '#b8b8b8';
      hctx.fillRect(x, 58, 18, size - 116);
    }

    // Steel corner brackets
    ctx.fillStyle = '#2d3328';
    hctx.fillStyle = '#f2f2f2';
    const corners = [[0, 0], [size - 64, 0], [0, size - 64], [size - 64, size - 64]];
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx, cy, 64, 64);
      hctx.fillRect(cx, cy, 64, 64);
    }

    // Yellow ordnance stencil
    ctx.fillStyle = 'rgba(232, 192, 74, 0.82)';
    ctx.font = 'bold 32px monospace';
    ctx.fillText('ORD-7.62 NATO', 86, 255);
    ctx.fillRect(86, 270, 240, 8);

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 2.6),
      roughness: 0.62,
      metalness: 0.35
    });
  }

  _makeBlueContainer() {
    const size = 512;
    const c = document.createElement('canvas');
    const hc = document.createElement('canvas');
    c.width = hc.width = size;
    c.height = hc.height = size;
    const ctx = c.getContext('2d');
    const hctx = hc.getContext('2d');
    const rng = seededRand(2026);

    ctx.fillStyle = '#26588c';
    ctx.fillRect(0, 0, size, size);
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, size, size);

    // Corrugated steel vertical ribs
    for (let x = 0; x < size; x += 24) {
      ctx.fillStyle = '#316aa4';
      ctx.fillRect(x, 24, 12, size - 48);
      ctx.fillStyle = '#1b436c';
      ctx.fillRect(x + 12, 24, 12, size - 48);

      hctx.fillStyle = '#d8d8d8';
      hctx.fillRect(x, 24, 12, size - 48);
      hctx.fillStyle = '#444444';
      hctx.fillRect(x + 12, 24, 12, size - 48);
    }

    // Rust & desert dust streaks
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(130,72,38,0.18)' : 'rgba(218,192,148,0.15)';
      ctx.fillRect(rng() * size, rng() * size, 8 + rng() * 30, 6 + rng() * 24);
    }

    ctx.fillStyle = 'rgba(240,244,248,0.75)';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('MAGHREB TRANSIT 402', 48, 96);

    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      normalMap: heightCanvasToNormalTexture(hc, 2.8),
      roughness: 0.54,
      metalness: 0.58
    });
  }

  _makeAwningCloth() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    for (let x = 0; x < size; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? '#a83c2c' : '#e4d5b7';
      ctx.fillRect(x, 0, 32, size);
    }
    return new THREE.MeshStandardMaterial({
      map: finalizeColorTex(c),
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
  }

  // Create crisp wall graffiti / directional sign plane (e.g. '[ A ]', '[ B ]', 'GOOSE', '← A')
  createWallDecal(text, subtext = '', color = '#b92622', width = 2.0, height = 1.2) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    // Spray-paint halo
    const grad = ctx.createRadialGradient(256, 150, 15, 256, 150, 175);
    grad.addColorStop(0, 'rgba(185,38,34,0.22)');
    grad.addColorStop(1, 'rgba(185,38,34,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);

    // Circle or bracket ring for A / B sites
    if (text === 'A' || text === 'B') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(256, 155, 108, 0.15, Math.PI * 1.92);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = text.length <= 2 ? '900 150px Impact, Arial Black, sans-serif' : '900 92px Impact, Arial Black, sans-serif';
    ctx.fillText(text, 256, subtext ? 132 : 160);

    if (subtext) {
      ctx.font = 'bold 44px Arial, sans-serif';
      ctx.fillText(subtext, 256, 245);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    return mesh;
  }

  // Bombsite dashed red floor zone indicator
  createBombsiteFloorZone(w, d, letter) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');

    ctx.strokeStyle = 'rgba(205, 42, 36, 0.72)';
    ctx.lineWidth = 14;
    ctx.setLineDash([36, 22]);
    ctx.strokeRect(20, 20, 472, 472);

    // Hazard corner brackets
    ctx.setLineDash([]);
    ctx.lineWidth = 18;
    const b = 70;
    for (const [x, y, sx, sy] of [[16, 16, 1, 1], [496, 16, -1, 1], [16, 496, 1, -1], [496, 496, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * b);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * b, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(205, 42, 36, 0.52)';
    ctx.font = '900 220px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 256, 266);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }
}
