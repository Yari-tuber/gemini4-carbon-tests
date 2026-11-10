import * as THREE from 'three';
import { ViceAudioEngine, RADIO_STATIONS } from './audio/ViceAudioEngine.js';
import { ViceEnvironment, WEATHER_PRESETS } from './world/ViceEnvironment.js';
import { ViceCityMap } from './world/ViceCityMap.js';
import { DualProtagonistSystem } from './entities/CharacterSystem.js';
import { VehicleManager, VEHICLE_ARCHETYPES } from './entities/VehicleSystem.js';
import { WantedAndCombatSystem, WEAPONS } from './gameplay/WantedAndCombat.js';
import { MissionAndPhoneSystem } from './gameplay/MissionAndPhoneSystem.js';
import { RadarAndHUD } from './ui/RadarAndHUD.js';

// ============================================================================
// GTA VI: Vice City (Leonida) — Main Game Engine & Camera Director
// ============================================================================

const container = document.getElementById('game-canvas-container');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.15,
  2000
);

// --- Initialize Core Subsystems ---
const audio = new ViceAudioEngine();
const environment = new ViceEnvironment(scene);
const cityMap = new ViceCityMap(scene);
const protagonists = new DualProtagonistSystem(scene, cityMap, environment, audio);
const vehicleManager = new VehicleManager(scene, cityMap, environment, audio);
protagonists.vehicleManager = vehicleManager;
const hud = new RadarAndHUD(cityMap);

const combat = new WantedAndCombatSystem(
  scene,
  cityMap,
  protagonists,
  vehicleManager,
  audio,
  (crimeText, stars) => {
    missionSystem?.pushSnapVicePost(
      '@VCPD_LiveAlert',
      `WANTED ${'★'.repeat(stars)}`,
      `🚔 ${crimeText} — VCPD units converging on Ocean Drive!`
    );
  }
);

const missionSystem = new MissionAndPhoneSystem(
  scene,
  cityMap,
  protagonists,
  vehicleManager,
  combat,
  audio,
  hud
);
hud.renderSnapViceFeed(missionSystem.snapFeed);

// --- Input & Camera State ---
const input = {
  keys: {},
  leftMouseDown: false,
  rightMouseDown: false
};

let cameraYaw = 0.25;
let cameraPitch = 0.22;
let pointerLocked = false;
let phoneOpen = false;
let weaponWheelOpen = false;
let trailerIntroActive = true;
let trailerAngle = 0;
let stuntSlowMoTimer = 0;
let wastedTimer = 0;

// --- Pointer Lock & Mouse Look ---
renderer.domElement.addEventListener('click', () => {
  if (trailerIntroActive || phoneOpen || weaponWheelOpen) return;
  audio.init();
  if (!pointerLocked && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});

window.addEventListener('mousemove', (e) => {
  if (!pointerLocked || phoneOpen || weaponWheelOpen || trailerIntroActive) return;
  const sens = input.rightMouseDown ? 0.0016 : 0.0024;
  cameraYaw -= e.movementX * sens;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + e.movementY * sens, -0.42, 1.05);
});

