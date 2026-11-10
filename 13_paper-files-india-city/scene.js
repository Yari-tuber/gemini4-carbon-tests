import * as THREE from '/node_modules/three/build/three.module.js';
import { clamp, lerp, seg, ss, eio, eo, ei, spring, mulberry } from '/core/lib.js';
import { DUR, HUD_CUES } from './timeline.js';

const SHIRT_PALETTE = [
  [0.95, 0.24, 0.32], // coral red
  [0.22, 0.62, 0.98], // sky blue
  [0.24, 0.86, 0.44], // vibrant green
  [0.98, 0.82, 0.18], // sunny yellow
  [0.92, 0.34, 0.78], // magenta pink
  [0.18, 0.84, 0.82], // teal cyan
  [0.98, 0.52, 0.16], // vivid orange
  [0.68, 0.38, 0.98], // violet
  [0.96, 0.96, 0.98], // crisp white
];

function latLonToVec3(lat, lon, r) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
     r * Math.cos(theta),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

// Build high-precision 3D architectural basin (sand floor + crisp thin white rim + clean offset drop shadow)
function buildBasinMesh(ringKm, { wallWidth = 0.62, wallHeight = 1.75, floorY = 0.32 } = {}) {
  const group = new THREE.Group();
  const n = ringKm.length;

  // 1. Sand floor via THREE.Shape (shape (x, y) rotated -90 deg on X -> world (x, floorY, -y))
  const shape = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const [wx, wz] = ringKm[i];
    if (i === 0) shape.moveTo(wx, -wz);
    else shape.lineTo(wx, -wz);
  }
  shape.closePath();
  const floorGeo = new THREE.ShapeGeometry(shape);

  // Warm matte architectural sand with subtle micro-grain shader so large open floor looks tactile
  const floorMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vWorld;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        float g1 = hash(floor(vWorld.xz * 3.5)) * 0.035;
        float g2 = sin(vWorld.x * 0.18 + vWorld.z * 0.12) * 0.018;
        vec3 sand = vec3(0.805, 0.725, 0.568) + (g1 - 0.017) + g2;
        gl_FragColor = vec4(sand, 1.0);
      }
    `,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = floorY;
  group.add(floorMesh);

  // 2. Clean offset drop-shadow silhouette (zero miter spikes on sharp GIS inlets!)
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
  });
  const shadowA = new THREE.Mesh(floorGeo, shadowMat);
  shadowA.rotation.x = -Math.PI / 2;
  shadowA.position.set(wallWidth * 1.45, 0.05, wallWidth * 2.15);
  group.add(shadowA);

  const shadowMatSoft = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  const shadowB = new THREE.Mesh(floorGeo, shadowMatSoft);
  shadowB.rotation.x = -Math.PI / 2;
  shadowB.position.set(wallWidth * 2.6, 0.04, wallWidth * 3.8);
  group.add(shadowB);

  // 3. Outward segment normals with clamped miter (scale <= 1.45 prevents spikes on 339-pt OSM boundaries)
  let cx = 0, cz = 0;
  for (const [x, z] of ringKm) { cx += x; cz += z; }
  cx /= n; cz /= n;

  const segNormals = [];
  let dotSum = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ringKm[i];
    const [x1, z1] = ringKm[(i + 1) % n];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 1e-6;
    const nx = -dz / len, nz = dx / len;
    segNormals.push([nx, nz]);
    dotSum += nx * ((x0 + x1) * 0.5 - cx) + nz * ((z0 + z1) * 0.5 - cz);
  }
  const sign = dotSum >= 0 ? 1 : -1;
  for (const sn of segNormals) { sn[0] *= sign; sn[1] *= sign; }

  const innerPts = [];
  const outerPts = [];
  for (let i = 0; i < n; i++) {
    const [n0x, n0z] = segNormals[(i - 1 + n) % n];
    const [n1x, n1z] = segNormals[i];
    let mx = n0x + n1x, mz = n0z + n1z;
    const mlen = Math.hypot(mx, mz);
    if (mlen < 1e-4) { mx = n1x; mz = n1z; }
    else { mx /= mlen; mz /= mlen; }
    const denom = Math.max(0.68, mx * n1x + mz * n1z);
    const scale = Math.min(1.45, 1 / denom);
    const [px, pz] = ringKm[i];
    innerPts.push([px, pz]);
    outerPts.push([px + mx * wallWidth * scale, pz + mz * wallWidth * scale]);
  }

  const pos = [];
  const norm = [];
  const col = [];
  const topC = [0.97, 0.97, 0.96];
  const outC = [0.76, 0.76, 0.74];
  const inC  = [0.80, 0.78, 0.74];

  const pushTri = (a, b, c, na, cc) => {
    pos.push(...a, ...b, ...c);
    norm.push(...na, ...na, ...na);
    col.push(...cc, ...cc, ...cc);
  };

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ix0, iz0] = innerPts[i], [ix1, iz1] = innerPts[j];
    const [ox0, oz0] = outerPts[i], [ox1, oz1] = outerPts[j];
    const [snx, snz] = segNormals[i];

    const ti0 = [ix0, wallHeight, iz0], ti1 = [ix1, wallHeight, iz1];
    const to0 = [ox0, wallHeight, oz0], to1 = [ox1, wallHeight, oz1];
    pushTri(ti0, to0, to1, [0, 1, 0], topC);
    pushTri(ti0, to1, ti1, [0, 1, 0], topC);

    const bo0 = [ox0, 0.04, oz0], bo1 = [ox1, 0.04, oz1];
    pushTri(bo0, bo1, to1, [snx, 0.18, snz], outC);
    pushTri(bo0, to1, to0, [snx, 0.18, snz], outC);

    const bi0 = [ix0, floorY, iz0], bi1 = [ix1, floorY, iz1];
    pushTri(bi1, bi0, ti0, [-snx, 0.22, -snz], inC);
    pushTri(bi1, ti0, ti1, [-snx, 0.22, -snz], inC);
  }

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.52,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(wallGeo, wallMat));

  return group;
}

// Crisp bold white dashed GIS outline (3-strand offset ribbon so dashes are thick & legible even on ANGLE 1px WebGL lines!)
function buildDashedOutline(ringKm, y = 4.6) {
  const grp = new THREE.Group();
  const offsets = [[0, 0], [0.22, 0.12], [-0.22, -0.12], [0.12, -0.22]];
  for (const [ox, oz] of offsets) {
    const pts = ringKm.map(([x, z]) => new THREE.Vector3(x + ox, y, z + oz));
    pts.push(pts[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 2.0,
      gapSize: 1.4,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    line.renderOrder = 25;
    grp.add(line);
  }
  return grp;
}

// White architectural square pouring sheet (matte off-white board + subtle rim)
function buildSquareTray() {
  const group = new THREE.Group();
  const baseGeo = new THREE.BoxGeometry(1, 0.014, 1);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4da,
    roughness: 0.68,
    metalness: 0.03,
    transparent: true,
    opacity: 1,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  group.add(base);

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf7f6f2,
    roughness: 0.48,
    metalness: 0.04,
    transparent: true,
    opacity: 1,
  });
  const t = 0.012, h = 0.024;
  const rims = [
    [1 + t * 2, h, t, 0, h * 0.35, -0.5 - t * 0.5],
    [1 + t * 2, h, t, 0, h * 0.35,  0.5 + t * 0.5],
    [t, h, 1, -0.5 - t * 0.5, h * 0.35, 0],
    [t, h, 1,  0.5 + t * 0.5, h * 0.35, 0],
  ];
  for (const [sx, sy, sz, px, py, pz] of rims) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), rimMat);
    m.position.set(px, py, pz);
    group.add(m);
  }
  return {
    group,
    setOpacity(a) {
      baseMat.opacity = a;
      rimMat.opacity = a;
      group.visible = a > 0.01;
    }
  };
}

// GPU Instanced 3D Standing Crowd (42k Delhi / 48k Sikkim)
// Uses exact Tray Quaternion/Matrix so tilting around ANY edge (+X right lip or +Z front lip) keeps top face visible!
function buildPouringCrowd(targetPairsFloat32, count, seed, { pillarRadius = 0.09, pillarHeight = 0.52, floorY = 0.35 } = {}) {
  const rng = mulberry(seed);
  const sides = 5;
  const basePos = [];
  const baseNorm = [];
  const basePart = []; // 0 = colored shirt, >0 = dark hair/shadow accent

  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * Math.PI * 2;
    const a1 = ((s + 1) / sides) * Math.PI * 2;
    const x0 = Math.cos(a0) * pillarRadius, z0 = Math.sin(a0) * pillarRadius;
    const x1 = Math.cos(a1) * pillarRadius, z1 = Math.sin(a1) * pillarRadius;
    const nx = Math.cos((a0 + a1) * 0.5), nz = Math.sin((a0 + a1) * 0.5);

    basePos.push(x0, 0, z0,  x1, 0, z1,  x1, pillarHeight, z1);
    basePos.push(x0, 0, z0,  x1, pillarHeight, z1,  x0, pillarHeight, z0);
    // Darken lower base slightly for crisp ground contact shadow (like sec_01.jpg & sec_15.jpg)
    basePart.push(0.28, 0.28, 0.0,  0.28, 0.0, 0.0);
    for (let k = 0; k < 6; k++) baseNorm.push(nx, 0.22, nz);

    basePos.push(0, pillarHeight * 1.12, 0,  x1, pillarHeight, z1,  x0, pillarHeight, z0);
    baseNorm.push(0, 1, 0,  0, 1, 0,  0, 1, 0);
    basePart.push(0.42, 0.0, 0.0);
  }

  const instGeo = new THREE.InstancedBufferGeometry();
  instGeo.setAttribute('position', new THREE.Float32BufferAttribute(basePos, 3));
  instGeo.setAttribute('normal', new THREE.Float32BufferAttribute(baseNorm, 3));
  instGeo.setAttribute('aPart', new THREE.Float32BufferAttribute(basePart, 1));

  const gridN = Math.ceil(Math.sqrt(count));
  const trayUV = new Float32Array(count * 2);
  const targetXZ = new Float32Array(count * 2);
  const release = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  // Pour off the +U (+X right-hand edge of tray in local tray coords) so when tray sits left of basin and rolls -Z,
  // the camera sees the ENTIRE top face of the sheet AND colorful bands sliding off its right edge (sec_15.jpg & sec_34.jpg)!
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / gridN); // 0 = first to pour (+u = +0.485), gridN-1 = last (-u = -0.485)
    const col = i % gridN;
    const u = (0.5 - (row + 0.5 + (rng() - 0.5) * 0.55) / gridN) * 0.968;
    const v = ((col + 0.5 + (rng() - 0.5) * 0.55) / gridN - 0.5) * 0.968;
    trayUV[i * 2] = u;
    trayUV[i * 2 + 1] = v;

    targetXZ[i * 2] = targetPairsFloat32[i * 2];
    targetXZ[i * 2 + 1] = targetPairsFloat32[i * 2 + 1];

    // Distinct row-by-row wave bands matching the parallel cascading stripes in sec_15.jpg & sec_34.jpg!
    const rowFrac = row / gridN;
    const bandQuant = Math.floor(rowFrac * 26.0) / 26.0;
    const jitter = (rowFrac - bandQuant) * 0.65 + (rng() - 0.5) * 0.018;
    release[i] = clamp(0.02 + bandQuant * 0.76 + jitter, 0.0, 0.82);

    const pal = SHIRT_PALETTE[Math.floor(rng() * SHIRT_PALETTE.length)];
    const shade = 0.84 + rng() * 0.26;
    colors[i * 3]     = clamp(pal[0] * shade, 0, 1);
    colors[i * 3 + 1] = clamp(pal[1] * shade, 0, 1);
    colors[i * 3 + 2] = clamp(pal[2] * shade, 0, 1);
  }

  instGeo.setAttribute('aTrayUV', new THREE.InstancedBufferAttribute(trayUV, 2));
  instGeo.setAttribute('aTargetXZ', new THREE.InstancedBufferAttribute(targetXZ, 2));
  instGeo.setAttribute('aRelease', new THREE.InstancedBufferAttribute(release, 1));
  instGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  instGeo.instanceCount = count;

  const uniforms = {
    uPour:        { value: 1.0 },
    uTrayMatrix:  { value: new THREE.Matrix4() }, // Full world transform of unit tray (pos + rot + scale)
    uSlideAmt:    { value: 0.0 },
    uFloorY:      { value: floorY },
    uScalePillar: { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      attribute float aPart;
      attribute vec2 aTrayUV;
      attribute vec2 aTargetXZ;
      attribute float aRelease;
      attribute vec3 aColor;

      uniform float uPour;
      uniform mat4 uTrayMatrix;
      uniform float uSlideAmt;
      uniform float uFloorY;
      uniform float uScalePillar;

      varying vec3 vCol;

      void main() {
        // Slide smoothly toward +X (+U = +0.495) pouring lip as tray tilts
        float preSlide = clamp(uPour / max(aRelease, 0.001), 0.0, 1.0) * uSlideAmt * 0.16;
        float curU = min(0.495, aTrayUV.x + preSlide);
        vec3 onTrayWorld = (uTrayMatrix * vec4(curU, 0.012, aTrayUV.y, 1.0)).xyz;
        vec3 lipWorld    = (uTrayMatrix * vec4(0.496, 0.008, aTrayUV.y, 1.0)).xyz;
        vec3 landedWorld = vec3(aTargetXZ.x, uFloorY, aTargetXZ.y);

        vec3 baseCenter;
        float dropDur = 0.17;
        if (uPour <= 0.0001) {
          baseCenter = onTrayWorld;
        } else if (uPour >= 0.9999) {
          baseCenter = landedWorld;
        } else if (uPour < aRelease) {
          baseCenter = onTrayWorld;
        } else if (uPour < aRelease + dropDur) {
          float s = (uPour - aRelease) / dropDur;
          vec3 startP = mix(onTrayWorld, lipWorld, smoothstep(0.0, 0.30, s));
          float xzS = s * s * (3.0 - 2.0 * s);
          float x = mix(startP.x, landedWorld.x, xzS);
          float z = mix(startP.z, landedWorld.z, xzS);
          float y = mix(startP.y, landedWorld.y, pow(s, 1.65)) + sin(s * 3.14159) * 0.9;
          baseCenter = vec3(x, y, z);
        } else {
          baseCenter = landedWorld;
        }

        vec3 worldP = baseCenter + position * uScalePillar;
        vec3 n = normalize(normal);
        float diff = 0.52 + 0.48 * max(0.0, dot(n, normalize(vec3(-0.42, 0.82, 0.38))));
        vec3 bodyCol = mix(aColor, vec3(0.11, 0.09, 0.08), aPart);
        vCol = bodyCol * diff;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldP, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main() {
        gl_FragColor = vec4(vCol, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(instGeo, mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// Stage B: Micro Concert Crowd (1m x 1m neon square + 2 hero people + 2,800 concertgoers)
function buildConcertStage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6d5a45);
  const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 250);

  scene.add(new THREE.AmbientLight(0xfff4e4, 1.35));
  const key = new THREE.DirectionalLight(0xfff0d2, 1.75);
  key.position.set(4, 12, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec5ff, 0.55);
  rim.position.set(-6, 8, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 180),
    new THREE.MeshStandardMaterial({ color: 0x7e6a52, roughness: 0.88, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const neonGroup = new THREE.Group();
  const barMat = new THREE.MeshBasicMaterial({ color: 0xfff394 });
  const bw = 0.048;
  const bars = [
    [1 + bw, 0.02, bw, 0, 0.015, -0.5],
    [1 + bw, 0.02, bw, 0, 0.015,  0.5],
    [bw, 0.02, 1 + bw, -0.5, 0.015, 0],
    [bw, 0.02, 1 + bw,  0.5, 0.015, 0],
  ];
  for (const [sx, sy, sz, px, py, pz] of bars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), barMat);
    m.position.set(px, py, pz);
    neonGroup.add(m);
  }
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vP;
      void main() {
        vec2 d = abs(vP) - vec2(0.5);
        float dist = abs(max(d.x, d.y));
        float inside = max(d.x, d.y) < 0.0 ? 0.08 : 0.0;
        float glow = exp(-dist * 9.5) * 0.65 + exp(-dist * 3.2) * 0.22 + inside;
        gl_FragColor = vec4(1.0, 0.86, 0.32, clamp(glow, 0.0, 0.85));
      }
    `
  });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.008;
  neonGroup.add(glowPlane);
  scene.add(neonGroup);

  function makePersonMesh(shirtHex, skinHex = 0xd29c74, hairHex = 0x2d1d14, armPose = 0.35) {
    const g = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x26262c, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.58 });
    const headMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.42 });
    const handMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 });

    for (const lx of [-0.085, 0.085]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.38, 10), legMat);
      leg.position.set(lx, 0.19, 0);
      g.add(leg);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.26, 8, 14), shirtMat);
    torso.scale.set(1.18, 1, 0.82);
    torso.position.set(0, 0.56, 0);
    g.add(torso);

    for (const side of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.20, 0.67, 0);
      armPivot.rotation.z = side * (0.28 + armPose * 0.25);
      armPivot.rotation.x = -0.35 - armPose * 0.45;
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22, 6, 10), shirtMat);
      arm.position.set(0, -0.11, 0);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), handMat);
      hand.position.set(0, -0.24, 0);
      armPivot.add(arm, hand);
      g.add(armPivot);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 14), headMat);
    head.position.set(0, 0.89, 0.01);
    g.add(head);
    return g;
  }

  const heroA = makePersonMesh(0x6ee787, 0xd8a37c, 0x3b271c, 0.55);
  const heroB = makePersonMesh(0x93acff, 0xd8a37c, 0x6b5226, 0.45);
  scene.add(heroA, heroB);

  const rng = mulberry(2026);
  const crowdCoords = [];
  for (let gx = -24; gx <= 24; gx += 0.71) {
    for (let gz = -36; gz <= 36; gz += 0.71) {
      const x = gx + (rng() - 0.5) * 0.26;
      const z = gz + (rng() - 0.5) * 0.26;
      if (Math.abs(x) < 0.78 && Math.abs(z) < 0.78) continue;
      crowdCoords.push({
        x, z,
        yaw: rng() * Math.PI * 2,
        phase: rng() * Math.PI * 2,
        pal: SHIRT_PALETTE[Math.floor(rng() * SHIRT_PALETTE.length)],
        hair: rng() < 0.25 ? [0.42, 0.30, 0.16] : [0.16, 0.11, 0.09],
      });
    }
  }
  const N = crowdCoords.length;
  const torsoGeo = new THREE.CapsuleGeometry(0.16, 0.30, 5, 8);
  torsoGeo.scale(1.18, 1, 0.82);
  torsoGeo.translate(0, 0.54, 0);
  const headGeo = new THREE.SphereGeometry(0.135, 10, 8);
  headGeo.translate(0, 0.88, 0);

  const torsoInst = new THREE.InstancedMesh(torsoGeo, new THREE.MeshStandardMaterial({ roughness: 0.62 }), N);
  const headInst  = new THREE.InstancedMesh(headGeo,  new THREE.MeshStandardMaterial({ roughness: 0.45 }), N);
  torsoInst.frustumCulled = false;
  headInst.frustumCulled = false;

  const cTmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const c = crowdCoords[i];
    cTmp.setRGB(c.pal[0], c.pal[1], c.pal[2]);
    torsoInst.setColorAt(i, cTmp);
    cTmp.setRGB(c.hair[0], c.hair[1], c.hair[2]);
    headInst.setColorAt(i, cTmp);
  }
  torsoInst.instanceColor.needsUpdate = true;
  headInst.instanceColor.needsUpdate = true;
  scene.add(torsoInst, headInst);

  const dummy = new THREE.Object3D();
  function update(t) {
    const beatAng = t * (128 / 60) * Math.PI * 2;
    heroA.position.set(-0.20, Math.abs(Math.sin(beatAng * 0.5)) * 0.035, -0.17);
    heroA.rotation.y = 0.55 + Math.sin(t * 2.4) * 0.14;
    heroB.position.set(0.19, Math.abs(Math.cos(beatAng * 0.5)) * 0.035, 0.18);
    heroB.rotation.y = -2.35 + Math.cos(t * 2.2) * 0.14;

    for (let i = 0; i < N; i++) {
      const c = crowdCoords[i];
      const bob = Math.abs(Math.sin(beatAng * 0.5 + c.phase)) * 0.03;
      dummy.position.set(c.x, bob, c.z);
      dummy.rotation.set(Math.sin(t * 2.5 + c.phase) * 0.04, c.yaw + Math.sin(t * 1.8 + c.phase) * 0.10, 0);
      dummy.updateMatrix();
      torsoInst.setMatrixAt(i, dummy.matrix);
      headInst.setMatrixAt(i, dummy.matrix);
    }
    torsoInst.instanceMatrix.needsUpdate = true;
    headInst.instanceMatrix.needsUpdate = true;

    const dive = eo(seg(t, 6.18, 6.55));
    const hold = seg(t, 6.55, 8.05);
    const climb = Math.pow(seg(t, 8.05, 10.22), 2.35);
    const camY = lerp(5.8, 3.45, dive) + hold * 0.45 + climb * 44.0;
    const camZ = lerp(1.35, 0.82, dive) + hold * 0.08 + climb * 2.2;
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, 0.35 * (1 - climb), -0.05);
    camera.updateMatrixWorld();
  }

  return { scene, camera, update };
}

