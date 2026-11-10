import * as THREE from 'three';
import { SUN_DIR, SHADOW_SUN_DIR, WORLD_CONFIG } from '../config.js';
import { ATMOSPHERE_GLSL } from './AtmosphereCommon.js';

const { WATER_SURFACE_Y, SEA_LEVEL, SHADOW_MAP_SIZE } = WORLD_CONFIG;
const OUTER_EXTENT = 3550;

export class OceanRenderer {
  constructor(scene, shadowSystem) {
    this.scene = scene;

    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR.clone() },
      uShadowSunDir: { value: SHADOW_SUN_DIR.clone() },
      uShadowMap: { value: shadowSystem.depthTexture },
      uShadowMatrix: { value: shadowSystem.shadowMatrix },
      uSeaLevel: { value: SEA_LEVEL },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
      vertexShader: /* glsl */ `
        attribute vec2 aWaterInfo; // x = water column depth, y = shoreline foam factor
        uniform float uTime;

        varying vec3 vWorldPos;
        varying vec2 vWaterInfo;

        void main() {
          vWaterInfo = aWaterInfo;
          vec4 wp = modelMatrix * vec4(position, 1.0);

          // Fade vertex displacement smoothly before the 152m chunk border so chunk water & outer horizon sea meet with 0.000m seam!
          float camDistXZ = length(wp.xz - cameraPosition.xz);
          float nearCam = 1.0 - smoothstep(45.0, 110.0, camDistXZ);
          float deepFactor = smoothstep(1.0, 4.0, aWaterInfo.x) * (1.0 - aWaterInfo.y) * nearCam;
          float swell = sin(wp.x * 0.16 + wp.z * 0.22 + uTime * 1.45) * 0.045
                      + cos(wp.x * 0.29 - wp.z * 0.19 + uTime * 1.95) * 0.028;
          wp.y += swell * deepFactor;

          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uShadowSunDir;
        uniform sampler2D uShadowMap;
        uniform mat4 uShadowMatrix;
        uniform float uSeaLevel;

        varying vec3 vWorldPos;
        varying vec2 vWaterInfo;

        ${ATMOSPHERE_GLSL}

        // Fast Shadow lookup on water surface so coastal cliffs & trees cast shadows across the bay!
        float sampleWaterShadow(vec3 worldPos) {
          vec4 sc = uShadowMatrix * vec4(worldPos + vec3(0.0, 0.06, 0.0), 1.0);
          vec3 proj = (sc.xyz / sc.w) * 0.5 + 0.5;
          float edgeDist = max(abs(proj.x - 0.5), abs(proj.y - 0.5));
          if (edgeDist >= 0.49 || proj.z >= 0.998 || proj.z <= 0.001) return 1.0;

          float r = 2.2 / ${SHADOW_MAP_SIZE.toFixed(1)};
          float lit = 0.0;
          lit += (proj.z - 0.0009 <= texture2D(uShadowMap, proj.xy + vec2(-r, -r)).r) ? 1.0 : 0.0;
          lit += (proj.z - 0.0009 <= texture2D(uShadowMap, proj.xy + vec2( r, -r)).r) ? 1.0 : 0.0;
          lit += (proj.z - 0.0009 <= texture2D(uShadowMap, proj.xy + vec2(-r,  r)).r) ? 1.0 : 0.0;
          lit += (proj.z - 0.0009 <= texture2D(uShadowMap, proj.xy + vec2( r,  r)).r) ? 1.0 : 0.0;
          lit *= 0.25;

          return mix(lit, 1.0, smoothstep(0.42, 0.49, edgeDist));
        }

        // Multi-octave directional ocean wave normal aligned to generate rich sunset ripples
        vec3 computeWaveNormal(vec2 p, float dist, vec2 sunFwd, vec2 sunRight) {
          float u = dot(p, sunFwd);
          float v = dot(p, sunRight);

          // Attenuate high-frequency ripples smoothly over distance to prevent horizon shimmering
          float nearDetail = exp(-dist * 0.0095);
          float midDetail = exp(-dist * 0.0028);

          // 5 interfering wave octaves (swell rolling in from the sunset sea + cross-chop)
          float du = 0.0;
          float dv = 0.0;

          // Octave 1: Primary ocean swell
          float ph1 = u * 0.52 + sin(v * 0.09) * 1.4 + uTime * 1.55;
          du += cos(ph1) * 0.095 * midDetail;
          dv += cos(ph1) * cos(v * 0.09) * 0.022 * midDetail;

          // Octave 2: Cross-swell
          float ph2 = u * 0.92 + v * 0.34 + uTime * 2.15;
          du += cos(ph2) * 0.072 * midDetail;
          dv += cos(ph2) * 0.028 * midDetail;

          // Octave 3: Counter chop
          float ph3 = u * 1.65 - v * 0.48 + uTime * 2.85;
          du += cos(ph3) * 0.058 * nearDetail;
          dv -= cos(ph3) * 0.024 * nearDetail;

          // Octave 4: Fine capillary wind glitter
          float ph4 = u * 3.40 + v * 1.15 - uTime * 3.60;
          du += cos(ph4) * 0.045 * nearDetail;
          dv += cos(ph4) * 0.020 * nearDetail;

          // Octave 5: Crisp micro-facets
          float ph5 = u * 6.20 - v * 2.10 + uTime * 4.40;
          du += cos(ph5) * 0.032 * nearDetail;
          dv -= cos(ph5) * 0.015 * nearDetail;

          vec2 gradXZ = sunFwd * du + sunRight * dv;
          return normalize(vec3(-gradXZ.x, 1.0, -gradXZ.y));
        }

        void main() {
          vec3 toEye = cameraPosition - vWorldPos;
          float dist = length(toEye);
          vec3 V = toEye / max(dist, 0.001);

          vec2 sunFwd = normalize(uSunDir.xz);
          vec2 sunRight = vec2(-sunFwd.y, sunFwd.x);

          vec3 N = computeWaveNormal(vWorldPos.xz, dist, sunFwd, sunRight);
          float shadow = sampleWaterShadow(vWorldPos);

          // 1. Schlick Fresnel reflection factor (water F0 = 0.02 -> 1.0 at horizon grazing angles!)
          float ndotv = clamp(dot(N, V), 0.001, 1.0);
          float fresnel = 0.022 + 0.978 * pow(1.0 - ndotv, 5.0);

          // 2. Reflected Twilight Sky Color
          vec3 R = reflect(-V, N);
          R.y = abs(R.y) * 0.85 + 0.012; // Keep wave reflections sampling above horizon
          vec3 skyRefl = evalTwilightSky(R, uSunDir);

          // 3. Shallow Turquoise Lagoon vs Deep Twilight Sea Body Color (0 shallowFactor for depth >= 7 matches outer sea 100%)
          float depth = vWaterInfo.x;
          float shallowFactor = 1.0 - smoothstep(1.0, 7.0, depth);
          vec3 deepWaterCol = vec3(0.010, 0.032, 0.068);
          vec3 shallowWaterCol = vec3(0.028, 0.145, 0.135) * (0.45 + 0.75 * shadow);
          vec3 waterBody = mix(deepWaterCol, shallowWaterCol, shallowFactor);

          vec3 col = mix(waterBody, skyRefl, clamp(fresnel * 1.08, 0.0, 0.96));

          // 4. THE GOLDEN SUN-ROAD ("海面反射出一条通向地平线的日光路")
          // Combine crisp near-field wave facet specular + continuous anisotropic Beckmann horizon glitter path!
          vec3 H = normalize(V + uSunDir);

          // (a) Crisp sparkling wave-facet highlights
          float specSharp = pow(max(dot(N, H), 0.0), 260.0);
          float specMed = pow(max(dot(N, H), 0.0), 42.0);

          // (b) Anisotropic slope-distribution Sun-Road reaching 100% to the distant horizon!
          // Decompose half-vector tilt relative to flat sea normal (0,1,0) along & across sun azimuth:
          vec3 Hflat = normalize(V + vec3(uSunDir.x, max(uSunDir.y, 0.065), uSunDir.z));
          float slopeAlong = dot(Hflat.xz, sunFwd) / max(Hflat.y, 0.08);
          float slopeAcross = dot(Hflat.xz, sunRight) / max(Hflat.y, 0.08);

          // Wave-modulated shimmer so even the far sun-road breathes & sparkles with crisp horizontal wave bars
          float uCoord = dot(vWorldPos.xz, sunFwd);
          float vCoord = dot(vWorldPos.xz, sunRight);
          float waveBars = 0.62 + 0.48 * sin(uCoord * 0.58 + uTime * 2.3 + sin(vCoord * 0.22) * 2.2)
                                + 0.28 * cos(uCoord * 1.45 - vCoord * 0.45 + uTime * 3.4);
          waveBars = clamp(waveBars, 0.15, 1.45);

          float alphaAlong = 0.26;  // Spreads reflection all the way from foreground beach to horizon!
          float alphaAcross = 0.056 + 0.016 * exp(-dist * 0.008); // Focused shimmering sun-road ribbon!
          float beckmannExponent = -(slopeAlong * slopeAlong) / (alphaAlong * alphaAlong)
                                   -(slopeAcross * slopeAcross) / (alphaAcross * alphaAcross);
          float sunRoad = exp(beckmannExponent) * waveBars;

          // Ensure player is looking toward the sun hemisphere
          float facingSun = smoothstep(-0.1, 0.35, dot(normalize(vec2(-V.x, -V.z)), sunFwd));
          sunRoad *= facingSun * (0.35 + 0.65 * fresnel);

          vec3 moltenGold = vec3(2.35, 0.58, 0.045);
          vec3 warmAmber = vec3(1.25, 0.32, 0.032);

          vec3 sunGlitter = moltenGold * (specSharp * 2.2 + sunRoad * 1.12)
                          + warmAmber * (specMed * 0.36);
          col += sunGlitter * (0.12 + 0.88 * shadow);

          // 5. Animated Lapping Shoreline Surf Foam around beaches & sea stacks
          float shore = vWaterInfo.y;
          if (shore > 0.01) {
            float waveLap = sin(shore * 9.0 - uTime * 2.6 + sin(vWorldPos.x * 0.7 + vWorldPos.z * 0.7) * 1.5);
            float foamLine = smoothstep(0.22, 0.75, shore + waveLap * 0.16 * shore);
            vec3 foamCol = mix(vec3(0.28, 0.22, 0.32), vec3(1.15, 0.68, 0.32), 0.35 + 0.65 * shadow);
            col = mix(col, foamCol, foamLine * 0.68);
          }

          // 6. Seamless Atmospheric Horizon Blend (matches SunsetSky 100% at dist -> 3500m!)
          vec3 eyeToFrag = -V;
          vec3 horizonMistDir = normalize(vec3(eyeToFrag.x, max(eyeToFrag.y, 0.003), eyeToFrag.z));
          vec3 horizonSky = evalTwilightSky(horizonMistDir, uSunDir);
          float farBlend = smoothstep(260.0, 3350.0, dist);
          // Also subtle warm sea-haze over mid-distances
          float seaHaze = (1.0 - exp(-max(dist - 35.0, 0.0) * 0.0018)) * 0.45;
          col = mix(col, horizonSky, clamp(seaHaze + farBlend, 0.0, 1.0));

          // Water opacity: translucent over shallow beach sand, 100% opaque in deep sea (depth >= 7) for zero chunk-border seam!
          float alpha = clamp(mix(1.0, 0.62 + fresnel * 0.35, shallowFactor) + farBlend, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    // Build 4 outer horizon ocean strips (North, South, West, East) surrounding active voxel chunks
    this.outerGroup = new THREE.Group();
    this.strips = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this._createStripGeo(0, 0, 10, 10), this.material);
      mesh.frustumCulled = false;
      this.outerGroup.add(mesh);
      this.strips.push(mesh);
    }
    this.scene.add(this.outerGroup);

    this._lastBoundsKey = '';
  }

  _createStripGeo(x0, z0, x1, z1) {
    // Subdivide slightly so vertex swell & perspective interpolation stay smooth
    const segX = Math.max(1, Math.min(32, Math.round((x1 - x0) / 140)));
    const segZ = Math.max(1, Math.min(32, Math.round((z1 - z0) / 140)));
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) * 0.5, WATER_SURFACE_Y, (z0 + z1) * 0.5);

    const count = geo.attributes.position.count;
    const info = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      info[i * 2] = 12.0; // Deep ocean
      info[i * 2 + 1] = 0.0;
    }
    geo.setAttribute('aWaterInfo', new THREE.BufferAttribute(info, 2));
    return geo;
  }

  update(elapsed, loadedBounds) {
    this.uniforms.uTime.value = elapsed;

    const { minX, maxX, minZ, maxZ } = loadedBounds;
    const key = `${minX},${maxX},${minZ},${maxZ}`;
    if (key !== this._lastBoundsKey) {
      this._lastBoundsKey = key;
      const E = OUTER_EXTENT;
      const rects = [
        [-E, -E, E, minZ],       // North (-Z, sunset ocean!)
        [-E, maxZ, E, E],        // South (+Z)
        [-E, minZ, minX, maxZ],  // West (-X)
        [maxX, minZ, E, maxZ],   // East (+X)
      ];
      for (let i = 0; i < 4; i++) {
        const [x0, z0, x1, z1] = rects[i];
        this.strips[i].geometry.dispose();
        this.strips[i].geometry = this._createStripGeo(x0, z0, x1, z1);
      }
    }
  }
}
