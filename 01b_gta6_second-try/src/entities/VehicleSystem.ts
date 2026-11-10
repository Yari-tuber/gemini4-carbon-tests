import * as THREE from 'three';
import { BuildingCollider, VehicleKind, VehicleSpec } from '../types';
import { BuiltVehicleMesh, VEHICLE_SPECS, buildVehicleMesh } from './VehicleMesh';
import { CityBuilder } from '../world/CityBuilder';
import { PropsAndFX } from '../world/PropsAndFX';
import { AudioEngine } from '../core/AudioEngine';

export interface VehicleInstance {
  id: number;
  kind: VehicleKind;
  spec: VehicleSpec;
  visual: BuiltVehicleMesh;
  position: THREE.Vector3;
  heading: number; // 0 = +Z, Math.PI/2 = +X
  speed: number;
  lateralVel: number;
  vy: number;
  grounded: boolean;
  steerAngle: number;
  health: number;
  exploded: boolean;
  isTraffic: boolean;
  isPoliceUnit: boolean;
  isMissionTarget: boolean;
  missionTag?: string;
  driverType: 'none' | 'player' | 'npc' | 'police';
  sirenOn: boolean;
  smokeTimer: number;
  aiTargetRoadAxis: 'x' | 'z';
  aiDirSign: 1 | -1;
}

export class VehicleSystem {
  private scene: THREE.Scene;
  private city: CityBuilder;
  private fx: PropsAndFX;
  private audio: AudioEngine;

  public vehicles: VehicleInstance[] = [];
  private nextId = 1;
  private trafficMaintainTimer = 0;
  private playerHeadlight: THREE.SpotLight;
  public headlightsEnabled = true;

  constructor(scene: THREE.Scene, city: CityBuilder, fx: PropsAndFX, audio: AudioEngine) {
    this.scene = scene;
    this.city = city;
    this.fx = fx;
    this.audio = audio;

    // Dynamic headlight cone for whichever vehicle the player drives!
    this.playerHeadlight = new THREE.SpotLight(0xfff4d6, 0, 52, Math.PI / 4.2, 0.45, 1.2);
    this.scene.add(this.playerHeadlight);
    this.scene.add(this.playerHeadlight.target);

    this.spawnSignatureParkedFleet();
    this.seedInitialTraffic();
  }

  public spawnVehicle(
    kind: VehicleKind,
    x: number,
    z: number,
    heading = 0,
    options?: {
      paintHex?: number;
      isTraffic?: boolean;
      isPoliceUnit?: boolean;
      driverType?: 'none' | 'player' | 'npc' | 'police';
      missionTag?: string;
    }
  ): VehicleInstance {
    const spec = VEHICLE_SPECS[kind];
    const visual = buildVehicleMesh(kind, options?.paintHex);
    const y = kind === 'boat' ? -0.35 : 0;
    visual.root.position.set(x, y, z);
    visual.root.rotation.y = heading;
    this.scene.add(visual.root);

    const inst: VehicleInstance = {
      id: this.nextId++,
      kind,
      spec,
      visual,
      position: new THREE.Vector3(x, y, z),
      heading,
      speed: 0,
      lateralVel: 0,
      vy: 0,
      grounded: true,
      steerAngle: 0,
      health: spec.maxHealth,
      exploded: false,
      isTraffic: options?.isTraffic ?? false,
      isPoliceUnit: options?.isPoliceUnit ?? (kind === 'police' || kind === 'swat'),
      isMissionTarget: Boolean(options?.missionTag),
      missionTag: options?.missionTag,
      driverType: options?.driverType ?? 'none',
      sirenOn: Boolean(options?.isPoliceUnit),
      smokeTimer: 0,
      aiTargetRoadAxis: Math.abs(Math.cos(heading)) > 0.5 ? 'z' : 'x',
      aiDirSign: Math.cos(heading) + Math.sin(heading) >= 0 ? 1 : -1
    };

    this.vehicles.push(inst);
    return inst;
  }

