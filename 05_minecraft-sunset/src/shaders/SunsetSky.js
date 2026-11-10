import * as THREE from 'three';

export const ATMOSPHERE_GLSL = /* glsl */ `
vec3 computeSunsetAtmosphere(vec3 dir, vec3 sunDir, float time) {
  vec3 d = normalize(dir);
  vec3 s = normalize(sunDir);

  float y = max(0.0, d.y);
  vec2 dHoriz = length(d.xz) > 0.0001 ? normalize(d.xz) : vec2(0.0, -1.0);
  vec2 sHoriz = length(s.xz) > 0.0001 ? normalize(s.xz) : vec2(0.0, -1.0);
  float azDot = dot(dHoriz, sHoriz);
  float sunward = smoothstep(-0.40, 0.94, azDot);
  float antiSolar = smoothstep(0.40, -0.92, azDot);

  // --- 1. Sunward Palette (朝阳金色: Deep Fiery Vermilion -> Molten Gold -> Sunset Coral -> Dusk Violet) ---
  vec3 sunHorizonLow  = vec3(1.18, 0.34, 0.05); // Deep fiery orange-crimson right on the sea line
  vec3 sunHorizonHigh = vec3(1.22, 0.66, 0.16); // Blazing golden-amber band
  vec3 sunMidSky      = vec3(0.82, 0.32, 0.44); // Warm sunset rose-magenta
  vec3 sunUpperSky    = vec3(0.24, 0.16, 0.40); // Deep twilight indigo-violet

  // --- 2. Anti-Solar Palette (背阳粉紫: Belt of Venus Rose-Magenta -> Amethyst -> Deep Night Indigo) ---
  vec3 backHorizonLow  = vec3(0.72, 0.26, 0.48);
  vec3 backHorizonHigh = vec3(0.84, 0.38, 0.64);
  vec3 backMidSky      = vec3(0.40, 0.20, 0.50);
  vec3 backUpperSky    = vec3(0.14, 0.10, 0.30);

  vec3 zenithColor = vec3(0.08, 0.09, 0.22);

  vec3 horizLow  = mix(backHorizonLow,  sunHorizonLow,  sunward);
  vec3 horizHigh = mix(backHorizonHigh, sunHorizonHigh, sunward);
  vec3 midSky    = mix(backMidSky,      sunMidSky,      sunward);
  vec3 upperSky  = mix(backUpperSky,    sunUpperSky,    sunward);

  float sideMask = clamp(1.0 - max(0.0, azDot), 0.0, 1.0);
  horizHigh = mix(horizHigh, vec3(0.88, 0.34, 0.56), sideMask * 0.55);
  midSky    = mix(midSky,    vec3(0.54, 0.22, 0.48), sideMask * 0.65);

  float h1 = smoothstep(0.0, 0.048, y);
  float h2 = smoothstep(0.040, 0.17, y);
  float h3 = smoothstep(0.14, 0.38, y);
  float h4 = smoothstep(0.34, 0.85, y);

  vec3 sky = mix(horizLow, horizHigh, h1);
  sky = mix(sky, midSky, h2);
  sky = mix(sky, upperSky, h3);
  sky = mix(sky, zenithColor, h4);

  // Anamorphic horizontal golden horizon glow + Mie forward scattering
  float cosTheta = max(0.0001, dot(d, s));
  float mieWide  = pow(cosTheta, 5.0) * exp(-y * 5.2);
  float mieTight = pow(cosTheta, 32.0) * exp(-y * 3.5);
  float horizStreak = exp(-y * 22.0) * pow(max(0.0001, azDot), 4.0);

  sky += vec3(0.95, 0.40, 0.08) * mieWide * 0.32;
  sky += vec3(1.10, 0.54, 0.12) * mieTight * 0.28;
  sky += vec3(1.20, 0.48, 0.10) * horizStreak * 0.35;

  // Anti-solar Belt of Venus pink-violet band
  float venusBand = exp(-pow((y - 0.075) / 0.065, 2.0)) * antiSolar;
  sky += vec3(0.24, 0.07, 0.18) * venusBand;

  return sky;
}
`;

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldDir;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldDir = worldPos.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
uniform float uSunRadius;
uniform float uCloudDensity;

