import * as THREE from 'three';

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  SAND: 3,
  SANDSTONE: 4,
  STONE: 5,
  COBBLESTONE: 6,
  OAK_LOG: 7,
  BIRCH_LOG: 8,
  SPRUCE_LOG: 9,
  OAK_PLANKS: 10,
  BRICKS: 11,
  GLASS: 12,
  OAK_LEAVES: 13,
  GOLDEN_LEAVES: 14,
  SPRUCE_LEAVES: 15,
  GLOWSTONE: 16,
  SEA_LANTERN: 17,
  TALL_GRASS: 18,
  SUNSET_FLOWER: 19,
  WATER: 20,
  MOSSY_COBBLE: 21,
};

// Tile indices inside an 8x4 padded atlas
const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  SAND: 3,
  SANDSTONE_SIDE: 4,
  SANDSTONE_TOP: 5,
  STONE: 6,
  COBBLESTONE: 7,
  OAK_LOG_SIDE: 8,
  OAK_LOG_TOP: 9,
  BIRCH_LOG_SIDE: 10,
  BIRCH_LOG_TOP: 11,
  SPRUCE_LOG_SIDE: 12,
  SPRUCE_LOG_TOP: 13,
  OAK_PLANKS: 14,
  BRICKS: 15,
  GLASS: 16,
  OAK_LEAVES: 17,
  GOLDEN_LEAVES: 18,
  SPRUCE_LEAVES: 19,
  GLOWSTONE: 20,
  SEA_LANTERN: 21,
  TALL_GRASS: 22,
  SUNSET_FLOWER: 23,
  MOSSY_COBBLE: 24,
};