  private spawnSignatureParkedFleet(): void {
    // 1. Lucia & Jason's Burgundy Tulip V8 Muscle Car outside Ocean View Safehouse!
    this.spawnVehicle('muscle', 212, 92, 0, { paintHex: 0xc1121f });
    // 2. Exotic Pink & Cyan Supercars along Ocean Drive
    this.spawnVehicle('supercar', 212, 42, Math.PI, { paintHex: 0xff2e93 });
    this.spawnVehicle('convertible', 212, -38, 0, { paintHex: 0x00f0ff });
    // 3. Sportbike near Vice Beach Boardwalk
    this.spawnVehicle('bike', 231, 68, Math.PI);
    // 4. Muscle Getaway Car near LTD Gasoline (for Mission 1!)
    this.spawnVehicle('muscle', -52, 42, 0, { paintHex: 0xe63946 });
    // 5. Two Speedboats docked at Vice Marina Pier!
    this.spawnVehicle('boat', 368, 148, Math.PI / 2, { paintHex: 0xff2e93 });
    this.spawnVehicle('boat', 368, 172, Math.PI / 2, { paintHex: 0xf8f9fa });
    // 6. Two Vice Maverick Helicopters (Marina Helipad + VCPD Precinct Pad!)
    this.spawnVehicle('helicopter', 265, -320, Math.PI * 0.75, { paintHex: 0x7209b7 });
    this.spawnVehicle('helicopter', -56, 215, 0, { paintHex: 0x1e3a5f });
    // 7. Bonus Supercar on Starfish Island Villa!
    this.spawnVehicle('supercar', 458, 14, -Math.PI / 2, { paintHex: 0xffbe0b });
  }

  private seedInitialTraffic(): void {
    const trafficKinds: VehicleKind[] = ['supercar', 'convertible', 'muscle', 'suv', 'bike'];
    // North-South avenues
    for (const rx of this.city.roadsX) {
      for (let z = -260; z <= 260; z += 130) {
        const dirSign: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        const laneOffset = dirSign > 0 ? -4.8 : 4.8;
        const heading = dirSign > 0 ? 0 : Math.PI;
        const kind = trafficKinds[Math.floor(Math.random() * trafficKinds.length)];
        const v = this.spawnVehicle(kind, rx + laneOffset, z, heading, {
          isTraffic: true,
          driverType: 'npc'
        });
        v.aiTargetRoadAxis = 'z';
        v.aiDirSign = dirSign;
        v.speed = 13 + Math.random() * 5;
      }
    }
  }

