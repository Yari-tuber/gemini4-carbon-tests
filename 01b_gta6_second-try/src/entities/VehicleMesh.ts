import * as THREE from 'three';
import { VehicleKind, VehicleSpec } from '../types';

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  supercar: {
    kind: 'supercar',
    displayName: 'Grotti Cheetah Vice',
    cnName: '猎豹复古超跑',
    maxSpeed: 54,
    accel: 34,
    brake: 42,
    turnSpeed: 2.55,
    driftFactor: 0.92,
    maxHealth: 260,
    mass: 1.3,
    halfWidth: 1.08,
    halfLength: 2.35,
    seatHeight: 0.65
  },
  convertible: {
    kind: 'convertible',
    displayName: 'Pfister Comet Cabrio',
    cnName: '彗星霓虹敞篷跑车',
    maxSpeed: 48,
    accel: 30,
    brake: 38,
    turnSpeed: 2.65,
    driftFactor: 0.9,
    maxHealth: 240,
    mass: 1.2,
    halfWidth: 1.04,
    halfLength: 2.2,
    seatHeight: 0.68
  },
  muscle: {
    kind: 'muscle',
    displayName: 'Declasse Tulip V8',
    cnName: '郁金香美式肌肉车 (预告同款)',
    maxSpeed: 45,
    accel: 29,
    brake: 34,
    turnSpeed: 2.45,
    driftFactor: 0.95,
    maxHealth: 300,
    mass: 1.55,
    halfWidth: 1.06,
    halfLength: 2.38,
    seatHeight: 0.72
  },
  suv: {
    kind: 'suv',
    displayName: 'Gallivanter Baller LE',
    cnName: '行者豪华越野 SUV',
    maxSpeed: 39,
    accel: 23,
    brake: 32,
    turnSpeed: 2.15,
    driftFactor: 0.86,
    maxHealth: 420,
    mass: 2.15,
    halfWidth: 1.15,
    halfLength: 2.45,
    seatHeight: 0.95
  },
  police: {
    kind: 'police',
    displayName: 'VCPD Interceptor',
    cnName: '罪恶城警用巡逻车',
    maxSpeed: 47,
    accel: 31,
    brake: 38,
    turnSpeed: 2.5,
    driftFactor: 0.9,
    maxHealth: 320,
    mass: 1.65,
    halfWidth: 1.06,
    halfLength: 2.38,
    seatHeight: 0.75
  },
  swat: {
    kind: 'swat',
    displayName: 'NOOSE Armored Enforcer',
    cnName: '雷奥奈达重装防暴特警车',
    maxSpeed: 37,
    accel: 24,
    brake: 35,
    turnSpeed: 2.0,
    driftFactor: 0.84,
    maxHealth: 650,
    mass: 3.1,
    halfWidth: 1.24,
    halfLength: 2.75,
    seatHeight: 1.1
  },
  bike: {
    kind: 'bike',
    displayName: 'Pegassi Bati 801 Vice',
    cnName: '佩嘉西街头重机摩托',
    maxSpeed: 52,
    accel: 38,
    brake: 40,
    turnSpeed: 3.1,
    driftFactor: 0.88,
    maxHealth: 160,
    mass: 0.55,
    halfWidth: 0.48,
    halfLength: 1.25,
    seatHeight: 0.82
  },
  boat: {
    kind: 'boat',
    displayName: 'Shitzu Squalo Turbo',
    cnName: '狂鲨迈阿密竞速快艇',
    maxSpeed: 46,
    accel: 26,
    brake: 20,
    turnSpeed: 2.1,
    driftFactor: 0.95,
    maxHealth: 320,
    mass: 1.5,
    halfWidth: 1.35,
    halfLength: 3.3,
    seatHeight: 0.75
  },
  helicopter: {
    kind: 'helicopter',
    displayName: 'Buckingham Vice Maverick',
    cnName: '罪恶城警用/VIP 直升机',
    maxSpeed: 56,
    accel: 28,
    brake: 24,
    turnSpeed: 2.2,
    driftFactor: 0.96,
    maxHealth: 400,
    mass: 2.0,
    halfWidth: 1.4,
    halfLength: 3.6,
    seatHeight: 1.15
  }
};

