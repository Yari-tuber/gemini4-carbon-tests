import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const W = 1920;
const H = 1080;
const DURATION = 15.0;

const params = new URLSearchParams(window.location.search);
const IS_RENDER = params.get('render') === '1';

const stageEl = document.getElementById('stage');
const canvas = document.getElementById('gl-canvas');
const playerUi = document.getElementById('player-ui');
if (IS_RENDER) {
  playerUi.classList.add('render-hidden');
}

function fitViewport() {
  if (IS_RENDER) {
    stageEl.style.transform = 'none';
    return;
  }
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stageEl.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fitViewport);
fitViewport();

// ============================================================================
// Mathematical & Easing Utilities (100% Deterministic Functions of Time `t`)
// ============================================================================
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const saturate = (x) => Math.max(0.0, Math.min(1.0, x));
const lerp = (a, b, u) => a + (b - a) * u;
const norm = (t, t0, t1) => saturate((t - t0) / Math.max(1e-6, t1 - t0));

function smoothstep(t0, t1, t) {
  const u = norm(t, t0, t1);
  return u * u * (3.0 - 2.0 * u);
}

function smootherstep(t0, t1, t) {
  const u = norm(t, t0, t1);
  return u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
}

function easeOutExpo(u) {
  const x = saturate(u);
  return x >= 0.9999 ? 1.0 : 1.0 - Math.pow(2.0, -10.0 * x);
}

function easeOutQuint(u) {
  const x = saturate(u);
  return 1.0 - Math.pow(1.0 - x, 5.0);
}

function easeInOutQuint(u) {
  const x = saturate(u);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

// Deterministic pseudo-random PRNG (Mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// WebGL2 Renderer + Custom Studio HDRI + Post-Processing Pipeline
// ============================================================================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, W / H, 0.08, 80.0);

// Build Custom Softbox Photography Light-Tent Environment Map
function createStudioEnvironment(rendererInst) {
  const pmrem = new THREE.PMREMGenerator(rendererInst);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x090b10);

  const addPanel = (w, h, colorHex, intensity, pos, lookAtPos) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos);
    m.lookAt(lookAtPos);
    envScene.add(m);
  };

  const zero = new THREE.Vector3(0, 0, 0);
  // Overhead warm-champagne main studio softbox
  addPanel(16, 10, 0xfff3df, 3.6, new THREE.Vector3(0, 11, 2), zero);
  // Left cool-slate architectural rim strip
  addPanel(8, 14, 0x89a6d6, 2.2, new THREE.Vector3(-12, 3, -2), zero);
  // Right warm-brass specular kicker strip
  addPanel(7, 13, 0xe8be82, 2.8, new THREE.Vector3(12, 2, 3), zero);
  // High front-top fill strip for crisp glass & chrome edges
  addPanel(14, 3, 0xffffff, 2.5, new THREE.Vector3(0, 6, 12), zero);
  // Subtle warm floor bounce
  addPanel(18, 18, 0x262019, 1.1, new THREE.Vector3(0, -10, 0), zero);

  const rt = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return rt.texture;
}

const studioEnv = createStudioEnvironment(renderer);
scene.environment = studioEnv;
scene.environmentIntensity = 1.15;

// Post-Processing Composer (4x MSAA HDR HalfFloat RenderTarget)
const msaaTarget = new THREE.WebGLRenderTarget(W, H, {
  type: THREE.HalfFloatType,
  samples: 4,
});
const composer = new EffectComposer(renderer, msaaTarget);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.28, 0.72, 0.82);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Custom Cinema Optics Pass (Subtle Edge Chromatic Dispersion + Vignette + 35mm Grain)
const FilmOpticsShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uVignette: { value: 0.28 },
    uDispersion: { value: 0.0011 },
    uGrain: { value: 0.020 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uDispersion;
    uniform float uGrain;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // Subtle lateral optical dispersion only toward frame corners
      vec2 shift = centered * r2 * uDispersion * 3.2;
      float cr = texture2D(tDiffuse, clamp(vUv + shift, 0.001, 0.999)).r;
      float cg = texture2D(tDiffuse, vUv).g;
      float cb = texture2D(tDiffuse, clamp(vUv - shift, 0.001, 0.999)).b;
      vec3 col = vec3(cr, cg, cb);

      // Natural cosine^4 cinema lens vignette
      float vig = 1.0 - r2 * uVignette * 2.1;
      col *= clamp(vig, 0.0, 1.0);

      // Fine deterministic 35mm film grain (eliminates 8-bit banding)
      float frameSeed = floor(uTime * 60.0 + 0.5) * 0.173;
      float g = hash12(vUv * vec2(1920.0, 1080.0) + frameSeed) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
const opticsPass = new ShaderPass(FilmOpticsShader);
composer.addPass(opticsPass);

// ============================================================================
// Master Studio Lighting Rig (Dynamically Modulated per Act)
// ============================================================================
const keyLight = new THREE.DirectionalLight(0xfff4e2, 2.4);
keyLight.position.set(4.5, 7.5, 5.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 24.0;
keyLight.shadow.camera.left = -6.0;
keyLight.shadow.camera.right = 6.0;
keyLight.shadow.camera.top = 6.0;
keyLight.shadow.camera.bottom = -6.0;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.radius = 3.5;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x9cb8e8, 1.6);
rimLight.position.set(-6.0, 3.2, -4.5);
scene.add(rimLight);

const warmFill = new THREE.PointLight(0xeac891, 2.2, 16.0, 1.6);
warmFill.position.set(1.6, -0.5, 2.8);
scene.add(warmFill);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);

// ============================================================================
// ACT I (0.00s - 3.60s): GRAVITY & ZERO-G AWAKENING
// ============================================================================
const groupAct1 = new THREE.Group();
scene.add(groupAct1);

const MONO_X = 1.58;

// Custom GLSL Obsidian Mirror Horizon & Inversion Shockwave Plane (Seamless Additive Glow — Zero Plane Edge!)
const act1FloorMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0.0 },
    uShock: { value: 0.0 },
    uHorizon: { value: 1.0 },
    uCenter: { value: new THREE.Vector2(MONO_X, 0.0) },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorldPos;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uShock;
    uniform float uHorizon;
    uniform vec2 uCenter;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vec2 p = vWorldPos.xz - uCenter;
      float dist = length(p);

      // Smooth fade at far z, near z, and x edges so there is NEVER a visible polygon boundary
      float edgeMask = smoothstep(-7.6, -4.6, vWorldPos.z)
                     * smoothstep(7.5, 2.5, vWorldPos.z)
                     * smoothstep(14.0, 5.0, abs(vWorldPos.x));

      // Distant razor-thin champagne horizon glow reflected on wet obsidian
      float horizonDist = abs(vWorldPos.z + 5.6);
      float horizonLine = (exp(-horizonDist * 3.8) * 0.28 + exp(-horizonDist * 0.65) * 0.045) * uHorizon;
      vec3 champagne = vec3(0.96, 0.84, 0.65);

      // Warm specular pool directly beneath the levitating monolith
      float corePool = exp(-dist * dist * 0.45) * (0.06 + 0.19 * smoothstep(0.82, 1.6, uTime));

      // Concentric antigravity shockwave ring expanding from t = 0.85s
      float ringRadius = uShock * 7.2;
      float ringWave = exp(-pow(dist - ringRadius, 2.0) * 14.0) * (1.0 - smoothstep(0.55, 1.0, uShock)) * smoothstep(0.0, 0.06, uShock);
      float ripple2 = sin((dist - ringRadius) * 18.0) * exp(-pow(dist - ringRadius, 2.0) * 5.0) * (1.0 - uShock) * 0.06 * step(0.001, uShock);

      // Subtle architectural grid lines in obsidian reflection
      vec2 grid = abs(fract(vWorldPos.xz * 0.75 - 0.5) - 0.5) / fwidth(vWorldPos.xz * 0.75);
      float gridLine = 1.0 - min(min(grid.x, grid.y), 1.0);
      float gridFade = exp(-length(vWorldPos.xz) * 0.22) * 0.022;

      vec3 glow = champagne * (horizonLine + corePool + ringWave * 0.72 + max(0.0, ripple2))
                + vec3(0.65, 0.74, 0.90) * gridLine * gridFade;

      gl_FragColor = vec4(glow * edgeMask, 1.0);
    }
  `,
});
const act1Floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), act1FloorMat);
act1Floor.rotation.x = -Math.PI / 2;
act1Floor.position.set(0, -1.68, -1.5);
groupAct1.add(act1Floor);

// Distant Horizon Light Slit Quad
const horizonSlitMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uIntensity: { value: 1.0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      float vy = abs(vUv.y - 0.5) * 2.0;
      float core = exp(-vy * 28.0) * 0.95 + exp(-vy * 5.5) * 0.22;
      float hx = sin(vUv.x * 3.14159265);
      hx = pow(max(0.0, hx), 1.6);
      vec3 col = mix(vec3(0.72, 0.80, 0.96), vec3(0.98, 0.87, 0.68), 0.78);
      gl_FragColor = vec4(col * core * hx * uIntensity, 1.0);
    }
  `,
});
const horizonSlit = new THREE.Mesh(new THREE.PlaneGeometry(24, 1.35), horizonSlitMat);
horizonSlit.position.set(0.6, -1.60, -7.2);
groupAct1.add(horizonSlit);

