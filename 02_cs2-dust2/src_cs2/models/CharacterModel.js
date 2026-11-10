// Counter-Strike: Dust II — Articulated CT (SAS) & T (Dust2 Elite Crew) 3D Character Rigs
import * as THREE from 'three';
import { createWorldWeaponMesh } from './WeaponModels.js';

const CHAR_MATS = {
  ctSuit:     new THREE.MeshStandardMaterial({ color: 0x223042, roughness: 0.82 }),
  ctVest:     new THREE.MeshStandardMaterial({ color: 0x182028, roughness: 0.72, metalness: 0.15 }),
  ctHelmet:   new THREE.MeshStandardMaterial({ color: 0x263445, roughness: 0.52, metalness: 0.25 }),
  ctVisor:    new THREE.MeshStandardMaterial({ color: 0x111922, roughness: 0.16, metalness: 0.85 }),
  tJacket:    new THREE.MeshStandardMaterial({ color: 0x6f5a3e, roughness: 0.86 }),
  tPants:     new THREE.MeshStandardMaterial({ color: 0x3b3d36, roughness: 0.88 }),
  tRig:       new THREE.MeshStandardMaterial({ color: 0x2c2822, roughness: 0.78 }),
  tKeffiyeh:  new THREE.MeshStandardMaterial({ color: 0xc9bc9c, roughness: 0.88 }),
  tShades:    new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.15, metalness: 0.9 }),
  skin:       new THREE.MeshStandardMaterial({ color: 0xd29f78, roughness: 0.74 }),
  boots:      new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.80 }),
  c4Pack:     new THREE.MeshStandardMaterial({ color: 0xbba276, roughness: 0.80 })
};

export class CharacterRig {
  constructor(ownerEntity, team = 'CT') {
    this.owner = ownerEntity;
    this.team = team;
    this.root = new THREE.Group();

    this.hitboxes = [];
    this.walkPhase = Math.random() * Math.PI * 2;
    this.flinchTimer = 0;
    this.deathProgress = 0;
    this.deathDir = new THREE.Vector3(0, 0, 1);
    this.currentWeaponId = null;

    this._buildRig();
  }

  _registerHitbox(mesh, part) {
    mesh.userData = {
      character: this.owner,
      part
    };
    this.hitboxes.push(mesh);
  }