// Stage A: Orbital 3D Earth (NASA Blue Marble + VIIRS Pure City Lights + Exact 4K GIS India Mask + 1:10m Borders & Arcs)
function buildGlobeStage(dayTex, nightTex, indiaMaskTex, indiaBorder, coastlines) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010308);
  const camera = new THREE.PerspectiveCamera(38, 1080 / 1920, 1, 2500);
  const R = 100;

  // Starfield
  const rng = mulberry(777);
  const starPos = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const u = rng() * 2 - 1, phi = rng() * Math.PI * 2;
    const rad = 750 + rng() * 450;
    const s = Math.sqrt(1 - u * u);
    starPos[i * 3]     = rad * s * Math.cos(phi);
    starPos[i * 3 + 1] = rad * u;
    starPos[i * 3 + 2] = rad * s * Math.sin(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe2eeff, size: 1.6, sizeAttenuation: true })));

  const earthUniforms = {
    tDay: { value: dayTex },
    tNight: { value: nightTex },
    tIndiaMask: { value: indiaMaskTex },
    uBlackout: { value: 0.0 },
    uGlobalBright: { value: 0.0 },
    uBorderGlow: { value: 1.0 },
  };

  const earthMat = new THREE.ShaderMaterial({
    uniforms: earthUniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vUv = uv;
        vNormalW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDay;
      uniform sampler2D tNight;
      uniform sampler2D tIndiaMask;
      uniform float uBlackout;
      uniform float uGlobalBright;
      uniform float uBorderGlow;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;

      // Multi-octave procedural cloud wisps over high northern/southern latitudes (matching sec_05, sec_19, sec_23)
      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x),
                   mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = p * 2.07 + vec2(13.1, 7.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dayC = texture2D(tDay, vUv).rgb;
        vec3 nightRaw = texture2D(tNight, vUv).rgb;
        vec3 maskRGB = texture2D(tIndiaMask, vUv).rgb;
        float indiaPoly = maskRGB.r;  // Exact 1:10m China-view India polygon (0 outside, 1 inside)
        float delhiGlow = maskRGB.g;  // Organic Delhi metropolitan cluster
        float borderHalo = maskRGB.b; // Soft cyan-white halo along exact 1:10m India boundary

        float lon = vUv.x * 360.0 - 180.0;
        float lat = vUv.y * 180.0 - 90.0;

        // Sunlight grazing from northern horizon so Tibetan plateau & Himalayas have sunlit relief while India is in crisp twilight
        vec3 sunDir = normalize(vec3(0.18, 0.86, -0.48));
        float ndl = clamp(dot(vNormalW, sunDir) * 0.55 + 0.45, 0.0, 1.0);
        float dayFactor = mix(0.22 + 0.58 * pow(ndl, 1.85), 0.48 + 0.46 * ndl, uGlobalBright);
        vec3 base = dayC * dayFactor;

        // Subtle atmospheric cloud cover north of Himalayas (>33N) & southern oceans (<-18S), leaving India crystal clear!
        float cloudBand = smoothstep(31.0, 46.0, lat) * 0.72 + smoothstep(-14.0, -36.0, lat) * 0.55;
        float cNoise = smoothstep(0.46, 0.78, fbm(vec2(lon * 0.14 + lat * 0.06, lat * 0.22)));
        base = mix(base, vec3(0.84, 0.89, 0.94) * (0.45 + 0.52 * ndl), cloudBand * cNoise);

        // Extract PURE city-light emission (removes NASA VIIRS blue moonlit background floor completely -> ZERO rectangular/border dark patches!)
        float pureCity = clamp((nightRaw.r - nightRaw.b * 0.45 - 0.055) / 0.82, 0.0, 1.0);
        float city = pow(pureCity, 0.92) * 2.55;

        // Exact GIS polygon blackout in Scene 5: rest of India drops to 0.0, while Delhi's real night-light cluster blazes!
        float blackoutKeep = mix(1.0, 1.0 - indiaPoly, uBlackout);
        city *= blackoutKeep;
        city += delhiGlow * (0.35 + 2.35 * uBlackout) * (0.55 + 0.65 * pureCity);

        vec3 lightCol = mix(vec3(1.0, 0.85, 0.44), vec3(1.0, 0.99, 0.90), clamp(city * 0.48, 0.0, 1.0));

        // Crisp blue Rayleigh atmospheric limb glow + glowing cyan-white India border halo (matching sec_05, sec_19)
        vec3 viewDir = normalize(cameraPosition - vPosW);
        float nv = clamp(dot(vNormalW, viewDir), 0.0, 1.0);
        float limb = pow(1.0 - nv, 3.0);
        vec3 atmo = vec3(0.42, 0.72, 1.0) * limb * 0.88;
        vec3 bGlow = vec3(0.72, 0.94, 1.0) * borderHalo * 0.72 * uBorderGlow;

        gl_FragColor = vec4(base + lightCol * city + bGlow + atmo, 1.0);
      }
    `
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), earthMat);
  scene.add(earth);

  // Outer atmosphere limb halo (creates the bright cyan-blue horizon arc at top of sec_05 & sec_19 and ring around sec_23)
  const atmoMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vP = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vec3 vd = normalize(cameraPosition - vP);
        float intensity = pow(clamp(0.72 - dot(vN, vd), 0.0, 1.0), 2.2);
        gl_FragColor = vec4(0.54, 0.82, 1.0, intensity * 1.05);
      }
    `
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.042, 96, 64), atmoMat));

  // 1:10m Physical Coastlines (subtle worldwide)
  const coastPos = [];
  for (const feat of coastlines) {
    const line = feat.coordinates;
    for (let i = 0; i < line.length - 1; i++) {
      const a = latLonToVec3(line[i][1], line[i][0], R * 1.0014);
      const b = latLonToVec3(line[i + 1][1], line[i + 1][0], R * 1.0014);
      coastPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const coastGeo = new THREE.BufferGeometry();
  coastGeo.setAttribute('position', new THREE.Float32BufferAttribute(coastPos, 3));
  const coastMat = new THREE.LineBasicMaterial({ color: 0x9cd8f0, transparent: true, opacity: 0.36 });
  scene.add(new THREE.LineSegments(coastGeo, coastMat));

  // Glowing Cyan-White 1:10m China-View India Outline (matching sec_05.jpg & sec_19.jpg!)
  const indPos = [];
  for (const ring of indiaBorder) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = latLonToVec3(ring[i][1], ring[i][0], R * 1.0024);
      const b = latLonToVec3(ring[i + 1][1], ring[i + 1][0], R * 1.0024);
      indPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const indGeo = new THREE.BufferGeometry();
  indGeo.setAttribute('position', new THREE.Float32BufferAttribute(indPos, 3));
  const indMat = new THREE.LineBasicMaterial({
    color: 0xdff8ff,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.LineSegments(indGeo, indMat));

  // 12 Sleek Golden Great-Circle Convergence Arcs for Scene 6a (matching sec_23.jpg!)
  const origins = [
    [51.5, -0.1],   // Western Europe
    [48.2, 16.4],   // Central Europe
    [55.7, 37.6],   // Eastern Europe
    [30.0, 31.2],   // Cairo / MENA
    [6.5, 3.4],     // West Africa
    [-26.2, 28.0],  // Southern Africa
    [39.9, 116.4],  // East Asia
    [35.7, 139.7],  // Japan
    [1.3, 103.8],   // SE Asia
    [-6.2, 106.8],  // Indonesia
    [-33.8, 151.2], // Australia
    [40.7, -74.0],  // Americas over North Atlantic
  ];
  const targetLatLon = [28.65, 77.12];
  const arcsGroup = new THREE.Group();
  const arcItems = [];

  origins.forEach(([olat, olon], idx) => {
    const p0 = latLonToVec3(olat, olon, R * 1.003);
    const p2 = latLonToVec3(targetLatLon[0], targetLatLon[1], R * 1.004);
    const chord = p0.distanceTo(p2);
    const mid = p0.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(R + 8 + chord * 0.22);
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
    const segs = 72;
    const coreGeo = new THREE.TubeGeometry(curve, segs, 0.24, 6, false);
    const haloGeo = new THREE.TubeGeometry(curve, segs, 0.78, 6, false);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff8c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffbc3b, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);

    // Two small traveling light beads per arc (like sec_23.jpg)
    const beads = [0, 1].map(() => new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending })
    ));
    arcsGroup.add(coreMesh, haloMesh, ...beads);
    arcItems.push({ curve, coreGeo, haloGeo, beads, totalIndices: coreGeo.index.count, delay: idx * 0.07 });
  });
  scene.add(arcsGroup);

  function update(t) {
    const inS2  = t >= 3.10 && t < 6.22;
    const inS5  = t >= 15.55 && t < 20.58;
    const inS6a = t >= 20.58 && t < 24.20;

    earthUniforms.uBlackout.value = inS5 ? ss(seg(t, 15.92, 16.50)) : 0.0;
    earthUniforms.uGlobalBright.value = inS6a ? ss(seg(t, 20.65, 21.60)) * 0.62 : 0.0;
    earthUniforms.uBorderGlow.value = inS6a ? lerp(1.0, 0.20, ss(seg(t, 20.65, 21.55))) : 1.0;
    coastMat.opacity = inS6a ? 0.22 : 0.38;
    indMat.opacity   = inS6a ? lerp(0.92, 0.25, ss(seg(t, 20.65, 21.55))) : 0.92;

    arcsGroup.visible = inS6a;
    if (inS6a) {
      for (const item of arcItems) {
        const p = eo(seg(t, 20.70 + item.delay, 22.30 + item.delay));
        const drawCount = Math.floor((item.totalIndices * p) / 3) * 3;
        item.coreGeo.setDrawRange(0, drawCount);
        item.haloGeo.setDrawRange(0, drawCount);
        item.beads.forEach((bead, bIdx) => {
          const beadT = (t - 20.70 - item.delay) * 0.72 - bIdx * 0.42;
          if (p > 0.05 && beadT > 0) {
            bead.visible = true;
            bead.position.copy(item.curve.getPoint(Math.min(p, beadT % 1.0)));
          } else {
            bead.visible = false;
          }
        });
      }
    }

    if (inS2) {
      // Orbital view over India with curved blue atmospheric horizon limb across top of frame (matching sec_05.jpg!)
      const u = ss(seg(t, 3.18, 5.90));
      const dive = ei(seg(t, 5.88, 6.18));
      const dist = lerp(276, 260, u) - dive * 110;
      camera.position.copy(latLonToVec3(lerp(13.2, 14.8, u), 79.2, dist));
      camera.up.set(0, 1, 0);
      camera.lookAt(latLonToVec3(25.4, 79.4, R * 0.96));
    } else if (inS5) {
      // Scene 5 Empty India blackout with curved blue horizon limb at top & full Kolkata/Mumbai/Chennai framing (matching sec_19.jpg!)
      const u = ss(seg(t, 15.62, 20.55));
      const dist = lerp(274, 262, u);
      camera.position.copy(latLonToVec3(13.6, 79.4, dist));
      camera.up.set(0, 1, 0);
      camera.lookAt(latLonToVec3(25.2, 79.5, R * 0.96));
    } else {
      // Scene 6a: Smooth pull-back from India to FULL circular Earth sphere centered in 1080x1920 frame (matching sec_23.jpg!)
      const pull = eio(seg(t, 20.58, 21.85));
      const dive = ei(seg(t, 23.78, 24.12));
      const dist = lerp(262, 585, pull) - dive * 340;
      const lat = lerp(13.6, 25.0, pull);
      const lon = lerp(79.4, 65.0, pull);
      camera.position.copy(latLonToVec3(lat, lon, dist));
      camera.up.set(0, 1, 0);
      const startLook = latLonToVec3(25.2, 79.5, R * 0.96);
      const endLook = new THREE.Vector3(0, -2.0, 0);
      camera.lookAt(startLook.lerp(endLook, pull));
    }
    camera.updateMatrixWorld();
  }

  return { scene, camera, R, update };
}

