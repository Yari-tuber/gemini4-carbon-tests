/**
 * 墨生 · 字即世界 — Real-Time WebGL Navier-Stokes Fluid Ink & Xuan Paper Engine
 *
 * Physical 4-channel mineral pigment dye field:
 *   R = 墨 (Sumi carbon ink)
 *   G = 朱 (Cinnabar vermilion)
 *   B = 青 (Mineral azurite/malachite cyan-teal)
 *   A = 灵雾 (Luminous silver/lightning/steam mist)
 */
(function (global) {
  "use strict";

  class InkFluidEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.nightMix = 0.0;
      this.flashIntensity = 0.0;
      this.time = 0.0;

      // Simulation tuning — calibrated to match f_003..f_060 laminar spiral ribbons & Xuan paper 留白
      this.config = {
        simHeight: 256,
        dyeHeight: 768,
        pressureIterations: 22,
        curlStrength: 3.6,
        velocityDissipation: 0.980,
        dyeDissipation: 0.9885,
        pressureDecay: 0.80
      };

      this.glyphCanvas = document.createElement("canvas");
      this.glyphCanvas.width = 256;
      this.glyphCanvas.height = 256;
      this.glyphCtx = this.glyphCanvas.getContext("2d");

      this._pendingSwirls = [];
      this._initGL();
    }

    _initGL() {
      const params = {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true
      };

      let gl = this.canvas.getContext("webgl2", params);
      const isWebGL2 = !!gl;
      if (!gl) {
        gl = this.canvas.getContext("webgl", params) || this.canvas.getContext("experimental-webgl", params);
      }
      this.gl = gl;
      this.isWebGL2 = isWebGL2;

      if (!gl) {
        this.supported = false;
        return;
      }
      this.supported = true;

      let halfFloatTexType;
      let supportLinearFiltering;
      if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float");
        supportLinearFiltering = !!gl.getExtension("OES_texture_float_linear");
        halfFloatTexType = gl.HALF_FLOAT;
      } else {
        const halfFloat = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = !!gl.getExtension("OES_texture_half_float_linear");
        halfFloatTexType = halfFloat ? halfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
      }

      this.texType = halfFloatTexType;
      this.supportLinear = supportLinearFiltering;

      if (isWebGL2) {
        this.formatRGBA = this._getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        this.formatRG = this._getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType) || this.formatRGBA;
        this.formatR = this._getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType) || this.formatRGBA;
      } else {
        this.formatRGBA = { internalFormat: gl.RGBA, format: gl.RGBA };
        this.formatRG = this.formatRGBA;
        this.formatR = this.formatRGBA;
      }

      this._compileShaders();
      this._initQuad();
      this._initGlyphTexture();
      this.resize();
    }

    _getSupportedFormat(gl, internalFormat, format, type) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);

      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        return null;
      }
      return { internalFormat, format };
    }

    _compileShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Fluid shader compile error:", gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    _createProgram(vsSource, fsSource) {
      const gl = this.gl;
      const program = gl.createProgram();
      const vs = this._compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSource);
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, "aPosition");
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Fluid program link error:", gl.getProgramInfoLog(program));
      }

      const uniforms = {};
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(program, i).name;
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      return { program, uniforms };
    }

    _compileShaders() {
      const baseVS = `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;
        void main () {
          vUv = aPosition * 0.5 + 0.5;
          vL = vUv - vec2(texelSize.x, 0.0);
          vR = vUv + vec2(texelSize.x, 0.0);
          vT = vUv + vec2(0.0, texelSize.y);
          vB = vUv - vec2(0.0, texelSize.y);
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const clearFS = `
        precision mediump float;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;
        void main () {
          gl_FragColor = value * texture2D(uTexture, vUv);
        }
      `;

      const splatFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec4 color;
        uniform vec2 point;
        uniform float radius;
        void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          float d = exp(-dot(p, p) / max(radius, 0.00001));
          vec4 base = texture2D(uTarget, vUv);
          gl_FragColor = base + d * color;
        }
      `;

      // Axisymmetric rotational vortex splat ("墨生" concentric Nautilus spiral ribbons)
      const vortexSplatFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec2 center;
        uniform float radius;
        uniform float omega;
        uniform float pull;
        void main () {
          vec2 p = vUv - center;
          vec2 pa = vec2(p.x * aspectRatio, p.y);
          float r2 = dot(pa, pa);
          float env = exp(-r2 / max(radius * radius, 0.00001));
          vec2 tang = vec2(-pa.y, pa.x);
          vec2 vel = (tang * omega - pa * pull) * env;
          vec4 base = texture2D(uTarget, vUv);
          gl_FragColor = vec4(base.xy + vel, 0.0, 1.0);
        }
      `;

      // Ring splat for thunder shockwave & water ripple rings
      const ringSplatFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec2 point;
        uniform float radius;
        uniform float thickness;
        uniform float strength;
        uniform int isVelocity;
        uniform vec4 pigment;
        void main () {
          vec2 p = vUv - point;
          vec2 pa = vec2(p.x * aspectRatio, p.y);
          float dist = length(pa);
          float ring = exp(-pow((dist - radius) / max(thickness, 0.002), 2.0));
          vec4 base = texture2D(uTarget, vUv);
          if (isVelocity == 1) {
            vec2 dir = dist > 0.0001 ? normalize(pa) : vec2(0.0, 1.0);
            gl_FragColor = vec4(base.xy + dir * ring * strength, 0.0, 1.0);
          } else {
            gl_FragColor = base + pigment * ring * strength;
          }
        }
      `;

      // Pouring clean water (Shift + drag): dilutes & blooms ink outward
      const waterDiluteFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec2 point;
        uniform float radius;
        uniform float dilution;
        void main () {
          vec2 p = vUv - point;
          p.x *= aspectRatio;
          float w = exp(-dot(p, p) / max(radius, 0.00001));
          vec4 base = texture2D(uTarget, vUv);
          gl_FragColor = base * (1.0 - clamp(w * dilution, 0.0, 0.92));
        }
      `;

      // Stamp calligraphic glyph strokes directly into mineral dye field
      const glyphSplatFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform sampler2D uGlyph;
        uniform float aspectRatio;
        uniform vec2 center;
        uniform float size;
        uniform vec4 pigment;
        void main () {
          vec4 base = texture2D(uTarget, vUv);
          vec2 rel = vUv - center;
          rel.x *= aspectRatio;
          vec2 gUv = rel / max(size, 0.001) + 0.5;
          if (gUv.x < 0.0 || gUv.x > 1.0 || gUv.y < 0.0 || gUv.y > 1.0) {
            gl_FragColor = base;
            return;
          }
          float mask = texture2D(uGlyph, gUv).a;
          // Slight organic wet-edge feathering
          float wet = smoothstep(0.04, 0.75, mask);
          gl_FragColor = base + pigment * wet;
        }
      `;

      const advectionFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform vec2 dyeTexelSize;
        uniform float dt;
        uniform float dissipation;
        uniform int manualFilter;

        vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
          vec2 st = uv / tsize - 0.5;
          vec2 iuv = floor(st);
          vec2 fuv = fract(st);
          vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
          vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
          vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
          vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
          return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
        }

        void main () {
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          vec4 result = manualFilter == 1 ? bilerp(uSource, coord, dyeTexelSize) : texture2D(uSource, coord);
          gl_FragColor = clamp(result * dissipation, -2000.0, 2000.0);
        }
      `;

      const divergenceFS = `
        precision mediump float;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
          float L = texture2D(uVelocity, vL).x;
          float R = texture2D(uVelocity, vR).x;
          float T = texture2D(uVelocity, vT).y;
          float B = texture2D(uVelocity, vB).y;
          vec2 C = texture2D(uVelocity, vUv).xy;
          if (vL.x < 0.0) { L = -C.x; }
          if (vR.x > 1.0) { R = -C.x; }
          if (vT.y > 1.0) { T = -C.y; }
          if (vB.y < 0.0) { B = -C.y; }
          float div = 0.5 * (R - L + T - B);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
      `;

      const curlFS = `
        precision mediump float;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uVelocity;
        void main () {
          float L = texture2D(uVelocity, vL).y;
          float R = texture2D(uVelocity, vR).y;
          float T = texture2D(uVelocity, vT).x;
          float B = texture2D(uVelocity, vB).x;
          float vorticity = R - L - T + B;
          gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
      `;

      const vorticityFS = `
        precision highp float;
        varying vec2 vUv;
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;
        void main () {
          float L = texture2D(uCurl, vL).x;
          float R = texture2D(uCurl, vR).x;
          float T = texture2D(uCurl, vT).x;
          float B = texture2D(uCurl, vB).x;
          float C = texture2D(uCurl, vUv).x;
          vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
          force /= length(force) + 0.0001;
          force *= curl * C;
          force.y *= -1.0;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          vel += force * dt;
          gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
        }
      `;

      const pressureFS = `
        precision mediump float;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        void main () {
          float L = texture2D(uPressure, vL).x;
          float R = texture2D(uPressure, vR).x;
          float T = texture2D(uPressure, vT).x;
          float B = texture2D(uPressure, vB).x;
          float divergence = texture2D(uDivergence, vUv).x;
          float pressure = (L + R + B + T - divergence) * 0.25;
          gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
      `;

      const gradSubtractFS = `
        precision mediump float;
        varying highp vec2 vUv;
        varying highp vec2 vL;
        varying highp vec2 vR;
        varying highp vec2 vT;
        varying highp vec2 vB;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        void main () {
          float L = texture2D(uPressure, vL).x;
          float R = texture2D(uPressure, vR).x;
          float T = texture2D(uPressure, vT).x;
          float B = texture2D(uPressure, vB).x;
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity.xy -= vec2(R - L, T - B);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `;

      // Xuan Paper + Optical Beer-Lambert Mineral Ink Display Shader
      const displayFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uDye;
        uniform vec2 uResolution;
        uniform float uNight;
        uniform float uFlash;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.03 + vec2(17.3, 9.2);
            a *= 0.5;
          }
          return v;
        }

        void main () {
          vec2 frag = gl_FragCoord.xy;

          // Authentic Xuan Paper weave: bamboo screen laid lines + organic fiber clusters
          float fineGrain = noise(frag * 0.45) - 0.5;
          float coarseFiber = fbm(frag * 0.018) - 0.5;
          float laidH = sin(frag.y * 1.15 + coarseFiber * 3.0) * 0.5 + 0.5;
          float laidV = sin(frag.x * 0.28 + fineGrain * 2.0) * 0.5 + 0.5;
          float paperTex = fineGrain * 0.024 + coarseFiber * 0.028 + (laidH - 0.5) * 0.010 + (laidV - 0.5) * 0.006;

          vec2 vigUv = vUv - 0.5;
          float vignette = dot(vigUv, vigUv) * 0.14;

          vec3 dayPaper = vec3(0.918, 0.895, 0.836) + paperTex - vignette * vec3(0.07, 0.075, 0.085);
          vec3 nightPaper = vec3(0.031, 0.047, 0.052) + paperTex * 0.22 - vignette * 0.02 + uFlash * vec3(0.14, 0.16, 0.17);
          vec3 baseCol = mix(dayPaper, nightPaper, uNight);

          // Sample 4-channel mineral pigment field
          vec4 d = max(texture2D(uDye, vUv), vec4(0.0));
          // Subtle paper-fiber modulation along ink edges (水墨渗化毛边)
          float fiberMod = 1.0 + (coarseFiber * 0.22 + fineGrain * 0.12);
          float sumi = d.r * fiberMod;
          float cinnabar = d.g * fiberMod;
          float cyan = d.b * fiberMod;
          float mist = d.a * fiberMod;

          // Day composition (translucent Beer-Lambert absorption on warm Xuan paper)
          float sumiAbsorb = 1.0 - exp(-sumi * 1.95);
          float cinnabarAbsorb = 1.0 - exp(-cinnabar * 2.05);
          float cyanAbsorb = 1.0 - exp(-cyan * 2.0);
          float mistDay = 1.0 - exp(-mist * 1.2);

          vec3 dayCol = dayPaper;
          // Sumi carbon ink: pale warm-cool silver wash at low density -> velvety焦墨 at core
          vec3 sumiTone = mix(vec3(0.32, 0.33, 0.32), vec3(0.055, 0.06, 0.062), clamp(sumi * 0.65, 0.0, 1.0));
          dayCol = mix(dayCol, sumiTone, clamp(sumiAbsorb * 0.95, 0.0, 0.96));

          // Cinnabar vermilion (朱砂)
          vec3 cinTone = mix(vec3(0.80, 0.27, 0.24), vec3(0.54, 0.07, 0.07), clamp(cinnabar * 0.65, 0.0, 1.0));
          dayCol = mix(dayCol, cinTone, clamp(cinnabarAbsorb * 0.90, 0.0, 0.94));

          // Mineral cyan-teal (花青 / 石青)
          vec3 cyanTone = mix(vec3(0.24, 0.52, 0.49), vec3(0.08, 0.28, 0.27), clamp(cyan * 0.65, 0.0, 1.0));
          dayCol = mix(dayCol, cyanTone, clamp(cyanAbsorb * 0.88, 0.0, 0.93));

          dayCol = mix(dayCol, vec3(0.97, 0.96, 0.93), clamp(mistDay * 0.45, 0.0, 0.6));

          // Night composition (obsidian Xuan inkstone + subtle ghostly smoke + glowing mineral pigments)
          vec3 nightCol = nightPaper;
          float sumiNight = 1.0 - exp(-sumi * 1.25);
          nightCol += vec3(0.24, 0.27, 0.27) * sumiNight * 0.22;
          nightCol = mix(nightCol, vec3(0.82, 0.24, 0.22), clamp(cinnabarAbsorb * 0.72, 0.0, 0.84));
          nightCol = mix(nightCol, vec3(0.24, 0.68, 0.60), clamp(cyanAbsorb * 0.72, 0.0, 0.84));
          float mistNight = 1.0 - exp(-mist * 1.75);
          nightCol += vec3(0.78, 0.82, 0.80) * mistNight * 0.72;

          vec3 finalCol = mix(dayCol, nightCol, uNight);
          gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
        }
      `;

      this.programs = {
        clear: this._createProgram(baseVS, clearFS),
        splat: this._createProgram(baseVS, splatFS),
        vortexSplat: this._createProgram(baseVS, vortexSplatFS),
        ringSplat: this._createProgram(baseVS, ringSplatFS),
        waterDilute: this._createProgram(baseVS, waterDiluteFS),
        glyphSplat: this._createProgram(baseVS, glyphSplatFS),
        advection: this._createProgram(baseVS, advectionFS),
        divergence: this._createProgram(baseVS, divergenceFS),
        curl: this._createProgram(baseVS, curlFS),
        vorticity: this._createProgram(baseVS, vorticityFS),
        pressure: this._createProgram(baseVS, pressureFS),
        gradSubtract: this._createProgram(baseVS, gradSubtractFS),
        display: this._createProgram(baseVS, displayFS)
      };
    }

    _initQuad() {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      );
      const ibuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      this.quadBuffer = buf;
      this.quadIndexBuffer = ibuf;
    }

    _initGlyphTexture() {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.glyphTexture = tex;
    }

    _createFBO(w, h, internalFormat, format, type, filtering) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const texelSizeX = 1.0 / w;
      const texelSizeY = 1.0 / h;
      return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX,
        texelSizeY,
        attach: (id) => {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        }
      };
    }

    _createDoubleFBO(w, h, internalFormat, format, type, filtering) {
      let fbo1 = this._createFBO(w, h, internalFormat, format, type, filtering);
      let fbo2 = this._createFBO(w, h, internalFormat, format, type, filtering);
      return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
          return fbo1;
        },
        set read(v) {
          fbo1 = v;
        },
        get write() {
          return fbo2;
        },
        set write(v) {
          fbo2 = v;
        },
        swap() {
          const t = fbo1;
          fbo1 = fbo2;
          fbo2 = t;
        }
      };
    }

    _blit(target) {
      const gl = this.gl;
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    _getResolution(baseHeight) {
      const gl = this.gl;
      let aspect = gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1);
      if (aspect < 1) aspect = 1 / aspect;
      const min = Math.round(baseHeight);
      const max = Math.round(baseHeight * aspect);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
        return { width: max, height: min };
      }
      return { width: min, height: max };
    }

    resize() {
      if (!this.supported) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (this.canvas.width === w && this.canvas.height === h && this.dye) {
        return;
      }
      this.canvas.width = w;
      this.canvas.height = h;

      const gl = this.gl;
      const simRes = this._getResolution(this.config.simHeight);
      const dyeRes = this._getResolution(this.config.dyeHeight);
      const filtering = this.supportLinear ? gl.LINEAR : gl.NEAREST;

      if (!this.dye) {
        this.dye = this._createDoubleFBO(
          dyeRes.width,
          dyeRes.height,
          this.formatRGBA.internalFormat,
          this.formatRGBA.format,
          this.texType,
          filtering
        );
        this.velocity = this._createDoubleFBO(
          simRes.width,
          simRes.height,
          this.formatRG.internalFormat,
          this.formatRG.format,
          this.texType,
          filtering
        );
        this.divergence = this._createFBO(
          simRes.width,
          simRes.height,
          this.formatR.internalFormat,
          this.formatR.format,
          this.texType,
          gl.NEAREST
        );
        this.curl = this._createFBO(
          simRes.width,
          simRes.height,
          this.formatR.internalFormat,
          this.formatR.format,
          this.texType,
          gl.NEAREST
        );
        this.pressure = this._createDoubleFBO(
          simRes.width,
          simRes.height,
          this.formatR.internalFormat,
          this.formatR.format,
          this.texType,
          gl.NEAREST
        );
      }
    }

    /**
     * Splat brush pigment + fluid velocity at normalized screen coordinates (0..1, top-left origin)
     */
    splat(normX, normY, velX, velY, pigmentVec4, radius) {
      if (!this.supported) return;
      const gl = this.gl;
      const uvX = normX;
      const uvY = 1.0 - normY;
      const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
      const r = radius || 0.00055;

      const prog = this.programs.splat;
      gl.useProgram(prog.program);
      gl.uniform1f(prog.uniforms.aspectRatio, aspect);
      gl.uniform2f(prog.uniforms.point, uvX, uvY);
      gl.uniform1f(prog.uniforms.radius, r);

      // Velocity impulse
      gl.uniform1i(prog.uniforms.uTarget, this.velocity.read.attach(0));
      gl.uniform4f(prog.uniforms.color, velX, -velY, 0.0, 0.0);
      this._blit(this.velocity.write);
      this.velocity.swap();

      // Pigment injection
      if (pigmentVec4) {
        gl.uniform1i(prog.uniforms.uTarget, this.dye.read.attach(0));
        gl.uniform4f(
          prog.uniforms.color,
          pigmentVec4[0],
          pigmentVec4[1],
          pigmentVec4[2],
          pigmentVec4[3]
        );
        this._blit(this.dye.write);
        this.dye.swap();
      }
    }

    /**
     * Pour clean water (Shift + drag): dilutes ink locally while pushing outward swirls
     */
    splashWater(normX, normY, velX, velY, radius, dilution) {
      if (!this.supported) return;
      const gl = this.gl;
      const uvX = normX;
      const uvY = 1.0 - normY;
      const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
      const r = radius || 0.0018;

      // Velocity push
      const splat = this.programs.splat;
      gl.useProgram(splat.program);
      gl.uniform1f(splat.uniforms.aspectRatio, aspect);
      gl.uniform2f(splat.uniforms.point, uvX, uvY);
      gl.uniform1f(splat.uniforms.radius, r);
      gl.uniform1i(splat.uniforms.uTarget, this.velocity.read.attach(0));
      gl.uniform4f(splat.uniforms.color, velX * 1.45, -velY * 1.45, 0.0, 0.0);
      this._blit(this.velocity.write);
      this.velocity.swap();

      // Dilute mineral dye
      const wd = this.programs.waterDilute;
      gl.useProgram(wd.program);
      gl.uniform1f(wd.uniforms.aspectRatio, aspect);
      gl.uniform2f(wd.uniforms.point, uvX, uvY);
      gl.uniform1f(wd.uniforms.radius, r * 1.4);
      gl.uniform1f(wd.uniforms.dilution, dilution !== undefined ? dilution : 0.35);
      gl.uniform1i(wd.uniforms.uTarget, this.dye.read.attach(0));
      this._blit(this.dye.write);
      this.dye.swap();
    }

    /**
     * Expanding shockwave ring (used for 雷 thunderbolt & 水 water rings)
     */
    splatRing(normX, normY, radius, thickness, velStrength, pigmentVec4, pigmentStrength) {
      if (!this.supported) return;
      const gl = this.gl;
      const uvX = normX;
      const uvY = 1.0 - normY;
      const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
      const prog = this.programs.ringSplat;

      gl.useProgram(prog.program);
      gl.uniform1f(prog.uniforms.aspectRatio, aspect);
      gl.uniform2f(prog.uniforms.point, uvX, uvY);
      gl.uniform1f(prog.uniforms.radius, radius);
      gl.uniform1f(prog.uniforms.thickness, thickness);

      if (velStrength) {
        gl.uniform1i(prog.uniforms.isVelocity, 1);
        gl.uniform1f(prog.uniforms.strength, velStrength);
        gl.uniform1i(prog.uniforms.uTarget, this.velocity.read.attach(0));
        this._blit(this.velocity.write);
        this.velocity.swap();
      }

      if (pigmentVec4 && pigmentStrength) {
        gl.uniform1i(prog.uniforms.isVelocity, 0);
        gl.uniform1f(prog.uniforms.strength, pigmentStrength);
        gl.uniform4f(
          prog.uniforms.pigment,
          pigmentVec4[0],
          pigmentVec4[1],
          pigmentVec4[2],
          pigmentVec4[3]
        );
        gl.uniform1i(prog.uniforms.uTarget, this.dye.read.attach(0));
        this._blit(this.dye.write);
        this.dye.swap();
      }
    }

    /**
     * Stamp a calligraphic Chinese character into the fluid dye field and schedule
     * dipolar counter-rotating vortex liquefaction ("字落化墨").
     */
    stampGlyph(char, normX, normY, options) {
      if (!this.supported) return;
      const opts = options || {};
      const size = opts.size || 0.16;
      const pigment = opts.pigment || [1.35, 0.0, 0.0, 0.0];
      const swirlDelay = opts.swirlDelay !== undefined ? opts.swirlDelay : 0.24;
      const swirlPower = opts.swirlPower !== undefined ? opts.swirlPower : 1.0;

      // Render crisp calligraphic character onto offscreen 256x256 canvas
      const ctx = this.glyphCtx;
      const cw = this.glyphCanvas.width;
      const ch = this.glyphCanvas.height;
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '600 182px "STKaiti", "Kaiti SC", "KaiTi", "Ma Shan Zheng", "Noto Serif SC", serif';
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#000000";
      ctx.fillText(char, cw * 0.5, ch * 0.53);
      ctx.restore();

      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.glyphTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.glyphCanvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      const prog = this.programs.glyphSplat;
      const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
      gl.useProgram(prog.program);
      gl.uniform1i(prog.uniforms.uTarget, this.dye.read.attach(0));
      gl.uniform1i(prog.uniforms.uGlyph, 1);
      gl.uniform1f(prog.uniforms.aspectRatio, aspect);
      gl.uniform2f(prog.uniforms.center, normX, 1.0 - normY);
      gl.uniform1f(prog.uniforms.size, size);
      gl.uniform4f(prog.uniforms.pigment, pigment[0], pigment[1], pigment[2], pigment[3]);
      this._blit(this.dye.write);
      this.dye.swap();

      // Subtle initial wet bloom impulse (only when non-vortex or tiny micro-settle)
      const angle0 = opts.angle !== undefined ? opts.angle : (Math.random() - 0.5) * 0.8 - Math.PI * 0.5;
      if (!opts.inPlaceSpiral) {
        this.splat(
          normX,
          normY,
          Math.cos(angle0) * 12 * swirlPower,
          Math.sin(angle0) * 12 * swirlPower,
          null,
          0.0009
        );
      }

      // Schedule organic concentric spiral liquefaction ("墨生" Nautilus vortex signature, matches f_003!)
      this._pendingSwirls.push({
        normX,
        normY,
        delay: swirlDelay,
        elapsed: 0,
        duration: opts.swirlDuration || 0.85,
        power: swirlPower,
        radius: opts.vortexRadius || size * 0.42,
        chirality: opts.chirality || (Math.random() < 0.5 ? 1 : -1)
      });
    }

    splatVortex(normX, normY, radius, omega, pull = 0.0) {
      if (!this.supported) return;
      const gl = this.gl;
      const prog = this.programs.vortexSplat;
      const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
      gl.useProgram(prog.program);
      gl.uniform1f(prog.uniforms.aspectRatio, aspect);
      gl.uniform2f(prog.uniforms.center, normX, 1.0 - normY);
      gl.uniform1f(prog.uniforms.radius, radius);
      gl.uniform1f(prog.uniforms.omega, omega);
      gl.uniform1f(prog.uniforms.pull, pull);
      gl.uniform1i(prog.uniforms.uTarget, this.velocity.read.attach(0));
      this._blit(this.velocity.write);
      this.velocity.swap();
    }

    washClear() {
      if (!this.supported) return;
      // Expanding gentle water clear pulse across screen
      this._washTimer = 1.25;
    }

    step(dt) {
      if (!this.supported) return;
      this.resize();
      const clampedDt = Math.min(dt, 0.033);
      this.time += clampedDt;
      this.flashIntensity = Math.max(0, this.flashIntensity - clampedDt * 5.8);

      // Process scheduled glyph liquefaction vortices
      for (let i = this._pendingSwirls.length - 1; i >= 0; i--) {
        const s = this._pendingSwirls[i];
        s.elapsed += clampedDt;
        if (s.elapsed >= s.delay) {
          const t = (s.elapsed - s.delay) / s.duration;
          if (t >= 1.0) {
            this._pendingSwirls.splice(i, 1);
            continue;
          }
          const env = Math.sin(t * Math.PI) * s.power;
          this.splatVortex(
            s.normX,
            s.normY,
            s.radius * (0.92 + 0.16 * t),
            s.chirality * 62.0 * env * clampedDt * 60.0,
            26.0 * env * clampedDt * 60.0
          );
        }
      }

      const gl = this.gl;
      gl.disable(gl.BLEND);

      // 1. Curl
      const curlProg = this.programs.curl;
      gl.useProgram(curlProg.program);
      gl.uniform2f(curlProg.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform1i(curlProg.uniforms.uVelocity, this.velocity.read.attach(0));
      this._blit(this.curl);

      // 2. Vorticity confinement
      const vortProg = this.programs.vorticity;
      gl.useProgram(vortProg.program);
      gl.uniform2f(vortProg.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform1i(vortProg.uniforms.uVelocity, this.velocity.read.attach(0));
      gl.uniform1i(vortProg.uniforms.uCurl, this.curl.attach(1));
      gl.uniform1f(vortProg.uniforms.curl, this.config.curlStrength);
      gl.uniform1f(vortProg.uniforms.dt, clampedDt);
      this._blit(this.velocity.write);
      this.velocity.swap();

      // 3. Divergence
      const divProg = this.programs.divergence;
      gl.useProgram(divProg.program);
      gl.uniform2f(divProg.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform1i(divProg.uniforms.uVelocity, this.velocity.read.attach(0));
      this._blit(this.divergence);

      // 4. Decay previous pressure
      const clearProg = this.programs.clear;
      gl.useProgram(clearProg.program);
      gl.uniform1i(clearProg.uniforms.uTexture, this.pressure.read.attach(0));
      gl.uniform1f(clearProg.uniforms.value, this.config.pressureDecay);
      this._blit(this.pressure.write);
      this.pressure.swap();

      // 5. Jacobi pressure projection
      const pressProg = this.programs.pressure;
      gl.useProgram(pressProg.program);
      gl.uniform2f(pressProg.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform1i(pressProg.uniforms.uDivergence, this.divergence.attach(0));
      for (let i = 0; i < this.config.pressureIterations; i++) {
        gl.uniform1i(pressProg.uniforms.uPressure, this.pressure.read.attach(1));
        this._blit(this.pressure.write);
        this.pressure.swap();
      }

      // 6. Subtract pressure gradient
      const gradProg = this.programs.gradSubtract;
      gl.useProgram(gradProg.program);
      gl.uniform2f(gradProg.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform1i(gradProg.uniforms.uPressure, this.pressure.read.attach(0));
      gl.uniform1i(gradProg.uniforms.uVelocity, this.velocity.read.attach(1));
      this._blit(this.velocity.write);
      this.velocity.swap();

      // 7. Advect velocity
      const advProg = this.programs.advection;
      gl.useProgram(advProg.program);
      gl.uniform2f(advProg.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform2f(advProg.uniforms.dyeTexelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
      gl.uniform1i(advProg.uniforms.uVelocity, this.velocity.read.attach(0));
      gl.uniform1i(advProg.uniforms.uSource, this.velocity.read.attach(0));
      gl.uniform1f(advProg.uniforms.dt, clampedDt);
      gl.uniform1f(advProg.uniforms.dissipation, this.config.velocityDissipation);
      gl.uniform1i(advProg.uniforms.manualFilter, this.supportLinear ? 0 : 1);
      this._blit(this.velocity.write);
      this.velocity.swap();

      // 8. Advect 4-channel mineral dye
      let dyeDiss = this.config.dyeDissipation;
      if (this._washTimer && this._washTimer > 0) {
        this._washTimer -= clampedDt;
        dyeDiss = 0.91;
      }
      gl.uniform2f(advProg.uniforms.dyeTexelSize, this.dye.texelSizeX, this.dye.texelSizeY);
      gl.uniform1i(advProg.uniforms.uVelocity, this.velocity.read.attach(0));
      gl.uniform1i(advProg.uniforms.uSource, this.dye.read.attach(1));
      gl.uniform1f(advProg.uniforms.dissipation, dyeDiss);
      this._blit(this.dye.write);
      this.dye.swap();

      // 9. Render Xuan paper + optical mineral ink
      const disp = this.programs.display;
      gl.useProgram(disp.program);
      gl.uniform1i(disp.uniforms.uDye, this.dye.read.attach(0));
      gl.uniform2f(disp.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(disp.uniforms.uNight, this.nightMix);
      gl.uniform1f(disp.uniforms.uFlash, this.flashIntensity);
      gl.uniform1f(disp.uniforms.uTime, this.time);
      this._blit(null);
    }
  }

  global.InkFluidEngine = InkFluidEngine;
})(window);
