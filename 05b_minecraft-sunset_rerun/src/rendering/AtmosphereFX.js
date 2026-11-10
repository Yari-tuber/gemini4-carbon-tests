import * as THREE from 'three';
import { SUN_DIR } from '../config.js';

export class AtmosphereFX {
  constructor(scene) {
    this.scene = scene;

    // 1. Wrapping Sunlit Golden Dust / Pollen Motes around camera
    const moteCount = 420;
    const moteOffsets = new Float32Array(moteCount * 3);
    const moteSeeds = new Float32Array(moteCount * 2);
    for (let i = 0; i < moteCount; i++) {
      moteOffsets[i * 3] = (Math.random() - 0.5) * 90;
      moteOffsets[i * 3 + 1] = (Math.random() - 0.5) * 48;
      moteOffsets[i * 3 + 2] = (Math.random() - 0.5) * 90;
      moteSeeds[i * 2] = Math.random() * 100.0;
      moteSeeds[i * 2 + 1] = 0.55 + Math.random() * 0.95;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(moteOffsets, 3));
    moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeeds, 2));

    this.moteUniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: SUN_DIR.clone() },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    };

    const moteMat = new THREE.ShaderMaterial({
      uniforms: this.moteUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec2 aSeed;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform float uPixelRatio;

        varying float vAlpha;
        varying vec3 vViewDir;

        void main() {
          vec3 boxSize = vec3(90.0, 48.0, 90.0);
          vec3 drift = vec3(
            uTime * 0.65 + sin(uTime * 0.5 + aSeed.x) * 1.8,
            sin(uTime * 0.7 + aSeed.x * 1.3) * 1.4,
            uTime * 0.35 + cos(uTime * 0.45 + aSeed.x) * 1.8
          );
          vec3 rel = mod(position + drift - uCamPos + boxSize * 0.5, boxSize) - boxSize * 0.5;
          vec3 worldPos = uCamPos + rel;

          float dist = length(rel);
          vAlpha = smoothstep(44.0, 12.0, dist) * smoothstep(1.5, 5.5, dist) * (0.55 + 0.45 * sin(uTime * 2.1 + aSeed.x));
          vViewDir = normalize(worldPos - uCamPos);

          vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = clamp((34.0 * aSeed.y * uPixelRatio) / max(-mvPos.z, 1.0), 1.5, 6.5);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        varying float vAlpha;
        varying vec3 vViewDir;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float soft = pow(1.0 - d * 2.0, 2.0);
          float forwardScatter = 0.35 + 1.15 * pow(max(dot(vViewDir, uSunDir), 0.0), 3.0);
          vec3 col = vec3(1.45, 0.72, 0.22) * forwardScatter;
          gl_FragColor = vec4(col, soft * vAlpha * 0.55);
        }
      `,
    });

    this.motes = new THREE.Points(moteGeo, moteMat);
    this.motes.frustumCulled = false;
    scene.add(this.motes);

    // 2. Graceful Coastal Seabirds Soaring over Sunset Bay
    this.birds = [];
    this.birdGroup = new THREE.Group();
    const wingGeo = this._createBirdGeometry();
    this.birdUniforms = { uTime: { value: 0 } };
    const birdMat = new THREE.ShaderMaterial({
      uniforms: this.birdUniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aWingSide;
        uniform float uTime;
        uniform float uPhase;
        void main() {
          vec3 p = position;
          // Gentle natural seabird wingbeat + glide pause
          float cycle = uTime * 3.8 + modelMatrix[3][0] * 0.15 + modelMatrix[3][2] * 0.15;
          float glideMask = smoothstep(-0.2, 0.5, sin(cycle * 0.28));
          float flap = sin(cycle) * 0.38 * glideMask + 0.10;
          p.y += abs(p.x) * flap;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        void main() {
          // Warm dark twilight silhouette catching faint golden rim
          gl_FragColor = vec4(0.065, 0.042, 0.075, 1.0);
        }
      `,
    });

    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(wingGeo, birdMat);
      const scale = 0.75 + Math.random() * 0.45;
      mesh.scale.setScalar(scale);
      this.birdGroup.add(mesh);
      this.birds.push({
        mesh,
        centerX: -25 + (Math.random() - 0.5) * 95,
        centerZ: -35 - Math.random() * 115,
        alt: 44 + Math.random() * 28,
        radiusX: 28 + Math.random() * 38,
        radiusZ: 22 + Math.random() * 32,
        speed: (0.14 + Math.random() * 0.10) * (i % 2 === 0 ? 1 : -1),
        angle: Math.random() * Math.PI * 2,
      });
    }
    scene.add(this.birdGroup);

    // 3. Crisp Voxel Block Target Selection Box
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    const boxMat = new THREE.LineBasicMaterial({
      color: 0xffe4b5,
      transparent: true,
      opacity: 0.75,
    });
    this.selectionBox = new THREE.LineSegments(boxEdges, boxMat);
    this.selectionBox.visible = false;
    scene.add(this.selectionBox);
  }

  _createBirdGeometry() {
    // Simple 4-triangle V-wing gull silhouette in XZ plane
    const pos = new Float32Array([
      // Left wing
      0.0, 0.0,  0.28,
      -1.15, 0.0, -0.18,
      0.0, 0.0, -0.22,
      // Right wing
      0.0, 0.0,  0.28,
      0.0, 0.0, -0.22,
      1.15, 0.0, -0.18,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }

  update(elapsed, cameraPos, rayHit) {
    this.moteUniforms.uTime.value = elapsed;
    this.moteUniforms.uCamPos.value.copy(cameraPos);
    this.birdUniforms.uTime.value = elapsed;

    for (const b of this.birds) {
      const a = b.angle + elapsed * b.speed;
      const x = b.centerX + Math.cos(a) * b.radiusX;
      const z = b.centerZ + Math.sin(a) * b.radiusZ;
      const y = b.alt + Math.sin(elapsed * 0.6 + b.angle) * 2.2;

      const dx = -Math.sin(a) * b.radiusX * b.speed;
      const dz = Math.cos(a) * b.radiusZ * b.speed;
      b.mesh.position.set(x, y, z);
      b.mesh.rotation.y = Math.atan2(dx, dz);
      b.mesh.rotation.z = -b.speed * 1.2;
    }

    if (rayHit) {
      this.selectionBox.visible = true;
      this.selectionBox.position.set(rayHit.x + 0.5, rayHit.y + 0.5, rayHit.z + 0.5);
    } else {
      this.selectionBox.visible = false;
    }
  }

  onResize() {
    this.moteUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
  }
}
