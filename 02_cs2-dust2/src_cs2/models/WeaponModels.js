// Counter-Strike: Dust II — High-Detail 3D Viewmodels, Tactical Gloves & World Weapon Meshes
import * as THREE from 'three';

function makeWoodStockMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6e3819';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(42,18,6,0.28)' : 'rgba(156,88,42,0.18)';
    ctx.fillRect(0, (i * 11) % 256, 256, 2 + (i % 4));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.08 });
}

function makeC4ScreenTexture(codeText = '7355608') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141a12';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#3a4a35';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = '#ff3824';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(codeText, 128, 52);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SHARED_MATS = {
  gunmetalDark: new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.38, metalness: 0.85 }),
  gunmetalMid:  new THREE.MeshStandardMaterial({ color: 0x343941, roughness: 0.44, metalness: 0.78 }),
  chromeSteel:  new THREE.MeshStandardMaterial({ color: 0xcfd5dc, roughness: 0.20, metalness: 0.94 }),
  polymerBlack: new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.76, metalness: 0.12 }),
  awpGreen:     new THREE.MeshStandardMaterial({ color: 0x3b4d36, roughness: 0.62, metalness: 0.18 }),
  walnutWood:   null,
  brass:        new THREE.MeshStandardMaterial({ color: 0xd4a843, roughness: 0.30, metalness: 0.88 }),
  tritiumGlow:  new THREE.MeshBasicMaterial({ color: 0x48ff6a }),
  lensGlass:    new THREE.MeshStandardMaterial({ color: 0x16384c, roughness: 0.08, metalness: 0.92 }),
  c4Tan:        new THREE.MeshStandardMaterial({ color: 0xbda67e, roughness: 0.82, metalness: 0.05 }),
  heOlive:      new THREE.MeshStandardMaterial({ color: 0x435335, roughness: 0.56, metalness: 0.38 }),
  flashSilver:  new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.32, metalness: 0.82 }),
  flashBlue:    new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.48, metalness: 0.35 }),
  smokeGrey:    new THREE.MeshStandardMaterial({ color: 0x6e7378, roughness: 0.58, metalness: 0.42 }),
  gloveCT:      new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 0.75, metalness: 0.10 }),
  gloveT:       new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.78, metalness: 0.06 }),
  sleeveCT:     new THREE.MeshStandardMaterial({ color: 0x1d2836, roughness: 0.85 }),
  sleeveT:      new THREE.MeshStandardMaterial({ color: 0x8c7355, roughness: 0.88 }),
  skinTone:     new THREE.MeshStandardMaterial({ color: 0xd1a17c, roughness: 0.72 })
};

function getWoodMat() {
  if (!SHARED_MATS.walnutWood) SHARED_MATS.walnutWood = makeWoodStockMaterial();
  return SHARED_MATS.walnutWood;
}

