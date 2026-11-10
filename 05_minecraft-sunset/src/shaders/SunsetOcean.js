import * as THREE from 'three';
import { ATMOSPHERE_GLSL } from './SunsetSky.js';
import { SEA_LEVEL, WORLD_MIN, WORLD_SPAN } from '../world/World.js';

const OCEAN_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform vec3 uCameraPos;

varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const OCEAN_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform sampler2D uDepthMap;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uHasShadow;
uniform float uSeaLevel;
uniform float uWorldMin;
uniform float uWorldSpan;
uniform float uSunRoadIntensity;

varying vec3 vWorldPos;

${ATMOSPHERE_GLSL}

float hashOcean(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noiseOcean(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hashOcean(i + vec2(0.0, 0.0)), hashOcean(i + vec2(1.0, 0.0)), u.x),
    mix(hashOcean(i + vec2(0.0, 1.0)), hashOcean(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Multi-octave organic wave height with grazing-angle anti-aliasing filter
float sampleWaveHeight(vec2 pos, float pixelFootprint, float t) {
  mat2 rot1 = mat2(0.82, -0.57, 0.57, 0.82);
  mat2 rot2 = mat2(0.64,  0.77, -0.77, 0.64);

  float w1 = exp(-0.15 * pixelFootprint);
  vec2 p1 = pos * vec2(0.22, 0.45) + vec2(t * 0.42, t * 0.88);
  float h = (noiseOcean(p1) - 0.5) * 0.62 * w1;

  float w2 = exp(-0.40 * pixelFootprint);
  vec2 p2 = (rot1 * pos) * vec2(0.52, 1.05) + vec2(-t * 0.72, t * 1.40);
  h += (noiseOcean(p2) - 0.5) * 0.34 * w2;

  float w3 = exp(-0.95 * pixelFootprint);
  vec2 p3 = (rot2 * pos) * vec2(1.30, 2.25) + vec2(t * 1.35, -t * 1.90);
  h += (noiseOcean(p3) - 0.5) * 0.16 * w3;

  float w4 = exp(-2.20 * pixelFootprint);
  vec2 p4 = pos * vec2(2.90, 4.80) + vec2(-t * 2.10, t * 3.20);
  h += (noiseOcean(p4) - 0.5) * 0.07 * w4;

  return h;
}

vec3 computeOceanNormal(vec2 pos, float dist, float viewY, float t) {
  float pixelFootprint = (dist / max(0.07, viewY)) * 0.0020;
  float eps = max(0.16, pixelFootprint * 0.32);

  float h0 = sampleWaveHeight(pos, pixelFootprint, t);
  float hx = sampleWaveHeight(pos + vec2(eps, 0.0), pixelFootprint, t);
  float hz = sampleWaveHeight(pos + vec2(0.0, eps), pixelFootprint, t);

  float dhdx = (hx - h0) / eps;
  float dhdz = (hz - h0) / eps;

  return normalize(vec3(-dhdx * 0.72, 1.0, -dhdz * 0.72));
}

// 9-tap PCF soft shadow lookup
float sampleOceanShadow(vec3 worldPos) {
  vec4 sc = uShadowMatrix * vec4(worldPos, 1.0);
  vec3 proj = sc.xyz / max(sc.w, 0.0001);
  vec2 uv = clamp(proj.xy, 0.002, 0.998);

  float bias = 0.0035;
  vec2 t = vec2(1.35 / 2048.0);
  float z = proj.z - bias;

  float shadow = 0.0;
  shadow += step(z, texture2D(uShadowMap, uv).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2( t.x,  0.0)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2(-t.x,  0.0)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2( 0.0,  t.y)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2( 0.0, -t.y)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2( t.x,  t.y)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2(-t.x,  t.y)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2( t.x, -t.y)).r);
  shadow += step(z, texture2D(uShadowMap, uv + vec2(-t.x, -t.y)).r);
  shadow /= 9.0;

  float inBounds = step(0.02, proj.x) * step(proj.x, 0.98) *
                   step(0.02, proj.y) * step(proj.y, 0.98) *
                   step(0.001, proj.z) * step(proj.z, 0.998) * step(0.5, uHasShadow);

  float edgeFade = smoothstep(0.02, 0.10, proj.x) * smoothstep(0.98, 0.90, proj.x) *
                   smoothstep(0.02, 0.10, proj.y) * smoothstep(0.98, 0.90, proj.y);

  return mix(1.0, shadow, inBounds * edgeFade);
}

// 3D Raymarched Water Terrain Reflection using the world heightmap texture!
// Reflects coastal mountains, the Natural Sea Arch, and the Lighthouse onto the rippling sea!
float sampleTerrainReflection(vec3 startPos, vec3 R) {
  vec3 stepDir = normalize(vec3(R.x, max(0.06, R.y * 0.55), R.z));
  float hit = 0.0;
  for (int i = 1; i <= 10; i++) {
    float marchDist = float(i) * 5.5;
    vec3 p = startPos + stepDir * marchDist;
    vec2 uv = (p.xz - vec2(uWorldMin)) / uWorldSpan;
    if (uv.x < 0.02 || uv.x > 0.98 || uv.y < 0.02 || uv.y > 0.98) break;
    float terrH = texture2D(uDepthMap, uv).r * 80.0;
    if (terrH > uSeaLevel + 0.8 && p.y <= terrH + 1.5) {
      hit = clamp((terrH - uSeaLevel) / 16.0, 0.25, 0.92) * (1.0 - float(i) / 11.5);
      break;
    }
  }
  return hit;
}

void main() {
  vec3 viewVec = cameraPosition - vWorldPos;
  float dist = length(viewVec);
  vec3 V = viewVec / max(dist, 0.0001);
  vec3 L = normalize(uSunDir);

  vec3 N = computeOceanNormal(vWorldPos.xz, dist, max(0.02, V.y), uTime);

  vec2 worldUV = (vWorldPos.xz - vec2(uWorldMin)) / uWorldSpan;
  float inVoxelBounds = step(0.01, worldUV.x) * step(worldUV.x, 0.99) *
                        step(0.01, worldUV.y) * step(worldUV.y, 0.99);
  vec4 depthSample = texture2D(uDepthMap, clamp(worldUV, 0.001, 0.999));
  float waterDepth = mix(9.0, (depthSample.g * 255.0) / 18.0, inVoxelBounds);

  float shadow = sampleOceanShadow(vWorldPos);

  // Rich glossy deep ocean palette so golden reflections & sun road pop with high contrast
  vec3 deepWaterColor   = vec3(0.03, 0.07, 0.16);
  vec3 midWaterColor    = vec3(0.05, 0.18, 0.26);
  vec3 shallowSandColor = vec3(0.68, 0.48, 0.26) * (0.28 + 0.72 * shadow);

  float shallowMask = exp(-waterDepth * 0.55) * inVoxelBounds;
  float coastalGlow = exp(-waterDepth * 0.25) * inVoxelBounds;
  vec3 waterBody = mix(deepWaterColor, midWaterColor, coastalGlow);
  waterBody = mix(waterBody, shallowSandColor, shallowMask * 0.72);

  // Sky + 3D Terrain Silhouette Reflection
  vec3 R = reflect(-V, N);
  R.y = max(0.012, R.y);
  vec3 skyReflection = computeSunsetAtmosphere(R, L, uTime);

  // Raymarch terrain reflections on water within 180m
  if (dist < 180.0 && inVoxelBounds > 0.5) {
    float terrRefl = sampleTerrainReflection(vWorldPos, R) * (1.0 - smoothstep(90.0, 180.0, dist));
    vec3 mountainReflCol = vec3(0.10, 0.08, 0.18);
    skyReflection = mix(skyReflection, mountainReflCol, terrRefl * 0.78);
  }

  skyReflection *= mix(0.24, 0.90, shadow);

  float NoV = clamp(dot(N, V), 0.03, 0.9999);
  float fresnel = 0.05 + 0.88 * pow(1.0 - NoV, 3.8);
  vec3 color = mix(waterBody, skyReflection, fresnel);

  // --- THE GOLDEN SUN ROAD (海面反射出一条通向地平线的日光路) ---
  vec2 vHoriz = length(V.xz) > 0.001 ? normalize(V.xz) : vec2(0.0, 1.0);
  vec2 lHoriz = normalize(L.xz);
  float sunCorridor = dot(-vHoriz, lHoriz);

  if (sunCorridor > 0.0) {
    // Perturb horizontal deviation with wave normal slope to form liquid wave-crest ribbons
    float crossDeviation = (vHoriz.x * lHoriz.y - vHoriz.y * lHoriz.x) + N.x * 0.38;

    float roadWidth = mix(0.052, 0.132, smoothstep(1000.0, 16.0, dist));
    float roadProfile = exp(-pow(crossDeviation / roadWidth, 2.0));
    float tightCoreProfile = exp(-pow(crossDeviation / (roadWidth * 0.36), 2.0));

    // Wave-crest horizontal ribbons: forward/back wave slopes catch the low sun in crisp golden bars
    float slopeCatch = smoothstep(-0.08, 0.22, N.z * lHoriz.y + N.x * lHoriz.x);
    float nGlint1 = noiseOcean(vWorldPos.xz * vec2(0.48, 1.45) + vec2(0.0, uTime * 2.1));
    float nGlint2 = noiseOcean(vWorldPos.xz * vec2(1.35, 3.60) - vec2(uTime * 1.0, uTime * 3.5));
    float waveFacets = smoothstep(0.24, 0.80, nGlint1 * 0.52 + nGlint2 * 0.48) * (0.4 + 0.6 * slopeCatch);
    float sparkleMask = smoothstep(0.66, 0.90, nGlint1 * nGlint2 * 2.15) * (1.0 - smoothstep(55.0, 380.0, dist));

    vec3 H = normalize(L + V);
    float specLobe = pow(max(0.0001, dot(N, H)), 32.0);

    vec3 sunRoadOuter = vec3(1.35, 0.46, 0.07) * roadProfile * (0.38 + 0.85 * waveFacets);
    vec3 sunRoadInner = vec3(2.15, 1.02, 0.24) * tightCoreProfile * (0.50 + 0.95 * waveFacets + 0.80 * specLobe);
    vec3 sunSparkles  = vec3(2.85, 1.65, 0.55) * sparkleMask * roadProfile * 1.95;

    float sunRoadShadow = mix(0.04, 1.0, shadow);
    color += (sunRoadOuter + sunRoadInner + sunSparkles) * sunRoadShadow * uSunRoadIntensity;
  }

  // Animated Coastal Surf & Shoreline Foam
  if (inVoxelBounds > 0.5 && waterDepth < 1.35 && waterDepth > 0.01) {
    float shoreFactor = 1.0 - smoothstep(0.04, 1.35, waterDepth);
    float waveNoise = (noiseOcean(vWorldPos.xz * 0.35 + uTime * 0.5) - 0.5) * 1.8;
    float surfWave = sin(waterDepth * 14.5 - uTime * 3.2 + waveNoise);
    float foamLine = smoothstep(0.28, 0.86, surfWave) * shoreFactor;
    float edgeFoam = smoothstep(0.36, 0.03, waterDepth);
    float totalFoam = clamp(foamLine * 0.65 + edgeFoam * 0.85, 0.0, 1.0);

    vec3 foamColor = mix(vec3(0.54, 0.40, 0.56), vec3(1.18, 0.84, 0.52), shadow);
    color = mix(color, foamColor, totalFoam * 0.82);
  }

  // Horizon atmospheric blend
  vec3 viewRay = -V;
  vec3 fogSky = computeSunsetAtmosphere(vec3(viewRay.x, max(0.008, viewRay.y), viewRay.z), L, uTime);
  float distFog = smoothstep(160.0, 1900.0, dist);
  color = mix(color, fogSky, distFog * 0.92);

  gl_FragColor = vec4(clamp(color, vec3(0.0), vec3(12.0)), 1.0);
}
`;

export class SunsetOcean {
  constructor(scene, sunDir, waterDepthTexture) {
    this.uniforms = {
      uTime: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() },
      uSunDir: { value: sunDir.clone().normalize() },
      uDepthMap: { value: waterDepthTexture },
      uShadowMap: { value: null },
      uShadowMatrix: { value: new THREE.Matrix4() },
      uHasShadow: { value: 0.0 },
      uSeaLevel: { value: SEA_LEVEL + 0.32 },
      uWorldMin: { value: WORLD_MIN },
      uWorldSpan: { value: WORLD_SPAN },
      uSunRoadIntensity: { value: 1.15 }
    };

    const geo = new THREE.PlaneGeometry(4200, 4200, 128, 128);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      vertexShader: OCEAN_VERTEX_SHADER,
      fragmentShader: OCEAN_FRAGMENT_SHADER,
      uniforms: this.uniforms
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = SEA_LEVEL + 0.32;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(time, cameraPos, sunDir, shadowTexture, shadowMatrix) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCameraPos.value.copy(cameraPos);
    if (sunDir) {
      this.uniforms.uSunDir.value.copy(sunDir).normalize();
    }
    if (shadowTexture && shadowMatrix) {
      this.uniforms.uShadowMap.value = shadowTexture;
      this.uniforms.uShadowMatrix.value.copy(shadowMatrix);
      this.uniforms.uHasShadow.value = 1.0;
    }
  }
}
