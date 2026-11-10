import * as THREE from 'three';
import { SUN_DIR, SHADOW_SUN_DIR, WORLD_CONFIG } from '../config.js';
import { ATMOSPHERE_GLSL } from './AtmosphereCommon.js';

const WIND_DISPLACEMENT_GLSL = /* glsl */ `
vec3 computeWindOffset(vec3 worldPos, float windWeight, float time) {
  if (windWeight <= 0.001) return vec3(0.0);
  float phase = worldPos.x * 0.42 + worldPos.z * 0.36 + worldPos.y * 0.18;
  float gust = 0.72 + 0.28 * sin(time * 0.65 + worldPos.x * 0.05 - worldPos.z * 0.04);
  float dx = sin(time * 2.15 + phase) * 0.075 * windWeight * gust;
  float dz = cos(time * 1.85 + phase * 1.13) * 0.062 * windWeight * gust;
  float dy = sin(time * 3.10 + phase * 0.7) * 0.018 * windWeight;
  return vec3(dx, dy, dz);
}
`;

export class SunShadowSystem {
  constructor() {
    const size = WORLD_CONFIG.SHADOW_MAP_SIZE;
    const F = WORLD_CONFIG.SHADOW_FRUSTUM;

    const depthTex = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    depthTex.minFilter = THREE.NearestFilter;
    depthTex.magFilter = THREE.NearestFilter;

    this.renderTarget = new THREE.WebGLRenderTarget(size, size, {
      depthTexture: depthTex,
      depthBuffer: true,
      stencilBuffer: false,
    });

    this.camera = new THREE.OrthographicCamera(-F, F, F, -F, 1.0, 500.0);
    this.shadowMatrix = new THREE.Matrix4();

    // Fixed light-space basis for shimmer-free texel snapping
    this._lightFwd = SHADOW_SUN_DIR.clone().negate().normalize();
    this._lightRight = new THREE.Vector3().crossVectors(this._lightFwd, new THREE.Vector3(0, 1, 0)).normalize();
    this._lightUp = new THREE.Vector3().crossVectors(this._lightRight, this._lightFwd).normalize();
    this._texelSize = (2.0 * F) / size;
    this._center = new THREE.Vector3();
  }

  get depthTexture() {
    return this.renderTarget.depthTexture;
  }

  render(renderer, solidGroup, depthMaterial, playerPos) {
    // Snap light-space center to exact shadow texels so long shadows stay rock-steady while gliding
    this._center.set(playerPos.x, WORLD_CONFIG.SEA_LEVEL + 12.0, playerPos.z);

    const rx = this._center.dot(this._lightRight);
    const ry = this._center.dot(this._lightUp);
    const rz = this._center.dot(this._lightFwd);

    const snappedRx = Math.round(rx / this._texelSize) * this._texelSize;
    const snappedRy = Math.round(ry / this._texelSize) * this._texelSize;

    const target = new THREE.Vector3()
      .addScaledVector(this._lightRight, snappedRx)
      .addScaledVector(this._lightUp, snappedRy)
      .addScaledVector(this._lightFwd, rz);

    this.camera.position.copy(target).addScaledVector(SHADOW_SUN_DIR, 240.0);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(true);

    this.shadowMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(this.renderTarget);
    renderer.clear(true, true, false);

    // Override solidGroup meshes with custom alpha-tested wind-aware shadow depth material
    const prevOverride = solidGroup.overrideMaterial;
    const savedMaterials = [];
    for (let i = 0; i < solidGroup.children.length; i++) {
      const m = solidGroup.children[i];
      savedMaterials.push(m.material);
      m.material = depthMaterial;
    }

    renderer.render(solidGroup, this.camera);

    for (let i = 0; i < solidGroup.children.length; i++) {
      solidGroup.children[i].material = savedMaterials[i];
    }
    solidGroup.overrideMaterial = prevOverride;

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
  }
}