export const BLOCK_DEFS = {
  [BLOCK.AIR]: { id: 0, name: '空气', solid: false, opaque: false },
  [BLOCK.GRASS]: {
    id: BLOCK.GRASS, name: '草方块', solid: true, opaque: true, sound: 'grass',
    tiles: { top: TILE.GRASS_TOP, bottom: TILE.DIRT, side: TILE.GRASS_SIDE },
    particleColor: '#5ea039',
  },
  [BLOCK.DIRT]: {
    id: BLOCK.DIRT, name: '泥土', solid: true, opaque: true, sound: 'grass',
    tiles: { all: TILE.DIRT },
    particleColor: '#7b5538',
  },
  [BLOCK.SAND]: {
    id: BLOCK.SAND, name: '海岸金沙', solid: true, opaque: true, sound: 'sand',
    tiles: { all: TILE.SAND },
    particleColor: '#dfc184',
  },
  [BLOCK.SANDSTONE]: {
    id: BLOCK.SANDSTONE, name: '平滑沙石', solid: true, opaque: true, sound: 'stone',
    tiles: { top: TILE.SANDSTONE_TOP, bottom: TILE.SANDSTONE_TOP, side: TILE.SANDSTONE_SIDE },
    particleColor: '#d7b87c',
  },
  [BLOCK.STONE]: {
    id: BLOCK.STONE, name: '岩石', solid: true, opaque: true, sound: 'stone',
    tiles: { all: TILE.STONE },
    particleColor: '#82848a',
  },
  [BLOCK.COBBLESTONE]: {
    id: BLOCK.COBBLESTONE, name: '圆石', solid: true, opaque: true, sound: 'stone',
    tiles: { all: TILE.COBBLESTONE },
    particleColor: '#73747a',
  },
  [BLOCK.MOSSY_COBBLE]: {
    id: BLOCK.MOSSY_COBBLE, name: '苔石', solid: true, opaque: true, sound: 'stone',
    tiles: { all: TILE.MOSSY_COBBLE },
    particleColor: '#5c7c4c',
  },
  [BLOCK.OAK_LOG]: {
    id: BLOCK.OAK_LOG, name: '橡木原木', solid: true, opaque: true, sound: 'wood',
    tiles: { top: TILE.OAK_LOG_TOP, bottom: TILE.OAK_LOG_TOP, side: TILE.OAK_LOG_SIDE },
    particleColor: '#6b5033',
  },
  [BLOCK.BIRCH_LOG]: {
    id: BLOCK.BIRCH_LOG, name: '白桦原木', solid: true, opaque: true, sound: 'wood',
    tiles: { top: TILE.BIRCH_LOG_TOP, bottom: TILE.BIRCH_LOG_TOP, side: TILE.BIRCH_LOG_SIDE },
    particleColor: '#dcd7cc',
  },
  [BLOCK.SPRUCE_LOG]: {
    id: BLOCK.SPRUCE_LOG, name: '云杉原木', solid: true, opaque: true, sound: 'wood',
    tiles: { top: TILE.SPRUCE_LOG_TOP, bottom: TILE.SPRUCE_LOG_TOP, side: TILE.SPRUCE_LOG_SIDE },
    particleColor: '#473321',
  },
  [BLOCK.OAK_PLANKS]: {
    id: BLOCK.OAK_PLANKS, name: '橡木木板', solid: true, opaque: true, sound: 'wood',
    tiles: { all: TILE.OAK_PLANKS },
    particleColor: '#af8855',
  },
  [BLOCK.BRICKS]: {
    id: BLOCK.BRICKS, name: '红砖块', solid: true, opaque: true, sound: 'stone',
    tiles: { all: TILE.BRICKS },
    particleColor: '#a45343',
  },
  [BLOCK.GLASS]: {
    id: BLOCK.GLASS, name: '通透玻璃', solid: true, opaque: false, cutout: true, sound: 'glass',
    tiles: { all: TILE.GLASS },
    sss: 0.25,
    particleColor: '#cdeef8',
  },
  [BLOCK.OAK_LEAVES]: {
    id: BLOCK.OAK_LEAVES, name: '橡木树叶', solid: true, opaque: false, cutout: true, foliage: true, sound: 'grass',
    tiles: { all: TILE.OAK_LEAVES },
    wind: 0.72, sss: 0.88,
    particleColor: '#488c32',
  },
  [BLOCK.GOLDEN_LEAVES]: {
    id: BLOCK.GOLDEN_LEAVES, name: '金桦树叶', solid: true, opaque: false, cutout: true, foliage: true, sound: 'grass',
    tiles: { all: TILE.GOLDEN_LEAVES },
    wind: 0.82, sss: 1.0,
    particleColor: '#e0932b',
  },
  [BLOCK.SPRUCE_LEAVES]: {
    id: BLOCK.SPRUCE_LEAVES, name: '云杉针叶', solid: true, opaque: false, cutout: true, foliage: true, sound: 'grass',
    tiles: { all: TILE.SPRUCE_LEAVES },
    wind: 0.45, sss: 0.65,
    particleColor: '#2f5f3b',
  },
  [BLOCK.GLOWSTONE]: {
    id: BLOCK.GLOWSTONE, name: '落日荧石灯', solid: true, opaque: true, emissive: 1.0, light: 15, sound: 'glass',
    tiles: { all: TILE.GLOWSTONE },
    particleColor: '#ffbe4f',
  },
  [BLOCK.SEA_LANTERN]: {
    id: BLOCK.SEA_LANTERN, name: '海晶灯', solid: true, opaque: true, emissive: 0.9, light: 15, sound: 'glass',
    tiles: { all: TILE.SEA_LANTERN },
    particleColor: '#9cf2ea',
  },
  [BLOCK.TALL_GRASS]: {
    id: BLOCK.TALL_GRASS, name: '海岸高草', solid: false, opaque: false, crossQuad: true, replaceable: true, sound: 'grass',
    tiles: { all: TILE.TALL_GRASS },
    wind: 1.0, sss: 0.95,
    particleColor: '#66a53d',
  },
  [BLOCK.SUNSET_FLOWER]: {
    id: BLOCK.SUNSET_FLOWER, name: '晚霞野花', solid: false, opaque: false, crossQuad: true, replaceable: true, sound: 'grass',
    tiles: { all: TILE.SUNSET_FLOWER },
    wind: 0.95, sss: 1.0,
    particleColor: '#ff7847',
  },
  [BLOCK.WATER]: {
    id: BLOCK.WATER, name: '海水', solid: false, opaque: false, liquid: true, replaceable: true,
  },
};

