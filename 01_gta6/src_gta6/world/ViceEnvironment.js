import * as THREE from 'three';

// ============================================================================
// GTA VI: Vice City (Leonida) — Atmosphere, Sky Dome & Vice Beach Ocean Shader
// Recreates the iconic GTA 6 Trailer 1 pink-magenta-gold sunset, neon night,
// tropical noon, and Vice rainstorm, plus animated Vice Beach ocean waves.
// ============================================================================

export const WEATHER_PRESETS = [
  {
    id: 'vice_sunset',
    name: 'Trailer 1 · 罪恶粉金日落',
    zenithColor: new THREE.Color('#23134a'),
    midSkyColor: new THREE.Color('#9c2c77'),
    horizonColor: new THREE.Color('#ff7b47'),
    sunColor: new THREE.Color('#ffe28a'),
    sunPos: new THREE.Vector3(0.75, 0.13, -0.64).normalize(),
    ambientColor: new THREE.Color('#ff8cd9'),
    ambientIntensity: 0.85,
    sunIntensity: 2.3,
    fogColor: new THREE.Color('#5a2254'),
    fogDensity: 0.0016,
    nightFactor: 0.45,
    rainFactor: 0.0,
    roadWetness: 0.35
  },
  {
    id: 'neon_night',
    name: 'Ocean Drive · 霓虹午夜',
    zenithColor: new THREE.Color('#050514'),
    midSkyColor: new THREE.Color('#130f36'),
    horizonColor: new THREE.Color('#471657'),
    sunColor: new THREE.Color('#a6c8ff'),
    sunPos: new THREE.Vector3(-0.4, 0.35, -0.82).normalize(),
    ambientColor: new THREE.Color('#5844a8'),
    ambientIntensity: 0.65,
    sunIntensity: 0.65,
    fogColor: new THREE.Color('#140d2b'),
    fogDensity: 0.0019,
    nightFactor: 1.0,
    rainFactor: 0.0,
    roadWetness: 0.65
  },
  {
    id: 'tropical_noon',
    name: 'Leonida · 热带艳阳正午',
    zenithColor: new THREE.Color('#0066cc'),
    midSkyColor: new THREE.Color('#32a4ff'),
    horizonColor: new THREE.Color('#a8f2ff'),
    sunColor: new THREE.Color('#fff9e6'),
    sunPos: new THREE.Vector3(0.5, 0.78, -0.35).normalize(),
    ambientColor: new THREE.Color('#b8e6ff'),
    ambientIntensity: 1.15,
    sunIntensity: 2.6,
    fogColor: new THREE.Color('#8cd9ff'),
    fogDensity: 0.0011,
    nightFactor: 0.0,
    rainFactor: 0.0,
    roadWetness: 0.08
  },
  {
    id: 'vice_storm',
    name: 'Vice Storm · 暴雨霓虹倒影',
    zenithColor: new THREE.Color('#0a0c1d'),
    midSkyColor: new THREE.Color('#1d1d3b'),
    horizonColor: new THREE.Color('#4c265e'),
    sunColor: new THREE.Color('#d28eff'),
    sunPos: new THREE.Vector3(0.6, 0.18, -0.75).normalize(),
    ambientColor: new THREE.Color('#665499'),
    ambientIntensity: 0.72,
    sunIntensity: 0.9,
    fogColor: new THREE.Color('#211738'),
    fogDensity: 0.0028,
    nightFactor: 0.88,
    rainFactor: 1.0,
    roadWetness: 1.0
  }
];