function addPart(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

// Build articulated First-Person Viewmodel with Hands, Gloves, Bolt/Slide, Mag & Muzzle Anchor
export function createFirstPersonWeapon(weaponId, team = 'CT') {
  const root = new THREE.Group();
  const gunGroup = new THREE.Group();
  root.add(gunGroup);

  const wood = getWoodMat();
  const dk = SHARED_MATS.gunmetalDark;
  const md = SHARED_MATS.gunmetalMid;
  const poly = SHARED_MATS.polymerBlack;
  const chr = SHARED_MATS.chromeSteel;
  const glow = SHARED_MATS.tritiumGlow;

  let slideOrBolt = null;
  let magazine = null;
  const muzzleAnchor = new THREE.Object3D();
  let leftHandPos = new THREE.Vector3(-0.04, -0.05, -0.34);
  let rightHandPos = new THREE.Vector3(0.01, -0.08, -0.06);
  let c4ScreenMat = null;

  switch (weaponId) {
    case 'ak47': {
      // Stamped steel receiver + ribbed dust cover
      addPart(gunGroup, new THREE.BoxGeometry(0.046, 0.062, 0.26), dk, 0, 0, -0.14);
      addPart(gunGroup, new THREE.BoxGeometry(0.042, 0.024, 0.24), md, 0, 0.038, -0.14);
      // Varnished walnut buttstock
      addPart(gunGroup, new THREE.BoxGeometry(0.040, 0.072, 0.22), wood, 0, -0.024, 0.08, -0.14, 0, 0);
      // Pistol grip
      addPart(gunGroup, new THREE.BoxGeometry(0.034, 0.105, 0.046), wood, 0, -0.072, -0.05, 0.28, 0, 0);
      // Walnut lower & upper handguard
      addPart(gunGroup, new THREE.BoxGeometry(0.046, 0.042, 0.19), wood, 0, -0.004, -0.36);
      addPart(gunGroup, new THREE.BoxGeometry(0.038, 0.026, 0.16), wood, 0, 0.030, -0.35);
      // Barrel + gas tube + front sight triangle + slant brake
      const brl = new THREE.CylinderGeometry(0.010, 0.011, 0.36, 12);
      brl.rotateX(Math.PI / 2);
      addPart(gunGroup, brl, dk, 0, 0.008, -0.56);
      const gas = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 10);
      gas.rotateX(Math.PI / 2);
      addPart(gunGroup, gas, md, 0, 0.032, -0.44);
      // Front & rear iron sights with tritium dot
      addPart(gunGroup, new THREE.BoxGeometry(0.014, 0.042, 0.022), dk, 0, 0.034, -0.69);
      addPart(gunGroup, new THREE.BoxGeometry(0.004, 0.004, 0.004), glow, 0, 0.054, -0.688);
      addPart(gunGroup, new THREE.BoxGeometry(0.024, 0.014, 0.04), md, 0, 0.052, -0.25);

      // Reciprocating bolt carrier & charging handle
      slideOrBolt = new THREE.Group();
      addPart(slideOrBolt, new THREE.BoxGeometry(0.012, 0.018, 0.09), chr, 0.024, 0.028, -0.18);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.026, 0.010, 0.012), dk, 0.038, 0.028, -0.22);
      gunGroup.add(slideOrBolt);

      // Iconic curved 30-rd banana magazine
      magazine = new THREE.Group();
      addPart(magazine, new THREE.BoxGeometry(0.032, 0.12, 0.058), md, 0, -0.085, -0.21, -0.16, 0, 0);
      addPart(magazine, new THREE.BoxGeometry(0.031, 0.11, 0.056), md, 0, -0.175, -0.24, -0.36, 0, 0);
      gunGroup.add(magazine);

      muzzleAnchor.position.set(0, 0.008, -0.75);
      leftHandPos.set(-0.028, -0.035, -0.37);
      rightHandPos.set(0.015, -0.075, -0.05);
      break;
    }

    case 'm4a1s':
    case 'famas':
    case 'galil': {
      const isFamas = weaponId === 'famas';
      const isSilenced = weaponId === 'm4a1s';
      // Upper & lower anodized receiver
      addPart(gunGroup, new THREE.BoxGeometry(0.046, 0.068, 0.25), dk, 0, 0.004, -0.14);
      // Picatinny top rail or FAMAS carry handle
      if (isFamas) {
        addPart(gunGroup, new THREE.BoxGeometry(0.034, 0.052, 0.30), poly, 0, 0.060, -0.18);
      } else {
        addPart(gunGroup, new THREE.BoxGeometry(0.028, 0.012, 0.38), md, 0, 0.044, -0.23);
        // Rear & front flip sights with glowing dots
        addPart(gunGroup, new THREE.BoxGeometry(0.026, 0.028, 0.018), dk, 0, 0.058, -0.06);
        addPart(gunGroup, new THREE.BoxGeometry(0.004, 0.004, 0.004), glow, -0.007, 0.066, -0.058);
        addPart(gunGroup, new THREE.BoxGeometry(0.004, 0.004, 0.004), glow, 0.007, 0.066, -0.058);
        addPart(gunGroup, new THREE.BoxGeometry(0.016, 0.038, 0.022), dk, 0, 0.054, -0.42);
        addPart(gunGroup, new THREE.BoxGeometry(0.004, 0.004, 0.004), glow, 0, 0.070, -0.42);
      }
      // SOPMOD stock & pistol grip
      addPart(gunGroup, new THREE.BoxGeometry(0.042, 0.082, 0.20), poly, 0, -0.008, 0.07);
      addPart(gunGroup, new THREE.BoxGeometry(0.034, 0.105, 0.044), poly, 0, -0.074, -0.06, 0.26, 0, 0);
      // Quad-rail handguard
      addPart(gunGroup, new THREE.BoxGeometry(0.048, 0.052, 0.22), poly, 0, 0.008, -0.36);
      // Barrel + M4A1-S Long Suppressor
      const brl = new THREE.CylinderGeometry(0.010, 0.010, 0.22, 12);
      brl.rotateX(Math.PI / 2);
      addPart(gunGroup, brl, dk, 0, 0.008, -0.52);

      if (isSilenced) {
        const sup = new THREE.CylinderGeometry(0.019, 0.019, 0.24, 16);
        sup.rotateX(Math.PI / 2);
        addPart(gunGroup, sup, md, 0, 0.008, -0.69);
        muzzleAnchor.position.set(0, 0.008, -0.82);
      } else {
        muzzleAnchor.position.set(0, 0.008, -0.64);
      }

      slideOrBolt = new THREE.Group();
      addPart(slideOrBolt, new THREE.BoxGeometry(0.008, 0.018, 0.075), chr, 0.023, 0.016, -0.15);
      gunGroup.add(slideOrBolt);

      magazine = new THREE.Group();
      const magZ = isFamas ? 0.02 : -0.20;
      addPart(magazine, new THREE.BoxGeometry(0.030, 0.16, 0.056), md, 0, -0.11, magZ, -0.12, 0, 0);
      gunGroup.add(magazine);

      leftHandPos.set(-0.028, -0.03, -0.36);
      rightHandPos.set(0.015, -0.075, -0.06);
      break;
    }

    case 'awp':
    case 'ssg08': {
      const isAWP = weaponId === 'awp';
      const bodyMat = isAWP ? SHARED_MATS.awpGreen : poly;
      // Iconic olive-green thumbhole sniper chassis
      addPart(gunGroup, new THREE.BoxGeometry(0.050, 0.074, 0.44), bodyMat, 0, -0.010, -0.20);
      addPart(gunGroup, new THREE.BoxGeometry(0.046, 0.105, 0.24), bodyMat, 0, -0.024, 0.10);
      addPart(gunGroup, new THREE.BoxGeometry(0.014, 0.095, 0.032), poly, 0, -0.024, 0.22); // Rubber buttpad
      addPart(gunGroup, new THREE.BoxGeometry(0.036, 0.10, 0.048), bodyMat, 0, -0.072, -0.04, 0.22, 0, 0);

      // Heavy free-float fluted barrel + boxy AWP muzzle brake
      const brlLen = isAWP ? 0.56 : 0.46;
      const brl = new THREE.CylinderGeometry(0.013, 0.016, brlLen, 14);
      brl.rotateX(Math.PI / 2);
      addPart(gunGroup, brl, md, 0, 0.020, -0.42 - brlLen * 0.45);
      if (isAWP) {
        addPart(gunGroup, new THREE.BoxGeometry(0.032, 0.028, 0.065), dk, 0, 0.020, -0.94);
        // Folded bipod legs
        const leg = new THREE.CylinderGeometry(0.006, 0.006, 0.18, 8);
        leg.rotateX(Math.PI / 2);
        addPart(gunGroup, leg, dk, -0.022, -0.036, -0.46);
        addPart(gunGroup, leg, dk, 0.022, -0.036, -0.46);
      }

      // Dual-lens Telescopic Sniper Scope + Scope Rings + Elevation Turrets
      addPart(gunGroup, new THREE.BoxGeometry(0.026, 0.022, 0.03), dk, 0, 0.042, -0.10);
      addPart(gunGroup, new THREE.BoxGeometry(0.026, 0.022, 0.03), dk, 0, 0.042, -0.26);
      const scopeTube = new THREE.CylinderGeometry(0.018, 0.018, 0.28, 16);
      scopeTube.rotateX(Math.PI / 2);
      addPart(gunGroup, scopeTube, dk, 0, 0.064, -0.18);
      const frontBell = new THREE.CylinderGeometry(0.027, 0.018, 0.09, 16);
      frontBell.rotateX(Math.PI / 2);
      addPart(gunGroup, frontBell, dk, 0, 0.064, -0.35);
      const rearBell = new THREE.CylinderGeometry(0.018, 0.023, 0.07, 16);
      rearBell.rotateX(Math.PI / 2);
      addPart(gunGroup, rearBell, dk, 0, 0.064, -0.02);
      // Tinted lens glass
      const lens = new THREE.CylinderGeometry(0.021, 0.021, 0.005, 16);
      lens.rotateX(Math.PI / 2);
      addPart(gunGroup, lens, SHARED_MATS.lensGlass, 0, 0.064, 0.015);
      // Windage/Elevation knobs
      addPart(gunGroup, new THREE.CylinderGeometry(0.011, 0.011, 0.022, 12), md, 0, 0.088, -0.18);

      // Articulated Bolt Handle (rotates & pulls back after firing!)
      slideOrBolt = new THREE.Group();
      slideOrBolt.position.set(0, 0.020, -0.12);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.018, 0.018, 0.11), chr, 0.014, 0, 0);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.042, 0.009, 0.010), dk, 0.036, -0.008, 0.03, 0, 0, -0.35);
      addPart(slideOrBolt, new THREE.SphereGeometry(0.011, 10, 10), poly, 0.055, -0.016, 0.03);
      gunGroup.add(slideOrBolt);

      // Detachable Box Magazine
      magazine = new THREE.Group();
      addPart(magazine, new THREE.BoxGeometry(0.034, 0.085, 0.095), md, 0, -0.075, -0.21);
      gunGroup.add(magazine);

      muzzleAnchor.position.set(0, 0.020, isAWP ? -0.98 : -0.82);
      leftHandPos.set(-0.028, -0.038, -0.38);
      rightHandPos.set(0.015, -0.072, -0.04);
      break;
    }

    case 'mp9':
    case 'mac10':
    case 'xm1014': {
      if (weaponId === 'xm1014') {
        addPart(gunGroup, new THREE.BoxGeometry(0.048, 0.068, 0.28), dk, 0, 0.005, -0.16);
        addPart(gunGroup, new THREE.BoxGeometry(0.042, 0.078, 0.22), poly, 0, -0.02, 0.06, -0.12, 0, 0);
        addPart(gunGroup, new THREE.BoxGeometry(0.034, 0.10, 0.044), poly, 0, -0.07, -0.05, 0.25, 0, 0);
        const topBrl = new THREE.CylinderGeometry(0.014, 0.014, 0.44, 12);
        topBrl.rotateX(Math.PI / 2);
        addPart(gunGroup, topBrl, md, 0, 0.022, -0.48);
        const magTube = new THREE.CylinderGeometry(0.013, 0.013, 0.40, 12);
        magTube.rotateX(Math.PI / 2);
        addPart(gunGroup, magTube, dk, 0, -0.008, -0.46);
        addPart(gunGroup, new THREE.BoxGeometry(0.046, 0.042, 0.20), poly, 0, -0.010, -0.38);
        slideOrBolt = new THREE.Group();
        addPart(slideOrBolt, new THREE.BoxGeometry(0.012, 0.018, 0.08), chr, 0.025, 0.018, -0.16);
        gunGroup.add(slideOrBolt);
        muzzleAnchor.position.set(0, 0.022, -0.71);
        leftHandPos.set(-0.025, -0.03, -0.38);
      } else {
        // Compact SMG (MP9 / MAC-10)
        addPart(gunGroup, new THREE.BoxGeometry(0.046, 0.066, 0.24), weaponId === 'mp9' ? poly : dk, 0, 0.01, -0.15);
        addPart(gunGroup, new THREE.BoxGeometry(0.034, 0.11, 0.046), poly, 0, -0.065, -0.12, 0.15, 0, 0);
        if (weaponId === 'mp9') {
          addPart(gunGroup, new THREE.BoxGeometry(0.026, 0.085, 0.032), poly, 0, -0.055, -0.24); // Vertical foregrip
        }
        const brl = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 12);
        brl.rotateX(Math.PI / 2);
        addPart(gunGroup, brl, md, 0, 0.012, -0.32);
        slideOrBolt = new THREE.Group();
        addPart(slideOrBolt, new THREE.BoxGeometry(0.012, 0.018, 0.07), chr, -0.024, 0.026, -0.16);
        gunGroup.add(slideOrBolt);
        magazine = new THREE.Group();
        addPart(magazine, new THREE.BoxGeometry(0.026, 0.19, 0.036), md, 0, -0.13, -0.13);
        gunGroup.add(magazine);
        muzzleAnchor.position.set(0, 0.012, -0.39);
        leftHandPos.set(-0.022, -0.065, -0.24);
      }
      break;
    }

    case 'deagle':
    case 'usp':
    case 'glock':
    case 'p250': {
      const isDeagle = weaponId === 'deagle';
      const isUSP = weaponId === 'usp';
      const slideMat = isDeagle ? chr : (isUSP ? md : dk);
      const slideLen = isDeagle ? 0.25 : 0.19;
      const slideH = isDeagle ? 0.044 : 0.032;

      // Lower polymer/steel frame & trigger guard
      addPart(gunGroup, new THREE.BoxGeometry(0.034, 0.024, slideLen * 0.88), poly, 0, -0.008, -0.12);
      addPart(gunGroup, new THREE.BoxGeometry(0.032, 0.105, 0.046), poly, 0, -0.065, -0.05, 0.26, 0, 0);
      addPart(gunGroup, new THREE.BoxGeometry(0.012, 0.026, 0.044), poly, 0, -0.032, -0.11);

      // Reciprocating Top Slide with Glowing 3-Dot Tritium Iron Sights!
      slideOrBolt = new THREE.Group();
      addPart(slideOrBolt, new THREE.BoxGeometry(0.036, slideH, slideLen), slideMat, 0, 0.020, -0.13);
      // Rear 2 dots + front 1 dot
      addPart(slideOrBolt, new THREE.BoxGeometry(0.026, 0.010, 0.014), dk, 0, 0.020 + slideH * 0.55, -0.13 + slideLen * 0.44);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.0035, 0.0035, 0.003), glow, -0.007, 0.022 + slideH * 0.55, -0.122 + slideLen * 0.44);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.0035, 0.0035, 0.003), glow, 0.007, 0.022 + slideH * 0.55, -0.122 + slideLen * 0.44);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.008, 0.010, 0.014), dk, 0, 0.020 + slideH * 0.55, -0.13 - slideLen * 0.44);
      addPart(slideOrBolt, new THREE.BoxGeometry(0.0035, 0.0035, 0.003), glow, 0, 0.022 + slideH * 0.55, -0.13 - slideLen * 0.43);
      gunGroup.add(slideOrBolt);

      // USP-S Tactical Suppressor
      if (isUSP) {
        const sup = new THREE.CylinderGeometry(0.016, 0.016, 0.19, 16);
        sup.rotateX(Math.PI / 2);
        addPart(gunGroup, sup, dk, 0, 0.020, -0.32);
        muzzleAnchor.position.set(0, 0.020, -0.42);
      } else {
        muzzleAnchor.position.set(0, 0.020, -0.14 - slideLen * 0.52);
      }

      magazine = new THREE.Group();
      addPart(magazine, new THREE.BoxGeometry(0.024, 0.10, 0.036), md, 0, -0.072, -0.052, 0.26, 0, 0);
      gunGroup.add(magazine);

      leftHandPos.set(-0.018, -0.075, -0.07);
      rightHandPos.set(0.012, -0.072, -0.05);
      break;
    }

    case 'knife': {
      // M9 Bayonet Tactical Knife (angled aggressively ready to slash/inspect!)
      const knifePivot = new THREE.Group();
      knifePivot.position.set(0.02, -0.03, -0.18);
      knifePivot.rotation.set(0.35, -0.25, 0.12);
      gunGroup.add(knifePivot);

      // Ribbed polymer grip + pommel ring + crossguard
      const grip = new THREE.CylinderGeometry(0.016, 0.017, 0.115, 12);
      addPart(knifePivot, grip, poly, 0, -0.055, 0);
      addPart(knifePivot, new THREE.BoxGeometry(0.014, 0.010, 0.068), dk, 0, 0.005, 0);
      // Thick satin steel clip-point blade + spine serrations
      addPart(knifePivot, new THREE.BoxGeometry(0.006, 0.19, 0.034), chr, 0, 0.102, -0.002);
      // Tapered tip
      const tipGeo = new THREE.ConeGeometry(0.018, 0.055, 4);
      tipGeo.scale(0.22, 1.0, 1.0);
      addPart(knifePivot, tipGeo, chr, 0, 0.222, -0.002);

      slideOrBolt = knifePivot;
      leftHandPos.set(-0.14, -0.12, -0.16);
      rightHandPos.set(0.02, -0.08, -0.16);
      break;
    }

    case 'hegrenade':
    case 'flashbang':
    case 'smokegrenade': {
      const nadePivot = new THREE.Group();
      nadePivot.position.set(0.01, -0.02, -0.18);
      gunGroup.add(nadePivot);

      if (weaponId === 'hegrenade') {
        addPart(nadePivot, new THREE.SphereGeometry(0.044, 16, 14), SHARED_MATS.heOlive, 0, 0, 0);
        addPart(nadePivot, new THREE.CylinderGeometry(0.016, 0.020, 0.035, 10), md, 0, 0.048, 0);
      } else if (weaponId === 'flashbang') {
        addPart(nadePivot, new THREE.CylinderGeometry(0.030, 0.030, 0.115, 16), SHARED_MATS.flashSilver, 0, 0, 0);
        addPart(nadePivot, new THREE.CylinderGeometry(0.031, 0.031, 0.026, 16), SHARED_MATS.flashBlue, 0, 0.015, 0);
        addPart(nadePivot, new THREE.CylinderGeometry(0.016, 0.020, 0.032, 10), md, 0, 0.072, 0);
      } else {
        addPart(nadePivot, new THREE.CylinderGeometry(0.034, 0.034, 0.125, 16), SHARED_MATS.smokeGrey, 0, 0, 0);
        addPart(nadePivot, new THREE.CylinderGeometry(0.035, 0.035, 0.022, 16), SHARED_MATS.brass, 0, 0.02, 0);
        addPart(nadePivot, new THREE.CylinderGeometry(0.016, 0.018, 0.028, 10), dk, 0, 0.075, 0);
      }
      // Spoon lever & pull-ring pin
      addPart(nadePivot, new THREE.BoxGeometry(0.010, 0.075, 0.006), dk, 0.032, 0.02, 0, 0, 0, 0.12);
      const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0025, 8, 16), chr);
      pinRing.position.set(-0.022, 0.062, 0.012);
      nadePivot.add(pinRing);

      slideOrBolt = pinRing;
      leftHandPos.set(-0.04, -0.04, -0.17);
      rightHandPos.set(0.02, -0.06, -0.17);
      break;
    }

    case 'c4': {
      // Iconic CS C4 Brick with '7355608' LCD & Keypad!
      const c4Pivot = new THREE.Group();
      c4Pivot.position.set(0.0, -0.03, -0.22);
      c4Pivot.rotation.set(-0.48, 0.08, 0.0);
      gunGroup.add(c4Pivot);

      // Dual C4 plastic blocks + black duct tape straps
      addPart(c4Pivot, new THREE.BoxGeometry(0.15, 0.055, 0.21), SHARED_MATS.c4Tan, 0, 0, 0);
      addPart(c4Pivot, new THREE.BoxGeometry(0.154, 0.058, 0.024), poly, 0, 0, -0.055);
      addPart(c4Pivot, new THREE.BoxGeometry(0.154, 0.058, 0.024), poly, 0, 0, 0.055);

      // Green PCB + LCD Display + 3x4 Keypad
      addPart(c4Pivot, new THREE.BoxGeometry(0.105, 0.012, 0.135), SHARED_MATS.awpGreen, 0, 0.032, 0);
      c4ScreenMat = new THREE.MeshBasicMaterial({ map: makeC4ScreenTexture('7355608') });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.032), c4ScreenMat);
      screen.rotation.x = -Math.PI / 2;
      screen.position.set(0, 0.039, -0.036);
      c4Pivot.add(screen);

      // Keypad buttons
      for (let r = 0; r < 4; r++) {
        for (let col = -1; col <= 1; col++) {
          addPart(c4Pivot, new THREE.BoxGeometry(0.018, 0.008, 0.014), chr, col * 0.025, 0.039, 0.005 + r * 0.019);
        }
      }
      // Red blinking LED
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2211 }));
      led.position.set(0.055, 0.036, -0.075);
      c4Pivot.add(led);

      leftHandPos.set(-0.08, -0.04, -0.22);
      rightHandPos.set(0.08, -0.04, -0.22);
      break;
    }
  }

  gunGroup.add(muzzleAnchor);

  // ==================== TACTICAL GLOVES & FOREARMS ====================
  const gloveMat = team === 'CT' ? SHARED_MATS.gloveCT : SHARED_MATS.gloveT;
  const sleeveMat = team === 'CT' ? SHARED_MATS.sleeveCT : SHARED_MATS.sleeveT;

  const buildArm = (handTarget, shoulderOrigin) => {
    const armGroup = new THREE.Group();
    // Tactical gloved palm + knuckle guard
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.072), gloveMat);
    palm.position.copy(handTarget);
    armGroup.add(palm);

    // Forearm cylinder connecting shoulder origin to wrist
    const wrist = handTarget.clone().add(new THREE.Vector3(0, -0.01, 0.04));
    const vec = new THREE.Vector3().subVectors(wrist, shoulderOrigin);
    const len = vec.length();
    const sleeveGeo = new THREE.CylinderGeometry(0.030, 0.042, len, 10);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.position.copy(shoulderOrigin).addScaledVector(vec, 0.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize());
    armGroup.add(sleeve);

    return armGroup;
  };

  const leftArm = buildArm(leftHandPos, new THREE.Vector3(-0.22, -0.24, 0.18));
  const rightArm = buildArm(rightHandPos, new THREE.Vector3(0.20, -0.24, 0.18));
  gunGroup.add(leftArm);
  gunGroup.add(rightArm);

  root.userData = {
    weaponId,
    gunGroup,
    slideOrBolt,
    magazine,
    muzzleAnchor,
    leftArm,
    c4ScreenMat,
    updateC4Text: (txt) => {
      if (c4ScreenMat) {
        c4ScreenMat.map.dispose();
        c4ScreenMat.map = makeC4ScreenTexture(txt);
        c4ScreenMat.needsUpdate = true;
      }
    }
  };

  return root;
}

