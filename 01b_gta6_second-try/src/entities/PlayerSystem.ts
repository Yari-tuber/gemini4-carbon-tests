import * as THREE from 'three';
import { BuildingCollider, ProtagonistId, WeaponDef, WeaponId } from '../types';
import {
  RiggedCharacter,
  animateCharacterRig,
  createCharacterRig,
  setRigWeapon
} from './CharacterMesh';
import { createDefaultArsenal } from './Weapons';
import { VehicleInstance } from './VehicleSystem';
import { CityBuilder } from '../world/CityBuilder';
import { PropsAndFX } from '../world/PropsAndFX';
import { AudioEngine } from '../core/AudioEngine';
import { NpcEntity } from './PedAndPolice';

export interface ProtagonistState {
  id: ProtagonistId;
  name: string;
  cnName: string;
  rig: RiggedCharacter;
  position: THREE.Vector3;
  heading: number;
  vy: number;
  grounded: boolean;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  specialCharge: number; // 0..100
}

export class PlayerSystem {
  private scene: THREE.Scene;
  private city: CityBuilder;
  private fx: PropsAndFX;
  private audio: AudioEngine;

  public lucia: ProtagonistState;
  public jason: ProtagonistState;
  public activeId: ProtagonistId = 'lucia';

  public arsenal: Record<WeaponId, WeaponDef>;
  public currentWeaponId: WeaponId = 'pistol';
  public fireCooldown = 0;

  public currentVehicle: VehicleInstance | null = null;
  public partnerFollowMode = true;
  private partnerShootTimer = 0;

  public specialAbilityActive = false;
  public cash = 2500;

  constructor(scene: THREE.Scene, city: CityBuilder, fx: PropsAndFX, audio: AudioEngine) {
    this.scene = scene;
    this.city = city;
    this.fx = fx;
    this.audio = audio;

    this.arsenal = createDefaultArsenal();

    const luciaRig = createCharacterRig('lucia');
    luciaRig.root.position.set(206, 0, 96);
    setRigWeapon(luciaRig, 'pistol');
    scene.add(luciaRig.root);

    const jasonRig = createCharacterRig('jason');
    jasonRig.root.position.set(204, 0, 93);
    setRigWeapon(jasonRig, 'smg');
    scene.add(jasonRig.root);

    this.lucia = {
      id: 'lucia',
      name: 'LUCIA',
      cnName: '露西娅',
      rig: luciaRig,
      position: new THREE.Vector3(206, 0, 96),
      heading: Math.PI * 0.25,
      vy: 0,
      grounded: true,
      health: 100,
      maxHealth: 100,
      armor: 50,
      maxArmor: 100,
      specialCharge: 100
    };

    this.jason = {
      id: 'jason',
      name: 'JASON',
      cnName: '杰森',
      rig: jasonRig,
      position: new THREE.Vector3(204, 0, 93),
      heading: Math.PI * 0.25,
      vy: 0,
      grounded: true,
      health: 100,
      maxHealth: 100,
      armor: 50,
      maxArmor: 100,
      specialCharge: 100
    };
  }

  public get active(): ProtagonistState {
    return this.activeId === 'lucia' ? this.lucia : this.jason;
  }

  public get partner(): ProtagonistState {
    return this.activeId === 'lucia' ? this.jason : this.lucia;
  }

  public get currentWeapon(): WeaponDef {
    return this.arsenal[this.currentWeaponId];
  }

  public equipWeapon(id: WeaponId): void {
    this.currentWeaponId = id;
    setRigWeapon(this.active.rig, id);
  }

  public switchProtagonistMidpoint(): void {
    // If currently in a vehicle, hand the wheel to the partner or exit cleanly
    this.activeId = this.activeId === 'lucia' ? 'jason' : 'lucia';
    setRigWeapon(this.active.rig, this.currentWeaponId);
    setRigWeapon(this.partner.rig, 'smg');
  }

  public enterVehicle(v: VehicleInstance): void {
    this.currentVehicle = v;
    v.driverType = 'player';
    if (v.isPoliceUnit) v.sirenOn = true;

    // Show driver inside open-top convertibles, bikes, & boats; hide inside closed roofs
    const visibleInside = v.kind === 'convertible' || v.kind === 'bike' || v.kind === 'boat';
    this.active.rig.root.visible = visibleInside;
    if (this.partnerFollowMode) {
      this.partner.rig.root.visible = false;
    }
  }

