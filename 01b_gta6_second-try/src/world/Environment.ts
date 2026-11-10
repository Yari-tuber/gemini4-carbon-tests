import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { WeatherMode } from '../types';

export class Environment {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;
  public useUltraQuality = true;

  public timeOfDay = 18.25; // Iconic Vice City Sunset start (18:15)
  public timeSpeed = 0.035; // Smooth real-time progression
  public weather: WeatherMode = 'sunset';

  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public fog: THREE.FogExp2;

  private skyUniforms: {
    uTime: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uZenithColor: { value: THREE.Color };
    uMidColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uNightFactor: { value: number };
    uCloudDensity: { value: number };
  };
  private skyMesh: THREE.Mesh;

  private oceanUniforms: {
    uTime: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uSkyHorizon: { value: THREE.Color };
    uDeepColor: { value: THREE.Color };
    uShallowColor: { value: THREE.Color };
  };
  private oceanMesh: THREE.Mesh;

  // Rain particle system
  private rainLines: THREE.LineSegments;
  private rainPositions: Float32Array;
  private readonly rainCount = 900;

  // Shared road material reference so rain/night can make asphalt extra glossy
  public roadMaterial: THREE.MeshStandardMaterial | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.fog = new THREE.FogExp2(0x3a1c4a, 0.00145);
    this.scene.fog = this.fog;

    // Hemisphere ambient bounce
    this.hemiLight = new THREE.HemisphereLight(0xff85b3, 0x2b213a, 0.85);
    this.scene.add(this.hemiLight);

