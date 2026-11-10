import * as THREE from 'three';
import { WeaponId } from '../types';

export type CharacterStyle = 'lucia' | 'jason' | 'police' | 'swat' | 'gang' | 'civilian';

export interface RiggedCharacter {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMount: THREE.Group;
  weaponMeshes: Record<WeaponId, THREE.Object3D>;
  walkPhase: number;
  punchTimer: number;
}

export function createCharacterRig(style: CharacterStyle): RiggedCharacter {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  // Palette selection
  let skinHex = 0xd9a17c;
  let topHex = 0xff2e93;
  let pantsHex = 0x3b6ea5;
  let hairHex = 0x1d1616;
  let shoeHex = 0xf5f5f5;

  if (style === 'lucia') {
    skinHex = 0xd49a73;
    topHex = 0xe63982; // Lucia's iconic pink/berry tank
    pantsHex = 0x457b9d; // Denim jeans
    hairHex = 0x1a1212;
    shoeHex = 0xffffff;
  } else if (style === 'jason') {
    skinHex = 0xdcb08b;
    topHex = 0xf1faee; // Jason's white tank/tee with coastal overshirt vibe
    pantsHex = 0x2b4c7e;
    hairHex = 0x4a3525;
    shoeHex = 0x3d2b1f;
  } else if (style === 'police') {
    skinHex = 0xd8a47f;
    topHex = 0x16294a;
    pantsHex = 0x101d36;
    hairHex = 0x222222;
    shoeHex = 0x111111;
  } else if (style === 'swat') {
    skinHex = 0x222222;
    topHex = 0x1c1f26;
    pantsHex = 0x14161b;
    hairHex = 0x111111;
    shoeHex = 0x0a0a0a;
  } else if (style === 'gang') {
    const gangTops = [0x9b5de5, 0xf15bb5, 0x00bbf9, 0xff9e00];
    skinHex = 0xc68b59;
    topHex = gangTops[Math.floor(Math.random() * gangTops.length)];
    pantsHex = 0xf8f9fa;
    hairHex = 0x181818;
    shoeHex = 0x222222;
  } else {
    const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    const tops = [0x00f5d4, 0xff5d8f, 0xfee440, 0x8338ec, 0xfb5607, 0xffffff, 0x3a86ff];
    const bottoms = [0x264653, 0xe9c46a, 0x3d5a80, 0xf4a261, 0x2b2d42];
    skinHex = skins[Math.floor(Math.random() * skins.length)];
    topHex = tops[Math.floor(Math.random() * tops.length)];
    pantsHex = bottoms[Math.floor(Math.random() * bottoms.length)];
    hairHex = Math.random() > 0.35 ? 0x241914 : 0xb58338;
  }

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 });
  const topMat = new THREE.MeshStandardMaterial({ color: topHex, roughness: 0.55 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.72 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.75 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: shoeHex, roughness: 0.6 });

  // Torso
  const torso = new THREE.Group();
  const torsoWidth = style === 'lucia' ? 0.42 : style === 'swat' ? 0.54 : 0.48;
  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, 0.6, 0.26), topMat);
  chestMesh.position.y = 0.3;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  if (style === 'jason') {
    // Open teal tropical overshirt panels on sides
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.6 });
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.28), shirtMat);
    leftPanel.position.set(-0.18, 0.3, 0);
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.28), shirtMat);
    rightPanel.position.set(0.18, 0.3, 0);
    torso.add(leftPanel, rightPanel);
  } else if (style === 'police' || style === 'swat') {
    // Gold badge / tactical vest plate
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.09, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.8, roughness: 0.2 })
    );
    badge.position.set(-0.11, 0.44, 0.14);
    torso.add(badge);
  }

  hips.add(torso);

  // Head
  const head = new THREE.Group();
  head.position.y = 0.62;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  skull.position.y = 0.18;
  skull.castShadow = true;
  head.add(skull);

  // Sunglasses / Eyes facing +Z
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), eyeMat);
  shades.position.set(0, 0.21, 0.155);
  head.add(shades);

  // Hair / Cap / Helmet
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.34), hairMat);
  hairCap.position.y = 0.33;
  head.add(hairCap);

  if (style === 'lucia') {
    // Lucia's signature ponytail in back (-Z)
    const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), hairMat);
    ponytail.position.set(0, 0.18, -0.2);
    ponytail.rotation.x = 0.25;
    head.add(ponytail);
  } else if (style === 'jason') {
    // Backwards capvisor in -Z
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.6 });
    hairCap.material = capMat;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.16), capMat);
    brim.position.set(0, 0.28, -0.22);
    head.add(brim);
  } else if (style === 'police') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.14), pantsMat);
    visor.position.set(0, 0.29, 0.2);
    head.add(visor);
  }

  torso.add(head);

  // Arms
  const armOffset = torsoWidth / 2 + 0.1;
  const leftArm = new THREE.Group();
  leftArm.position.set(armOffset, 0.55, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.15), style === 'police' || style === 'swat' ? topMat : skinMat);
  lUpper.position.y = -0.26;
  lUpper.castShadow = true;
  leftArm.add(lUpper);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(-armOffset, 0.55, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.15), style === 'police' || style === 'swat' ? topMat : skinMat);
  rUpper.position.y = -0.26;
  rUpper.castShadow = true;
  rightArm.add(rUpper);
  torso.add(rightArm);

  // Weapon mount at right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.52, 0.12);
  rightArm.add(weaponMount);

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.75, roughness: 0.3 });
  const woodStock = new THREE.MeshStandardMaterial({ color: 0x6f4518, roughness: 0.7 });
  const rpgGreen = new THREE.MeshStandardMaterial({ color: 0x3a5a40, roughness: 0.5 });

  const fistsObj = new THREE.Group();

  const pistolObj = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.28), gunMetal);
  pistolObj.position.z = 0.1;

  const smgObj = new THREE.Group();
  const smgBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.42), gunMetal);
  const smgMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.07), gunMetal);
  smgMag.position.set(0, -0.14, 0.05);
  smgObj.add(smgBody, smgMag);
  smgObj.position.z = 0.16;

  const shotgunObj = new THREE.Group();
  const sgBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.78), gunMetal);
  const sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.26), woodStock);
  sgPump.position.set(0, -0.04, 0.12);
  shotgunObj.add(sgBarrel, sgPump);
  shotgunObj.position.z = 0.3;

  const rifleObj = new THREE.Group();
  const rfBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.82), gunMetal);
  const rfMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.1), gunMetal);
  rfMag.position.set(0, -0.14, 0.1);
  rifleObj.add(rfBody, rfMag);
  rifleObj.position.z = 0.32;

  const rpgObj = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 8), rpgGreen);
  tube.rotation.x = Math.PI / 2;
  const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 8), woodStock);
  warhead.rotation.x = Math.PI / 2;
  warhead.position.z = 0.62;
  rpgObj.add(tube, warhead);
  rpgObj.position.z = 0.22;

  const weaponMeshes: Record<WeaponId, THREE.Object3D> = {
    fists: fistsObj,
    pistol: pistolObj,
    smg: smgObj,
    shotgun: shotgunObj,
    rifle: rifleObj,
    rpg: rpgObj
  };
  Object.values(weaponMeshes).forEach((m) => {
    m.visible = false;
    weaponMount.add(m);
  });

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(0.12, 0, 0);
  const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.19), pantsMat);
  lThigh.position.y = -0.41;
  lThigh.castShadow = true;
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.28), shoeMat);
  lShoe.position.set(0, -0.85, 0.04);
  leftLeg.add(lThigh, lShoe);
  hips.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(-0.12, 0, 0);
  const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.19), pantsMat);
  rThigh.position.y = -0.41;
  rThigh.castShadow = true;
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.28), shoeMat);
  rShoe.position.set(0, -0.85, 0.04);
  rightLeg.add(rThigh, rShoe);
  hips.add(rightLeg);

  return {
    root,
    hips,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMount,
    weaponMeshes,
    walkPhase: Math.random() * Math.PI * 2,
    punchTimer: 0
  };
}

