import * as THREE from 'three';
import { SeededNoise } from '../utils/noise.js';
import { BLOCK, BLOCK_DEFS, getTileUVs } from './blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 80;
export const SEA_LEVEL = 14;
export const CHUNK_RADIUS = 8; // 256x256 world
export const WORLD_MIN = -CHUNK_RADIUS * CHUNK_SIZE;
export const WORLD_MAX = CHUNK_RADIUS * CHUNK_SIZE;
export const WORLD_SPAN = WORLD_MAX - WORLD_MIN;

const FACES = [
  { // +Y (Top)
    dir: [0, 1, 0],
    norm: [0, 1, 0],
    faceKey: 'top',
    verts: [
      { pos: [0, 1, 1], uv: [0, 0], uDir: [-1, 0, 0], vDir: [0, 0, 1] },
      { pos: [1, 1, 1], uv: [1, 0], uDir: [1, 0, 0],  vDir: [0, 0, 1] },
      { pos: [1, 1, 0], uv: [1, 1], uDir: [1, 0, 0],  vDir: [0, 0, -1] },
      { pos: [0, 1, 0], uv: [0, 1], uDir: [-1, 0, 0], vDir: [0, 0, -1] }
    ]
  },
  { // -Y (Bottom)
    dir: [0, -1, 0],
    norm: [0, -1, 0],
    faceKey: 'bottom',
    verts: [
      { pos: [0, 0, 0], uv: [0, 0], uDir: [-1, 0, 0], vDir: [0, 0, -1] },
      { pos: [1, 0, 0], uv: [1, 0], uDir: [1, 0, 0],  vDir: [0, 0, -1] },
      { pos: [1, 0, 1], uv: [1, 1], uDir: [1, 0, 0],  vDir: [0, 0, 1] },
      { pos: [0, 0, 1], uv: [0, 1], uDir: [-1, 0, 0], vDir: [0, 0, 1] }
    ]
  },
  { // +X (East)
    dir: [1, 0, 0],
    norm: [1, 0, 0],
    faceKey: 'side',
    verts: [
      { pos: [1, 0, 1], uv: [0, 0], uDir: [0, -1, 0], vDir: [0, 0, 1] },
      { pos: [1, 0, 0], uv: [1, 0], uDir: [0, -1, 0], vDir: [0, 0, -1] },
      { pos: [1, 1, 0], uv: [1, 1], uDir: [0, 1, 0],  vDir: [0, 0, -1] },
      { pos: [1, 1, 1], uv: [0, 1], uDir: [0, 1, 0],  vDir: [0, 0, 1] }
    ]
  },
  { // -X (West)
    dir: [-1, 0, 0],
    norm: [-1, 0, 0],
    faceKey: 'side',
    verts: [
      { pos: [0, 0, 0], uv: [0, 0], uDir: [0, -1, 0], vDir: [0, 0, -1] },
      { pos: [0, 0, 1], uv: [1, 0], uDir: [0, -1, 0], vDir: [0, 0, 1] },
      { pos: [0, 1, 1], uv: [1, 1], uDir: [0, 1, 0],  vDir: [0, 0, 1] },
      { pos: [0, 1, 0], uv: [0, 1], uDir: [0, 1, 0],  vDir: [0, 0, -1] }
    ]
  },
  { // +Z (South)
    dir: [0, 0, 1],
    norm: [0, 0, 1],
    faceKey: 'side',
    verts: [
      { pos: [0, 0, 1], uv: [0, 0], uDir: [-1, 0, 0], vDir: [0, -1, 0] },
      { pos: [1, 0, 1], uv: [1, 0], uDir: [1, 0, 0],  vDir: [0, -1, 0] },
      { pos: [1, 1, 1], uv: [1, 1], uDir: [1, 0, 0],  vDir: [0, 1, 0] },
      { pos: [0, 1, 1], uv: [0, 1], uDir: [-1, 0, 0], vDir: [0, 1, 0] }
    ]
  },
  { // -Z (North / Sunward)
    dir: [0, 0, -1],
    norm: [0, 0, -1],
    faceKey: 'side',
    verts: [
      { pos: [1, 0, 0], uv: [0, 0], uDir: [1, 0, 0],  vDir: [0, -1, 0] },
      { pos: [0, 0, 0], uv: [1, 0], uDir: [-1, 0, 0], vDir: [0, -1, 0] },
      { pos: [0, 1, 0], uv: [1, 1], uDir: [-1, 0, 0], vDir: [0, 1, 0] },
      { pos: [1, 1, 0], uv: [0, 1], uDir: [1, 0, 0],  vDir: [0, 1, 0] }
    ]
  }
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class World {
  constructor(scene, voxelMaterial, cutoutMaterial) {
    this.scene = scene;
    this.voxelMaterial = voxelMaterial;
    this.cutoutMaterial = cutoutMaterial;
    this.noise = new SeededNoise(20261109);

    this.voxels = new Uint8Array(WORLD_SPAN * WORLD_HEIGHT * WORLD_SPAN);
    this.heightMap = new Uint8Array(WORLD_SPAN * WORLD_SPAN);
    this.chunks = new Map();
    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);

    this.lightSources = [];

    // Seabed & terrain height texture for Ocean reflections, shallow water absorption & shoreline surf
    this.depthData = new Uint8Array(WORLD_SPAN * WORLD_SPAN * 4);
    this.waterDepthTexture = new THREE.DataTexture(
      this.depthData,
      WORLD_SPAN,
      WORLD_SPAN,
      THREE.RGBAFormat
    );
    this.waterDepthTexture.magFilter = THREE.LinearFilter;
    this.waterDepthTexture.minFilter = THREE.LinearFilter;
    this.waterDepthTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.waterDepthTexture.wrapT = THREE.ClampToEdgeWrapping;
  }

  inBounds(x, y, z) {
    return (
      x >= WORLD_MIN && x < WORLD_MAX &&
      y >= 0 && y < WORLD_HEIGHT &&
      z >= WORLD_MIN && z < WORLD_MAX
    );
  }

  voxelIndex(x, y, z) {
    const lx = x - WORLD_MIN;
    const lz = z - WORLD_MIN;
    return (lx * WORLD_SPAN + lz) * WORLD_HEIGHT + y;
  }

  getBlock(x, y, z) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (!this.inBounds(ix, iy, iz)) {
      return iy < 4 ? BLOCK.SAND : BLOCK.AIR;
    }
    return this.voxels[this.voxelIndex(ix, iy, iz)];
  }

  setBlockData(x, y, z, id) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (!this.inBounds(ix, iy, iz)) return;
    this.voxels[this.voxelIndex(ix, iy, iz)] = id;
    if (id === BLOCK.GLOWSTONE) {
      this.lightSources.push({ x: ix + 0.5, y: iy + 0.5, z: iz + 0.5 });
    }
  }

  setBlock(x, y, z, id) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (!this.inBounds(ix, iy, iz)) return false;

    const oldId = this.getBlock(ix, iy, iz);
    if (oldId === id) return false;

    this.voxels[this.voxelIndex(ix, iy, iz)] = id;

    if (oldId === BLOCK.GLOWSTONE) {
      this.lightSources = this.lightSources.filter(
        l => !(Math.floor(l.x) === ix && Math.floor(l.y) === iy && Math.floor(l.z) === iz)
      );
    }
    if (id === BLOCK.GLOWSTONE) {
      this.lightSources.push({ x: ix + 0.5, y: iy + 0.5, z: iz + 0.5 });
    }

    let topH = 1;
    for (let checkY = WORLD_HEIGHT - 1; checkY >= 0; checkY--) {
      const b = this.getBlock(ix, checkY, iz);
      if (b !== BLOCK.AIR && !BLOCK_DEFS[b]?.crossMesh) {
        topH = checkY;
        break;
      }
    }
    const lx = ix - WORLD_MIN;
    const lz = iz - WORLD_MIN;
    this.heightMap[lz * WORLD_SPAN + lx] = topH;
    this.updateDepthTexturePixel(lx, lz, topH);
    this.waterDepthTexture.needsUpdate = true;

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const chunksToRebuild = new Set([`${cx},${cz}`]);

    const modX = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const modZ = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if (modX === 0) chunksToRebuild.add(`${cx - 1},${cz}`);
    if (modX === CHUNK_SIZE - 1) chunksToRebuild.add(`${cx + 1},${cz}`);
    if (modZ === 0) chunksToRebuild.add(`${cx},${cz - 1}`);
    if (modZ === CHUNK_SIZE - 1) chunksToRebuild.add(`${cx},${cz + 1}`);

    if (oldId === BLOCK.GLOWSTONE || id === BLOCK.GLOWSTONE) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          chunksToRebuild.add(`${cx + dx},${cz + dz}`);
        }
      }
    }

    for (const key of chunksToRebuild) {
      const [rcx, rcz] = key.split(',').map(Number);
      if (rcx >= -CHUNK_RADIUS && rcx < CHUNK_RADIUS && rcz >= -CHUNK_RADIUS && rcz < CHUNK_RADIUS) {
        this.buildChunkMesh(rcx, rcz);
      }
    }

    return true;
  }

  getSurfaceHeight(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (ix < WORLD_MIN || ix >= WORLD_MAX || iz < WORLD_MIN || iz >= WORLD_MAX) {
      return 6;
    }
    const lx = ix - WORLD_MIN;
    const lz = iz - WORLD_MIN;
    return this.heightMap[lz * WORLD_SPAN + lx];
  }

  updateDepthTexturePixel(lx, lz, height) {
    const idx = (lz * WORLD_SPAN + lx) * 4;
    const depth = Math.max(0, (SEA_LEVEL + 0.35) - height);
    // R: exact terrain height (0..80 mapped to 0..255) for 3D water reflection raymarching!
    // G: water depth where >0 means submerged
    // B: above-water mask
    this.depthData[idx] = Math.min(255, Math.round((height / 80.0) * 255));
    this.depthData[idx + 1] = Math.min(255, Math.round(depth * 18));
    this.depthData[idx + 2] = height >= SEA_LEVEL ? 255 : 0;
    this.depthData[idx + 3] = 255;
  }

  computeTerrainHeight(x, z) {
    const warpX = this.noise.fbm2D(x * 0.011 + 13.7, z * 0.011 - 9.2, 3) * 16.0;
    const warpZ = this.noise.fbm2D(x * 0.011 - 24.1, z * 0.011 + 5.8, 3) * 16.0;
    const wx = x + warpX;
    const wz = z + warpZ;

    // 1. North (-Z) opens into the Sunset Ocean; South (+Z) and flanking Capes rise into dramatic fjord mountains
    const northSouthTrend = smoothstep(-52, 74, wz);

    // Wide central Sunset Bay corridor aligned with the sun (-0.15 azimuth) so the Sun Road is unobstructed
    const sunCorridorX = x - z * 0.15;
    const bayWidth = 30 + Math.max(0, -z) * 0.36;
    const bayMask = Math.exp(-(sunCorridorX * sunCorridorX) / (2.0 * bayWidth * bayWidth)) *
                    smoothstep(38, -28, z);

    // Dramatic West Fjord Mountain Ridge & East Lighthouse Promontory framing the bay
    const westCapeDist = Math.hypot((wx + 62) * 0.82, (wz + 12) * 0.68);
    const westCape = Math.max(0, 1.0 - westCapeDist / 58.0);

    const eastCapeDist = Math.hypot((wx - 60) * 0.82, (wz + 6) * 0.72);
    const eastCape = Math.max(0, 1.0 - eastCapeDist / 54.0);

    // Lighthouse promontory on the right side of the bay (x = 28, z = -22)
    const promontory = Math.max(0, 1.0 - Math.hypot(x - 28, z + 22) / 14.5);

    const baseHills = (this.noise.fbm2D(wx * 0.012, wz * 0.012, 4, 2.05, 0.5) + 1.0) * 0.5;
    const detailHills = this.noise.fbm2D(x * 0.035, z * 0.035, 3, 2.0, 0.5);
    const mountainRidges = this.noise.ridged2D(wx * 0.014 + 3.1, wz * 0.014 - 2.4, 4);

    let elevation = 6.0;
    elevation += northSouthTrend * (12.0 + baseHills * 19.0 + mountainRidges * 22.0);
    elevation += Math.pow(westCape, 1.3) * (18.0 + mountainRidges * 28.0);
    elevation += Math.pow(eastCape, 1.3) * (16.0 + mountainRidges * 24.0);
    elevation += detailHills * 3.2;

    // Carve the central bay channel
    elevation -= bayMask * (14.5 + baseHills * 8.0);

    // Add Lighthouse rocky promontory
    if (promontory > 0) {
      elevation = Math.max(elevation, 11.5 + Math.pow(promontory, 1.35) * 11.5);
    }

    // Outer world boundary falloff -> gentle island edges into the sea
    const edgeDistX = Math.min(x - WORLD_MIN, WORLD_MAX - 1 - x);
    const edgeDistZ = Math.min(z - WORLD_MIN, WORLD_MAX - 1 - z);
    const minEdgeDist = Math.min(edgeDistX, edgeDistZ);
    const outerIslandMask = smoothstep(4, 34, minEdgeDist);
    const northOceanFade = smoothstep(WORLD_MIN + 6, WORLD_MIN + 44, z);

    elevation = 5.0 + (elevation - 5.0) * outerIslandMask * northOceanFade;

    // Gentle sandy beach shelf around SEA_LEVEL (14)
    if (elevation > 12.6 && elevation < 17.0 && promontory <= 0.1) {
      elevation = 14.0 + (elevation - 14.0) * 0.55;
    }

    return Math.max(3, Math.min(WORLD_HEIGHT - 16, Math.round(elevation)));
  }

  generate() {
    this.voxels.fill(BLOCK.AIR);
    this.lightSources = [];

    // 1. Generate base terrain columns
    for (let z = WORLD_MIN; z < WORLD_MAX; z++) {
      for (let x = WORLD_MIN; x < WORLD_MAX; x++) {
        const h = this.computeTerrainHeight(x, z);
        const lx = x - WORLD_MIN;
        const lz = z - WORLD_MIN;
        this.heightMap[lz * WORLD_SPAN + lx] = h;
        this.updateDepthTexturePixel(lx, lz, h);

        const hN = this.computeTerrainHeight(x, z - 1);
        const hS = this.computeTerrainHeight(x, z + 1);
        const hE = this.computeTerrainHeight(x + 1, z);
        const hW = this.computeTerrainHeight(x - 1, z);
        const maxSlope = Math.max(Math.abs(h - hN), Math.abs(h - hS), Math.abs(h - hE), Math.abs(h - hW));

        const beachNoise = this.noise.noise2D(x * 0.08, z * 0.08);
        const isBeach = h <= SEA_LEVEL + 2 + (beachNoise > 0.25 ? 1 : 0);
        const isCliff = maxSlope >= 3 && h > SEA_LEVEL + 3;

        for (let y = 0; y <= h; y++) {
          let blockId = BLOCK.STONE;
          if (y === 0) {
            blockId = BLOCK.STONE;
          } else if (y === h) {
            if (h < SEA_LEVEL - 2) {
              blockId = beachNoise > 0.1 ? BLOCK.SAND : BLOCK.GRAVEL;
            } else if (isBeach) {
              blockId = BLOCK.SAND;
            } else if (isCliff) {
              blockId = (y % 5 === 0) ? BLOCK.COBBLESTONE : BLOCK.STONE;
            } else {
              blockId = BLOCK.GRASS;
            }
          } else if (y >= h - 3) {
            if (isBeach) {
              blockId = y === h - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (isCliff) {
              blockId = BLOCK.STONE;
            } else {
              blockId = BLOCK.DIRT;
            }
          }
          this.setBlockData(x, y, z, blockId);
        }
      }
    }

    // 2. Sculpt a Majestic Natural Voxel Sea Arch (海上天然石拱门) on the West side of the bay
    this.buildNaturalSeaArch(-28, -46);

    // 3. Build a Coastal Sunset Lighthouse & Wooden Pier on the East Promontory (x=28, z=-22) and Beach Pier
    this.buildCoastalLighthouse(28, -22);
    this.buildSunsetPierAndPavilion();

    // 4. Populate Multi-Species Sunset Forests (Pine, Oak, Golden Maple, Birch) & Flora
    this.populateForestsAndFlora();

    // Refresh heightMap & waterDepthTexture after landmarks so water reflections know about the Sea Arch & Lighthouse!
    for (let z = WORLD_MIN; z < WORLD_MAX; z++) {
      for (let x = WORLD_MIN; x < WORLD_MAX; x++) {
        let topH = 4;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const b = this.getBlock(x, y, z);
          if (b !== BLOCK.AIR && !BLOCK_DEFS[b]?.crossMesh) {
            topH = y;
            break;
          }
        }
        const lx = x - WORLD_MIN;
        const lz = z - WORLD_MIN;
        this.heightMap[lz * WORLD_SPAN + lx] = topH;
        this.updateDepthTexturePixel(lx, lz, topH);
      }
    }
    this.waterDepthTexture.needsUpdate = true;

    // 5. Build all 16x16 chunk meshes
    for (let cz = -CHUNK_RADIUS; cz < CHUNK_RADIUS; cz++) {
      for (let cx = -CHUNK_RADIUS; cx < CHUNK_RADIUS; cx++) {
        this.buildChunkMesh(cx, cz);
      }
    }
  }

  buildNaturalSeaArch(centerX, centerZ) {
    // Wide, flat-topped natural rock arch spanning 22 blocks wide out in the bay
    for (let dx = -11; dx <= 11; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        const x = centerX + dx;
        const z = centerZ + dz;
        const n = this.noise.noise2D(x * 0.14, z * 0.14) * 1.8;
        const spanFactor = Math.max(0, 1.0 - Math.pow(dx / 11.5, 2.4));
        const zProfile = Math.max(0, 1.0 - Math.pow((dz + n * 0.25) / 5.2, 2.0));
        if (spanFactor <= 0 || zProfile <= 0) continue;

        const maxY = Math.round(SEA_LEVEL + Math.pow(spanFactor, 0.65) * zProfile * 16.5 + n);
        const archRadius = 4.8 - Math.abs(dz) * 0.22;
        const archTopY = Math.round(SEA_LEVEL + 7.5 * Math.sqrt(Math.max(0, 1.0 - Math.pow(dx / archRadius, 2.0))));

        for (let y = 7; y <= maxY; y++) {
          if (Math.abs(dx) < archRadius && y >= SEA_LEVEL - 1 && y <= archTopY) {
            continue;
          }
          let blk = BLOCK.STONE;
          if (y === maxY && maxY > SEA_LEVEL + 5) {
            blk = BLOCK.GRASS;
          } else if (y === maxY - 1 && maxY > SEA_LEVEL + 5) {
            blk = BLOCK.DIRT;
          } else if ((x + y + z) % 5 === 0) {
            blk = BLOCK.COBBLESTONE;
          }
          this.setBlockData(x, y, z, blk);
        }
      }
    }
    this.setBlockData(centerX, SEA_LEVEL + 6, centerZ, BLOCK.GLOWSTONE);
  }

  buildCoastalLighthouse(lx, lz) {
    const baseH = this.getSurfaceHeight(lx, lz);
    const towerBase = Math.max(SEA_LEVEL + 4, baseH);

    // Stone brick foundation & cylindrical-octagonal lighthouse tower
    for (let y = towerBase - 4; y <= towerBase + 15; y++) {
      const dy = y - towerBase;
      const radius = dy < 2 ? 3 : (dy < 11 ? 2 : 2);
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius >= 2) continue;

          if (dy <= 0) {
            this.setBlockData(lx + dx, y, lz + dz, BLOCK.STONE_BRICKS);
          } else if (dy < 10) {
            // Red brick & white birch/stone striped lighthouse body
            const isWall = Math.abs(dx) === radius || Math.abs(dz) === radius || (Math.abs(dx) + Math.abs(dz) >= radius + 1);
            if (isWall) {
              const stripe = (dy >= 4 && dy <= 6) ? BLOCK.BRICKS : BLOCK.STONE_BRICKS;
              this.setBlockData(lx + dx, y, lz + dz, stripe);
            } else {
              this.setBlockData(lx + dx, y, lz + dz, BLOCK.AIR);
            }
          } else if (dy === 10) {
            // Observation balcony
            this.setBlockData(lx + dx, y, lz + dz, BLOCK.OAK_PLANKS);
          } else if (dy >= 11 && dy <= 13) {
            // Glowing Lantern Room framed by glass
            if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
              this.setBlockData(lx + dx, y, lz + dz, BLOCK.GLOWSTONE);
            } else {
              this.setBlockData(lx + dx, y, lz + dz, BLOCK.GLASS);
            }
          } else if (dy === 14) {
            this.setBlockData(lx + dx, y, lz + dz, BLOCK.TERRACOTTA);
          } else if (dy === 15 && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
            this.setBlockData(lx + dx, y, lz + dz, BLOCK.TERRACOTTA);
          }
        }
      }
    }
    this.setBlockData(lx, towerBase + 16, lz, BLOCK.OAK_LOG);
    this.setBlockData(lx, towerBase + 17, lz, BLOCK.GLOWSTONE);
  }

  buildSunsetPierAndPavilion() {
    const pierZStart = 15;
    const pierZEnd = -6;
    const pierX = 5;
    const deckY = SEA_LEVEL + 2; // y = 16

    for (let z = pierZEnd; z <= pierZStart; z++) {
      for (let x = pierX - 1; x <= pierX + 1; x++) {
        this.setBlockData(x, deckY, z, BLOCK.OAK_PLANKS);
        for (let cy = deckY + 1; cy <= deckY + 6; cy++) {
          this.setBlockData(x, cy, z, BLOCK.AIR);
        }
      }
      if ((z - pierZEnd) % 5 === 0) {
        for (const px of [pierX - 1, pierX + 1]) {
          for (let y = 8; y <= deckY + 1; y++) {
            this.setBlockData(px, y, z, BLOCK.OAK_LOG);
          }
          if (z === pierZEnd || z === pierZEnd + 10) {
            this.setBlockData(px, deckY + 2, z, BLOCK.GLOWSTONE);
          }
        }
      }
    }
  }

  populateForestsAndFlora() {
    for (let z = WORLD_MIN + 8; z < WORLD_MAX - 8; z++) {
      for (let x = WORLD_MIN + 8; x < WORLD_MAX - 8; x++) {
        const h = this.getSurfaceHeight(x, z);
        const topBlock = this.getBlock(x, h, z);
        if (topBlock !== BLOCK.GRASS) continue;
        if (h <= SEA_LEVEL + 1) continue;

        // Keep pier, lighthouse, and central spawn sightline clear
        if (Math.abs(x - 5) < 5 && z > -10 && z < 20) continue;
        if (Math.hypot(x - 28, z + 22) < 9) continue;
        if (Math.hypot(x + 28, z + 46) < 12) continue;
        if (Math.abs(x) < 14 && z > 10 && z < 44) continue;

        const forestDensity = (this.noise.fbm2D(x * 0.025 + 50, z * 0.025 + 50, 3) + 1.0) * 0.5;
        const r = this.noise.hash2D(x, z);

        const treeChance = forestDensity > 0.42 ? 0.052 : 0.016;
        if (r < treeChance && this.canPlaceTree(x, h + 1, z)) {
          const typeRoll = this.noise.hash2D(x + 91, z - 37);
          if (typeRoll < 0.24) {
            this.buildGoldenMapleTree(x, h + 1, z);
          } else if (h > 28 || typeRoll < 0.58) {
            this.buildPineTree(x, h + 1, z);
          } else if (typeRoll < 0.84) {
            this.buildOakTree(x, h + 1, z);
          } else {
            this.buildBirchTree(x, h + 1, z);
          }
        } else if (r > 0.68 && this.getBlock(x, h + 1, z) === BLOCK.AIR) {
          const floraRoll = this.noise.hash2D(x - 19, z + 73);
          if (floraRoll < 0.70) {
            this.setBlockData(x, h + 1, z, BLOCK.TALL_GRASS);
          } else if (floraRoll < 0.86) {
            this.setBlockData(x, h + 1, z, BLOCK.GOLD_FLOWER);
          } else {
            this.setBlockData(x, h + 1, z, BLOCK.ROSE_FLOWER);
          }
        }
      }
    }
  }

  canPlaceTree(x, y, z) {
    if (y + 12 >= WORLD_HEIGHT) return false;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = 0; dy <= 5; dy++) {
          const b = this.getBlock(x + dx, y + dy, z + dz);
          if (b === BLOCK.OAK_LOG || b === BLOCK.BIRCH_LOG || b === BLOCK.STONE_BRICKS) return false;
        }
      }
    }
    return true;
  }

  buildOakTree(x, y, z) {
    const trunkHeight = 5 + Math.floor(this.noise.hash2D(x * 3, z * 7) * 3);
    this.setBlockData(x, y - 1, z, BLOCK.DIRT);

    const canopyBase = y + trunkHeight - 2;
    const canopyTop = y + trunkHeight + 1;
    for (let ly = canopyBase; ly <= canopyTop; ly++) {
      const radius = ly === canopyTop ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const cornerDist = Math.abs(dx) + Math.abs(dz);
          if (radius === 2 && cornerDist === 4 && (ly === canopyTop - 1 || this.noise.hash2D(x + dx, z + dz + ly) > 0.45)) {
            continue;
          }
          if (this.getBlock(x + dx, ly, z + dz) === BLOCK.AIR) {
            this.setBlockData(x + dx, ly, z + dz, BLOCK.OAK_LEAVES);
          }
        }
      }
    }

    for (let ty = 0; ty < trunkHeight; ty++) {
      this.setBlockData(x, y + ty, z, BLOCK.OAK_LOG);
    }
  }

  buildGoldenMapleTree(x, y, z) {
    const trunkHeight = 5 + Math.floor(this.noise.hash2D(x * 11, z * 5) * 3);
    this.setBlockData(x, y - 1, z, BLOCK.DIRT);

    const canopyBase = y + trunkHeight - 2;
    const canopyTop = y + trunkHeight + 2;
    for (let ly = canopyBase; ly <= canopyTop; ly++) {
      const radius = (ly === canopyTop || ly === canopyBase) ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && this.noise.hash2D(x + dx, z + dz) > 0.35) continue;
          if (this.getBlock(x + dx, ly, z + dz) === BLOCK.AIR) {
            this.setBlockData(x + dx, ly, z + dz, BLOCK.GOLD_LEAVES);
          }
        }
      }
    }

    for (let ty = 0; ty < trunkHeight; ty++) {
      this.setBlockData(x, y + ty, z, BLOCK.OAK_LOG);
    }
  }

  buildBirchTree(x, y, z) {
    const trunkHeight = 6 + Math.floor(this.noise.hash2D(x * 5, z * 11) * 2);
    this.setBlockData(x, y - 1, z, BLOCK.DIRT);

    const canopyBase = y + trunkHeight - 3;
    const canopyTop = y + trunkHeight + 1;
    for (let ly = canopyBase; ly <= canopyTop; ly++) {
      const radius = ly >= canopyTop - 1 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && this.noise.hash2D(x + dx, z + dz) > 0.3) continue;
          if (this.getBlock(x + dx, ly, z + dz) === BLOCK.AIR) {
            this.setBlockData(x + dx, ly, z + dz, BLOCK.OAK_LEAVES);
          }
        }
      }
    }

    for (let ty = 0; ty < trunkHeight; ty++) {
      this.setBlockData(x, y + ty, z, BLOCK.BIRCH_LOG);
    }
  }

  buildPineTree(x, y, z) {
    const trunkHeight = 8 + Math.floor(this.noise.hash2D(x * 7, z * 13) * 4);
    this.setBlockData(x, y - 1, z, BLOCK.DIRT);

    const startLeaf = y + 3;
    const topLeaf = y + trunkHeight + 2;
    for (let ly = startLeaf; ly <= topLeaf; ly++) {
      const progress = (ly - startLeaf) / (topLeaf - startLeaf);
      let radius = 0;
      if (ly === topLeaf || ly === topLeaf - 1) {
        radius = 0;
      } else if (progress > 0.72) {
        radius = 1;
      } else {
        radius = ((ly - startLeaf) % 2 === 0) ? 2 : 1;
      }

      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (this.getBlock(x + dx, ly, z + dz) === BLOCK.AIR) {
            this.setBlockData(x + dx, ly, z + dz, BLOCK.PINE_LEAVES);
          }
        }
      }
    }

    for (let ty = 0; ty < trunkHeight; ty++) {
      this.setBlockData(x, y + ty, z, BLOCK.OAK_LOG);
    }
  }

  isAoOccluder(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id === BLOCK.AIR) return false;
    const def = BLOCK_DEFS[id];
    return def ? (def.solid && !def.crossMesh && id !== BLOCK.GLASS) : false;
  }

  computeVertexAO(x, y, z, dir, uDir, vDir) {
    const nx = x + dir[0];
    const ny = y + dir[1];
    const nz = z + dir[2];

    const side1 = this.isAoOccluder(nx + uDir[0], ny + uDir[1], nz + uDir[2]) ? 1 : 0;
    const side2 = this.isAoOccluder(nx + vDir[0], ny + vDir[1], nz + vDir[2]) ? 1 : 0;
    const corner = this.isAoOccluder(
      nx + uDir[0] + vDir[0],
      ny + uDir[1] + vDir[1],
      nz + uDir[2] + vDir[2]
    ) ? 1 : 0;

    let occ = 0;
    if (side1 && side2) {
      occ = 3;
    } else {
      occ = side1 + side2 + corner;
    }

    const aoTable = [1.0, 0.78, 0.58, 0.38];
    return aoTable[occ];
  }

  computeVertexBlockLight(vx, vy, vz, isEmissiveBlock) {
    if (isEmissiveBlock) return 1.0;
    let maxLight = 0.0;
    for (let i = 0; i < this.lightSources.length; i++) {
      const ls = this.lightSources[i];
      const dx = vx - ls.x;
      const dy = vy - ls.y;
      const dz = vz - ls.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 100.0) {
        const dist = Math.sqrt(distSq);
        const atten = Math.max(0.0, 1.0 - dist / 10.0);
        const l = atten * atten;
        if (l > maxLight) maxLight = l;
      }
    }
    return maxLight;
  }

  buildChunkMesh(cx, cz) {
    const key = `${cx},${cz}`;
    const existing = this.chunks.get(key);
    if (existing) {
      if (existing.solidMesh) {
        this.chunkGroup.remove(existing.solidMesh);
        existing.solidMesh.geometry.dispose();
      }
      if (existing.cutoutMesh) {
        this.chunkGroup.remove(existing.cutoutMesh);
        existing.cutoutMesh.geometry.dispose();
      }
    }

    const solidData = {
      positions: [],
      normals: [],
      uvs: [],
      aos: [],
      lights: [],
      foliages: [],
      indices: []
    };

    const cutoutData = {
      positions: [],
      normals: [],
      uvs: [],
      aos: [],
      lights: [],
      foliages: [],
      indices: []
    };

    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
        for (let x = startX; x < startX + CHUNK_SIZE; x++) {
          const blockId = this.getBlock(x, y, z);
          if (blockId === BLOCK.AIR) continue;

          const def = BLOCK_DEFS[blockId];
          if (!def) continue;

          if (def.crossMesh) {
            this.appendCrossMesh(x, y, z, def, cutoutData);
            continue;
          }

          const target = def.alphaTest ? cutoutData : solidData;
          const isFoliage = def.foliage ? 1.0 : 0.0;
          const isEmissive = def.emissive ? true : false;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];

            const neighborId = this.getBlock(nx, ny, nz);
            if (neighborId !== BLOCK.AIR) {
              const nDef = BLOCK_DEFS[neighborId];
              if (nDef && nDef.opaque) continue;
              if (neighborId === blockId && def.alphaTest) continue;
            }

            const tileId = def.tiles[face.faceKey] !== undefined
              ? def.tiles[face.faceKey]
              : def.tiles.all;
            const [u0, v0, u1, v1] = getTileUVs(tileId);

            const baseIndex = target.positions.length / 3;
            const faceAOs = [];

            for (let v = 0; v < 4; v++) {
              const vert = face.verts[v];
              const vx = x + vert.pos[0];
              const vy = y + vert.pos.y || (y + vert.pos[1]);
              const vz = z + vert.pos[2];

              target.positions.push(vx, y + vert.pos[1], vz);
              target.normals.push(face.norm[0], face.norm[1], face.norm[2]);

              const u = vert.uv[0] === 0 ? u0 : u1;
              const vt = vert.uv[1] === 0 ? v0 : v1;
              target.uvs.push(u, vt);

              const ao = isEmissive
                ? 1.0
                : this.computeVertexAO(x, y, z, face.dir, vert.uDir, vert.vDir);
              faceAOs.push(ao);
              target.aos.push(ao);

              const light = this.computeVertexBlockLight(vx, y + vert.pos[1], vz, isEmissive);
              target.lights.push(light);
              target.foliages.push(isFoliage);
            }

            if (faceAOs[0] + faceAOs[2] > faceAOs[1] + faceAOs[3]) {
              target.indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex, baseIndex + 2, baseIndex + 3
              );
            } else {
              target.indices.push(
                baseIndex + 1, baseIndex + 2, baseIndex + 3,
                baseIndex + 1, baseIndex + 3, baseIndex
              );
            }
          }
        }
      }
    }

    const createMeshFromData = (data, material, castShadow, receiveShadow) => {
      if (data.positions.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
      geo.setAttribute('aAo', new THREE.Float32BufferAttribute(data.aos, 1));
      geo.setAttribute('aLight', new THREE.Float32BufferAttribute(data.lights, 1));
      geo.setAttribute('aFoliage', new THREE.Float32BufferAttribute(data.foliages, 1));
      geo.setIndex(data.indices);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      this.chunkGroup.add(mesh);
      return mesh;
    };

    const solidMesh = createMeshFromData(solidData, this.voxelMaterial, true, true);
    const cutoutMesh = createMeshFromData(cutoutData, this.cutoutMaterial, true, true);

    this.chunks.set(key, { solidMesh, cutoutMesh });
  }

  appendCrossMesh(x, y, z, def, target) {
    const [u0, v0, u1, v1] = getTileUVs(def.tiles.all);
    const light = this.computeVertexBlockLight(x + 0.5, y + 0.5, z + 0.5, false);

    const jx = (this.noise.hash2D(x * 13, z * 29) - 0.5) * 0.22;
    const jz = (this.noise.hash2D(x * 31, z * 17) - 0.5) * 0.22;

    const quads = [
      [
        [0.15 + jx, 0, 0.15 + jz, u0, v0],
        [0.85 + jx, 0, 0.85 + jz, u1, v0],
        [0.85 + jx, 0.92, 0.85 + jz, u1, v1],
        [0.15 + jx, 0.92, 0.15 + jz, u0, v1]
      ],
      [
        [0.15 + jx, 0, 0.85 + jz, u0, v0],
        [0.85 + jx, 0, 0.15 + jz, u1, v0],
        [0.85 + jx, 0.92, 0.15 + jz, u1, v1],
        [0.15 + jx, 0.92, 0.85 + jz, u0, v1]
      ]
    ];

    for (const q of quads) {
      const baseIndex = target.positions.length / 3;
      for (let i = 0; i < 4; i++) {
        const v = q[i];
        target.positions.push(x + v[0], y + v[1], z + v[2]);
        target.normals.push(0, 1, 0);
        target.uvs.push(v[3], v[4]);
        target.aos.push(i >= 2 ? 1.0 : 0.78);
        target.lights.push(light);
        target.foliages.push(i >= 2 ? 1.5 : 0.2);
      }
      target.indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,
        baseIndex, baseIndex + 2, baseIndex + 3,
        baseIndex + 2, baseIndex + 1, baseIndex,
        baseIndex + 3, baseIndex + 2, baseIndex
      );
    }
  }
}