// Fractured Obsidian Geode Monolith Assembly
const monolithRoot = new THREE.Group();
monolithRoot.position.set(MONO_X, -0.35, 0.0);
groupAct1.add(monolithRoot);

// Incandescent Warm Champagne Inner Core
const geodeCoreMat = new THREE.MeshStandardMaterial({
  color: 0xfff0d4,
  emissive: 0xf4c987,
  emissiveIntensity: 0.2,
  roughness: 0.18,
  metalness: 0.2,
});
const geodeCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 4), geodeCoreMat);
monolithRoot.add(geodeCore);

// Delicate Gold Inner Orbital Rings inside the Geode
const innerRingMat = new THREE.MeshStandardMaterial({
  color: 0xe6cb9c,
  emissive: 0xd9b477,
  emissiveIntensity: 0.35,
  metalness: 0.92,
  roughness: 0.16,
});
const innerRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.008, 16, 128), innerRingMat);
const innerRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.006, 16, 128), innerRingMat);
monolithRoot.add(innerRing1, innerRing2);

// 26 Tectonic Obsidian & Brushed-Titanium Faceted Shell Plates
const obsidianPlateMat = new THREE.MeshPhysicalMaterial({
  color: 0x11131a,
  metalness: 0.84,
  roughness: 0.20,
  clearcoat: 0.92,
  clearcoatRoughness: 0.14,
  reflectivity: 1.0,
});
const goldTrimMat = new THREE.MeshPhysicalMaterial({
  color: 0xd7b988,
  metalness: 0.94,
  roughness: 0.18,
  clearcoat: 0.6,
});

const rng1 = mulberry32(10801);
const shellPlates = [];
const NUM_PLATES = 26;
for (let i = 0; i < NUM_PLATES; i++) {
  // Fibonacci sphere distribution around the geode
  const y = 1 - (i / (NUM_PLATES - 1)) * 2;
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.39996323;
  const dir = new THREE.Vector3(Math.cos(theta) * radiusAtY, y, Math.sin(theta) * radiusAtY).normalize();

  const holder = new THREE.Group();
  const sides = 5 + (i % 3);
  const rOuter = 0.30 + rng1() * 0.13;
  const thickness = 0.16 + rng1() * 0.09;
  const geo = new THREE.CylinderGeometry(rOuter * 0.76, rOuter, thickness, sides, 1);
  geo.rotateX(Math.PI / 2);

  const mesh = new THREE.Mesh(geo, obsidianPlateMat);
  // Subtle brushed gold inner backing plate
  const innerGeo = new THREE.CylinderGeometry(rOuter * 0.70, rOuter * 0.72, 0.02, sides, 1);
  innerGeo.rotateX(Math.PI / 2);
  const innerMesh = new THREE.Mesh(innerGeo, goldTrimMat);
  innerMesh.position.z = -thickness * 0.51;
  holder.add(mesh, innerMesh);

  holder.lookAt(dir);
  monolithRoot.add(holder);

  shellPlates.push({
    holder,
    dir,
    baseRadius: 0.66 + rng1() * 0.06,
    driftRadius: 0.44 + rng1() * 0.48,
    rotAxis: new THREE.Vector3(rng1() - 0.5, rng1() - 0.5, rng1() - 0.5).normalize(),
    rotSpeed: (rng1() * 0.7 + 0.25) * (i % 2 === 0 ? 1 : -1),
    delay: rng1() * 0.18,
  });
}

// 92 Zero-Gravity Liquid-Mercury & Champagne-Pearl Rising Droplets
const mercuryMat = new THREE.MeshPhysicalMaterial({
  color: 0xf4f1ea,
  metalness: 1.0,
  roughness: 0.035,
  clearcoat: 1.0,
});
const pearlGoldMat = new THREE.MeshPhysicalMaterial({
  color: 0xe8cfa2,
  metalness: 0.95,
  roughness: 0.08,
  clearcoat: 1.0,
});

const dropletGeo = new THREE.SphereGeometry(1.0, 24, 24);
const droplets = [];
for (let i = 0; i < 92; i++) {
  const isGold = i % 3 === 0;
  const m = new THREE.Mesh(dropletGeo, isGold ? pearlGoldMat : mercuryMat);
  const rad = 0.014 + Math.pow(rng1(), 2.2) * 0.062;
  m.scale.setScalar(rad);

  const angle = rng1() * Math.PI * 2;
  const dist = 0.35 + Math.pow(rng1(), 0.75) * 3.1;
  const x0 = MONO_X + Math.cos(angle) * dist - (i > 70 ? 1.8 : 0.0);
  const z0 = Math.sin(angle) * dist * 0.85 - 0.3;
  const yFloor = -1.66 + rad;
  const riseSpeed = 0.42 + rng1() * 0.95;
  const delay = dist * 0.075 + rng1() * 0.22;
  const swirl = (rng1() - 0.5) * 0.45;

  groupAct1.add(m);
  droplets.push({ m, rad, x0, z0, yFloor, riseSpeed, delay, swirl, phase: rng1() * 6.28 });
}

// ============================================================================
// ACT II (3.60s - 7.40s): SUNLIT ALABASTER STUDIO — REASONING & ARCHITECTURE
// ============================================================================
const groupAct2 = new THREE.Group();
scene.add(groupAct2);

const ASTRO_CENTER = new THREE.Vector3(1.66, 0.04, 0.0);

// Matte Architectural Alabaster Studio Backdrop Cyclorama (catches soft studio shadows)
const alabasterWallMat = new THREE.MeshStandardMaterial({
  color: 0xede7dc,
  roughness: 0.92,
  metalness: 0.0,
});
const alabasterBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(32, 18), alabasterWallMat);
alabasterBackdrop.position.set(0, 0, -3.4);
alabasterBackdrop.receiveShadow = true;
groupAct2.add(alabasterBackdrop);

const alabasterRoot = new THREE.Group();
alabasterRoot.position.copy(ASTRO_CENTER);
groupAct2.add(alabasterRoot);

// Precision Materials for Act II
const charcoalArchMat = new THREE.MeshPhysicalMaterial({
  color: 0x17191f,
  metalness: 0.55,
  roughness: 0.28,
  clearcoat: 0.45,
  clearcoatRoughness: 0.25,
});
const warmBrassMat = new THREE.MeshPhysicalMaterial({
  color: 0xb08b54,
  metalness: 0.90,
  roughness: 0.22,
  clearcoat: 0.5,
});
const smokedQuartzMat = new THREE.MeshPhysicalMaterial({
  color: 0xd9d4ca,
  metalness: 0.05,
  roughness: 0.08,
  transmission: 0.82,
  thickness: 0.55,
  ior: 1.52,
  clearcoat: 1.0,
});

