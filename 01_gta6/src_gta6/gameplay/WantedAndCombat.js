import * as THREE from 'three';
import { createHumanoidCharacterMesh } from '../entities/CharacterSystem.js';

// ============================================================================
// GTA VI: Vice City (Leonida) — Weapons, Shooting, Explosions, Pedestrians,
// AI Traffic & 6-Star VCPD Police Pursuit + Police Helicopter Searchlight!
// ============================================================================

export const WEAPONS = [
  { id: 'unarmed', name: 'UNARMED · 徒手格斗', damage: 35, rate: 0.38, range: 3.4, spread: 0, icon: '👊', ammo: '∞' },
  { id: 'pistol', name: 'HEAVY PISTOL · 战术手枪', damage: 38, rate: 0.24, range: 85, spread: 0.015, icon: '🔫', ammo: 240 },
  { id: 'smg', name: 'MICRO SMG · 微型冲锋枪', damage: 24, rate: 0.09, range: 75, spread: 0.04, icon: '⚡', ammo: 600 },
  { id: 'rifle', name: 'CARBINE RIFLE · 突击步枪', damage: 42, rate: 0.11, range: 120, spread: 0.02, icon: '🎯', ammo: 450 },
  { id: 'shotgun', name: 'PUMP SHOTGUN · 霰弹枪', damage: 28, pellets: 6, rate: 0.68, range: 42, spread: 0.09, icon: '💥', ammo: 96 },
  { id: 'rpg', name: 'RPG LAUNCHER · 火箭筒', damage: 300, rate: 1.35, range: 160, spread: 0.005, icon: '🚀', ammo: 24 }
];

export class WantedAndCombatSystem {
  constructor(scene, cityMap, protagonistSystem, vehicleManager, audioEngine, onCrimeEvent) {
    this.scene = scene;
    this.cityMap = cityMap;
    this.protagonists = protagonistSystem;
    this.vehicleManager = vehicleManager;
    this.audio = audioEngine;
    this.onCrimeEvent = onCrimeEvent;

    // Weapon state
    this.weaponIndex = 1; // Default Heavy Pistol ready
    this.fireCooldown = 0;
    this.explosiveAmmoCheat = false;

    // Wanted state (0 to 6 stars)
    this.wantedStars = 0;
    this.wantedHeat = 0;
    this.evadeTimer = 0;
    this.isEvading = false;

    // Entities
    this.pedestrians = [];
    this.copsOnFoot = [];
    this.tracers = [];
    this.rockets = [];
    this.explosions = [];
    this.cashDrops = [];

    this._spawnPedestrians(42);
    this._spawnAITraffic(14);
    this._initPoliceHelicopter();
  }

  getEquippedWeapon() {
    return WEAPONS[this.weaponIndex];
  }

  selectWeapon(index) {
    this.weaponIndex = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    const w = WEAPONS[this.weaponIndex];
    this.protagonists.setEquippedWeaponVisual(w.id);
    return w;
  }

  _spawnPedestrians(count) {
    const tops = [0xff47b6, 0x00f0ff, 0xffbe2e, 0x22ffaa, 0xffffff, 0xb55cff, 0xff5733];
    const pants = [0x223355, 0xf2e4c8, 0x181a24, 0x3d6899, 0xff47b6];
    const skins = [0xe5b18c, 0xc98a63, 0x8d5534, 0xf2c6a5];

    for (let i = 0; i < count; i++) {
      // Distribute along Ocean Drive, Vice Beach & Vice Blvd
      const laneChoice = i % 3;
      const x = laneChoice === 0 ? (63 + (i % 2) * 21) : laneChoice === 1 ? (102 + Math.random() * 14) : (4 + (i % 2) * 20);
      const z = (Math.random() - 0.5) * 310;

      const mesh = createHumanoidCharacterMesh({
        skinColor: skins[i % skins.length],
        topColor: tops[i % tops.length],
        pantsColor: pants[i % pants.length],
        hairColor: 0x1f1410,
        hasPonytail: i % 2 === 0
      });
      const y = Math.max(0.04, this.cityMap.getGroundHeight(x, z));
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      this.pedestrians.push({
        mesh,
        x,
        y,
        z,
        yaw: Math.random() < 0.5 ? 0 : Math.PI,
        speed: 1.8 + Math.random() * 1.1,
        panicTimer: 0,
        health: 50,
        dead: false,
        respawnTimer: 0,
        walkCycle: Math.random() * 10
      });
    }
  }

