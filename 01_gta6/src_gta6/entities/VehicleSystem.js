import * as THREE from 'three';

// ============================================================================
// GTA VI: Vice City (Leonida) — Vehicle Physics, 7 Archetypes (Supercars,
// Convertibles, Muscle, Donk, VCPD Police, Maverick Helicopter, Speedboat),
// Drift Skidmarks, Nitro Boost Flames & Unique Stunt Jump Detection
// ============================================================================

export const VEHICLE_ARCHETYPES = {
  cheetah: {
    type: 'cheetah',
    name: 'Grotti Cheetah Vice',
    category: 'SUPERCAR · 超级跑车',
    maxSpeed: 46,
    accel: 28,
    turnRate: 2.35,
    driftGrip: 0.92,
    w: 2.15,
    h: 1.18,
    l: 4.55,
    defaultColors: [0xff2a85, 0x00f0ff, 0xffbe2e, 0x9b4dff]
  },
  banshee: {
    type: 'banshee',
    name: 'Bravado Banshee Cabrio',
    category: 'CONVERTIBLE · 敞篷跑车',
    maxSpeed: 43,
    accel: 25,
    turnRate: 2.45,
    driftGrip: 0.89,
    w: 2.08,
    h: 1.15,
    l: 4.4,
    defaultColors: [0xff384c, 0x00d8ff, 0xffe144, 0xffffff]
  },
  muscle: {
    type: 'muscle',
    name: 'Declasse Sabre Turbo',
    category: 'MUSCLE · 美式肌肉车',
    maxSpeed: 39,
    accel: 26,
    turnRate: 2.25,
    driftGrip: 0.84, // Loves big powerslides!
    w: 2.1,
    h: 1.32,
    l: 4.65,
    defaultColors: [0xff7722, 0x22e58b, 0xd426ff, 0x181b24]
  },
  lowrider: {
    type: 'lowrider',
    name: 'Vapid Chino Donk Custom',
    category: 'LEONIDA CUSTOM · 改装大轮车',
    maxSpeed: 35,
    accel: 21,
    turnRate: 2.1,
    driftGrip: 0.9,
    w: 2.15,
    h: 1.45,
    l: 4.8,
    defaultColors: [0x9d34ff, 0xff3ca6, 0x00e6a8, 0xffb82e]
  },
  police: {
    type: 'police',
    name: 'VCPD Stanier Cruiser',
    category: 'EMERGENCY · 罪恶都市警车',
    maxSpeed: 42,
    accel: 26,
    turnRate: 2.3,
    driftGrip: 0.9,
    w: 2.1,
    h: 1.42,
    l: 4.65,
    defaultColors: [0x151924]
  },
  helicopter: {
    type: 'helicopter',
    name: 'Buckingham Vice Maverick',
    category: 'HELICOPTER · 武装/观光直升机',
    maxSpeed: 54,
    accel: 24,
    turnRate: 2.1,
    driftGrip: 0.96,
    w: 2.6,
    h: 2.9,
    l: 6.8,
    defaultColors: [0xff2a85, 0x00f0ff]
  },
  boat: {
    type: 'boat',
    name: 'Shitzu Squalo Vice',
    category: 'SPEEDBOAT · 海洋快艇',
    maxSpeed: 44,
    accel: 24,
    turnRate: 1.95,
    driftGrip: 0.93,
    w: 2.4,
    h: 1.3,
    l: 6.2,
    defaultColors: [0xffffff, 0x00f0ff, 0xff3ca6]
  }
};