// 3 Concentric Precision Gimbal Rings
const gimbalRings = [];
[
  { r: 1.66, tube: 0.013, mat: charcoalArchMat, startEuler: [1.2, 0.8, -0.6], endEuler: [0.32, 0.45, 0.0] },
  { r: 1.36, tube: 0.011, mat: warmBrassMat, startEuler: [-1.1, 1.4, 0.9], endEuler: [-0.42, 0.22, Math.PI / 4] },
  { r: 1.05, tube: 0.010, mat: charcoalArchMat, startEuler: [0.7, -1.3, 1.1], endEuler: [Math.PI / 2 - 0.28, 0.0, -0.35] },
].forEach((cfg, idx) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, cfg.tube, 20, 160), cfg.mat);
  ring.castShadow = true;
  // Add 4 tiny precision vernier tick blocks on each ring
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.024, 0.024), idx === 1 ? charcoalArchMat : warmBrassMat);
    tick.position.set(Math.cos(a) * cfg.r, Math.sin(a) * cfg.r, 0);
    tick.rotation.z = a;
    ring.add(tick);
  }
  alabasterRoot.add(ring);
  gimbalRings.push({ ring, cfg });
});

// Central Smoked-Obsidian Optical Aperture (Portal into Act III!)
const apertureGroup = new THREE.Group();
alabasterRoot.add(apertureGroup);

const bezelOuter = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.028, 24, 128), warmBrassMat);
bezelOuter.castShadow = true;
const bezelInner = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.018, 20, 128), charcoalArchMat);
// Pure velvet-obsidian optical lens core
const portalLensMat = new THREE.MeshPhysicalMaterial({
  color: 0x050609,
  metalness: 0.15,
  roughness: 0.06,
  clearcoat: 1.0,
  clearcoatRoughness: 0.04,
});
const portalDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 96), portalLensMat);
portalDisc.rotation.x = Math.PI / 2;
apertureGroup.add(bezelOuter, bezelInner, portalDisc);

// 36 Modular Architectural Blocks Snapping from Chaos into Sacred Crystalline Lattice
const rng2 = mulberry32(20402);
const archModules = [];
const latticeTargets = [];

// Construct a clean 36-node symmetrical architectural polyhedral cage around radius 0.82 .. 1.48
for (let ringIdx = 0; ringIdx < 3; ringIdx++) {
  const count = 12;
  const rad = 0.80 + ringIdx * 0.31;
  const zOff = (ringIdx - 1) * 0.34;
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * Math.PI * 2 + ringIdx * (Math.PI / 12);
    latticeTargets.push({
      pos: new THREE.Vector3(Math.cos(ang) * rad, Math.sin(ang) * rad, zOff),
      rotZ: ang,
      ringIdx,
      k,
    });
  }
}

latticeTargets.forEach((lt, i) => {
  const cohort = i % 4; // 0: PERCEIVE (4.1s), 1: REASON (4.7s), 2: ARCHITECT (5.3s), 3: VERIFY (5.9s)
  let geo;
  let mat;
  if (i % 3 === 0) {
    geo = new THREE.BoxGeometry(0.20, 0.065, 0.085);
    mat = charcoalArchMat;
  } else if (i % 3 === 1) {
    geo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    mat = smokedQuartzMat;
  } else {
    geo = new THREE.OctahedronGeometry(0.082, 0);
    mat = warmBrassMat;
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  alabasterRoot.add(mesh);

  // Chaotic initial dispersed position
  const chaosDir = new THREE.Vector3(rng2() - 0.5, rng2() - 0.5, (rng2() - 0.5) * 0.8).normalize();
  const chaosDist = 2.0 + rng2() * 1.65;
  const startPos = chaosDir.multiplyScalar(chaosDist);
  const startRot = new THREE.Euler(rng2() * 5, rng2() * 5, rng2() * 5);
  const endRot = new THREE.Euler(0, 0, lt.rotZ);

  archModules.push({
    mesh,
    cohort,
    startPos,
    targetPos: lt.pos,
    startRot,
    endRot,
    lockTime: 4.10 + cohort * 0.60,
    jitterSeed: rng2() * 10.0,
  });
});

// Fine Connecting Wireframe Struts (appear smoothly as verification completes)
const strutPositions = [];
for (let i = 0; i < 12; i++) {
  const a = latticeTargets[i].pos;
  const b = latticeTargets[i + 12].pos;
  const c = latticeTargets[i + 24].pos;
  const nextA = latticeTargets[(i + 1) % 12].pos;
  strutPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  strutPositions.push(b.x, b.y, b.z, c.x, c.y, c.z);
  strutPositions.push(a.x, a.y, a.z, nextA.x, nextA.y, nextA.z);
}
const strutGeo = new THREE.BufferGeometry();
strutGeo.setAttribute('position', new THREE.Float32BufferAttribute(strutPositions, 3));
const strutMat = new THREE.LineBasicMaterial({
  color: 0x8a683b,
  transparent: true,
  opacity: 0.0,
});
const latticeStruts = new THREE.LineSegments(strutGeo, strutMat);
alabasterRoot.add(latticeStruts);

// ============================================================================
// ACT III (7.40s - 11.20s): SYMBIOSIS & TASTE — IRIDESCENT HARMONIC RIBBON
// ============================================================================
const groupAct3 = new THREE.Group();
scene.add(groupAct3);

const RIBBON_X = -1.72;
const ribbonRoot = new THREE.Group();
ribbonRoot.position.set(RIBBON_X, 0.04, 0.0);
groupAct3.add(ribbonRoot);

// Dynamic Parametric Twisted Harmonic Silk/Glass Ribbon
const U_SEG = 320;
const V_SEG = 30;
const ribbonGeo = new THREE.BufferGeometry();
const numVerts = (U_SEG + 1) * (V_SEG + 1);
const ribPos = new Float32Array(numVerts * 3);
const ribUv = new Float32Array(numVerts * 2);
const ribIndices = [];

for (let iu = 0; iu <= U_SEG; iu++) {
  for (let iv = 0; iv <= V_SEG; iv++) {
    const idx = iu * (V_SEG + 1) + iv;
    ribUv[idx * 2] = iu / U_SEG;
    ribUv[idx * 2 + 1] = iv / V_SEG;
    if (iu < U_SEG && iv < V_SEG) {
      const a = idx;
      const b = idx + V_SEG + 1;
      const c = idx + 1;
      const d = idx + V_SEG + 2;
      ribIndices.push(a, b, c, c, b, d);
    }
  }
}
ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(ribUv, 2));
ribbonGeo.setIndex(ribIndices);

function evalHarmonicCurve(uAngle, phase, outVec) {
  // Graceful sculptural (2,3) trefoil-torus harmonic curve
  const rMain = 1.05 + 0.34 * Math.cos(3.0 * uAngle + phase * 0.6);
  const x = rMain * Math.cos(2.0 * uAngle);
  const y = rMain * Math.sin(2.0 * uAngle);
  const z = 0.56 * Math.sin(3.0 * uAngle + phase * 0.6);
  outVec.set(x, y, z);
}

const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _tang = new THREE.Vector3();
const _normV = new THREE.Vector3();
const _binorm = new THREE.Vector3();
const _upRef = new THREE.Vector3(0, 0, 1);

