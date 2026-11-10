import * as THREE from 'three';

export class AtmosphereFX {
  constructor(scene) {
    this.scene = scene;

    // 1. Floating Golden Sunset Motes around the player
    this.moteCount = 360;
    this.motePositions = new Float32Array(this.moteCount * 3);
    this.motePhases = new Float32Array(this.moteCount);

    for (let i = 0; i < this.moteCount; i++) {
      this.motePositions[i * 3] = (Math.random() - 0.5) * 90;
      this.motePositions[i * 3 + 1] = 14 + Math.random() * 52;
      this.motePositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
      this.motePhases[i] = Math.random() * Math.PI * 2;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePositions, 3));
    moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(this.motePhases, 1));

    const moteMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        uniform vec3 uCameraPos;
        varying float vAlpha;
        varying float vWarmth;

        void main() {
          // Wrap mote coordinates into a 90x50x90 box centered around camera
          vec3 rel = position - uCameraPos;
          rel.x = mod(rel.x + 45.0, 90.0) - 45.0;
          rel.z = mod(rel.z + 45.0, 90.0) - 45.0;
          rel.y = mod(rel.y + 20.0, 50.0) - 20.0;

          vec3 worldPos = uCameraPos + rel;
          worldPos.x += sin(uTime * 0.65 + aPhase) * 0.9;
          worldPos.y += cos(uTime * 0.45 + aPhase * 1.3) * 0.6;
          worldPos.z += sin(uTime * 0.55 - aPhase) * 0.9;

          float dist = length(worldPos - uCameraPos);
          vAlpha = smoothstep(44.0, 12.0, dist) * smoothstep(1.5, 5.0, dist) *
                   (0.45 + 0.55 * sin(uTime * 2.2 + aPhase * 3.0));
          vWarmth = fract(aPhase * 1.7);

          vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
          gl_PointSize = clamp(110.0 / max(1.0, -mvPos.z), 1.5, 5.5);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vWarmth;

        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r2 = dot(c, c);
          if (r2 > 0.25) discard;
          float soft = exp(-r2 * 14.0);
          vec3 col = mix(vec3(1.15, 0.62, 0.28), vec3(1.45, 0.92, 0.42), vWarmth);
          gl_FragColor = vec4(col, soft * vAlpha * 0.72);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.motePoints = new THREE.Points(moteGeo, moteMat);
    this.motePoints.frustumCulled = false;
    this.scene.add(this.motePoints);

    // 2. Distant Sunset Seabirds wheeling over the bay toward the sun
    this.birds = [];
    this.birdGroup = new THREE.Group();
    this.scene.add(this.birdGroup);
    this.initSeabirds();

    // 3. Dynamic Block-Break Debris & Firework Boost Particles
    this.debrisList = [];
    this.debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.debrisGroup = new THREE.Group();
    this.scene.add(this.debrisGroup);
  }

  initSeabirds() {
    const wingGeo = new THREE.BufferGeometry();
    // Simple 2-wing chevron mesh (left wing + right wing)
    const positions = new Float32Array([
      // Left wing
      0, 0, -0.35,   -1.15, 0.15, 0.1,   0, 0, 0.35,
      // Right wing
      0, 0, -0.35,    0, 0, 0.35,         1.15, 0.15, 0.1
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const birdMat = new THREE.MeshBasicMaterial({
      color: 0x261528,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 14; i++) {
      const bird = new THREE.Mesh(wingGeo.clone(), birdMat);
      const scale = 0.45 + Math.random() * 0.35;
      bird.scale.setScalar(scale);

      const orbitCenter = new THREE.Vector3(
        -8 + (Math.random() - 0.5) * 35,
        34 + Math.random() * 24,
        -48 - Math.random() * 85
      );
      const radiusX = 22 + Math.random() * 28;
      const radiusZ = 16 + Math.random() * 22;
      const speed = 0.22 + Math.random() * 0.16;
      const phase = Math.random() * Math.PI * 2;
      const flapSpeed = 5.5 + Math.random() * 2.5;

      this.birdGroup.add(bird);
      this.birds.push({
        mesh: bird,
        orbitCenter,
        radiusX,
        radiusZ,
        speed,
        phase,
        flapSpeed
      });
    }
  }

  spawnBlockDebris(x, y, z, hexColor = '#a67e49', count = 20) {
    const color = new THREE.Color(hexColor);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.16)
      });
      const mesh = new THREE.Mesh(this.debrisGeo, mat);
      mesh.position.set(
        x + 0.5 + (Math.random() - 0.5) * 0.65,
        y + 0.5 + (Math.random() - 0.5) * 0.65,
        z + 0.5 + (Math.random() - 0.5) * 0.65
      );
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.2,
        1.6 + Math.random() * 3.4,
        (Math.random() - 0.5) * 4.2
      );

      this.debrisGroup.add(mesh);
      this.debrisList.push({
        mesh,
        vel,
        life: 0.65 + Math.random() * 0.45,
        age: 0,
        gravity: 13.5
      });
    }
  }

  spawnTakeoffBurst(pos) {
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffaa33 : 0xff6622
      });
      const mesh = new THREE.Mesh(this.debrisGeo, mat);
      mesh.scale.setScalar(0.85);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        -0.5 + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.2
      ));
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        -1.5 + Math.random() * 3.5,
        Math.sin(angle) * speed
      );
      this.debrisGroup.add(mesh);
      this.debrisList.push({
        mesh,
        vel,
        life: 0.55 + Math.random() * 0.35,
        age: 0,
        gravity: 3.5
      });
    }
  }

  update(dt, time, cameraPos) {
    // 1. Update motes
    this.motePoints.material.uniforms.uTime.value = time;
    this.motePoints.material.uniforms.uCameraPos.value.copy(cameraPos);

    // 2. Update distant seabirds
    for (const b of this.birds) {
      const t = time * b.speed + b.phase;
      const nx = b.orbitCenter.x + Math.cos(t) * b.radiusX;
      const nz = b.orbitCenter.z + Math.sin(t) * b.radiusZ;
      const ny = b.orbitCenter.y + Math.sin(t * 2.0) * 1.8;

      const dx = -Math.sin(t) * b.radiusX;
      const dz = Math.cos(t) * b.radiusZ;
      b.mesh.position.set(nx, ny, nz);
      b.mesh.rotation.y = Math.atan2(dx, dz);
      b.mesh.rotation.z = Math.sin(t) * 0.25;

      // Flap wing tips
      const posAttr = b.mesh.geometry.attributes.position;
      const wingY = Math.sin(time * b.flapSpeed + b.phase) * 0.35;
      posAttr.setY(1, wingY);
      posAttr.setY(5, wingY);
      posAttr.needsUpdate = true;
    }

    // 3. Update debris particles
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.age += dt;
      if (d.age >= d.life) {
        this.debrisGroup.remove(d.mesh);
        d.mesh.material.dispose();
        this.debrisList.splice(i, 1);
        continue;
      }
      d.vel.y -= d.gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt * 5.0;
      d.mesh.rotation.y += dt * 6.0;
      const scale = Math.max(0.05, 1.0 - (d.age / d.life) * 0.65);
      d.mesh.scale.setScalar(scale);
    }
  }
}
