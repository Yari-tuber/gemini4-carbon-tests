import * as THREE from 'three';
import { BuildingCollider, VehicleKind } from '../types';

export class CameraRig {
  public camera: THREE.PerspectiveCamera;
  public yaw = Math.PI * 0.75;
  public pitch = 0.22;

  private currentPos = new THREE.Vector3(195, 22, 110);
  private currentLook = new THREE.Vector3(195, 2, 95);
  private shakeAmount = 0;

  // Sky-Cam Protagonist Switch state (GTA V/VI signature 3-step zoom)
  public isSkySwitching = false;
  private switchTimer = 0;
  private switchDuration = 1.65;
  private switchFrom = new THREE.Vector3();
  private switchTo = new THREE.Vector3();
  private onSwitchMidpoint: (() => void) | null = null;
  private midpointTriggered = false;
  private onStepSound: ((step: number) => void) | null = null;
  private lastStepPlayed = -1;

  // Cinematic stunt jump timer
  public stuntCamTimer = 0;

  // Title screen orbit angle
  private titleOrbitAngle = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.25, 1400);
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public addShake(amount: number): void {
    this.shakeAmount = Math.min(1.4, this.shakeAmount + amount);
  }

  public startSkySwitch(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    onMidpoint: () => void,
    onStepSound: (step: number) => void
  ): void {
    if (this.isSkySwitching) return;
    this.isSkySwitching = true;
    this.switchTimer = 0;
    this.switchFrom.copy(fromPos);
    this.switchTo.copy(toPos);
    this.onSwitchMidpoint = onMidpoint;
    this.midpointTriggered = false;
    this.onStepSound = onStepSound;
    this.lastStepPlayed = 0;
    onStepSound(0);
  }

  public updateTitleOrbit(dt: number): void {
    this.titleOrbitAngle += dt * 0.14;
    const cx = 225;
    const cz = 20;
    const radius = 82;
    this.camera.position.set(
      cx + Math.cos(this.titleOrbitAngle) * radius,
      28 + Math.sin(this.titleOrbitAngle * 1.7) * 6,
      cz + Math.sin(this.titleOrbitAngle) * radius
    );
    this.camera.lookAt(200, 10, 0);
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
  }

  public update(
    dt: number,
    mouseDX: number,
    mouseDY: number,
    targetPos: THREE.Vector3,
    targetHeading: number,
    isAiming: boolean,
    inVehicle: boolean,
    vehicleKind: VehicleKind | null,
    vehicleSpeed: number,
    colliders: BuildingCollider[]
  ): void {
    // Handle Sky-Switch cinematic animation
    if (this.isSkySwitching) {
      this.switchTimer += dt;
      const t = Math.min(1, this.switchTimer / this.switchDuration);

      if (t >= 0.36 && this.lastStepPlayed < 1) {
        this.lastStepPlayed = 1;
        this.onStepSound?.(1);
      }
      if (t >= 0.52 && !this.midpointTriggered) {
        this.midpointTriggered = true;
        this.onSwitchMidpoint?.();
      }
      if (t >= 0.72 && this.lastStepPlayed < 2) {
        this.lastStepPlayed = 2;
        this.onStepSound?.(2);
      }

      // 3-step altitude arc
      let altitude = 12;
      if (t < 0.35) {
        const u = t / 0.35;
        const stepped = Math.floor(u * 3) / 3 + (u * 3 - Math.floor(u * 3)) * 0.33;
        altitude = THREE.MathUtils.lerp(8, 145, stepped);
      } else if (t < 0.68) {
        altitude = 145;
      } else {
        const u = (t - 0.68) / 0.32;
        altitude = THREE.MathUtils.lerp(145, 7, u * u);
      }

      const panT = THREE.MathUtils.smoothstep(t, 0.28, 0.72);
      const groundX = THREE.MathUtils.lerp(this.switchFrom.x, this.switchTo.x, panT);
      const groundZ = THREE.MathUtils.lerp(this.switchFrom.z, this.switchTo.z, panT);

      this.currentPos.set(groundX + 10, altitude, groundZ + 14);
      this.currentLook.set(groundX, 1.5, groundZ);
      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLook);

      if (t >= 1) {
        this.isSkySwitching = false;
      }
      return;
    }

    // Mouse look
    const sens = isAiming ? 0.0018 : 0.0026;
    this.yaw -= mouseDX * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + mouseDY * sens, -0.42, 1.08);

    // Subtle auto-align behind vehicle when driving without moving mouse
    if (inVehicle && Math.abs(mouseDX) < 0.5 && Math.abs(vehicleSpeed) > 3.5 && !isAiming) {
      const desiredYaw = targetHeading + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 2.4);
      this.pitch = THREE.MathUtils.lerp(this.pitch, vehicleKind === 'helicopter' ? 0.28 : 0.19, dt * 2.0);
    }

    // Stunt Jump Dramatic Low Side Angle
    if (this.stuntCamTimer > 0) {
      this.stuntCamTimer -= dt;
      const sideX = targetPos.x + Math.cos(targetHeading + 1.1) * 11;
      const sideZ = targetPos.z + Math.sin(targetHeading + 1.1) * 11;
      this.currentPos.lerp(new THREE.Vector3(sideX, Math.max(1.8, targetPos.y - 1.2), sideZ), Math.min(1, dt * 8));
      this.currentLook.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 0.8, targetPos.z), Math.min(1, dt * 12));
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 50, dt * 6);
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(this.currentPos);
      this.camera.lookAt(this.currentLook);
      return;
    }

    // Compute desired camera distance & shoulder offset
    let dist = 5.2;
    let heightOffset = 1.65;
    let rightOffset = 0.45;
    let desiredFov = 62;

    if (inVehicle) {
      if (vehicleKind === 'helicopter') {
        dist = 14.5;
        heightOffset = 3.8;
        rightOffset = 0;
        desiredFov = 68;
      } else if (vehicleKind === 'boat') {
        dist = 10.5;
        heightOffset = 2.6;
        rightOffset = 0;
        desiredFov = 66 + Math.min(14, Math.abs(vehicleSpeed) * 0.25);
      } else {
        dist = 7.8 + Math.min(2.4, Math.abs(vehicleSpeed) * 0.045);
        heightOffset = 2.15;
        rightOffset = 0;
        desiredFov = 62 + Math.min(18, Math.abs(vehicleSpeed) * 0.34);
      }
    } else if (isAiming) {
      dist = 2.35;
      heightOffset = 1.62;
      rightOffset = 0.72;
      desiredFov = 46;
    }

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, desiredFov, Math.min(1, dt * 8));
    this.camera.updateProjectionMatrix();

    // Forward direction camera is looking
    const cosPitch = Math.cos(this.pitch);
    const forwardX = -Math.sin(this.yaw) * cosPitch;
    const forwardY = -Math.sin(this.pitch);
    const forwardZ = -Math.cos(this.yaw) * cosPitch;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const pivotX = targetPos.x + rightX * rightOffset;
    const pivotY = targetPos.y + heightOffset;
    const pivotZ = targetPos.z + rightZ * rightOffset;

    let desiredCamX = pivotX - forwardX * dist;
    let desiredCamY = Math.max(0.85, pivotY - forwardY * dist);
    let desiredCamZ = pivotZ - forwardZ * dist;

    // Simple building AABB push-out so camera never clips inside skyscrapers
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (
        desiredCamY < b.height &&
        desiredCamX > b.minX - 0.6 &&
        desiredCamX < b.maxX + 0.6 &&
        desiredCamZ > b.minZ - 0.6 &&
        desiredCamZ < b.maxZ + 0.6
      ) {
        // Pull camera closer to pivot
        desiredCamX = THREE.MathUtils.lerp(pivotX, desiredCamX, 0.35);
        desiredCamZ = THREE.MathUtils.lerp(pivotZ, desiredCamZ, 0.35);
        break;
      }
    }

    const followLerp = isAiming ? 1 - Math.exp(-24 * dt) : 1 - Math.exp(-14 * dt);
    this.currentPos.lerp(new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ), followLerp);

    const lookTarget = new THREE.Vector3(
      pivotX + forwardX * 28,
      pivotY + forwardY * 28,
      pivotZ + forwardZ * 28
    );
    if (inVehicle && !isAiming) {
      lookTarget.set(targetPos.x - Math.sin(this.yaw) * 6, targetPos.y + 1.4, targetPos.z - Math.cos(this.yaw) * 6);
    }
    this.currentLook.lerp(lookTarget, followLerp);

    // Apply camera shake
    if (this.shakeAmount > 0.001) {
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.8);
      this.camera.position.set(
        this.currentPos.x + (Math.random() - 0.5) * this.shakeAmount,
        this.currentPos.y + (Math.random() - 0.5) * this.shakeAmount,
        this.currentPos.z + (Math.random() - 0.5) * this.shakeAmount
      );
    } else {
      this.camera.position.copy(this.currentPos);
    }

    this.camera.lookAt(this.currentLook);
  }

  public getAimRay(outOrigin: THREE.Vector3, outDir: THREE.Vector3): void {
    outOrigin.copy(this.camera.position);
    this.camera.getWorldDirection(outDir);
  }
}
