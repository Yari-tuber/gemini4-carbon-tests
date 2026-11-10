import * as THREE from 'three';
import { WORLD_CONFIG, PLAYER_CONFIG } from './config.js';
import { BLOCK, BLOCK_DEFS, BlockAtlas } from './world/BlockRegistry.js';
import { WorldManager } from './world/WorldManager.js';
import { SunsetSky } from './rendering/SunsetSky.js';
import { SunShadowSystem, createVoxelShaders } from './rendering/VoxelShaders.js';
import { OceanRenderer } from './rendering/OceanRenderer.js';
import { AtmosphereFX } from './rendering/AtmosphereFX.js';
import { PostPipeline } from './rendering/PostPipeline.js';
import { PlayerController } from './player/PlayerController.js';
import { HeldBlockView } from './player/HeldBlockView.js';
import { HUDManager } from './ui/HUDManager.js';
import { SoundEngine } from './audio/SoundEngine.js';

class EternalSunsetGame {
  constructor() {
    this.container = document.getElementById('game-container');

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Handled via 4x MSAA HalfFloat RenderTarget in PostPipeline!
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      66,
      window.innerWidth / window.innerHeight,
      0.1,
      4500
    );

    // 1. Procedural Padded Block Atlas & Icons
    this.atlas = new BlockAtlas();

    // 2. Sky, Shadows, Voxel Shaders & Seamless Sun-Road Ocean
    this.sky = new SunsetSky(this.scene);
    this.shadowSystem = new SunShadowSystem();
    const { voxelMaterial, shadowDepthMaterial, sharedUniforms } = createVoxelShaders(
      this.atlas.texture,
      this.shadowSystem
    );
    this.voxelUniforms = sharedUniforms;
    this.shadowDepthMaterial = shadowDepthMaterial;

    this.ocean = new OceanRenderer(this.scene, this.shadowSystem);

    // 3. Procedural Voxel World (Pre-warmed around high-altitude spawn for instant Frame-1 grandeur!)
    this.world = new WorldManager(
      this.scene,
      this.atlas,
      voxelMaterial,
      shadowDepthMaterial,
      this.ocean.material
    );
    this.world.warmupInitialWorld(PLAYER_CONFIG.SPAWN_POS.x, PLAYER_CONFIG.SPAWN_POS.z);
    this.ocean.update(0, this.world.loadedBounds);

    // 4. Atmospheric Motes, Coastal Seabirds & Target Block Outline
    this.atmosphereFX = new AtmosphereFX(this.scene);

    // 5. Audio, First-Person Held Block, Player Controller & HUD
    this.sound = new SoundEngine();
    this.heldView = new HeldBlockView(this.atlas);

    this.hud = new HUDManager(
      this.atlas,
      (blockId) => this.heldView.setBlock(blockId),
      (invOpen) => { this.player.inventoryOpen = invOpen; }
    );
    this.heldView.setBlock(this.hud.currentBlockId);

    this.player = new PlayerController(
      this.camera,
      this.world,
      this.sound,
      (newMode) => this.hud.updateModeBadge(newMode)
    );
    this.player.bindEvents(this.renderer.domElement);

    // 6. HDR Post-Processing (HeldOverlay -> Volumetric Sun Shafts -> UnrealBloom -> Chroma-Preserving Sunset Grade)
    this.post = new PostPipeline(this.renderer, this.scene, this.camera, this.heldView);

    this.currentRayHit = null;
    this._camDir = new THREE.Vector3();
    this._lastFrameTime = performance.now();
    this._elapsedTime = 0;

    this._bindGameplayActions();
    window.addEventListener('resize', () => this._onResize());

    // Expose debug handle for automated inspection & testing
    window.__ETERNAL_SUNSET__ = this;

