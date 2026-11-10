import * as THREE from 'three';
import {
  BLOCK_DEFS,
  HOTBAR_DEFAULT_BLOCKS,
  INVENTORY_BLOCKS,
  createBlockTextureAtlas,
  getBlockIconDataURL
} from './world/blocks.js';
import { World } from './world/World.js';
import { SunsetSky } from './shaders/SunsetSky.js';
import { SunsetOcean } from './shaders/SunsetOcean.js';
import { createVoxelMaterials } from './shaders/VoxelMaterial.js';
import { PostProcessingPipeline } from './shaders/PostProcessing.js';
import { AtmosphereFX } from './shaders/AtmosphereParticles.js';
import { Player } from './player/Player.js';
import { BlockInteraction } from './player/BlockInteraction.js';
import { SoundManager } from './audio/SoundManager.js';
import { SunsetGameDirector } from './gameplay/SunsetGameDirector.js';

// --- 1. Initialize Renderer, Scene, and Camera ---
const container = document.getElementById('game-canvas-container');
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.1,
  3000
);
scene.add(camera);

// --- 2. Eternal Sunset Sun Direction & Dedicated Float Shadow Map Pass ---
let sunElevationDeg = 4.2; // Low-hanging right above the sea horizon!
const sunAzimuthRad = -0.15;
const sunDir = new THREE.Vector3();
const shadowLightDir = new THREE.Vector3();

function updateSunDirection() {
  const elevRad = THREE.MathUtils.degToRad(sunElevationDeg);
  sunDir.set(
    Math.sin(sunAzimuthRad) * Math.cos(elevRad),
    Math.sin(elevRad),
    -Math.cos(sunAzimuthRad) * Math.cos(elevRad)
  ).normalize();

  // Diagonal low-angle sunset shadow caster so hills, cliffs, trees & sea arch cast long dramatic shadows!
  const shadowElev = THREE.MathUtils.degToRad(Math.max(10.5, sunElevationDeg + 6.0));
  const shadowAzim = sunAzimuthRad - 0.56;
  shadowLightDir.set(
    Math.sin(shadowAzim) * Math.cos(shadowElev),
    Math.sin(shadowElev),
    -Math.cos(shadowAzim) * Math.cos(shadowElev)
  ).normalize();
}
updateSunDirection();