function updateIridescentRibbon(phase) {
  const posAttr = ribbonGeo.attributes.position;
  const arr = posAttr.array;
  const eps = 0.002;

  for (let iu = 0; iu <= U_SEG; iu++) {
    const u = (iu / U_SEG) * Math.PI * 2.0;
    evalHarmonicCurve(u, phase, _p0);
    evalHarmonicCurve(u + eps, phase, _p1);
    _tang.subVectors(_p1, _p0).normalize();

    // Smooth Frenet-like radial frame without gimbal flip
    _normV.copy(_p0).normalize();
    _binorm.crossVectors(_tang, _normV).normalize();
    _normV.crossVectors(_binorm, _tang).normalize();

    // Sculptural twist + breathing ribbon width
    const twist = 1.5 * u + phase * 1.15;
    const width = 0.30 + 0.11 * Math.sin(3.0 * u - phase * 0.8);
    const cosT = Math.cos(twist);
    const sinT = Math.sin(twist);

    for (let iv = 0; iv <= V_SEG; iv++) {
      const sv = (iv / V_SEG - 0.5) * 2.0; // -1 .. +1
      const wOff = sv * width;
      // Subtle parabolic cup across the ribbon width for rich specular highlights
      const arch = (1.0 - sv * sv) * 0.045;

      const rx = _normV.x * (wOff * cosT - arch * sinT) + _binorm.x * (wOff * sinT + arch * cosT);
      const ry = _normV.y * (wOff * cosT - arch * sinT) + _binorm.y * (wOff * sinT + arch * cosT);
      const rz = _normV.z * (wOff * cosT - arch * sinT) + _binorm.z * (wOff * sinT + arch * cosT);

      const idx = (iu * (V_SEG + 1) + iv) * 3;
      arr[idx] = _p0.x + rx;
      arr[idx + 1] = _p0.y + ry;
      arr[idx + 2] = _p0.z + rz;
    }
  }
  posAttr.needsUpdate = true;
  ribbonGeo.computeVertexNormals();
}

const iridescentMat = new THREE.MeshPhysicalMaterial({
  color: 0x22283a,
  metalness: 0.74,
  roughness: 0.09,
  iridescence: 1.0,
  iridescenceIOR: 1.36,
  iridescenceThicknessRange: [220, 620],
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  sheen: 0.65,
  sheenColor: new THREE.Color(0xf5dfc0),
  side: THREE.DoubleSide,
});
const ribbonMesh = new THREE.Mesh(ribbonGeo, iridescentMat);
ribbonRoot.add(ribbonMesh);

// 7 Luminous Champagne-Gold Harmonic Filaments Orbiting the Sculpture
const filamentMat = new THREE.MeshStandardMaterial({
  color: 0xf5e2be,
  emissive: 0xdcb980,
  emissiveIntensity: 0.50,
  metalness: 0.9,
  roughness: 0.15,
});
const harmonicFilaments = [];
for (let f = 0; f < 7; f++) {
  const pts = [];
  const rad = 1.12 + f * 0.058;
  for (let s = 0; s <= 128; s++) {
    const a = (s / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      Math.cos(a) * rad,
      Math.sin(a) * rad,
      Math.sin(a * 3.0 + f * 0.9) * 0.24
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.0038, 8, true), filamentMat);
  tube.rotation.set(f * 0.35, f * 0.52, 0);
  ribbonRoot.add(tube);
  harmonicFilaments.push(tube);
}

// Rising Stardust Motes in Act III & IV
function createStardustField(count, spreadX, spreadY, seed) {
  const r = mulberry32(seed);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const meta = [];
  for (let i = 0; i < count; i++) {
    const x = (r() - 0.5) * spreadX;
    const y = (r() - 0.5) * spreadY;
    const z = (r() - 0.5) * 5.0;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    meta.push({ x, y0: y, z, speed: 0.18 + r() * 0.38, amp: 0.08 + r() * 0.14, ph: r() * 6.28 });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xf4e4c6,
    size: 0.026,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  return { pts, geo, mat, meta, spreadY };
}

const act3Dust = createStardustField(140, 9.0, 5.5, 30903);
groupAct3.add(act3Dust.pts);

// ============================================================================
// ACT IV (11.20s - 15.00s): THE SIGNATURE — ANTIGRAVITY ECLIPSE MONOLITH
// ============================================================================
const groupAct4 = new THREE.Group();
scene.add(groupAct4);

const ECLIPSE_Y = 0.56;
const eclipseRoot = new THREE.Group();
eclipseRoot.position.set(0.0, ECLIPSE_Y, 0.0);
groupAct4.add(eclipseRoot);

// Central Levitating Velvet-Obsidian Total-Eclipse Sphere
const eclipseSphereMat = new THREE.MeshPhysicalMaterial({
  color: 0x050609,
  metalness: 0.55,
  roughness: 0.42,
  clearcoat: 0.18,
  clearcoatRoughness: 0.30,
});
const eclipseSphere = new THREE.Mesh(new THREE.SphereGeometry(0.68, 96, 96), eclipseSphereMat);
eclipseRoot.add(eclipseSphere);

// Custom GLSL Volumetric Solar-Eclipse Corona Halo Behind the Monolith Sphere
const coronaMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uIntensity: { value: 1.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uIntensity;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);
      float ang = atan(p.y, p.x);

      // Tight incandescent rim right around r = 0.340 (matches 0.68 sphere radius on 4.0 quad)
      float rim = exp(-abs(r - 0.340) * 28.0) * 1.25;
      float outerGlow = exp(-max(0.0, r - 0.32) * 4.8) * 0.34;
      // Subtle anisotropic crown flare
      float rays = 1.0 + 0.15 * cos(ang * 2.0 - 0.35) + 0.06 * cos(ang * 6.0 + uTime * 0.4);
      // Mask inside sphere interior cleanly
      float innerMask = smoothstep(0.315, 0.342, r);

      vec3 champagne = mix(vec3(0.84, 0.90, 1.0), vec3(0.99, 0.88, 0.68), 0.84);
      float alpha = (rim + outerGlow * rays) * innerMask * smoothstep(1.0, 0.42, r);
      gl_FragColor = vec4(champagne * alpha * uIntensity, 1.0);
    }
  `,
});
const coronaQuad = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), coronaMat);
coronaQuad.position.set(0, 0, -0.08);
eclipseRoot.add(coronaQuad);

// Precision Inclined Champagne-Gold Astrolabe/Saturn Halo Ring + Whisper Outer Orbit
const haloGroup = new THREE.Group();
haloGroup.rotation.set(1.18, 0.06, -0.20);
eclipseRoot.add(haloGroup);

const primaryHaloMat = new THREE.MeshStandardMaterial({
  color: 0xf4dfc0,
  emissive: 0xd9b882,
  emissiveIntensity: 0.48,
  metalness: 0.95,
  roughness: 0.14,
});
const primaryHalo = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.011, 24, 220), primaryHaloMat);
const outerWhisperHalo = new THREE.Mesh(
  new THREE.TorusGeometry(1.86, 0.0045, 16, 220),
  new THREE.MeshBasicMaterial({ color: 0xd7be93, transparent: true, opacity: 0.38 })
);
const orbitalPearl = new THREE.Mesh(new THREE.SphereGeometry(0.030, 24, 24), mercuryMat);
haloGroup.add(primaryHalo, outerWhisperHalo, orbitalPearl);

// Vertical Zero-Gravity Axis Light Filament (placed behind sphere at z = -0.15 so front silhouette stays pure!)
const axisBeamMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uAlpha: { value: 1.0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uAlpha;
    varying vec2 vUv;
    void main() {
      float cx = exp(-abs(vUv.x - 0.5) * 48.0);
      float cy = sin(vUv.y * 3.14159265);
      cy = pow(max(0.0, cy), 2.2);
      vec3 col = vec3(0.98, 0.89, 0.72);
      gl_FragColor = vec4(col * cx * cy * 0.42 * uAlpha, 1.0);
    }
  `,
});
const axisBeam = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.2), axisBeamMat);
axisBeam.position.set(0, 0.15, -0.15);
eclipseRoot.add(axisBeam);

