// Counter-Strike: Dust II — Grenades (HE, Flash, Smoke), Tracers, Decals, Shells & Planted C4 FX
import * as THREE from 'three';
import { createWorldWeaponMesh } from '../models/WeaponModels.js';

function createSoftPuffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(222, 224, 226, 0.92)');
  g.addColorStop(0.55, 'rgba(186, 190, 194, 0.65)');
  g.addColorStop(1, 'rgba(155, 160, 165, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBulletHoleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 26);
  g.addColorStop(0, 'rgba(18, 15, 12, 0.95)');
  g.addColorStop(0.35, 'rgba(48, 40, 32, 0.72)');
  g.addColorStop(0.75, 'rgba(110, 95, 76, 0.25)');
  g.addColorStop(1, 'rgba(110, 95, 76, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class ProjectilesAndFX {
  constructor(scene, map, sound) {
    this.scene = scene;
    this.map = map;
    this.sound = sound;

    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    this.puffTex = createSoftPuffTexture();
    this.holeTex = createBulletHoleTexture();
    this.decalMat = new THREE.MeshBasicMaterial({
      map: this.holeTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3
    });

    this.decals = [];
    this.maxDecals = 140;
    this.particles = [];
    this.tracers = [];
    this.shells = [];
    this.grenades = [];
    this.activeSmokes = [];
    this.droppedItems = []; // { mesh, weaponId, ammo, reserve, pos, isC4 }

    this.plantedC4Mesh = null;
    this.shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.026, 6);
    this.shellGeo.rotateZ(Math.PI / 2);
    this.shellMat = new THREE.MeshStandardMaterial({ color: 0xd8ad48, roughness: 0.3, metalness: 0.85 });
  }

  clearRoundObjects() {
    for (const g of this.grenades) this.fxGroup.remove(g.mesh);
    this.grenades = [];

    for (const s of this.activeSmokes) this.fxGroup.remove(s.group);
    this.activeSmokes = [];

    for (const d of this.droppedItems) this.fxGroup.remove(d.mesh);
    this.droppedItems = [];

    if (this.plantedC4Mesh) {
      this.fxGroup.remove(this.plantedC4Mesh);
      this.plantedC4Mesh = null;
    }
  }

  // ==================== BULLET IMPACTS, TRACERS & SHELLS ====================

  spawnTracer(startPos, endPos, silenced = false) {
    if (silenced) return; // Authentic CS: M4A1-S & USP-S fire ZERO tracers!
    const dist = startPos.distanceTo(endPos);
    if (dist < 1.2) return;

    const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const len = Math.min(dist * 0.65, 9.5);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, len)
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe494, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    line.position.copy(startPos).addScaledVector(dir, 0.6);
    line.lookAt(endPos);
    this.fxGroup.add(line);

    this.tracers.push({ line, dir, speed: 165, traveled: 0, maxDist: dist - len, life: 0.14 });
  }

  spawnShellCasing(originPos, rightDir, upDir) {
    const mesh = new THREE.Mesh(this.shellGeo, this.shellMat);
    mesh.position.copy(originPos);
    const vel = rightDir.clone().multiplyScalar(1.8 + Math.random() * 1.1)
      .addScaledVector(upDir, 1.4 + Math.random() * 0.8);
    this.fxGroup.add(mesh);
    this.shells.push({ mesh, vel, life: 1.1 });
  }

  spawnImpactFX(point, normal, surface = 'stone', isBlood = false, isHeadshot = false) {
    if (!isBlood) {
      // Bullet hole decal on wall/crate/floor
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), this.decalMat);
      hole.position.copy(point).addScaledVector(normal, 0.012);
      hole.lookAt(point.clone().add(normal));
      hole.rotation.z = Math.random() * Math.PI * 2;
      this.fxGroup.add(hole);
      this.decals.push(hole);
      if (this.decals.length > this.maxDecals) {
        const old = this.decals.shift();
        this.fxGroup.remove(old);
      }
    }

    // Burst particles (sparks for metal/headshot, splinters for wood, dust for stone, crimson mist for hits)
    const count = isHeadshot ? 14 : (isBlood ? 8 : 7);
    let color = 0xd6c098;
    if (isBlood) color = isHeadshot ? 0xd91e18 : 0x9e1915;
    else if (surface === 'metal') color = 0xffc65c;
    else if (surface === 'wood') color = 0xb58348;

    for (let i = 0; i < count; i++) {
      const size = isBlood ? (0.045 + Math.random() * 0.05) : (0.025 + Math.random() * 0.035);
      const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
      const p = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), pMat);
      p.position.copy(point);
      const vel = normal.clone().multiplyScalar(1.5 + Math.random() * 3.5).add(
        new THREE.Vector3((Math.random() - 0.5) * 3.4, Math.random() * 2.6, (Math.random() - 0.5) * 3.4)
      );
      this.fxGroup.add(p);
      this.particles.push({ mesh: p, vel, life: 0.32 + Math.random() * 0.25, maxLife: 0.55, gravity: 9.8 });
    }
  }

  // ==================== GRENADES (HE / FLASHBANG / SMOKE) ====================

  throwGrenade({ type, origin, direction, throwPower = 1.0, thrower }) {
    const group = new THREE.Group();
    let mesh;
    if (type === 'hegrenade') {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x445636, roughness: 0.5, metalness: 0.4 })
      );
    } else if (type === 'flashbang') {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12),
        new THREE.MeshStandardMaterial({ color: 0xaab4be, roughness: 0.3, metalness: 0.8 })
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.17, 12),
        new THREE.MeshStandardMaterial({ color: 0x6e747a, roughness: 0.55, metalness: 0.4 })
      );
    }
    mesh.castShadow = true;
    group.add(mesh);
    group.position.copy(origin);
    this.fxGroup.add(group);

    // CS throw speeds: Left-Click ~21.5 m/s, Medium ~15 m/s, Right-Click lob ~9.5 m/s
    const speed = 9.5 + throwPower * 12.5;
    const vel = direction.clone().normalize().multiplyScalar(speed);
    vel.y += 1.8 * throwPower;

    const fuse = type === 'flashbang' ? 1.45 : (type === 'hegrenade' ? 1.68 : 1.75);
    this.grenades.push({
      type,
      mesh: group,
      pos: origin.clone(),
      vel,
      fuse,
      thrower,
      bounces: 0
    });
  }

  _detonateHE(nade, combatCallbacks) {
    const pos = nade.pos.clone();
    this.sound.playHEExplosion(pos);

    // Scorch decal on floor
    const { floorY } = this.map.getSupportingFloorY(pos.x, pos.y + 0.5, pos.z, 0.2, 2.0);
    if (floorY > -20) {
      const scorch = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.decalMat);
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.set(pos.x, floorY + 0.02, pos.z);
      this.fxGroup.add(scorch);
      this.decals.push(scorch);
    }

    // Fireball & shrapnel burst
    const flashLight = new THREE.PointLight(0xff8c2e, 35, 18, 1.5);
    flashLight.position.copy(pos);
    this.fxGroup.add(flashLight);
    setTimeout(() => this.fxGroup.remove(flashLight), 110);

    for (let i = 0; i < 28; i++) {
      const isFire = i < 14;
      const col = isFire ? (i % 2 === 0 ? 0xff7b24 : 0xffcc44) : 0x5c5346;
      const sz = isFire ? 0.26 : 0.10;
      const pMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92 });
      const p = new THREE.Mesh(new THREE.SphereGeometry(sz, 8, 6), pMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        1.5 + Math.random() * 8,
        (Math.random() - 0.5) * 14
      );
      this.fxGroup.add(p);
      this.particles.push({ mesh: p, vel, life: 0.48 + Math.random() * 0.35, maxLife: 0.8, gravity: 7.5 });
    }

    if (combatCallbacks && combatCallbacks.onHEDetonate) {
      combatCallbacks.onHEDetonate(pos, nade.thrower);
    }
  }

  _detonateFlashbang(nade, combatCallbacks) {
    const pos = nade.pos.clone();
    const flashLight = new THREE.PointLight(0xffffff, 55, 26, 1.2);
    flashLight.position.copy(pos);
    this.fxGroup.add(flashLight);
    setTimeout(() => this.fxGroup.remove(flashLight), 90);

    if (combatCallbacks && combatCallbacks.onFlashDetonate) {
      combatCallbacks.onFlashDetonate(pos, nade.thrower);
    }
  }

  _deploySmoke(nade) {
    const pos = nade.pos.clone();
    const { floorY } = this.map.getSupportingFloorY(pos.x, pos.y + 0.5, pos.z, 0.25, 1.5);
    if (floorY > -20) pos.y = floorY + 0.35;

    this.sound.playSmokeBloom(pos);

    // Multi-puff billboard sprite cluster forming a thick, realistic 4.3m CS2 Smoke Dome!
    const smokeGroup = new THREE.Group();
    smokeGroup.position.copy(pos);

    const puffs = [];
    const puffOffsets = [
      [0, 1.1, 0, 4.6],
      [-1.7, 0.9, -1.1, 3.8], [1.8, 0.9, -1.0, 3.8],
      [-1.5, 0.9, 1.4, 3.8],  [1.6, 0.9, 1.3, 3.8],
      [0.0, 2.2, 0.2, 4.1],   [-0.9, 1.7, -0.8, 3.6],
      [1.0, 1.6, 0.9, 3.6],   [-2.4, 0.7, 0.1, 3.3],
      [2.4, 0.7, -0.2, 3.3],  [0.1, 0.7, -2.3, 3.3],
      [-0.2, 0.7, 2.3, 3.3]
    ];

    for (const [ox, oy, oz, scale] of puffOffsets) {
      const sMat = new THREE.SpriteMaterial({
        map: this.puffTex,
        color: 0xd8dce0,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const sp = new THREE.Sprite(sMat);
      sp.position.set(ox * 0.2, oy * 0.2, oz * 0.2);
      sp.scale.set(0.5, 0.5, 0.5);
      smokeGroup.add(sp);
      puffs.push({ sprite: sp, targetPos: new THREE.Vector3(ox, oy, oz), targetScale: scale });
    }

    this.fxGroup.add(smokeGroup);
    this.activeSmokes.push({
      group: smokeGroup,
      position: pos.clone().add(new THREE.Vector3(0, 1.3, 0)),
      radius: 4.15,
      age: 0,
      duration: 18.0, // Official CS 18-second smoke duration!
      puffs
    });
  }

  // ==================== DROPPED WEAPONS & PLANTED C4 ====================

  dropWeapon(weaponId, pos, ammo, reserve) {
    if (!weaponId || weaponId === 'knife') return;
    const mesh = createWorldWeaponMesh(weaponId);
    const { floorY } = this.map.getSupportingFloorY(pos.x, pos.y + 0.6, pos.z, 0.25, 1.5);
    const y = floorY > -20 ? floorY + 0.08 : pos.y;
    mesh.position.set(pos.x + (Math.random() - 0.5) * 0.4, y, pos.z + (Math.random() - 0.5) * 0.4);
    mesh.rotation.set(0, Math.random() * Math.PI * 2, Math.PI * 0.46);
    this.fxGroup.add(mesh);

    this.droppedItems.push({
      mesh,
      weaponId,
      ammo,
      reserve,
      pos: mesh.position.clone(),
      isC4: weaponId === 'c4'
    });
  }

  spawnPlantedC4(pos) {
    if (this.plantedC4Mesh) this.fxGroup.remove(this.plantedC4Mesh);
    this.plantedC4Mesh = createWorldWeaponMesh('c4');
    this.plantedC4Mesh.position.copy(pos);
    this.fxGroup.add(this.plantedC4Mesh);
  }

  triggerC4SiteExplosion(pos) {
    this.sound.playC4Explosion();
    for (let i = 0; i < 65; i++) {
      const col = i % 3 === 0 ? 0xff5e1a : (i % 3 === 1 ? 0xffbd38 : 0x3b352e);
      const pMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 });
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.65, 8, 6), pMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 28,
        3 + Math.random() * 19,
        (Math.random() - 0.5) * 28
      );
      this.fxGroup.add(p);
      this.particles.push({ mesh: p, vel, life: 1.4 + Math.random() * 0.9, maxLife: 2.2, gravity: 5.5 });
    }
  }

  // ==================== FRAME UPDATE ====================

  update(dt, combatCallbacks) {
    // Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      const step = tr.speed * dt;
      tr.traveled += step;
      tr.life -= dt;
      tr.line.position.addScaledVector(tr.dir, step);
      if (tr.traveled >= tr.maxDist || tr.life <= 0) {
        this.fxGroup.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update brass shell casings
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      sh.vel.y -= 9.8 * dt;
      sh.mesh.position.addScaledVector(sh.vel, dt);
      sh.mesh.rotation.x += dt * 18;
      sh.mesh.rotation.y += dt * 14;
      if (sh.life <= 0) {
        this.fxGroup.remove(sh.mesh);
        this.shells.splice(i, 1);
      }
    }

    // Update impact & explosion particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.fxGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Update thrown grenades with 3D wall & floor bounce physics!
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vel.y -= 16.5 * dt;

      const nextPos = g.pos.clone().addScaledVector(g.vel, dt);

      // Wall bounce check via raycast along step segment
      const stepVec = new THREE.Vector3().subVectors(nextPos, g.pos);
      const stepLen = stepVec.length();
      if (stepLen > 0.001) {
        const rc = new THREE.Raycaster(g.pos, stepVec.clone().divideScalar(stepLen), 0, stepLen + 0.14);
        const hits = rc.intersectObjects(this.map.raycastMeshes, false);
        if (hits.length > 0 && hits[0].face) {
          const n = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld).normalize();
          g.vel.reflect(n).multiplyScalar(0.46);
          nextPos.copy(hits[0].point).addScaledVector(n, 0.15);
          if (g.vel.length() > 1.8 && g.bounces < 4) {
            this.sound.playGrenadeBounce(nextPos);
            g.bounces++;
          }
        }
      }

      // Floor support check
      const { floorY } = this.map.getSupportingFloorY(nextPos.x, g.pos.y + 0.3, nextPos.z, 0.12, 0.6);
      if (nextPos.y < floorY + 0.10) {
        nextPos.y = floorY + 0.10;
        if (g.vel.y < -1.5) {
          g.vel.y = -g.vel.y * 0.38;
          g.vel.x *= 0.68;
          g.vel.z *= 0.68;
          this.sound.playGrenadeBounce(nextPos);
        } else {
          g.vel.y = 0;
          g.vel.x *= 0.85;
          g.vel.z *= 0.85;
        }
      }

      g.pos.copy(nextPos);
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.vel.z * dt * 2.5;
      g.mesh.rotation.z -= g.vel.x * dt * 2.5;

      // Detonation check (Smoke waits until slow or fuse <= 0)
      if (g.fuse <= 0) {
        this.fxGroup.remove(g.mesh);
        this.grenades.splice(i, 1);
        if (g.type === 'hegrenade') this._detonateHE(g, combatCallbacks);
        else if (g.type === 'flashbang') this._detonateFlashbang(g, combatCallbacks);
        else this._deploySmoke(g);
      }
    }

    // Update active Volumetric Smoke Clouds
    for (let i = this.activeSmokes.length - 1; i >= 0; i--) {
      const sm = this.activeSmokes[i];
      sm.age += dt;
      const expandT = Math.min(1, sm.age / 0.55);
      const fadeOutT = sm.age > sm.duration - 2.2 ? Math.max(0, (sm.duration - sm.age) / 2.2) : 1.0;

      for (const p of sm.puffs) {
        p.sprite.position.lerp(p.targetPos, Math.min(1, dt * 6.5));
        const sc = p.targetScale * (0.3 + 0.7 * expandT);
        p.sprite.scale.set(sc, sc, sc);
        p.sprite.material.opacity = 0.86 * expandT * fadeOutT;
      }

      if (sm.age >= sm.duration) {
        this.fxGroup.remove(sm.group);
        for (const p of sm.puffs) p.sprite.material.dispose();
        this.activeSmokes.splice(i, 1);
      }
    }
  }

  // Returns [0..1] smoke screen overlay density if camera is inside an active smoke cloud
  getSmokeOverlayAt(eyePos) {
    let maxDensity = 0;
    for (const sm of this.activeSmokes) {
      const d = eyePos.distanceTo(sm.position);
      if (d < sm.radius * 1.08) {
        const fade = sm.age > sm.duration - 2.2 ? Math.max(0, (sm.duration - sm.age) / 2.2) : 1.0;
        const inner = Math.max(0, Math.min(1, 1 - (d - sm.radius * 0.45) / (sm.radius * 0.63)));
        maxDensity = Math.max(maxDensity, inner * fade * 0.94);
      }
    }
    return maxDensity;
  }
}
