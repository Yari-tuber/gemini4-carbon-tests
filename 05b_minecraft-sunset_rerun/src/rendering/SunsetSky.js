import * as THREE from 'three';
import { SUN_DIR } from '../config.js';
import { ATMOSPHERE_GLSL } from './AtmosphereCommon.js';

export class SunsetSky {
  constructor(scene) {
    this.uniforms = {
      uSunDir: { value: SUN_DIR.clone() },
      uTime: { value: 0 },
    };

    const geo = new THREE.SphereGeometry(3800, 48, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 0.0);
          gl_Position = projectionMatrix * vec4(mvPos.xyz, 1.0);
          gl_Position.z = gl_Position.w * 0.99999;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform float uTime;
        varying vec3 vWorldDir;

        ${ATMOSPHERE_GLSL}

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float cloudFbm(vec2 p) {
          vec2 qb = floor(p * 6.5) / 6.5;
          vec2 q = mix(p, qb, 0.16);
          float v = 0.0;
          float amp = 0.52;
          for (int i = 0; i < 4; i++) {
            v += amp * vnoise(q);
            q = q * 2.07 + vec2(13.1, -7.7);
            amp *= 0.48;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          vec3 col = evalTwilightSky(dir, uSunDir);

          // Subtle early-twilight stars in the deep violet upper sky
          if (dir.y > 0.24) {
            vec2 starCell = floor(dir.xz / (dir.y + 0.4) * 260.0);
            float starRand = hash21(starCell);
            if (starRand > 0.9965) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + starRand * 80.0);
              float starVis = smoothstep(0.26, 0.72, dir.y) * smoothstep(0.35, -0.35, dot(dir, uSunDir));
              col += vec3(0.55, 0.62, 0.88) * twinkle * starVis * 0.55;
            }
          }

          // 1. Shader-Pack Volumetric Sunset Clouds (behind/framing the sun, cleared around solar disc!)
          float cosTheta = dot(dir, uSunDir);
          if (dir.y > 0.018) {
            float planeDist = 1.0 / (dir.y + 0.085);
            vec2 cloudUV = dir.xz * planeDist * 1.45 + vec2(uTime * 0.0075, uTime * 0.0032);

            float densityBase = cloudFbm(cloudUV);
            // Gently thin clouds across a broad 35-degree region toward the low sun (zero circular cutout!)
            float sunClearWindow = smoothstep(0.80, 0.996, cosTheta);
            float density = smoothstep(0.50 + sunClearWindow * 0.20, 0.78, densityBase);
            float horizonFade = smoothstep(0.018, 0.11, dir.y);
            density *= horizonFade * 0.86;

            if (density > 0.002) {
              vec2 sunStep = normalize(uSunDir.xz) * 0.085;
              float occ = cloudFbm(cloudUV + sunStep);
              float lit = clamp(1.0 - smoothstep(0.45, 0.78, occ) * 0.85, 0.0, 1.0);

              float sunPhase = max(cosTheta, 0.0);
              vec3 cloudShadow = mix(
                vec3(0.095, 0.055, 0.155), // Anti-solar plum-violet cloud tops
                vec3(0.24, 0.085, 0.145),  // Dusty rose-magenta cloud backs
                pow(sunPhase, 1.4)
              );
              vec3 cloudSunlit = mix(
                vec3(0.72, 0.22, 0.085),   // Warm coral-amber cloud bellies
                vec3(1.22, 0.38, 0.065),   // Rich sunset orange-gold cloud rims
                pow(sunPhase, 3.5)
              );
              float edgeLining = (1.0 - density) * pow(sunPhase, 12.0) * 0.65;
              vec3 cloudCol = mix(cloudShadow, cloudSunlit, lit) + vec3(0.95, 0.32, 0.05) * edgeLining;

              col = mix(col, cloudCol, density);
            }
          }

          // 2. ICONIC CRISP ORANGE SOLAR DISC ("太阳是一颗清晰的橙色圆日,低悬在海面上")
          // Angular radius ~2.65 degrees -> bold, razor-clear circular orange sun low over the sea!
          float cosRadius = 0.99893;
          if (dir.y > -0.005) {
            // Tightly anti-aliased circular edge (~2 pixels wide)
            float sunMask = smoothstep(cosRadius - 0.00010, cosRadius + 0.00008, cosTheta);
            if (sunMask > 0.001) {
              float radial = sqrt(clamp(1.0 - (1.0 - cosTheta) / (1.0 - cosRadius), 0.0, 1.0));
              float vertGrad = clamp((dir.y - (uSunDir.y - 0.046)) / 0.092, 0.0, 1.0);

              // Deep saturated sunset orange chromaticity (low G/R & near-zero B so it NEVER washes to yellow-white!)
              vec3 sunCore = vec3(2.45, 0.56, 0.038);  // Radiant molten tangerine-orange center
              vec3 sunLimb = vec3(1.72, 0.21, 0.008);  // Crisp vermilion-orange edge
              vec3 sunCol = mix(sunLimb, sunCore, pow(radial, 0.65));
              // Atmospheric extinction makes the bottom rim of the low sun slightly deeper crimson-orange
              sunCol *= mix(vec3(0.92, 0.68, 0.50), vec3(1.05, 1.08, 1.05), vertGrad);

              float aboveHorizon = smoothstep(-0.002, 0.003, dir.y);
              col = mix(col, sunCol, sunMask * aboveHorizon);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  update(elapsed) {
    this.uniforms.uTime.value = elapsed;
  }
}