// Calm Mirror Horizon Plane for Act IV (lowered subtly below title lockup)
const act4Floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), act1FloorMat);
act4Floor.rotation.x = -Math.PI / 2;
act4Floor.position.set(0, -1.92, -1.5);
groupAct4.add(act4Floor);

const act4Dust = createStardustField(120, 10.0, 5.5, 40904);
groupAct4.add(act4Dust.pts);

// ============================================================================
// DOM & SVG References for Frame-Exact Editorial Choreography
// ============================================================================
const hudGravity = document.getElementById('hud-gravity');
const hudAct = document.getElementById('hud-act');
const hudTc = document.getElementById('hud-tc');
const hudProgress = document.getElementById('hud-progress');
const curtainEl = document.getElementById('curtain');

const copyAct1 = document.getElementById('copy-act1');
const a1Eye = document.getElementById('a1-eye');
const a1L1 = document.getElementById('a1-l1');
const a1L2 = document.getElementById('a1-l2');
const a1En = document.getElementById('a1-en');

const copyAct2 = document.getElementById('copy-act2');
const a2Eye = document.getElementById('a2-eye');
const a2L1 = document.getElementById('a2-l1');
const a2L2 = document.getElementById('a2-l2');
const a2En = document.getElementById('a2-en');
const pipeCells = [0, 1, 2, 3].map((i) => document.getElementById(`pipe-${i}`));

const copyAct3 = document.getElementById('copy-act3');
const a3Eye = document.getElementById('a3-eye');
const a3L1 = document.getElementById('a3-l1');
const a3L2 = document.getElementById('a3-l2');
const a3En = document.getElementById('a3-en');

const copyAct4 = document.getElementById('copy-act4');
const titleRoman = document.getElementById('title-roman');
const sigDivider = document.getElementById('sig-divider');
const sigCn = document.getElementById('sig-cn');
const sigOrigin = document.getElementById('sig-origin');

const act2Drafting = document.getElementById('act2-drafting');
const draftC1 = document.getElementById('draft-c1');
const draftC2 = document.getElementById('draft-c2');
const draftAxisH = document.getElementById('draft-axis-h');
const draftAxisV = document.getElementById('draft-axis-v');
const callouts = [0, 1, 2].map((i) => ({
  line: document.getElementById(`co-line-${i}`),
  dot: document.getElementById(`co-dot-${i}`),
  txt: document.getElementById(`co-txt-${i}`),
}));

function styleLineReveal(el, t, tIn, durIn, tOut, durOut, yPx = 54) {
  const uIn = easeOutExpo(norm(t, tIn, tIn + durIn));
  const uOut = tOut != null ? smootherstep(tOut, tOut + durOut, t) : 0.0;
  const y = (1.0 - uIn) * yPx - uOut * 22.0;
  const op = uIn * (1.0 - uOut);
  el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
  el.style.opacity = op.toFixed(4);
}

const _projVec = new THREE.Vector3();
function projectToScreen(worldVec) {
  _projVec.copy(worldVec).project(camera);
  return {
    x: (_projVec.x * 0.5 + 0.5) * W,
    y: (-_projVec.y * 0.5 + 0.5) * H,
  };
}

function updateDust(field, t) {
  const arr = field.geo.attributes.position.array;
  const halfY = field.spreadY * 0.5;
  for (let i = 0; i < field.meta.length; i++) {
    const d = field.meta[i];
    let y = ((d.y0 + t * d.speed + halfY) % field.spreadY) - halfY;
    if (y < -halfY) y += field.spreadY;
    arr[i * 3] = d.x + Math.sin(t * 0.7 + d.ph) * d.amp;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = d.z + Math.cos(t * 0.6 + d.ph) * d.amp;
  }
  field.geo.attributes.position.needsUpdate = true;
}

// ============================================================================
// Master Deterministic Frame Evaluation: setFilmTime(t)
// ============================================================================
const BG_DARK_1 = new THREE.Color(0x07080c);
const BG_ALABASTER = new THREE.Color(0xede7dc);
const BG_DARK_3 = new THREE.Color(0x06070b);
const _bgColor = new THREE.Color();