    // Directional Sun/Moon with player-following crisp shadow map
    this.sunLight = new THREE.DirectionalLight(0xff9e64, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 280;
    const d = 95;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Sky Shader Dome
    this.skyUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.85, 0.16, -0.3).normalize() },
      uZenithColor: { value: new THREE.Color(0x1b0e3d) },
      uMidColor: { value: new THREE.Color(0xc92a82) },
      uHorizonColor: { value: new THREE.Color(0xff8c42) },
      uSunColor: { value: new THREE.Color(0xffe066) },
      uNightFactor: { value: 0.15 },
      uCloudDensity: { value: 0.42 }
    };

    const skyGeo = new THREE.SphereGeometry(1150, 40, 28);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uNightFactor;
        uniform float uCloudDensity;
        varying vec3 vWorldDir;

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
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);

          vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.26, h));
          col = mix(col, uZenithColor, smoothstep(0.22, 0.82, h));

          // Sun disc with Vice retro horizontal scanlines near horizon + warm halo
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunAmt, 12.0) * 0.42;
          col += uSunColor * pow(sunAmt, 90.0) * 0.85;
          if (sunAmt > 0.9978) {
            float stripe = step(0.18, fract(dir.y * 150.0));
            col = mix(col, uSunColor * 2.2, mix(1.0, stripe, smoothstep(0.35, 0.02, uSunDir.y)));
          }

          // Twinkling stars at night
          if (uNightFactor > 0.05 && dir.y > 0.06) {
            vec2 starUv = dir.xz / (dir.y + 0.15) * 95.0;
            float s = hash(floor(starUv));
            if (s > 0.993) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + s * 80.0);
              col += vec3(0.85, 0.92, 1.0) * uNightFactor * twinkle * smoothstep(0.06, 0.35, dir.y);
            }
          }

          // Soft tropical clouds
          if (dir.y > 0.03) {
            vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.45 + vec2(uTime * 0.012, uTime * 0.005);
            float c = fbm(cloudUv);
            float cloudMask = smoothstep(1.0 - uCloudDensity, 1.0, c) * smoothstep(0.03, 0.22, dir.y);
            vec3 cloudCol = mix(uHorizonColor * 1.15, vec3(1.0, 0.94, 0.96), 0.45 * (1.0 - uNightFactor));
            col = mix(col, cloudCol, cloudMask * 0.58);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    // Atlantic / Vice Beach Animated Ocean
    this.oceanUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: this.skyUniforms.uSunDir.value },
      uSunColor: { value: new THREE.Color(0xffae70) },
      uSkyHorizon: { value: new THREE.Color(0xff7597) },
      uDeepColor: { value: new THREE.Color(0x063954) },
      uShallowColor: { value: new THREE.Color(0x0ca69a) }
    };

    const oceanGeo = new THREE.PlaneGeometry(2400, 2400, 140, 140);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying float vWaveH;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float w1 = sin(wp.x * 0.075 + uTime * 1.65) * 0.24;
          float w2 = cos(wp.z * 0.06 - uTime * 1.25 + wp.x * 0.03) * 0.18;
          float w3 = sin((wp.x + wp.z) * 0.14 + uTime * 2.4) * 0.08;
          // Calmer right next to beach shoreline (X ~ 328)
          float shoreDamp = smoothstep(318.0, 355.0, wp.x);
          float h = (w1 + w2 + w3) * mix(0.25, 1.0, shoreDamp);
          wp.y += h;
          vWaveH = h;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyHorizon;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        varying vec3 vWorldPos;
        varying float vWaveH;

        void main() {
          // Tropical turquoise shallow gradient near Vice Beach (X ~ 325..365) & Starfish Island
          float beachDist = clamp((vWorldPos.x - 324.0) / 75.0, 0.0, 1.0);
          vec3 waterBase = mix(uShallowColor, uDeepColor, beachDist);

          // Procedural wave normal perturbation
          float nx = cos(vWorldPos.x * 0.19 + uTime * 2.1) * 0.14 + sin(vWorldPos.z * 0.23 - uTime * 1.7) * 0.1;
          float nz = sin(vWorldPos.z * 0.17 + uTime * 1.8) * 0.14;
          vec3 N = normalize(vec3(nx, 1.0, nz));

          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.6);
          vec3 col = mix(waterBase, uSkyHorizon, clamp(fresnel * 0.78, 0.0, 0.85));

          // Sun glitter path on waves
          vec3 R = reflect(-normalize(uSunDir), N);
          float spec = pow(max(dot(R, V), 0.0), 64.0);
          col += uSunColor * spec * 1.45;

          // Animated shoreline surf foam along Vice Beach (x around 325..336)
          float shoreWave = sin(vWorldPos.z * 0.08 + uTime * 1.5) * 2.2;
          float distToShore = abs(vWorldPos.x - (328.5 + shoreWave));
          if (vWorldPos.x > 315.0 && vWorldPos.x < 342.0 && abs(vWorldPos.z) < 430.0) {
            float foam = smoothstep(4.2, 0.6, distToShore) * (0.55 + 0.45 * sin(uTime * 3.4 - vWorldPos.x * 0.8));
            col = mix(col, vec3(0.96, 0.98, 1.0), clamp(foam, 0.0, 0.88));
          }

          // Wave crest highlights
          col += vec3(0.12, 0.18, 0.2) * smoothstep(0.18, 0.42, vWaveH);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.set(250, -0.65, 0);
    this.scene.add(this.oceanMesh);

    // Rain streak lines around camera (hidden unless weather === 'rain')
    this.rainPositions = new Float32Array(this.rainCount * 6);
    for (let i = 0; i < this.rainCount; i++) {
      const rx = (Math.random() - 0.5) * 90;
      const ry = Math.random() * 40;
      const rz = (Math.random() - 0.5) * 90;
      const idx = i * 6;
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;
      this.rainPositions[idx + 3] = rx - 0.35;
      this.rainPositions[idx + 4] = ry - 1.65;
      this.rainPositions[idx + 5] = rz - 0.2;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xa5d8ff,
      transparent: true,
      opacity: 0.42
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);

    // Post-processing composer (RenderPass + UnrealBloomPass + OutputPass)
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, new THREE.PerspectiveCamera());
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.58, // strength
      0.42, // radius
      0.84 // threshold so only neon, lights, sun, explosions glow!
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  public setCamera(camera: THREE.PerspectiveCamera): void {
    const renderPass = this.composer.passes[0] as RenderPass;
    renderPass.camera = camera;
  }

  public setQuality(ultra: boolean): void {
    this.useUltraQuality = ultra;
    this.renderer.setPixelRatio(ultra ? Math.min(window.devicePixelRatio, 2) : 1);
  }

  public setPresetWeather(mode: WeatherMode): void {
    this.weather = mode;
    if (mode === 'sunset') {
      this.timeOfDay = 18.3;
    } else if (mode === 'night') {
      this.timeOfDay = 23.0;
    } else if (mode === 'day') {
      this.timeOfDay = 12.5;
    } else if (mode === 'rain') {
      this.timeOfDay = 20.4;
    }
  }

  public resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  }

  public getFormattedClock(): string {
    const hours = Math.floor(this.timeOfDay) % 24;
    const mins = Math.floor((this.timeOfDay - Math.floor(this.timeOfDay)) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  public isNightLike(): boolean {
    return this.timeOfDay >= 18.0 || this.timeOfDay <= 6.3 || this.weather === 'rain';
  }

  public update(dt: number, focusPos: THREE.Vector3): void {
    const elapsed = performance.now() * 0.001;
    this.skyUniforms.uTime.value = elapsed;
    this.oceanUniforms.uTime.value = elapsed;

    this.timeOfDay = (this.timeOfDay + dt * this.timeSpeed) % 24;
    this.skyMesh.position.set(focusPos.x, 0, focusPos.z);

    // Compute solar elevation angle from timeOfDay (6:00 sunrise, 12:30 peak, 19:00 sunset)
    const dayAngle = ((this.timeOfDay - 6.0) / 24.0) * Math.PI * 2;
    const sunElev = Math.sin(dayAngle); // >0 day, ~0 dawn/sunset, <0 night
    const sunAzimuth = Math.cos(dayAngle);

    // Place sun out over the ocean/horizon for iconic Vice Beach reflections
    const sunDir = new THREE.Vector3(
      0.72,
      Math.max(0.04, Math.abs(sunElev) * 0.78),
      sunAzimuth * 0.65
    ).normalize();
    this.skyUniforms.uSunDir.value.copy(sunDir);
    this.oceanUniforms.uSunDir.value.copy(sunDir);

    // Palette keyframes: Day, Vice Sunset, Neon Night
    const sunsetWeight = Math.exp(-Math.pow((sunElev - 0.06) / 0.28, 2));
    const nightWeight = THREE.MathUtils.smoothstep(-sunElev, -0.05, 0.35);
    const dayWeight = Math.max(0, 1 - sunsetWeight - nightWeight);

    const zenith = new THREE.Color(0x0b72b5)
      .multiplyScalar(dayWeight)
      .add(new THREE.Color(0x1f0f47).multiplyScalar(sunsetWeight))
      .add(new THREE.Color(0x050716).multiplyScalar(nightWeight));

    const mid = new THREE.Color(0x5cc8ff)
      .multiplyScalar(dayWeight)
      .add(new THREE.Color(0xd63384).multiplyScalar(sunsetWeight))
      .add(new THREE.Color(0x141236).multiplyScalar(nightWeight));

    const horizon = new THREE.Color(0xc5f0ff)
      .multiplyScalar(dayWeight)
      .add(new THREE.Color(0xff8547).multiplyScalar(sunsetWeight))
      .add(new THREE.Color(0x3a1448).multiplyScalar(nightWeight));

    const sunCol = new THREE.Color(0xfff6dc)
      .multiplyScalar(dayWeight)
      .add(new THREE.Color(0xffbe55).multiplyScalar(sunsetWeight))
      .add(new THREE.Color(0x6488cc).multiplyScalar(nightWeight));

    if (this.weather === 'rain') {
      zenith.lerp(new THREE.Color(0x0d1324), 0.75);
      mid.lerp(new THREE.Color(0x1e2640), 0.75);
      horizon.lerp(new THREE.Color(0x3c2a52), 0.65);
      this.skyUniforms.uCloudDensity.value = 0.78;
    } else {
      this.skyUniforms.uCloudDensity.value = 0.42;
    }

    this.skyUniforms.uZenithColor.value.copy(zenith);
    this.skyUniforms.uMidColor.value.copy(mid);
    this.skyUniforms.uHorizonColor.value.copy(horizon);
    this.skyUniforms.uSunColor.value.copy(sunCol);
    this.skyUniforms.uNightFactor.value = nightWeight;

    this.oceanUniforms.uSkyHorizon.value.copy(horizon);
    this.oceanUniforms.uSunColor.value.copy(sunCol);

    // Fog & Lights
    this.fog.color.copy(horizon).lerp(mid, 0.35);
    this.fog.density = this.weather === 'rain' ? 0.0024 : 0.00125;

    this.sunLight.color.copy(sunCol);
    this.sunLight.intensity =
      this.weather === 'rain'
        ? 0.85
        : THREE.MathUtils.lerp(2.75, 0.55, nightWeight) * (1 + sunsetWeight * 0.25);

    this.hemiLight.color.copy(mid).lerp(new THREE.Color(0xffffff), 0.25);
    this.hemiLight.groundColor.setHex(nightWeight > 0.5 ? 0x1b152b : 0x4a3b4e);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.95, 0.52, nightWeight);

    // Boost neon bloom slightly at night/sunset/rain
    this.bloomPass.strength = this.useUltraQuality
      ? THREE.MathUtils.lerp(0.38, 0.72, Math.max(sunsetWeight, nightWeight))
      : 0;

    // Wet reflective asphalt in rain or neon dusk
    if (this.roadMaterial) {
      this.roadMaterial.roughness =
        this.weather === 'rain' ? 0.16 : THREE.MathUtils.lerp(0.62, 0.34, nightWeight + sunsetWeight * 0.5);
      this.roadMaterial.metalness = this.weather === 'rain' ? 0.35 : 0.12;
    }

    // Snap directional shadow camera around focusPos so shadows stay crisp everywhere
    const snapX = Math.round(focusPos.x / 4) * 4;
    const snapZ = Math.round(focusPos.z / 4) * 4;
    this.sunLight.target.position.set(snapX, 0, snapZ);
    this.sunLight.position.set(
      snapX + sunDir.x * 130,
      Math.max(38, sunDir.y * 145),
      snapZ + sunDir.z * 130
    );

    // Rain update
    this.rainLines.visible = this.weather === 'rain';
    if (this.weather === 'rain') {
      this.rainLines.position.set(focusPos.x, 0, focusPos.z);
      const arr = this.rainPositions;
      const fall = dt * 38;
      for (let i = 0; i < this.rainCount; i++) {
        const idx = i * 6;
        arr[idx + 1] -= fall;
        arr[idx + 4] -= fall;
        if (arr[idx + 1] < 0) {
          const ny = 36 + Math.random() * 8;
          arr[idx + 1] = ny;
          arr[idx + 4] = ny - 1.65;
        }
      }
      (this.rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public render(camera: THREE.PerspectiveCamera): void {
    if (this.useUltraQuality) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, camera);
    }
  }
}
