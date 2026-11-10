import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS } from '../world/blocks.js';
import { SEA_LEVEL, WORLD_MIN, WORLD_MAX } from '../world/World.js';

export const SPAWN_POS = new THREE.Vector3(-2, 42, 34);
export const SPAWN_YAW = 0.14;    // Facing directly toward the low orange sun & golden sun road over the sea
export const SPAWN_PITCH = -0.12; // Overlooking the coastline, forested capes, pier, and ocean horizon

export class Player {
  constructor(camera, world, atmosphereFX, soundManager, onModeChange) {
    this.camera = camera;
    this.world = world;
    this.atmosphereFX = atmosphereFX;
    this.soundManager = soundManager;
    this.onModeChange = onModeChange;

    // Player physical dimensions (feet position)
    this.position = SPAWN_POS.clone();
    this.velocity = new THREE.Vector3(0, -1.5, -10.0);
    this.radius = 0.32;
    this.height = 1.78;
    this.eyeHeight = 1.62;

    // Camera Euler angles (YXZ order)
    this.yaw = SPAWN_YAW;
    this.pitch = SPAWN_PITCH;
    this.roll = 0;

    // Modes: 'GLIDING' | 'WALKING'
    this.mode = 'GLIDING';
    this.onGround = false;
    this.inWater = false;
    this.headUnderwater = false;

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      descend: false,
      sprint: false
    };

    this.lastSpacePressTime = 0;
    this.walkBobTimer = 0;
    this.walkStepAccum = 0;
    this.glideSpeed = 11.5;
    this.boostCooldown = 0;
    this.isPointerLocked = false;
    this.pointerLockTime = 0;
    this.lastMoveX = 0;
    this.lastMoveY = 0;
    this.hasInteracted = false;

