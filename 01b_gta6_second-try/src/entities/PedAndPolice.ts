import * as THREE from 'three';
import { BuildingCollider } from '../types';
import {
  CharacterStyle,
  RiggedCharacter,
  animateCharacterRig,
  createCharacterRig,
  setRigWeapon
} from './CharacterMesh';
import { CityBuilder } from '../world/CityBuilder';
import { VehicleInstance, VehicleSystem } from './VehicleSystem';
import { PropsAndFX } from '../world/PropsAndFX';
import { AudioEngine } from '../core/AudioEngine';
import { buildVehicleMesh } from './VehicleMesh';

export interface NpcEntity {
  id: number;
  role: 'civilian' | 'police' | 'swat' | 'gang';
  rig: RiggedCharacter;
  position: THREE.Vector3;
  heading: number;
  health: number;
  dead: boolean;
  deadTimer: number;
  panicTimer: number;
  shootCooldown: number;
  missionTag?: string;
}

export class PedAndPoliceSystem {
  private scene: THREE.Scene;
  private city: CityBuilder;
  private vehicles: VehicleSystem;
  private fx: PropsAndFX;
  private audio: AudioEngine;

  public npcs: NpcEntity[] = [];
  private nextNpcId = 1;

  // Wanted System State (0..5 Stars)
  public wantedLevel = 0;
  public crimePoints = 0;
  public loseSightTimer = 0;
  public inCooldown = false;
  public bustedProgress = 0;

  private policeSpawnTimer = 0;
  private policeCars: VehicleInstance[] = [];

  // 3+ Star Police Helicopter with Volumetric Spotlight!
  public chopperGroup: THREE.Group | null = null;
  public chopperPos = new THREE.Vector3(0, 42, 0);
  public chopperHealth = 260;
  private chopperMainRotor: THREE.Object3D | null = null;
  private chopperShootTimer = 0;
  private chopperOrbitAngle = 0;

  constructor(
    scene: THREE.Scene,
    city: CityBuilder,
    vehicles: VehicleSystem,
    fx: PropsAndFX,
    audio: AudioEngine
  ) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.fx = fx;
    this.audio = audio;