window.addEventListener('mousedown', (e) => {
  if (trailerIntroActive || phoneOpen || weaponWheelOpen) return;
  audio.init();
  if (e.button === 0) {
    input.leftMouseDown = true;
    combat.tryFireWeapon(camera);
  } else if (e.button === 2) {
    input.rightMouseDown = true;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.leftMouseDown = false;
  if (e.button === 2) input.rightMouseDown = false;
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Enter / Exit Vehicle (Carjacking) ---
function toggleEnterExitVehicle() {
  audio.init();
  const active = protagonists.getActiveActor();

  if (protagonists.currentVehicle) {
    // Exit current vehicle
    const v = protagonists.currentVehicle;
    protagonists.currentVehicle = null;
    const exitX = v.x - Math.cos(v.yaw) * 2.4;
    const exitZ = v.z + Math.sin(v.yaw) * 2.4;
    active.pos.set(exitX, Math.max(0.05, v.y + 0.1), exitZ);
    const partner = protagonists.getPartnerActor();
    partner.pos.set(v.x + Math.cos(v.yaw) * 2.4, Math.max(0.05, v.y + 0.1), v.z - Math.sin(v.yaw) * 2.4);
    return;
  }

  const near = vehicleManager.findNearestVehicle(active.pos, 6.8);
  if (near) {
    if (near.isAI) {
      near.isAI = false;
      near.isPolicePursuit = false;
      combat.addWantedHeat(60, `Grand Theft Auto: Hijacked ${near.cfg.name}!`);
      missionSystem.pushSnapVicePost(
        '@OceanDriveWitness',
        'GRAND THEFT AUTO',
        `😱 Someone just carjacked a ${near.cfg.name} right in the middle of Vice City!!`
      );
    }
    protagonists.currentVehicle = near;
    cameraYaw = near.yaw + Math.PI;
    hud.showSubtitle(
      `正在驾驶: ${near.cfg.name} · 按 [Shift] 氮气喷射 / [Space] 漂移 / [R] 切换电台`,
      4.5
    );
  }
}

// --- Keyboard Controls ---
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  audio.init();

  if (e.code === 'KeyF') {
    toggleEnterExitVehicle();
  } else if (e.code === 'KeyE') {
    missionSystem.tryInteractContextAction();
  } else if (e.code === 'Tab') {
    e.preventDefault();
    if (protagonists.triggerCharacterSwitch()) {
      const nextName = protagonists.activeId === 'lucia' ? 'Jason (杰森)' : 'Lucia (露西亚)';
      hud.showSubtitle(`正在通过卫星视角切换至: ${nextName}`, 3.5);
    }
  } else if (e.code === 'KeyR') {
    const st = audio.cycleRadioStation(1);
    hud.showSubtitle(`📻 电台已切换: ${st.name} — ${st.genre}`, 3.0);
  } else if (e.code === 'KeyG') {
    const v = protagonists.currentVehicle;
    if (v && v.type === 'police') {
      v.sirenOn = !v.sirenOn;
      hud.showSubtitle(v.sirenOn ? '🚨 VCPD 警灯与警笛已开启' : '🚨 VCPD 警笛已关闭', 2.5);
    }
  } else if (e.code === 'KeyT') {
    const p = environment.cycleWeather();
    hud.showSubtitle(`🌅 天气与光影已切换: ${p.name}`, 3.5);
  } else if (e.code === 'KeyP') {
    togglePhoneUI();
  } else if (e.code === 'KeyQ') {
    toggleWeaponWheel(true);
  } else if (e.code >= 'Digit1' && e.code <= 'Digit6') {
    const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
    const w = combat.selectWeapon(idx);
    hud.showSubtitle(`已装备武器: ${w.icon} ${w.name}`, 2.5);
  }
});

window.addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  if (e.code === 'KeyQ') {
    toggleWeaponWheel(false);
  }
});

// --- UI Overlays: Trailer Intro, iFruit Phone & Weapon Wheel ---
const introModal = document.getElementById('gta-intro-overlay');
const btnStartGame = document.getElementById('btn-start-gta6');
if (btnStartGame) {
  btnStartGame.addEventListener('click', () => {
    audio.init();
    trailerIntroActive = false;
    introModal?.classList.add('hidden');
    audio.playMissionPassedStinger();
    renderer.domElement.requestPointerLock?.();
  });
}

