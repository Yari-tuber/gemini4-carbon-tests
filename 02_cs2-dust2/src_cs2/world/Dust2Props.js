// Counter-Strike: Dust II — Sculpted Architectural & Tactical 3D Props
import * as THREE from 'three';
import { createWorldBox } from './Materials.js';

export class Dust2Props {
  constructor(matLib) {
    this.m = matLib.mats;
    this.matLib = matLib;
  }

  // Iconic Dust2 Double Doors with stone arch frame, iron hinges & narrow sniper gap!
  // Returns { group, colliders, raycastMeshes }
  // axis = 'Z' (wall faces North/South like Mid Doors & Long Doors) or 'X' (wall faces East/West like B Doors)
  createDoubleDoors({
    cx, y, cz,
    axis = 'Z',
    openingWidth = 3.1,
    doorHeight = 3.15,
    wallHeight = 4.8,
    thickness = 0.45,
    leftAngle = 0.48,
    rightAngle = -0.48,
    gapWidth = 0.36
  }) {
    const group = new THREE.Group();
    group.position.set(cx, y, cz);
    if (axis === 'X') group.rotation.y = Math.PI / 2;

    const raycastMeshes = [];
    const colliders = [];

    // Stone jamb pillars & overhead arch lintel
    const jambW = 0.42;
    const leftJamb = createWorldBox(jambW, doorHeight, thickness + 0.12, this.m.sandstoneTrim, 0.35);
    leftJamb.position.set(-openingWidth / 2 - jambW / 2, doorHeight / 2, 0);
    leftJamb.userData = { surface: 'stone', penetrable: false };
    group.add(leftJamb);
    raycastMeshes.push(leftJamb);

    const rightJamb = createWorldBox(jambW, doorHeight, thickness + 0.12, this.m.sandstoneTrim, 0.35);
    rightJamb.position.set(openingWidth / 2 + jambW / 2, doorHeight / 2, 0);
    rightJamb.userData = { surface: 'stone', penetrable: false };
    group.add(rightJamb);
    raycastMeshes.push(rightJamb);

    const lintelH = wallHeight - doorHeight;
    if (lintelH > 0.05) {
      const lintel = createWorldBox(openingWidth + jambW * 2, lintelH, thickness + 0.06, this.m.sandstonePlaster, 0.28);
      lintel.position.set(0, doorHeight + lintelH / 2, 0);
      lintel.userData = { surface: 'stone', penetrable: false };
      group.add(lintel);
      raycastMeshes.push(lintel);

      // Decorative stone arch trim keystone
      const archTrim = createWorldBox(openingWidth + 0.3, 0.28, thickness + 0.18, this.m.sandstoneTrim, 0.4);
      archTrim.position.set(0, doorHeight + 0.14, 0);
      group.add(archTrim);
    }

    // Compute leaf width so angled doors leave an exact sniper peek gap in the center!
    // Projected horizontal reach of each leaf = leafW * cos(angle) = (openingWidth - gapWidth) / 2
    const projEach = (openingWidth - gapWidth) * 0.5;
    const leftLeafW = projEach / Math.max(0.5, Math.cos(leftAngle));
    const rightLeafW = projEach / Math.max(0.5, Math.cos(rightAngle));
    const leafThick = 0.13;
    const leafH = doorHeight - 0.04;

    const buildDoorLeaf = (hingeX, width, dirSign, angle) => {
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, 0, 0);
      pivot.rotation.y = angle;

      const leafGeo = new THREE.BoxGeometry(width, leafH, leafThick);
      const leaf = new THREE.Mesh(leafGeo, this.m.heavyWoodDoor);
      leaf.position.set(dirSign * (width * 0.5), leafH * 0.5, 0);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      leaf.userData = { surface: 'wood', penetrable: true, penLoss: 0.34 };
      pivot.add(leaf);
      raycastMeshes.push(leaf);

      // Iron hinge brackets
      for (const hy of [0.55, leafH - 0.55]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.12, leafThick + 0.03), this.m.darkIron);
        strap.position.set(dirSign * (width * 0.46), hy, 0);
        pivot.add(strap);
      }

      group.add(pivot);

      // Approximate physics AABB for player collision (leaves center passage / side walkability accurate)
      // Note: In Dust2, Mid Doors & B Doors have one side wide enough to walk through (`passage`) while the two doors angle opposite ways!
    };

    buildDoorLeaf(-openingWidth / 2, leftLeafW, +1, leftAngle);
    buildDoorLeaf(+openingWidth / 2, rightLeafW, -1, rightAngle);

    // Build accurate small AABB segments along the angled leaves so players can walk smoothly through wide door openings
    const addLeafColliders = (hingeLocalX, width, dirSign, angle) => {
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const dist = width * t * dirSign;
        const lx = hingeLocalX + Math.cos(angle) * dist;
        const lz = -Math.sin(angle) * dist;
        const segHalf = (width / steps) * 0.45;
        if (axis === 'Z') {
          colliders.push({
            minX: cx + lx - segHalf, maxX: cx + lx + segHalf,
            minY: y, maxY: y + leafH,
            minZ: cz + lz - 0.16, maxZ: cz + lz + 0.16,
            surface: 'wood'
          });
        } else {
          // rotated +90 deg around Y: worldX = cx + lz, worldZ = cz - lx
          colliders.push({
            minX: cx + lz - 0.16, maxX: cx + lz + 0.16,
            minY: y, maxY: y + leafH,
            minZ: cz - lx - segHalf, maxZ: cz - lx + segHalf,
            surface: 'wood'
          });
        }
      }
    };

    addLeafColliders(-openingWidth / 2, leftLeafW, +1, leftAngle);
    addLeafColliders(+openingWidth / 2, rightLeafW, -1, rightAngle);

    return { group, colliders, raycastMeshes };
  }

  // Sculpted Crate (Wood or Military Ordnance) with 3D recessed frame & corner trim
  createDetailedCrate(w, h, d, type = 'wood') {
    const group = new THREE.Group();
    const baseMat = type === 'military' ? this.m.militaryCrate : this.m.woodCrate;
    const frameMat = type === 'military' ? this.m.darkIron : this.m.woodCrate;
    const surface = type === 'military' ? 'metal' : 'wood';

    const core = createWorldBox(w - 0.06, h - 0.04, d - 0.06, baseMat, 0.55);
    core.position.y = h * 0.5;
    core.userData = { surface, penetrable: type === 'wood', penLoss: 0.48 };
    group.add(core);

    // Corner vertical posts & top/bottom rim rails for crisp 3D silhouette
    const postT = 0.08;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(postT, h, postT), frameMat);
        post.position.set(sx * (w * 0.5 - postT * 0.4), h * 0.5, sz * (d * 0.5 - postT * 0.4));
        post.castShadow = true;
        post.receiveShadow = true;
        group.add(post);
      }
    }

    const topCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02), frameMat);
    topCap.position.y = h - 0.03;
    topCap.castShadow = true;
    topCap.receiveShadow = true;
    group.add(topCap);

    return { group, hitMesh: core };
  }

  // Iconic Wrecked / Scorched Sedan for Long A Car & B Car!
  createWreckedCar(bodyColor = 0x8a7d6a, rotY = 0) {
    const group = new THREE.Group();
    group.rotation.y = rotY;

    const paintMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.72,
      metalness: 0.35
    });
    const glassFrameMat = this.m.darkIron;
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.9, metalness: 0.05 });

    const rayMeshes = [];

    // Main lower chassis (length 4.3m along Z, width 1.85m along X, height 0.78m)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.68, 4.25), paintMat);
    chassis.position.set(0, 0.62, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    chassis.userData = { surface: 'metal', penetrable: false };
    group.add(chassis);
    rayMeshes.push(chassis);

    // Sloped front hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 1.25), paintMat);
    hood.position.set(0, 0.97, 1.42);
    hood.rotation.x = 0.09;
    hood.castShadow = true;
    group.add(hood);

    // Cabin roof & pillars (empty blown-out windows for authentic CS peek lines!)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.10, 1.65), paintMat);
    roof.position.set(0, 1.52, -0.15);
    roof.castShadow = true;
    roof.userData = { surface: 'metal', penetrable: true, penLoss: 0.55 };
    group.add(roof);
    rayMeshes.push(roof);

    const pillarPositions = [
      [-0.74, 1.24, 0.62, -0.32], [0.74, 1.24, 0.62, -0.32],
      [-0.74, 1.24, -0.15, 0],    [0.74, 1.24, -0.15, 0],
      [-0.74, 1.24, -0.92, 0.32], [0.74, 1.24, -0.92, 0.32]
    ];
    for (const [px, py, pz, rx] of pillarPositions) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.64, 0.10), glassFrameMat);
      p.position.set(px, py, pz);
      p.rotation.x = rx;
      p.castShadow = true;
      group.add(p);
    }

    // Bumpers & headlights
    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(1.90, 0.24, 0.22), glassFrameMat);
    fBumper.position.set(0, 0.42, 2.12);
    group.add(fBumper);
    const rBumper = fBumper.clone();
    rBumper.position.set(0, 0.44, -2.12);
    group.add(rBumper);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.28, 12);
    hubGeo.rotateZ(Math.PI / 2);
    for (const [wx, wz] of [[-0.88, 1.32], [0.88, 1.32], [-0.88, -1.32], [0.88, -1.32]]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(wx, 0.36, wz);
      w.castShadow = true;
      group.add(w);
      const hub = new THREE.Mesh(hubGeo, this.m.rustedMetal);
      hub.position.set(wx, 0.36, wz);
      group.add(hub);
    }

    return { group, rayMeshes };
  }

  // Ribbed Steel Oil Drum
  createBarrel(color = 0x385266) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.04, 16), mat);
    body.position.y = 0.52;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { surface: 'metal', penetrable: false };
    group.add(body);

    for (const ry of [0.04, 0.36, 0.68, 1.00]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.02, 8, 20), this.m.darkIron);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry;
      group.add(ring);
    }
    return { group, hitMesh: body };
  }

  // Iconic Dust2 Desert Palm Tree
  createPalmTree(height = 8.5, leanX = 0.6, leanZ = 0.3) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 0.94 });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x4d6b34,
      roughness: 0.78,
      side: THREE.DoubleSide
    });

    const segs = 9;
    let cx = 0, cy = 0, cz = 0;
    const segH = height / segs;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const rBot = 0.32 * (1 - t * 0.45);
      const rTop = 0.32 * (1 - (t + 1 / segs) * 0.45);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH * 1.08, 9), trunkMat);
      const nx = Math.pow(t, 1.5) * leanX;
      const nz = Math.pow(t, 1.5) * leanZ;
      seg.position.set(nx, cy + segH * 0.5, nz);
      seg.castShadow = true;
      group.add(seg);
      cx = nx;
      cz = nz;
      cy += segH;
    }

    // Crown of lush continuous arching palm fronds
    const crown = new THREE.Group();
    crown.position.set(cx, cy - 0.15, cz);
    const frondCount = 12;
    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount) * Math.PI * 2 + (f % 2) * 0.12;
      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = angle;
      frondPivot.rotation.z = 0.22 - (f % 3) * 0.12;

      let fx = 0, fy = 0;
      const segLen = 0.72;
      for (let s = 0; s < 5; s++) {
        const pitch = -0.18 - s * 0.22;
        const w = 0.62 * (1 - s * 0.14);
        const segGroup = new THREE.Group();
        segGroup.position.set(fx, fy, 0);
        segGroup.rotation.z = pitch;

        // Spine + V-shaped palm leaflets
        const spine = new THREE.Mesh(new THREE.BoxGeometry(segLen * 1.05, 0.035, 0.04), frondMat);
        spine.position.x = segLen * 0.5;
        segGroup.add(spine);

        const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(segLen * 1.02, 0.018, w), frondMat);
        leftLeaf.position.set(segLen * 0.5, -0.02, w * 0.45);
        leftLeaf.rotation.x = 0.25;
        leftLeaf.castShadow = true;
        segGroup.add(leftLeaf);

        const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(segLen * 1.02, 0.018, w), frondMat);
        rightLeaf.position.set(segLen * 0.5, -0.02, -w * 0.45);
        rightLeaf.rotation.x = -0.25;
        rightLeaf.castShadow = true;
        segGroup.add(rightLeaf);

        frondPivot.add(segGroup);
        fx += Math.cos(pitch) * segLen;
        fy += Math.sin(pitch) * segLen;
      }
      crown.add(frondPivot);
    }
    group.add(crown);
    group.userData.crown = crown;
    return group;
  }

  // Moroccan Minaret Dome Tower for Dust2 Skyline
  createMinaretDome(scale = 1.0) {
    const group = new THREE.Group();
    const base = createWorldBox(3.6 * scale, 7.0 * scale, 3.6 * scale, this.m.sandstoneWarm, 0.28);
    base.position.y = 3.5 * scale;
    group.add(base);

    const cornice = createWorldBox(4.0 * scale, 0.45 * scale, 4.0 * scale, this.m.sandstoneTrim, 0.35);
    cornice.position.y = 7.1 * scale;
    group.add(cornice);

    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55 * scale, 1.65 * scale, 1.8 * scale, 16),
      this.m.sandstonePlaster
    );
    drum.position.y = 8.1 * scale;
    group.add(drum);

    const domeMat = new THREE.MeshStandardMaterial({ color: 0xc9a368, roughness: 0.55, metalness: 0.18 });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.62 * scale, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      domeMat
    );
    dome.position.y = 8.9 * scale;
    group.add(dome);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.5 * scale, 8), this.m.darkIron);
    spire.position.y = 11.0 * scale;
    group.add(spire);

    return group;
  }

  // Decorative Shuttered Window / Balcony for Dust2 facades
  createShutteredWindow(width = 1.3, height = 1.8) {
    const group = new THREE.Group();
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.9 })
    );
    group.add(recess);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.28, 0.14, 0.28), this.m.sandstoneTrim);
    sill.position.set(0, -height / 2 - 0.05, 0.08);
    group.add(sill);

    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x3b5848, roughness: 0.82 });
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.44, height * 0.94, 0.06), shutterMat);
      sh.position.set(sx * (width * 0.46), 0, 0.10);
      sh.rotation.y = sx * -0.35;
      group.add(sh);
    }
    return group;
  }

  // Striped Moroccan Cloth Market Awning
  createAwning(width = 4.2, depth = 1.8) {
    const group = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.m.awningCloth);
    cloth.rotation.x = -Math.PI / 2 + 0.36;
    cloth.position.set(0, -0.3, depth * 0.44);
    cloth.castShadow = true;
    group.add(cloth);

    for (const sx of [-width / 2 + 0.1, width / 2 - 0.1]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, depth, 6), this.m.darkIron);
      rod.rotation.x = Math.PI / 2 + 0.36;
      rod.position.set(sx, -0.32, depth * 0.44);
      group.add(rod);
    }
    return group;
  }

  // Warm Tunnel Cage Light (for Upper/Lower B Tunnels & Long House)
  createTunnelLight(withPointLight = true) {
    const group = new THREE.Group();
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.10, 10), this.m.darkIron);
    group.add(mount);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdca0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bulbMat);
    bulb.position.y = -0.10;
    group.add(bulb);

    if (withPointLight) {
      const pl = new THREE.PointLight(0xffbe73, 14, 15, 1.6);
      pl.position.y = -0.25;
      group.add(pl);
    }
    return group;
  }
}
