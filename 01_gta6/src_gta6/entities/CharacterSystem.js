import * as THREE from 'three';

// ============================================================================
// GTA VI: Vice City (Leonida) — Dual Protagonist System: LUCIA & JASON
// Features articulated 3D character meshes, weapon holding, swimming,
// companion partner AI, and GTA Satellite Sky-Camera Character Switch!
// ============================================================================

export const PROTAGONISTS = {
  lucia: {
    id: 'lucia',
    name: 'Lucia (露西亚)',
    title: 'Leonida Outlaw · 亡命女主',
    accentColor: '#ff47b6',
    skinColor: 0xd99b78,
    hairColor: 0x1e1412,
    topColor: 0xff2e93, // Iconic GTA 6 pink/magenta fitted top
    pantsColor: 0x3b629c, // Faded blue denim
    shoesColor: 0xffffff,
    hasPonytail: true,
    hasAnkleMonitor: true // Iconic GTA 6 Trailer 1 detail!
  },
  jason: {
    id: 'jason',
    name: 'Jason (杰森)',
    title: 'Vice Partner · 亡命搭档',
    accentColor: '#00f0ff',
    skinColor: 0xe3aa87,
    hairColor: 0x3b281c,
    topColor: 0xf2f4f8, // White tank / teal overshirt accent
    shirtColor: 0x148f8b,
    pantsColor: 0x2c4268,
    shoesColor: 0x222222,
    hasCap: true
  }
};

export function createHumanoidCharacterMesh(config) {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: config.skinColor, roughness: 0.65 });
  const topMat = new THREE.MeshStandardMaterial({ color: config.topColor, roughness: 0.55 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: config.pantsColor, roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: config.shoesColor || 0x222222, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor || 0x1a1210, roughness: 0.8 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.28), topMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  root.add(torso);

  // Optional open overshirt for Jason
  if (config.shirtColor) {
    const jacketMat = new THREE.MeshStandardMaterial({ color: config.shirtColor, roughness: 0.6 });
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.69, 0.3), jacketMat);
    leftPanel.position.set(-0.18, 1.12, 0);
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.69, 0.3), jacketMat);
    rightPanel.position.set(0.18, 1.12, 0);
    root.add(leftPanel, rightPanel);
  }

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.66, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Sunglasses / Vice shades
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.1, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.85, roughness: 0.15 })
  );
  shades.position.set(0, 0.03, 0.16);
  headGroup.add(shades);

  // Hair / Cap
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.16, 0.39), hairMat);
  hairCap.position.set(0, 0.16, -0.01);
  headGroup.add(hairCap);

  if (config.hasPonytail) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), hairMat);
    tail.position.set(0, -0.02, -0.24);
    tail.rotation.x = 0.28;
    headGroup.add(tail);
  }

  if (config.hasCap) {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.6 });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.22), capMat);
    visor.position.set(0, 0.11, -0.24); // Backwards cap like Jason!
    headGroup.add(visor);
  }

  root.add(headGroup);

  // Articulated Arms
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.35, 1.4, 0);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), skinMat);
  leftArm.position.y = -0.26;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  root.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.35, 1.4, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), skinMat);
  rightArm.position.y = -0.26;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);

  // Weapon Mesh socket attached to Right Hand
  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0, -0.52, 0.18);
  rightArmPivot.add(weaponSocket);
  root.add(rightArmPivot);

  // Articulated Legs
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, 0.78, 0);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.21), pantsMat);
  leftLeg.position.y = -0.36;
  leftLeg.castShadow = true;
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.28), shoeMat);
  leftShoe.position.set(0, -0.71, 0.04);
  leftLegPivot.add(leftLeg, leftShoe);

  // Lucia's iconic GTA 6 Trailer 1 flashing ankle monitor!
  if (config.hasAnkleMonitor) {
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.08, 0.25),
      new THREE.MeshBasicMaterial({ color: 0xff2942 })
    );
    monitor.position.set(0, -0.58, 0);
    leftLegPivot.add(monitor);
  }
  root.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.14, 0.78, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.21), pantsMat);
  rightLeg.position.y = -0.36;
  rightLeg.castShadow = true;
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.28), shoeMat);
  rightShoe.position.set(0, -0.71, 0.04);
  rightLegPivot.add(rightLeg, rightShoe);
  root.add(rightLegPivot);

  root.userData = {
    headGroup,
    torso,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    weaponSocket
  };

  return root;
}

