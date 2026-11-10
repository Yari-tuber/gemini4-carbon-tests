import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  growRate: number;
  gravity: number;
}

interface Tracer {
  line: THREE.Line;
  life: number;
}

export interface CashPickup {
  mesh: THREE.Group;
  amount: number;
  life: number;
}

export class PropsAndFX {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  public cashPickups: CashPickup[] = [];

  // Skidmark ring buffer
  private skidMeshes: THREE.Mesh[] = [];
  private skidIndex = 0;
  private readonly maxSkids = 160;

  // Dynamic explosion/muzzle flash light
  private flashLight: THREE.PointLight;
  private flashTimer = 0;

  private sharedSphereGeo = new THREE.SphereGeometry(0.35, 8, 8);
  private sharedBoxGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.flashLight = new THREE.PointLight(0xffaa44, 0, 32);
    this.scene.add(this.flashLight);

    // Pre-allocate skidmark quads
    const skidGeo = new THREE.PlaneGeometry(0.45, 1.35);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x0b0b0e,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    });
    for (let i = 0; i < this.maxSkids; i++) {
      const m = new THREE.Mesh(skidGeo, skidMat);
      m.visible = false;
      m.position.y = 0.03;
      this.scene.add(m);
      this.skidMeshes.push(m);
    }
  }

  public addSkidmark(x: number, z: number, heading: number): void {
    const leftX = x + Math.cos(heading) * 0.85;
    const leftZ = z - Math.sin(heading) * 0.85;
    const rightX = x - Math.cos(heading) * 0.85;
    const rightZ = z + Math.sin(heading) * 0.85;

    const m1 = this.skidMeshes[this.skidIndex % this.maxSkids];
    m1.position.set(leftX, 0.035, leftZ);
    m1.rotation.y = heading;
    m1.visible = true;
    this.skidIndex++;

    const m2 = this.skidMeshes[this.skidIndex % this.maxSkids];
    m2.position.set(rightX, 0.035, rightZ);
    m2.rotation.y = heading;
    m2.visible = true;
    this.skidIndex++;
  }

  public spawnTireSmoke(pos: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdde2ec,
      transparent: true,
      opacity: 0.42
    });
    const m = new THREE.Mesh(this.sharedSphereGeo, mat);
    m.position.copy(pos);
    m.scale.setScalar(0.5);
    this.scene.add(m);
    this.particles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6),
      life: 0.65,
      maxLife: 0.65,
      growRate: 2.2,
      gravity: -0.3
    });
  }

  public spawnMuzzleAndTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex = 0xffe066): void {
    this.flashLight.position.copy(start);
    this.flashLight.color.setHex(colorHex);
    this.flashLight.intensity = 6.5;
    this.flashTimer = 0.055;

    const pts = [start.clone(), end.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.075 });
  }

  public spawnImpact(pos: THREE.Vector3, isFlesh: boolean): void {
    const count = isFlesh ? 6 : 5;
    const color = isFlesh ? 0xd91e36 : 0xffbe55;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9
      });
      const m = new THREE.Mesh(this.sharedBoxGeo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 6.5,
          1.5 + Math.random() * 4.0,
          (Math.random() - 0.5) * 6.5
        ),
        life: 0.38,
        maxLife: 0.38,
        growRate: -0.2,
        gravity: 12.0
      });
    }
  }

  public spawnExplosion(pos: THREE.Vector3): void {
    this.flashLight.position.set(pos.x, pos.y + 2.0, pos.z);
    this.flashLight.color.setHex(0xff6b2b);
    this.flashLight.intensity = 28;
    this.flashTimer = 0.35;

    // Fireballs
    const fireColors = [0xfff07c, 0xff7b29, 0xff2e4c, 0x2b262c];
    for (let i = 0; i < 24; i++) {
      const c = fireColors[i % fireColors.length];
      const isSmoke = i >= 14;
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: isSmoke ? 0.68 : 0.95
      });
      const m = new THREE.Mesh(this.sharedSphereGeo, mat);
      m.position.set(
        pos.x + (Math.random() - 0.5) * 2.2,
        pos.y + 0.5 + Math.random() * 1.5,
        pos.z + (Math.random() - 0.5) * 2.2
      );
      m.scale.setScalar(isSmoke ? 1.8 : 1.3);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * (isSmoke ? 7 : 13),
          (isSmoke ? 4 : 3) + Math.random() * 8,
          (Math.random() - 0.5) * (isSmoke ? 7 : 13)
        ),
        life: isSmoke ? 1.5 : 0.72,
        maxLife: isSmoke ? 1.5 : 0.72,
        growRate: isSmoke ? 4.2 : 3.4,
        gravity: isSmoke ? -1.2 : 4.5
      });
    }
  }

  public spawnCashBundle(pos: THREE.Vector3, amount: number): void {
    const group = new THREE.Group();
    const stackMat = new THREE.MeshStandardMaterial({
      color: 0x38b000,
      emissive: 0x1f6e10,
      emissiveIntensity: 0.65,
      roughness: 0.4
    });
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.28), stackMat);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.21, 0.29), bandMat);
    group.add(bill, band);

    // Subtle glowing ring under cash
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.48, 16),
      new THREE.MeshBasicMaterial({ color: 0x6ee778, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.18;
    group.add(ring);

    group.position.set(pos.x, Math.max(0.45, pos.y + 0.45), pos.z);
    this.scene.add(group);
    this.cashPickups.push({ mesh: group, amount, life: 45 });
  }

  public update(dt: number, playerPos: THREE.Vector3, onCollectCash: (amount: number) => void): void {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashLight.intensity = 0;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.life / 0.075);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vel.y *= -0.25;
      }
      const scale = Math.max(0.05, p.mesh.scale.x + p.growRate * dt);
      p.mesh.scale.setScalar(scale);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (p.life / p.maxLife) * 0.85;
    }

    for (let i = this.cashPickups.length - 1; i >= 0; i--) {
      const c = this.cashPickups[i];
      c.life -= dt;
      c.mesh.rotation.y += dt * 2.6;
      c.mesh.position.y = 0.45 + Math.sin(performance.now() * 0.005 + i) * 0.12;

      if (c.mesh.position.distanceToSquared(playerPos) < 5.5) {
        onCollectCash(c.amount);
        this.scene.remove(c.mesh);
        this.cashPickups.splice(i, 1);
        continue;
      }
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.cashPickups.splice(i, 1);
      }
    }
  }
}
