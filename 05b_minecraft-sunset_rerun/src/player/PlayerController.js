import * as THREE from 'three';
import { PLAYER_CONFIG, WORLD_CONFIG } from '../config.js';
import { BLOCK, BLOCK_DEFS } from '../world/BlockRegistry.js';

export class PlayerController {
  constructor(camera, world, soundEngine, onModeChange) {
    this.camera = camera;
    this.world = world;
    this.sound = soundEngine;
    this.onModeChange = onModeChange;

    this.pos = PLAYER_CONFIG.SPAWN_POS.clone(); // Feet position
    this.vel = new THREE.Vector3(0, -1.5, 0);

    this.yaw = PLAYER_CONFIG.SPAWN_YAW;
    this.pitch = PLAYER_CONFIG.SPAWN_PITCH;
    this.roll = 0;

    this.mode = 'GLIDING'; // 'GLIDING' | 'WALKING'
    this.cinematicIdle = true; // True until first pointer lock click
    this.isLocked = false;
    this.inventoryOpen = false;

    this.onGround = false;
    this.inWater = false;
    this.airSpeed = PLAYER_CONFIG.GLIDE_BASE_SPEED;

    this.keys = new Set();
    this._lastSpaceDownTime = 0;
    this._yawDeltaAccum = 0;
    this._walkBobPhase = 0;
    this._walkBobAmp = 0;
    this._landingDip = 0;
    this._stepDistAccum = 0;
    this._idleOrigin = PLAYER_CONFIG.SPAWN_POS.clone();

    this.camera.rotation.order = 'YXZ';
    this._syncCamera(0, 0);
  }

  bindEvents(domElement) {
    document.addEventListener('keydown', (e) => {
      if (this.inventoryOpen && e.code !== 'KeyE' && e.code !== 'Escape') return;

      const wasDown = this.keys.has(e.code);
      this.keys.add(e.code);

      if (!this.isLocked) return;

      // R: Respawn high in the sky over Sunset Bay in Gliding mode
      if (e.code === 'KeyR' && !wasDown) {
        this.respawnHighGlide();
        return;
      }

      // F: Instant Take-off (from Walking/Swimming) or Fold Glider (if Gliding)
      if (e.code === 'KeyF' && !wasDown) {
        if (this.mode === 'WALKING') {
          this.launchIntoGlide(PLAYER_CONFIG.GLIDE_TAKEOFF_BOOST);
        } else {
          this._setMode('WALKING');
        }
        return;
      }

      // Space: Jump on ground, OR Double-Tap Space / Mid-air Space to deploy Glider!
      if (e.code === 'Space' && !wasDown) {
        const now = performance.now();
        const dtSpace = now - this._lastSpaceDownTime;
        this._lastSpaceDownTime = now;

        if (this.mode === 'WALKING') {
          if (dtSpace < 360 || (!this.onGround && !this.inWater && this.vel.y < 5.5)) {
            this.launchIntoGlide(9.6);
          } else if (this.onGround) {
            this.vel.y = PLAYER_CONFIG.JUMP_SPEED;
            this.onGround = false;
            this.sound?.playJump();
          }
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked || this.inventoryOpen) return;
      const sens = 0.0021;
      const dyaw = -e.movementX * sens;
      const dpitch = -e.movementY * sens;
      this.yaw += dyaw;
      this.pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, this.pitch + dpitch));
      this._yawDeltaAccum += dyaw;
    });

    domElement.addEventListener('click', () => {
      if (!this.isLocked && !this.inventoryOpen) {
        domElement.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (document.pointerLockElement === domElement);
      if (this.isLocked && this.cinematicIdle) {
        this.cinematicIdle = false;
      }
      if (!this.isLocked) {
        this.keys.clear();
      }
    });
  }

