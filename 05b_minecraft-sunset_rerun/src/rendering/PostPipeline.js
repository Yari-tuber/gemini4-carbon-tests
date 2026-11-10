import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { SUN_DIR } from '../config.js';

class HeldOverlayPass extends Pass {
  constructor(heldView) {
    super();
    this.heldView = heldView;
    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!this.heldView || !this.heldView.visible) return;
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(this.heldView.scene, this.heldView.camera);
    renderer.autoClear = prevAutoClear;
  }
}

const VolumetricGodRaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunScreenPos: { value: new THREE.Vector2(0.5, 0.7) },
    uSunVisibility: { value: 1.0 },
    uAspect: { value: 1.777 },
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
    uniform float uSunVisibility;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uSunVisibility <= 0.005) {
        gl_FragColor = base;
        return;
      }

      vec2 delta = (vUv - uSunScreenPos);
      vec2 aspectDelta = vec2(delta.x * uAspect, delta.y);
      float radialDist = length(aspectDelta);

      // March 100% of the segment [vUv -> uSunScreenPos] so the corona falls off smoothly as 1/r with ZERO ring!
      float radialFalloff = exp(-radialDist * 2.5);
      vec2 stepUV = delta / 32.0;
      float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec2 sampleUV = vUv - stepUV * jitter;

      float decay = 1.0;
      vec3 shaftAccum = vec3(0.0);

      for (int i = 0; i < 32; i++) {
        sampleUV -= stepUV;
        vec2 clampedUV = clamp(sampleUV, 0.002, 0.998);
        vec3 s = texture2D(tDiffuse, clampedUV).rgb;
        // Only pixels brighter than the sky (> 1.05, i.e. the solar disc itself!) emit crepuscular shafts
        float sunEnergy = smoothstep(1.05, 1.85, s.r);
        shaftAccum += min(s, vec3(2.2, 0.65, 0.08)) * sunEnergy * decay;
        decay *= 0.965;
      }

      vec3 shafts = (shaftAccum / 32.0) * vec3(0.42, 0.14, 0.024) * radialFalloff * uSunVisibility;
      gl_FragColor = vec4(base.rgb + shafts, 1.0);
    }
  `,
};

const SunsetFilmicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
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
    varying vec2 vUv;

    // Pure chroma-preserving sunset tonemapper:
    // Compresses max channel / luminance smoothly so vivid HDR orange (2.4, 0.55, 0.04)
    // maps to radiant saturated sunset orange (#ff7c1f) instead of washing out to yellow/white!
    vec3 sunsetTonemap(vec3 hdr) {
      hdr = max(hdr, vec3(0.0));

      float peak = max(hdr.r, max(hdr.g, hdr.b));
      if (peak < 0.0001) return vec3(0.0);

      // Soft S-curve shoulder on peak intensity
      float mappedPeak = (peak * (1.0 + peak * 0.22)) / (1.0 + peak * 0.98);
      vec3 chromaKept = hdr * (mappedPeak / peak);

      // Subtle warm golden lift only in extreme highlights (e.g. center of sun & wave glints)
      float hot = smoothstep(1.35, 3.2, peak);
      chromaKept += vec3(0.06, 0.08, 0.02) * hot;

      // Crisp filmic contrast in midtones/shadows
      chromaKept = pow(clamp(chromaKept, 0.0, 1.0), vec3(1.04));
      return clamp(chromaKept, 0.0, 1.0);
    }

    void main() {
      vec3 hdr = texture2D(tDiffuse, vUv).rgb;
      vec3 mapped = sunsetTonemap(hdr * 1.06);

      // Gentle cinematic vignette
      vec2 centered = vUv - 0.5;
      float vig = 1.0 - dot(centered, centered) * 0.30;
      mapped *= clamp(vig, 0.78, 1.0);

      // Linear -> sRGB gamma encoding
      vec3 srgb = pow(mapped, vec3(1.0 / 2.2));
      gl_FragColor = vec4(srgb, 1.0);
    }
  `,
};

export class PostPipeline {
  constructor(renderer, scene, camera, heldView) {
    this.renderer = renderer;
    this.camera = camera;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });

    this.composer = new EffectComposer(renderer, rt);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.heldPass = new HeldOverlayPass(heldView);
    this.composer.addPass(this.heldPass);

    this.godRaysPass = new ShaderPass(VolumetricGodRaysShader);
    this.composer.addPass(this.godRaysPass);

    // Controlled HDR Bloom: wraps a delicate golden-orange corona around the crisp solar disc,
    // ocean sun-road glitter, and player lanterns without blurring the sun's circular outline!
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.26, // strength
      0.46, // radius
      1.02  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(SunsetFilmicGradeShader);
    this.composer.addPass(this.gradePass);

    this._sunWorld = new THREE.Vector3();
    this._camFwd = new THREE.Vector3();
  }

  render(dt) {
    this._sunWorld.copy(this.camera.position).addScaledVector(SUN_DIR, 2000.0);
    this.camera.getWorldDirection(this._camFwd);
    const cosCamSun = this._camFwd.dot(SUN_DIR);

    const projected = this._sunWorld.clone().project(this.camera);
    const su = projected.x * 0.5 + 0.5;
    const sv = projected.y * 0.5 + 0.5;

    this.godRaysPass.uniforms.uSunScreenPos.value.set(su, sv);
    const vis = THREE.MathUtils.smoothstep(cosCamSun, 0.05, 0.65)
      * (1.0 - THREE.MathUtils.smoothstep(Math.max(Math.abs(su - 0.5), Math.abs(sv - 0.5)), 0.55, 0.95));
    this.godRaysPass.uniforms.uSunVisibility.value = vis;
    this.godRaysPass.uniforms.uAspect.value = this.camera.aspect;

    this.composer.render(dt);
  }

  onResize(width, height) {
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.floor(width * pr));
    const bh = Math.max(1, Math.floor(height * pr));
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(pr);
    this.bloomPass.resolution.set(bw, bh);
  }
}
