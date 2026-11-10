import * as THREE from 'three';

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  SAND: 3,
  STONE: 4,
  COBBLESTONE: 5,
  OAK_LOG: 6,
  OAK_PLANKS: 7,
  OAK_LEAVES: 8,
  PINE_LEAVES: 9,
  BIRCH_LOG: 10,
  SANDSTONE: 11,
  STONE_BRICKS: 12,
  GLASS: 13,
  GLOWSTONE: 14,
  TERRACOTTA: 15,
  BRICKS: 16,
  GRAVEL: 17,
  TALL_GRASS: 18,
  GOLD_FLOWER: 19,
  ROSE_FLOWER: 20,
  GOLD_LEAVES: 21
};

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  SAND: 3,
  STONE: 4,
  COBBLESTONE: 5,
  OAK_LOG_SIDE: 6,
  OAK_LOG_TOP: 7,
  OAK_PLANKS: 8,
  OAK_LEAVES: 9,
  PINE_LEAVES: 10,
  BIRCH_LOG_SIDE: 11,
  BIRCH_LOG_TOP: 12,
  SANDSTONE_SIDE: 13,
  SANDSTONE_TOP: 14,
  STONE_BRICKS: 15,
  GLASS: 16,
  GLOWSTONE: 17,
  TERRACOTTA: 18,
  BRICKS: 19,
  GRAVEL: 20,
  TALL_GRASS: 21,
  GOLD_FLOWER: 22,
  ROSE_FLOWER: 23,
  GOLD_LEAVES: 24
};