export class DualProtagonistSystem {
  constructor(scene, cityMap, environment, audioEngine) {
    this.scene = scene;
    this.cityMap = cityMap;
    this.environment = environment;
    this.audio = audioEngine;

    this.activeId = 'lucia'; // 'lucia' or 'jason'
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 100;
    this.stamina = 100;
    this.cash = 18500;
    this.godMode = false;
    this.superJump = false;

    // Create Lucia & Jason actor states
    this.actors = {
      lucia: this._createActor(PROTAGONISTS.lucia, 65, 0.05, -28, 0),
      jason: this._createActor(PROTAGONISTS.jason, 62, 0.05, -31, 0.4)
    };

    // Equipped weapon visual meshes per actor
    this._attachWeaponVisual(this.actors.lucia, 'unarmed');
    this._attachWeaponVisual(this.actors.jason, 'smg');

    // GTA Satellite Sky-Camera Switch state
    this.switchAnim = {
      active: false,
      timer: 0,
      duration: 1.45,
      fromPos: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      targetId: 'jason'
    };

    this.currentVehicle = null;
    this.partnerFollowEnabled = true;
  }

  _createActor(cfg, x, y, z, yaw) {
    const mesh = createHumanoidCharacterMesh(cfg);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);
    return {
      id: cfg.id,
      cfg,
      mesh,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw,
      walkCycle: 0,
      isSwimming: false,
      isAiming: false,
      inVehicle: false,
      onGround: true,
      shootCooldown: 0
    };
  }

  _attachWeaponVisual(actor, weaponId) {
    const socket = actor.mesh.userData.weaponSocket;
    while (socket.children.length > 0) {
      socket.remove(socket.children[0]);
    }
    if (weaponId === 'unarmed') return;

    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, metalness: 0.8, roughness: 0.25 });
    let gunMesh;
    if (weaponId === 'pistol') {
      gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.32), gunMat);
    } else if (weaponId === 'smg') {
      gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.44), gunMat);
    } else if (weaponId === 'rifle' || weaponId === 'shotgun') {
      gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.78), gunMat);
      gunMesh.position.z = 0.18;
    } else if (weaponId === 'rpg') {
      gunMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1.15, 10),
        new THREE.MeshStandardMaterial({ color: 0x4b5d3b, metalness: 0.5 })
      );
      gunMesh.rotation.x = Math.PI / 2;
      gunMesh.position.z = 0.22;
    }
    if (gunMesh) socket.add(gunMesh);
  }

  getActiveActor() {
    return this.actors[this.activeId];
  }

  getPartnerActor() {
    return this.actors[this.activeId === 'lucia' ? 'jason' : 'lucia'];
  }

  setEquippedWeaponVisual(weaponId) {
    this._attachWeaponVisual(this.getActiveActor(), weaponId);
  }

  triggerCharacterSwitch() {
    if (this.switchAnim.active) return false;
    if (this.currentVehicle) {
      // Instant seat/character swap inside vehicle
      this.activeId = this.activeId === 'lucia' ? 'jason' : 'lucia';
      this.audio.playCharacterSwitchWhoosh();
      return true;
    }

    const curr = this.getActiveActor();
    const next = this.getPartnerActor();

    this.switchAnim.active = true;
    this.switchAnim.timer = 0;
    this.switchAnim.fromPos.copy(curr.pos);
    this.switchAnim.toPos.copy(next.pos);
    this.switchAnim.targetId = next.id;
    this.audio.playCharacterSwitchWhoosh();
    return true;
  }

  animateHumanoid(actor, speed, dt, isAiming, isSwimming, inVehicle) {
    const parts = actor.mesh.userData;
    if (inVehicle) {
      // Seated driving / passenger pose
      parts.leftLegPivot.rotation.x = -Math.PI / 2.2;
      parts.rightLegPivot.rotation.x = -Math.PI / 2.2;
      parts.leftArmPivot.rotation.x = -Math.PI / 2.6;
      parts.rightArmPivot.rotation.x = -Math.PI / 2.6;
      return;
    }

    if (isSwimming) {
      actor.walkCycle += dt * 6.5;
      actor.mesh.rotation.x = 0.55;
      parts.leftArmPivot.rotation.x = Math.sin(actor.walkCycle) * 1.1 - 0.8;
      parts.rightArmPivot.rotation.x = -Math.sin(actor.walkCycle) * 1.1 - 0.8;
      parts.leftLegPivot.rotation.x = Math.sin(actor.walkCycle * 1.5) * 0.5;
      parts.rightLegPivot.rotation.x = -Math.sin(actor.walkCycle * 1.5) * 0.5;
      return;
    }

    actor.mesh.rotation.x = 0;

    if (speed > 0.25) {
      actor.walkCycle += dt * (speed > 7.5 ? 13.5 : 8.5);
      const swing = Math.sin(actor.walkCycle) * (speed > 7.5 ? 0.82 : 0.52);
      parts.leftLegPivot.rotation.x = swing;
      parts.rightLegPivot.rotation.x = -swing;
      parts.leftArmPivot.rotation.x = isAiming ? -1.25 : -swing * 0.75;
      parts.rightArmPivot.rotation.x = isAiming ? -1.48 : swing * 0.75;
    } else {
      parts.leftLegPivot.rotation.x *= 0.82;
      parts.rightLegPivot.rotation.x *= 0.82;
      parts.leftArmPivot.rotation.x = isAiming ? -1.35 : parts.leftArmPivot.rotation.x * 0.82;
      parts.rightArmPivot.rotation.x = isAiming ? -1.52 : parts.rightArmPivot.rotation.x * 0.82;
    }
  }

  updateOnFoot(dt, input, cameraYaw, equippedWeaponId) {
    const active = this.getActiveActor();
    const partner = this.getPartnerActor();

    // Update Sky-Camera Character Switch if active
    if (this.switchAnim.active) {
      this.switchAnim.timer += dt;
      if (this.switchAnim.timer >= this.switchAnim.duration * 0.55 && this.activeId !== this.switchAnim.targetId) {
        this.activeId = this.switchAnim.targetId;
        this.audio.playCharacterSwitchWhoosh();
      }
      if (this.switchAnim.timer >= this.switchAnim.duration) {
        this.switchAnim.active = false;
      }
      return;
    }

    if (this.currentVehicle) {
      // Keep both protagonists synced with the vehicle
      const v = this.currentVehicle;
      active.inVehicle = true;
      const cos = Math.cos(v.yaw);
      const sin = Math.sin(v.yaw);

      // Show characters inside open-top convertibles & boats, hide inside closed roofs
      const showInside = (v.type === 'banshee' || v.type === 'boat');
      active.mesh.visible = showInside;
      active.pos.set(v.x - cos * 0.35, v.y + 0.35, v.z + sin * 0.35);
      active.mesh.rotation.y = v.yaw;
      this.animateHumanoid(active, 0, dt, false, false, true);

      if (this.partnerFollowEnabled) {
        partner.inVehicle = true;
        partner.mesh.visible = showInside;
        partner.pos.set(v.x + cos * 0.35, v.y + 0.35, v.z - sin * 0.35);
        partner.mesh.rotation.y = v.yaw;
        this.animateHumanoid(partner, 0, dt, false, false, true);
      }
      return;
    }

    active.inVehicle = false;
    active.mesh.visible = true;
    partner.inVehicle = false;
    partner.mesh.visible = true;

    // Movement vector relative to camera yaw
    let moveForward = (input.keys['KeyW'] || input.keys['ArrowUp'] ? 1 : 0) -
                      (input.keys['KeyS'] || input.keys['ArrowDown'] ? 1 : 0);
    let moveRight = (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0) -
                    (input.keys['KeyA'] || input.keys['ArrowLeft'] ? 1 : 0);

    const isSprinting = (input.keys['ShiftLeft'] || input.keys['ShiftRight']) && this.stamina > 5;
    if (isSprinting && (moveForward !== 0 || moveRight !== 0)) {
      this.stamina = Math.max(0, this.stamina - dt * 12);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 18);
    }

    const baseSpeed = active.isSwimming ? 5.2 : (isSprinting ? 10.6 : 6.2);
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    let wishX = forwardX * moveForward + rightX * moveRight;
    let wishZ = forwardZ * moveForward + rightZ * moveRight;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) {
      wishX = (wishX / wishLen) * baseSpeed;
      wishZ = (wishZ / wishLen) * baseSpeed;
      if (!input.rightMouseDown) {
        active.yaw = Math.atan2(wishX, wishZ);
      }
    }

    if (input.rightMouseDown) {
      // Face camera crosshairs when aiming
      active.yaw = cameraYaw + Math.PI;
    }

    active.vel.x = THREE.MathUtils.lerp(active.vel.x, wishX, Math.min(1, dt * 12));
    active.vel.z = THREE.MathUtils.lerp(active.vel.z, wishZ, Math.min(1, dt * 12));

    // Jump & Gravity
    const groundY = this.cityMap.getGroundHeight(active.pos.x, active.pos.z);
    const waterY = this.environment.getWaterHeight(active.pos.x, active.pos.z);

    if (waterY > groundY + 0.45) {
      // Swimming in the Atlantic Ocean!
      active.isSwimming = true;
      active.pos.y = THREE.MathUtils.lerp(active.pos.y, waterY - 0.55, dt * 6);
      active.vel.y = 0;
    } else {
      active.isSwimming = false;
      if (active.onGround && input.keys['Space']) {
        active.vel.y = this.superJump ? 18.5 : 8.2;
        active.onGround = false;
      }
      active.vel.y -= 22.0 * dt;
      active.pos.y += active.vel.y * dt;

      // Check rooftop or ground support
      const roofY = this.cityMap.getRoofHeightAt(active.pos.x, active.pos.z);
      const supportY = (roofY > 0 && active.pos.y >= roofY - 1.2) ? roofY : Math.max(0, groundY);
      if (active.pos.y <= supportY) {
        active.pos.y = supportY;
        active.vel.y = 0;
        active.onGround = true;
      }
    }

    // Apply horizontal movement & building collision
    const nextX = active.pos.x + active.vel.x * dt;
    const nextZ = active.pos.z + active.vel.z * dt;
    const resolved = this.cityMap.resolveHorizontalCollision(nextX, nextZ, active.pos.y, 0.55);
    active.pos.x = resolved.x;
    active.pos.z = resolved.z;

    active.mesh.rotation.y = active.yaw;
    const horizSpeed = Math.hypot(active.vel.x, active.vel.z);
    this.animateHumanoid(active, horizSpeed, dt, input.rightMouseDown || equippedWeaponId !== 'unarmed', active.isSwimming, false);

    // Update AI Companion Partner (Jason or Lucia follows player!)
    this._updatePartnerAI(partner, active, dt);
  }

  _updatePartnerAI(partner, leader, dt) {
    if (!this.partnerFollowEnabled) return;
    const dx = leader.pos.x - partner.pos.x;
    const dz = leader.pos.z - partner.pos.z;
    const dist = Math.hypot(dx, dz);

    // Teleport partner if very far (e.g. after rooftop elevator)
    if (dist > 45 || Math.abs(leader.pos.y - partner.pos.y) > 12) {
      partner.pos.set(leader.pos.x - 2.2, leader.pos.y, leader.pos.z - 2.2);
      return;
    }

    let partnerSpeed = 0;
    if (dist > 3.4) {
      partnerSpeed = dist > 7.5 ? 10.2 : 6.0;
      const nx = dx / dist;
      const nz = dz / dist;
      const stepX = partner.pos.x + nx * partnerSpeed * dt;
      const stepZ = partner.pos.z + nz * partnerSpeed * dt;
      const res = this.cityMap.resolveHorizontalCollision(stepX, stepZ, partner.pos.y, 0.55);
      partner.pos.x = res.x;
      partner.pos.z = res.z;
      partner.yaw = Math.atan2(nx, nz);
    }

    const pGround = Math.max(0, this.cityMap.getGroundHeight(partner.pos.x, partner.pos.z));
    const pRoof = this.cityMap.getRoofHeightAt(partner.pos.x, partner.pos.z);
    partner.pos.y = (pRoof > 0 && leader.pos.y >= pRoof - 0.5) ? pRoof : pGround;
    partner.mesh.rotation.y = partner.yaw;
    this.animateHumanoid(partner, partnerSpeed, dt, false, false, false);
  }

  takeDamage(amount) {
    if (this.godMode) return false;
    if (this.armor > 0) {
      const absorb = Math.min(this.armor, amount * 0.75);
      this.armor -= absorb;
      amount -= absorb;
    }
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }
}
