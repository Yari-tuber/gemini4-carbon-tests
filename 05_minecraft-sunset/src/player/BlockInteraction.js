import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS, getTileUVs } from '../world/blocks.js';

export class BlockInteraction {
  constructor(scene, camera, world, player, atmosphereFX, soundManager, atlasTexture) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.atmosphereFX = atmosphereFX;
    this.soundManager = soundManager;
    this.atlasTexture = atlasTexture;

    this.maxReach = 6.5;
    this.currentTarget = null;
    this.selectedBlockId = BLOCK.OAK_PLANKS;

    // 1. Target block wireframe highlight box
    const boxGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.85
    });
    this.highlightBox = new THREE.LineSegments(edgesGeo, edgesMat);
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // 2. First-person 3D held block in bottom-right corner (sunset-shaded!)
    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);
    this.handMesh = null;
    this.swingTimer = 0;
    this.isSwinging = false;
    this.rebuildHandMesh(this.selectedBlockId);
  }

  setSelectedBlock(blockId) {
    if (this.selectedBlockId === blockId && this.handMesh) return;
    this.selectedBlockId = blockId;
    this.rebuildHandMesh(blockId);
  }

  rebuildHandMesh(blockId) {
    if (this.handMesh) {
      this.handGroup.remove(this.handMesh);
      this.handMesh.geometry.dispose();
      this.handMesh.material.dispose();
      this.handMesh = null;
    }

    const def = BLOCK_DEFS[blockId];
    if (!def || blockId === BLOCK.AIR) return;

    const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const uvAttr = geo.attributes.uv;

    const faceKeys = ['side', 'side', 'top', 'bottom', 'side', 'side'];
    // Bake warm sunset directional face colors into vertex colors so the held block blends into the sunset lighting!
    const faceTints = [
      [0.72, 0.50, 0.56], // +X (shadowed side)
      [1.05, 0.72, 0.48], // -X (sunlit side)
      [1.12, 0.86, 0.65], // +Y (top sunlit face)
      [0.45, 0.34, 0.44], // -Y (bottom)
      [0.82, 0.58, 0.60], // +Z
      [1.08, 0.76, 0.52]  // -Z
    ];
    if (def.emissive) {
      for (let i = 0; i < 6; i++) faceTints[i] = [1.35, 1.05, 0.75];
    }

    const colors = [];
    for (let f = 0; f < 6; f++) {
      const key = faceKeys[f];
      const tileId = def.tiles[key] !== undefined ? def.tiles[key] : def.tiles.all;
      const [u0, v0, u1, v1] = getTileUVs(tileId);
      const base = f * 4;
      uvAttr.setXY(base + 0, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);

      const tint = faceTints[f];
      for (let v = 0; v < 4; v++) {
        colors.push(tint[0], tint[1], tint[2]);
      }
    }
    uvAttr.needsUpdate = true;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      map: this.atlasTexture,
      vertexColors: true,
      transparent: !!def.alphaTest,
      alphaTest: def.alphaTest ? 0.5 : 0.0
    });

    this.handMesh = new THREE.Mesh(geo, mat);
    this.handMesh.position.set(0.38, -0.29, -0.52);
    this.handMesh.rotation.set(0.22, -0.68, 0.10);
    this.handGroup.add(this.handMesh);
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingTimer = 0;
  }

  raycast() {
    const origin = this.camera.position;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : 1e9;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : 1e9;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : 1e9;

    let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX) : 1e9;
    let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY) : 1e9;
    let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ) : 1e9;

    let dist = 0;
    let normX = 0, normY = 0, normZ = 0;

    for (let i = 0; i < 32; i++) {
      const blockId = this.world.getBlock(x, y, z);
      if (blockId !== BLOCK.AIR) {
        return {
          x, y, z,
          blockId,
          nx: normX,
          ny: normY,
          nz: normZ,
          dist
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          if (dist > this.maxReach) break;
          x += stepX;
          tMaxX += tDeltaX;
          normX = -stepX; normY = 0; normZ = 0;
        } else {
          dist = tMaxZ;
          if (dist > this.maxReach) break;
          z += stepZ;
          tMaxZ += tDeltaZ;
          normX = 0; normY = 0; normZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          if (dist > this.maxReach) break;
          y += stepY;
          tMaxY += tDeltaY;
          normX = 0; normY = -stepY; normZ = 0;
        } else {
          dist = tMaxZ;
          if (dist > this.maxReach) break;
          z += stepZ;
          tMaxZ += tDeltaZ;
          normX = 0; normY = 0; normZ = -stepZ;
        }
      }
    }

    return null;
  }

  breakBlock() {
    this.triggerSwing();
    if (!this.currentTarget) return false;

    const { x, y, z, blockId } = this.currentTarget;
    if (y <= 0) return false;

    const def = BLOCK_DEFS[blockId];
    const ok = this.world.setBlock(x, y, z, BLOCK.AIR);
    if (ok) {
      if (this.atmosphereFX) {
        this.atmosphereFX.spawnBlockDebris(x, y, z, def?.particleColor || '#a67e49', 22);
      }
      if (this.soundManager) {
        this.soundManager.playBreak(def?.sound || 'stone');
      }
    }
    return ok;
  }

  placeBlock() {
    this.triggerSwing();
    if (!this.currentTarget) return false;

    const { x, y, z, blockId, nx, ny, nz } = this.currentTarget;
    const hitDef = BLOCK_DEFS[blockId];

    const px = hitDef?.crossMesh ? x : x + nx;
    const py = hitDef?.crossMesh ? y : y + ny;
    const pz = hitDef?.crossMesh ? z : z + nz;

    const placeDef = BLOCK_DEFS[this.selectedBlockId];
    if (!placeDef) return false;

    if (placeDef.solid) {
      const pPos = this.player.position;
      const r = this.player.radius - 0.02;
      const overlapsX = (pPos.x + r > px) && (pPos.x - r < px + 1);
      const overlapsY = (pPos.y + this.player.height > py) && (pPos.y < py + 1);
      const overlapsZ = (pPos.z + r > pz) && (pPos.z - r < pz + 1);
      if (overlapsX && overlapsY && overlapsZ) {
        return false;
      }
    }

    const existing = this.world.getBlock(px, py, pz);
    if (existing !== BLOCK.AIR && !BLOCK_DEFS[existing]?.crossMesh) {
      return false;
    }

    const ok = this.world.setBlock(px, py, pz, this.selectedBlockId);
    if (ok && this.soundManager) {
      this.soundManager.playPlace(placeDef.sound || 'stone');
    }
    return ok;
  }

  pickBlock() {
    if (!this.currentTarget) return null;
    return this.currentTarget.blockId;
  }

  update(dt, time) {
    this.currentTarget = this.raycast();
    if (this.currentTarget) {
      this.highlightBox.visible = true;
      this.highlightBox.position.set(
        this.currentTarget.x + 0.5,
        this.currentTarget.y + 0.5,
        this.currentTarget.z + 0.5
      );
    } else {
      this.highlightBox.visible = false;
    }

    if (this.handMesh) {
      let swingOffsetX = 0;
      let swingOffsetY = 0;
      let swingRotX = 0;
      let swingRotZ = 0;

      if (this.isSwinging) {
        this.swingTimer += dt * 4.8;
        if (this.swingTimer >= 1.0) {
          this.isSwinging = false;
          this.swingTimer = 0;
        } else {
          const s = Math.sin(this.swingTimer * Math.PI);
          swingOffsetX = -s * 0.12;
          swingOffsetY = -s * 0.07;
          swingRotX = -s * 0.85;
          swingRotZ = s * 0.45;
        }
      }

      const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
      const walkBob = (this.player.mode === 'WALKING' && this.player.onGround)
        ? Math.sin(time * 9.0) * 0.012 * Math.min(1, speed / 5)
        : Math.sin(time * 2.2) * 0.006;

      this.handMesh.position.set(
        0.46 + swingOffsetX,
        -0.35 + walkBob + swingOffsetY,
        -0.66
      );
      this.handMesh.rotation.set(
        0.22 + swingRotX,
        -0.68,
        0.10 + swingRotZ - this.player.roll * 0.5
      );
    }
  }
}