export function createVehicleMesh(type, primaryColorHex) {
  const cfg = VEHICLE_ARCHETYPES[type] || VEHICLE_ARCHETYPES.cheetah;
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group(); // Tilts with suspension pitch/roll!
  root.add(bodyGroup);

  const paintMat = new THREE.MeshStandardMaterial({
    color: primaryColorHex,
    metalness: 0.65,
    roughness: 0.22
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x162238,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.78
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe8eef5,
    metalness: 0.92,
    roughness: 0.14
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x181a22,
    roughness: 0.6
  });

  const wheels = [];
  let mainRotor = null;
  let tailRotor = null;
  let sirenRed = null;
  let sirenBlue = null;

  // --- HELICOPTER MESH ---
  if (type === 'helicopter') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 3.6), paintMat);
    cabin.position.set(0, 1.45, 0.3);
    cabin.castShadow = true;
    bodyGroup.add(cabin);

    const noseGlass = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.35, 1.5), glassMat);
    noseGlass.position.set(0, 1.4, 1.85);
    bodyGroup.add(noseGlass);

    // Vice racing stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.14, 0.28, 3.65),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    stripe.position.set(0, 1.35, 0.3);
    bodyGroup.add(stripe);

    // Tail boom
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 4.2), paintMat);
    boom.position.set(0, 1.65, -3.2);
    bodyGroup.add(boom);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.9), paintMat);
    fin.position.set(0, 2.2, -5.0);
    bodyGroup.add(fin);

    // Landing skids
    [-0.95, 0.95].forEach((sx) => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.8, 8), chromeMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.15, 0.4);
      bodyGroup.add(skid);

      const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), chromeMat);
      strut1.position.set(sx, 0.5, 1.2);
      const strut2 = strut1.clone();
      strut2.position.set(sx, 0.5, -0.4);
      bodyGroup.add(strut1, strut2);
    });

    // Main & Tail Rotors
    mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.55, 0.3);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8), chromeMat);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.05, 0.34), darkTrimMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 8.6), darkTrimMat);
    mainRotor.add(mast, blade1, blade2);
    bodyGroup.add(mainRotor);

    tailRotor = new THREE.Group();
    tailRotor.position.set(0.16, 2.3, -5.0);
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.18), chromeMat);
    tailRotor.add(tBlade);
    bodyGroup.add(tailRotor);
  }
  // --- SPEEDBOAT MESH ---
  else if (type === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.85, 5.2), paintMat);
    hull.position.set(0, 0.55, -0.3);
    hull.castShadow = true;
    bodyGroup.add(hull);

    // Pointed bow
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.62, 2.2, 4), paintMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 0.62, 3.1);
    bodyGroup.add(bow);

    // Neon hull stripe
    const neonStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 0.16, 5.1),
      new THREE.MeshBasicMaterial({ color: 0xff47b6 })
    );
    neonStripe.position.set(0, 0.72, -0.2);
    bodyGroup.add(neonStripe);

    // Cockpit windshield
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.52, 0.9), glassMat);
    screen.position.set(0, 1.15, 0.8);
    screen.rotation.x = -0.35;
    bodyGroup.add(screen);
  }
  // --- WHEELED CARS (SUPERCAR, CONVERTIBLE, MUSCLE, LOWRIDER, POLICE) ---
  else {
    const isLowrider = type === 'lowrider';
    const chassisY = isLowrider ? 0.68 : 0.52;

    // Lower body chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, 0.62, cfg.l), paintMat);
    chassis.position.y = chassisY;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    bodyGroup.add(chassis);

    // Racing stripe or Police doors
    if (type === 'banshee' || type === 'muscle') {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.64, cfg.l + 0.02),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      stripe.position.y = chassisY;
      bodyGroup.add(stripe);
    } else if (type === 'police') {
      const whiteDoors = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w + 0.03, 0.58, 1.85),
        new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.35 })
      );
      whiteDoors.position.set(0, chassisY, 0);
      bodyGroup.add(whiteDoors);
    }

    // Cabin / Roof (Banshee is an open-top convertible!)
    if (type === 'banshee') {
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.88, 0.52, 0.16), glassMat);
      windshield.position.set(0, chassisY + 0.5, 0.68);
      windshield.rotation.x = -0.42;
      bodyGroup.add(windshield);

      // Bucket seats inside convertible
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x221929 });
      [-0.45, 0.45].forEach((sx) => {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 0.5), seatMat);
        seat.position.set(sx, chassisY + 0.35, -0.15);
        bodyGroup.add(seat);
      });
    } else {
      const cabinH = type === 'cheetah' ? 0.46 : 0.56;
      const cabinL = type === 'cheetah' ? 2.0 : 2.25;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.84, cabinH, cabinL), paintMat);
      cabin.position.set(0, chassisY + 0.52, -0.15);
      cabin.castShadow = true;
      bodyGroup.add(cabin);

      const glassBox = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w * 0.86, cabinH * 0.82, cabinL * 0.92),
        glassMat
      );
      glassBox.position.set(0, chassisY + 0.51, -0.15);
      bodyGroup.add(glassBox);
    }

    // Supercar Spoiler & Neon Underglow
    if (type === 'cheetah') {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.96, 0.08, 0.42), paintMat);
      wing.position.set(0, chassisY + 0.58, -cfg.l / 2 + 0.28);
      bodyGroup.add(wing);

      const underglow = new THREE.Mesh(
        new THREE.PlaneGeometry(cfg.w * 0.9, cfg.l * 0.82),
        new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide
        })
      );
      underglow.rotateX(-Math.PI / 2);
      underglow.position.y = 0.06;
      bodyGroup.add(underglow);
    }

    // Muscle Car Supercharger Blower on Hood
    if (type === 'muscle') {
      const blower = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.68), chromeMat);
      blower.position.set(0, chassisY + 0.42, 1.15);
      bodyGroup.add(blower);
    }

    // Police Cruiser Rooftop LED Lightbar & Pushbar
    if (type === 'police') {
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.32), chromeMat);
      barBase.position.set(0, chassisY + 0.86, -0.1);
      bodyGroup.add(barBase);

      sirenRed = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.16, 0.28),
        new THREE.MeshBasicMaterial({ color: 0xff1e38 })
      );
      sirenRed.position.set(-0.34, chassisY + 0.92, -0.1);

      sirenBlue = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.16, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x1e78ff })
      );
      sirenBlue.position.set(0.34, chassisY + 0.92, -0.1);
      bodyGroup.add(sirenRed, sirenBlue);
    }

    // Headlights & Taillights
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfff6d6 });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff1e38 });
    [-cfg.w * 0.34, cfg.w * 0.34].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), headLightMat);
      hl.position.set(lx, chassisY + 0.06, cfg.l / 2 + 0.02);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailLightMat);
      tl.position.set(lx, chassisY + 0.08, -cfg.l / 2 - 0.02);
      bodyGroup.add(hl, tl);
    });

    // 4 Spinning Wheels (Oversized chrome/gold rims for Leonida Donk Lowrider!)
    const wheelRadius = isLowrider ? 0.52 : 0.38;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.32, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: isLowrider ? 0xffd24c : 0xdde6f0,
      metalness: 0.9,
      roughness: 0.15
    });

    const wheelPositions = [
      { x: -cfg.w / 2 - 0.04, y: wheelRadius, z: cfg.l * 0.31, front: true },
      { x: cfg.w / 2 + 0.04, y: wheelRadius, z: cfg.l * 0.31, front: true },
      { x: -cfg.w / 2 - 0.04, y: wheelRadius, z: -cfg.l * 0.31, front: false },
      { x: cfg.w / 2 + 0.04, y: wheelRadius, z: -cfg.l * 0.31, front: false }
    ];

    wheelPositions.forEach((wp) => {
      const wPivot = new THREE.Group();
      wPivot.position.set(wp.x, wp.y, wp.z);
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.64, wheelRadius * 0.64, 0.34, 12).rotateZ(Math.PI / 2),
        rimMat
      );
      tire.add(hub);
      wPivot.add(tire);
      wPivot.userData = { tire, front: wp.front };
      root.add(wPivot);
      wheels.push(wPivot);
    });
  }

  // Twin Nitro Exhaust Flame Cones
  const nitroGroup = new THREE.Group();
  const flameGeo = new THREE.ConeGeometry(0.18, 1.45, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.88
  });
  [-0.45, 0.45].forEach((fx) => {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(fx, 0.38, -cfg.l / 2 - 0.7);
    nitroGroup.add(f);
  });
  nitroGroup.visible = false;
  bodyGroup.add(nitroGroup);

  // Damage Hood Smoke Indicator
  const smokeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.55 })
  );
  smokeMesh.position.set(0, 1.1, cfg.l * 0.28);
  smokeMesh.visible = false;
  bodyGroup.add(smokeMesh);

  root.userData = {
    bodyGroup,
    paintMat,
    wheels,
    mainRotor,
    tailRotor,
    sirenRed,
    sirenBlue,
    nitroGroup,
    smokeMesh
  };

  return root;
}

