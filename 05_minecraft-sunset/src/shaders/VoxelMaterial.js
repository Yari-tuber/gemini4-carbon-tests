import * as THREE from 'three';
import { ATMOSPHERE_GLSL } from './SunsetSky.js';
import { SEA_LEVEL } from '../world/World.js';

const VOXEL_VERTEX_SHADER = /* glsl */ `
attribute float aAo;
attribute float aLight;
attribute float aFoliage;

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vAo;
varying float vLight;
varying float vFoliage;

void main() {
  vUv = uv;
  vAo = aAo;
  vLight = aLight;
  vFoliage = aFoliage;

  vec3 pos = position;

  if (aFoliage > 0.1) {
    float swayAmp = aFoliage > 1.1 ? 0.09 : 0.036;
    float wave = sin(uTime * 2.1 + pos.x * 0.7 + pos.z * 0.6 + pos.y * 0.4);
    pos.x += wave * swayAmp;
    pos.z += cos(uTime * 1.7 + pos.x * 0.5 - pos.z * 0.8) * swayAmp * 0.6;
  }

  vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const VOXEL_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uAlphaTest;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uHasShadow;
uniform float uSeaLevel;
uniform float uMistIntensity;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vAo;
varying float vLight;
varying float vFoliage;

${ATMOSPHERE_GLSL}

// 9-tap PCF soft shadow lookup
float sampleVoxelShadow(vec3 worldPos, vec3 normal, vec3 sunDir) {
  vec3 offsetPos = worldPos + normal * 0.085 + sunDir * 0.055;
  vec4 sc = uShadowMatrix * vec4(offsetPos, 1.0);
  vec3 proj = sc.xyz / max(sc.w, 0.0001);
  vec2 uv = clamp(proj.xy, 0.002, 0.998);

  float bias = 0.0020;
  vec2 t = vec2(1.20 / 2048.0);
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

  float inBounds = step(0.015, proj.x) * step(proj.x, 0.985) *
                   step(0.015, proj.y) * step(proj.y, 0.985) *
                   step(0.001, proj.z) * step(proj.z, 0.998) * step(0.5, uHasShadow);

  float edgeFade = smoothstep(0.015, 0.08, proj.x) * smoothstep(0.985, 0.92, proj.x) *
                   smoothstep(0.015, 0.08, proj.y) * smoothstep(0.985, 0.92, proj.y);

  return mix(1.0, shadow, inBounds * edgeFade);
}

void main() {
  vec4 texColor = texture2D(uAtlas, vUv);
  if (uAlphaTest > 0.0 && texColor.a < uAlphaTest) {
    discard;
  }

  vec3 albedo = texColor.rgb;
  vec3 baseN = normalize(vWorldNormal);
  vec3 L = normalize(uSunDir);
  vec3 viewVec = cameraPosition - vWorldPos;
  float dist = length(viewVec);
  vec3 V = viewVec / max(dist, 0.0001);

  // --- 1. Shaderpack Procedural Pixel-Bevel Micro-Normal Perturbation (像素级法线凹凸细节) ---
  float microFade = 1.0 - smoothstep(18.0, 65.0, dist);
  vec3 N = baseN;
  if (microFade > 0.01) {
    float stepUV = 1.0 / 256.0;
    float l0 = dot(albedo, vec3(0.333));
    float lx = dot(texture2D(uAtlas, vUv + vec2(stepUV, 0.0)).rgb, vec3(0.333));
    float ly = dot(texture2D(uAtlas, vUv + vec2(0.0, stepUV)).rgb, vec3(0.333));
    vec2 dL = vec2(lx - l0, ly - l0) * 1.65 * microFade;

    if (abs(baseN.y) > 0.8) {
      N = normalize(baseN + vec3(-dL.x, 0.0, dL.y));
    } else if (abs(baseN.x) > 0.8) {
      N = normalize(baseN + vec3(0.0, -dL.y, -dL.x));
    } else {
      N = normalize(baseN + vec3(-dL.x, -dL.y, 0.0));
    }
  }

  // Underwater caustics & absorption tint for submerged sand/rocks
  float submergeDepth = max(0.0, (uSeaLevel + 0.32) - vWorldPos.y);
  if (submergeDepth > 0.01) {
    float caustics = 0.5 + 0.5 * sin(vWorldPos.x * 1.8 + uTime * 2.4) * cos(vWorldPos.z * 1.8 - uTime * 2.1);
    albedo *= mix(vec3(1.0), vec3(0.40, 0.66, 0.74), clamp(submergeDepth * 0.25, 0.0, 0.85));
    albedo += vec3(0.20, 0.14, 0.06) * caustics * exp(-submergeDepth * 0.45);
  }

  // Wet shoreline sand darkening
  float wetShore = smoothstep(uSeaLevel + 1.15, uSeaLevel + 0.30, vWorldPos.y) * step(uSeaLevel + 0.25, vWorldPos.y);
  if (wetShore > 0.01 && vFoliage < 0.1) {
    albedo *= mix(1.0, 0.68, wetShore);
  }

  // --- 2. High-Contrast Sunset Direct Light & Long Shadows (长影与夕阳暖光) ---
  float rawNdotL = max(0.0, dot(N, L));
  float topBoost = step(0.5, baseN.y) * (0.68 + 0.22 * max(0.0, dot(N, L)));
  float NdotL = max(rawNdotL, topBoost);
  if (vFoliage > 0.1) {
    NdotL = max(NdotL, 0.62);
  }

  float shadow = sampleVoxelShadow(vWorldPos, baseN, L);
  if (baseN.y < 0.1 && dot(baseN, L) <= 0.0) {
    shadow = 0.0;
  }

  vec3 sunLightColor = vec3(1.55, 0.76, 0.26);
  vec3 directLight = sunLightColor * NdotL * shadow;

  // --- 3. PBR Grazing Fresnel Golden Rim-Light (掠射角菲涅尔金边高光) ---
  float NoV = clamp(dot(N, V), 0.02, 0.9999);
  float grazingFresnel = pow(1.0 - NoV, 3.6);
  float sunForward = pow(max(0.0001, dot(-V, L)), 3.0);
  vec3 rimHighlight = vec3(1.35, 0.68, 0.20) * grazingFresnel * (0.25 + 0.75 * sunForward) * shadow * 0.48;

  // --- 4. Anti-Solar Twilight Shadow Ambient (背阳粉紫/暮蓝阴影环境光) ---
  float skyUp = baseN.y * 0.5 + 0.5;
  float sunSide = dot(baseN.xz, L.xz) * 0.5 + 0.5;
  vec3 shadowZenith  = vec3(0.32, 0.24, 0.46);
  vec3 shadowHorizon = mix(vec3(0.24, 0.16, 0.36), vec3(0.44, 0.24, 0.24), sunSide);
  vec3 ambientLight  = mix(shadowHorizon, shadowZenith, skyUp) * 0.72;

  float faceShade = 1.0;
  if (abs(baseN.y) > 0.9) {
    faceShade = baseN.y > 0.0 ? 1.0 : 0.50;
  } else if (abs(baseN.x) > 0.9) {
    faceShade = 0.80;
  } else {
    faceShade = 0.90;
  }

  // --- 5. Foliage Subsurface Scattering (树叶与花草背光黄金透射) ---
  vec3 sssLight = vec3(0.0);
  if (vFoliage > 0.1) {
    float backLit = pow(max(0.0001, dot(-V, L)), 2.2);
    // Edge blocks of tree canopies (where vAo > 0.75) glow brightest when backlit!
    float canopyEdge = smoothstep(0.55, 0.98, vAo);
    sssLight = vec3(1.52, 0.72, 0.16) * backLit * canopyEdge * (0.22 + 0.78 * shadow) * 0.82;
  }

  // --- 6. Emissive Lantern Block Light (落日萤石灯温暖点光源) ---
  vec3 blockLight = vec3(1.85, 0.98, 0.36) * pow(max(0.0001, vLight), 1.25) * step(0.01, vLight) * 1.35;

  // Combine with crisp Voxel AO
  float aoFactor = mix(0.28, 1.0, vAo);
  vec3 litColor = albedo * ((ambientLight * faceShade + directLight + sssLight) * aoFactor + blockLight) + rimHighlight * aoFactor;

  // Wet-shore specular glint
  if (wetShore > 0.01 && baseN.y > 0.8 && shadow > 0.2) {
    vec3 H = normalize(L + V);
    float wetSpec = pow(max(0.0001, dot(N, H)), 32.0) * wetShore * shadow;
    litColor += vec3(1.30, 0.62, 0.18) * wetSpec * 0.55;
  }

  // --- 7. LAYERED VOLUMETRIC COASTAL MIST & DISTANCE FOG (山谷海湾动态体积薄雾) ---
  vec3 viewRay = -V;
  vec3 skyFogColor = computeSunsetAtmosphere(vec3(viewRay.x, max(0.015, viewRay.y), viewRay.z), L, uTime);

  // Drifting 3D mist bands in coastal valleys (below y=28)
  float mistWave = 0.65 + 0.35 * sin(vWorldPos.x * 0.08 + uTime * 0.35) * cos(vWorldPos.z * 0.08 - uTime * 0.25);
  float heightFactor = exp(-max(0.0, vWorldPos.y - uSeaLevel) * 0.105) * mistWave;
  float mistDistMask = smoothstep(22.0, 130.0, dist);
  float valleyMistAmount = mistDistMask * heightFactor * 0.42 * uMistIntensity;
  float sunScatter = pow(max(0.0001, dot(viewRay, L)), 4.5);
  vec3 valleyMistColor = mix(vec3(0.58, 0.30, 0.50), vec3(1.22, 0.58, 0.18), 0.28 + 0.72 * sunScatter);
  litColor = mix(litColor, valleyMistColor, clamp(valleyMistAmount, 0.0, 0.58));

  // Distance atmospheric haze
  float distFog = smoothstep(58.0, 225.0, dist);
  litColor = mix(litColor, skyFogColor, distFog * 0.82);

  gl_FragColor = vec4(clamp(litColor, vec3(0.0), vec3(12.0)), texColor.a);
}
`;

