import * as THREE from 'three';
import { WORLD_CONFIG } from '../config.js';
import { BLOCK, BLOCK_DEFS } from './BlockRegistry.js';
import { TerrainGenerator } from './TerrainGen.js';
import { buildChunkMeshes } from './ChunkMesher.js';

const { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_RADIUS } = WORLD_CONFIG;

export class WorldManager {
  constructor(scene, atlas, voxelMaterial, shadowDepthMaterial, waterMaterial) {
    this.scene = scene;
    this.atlas = atlas;
    this.voxelMaterial = voxelMaterial;
    this.shadowDepthMaterial = shadowDepthMaterial;
    this.waterMaterial = waterMaterial;

    this.generator = new TerrainGenerator(WORLD_CONFIG.SEED);
    this.chunks = new Map();       // "cx,cz" -> { cx, cz, data, solidMesh, waterMesh, dirty }
    this.emissiveBlocks = new Map(); // "wx,wy,wz" -> lightLevel (15)

    this.solidGroup = new THREE.Group();
    this.waterGroup = new THREE.Group();
    this.particleGroup = new THREE.Group();
    this.scene.add(this.solidGroup);
    this.scene.add(this.waterGroup);
    this.scene.add(this.particleGroup);

    // Block break debris pool
    this.debrisParticles = [];
    this._debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);