  public findNearestEnterable(pos: THREE.Vector3, maxDist = 6.2): VehicleInstance | null {
    let best: VehicleInstance | null = null;
    let bestDist = maxDist;
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const d = v.position.distanceTo(pos);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  public resprayAndRepair(v: VehicleInstance): void {
    const freshColors = [0x00f0ff, 0xff2e93, 0xffbe0b, 0x38ef7d, 0x9b5de5, 0xff5400, 0xffffff];
    const nextColor = freshColors[Math.floor(Math.random() * freshColors.length)];
    v.visual.bodyPaintMat.color.setHex(nextColor);
    v.health = v.spec.maxHealth;
  }

  public damageVehicle(
    v: VehicleInstance,
    amount: number,
    onExplosion: (pos: THREE.Vector3) => void
  ): void {
    if (v.exploded) return;
    v.health -= amount;
    if (v.health <= 0) {
      this.explodeVehicle(v, onExplosion);
    }
  }

  public explodeVehicle(v: VehicleInstance, onExplosion: (pos: THREE.Vector3) => void): void {
    if (v.exploded) return;
    v.exploded = true;
    v.health = 0;
    v.speed = 0;
    v.vy = 8.5;
    v.grounded = false;
    v.driverType = 'none';
    v.sirenOn = false;
    v.visual.bodyPaintMat.color.setHex(0x1e1e22);
    v.visual.bodyPaintMat.roughness = 0.92;
    v.visual.bodyPaintMat.metalness = 0.1;

    this.fx.spawnExplosion(v.position);
    this.audio.playExplosion();
    onExplosion(v.position.clone());
  }

  public update(
    dt: number,
    playerVehicle: VehicleInstance | null,
    controls: {
      throttle: number; // -1..+1
      steer: number; // -1..+1
      handbrake: boolean;
      boost: boolean;
      ascend: boolean;
      descend: boolean;
    },
    focusPos: THREE.Vector3,
    colliders: BuildingCollider[],
    onExplosion: (pos: THREE.Vector3) => void,
    onStuntJump: (rampId: string) => void
  ): void {
    const nowSec = performance.now() * 0.001;

    // Stream traffic around player
    this.trafficMaintainTimer += dt;
    if (this.trafficMaintainTimer > 2.5) {
      this.trafficMaintainTimer = 0;
      this.maintainTrafficBubble(focusPos);
    }

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      // Helicopter rotor animation
      if (v.kind === 'helicopter' && v.visual.mainRotor && v.visual.tailRotor) {
        const spin = v.driverType !== 'none' ? 28 : 2.5;
        v.visual.mainRotor.rotation.y += dt * spin;
        v.visual.tailRotor.rotation.x += dt * spin * 1.4;
      }

      // Flashing Police / SWAT Red & Blue Sirens
      if (v.visual.sirenRedMat && v.visual.sirenBlueMat) {
        if (v.sirenOn && !v.exploded) {
          const flash = Math.sin(nowSec * 18 + v.id) > 0;
          v.visual.sirenRedMat.emissiveIntensity = flash ? 4.5 : 0.3;
          v.visual.sirenBlueMat.emissiveIntensity = flash ? 0.3 : 4.5;
        } else {
          v.visual.sirenRedMat.emissiveIntensity = 0.2;
          v.visual.sirenBlueMat.emissiveIntensity = 0.2;
        }
      }

      // Damaged engine hood smoke
      if (!v.exploded && v.health < v.spec.maxHealth * 0.42) {
        v.smokeTimer -= dt;
        if (v.smokeTimer <= 0) {
          v.smokeTimer = 0.14;
          this.fx.spawnTireSmoke(
            new THREE.Vector3(
              v.position.x + Math.sin(v.heading) * 1.6,
              v.position.y + 1.0,
              v.position.z + Math.cos(v.heading) * 1.6
            )
          );
        }
        // Critical burning cars eventually explode
        if (v.health < v.spec.maxHealth * 0.12) {
          v.health -= dt * 8;
          if (v.health <= 0) {
            this.explodeVehicle(v, onExplosion);
          }
        }
      }

      if (v === playerVehicle && !v.exploded) {
        this.updatePlayerDrivenVehicle(v, dt, controls, colliders, onExplosion, onStuntJump);
      } else if (v.driverType === 'npc' && v.isTraffic && !v.exploded) {
        this.updateTrafficAI(v, dt, focusPos);
      } else {
        // Coast unoccupied or wrecked vehicle to rest + gravity
        v.speed *= Math.pow(0.18, dt);
        v.lateralVel *= Math.pow(0.08, dt);
        this.integrateMotionAndCollisions(v, dt, colliders, onExplosion, onStuntJump, false);
      }

      // Update mesh transform, wheel spin, & body roll/pitch
      this.syncVehicleVisuals(v, dt);
    }

    // Vehicle-to-Vehicle solid collisions near focusPos
    this.resolveVehicleToVehicleCollisions(playerVehicle, onExplosion);

    // Sync active player vehicle headlight beam
    if (playerVehicle && !playerVehicle.exploded && this.headlightsEnabled) {
      const fx = Math.sin(playerVehicle.heading);
      const fz = Math.cos(playerVehicle.heading);
      this.playerHeadlight.intensity = 18;
      this.playerHeadlight.position.set(
        playerVehicle.position.x + fx * 2.1,
        playerVehicle.position.y + 0.95,
        playerVehicle.position.z + fz * 2.1
      );
      this.playerHeadlight.target.position.set(
        playerVehicle.position.x + fx * 26,
        playerVehicle.position.y,
        playerVehicle.position.z + fz * 26
      );
    } else {
      this.playerHeadlight.intensity = 0;
    }
  }

  private updatePlayerDrivenVehicle(
    v: VehicleInstance,
    dt: number,
    controls: {
      throttle: number;
      steer: number;
      handbrake: boolean;
      boost: boolean;
      ascend: boolean;
      descend: boolean;
    },
    colliders: BuildingCollider[],
    onExplosion: (pos: THREE.Vector3) => void,
    onStuntJump: (rampId: string) => void
  ): void {
    if (v.kind === 'helicopter') {
      // Helicopter 3D Flight Controls
      const climb = (controls.ascend ? 1 : 0) - (controls.descend ? 1 : 0);
      v.vy = THREE.MathUtils.lerp(v.vy, climb * 18, dt * 3.5);
      v.position.y = THREE.MathUtils.clamp(v.position.y + v.vy * dt, 0, 145);
      v.grounded = v.position.y <= 0.08;

      if (!v.grounded || controls.ascend) {
        v.heading += controls.steer * v.spec.turnSpeed * dt * 0.95;
        const targetSpeed = controls.throttle * v.spec.maxSpeed;
        v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, dt * 2.2);
        v.position.x += Math.sin(v.heading) * v.speed * dt;
        v.position.z += Math.cos(v.heading) * v.speed * dt;
      } else {
        v.speed *= Math.pow(0.1, dt);
      }

      // Tilt helicopter nose forward when accelerating
      v.visual.bodyTiltGroup.rotation.x = THREE.MathUtils.lerp(
        v.visual.bodyTiltGroup.rotation.x,
        (v.speed / v.spec.maxSpeed) * 0.28,
        dt * 5
      );
      v.visual.bodyTiltGroup.rotation.z = THREE.MathUtils.lerp(
        v.visual.bodyTiltGroup.rotation.z,
        -controls.steer * 0.26,
        dt * 5
      );
      return;
    }