export const BLOCK_DEFS = {
  [BLOCK.AIR]: {
    id: BLOCK.AIR,
    name: 'Air',
    zhName: '空气',
    solid: false,
    opaque: false
  },
  [BLOCK.GRASS]: {
    id: BLOCK.GRASS,
    name: 'Grass Block',
    zhName: '草方块',
    solid: true,
    opaque: true,
    sound: 'grass',
    tiles: {
      top: TILE.GRASS_TOP,
      bottom: TILE.DIRT,
      side: TILE.GRASS_SIDE
    },
    particleColor: '#5d8f37'
  },
  [BLOCK.DIRT]: {
    id: BLOCK.DIRT,
    name: 'Dirt',
    zhName: '泥土',
    solid: true,
    opaque: true,
    sound: 'grass',
    tiles: { all: TILE.DIRT },
    particleColor: '#7a5638'
  },
  [BLOCK.SAND]: {
    id: BLOCK.SAND,
    name: 'Coast Sand',
    zhName: '海岸细沙',
    solid: true,
    opaque: true,
    sound: 'sand',
    tiles: { all: TILE.SAND },
    particleColor: '#dfc184'
  },
  [BLOCK.STONE]: {
    id: BLOCK.STONE,
    name: 'Stone',
    zhName: '岩石',
    solid: true,
    opaque: true,
    sound: 'stone',
    tiles: { all: TILE.STONE },
    particleColor: '#7e7d82'
  },
  [BLOCK.COBBLESTONE]: {
    id: BLOCK.COBBLESTONE,
    name: 'Cobblestone',
    zhName: '圆石',
    solid: true,
    opaque: true,
    sound: 'stone',
    tiles: { all: TILE.COBBLESTONE },
    particleColor: '#69686d'
  },
  [BLOCK.OAK_LOG]: {
    id: BLOCK.OAK_LOG,
    name: 'Oak Log',
    zhName: '橡木原木',
    solid: true,
    opaque: true,
    sound: 'wood',
    tiles: {
      top: TILE.OAK_LOG_TOP,
      bottom: TILE.OAK_LOG_TOP,
      side: TILE.OAK_LOG_SIDE
    },
    particleColor: '#61482c'
  },
  [BLOCK.OAK_PLANKS]: {
    id: BLOCK.OAK_PLANKS,
    name: 'Oak Planks',
    zhName: '橡木木板',
    solid: true,
    opaque: true,
    sound: 'wood',
    tiles: { all: TILE.OAK_PLANKS },
    particleColor: '#a67e49'
  },
  [BLOCK.OAK_LEAVES]: {
    id: BLOCK.OAK_LEAVES,
    name: 'Oak Leaves',
    zhName: '橡树枝叶',
    solid: true,
    opaque: true,
    foliage: true,
    sound: 'grass',
    tiles: { all: TILE.OAK_LEAVES },
    particleColor: '#4c7a2e'
  },
  [BLOCK.PINE_LEAVES]: {
    id: BLOCK.PINE_LEAVES,
    name: 'Coast Pine Leaves',
    zhName: '海岸松叶',
    solid: true,
    opaque: true,
    foliage: true,
    sound: 'grass',
    tiles: { all: TILE.PINE_LEAVES },
    particleColor: '#2d5c42'
  },
  [BLOCK.GOLD_LEAVES]: {
    id: BLOCK.GOLD_LEAVES,
    name: 'Sunset Maple Leaves',
    zhName: '晚霞金枫叶',
    solid: true,
    opaque: true,
    foliage: true,
    sound: 'grass',
    tiles: { all: TILE.GOLD_LEAVES },
    particleColor: '#d97b28'
  },
  [BLOCK.BIRCH_LOG]: {
    id: BLOCK.BIRCH_LOG,
    name: 'Birch Log',
    zhName: '白桦原木',
    solid: true,
    opaque: true,
    sound: 'wood',
    tiles: {
      top: TILE.BIRCH_LOG_TOP,
      bottom: TILE.BIRCH_LOG_TOP,
      side: TILE.BIRCH_LOG_SIDE
    },
    particleColor: '#d9d3c7'
  },
  [BLOCK.SANDSTONE]: {
    id: BLOCK.SANDSTONE,
    name: 'Sandstone',
    zhName: '海岸砂岩',
    solid: true,
    opaque: true,
    sound: 'stone',
    tiles: {
      top: TILE.SANDSTONE_TOP,
      bottom: TILE.SANDSTONE_TOP,
      side: TILE.SANDSTONE_SIDE
    },
    particleColor: '#d4b275'
  },
  [BLOCK.STONE_BRICKS]: {
    id: BLOCK.STONE_BRICKS,
    name: 'Stone Bricks',
    zhName: '石砖',
    solid: true,
    opaque: true,
    sound: 'stone',
    tiles: { all: TILE.STONE_BRICKS },
    particleColor: '#76757a'
  },
  [BLOCK.GLASS]: {
    id: BLOCK.GLASS,
    name: 'Clear Glass',
    zhName: '清透玻璃',
    solid: true,
    opaque: false,
    alphaTest: true,
    sound: 'stone',
    tiles: { all: TILE.GLASS },
    particleColor: '#bfe8f5'
  },
  [BLOCK.GLOWSTONE]: {
    id: BLOCK.GLOWSTONE,
    name: 'Sunset Lantern',
    zhName: '落日萤石灯',
    solid: true,
    opaque: true,
    emissive: 1.0,
    sound: 'stone',
    tiles: { all: TILE.GLOWSTONE },
    particleColor: '#ffb84d'
  },
  [BLOCK.TERRACOTTA]: {
    id: BLOCK.TERRACOTTA,
    name: 'Sunset Terracotta',
    zhName: '晚霞陶瓦',
    solid: true,
    opaque: true,
    sound: 'stone',
    tiles: { all: TILE.TERRACOTTA },
    particleColor: '#b85d43'
  },
  [BLOCK.BRICKS]: {
    id: BLOCK.BRICKS,
    name: 'Classic Bricks',
    zhName: '古典红砖',
    solid: true,
    opaque: true,
    sound: 'stone',
    tiles: { all: TILE.BRICKS },
    particleColor: '#9c4a3c'
  },
  [BLOCK.GRAVEL]: {
    id: BLOCK.GRAVEL,
    name: 'Coastal Gravel',
    zhName: '海岸砾石',
    solid: true,
    opaque: true,
    sound: 'sand',
    tiles: { all: TILE.GRAVEL },
    particleColor: '#827c7a'
  },
  [BLOCK.TALL_GRASS]: {
    id: BLOCK.TALL_GRASS,
    name: 'Coastal Grass',
    zhName: '海岸高草',
    solid: false,
    opaque: false,
    crossMesh: true,
    foliage: true,
    sound: 'grass',
    tiles: { all: TILE.TALL_GRASS },
    particleColor: '#6b9c3e'
  },
  [BLOCK.GOLD_FLOWER]: {
    id: BLOCK.GOLD_FLOWER,
    name: 'Sunbloom Flower',
    zhName: '落日金菊',
    solid: false,
    opaque: false,
    crossMesh: true,
    foliage: true,
    sound: 'grass',
    tiles: { all: TILE.GOLD_FLOWER },
    particleColor: '#ffaa2b'
  },
  [BLOCK.ROSE_FLOWER]: {
    id: BLOCK.ROSE_FLOWER,
    name: 'Twilight Blossom',
    zhName: '晚霞花簇',
    solid: false,
    opaque: false,
    crossMesh: true,
    foliage: true,
    sound: 'grass',
    tiles: { all: TILE.ROSE_FLOWER },
    particleColor: '#e06397'
  }
};