    this.initControls();
    this.syncCamera(0);
  }

  initControls() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && (e.code === 'KeyF' || e.code === 'KeyR' || e.code === 'Space')) {
        if (e.code === 'Space') {
          this.keys.jump = true;
        }
        return;
      }

      this.hasInteracted = true;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.descend = true;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.keys.sprint = true;
          break;
        case 'Space': {
          const now = performance.now();
          if (this.mode === 'WALKING' && now - this.lastSpacePressTime < 320) {
            this.takeOff();
            this.lastSpacePressTime = 0;
          } else {
            this.lastSpacePressTime = now;
            if (this.mode === 'GLIDING' && this.boostCooldown <= 0) {
              this.triggerGlideBoost();
            }
          }
          this.keys.jump = true;
          break;
        }
        case 'KeyF':
          if (this.mode === 'WALKING') {
            this.takeOff();
          } else {
            this.triggerGlideBoost();
          }
          break;
        case 'KeyR':
          this.resetToHighAltitudeSpawn();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.descend = false;
          break;
        case 'ControlLeft':
        case 'ControlRight':
          this.keys.sprint = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      // Ignore the initial cursor-warp frame right after Pointer Lock engages
      if (performance.now() - this.pointerLockTime < 65) return;

      let dx = e.movementX || 0;
      let dy = e.movementY || 0;

      // Filter out Chromium/Windows DPI SetCursorPos warp spikes (sudden huge single-frame jumps)
      if (Math.abs(dx) > 180 || Math.abs(dy) > 180) {
        return;
      }
      if ((Math.abs(dx) > 95 && Math.abs(this.lastMoveX) < 18) ||
          (Math.abs(dy) > 95 && Math.abs(this.lastMoveY) < 18)) {
        return;
      }

      this.lastMoveX = dx;
      this.lastMoveY = dy;

      // Clamp per-event delta to prevent any sudden snap
      dx = Math.max(-75, Math.min(75, dx));
      dy = Math.max(-75, Math.min(75, dy));

      const sensitivity = 0.0020;
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity;
      const maxPitch = Math.PI * 0.485;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  resetToHighAltitudeSpawn() {
    this.position.copy(SPAWN_POS);
    this.yaw = SPAWN_YAW;
    this.pitch = SPAWN_PITCH;
    this.roll = 0;
    this.glideSpeed = 11.5;
    this.velocity.set(-Math.sin(this.yaw) * 11.0, -1.7, -Math.cos(this.yaw) * 11.0);
    this.setMode('GLIDING', '已重返高空滑翔点 · 俯瞰落日海湾');
    if (this.atmosphereFX) this.atmosphereFX.spawnTakeoffBurst(this.position);
    if (this.soundManager) this.soundManager.playTakeoff();
  }

  takeOff() {
    this.onGround = false;
    this.position.y += 0.6;
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);
    this.glideSpeed = 12.8;
    this.velocity.set(lookX * 11.5, 13.5, lookZ * 11.5);
    if (this.pitch < -0.25) this.pitch = -0.10;
    this.setMode('GLIDING', '重新起飞 · 滑翔模式 (WASD转向 / Space推进 / 落地切步行)');
    if (this.atmosphereFX) this.atmosphereFX.spawnTakeoffBurst(this.position);
    if (this.soundManager) this.soundManager.playTakeoff();
  }

  triggerGlideBoost() {
    if (this.boostCooldown > 0) return;
    this.boostCooldown = 0.45;
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);
    this.glideSpeed = Math.min(18.5, this.glideSpeed + 4.5);
    this.velocity.y = Math.max(this.velocity.y + 7.5, 8.2);
    this.velocity.x += lookX * 4.0;
    this.velocity.z += lookZ * 4.0;
    if (this.atmosphereFX) this.atmosphereFX.spawnTakeoffBurst(this.position);
    if (this.soundManager) this.soundManager.playTakeoff();
  }

  setMode(newMode, toastText) {
    const changed = this.mode !== newMode;
    this.mode = newMode;
    if (changed && this.onModeChange) {
      this.onModeChange(newMode, toastText);
    } else if (toastText && this.onModeChange) {
      this.onModeChange(newMode, toastText);
    }
  }

  isSolidAt(x, y, z) {
    const b = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if (b === BLOCK.AIR) return false;
    const def = BLOCK_DEFS[b];
    return def ? def.solid : false;
  }

  checkAABBCollision(pos) {
    const minX = Math.floor(pos.x - this.radius);
    const maxX = Math.floor(pos.x + this.radius);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + this.height - 0.02);
    const minZ = Math.floor(pos.z - this.radius);
    const maxZ = Math.floor(pos.z + this.radius);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.isSolidAt(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  update(dt, time) {
    dt = Math.min(dt, 0.05);
    if (this.boostCooldown > 0) this.boostCooldown -= dt;

    // Check water immersion
    const waterSurface = SEA_LEVEL + 0.32;
    this.inWater = (this.position.y + 0.5) < waterSurface;
    this.headUnderwater = (this.position.y + this.eyeHeight) < waterSurface;

    // Before first click/interaction: gentle scenic aerial glide loop so the sunset view never crashes
    if (!this.isPointerLocked && !this.hasInteracted && this.mode === 'GLIDING') {
      const slowDt = dt * 0.28;
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      this.position.x += forwardX * 6.5 * slowDt;
      this.position.z += forwardZ * 6.5 * slowDt;
      this.position.y -= 1.05 * slowDt;

      // Gently loop back if drifting too close to water before user clicks
      if (this.position.y < 26 || this.position.z < -20) {
        this.position.copy(SPAWN_POS);
      }
      this.roll = Math.sin(time * 0.6) * 0.025;
      this.syncCamera(dt);
      return;
    }

    if (this.mode === 'GLIDING') {
      this.updateGliding(dt);
    } else {
      this.updateWalking(dt);
    }

    // Keep player inside playable peninsula/bay bounds
    const bound = WORLD_MAX - 6;
    this.position.x = Math.max(WORLD_MIN + 6, Math.min(bound, this.position.x));
    this.position.z = Math.max(WORLD_MIN + 6, Math.min(bound, this.position.z));

    this.syncCamera(dt);
  }

  updateGliding(dt) {
    // Banking while gliding (only rotate yaw via keyboard if mouse pointer is NOT locked)
    const turnRate = 1.35;
    let targetRoll = 0;
    if (this.keys.left) {
      if (!this.isPointerLocked) this.yaw += turnRate * dt;
      targetRoll = 0.14;
    } else if (this.keys.right) {
      if (!this.isPointerLocked) this.yaw -= turnRate * dt;
      targetRoll = -0.14;
    }
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, Math.min(1.0, dt * 6.0));

    // Target airspeed based on W (accelerate/dive), S (flare/slow), and pitch
    let targetSpeed = 11.8;
    if (this.keys.forward) targetSpeed = 15.8;
    if (this.keys.backward) targetSpeed = 6.2;
    if (this.keys.sprint) targetSpeed = 18.2;

    // Diving slightly increases glide speed
    targetSpeed += Math.max(-2.5, -this.pitch * 5.0);
    this.glideSpeed = THREE.MathUtils.lerp(this.glideSpeed, targetSpeed, Math.min(1.0, dt * 3.5));

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let strafe = 0;
    if (this.keys.left) strafe -= 3.2;
    if (this.keys.right) strafe += 3.2;

    const desiredVx = forwardX * this.glideSpeed + rightX * strafe;
    const desiredVz = forwardZ * this.glideSpeed + rightZ * strafe;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, desiredVx, Math.min(1.0, dt * 4.5));
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, desiredVz, Math.min(1.0, dt * 4.5));

    // Vertical sink rate: gentle aerodynamic descent ("俯瞰世界缓缓下降")
    // Pitching down descends faster; pitching up converts speed into lift; Shift descends faster
    let targetSinkRate = -1.85 + Math.sin(this.pitch) * 6.8;
    if (this.keys.backward) targetSinkRate = -1.15; // Flare for soft landing
    if (this.keys.descend) targetSinkRate = -6.5;   // Fast descent

    this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetSinkRate, Math.min(1.0, dt * 3.2));

    // Apply movement with axis-separated voxel collision
    const landed = this.moveWithCollision(dt);

    // Switch to walking upon touching solid ground ("落地后切步行")
    if (landed || (this.inWater && this.position.y <= SEA_LEVEL - 0.1)) {
      this.onGround = landed;
      this.roll = 0;
      this.velocity.y = 0;
      const surfaceBlock = this.world.getBlock(
        Math.floor(this.position.x),
        Math.floor(this.position.y - 0.2),
        Math.floor(this.position.z)
      );
      if (this.soundManager) {
        const def = BLOCK_DEFS[surfaceBlock];
        this.soundManager.playStep(def?.sound || 'grass', 1.3);
      }
      this.setMode('WALKING', '已着陆 · 切换为步行模式 (按 F 或双击空格可随时重新起飞)');
    }
  }

  updateWalking(dt) {
    this.roll = THREE.MathUtils.lerp(this.roll, 0, Math.min(1.0, dt * 10.0));

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = 0;
    let moveZ = 0;
    if (this.keys.forward) { moveX += forwardX; moveZ += forwardZ; }
    if (this.keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
    if (this.keys.left) { moveX -= rightX; moveZ -= rightZ; }
    if (this.keys.right) { moveX += rightX; moveZ += rightZ; }

    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0.001) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    let walkSpeed = 5.4;
    if (this.keys.sprint && this.keys.forward) walkSpeed = 7.8;
    else if (this.keys.descend && this.onGround) walkSpeed = 2.8;
    if (this.inWater) walkSpeed *= 0.68;

    const accel = this.onGround ? 18.0 : 8.5;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveX * walkSpeed, Math.min(1.0, dt * accel));
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveZ * walkSpeed, Math.min(1.0, dt * accel));

    if (this.inWater) {
      // Swimming physics in the ocean
      this.velocity.y -= 7.5 * dt;
      this.velocity.y *= Math.pow(0.85, dt * 60);
      if (this.keys.jump) {
        this.velocity.y = 4.6;
      } else if (this.keys.descend) {
        this.velocity.y = -3.8;
      }
    } else {
      // Standard Minecraft gravity & jump
      this.velocity.y -= 24.5 * dt;
      this.velocity.y = Math.max(-38.0, this.velocity.y);
      if (this.keys.jump && this.onGround) {
        this.velocity.y = 8.45;
        this.onGround = false;
      }
    }

    const wasOnGround = this.onGround;
    this.onGround = this.moveWithCollision(dt);

    // Footstep sound & view bobbing
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && horizSpeed > 0.4) {
      this.walkBobTimer += dt * horizSpeed * 1.65;
      this.walkStepAccum += dt * horizSpeed;
      if (this.walkStepAccum > 2.15) {
        this.walkStepAccum = 0;
        const groundBlock = this.world.getBlock(
          Math.floor(this.position.x),
          Math.floor(this.position.y - 0.2),
          Math.floor(this.position.z)
        );
        const def = BLOCK_DEFS[groundBlock];
        if (this.soundManager) this.soundManager.playStep(def?.sound || 'grass', 0.85);
      }
    } else if (!wasOnGround && this.onGround) {
      const groundBlock = this.world.getBlock(
        Math.floor(this.position.x),
        Math.floor(this.position.y - 0.2),
        Math.floor(this.position.z)
      );
      const def = BLOCK_DEFS[groundBlock];
      if (this.soundManager) this.soundManager.playStep(def?.sound || 'grass', 1.1);
    }
  }

  moveWithCollision(dt) {
    let grounded = false;

    // X axis
    const nextX = this.position.clone();
    nextX.x += this.velocity.x * dt;
    if (!this.checkAABBCollision(nextX)) {
      this.position.x = nextX.x;
    } else {
      // Auto-step 1 block when walking on ground or landing gently
      this.velocity.x = 0;
    }

    // Z axis
    const nextZ = this.position.clone();
    nextZ.z += this.velocity.z * dt;
    if (!this.checkAABBCollision(nextZ)) {
      this.position.z = nextZ.z;
    } else {
      this.velocity.z = 0;
    }

    // Y axis
    const nextY = this.position.clone();
    nextY.y += this.velocity.y * dt;
    if (!this.checkAABBCollision(nextY)) {
      this.position.y = nextY.y;
    } else {
      if (this.velocity.y <= 0) {
        grounded = true;
        this.position.y = Math.floor(this.position.y + 0.05);
        while (this.checkAABBCollision(this.position) && this.position.y < 76) {
          this.position.y += 1.0;
        }
      }
      this.velocity.y = 0;
    }

    if (this.position.y < 1.0) {
      this.position.y = 1.0;
      grounded = true;
    }

    return grounded;
  }

  syncCamera(dt) {
    let eyeY = this.position.y + this.eyeHeight;
    if (this.mode === 'WALKING' && this.keys.descend && this.onGround) {
      eyeY -= 0.22; // Sneak crouch
    }

    // Subtle view bobbing when walking
    let bobX = 0;
    let bobY = 0;
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.mode === 'WALKING' && this.onGround && horizSpeed > 0.3) {
      const bobFactor = Math.min(1.0, horizSpeed / 6.0);
      bobX = Math.cos(this.walkBobTimer * 0.5) * 0.035 * bobFactor;
      bobY = Math.abs(Math.sin(this.walkBobTimer)) * 0.055 * bobFactor;
    }

    this.camera.position.set(
      this.position.x + bobX,
      eyeY + bobY,
      this.position.z
    );

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.roll;

    // Dynamic FOV kick when gliding fast or sprinting
    let targetFov = 70;
    if (this.mode === 'GLIDING') {
      targetFov = 72 + Math.max(0, (this.glideSpeed - 10.0) * 0.85);
    } else if (this.keys.sprint && this.keys.forward && horizSpeed > 5.8) {
      targetFov = 76;
    }

    if (dt > 0 && Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1.0, dt * 8.0));
      this.camera.updateProjectionMatrix();
    }
  }
}