export const PLACEABLE_BLOCKS = [
  BLOCK.GRASS,
  BLOCK.COBBLESTONE,
  BLOCK.OAK_PLANKS,
  BLOCK.OAK_LOG,
  BLOCK.SANDSTONE,
  BLOCK.GLASS,
  BLOCK.GLOWSTONE,
  BLOCK.GOLDEN_LEAVES,
  BLOCK.SUNSET_FLOWER,
  BLOCK.BRICKS,
  BLOCK.STONE,
  BLOCK.MOSSY_COBBLE,
  BLOCK.BIRCH_LOG,
  BLOCK.SPRUCE_LOG,
  BLOCK.OAK_LEAVES,
  BLOCK.SPRUCE_LEAVES,
  BLOCK.SAND,
  BLOCK.DIRT,
  BLOCK.SEA_LANTERN,
  BLOCK.TALL_GRASS,
];

export const DEFAULT_HOTBAR = [
  BLOCK.GRASS,
  BLOCK.OAK_PLANKS,
  BLOCK.COBBLESTONE,
  BLOCK.OAK_LOG,
  BLOCK.SANDSTONE,
  BLOCK.GLASS,
  BLOCK.GLOWSTONE,
  BLOCK.GOLDEN_LEAVES,
  BLOCK.SUNSET_FLOWER,
];

// Atlas layout: 8 cols x 4 rows of 32x32 padded cells (inner 16x16 + 8px extruded border)
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
const CELL_SIZE = 32;
const INNER_SIZE = 16;
const PAD = 8;