export function setFilmTime(rawT) {
  const t = clamp(rawT, 0.0, DURATION);
  opticsPass.uniforms.uTime.value = t;

  // Update Margin HUD & SMPTE Timecode
  hudProgress.style.width = `${((t / DURATION) * (100 - 2.4)).toFixed(3)}%`;
  const frameNum = Math.min(900, Math.round(t * 60));
  const secWhole = Math.floor(t);
  const ff = Math.min(59, Math.floor((t - secWhole + 1e-6) * 60));
  hudTc.textContent = `00:00:${String(secWhole).padStart(2, '0')}:${String(ff).padStart(2, '0')}  ·  F ${String(frameNum).padStart(3, '0')}/900`;

  // Physics Gravity Telemetry
  if (t < 0.85) {
    const prePulse = smoothstep(0.60, 0.85, t);
    const gVal = lerp(-9.807, -7.420, prePulse);
    hudGravity.innerHTML = `GRAVITY &nbsp;<b>g = ${gVal.toFixed(3)} m/s²</b>`;
  } else {
    const inv = easeOutExpo(norm(t, 0.85, 1.55));
    const gVal = lerp(-7.420, 0.0, inv);
    const tag = inv > 0.98 ? ' [ZERO-G]' : '';
    hudGravity.innerHTML = `GRAVITY &nbsp;<b>g = ${Math.abs(gVal) < 0.002 ? '0.000' : gVal.toFixed(3)} m/s²${tag}</b>`;
  }

  // Reset visibility
  groupAct1.visible = false;
  groupAct2.visible = false;
  groupAct3.visible = false;
  groupAct4.visible = false;
  copyAct1.style.opacity = '0';
  copyAct2.style.opacity = '0';
  copyAct3.style.opacity = '0';
  copyAct4.style.opacity = '0';
  act2Drafting.setAttribute('opacity', '0');

  // --------------------------------------------------------------------------
  // ACT I: 0.00s -> 3.60s (Obsidian Zero-G Awakening)
  // --------------------------------------------------------------------------
  if (t < 3.60) {
    groupAct1.visible = true;
    stageEl.dataset.theme = 'dark';
    hudAct.textContent = '01  /  AWAKENING';
    scene.background = BG_DARK_1;
    scene.environmentIntensity = 1.18;

    bloomPass.strength = 0.30;
    bloomPass.radius = 0.72;
    bloomPass.threshold = 0.78;
    opticsPass.uniforms.uVignette.value = 0.30;
    opticsPass.uniforms.uDispersion.value = 0.0010;
    renderer.toneMappingExposure = 1.10;

    keyLight.color.setHex(0xfff1da);
    keyLight.intensity = 2.4;
    keyLight.position.set(4.5, 7.2, 4.8);
    rimLight.color.setHex(0x88a8dc);
    rimLight.intensity = 1.75;
    warmFill.position.set(MONO_X, -0.3, 2.5);
    warmFill.intensity = 1.6 + 1.8 * smoothstep(0.84, 1.8, t);
    ambientLight.intensity = 0.18;

    // Camera subtle push-in + gentle zero-gravity float after 0.85s
    const camU = smootherstep(0.0, 3.60, t);
    const tremor = t > 0.55 && t < 0.85 ? Math.sin(t * 95.0) * 0.006 * smoothstep(0.55, 0.85, t) : 0.0;
    camera.fov = lerp(37.5, 34.5, camU);
    camera.updateProjectionMatrix();
    camera.position.set(
      lerp(0.0, 0.24, camU) + tremor,
      lerp(-0.12, 0.18, camU) - tremor * 0.5,
      lerp(6.45, 5.55, camU)
    );
    camera.lookAt(0.28, lerp(-0.22, 0.06, camU), 0.0);

    // Floor shockwave & horizon
    act1FloorMat.uniforms.uTime.value = t;
    act1FloorMat.uniforms.uShock.value = t >= 0.85 ? easeOutQuint(norm(t, 0.85, 2.85)) : 0.0;
    act1FloorMat.uniforms.uHorizon.value = 1.0;
    act1FloorMat.uniforms.uCenter.value.set(MONO_X, 0.0);
    horizonSlitMat.uniforms.uIntensity.value = lerp(0.55, 0.95, smoothstep(0.0, 1.2, t));

    // Fractured Obsidian Geode Levitation & Shell Expansion
    const release = t >= 0.85 ? easeOutQuint(norm(t, 0.85, 3.10)) : 0.0;
    const preComp = t < 0.85 ? smoothstep(0.45, 0.85, t) * 0.04 : 0.0;
    monolithRoot.scale.setScalar(0.88);
    monolithRoot.position.set(
      MONO_X,
      -0.38 - preComp + release * 0.68 + Math.sin(Math.max(0, t - 0.85) * 1.6) * 0.03 * release,
      0.0
    );
    monolithRoot.rotation.y = t * 0.22 + release * 0.35;
    monolithRoot.rotation.x = 0.15 * release;

    geodeCoreMat.emissiveIntensity = 0.15 + release * 1.15;
    geodeCore.scale.setScalar(0.88 + release * 0.18);
    innerRing1.rotation.set(0.6 + t * 0.55, t * 0.42, 0.2);
    innerRing2.rotation.set(-0.5, 0.8 + t * 0.65, t * 0.35);
    innerRing1.scale.setScalar(0.6 + release * 0.55);
    innerRing2.scale.setScalar(0.6 + release * 0.58);

    for (let i = 0; i < shellPlates.length; i++) {
      const sp = shellPlates[i];
      const uPlate = t >= 0.85 + sp.delay ? easeOutQuint(norm(t, 0.85 + sp.delay, 3.25)) : 0.0;
      const rNow = sp.baseRadius - preComp * 0.4 + uPlate * sp.driftRadius;
      sp.holder.position.copy(sp.dir).multiplyScalar(rNow);
      sp.holder.lookAt(sp.dir.clone().multiplyScalar(rNow + 1.0));
      sp.holder.rotateOnAxis(sp.rotAxis, uPlate * sp.rotSpeed * 1.15);
    }

    // Liquid-Mercury & Champagne-Pearl Droplets Rising Against Gravity
    for (let i = 0; i < droplets.length; i++) {
      const d = droplets[i];
      const dt = Math.max(0.0, t - (0.85 + d.delay));
      const lift = dt > 0 ? Math.pow(dt, 1.28) * d.riseSpeed : 0.0;
      const theta = d.swirl * dt;
      const dx = d.x0 - MONO_X;
      const dz = d.z0;
      const rx = MONO_X + dx * Math.cos(theta) - dz * Math.sin(theta);
      const rz = dx * Math.sin(theta) + dz * Math.cos(theta);
      d.m.position.set(
        rx,
        d.yFloor + lift + (dt > 0 ? Math.sin(t * 2.4 + d.phase) * 0.025 : 0.0),
        rz
      );
      // Slight vertical elongation during initial acceleration
      const stretch = 1.0 + Math.min(0.28, dt * 0.35) * Math.exp(-dt * 0.9);
      d.m.scale.set(d.rad / Math.sqrt(stretch), d.rad * stretch, d.rad / Math.sqrt(stretch));
    }

    // Editorial Typography Act I
    copyAct1.style.opacity = '1';
    styleLineReveal(a1Eye, t, 0.20, 0.65, 3.22, 0.34, 20);
    styleLineReveal(a1L1, t, 0.42, 0.82, 3.24, 0.34, 62);
    styleLineReveal(a1L2, t, 1.02, 0.85, 3.27, 0.32, 62);
    styleLineReveal(a1En, t, 1.48, 0.80, 3.29, 0.30, 28);
  }

  // --------------------------------------------------------------------------
  // ACT II: 3.60s -> 7.40s (Sunlit Alabaster Gallery & Aperture Dive)
  // --------------------------------------------------------------------------
  else if (t < 7.40) {
    groupAct2.visible = true;
    const diveU = easeInOutQuint(norm(t, 6.96, 7.40));
    stageEl.dataset.theme = diveU > 0.72 ? 'dark' : 'light';
    hudAct.textContent = '02  /  ARCHITECTURE';

    _bgColor.copy(BG_ALABASTER).lerp(BG_DARK_3, smoothstep(7.18, 7.39, t));
    scene.background = _bgColor;
    scene.environmentIntensity = lerp(0.85, 1.15, diveU);

    // Keep alabaster paper crisp & bloom-free!
    bloomPass.strength = 0.05;
    bloomPass.radius = 0.45;
    bloomPass.threshold = 0.96;
    opticsPass.uniforms.uVignette.value = lerp(0.16, 0.32, diveU);
    opticsPass.uniforms.uDispersion.value = lerp(0.0006, 0.0018, Math.sin(diveU * Math.PI));
    renderer.toneMappingExposure = 1.02;

    keyLight.color.setHex(0xfff9f0);
    keyLight.intensity = 2.45;
    keyLight.position.set(2.4, 8.6, 5.8);
    rimLight.color.setHex(0xdbe4f0);
    rimLight.intensity = 1.15;
    warmFill.position.set(1.6, -1.5, 3.2);
    warmFill.intensity = 1.2;
    ambientLight.intensity = 0.82;

    // Camera orbits poised around studio, then plunges dead-center through the central smoked-obsidian aperture!
    const browseU = smootherstep(3.60, 7.00, t);
    const alignXY = smootherstep(6.92, 7.26, t);
    const baseCamX = lerp(0.12, 0.30, browseU);
    const baseCamY = lerp(0.02, 0.04, browseU);
    const baseCamZ = lerp(6.15, 5.75, browseU);

    camera.fov = lerp(35.0, 26.0, diveU);
    camera.updateProjectionMatrix();
    camera.position.set(
      lerp(baseCamX, ASTRO_CENTER.x, alignXY),
      lerp(baseCamY, ASTRO_CENTER.y, alignXY),
      lerp(baseCamZ, 0.14, diveU)
    );
    camera.lookAt(
      lerp(0.28, ASTRO_CENTER.x, alignXY),
      lerp(0.03, ASTRO_CENTER.y, alignXY),
      0.0
    );

    alabasterRoot.scale.setScalar(lerp(0.86, 1.08, diveU));

    // Gimbal rings converge into orthogonal architectural lock by 5.90s
    const lockGlobal = easeOutQuint(norm(t, 3.60, 5.95));
    const steadySpin = Math.max(0, t - 3.60) * 0.16 * (1.0 - diveU * 0.85);
    gimbalRings.forEach(({ ring, cfg }, idx) => {
      ring.rotation.set(
        lerp(cfg.startEuler[0], cfg.endEuler[0], lockGlobal) + steadySpin * (idx === 1 ? -0.5 : 0.35),
        lerp(cfg.startEuler[1], cfg.endEuler[1], lockGlobal) + steadySpin * 0.6,
        lerp(cfg.startEuler[2], cfg.endEuler[2], lockGlobal)
      );
    });

    // Aperture faces camera cleanly as we dive through it
    apertureGroup.rotation.set(
      (1.0 - diveU) * Math.sin(t * 0.9) * 0.08,
      (1.0 - diveU) * (-0.18 + Math.cos(t * 0.7) * 0.08),
      t * 0.25
    );

    // 36 Modular Architectural Blocks Snap into Sacred Crystalline Lattice
    for (let i = 0; i < archModules.length; i++) {
      const m = archModules[i];
      const tStart = 3.60 + m.cohort * 0.14;
      const uSnap = easeOutQuint(norm(t, tStart, m.lockTime));
      m.mesh.position.lerpVectors(m.startPos, m.targetPos, uSnap);
      // Slight outward iris expansion during aperture dive so camera clears the inner ring cleanly
      if (diveU > 0.01) {
        m.mesh.position.multiplyScalar(1.0 + diveU * 0.38);
      }
      m.mesh.rotation.set(
        lerp(m.startRot.x, m.endRot.x, uSnap),
        lerp(m.startRot.y, m.endRot.y, uSnap),
        lerp(m.startRot.z, m.endRot.z, uSnap) + steadySpin * 0.35
      );
    }

    strutMat.opacity = smoothstep(5.15, 6.05, t) * (1.0 - smoothstep(6.95, 7.25, t)) * 0.34;
    alabasterRoot.rotation.z = steadySpin * 0.25;

    // Live 3D-Projected SVG Architectural Drafting Overlay
    const draftAlpha = smoothstep(3.72, 4.25, t) * (1.0 - smoothstep(6.82, 7.12, t));
    act2Drafting.setAttribute('opacity', draftAlpha.toFixed(3));
    if (draftAlpha > 0.005) {
      const sc = projectToScreen(ASTRO_CENTER);
      draftC1.setAttribute('cx', sc.x.toFixed(1));
      draftC1.setAttribute('cy', sc.y.toFixed(1));
      draftC2.setAttribute('cx', sc.x.toFixed(1));
      draftC2.setAttribute('cy', sc.y.toFixed(1));
      draftAxisH.setAttribute('x1', (sc.x - 420).toFixed(1));
      draftAxisH.setAttribute('x2', (sc.x + 420).toFixed(1));
      draftAxisH.setAttribute('y1', sc.y.toFixed(1));
      draftAxisH.setAttribute('y2', sc.y.toFixed(1));
      draftAxisV.setAttribute('x1', sc.x.toFixed(1));
      draftAxisV.setAttribute('x2', sc.x.toFixed(1));
      draftAxisV.setAttribute('y1', (sc.y - 390).toFixed(1));
      draftAxisV.setAttribute('y2', (sc.y + 390).toFixed(1));

      // Place callout shelves cleanly outside the outer gimbal ring so labels never collide with rings!
      const pickIndices = [1, 17, 29];
      const worldTmp = new THREE.Vector3();
      pickIndices.forEach((mIdx, cIdx) => {
        archModules[mIdx].mesh.getWorldPosition(worldTmp);
        const p = projectToScreen(worldTmp);
        let vx = p.x - sc.x;
        let vy = p.y - sc.y;
        const vLen = Math.max(1.0, Math.hypot(vx, vy));
        vx /= vLen;
        vy /= vLen;
        const shelfR = 352;
        const elbowX = clamp(sc.x + vx * shelfR, 940, 1710);
        const elbowY = clamp(sc.y + vy * shelfR, 128, 940);
        const dirSign = vx >= -0.15 ? 1 : -1;
        const shelfLen = 152 * dirSign;
        const endX = clamp(elbowX + shelfLen, 800, 1850);
        const co = callouts[cIdx];
        co.dot.setAttribute('cx', p.x.toFixed(1));
        co.dot.setAttribute('cy', p.y.toFixed(1));
        co.line.setAttribute('points', `${p.x.toFixed(1)},${p.y.toFixed(1)} ${elbowX.toFixed(1)},${elbowY.toFixed(1)} ${endX.toFixed(1)},${elbowY.toFixed(1)}`);
        co.txt.setAttribute('x', (dirSign > 0 ? elbowX + 8 : endX + 4).toFixed(1));
        co.txt.setAttribute('y', (elbowY - 7).toFixed(1));
      });
    }

    // Editorial Typography Act II
    copyAct2.style.opacity = (1.0 - smoothstep(6.88, 7.18, t)).toFixed(4);
    styleLineReveal(a2Eye, t, 3.63, 0.55, 6.85, 0.30, 18);
    styleLineReveal(a2L1, t, 3.70, 0.68, 6.87, 0.30, 58);
    styleLineReveal(a2L2, t, 3.98, 0.72, 6.90, 0.30, 58);
    styleLineReveal(a2En, t, 4.26, 0.68, 6.92, 0.28, 24);

    const pipeTimes = [4.10, 4.70, 5.30, 5.90];
    pipeCells.forEach((cell, idx) => {
      const showU = easeOutExpo(norm(t, 3.85 + idx * 0.08, 4.35 + idx * 0.08));
      cell.style.opacity = showU.toFixed(3);
      cell.classList.toggle('active', t >= pipeTimes[idx] - 0.02);
    });
  }

  // --------------------------------------------------------------------------
  // ACT III: 7.40s -> 11.20s (Symbiosis & Taste — Iridescent Harmonic Ribbon)
  // --------------------------------------------------------------------------
  else if (t < 11.20) {
    groupAct3.visible = true;
    stageEl.dataset.theme = 'dark';
    hudAct.textContent = '03  /  SYMBIOSIS';
    scene.background = BG_DARK_3;
    scene.environmentIntensity = 1.32;

    bloomPass.strength = 0.28;
    bloomPass.radius = 0.68;
    bloomPass.threshold = 0.80;
    opticsPass.uniforms.uVignette.value = 0.30;
    opticsPass.uniforms.uDispersion.value = 0.0011;
    renderer.toneMappingExposure = 1.12;

    keyLight.color.setHex(0xfff0d6);
    keyLight.intensity = 2.6;
    keyLight.position.set(4.8, 6.2, 5.5);
    rimLight.color.setHex(0x8fb0e8);
    rimLight.intensity = 2.0;
    warmFill.position.set(RIBBON_X + 1.2, 0.4, 3.0);
    warmFill.intensity = 2.4;
    ambientLight.intensity = 0.20;

    // Emerge smoothly out of the dark glass aperture and frame sculpture on the left
    const emergeU = easeOutQuint(norm(t, 7.40, 8.25));
    const exitU = easeInOutQuint(norm(t, 10.65, 11.20));

    camera.fov = lerp(29.0, 35.5, emergeU);
    camera.updateProjectionMatrix();
    camera.position.set(
      lerp(-1.10, -0.10, emergeU) * (1.0 - exitU),
      lerp(0.04, 0.08, emergeU),
      lerp(2.35, 5.85, emergeU) + exitU * 0.35
    );
    camera.lookAt(lerp(-0.95, -0.22, emergeU) * (1.0 - exitU), 0.03, 0.0);

    // Update living iridescent parametric ribbon
    const phase = (t - 7.40) * 1.15;
    updateIridescentRibbon(phase);

    const convScale = (1.0 - exitU * 0.55) * 0.86;
    ribbonRoot.position.set(lerp(RIBBON_X, 0.0, exitU), lerp(0.04, ECLIPSE_Y, exitU), 0.0);
    ribbonRoot.scale.setScalar(convScale);
    ribbonRoot.rotation.set(0.28 + (t - 7.40) * 0.16, -0.35 + (t - 7.40) * 0.28, 0.12);

    harmonicFilaments.forEach((tube, idx) => {
      tube.rotation.z = (t - 7.40) * (0.22 + idx * 0.04) * (idx % 2 === 0 ? 1 : -1);
      tube.rotation.x = idx * 0.35 + Math.sin(t * 1.2 + idx) * 0.08;
    });

    updateDust(act3Dust, t);
    act3Dust.mat.opacity = smoothstep(7.45, 8.0, t) * (1.0 - exitU * 0.5) * 0.62;

    // Editorial Typography Act III (Right Side)
    copyAct3.style.opacity = '1';
    styleLineReveal(a3Eye, t, 7.55, 0.60, 10.62, 0.42, 20);
    styleLineReveal(a3L1, t, 7.68, 0.78, 10.66, 0.42, 58);
    styleLineReveal(a3L2, t, 8.02, 0.82, 10.70, 0.40, 58);
    styleLineReveal(a3En, t, 8.42, 0.78, 10.74, 0.38, 26);
  }

  // --------------------------------------------------------------------------
  // ACT IV: 11.20s -> 15.00s (The Signature — Antigravity Eclipse Monolith)
  // --------------------------------------------------------------------------
  else {
    groupAct4.visible = true;
    stageEl.dataset.theme = 'dark';
    hudAct.textContent = '04  /  IDENTITY';
    scene.background = BG_DARK_3;
    scene.environmentIntensity = 0.34;

    bloomPass.strength = 0.32;
    bloomPass.radius = 0.76;
    bloomPass.threshold = 0.76;
    opticsPass.uniforms.uVignette.value = 0.32;
    opticsPass.uniforms.uDispersion.value = 0.0009;
    renderer.toneMappingExposure = 1.08;

    // Grazing rear-side rim lighting for true total-eclipse silhouette (no front hot-spots!)
    keyLight.color.setHex(0xfff0d4);
    keyLight.intensity = 2.6;
    keyLight.position.set(4.5, 3.6, -4.8);
    rimLight.color.setHex(0x98b6eb);
    rimLight.intensity = 2.2;
    rimLight.position.set(-4.8, 2.4, -4.5);
    warmFill.position.set(0.0, -2.5, 1.5);
    warmFill.intensity = 0.18;
    ambientLight.intensity = 0.06;

    const settleU = easeOutQuint(norm(t, 11.20, 14.80));
    camera.fov = 34.0;
    camera.updateProjectionMatrix();
    camera.position.set(0.0, lerp(0.08, 0.02, settleU), lerp(6.25, 5.82, settleU));
    camera.lookAt(0.0, -0.04, 0.0);

    // Levitating Eclipse Monolith
    const introScale = lerp(0.84, 1.0, easeOutExpo(norm(t, 11.20, 12.10))) * 0.90;
    const hoverY = ECLIPSE_Y + Math.sin((t - 11.20) * 1.35) * 0.028;
    eclipseRoot.position.set(0.0, hoverY, 0.0);
    eclipseRoot.scale.setScalar(introScale);
    eclipseSphere.rotation.y = (t - 11.20) * 0.18;

    coronaMat.uniforms.uTime.value = t;
    coronaMat.uniforms.uIntensity.value = lerp(1.35, 1.05, easeOutQuint(norm(t, 11.20, 12.40)));
    axisBeamMat.uniforms.uAlpha.value = smoothstep(11.20, 11.95, t);

    haloGroup.rotation.set(
      1.18 + Math.sin((t - 11.20) * 0.6) * 0.025,
      0.06,
      -0.20 + (t - 11.20) * 0.12
    );
    const pearlAng = 0.45 + (t - 11.20) * 0.48;
    orbitalPearl.position.set(Math.cos(pearlAng) * 1.42, Math.sin(pearlAng) * 1.42, 0.0);

    // Subtle serene floor reflection beneath Act IV without bright horizon line cutting across text
    act1FloorMat.uniforms.uTime.value = 2.4;
    act1FloorMat.uniforms.uShock.value = 1.0;
    act1FloorMat.uniforms.uHorizon.value = 0.18;
    act1FloorMat.uniforms.uCenter.value.set(0.0, 0.0);

    updateDust(act4Dust, t);
    act4Dust.mat.opacity = smoothstep(11.25, 12.0, t) * 0.58;

    // Monumental Center Title Lockup
    copyAct4.style.opacity = '1';
    const uRoman = easeOutExpo(norm(t, 11.26, 12.20));
    titleRoman.style.opacity = uRoman.toFixed(4);
    titleRoman.style.transform = `translate3d(0, ${((1.0 - uRoman) * 26).toFixed(2)}px, 0)`;
    const lsEm = lerp(0.54, 0.42, uRoman);
    titleRoman.style.letterSpacing = `${lsEm.toFixed(4)}em`;
    titleRoman.style.paddingLeft = `${lsEm.toFixed(4)}em`;

    const uDiv = easeOutExpo(norm(t, 11.50, 12.35));
    sigDivider.style.transform = `scaleX(${uDiv.toFixed(4)})`;
    sigDivider.style.opacity = uDiv.toFixed(4);

    const uCn = easeOutExpo(norm(t, 11.72, 12.55));
    sigCn.style.opacity = uCn.toFixed(4);
    sigCn.style.transform = `translate3d(0, ${((1.0 - uCn) * 20).toFixed(2)}px, 0)`;

    const uOrig = easeOutExpo(norm(t, 12.02, 12.80));
    sigOrigin.style.opacity = uOrig.toFixed(4);
    sigOrigin.style.transform = `translate3d(0, ${((1.0 - uOrig) * 14).toFixed(2)}px, 0)`;
  }

  // Subtle opening fade-in (0.00 -> 0.28s) and poised velvet ending fade-out (14.62 -> 15.00s)
  const openVeil = 1.0 - smoothstep(0.0, 0.28, t);
  const closeVeil = smootherstep(14.62, 15.00, t);
  curtainEl.style.opacity = Math.max(openVeil, closeVeil).toFixed(4);

  composer.render();
}

