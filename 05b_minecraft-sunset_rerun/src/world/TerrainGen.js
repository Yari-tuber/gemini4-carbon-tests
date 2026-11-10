import { WORLD_CONFIG } from '../config.js';
import { BLOCK } from './BlockRegistry.js';
import { SeededNoise } from './noise.js';

const { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } = WORLD_CONFIG;

// Sunset azimuth basis for sculpting the natural coastal bay corridor facing the sun
const AZ = 0.37;
const FWD_X = -Math.sin(AZ);
const FWD_Z = -Math.cos(AZ);
const RIGHT_X = Math.cos(AZ);
const RIGHT_Z = -Math.sin(AZ);

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class TerrainGenerator {
  constructor(seed = WORLD_CONFIG.SEED) {
    this.noise = new SeededNoise(seed);
    this.heightCache = new Map();
  }

  // Deterministic terrain height & biome query at any world (wx, wz)
  getColumnInfo(wx, wz) {
    const key = ((wx + 32768) << 16) | ((wz + 32768) & 0xffff);
    const cached = this.heightCache.get(key);
    if (cached !== undefined) return cached;

    const n = this.noise;

    // Domain warp for organic coastlines and valleys
    const warpX = n.fbm2D(wx * 0.0045 + 11.3, wz * 0.0045 - 7.1, 3) * 26.0;
    const warpZ = n.fbm2D(wx * 0.0045 - 19.7, wz * 0.0045 + 5.9, 3) * 26.0;
    const sx = wx + warpX;
    const sz = wz + warpZ;

    // Macro continentalness: [-1, 1] -> ocean vs land
    let continent = n.fbm2D(sx * 0.0032, sz * 0.0032, 4, 2.05, 0.5);

    // Project relative to Sunset Bay center (10, 26) along sun azimuth
    const dx = wx - 10;
    const dz = wz - 26;
    const s = dx * FWD_X + dz * FWD_Z;     // +s = toward the low orange sun over the sea
    const t = dx * RIGHT_X + dz * RIGHT_Z; // lateral across the bay

    // Sculpt natural Sunset Bay & open ocean sun-road corridor + flanking coastal headlands
    const bayInfluence = 1.0 - smoothstep(130, 280, Math.hypot(s - 30, t));
    if (bayInfluence > 0.001) {
      // Open ocean channel straight toward the sun so the horizon & sun-road are unobstructed
      const channelHalfWidth = 36.0 + Math.max(0, s) * 0.44;
      const inSunChannel = (1.0 - smoothstep(channelHalfWidth * 0.65, channelHalfWidth * 1.25, Math.abs(t)))
        * smoothstep(-28, 28, s);

      // Crescent cove & flanking scenic headlands (left golden oak hills, right pine cliffs)
      const leftHeadland = Math.exp(-Math.pow((t + 54) / 30, 2) - Math.pow((s - 18) / 56, 2));
      const rightHeadland = Math.exp(-Math.pow((t - 56) / 28, 2) - Math.pow((s - 26) / 60, 2));
      const inlandHills = smoothstep(26, -55, s) * (0.42 + 0.25 * Math.cos(t * 0.03));

      // Picturesque distant sea-stack islets off to the sides of the sun-road
      const leftIslet = Math.exp(-Math.pow((t + 92) / 14, 2) - Math.pow((s - 105) / 16, 2)) * 0.72;
      const rightIslet = Math.exp(-Math.pow((t - 98) / 15, 2) - Math.pow((s - 118) / 17, 2)) * 0.76;

      // Also guarantee vast western ocean far toward the sun (s > 85) except flanking islets
      const farSeaMask = smoothstep(55, 115, s) * (1.0 - Math.max(leftIslet, rightIslet));

      let sculpted = continent * 0.45
        + inlandHills
        + leftHeadland * 0.78
        + rightHeadland * 0.86
        + leftIslet
        + rightIslet
        - inSunChannel * 0.95
        - farSeaMask * 0.85;

      continent = continent * (1.0 - bayInfluence) + sculpted * bayInfluence;
    } else {
      // Even far outside the bay, keep the far sunward horizon (s > 175) mostly ocean archipelago
      const distantHorizonSea = smoothstep(145, 230, s);
      continent -= distantHorizonSea * 0.68;
    }

    // Detail noise layers: rolling hills + ridged coastal peaks
    const hills = (n.fbm2D(sx * 0.013, sz * 0.013, 4) * 0.5 + 0.5);
    const ridges = n.ridged2D(wx * 0.011 + 4.2, wz * 0.011 - 3.7, 4);
    const micro = n.fbm2D(wx * 0.048, wz * 0.048, 2) * 2.2;

    let heightFloat;
    if (continent < -0.05) {
      // Ocean floor: smooth shallow lagoon near coast, deeper further out
      const seaDepth = Math.min(14.5, (-continent - 0.05) * 26.0 + (1.0 - hills) * 3.5);
      heightFloat = SEA_LEVEL - 1.2 - seaDepth;
    } else {
      // Coastline -> wide golden sandy beach shelf -> rolling meadow -> forested hills & craggy peaks
      const beachShelf = smoothstep(-0.05, 0.07, continent);
      const landFactor = smoothstep(0.04, 0.30, continent);
      const mountainFactor = smoothstep(0.26, 0.80, continent);

      // Subtle Minecraft-like natural terraces on mid-slopes
      const rawHill = hills * 16.5 + ridges * 26.0 * mountainFactor;
      const terrace = Math.sin(rawHill * 0.85) * 0.65;

      heightFloat = SEA_LEVEL + 0.4
        + beachShelf * 2.2
        + landFactor * 4.5
        + (rawHill + terrace) * Math.pow(landFactor, 1.2)
        + mountainFactor * 14.0
        + micro * landFactor;
    }

    const height = Math.max(3, Math.min(CHUNK_HEIGHT - 14, Math.floor(heightFloat)));

    // Biome moisture & warmth (controls tree species & wildflower meadows)
    const moisture = n.fbm2D(wx * 0.009 - 50, wz * 0.009 + 50, 3);
    const warmth = n.fbm2D(wx * 0.012 + 90, wz * 0.012 - 40, 2);

    // Steepness check can be approximated or computed in chunk pass; store core column data
    const info = { height, moisture, warmth, continent };
    if (this.heightCache.size > 90000) this.heightCache.clear();
    this.heightCache.set(key, info);
    return info;
  }

  // Deterministic tree placement test at world coordinate (wx, wz)
  getTreeAt(wx, wz) {
    // Place trees on a jittered 4x4 grid to prevent overlapping trunks while looking natural
    const cellX = Math.floor(wx / 4);
    const cellZ = Math.floor(wz / 4);
    const jx = cellX * 4 + Math.floor(this.noise.hash2D(cellX, cellZ, 11) * 4);
    const jz = cellZ * 4 + Math.floor(this.noise.hash2D(cellX, cellZ, 23) * 4);
    if (wx !== jx || wz !== jz) return null;

    const col = this.getColumnInfo(wx, wz);
    const h = col.height;

    // Trees grow above beach sand (h >= SEA_LEVEL + 3) and below rocky alpine peaks (h <= 62)
    if (h < SEA_LEVEL + 3 || h > 62) return null;

    // Avoid steep cliff faces
    const hE = this.getColumnInfo(wx + 1, wz).height;
    const hW = this.getColumnInfo(wx - 1, wz).height;
    const hN = this.getColumnInfo(wx, wz - 1).height;
    const hS = this.getColumnInfo(wx, wz + 1).height;
    const slope = Math.max(Math.abs(hE - hW), Math.abs(hN - hS));
    if (slope > 3) return null;

    // Forest density clusters naturally (groves + open sunlit clearings!)
    const forestDensity = this.noise.fbm2D(wx * 0.022 + 31, wz * 0.022 - 17, 3) * 0.5 + 0.52;
    const roll = this.noise.hash2D(wx, wz, 101);
    if (roll > forestDensity * 0.68) return null;

    // Choose species:
    // Higher ridges or cool zones -> Tall Coastal Spruce
    // Warm sunlit groves -> Golden Sunset Birch (~26%) + Lush Classic Oak (~74%)
    const speciesRoll = this.noise.hash2D(wx, wz, 209);
    let type = 'oak';
    if (h > 44 || (col.warmth < -0.18 && speciesRoll < 0.65)) {
      type = 'spruce';
    } else if (speciesRoll < 0.28 + col.warmth * 0.2) {
      type = 'golden_birch';
    }

    const sizeRoll = this.noise.hash2D(wx, wz, 307);
    return { type, rootY: h + 1, sizeRoll };
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const wxBase = cx * CHUNK_SIZE;
    const wzBase = cz * CHUNK_SIZE;

    const setLocal = (lx, y, lz, id) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] = id;
    };

    const getLocal = (lx, y, lz) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
      return data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    };

    // 1. Base Terrain Strata + Ocean Water + Beaches + Rocky Cliffs
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = wzBase + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = wxBase + lx;
        const col = this.getColumnInfo(wx, wz);
        const h = col.height;

        // Neighbor slope for exposed rocky cliff faces
        const hX = this.getColumnInfo(wx + 1, wz).height;
        const hZ = this.getColumnInfo(wx, wz + 1).height;
        const steep = Math.abs(h - hX) >= 3 || Math.abs(h - hZ) >= 3;

        const beachNoise = this.noise.hash2D(wx, wz, 71) * 1.2;
        const isBeach = h <= SEA_LEVEL + 3 + (beachNoise > 0.72 ? 1 : 0) && !steep;
        const isAlpineRock = h >= 58 + Math.floor(beachNoise * 3);

        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          if (y === 0) {
            setLocal(lx, y, lz, BLOCK.STONE);
          } else if (y <= h) {
            if (steep && y > h - 4 && h > SEA_LEVEL + 4) {
              setLocal(lx, y, lz, y === h && h < 45 && beachNoise > 0.7 ? BLOCK.MOSSY_COBBLE : BLOCK.STONE);
            } else if (isAlpineRock && y >= h - 2) {
              setLocal(lx, y, lz, BLOCK.STONE);
            } else if (isBeach) {
              if (y >= h - 2) setLocal(lx, y, lz, BLOCK.SAND);
              else if (y >= h - 5) setLocal(lx, y, lz, BLOCK.SANDSTONE);
              else setLocal(lx, y, lz, BLOCK.STONE);
            } else {
              if (y === h) {
                setLocal(lx, y, lz, h < SEA_LEVEL ? BLOCK.SAND : BLOCK.GRASS);
              } else if (y >= h - 3) {
                setLocal(lx, y, lz, h < SEA_LEVEL ? BLOCK.SAND : BLOCK.DIRT);
              } else {
                setLocal(lx, y, lz, BLOCK.STONE);
              }
            }
          } else if (y <= SEA_LEVEL) {
            setLocal(lx, y, lz, BLOCK.WATER);
          }
        }

        // 2. Meadow Tall Grass & Sunset Wildflowers on sunlit grass blocks
        if (h > SEA_LEVEL + 2 && !isBeach && !steep && !isAlpineRock && getLocal(lx, h, lz) === BLOCK.GRASS) {
          const floraRoll = this.noise.hash2D(wx, wz, 509);
          if (floraRoll < 0.14) {
            setLocal(lx, h + 1, lz, BLOCK.TALL_GRASS);
          } else if (floraRoll < 0.185) {
            setLocal(lx, h + 1, lz, BLOCK.SUNSET_FLOWER);
          }
        }
      }
    }

    // 3. Cross-chunk Seamless Trees (scan 3-block margin around chunk)
    const margin = 3;
    for (let wz = wzBase - margin; wz < wzBase + CHUNK_SIZE + margin; wz++) {
      for (let wx = wxBase - margin; wx < wxBase + CHUNK_SIZE + margin; wx++) {
        const tree = this.getTreeAt(wx, wz);
        if (!tree) continue;

        const lxRoot = wx - wxBase;
        const lzRoot = wz - wzBase;
        this._stampTree(data, lxRoot, tree.rootY, lzRoot, tree.type, tree.sizeRoll, wx, wz);
      }
    }

    return data;
  }

  _stampTree(data, lx, rootY, lz, type, sizeRoll, wx, wz) {
    const placeLeaf = (x, y, z, leafBlock) => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      const idx = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
      const cur = data[idx];
      if (cur === BLOCK.AIR || cur === BLOCK.TALL_GRASS || cur === BLOCK.SUNSET_FLOWER) {
        data[idx] = leafBlock;
      }
    };

    const placeTrunk = (x, y, z, logBlock) => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      data[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] = logBlock;
    };

    if (type === 'spruce') {
      // Tall conical coastal spruce (7 to 10 blocks tall -> casts dramatic triangular sunset shadows!)
      const trunkH = 7 + Math.floor(sizeRoll * 4);
      for (let dy = 0; dy < trunkH; dy++) {
        placeTrunk(lx, rootY + dy, lz, BLOCK.SPRUCE_LOG);
      }
      // Tiered conifer crown
      const topY = rootY + trunkH;
      placeLeaf(lx, topY + 1, lz, BLOCK.SPRUCE_LEAVES);
      placeLeaf(lx, topY, lz, BLOCK.SPRUCE_LEAVES);
      placeLeaf(lx + 1, topY, lz, BLOCK.SPRUCE_LEAVES);
      placeLeaf(lx - 1, topY, lz, BLOCK.SPRUCE_LEAVES);
      placeLeaf(lx, topY, lz + 1, BLOCK.SPRUCE_LEAVES);
      placeLeaf(lx, topY, lz - 1, BLOCK.SPRUCE_LEAVES);

      for (let layer = 1; layer <= trunkH - 2; layer++) {
        const y = topY - layer;
        const r = (layer % 2 === 1) ? Math.min(3, 1 + Math.floor(layer / 2)) : Math.min(2, 1 + Math.floor((layer - 1) / 3));
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            const manhattan = Math.abs(dx) + Math.abs(dz);
            if (manhattan > r + 1) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && r >= 2) continue;
            placeLeaf(lx + dx, y, lz + dz, BLOCK.SPRUCE_LEAVES);
          }
        }
      }
    } else {
      // Classic Minecraft Oak or Golden Sunset Birch (5 to 7 blocks tall)
      const isBirch = type === 'golden_birch';
      const logBlock = isBirch ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
      const leafBlock = isBirch ? BLOCK.GOLDEN_LEAVES : BLOCK.OAK_LEAVES;
      const trunkH = (isBirch ? 5 : 4) + Math.floor(sizeRoll * 2.8);

      for (let dy = 0; dy < trunkH; dy++) {
        placeTrunk(lx, rootY + dy, lz, logBlock);
      }

      const crownBase = rootY + trunkH - 2;
      for (let dy = 0; dy <= 3; dy++) {
        const y = crownBase + dy;
        const r = dy >= 2 ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) === r && Math.abs(dz) === r) {
              if (dy === 3) continue;
              const cornerKeep = this.noise.hash2D(wx + dx * 7, wz + dz * 13, dy + 400);
              if (cornerKeep < 0.55) continue;
            }
            placeLeaf(lx + dx, y, lz + dz, leafBlock);
          }
        }
      }
    }
  }
}