function hashPix(x, y, seed) {
  let h = Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function draw16x16Tile(tileId) {
  const c = document.createElement('canvas');
  c.width = INNER_SIZE;
  c.height = INNER_SIZE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(INNER_SIZE, INNER_SIZE);
  const d = img.data;

  const setPx = (x, y, r, g, b, a = 255) => {
    const idx = (y * INNER_SIZE + x) * 4;
    d[idx] = clampByte(r);
    d[idx + 1] = clampByte(g);
    d[idx + 2] = clampByte(b);
    d[idx + 3] = clampByte(a);
  };

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = hashPix(x, y, tileId * 97 + 13);
      const n2 = hashPix(x >> 1, y >> 1, tileId * 53 + 7);
      const v = (n - 0.5) * 22 + (n2 - 0.5) * 14;

      switch (tileId) {
        case TILE.GRASS_TOP: {
          const lush = Math.sin(x * 0.6 + y * 0.5) * 6;
          setPx(x, y, 88 + v * 0.7 + lush, 152 + v * 0.9 + lush, 52 + v * 0.55);
          break;
        }
        case TILE.DIRT: {
          const pebble = n > 0.88 ? 18 : (n < 0.08 ? -16 : 0);
          setPx(x, y, 124 + v * 0.7 + pebble, 87 + v * 0.55 + pebble * 0.7, 57 + v * 0.45 + pebble * 0.5);
          break;
        }
        case TILE.GRASS_SIDE: {
          const skirt = 3 + Math.floor(hashPix(x, 0, 777) * 3.6);
          if (y < skirt) {
            setPx(x, y, 88 + v * 0.7, 150 + v * 0.9, 51 + v * 0.5);
          } else if (y === skirt) {
            setPx(x, y, 72 + v * 0.5, 122 + v * 0.6, 42 + v * 0.4);
          } else {
            const pebble = n > 0.88 ? 16 : 0;
            setPx(x, y, 122 + v * 0.7 + pebble, 85 + v * 0.55 + pebble * 0.7, 55 + v * 0.45);
          }
          break;
        }
        case TILE.SAND: {
          const wave = Math.sin(y * 0.85 + Math.sin(x * 0.45) * 1.6) * 7;
          setPx(x, y, 226 + v * 0.45 + wave, 196 + v * 0.45 + wave * 0.85, 138 + v * 0.4 + wave * 0.6);
          break;
        }
        case TILE.SANDSTONE_SIDE: {
          const band = y < 3 ? 12 : (y === 3 || y === 11 ? -16 : (y > 11 ? -6 : 4));
          setPx(x, y, 218 + band + v * 0.35, 187 + band + v * 0.35, 126 + band * 0.8 + v * 0.3);
          break;
        }
        case TILE.SANDSTONE_TOP: {
          const border = (x === 0 || y === 0 || x === 15 || y === 15) ? -10 : 5;
          setPx(x, y, 224 + border + v * 0.35, 195 + border + v * 0.35, 136 + border * 0.8 + v * 0.3);
          break;
        }
        case TILE.STONE: {
          const strata = Math.sin(y * 1.1 + n2 * 2.5) * 9;
          const base = 128 + strata + v * 0.65;
          setPx(x, y, base + 2, base, base + 4);
          break;
        }
        case TILE.COBBLESTONE:
        case TILE.MOSSY_COBBLE: {
          const cellX = Math.floor((x + (y % 4 >= 2 ? 2 : 0)) / 4);
          const cellY = Math.floor(y / 4);
          const edge = ((x + (y % 4 >= 2 ? 2 : 0)) % 4 === 0) || (y % 4 === 0);
          const stoneShade = hashPix(cellX, cellY, 303) * 34 - 14;
          if (edge) {
            if (tileId === TILE.MOSSY_COBBLE && n > 0.32) {
              setPx(x, y, 68 + v * 0.5, 114 + v * 0.7, 50 + v * 0.4);
            } else {
              setPx(x, y, 76 + v * 0.4, 77 + v * 0.4, 82 + v * 0.4);
            }
          } else {
            const b = 124 + stoneShade + v * 0.45;
            if (tileId === TILE.MOSSY_COBBLE && n2 > 0.66) {
              setPx(x, y, 82 + v * 0.5, 128 + v * 0.6, 58 + v * 0.4);
            } else {
              setPx(x, y, b, b + 1, b + 4);
            }
          }
          break;
        }
        case TILE.OAK_LOG_SIDE: {
          const groove = Math.sin(x * 1.65 + n2 * 1.2) * 14;
          setPx(x, y, 104 + groove + v * 0.45, 78 + groove * 0.75 + v * 0.35, 49 + groove * 0.55 + v * 0.25);
          break;
        }
        case TILE.OAK_LOG_TOP:
        case TILE.BIRCH_LOG_TOP:
        case TILE.SPRUCE_LOG_TOP: {
          const dx = x - 7.5, dy = y - 7.5;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > 6.4) {
            if (tileId === TILE.BIRCH_LOG_TOP) setPx(x, y, 214 + v * 0.3, 209 + v * 0.3, 198 + v * 0.3);
            else if (tileId === TILE.SPRUCE_LOG_TOP) setPx(x, y, 68 + v * 0.3, 48 + v * 0.3, 31 + v * 0.25);
            else setPx(x, y, 98 + v * 0.35, 73 + v * 0.3, 46 + v * 0.25);
          } else {
            const ring = Math.sin(dist * 2.4) * 14;
            setPx(x, y, 174 + ring + v * 0.3, 138 + ring * 0.8 + v * 0.25, 88 + ring * 0.6 + v * 0.2);
          }
          break;
        }
        case TILE.BIRCH_LOG_SIDE: {
          const knot = (y % 5 === 2 && hashPix(x >> 1, y, 91) > 0.74) || (x === 3 && y === 11);
          if (knot) {
            setPx(x, y, 62 + v * 0.4, 58 + v * 0.4, 54 + v * 0.4);
          } else {
            setPx(x, y, 226 + v * 0.35, 221 + v * 0.35, 210 + v * 0.35);
          }
          break;
        }
        case TILE.SPRUCE_LOG_SIDE: {
          const groove = Math.sin(x * 1.7 + n2) * 10;
          setPx(x, y, 72 + groove + v * 0.35, 50 + groove * 0.7 + v * 0.3, 33 + groove * 0.5 + v * 0.25);
          break;
        }
        case TILE.OAK_PLANKS: {
          const row = y >> 2;
          const seamY = (y % 4 === 0);
          const seamX = (x === ((row * 7 + 3) % 16));
          if (seamY || seamX) {
            setPx(x, y, 128 + v * 0.3, 95 + v * 0.25, 56 + v * 0.2);
          } else {
            const plankTone = (row % 2 === 0 ? 6 : -5) + (hashPix(row, 1, 55) - 0.5) * 10;
            setPx(x, y, 182 + plankTone + v * 0.4, 142 + plankTone * 0.8 + v * 0.35, 89 + plankTone * 0.6 + v * 0.25);
          }
          break;
        }
        case TILE.BRICKS: {
          const row = y >> 2;
          const mortarY = (y % 4 === 0);
          const mortarX = ((x + (row % 2) * 4) % 8 === 0);
          if (mortarY || mortarX) {
            setPx(x, y, 188 + v * 0.3, 179 + v * 0.3, 166 + v * 0.3);
          } else {
            const brickTone = (hashPix((x + (row % 2) * 4) >> 3, row, 19) - 0.5) * 22;
            setPx(x, y, 168 + brickTone + v * 0.4, 84 + brickTone * 0.5 + v * 0.3, 67 + brickTone * 0.4 + v * 0.3);
          }
          break;
        }
        case TILE.GLASS: {
          const border = (x === 0 || y === 0 || x === 15 || y === 15);
          const streak = (x + y === 5 || x + y === 6 || x + y === 21) && x > 1 && x < 14 && y > 1 && y < 14;
          if (border) {
            setPx(x, y, 210, 236, 245, 255);
          } else if (streak) {
            setPx(x, y, 238, 250, 255, 220);
          } else {
            setPx(x, y, 0, 0, 0, 0);
          }
          break;
        }
        case TILE.OAK_LEAVES: {
          const hole = n < 0.19 && !(x % 3 === 1 && y % 3 === 1);
          if (hole) {
            setPx(x, y, 0, 0, 0, 0);
          } else {
            const cluster = n2 > 0.5 ? 14 : -10;
            setPx(x, y, 66 + cluster * 0.8 + v * 0.6, 134 + cluster + v * 0.8, 46 + cluster * 0.5 + v * 0.5, 255);
          }
          break;
        }
        case TILE.GOLDEN_LEAVES: {
          const hole = n < 0.2 && !(x % 3 === 1 && y % 3 === 1);
          if (hole) {
            setPx(x, y, 0, 0, 0, 0);
          } else {
            const cluster = n2 > 0.48 ? 18 : -12;
            setPx(x, y, 226 + cluster * 0.7 + v * 0.5, 146 + cluster + v * 0.75, 38 + cluster * 0.35 + v * 0.4, 255);
          }
          break;
        }
        case TILE.SPRUCE_LEAVES: {
          const hole = n < 0.17 && ((x + y) % 2 === 0);
          if (hole) {
            setPx(x, y, 0, 0, 0, 0);
          } else {
            const cluster = n2 > 0.5 ? 10 : -8;
            setPx(x, y, 44 + cluster * 0.6 + v * 0.45, 92 + cluster + v * 0.6, 56 + cluster * 0.7 + v * 0.45, 255);
          }
          break;
        }
        case TILE.GLOWSTONE: {
          const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
          const frame = (x === 0 || y === 0 || x === 15 || y === 15 || (dx > 5.5 && dy > 5.5));
          if (frame) {
            setPx(x, y, 126 + v * 0.3, 78 + v * 0.3, 36 + v * 0.25);
          } else {
            const core = Math.max(0, 1.0 - Math.hypot(x - 7.5, y - 7.5) / 8.5);
            setPx(x, y, 255, 188 + core * 62 + v * 0.3, 76 + core * 115 + v * 0.35);
          }
          break;
        }
        case TILE.SEA_LANTERN: {
          const border = (x === 0 || y === 0 || x === 15 || y === 15);
          if (border) {
            setPx(x, y, 92 + v * 0.3, 148 + v * 0.3, 146 + v * 0.3);
          } else {
            const core = Math.max(0, 1.0 - Math.hypot(x - 7.5, y - 7.5) / 8.5);
            setPx(x, y, 168 + core * 78, 240 + core * 15, 232 + core * 22);
          }
          break;
        }
        case TILE.TALL_GRASS: {
          // 16x16 blade silhouettes growing up from y=15
          const bladeCenter = 2 + ((x * 5) % 12);
          const sway = Math.floor(Math.sin((15 - y) * 0.22 + x) * 1.1);
          const bladeH = 4 + Math.floor(hashPix(x, 0, 412) * 9);
          const isBlade = y >= bladeH && (hashPix(x + sway, 0, 88) > 0.38) && x >= 1 && x <= 14;
          if (!isBlade) {
            setPx(x, y, 0, 0, 0, 0);
          } else {
            const tipGold = Math.max(0, (12 - y) / 10);
            setPx(
              x, y,
              86 + tipGold * 75 + v * 0.5,
              148 + tipGold * 28 + v * 0.6,
              48 + tipGold * 10 + v * 0.4,
              255
            );
          }
          break;
        }
        case TILE.SUNSET_FLOWER: {
          // Stems + warm coral/gold blossoms
          const stems = [4, 8, 12];
          let drawn = false;
          for (let s = 0; s < stems.length; s++) {
            const sx = stems[s];
            const fy = s === 1 ? 4 : (s === 0 ? 7 : 6);
            const distBlossom = Math.hypot(x - sx, y - fy);
            if (distBlossom <= 2.3) {
              if (distBlossom < 0.9) {
                setPx(x, y, 255, 224, 92, 255);
              } else {
                const coral = s === 1 ? [255, 116, 62] : [255, 158, 68];
                setPx(x, y, coral[0] + v * 0.3, coral[1] + v * 0.3, coral[2] + v * 0.3, 255);
              }
              drawn = true;
              break;
            }
            if (y > fy + 1 && Math.abs(x - sx) <= (y > 12 ? 1 : 0)) {
              setPx(x, y, 68 + v * 0.4, 134 + v * 0.5, 44 + v * 0.3, 255);
              drawn = true;
              break;
            }
          }
          if (!drawn) setPx(x, y, 0, 0, 0, 0);
          break;
        }
        default:
          setPx(x, y, 255, 0, 255, 255);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return c;
}

export class BlockAtlas {
  constructor() {
    this.tileCanvases = new Map();
    this.iconUrls = new Map();
    this.atlasCanvas = document.createElement('canvas');
    this.atlasCanvas.width = ATLAS_COLS * CELL_SIZE;   // 256
    this.atlasCanvas.height = ATLAS_ROWS * CELL_SIZE;  // 128

    this._buildAtlas();
    this.texture = this._createThreeTexture();
    this._buildIcons();
  }

  _buildAtlas() {
    const ctx = this.atlasCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const tileIds = Object.values(TILE);
    for (const id of tileIds) {
      const tileCanvas = draw16x16Tile(id);
      this.tileCanvases.set(id, tileCanvas);

      const col = id % ATLAS_COLS;
      const row = Math.floor(id / ATLAS_COLS);
      const ox = col * CELL_SIZE;
      const oy = row * CELL_SIZE;

      // Center 16x16
      ctx.drawImage(tileCanvas, ox + PAD, oy + PAD);

      // Extrude 8px borders on all 4 sides + 4 corners to eliminate mipmap seam bleeding!
      // Top & Bottom strips
      ctx.drawImage(tileCanvas, 0, 0, 16, 1, ox + PAD, oy, 16, PAD);
      ctx.drawImage(tileCanvas, 0, 15, 16, 1, ox + PAD, oy + PAD + 16, 16, PAD);
      // Left & Right strips
      ctx.drawImage(tileCanvas, 0, 0, 1, 16, ox, oy + PAD, PAD, 16);
      ctx.drawImage(tileCanvas, 15, 0, 1, 16, ox + PAD + 16, oy + PAD, PAD, 16);
      // 4 Corners
      ctx.drawImage(tileCanvas, 0, 0, 1, 1, ox, oy, PAD, PAD);
      ctx.drawImage(tileCanvas, 15, 0, 1, 1, ox + PAD + 16, oy, PAD, PAD);
      ctx.drawImage(tileCanvas, 0, 15, 1, 1, ox, oy + PAD + 16, PAD, PAD);
      ctx.drawImage(tileCanvas, 15, 15, 1, 1, ox + PAD + 16, oy + PAD + 16, PAD, PAD);
    }
  }

  _createThreeTexture() {
    const tex = new THREE.CanvasTexture(this.atlasCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    // Generate controlled mipmaps (max 3 downsample levels so 8px padding is never exceeded)
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = false;

    tex.mipmaps = [];
    let w = this.atlasCanvas.width;
    let h = this.atlasCanvas.height;
    let prev = this.atlasCanvas;
    tex.mipmaps.push(prev);

    for (let level = 1; level <= 3; level++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      const mip = document.createElement('canvas');
      mip.width = w;
      mip.height = h;
      const mctx = mip.getContext('2d');
      mctx.imageSmoothingEnabled = true;
      mctx.drawImage(prev, 0, 0, w, h);
      tex.mipmaps.push(mip);
      prev = mip;
    }

    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // Returns [u0, v0, u1, v1] in Three.js UV space (v=1 is top of canvas)
  getTileUV(tileId) {
    const col = tileId % ATLAS_COLS;
    const row = Math.floor(idToSafe(tileId) / ATLAS_COLS);
    const W = this.atlasCanvas.width;
    const H = this.atlasCanvas.height;

    const px0 = col * CELL_SIZE + PAD;
    const px1 = px0 + INNER_SIZE;
    const py0 = row * CELL_SIZE + PAD;
    const py1 = py0 + INNER_SIZE;

    const u0 = px0 / W;
    const u1 = px1 / W;
    const v1 = 1.0 - py0 / H;
    const v0 = 1.0 - py1 / H;
    return [u0, v0, u1, v1];
  }

  getBlockFaceTile(blockId, faceName) {
    const def = BLOCK_DEFS[blockId];
    if (!def || !def.tiles) return TILE.STONE;
    if (def.tiles.all !== undefined) return def.tiles.all;
    if (faceName === 'top') return def.tiles.top;
    if (faceName === 'bottom') return def.tiles.bottom;
    return def.tiles.side;
  }

  _buildIcons() {
    for (const blockId of PLACEABLE_BLOCKS) {
      const def = BLOCK_DEFS[blockId];
      const icon = document.createElement('canvas');
      icon.width = 56;
      icon.height = 56;
      const ctx = icon.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      if (def.crossQuad) {
        const tile = this.tileCanvases.get(def.tiles.all);
        ctx.drawImage(tile, 8, 8, 40, 40);
      } else {
        const topTile = this.tileCanvases.get(this.getBlockFaceTile(blockId, 'top'));
        const sideTile = this.tileCanvases.get(this.getBlockFaceTile(blockId, 'side'));

        // Isometric 3D cube projection
        // Top diamond
        ctx.save();
        ctx.translate(28, 8);
        ctx.transform(1.25, 0.62, -1.25, 0.62, 0, 0);
        ctx.drawImage(topTile, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(255, 225, 175, 0.08)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();

        // Left face (sun-warmed)
        ctx.save();
        ctx.translate(8, 18);
        ctx.transform(1.25, 0.62, 0, 1.38, 0, 0);
        ctx.drawImage(sideTile, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();

        // Right face (twilight shaded)
        ctx.save();
        ctx.translate(28, 28);
        ctx.transform(1.25, -0.62, 0, 1.38, 0, 0);
        ctx.drawImage(sideTile, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(32, 20, 58, 0.36)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();
      }
      this.iconUrls.set(blockId, icon.toDataURL());
    }
  }

  getIconUrl(blockId) {
    return this.iconUrls.get(blockId) || '';
  }
}

function idToSafe(id) {
  return id || 0;
}