  _buildRig() {
    const isCT = this.team === 'CT';
    const topMat = isCT ? CHAR_MATS.ctSuit : CHAR_MATS.tJacket;
    const legMat = isCT ? CHAR_MATS.ctSuit : CHAR_MATS.tPants;
    const vestMat = isCT ? CHAR_MATS.ctVest : CHAR_MATS.tRig;

    // Pelvis / Hip root (standing height ~0.92m)
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.set(0, 0.90, 0);
    this.root.add(this.bodyPivot);

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.24), legMat);
    pelvis.castShadow = true;
    pelvis.receiveShadow = true;
    this.bodyPivot.add(pelvis);
    this._registerHitbox(pelvis, 'STOMACH');

    // Torso & Kevlar Rig
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 0.10, 0);
    this.bodyPivot.add(this.torsoPivot);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.25), topMat);
    chest.position.set(0, 0.22, 0);
    chest.castShadow = true;
    chest.receiveShadow = true;
    this.torsoPivot.add(chest);
    this._registerHitbox(chest, 'CHEST');

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.34, 0.29), vestMat);
    vest.position.set(0, 0.23, 0);
    vest.castShadow = true;
    this.torsoPivot.add(vest);

    // Tactical Magazine Pouches on chest
    for (const px of [-0.11, 0, 0.11]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), vestMat);
      pouch.position.set(px, 0.16, -0.16);
      this.torsoPivot.add(pouch);
    }

    // Optional C4 Backpack indicator for T bomb carrier
    this.c4BackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.11), CHAR_MATS.c4Pack);
    this.c4BackMesh.position.set(0, 0.24, 0.19);
    this.c4BackMesh.visible = false;
    this.torsoPivot.add(this.c4BackMesh);

    // Head + Helmet/Keffiyeh + Goggles/Sunglasses
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.46, 0);
    this.torsoPivot.add(this.headPivot);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.24, 0.23),
      isCT ? CHAR_MATS.ctVest : CHAR_MATS.skin
    );
    head.position.set(0, 0.13, 0);
    head.castShadow = true;
    this.headPivot.add(head);
    this._registerHitbox(head, 'HEAD');

    if (isCT) {
      // Tactical SAS Ballistic Helmet & Goggles
      const helm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.27), CHAR_MATS.ctHelmet);
      helm.position.set(0, 0.19, 0.01);
      helm.castShadow = true;
      this.headPivot.add(helm);
      this._registerHitbox(helm, 'HEAD');

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.075, 0.04), CHAR_MATS.ctVisor);
      visor.position.set(0, 0.15, -0.12);
      this.headPivot.add(visor);
    } else {
      // Iconic Dust2 Keffiyeh Headwrap & Dark Aviator Shades
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.26), CHAR_MATS.tKeffiyeh);
      wrap.position.set(0, 0.20, 0.01);
      wrap.castShadow = true;
      this.headPivot.add(wrap);
      this._registerHitbox(wrap, 'HEAD');

      const shades = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.055, 0.03), CHAR_MATS.tShades);
      shades.position.set(0, 0.15, -0.118);
      this.headPivot.add(shades);
    }

    // Arms & Weapon Mount
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(-0.25, 0.38, 0);
    this.torsoPivot.add(this.rightArm);
    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.50, 0.12), topMat);
    rArmMesh.position.set(0, -0.20, -0.12);
    rArmMesh.rotation.x = Math.PI * 0.38;
    rArmMesh.castShadow = true;
    this.rightArm.add(rArmMesh);

    this.leftArm = new THREE.Group();
    this.leftArm.position.set(0.25, 0.38, 0);
    this.torsoPivot.add(this.leftArm);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.50, 0.12), topMat);
    lArmMesh.position.set(-0.08, -0.18, -0.16);
    lArmMesh.rotation.set(Math.PI * 0.40, 0, 0.28);
    lArmMesh.castShadow = true;
    this.leftArm.add(lArmMesh);

    this.weaponSocket = new THREE.Group();
    this.weaponSocket.position.set(-0.08, -0.14, -0.26);
    this.rightArm.add(this.weaponSocket);

    // Articulated Legs + Combat Boots
    const makeLeg = (xOffset) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(xOffset, -0.06, 0);

      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.16), legMat);
      thigh.position.set(0, -0.22, 0);
      thigh.castShadow = true;
      legPivot.add(thigh);
      this._registerHitbox(thigh, 'LEGS');

      const calf = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.36, 0.15), legMat);
      calf.position.set(0, -0.58, 0);
      calf.castShadow = true;
      legPivot.add(calf);
      this._registerHitbox(calf, 'LEGS');

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.12, 0.23), CHAR_MATS.boots);
      boot.position.set(0, -0.78, -0.03);
      boot.castShadow = true;
      legPivot.add(boot);

      this.bodyPivot.add(legPivot);
      return legPivot;
    };

    this.leftLeg = makeLeg(0.10);
    this.rightLeg = makeLeg(-0.10);
  }

  setHeldWeapon(weaponId) {
    if (this.currentWeaponId === weaponId) return;
    this.currentWeaponId = weaponId;
    while (this.weaponSocket.children.length > 0) {
      this.weaponSocket.remove(this.weaponSocket.children[0]);
    }
    if (weaponId) {
      const mesh = createWorldWeaponMesh(weaponId);
      this.weaponSocket.add(mesh);
    }
  }

  triggerFlinch() {
    this.flinchTimer = 0.16;
  }

  triggerDeath(bulletDir) {
    this.deathProgress = 0.001;
    if (bulletDir) {
      this.deathDir.copy(bulletDir).setY(0).normalize();
    }
  }

  resetAlive() {
    this.deathProgress = 0;
    this.flinchTimer = 0;
    this.root.rotation.set(0, 0, 0);
    this.bodyPivot.rotation.set(0, 0, 0);
    this.bodyPivot.position.set(0, 0.90, 0);
  }

  update(dt, { pos, yaw, pitch = 0, speed = 0, crouching = false, blinded = false, hasC4 = false, dead = false }) {
    this.root.position.copy(pos);
    this.c4BackMesh.visible = !!hasC4;

    if (dead) {
      this.deathProgress = Math.min(1.0, this.deathProgress + dt * 3.8);
      const ease = 1 - Math.pow(1 - this.deathProgress, 3);
      this.root.rotation.y = yaw;
      this.bodyPivot.position.y = 0.90 * (1 - ease * 0.82);
      this.bodyPivot.rotation.x = -ease * (Math.PI * 0.47);
      this.bodyPivot.rotation.z = ease * 0.18;
      return;
    }

    this.root.rotation.y = yaw;

    // Smooth crouch lower
    const targetHipY = crouching ? 0.58 : 0.90;
    this.bodyPivot.position.y += (targetHipY - this.bodyPivot.position.y) * Math.min(1, dt * 14);

    // Leg walking stride
    if (speed > 0.35) {
      this.walkPhase += dt * speed * 1.85;
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
    } else {
      const crouchBend = crouching ? 0.45 : 0;
      this.leftLeg.rotation.x += (crouchBend - this.leftLeg.rotation.x) * Math.min(1, dt * 10);
      this.rightLeg.rotation.x += (-crouchBend * 0.5 - this.rightLeg.rotation.x) * Math.min(1, dt * 10);
    }

    // Aim pitch + hit flinch
    let flinchPitch = 0;
    if (this.flinchTimer > 0) {
      this.flinchTimer = Math.max(0, this.flinchTimer - dt);
      flinchPitch = -Math.sin((this.flinchTimer / 0.16) * Math.PI) * 0.25;
    }
    this.headPivot.rotation.x = Math.max(-0.6, Math.min(0.6, pitch * 0.6)) + flinchPitch;
    this.rightArm.rotation.x = Math.max(-0.5, Math.min(0.5, pitch * 0.7));

    // Authentic CS Blinded Animation: bot shields eyes with left arm!
    if (blinded) {
      this.leftArm.rotation.x = 0.95;
      this.leftArm.rotation.z = -0.65;
    } else {
      this.leftArm.rotation.x = Math.max(-0.5, Math.min(0.5, pitch * 0.65));
      this.leftArm.rotation.z = 0;
    }
  }
}