// Estimate visual motion speed (in px/sec) for adaptive shutter motion blur in offline render
function getMotionFactor(t) {
  if (Math.abs(t - 0.85) < 0.25) return 2;
  if (t >= 3.56 && t <= 3.64) return 1; // crisp Leica hard cut — NO cross-cut ghosting!
  if (t >= 6.95 && t <= 7.65) return 3; // aperture pass-through motion blur
  if (t >= 10.70 && t <= 11.35) return 2;
  return 1;
}

// ============================================================================
// Initialization & Interactive Browser Playback Loop
// ============================================================================
const audioEl = document.getElementById('film-audio');
const playBtn = document.getElementById('play-btn');
const scrubEl = document.getElementById('scrub');
const uiTime = document.getElementById('ui-time');

let playing = false;
let fallbackClockStart = 0;
let currentT = 0.0;

function syncInteractiveUI(t) {
  scrubEl.value = t.toFixed(3);
  uiTime.textContent = `${t.toFixed(2).padStart(5, '0')} / 15.00s`;
}

function tickInteractive(nowMs) {
  if (playing) {
    if (!audioEl.paused && Number.isFinite(audioEl.currentTime)) {
      currentT = audioEl.currentTime;
    } else {
      currentT = (nowMs - fallbackClockStart) / 1000.0;
    }
    if (currentT >= DURATION) {
      currentT = DURATION;
      playing = false;
      audioEl.pause();
      playBtn.textContent = 'REPLAY';
    }
    setFilmTime(currentT);
    syncInteractiveUI(currentT);
  }
  if (!IS_RENDER) {
    requestAnimationFrame(tickInteractive);
  }
}