export function setRigWeapon(rig: RiggedCharacter, weaponId: WeaponId): void {
  (Object.keys(rig.weaponMeshes) as WeaponId[]).forEach((k) => {
    rig.weaponMeshes[k].visible = k === weaponId;
  });
}

export function animateCharacterRig(
  rig: RiggedCharacter,
  dt: number,
  speed: number,
  isAiming: boolean,
  aimPitch: number,
  isSwimming: boolean,
  isDead: boolean
): void {
  if (isDead) {
    rig.root.rotation.x = THREE.MathUtils.lerp(rig.root.rotation.x, -Math.PI / 2, dt * 10);
    rig.hips.position.y = THREE.MathUtils.lerp(rig.hips.position.y, 0.22, dt * 10);
    return;
  }

  rig.root.rotation.x = THREE.MathUtils.lerp(rig.root.rotation.x, isSwimming ? 0.95 : 0, dt * 8);

  if (isSwimming) {
    rig.walkPhase += dt * 6;
    rig.hips.position.y = 0.25 + Math.sin(rig.walkPhase) * 0.06;
    rig.leftArm.rotation.x = Math.sin(rig.walkPhase) * 1.1 - 1.2;
    rig.rightArm.rotation.x = -Math.sin(rig.walkPhase) * 1.1 - 1.2;
    rig.leftLeg.rotation.x = Math.sin(rig.walkPhase * 1.5) * 0.45;
    rig.rightLeg.rotation.x = -Math.sin(rig.walkPhase * 1.5) * 0.45;
    return;
  }

  if (speed > 0.25) {
    const freq = speed > 6.5 ? 13.5 : 8.5;
    const amp = speed > 6.5 ? 0.82 : 0.52;
    rig.walkPhase += dt * freq;
    rig.leftLeg.rotation.x = Math.sin(rig.walkPhase) * amp;
    rig.rightLeg.rotation.x = -Math.sin(rig.walkPhase) * amp;
    rig.hips.position.y = 0.92 + Math.abs(Math.cos(rig.walkPhase)) * 0.05;
    rig.leftArm.rotation.x = -Math.sin(rig.walkPhase) * amp * 0.85;
    if (!isAiming && rig.punchTimer <= 0) {
      rig.rightArm.rotation.x = Math.sin(rig.walkPhase) * amp * 0.85;
    }
  } else {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, 0, dt * 10);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, 0, dt * 10);
    rig.hips.position.y = 0.92 + Math.sin(performance.now() * 0.003) * 0.015;
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, 0, dt * 10);
    if (!isAiming && rig.punchTimer <= 0) {
      rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, 0, dt * 10);
    }
  }

  if (rig.punchTimer > 0) {
    rig.punchTimer -= dt;
    rig.rightArm.rotation.x = -Math.PI * 0.58;
    rig.torso.rotation.y = 0.35;
  } else if (isAiming) {
    // Raise right arm forward (+Z is forward in local character space!)
    rig.rightArm.rotation.x = -Math.PI / 2 + aimPitch;
    rig.leftArm.rotation.x = -Math.PI * 0.42 + aimPitch * 0.8;
    rig.leftArm.rotation.z = -0.32;
    rig.torso.rotation.y = 0;
  } else {
    rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, 0, dt * 10);
    rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, 0, dt * 10);
  }
}