// Compact 3D World Weapon Mesh for Bots & Dropped Weapons on Dust2 floor!
export function createWorldWeaponMesh(weaponId) {
  const g = new THREE.Group();
  const dk = SHARED_MATS.gunmetalDark;
  const md = SHARED_MATS.gunmetalMid;
  const wood = getWoodMat();

  if (weaponId === 'awp' || weaponId === 'ssg08') {
    const bodyMat = weaponId === 'awp' ? SHARED_MATS.awpGreen : SHARED_MATS.polymerBlack;
    addPart(g, new THREE.BoxGeometry(0.055, 0.09, 0.72), bodyMat, 0, 0.02, -0.08);
    const brl = new THREE.CylinderGeometry(0.014, 0.016, 0.55, 8);
    brl.rotateX(Math.PI / 2);
    addPart(g, brl, dk, 0, 0.045, -0.62);
    const scope = new THREE.CylinderGeometry(0.022, 0.022, 0.28, 10);
    scope.rotateX(Math.PI / 2);
    addPart(g, scope, dk, 0, 0.095, -0.12);
  } else if (weaponId === 'ak47' || weaponId === 'galil') {
    addPart(g, new THREE.BoxGeometry(0.05, 0.08, 0.42), dk, 0, 0.02, -0.10);
    addPart(g, new THREE.BoxGeometry(0.045, 0.08, 0.24), wood, 0, 0.0, 0.18);
    addPart(g, new THREE.BoxGeometry(0.048, 0.05, 0.22), wood, 0, 0.02, -0.38);
    addPart(g, new THREE.BoxGeometry(0.035, 0.16, 0.06), md, 0, -0.08, -0.16, -0.25, 0, 0);
    const brl = new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8);
    brl.rotateX(Math.PI / 2);
    addPart(g, brl, dk, 0, 0.03, -0.56);
  } else if (weaponId === 'm4a1s' || weaponId === 'famas') {
    addPart(g, new THREE.BoxGeometry(0.05, 0.085, 0.56), dk, 0, 0.02, -0.08);
    addPart(g, new THREE.BoxGeometry(0.032, 0.15, 0.055), md, 0, -0.07, -0.14);
    const sup = new THREE.CylinderGeometry(0.018, 0.018, 0.32, 10);
    sup.rotateX(Math.PI / 2);
    addPart(g, sup, md, 0, 0.03, -0.50);
  } else if (weaponId === 'c4') {
    addPart(g, new THREE.BoxGeometry(0.22, 0.09, 0.30), SHARED_MATS.c4Tan, 0, 0.045, 0);
    addPart(g, new THREE.BoxGeometry(0.14, 0.02, 0.18), SHARED_MATS.awpGreen, 0, 0.095, 0);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2211 }));
    led.position.set(0.06, 0.11, -0.08);
    g.add(led);
    g.userData.led = led;
  } else {
    // Pistol / SMG compact world model
    const mat = weaponId === 'deagle' ? SHARED_MATS.chromeSteel : dk;
    addPart(g, new THREE.BoxGeometry(0.042, 0.055, 0.28), mat, 0, 0.03, -0.06);
    addPart(g, new THREE.BoxGeometry(0.036, 0.10, 0.05), SHARED_MATS.polymerBlack, 0, -0.03, 0.03, 0.22, 0, 0);
  }

  g.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return g;
}