    this.seedInitialPedestrians();
  }

  private seedInitialPedestrians(): void {
    // Sidewalk & Beach pedestrians
    for (let i = 0; i < 34; i++) {
      const onBeach = i < 10;
      const x = onBeach
        ? 248 + Math.random() * 48
        : this.city.roadsX[i % this.city.roadsX.length] + (Math.random() > 0.5 ? 13.5 : -13.5);
      const z = -290 + Math.random() * 580;
      this.spawnNpc('civilian', x, z);
    }
  }

  public spawnNpc(
    role: 'civilian' | 'police' | 'swat' | 'gang',
    x: number,
    z: number,
    missionTag?: string
  ): NpcEntity {
    const style: CharacterStyle = role;
    const rig = createCharacterRig(style);
    if (role === 'police') setRigWeapon(rig, 'pistol');
    else if (role === 'swat') setRigWeapon(rig, 'rifle');
    else if (role === 'gang') setRigWeapon(rig, 'smg');
    else setRigWeapon(rig, 'fists');

    rig.root.position.set(x, 0, z);
    const heading = Math.random() * Math.PI * 2;
    rig.root.rotation.y = heading;
    this.scene.add(rig.root);

    const ent: NpcEntity = {
      id: this.nextNpcId++,
      role,
      rig,
      position: new THREE.Vector3(x, 0, z),
      heading,
      health: role === 'swat' ? 150 : role === 'police' || role === 'gang' ? 100 : 65,
      dead: false,
      deadTimer: 0,
      panicTimer: 0,
      shootCooldown: 0.6 + Math.random() * 0.8,
      missionTag
    };
    this.npcs.push(ent);
    return ent;
  }

  public reportCrime(points: number, minStars = 1): void {
    this.crimePoints += points;
    let newStars = this.wantedLevel;
    if (this.crimePoints >= 220) newStars = 5;
    else if (this.crimePoints >= 140) newStars = 4;
    else if (this.crimePoints >= 75) newStars = 3;
    else if (this.crimePoints >= 30) newStars = 2;
    else if (this.crimePoints >= 8) newStars = 1;

    this.wantedLevel = Math.min(5, Math.max(this.wantedLevel, minStars, newStars));
    this.loseSightTimer = 0;
    this.inCooldown = false;
  }

  public clearWanted(): void {
    this.wantedLevel = 0;
    this.crimePoints = 0;
    this.loseSightTimer = 0;
    this.inCooldown = false;
    this.bustedProgress = 0;

    if (this.chopperGroup) {
      this.scene.remove(this.chopperGroup);
      this.chopperGroup = null;
    }

    // Dismiss active police pursuit cars
    for (const pc of this.policeCars) {
      pc.sirenOn = false;
      pc.driverType = 'none';
    }
    this.policeCars = [];
  }

  public alertPanicNearby(origin: THREE.Vector3, radius = 45): void {
    for (const n of this.npcs) {
      if (n.dead || n.role !== 'civilian') continue;
      if (n.position.distanceTo(origin) < radius) {
        n.panicTimer = 10 + Math.random() * 6;
        n.heading = Math.atan2(n.position.x - origin.x, n.position.z - origin.z);
      }
    }
  }

  public damageNpc(npc: NpcEntity, amount: number, fromPlayer: boolean): boolean {
    if (npc.dead) return false;
    npc.health -= amount;
    if (npc.role === 'civilian') {
      npc.panicTimer = 12;
      if (fromPlayer) this.reportCrime(10, 1);
    } else if (npc.role === 'police' || npc.role === 'swat') {
      if (fromPlayer) this.reportCrime(28, 2);
    }

    if (npc.health <= 0) {
      npc.dead = true;
      npc.deadTimer = 16;
      setRigWeapon(npc.rig, 'fists');
      if (fromPlayer) {
        if (npc.role === 'police' || npc.role === 'swat') this.reportCrime(35, 3);
        const dropAmt =
          npc.role === 'gang'
            ? 350 + Math.floor(Math.random() * 400)
            : npc.role === 'civilian'
            ? 40 + Math.floor(Math.random() * 90)
            : 120;
        this.fx.spawnCashBundle(npc.position, dropAmt);
      }
      return true;
    }
    return false;
  }

  public damageChopper(amount: number): boolean {
    if (!this.chopperGroup) return false;
    this.chopperHealth -= amount;
    if (this.chopperHealth <= 0) {
      this.fx.spawnExplosion(this.chopperPos);
      this.audio.playExplosion();
      this.scene.remove(this.chopperGroup);
      this.chopperGroup = null;
      return true;
    }
    return false;
  }

  public getNearestPoliceDist(pos: THREE.Vector3): number {
    let best = 999;
    for (const n of this.npcs) {
      if (!n.dead && (n.role === 'police' || n.role === 'swat')) {
        best = Math.min(best, n.position.distanceTo(pos));
      }
    }
    for (const pc of this.policeCars) {
      if (!pc.exploded && pc.sirenOn) {
        best = Math.min(best, pc.position.distanceTo(pos));
      }
    }
    if (this.chopperGroup) {
      best = Math.min(best, Math.hypot(this.chopperPos.x - pos.x, this.chopperPos.z - pos.z));
    }
    return best;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerInVehicle: VehicleInstance | null,
    playerHealth: number,
    colliders: BuildingCollider[],
    onHitPlayer: (dmg: number) => void,
    onBusted: () => void,
    onWantedEvaded: () => void
  ): void {
    // 1. Wanted Level Dispatch & Evasion Logic
    if (this.wantedLevel > 0) {
      const nearestCop = this.getNearestPoliceDist(playerPos);
      const spotted = nearestCop < (this.chopperGroup ? 78 : 52);

      if (spotted) {
        this.loseSightTimer = 0;
        this.inCooldown = false;
      } else {
        this.loseSightTimer += dt;
        if (this.loseSightTimer > 4.0) {
          this.inCooldown = true;
        }
        if (this.loseSightTimer > 17.0) {
          this.clearWanted();
          onWantedEvaded();
        }
      }

      // Spawn pursuing police cruisers & units
      this.policeSpawnTimer -= dt;
      const desiredUnits = this.wantedLevel * 2;
      const activePoliceCount = this.npcs.filter(
        (n) => !n.dead && (n.role === 'police' || n.role === 'swat')
      ).length;

      if (this.policeSpawnTimer <= 0 && activePoliceCount < desiredUnits + 2 && !this.inCooldown) {
        this.policeSpawnTimer = Math.max(3.2, 8.0 - this.wantedLevel * 1.1);
        this.dispatchPoliceSquad(playerPos);
      }

      // 3+ Star Police Helicopter
      this.updatePoliceHelicopter(dt, playerPos, onHitPlayer);

      // 1-Star Arrest ("BUSTED") check if player is cornered on foot at low health
      if (!playerInVehicle && playerHealth < 45 && nearestCop < 2.35 && this.wantedLevel <= 2) {
        this.bustedProgress += dt;
        if (this.bustedProgress > 1.8) {
          this.bustedProgress = 0;
          onBusted();
        }
      } else {
        this.bustedProgress = Math.max(0, this.bustedProgress - dt * 2);
      }
    } else if (this.chopperGroup) {
      this.scene.remove(this.chopperGroup);
      this.chopperGroup = null;
    }

    // 2. Update Police Pursuit Cruisers AI
    for (let i = this.policeCars.length - 1; i >= 0; i--) {
      const pc = this.policeCars[i];
      if (pc.exploded || pc.driverType === 'player') {
        this.policeCars.splice(i, 1);
        continue;
      }
      const dx = playerPos.x - pc.position.x;
      const dz = playerPos.z - pc.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 220) {
        this.scene.remove(pc.visual.root);
        const vIdx = this.vehicles.vehicles.indexOf(pc);
        if (vIdx !== -1) this.vehicles.vehicles.splice(vIdx, 1);
        this.policeCars.splice(i, 1);
        continue;
      }

      if (dist > 15) {
        const desiredHeading = Math.atan2(dx, dz);
        let diff = desiredHeading - pc.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        pc.heading += THREE.MathUtils.clamp(diff, -2.5 * dt, 2.5 * dt);
        pc.speed = THREE.MathUtils.lerp(pc.speed, 28 + this.wantedLevel * 2.5, dt * 3);
        pc.position.x += Math.sin(pc.heading) * pc.speed * dt;
        pc.position.z += Math.cos(pc.heading) * pc.speed * dt;
      } else {
        // Brake & deploy two officers out of cruiser!
        pc.speed *= Math.pow(0.08, dt);
        if (pc.driverType === 'police') {
          pc.driverType = 'none';
          const role = pc.kind === 'swat' ? 'swat' : 'police';
          this.spawnNpc(role, pc.position.x + 2.1, pc.position.z);
          this.spawnNpc(role, pc.position.x - 2.1, pc.position.z);
        }
      }
    }

    // 3. Update All Pedestrians, Police & Gang NPCs
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];

      if (n.dead) {
        n.deadTimer -= dt;
        animateCharacterRig(n.rig, dt, 0, false, 0, false, true);
        if (n.deadTimer <= 0) {
          this.scene.remove(n.rig.root);
          this.npcs.splice(i, 1);
          // Replenish ambient civilians so Vice City stays lively
          if (n.role === 'civilian') {
            const rx = this.city.roadsX[Math.floor(Math.random() * this.city.roadsX.length)];
            this.spawnNpc(
              'civilian',
              rx + (Math.random() > 0.5 ? 13.5 : -13.5),
              THREE.MathUtils.clamp(playerPos.z + (Math.random() > 0.5 ? 85 : -85), -320, 320)
            );
          }
        }
        continue;
      }

      // Check vehicle roadkill collision!
      for (const v of this.vehicles.vehicles) {
        if (Math.abs(v.speed) > 9 && v.position.y < 1.5) {
          const d = Math.hypot(v.position.x - n.position.x, v.position.z - n.position.z);
          if (d < v.spec.halfWidth + 0.65) {
            this.fx.spawnImpact(n.position.clone().add(new THREE.Vector3(0, 1, 0)), true);
            this.audio.playCrash(0.5);
            this.damageNpc(n, 120, v === playerInVehicle);
            break;
          }
        }
      }
      if (n.dead) continue;

      const distToPlayer = n.position.distanceTo(playerPos);

      // Recycle very distant ambient civilians closer to player's district
      if (n.role === 'civilian' && !n.missionTag && distToPlayer > 220) {
        const rx = this.city.roadsX[Math.floor(Math.random() * this.city.roadsX.length)];
        n.position.set(
          rx + (Math.random() > 0.5 ? 13.5 : -13.5),
          0,
          THREE.MathUtils.clamp(playerPos.z + (Math.random() - 0.5) * 180, -320, 320)
        );
        n.rig.root.position.copy(n.position);
        continue;
      }

      let moveSpeed = 0;
      let aiming = false;

      if (n.role === 'civilian') {
        if (n.panicTimer > 0) {
          n.panicTimer -= dt;
          moveSpeed = 6.8;
        } else {
          moveSpeed = 1.75;
          if (Math.random() < dt * 0.35) {
            n.heading += (Math.random() - 0.5) * 1.2;
          }
        }
      } else {
        // Armed Hostile (Police, SWAT, or Cartel Gang)
        const isHostile =
          n.role === 'gang' || ((n.role === 'police' || n.role === 'swat') && this.wantedLevel > 0);
        if (isHostile && distToPlayer < 68) {
          n.heading = Math.atan2(playerPos.x - n.position.x, playerPos.z - n.position.z);
          aiming = true;
          moveSpeed = distToPlayer > 18 ? 4.8 : 0;

          n.shootCooldown -= dt;
          if (n.shootCooldown <= 0 && distToPlayer < 55) {
            n.shootCooldown = n.role === 'swat' ? 0.55 : n.role === 'gang' ? 0.65 : 0.95;
            const muzzle = n.position.clone().add(new THREE.Vector3(0, 1.38, 0));
            const spread = new THREE.Vector3(
              (Math.random() - 0.5) * 1.8,
              0.9 + (Math.random() - 0.5) * 1.1,
              (Math.random() - 0.5) * 1.8
            );
            const target = playerPos.clone().add(spread);
            this.fx.spawnMuzzleAndTracer(muzzle, target, 0xffaa44);
            this.audio.playGunshot(n.role === 'swat' ? 'rifle' : 'pistol');

            if (Math.random() < (playerInVehicle ? 0.32 : 0.42)) {
              onHitPlayer(n.role === 'swat' ? 9 : 6);
            }
          }
        }
      }

      if (moveSpeed > 0.05) {
        const nx = n.position.x + Math.sin(n.heading) * moveSpeed * dt;
        const nz = n.position.z + Math.cos(n.heading) * moveSpeed * dt;
        let blocked = this.city.isWaterAt(nx, nz);
        if (!blocked) {
          for (let c = 0; c < colliders.length; c++) {
            const b = colliders[c];
            if (nx > b.minX - 0.5 && nx < b.maxX + 0.5 && nz > b.minZ - 0.5 && nz < b.maxZ + 0.5) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) {
          n.heading += Math.PI * 0.65;
        } else {
          n.position.x = nx;
          n.position.z = nz;
        }
      }

      n.rig.root.position.copy(n.position);
      n.rig.root.rotation.y = n.heading;
      animateCharacterRig(n.rig, dt, moveSpeed, aiming, 0, false, false);
    }
  }

  private dispatchPoliceSquad(playerPos: THREE.Vector3): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 68 + Math.random() * 28;
    const sx = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -340, 235);
    const sz = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -340, 340);

    // Snap to nearest avenue so police cruisers arrive cleanly on roads!
    let bestRx = this.city.roadsX[0];
    for (const rx of this.city.roadsX) {
      if (Math.abs(rx - sx) < Math.abs(bestRx - sx)) bestRx = rx;
    }

    const kind = this.wantedLevel >= 4 ? 'swat' : 'police';
    const cruiser = this.vehicles.spawnVehicle(
      kind,
      bestRx,
      sz,
      Math.atan2(playerPos.x - bestRx, playerPos.z - sz),
      {
        isPoliceUnit: true,
        driverType: 'police'
      }
    );
    cruiser.sirenOn = true;
    this.policeCars.push(cruiser);
  }

  private updatePoliceHelicopter(
    dt: number,
    playerPos: THREE.Vector3,
    onHitPlayer: (dmg: number) => void
  ): void {
    if (this.wantedLevel < 3) {
      if (this.chopperGroup) {
        this.scene.remove(this.chopperGroup);
        this.chopperGroup = null;
      }
      return;
    }

    if (!this.chopperGroup) {
      const built = buildVehicleMesh('helicopter', 0x0f172a);
      this.chopperGroup = built.root;
      this.chopperMainRotor = built.mainRotor ?? null;

      // Add Volumetric Spotlight Cone underneath VCPD Helicopter!
      const coneGeo = new THREE.ConeGeometry(8.5, 36, 16, 1, true);
      coneGeo.translate(0, -18, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const beam = new THREE.Mesh(coneGeo, coneMat);
      beam.position.set(0, 0.5, 1.5);
      this.chopperGroup.add(beam);

      this.chopperPos.set(playerPos.x + 65, 36, playerPos.z + 65);
      this.chopperHealth = 260;
      this.scene.add(this.chopperGroup);
    }

    this.chopperOrbitAngle += dt * 0.52;
    const desiredX = playerPos.x + Math.cos(this.chopperOrbitAngle) * 26;
    const desiredZ = playerPos.z + Math.sin(this.chopperOrbitAngle) * 26;
    this.chopperPos.x = THREE.MathUtils.lerp(this.chopperPos.x, desiredX, dt * 1.8);
    this.chopperPos.z = THREE.MathUtils.lerp(this.chopperPos.z, desiredZ, dt * 1.8);
    this.chopperPos.y = 35 + Math.sin(this.chopperOrbitAngle * 2.2) * 2.0;

    this.chopperGroup.position.copy(this.chopperPos);
    this.chopperGroup.rotation.y = Math.atan2(
      playerPos.x - this.chopperPos.x,
      playerPos.z - this.chopperPos.z
    );

    if (this.chopperMainRotor) {
      this.chopperMainRotor.rotation.y += dt * 30;
    }

    this.chopperShootTimer -= dt;
    if (this.chopperShootTimer <= 0 && !this.inCooldown) {
      this.chopperShootTimer = 1.15;
      const target = playerPos.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 3, 1.0, (Math.random() - 0.5) * 3)
      );
      this.fx.spawnMuzzleAndTracer(this.chopperPos.clone(), target, 0x90e0ef);
      this.audio.playGunshot('rifle');
      if (Math.random() < 0.35) {
        onHitPlayer(7);
      }
    }
  }
}