export interface BuiltVehicleMesh {
  root: THREE.Group;
  bodyTiltGroup: THREE.Group;
  bodyPaintMat: THREE.MeshStandardMaterial;
  wheels: THREE.Object3D[];
  frontSteerPivots: THREE.Group[];
  brakeLightMat: THREE.MeshStandardMaterial;
  sirenRedMat?: THREE.MeshStandardMaterial;
  sirenBlueMat?: THREE.MeshStandardMaterial;
  mainRotor?: THREE.Object3D;
  tailRotor?: THREE.Object3D;
}

export function buildVehicleMesh(kind: VehicleKind, paintHex?: number): BuiltVehicleMesh {
  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const vicePaints = [
    0xff2e93, // Vice Hot Pink
    0x00f0ff, // Miami Cyan
    0xffbe0b, // Sunset Gold
    0xf72585, // Magenta
    0x3a86ff, // Ocean Blue
    0xfb5607, // Coral Orange
    0xf8f9fa, // Pearl White
    0x7209b7  // Neon Purple
  ];
  const chosenPaint =
    paintHex ??
    (kind === 'police'
      ? 0x111827
      : kind === 'swat'
      ? 0x161a22
      : kind === 'muscle'
      ? 0xc1121f // Classic burgundy/red getaway Tulip
      : vicePaints[Math.floor(Math.random() * vicePaints.length)]);

  const bodyPaintMat = new THREE.MeshStandardMaterial({
    color: chosenPaint,
    metalness: 0.68,
    roughness: 0.22
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.55, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x112233,
    metalness: 0.85,
    roughness: 0.1,
    transparent: true,
    opacity: 0.78
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3c4,
    emissiveIntensity: 3.2
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e38,
    emissive: 0xff112b,
    emissiveIntensity: 1.8
  });

  const wheels: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Group[] = [];

  if (kind === 'boat') {
    // Sleek Miami Offshore Speedboat (+Z is forward)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.85, 5.4), bodyPaintMat);
    hull.position.set(0, 0.45, -0.3);
    hull.castShadow = true;

    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.62, 2.4, 4), bodyPaintMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.scale.set(1, 1, 0.42);
    bow.position.set(0, 0.52, 3.4);
    bow.castShadow = true;

    const deckInset = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.25, 2.8), darkTrimMat);
    deckInset.position.set(0, 0.82, -0.5);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.48, 0.8), glassMat);
    windshield.rotation.x = -0.45;
    windshield.position.set(0, 1.05, 0.9);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 0.14, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00a8b5, emissiveIntensity: 0.8 })
    );
    stripe.position.set(0, 0.62, -0.2);

    bodyTiltGroup.add(hull, bow, deckInset, windshield, stripe);
    return { root, bodyTiltGroup, bodyPaintMat, wheels, frontSteerPivots, brakeLightMat };
  }

  if (kind === 'helicopter') {
    // Buckingham Vice Maverick Helicopter (+Z is forward)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.75, 3.6), bodyPaintMat);
    cabin.position.set(0, 1.45, 0.2);
    cabin.castShadow = true;

    const noseGlass = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), glassMat);
    noseGlass.scale.set(0.95, 0.8, 1.25);
    noseGlass.position.set(0, 1.38, 1.85);

    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.48, 4.2), bodyPaintMat);
    tailBoom.position.set(0, 1.65, -3.4);
    tailBoom.castShadow = true;

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 0.75), bodyPaintMat);
    tailFin.position.set(0, 2.1, -5.3);

    // Landing skids
    for (const sx of [-0.95, 0.95]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 8), darkTrimMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.12, 0.2);
      const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6), darkTrimMat);
      strut1.position.set(sx * 0.85, 0.42, 0.9);
      const strut2 = strut1.clone();
      strut2.position.set(sx * 0.85, 0.42, -0.6);
      bodyTiltGroup.add(skid, strut1, strut2);
    }

    // Main Rotor & Tail Rotor
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.52, 0.2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8), darkTrimMat);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.04, 0.34), darkTrimMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 8.8), darkTrimMat);
    mainRotor.add(mast, blade1, blade2);

    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.45, 0.18), darkTrimMat);
    tailRotor.position.set(0.28, 2.1, -5.35);

    const noseLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), headLightMat);
    noseLight.position.set(0, 0.72, 2.5);

    bodyTiltGroup.add(cabin, noseGlass, tailBoom, tailFin, mainRotor, tailRotor, noseLight);
    return {
      root,
      bodyTiltGroup,
      bodyPaintMat,
      wheels,
      frontSteerPivots,
      brakeLightMat,
      mainRotor,
      tailRotor
    };
  }

  if (kind === 'bike') {
    // Pegassi Sportbike (+Z is forward)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 1.55), bodyPaintMat);
    frame.position.set(0, 0.72, 0);
    frame.castShadow = true;

    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.65), bodyPaintMat);
    fairing.rotation.x = 0.35;
    fairing.position.set(0, 0.92, 0.62);

    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), headLightMat);
    headlight.position.set(0, 0.92, 0.96);

    const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.08), brakeLightMat);
    taillight.position.set(0, 0.88, -0.82);

    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 14);
    tireGeo.rotateZ(Math.PI / 2);

    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, 0.36, 0.82);
    const fWheel = new THREE.Mesh(tireGeo, darkTrimMat);
    frontPivot.add(fWheel);
    frontSteerPivots.push(frontPivot);
    wheels.push(fWheel);

    const rWheel = new THREE.Mesh(tireGeo, darkTrimMat);
    rWheel.position.set(0, 0.36, -0.8);
    wheels.push(rWheel);

    bodyTiltGroup.add(frame, fairing, headlight, taillight, frontPivot, rWheel);
    return { root, bodyTiltGroup, bodyPaintMat, wheels, frontSteerPivots, brakeLightMat };
  }

  // 4-Wheeled Cars & Trucks (+Z is forward)
  const spec = VEHICLE_SPECS[kind];
  const w = spec.halfWidth * 2;
  const l = spec.halfLength * 2;
  const chassisH = kind === 'supercar' || kind === 'convertible' ? 0.56 : kind === 'suv' || kind === 'swat' ? 0.88 : 0.68;

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, chassisH, l), bodyPaintMat);
  chassis.position.y = 0.36 + chassisH / 2;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyTiltGroup.add(chassis);

  // Police white doors contrast
  if (kind === 'police') {
    const whiteDoors = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.03, chassisH * 0.86, l * 0.44),
      new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.3, metalness: 0.3 })
    );
    whiteDoors.position.set(0, 0.36 + chassisH / 2, 0);
    bodyTiltGroup.add(whiteDoors);
  }

  // Cabin / Roof
  if (kind === 'convertible') {
    // Open-top windshield + sport rollbar + tan leather seats!
    const ws = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.48, 0.12), glassMat);
    ws.rotation.x = -0.48;
    ws.position.set(0, 0.36 + chassisH + 0.2, 0.55);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
    const seats = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.42, 0.55), seatMat);
    seats.position.set(0, 0.36 + chassisH + 0.12, -0.25);
    bodyTiltGroup.add(ws, seats);
  } else {
    const cabH = kind === 'supercar' ? 0.46 : kind === 'suv' || kind === 'swat' ? 0.72 : 0.56;
    const cabL = kind === 'suv' || kind === 'swat' ? l * 0.68 : l * 0.5;
    const cabZ = kind === 'supercar' ? -0.15 : kind === 'suv' || kind === 'swat' ? -0.22 : -0.12;

    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, cabH, cabL), glassMat);
    cabinGlass.position.set(0, 0.36 + chassisH + cabH / 2 - 0.02, cabZ);
    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, 0.09, cabL * 0.82),
      kind === 'police' ? new THREE.MeshStandardMaterial({ color: 0xf8f9fa }) : bodyPaintMat
    );
    roofCap.position.set(0, 0.36 + chassisH + cabH, cabZ);
    roofCap.castShadow = true;
    bodyTiltGroup.add(cabinGlass, roofCap);
  }

  // Supercar Rear Wing & Neon Underglow Accent
  if (kind === 'supercar') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.08, 0.36), darkTrimMat);
    wing.position.set(0, 0.36 + chassisH + 0.32, -l / 2 + 0.22);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), darkTrimMat);
    strutL.position.set(-w * 0.34, 0.36 + chassisH + 0.15, -l / 2 + 0.22);
    const strutR = strutL.clone();
    strutR.position.x = w * 0.34;
    bodyTiltGroup.add(wing, strutL, strutR);
  }

  // Vice City Neon Underglow Plane on Supercars & Convertibles!
  if (kind === 'supercar' || kind === 'convertible') {
    const glowHex = kind === 'supercar' ? 0xff2e93 : 0x00f0ff;
    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.15, l * 0.92),
      new THREE.MeshBasicMaterial({
        color: glowHex,
        transparent: true,
        opacity: 0.38,
        depthWrite: false
      })
    );
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.set(0, 0.06, 0);
    root.add(underglow);
  }

  // Muscle Car Hood Blower Scoop
  if (kind === 'muscle') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.75), darkTrimMat);
    scoop.position.set(0, 0.36 + chassisH + 0.08, l * 0.24);
    bodyTiltGroup.add(scoop);
  }

  // Police / SWAT Flashing Lightbar & Bullbar
  let sirenRedMat: THREE.MeshStandardMaterial | undefined;
  let sirenBlueMat: THREE.MeshStandardMaterial | undefined;
  if (kind === 'police' || kind === 'swat') {
    sirenRedMat = new THREE.MeshStandardMaterial({
      color: 0xff1e38,
      emissive: 0xff0022,
      emissiveIntensity: 3.5
    });
    sirenBlueMat = new THREE.MeshStandardMaterial({
      color: 0x00a6ff,
      emissive: 0x0077ff,
      emissiveIntensity: 3.5
    });
    const topY = 0.36 + chassisH + (kind === 'swat' ? 0.82 : 0.66);
    const redBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.14, 0.26), sirenRedMat);
    redBar.position.set(w * 0.18, topY, -0.1);
    const blueBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.14, 0.26), sirenBlueMat);
    blueBar.position.set(-w * 0.18, topY, -0.1);
    const bullbar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.45, 0.18), darkTrimMat);
    bullbar.position.set(0, 0.56, l / 2 + 0.08);
    bodyTiltGroup.add(redBar, blueBar, bullbar);
  }

  // Headlights (+Z) & Taillights (-Z)
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, 0.16, 0.08), headLightMat);
    hl.position.set(side * w * 0.33, 0.36 + chassisH * 0.62, l / 2 + 0.02);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, 0.16, 0.08), brakeLightMat);
    bl.position.set(side * w * 0.32, 0.36 + chassisH * 0.64, -l / 2 - 0.02);
    bodyTiltGroup.add(hl, bl);
  }

  // 4 Wheels with Chrome/Alloy Rims
  const wheelRadius = kind === 'suv' || kind === 'swat' ? 0.44 : 0.36;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.28, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, 0.3, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });

  const wheelPositions: Array<[number, number, boolean]> = [
    [w * 0.48, l * 0.31, true],
    [-w * 0.48, l * 0.31, true],
    [w * 0.48, -l * 0.31, false],
    [-w * 0.48, -l * 0.31, false]
  ];

  for (const [wx, wz, isFront] of wheelPositions) {
    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, darkTrimMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(tire, rim);

    if (isFront) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, wheelRadius, wz);
      steerPivot.add(wheelGroup);
      root.add(steerPivot);
      frontSteerPivots.push(steerPivot);
    } else {
      wheelGroup.position.set(wx, wheelRadius, wz);
      root.add(wheelGroup);
    }
    wheels.push(wheelGroup);
  }

  return {
    root,
    bodyTiltGroup,
    bodyPaintMat,
    wheels,
    frontSteerPivots,
    brakeLightMat,
    sirenRedMat,
    sirenBlueMat
  };
}