const phoneModal = document.getElementById('ifruit-phone');
function togglePhoneUI(forceState) {
  phoneOpen = forceState !== undefined ? forceState : !phoneOpen;
  if (phoneModal) {
    phoneModal.classList.toggle('open', phoneOpen);
  }
  if (phoneOpen && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
}

const weaponWheelEl = document.getElementById('gta-weapon-wheel');
function toggleWeaponWheel(open) {
  weaponWheelOpen = open;
  if (weaponWheelEl) {
    weaponWheelEl.classList.toggle('open', open);
  }
  if (open && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
}

// Expose actions for HTML buttons (Phone Apps, Weapon Wheel slices, Quick Bar)
window.GTA6_ACTIONS = {
  summonVehicle(type) {
    audio.init();
    const active = protagonists.getActiveActor();
    const fwdX = -Math.sin(cameraYaw);
    const fwdZ = -Math.cos(cameraYaw);
    const sx = type === 'boat' ? Math.max(138, active.pos.x + 8) : active.pos.x + fwdX * 6.5;
    const sz = active.pos.z + fwdZ * 6.5;
    const sy = type === 'boat' ? -0.1 : Math.max(0.08, active.pos.y + 0.2);

    const v = vehicleManager.spawnVehicle(type, sx, sy, sz, cameraYaw + Math.PI, null, false);
    protagonists.currentVehicle = v;
    audio.playCashPickup();
    hud.showBigBanner('PEGASUS DELIVERY', `${v.cfg.name} DELIVERED TO YOUR LOCATION`, '#00f0ff');
    togglePhoneUI(false);
  },
  setWeather(index) {
    const p = environment.applyPreset(index);
    hud.showSubtitle(`🌅 光影氛围已切换: ${p.name}`, 3.0);
  },
  switchProtagonist() {
    protagonists.triggerCharacterSwitch();
    togglePhoneUI(false);
  },
  addWantedStar() {
    combat.addWantedHeat(105, 'Leonida Most Wanted Challenge!');
  },
  clearWantedStars() {
    combat.clearWanted();
    hud.showBigBanner('WANTED CLEARED', 'VCPD DISPATCH CALLED OFF BY VICE MAYOR', '#00ff88');
  },
  toggleGodMode() {
    protagonists.godMode = !protagonists.godMode;
    protagonists.health = 100;
    protagonists.armor = 100;
    hud.showSubtitle(`无敌护甲模式 (God Mode): ${protagonists.godMode ? '已开启 ON' : '已关闭 OFF'}`, 3.0);
  },
  toggleExplosiveAmmo() {
    combat.explosiveAmmoCheat = !combat.explosiveAmmoCheat;
    hud.showSubtitle(`爆炸子弹秘籍 (Explosive Ammo): ${combat.explosiveAmmoCheat ? '已开启 ON' : '已关闭 OFF'}`, 3.0);
  },
  teleportToHelipad() {
    const active = protagonists.getActiveActor();
    protagonists.currentVehicle = null;
    active.pos.set(-81, 48.3, 4);
    active.vel.set(0, 0, 0);
    hud.showSubtitle('已传送至 Vice Tower 48层摩天楼顶停机坪！', 3.5);
    togglePhoneUI(false);
  },
  selectWeapon(index) {
    const w = combat.selectWeapon(index);
    hud.showSubtitle(`已装备: ${w.icon} ${w.name}`, 2.5);
    toggleWeaponWheel(false);
  },
  togglePhone() {
    togglePhoneUI();
  }
};

// --- Resize Handler ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main Game Loop ---
let lastTime = performance.now();
const camTargetPos = new THREE.Vector3(65, 2, -28);
const camDesiredPos = new THREE.Vector3(65, 5, -20);

function animate(now) {
  requestAnimationFrame(animate);
  let rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // Time dilation during Weapon Wheel or Stunt Jump Slow-Mo!
  let dt = rawDt;
  if (weaponWheelOpen) dt *= 0.25;
  if (stuntSlowMoTimer > 0) {
    stuntSlowMoTimer -= rawDt;
    dt *= 0.38;
  }

  const activeActor = protagonists.getActiveActor();
  const currentVeh = protagonists.currentVehicle;

  // 1. Check WASTED state
  if (protagonists.health <= 0) {
    if (wastedTimer === 0) {
      hud.showBigBanner('WASTED', 'VICE CITY MEDICAL CENTER · -$500', '#ff2942');
      combat.clearWanted();
    }
    wastedTimer += rawDt;
    dt *= 0.25;
    if (wastedTimer > 3.6) {
      wastedTimer = 0;
      protagonists.health = 100;
      protagonists.armor = 100;
      protagonists.currentVehicle = null;
      activeActor.pos.set(65, 0.05, -28);
    }
  }

  // 2. Update Player On-Foot or Vehicle Physics
  let vehTelemetry = { speedRatio: 0, isDrifting: false, isBoosting: false };

  if (!trailerIntroActive) {
    if (currentVeh) {
      vehTelemetry = vehicleManager.updatePlayerVehicle(
        currentVeh,
        dt,
        input,
        (dist, peakH) => {
          stuntSlowMoTimer = 1.6;
          protagonists.cash += 5000;
          audio.playMissionPassedStinger();
          hud.showBigBanner(
            'UNIQUE STUNT BONUS!',
            `DISTANCE: ${Math.round(dist)}m · HEIGHT: ${peakH.toFixed(1)}m · +$5,000`,
            '#00f0ff'
          );
          missionSystem.pushSnapVicePost(
            '@ViceStuntJunkie',
            'INSANE JUMP · 950K',
            `🚀 A ${currentVeh.cfg.name} just flew ${Math.round(dist)} meters over Ocean Drive!! #GTA6Stunts`
          );
        }
      );
    }

    protagonists.updateOnFoot(dt, input, cameraYaw, combat.getEquippedWeapon().id);

    // Continuous automatic weapon fire when holding Left Mouse
    if (input.leftMouseDown && !phoneOpen && !weaponWheelOpen) {
      combat.tryFireWeapon(camera);
    }
  }

  // 3. Update World, Traffic, Combat, Missions & Audio
  const focusPoint = currentVeh
    ? new THREE.Vector3(currentVeh.x, currentVeh.y, currentVeh.z)
    : activeActor.pos;

  environment.update(dt, focusPoint);
  cityMap.update(dt);
  vehicleManager.updateAllVehicles(dt, currentVeh);
  combat.update(dt);
  missionSystem.update(dt);

  const sirenHeard = (currentVeh && currentVeh.sirenOn) || combat.wantedStars >= 2;
  audio.updateVehicleAudio(
    Boolean(currentVeh),
    vehTelemetry.speedRatio,
    vehTelemetry.isDrifting,
    vehTelemetry.isBoosting,
    currentVeh?.type || 'car',
    sirenHeard,
    rawDt
  );

  // 4. Update Camera System
  if (trailerIntroActive) {
    // Iconic GTA 6 Trailer 1 Hero Panorama Orbit over Ocean Drive & Vice Beach!
    trailerAngle += rawDt * 0.18;
    const cx = 72 + Math.cos(trailerAngle) * 26;
    const cz = -28 + Math.sin(trailerAngle) * 32;
    camera.position.set(cx, 12.5 + Math.sin(trailerAngle * 2) * 3.0, cz);
    camera.lookAt(64, 4.5, -28);
  } else if (protagonists.switchAnim.active) {
    // GTA Satellite Sky-Camera Zoom Transition!
    const anim = protagonists.switchAnim;
    const t = anim.timer / anim.duration;
    const interpX = THREE.MathUtils.lerp(anim.fromPos.x, anim.toPos.x, THREE.MathUtils.smoothstep(t, 0.25, 0.75));
    const interpZ = THREE.MathUtils.lerp(anim.fromPos.z, anim.toPos.z, THREE.MathUtils.smoothstep(t, 0.25, 0.75));
    const archY = Math.sin(t * Math.PI) * 95 + 6;
    camera.position.set(interpX, archY, interpZ + 12);
    camera.lookAt(interpX, 1.0, interpZ);
  } else if (stuntSlowMoTimer > 0 && currentVeh) {
    // Cinematic Low-Angle Stunt Jump Camera!
    camera.position.set(currentVeh.x + 7.5, Math.max(1.2, currentVeh.y - 0.8), currentVeh.z + 6.5);
    camera.lookAt(currentVeh.x, currentVeh.y + 0.8, currentVeh.z);
  } else if (currentVeh) {
    // Vehicle Third-Person Chase Camera
    const dist = currentVeh.type === 'helicopter' ? 11.5 : 7.8;
    const height = currentVeh.type === 'helicopter' ? 4.2 : 2.55;
    // Gently auto-align camera behind vehicle when driving fast unless mouse is moving
    if (Math.abs(currentVeh.speed) > 4 && !input.rightMouseDown) {
      const targetYaw = currentVeh.yaw + Math.PI;
      let diff = targetYaw - cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cameraYaw += diff * Math.min(1, rawDt * 2.8);
    }

    camTargetPos.set(currentVeh.x, currentVeh.y + 1.25, currentVeh.z);
    camDesiredPos.set(
      currentVeh.x + Math.sin(cameraYaw) * dist * Math.cos(cameraPitch),
      Math.max(0.8, currentVeh.y + height + Math.sin(cameraPitch) * dist * 0.6),
      currentVeh.z + Math.cos(cameraYaw) * dist * Math.cos(cameraPitch)
    );
    camera.position.lerp(camDesiredPos, Math.min(1, rawDt * 12));
    camera.lookAt(camTargetPos);

    // Dynamic FOV boost when using Nitro!
    const targetFov = vehTelemetry.isBoosting ? 82 : 68;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, rawDt * 6);
    camera.updateProjectionMatrix();
  } else {
    // On-Foot Third-Person Follow & Over-the-Shoulder Aim Camera
    const isAiming = input.rightMouseDown;
    const dist = isAiming ? 2.35 : 4.4;
    const shoulderOffset = isAiming ? 0.58 : 0.25;
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    camTargetPos.set(
      activeActor.pos.x + rightX * shoulderOffset,
      activeActor.pos.y + 1.52 - Math.sin(cameraPitch) * 1.4,
      activeActor.pos.z + rightZ * shoulderOffset
    );

    camDesiredPos.set(
      activeActor.pos.x + rightX * shoulderOffset + Math.sin(cameraYaw) * dist * Math.cos(cameraPitch),
      Math.max(0.45, activeActor.pos.y + 1.65 + Math.sin(cameraPitch) * dist),
      activeActor.pos.z + rightZ * shoulderOffset + Math.cos(cameraYaw) * dist * Math.cos(cameraPitch)
    );

    camera.position.lerp(camDesiredPos, Math.min(1, rawDt * 15));
    camera.lookAt(camTargetPos);
    camera.fov = THREE.MathUtils.lerp(camera.fov, isAiming ? 52 : 68, rawDt * 10);
    camera.updateProjectionMatrix();
  }

  // 5. Update HUD & Radar Minimap
  const nearVeh = !currentVeh ? vehicleManager.findNearestVehicle(activeActor.pos, 6.5) : null;
  let nearInteractText = '';
  const elev = cityMap.landmarks.helipadElevator;
  const store = cityMap.landmarks.convenienceStore;
  if (Math.hypot(activeActor.pos.x - elev.x, activeActor.pos.z - elev.z) < 5.2) {
    nearInteractText = '按 [E] 乘高速电梯直达 Vice Tower 48层楼顶停机坪 (驾驶直升机)';
  } else if (Math.hypot(activeActor.pos.x - 58, activeActor.pos.z - store.z) < 7.0) {
    nearInteractText = '按 [E] 抢劫 24/7 Leonida 超市收银机 (+$3,500~$6,000)';
  }

  hud.updateHUD(rawDt, {
    protagonists,
    combat,
    missionSystem,
    audio,
    cameraYaw,
    nearVehicle: nearVeh,
    nearInteractText
  });

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