  public exitVehicle(): void {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    v.driverType = 'none';

    const sideX = Math.cos(v.heading) * (v.spec.halfWidth + 1.15);
    const sideZ = -Math.sin(v.heading) * (v.spec.halfWidth + 1.15);
    const exitY = Math.max(0, v.position.y);

    this.active.position.set(v.position.x - sideX, exitY, v.position.z - sideZ);
    this.active.vy = 0;
    this.active.rig.root.visible = true;
    this.active.rig.root.position.copy(this.active.position);

    if (this.partnerFollowMode) {
      this.partner.position.set(v.position.x + sideX, exitY, v.position.z + sideZ);
      this.partner.rig.root.visible = true;
      this.partner.rig.root.position.copy(this.partner.position);
    }

    this.currentVehicle = null;
  }

  public applyDamage(amount: number): boolean {
    const p = this.active;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, amount * 0.75);
      p.armor -= absorbed;
      amount -= absorbed;
    }
    p.health = Math.max(0, p.health - amount);
    return p.health <= 0;
  }

  public respawnAtSafehouseOrHospital(hospitalX: number, hospitalZ: number): void {
    if (this.currentVehicle) {
      this.exitVehicle();
    }
    this.active.health = 100;
    this.active.armor = 50;
    this.active.specialCharge = 100;
    this.active.position.set(hospitalX, 0, hospitalZ);
    this.active.rig.root.visible = true;
    this.active.rig.root.rotation.set(0, 0, 0);

    this.partner.health = 100;
    this.partner.position.set(hospitalX + 2.2, 0, hospitalZ - 1.5);
    this.partner.rig.root.visible = true;
  }

  public updateOnFoot(
    dt: number,
    moveForward: number,
    moveRight: number,
    sprint: boolean,
    jumpJustPressed: boolean,
    isAiming: boolean,
    camYaw: number,
    camPitch: number,
    colliders: BuildingCollider[]
  ): void {
    const p = this.active;
    const isSwimming = p.position.y <= 0.15 && this.city.isWaterAt(p.position.x, p.position.z);

    // Camera-relative movement direction
    const camFwdX = -Math.sin(camYaw);
    const camFwdZ = -Math.cos(camYaw);
    const camRightX = Math.cos(camYaw);
    const camRightZ = -Math.sin(camYaw);

    let dirX = camFwdX * moveForward + camRightX * moveRight;
    let dirZ = camFwdZ * moveForward + camRightZ * moveRight;
    const len = Math.hypot(dirX, dirZ);
    if (len > 0.001) {
      dirX /= len;
      dirZ /= len;
    }

    const baseSpeed = isSwimming ? 4.6 : sprint && !isAiming ? 8.6 : 4.8;
    const speed = len > 0.01 ? baseSpeed : 0;

    if (isAiming) {
      p.heading = camYaw + Math.PI; // Face camera forward (+Z in character rig faces heading)
    } else if (speed > 0.1) {
      const targetHeading = Math.atan2(dirX, dirZ);
      let diff = targetHeading - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += diff * Math.min(1, dt * 14);
    }

    let nextX = p.position.x + dirX * speed * dt;
    let nextZ = p.position.z + dirZ * speed * dt;

    // Building AABB slide collision
    const r = 0.45;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (p.position.y > b.height) continue;
      if (nextX + r > b.minX && nextX - r < b.maxX && p.position.z + r > b.minZ && p.position.z - r < b.maxZ) {
        nextX = p.position.x;
      }
      if (nextX + r > b.minX && nextX - r < b.maxX && nextZ + r > b.minZ && nextZ - r < b.maxZ) {
        nextZ = p.position.z;
      }
    }

    p.position.x = THREE.MathUtils.clamp(nextX, -415, 535);
    p.position.z = THREE.MathUtils.clamp(nextZ, -415, 415);

    // Jump & Gravity
    const rampInfo = this.city.getRampHeightAt(p.position.x, p.position.z);
    const groundY = isSwimming ? -0.55 : rampInfo.height;

    if (jumpJustPressed && p.grounded && !isSwimming) {
      p.vy = 7.8;
      p.grounded = false;
    }

    if (!p.grounded || p.position.y > groundY) {
      p.vy -= 20 * dt;
      p.position.y += p.vy * dt;
      if (p.position.y <= groundY) {
        p.position.y = groundY;
        p.vy = 0;
        p.grounded = true;
      }
    } else {
      p.position.y = groundY;
    }

    p.rig.root.position.copy(p.position);
    p.rig.root.rotation.y = p.heading;
    animateCharacterRig(p.rig, dt, speed, isAiming, -camPitch, isSwimming, false);
  }

  public updatePartnerAndVehicleSync(
    dt: number,
    npcs: NpcEntity[],
    wantedLevel: number,
    colliders: BuildingCollider[],
    onDamageNpc: (npc: NpcEntity, dmg: number) => void
  ): void {
    // Sync active character position when inside a vehicle
    if (this.currentVehicle) {
      this.active.position.copy(this.currentVehicle.position);
      this.active.heading = this.currentVehicle.heading;
      this.active.rig.root.position.set(
        this.currentVehicle.position.x,
        this.currentVehicle.position.y + this.currentVehicle.spec.seatHeight * 0.35,
        this.currentVehicle.position.z
      );
      this.active.rig.root.rotation.y = this.currentVehicle.heading;

      if (this.partnerFollowMode) {
        this.partner.position.copy(this.currentVehicle.position);
      }
    }

    // Partner AI: follow active protagonist & provide GTA 6 co-op cover fire / passenger drive-by!
    const mate = this.partner;
    if (!this.partnerFollowMode) {
      animateCharacterRig(mate.rig, dt, 0, false, 0, false, false);
      return;
    }

    // Find nearest hostile NPC (police when wanted, or gang member)
    let targetEnemy: NpcEntity | null = null;
    let bestDist = 42;
    for (const n of npcs) {
      if (n.dead) continue;
      const hostile = n.role === 'gang' || ((n.role === 'police' || n.role === 'swat') && wantedLevel > 0);
      if (!hostile) continue;
      const d = n.position.distanceTo(this.active.position);
      if (d < bestDist) {
        bestDist = d;
        targetEnemy = n;
      }
    }

    this.partnerShootTimer -= dt;
    if (targetEnemy && this.partnerShootTimer <= 0) {
      this.partnerShootTimer = 0.48;
      const origin = this.currentVehicle
        ? this.currentVehicle.position.clone().add(new THREE.Vector3(0, 1.35, 0))
        : mate.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const hitPos = targetEnemy.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      this.fx.spawnMuzzleAndTracer(origin, hitPos, 0x00f0ff);
      this.audio.playGunshot('smg');
      this.fx.spawnImpact(hitPos, true);
      onDamageNpc(targetEnemy, 22);
    }

    if (!this.currentVehicle) {
      mate.rig.root.visible = true;
      const dx = this.active.position.x - mate.position.x;
      const dz = this.active.position.z - mate.position.z;
      const dist = Math.hypot(dx, dz);

      // Teleport smoothly if way too far behind
      if (dist > 55) {
        mate.position.set(this.active.position.x - 2.5, this.active.position.y, this.active.position.z - 2.5);
      }

      let spd = 0;
      if (dist > 3.2) {
        spd = dist > 7.5 ? 8.4 : 4.8;
        mate.heading = Math.atan2(dx, dz);
        const nx = mate.position.x + (dx / dist) * spd * dt;
        const nz = mate.position.z + (dz / dist) * spd * dt;
        let blocked = false;
        for (const b of colliders) {
          if (nx > b.minX - 0.4 && nx < b.maxX + 0.4 && nz > b.minZ - 0.4 && nz < b.maxZ + 0.4) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          mate.position.x = nx;
          mate.position.z = nz;
        }
      } else if (targetEnemy) {
        mate.heading = Math.atan2(
          targetEnemy.position.x - mate.position.x,
          targetEnemy.position.z - mate.position.z
        );
      }

      const swimming = this.city.isWaterAt(mate.position.x, mate.position.z);
      mate.position.y = swimming ? -0.55 : 0;
      mate.rig.root.position.copy(mate.position);
      mate.rig.root.rotation.y = mate.heading;
      animateCharacterRig(mate.rig, dt, spd, Boolean(targetEnemy), 0, swimming, false);
    }
  }
}