  _setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    if (this.onModeChange) this.onModeChange(newMode);
  }

  launchIntoGlide(upwardBoost = PLAYER_CONFIG.GLIDE_TAKEOFF_BOOST) {
    this._setMode('GLIDING');
    this.onGround = false;
    this.vel.y = Math.max(this.vel.y + 4.0, upwardBoost);
    this.airSpeed = Math.max(this.airSpeed, PLAYER_CONFIG.GLIDE_BASE_SPEED);
    if (this.pitch < -0.35) this.pitch = -0.12;
    this.sound?.playTakeoff();
  }

  respawnHighGlide() {
    this.pos.copy(PLAYER_CONFIG.SPAWN_POS);
    this.yaw = PLAYER_CONFIG.SPAWN_YAW;
    this.pitch = PLAYER_CONFIG.SPAWN_PITCH;
    this.roll = 0;
    this.vel.set(0, -1.8, 0);
    this.airSpeed = PLAYER_CONFIG.GLIDE_BASE_SPEED;
    this._setMode('GLIDING');
    this.sound?.playTakeoff();
  }

  update(dt, elapsed) {
    const clampedDt = Math.min(dt, 0.05);

    // Pre-click opening vista: gentle floating high-altitude glide so the opening shot stays alive & majestic!
    if (this.cinematicIdle) {
      const t = elapsed;
      this.pos.x = this._idleOrigin.x + Math.sin(t * 0.16) * 6.5 - Math.sin(PLAYER_CONFIG.SPAWN_YAW) * (Math.sin(t * 0.09) * 5.0);
      this.pos.z = this._idleOrigin.z + Math.cos(t * 0.14) * 5.0 - Math.cos(PLAYER_CONFIG.SPAWN_YAW) * (t * 1.35 % 28.0);
      // Smoothly loop subtle drift without any pop: use pure harmonic figure-eight hover at high altitude!
      this.pos.x = this._idleOrigin.x + Math.sin(t * 0.22) * 8.0;
      this.pos.z = this._idleOrigin.z - Math.sin(t * 0.14) * 10.0;
      this.pos.y = this._idleOrigin.y + Math.sin(t * 0.45) * 1.4;
      this.roll = Math.cos(t * 0.22) * -0.025;
      this._syncCamera(clampedDt, elapsed);
      return;
    }

    if (!this.isLocked || this.inventoryOpen) {
      this._yawDeltaAccum = 0;
      this._syncCamera(clampedDt, elapsed);
      return;
    }

    this._checkWaterState();

    if (this.mode === 'GLIDING') {
      this._updateGliding(clampedDt);
    } else {
      this._updateWalking(clampedDt);
    }

    this._yawDeltaAccum *= Math.exp(-clampedDt * 12.0);
    this._landingDip *= Math.exp(-clampedDt * 9.0);
    this._syncCamera(clampedDt, elapsed);
  }

  _checkWaterState() {
    const bx = Math.floor(this.pos.x);
    const byFeet = Math.floor(this.pos.y + 0.15);
    const byWaist = Math.floor(this.pos.y + 0.85);
    const bz = Math.floor(this.pos.z);
    this.inWater = (
      this.world.getBlock(bx, byFeet, bz) === BLOCK.WATER ||
      this.world.getBlock(bx, byWaist, bz) === BLOCK.WATER
    );
  }

  _updateGliding(dt) {
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const w = this.keys.has('KeyW') ? 1 : 0;
    const s = this.keys.has('KeyS') ? 1 : 0;
    const a = this.keys.has('KeyA') ? 1 : 0;
    const d = this.keys.has('KeyD') ? 1 : 0;
    const space = this.keys.has('Space');
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Steer gently with A/D in addition to mouse look
    const strafeInput = d - a;
    this.yaw -= strafeInput * 0.85 * dt;

    // Airspeed responds to W/S and camera pitch (diving speeds up, flaring slows down)
    const pitchDive = Math.max(-0.5, Math.min(0.6, -this.pitch));
    let targetSpeed = PLAYER_CONFIG.GLIDE_BASE_SPEED
      + (w - s) * 4.4
      + pitchDive * 7.5
      + (shift ? 4.2 : 0);
    targetSpeed = Math.max(PLAYER_CONFIG.GLIDE_MIN_SPEED, Math.min(PLAYER_CONFIG.GLIDE_MAX_SPEED, targetSpeed));
    this.airSpeed += (targetSpeed - this.airSpeed) * Math.min(1, dt * 3.8);

    // Horizontal glide velocity + subtle lateral carve
    const targetVx = forwardX * this.airSpeed + rightX * strafeInput * 3.6;
    const targetVz = forwardZ * this.airSpeed + rightZ * strafeInput * 3.6;
    this.vel.x += (targetVx - this.vel.x) * Math.min(1, dt * 5.5);
    this.vel.z += (targetVz - this.vel.z) * Math.min(1, dt * 5.5);

    // Vertical glide physics: buoyant hang-glider sink, Spacebar thermal updraft, Shift steep dive
    let targetVy = -PLAYER_CONFIG.GLIDE_SINK_RATE - pitchDive * 5.2;
    if (s && !w) targetVy = Math.max(targetVy, -1.15); // Flare for soft landing
    if (shift) targetVy = -9.2;
    if (space) {
      // Thermal boost upward so player can climb freely anytime while gliding!
      targetVy = 8.8;
    }

    const vertLerp = space ? 5.2 : 3.6;
    this.vel.y += (targetVy - this.vel.y) * Math.min(1, dt * vertLerp);

    // Keep within comfortable sky ceiling
    if (this.pos.y > 145 && this.vel.y > 0) {
      this.vel.y *= 0.85;
    }

    // Coordinated banking camera roll
    const targetRoll = THREE.MathUtils.clamp(this._yawDeltaAccum * 2.4 - strafeInput * 0.11, -0.16, 0.16);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 7.5);

    // Move & check voxel collision
    this._moveAndCollide(dt, false);

    // Automatic transition to WALKING on touchdown (or skimming deep into water)!
    if (this.onGround || (this.inWater && this.vel.y <= 0 && !space)) {
      this._setMode('WALKING');
      this._landingDip = 0.16;
      this.sound?.playLand(this.inWater);
    }

    this.sound?.updateGlideWind(this.airSpeed, true);
  }

  _updateWalking(dt) {
    this.sound?.updateGlideWind(0, false);

    // Relax roll smoothly back to level horizon
    this.roll += (0 - this.roll) * Math.min(1, dt * 10.0);

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const moveF = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const moveR = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const sneaking = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !this.inWater;
    const sprinting = (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) && moveF > 0 && !sneaking;

    let wishX = forwardX * moveF + rightX * moveR;
    let wishZ = forwardZ * moveF + rightZ * moveR;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    let maxSpeed = PLAYER_CONFIG.WALK_SPEED;
    if (this.inWater) maxSpeed = PLAYER_CONFIG.SWIM_SPEED;
    else if (sneaking) maxSpeed = PLAYER_CONFIG.SNEAK_SPEED;
    else if (sprinting) maxSpeed = PLAYER_CONFIG.SPRINT_SPEED;

    const accel = this.onGround ? 14.0 : (this.inWater ? 6.5 : 4.5);
    this.vel.x += (wishX * maxSpeed - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wishZ * maxSpeed - this.vel.z) * Math.min(1, dt * accel);

    if (this.inWater) {
      // Buoyant water swimming
      this.vel.y -= PLAYER_CONFIG.GRAVITY * 0.28 * dt;
      this.vel.y *= Math.exp(-dt * 4.2);
      if (this.keys.has('Space')) {
        this.vel.y = 4.6;
      } else if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
        this.vel.y = -3.4;
      }
    } else {
      this.vel.y -= PLAYER_CONFIG.GRAVITY * dt;
      if (this.vel.y < -38) this.vel.y = -38;
    }

    const prevX = this.pos.x;
    const prevZ = this.pos.z;
    this._moveAndCollide(dt, sneaking && this.onGround);

    // Footstep sound & head-bob accumulation
    const movedHoriz = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    if (this.onGround && movedHoriz > 0.001) {
      this._stepDistAccum += movedHoriz;
      this._walkBobPhase += movedHoriz * 3.1;
      this._walkBobAmp += (1.0 - this._walkBobAmp) * Math.min(1, dt * 10.0);

      if (this._stepDistAccum >= 1.95) {
        this._stepDistAccum = 0;
        const groundId = this.world.getBlock(
          Math.floor(this.pos.x),
          Math.floor(this.pos.y - 0.2),
          Math.floor(this.pos.z)
        );
        const soundType = BLOCK_DEFS[groundId]?.sound || 'grass';
        this.sound?.playStep(soundType);
      }
    } else {
      this._walkBobAmp *= Math.exp(-dt * 10.0);
    }
  }

  _moveAndCollide(dt, sneakEdgeGuard) {
    const hw = PLAYER_CONFIG.WIDTH * 0.5;
    const h = PLAYER_CONFIG.HEIGHT;

    // Classic Minecraft Sneak Edge-Guard: prevent walking off ledges while sneaking on ground
    let dx = this.vel.x * dt;
    let dz = this.vel.z * dt;
    if (sneakEdgeGuard) {
      if (dx !== 0 && !this._hasGroundBelow(this.pos.x + dx, this.pos.y, this.pos.z, hw * 0.7)) {
        dx = 0;
        this.vel.x = 0;
      }
      if (dz !== 0 && !this._hasGroundBelow(this.pos.x, this.pos.y, this.pos.z + dz, hw * 0.7)) {
        dz = 0;
        this.vel.z = 0;
      }
    }

    // Resolve X axis
    this.pos.x += dx;
    if (this._collidesAABB(this.pos.x, this.pos.y, this.pos.z, hw, h)) {
      this.pos.x -= dx;
      this.vel.x = 0;
    }

    // Resolve Z axis
    this.pos.z += dz;
    if (this._collidesAABB(this.pos.x, this.pos.y, this.pos.z, hw, h)) {
      this.pos.z -= dz;
      this.vel.z = 0;
    }

    // Resolve Y axis
    const dy = this.vel.y * dt;
    this.pos.y += dy;
    this.onGround = false;
    if (this._collidesAABB(this.pos.x, this.pos.y, this.pos.z, hw, h)) {
      if (dy < 0) {
        this.pos.y = Math.floor(this.pos.y) + 1.0001;
        this.onGround = true;
      } else {
        this.pos.y -= dy;
      }
      this.vel.y = 0;
    }

    if (this.pos.y < 1.01) {
      this.pos.y = 1.01;
      this.vel.y = 0;
      this.onGround = true;
    }
  }

  _hasGroundBelow(x, y, z, r) {
    const checkY = Math.floor(y - 0.15);
    const minX = Math.floor(x - r), maxX = Math.floor(x + r);
    const minZ = Math.floor(z - r), maxZ = Math.floor(z + r);
    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        const id = this.world.getBlock(bx, checkY, bz);
        if (id !== BLOCK.AIR && BLOCK_DEFS[id]?.solid) return true;
      }
    }
    return false;
  }

  _collidesAABB(x, y, z, hw, h) {
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw - 0.0001);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + h - 0.0001);
    const minZ = Math.floor(z - hw);
    const maxZ = Math.floor(z + hw - 0.0001);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          const id = this.world.getBlock(bx, by, bz);
          if (id !== BLOCK.AIR && BLOCK_DEFS[id]?.solid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  intersectsBlock(bx, by, bz) {
    const hw = PLAYER_CONFIG.WIDTH * 0.5;
    const minX = this.pos.x - hw, maxX = this.pos.x + hw;
    const minY = this.pos.y, maxY = this.pos.y + PLAYER_CONFIG.HEIGHT;
    const minZ = this.pos.z - hw, maxZ = this.pos.z + hw;

    return (
      maxX > bx && minX < bx + 1 &&
      maxY > by && minY < by + 1 &&
      maxZ > bz && minZ < bz + 1
    );
  }

  _syncCamera(dt, elapsed) {
    const sneaking = this.mode === 'WALKING' && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !this.inWater;
    const targetEye = sneaking ? PLAYER_CONFIG.SNEAK_EYE_HEIGHT : PLAYER_CONFIG.EYE_HEIGHT;
    this._currentEye = this._currentEye === undefined
      ? targetEye
      : this._currentEye + (targetEye - this._currentEye) * Math.min(1, (dt || 0.016) * 12.0);

    const bobY = Math.sin(this._walkBobPhase * 2.0) * 0.042 * this._walkBobAmp;
    const bobX = Math.cos(this._walkBobPhase) * 0.026 * this._walkBobAmp;

    this.camera.position.set(
      this.pos.x + Math.cos(this.yaw) * bobX,
      this.pos.y + this._currentEye + bobY - this._landingDip,
      this.pos.z - Math.sin(this.yaw) * bobX
    );

    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.roll;

    // Dynamic FOV: widens smoothly when gliding fast or sprinting!
    let targetFov = 66;
    if (this.mode === 'GLIDING' && !this.cinematicIdle) {
      const speedNorm = (this.airSpeed - PLAYER_CONFIG.GLIDE_BASE_SPEED) / 10.0;
      targetFov = 68 + THREE.MathUtils.clamp(speedNorm * 8.5, -2, 10);
    } else if (this.mode === 'WALKING' && (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) && this.keys.has('KeyW')) {
      targetFov = 72;
    }

    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, (dt || 0.016) * 6.5);
      this.camera.updateProjectionMatrix();
    }
  }

  getWalkBobState() {
    return { phase: this._walkBobPhase, amp: this._walkBobAmp, roll: this.roll, mode: this.mode };
  }
}
