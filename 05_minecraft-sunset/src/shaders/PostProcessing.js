import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GODRAYS_AND_GRADING_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVisible: { value: 1.0 },
    uUnderwater: { value: 0.0 },
    uTime: { value: 0.0 },
    uGlideSpeed: { value: 0.0 },
    uGodRayIntensity: { value: 1.0 }
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
    uniform vec2 uSunScreenPos;
    uniform float uSunVisible;
    uniform float uUnderwater;
    uniform float uTime;
    uniform float uGlideSpeed;
    uniform float uGodRayIntensity;

    varying vec2 vUv;

    // Interleaved Gradient Noise for zero-banding volumetric god rays
    float ign(vec2 p) {
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    vec3 sunsetToneMap(vec3 col) {
      float maxC = max(col.r, max(col.g, col.b));
      if (maxC < 0.0001) return col;

      vec3 ratio = col / maxC;
      float mappedMax = (maxC * (2.42 * maxC + 0.06)) / (maxC * (2.26 * maxC + 1.32) + 0.08);

      vec3 chromaPreserved = ratio * mappedMax;
      vec3 perChannel = (col * (2.42 * col + 0.06)) / (col * (2.26 * col + 1.32) + 0.08);
      return mix(perChannel, chromaPreserved, 0.78);
    }

    void main() {
      vec2 uv = vUv;

      if (uUnderwater > 0.01) {
        uv.x += sin(uv.y * 18.0 + uTime * 3.2) * 0.004 * uUnderwater;
        uv.y += cos(uv.x * 16.0 + uTime * 2.7) * 0.004 * uUnderwater;
      }

      vec3 sceneColor = texture2D(tDiffuse, uv).rgb;

      // --- 1. Dithered 24-Step Volumetric Crepuscular God Rays (丁达尔落日体积光束) ---
      if (uSunVisible > 0.01 && uUnderwater < 0.5 && uGodRayIntensity > 0.01) {
        vec2 toSun = uv - uSunScreenPos;
        float distToSun = length(toSun);
        vec2 deltaUV = toSun * (1.0 / 24.0) * 0.68;

        // Dither start offset using screen-space IGN noise
        float jitter = ign(gl_FragCoord.xy);
        vec2 sampleUV = uv - deltaUV * jitter;

        float illuminationDecay = 1.0;
        float godRayAccum = 0.0;

        for (int i = 0; i < 24; i++) {
          sampleUV -= deltaUV;
          vec2 clampedUV = clamp(sampleUV, 0.002, 0.998);
          vec3 sCol = texture2D(tDiffuse, clampedUV).rgb;
          float luma = dot(sCol, vec3(0.45, 0.40, 0.15));
          // Sky & sun gap detection
          float sunShaftSample = smoothstep(0.82, 1.85, luma);
          godRayAccum += sunShaftSample * illuminationDecay;
          illuminationDecay *= 0.945;
        }

        godRayAccum /= 24.0;
        // Crepuscular shafts show up most dramatically over dark silhouettes & mid-tones
        float curLuma = dot(sceneColor, vec3(0.333));
        float silhouetteContrast = mix(1.25, 0.45, clamp(curLuma, 0.0, 1.0));
        float radialFalloff = exp(-distToSun * 1.95);

        vec3 rayColor = vec3(1.24, 0.54, 0.12) * godRayAccum * radialFalloff * silhouetteContrast * uSunVisible * 0.36 * uGodRayIntensity;
        sceneColor += rayColor;
      }

      // --- 2. Underwater Tint ---
      if (uUnderwater > 0.01) {
        sceneColor = mix(sceneColor, sceneColor * vec3(0.35, 0.72, 0.85) + vec3(0.02, 0.12, 0.18), uUnderwater * 0.75);
      }

      // --- 3. Hue-Preserving Sunset Tone Mapping & Cinema Contrast ---
      vec3 mapped = sunsetToneMap(sceneColor);
      mapped = smoothstep(0.008, 0.992, mapped);

      vec2 centered = vUv - 0.5;
      float vig = 1.0 - dot(centered, centered) * (0.36 + uGlideSpeed * 0.12);
      mapped *= clamp(vig, 0.68, 1.0);

      mapped = pow(max(vec3(0.0001), mapped), vec3(1.0 / 2.2));
      gl_FragColor = vec4(mapped, 1.0);
    }
  `
};

export class PostProcessingPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();

    const renderTarget = new THREE.WebGLRenderTarget(
      size.x * pixelRatio,
      size.y * pixelRatio,
      {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat
      }
    );

    this.composer = new EffectComposer(renderer, renderTarget);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.42, // strength
      0.62, // radius
      1.05  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.gradingPass = new ShaderPass(GODRAYS_AND_GRADING_SHADER);
    this.composer.addPass(this.gradingPass);

    this._sunWorldPos = new THREE.Vector3();
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  render(time, sunDir, isUnderwater, glideSpeedFactor = 0) {
    this._sunWorldPos.copy(this.camera.position).addScaledVector(sunDir, 1000.0);
    this._sunWorldPos.project(this.camera);

    const sunU = this._sunWorldPos.x * 0.5 + 0.5;
    const sunV = this._sunWorldPos.y * 0.5 + 0.5;

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const cosCamSun = camDir.dot(sunDir);
    const sunVisible = THREE.MathUtils.smoothstep(cosCamSun, 0.05, 0.55);

    this.gradingPass.uniforms.uSunScreenPos.value.set(sunU, sunV);
    this.gradingPass.uniforms.uSunVisible.value = sunVisible;
    this.gradingPass.uniforms.uUnderwater.value = isUnderwater ? 1.0 : 0.0;
    this.gradingPass.uniforms.uTime.value = time;
    this.gradingPass.uniforms.uGlideSpeed.value = glideSpeedFactor;

    this.composer.render();
  }
}
