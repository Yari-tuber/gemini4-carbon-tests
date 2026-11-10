// Counter-Strike: Dust II — First-Person Player Controller, Gunplay, Spray Recoil & Utility
import * as THREE from 'three';
import { WEAPONS, WEAPON_SLOTS } from '../config/WeaponsData.js';
import { createFirstPersonWeapon } from '../models/WeaponModels.js';

export class PlayerController {
  constructor(camera, viewmodelScene, map, fx, sound) {
    this.camera = camera;
    this.viewmodelScene = viewmodelScene;
    this.map = map;
    this.fx = fx;
    this.sound = sound;

    // Transform & Movement state
    this.team = 'CT';
    this.name = 'YOU (Player)';
    this.isPlayer = true;
    this.pos = new THREE.Vector3(14, -1.6, -29);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.baseFov = 76;
    this.sensitivity = 0.0021;

    this.grounded = true;
    this.crouching = false;
    this.walking = false;
    this.eyeHeight = 1.58;
    this.stepAccum = 0;
    this.currentSurface = 'stone';
    this.tagSlowTimer = 0;

    // Health, Armor & Economy
    this.alive = true;
    this.hp = 100;
    this.armor = 0;
    this.hasHelmet = false;
    this.hasDefuser = false;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;

    // Inventory State
    this.slots = {
      [WEAPON_SLOTS.PRIMARY]: null,   // { id, mag, reserve }
      [WEAPON_SLOTS.SECONDARY]: null, // { id, mag, reserve }
      [WEAPON_SLOTS.MELEE]: { id: 'knife', mag: 1, reserve: 0 },
      [WEAPON_SLOTS.GRENADE]: [],     // array of ids: ['flashbang', 'hegrenade', 'smokegrenade']
      [WEAPON_SLOTS.C4]: null         // { id: 'c4' }
    };
    this.activeSlot = WEAPON_SLOTS.SECONDARY;
    this.activeGrenadeIdx = 0;
    this.lastSlot = WEAPON_SLOTS.MELEE;

    // Weapon Action Timers
    this.fireCooldown = 0;
    this.drawTimer = 0;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.inspectTimer = 0;
    this.boltCycleTimer = 0;
    this.pendingRescopeLevel = 0;
    this.scopeLevel = 0; // 0 = unscoped, 1 = zoom1, 2 = zoom2

    // Recoil & Spray state
    this.shotsFired = 0;
    this.recoilPitch = 0; // deg
    this.recoilYaw = 0;   // deg
    this.aimPunchPitch = 0;
    this.currentSpread = 0.003;

    // Grenade pin-pull state
    this.nadePullTimer = 0;
    this.nadeThrowPower = 1.0;

    // C4 Plant / Defuse state
    this.plantProgress = 0;
    this.lastBeepStep = -1;
    this.defuseProgress = 0;

    // Flashbang blind state
    this.flashAlpha = 0;
    this.flashHoldTimer = 0;

    // Input state
    this.keys = {};
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.justPressedLeft = false;

    // Viewmodel Rig attached to viewmodel camera
    this.vmCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.02, 5.0);
    this.viewmodelScene.add(this.vmCamera);
    this.vmHolder = new THREE.Group();
    this.vmCamera.add(this.vmHolder);
    this.vmMesh = null;
    this.muzzleFlashLight = new THREE.PointLight(0xffb84d, 0, 3.5);
    this.vmCamera.add(this.muzzleFlashLight);
    this.muzzleFlashSprite = this._createMuzzleFlashMesh();
    this.vmHolder.add(this.muzzleFlashSprite);
    this.muzzleFlashTimer = 0;

    this.bobPhase = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.recoilKickZ = 0;
    this.recoilKickPitch = 0;