varying vec3 vWorldDir;

${ATMOSPHERE_GLSL}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbmClouds(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = rot * p * 2.05 + vec2(19.3, 37.1);
    a *= 0.5;
  }
  return v;
}

// Evaluate 3D volumetric cloud density at (xz, heightFraction in [0..1])
float sampleCloudVolume(vec2 xz, float hFrac, float t) {
  vec2 wind = vec2(t * 0.0045, -t * 0.0022);
  float base = fbmClouds(xz * 1.15 + wind);
  float billow = fbmClouds(xz * 2.85 - wind * 1.6 + vec2(hFrac * 1.4));
  float shape = base * 0.72 + billow * 0.28;

  // Cumulus vertical profile: flat anvil base, rounded billowy tops
  float heightProfile = smoothstep(0.0, 0.22, hFrac) * smoothstep(1.0, 0.45, hFrac);
  float coverage = mix(0.56, 0.38, uCloudDensity);
  return max(0.0, shape - coverage) * heightProfile * 2.6;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  vec3 sunDir = normalize(uSunDir);

  vec3 color = computeSunsetAtmosphere(dir, sunDir, uTime);

  float cosAngle = clamp(dot(dir, sunDir), -1.0, 1.0);
  float angle = acos(cosAngle);

  // --- 1. THE CRISP, BLAZING ORANGE SUN DISK (清晰的橙色圆日, 低悬在海面上) ---
  // Rendered before clouds or with a clear window so the circular orange sun disk is 100% razor-sharp
  float sunWindow = smoothstep(uSunRadius * 1.25, uSunRadius * 2.65, angle);

  if (dir.y > -0.005) {
    float outerCorona = exp(-max(0.0, angle - uSunRadius) * 26.0);
    color += vec3(1.25, 0.44, 0.06) * outerCorona * 0.48;

    float diskMask = 1.0 - smoothstep(uSunRadius * 0.962, uSunRadius * 1.004, angle);
    if (diskMask > 0.001) {
      float r = clamp(angle / uSunRadius, 0.0, 1.0);
      float mu = sqrt(max(0.0, 1.0 - r * r));

      vec3 sunCenter = vec3(2.75, 1.22, 0.22);
      vec3 sunMid    = vec3(2.35, 0.76, 0.08);
      vec3 sunLimb   = vec3(1.85, 0.34, 0.02);

      vec3 sunDiskColor = mix(sunLimb, sunMid, smoothstep(0.0, 0.52, mu));
      sunDiskColor = mix(sunDiskColor, sunCenter, smoothstep(0.40, 1.0, mu));

      // Horizon atmospheric reddening & subtle ocean mirage striations on the lower third of the disk
      float vertGrad = clamp((dir.y - (sunDir.y - uSunRadius)) / (2.0 * uSunRadius), 0.0, 1.0);
      sunDiskColor *= mix(vec3(0.95, 0.56, 0.34), vec3(1.04, 1.0, 1.0), vertGrad);
      float mirageBand = 0.95 + 0.05 * sin(dir.y * 1100.0 + uTime * 2.0);
      sunDiskColor *= mix(mirageBand, 1.0, smoothstep(0.0, 0.38, vertGrad));

      color = mix(color, sunDiskColor, diskMask);
    }
  }

  // --- 2. 3D RAYMARCHED VOLUMETRIC SUNSET CLOUDS (Shaderpack 立体体积晚霞云层) ---
  if (dir.y > 0.016 && uCloudDensity > 0.01) {
    // High-altitude crimson-pink cirrus wisps first
    vec2 cirrusUV = dir.xz / (dir.y + 0.20) * vec2(0.85, 1.95) + vec2(-uTime * 0.0018, 0.0);
    float cirrus = smoothstep(0.58, 0.80, fbmClouds(cirrusUV * 2.2)) *
                   smoothstep(0.04, 0.25, dir.y) * (1.0 - smoothstep(0.45, 0.88, dir.y)) *
                   sunWindow * 0.42;
    vec2 dHoriz = length(dir.xz) > 0.0001 ? normalize(dir.xz) : vec2(0.0, -1.0);
    vec2 sHoriz = normalize(sunDir.xz);
    float azDot = dot(dHoriz, sHoriz);
    float sunward = smoothstep(-0.45, 0.92, azDot);

    vec3 cirrusColor = mix(vec3(0.88, 0.38, 0.64), vec3(1.32, 0.68, 0.22), sunward);
    color = mix(color, cirrusColor, cirrus);

    // 5-slice 3D Volumetric Cumulus Slab raymarching with Beer-Powder scattering & bottom rim-lighting
    float horizonFade = smoothstep(0.016, 0.085, dir.y);
    float zenithFade  = 1.0 - smoothstep(0.48, 0.92, dir.y);
    float cloudMask   = sunWindow * horizonFade * zenithFade;

    if (cloudMask > 0.01) {
      float transmittance = 1.0;
      vec3 cloudAccum = vec3(0.0);
      vec2 toSunStep = sHoriz * 0.055;

      for (int i = 0; i < 5; i++) {
        float hFrac = (float(i) + 0.5) / 5.0;
        float layerAlt = 1.0 + hFrac * 0.22;
        vec2 sliceXZ = (dir.xz / (dir.y + 0.11)) * 0.36 * layerAlt;

        float d = sampleCloudVolume(sliceXZ, hFrac, uTime) * cloudMask;
        if (d > 0.005) {
          // Sample density toward the sun for volumetric self-shadowing
          float dSun1 = sampleCloudVolume(sliceXZ + toSunStep, clamp(hFrac - 0.12, 0.05, 0.95), uTime);
          float dSun2 = sampleCloudVolume(sliceXZ + toSunStep * 2.2, clamp(hFrac - 0.22, 0.05, 0.95), uTime);
          float opticalDepthToSun = (dSun1 + dSun2) * 1.45;

          // Beer-Powder Law: bright glowing thin edges + deep sculptural dark bellies
          float beer = exp(-opticalDepthToSun);
          float powder = 1.0 - exp(-d * 3.8) * 0.55;
          float lightEnergy = beer * powder;

          // Bottom-lit golden-scarlet sunset glow on lower slices (hFrac < 0.45)
          float bottomLit = (1.0 - hFrac) * beer;

          vec3 deepShadowCol = mix(vec3(0.18, 0.11, 0.30), vec3(0.34, 0.14, 0.26), sunward);
          vec3 midCloudCol   = mix(vec3(0.76, 0.34, 0.58), vec3(1.18, 0.46, 0.16), sunward);
          vec3 goldRimCol    = vec3(1.65, 0.82, 0.22) * pow(max(0.0001, cosAngle), 4.0);

          vec3 sliceCol = mix(deepShadowCol, midCloudCol, lightEnergy);
          sliceCol += vec3(1.42, 0.58, 0.14) * bottomLit * sunward * 0.68;
          sliceCol += goldRimCol * beer * 0.62;

          float sliceAlpha = 1.0 - exp(-d * 0.85);
          cloudAccum += transmittance * sliceCol * sliceAlpha;
          transmittance *= (1.0 - sliceAlpha);
          if (transmittance < 0.04) break;
        }
      }

      color = color * transmittance + cloudAccum;
    }
  }

  gl_FragColor = vec4(clamp(color, vec3(0.0), vec3(12.0)), 1.0);
}
`;

export class SunsetSky {
  constructor(scene, sunDir) {
    this.sunDir = sunDir.clone().normalize();
    this.uniforms = {
      uSunDir: { value: this.sunDir },
      uTime: { value: 0 },
      uSunRadius: { value: 0.056 },
      uCloudDensity: { value: 0.65 }
    };

    const geo = new THREE.SphereGeometry(2200, 64, 48);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }

  update(time, cameraPos, sunDir) {
    this.uniforms.uTime.value = time;
    if (sunDir) {
      this.uniforms.uSunDir.value.copy(sunDir).normalize();
    }
    if (cameraPos) {
      this.mesh.position.copy(cameraPos);
    }
  }
}