playBtn.addEventListener('click', async () => {
  if (playing) {
    playing = false;
    audioEl.pause();
    playBtn.textContent = 'PLAY';
  } else {
    if (currentT >= DURATION - 0.05) {
      currentT = 0.0;
      audioEl.currentTime = 0.0;
    }
    fallbackClockStart = performance.now() - currentT * 1000.0;
    try {
      audioEl.currentTime = currentT;
      await audioEl.play();
    } catch (_) {
      // Fallback to high-precision performance.now() clock if autoplay audio blocked
    }
    playing = true;
    playBtn.textContent = 'PAUSE';
  }
});

scrubEl.addEventListener('input', () => {
  currentT = parseFloat(scrubEl.value);
  if (!audioEl.paused) {
    audioEl.currentTime = currentT;
  }
  fallbackClockStart = performance.now() - currentT * 1000.0;
  setFilmTime(currentT);
  syncInteractiveUI(currentT);
});

async function boot() {
  // Pre-warm all 4 acts so every font weight, glyph, and shader program is compiled & cached
  updateIridescentRibbon(0.0);
  for (const warmT of [1.5, 5.2, 9.0, 13.0, 0.0]) {
    setFilmTime(warmT);
  }
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  setFilmTime(0.0);

  window.__film = {
    ready: true,
    duration: DURATION,
    setTime: setFilmTime,
    motionSubframes: getMotionFactor,
  };

  if (!IS_RENDER) {
    requestAnimationFrame(tickInteractive);
  }
}

boot();