export class ViceEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.presetIndex = 0;
    this.currentPreset = WEATHER_PRESETS[0];
    this.time = 0;

    this._initLights();
    this._initSkyDome();
    this._initOcean();
    this._initRainSystem();
    this.applyPreset(0);
  }

  _initLights() {
    this.ambientLight = new THREE.HemisphereLight(0xff99dd, 0x241734, 0.95);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffb86c, 2.3);
    this.sunLight.position.set(160, 95, -140);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    const d = 165;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.scene.fog = new THREE.FogExp2(0x5a2254, 0.0016);
  }

  _initSkyDome() {
    const skyGeo = new THREE.SphereGeometry(1400, 48, 32);
    this.skyUniforms = {
      uTime: { value: 0 },
      uZenithColor: { value: new THREE.Color('#23134a') },
      uMidSkyColor: { value: new THREE.Color('#9c2c77') },
      uHorizonColor: { value: new THREE.Color('#ff7b47') },
      uSunColor: { value: new THREE.Color('#ffe28a') },
      uSunDir: { value: new THREE.Vector3(0.75, 0.13, -0.64).normalize() },
      uNightFactor: { value: 0.45 }
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uZenithColor;
        uniform vec3 uMidSkyColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uNightFactor;
        varying vec3 vWorldPos;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            v += amp * noise(p);
            p *= 2.03;
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = clamp(dir.y, 0.0, 1.0);

          // Multi-band GTA 6 Leonida gradient
          vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.28, y));
          col = mix(col, uZenithColor, smoothstep(0.22, 0.85, y));

          // Sun disc + synthwave retro horizontal scanlines in the sun core
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float sunGlow = pow(sunDot, 7.0) * 0.55 + pow(sunDot, 48.0) * 0.7;
          float sunDisc = smoothstep(0.9965, 0.9982, sunDot);
          float scanline = 0.75 + 0.25 * sin(dir.y * 420.0);
          col += uSunColor * (sunGlow + sunDisc * 2.2 * scanline);

          // Tropical volumetric clouds
          if (dir.y > 0.02) {
            vec2 cloudUV = dir.xz / (dir.y + 0.18) * 1.4 + vec2(uTime * 0.012, -uTime * 0.006);
            float c = fbm(cloudUV);
            float cloudMask = smoothstep(0.46, 0.76, c) * smoothstep(0.02, 0.16, dir.y) * (1.0 - smoothstep(0.65, 0.95, dir.y));
            vec3 cloudLit = mix(uMidSkyColor * 0.85, uHorizonColor * 1.35 + uSunColor * 0.35, pow(sunDot, 2.0));
            col = mix(col, cloudLit, cloudMask * 0.68);
          }

          // Stars at dusk/night
          if (uNightFactor > 0.15 && dir.y > 0.12) {
            vec2 starCell = floor(dir.xz / (dir.y + 0.1) * 190.0);
            float s = hash(starCell);
            if (s > 0.994) {
              float twinkle = 0.55 + 0.45 * sin(uTime * 3.5 + s * 100.0);
              col += vec3(1.0, 0.92, 0.98) * twinkle * uNightFactor * smoothstep(0.12, 0.4, dir.y);
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
  }

  _initOcean() {
    // East of Vice Beach (x > 118) is the Atlantic / Leonida Ocean
    const oceanGeo = new THREE.PlaneGeometry(900, 1200, 140, 140);
    oceanGeo.rotateX(-Math.PI / 2);

    this.oceanUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.75, 0.13, -0.64).normalize() },
      uSunColor: { value: new THREE.Color('#ffe28a') },
      uHorizonColor: { value: new THREE.Color('#ff7b47') },
      uShoreX: { value: 120.0 }
    };

    const oceanMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: this.oceanUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying float vWaveHeight;

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float w1 = sin(wp.x * 0.11 + uTime * 1.8) * 0.32;
          float w2 = cos(wp.z * 0.09 - uTime * 1.35) * 0.24;
          float w3 = sin((wp.x + wp.z) * 0.18 + uTime * 2.4) * 0.12;
          float shoreFade = smoothstep(115.0, 142.0, wp.x);
          wp.y += (w1 + w2 + w3) * shoreFade;
          vWaveHeight = wp.y;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uHorizonColor;
        uniform float uShoreX;
        varying vec3 vWorldPos;
        varying float vWaveHeight;

        void main() {
          float distFromShore = vWorldPos.x - uShoreX;
          // Turquoise shallow water blending into deep Atlantic sapphire
          vec3 shallowCol = vec3(0.04, 0.76, 0.78);
          vec3 deepCol = vec3(0.03, 0.16, 0.42);
          float depthFactor = smoothstep(0.0, 95.0, distFromShore);
          vec3 waterCol = mix(shallowCol, deepCol, depthFactor);

          // Procedural wave normal approximation
          float nx = cos(vWorldPos.x * 0.22 + uTime * 2.1) * 0.16 + sin(vWorldPos.z * 0.18 - uTime * 1.6) * 0.12;
          float nz = sin(vWorldPos.z * 0.25 + uTime * 1.9) * 0.16;
          vec3 N = normalize(vec3(nx, 1.0, nz));

          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunDir);
          vec3 H = normalize(V + L);

          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          float spec = pow(max(dot(N, H), 0.0), 96.0) * 2.4;
          float glitter = pow(max(dot(N, H), 0.0), 18.0) * 0.45;

          // Animated white shoreline foam on Vice Beach
          float foamWave = sin(distFromShore * 0.45 + uTime * 2.8 + sin(vWorldPos.z * 0.08) * 3.0);
          float shoreFoam = smoothstep(18.0, -2.0, distFromShore) * smoothstep(0.25, 0.85, foamWave);
          float crestFoam = smoothstep(0.36, 0.62, vWaveHeight) * 0.35;

          vec3 col = mix(waterCol, uHorizonColor * 0.85, fresnel * 0.65);
          col += uSunColor * (spec + glitter);
          col = mix(col, vec3(0.98, 0.96, 1.0), clamp(shoreFoam + crestFoam, 0.0, 1.0));

          float alpha = smoothstep(-6.0, 4.0, distFromShore) * 0.92;
          gl_FragColor = vec4(col, alpha);
        }
      `
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.set(540, -0.35, 0);
    this.scene.add(this.oceanMesh);
  }

  _initRainSystem() {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 55;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd8c8ff,
      size: 0.32,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  getWaterHeight(x, z) {
    if (x < 118) return -10.0;
    const shoreFade = Math.min(1, Math.max(0, (x - 115) / 27));
    const w1 = Math.sin(x * 0.11 + this.time * 1.8) * 0.32;
    const w2 = Math.cos(z * 0.09 - this.time * 1.35) * 0.24;
    return -0.35 + (w1 + w2) * shoreFade;
  }

  applyPreset(index) {
    this.presetIndex = ((index % WEATHER_PRESETS.length) + WEATHER_PRESETS.length) % WEATHER_PRESETS.length;
    const p = WEATHER_PRESETS[this.presetIndex];
    this.currentPreset = p;

    this.skyUniforms.uZenithColor.value.copy(p.zenithColor);
    this.skyUniforms.uMidSkyColor.value.copy(p.midSkyColor);
    this.skyUniforms.uHorizonColor.value.copy(p.horizonColor);
    this.skyUniforms.uSunColor.value.copy(p.sunColor);
    this.skyUniforms.uSunDir.value.copy(p.sunPos);
    this.skyUniforms.uNightFactor.value = p.nightFactor;

    this.oceanUniforms.uSunDir.value.copy(p.sunPos);
    this.oceanUniforms.uSunColor.value.copy(p.sunColor);
    this.oceanUniforms.uHorizonColor.value.copy(p.horizonColor);

    this.ambientLight.color.copy(p.ambientColor);
    this.ambientLight.intensity = p.ambientIntensity;
    this.sunLight.color.copy(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;

    this.scene.fog.color.copy(p.fogColor);
    this.scene.fog.density = p.fogDensity;

    this.rainPoints.visible = p.rainFactor > 0.1;
    return p;
  }

  cycleWeather() {
    return this.applyPreset(this.presetIndex + 1);
  }

  update(dt, focusPos) {
    this.time += dt;
    this.skyUniforms.uTime.value = this.time;
    this.oceanUniforms.uTime.value = this.time;

    if (focusPos) {
      this.skyMesh.position.set(focusPos.x, 0, focusPos.z);
      const sunDir = this.currentPreset.sunPos;
      this.sunLight.position.set(
        focusPos.x + sunDir.x * 180,
        Math.max(45, sunDir.y * 220),
        focusPos.z + sunDir.z * 180
      );
      this.sunLight.target.position.set(focusPos.x, 0, focusPos.z);
      this.sunLight.target.updateMatrixWorld();

      if (this.rainPoints.visible) {
        this.rainPoints.position.set(focusPos.x, 0, focusPos.z);
        const posAttr = this.rainPoints.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          let y = posAttr.getY(i) - dt * 42;
          if (y < 0) y += 55;
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }
    }
  }
}