    if (v.kind === 'boat') {
      // Speedboat Water Controls
      const inWater = this.city.isWaterAt(v.position.x, v.position.z);
      const maxSpd = inWater ? v.spec.maxSpeed * (controls.boost ? 1.25 : 1) : 6;
      if (controls.throttle > 0) {
        v.speed = Math.min(maxSpd, v.speed + v.spec.accel * dt * (controls.boost ? 1.4 : 1));
      } else if (controls.throttle < 0) {
        v.speed = Math.max(-14, v.speed - v.spec.brake * dt);
      } else {
        v.speed *= Math.pow(0.35, dt);
      }

      if (Math.abs(v.speed) > 0.6) {
        v.heading += controls.steer * v.spec.turnSpeed * dt * Math.sign(v.speed);
      }
      v.position.x += Math.sin(v.heading) * v.speed * dt;
      v.position.z += Math.cos(v.heading) * v.speed * dt;
      v.position.y = -0.35 + Math.sin(performance.now() * 0.004 + v.position.x * 0.08) * 0.14;

      if (Math.abs(v.speed) > 12 && Math.random() < 0.5) {
        this.fx.spawnTireSmoke(
          new THREE.Vector3(
            v.position.x - Math.sin(v.heading) * 2.8,
            -0.2,
            v.position.z - Math.cos(v.heading) * 2.8
          )
        );
      }
      return;
    }

    // Ground Cars & Bikes Arcade-Sim Physics
    const boostMult = controls.boost && (v.kind === 'supercar' || v.kind === 'convertible' || v.kind === 'muscle' || v.kind === 'bike') ? 1.26 : 1.0;
    const topSpeed = v.spec.maxSpeed * boostMult;

    if (controls.throttle > 0) {
      const accelBoost = v.speed < 0 ? v.spec.brake : v.spec.accel * boostMult;
      v.speed = Math.min(topSpeed, v.speed + accelBoost * dt);
    } else if (controls.throttle < 0) {
      const revAccel = v.speed > 0 ? v.spec.brake : v.spec.accel * 0.6;
      v.speed = Math.max(-16, v.speed - revAccel * dt);
    } else {
      v.speed *= Math.pow(0.32, dt);
    }

    if (controls.handbrake && v.grounded) {
      v.speed *= Math.pow(0.22, dt);
    }

    v.visual.brakeLightMat.emissiveIntensity = controls.throttle < 0 || controls.handbrake ? 4.6 : 1.5;

    // Steering & Handbrake Drift
    v.steerAngle = THREE.MathUtils.lerp(v.steerAngle, controls.steer * 0.52, dt * 12);
    const speedFactor = Math.min(1, Math.abs(v.speed) / 7);
    const dirSign = v.speed >= -0.2 ? 1 : -1;
    const driftTurnBoost = controls.handbrake ? 1.38 : 1.0;

    if (speedFactor > 0.04) {
      v.heading += controls.steer * v.spec.turnSpeed * speedFactor * dirSign * driftTurnBoost * dt;
    }

    // Lateral drift slip when handbraking or hard-cornering at high speed
    if (controls.handbrake && Math.abs(v.speed) > 10 && Math.abs(controls.steer) > 0.1) {
      v.lateralVel = THREE.MathUtils.lerp(v.lateralVel, -controls.steer * Math.abs(v.speed) * 0.42, dt * 6);
      if (v.grounded) {
        this.fx.addSkidmark(v.position.x, v.position.z, v.heading);
        if (Math.random() < 0.55) {
          this.fx.spawnTireSmoke(
            new THREE.Vector3(
              v.position.x - Math.sin(v.heading) * 1.8,
              v.position.y + 0.25,
              v.position.z - Math.cos(v.heading) * 1.8
            )
          );
        }
      }
    } else {
      v.lateralVel *= Math.pow(0.04, dt);
    }