// Stage C: Regional 3D Basin & Pouring Theater (OSM Delhi + 4K Himalaya Satellite Terrain + OSM Sikkim)
function buildBasinStage(regTex, sceneGeo, targetsBuffer) {
  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0x9ca7a8);
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(0x9ca7a8, 0.00118);

  const camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 1.0, 3200);

  scene.add(new THREE.AmbientLight(0xf6f3ea, 1.32));
  const sun = new THREE.DirectionalLight(0xfff5df, 1.62);
  sun.position.set(-220, 440, 280);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcce2ff, 0.45);
  fill.position.set(240, 200, -240);
  scene.add(fill);

  // Outer earth apron
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(16000, 16000),
    new THREE.MeshBasicMaterial({ color: 0x4b5b3c })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.25;
  scene.add(apron);

  const plateW = 28.0 * sceneGeo.kx; // ~2,735 km
  const plateH = 16.0 * sceneGeo.kz; // ~1,769 km
  const plateCX = (82.0 - sceneGeo.lon0) * sceneGeo.kx;
  const plateCZ = -(28.0 - sceneGeo.lat0) * sceneGeo.kz;

  const regMat = new THREE.ShaderMaterial({
    uniforms: {
      tMap: { value: regTex },
      uFogColor: { value: new THREE.Vector3(0.61, 0.655, 0.66) },
      uFogStart: { value: 195.0 },
      uFogRange: { value: 380.0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tMap;
      uniform vec3 uFogColor;
      uniform float uFogStart;
      uniform float uFogRange;
      varying vec2 vUv;
      varying vec3 vWorld;

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x),
                   mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
      }

      void main() {
        // Sample un-linearized sRGB satellite texture directly so colors match sec_01.jpg & sec_30.jpg!
        vec3 tex = texture2D(tMap, vUv).rgb * 0.72;
        float n1 = vnoise(vWorld.xz * 0.085);
        float n2 = vnoise(vWorld.xz * 0.24 + 11.3);
        float mottle = (n1 * 0.65 + n2 * 0.35 - 0.5) * 0.16;
        vec3 col = tex * (1.0 + mottle);

        // Compute per-pixel camera distance (not 4-corner vertex distance!) so terrain stays vivid & fades at true horizon!
        float viewDist = distance(cameraPosition, vWorld);
        float fogF = smoothstep(uFogStart, uFogStart + uFogRange, viewDist);
        col = mix(col, uFogColor, fogF * 0.92);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const regPlane = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH), regMat);
  regPlane.rotation.x = -Math.PI / 2;
  regPlane.position.set(plateCX, 0.0, plateCZ);
  scene.add(regPlane);

  // Crisp survey-accurate OSM 3D basins
  const delhiBasin  = buildBasinMesh(sceneGeo.delhiRing,  { wallWidth: 0.58, wallHeight: 1.65, floorY: 0.32 });
  const sikkimBasin = buildBasinMesh(sceneGeo.sikkimRing, { wallWidth: 1.05, wallHeight: 2.85, floorY: 0.42 });
  scene.add(delhiBasin, sikkimBasin);

  const delhiDashed = buildDashedOutline(sceneGeo.delhiRing, 4.6);
  scene.add(delhiDashed);

  const tray27 = buildSquareTray();
  const tray64 = buildSquareTray();
  scene.add(tray27.group, tray64.group);

  const nDelhi = sceneGeo.nDelhi;
  const nSikkim = sceneGeo.nSikkim;
  const f32 = new Float32Array(targetsBuffer);
  const delhiTargets = f32.subarray(0, nDelhi * 2);
  const sikkimTargets = f32.subarray(nDelhi * 2, (nDelhi + nSikkim) * 2);

  const delhiCrowd = buildPouringCrowd(delhiTargets, nDelhi, 101, { pillarRadius: 0.092, pillarHeight: 0.52, floorY: 0.35 });
  const worldCrowd = buildPouringCrowd(sikkimTargets, nSikkim, 202, { pillarRadius: 0.155, pillarHeight: 0.88, floorY: 0.45 });
  scene.add(delhiCrowd.mesh, worldCrowd.mesh);

  const [dcx, dcz] = sceneGeo.delhiCenter;
  const [scx, scz] = sceneGeo.sikkimCenter;

  // Exact Frame-0 & Frame-DUR Loop Camera Pose over Half-Filled OSM Delhi (49.5 km wide fits 100% inside 1080px with horizon at top!)
  const LOOP_CAM_POS  = new THREE.Vector3(dcx - 1.2, 80.0, dcz + 114.0);
  const LOOP_CAM_LOOK = new THREE.Vector3(dcx - 1.2, 0.0, dcz - 5.0);

  const anchors = {
    delhiLabel:  new THREE.Vector3(dcx + 3.5, 2.2, dcz - 23.5),
    sikkimLabel: new THREE.Vector3(scx + 1.0, 3.5, scz - 55.0),
    tray27Edge:  new THREE.Vector3(),
    tray64Edge:  new THREE.Vector3(),
    showTray27Label: false,
    showTray64Label: false,
    showDelhiLabel: false,
    showSikkimLabel: false,
  };

  function setFogDensity(d) {
    scene.fog.density = d * 0.55;
    // Map density to far-horizon distance so foreground satellite terrain stays vivid green/ochre/white!
    regMat.uniforms.uFogStart.value = lerp(420.0, 185.0, clamp((d - 0.0006) / 0.0016, 0, 1));
    regMat.uniforms.uFogRange.value = lerp(650.0, 260.0, clamp((d - 0.0006) / 0.0016, 0, 1));
  }

  function update(t) {
    anchors.showTray27Label = false;
    anchors.showTray64Label = false;
    anchors.showDelhiLabel = false;
    anchors.showSikkimLabel = false;
    delhiDashed.visible = false;

    if (t < 3.20) {
      // S1: Half-filled OSM Delhi hook -> rocket climb to space at 2.65..3.18s (matching sec_01.jpg!)
      delhiCrowd.mesh.visible = true;
      delhiCrowd.uniforms.uPour.value = 1.0;
      delhiCrowd.uniforms.uScalePillar.value = 1.0;
      worldCrowd.mesh.visible = false;
      tray27.setOpacity(0);
      tray64.setOpacity(0);
      anchors.showDelhiLabel = t < 2.95;
      anchors.delhiLabel.set(dcx + 3.5, 2.2, dcz - 23.5);

      const creep = ss(seg(t, 0.0, 2.65));
      const climb = Math.pow(seg(t, 2.65, 3.18), 2.8);
      camera.position.set(
        LOOP_CAM_POS.x,
        LOOP_CAM_POS.y - creep * 2.5 + climb * 560.0,
        LOOP_CAM_POS.z - creep * 2.2 + climb * 180.0
      );
      camera.lookAt(LOOP_CAM_LOOK.x, LOOP_CAM_LOOK.y, LOOP_CAM_LOOK.z - creep * 0.6);
      setFogDensity(lerp(0.00215, 0.0004, climb));
    } else if (t >= 10.15 && t < 15.65) {
      // S4: 27km square hovers behind/above Delhi (sec_12.jpg), then glides left & rolls -Z so top face + pouring ribbons shine (sec_15.jpg!)
      delhiCrowd.mesh.visible = true;
      delhiCrowd.uniforms.uScalePillar.value = 1.0;
      worldCrowd.mesh.visible = false;
      tray64.setOpacity(0);
      anchors.showDelhiLabel = t < 15.42;

      const moveIn  = eio(seg(t, 12.20, 13.15));
      const tiltU   = ss(seg(t, 12.45, 13.35)) * (1 - ss(seg(t, 14.90, 15.35)) * 0.45);
      const pourU   = ss(seg(t, 12.55, 14.98));
      const fadeOut = 1.0 - ss(seg(t, 14.88, 15.32));

      // Start centered behind Delhi (-Z), then slide to West/NW of Delhi (-X) and roll -Z (-27 deg) so +X right edge pours into Delhi!
      const tx = lerp(dcx - 2.0, dcx - 18.5, moveIn);
      const ty = lerp(11.0, 15.8, moveIn) + (1 - fadeOut) * 4.5;
      const tz = lerp(dcz - 36.0, dcz - 3.0, moveIn);
      const rollZ  = -tiltU * 0.46; // tilts +X lip downward while keeping TOP of white sheet facing camera!
      const pitchX = tiltU * 0.14;
      const yawY   = lerp(0.0, -0.22, moveIn);

      tray27.group.position.set(tx, ty, tz);
      tray27.group.rotation.set(pitchX, yawY, rollZ, 'YXZ');
      tray27.group.scale.set(27.05, 27.05, 27.05);
      tray27.group.updateMatrixWorld(true);
      tray27.setOpacity(fadeOut);

      delhiCrowd.uniforms.uPour.value = pourU;
      delhiCrowd.uniforms.uTrayMatrix.value.copy(tray27.group.matrixWorld);
      delhiCrowd.uniforms.uSlideAmt.value = tiltU;

      if (t < 12.35) {
        anchors.showTray27Label = true;
        anchors.tray27Edge.set(tx, ty, tz + 15.5);
      }

      anchors.delhiLabel.set(dcx + 15.5, 2.2, dcz - 15.0);

      // Camera frames both hovering 27km square & entire OSM Delhi cleanly inside 1080x1920, then pushes in gently during pour
      const settle   = eo(seg(t, 10.22, 10.85));
      const pushPour = eio(seg(t, 12.20, 14.85));
      const climbOut = Math.pow(seg(t, 15.32, 15.62), 2.6);
      camera.position.set(
        dcx + lerp(16.0, 4.0, pushPour),
        lerp(122, 104, settle) - pushPour * 18.0 + climbOut * 520.0,
        dcz + lerp(152, 138, settle) - pushPour * 22.0 + climbOut * 160.0
      );
      camera.lookAt(dcx - lerp(0.0, 2.5, pushPour), 0, lerp(dcz - 16.0, dcz - 3.0, pushPour));
      setFogDensity(lerp(0.00175, 0.00205, pushPour) * (1 - climbOut * 0.75));
    } else {
      // S6b & S7 (24.05 -> 37.50s):
      // 1) 64km square over Delhi with dashed OSM Delhi outline (sec_26.jpg)
      // 2) 1,118 km flight east along Himalayas to Sikkim (sec_30.jpg)
      // 3) Tilts +X right lip into Sikkim 58% full while top face stays visible (sec_34.jpg!)
      // 4) Smoothly returns west to exact LOOP_CAM_POS over half-filled Delhi for seamless Frame-0 loop!
      tray27.setOpacity(0);

      const growU  = eo(seg(t, 24.12, 24.95));
      const flyE   = eio(seg(t, 27.38, 29.85));
      const movePourS = eio(seg(t, 30.85, 31.65));
      const tiltS  = ss(seg(t, 31.05, 31.85)) * (1 - ss(seg(t, 33.70, 34.18)) * 0.45);
      const pourS  = ss(seg(t, 31.12, 33.80));
      const fade64 = 1.0 - ss(seg(t, 33.68, 34.15));
      const flyW   = eio(seg(t, 34.30, 37.22));

      delhiCrowd.mesh.visible = t >= 28.50;
      delhiCrowd.uniforms.uPour.value = 1.0;
      delhiCrowd.uniforms.uScalePillar.value = 1.0;

      worldCrowd.mesh.visible = t < 36.60;
      const curSize = lerp(28.0, 64.15, growU);

      const arcLift = Math.sin(flyE * Math.PI) * 36.0;
      const tx = lerp(dcx - 0.5, scx - 5.0, flyE) - movePourS * 16.0;
      const ty = lerp(4.2, 16.0, flyE) + arcLift + movePourS * 7.5 + (1 - fade64) * 5.0;
      const tz = lerp(dcz + 1.0, scz + 14.0, flyE) + movePourS * 4.0;
      // Roll -Z (-25 deg) + slight pitch so top face of 64km white sheet faces camera while crowd cascades right into Sikkim (sec_34.jpg!)
      const rollZ  = -tiltS * 0.44;
      const pitchX = tiltS * 0.12;
      const yawY   = lerp(0.06, -0.06, flyE) - movePourS * 0.16;

      tray64.group.position.set(tx, ty, tz);
      tray64.group.rotation.set(pitchX, yawY, rollZ, 'YXZ');
      tray64.group.scale.set(curSize, curSize, curSize);
      tray64.group.updateMatrixWorld(true);
      tray64.setOpacity(fade64);

      worldCrowd.uniforms.uPour.value = pourS;
      worldCrowd.uniforms.uTrayMatrix.value.copy(tray64.group.matrixWorld);
      worldCrowd.uniforms.uSlideAmt.value = tiltS;
      worldCrowd.uniforms.uScalePillar.value = lerp(0.85, 1.15, flyE);

      if (t >= 24.45 && t < 27.45) {
        delhiDashed.visible = true;
        anchors.showDelhiLabel = true;
        anchors.delhiLabel.set(dcx + 2.5, 6.2, dcz - 23.5);
        anchors.showTray64Label = true;
        anchors.tray64Edge.set(tx, ty, tz + curSize * 0.54);
      }

      if (t >= 29.40 && t < 35.10) {
        anchors.showSikkimLabel = true;
      }

      if (t >= 36.85) {
        anchors.showDelhiLabel = true;
        anchors.delhiLabel.set(dcx + 3.5, 2.2, dcz - 23.5);
      }

      const diveIn = eo(seg(t, 24.12, 24.55));
      // Full 64.15km square fits comfortably inside 1080px width (sec_26.jpg)
      const d64Cam  = new THREE.Vector3(dcx, lerp(240, 126, diveIn), dcz + lerp(195, 168, diveIn));
      const d64Look = new THREE.Vector3(dcx, 0, dcz + 8.5);
      // Full 89.7km wide OSM Sikkim + snow-capped Kangchenjunga/Himalayas in background (sec_30.jpg & sec_34.jpg!)
      const sikCam  = new THREE.Vector3(scx - 4.0, 148.0, scz + 206.0);
      const sikLook = new THREE.Vector3(scx, 0.0, scz - 12.0);

      const curCam = d64Cam.clone().lerp(sikCam, flyE);
      const curLook = d64Look.clone().lerp(sikLook, flyE);
      curCam.y += Math.sin(flyE * Math.PI) * 105.0;
      curCam.z += Math.sin(flyE * Math.PI) * 40.0;

      if (t >= 34.25) {
        curCam.lerp(LOOP_CAM_POS, flyW);
        curLook.lerp(LOOP_CAM_LOOK, flyW);
        curCam.y += Math.sin(flyW * Math.PI) * 120.0;
        curCam.z += Math.sin(flyW * Math.PI) * 35.0;
      }

      camera.position.copy(curCam);
      camera.lookAt(curLook);
      // Crisp view of Himalayan snow peaks at Sikkim, aerial haze at Delhi
      const sikBlend = flyE * (1.0 - flyW);
      setFogDensity(lerp(0.00205, 0.00072, sikBlend));
    }

    camera.updateMatrixWorld();
  }

  return { scene, camera, anchors, update };
}