  _spawnAITraffic(count) {
    const types = ['cheetah', 'banshee', 'muscle', 'lowrider'];
    const avenues = [74, 14, -56];
    for (let i = 0; i < count; i++) {
      const avX = avenues[i % avenues.length];
      const dir = i % 2 === 0 ? 1 : -1;
      const laneX = avX + (dir > 0 ? 3.6 : -3.6);
      const z = -150 + (i * 24) % 300;
      const type = types[i % types.length];
      const v = this.vehicleManager.spawnVehicle(
        type,
        laneX,
        0.05,
        z,
        dir > 0 ? 0 : Math.PI,
        null,
        true
      );
      v.aiDir = dir;
      v.aiBaseX = laneX;
    }
  }

  _initPoliceHelicopter() {
    // 4-6 Star VCPD Police Helicopter overhead with volumetric spotlight cone!
    this.policeHeliGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.6, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x141926, roughness: 0.4 })
    );
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.06, 0.36),
      new THREE.MeshBasicMaterial({ color: 0xcccccc })
    );
    rotor.position.y = 1.15;

    // Volumetric searchlight cone pointing down at the player
    const coneGeo = new THREE.ConeGeometry(8.5, 36, 16, 1, true);
    coneGeo.translate(0, -18, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xdff6ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const searchCone = new THREE.Mesh(coneGeo, coneMat);

    this.policeHeliGroup.add(body, rotor, searchCone);
    this.policeHeliRotor = rotor;
    this.policeHeliGroup.visible = false;
    this.scene.add(this.policeHeliGroup);
  }

  addWantedHeat(amount, reasonText = '') {
    this.wantedHeat += amount;
    this.evadeTimer = 0;
    this.isEvading = false;

    const newStars = Math.min(6, Math.ceil(this.wantedHeat / 100));
    if (newStars > this.wantedStars) {
      this.wantedStars = newStars;
      this._reinforcePoliceForStars();
      if (this.onCrimeEvent && reasonText) {
        this.onCrimeEvent(reasonText, this.wantedStars);
      }
    }
  }

  clearWanted() {
    this.wantedStars = 0;
    this.wantedHeat = 0;
    this.evadeTimer = 0;
    this.isEvading = false;

    // Remove foot cops & disarm police cruisers
    for (const c of this.copsOnFoot) {
      this.scene.remove(c.mesh);
    }
    this.copsOnFoot.length = 0;

    for (const v of this.vehicleManager.vehicles) {
      if (v.isPolicePursuit) {
        v.isPolicePursuit = false;
        v.sirenOn = false;
      }
    }
    this.policeHeliGroup.visible = false;
  }

  _reinforcePoliceForStars() {
    const pPos = this.protagonists.getActiveActor().pos;

    // Spawn VCPD foot officers near player
    const desiredFootCops = Math.min(6, this.wantedStars * 2);
    while (this.copsOnFoot.length < desiredFootCops) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 14;
      const cx = pPos.x + Math.cos(ang) * dist;
      const cz = pPos.z + Math.sin(ang) * dist;

      const mesh = createHumanoidCharacterMesh({
        skinColor: 0xdba382,
        topColor: 0x162447, // VCPD dark navy uniform
        pantsColor: 0x10182b,
        hairColor: 0x1a1a1a,
        hasCap: true
      });
      mesh.position.set(cx, 0.05, cz);
      this.scene.add(mesh);

      this.copsOnFoot.push({
        mesh,
        x: cx,
        y: 0.05,
        z: cz,
        yaw: 0,
        health: 80,
        shootCooldown: 1.0 + Math.random()
      });
    }

    // Spawn pursuing VCPD Police Cruisers at 2+ Stars
    if (this.wantedStars >= 2) {
      const activePoliceCars = this.vehicleManager.vehicles.filter((v) => v.isPolicePursuit && !v.exploded);
      if (activePoliceCars.length < Math.min(3, this.wantedStars - 1)) {
        const spawnZ = pPos.z + (Math.random() < 0.5 ? 48 : -48);
        const pv = this.vehicleManager.spawnVehicle('police', 74, 0.05, spawnZ, 0, 0x151924, true);
        pv.isPolicePursuit = true;
        pv.sirenOn = true;
      }
    }
  }

  tryFireWeapon(camera, aimRaycaster) {
    if (this.fireCooldown > 0) return false;
    const weapon = this.getEquippedWeapon();
    const actor = this.protagonists.getActiveActor();

    //Inside vehicle, only allow Micro SMG or Heavy Pistol drive-by!
    if (this.protagonists.currentVehicle && weapon.id !== 'smg' && weapon.id !== 'pistol') {
      this.selectWeapon(2); // Auto-switch to Micro SMG for drive-by!
    }

    const w = this.getEquippedWeapon();
    this.fireCooldown = w.rate;
    this.audio.playGunshot(w.id);

    const origin = new THREE.Vector3(actor.pos.x, actor.pos.y + 1.38, actor.pos.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    // RPG physical projectile
    if (w.id === 'rpg' || this.explosiveAmmoCheat) {
      if (w.id === 'rpg') {
        const rocketMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8).rotateX(Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xff9d2e })
        );
        rocketMesh.position.copy(origin).addScaledVector(dir, 1.4);
        rocketMesh.lookAt(origin.clone().addScaledVector(dir, 10));
        this.scene.add(rocketMesh);
        this.rockets.push({
          mesh: rocketMesh,
          pos: rocketMesh.position,
          dir: dir.clone().normalize(),
          speed: 58,
          life: 3.2
        });
        this.addWantedHeat(65, 'RPG Launch on Ocean Drive!');
        return true;
      }
    }

    // Melee punch
    if (w.id === 'unarmed') {
      this._checkHitAlongRay(origin, dir, w.range, w.damage);
      return true;
    }

    // Firearm pellets / bullets
    const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const shotDir = dir.clone();
      shotDir.x += (Math.random() - 0.5) * w.spread;
      shotDir.y += (Math.random() - 0.5) * w.spread;
      shotDir.z += (Math.random() - 0.5) * w.spread;
      shotDir.normalize();

      const hitPoint = this._checkHitAlongRay(origin, shotDir, w.range, w.damage);
      this._spawnBulletTracer(origin.clone().addScaledVector(shotDir, 0.8), hitPoint);

      if (this.explosiveAmmoCheat) {
        this.triggerExplosion(hitPoint.x, hitPoint.y, hitPoint.z, 6.5);
      }
    }

    this.addWantedHeat(18, 'Shots Fired in Vice City');
    return true;
  }

  _checkHitAlongRay(origin, dir, maxRange, damage) {
    let closestDist = maxRange;
    let hitType = null;
    let hitTarget = null;

    // 1. Check Explosive Gas Pumps
    for (const prop of this.cityMap.explosiveProps) {
      if (prop.exploded) continue;
      const d = this._raySphereIntersect(origin, dir, new THREE.Vector3(prop.x, prop.y, prop.z), prop.radius);
      if (d !== null && d < closestDist) {
        closestDist = d;
        hitType = 'gas_pump';
        hitTarget = prop;
      }
    }

    // 2. Check Vehicles
    for (const v of this.vehicleManager.vehicles) {
      if (v.exploded || v === this.protagonists.currentVehicle) continue;
      const d = this._raySphereIntersect(origin, dir, new THREE.Vector3(v.x, v.y + 0.8, v.z), 2.1);
      if (d !== null && d < closestDist) {
        closestDist = d;
        hitType = 'vehicle';
        hitTarget = v;
      }
    }

    // 3. Check Cops on foot
    for (const cop of this.copsOnFoot) {
      const d = this._raySphereIntersect(origin, dir, new THREE.Vector3(cop.x, cop.y + 1.0, cop.z), 0.75);
      if (d !== null && d < closestDist) {
        closestDist = d;
        hitType = 'cop';
        hitTarget = cop;
      }
    }

    // 4. Check Pedestrians
    for (const ped of this.pedestrians) {
      if (ped.dead) continue;
      const d = this._raySphereIntersect(origin, dir, new THREE.Vector3(ped.x, ped.y + 1.0, ped.z), 0.72);
      if (d !== null && d < closestDist) {
        closestDist = d;
        hitType = 'ped';
        hitTarget = ped;
      }
    }

    const endPoint = origin.clone().addScaledVector(dir, closestDist);

    if (hitType === 'gas_pump') {
      hitTarget.exploded = true;
      hitTarget.mesh.material.color.setHex(0x222222);
      this.triggerExplosion(hitTarget.x, hitTarget.y, hitTarget.z, 14);
    } else if (hitType === 'vehicle') {
      hitTarget.health -= damage;
      this.vehicleManager.spawnSmokeParticle(endPoint.x, endPoint.y, endPoint.z, 0xffaa33, 0.8);
      if (hitTarget.health <= 0 && !hitTarget.exploded) {
        this.blowUpVehicle(hitTarget);
      }
    } else if (hitType === 'cop') {
      hitTarget.health -= damage;
      if (hitTarget.health <= 0) {
        this._spawnCashBundle(hitTarget.x, hitTarget.y, hitTarget.z, 250);
        this.scene.remove(hitTarget.mesh);
        this.copsOnFoot.splice(this.copsOnFoot.indexOf(hitTarget), 1);
        this.addWantedHeat(55, 'VCPD Officer Down!');
      }
    } else if (hitType === 'ped') {
      hitTarget.health -= damage;
      if (hitTarget.health <= 0) {
        this._knockDownPedestrian(hitTarget);
      }
    }

    return endPoint;
  }

  _raySphereIntersect(origin, dir, center, radius) {
    const oc = origin.clone().sub(center);
    const b = oc.dot(dir);
    const c = oc.dot(oc) - radius * radius;
    const h = b * b - c;
    if (h < 0) return null;
    const t = -b - Math.sqrt(h);
    return t > 0 ? t : null;
  }

  _spawnBulletTracer(start, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  _knockDownPedestrian(ped) {
    ped.dead = true;
    ped.respawnTimer = 14;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = ped.y + 0.2;
    this._spawnCashBundle(ped.x, ped.y, ped.z, 85 + Math.floor(Math.random() * 140));
    this.addWantedHeat(38, 'Civilian Assault on Ocean Drive');
  }

  _spawnCashBundle(x, y, z, amount) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    mesh.position.set(x, y + 0.25, z);
    this.scene.add(mesh);
    this.cashDrops.push({ mesh, x, y, z, amount });
  }

  blowUpVehicle(v) {
    if (v.exploded) return;
    v.exploded = true;
    v.speed = 0;
    v.sirenOn = false;
    v.mesh.userData.paintMat.color.setHex(0x1e1b1b);
    v.mesh.userData.bodyGroup.position.y += 1.4;
    v.mesh.userData.bodyGroup.rotation.z = 0.28;
    this.triggerExplosion(v.x, v.y + 1.0, v.z, 11);
    this.addWantedHeat(85, 'Vehicle Explosion in Leonida!');
  }

  triggerExplosion(x, y, z, radius = 10) {
    this.audio.playExplosion();

    // Multi-layered fiery fireball spheres
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff4a3, transparent: true, opacity: 0.95 })
    );
    core.position.set(x, y, z);

    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff451e, transparent: true, opacity: 0.8 })
    );
    outer.position.set(x, y, z);

    this.scene.add(core, outer);
    this.explosions.push({ core, outer, life: 0.65, maxLife: 0.65, maxRadius: radius * 0.65 });

    // Chain-damage nearby vehicles & peds
    for (const v of this.vehicleManager.vehicles) {
      if (v.exploded) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < radius) {
        v.health -= (1 - d / radius) * 140;
        if (v.health <= 0) this.blowUpVehicle(v);
      }
    }

    for (const ped of this.pedestrians) {
      if (!ped.dead && Math.hypot(ped.x - x, ped.z - z) < radius) {
        this._knockDownPedestrian(ped);
      }
    }
  }

  update(dt) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    const activeActor = this.protagonists.getActiveActor();
    const pPos = activeActor.pos;
    const playerVeh = this.protagonists.currentVehicle;

    // 1. Update Bullet Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 2. Update RPG Rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.pos.addScaledVector(r.dir, r.speed * dt);
      this.vehicleManager.spawnSmokeParticle(r.pos.x, r.pos.y, r.pos.z, 0xffaa44, 0.75);

      const groundY = this.cityMap.getGroundHeight(r.pos.x, r.pos.z);
      const col = this.cityMap.resolveHorizontalCollision(r.pos.x, r.pos.z, r.pos.y, 0.4);
      let hitVeh = false;
      for (const v of this.vehicleManager.vehicles) {
        if (!v.exploded && v !== playerVeh && Math.hypot(v.x - r.pos.x, v.y + 0.8 - r.pos.y, v.z - r.pos.z) < 2.4) {
          hitVeh = true;
          break;
        }
      }

      if (r.life <= 0 || r.pos.y <= groundY || col.hit || hitVeh) {
        this.triggerExplosion(r.pos.x, Math.max(0.5, r.pos.y), r.pos.z, 12);
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }

    // 3. Update Fireball Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      if (ex.life <= 0) {
        this.scene.remove(ex.core, ex.outer);
        this.explosions.splice(i, 1);
        continue;
      }
      const prog = 1 - ex.life / ex.maxLife;
      const scale = 1 + prog * ex.maxRadius;
      ex.core.scale.setScalar(scale * 0.7);
      ex.outer.scale.setScalar(scale);
      ex.core.material.opacity = (1 - prog) * 0.9;
      ex.outer.material.opacity = (1 - prog) * 0.7;
    }

    // 4. Update Cash Drops pickup
    for (let i = this.cashDrops.length - 1; i >= 0; i--) {
      const c = this.cashDrops[i];
      c.mesh.rotation.y += dt * 3;
      if (Math.hypot(c.x - pPos.x, c.z - pPos.z) < 2.4) {
        this.protagonists.cash += c.amount;
        this.audio.playCashPickup();
        this.scene.remove(c.mesh);
        this.cashDrops.splice(i, 1);
      }
    }

    // 5. Update Pedestrians (walking & car run-over check)
    for (const ped of this.pedestrians) {
      if (ped.dead) {
        ped.respawnTimer -= dt;
        if (ped.respawnTimer <= 0) {
          ped.dead = false;
          ped.health = 50;
          ped.mesh.rotation.x = 0;
          ped.z = (Math.random() - 0.5) * 300;
        }
        continue;
      }

      ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      if (ped.z > 165) ped.yaw = Math.PI;
      if (ped.z < -165) ped.yaw = 0;
      ped.y = Math.max(0.04, this.cityMap.getGroundHeight(ped.x, ped.z));
      ped.mesh.position.set(ped.x, ped.y, ped.z);
      ped.mesh.rotation.y = ped.yaw;
      this.protagonists.animateHumanoid({ mesh: ped.mesh, walkCycle: (ped.walkCycle += dt * 5) }, ped.speed, 0, false, false, false);

      // Check if player vehicle hits pedestrian at speed
      if (playerVeh && Math.abs(playerVeh.speed) > 9) {
        if (Math.hypot(playerVeh.x - ped.x, playerVeh.z - ped.z) < 1.9) {
          this._knockDownPedestrian(ped);
        }
      }
    }

    // 6. Update AI Traffic & Pursuing Police Cruisers
    for (const v of this.vehicleManager.vehicles) {
      if (v === playerVeh || v.exploded || !v.isAI) continue;

      if (v.isPolicePursuit && this.wantedStars > 0) {
        // Police Cruiser pursuit steering toward player!
        const dx = pPos.x - v.x;
        const dz = pPos.z - v.z;
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - v.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        v.yaw += Math.sign(diff) * Math.min(Math.abs(diff), 2.1 * dt);
        v.speed = 24;
        v.x += Math.sin(v.yaw) * v.speed * dt;
        v.z += Math.cos(v.yaw) * v.speed * dt;
        v.mesh.position.set(v.x, v.y, v.z);
        v.mesh.rotation.y = v.yaw;
      } else {
        // Normal traffic cruising along avenues
        v.speed = 14;
        v.z += v.aiDir * v.speed * dt;
        if (v.z > 175) v.z = -175;
        if (v.z < -175) v.z = 175;
        v.mesh.position.set(v.x, v.y, v.z);
      }
    }

    // 7. Update Foot Police & Wanted Cooldown
    if (this.wantedStars > 0) {
      let minCopDist = 999;

      for (const cop of this.copsOnFoot) {
        const dx = pPos.x - cop.x;
        const dz = pPos.z - cop.z;
        const dist = Math.hypot(dx, dz);
        minCopDist = Math.min(minCopDist, dist);
        cop.yaw = Math.atan2(dx, dz);
        cop.mesh.rotation.y = cop.yaw;

        if (dist > 11) {
          cop.x += (dx / dist) * 5.6 * dt;
          cop.z += (dz / dist) * 5.6 * dt;
          cop.mesh.position.set(cop.x, cop.y, cop.z);
        }

        cop.shootCooldown -= dt;
        if (cop.shootCooldown <= 0 && dist < 38) {
          cop.shootCooldown = 1.35;
          this.audio.playGunshot('pistol');
          const start = new THREE.Vector3(cop.x, cop.y + 1.35, cop.z);
          const end = new THREE.Vector3(pPos.x + (Math.random() - 0.5) * 1.5, pPos.y + 1.0, pPos.z + (Math.random() - 0.5) * 1.5);
          this._spawnBulletTracer(start, end);
          this.protagonists.takeDamage(5);
        }
      }

      // 4+ Stars Police Helicopter overhead with searchlight!
      if (this.wantedStars >= 4) {
        this.policeHeliGroup.visible = true;
        const t = performance.now() * 0.001;
        this.policeHeliGroup.position.set(
          pPos.x + Math.cos(t * 0.7) * 14,
          34,
          pPos.z + Math.sin(t * 0.7) * 14
        );
        this.policeHeliGroup.lookAt(pPos.x, 34, pPos.z);
        this.policeHeliRotor.rotation.y += dt * 28;
        minCopDist = 20;
      } else {
        this.policeHeliGroup.visible = false;
      }

      // Evade line-of-sight timer
      if (minCopDist > 52) {
        this.isEvading = true;
        this.evadeTimer += dt;
        if (this.evadeTimer > 12) {
          this.clearWanted();
        }
      } else {
        this.isEvading = false;
        this.evadeTimer = 0;
      }
    }
  }
}