export const HOTBAR_DEFAULT_BLOCKS = [
  BLOCK.OAK_PLANKS,
  BLOCK.STONE_BRICKS,
  BLOCK.COBBLESTONE,
  BLOCK.OAK_LOG,
  BLOCK.GRASS,
  BLOCK.SAND,
  BLOCK.GOLD_LEAVES,
  BLOCK.GLASS,
  BLOCK.GLOWSTONE
];

export const INVENTORY_BLOCKS = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.SAND,
  BLOCK.SANDSTONE,
  BLOCK.STONE,
  BLOCK.COBBLESTONE,
  BLOCK.STONE_BRICKS,
  BLOCK.GRAVEL,
  BLOCK.OAK_LOG,
  BLOCK.OAK_PLANKS,
  BLOCK.BIRCH_LOG,
  BLOCK.OAK_LEAVES,
  BLOCK.PINE_LEAVES,
  BLOCK.GOLD_LEAVES,
  BLOCK.TERRACOTTA,
  BLOCK.BRICKS,
  BLOCK.GLASS,
  BLOCK.GLOWSTONE,
  BLOCK.GOLD_FLOWER,
  BLOCK.ROSE_FLOWER
];

function pixHash(x, y, seed) {
  let n = Math.imul(x + seed * 31, 374761393) + Math.imul(y + seed * 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function tintRGB(rgb, delta) {
  return [
    clampByte(rgb[0] + delta),
    clampByte(rgb[1] + delta),
    clampByte(rgb[2] + delta),
    rgb[3] !== undefined ? rgb[3] : 255
  ];
}

function generateTilePixels(tileId) {
  const pixels = new Array(16 * 16);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const h = pixHash(x, y, tileId + 101);
      const h2 = pixHash(x >> 1, y >> 1, tileId + 307);
      const n = (h - 0.5) * 18 + (h2 - 0.5) * 12;
      let rgba = [128, 128, 128, 255];

      switch (tileId) {
        case TILE.GRASS_TOP: {
          const base = [88, 138, 52];
          const blade = h > 0.76 ? 15 : (h < 0.20 ? -13 : 0);
          rgba = [
            clampByte(base[0] + n * 0.75 + blade),
            clampByte(base[1] + n * 0.85 + blade),
            clampByte(base[2] + n * 0.50 + blade * 0.4),
            255
          ];
          break;
        }
        case TILE.DIRT: {
          const base = [118, 82, 54];
          const pebble = h > 0.85 ? 18 : (h < 0.14 ? -16 : 0);
          rgba = tintRGB(base, n * 0.8 + pebble);
          break;
        }
        case TILE.GRASS_SIDE: {
          const fringeDepth = 2 + Math.floor(pixHash(x, 0, 77) * 3.6);
          if (y < fringeDepth) {
            const base = [88, 138, 52];
            const shadow = y === fringeDepth - 1 ? -10 : 0;
            rgba = tintRGB(base, n * 0.7 + shadow);
          } else {
            const base = [118, 82, 54];
            const underShadow = y === fringeDepth ? -18 : 0;
            const pebble = h > 0.86 ? 16 : 0;
            rgba = tintRGB(base, n * 0.8 + underShadow + pebble);
          }
          break;
        }
        case TILE.SAND: {
          const ripple = Math.sin((x + y * 1.5) * 0.65) * 7;
          const base = [224, 192, 132];
          rgba = tintRGB(base, n * 0.55 + ripple);
          break;
        }
        case TILE.STONE: {
          const strata = Math.sin(y * 0.9 + pixHash(x >> 1, y, 19) * 2.0) * 9;
          const crack = (h < 0.08) ? -22 : 0;
          const base = [122, 121, 128];
          rgba = tintRGB(base, n * 0.75 + strata + crack);
          break;
        }
        case TILE.COBBLESTONE: {
          const cx = (x + (y % 4 > 1 ? 2 : 0)) % 5;
          const cy = y % 5;
          const isMortar = cx === 0 || cy === 0;
          const base = isMortar ? [72, 71, 78] : [118, 117, 124];
          const highlight = (!isMortar && (cx === 1 || cy === 1)) ? 16 : 0;
          rgba = tintRGB(base, n * 0.8 + highlight);
          break;
        }
        case TILE.OAK_LOG_SIDE: {
          const streak = Math.sin(x * 1.4 + pixHash(x, y >> 2, 55) * 1.5) * 13;
          const base = [92, 66, 40];
          rgba = tintRGB(base, streak + n * 0.5);
          break;
        }
        case TILE.OAK_LOG_TOP: {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 6.6) {
            rgba = tintRGB([92, 66, 40], n * 0.6);
          } else {
            const ring = Math.sin(dist * 2.4) * 10;
            rgba = tintRGB([168, 132, 82], ring + n * 0.4);
          }
          break;
        }
        case TILE.OAK_PLANKS: {
          const plankRow = y % 4;
          const isSeam = plankRow === 0 || (x === ((y >> 2) * 7 + 3) % 16);
          const grain = Math.sin(x * 0.8 + (y >> 2) * 3.1) * 6;
          const base = isSeam ? [122, 88, 50] : [172, 130, 76];
          rgba = tintRGB(base, grain + n * 0.45);
          break;
        }
        case TILE.OAK_LEAVES: {
          const cluster = pixHash(x >> 1, y >> 1, 901);
          const leafDetail = h > 0.70 ? 20 : (h < 0.24 ? -24 : 0);
          const warmTint = cluster > 0.65 ? [86, 134, 44] : [64, 112, 38];
          rgba = tintRGB(warmTint, leafDetail + n * 0.55);
          break;
        }
        case TILE.PINE_LEAVES: {
          const needle = h > 0.68 ? 18 : (h < 0.26 ? -20 : 0);
          const base = [42, 88, 62];
          rgba = tintRGB(base, needle + n * 0.55);
          break;
        }
        case TILE.GOLD_LEAVES: {
          // Golden-amber & fiery sunset maple foliage
          const cluster = pixHash(x >> 1, y >> 1, 613);
          const detail = h > 0.68 ? 22 : (h < 0.24 ? -24 : 0);
          const base = cluster > 0.55 ? [216, 132, 38] : [192, 92, 32];
          rgba = tintRGB(base, detail + n * 0.55);
          break;
        }
        case TILE.BIRCH_LOG_SIDE: {
          const isKnot = (pixHash(x >> 2, y >> 1, 412) > 0.82) && (y % 3 === 0);
          const base = isKnot ? [62, 58, 54] : [224, 218, 206];
          rgba = tintRGB(base, n * 0.45);
          break;
        }
        case TILE.BIRCH_LOG_TOP: {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 6.6) {
            rgba = tintRGB([220, 214, 202], n * 0.4);
          } else {
            const ring = Math.sin(dist * 2.3) * 8;
            rgba = tintRGB([196, 172, 128], ring + n * 0.4);
          }
          break;
        }
        case TILE.SANDSTONE_SIDE: {
          const band = y < 3 ? 12 : (y === 3 || y === 11 ? -14 : 0);
          const base = [216, 184, 122];
          rgba = tintRGB(base, band + n * 0.45);
          break;
        }
        case TILE.SANDSTONE_TOP: {
          const base = [224, 194, 134];
          rgba = tintRGB(base, n * 0.5);
          break;
        }
        case TILE.STONE_BRICKS: {
          const row = y >> 2;
          const isHSeam = (y % 4) === 0;
          const isVSeam = ((x + (row % 2) * 4) % 8) === 0;
          if (isHSeam || isVSeam) {
            rgba = tintRGB([72, 71, 78], n * 0.4);
          } else {
            const bevel = (y % 4 === 1) ? 12 : ((y % 4 === 3) ? -10 : 0);
            rgba = tintRGB([128, 127, 136], bevel + n * 0.55);
          }
          break;
        }
        case TILE.GLASS: {
          const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
          const isGlint = (x + y === 5 || x + y === 6) && x > 1 && y > 1 && x < 7 && y < 7;
          if (isBorder) {
            rgba = [210, 238, 248, 240];
          } else if (isGlint) {
            rgba = [245, 252, 255, 210];
          } else {
            rgba = [180, 220, 240, 0];
          }
          break;
        }
        case TILE.GLOWSTONE: {
          const isFrame = x === 0 || x === 15 || y === 0 || y === 15 ||
                          ((x === 3 || x === 12) && (y < 3 || y > 12));
          if (isFrame) {
            rgba = tintRGB([104, 68, 38], n * 0.4);
          } else {
            const dx = Math.abs(x - 7.5);
            const dy = Math.abs(y - 7.5);
            const core = Math.max(0, 1.0 - (dx + dy) / 10.0);
            rgba = [
              255,
              clampByte(175 + core * 75 + n * 0.4),
              clampByte(75 + core * 130 + n * 0.4),
              255
            ];
          }
          break;
        }
        case TILE.TERRACOTTA: {
          const wave = Math.sin(y * 0.7 + x * 0.25) * 8;
          rgba = tintRGB([188, 96, 68], wave + n * 0.5);
          break;
        }
        case TILE.BRICKS: {
          const row = y >> 2;
          const mortar = (y % 4 === 0) || (((x + (row % 2) * 4) % 8) === 0);
          if (mortar) {
            rgba = tintRGB([186, 176, 164], n * 0.35);
          } else {
            const brickTone = pixHash(x >> 3, row, 88) * 18 - 9;
            rgba = tintRGB([162, 76, 62], brickTone + n * 0.5);
          }
          break;
        }
        case TILE.GRAVEL: {
          const pebble = h > 0.72 ? 20 : (h < 0.28 ? -18 : 0);
          rgba = tintRGB([132, 126, 124], pebble + n * 0.6);
          break;
        }
        case TILE.TALL_GRASS: {
          const sway = Math.floor(Math.sin((15 - y) * 0.25 + x) * 1.2);
          const dist = Math.abs((x + sway) % 3 - 1);
          const heightLimit = 2 + Math.floor(pixHash(x, 0, 512) * 6);
          if (y >= heightLimit && (dist === 0 || (y > 10 && dist <= 1))) {
            const tipWarmth = (15 - y) * 2.4;
            rgba = [
              clampByte(92 + tipWarmth * 1.4 + n * 0.4),
              clampByte(142 + tipWarmth * 0.7 + n * 0.4),
              clampByte(50 + n * 0.3),
              255
            ];
          } else {
            rgba = [0, 0, 0, 0];
          }
          break;
        }
        case TILE.GOLD_FLOWER: {
          const dx = x - 7.5;
          const dy = y - 5.5;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < 1.6) {
            rgba = [235, 95, 25, 255];
          } else if (r < 3.6 && ((x + y) % 2 === 0 || r < 2.8)) {
            rgba = [255, 196, 48, 255];
          } else if (y >= 8 && Math.abs(x - 8 + Math.round(Math.sin(y * 0.5))) <= 0.8) {
            rgba = [76, 130, 44, 255];
          } else if (y >= 11 && Math.abs(x - 8) <= 2 && (y + x) % 2 === 0) {
            rgba = [86, 140, 48, 255];
          } else {
            rgba = [0, 0, 0, 0];
          }
          break;
        }
        case TILE.ROSE_FLOWER: {
          const dx = x - 7.5;
          const dy = y - 5.5;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < 1.5) {
            rgba = [255, 215, 90, 255];
          } else if (r < 3.8 && r >= 1.5 && (pixHash(x, y, 99) > 0.2)) {
            rgba = tintRGB([228, 96, 152], n * 0.6);
          } else if (y >= 8 && Math.abs(x - 8) <= 0.8) {
            rgba = [70, 124, 44, 255];
          } else if (y >= 11 && Math.abs(x - 8) <= 2 && (y + x) % 2 === 0) {
            rgba = [82, 134, 48, 255];
          } else {
            rgba = [0, 0, 0, 0];
          }
          break;
        }
      }

      pixels[y * 16 + x] = rgba;
    }
  }

  return pixels;
}