// Bold Outlined Typography on 2D Overlay Canvas (matching Paper Files typography)
function drawStrokedText(ctx, text, x, y, {
  size = 64,
  fill = '#FFE047',
  stroke = '#000000',
  strokeWidth = 12,
  shadowOffset = 5,
  scale = 1.0,
  alpha = 1.0,
  align = 'center'
} = {}) {
  if (!text || alpha <= 0.01) return null;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y);
  if (scale !== 1.0) ctx.scale(scale, scale);
  ctx.font = `900 ${size}px "InterDisplay", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  ctx.strokeStyle = 'rgba(0,0,0,0.88)';
  ctx.lineWidth = strokeWidth;
  ctx.strokeText(text, 0, shadowOffset);
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillText(text, 0, shadowOffset);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);

  const m = ctx.measureText(text);
  const w = m.width * scale;
  const h = size * 1.15 * scale;
  ctx.restore();

  const x0 = align === 'center' ? x - w / 2 : align === 'left' ? x : x - w;
  return { x0: Math.round(x0), y0: Math.round(y - h / 2), x1: Math.round(x0 + w), y1: Math.round(y + h / 2) };
}

function projectToScreen(vec3, camera, W, H) {
  const v = vec3.clone().project(camera);
  if (v.z > 1.0) return null;
  return {
    x: (v.x * 0.5 + 0.5) * W,
    y: (-v.y * 0.5 + 0.5) * H,
  };
}

export async function createFilm(glCanvas, uiCanvas) {
  const W = glCanvas.width, H = glCanvas.height;
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const ctx = uiCanvas.getContext('2d');

  const font900 = new FontFace('InterDisplay', 'url(./fonts/Inter-900.woff2)', { weight: '900' });
  const loader = new THREE.TextureLoader();
  const loadTex = (url, srgb = true) => new Promise((res, rej) => loader.load(url, t => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    res(t);
  }, undefined, rej));

  const [loadedFont, dayTex, nightTex, indiaMaskTex, regTex, sceneGeo, targetsBuf, wordCues] = await Promise.all([
    font900.load(),
    loadTex('./assets/earth_day_4k.jpg', true),
    loadTex('./assets/earth_night_4k.jpg', true),
    loadTex('./assets/india_mask_4k.png', false),
    loadTex('./assets/region_terrain_4k.jpg', false),
    fetch('./assets/scene_geo.json').then(r => r.json()),
    fetch('./assets/crowd_targets.bin').then(r => r.arrayBuffer()),
    fetch('./assets/word_cues.json').then(r => r.json()),
  ]);
  document.fonts.add(loadedFont);
  await document.fonts.ready;

  const globeStage   = buildGlobeStage(dayTex, nightTex, indiaMaskTex, sceneGeo.indiaBorder, sceneGeo.coastlines);
  const concertStage = buildConcertStage();
  const basinStage   = buildBasinStage(regTex, sceneGeo, targetsBuf);

  let lastTexts = [];

  function renderFrame(rawT) {
    const t = (rawT >= DUR) ? 0.0 : clamp(rawT, 0, DUR);
    lastTexts = [];

    let activeStage = 'basin';
    if ((t >= 3.18 && t < 6.18) || (t >= 15.62 && t < 24.12)) activeStage = 'globe';
    else if (t >= 6.18 && t < 10.22) activeStage = 'concert';

    let activeCam;
    if (activeStage === 'globe') {
      globeStage.update(t);
      renderer.render(globeStage.scene, globeStage.camera);
      activeCam = globeStage.camera;
    } else if (activeStage === 'concert') {
      concertStage.update(t);
      renderer.render(concertStage.scene, concertStage.camera);
      activeCam = concertStage.camera;
    } else {
      basinStage.update(t);
      renderer.render(basinStage.scene, basinStage.camera);
      activeCam = basinStage.camera;
    }

    ctx.clearRect(0, 0, W, H);

    // Smooth altitude cloud veil on scale-regime dives/climbs
    const mistTimes = [3.18, 6.18, 10.22, 15.62, 24.12];
    for (const mt of mistTimes) {
      const d = Math.abs(t - mt);
      if (d < 0.16) {
        const a = Math.pow(1 - d / 0.16, 2.0) * 0.45;
        ctx.fillStyle = mt === 6.18 ? `rgba(255, 232, 165, ${a})` : `rgba(145, 175, 195, ${a})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Subtle top/bottom vignette for high-contrast caption legibility
    const gradTop = ctx.createLinearGradient(0, 0, 0, 380);
    gradTop.addColorStop(0, 'rgba(0,0,0,0.28)');
    gradTop.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, W, 380);

    const gradBot = ctx.createLinearGradient(0, H - 500, 0, H);
    gradBot.addColorStop(0, 'rgba(0,0,0,0)');
    gradBot.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = gradBot;
    ctx.fillRect(0, H - 500, W, 500);

    // 1. World-pinned 3D Labels
    if (activeStage === 'basin') {
      const A = basinStage.anchors;
      if (A.showDelhiLabel) {
        const p = projectToScreen(A.delhiLabel, activeCam, W, H);
        if (p) drawStrokedText(ctx, 'DELHI', clamp(p.x, 120, W - 120), p.y, { size: 46, fill: '#FFFFFF', strokeWidth: 11, shadowOffset: 4 });
      }
      if (A.showSikkimLabel) {
        const p = projectToScreen(A.sikkimLabel, activeCam, W, H);
        if (p) drawStrokedText(ctx, 'SIKKIM', clamp(p.x, 130, W - 130), p.y - 8, { size: 48, fill: '#FFFFFF', strokeWidth: 11, shadowOffset: 4 });
      }
      if (A.showTray27Label) {
        const p = projectToScreen(A.tray27Edge, activeCam, W, H);
        if (p) drawStrokedText(ctx, '27 KM', p.x, p.y + 26, { size: 44, fill: '#FFE047', strokeWidth: 10, shadowOffset: 4 });
      }
      if (A.showTray64Label) {
        const p = projectToScreen(A.tray64Edge, activeCam, W, H);
        if (p) drawStrokedText(ctx, '64 KM', p.x, p.y + 28, { size: 46, fill: '#FFE047', strokeWidth: 11, shadowOffset: 4 });
      }
    } else if (activeStage === 'concert') {
      const fade1m = 1.0 - ss(seg(t, 8.35, 9.20));
      if (fade1m > 0.02) {
        const pLeft = projectToScreen(new THREE.Vector3(-0.66, 0.02, 0.04), activeCam, W, H);
        const pTop  = projectToScreen(new THREE.Vector3(0.0, 0.02, -0.64), activeCam, W, H);
        if (pLeft) drawStrokedText(ctx, '1 M', pLeft.x, pLeft.y, { size: 36, fill: '#FFE047', strokeWidth: 9, alpha: fade1m });
        if (pTop)  drawStrokedText(ctx, '1 M', pTop.x,  pTop.y,  { size: 36, fill: '#FFE047', strokeWidth: 9, alpha: fade1m });
      }
    } else if (activeStage === 'globe' && t >= 15.85 && t < 20.55) {
      const R = globeStage.R;
      const pDelhi = projectToScreen(latLonToVec3(28.65, 77.12, R * 1.005), activeCam, W, H);
      const aHere = ss(seg(t, 16.15, 16.50)) * (1 - ss(seg(t, 20.25, 20.55)));
      if (pDelhi && aHere > 0.02) {
        const box = drawStrokedText(ctx, '146 CRORE HERE', clamp(pDelhi.x - 10, 240, W - 240), pDelhi.y - 115, {
          size: 46, fill: '#FFE047', strokeWidth: 11, alpha: aHere
        });
        if (box) lastTexts.push({ id: 'lbl_146here', text: '146 CRORE HERE', ...box, pass: true });
      }

      const zeroCities = [
        { id: 'c_mum', label: 'MUMBAI: 0',  lat: 19.08, lon: 72.88, tIn: 17.75, dx:   4, dy: -38 },
        { id: 'c_kol', label: 'KOLKATA: 0', lat: 22.57, lon: 88.36, tIn: 18.31, dx: -32, dy:  40 },
        { id: 'c_che', label: 'CHENNAI: 0', lat: 13.08, lon: 80.27, tIn: 18.93, dx: 118, dy:   6 },
      ];
      for (const c of zeroCities) {
        if (t >= c.tIn) {
          const popS = spring(Math.min(1, (t - c.tIn) * 4.0), 8, 0.45);
          const fadeOut = 1 - ss(seg(t, 20.25, 20.55));
          const pt = projectToScreen(latLonToVec3(c.lat, c.lon, R * 1.004), activeCam, W, H);
          if (pt && fadeOut > 0.02) {
            ctx.save();
            ctx.globalAlpha = fadeOut;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 10 * popS, 0, Math.PI * 2);
            ctx.fillStyle = '#FF3328';
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
            ctx.restore();
            const tx = clamp(pt.x + c.dx, 175, W - 175);
            drawStrokedText(ctx, c.label, tx, pt.y + c.dy, {
              size: 38, fill: '#FFFFFF', strokeWidth: 9, scale: popS, alpha: fadeOut
            });
          }
        }
      }
    }

    // 2. Top Yellow HUD Banner (y = 335px = 17.4% of 1920, matching Paper Files!)
    for (const cue of HUD_CUES) {
      if (t >= cue.t0 && t <= cue.t1) {
        const isLoopStart = cue.id === 'hud_crore' && t < 0.25;
        const isLoopEnd   = cue.id === 'hud_crore_loop';
        const fi = isLoopStart ? 1.0 : ss(seg(t, cue.t0, cue.t0 + 0.16));
        const fo = isLoopEnd   ? 1.0 : 1.0 - ss(seg(t, cue.t1 - 0.18, cue.t1));
        const alpha = Math.min(fi, fo);
        const box = drawStrokedText(ctx, cue.text, W * 0.5, 335, {
          size: 64,
          fill: '#FFE047',
          strokeWidth: 14,
          shadowOffset: 5,
          alpha,
        });
        if (box && !isLoopEnd) {
          lastTexts.push({ id: cue.id, text: cue.text, x0: 100, y0: 290, x1: 980, y1: 380 });
        }
        break;
      }
    }

    // 3. Word-by-Word Pop Karaoke Caption (y = 1300px = 67.7% of 1920, matching Paper Files!)
    let activeWord = null;
    for (let i = wordCues.length - 1; i >= 0; i--) {
      const wc = wordCues[i];
      if (t >= wc.t0 && t <= wc.t1) { activeWord = wc; break; }
    }
    if (activeWord) {
      const dt = t - activeWord.t0;
      const popScale = 1.0 + 0.08 * Math.exp(-dt * 24.0);
      const fontSize = activeWord.w.length > 10 ? 74 : 88;
      const wordY = (activeStage === 'globe' && t >= 15.85 && t < 20.55) ? 1365 : 1310;
      drawStrokedText(ctx, activeWord.w, W * 0.5, wordY, {
        size: fontSize,
        fill: activeWord.yellow ? '#FFE047' : '#FFFFFF',
        strokeWidth: 16,
        shadowOffset: 6,
        scale: popScale,
        alpha: 1.0,
      });
    }
  }

  return {
    render: renderFrame,
    getTexts(t) {
      renderFrame(t);
      return lastTexts;
    }
  };
}