    // Track active chunk window bounds for seamless outer horizon ocean skirt
    this.loadedBounds = {
      minX: -RENDER_RADIUS * CHUNK_SIZE,
      maxX: (RENDER_RADIUS + 1) * CHUNK_SIZE,
      minZ: -RENDER_RADIUS * CHUNK_SIZE,
      maxZ: (RENDER_RADIUS + 1) * CHUNK_SIZE,
    };
    this._lastCenterCx = null;
    this._lastCenterCz = null;
    this._buildQueue = [];
  }

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunkData(cx, cz) {
    const k = this._key(cx, cz);
    let entry = this.chunks.get(k);
    if (!entry) {
      const data = this.generator.generateChunk(cx, cz);
      entry = { cx, cz, data, solidMesh: null, waterMesh: null, meshed: false };
      this.chunks.set(k, entry);
    }
    return entry;
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const entry = this.chunks.get(this._key(cx, cz));
    if (!entry) return BLOCK.AIR;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return entry.data[(wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  // Ensures chunk data exists even at chunk borders when meshing
  getBlockEnsure(wx, wy, wz) {
    if (wy < 0) return BLOCK.STONE;
    if (wy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const entry = this.getChunkData(cx, cz);
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return entry.data[(wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
  }

  getLocalBlockLight(wx, wy, wz) {
    if (this.emissiveBlocks.size === 0) return 0.0;
    let best = 0.0;
    for (const [ _, src ] of this.emissiveBlocks) {
      const dist = Math.abs(wx - src.x) + Math.abs(wy - src.y) + Math.abs(wz - src.z);
      if (dist < 13) {
        const l = Math.max(0, 1.0 - dist / 13.0);
        if (l > best) best = l;
      }
    }
    return best * best;
  }

  setBlock(wx, wy, wz, newId) {
    if (wy <= 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const entry = this.getChunkData(cx, cz);
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    const idx = (wy * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    const oldId = entry.data[idx];
    if (oldId === newId) return false;

    entry.data[idx] = newId;

    // Track player-placed emissive light sources (Glowstone / Sea Lantern)
    const eKey = `${wx},${wy},${wz}`;
    const oldDef = BLOCK_DEFS[oldId];
    const newDef = BLOCK_DEFS[newId];
    const lightChanged = Boolean((oldDef && oldDef.light) || (newDef && newDef.light));

    if (newDef && newDef.light) {
      this.emissiveBlocks.set(eKey, { x: wx, y: wy, z: wz, level: newDef.light });
    } else {
      this.emissiveBlocks.delete(eKey);
    }

    // Rebuild affected chunk(s) immediately for zero-latency Minecraft block edit feel
    const toRebuild = new Set([this._key(cx, cz)]);
    if (lx === 0) toRebuild.add(this._key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) toRebuild.add(this._key(cx + 1, cz));
    if (lz === 0) toRebuild.add(this._key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) toRebuild.add(this._key(cx, cz + 1));

    if (lightChanged) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          toRebuild.add(this._key(cx + dx, cz + dz));
        }
      }
    }

    for (const key of toRebuild) {
      const [rcx, rcz] = key.split(',').map(Number);
      if (this.chunks.has(key)) {
        this._meshChunk(rcx, rcz);
      }
    }

    return true;
  }

  _meshChunk(cx, cz) {
    const entry = this.getChunkData(cx, cz);

    // Ensure 4 neighbors have data generated for seamless border culling & AO
    this.getChunkData(cx + 1, cz);
    this.getChunkData(cx - 1, cz);
    this.getChunkData(cx, cz + 1);
    this.getChunkData(cx, cz - 1);

    const { solidGeo, waterGeo } = buildChunkMeshes(
      cx, cz,
      (wx, wy, wz) => this.getBlockEnsure(wx, wy, wz),
      (wx, wy, wz) => this.getLocalBlockLight(wx, wy, wz),
      this.atlas
    );

    if (entry.solidMesh) {
      this.solidGroup.remove(entry.solidMesh);
      entry.solidMesh.geometry.dispose();
      entry.solidMesh = null;
    }
    if (entry.waterMesh) {
      this.waterGroup.remove(entry.waterMesh);
      entry.waterMesh.geometry.dispose();
      entry.waterMesh = null;
    }

    if (solidGeo) {
      const mesh = new THREE.Mesh(solidGeo, this.voxelMaterial);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      mesh.customDepthMaterial = this.shadowDepthMaterial;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.solidGroup.add(mesh);
      entry.solidMesh = mesh;
    }

    if (waterGeo) {
      const wMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
      wMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      wMesh.matrixAutoUpdate = false;
      wMesh.updateMatrix();
      this.waterGroup.add(wMesh);
      entry.waterMesh = wMesh;
    }

    entry.meshed = true;
  }

  // Synchronously prebuild initial world around spawn so frame 1 is 100% complete & breathtaking!
  warmupInitialWorld(spawnX, spawnZ) {
    const centerCx = Math.floor(spawnX / CHUNK_SIZE);
    const centerCz = Math.floor(spawnZ / CHUNK_SIZE);
    this._lastCenterCx = centerCx;
    this._lastCenterCz = centerCz;

    const coords = [];
    for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
      for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
        coords.push({ cx: centerCx + dx, cz: centerCz + dz, d2: dx * dx + dz * dz });
      }
    }
    coords.sort((a, b) => a.d2 - b.d2);

    // Pre-generate data first
    for (const c of coords) {
      this.getChunkData(c.cx, c.cz);
    }
    // Mesh all visible chunks for the opening shot
    for (const c of coords) {
      this._meshChunk(c.cx, c.cz);
    }

    this._updateLoadedBounds(centerCx, centerCz);
  }

  _updateLoadedBounds(centerCx, centerCz) {
    this.loadedBounds.minX = (centerCx - RENDER_RADIUS) * CHUNK_SIZE;
    this.loadedBounds.maxX = (centerCx + RENDER_RADIUS + 1) * CHUNK_SIZE;
    this.loadedBounds.minZ = (centerCz - RENDER_RADIUS) * CHUNK_SIZE;
    this.loadedBounds.maxZ = (centerCz + RENDER_RADIUS + 1) * CHUNK_SIZE;
  }

  updateStreaming(playerX, playerZ, dt) {
    const centerCx = Math.floor(playerX / CHUNK_SIZE);
    const centerCz = Math.floor(playerZ / CHUNK_SIZE);

    if (centerCx !== this._lastCenterCx || centerCz !== this._lastCenterCz) {
      this._lastCenterCx = centerCx;
      this._lastCenterCz = centerCz;

      // Queue newly needed chunks sorted near-to-far
      const needed = new Set();
      const queue = [];
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const k = this._key(cx, cz);
          needed.add(k);
          const existing = this.chunks.get(k);
          if (!existing || !existing.meshed) {
            queue.push({ cx, cz, d2: dx * dx + dz * dz });
          } else {
            if (existing.solidMesh) existing.solidMesh.visible = true;
            if (existing.waterMesh) existing.waterMesh.visible = true;
          }
        }
      }
      queue.sort((a, b) => a.d2 - b.d2);
      this._buildQueue = queue;

      // Hide chunks outside active window (and prune far-away chunks to bound RAM)
      for (const [k, entry] of this.chunks.entries()) {
        if (!needed.has(k)) {
          if (entry.solidMesh) entry.solidMesh.visible = false;
          if (entry.waterMesh) entry.waterMesh.visible = false;

          const distCheb = Math.max(Math.abs(entry.cx - centerCx), Math.abs(entry.cz - centerCz));
          if (distCheb > RENDER_RADIUS + 5) {
            if (entry.solidMesh) {
              this.solidGroup.remove(entry.solidMesh);
              entry.solidMesh.geometry.dispose();
            }
            if (entry.waterMesh) {
              this.waterGroup.remove(entry.waterMesh);
              entry.waterMesh.geometry.dispose();
            }
            this.chunks.delete(k);
          }
        }
      }

      this._updateLoadedBounds(centerCx, centerCz);
    }

    // Incrementally build up to 2 chunks per frame so gliding stays silky 60fps
    let budget = 2;
    while (this._buildQueue.length > 0 && budget > 0) {
      const next = this._buildQueue.shift();
      const k = this._key(next.cx, next.cz);
      const entry = this.chunks.get(k);
      if (!entry || !entry.meshed) {
        this._meshChunk(next.cx, next.cz);
        budget--;
      }
    }

    this._updateDebris(dt);
  }

  // Fast 3D Amanatides & Woo DDA Voxel Raycast
  raycast(origin, direction, maxDist = 7.0) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : 1e9;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : 1e9;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : 1e9;

    let tMaxX = dx > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
    let tMaxY = dy > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
    let tMaxZ = dz > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;

    let hitNormal = [0, 0, 0];
    let dist = 0;

    for (let i = 0; i < 64 && dist <= maxDist; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER) {
        return {
          blockId: id,
          x, y, z,
          normal: hitNormal,
          distance: dist,
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          tMaxX += tDeltaX;
          x += stepX;
          hitNormal = [-stepX, 0, 0];
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          hitNormal = [0, 0, -stepZ];
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          tMaxY += tDeltaY;
          y += stepY;
          hitNormal = [0, -stepY, 0];
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          hitNormal = [0, 0, -stepZ];
        }
      }
    }
    return null;
  }

  spawnBreakParticles(wx, wy, wz, blockId) {
    const def = BLOCK_DEFS[blockId];
    const baseHex = (def && def.particleColor) || '#b09070';
    const baseColor = new THREE.Color(baseHex);

    const count = 18;
    for (let i = 0; i < count; i++) {
      const shade = 0.75 + Math.random() * 0.45;
      const mat = new THREE.MeshBasicMaterial({
        color: baseColor.clone().multiplyScalar(shade),
      });
      const mesh = new THREE.Mesh(this._debrisGeo, mat);
      mesh.position.set(
        wx + 0.2 + Math.random() * 0.6,
        wy + 0.2 + Math.random() * 0.6,
        wz + 0.2 + Math.random() * 0.6
      );
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.particleGroup.add(mesh);

      this.debrisParticles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4.4,
          1.8 + Math.random() * 3.6,
          (Math.random() - 0.5) * 4.4
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9
        ),
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
      });
    }
  }

  _updateDebris(dt) {
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
      const p = this.debrisParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        p.mesh.material.dispose();
        this.debrisParticles.splice(i, 1);
        continue;
      }
      p.vel.y -= 18.0 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;

      // Simple floor bounce
      const bx = Math.floor(p.mesh.position.x);
      const by = Math.floor(p.mesh.position.y - 0.08);
      const bz = Math.floor(p.mesh.position.z);
      const bId = this.getBlock(bx, by, bz);
      if (bId !== BLOCK.AIR && bId !== BLOCK.WATER && BLOCK_DEFS[bId]?.solid && p.vel.y < 0) {
        p.mesh.position.y = by + 1.08;
        p.vel.y *= -0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }

      const scale = Math.min(1.0, p.life * 3.2);
      p.mesh.scale.setScalar(scale);
    }
  }
}
