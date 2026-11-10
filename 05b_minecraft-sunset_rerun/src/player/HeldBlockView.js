import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS } from '../world/BlockRegistry.js';

export class HeldBlockView {
  constructor(atlas) {
    this.atlas = atlas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 10);
    this.visible = true;

    // Sunset-matched lighting for the held 3D voxel block
    const hemi = new THREE.HemisphereLight(0xffb478, 0x3a2a58, 1.05);
    this.scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xff963b, 1.45);
    sunLight.position.set(-1.5, 1.2, 1.4);
    this.scene.add(sunLight);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.currentBlockId = null;
    this.mesh = null;
    this.swingProgress = 0;
    this.isSwinging = false;

    this.setBlock(BLOCK.GRASS);
  }

  setBlock(blockId) {
    if (this.currentBlockId === blockId) return;
    this.currentBlockId = blockId;

    if (this.mesh) {
      this.pivot.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    const def = BLOCK_DEFS[blockId];
    if (!def) return;

    if (def.crossQuad) {
      const [u0, v0, u1, v1] = this.atlas.getTileUV(this.atlas.getBlockFaceTile(blockId, 'all'));
      const geo = new THREE.PlaneGeometry(0.42, 0.42);
      const uvs = geo.attributes.uv;
      uvs.setXY(0, u0, v1);
      uvs.setXY(1, u1, v1);
      uvs.setXY(2, u0, v0);
      uvs.setXY(3, u1, v0);
      const mat = new THREE.MeshLambertMaterial({
        map: this.atlas.texture,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.pivot.add(this.mesh);
      return;
    }

    // 3D Voxel Cube with exact per-face UVs from our padded BlockAtlas
    const geo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const uvAttr = geo.attributes.uv;
    // BoxGeometry face order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    const faceOrder = ['side', 'side', 'top', 'bottom', 'side', 'side'];
    for (let f = 0; f < 6; f++) {
      const tileId = this.atlas.getBlockFaceTile(blockId, faceOrder[f]);
      const [u0, v0, u1, v1] = this.atlas.getTileUV(tileId);
      const base = f * 4;
      uvAttr.setXY(base + 0, u0, v1);
      uvAttr.setXY(base + 1, u1, v1);
      uvAttr.setXY(base + 2, u0, v0);
      uvAttr.setXY(base + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;

    const isEmissive = (def.emissive || 0) > 0;
    const mat = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      alphaTest: def.cutout ? 0.45 : 0.0,
      emissive: isEmissive ? new THREE.Color(0xffa838) : new THREE.Color(0x000000),
      emissiveMap: isEmissive ? this.atlas.texture : null,
      emissiveIntensity: isEmissive ? 1.4 : 0.0,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.pivot.add(this.mesh);
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  update(dt, elapsed, bobState, cinematicIdle) {
    // Hide held block during initial cinematic vista so frame 1 is 100% pure postcard landscape!
    this.visible = !cinematicIdle;
    if (!this.visible) return;

    if (this.isSwinging) {
      this.swingProgress += dt * 5.6;
      if (this.swingProgress >= 1.0) {
        this.swingProgress = 0;
        this.isSwinging = false;
      }
    }

    const s = Math.sin(this.swingProgress * Math.PI);
    const s2 = Math.sin(Math.sqrt(this.swingProgress) * Math.PI);

    const bobX = Math.cos(bobState.phase) * 0.022 * bobState.amp;
    const bobY = Math.abs(Math.sin(bobState.phase)) * -0.024 * bobState.amp;
    const glideDip = bobState.mode === 'GLIDING' ? -0.05 + Math.sin(elapsed * 1.8) * 0.012 : 0;

    this.pivot.position.set(
      0.46 + bobX - s2 * 0.14,
      -0.36 + bobY + glideDip + s * 0.08 - s2 * 0.12,
      -0.68 - s * 0.14
    );

    this.pivot.rotation.set(
      0.16 - s2 * 0.95,
      -0.68 + s * 0.42,
      0.06 - bobState.roll * 0.8 - s2 * 0.35
    );
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