export function createVoxelShaders(atlasTexture, shadowSystem) {
  const sharedUniforms = {
    uAtlas: { value: atlasTexture },
    uTime: { value: 0 },
    uSunDir: { value: SUN_DIR.clone() },
    uShadowSunDir: { value: SHADOW_SUN_DIR.clone() },
    uShadowMap: { value: shadowSystem.depthTexture },
    uShadowMatrix: { value: shadowSystem.shadowMatrix },
    uSeaLevel: { value: WORLD_CONFIG.SEA_LEVEL },
  };

  const shadowDepthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: sharedUniforms.uAtlas,
      uTime: sharedUniforms.uTime,
    },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec2 aMatProps;
      uniform float uTime;
      varying vec2 vUv;

      ${WIND_DISPLACEMENT_GLSL}

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        worldPos.xyz += computeWindOffset(worldPos.xyz, aMatProps.x, uTime);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(uAtlas, vUv);
        if (tex.a < 0.45) discard;
        gl_FragColor = vec4(1.0);
      }
    `,
  });

  const voxelMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      attribute float aAo;
      attribute float aBlockLight;
      attribute vec2 aMatProps;

      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vAo;
      varying float vBlockLight;
      varying vec2 vMatProps;

      ${WIND_DISPLACEMENT_GLSL}

      void main() {
        vUv = uv;
        vAo = aAo;
        vBlockLight = aBlockLight;
        vMatProps = aMatProps;
        vNormal = normalize(mat3(modelMatrix) * normal);

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        worldPos.xyz += computeWindOffset(worldPos.xyz, aMatProps.x, uTime);
        vWorldPos = worldPos.xyz;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform sampler2D uShadowMap;
      uniform mat4 uShadowMatrix;
      uniform vec3 uSunDir;
      uniform vec3 uShadowSunDir;
      uniform float uSeaLevel;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vAo;
      varying float vBlockLight;
      varying vec2 vMatProps;

      ${ATMOSPHERE_GLSL}

      // 12-tap Vogel Disk Poisson Soft PCF Shadow Sampling (branchless loop for zero HLSL gradient warnings)
      float sampleSunShadow(vec3 worldPos, vec3 normal) {
        vec3 offsetPos = worldPos + normal * 0.085 + uShadowSunDir * 0.035;
        vec4 sc = uShadowMatrix * vec4(offsetPos, 1.0);
        vec3 proj = (sc.xyz / sc.w) * 0.5 + 0.5;

        float edgeDist = max(abs(proj.x - 0.5), abs(proj.y - 0.5));
        vec2 baseUV = clamp(proj.xy, 0.002, 0.998);

        float rot = fract(sin(dot(floor(worldPos.xz * 32.0), vec2(12.9898, 78.233))) * 43758.5453) * 6.283185;
        float s = sin(rot), c = cos(rot);
        mat2 rotMat = mat2(c, -s, s, c);

        float radius = 1.95 / ${WORLD_CONFIG.SHADOW_MAP_SIZE.toFixed(1)};
        float bias = 0.00075;
        float lit = 0.0;

        for (int i = 0; i < 12; i++) {
          float fi = float(i);
          float r = sqrt((fi + 0.5) / 12.0) * radius;
          float theta = fi * 2.39996323;
          vec2 disk = rotMat * (vec2(cos(theta), sin(theta)) * r);
          float depthSample = texture2D(uShadowMap, baseUV + disk).r;
          lit += (proj.z - bias <= depthSample) ? 1.0 : 0.0;
        }
        lit /= 12.0;

        float outOfBounds = step(0.49, edgeDist) + step(0.998, proj.z) + step(proj.z, 0.001);
        float fade = clamp(smoothstep(0.42, 0.49, edgeDist) + outOfBounds, 0.0, 1.0);
        return mix(lit, 1.0, fade);
      }

      void main() {
        vec4 texSample = texture2D(uAtlas, vUv);
        if (texSample.a < 0.45) discard;

        // Convert sRGB atlas texel to linear space (CanvasTexture with SRGBColorSpace decodes in WebGL2 automatically!)
        vec3 albedo = texSample.rgb;

        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float sssWeight = vMatProps.y;

        // Self-emissive lantern / glowstone blocks!
        if (vBlockLight > 1.15) {
          vec3 glowCol = albedo * 2.45;
          glowCol = applySunsetMist(glowCol, vWorldPos, cameraPosition, uSunDir, uSeaLevel);
          gl_FragColor = vec4(glowCol, 1.0);
          return;
        }

        // 1. Classic Minecraft subtle face-orientation contrast + Twilight Hemisphere Ambient
        // Sky bounce is dreamy rose-violet above, warm sandy-earth bounce from below!
        float hemi = N.y * 0.5 + 0.5;
        vec3 skyAmbient = mix(vec3(0.085, 0.055, 0.115), vec3(0.185, 0.125, 0.255), hemi);
        // Subtle warm horizon bounce on sun-facing sides even in ambient
        float sunSideBounce = max(dot(N, uSunDir), 0.0);
        skyAmbient += vec3(0.11, 0.048, 0.035) * sunSideBounce;

        // 2. Direct Golden-Orange Sunset Sunlight + Long Shadows!
        float ndotl = max(dot(N, uShadowSunDir), 0.0);
        // Foliage gets wrap-around diffuse so leaves don't split harshly across cube corners
        if (sssWeight > 0.3) {
          ndotl = max(ndotl, (dot(N, uShadowSunDir) + 0.45) / 1.45 * 0.78);
        }

        float shadow = (ndotl > 0.001 || sssWeight > 0.3) ? sampleSunShadow(vWorldPos, N) : 0.0;

        vec3 sunLightColor = vec3(2.05, 0.84, 0.26); // Rich golden-hour sunlight!
        vec3 directLight = sunLightColor * ndotl * shadow;

        // 3. Foliage & Wildflower Backlit Subsurface Scattering (SSS) when looking toward the sun!
        vec3 sssLight = vec3(0.0);
        if (sssWeight > 0.05) {
          float backScatter = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 3.2);
          float rimSun = 0.32 + 0.68 * shadow;
          sssLight = vec3(2.25, 0.92, 0.18) * backScatter * sssWeight * rimSun * 0.72;
        }

        // 4. Warm Local Block Light (from nearby player-placed Glowstone / Sea Lanterns)
        vec3 localTorchLight = vec3(1.55, 0.82, 0.28) * vBlockLight * 1.15;

        // Combine lighting with smooth voxel corner Ambient Occlusion
        vec3 litColor = albedo * ((skyAmbient * vAo) + directLight * (0.45 + 0.55 * vAo) + sssLight + localTorchLight);

        // Subtle grazing golden Fresnel rim on sunlit top surfaces (wet sand / lush grass sheen)
        if (N.y > 0.8 && shadow > 0.2) {
          float fres = pow(1.0 - max(dot(N, V), 0.0), 4.5);
          float alignSun = pow(max(dot(reflect(-V, N), uSunDir), 0.0), 6.0);
          litColor += vec3(0.55, 0.22, 0.05) * fres * alignSun * shadow * 0.65;
        }

        // 5. Directional Sunset Mist & Low Valley Haze ("薄雾")
        litColor = applySunsetMist(litColor, vWorldPos, cameraPosition, uSunDir, uSeaLevel);

        gl_FragColor = vec4(litColor, 1.0);
      }
    `,
  });

  return { voxelMaterial, shadowDepthMaterial, sharedUniforms };
}