export function createVoxelMaterials(atlasTexture, sunDir) {
  const sharedUniforms = {
    uAtlas: { value: atlasTexture },
    uSunDir: { value: sunDir.clone().normalize() },
    uTime: { value: 0 },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uHasShadow: { value: 0.0 },
    uSeaLevel: { value: SEA_LEVEL },
    uMistIntensity: { value: 1.0 }
  };

  const solidMaterial = new THREE.ShaderMaterial({
    vertexShader: VOXEL_VERTEX_SHADER,
    fragmentShader: VOXEL_FRAGMENT_SHADER,
    uniforms: {
      ...sharedUniforms,
      uAlphaTest: { value: 0.0 }
    }
  });

  const cutoutMaterial = new THREE.ShaderMaterial({
    vertexShader: VOXEL_VERTEX_SHADER,
    fragmentShader: VOXEL_FRAGMENT_SHADER,
    uniforms: {
      ...sharedUniforms,
      uAlphaTest: { value: 0.5 }
    },
    side: THREE.DoubleSide
  });

  return {
    solidMaterial,
    cutoutMaterial,
    setMistIntensity(val) {
      solidMaterial.uniforms.uMistIntensity.value = val;
      cutoutMaterial.uniforms.uMistIntensity.value = val;
    },
    update(time, sunDir, shadowTexture, shadowMatrix) {
      solidMaterial.uniforms.uTime.value = time;
      cutoutMaterial.uniforms.uTime.value = time;
      if (sunDir) {
        solidMaterial.uniforms.uSunDir.value.copy(sunDir).normalize();
        cutoutMaterial.uniforms.uSunDir.value.copy(sunDir).normalize();
      }
      if (shadowTexture && shadowMatrix) {
        solidMaterial.uniforms.uShadowMap.value = shadowTexture;
        solidMaterial.uniforms.uShadowMatrix.value.copy(shadowMatrix);
        solidMaterial.uniforms.uHasShadow.value = 1.0;

        cutoutMaterial.uniforms.uShadowMap.value = shadowTexture;
        cutoutMaterial.uniforms.uShadowMatrix.value.copy(shadowMatrix);
        cutoutMaterial.uniforms.uHasShadow.value = 1.0;
      }
    }
  };
}