    this.integrateMotionAndCollisions(v, dt, colliders, onExplosion, onStuntJump, true);
  }

  private integrateMotionAndCollisions(
    v: VehicleInstance,
    dt: number,
    colliders: BuildingCollider[],
    onExplosion: (pos: THREE.Vector3) => void,
    onStuntJump: (rampId: string) => void,
    isPlayerCar: boolean
  ): void {
    const fwdX = Math.sin(v.heading);
    const fwdZ = Math.cos(v.heading);
    const rightX = Math.cos(v.heading);
    const rightZ = -Math.sin(v.heading);

    const prevRamp = this.city.getRampHeightAt(v.position.x, v.position.z);

    let nextX = v.position.x + (fwdX * v.speed + rightX * v.lateralVel) * dt;
    let nextZ = v.position.z + (fwdZ * v.speed + rightZ * v.lateralVel) * dt;

    // Keep within outer world bounds
    nextX = THREE.MathUtils.clamp(nextX, -415, 535);
    nextZ = THREE.MathUtils.clamp(nextZ, -415, 415);

    // Building AABB collision & bounce
    const radius = Math.max(v.spec.halfWidth, v.spec.halfLength * 0.72);
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (v.position.y > b.height) continue;
      if (
        nextX + radius > b.minX &&
        nextX - radius < b.maxX &&
        nextZ + radius > b.minZ &&
        nextZ - radius < b.maxZ
      ) {
        const impactSpeed = Math.abs(v.speed);
        if (impactSpeed > 14) {
          this.audio.playCrash(impactSpeed / 25);
          this.damageVehicle(v, impactSpeed * 0.65, onExplosion);
        }
        // Push out along shallowest penetration axis
        const penLeft = Math.abs(nextX + radius - b.minX);
        const penRight = Math.abs(b.maxX - (nextX - radius));
        const penTop = Math.abs(nextZ + radius - b.minZ);
        const penBottom = Math.abs(b.maxZ - (nextZ - radius));
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);

        if (minPen === penLeft) nextX = b.minX - radius;
        else if (minPen === penRight) nextX = b.maxX + radius;
        else if (minPen === penTop) nextZ = b.minZ - radius;
        else nextZ = b.maxZ + radius;

        v.speed *= -0.28;
        break;
      }
    }

    v.position.x = nextX;
    v.position.z = nextZ;

    // Vertical Ramp & Stunt Jump Physics
    const curRamp = this.city.getRampHeightAt(v.position.x, v.position.z);
    if (curRamp.ramp && v.position.y <= curRamp.height + 0.35) {
      v.position.y = curRamp.height;
      const slopeGain = (curRamp.height - prevRamp.height) / Math.max(0.001, dt);
      if (slopeGain > 0) {
        v.vy = Math.max(v.vy, slopeGain * 1.15);
      }
      v.grounded = true;
    } else {
      // Check if vehicle just launched off the lip of a Stunt Ramp at speed!
      if (prevRamp.ramp && !curRamp.ramp && Math.abs(v.speed) > 20 && prevRamp.height > 1.8) {
        v.vy = Math.max(v.vy, Math.abs(v.speed) * 0.36);
        v.grounded = false;
        if (isPlayerCar) {
          onStuntJump(prevRamp.ramp.id);
        }
      }

      if (!v.grounded || v.position.y > 0.02) {
        v.vy -= 21 * dt;
        v.position.y += v.vy * dt;
        if (v.position.y <= 0) {
          v.position.y = 0;
          v.vy = 0;
          v.grounded = true;
        }
      }
    }

    // Water hazard for non-boats!
    if (v.kind !== 'boat' && v.kind !== 'helicopter' && v.position.y <= 0.2 && this.city.isWaterAt(v.position.x, v.position.z)) {
      v.speed *= Math.pow(0.05, dt);
      v.position.y = -0.55;
      this.damageVehicle(v, dt * 45, onExplosion);
    }
  }

  private updateTrafficAI(v: VehicleInstance, dt: number, focusPos: THREE.Vector3): void {
    // Pause gently if player or another vehicle is right ahead
    const aheadX = v.position.x + Math.sin(v.heading) * 7.5;
    const aheadZ = v.position.z + Math.cos(v.heading) * 7.5;
    let blocked = Math.hypot(aheadX - focusPos.x, aheadZ - focusPos.z) < 5.5;

    if (!blocked) {
      for (const other of this.vehicles) {
        if (other === v) continue;
        if (Math.hypot(aheadX - other.position.x, aheadZ - other.position.z) < 5.2) {
          blocked = true;
          break;
        }
      }
    }

    const cruise = blocked ? 0 : 15;
    v.speed = THREE.MathUtils.lerp(v.speed, cruise, dt * 3.5);
    v.position.x += Math.sin(v.heading) * v.speed * dt;
    v.position.z += Math.cos(v.heading) * v.speed * dt;

    // U-turn cleanly at avenue ends
    if (v.position.z > 345 || v.position.z < -345 || v.position.x > 235 || v.position.x < -345) {
      v.heading += Math.PI;
      v.position.x += Math.sin(v.heading) * 4;
      v.position.z += Math.cos(v.heading) * 4;
    }
  }

  private maintainTrafficBubble(focusPos: THREE.Vector3): void {
    // Recycle far-away AI traffic cars to nearby avenues so city always feels bustling
    for (const v of this.vehicles) {
      if (!v.isTraffic || v.driverType !== 'npc') continue;
      if (v.position.distanceTo(focusPos) > 260) {
        const rx = this.city.roadsX[Math.floor(Math.random() * this.city.roadsX.length)];
        const zOff = (Math.random() > 0.5 ? 1 : -1) * (85 + Math.random() * 95);
        const nz = THREE.MathUtils.clamp(focusPos.z + zOff, -320, 320);
        const dirSign: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        v.position.set(rx + (dirSign > 0 ? -4.8 : 4.8), 0, nz);
        v.heading = dirSign > 0 ? 0 : Math.PI;
        v.speed = 14;
        v.exploded = false;
        v.health = v.spec.maxHealth;
      }
    }
  }

  private resolveVehicleToVehicleCollisions(
    playerVehicle: VehicleInstance | null,
    onExplosion: (pos: THREE.Vector3) => void
  ): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      if (a.kind === 'helicopter' && a.position.y > 2.5) continue;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        if (b.kind === 'helicopter' && b.position.y > 2.5) continue;

        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const minDist = a.spec.halfWidth + b.spec.halfWidth + 1.05;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.52;
          const nx = dx / dist;
          const nz = dz / dist;

          a.position.x -= nx * overlap;
          a.position.z -= nz * overlap;
          b.position.x += nx * overlap;
          b.position.z += nz * overlap;

          const relSpeed = Math.abs(a.speed - b.speed);
          if (relSpeed > 12 && (a === playerVehicle || b === playerVehicle)) {
            this.audio.playCrash(relSpeed / 26);
            this.damageVehicle(a, relSpeed * 0.35, onExplosion);
            this.damageVehicle(b, relSpeed * 0.35, onExplosion);
          }
          a.speed *= 0.78;
          b.speed *= 0.78;
        }
      }
    }
  }

  private syncVehicleVisuals(v: VehicleInstance, dt: number): void {
    v.visual.root.position.copy(v.position);
    v.visual.root.rotation.y = v.heading;

    if (v.kind !== 'helicopter') {
      // Body roll during steering / motorcycle lean
      const targetRoll =
        v.kind === 'bike'
          ? -v.steerAngle * Math.min(1, Math.abs(v.speed) / 18) * 0.68
          : v.steerAngle * Math.min(1, Math.abs(v.speed) / 24) * 0.11;
      v.visual.bodyTiltGroup.rotation.z = THREE.MathUtils.lerp(
        v.visual.bodyTiltGroup.rotation.z,
        targetRoll,
        dt * 10
      );

      // Pitch nose up when airborne on stunt jump
      const targetPitch = !v.grounded ? THREE.MathUtils.clamp(-v.vy * 0.025, -0.35, 0.35) : 0;
      v.visual.bodyTiltGroup.rotation.x = THREE.MathUtils.lerp(
        v.visual.bodyTiltGroup.rotation.x,
        targetPitch,
        dt * 8
      );
    }

    // Front wheel steering & 4-wheel spin
    for (const pivot of v.visual.frontSteerPivots) {
      pivot.rotation.y = v.steerAngle;
    }
    const wheelSpin = (v.speed * dt) / 0.36;
    for (const w of v.visual.wheels) {
      w.rotation.x += wheelSpin;
    }
  }
}