export const ATLAS_GRID = 8;
export const TILE_PIXELS = 16;
export const TILE_PADDING = 8;
export const SLOT_PIXELS = TILE_PIXELS + TILE_PADDING * 2;
export const ATLAS_SIZE = ATLAS_GRID * SLOT_PIXELS;

const tilePixelsCache = new Map();

export function getTilePixels(tileId) {
  if (!tilePixelsCache.has(tileId)) {
    tilePixelsCache.set(tileId, generateTilePixels(tileId));
  }
  return tilePixelsCache.get(tileId);
}

export function createBlockTextureAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const data = imgData.data;

  const tileValues = Object.values(TILE);
  for (const tileId of tileValues) {
    const pixels = getTilePixels(tileId);
    const col = tileId % ATLAS_GRID;
    const row = Math.floor(tileId / ATLAS_GRID);
    const slotX = col * SLOT_PIXELS;
    const slotY = row * SLOT_PIXELS;

    for (let sy = 0; sy < SLOT_PIXELS; sy++) {
      const py = Math.max(0, Math.min(15, sy - TILE_PADDING));
      for (let sx = 0; sx < SLOT_PIXELS; sx++) {
        const px = Math.max(0, Math.min(15, sx - TILE_PADDING));
        const rgba = pixels[py * 16 + px];
        const idx = ((slotY + sy) * ATLAS_SIZE + (slotX + sx)) * 4;
        data[idx] = rgba[0];
        data[idx + 1] = rgba[1];
        data[idx + 2] = rgba[2];
        data[idx + 3] = rgba[3];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

export function getTileUVs(tileId) {
  const col = tileId % ATLAS_GRID;
  const row = Math.floor(tileId / ATLAS_GRID);

  const x0 = col * SLOT_PIXELS + TILE_PADDING + 0.08;
  const x1 = col * SLOT_PIXELS + TILE_PADDING + TILE_PIXELS - 0.08;
  const yTop = row * SLOT_PIXELS + TILE_PADDING + 0.08;
  const yBottom = row * SLOT_PIXELS + TILE_PADDING + TILE_PIXELS - 0.08;

  const u0 = x0 / ATLAS_SIZE;
  const u1 = x1 / ATLAS_SIZE;
  const v1 = 1.0 - yTop / ATLAS_SIZE;
  const v0 = 1.0 - yBottom / ATLAS_SIZE;

  return [u0, v0, u1, v1];
}

const iconCache = new Map();

export function getBlockIconDataURL(blockId) {
  if (iconCache.has(blockId)) return iconCache.get(blockId);

  const def = BLOCK_DEFS[blockId];
  if (!def || blockId === BLOCK.AIR) return '';

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const makeFaceCanvas = (tileId, brightness = 1.0) => {
    const fc = document.createElement('canvas');
    fc.width = 16;
    fc.height = 16;
    const fctx = fc.getContext('2d');
    const id = fctx.createImageData(16, 16);
    const px = getTilePixels(tileId);
    for (let i = 0; i < 256; i++) {
      id.data[i * 4] = clampByte(px[i][0] * brightness);
      id.data[i * 4 + 1] = clampByte(px[i][1] * brightness);
      id.data[i * 4 + 2] = clampByte(px[i][2] * brightness);
      id.data[i * 4 + 3] = px[i][3];
    }
    fctx.putImageData(id, 0, 0);
    return fc;
  };

  if (def.crossMesh) {
    const face = makeFaceCanvas(def.tiles.all, 1.05);
    ctx.drawImage(face, 10, 8, 44, 44);
  } else {
    const topTile = def.tiles.top !== undefined ? def.tiles.top : def.tiles.all;
    const sideTile = def.tiles.side !== undefined ? def.tiles.side : def.tiles.all;

    const topCanvas = makeFaceCanvas(topTile, 1.08);
    const leftCanvas = makeFaceCanvas(sideTile, 0.88);
    const rightCanvas = makeFaceCanvas(sideTile, 0.68);

    ctx.save();
    ctx.translate(32, 10);
    ctx.transform(1.45, 0.72, -1.45, 0.72, 0, 0);
    ctx.drawImage(topCanvas, 0, 0, 16, 16);
    ctx.restore();

    ctx.save();
    ctx.translate(8.8, 21.5);
    ctx.transform(1.45, 0.72, 0, 1.55, 0, 0);
    ctx.drawImage(leftCanvas, 0, 0, 16, 16);
    ctx.restore();

    ctx.save();
    ctx.translate(32, 33.0);
    ctx.transform(1.45, -0.72, 0, 1.55, 0, 0);
    ctx.drawImage(rightCanvas, 0, 0, 16, 16);
    ctx.restore();
  }

  const url = canvas.toDataURL();
  iconCache.set(blockId, url);
  return url;
}