export class VehicleManager {
  constructor(scene, cityMap, environment, audioEngine) {
    this.scene = scene;
    this.cityMap = cityMap;
    this.environment = environment;
    this.audio = audioEngine;

    this.vehicles = [];
    this.stuntJumpState = {
      active: false,
      timer: 0,
      startX: 0,
      startZ: 0,
      peakHeight: 0,
      rampName: ''
    };

    // Skidmark pool on asphalt
    this.skidmarks = [];
    this.maxSkidmarks = 220;
    this._initSkidmarkPool();

    // Tire smoke / water wake particle pool
    this.particles = [];
    this._initParticlePool();

    this._spawnSignatureParkedVehicles();
  }

  _initSkidmarkPool() {
    const geo = new THREE.PlaneGeometry(0.32, 1.05);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0b0b0f,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    for (let i = 0; i < this.maxSkidmarks; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.scene.add(m);
      this.skidmarks.push(m);
    }
    this.skidCursor = 0;
  }

  _initParticlePool() {
    const geo = new THREE.SphereGeometry(0.38, 6, 6);
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.scene.add(m);
      this.particles.push({ mesh: m, life: 0, maxLife: 0.7, vx: 0, vy: 0, vz: 0 });
    }
    this.particleCursor = 0;
  }

  spawnSmokeParticle(x, y, z, colorHex = 0xeeeeee, scale = 1.0) {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.mesh.position.set(x, y, z);
    p.mesh.material.color.setHex(colorHex);
    p.mesh.scale.setScalar(0.5 * scale);
    p.mesh.visible = true;
    p.life = 0.65;
    p.maxLife = 0.65;
    p.vx = (Math.random() - 0.5) * 1.8;
    p.vy = 1.2 + Math.random() * 1.6;
    p.vz = (Math.random() - 0.5) * 1.8;
  }

  addSkidmark(x, y, z, yaw) {
    const s = this.skidmarks[this.skidCursor];
    this.skidCursor = (this.skidCursor + 1) % this.maxSkidmarks;
    s.position.set(x, y + 0.03, z);
    s.rotation.y = yaw;
    s.visible = true;
  }

  spawnVehicle(type, x, y, z, yaw = 0, customColor = null, isAI = false) {
    const cfg = VEHICLE_ARCHETYPES[type] || VEHICLE_ARCHETYPES.cheetah;
    const color = customColor ?? cfg.defaultColors[Math.floor(Math.random() * cfg.defaultColors.length)];
    const mesh = createVehicleMesh(type, color);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);

    const v = {
      id: 'veh_' + Math.random().toString(36).slice(2, 8),
      type,
      cfg,
      mesh,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      speed: 0,
      yaw,
      steerAngle: 0,
      pitch: 0,
      roll: 0,
      health: 100,
      exploded: false,
      sirenOn: type === 'police' && isAI,
      sirenTimer: 0,
      isAI,
      isPolicePursuit: false,
      colorHex: color
    };
    this.vehicles.push(v);
    return v;
  }

  _spawnSignatureParkedVehicles() {
    // 1. Lucia & Jason's Getaway Banshee Convertible right outside Ocean Drive Diner!
    this.spawnVehicle('banshee', 68, 0.05, -32, 0, 0xff2a6d, false);
    // 2. Hot-Pink Grotti Cheetah Vice Supercar on Ocean Drive!
    this.spawnVehicle('cheetah', 68, 0.05, -14, 0, 0xff2a85, false);
    // 3. Cyan Grotti Cheetah Vice near LEONIDA CLUB
    this.spawnVehicle('cheetah', 68, 0.05, 8, Math.PI, 0x00f0ff, false);
    // 4. Declasse Sabre Turbo Muscle Car
    this.spawnVehicle('muscle', 68, 0.05, 36, 0, 0xff7722, false);
    // 5. Trailer 1 Vapid Chino Donk Custom Lowrider
    this.spawnVehicle('lowrider', 20, 0.05, -18, 0, 0x9d34ff, false);
    // 6. Parked VCPD Police Cruiser near Civic Center
    this.spawnVehicle('police', -65, 0.05, -95, Math.PI / 2, 0x151924, false);
    // 7. Buckingham Vice Maverick Helicopter on Vice Tower Rooftop Helipad (y = 48.2)!
    this.spawnVehicle('helicopter', -85, 48.25, 0, Math.PI / 4, 0xff2a85, false);
    // Also a second Maverick Helicopter near Starfish Beach Helipad Pad (x = 104, z = -72) for instant access!
    this.spawnVehicle('helicopter', 105, 0.08, -72, -Math.PI / 2, 0x00f0ff, false);
    // 8. Shitzu Squalo Speedboats moored in the water at Vice Marina & Starfish Pier!
    this.spawnVehicle('boat', 148, -0.2, 118, 0, 0xffffff, false);
    this.spawnVehicle('boat', 156, -0.2, -22, 0, 0x00f0ff, false);
  }

  findNearestVehicle(pos, maxDist = 6.2) {
    let best = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      const d = Math.hypot(v.x - pos.x, v.y - pos.y, v.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  resprayVehicle(v) {
    const neonColors = [0xff2a85, 0x00f0ff, 0x00ff9d, 0xffbe2e, 0xb54cff, 0xffffff];
    const nextColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    v.colorHex = nextColor;
    v.health = 100;
    v.mesh.userData.paintMat.color.setHex(nextColor);
    v.mesh.userData.smokeMesh.visible = false;
  }

  updatePlayerVehicle(v, dt, input, onStuntJumpCompleted) {
    if (!v || v.exploded) return { speedRatio: 0, isDrifting: false, isBoosting: false };

    const cfg = v.cfg;
    const throttle = (input.keys['KeyW'] || input.keys['ArrowUp'] ? 1 : 0) -
                     (input.keys['KeyS'] || input.keys['ArrowDown'] ? 1 : 0);
    const steerInput = (input.keys['KeyA'] || input.keys['ArrowLeft'] ? 1 : 0) -
                       (input.keys['KeyD'] || input.keys['ArrowRight'] ? 1 : 0);
    const handbrake = Boolean(input.keys['Space']);
    const nitro = Boolean(input.keys['ShiftLeft'] || input.keys['ShiftRight']);

    // --- HELICOPTER FLIGHT PHYSICS ---
    if (v.type === 'helicopter') {
      const ascend = (input.keys['Space'] || input.keys['KeyE'] ? 1 : 0) -
                     (input.keys['ShiftLeft'] || input.keys['KeyC'] ? 1 : 0);

      v.yaw += steerInput * 1.75 * dt;
      const targetSpeed = throttle * cfg.maxSpeed;
      v.speed = THREE.MathUtils.lerp(v.speed, targetSpeed, dt * 2.5);

      const fwdX = Math.sin(v.yaw);
      const fwdZ = Math.cos(v.yaw);
      v.vx = THREE.MathUtils.lerp(v.vx, fwdX * v.speed, dt * 3.0);
      v.vz = THREE.MathUtils.lerp(v.vz, fwdZ * v.speed, dt * 3.0);
      v.vy = THREE.MathUtils.lerp(v.vy, ascend * 16.5, dt * 4.0);

      v.x += v.vx * dt;
      v.z += v.vz * dt;
      v.y += v.vy * dt;

      const groundY = Math.max(0.05, this.cityMap.getGroundHeight(v.x, v.z));
      const roofY = this.cityMap.getRoofHeightAt(v.x, v.z);
      const minFloor = (roofY > 0 && v.y >= roofY - 1.5) ? roofY : groundY;
      if (v.y < minFloor) {
        v.y = minFloor;
        v.vy = 0;
      }

      // Helicopter cyclic pitch & roll tilt
      v.pitch = THREE.MathUtils.lerp(v.pitch, throttle * 0.24, dt * 5);
      v.roll = THREE.MathUtils.lerp(v.roll, -steerInput * 0.28, dt * 5);

      v.mesh.position.set(v.x, v.y, v.z);
      v.mesh.rotation.y = v.yaw;
      v.mesh.userData.bodyGroup.rotation.x = v.pitch;
      v.mesh.userData.bodyGroup.rotation.z = v.roll;

      if (v.mesh.userData.mainRotor) v.mesh.userData.mainRotor.rotation.y += dt * 28;
      if (v.mesh.userData.tailRotor) v.mesh.userData.tailRotor.rotation.x += dt * 34;

      return { speedRatio: Math.abs(v.speed) / cfg.maxSpeed, isDrifting: false, isBoosting: false };
    }

    // --- SPEEDBOAT WATER PHYSICS ---
    if (v.type === 'boat') {
      const waterY = this.environment.getWaterHeight(v.x, v.z);
      const inWater = v.x > 116;
      const topSpd = inWater ? cfg.maxSpeed * (nitro ? 1.28 : 1.0) : 6.0;

      if (throttle !== 0) {
        v.speed += throttle * cfg.accel * dt;
      } else {
        v.speed *= Math.pow(0.4, dt);
      }
      v.speed = THREE.MathUtils.clamp(v.speed, -14, topSpd);

      if (Math.abs(v.speed) > 0.5) {
        v.yaw += steerInput * cfg.turnRate * Math.sign(v.speed) * dt;
      }
      const fwdX = Math.sin(v.yaw);
      const fwdZ = Math.cos(v.yaw);
      v.vx = fwdX * v.speed;
      v.vz = fwdZ * v.speed;
      v.x = Math.max(116, v.x + v.vx * dt);
      v.z += v.vz * dt;
      v.y = waterY + 0.15;

      // Speedboat bow lift when accelerating!
      v.pitch = THREE.MathUtils.lerp(v.pitch, -Math.max(0, v.speed / cfg.maxSpeed) * 0.18, dt * 6);
      v.roll = THREE.MathUtils.lerp(v.roll, -steerInput * (v.speed / cfg.maxSpeed) * 0.22, dt * 6);
      v.mesh.position.set(v.x, v.y, v.z);
      v.mesh.rotation.y = v.yaw;
      v.mesh.userData.bodyGroup.rotation.x = v.pitch;
      v.mesh.userData.bodyGroup.rotation.z = v.roll;

      if (Math.abs(v.speed) > 5) {
        this.spawnSmokeParticle(
          v.x - fwdX * 2.8 + (Math.random() - 0.5),
          v.y + 0.2,
          v.z - fwdZ * 2.8 + (Math.random() - 0.5),
          0xe6fcff,
          1.25
        );
      }
      return { speedRatio: Math.abs(v.speed) / cfg.maxSpeed, isDrifting: false, isBoosting: nitro };
    }

    // --- WHEELED CAR ARCADE-SIMULATION PHYSICS (WITH DRIFT & STUNT JUMPS!) ---
    const boostMult = nitro && throttle > 0 ? 1.32 : 1.0;
    const maxSpd = cfg.maxSpeed * boostMult;

    if (throttle !== 0) {
      v.speed += throttle * cfg.accel * boostMult * dt;
    } else {
      v.speed *= Math.pow(0.28, dt);
    }

    if (handbrake) {
      v.speed *= Math.pow(0.45, dt);
    }
    v.speed = THREE.MathUtils.clamp(v.speed, -18, maxSpd);

    const speedNorm = Math.min(1, Math.abs(v.speed) / cfg.maxSpeed);
    const turnStrength = cfg.turnRate * (handbrake ? 1.42 : 1.0) * Math.min(1, Math.abs(v.speed) / 5.5);
    if (Math.abs(v.speed) > 0.35) {
      v.yaw += steerInput * turnStrength * Math.sign(v.speed) * dt;
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);

    // Lateral velocity blending for authentic rear-end powerslides!
    const grip = handbrake ? 2.6 : (cfg.driftGrip * 8.5);
    v.vx = THREE.MathUtils.lerp(v.vx, fwdX * v.speed, Math.min(1, dt * grip));
    v.vz = THREE.MathUtils.lerp(v.vz, fwdZ * v.speed, Math.min(1, dt * grip));

    const prevGroundY = this.cityMap.getGroundHeight(v.x, v.z);
    const nextX = v.x + v.vx * dt;
    const nextZ = v.z + v.vz * dt;
    const newGroundY = this.cityMap.getGroundHeight(nextX, nextZ);

    // Check if launching off a stunt ramp!
    const slopeVelY = (newGroundY - prevGroundY) / Math.max(0.001, dt);
    const onGround = v.y <= newGroundY + 0.12;

    if (onGround) {
      v.y = newGroundY;
      if (slopeVelY > 2.2 && v.speed > 18) {
        v.vy = slopeVelY * 1.18;
      } else {
        v.vy = 0;
      }
      if (this.stuntJumpState.active && this.stuntJumpState.timer > 0.35) {
        const dist = Math.hypot(v.x - this.stuntJumpState.startX, v.z - this.stuntJumpState.startZ);
        if (onStuntJumpCompleted && dist > 16) {
          onStuntJumpCompleted(dist, this.stuntJumpState.peakHeight, this.stuntJumpState.rampName);
        }
        this.stuntJumpState.active = false;
      }
    } else {
      // Airborne!
      v.vy -= 21.0 * dt;
      v.y += v.vy * dt;
      if (v.y - newGroundY > 2.4 && !this.stuntJumpState.active && v.speed > 20) {
        this.stuntJumpState.active = true;
        this.stuntJumpState.timer = 0;
        this.stuntJumpState.startX = v.x;
        this.stuntJumpState.startZ = v.z;
        this.stuntJumpState.peakHeight = v.y;
        this.stuntJumpState.rampName = 'UNIQUE STUNT JUMP';
      }
      if (this.stuntJumpState.active) {
        this.stuntJumpState.timer += dt;
        this.stuntJumpState.peakHeight = Math.max(this.stuntJumpState.peakHeight, v.y);
      }
      if (v.y <= newGroundY) {
        v.y = newGroundY;
        v.vy = 0;
      }
    }

    // Building collision
    const col = this.cityMap.resolveHorizontalCollision(nextX, nextZ, v.y, 1.35);
    if (col.hit && Math.abs(v.speed) > 12) {
      v.speed *= -0.35;
      v.health = Math.max(10, v.health - 8);
    }
    v.x = col.x;
    v.z = col.z;

    // Suspension pitch & roll
    const targetPitch = !onGround
      ? THREE.MathUtils.clamp(-v.vy * 0.03, -0.35, 0.35)
      : (throttle * -0.045);
    const targetRoll = steerInput * speedNorm * (handbrake ? 0.14 : 0.08);
    v.pitch = THREE.MathUtils.lerp(v.pitch, targetPitch, dt * 8);
    v.roll = THREE.MathUtils.lerp(v.roll, targetRoll, dt * 8);

    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = v.yaw;
    v.mesh.userData.bodyGroup.rotation.x = v.pitch;
    v.mesh.userData.bodyGroup.rotation.z = v.roll;

    // Spin wheels & steer front wheels
    v.steerAngle = THREE.MathUtils.lerp(v.steerAngle, steerInput * 0.42, dt * 10);
    v.mesh.userData.wheels.forEach((w) => {
      w.userData.tire.rotation.x += v.speed * dt * 2.2;
      if (w.userData.front) {
        w.rotation.y = v.steerAngle;
      }
    });

    // Nitro exhaust flames
    v.mesh.userData.nitroGroup.visible = nitro && throttle > 0;
    v.mesh.userData.smokeMesh.visible = v.health < 45;

    // Drift detection, tire smoke & asphalt skidmarks!
    const forwardDot = (v.vx * fwdX + v.vz * fwdZ) / (Math.hypot(v.vx, v.vz) + 0.001);
    const isDrifting = onGround && Math.abs(v.speed) > 9 && (handbrake || forwardDot < 0.94);

    if (isDrifting) {
      const cos = Math.cos(v.yaw);
      const sin = Math.sin(v.yaw);
      const rearZ = -cfg.l * 0.32;
      [-cfg.w * 0.45, cfg.w * 0.45].forEach((rx) => {
        const wx = v.x + rx * cos + rearZ * sin;
        const wz = v.z - rx * sin + rearZ * cos;
        this.addSkidmark(wx, v.y, wz, v.yaw);
        if (Math.random() < 0.55) {
          this.spawnSmokeParticle(wx, v.y + 0.25, wz, 0xf2f2f7, 0.9);
        }
      });
    }

    return { speedRatio: v.speed / cfg.maxSpeed, isDrifting, isBoosting: nitro && throttle > 0 };
  }

  updateAllVehicles(dt, playerVehicle) {
    // Update particles
    for (const p of this.particles) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const ratio = p.life / p.maxLife;
      p.mesh.scale.addScalar(dt * 1.4);
      p.mesh.material.opacity = ratio * 0.5;
    }

    // Update police lightbars & idle rotors
    for (const v of this.vehicles) {
      if (v.exploded) continue;
      if (v.type === 'police' && v.mesh.userData.sirenRed) {
        if (v.sirenOn) {
          v.sirenTimer += dt * 12;
          const flash = Math.sin(v.sirenTimer) > 0;
          v.mesh.userData.sirenRed.material.color.setHex(flash ? 0xff1e38 : 0x33050c);
          v.mesh.userData.sirenBlue.material.color.setHex(flash ? 0x051a44 : 0x00a2ff);
        } else {
          v.mesh.userData.sirenRed.material.color.setHex(0x550c18);
          v.mesh.userData.sirenBlue.material.color.setHex(0x0c2455);
        }
      }
    }
  }
}