const shadowTarget = new THREE.WebGLRenderTarget(2048, 2048, {
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter
});
const shadowOrtho = 128;
const shadowCamera = new THREE.OrthographicCamera(
  -shadowOrtho, shadowOrtho,
  shadowOrtho, -shadowOrtho,
  10, 360
);
const shadowMatrix = new THREE.Matrix4();
const shadowBiasMatrix = new THREE.Matrix4().set(
  0.5, 0.0, 0.0, 0.5,
  0.0, 0.5, 0.0, 0.5,
  0.0, 0.0, 0.5, 0.5,
  0.0, 0.0, 0.0, 1.0
);
const shadowDepthMaterial = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    void main() {
      gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
    }
  `
});

// --- 3. Build Voxel World, Sky, Ocean, and Atmosphere FX ---
const atlasTexture = createBlockTextureAtlas();
const voxelMats = createVoxelMaterials(atlasTexture, sunDir);
const world = new World(scene, voxelMats.solidMaterial, voxelMats.cutoutMaterial);
world.generate();

const sunsetSky = new SunsetSky(scene, sunDir);
const sunsetOcean = new SunsetOcean(scene, sunDir, world.waterDepthTexture);
const atmosphereFX = new AtmosphereFX(scene);
const soundManager = new SoundManager();

// --- 4. Initialize Player, Gliding, and Block Interaction ---
const modeBadgeEl = document.getElementById('mode-badge');
const modeToastEl = document.getElementById('mode-toast');
let toastTimeout = null;

function showModeToast(mode, message) {
  if (mode === 'GLIDING') {
    modeBadgeEl.textContent = '🪽 高空滑翔';
    modeBadgeEl.classList.remove('walking');
  } else {
    modeBadgeEl.textContent = '🥾 步行建造';
    modeBadgeEl.classList.add('walking');
  }

  if (message) {
    modeToastEl.textContent = message;
    modeToastEl.classList.add('visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      modeToastEl.classList.remove('visible');
    }, 3200);
  }
}

const player = new Player(camera, world, atmosphereFX, soundManager, showModeToast);
const blockInteraction = new BlockInteraction(
  scene,
  camera,
  world,
  player,
  atmosphereFX,
  soundManager,
  atlasTexture
);

// --- 4.5 Initialize Sunset Game Director (Sky-Rings, Altars, Updrafts, Grapple, Blueprints) ---
const statScoreEl = document.getElementById('stat-score');
const statComboEl = document.getElementById('stat-combo');
const statRingsEl = document.getElementById('stat-rings');
const statAltarsEl = document.getElementById('stat-altars');
const skillSkywalkEl = document.getElementById('skill-skywalk');

const gameDirector = new SunsetGameDirector(
  scene,
  camera,
  world,
  player,
  atmosphereFX,
  soundManager,
  (hud) => {
    if (statScoreEl) statScoreEl.textContent = hud.score;
    if (statComboEl) {
      statComboEl.textContent = `x${hud.combo}`;
      statComboEl.classList.toggle('active', hud.combo > 1);
    }
    if (statRingsEl) statRingsEl.textContent = `${hud.ringsCollected} / ${hud.totalRings}`;
    if (statAltarsEl) statAltarsEl.textContent = `${hud.altarsLit} / ${hud.totalAltars}`;
    if (skillSkywalkEl) {
      skillSkywalkEl.classList.toggle('active', hud.skyWalkEnabled);
    }
    if (hud.isWaveSkimming) {
      modeBadgeEl.textContent = '🌊 掠海破浪';
      modeBadgeEl.classList.remove('walking');
    } else if (player.mode === 'GLIDING') {
      modeBadgeEl.textContent = '🪽 高空滑翔';
      modeBadgeEl.classList.remove('walking');
    }
  }
);

// --- 5. Post-Processing Pipeline ---
const postProcessing = new PostProcessingPipeline(renderer, scene, camera);

// --- 6. Hotbar & Creative Inventory UI ---
const hotbarBlocks = [...HOTBAR_DEFAULT_BLOCKS];
let activeSlot = 0;

const hotbarEl = document.getElementById('hotbar');
const activeBlockLabelEl = document.getElementById('active-block-label');
const invModalEl = document.getElementById('inventory-modal');
const invGridEl = document.getElementById('inventory-grid');
let isInventoryOpen = false;

function renderHotbar() {
  hotbarEl.innerHTML = '';
  hotbarBlocks.forEach((blockId, idx) => {
    const slot = document.createElement('div');
    slot.className = `hotbar-slot ${idx === activeSlot ? 'active' : ''}`;

    const keySpan = document.createElement('span');
    keySpan.className = 'slot-key';
    keySpan.textContent = idx + 1;
    slot.appendChild(keySpan);

    const img = document.createElement('img');
    img.src = getBlockIconDataURL(blockId);
    img.alt = BLOCK_DEFS[blockId]?.zhName || '';
    slot.appendChild(img);

    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      selectHotbarSlot(idx);
    });

    hotbarEl.appendChild(slot);
  });

  const currentBlockId = hotbarBlocks[activeSlot];
  const def = BLOCK_DEFS[currentBlockId];
  if (def) {
    activeBlockLabelEl.textContent = `${def.zhName} (${def.name})`;
  }
  player.selectedBlockId = currentBlockId;
  blockInteraction.setSelectedBlock(currentBlockId);
}

function selectHotbarSlot(idx) {
  activeSlot = (idx + hotbarBlocks.length) % hotbarBlocks.length;
  renderHotbar();
}

function initInventoryModal() {
  invGridEl.innerHTML = '';
  for (const blockId of INVENTORY_BLOCKS) {
    const def = BLOCK_DEFS[blockId];
    if (!def) continue;
    const item = document.createElement('div');
    item.className = 'inv-item';

    const img = document.createElement('img');
    img.src = getBlockIconDataURL(blockId);
    item.appendChild(img);

    const label = document.createElement('span');
    label.textContent = def.zhName;
    item.appendChild(label);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      hotbarBlocks[activeSlot] = blockId;
      renderHotbar();
      toggleInventory(false);
      lockPointer();
    });

    invGridEl.appendChild(item);
  }
}

function toggleInventory(forceState) {
  isInventoryOpen = forceState !== undefined ? forceState : !isInventoryOpen;
  invModalEl.classList.toggle('open', isInventoryOpen);
  if (isInventoryOpen && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
}

renderHotbar();
initInventoryModal();

// --- 7. Pointer Lock, Mouse Clicks & Keyboard Shortcuts ---
const clickPromptEl = document.getElementById('click-prompt');

function lockPointer() {
  if (!renderer.domElement.requestPointerLock) return;
  try {
    const promise = renderer.domElement.requestPointerLock({ unadjustedMovement: true });
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => renderer.domElement.requestPointerLock());
    }
  } catch (err) {
    renderer.domElement.requestPointerLock();
  }
}

document.addEventListener('pointerlockchange', () => {
  player.isPointerLocked = document.pointerLockElement === renderer.domElement;
  if (player.isPointerLocked) {
    player.pointerLockTime = performance.now();
    player.lastMoveX = 0;
    player.lastMoveY = 0;
    player.hasInteracted = true;
    clickPromptEl.classList.add('hidden');
    if (isInventoryOpen) toggleInventory(false);
  } else {
    clickPromptEl.classList.remove('hidden');
  }
});

renderer.domElement.addEventListener('mousedown', (e) => {
  soundManager.init();
  if (isInventoryOpen) return;

  if (!player.isPointerLocked) {
    lockPointer();
    return;
  }

  if (e.button === 0) {
    if (blockInteraction.breakBlock()) {
      gameDirector.score += 10;
      gameDirector.notifyHud();
    }
  } else if (e.button === 2) {
    if (blockInteraction.placeBlock()) {
      gameDirector.score += 10;
      gameDirector.notifyHud();
    }
  } else if (e.button === 1) {
    const picked = blockInteraction.pickBlock();
    if (picked) {
      const existingIdx = hotbarBlocks.indexOf(picked);
      if (existingIdx !== -1) {
        selectHotbarSlot(existingIdx);
      } else {
        hotbarBlocks[activeSlot] = picked;
        renderHotbar();
      }
    }
  }
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('wheel', (e) => {
  if (isInventoryOpen) return;
  if (e.deltaY > 0) {
    selectHotbarSlot(activeSlot + 1);
  } else if (e.deltaY < 0) {
    selectHotbarSlot(activeSlot - 1);
  }
});

const shaderPanelEl = document.getElementById('shader-panel');
const controlsCardEl = document.getElementById('controls-card');
const sliderSun = document.getElementById('slider-sun');

window.addEventListener('keydown', (e) => {
  soundManager.init();

  if (e.code.startsWith('Digit')) {
    const num = parseInt(e.code.replace('Digit', ''), 10);
    if (num >= 1 && num <= 9) {
      selectHotbarSlot(num - 1);
    }
  } else if (e.code === 'KeyQ') {
    if (!isInventoryOpen) gameDirector.triggerGrapple();
  } else if (e.code === 'KeyV') {
    if (!isInventoryOpen) gameDirector.toggleSkyWalk();
  } else if (e.code === 'KeyB') {
    if (!isInventoryOpen) gameDirector.placeBlueprint(blockInteraction);
  } else if (e.code === 'KeyE') {
    toggleInventory();
  } else if (e.code === 'KeyG') {
    shaderPanelEl.classList.toggle('open');
  } else if (e.code === 'KeyH') {
    controlsCardEl.classList.toggle('collapsed');
  } else if (e.code === 'Escape' && isInventoryOpen) {
    toggleInventory(false);
  } else if (e.code === 'KeyC') {
    document.body.classList.toggle('cinema-mode');
  } else if (e.code === 'KeyM') {
    const muted = soundManager.toggleMute();
    document.getElementById('btn-audio').textContent = muted ? '🔇 已静音' : '🔊 环境音';
  } else if (e.code === 'BracketLeft') {
    sunElevationDeg = Math.max(2.2, sunElevationDeg - 0.5);
    sliderSun.value = sunElevationDeg;
    document.getElementById('val-sun').textContent = `${sunElevationDeg.toFixed(1)}°`;
    updateSunDirection();
    showModeToast(player.mode, `落日高度角: ${sunElevationDeg.toFixed(1)}°`);
  } else if (e.code === 'BracketRight') {
    sunElevationDeg = Math.min(14.0, sunElevationDeg + 0.5);
    sliderSun.value = sunElevationDeg;
    document.getElementById('val-sun').textContent = `${sunElevationDeg.toFixed(1)}°`;
    updateSunDirection();
    showModeToast(player.mode, `落日高度角: ${sunElevationDeg.toFixed(1)}°`);
  }
});

// Skill Bar Clickable Pills
document.getElementById('skill-grapple')?.addEventListener('click', (e) => {
  e.stopPropagation();
  soundManager.init();
  gameDirector.triggerGrapple();
  lockPointer();
});

document.getElementById('skill-skywalk')?.addEventListener('click', (e) => {
  e.stopPropagation();
  soundManager.init();
  gameDirector.toggleSkyWalk();
  lockPointer();
});

document.getElementById('skill-blueprint')?.addEventListener('click', (e) => {
  e.stopPropagation();
  soundManager.init();
  gameDirector.placeBlueprint(blockInteraction);
  lockPointer();
});

// Shaderpack Live Sliders
sliderSun.addEventListener('input', (e) => {
  sunElevationDeg = parseFloat(e.target.value);
  document.getElementById('val-sun').textContent = `${sunElevationDeg.toFixed(1)}°`;
  updateSunDirection();
});

document.getElementById('slider-cloud').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  sunsetSky.uniforms.uCloudDensity.value = v;
  document.getElementById('val-cloud').textContent = `${Math.round(v * 100)}%`;
});

document.getElementById('slider-godray').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  postProcessing.gradingPass.uniforms.uGodRayIntensity.value = v;
  document.getElementById('val-godray').textContent = `${Math.round(v * 100)}%`;
});

document.getElementById('slider-sunroad').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  sunsetOcean.uniforms.uSunRoadIntensity.value = v;
  document.getElementById('val-sunroad').textContent = `${Math.round(v * 100)}%`;
});

document.getElementById('slider-mist').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  voxelMats.setMistIntensity(v);
  document.getElementById('val-mist').textContent = `${Math.round(v * 100)}%`;
});

// Top-right HUD buttons
document.getElementById('btn-shader').addEventListener('click', (e) => {
  e.stopPropagation();
  shaderPanelEl.classList.toggle('open');
});

document.getElementById('btn-respawn').addEventListener('click', (e) => {
  e.stopPropagation();
  soundManager.init();
  player.resetToHighAltitudeSpawn();
  lockPointer();
});

document.getElementById('btn-takeoff').addEventListener('click', (e) => {
  e.stopPropagation();
  soundManager.init();
  if (player.mode === 'WALKING') player.takeOff();
  else player.triggerGlideBoost();
  lockPointer();
});

document.getElementById('btn-inventory').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleInventory();
});

document.getElementById('btn-close-inv').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleInventory(false);
});

document.getElementById('btn-audio').addEventListener('click', (e) => {
  e.stopPropagation();
  soundManager.init();
  const muted = soundManager.toggleMute();
  e.currentTarget.textContent = muted ? '🔇 已静音' : '🔊 环境音';
});

// --- 8. Resize Handler ---
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  postProcessing.setSize(w, h);
});

// --- 9. Main Render & Physics Loop ---
const statAltEl = document.getElementById('stat-alt');
const statSpeedEl = document.getElementById('stat-speed');
const statPosEl = document.getElementById('stat-pos');
const shadowTargetPos = new THREE.Vector3();

let lastTime = performance.now();
let elapsed = 0;

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min(0.05, (now - lastTime) * 0.001);
  lastTime = now;
  elapsed += dt;

  if (!isInventoryOpen) {
    player.update(dt, elapsed);
    gameDirector.update(dt, elapsed);
  }

  blockInteraction.update(dt, elapsed);

  // Render dedicated Sunset Shadow Map pass from shadowCamera
  const shadowAnchorX = THREE.MathUtils.clamp(player.position.x, -40, 40);
  const shadowAnchorZ = THREE.MathUtils.clamp(player.position.z - 25, -45, 45);
  shadowTargetPos.set(shadowAnchorX, 14, shadowAnchorZ);
  shadowCamera.position.copy(shadowTargetPos).addScaledVector(shadowLightDir, 180);
  shadowCamera.lookAt(shadowTargetPos);
  shadowCamera.updateMatrixWorld();
  shadowCamera.updateProjectionMatrix();

  shadowMatrix.copy(shadowBiasMatrix)
    .multiply(shadowCamera.projectionMatrix)
    .multiply(shadowCamera.matrixWorldInverse);

  world.chunkGroup.overrideMaterial = shadowDepthMaterial;
  renderer.setRenderTarget(shadowTarget);
  renderer.setClearColor(0xffffff, 1.0);
  renderer.clear();
  renderer.render(world.chunkGroup, shadowCamera);
  world.chunkGroup.overrideMaterial = null;
  renderer.setRenderTarget(null);

  // Update Sky, Ocean, Voxel Shaders, Particles, and Sound
  sunsetSky.update(elapsed, camera.position, sunDir);
  sunsetOcean.update(elapsed, camera.position, sunDir, shadowTarget.texture, shadowMatrix);
  voxelMats.update(elapsed, sunDir, shadowTarget.texture, shadowMatrix);
  atmosphereFX.update(dt, elapsed, camera.position);
  soundManager.updateAmbience(player, elapsed);

  // Update Telemetry HUD
  const speed = Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z);
  statAltEl.textContent = `${player.position.y.toFixed(1)} m`;
  statSpeedEl.textContent = `${speed.toFixed(1)} m/s`;
  statPosEl.textContent = `${Math.round(player.position.x)}, ${Math.round(player.position.z)}`;

  const glideSpeedFactor = player.mode === 'GLIDING' ? Math.min(1.0, speed / 16.0) : 0.0;
  postProcessing.render(elapsed, sunDir, player.headUnderwater, glideSpeedFactor);
}

window.__game = {
  player,
  world,
  blockInteraction,
  gameDirector,
  toggleInventory,
  selectHotbarSlot
};

requestAnimationFrame(animate);