    this._animate();
  }

  _bindGameplayActions() {
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousedown', (e) => {
      this.sound.init();
      if (!this.player.isLocked || this.hud.inventoryOpen) return;

      // Refresh exact raycast at click instant
      this._updateRaycast();

      if (e.button === 0) {
        // Left Click: Break Block
        this.heldView.triggerSwing();
        if (this.currentRayHit) {
          const { x, y, z, blockId } = this.currentRayHit;
          if (y > 0) {
            const soundMat = BLOCK_DEFS[blockId]?.sound || 'grass';
            // If breaking a block adjacent to ocean at/below sea level, let sea water fill coastal digs naturally?
            // Classic Minecraft feel: break to AIR cleanly!
            this.world.spawnBreakParticles(x, y, z, blockId);
            this.world.setBlock(x, y, z, BLOCK.AIR);
            this.sound.playBlockBreak(soundMat);
          }
        }
      } else if (e.button === 2) {
        // Right Click: Place Selected Block
        if (!this.currentRayHit) return;
        const { x, y, z, normal, blockId: hitId } = this.currentRayHit;
        const hitDef = BLOCK_DEFS[hitId];

        // Replace tall grass / flowers directly if clicked, otherwise place on adjacent normal face
        let tx = x + normal[0];
        let ty = y + normal[1];
        let tz = z + normal[2];
        if (hitDef && hitDef.replaceable) {
          tx = x; ty = y; tz = z;
        }

        const placeId = this.hud.currentBlockId;
        const placeDef = BLOCK_DEFS[placeId];
        if (!placeDef) return;

        // Prevent placing solid blocks intersecting the player's body AABB
        if (placeDef.solid && this.player.intersectsBlock(tx, ty, tz)) {
          return;
        }

        const existingId = this.world.getBlock(tx, ty, tz);
        const existingDef = BLOCK_DEFS[existingId];
        if (existingId === BLOCK.AIR || existingId === BLOCK.WATER || existingDef?.replaceable) {
          if (this.world.setBlock(tx, ty, tz, placeId)) {
            this.heldView.triggerSwing();
            this.sound.playBlockPlace(placeDef.sound || 'stone');
          }
        }
      } else if (e.button === 1) {
        // Middle Click: Classic Minecraft Pick Block!
        if (this.currentRayHit) {
          e.preventDefault();
          this.hud.pickBlockToHotbar(this.currentRayHit.blockId);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.sound.toggleMute();
      }
    });
  }

  _updateRaycast() {
    if (!this.player.isLocked || this.hud.inventoryOpen) {
      this.currentRayHit = null;
      return;
    }
    this.camera.getWorldDirection(this._camDir);
    this.currentRayHit = this.world.raycast(
      this.camera.position,
      this._camDir,
      PLAYER_CONFIG.REACH_DISTANCE
    );
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.heldView.onResize(w, h);
    this.post.onResize(w, h);
    this.atmosphereFX.onResize();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    const dt = Math.min((now - this._lastFrameTime) * 0.001, 0.1);
    this._lastFrameTime = now;
    this._elapsedTime += dt;
    const elapsed = this._elapsedTime;

    // 1. Update Player Physics & Camera
    this.player.update(dt, elapsed);

    // 2. Stream Voxel Chunks & Debris around Player
    this.world.updateStreaming(this.player.pos.x, this.player.pos.z, dt);

    // 3. Update Uniforms, Sky, Ocean, Seabirds & Raycast Highlight
    this.voxelUniforms.uTime.value = elapsed;
    this.sky.update(elapsed);
    this.ocean.update(elapsed, this.world.loadedBounds);

    this._updateRaycast();
    this.atmosphereFX.update(elapsed, this.camera.position, this.currentRayHit);
    this.heldView.update(dt, elapsed, this.player.getWalkBobState(), this.player.cinematicIdle);
    this.hud.updateFrameState(this.player, WORLD_CONFIG.SEA_LEVEL);
    this.sound.updateAmbience(this.player.pos.y, WORLD_CONFIG.SEA_LEVEL, elapsed);

    // 4. Render 4096x4096 Sun Shadow Depth Map
    this.shadowSystem.render(
      this.renderer,
      this.world.solidGroup,
      this.shadowDepthMaterial,
      this.player.pos
    );

    // 5. Render HDR Scene + Volumetric Sun Shafts + Bloom + Filmic Sunset Grading
    this.post.render(dt);
  }
}

new EternalSunsetGame();