    this._bindInputs();
  }

  _createMuzzleFlashMesh() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.3, 'rgba(255,190,75,0.85)');
    g.addColorStop(1, 'rgba(255,110,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const mat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.18, 0.18, 0.18);
    sp.visible = false;
    return sp;
  }

  _bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  onMouseMove(dx, dy) {
    if (!this.alive) return;
    const zoomScale = this.scopeLevel > 0 ? (this.camera.fov / this.baseFov) * 0.92 : 1.0;
    const sens = this.sensitivity * zoomScale;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-Math.PI * 0.485, Math.min(Math.PI * 0.485, this.pitch - dy * sens));

    this.swayX = Math.max(-0.035, Math.min(0.035, this.swayX - dx * 0.00012));
    this.swayY = Math.max(-0.035, Math.min(0.035, this.swayY + dy * 0.00012));
  }

  // ==================== INVENTORY & EQUIP LOGIC ====================

  giveDefaultLoadout(team) {
    this.team = team;
    this.slots[WEAPON_SLOTS.PRIMARY] = null;
    const starterId = team === 'CT' ? 'usp' : 'glock';
    const def = WEAPONS[starterId];
    this.slots[WEAPON_SLOTS.SECONDARY] = { id: starterId, mag: def.magSize, reserve: def.reserveAmmo };
    this.slots[WEAPON_SLOTS.MELEE] = { id: 'knife', mag: 1, reserve: 0 };
    this.slots[WEAPON_SLOTS.GRENADE] = [];
    this.slots[WEAPON_SLOTS.C4] = null;
    this.armor = 0;
    this.hasHelmet = false;
    this.hasDefuser = false;
    this.equipSlot(WEAPON_SLOTS.SECONDARY, true);
  }

  refillAllAmmoForNewRound() {
    for (const slot of [WEAPON_SLOTS.PRIMARY, WEAPON_SLOTS.SECONDARY]) {
      const item = this.slots[slot];
      if (item && WEAPONS[item.id]) {
        item.mag = WEAPONS[item.id].magSize;
        item.reserve = WEAPONS[item.id].reserveAmmo;
      }
    }
    this.slots[WEAPON_SLOTS.C4] = null;
  }

  giveWeapon(weaponId) {
    const def = WEAPONS[weaponId];
    if (!def) return false;

    if (def.slot === WEAPON_SLOTS.GRENADE) {
      if (this.slots[WEAPON_SLOTS.GRENADE].length >= 4) return false;
      const countSame = this.slots[WEAPON_SLOTS.GRENADE].filter((g) => g === weaponId).length;
      const maxSame = weaponId === 'flashbang' ? 2 : 1;
      if (countSame >= maxSame) return false;
      this.slots[WEAPON_SLOTS.GRENADE].push(weaponId);
      return true;
    }

    if (def.slot === WEAPON_SLOTS.C4) {
      this.slots[WEAPON_SLOTS.C4] = { id: 'c4', mag: 1, reserve: 0 };
      return true;
    }

    // Drop existing weapon in that slot onto ground if replacing
    if (this.slots[def.slot]) {
      const old = this.slots[def.slot];
      this.fx.dropWeapon(old.id, this.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), old.mag, old.reserve);
    }

    this.slots[def.slot] = { id: weaponId, mag: def.magSize, reserve: def.reserveAmmo };
    this.equipSlot(def.slot, true);
    return true;
  }

  getActiveItem() {
    if (this.activeSlot === WEAPON_SLOTS.GRENADE) {
      const list = this.slots[WEAPON_SLOTS.GRENADE];
      if (!list || list.length === 0) return null;
      this.activeGrenadeIdx = Math.min(this.activeGrenadeIdx, list.length - 1);
      return { id: list[this.activeGrenadeIdx], mag: 1, reserve: list.length - 1 };
    }
    return this.slots[this.activeSlot];
  }

  getActiveWeaponDef() {
    const item = this.getActiveItem();
    return item ? WEAPONS[item.id] : WEAPONS.knife;
  }

  equipSlot(slot, forceRebuild = false) {
    if (slot === WEAPON_SLOTS.GRENADE) {
      const list = this.slots[WEAPON_SLOTS.GRENADE];
      if (!list || list.length === 0) return;
      if (this.activeSlot === WEAPON_SLOTS.GRENADE && !forceRebuild) {
        this.activeGrenadeIdx = (this.activeGrenadeIdx + 1) % list.length;
      } else {
        this.activeGrenadeIdx = 0;
      }
    } else {
      if (!this.slots[slot]) return;
      if (this.activeSlot === slot && !forceRebuild) return;
    }

    if (this.activeSlot !== slot) {
      this.lastSlot = this.activeSlot;
    }
    this.activeSlot = slot;
    this.scopeLevel = 0;
    this.pendingRescopeLevel = 0;
    this.reloadTimer = 0;
    this.inspectTimer = 0;
    this.boltCycleTimer = 0;
    this.nadePullTimer = 0;
    this.shotsFired = 0;

    const def = this.getActiveWeaponDef();
    this.drawTimer = def.drawTime || 0.6;
    if (def.id === 'knife') this.sound.playKnife('draw');

    this._rebuildViewmodel();
  }

  quickSwitch() {
    if (this.lastSlot && (this.slots[this.lastSlot] || (this.lastSlot === WEAPON_SLOTS.GRENADE && this.slots[4].length > 0))) {
      this.equipSlot(this.lastSlot, true);
    } else {
      this.equipSlot(this.activeSlot === WEAPON_SLOTS.MELEE ? WEAPON_SLOTS.SECONDARY : WEAPON_SLOTS.MELEE, true);
    }
  }

  dropCurrentWeapon() {
    if (!this.alive) return;
    if (this.activeSlot === WEAPON_SLOTS.PRIMARY || this.activeSlot === WEAPON_SLOTS.SECONDARY || this.activeSlot === WEAPON_SLOTS.C4) {
      // Don't drop starter pistol if no primary
      if (this.activeSlot === WEAPON_SLOTS.SECONDARY && !this.slots[WEAPON_SLOTS.PRIMARY]) return;
      const item = this.slots[this.activeSlot];
      if (!item) return;
      const forward = this.getLookDirection();
      const dropPos = this.getEyePosition().addScaledVector(forward, 0.9);
      this.fx.dropWeapon(item.id, dropPos, item.mag, item.reserve);
      this.slots[this.activeSlot] = null;

      if (this.slots[WEAPON_SLOTS.PRIMARY]) this.equipSlot(WEAPON_SLOTS.PRIMARY, true);
      else if (this.slots[WEAPON_SLOTS.SECONDARY]) this.equipSlot(WEAPON_SLOTS.SECONDARY, true);
      else this.equipSlot(WEAPON_SLOTS.MELEE, true);
    }
  }

  startReload() {
    const item = this.getActiveItem();
    const def = this.getActiveWeaponDef();
    if (!item || !def.magSize) return;
    if (this.reloadTimer > 0 || this.drawTimer > 0 || this.boltCycleTimer > 0) return;
    if (item.mag >= def.magSize || item.reserve <= 0) return;

    this.scopeLevel = 0;
    this.inspectTimer = 0;
    this.reloadDuration = def.reloadTime;
    this.reloadTimer = def.reloadTime;
    this.sound.playReload(def.reloadTime);
  }

  startInspect() {
    if (this.reloadTimer > 0 || this.drawTimer > 0 || this.scopeLevel > 0) return;
    this.inspectTimer = 3.2;
  }

  toggleScope() {
    const def = this.getActiveWeaponDef();
    if (!def.sniper || this.reloadTimer > 0 || this.drawTimer > 0 || this.boltCycleTimer > 0) return;
    this.scopeLevel = (this.scopeLevel + 1) % 3;
    this.inspectTimer = 0;
    this.sound.playScopeZoom();
  }

  _rebuildViewmodel() {
    if (this.vmMesh) {
      this.vmHolder.remove(this.vmMesh);
      this.vmMesh = null;
    }
    const item = this.getActiveItem();
    if (!item) return;
    this.vmMesh = createFirstPersonWeapon(item.id, this.team);
    // Standard right-handed CS viewmodel anchor
    this.vmMesh.position.set(0.22, -0.20, -0.32);
    this.vmHolder.add(this.vmMesh);
  }

  getEyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  getLookDirection() {
    const totalPitch = this.pitch + THREE.MathUtils.degToRad(this.recoilPitch * 0.72 + this.aimPunchPitch);
    const totalYaw = this.yaw + THREE.MathUtils.degToRad(this.recoilYaw * 0.72);
    const dir = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(totalPitch, totalYaw, 0, 'YXZ');
    dir.applyEuler(euler);
    return dir;
  }

  applyFlashbang(flashPos) {
    if (!this.alive) return;
    const eye = this.getEyePosition();
    const toFlash = new THREE.Vector3().subVectors(flashPos, eye);
    const dist = toFlash.length();
    if (dist > 36) return;
    if (!this.map.hasLineOfSight(eye, flashPos, [])) return;

    toFlash.divideScalar(dist);
    const look = this.getLookDirection();
    const facingDot = look.dot(toFlash); // +1 = staring directly at flash, -1 = turned 180 deg away (背闪!)

    const distFactor = Math.max(0.25, 1 - dist / 38);
    let intensity;
    if (facingDot > 0.55) {
      // Full stare -> full CS whiteout!
      intensity = 1.0 * distFactor;
      this.flashHoldTimer = Math.max(this.flashHoldTimer, 1.55 * distFactor);
    } else if (facingDot > -0.15) {
      // Peripheral vision -> half blind
      intensity = 0.62 * distFactor;
      this.flashHoldTimer = Math.max(this.flashHoldTimer, 0.45 * distFactor);
    } else {
      // Turned away (背闪!! Real CS anti-flash skill!)
      intensity = 0.16 * distFactor;
    }

    this.flashAlpha = Math.min(1.0, Math.max(this.flashAlpha, intensity));
    this.sound.playFlashbang(flashPos, intensity);
  }

  takeDamage(rawDamage, armorPen, part, attacker, weaponId, isWallbang = false) {
    if (!this.alive) return 0;

    let mult = 1.0;
    if (part === 'HEAD') mult = 4.0;
    else if (part === 'STOMACH') mult = 1.25;
    else if (part === 'LEGS') mult = 0.75;

    let dmg = rawDamage * mult;
    const protectedByArmor = (part === 'HEAD' && this.hasHelmet) || (part === 'CHEST' && this.armor > 0) || (part === 'STOMACH' && this.armor > 0);

    if (protectedByArmor) {
      const armorDmg = dmg * (1 - armorPen) * 0.5;
      this.armor = Math.max(0, Math.round(this.armor - armorDmg));
      dmg *= armorPen;
      if (part === 'HEAD') {
        this.sound.playImpact('headshot_helmet');
        this.aimPunchPitch += 2.2;
      } else {
        this.aimPunchPitch += 0.45;
      }
    } else {
      if (part === 'HEAD') {
        this.sound.playImpact('headshot');
        this.aimPunchPitch += 4.5;
      } else {
        this.aimPunchPitch += 1.35; // Unarmored aimpunch!
      }
    }

    const finalDmg = Math.max(1, Math.round(dmg));
    this.hp = Math.max(0, this.hp - finalDmg);
    this.tagSlowTimer = 0.28; // CS tagging slowdown

    if (this.hp <= 0) {
      this.die();
    }
    return finalDmg;
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.scopeLevel = 0;

    // Drop primary weapon & C4 onto Dust2 floor!
    if (this.slots[WEAPON_SLOTS.PRIMARY]) {
      const p = this.slots[WEAPON_SLOTS.PRIMARY];
      this.fx.dropWeapon(p.id, this.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), p.mag, p.reserve);
      this.slots[WEAPON_SLOTS.PRIMARY] = null;
    }
    if (this.slots[WEAPON_SLOTS.C4]) {
      this.fx.dropWeapon('c4', this.pos.clone().add(new THREE.Vector3(0.3, 0.8, 0)), 1, 0);
      this.slots[WEAPON_SLOTS.C4] = null;
    }
  }

  respawnAt(spawnVec) {
    this.alive = true;
    this.hp = 100;
    this.pos.copy(spawnVec);
    this.vel.set(0, 0, 0);
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.aimPunchPitch = 0;
    this.flashAlpha = 0;
    this.flashHoldTimer = 0;
    this.scopeLevel = 0;
    this.reloadTimer = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;

    if (this.slots[WEAPON_SLOTS.PRIMARY]) this.equipSlot(WEAPON_SLOTS.PRIMARY, true);
    else this.equipSlot(WEAPON_SLOTS.SECONDARY, true);
  }

  // ==================== MAIN FRAME UPDATE ====================

  update(dt, { freezeTime, canMove = true, matchCallbacks }) {
    // Decay flashbang blind overlay
    if (this.flashHoldTimer > 0) {
      this.flashHoldTimer = Math.max(0, this.flashHoldTimer - dt);
    } else if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.55);
    }

    if (!this.alive) {
      // Low death camera slump
      this.camera.position.set(this.pos.x, this.pos.y + 0.35, this.pos.z);
      this.camera.rotation.set(-0.15, this.yaw, 0.28, 'YXZ');
      if (this.vmMesh) this.vmMesh.visible = false;
      this.justPressedLeft = false;
      return;
    }

    const item = this.getActiveItem();
    const def = this.getActiveWeaponDef();

    // 1. Movement Physics (Frozen during Freeze Time, just like CS!)
    this.crouching = !!(this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['KeyC']);
    this.walking = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const targetEye = this.crouching ? 1.06 : 1.58;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 13);

    if (!freezeTime && canMove && this.plantProgress <= 0 && this.defuseProgress <= 0) {
      this._updateMovement(dt, def);
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
      // Still snap to ground during freeze time
      const { floorY } = this.map.getSupportingFloorY(this.pos.x, this.pos.y, this.pos.z, 0.40, 0.6);
      if (floorY > -20) this.pos.y = floorY;
    }

    // 2. Pickup dropped weapons / C4 on ground!
    this._checkGroundPickups(matchCallbacks);

    // 3. Weapon Timers (Draw, Reload, Bolt Cycle, Inspect)
    if (this.drawTimer > 0) this.drawTimer = Math.max(0, this.drawTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.inspectTimer > 0) this.inspectTimer = Math.max(0, this.inspectTimer - dt);
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashLight.intensity = 0;
        this.muzzleFlashSprite.visible = false;
      }
    }

    if (this.boltCycleTimer > 0) {
      this.boltCycleTimer = Math.max(0, this.boltCycleTimer - dt);
      if (this.boltCycleTimer <= 0 && this.pendingRescopeLevel > 0) {
        this.scopeLevel = this.pendingRescopeLevel;
        this.pendingRescopeLevel = 0;
        this.sound.playScopeZoom();
      }
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      if (this.reloadTimer <= 0 && item && def.magSize) {
        const needed = def.magSize - item.mag;
        const take = Math.min(needed, item.reserve);
        item.mag += take;
        item.reserve -= take;
      }
    }

    // 4. Recoil Recovery & Dynamic Spread Calculation
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const recovery = def.recoilRecovery || 9.0;
    if (!this.mouseDownLeft || !def.auto || this.fireCooldown <= 0) {
      this.recoilPitch += (0 - this.recoilPitch) * Math.min(1, dt * recovery);
      this.recoilYaw += (0 - this.recoilYaw) * Math.min(1, dt * recovery);
      if (Math.abs(this.recoilPitch) < 0.08 && !this.mouseDownLeft) {
        this.shotsFired = Math.max(0, this.shotsFired - dt * 18);
      }
    }
    this.aimPunchPitch += (0 - this.aimPunchPitch) * Math.min(1, dt * 12);

    let spread = (this.scopeLevel > 0 && def.scopedSpread !== undefined) ? def.scopedSpread : (def.baseSpread || 0.002);
    if (!this.grounded) {
      spread += def.jumpSpread || 0.18;
    } else if (horizSpeed > 0.6) {
      const speedRatio = Math.min(1.2, horizSpeed / 6.2);
      spread += (def.moveSpread || 0.045) * speedRatio;
    }
    if (this.crouching && this.grounded) spread *= 0.68;
    this.currentSpread = spread;

    // 5. Combat Actions (Firing, Knife, Grenade Throw, C4 Plant/Defuse)
    if (!freezeTime) {
      this._handleCombatActions(dt, item, def, matchCallbacks);
    }

    // 6. Camera FOV (Sniper Scope Zoom) & Viewmodel Animation
    let targetFov = this.baseFov;
    if (this.scopeLevel > 0 && def.scopeFovs) {
      targetFov = def.scopeFovs[this.scopeLevel - 1] || 30;
    }
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 18);
      this.camera.updateProjectionMatrix();
    }

    const eye = this.getEyePosition();
    this.camera.position.copy(eye);
    const camPitch = this.pitch + THREE.MathUtils.degToRad(this.recoilPitch * 0.68 + this.aimPunchPitch);
    const camYaw = this.yaw + THREE.MathUtils.degToRad(this.recoilYaw * 0.68);
    this.camera.rotation.set(camPitch, camYaw, 0, 'YXZ');

    this._animateViewmodel(dt, horizSpeed, def);
    this.sound.updateListener(eye, this.yaw);
    this.justPressedLeft = false;
  }

  _updateMovement(dt, def) {
    if (this.tagSlowTimer > 0) this.tagSlowTimer = Math.max(0, this.tagSlowTimer - dt);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wishDir = new THREE.Vector3();
    if (this.keys['KeyW']) wishDir.add(forward);
    if (this.keys['KeyS']) wishDir.sub(forward);
    if (this.keys['KeyD']) wishDir.add(right);
    if (this.keys['KeyA']) wishDir.sub(right);
    if (wishDir.lengthSq() > 0) wishDir.normalize();

    let maxSpeed = 6.55 * (this.scopeLevel > 0 && def.scopedMoveSpeed ? def.scopedMoveSpeed : (def.moveSpeed || 0.9));
    if (this.crouching) maxSpeed *= 0.44;
    else if (this.walking) maxSpeed *= 0.52;
    if (this.tagSlowTimer > 0) maxSpeed *= 0.52;

    if (this.grounded) {
      // Snappy CS ground friction + counter-strafing acceleration
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.001) {
        const drop = Math.max(speed, 2.2) * 10.8 * dt;
        const newSpeed = Math.max(0, speed - drop) / speed;
        this.vel.x *= newSpeed;
        this.vel.z *= newSpeed;
      }
      if (wishDir.lengthSq() > 0) {
        const currentProj = this.vel.x * wishDir.x + this.vel.z * wishDir.z;
        const addSpeed = maxSpeed - currentProj;
        if (addSpeed > 0) {
          const accelSpeed = Math.min(addSpeed, 58.0 * dt);
          this.vel.x += wishDir.x * accelSpeed;
          this.vel.z += wishDir.z * accelSpeed;
        }
      }

      // Jump & Crouch-Jump!
      if (this.keys['Space']) {
        this.vel.y = 6.35;
        this.grounded = false;
      }
    } else {
      // CS Air-Strafe Control!
      if (wishDir.lengthSq() > 0) {
        const airMax = Math.min(maxSpeed, 2.2);
        const currentProj = this.vel.x * wishDir.x + this.vel.z * wishDir.z;
        const addSpeed = airMax - currentProj;
        if (addSpeed > 0) {
          const accelSpeed = Math.min(addSpeed, 22.0 * dt);
          this.vel.x += wishDir.x * accelSpeed;
          this.vel.z += wishDir.z * accelSpeed;
        }
      }
      this.vel.y -= 18.2 * dt; // Crisp CS gravity
    }

    // Apply displacement + Map Collision
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const playerHeight = this.crouching ? 1.18 : 1.72;
    this.map.resolveHorizontal(this.pos, 0.40, playerHeight, 0.52);

    this.pos.y += this.vel.y * dt;

    // Ceiling bump check
    if (this.vel.y > 0) {
      const ceilY = this.map.getCeilingY(this.pos.x, this.pos.y, this.pos.z, 0.36);
      if (this.pos.y + playerHeight > ceilY) {
        this.pos.y = ceilY - playerHeight;
        this.vel.y = 0;
      }
    }

    // Floor support check
    const maxStepUp = this.grounded ? 0.54 : (this.crouching ? 0.62 : 0.36);
    const { floorY, surface } = this.map.getSupportingFloorY(this.pos.x, this.pos.y, this.pos.z, 0.38, maxStepUp);
    this.currentSurface = surface;

    if (this.pos.y <= floorY + 0.03 && this.vel.y <= 0.1) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.grounded = true;
    } else if (this.grounded && floorY > this.pos.y - 0.38 && this.vel.y <= 0) {
      // Smoothly glue down sloped ramps like Pit / A Ramp / CT Ramp!
      this.pos.y = floorY;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }

    // Footstep sound (Silent when holding Shift or crouching!)
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && horizSpeed > 3.6 && !this.walking && !this.crouching) {
      this.stepAccum += horizSpeed * dt;
      if (this.stepAccum > 2.35) {
        this.stepAccum = 0;
        this.sound.playFootstep(this.currentSurface, null);
      }
    }
  }

  _checkGroundPickups(matchCallbacks) {
    const items = this.fx.droppedItems;
    for (let i = items.length - 1; i >= 0; i--) {
      const d = items[i];
      const dist = this.pos.distanceTo(d.pos);
      if (dist > 2.1) continue;

      // Terrorists automatically pick up dropped C4!
      if (d.isC4 && this.team === 'T' && !this.slots[WEAPON_SLOTS.C4]) {
        this.slots[WEAPON_SLOTS.C4] = { id: 'c4', mag: 1, reserve: 0 };
        this.fx.fxGroup.remove(d.mesh);
        items.splice(i, 1);
        this.sound.playBuySound();
        if (matchCallbacks && matchCallbacks.onPickupC4) matchCallbacks.onPickupC4(this);
        continue;
      }

      const wDef = WEAPONS[d.weaponId];
      if (!wDef) continue;

      // Auto-pickup Primary if empty, OR press E to swap weapon!
      const autoPick = wDef.slot === WEAPON_SLOTS.PRIMARY && !this.slots[WEAPON_SLOTS.PRIMARY];
      const manualPick = !!this.keys['KeyE'] && dist < 1.9 && !d.isC4;
      if (autoPick || manualPick) {
        if (manualPick) this.keys['KeyE'] = false;
        if (this.slots[wDef.slot]) {
          const old = this.slots[wDef.slot];
          this.fx.dropWeapon(old.id, this.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), old.mag, old.reserve);
        }
        this.slots[wDef.slot] = { id: d.weaponId, mag: d.ammo, reserve: d.reserve };
        this.fx.fxGroup.remove(d.mesh);
        items.splice(i, 1);
        this.sound.playBuySound();
        this.equipSlot(wDef.slot, true);
        break;
      }
    }
  }

  _handleCombatActions(dt, item, def, matchCallbacks) {
    if (!item || !def) return;

    // --- CT Bomb Defusal (`Hold E` near planted C4!) ---
    if (this.team === 'CT' && matchCallbacks && matchCallbacks.canPlayerDefuse && matchCallbacks.canPlayerDefuse(this)) {
      if (this.keys['KeyE']) {
        if (this.defuseProgress === 0) this.sound.playDefuseStart();
        const defuseTime = this.hasDefuser ? 5.0 : 10.0;
        this.defuseProgress += dt / defuseTime;
        if (this.defuseProgress >= 1.0) {
          this.defuseProgress = 0;
          matchCallbacks.onBombDefused(this);
        }
        return;
      } else {
        this.defuseProgress = 0;
      }
    } else {
      this.defuseProgress = 0;
    }

    // --- T C4 Bomb Plant (`Hold Left-Click` with C4 OR `Hold E` inside Bombsite!) ---
    const inSite = this.map.getBombsiteAt(this.pos);
    const wantsPlantWithE = this.team === 'T' && inSite && this.slots[WEAPON_SLOTS.C4] && this.keys['KeyE'] && !matchCallbacks.isBombPlanted();
    if (wantsPlantWithE && this.activeSlot !== WEAPON_SLOTS.C4) {
      this.equipSlot(WEAPON_SLOTS.C4, true);
      this.drawTimer = 0.1;
    }

    if (def.id === 'c4') {
      const holdingPlant = (this.mouseDownLeft || this.keys['KeyE']) && inSite && this.grounded && !matchCallbacks.isBombPlanted();
      if (holdingPlant && this.drawTimer <= 0) {
        this.plantProgress += dt / 3.15; // 3.15s authentic CS plant time!
        const codeStr = '7355608';
        const digitsShown = Math.min(7, Math.floor(this.plantProgress * 8));
        if (digitsShown !== this.lastBeepStep) {
          this.lastBeepStep = digitsShown;
          this.sound.playC4KeyBeep(digitsShown);
          if (this.vmMesh && this.vmMesh.userData.updateC4Text) {
            this.vmMesh.userData.updateC4Text(codeStr.slice(0, digitsShown).padEnd(7, '_'));
          }
        }
        if (this.plantProgress >= 1.0) {
          this.plantProgress = 0;
          this.lastBeepStep = -1;
          this.slots[WEAPON_SLOTS.C4] = null;
          matchCallbacks.onBombPlanted(this, inSite);
          if (this.slots[WEAPON_SLOTS.PRIMARY]) this.equipSlot(WEAPON_SLOTS.PRIMARY, true);
          else this.equipSlot(WEAPON_SLOTS.SECONDARY, true);
        }
      } else {
        this.plantProgress = 0;
        this.lastBeepStep = -1;
      }
      return;
    }

    // --- Grenade Pin Pull & Throw (Left = Long, Right = Short Pop-Flash, Both = Medium!) ---
    if (def.slot === WEAPON_SLOTS.GRENADE) {
      if (this.drawTimer > 0) return;
      if (this.mouseDownLeft || this.mouseDownRight) {
        this.inspectTimer = 0;
        this.nadePullTimer = Math.min(0.35, this.nadePullTimer + dt);
        if (this.mouseDownLeft && this.mouseDownRight) this.nadeThrowPower = 0.62;
        else if (this.mouseDownLeft) this.nadeThrowPower = 1.0;
        else this.nadeThrowPower = 0.25;
      } else if (this.nadePullTimer > 0.08) {
        // Release -> Throw Grenade!
        const nadeType = item.id;
        const eye = this.getEyePosition();
        const dir = this.getLookDirection();
        this.fx.throwGrenade({
          type: nadeType,
          origin: eye.clone().addScaledVector(dir, 0.35),
          direction: dir,
          throwPower: this.nadeThrowPower,
          thrower: this
        });

        if (matchCallbacks && matchCallbacks.onUtilityThrown) {
          matchCallbacks.onUtilityThrown(this, nadeType);
        }

        // Consume grenade from inventory
        const list = this.slots[WEAPON_SLOTS.GRENADE];
        const idx = list.indexOf(nadeType);
        if (idx >= 0) list.splice(idx, 1);
        this.nadePullTimer = 0;

        if (list.length > 0) this.equipSlot(WEAPON_SLOTS.GRENADE, true);
        else if (this.slots[WEAPON_SLOTS.PRIMARY]) this.equipSlot(WEAPON_SLOTS.PRIMARY, true);
        else this.equipSlot(WEAPON_SLOTS.SECONDARY, true);
      }
      return;
    }

    // --- Knife Slash (Left) & Heavy Backstab (Right) ---
    if (def.id === 'knife') {
      if (this.drawTimer > 0 || this.fireCooldown > 0) return;
      const isLeft = this.mouseDownLeft;
      const isRight = this.mouseDownRight;
      if (!isLeft && !isRight) return;

      this.inspectTimer = 0;
      const heavy = isRight;
      this.fireCooldown = heavy ? def.heavyCooldown : (60 / def.rpm);
      this.recoilKickZ = heavy ? -0.16 : -0.09;
      this.recoilKickPitch = heavy ? 0.38 : 0.22;

      if (matchCallbacks && matchCallbacks.onPlayerKnifeAttack) {
        matchCallbacks.onPlayerKnifeAttack(this, heavy);
      }
      return;
    }

    // --- Firearms (Pistols, SMGs, Shotguns, Rifles, Snipers) ---
    if (this.drawTimer > 0 || this.reloadTimer > 0 || this.boltCycleTimer > 0 || this.fireCooldown > 0) return;

    const wantsFire = def.auto ? this.mouseDownLeft : this.justPressedLeft;
    if (!wantsFire) return;

    if (item.mag <= 0) {
      this.startReload();
      return;
    }

    // FIRE SHOT!
    this.inspectTimer = 0;
    item.mag -= 1;
    this.fireCooldown = 60 / def.rpm;
    this.sound.playGunshot(def.id, null);

    // Muzzle flash & shell casing
    if (!def.silenced) {
      this.muzzleFlashLight.intensity = 5.5;
      this.muzzleFlashTimer = 0.042;
      if (this.vmMesh && this.scopeLevel === 0) {
        const mp = this.vmMesh.userData.muzzleAnchor.position;
        this.muzzleFlashSprite.position.set(0.22 + mp.x, -0.20 + mp.y, -0.32 + mp.z);
        this.muzzleFlashSprite.material.rotation = Math.random() * Math.PI * 2;
        this.muzzleFlashSprite.visible = true;
      }
    }

    const eye = this.getEyePosition();
    const baseLook = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(
        this.pitch + THREE.MathUtils.degToRad(this.recoilPitch),
        this.yaw + THREE.MathUtils.degToRad(this.recoilYaw),
        0,
        'YXZ'
      )
    );

    // Spawn brass shell casing
    const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.fx.spawnShellCasing(
      eye.clone().addScaledVector(baseLook, 0.45).addScaledVector(rightVec, 0.18).add(new THREE.Vector3(0, -0.12, 0)),
      rightVec,
      new THREE.Vector3(0, 1, 0)
    );

    // Fire 1 bullet (or 6 pellets for XM1014!)
    const pellets = def.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const sx = (Math.random() - 0.5) * 2 * this.currentSpread;
      const sy = (Math.random() - 0.5) * 2 * this.currentSpread;
      const shotDir = baseLook.clone();
      shotDir.x += sx;
      shotDir.y += sy;
      shotDir.z += (Math.random() - 0.5) * this.currentSpread;
      shotDir.normalize();

      if (matchCallbacks && matchCallbacks.onFireHitscan) {
        matchCallbacks.onFireHitscan(this, eye, shotDir, def);
      }
    }

    // Advance deterministic CS spray recoil pattern!
    const patIdx = Math.min(Math.floor(this.shotsFired), (def.pattern ? def.pattern.length - 1 : 0));
    const [patYaw, patPitch] = def.pattern ? def.pattern[patIdx] : [0, 0.5];
    this.shotsFired += 1;
    this.recoilPitch = patPitch * (this.crouching ? 0.78 : 1.0);
    this.recoilYaw = patYaw * (this.crouching ? 0.78 : 1.0);

    // Visual viewmodel kickback
    this.recoilKickZ = Math.min(0.085, 0.032 * (def.recoilKick || 1.0));
    this.recoilKickPitch = 0.055 * (def.recoilKick || 1.0);

    // Bolt-action sniper unscope + bolt animation + auto-rescope!
    if (def.boltAction) {
      if (this.scopeLevel > 0) {
        this.pendingRescopeLevel = this.scopeLevel;
        this.scopeLevel = 0;
      }
      this.boltCycleTimer = (60 / def.rpm) * 0.88;
    }

    if (item.mag === 0 && item.reserve > 0 && !def.boltAction) {
      // Slight delay then auto-reload when mag runs dry
      setTimeout(() => {
        if (this.alive && this.getActiveItem() === item && item.mag === 0) {
          this.startReload();
        }
      }, 220);
    }
  }

  _animateViewmodel(dt, horizSpeed, def) {
    if (!this.vmMesh) return;

    // Hide 3D viewmodel while looking through AWP/Scout dual-lens scope!
    this.vmMesh.visible = this.scopeLevel === 0;
    if (!this.vmMesh.visible) return;

    this.swayX += (0 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (0 - this.swayY) * Math.min(1, dt * 10);
    this.recoilKickZ += (0 - this.recoilKickZ) * Math.min(1, dt * 16);
    this.recoilKickPitch += (0 - this.recoilKickPitch) * Math.min(1, dt * 14);

    // Weapon walk bobbing
    let bobX = 0, bobY = 0;
    if (this.grounded && horizSpeed > 0.4) {
      this.bobPhase += dt * horizSpeed * 1.9;
      bobX = Math.cos(this.bobPhase) * 0.009;
      bobY = Math.abs(Math.sin(this.bobPhase)) * -0.010;
    }

    // Draw animation (raise from bottom)
    let drawOffsetY = 0, drawRotX = 0;
    if (this.drawTimer > 0 && def.drawTime) {
      const t = this.drawTimer / def.drawTime;
      drawOffsetY = -t * t * 0.24;
      drawRotX = -t * 0.55;
    }

    // Reload animation (tilt weapon, pull magazine out & slap back in!)
    let reloadRotZ = 0, reloadRotX = 0, magDropY = 0;
    if (this.reloadTimer > 0 && this.reloadDuration > 0) {
      const prog = 1 - this.reloadTimer / this.reloadDuration;
      reloadRotZ = Math.sin(prog * Math.PI) * 0.42;
      reloadRotX = Math.sin(prog * Math.PI) * 0.25;
      if (prog > 0.14 && prog < 0.62) {
        magDropY = -Math.sin(((prog - 0.14) / 0.48) * Math.PI) * 0.22;
      }
    }

    // Weapon Inspect animation (`F` key — admire your AK/AWP/Knife!)
    let inspRotY = 0, inspRotZ = 0, inspRotX = 0;
    if (this.inspectTimer > 0) {
      const p = 1 - this.inspectTimer / 3.2;
      if (def.id === 'knife') {
        inspRotX = Math.sin(p * Math.PI * 2) * 0.45;
        inspRotZ = Math.sin(p * Math.PI) * 0.85;
        inspRotY = p < 0.5 ? Math.sin(p * Math.PI * 2) * Math.PI * 2 : 0;
      } else {
        const wave = Math.sin(p * Math.PI);
        inspRotY = wave * 0.68 * Math.cos(p * Math.PI * 2.0);
        inspRotZ = wave * 0.36;
        inspRotX = wave * 0.18;
      }
    }

    // Grenade pin-pull windup
    let nadePullZ = 0;
    if (this.nadePullTimer > 0) {
      nadePullZ = (this.nadePullTimer / 0.35) * 0.06;
    }

    this.vmMesh.position.set(
      0.22 + this.swayX + bobX,
      -0.20 + this.swayY + bobY + drawOffsetY,
      -0.32 + this.recoilKickZ + nadePullZ
    );
    this.vmMesh.rotation.set(
      this.recoilKickPitch + drawRotX + reloadRotX + inspRotX,
      inspRotY,
      reloadRotZ + inspRotZ
    );

    // Animate reciprocating slide / bolt handle & magazine!
    const ud = this.vmMesh.userData;
    if (ud.magazine) {
      ud.magazine.position.y = magDropY;
    }
    if (ud.slideOrBolt && def.id !== 'knife' && def.slot !== WEAPON_SLOTS.GRENADE) {
      if (def.boltAction && this.boltCycleTimer > 0) {
        const total = (60 / def.rpm) * 0.88;
        const bp = 1 - this.boltCycleTimer / total;
        const pull = bp > 0.22 && bp < 0.78 ? Math.sin(((bp - 0.22) / 0.56) * Math.PI) : 0;
        ud.slideOrBolt.rotation.z = pull * 0.75;
        ud.slideOrBolt.position.z = -0.12 + pull * 0.095;
      } else {
        ud.slideOrBolt.position.z = this.recoilKickZ * 1.4;
      }
    }
  }
}
