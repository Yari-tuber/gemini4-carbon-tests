import * as THREE from 'three';
import { BLOCK } from '../world/blocks.js';
import { SEA_LEVEL } from '../world/World.js';

export class SunsetGameDirector {
  constructor(scene, camera, world, player, atmosphereFX, soundManager, onHudUpdate) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.atmosphereFX = atmosphereFX;
    this.soundManager = soundManager;
    this.onHudUpdate = onHudUpdate;

    // Gameplay progression state
    this.score = 0;
    this.ringsCollected = 0;
    this.totalRings = 12;
    this.combo = 0;
    this.comboTimer = 0;
    this.altarsLit = 0;
    this.totalAltars = 5;
    this.isWaveSkimming = false;
    this.skyWalkEnabled = false;
    this.blueprintIndex = 0;
    this.blueprintNames = ['落日观景凉亭', '海岸篝火营地', '高空弹射跳台'];

    // Grappling hook state (Q key)
    this.grappleActive = false;
    this.grappleTarget = new THREE.Vector3();
    this.grappleLine = null;
    this.initGrappleLine();

    // Groups for 3D interactive elements
    this.ringGroup = new THREE.Group();
    this.altarGroup = new THREE.Group();
    this.updraftGroup = new THREE.Group();
    this.wildlifeGroup = new THREE.Group();
    this.scene.add(this.ringGroup);
    this.scene.add(this.altarGroup);
    this.scene.add(this.updraftGroup);
    this.scene.add(this.wildlifeGroup);

    this.rings = [];
    this.altars = [];
    this.updrafts = [];
    this.dolphins = [];
    this.shootingStars = [];
    this.jumpPads = [];

    this.initSkyRings();
    this.initAltars();
    this.initUpdrafts();
    this.initDolphinsAndStars();
  }

  initGrappleLine() {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1)
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffd466,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });
    this.grappleLine = new THREE.Line(geo, mat);
    this.grappleLine.visible = false;
    this.grappleLine.frustumCulled = false;
    this.scene.add(this.grappleLine);
  }

  // 1. Aerial Sky-Ring Course weaving through the bay, Sea Arch, Sun Road & Lighthouse
  initSkyRings() {
    const ringWaypoints = [
      { pos: new THREE.Vector3(-3, 33, 14),   rotY: 0.12 },  // Ring 1: Right below high-altitude spawn flight path!
      { pos: new THREE.Vector3(-9, 26, -6),   rotY: 0.25 },  // Ring 2: Diving over the central bay
      { pos: new THREE.Vector3(-19, 21, -26), rotY: 0.35 },  // Ring 3: Approaching the Natural Sea Arch
      { pos: new THREE.Vector3(-28, 18.5, -46), rotY: 0.0 }, // Ring 4: THREADING RIGHT THROUGH THE SEA ARCH!
      { pos: new THREE.Vector3(-16, 17.2, -68), rotY: -0.6 },// Ring 5: Skimming low onto the Golden Sun Road!
      { pos: new THREE.Vector3(2, 16.8, -76),  rotY: -1.3 }, // Ring 6: Wave-skimming directly under the Orange Sun!
      { pos: new THREE.Vector3(18, 21, -54),  rotY: -2.2 },  // Ring 7: Banking back toward the Lighthouse
      { pos: new THREE.Vector3(28, 36, -22),  rotY: -2.8 },  // Ring 8: Soaring over the Lighthouse beacon
      { pos: new THREE.Vector3(15, 25, 2),    rotY: 2.6 },   // Ring 9: Swooping over the Sunset Pier
      { pos: new THREE.Vector3(-34, 34, -12), rotY: 0.8 },   // Ring 10: High above West Maple Cliff ridge
      { pos: new THREE.Vector3(0, 46, 48),    rotY: 0.0 },   // Ring 11: Highland valley thermal
      { pos: new THREE.Vector3(28, 40, 24),   rotY: -0.8 }   // Ring 12: East pine ridge
    ];

    const torusGeo = new THREE.TorusGeometry(3.2, 0.22, 12, 36);
    const innerGeo = new THREE.TorusGeometry(2.7, 0.08, 8, 32);

    ringWaypoints.forEach((wp, idx) => {
      const holder = new THREE.Group();
      holder.position.copy(wp.pos);
      holder.rotation.y = wp.rotY;

      const mat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0xffe066 : 0xff9d3b
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75
      });

      const outerMesh = new THREE.Mesh(torusGeo, mat);
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      holder.add(outerMesh);
      holder.add(innerMesh);

      this.ringGroup.add(holder);
      this.rings.push({
        index: idx,
        group: holder,
        outerMesh,
        innerMesh,
        position: wp.pos.clone(),
        collected: false,
        respawnTimer: 0
      });
    });
  }

  // 2. Five Ancient Sunset Altars / Beacons at key landmarks
  initAltars() {
    const altarSpots = [
      { name: '海湾金沙祭坛', x: 12, z: 0, yOffset: 1 },
      { name: '东岸落日灯塔祭坛', x: 26, z: -12, yOffset: 1 },
      { name: '海上苍穹石拱祭坛', x: -28, z: -46, yForce: 31 },
      { name: '西峡晚霞金枫祭坛', x: -38, z: 12, yOffset: 1 },
      { name: '南岭云端翠峰祭坛', x: 14, z: 54, yOffset: 1 }
    ];

    altarSpots.forEach((spot, idx) => {
      const baseH = spot.yForce !== undefined
        ? spot.yForce
        : Math.max(SEA_LEVEL + 2, this.world.getSurfaceHeight(spot.x, spot.z) + (spot.yOffset || 1));

      // Build a 3x3 stone-brick & terracotta shrine pedestal in the voxel world
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          this.world.setBlock(spot.x + dx, baseH - 1, spot.z + dz, BLOCK.STONE_BRICKS);
        }
      }
      this.world.setBlock(spot.x, baseH, spot.z, BLOCK.TERRACOTTA);

      const group = new THREE.Group();
      group.position.set(spot.x + 0.5, baseH + 1.8, spot.z + 0.5);

      // Floating Octahedron Sunset Crystal
      const crystalGeo = new THREE.OctahedronGeometry(0.75, 0);
      const crystalMat = new THREE.MeshBasicMaterial({
        color: 0xff7733,
        wireframe: false
      });
      const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
      group.add(crystalMesh);

      // Wireframe cage around crystal
      const cageGeo = new THREE.OctahedronGeometry(1.05, 0);
      const cageMat = new THREE.MeshBasicMaterial({
        color: 0xffd27d,
        wireframe: true,
        transparent: true,
        opacity: 0.7
      });
      const cageMesh = new THREE.Mesh(cageGeo, cageMat);
      group.add(cageMesh);

      // Guide pillar beam (subtle before lighting, blazing golden sky-beam after lighting!)
      const beamGeo = new THREE.CylinderGeometry(0.09, 0.09, 120, 12, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.y = 60;
      group.add(beamMesh);

      this.altarGroup.add(group);
      this.altars.push({
        index: idx,
        name: spot.name,
        x: spot.x,
        y: baseH,
        z: spot.z,
        position: new THREE.Vector3(spot.x + 0.5, baseH + 1.5, spot.z + 0.5),
        group,
        crystalMesh,
        cageMesh,
        beamMesh,
        lit: false
      });
    });
  }

  // 3. Swirling Golden Thermal Updraft Columns (上升热气流柱)
  initUpdrafts() {
    const updraftCoords = [
      { x: -18, z: -14 }, // West bay entrance thermal
      { x: -30, z: -34 }, // Sea Arch approach thermal
      { x: 20,  z: -30 }, // Lighthouse cove thermal
      { x: 22,  z: 14 }   // East coastal meadow thermal
    ];

    const spiralGeo = new THREE.CylinderGeometry(2.4, 1.6, 24, 16, 8, true);
    const spiralMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float spiral = sin(vUv.x * 18.8495 - vUv.y * 14.0 + uTime * 5.0);
          float ribbon = smoothstep(0.72, 0.99, spiral);
          float vertFade = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.20, vUv.y);
          vec3 col = mix(vec3(1.10, 0.52, 0.18), vec3(1.40, 0.88, 0.42), vUv.y);
          gl_FragColor = vec4(col, ribbon * vertFade * 0.22);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.updraftMaterial = spiralMat;

    updraftCoords.forEach((c) => {
      const baseY = Math.max(SEA_LEVEL, this.world.getSurfaceHeight(c.x, c.z));
      const mesh = new THREE.Mesh(spiralGeo, spiralMat);
      mesh.position.set(c.x + 0.5, baseY + 12, c.z + 0.5);
      this.updraftGroup.add(mesh);

      this.updrafts.push({
        x: c.x + 0.5,
        baseY,
        z: c.z + 0.5,
        radius: 3.4,
        mesh
      });
    });
  }

  // 4. Leaping Sunset Dolphins in the Bay & Shooting Stars in the Twilight Sky
  initDolphinsAndStars() {
    // Voxel-styled leaping dolphins along the Sun Road
    const dolphinMat = new THREE.MeshBasicMaterial({ color: 0x2e2442 });
    for (let i = 0; i < 4; i++) {
      const dGroup = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, 1.35), dolphinMat);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.45), dolphinMat);
      snout.position.set(0, -0.04, -0.82);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.36, 0.32), dolphinMat);
      fin.position.set(0, 0.28, 0.05);
      fin.rotation.x = -0.35;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.10, 0.35), dolphinMat);
      tail.position.set(0, 0, 0.78);

      dGroup.add(body, snout, fin, tail);
      this.wildlifeGroup.add(dGroup);

      this.dolphins.push({
        group: dGroup,
        centerX: -6 + i * 7,
        centerZ: -32 - i * 16,
        phase: i * 1.7,
        speed: 1.35 + (i % 2) * 0.2
      });
    }

    // Shooting stars across the upper twilight sky
    const starGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-18, 6, 4)
    ]);
    const starMat = new THREE.LineBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 3; i++) {
      const line = new THREE.Line(starGeo.clone(), starMat.clone());
      this.wildlifeGroup.add(line);
      this.shootingStars.push({
        line,
        pos: new THREE.Vector3((Math.random() - 0.5) * 400, 180 + Math.random() * 140, -380 - Math.random() * 200),
        vel: new THREE.Vector3(65 + Math.random() * 35, -22, 10),
        timer: i * 2.8
      });
    }
  }

  // Trigger Grappling Hook (Q key) toward aimed voxel or sky ring / altar!
  triggerGrapple() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.normalize();

    // First check if aiming near any Sky Ring or Altar within 75m
    let bestTarget = null;
    for (const ring of this.rings) {
      const toRing = ring.position.clone().sub(origin);
      const dist = toRing.length();
      if (dist > 6 && dist < 75) {
        const align = toRing.normalize().dot(dir);
        if (align > 0.92) {
          bestTarget = ring.position.clone();
          break;
        }
      }
    }

    // Otherwise raycast against voxel world up to 72m
    if (!bestTarget) {
      for (let d = 2.0; d <= 72.0; d += 0.65) {
        const p = origin.clone().addScaledVector(dir, d);
        const blk = this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
        if (blk !== BLOCK.AIR) {
          bestTarget = p;
          break;
        }
      }
    }

    // Even if aiming at open sky, allow an "Aerial Cloud Grapple" boost!
    if (!bestTarget) {
      bestTarget = origin.clone().addScaledVector(dir, 36.0);
      bestTarget.y = Math.max(bestTarget.y, origin.y + 10.0);
    }

    this.grappleActive = true;
    this.grappleTarget.copy(bestTarget);
    this.grappleTimer = 0.68;

    const toTarget = bestTarget.clone().sub(this.player.position);
    const dist = toTarget.length();
    toTarget.normalize();

    const pullSpeed = Math.min(28.0, Math.max(17.5, dist * 0.65));
    this.player.onGround = false;
    this.player.position.y += 0.4;
    this.player.velocity.copy(toTarget.multiplyScalar(pullSpeed));
    this.player.velocity.y = Math.max(this.player.velocity.y + 4.5, 7.5);
    this.player.glideSpeed = Math.max(this.player.glideSpeed, 16.5);
    this.player.setMode('GLIDING', '🪝 飞索抓钩牵引中 · 高速滑翔突进！');

    if (this.atmosphereFX) this.atmosphereFX.spawnTakeoffBurst(bestTarget);
    this.playChordNote(587.33); // D5
  }

  // Toggle Sky-Walk Auto-Bridge (V key)
  toggleSkyWalk() {
    this.skyWalkEnabled = !this.skyWalkEnabled;
    const msg = this.skyWalkEnabled
      ? '🌉 已开启「踏空流金栈道 (V)」· 步行时脚下自动生成手持方块！'
      : '已关闭「踏空流金栈道」';
    this.player.setMode(this.player.mode, msg);
    this.playChordNote(this.skyWalkEnabled ? 659.25 : 440.0);
    this.notifyHud();
  }

  // Instant Voxel Blueprint Builder (B key)
  placeBlueprint(blockInteraction) {
    const hit = blockInteraction.raycast();
    const basePos = hit
      ? new THREE.Vector3(hit.x, hit.y + 1, hit.z)
      : new THREE.Vector3(
          Math.floor(this.player.position.x - Math.sin(this.player.yaw) * 5),
          Math.floor(this.player.position.y),
          Math.floor(this.player.position.z - Math.cos(this.player.yaw) * 5)
        );

    const bx = basePos.x;
    const by = basePos.y;
    const bz = basePos.z;
    const type = this.blueprintIndex % this.blueprintNames.length;
    const name = this.blueprintNames[type];
    this.blueprintIndex++;

    if (type === 0) {
      // 1. Sunset Gazebo (落日观景凉亭)
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.world.setBlock(bx + dx, by, bz + dz, BLOCK.OAK_PLANKS);
          this.world.setBlock(bx + dx, by + 4, bz + dz, BLOCK.TERRACOTTA);
        }
      }
      for (const [cx, cz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        for (let y = 1; y <= 3; y++) {
          this.world.setBlock(bx + cx, by + y, bz + cz, BLOCK.OAK_LOG);
        }
      }
      this.world.setBlock(bx, by + 3, bz, BLOCK.GLOWSTONE);
      this.world.setBlock(bx, by + 5, bz, BLOCK.OAK_PLANKS);
    } else if (type === 1) {
      // 2. Campfire & Lantern Outlook (海岸篝火营地)
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          this.world.setBlock(bx + dx, by, bz + dz, BLOCK.COBBLESTONE);
        }
      }
      this.world.setBlock(bx, by + 1, bz, BLOCK.GLOWSTONE);
      this.world.setBlock(bx - 2, by, bz, BLOCK.OAK_LOG);
      this.world.setBlock(bx + 2, by, bz, BLOCK.OAK_LOG);
      this.world.setBlock(bx, by, bz - 2, BLOCK.OAK_LOG);
    } else {
      // 3. Sky Launch Pad (高空弹射跳台)
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          this.world.setBlock(bx + dx, by, bz + dz, BLOCK.STONE_BRICKS);
        }
      }
      this.world.setBlock(bx, by, bz, BLOCK.GLOWSTONE);
      this.jumpPads.push(new THREE.Vector3(bx + 0.5, by + 1.0, bz + 0.5));
    }

    if (this.atmosphereFX) {
      this.atmosphereFX.spawnTakeoffBurst(new THREE.Vector3(bx + 0.5, by + 1.5, bz + 0.5));
    }
    this.playChordNote(783.99);
    this.score += 50;
    this.player.setMode(this.player.mode, `🏰 已一键建造「${name}」！(按 B 切换下一蓝图)`);
    this.notifyHud();
  }

  // Musical harmonic chime synthesizer for ring combos & altar ignition
  playChordNote(freq = 523.25) {
    if (!this.soundManager || !this.soundManager.ctx || this.soundManager.muted) return;
    const ctx = this.soundManager.ctx;
    const now = ctx.currentTime;

    const notes = [freq, freq * 1.25, freq * 1.5];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.045);

      gain.gain.setValueAtTime(0.055, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.045 + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.6);
    });
  }

  igniteAltar(altar) {
    if (altar.lit) return;
    altar.lit = true;
    this.altarsLit++;
    this.score += 250;

    // Place a permanent glowing lantern block in the voxel world at the altar core
    this.world.setBlock(altar.x, altar.y + 1, altar.z, BLOCK.GLOWSTONE);

    // Upgrade altar visual to blazing golden-violet sky beam
    altar.crystalMesh.material.color.setHex(0xfff099);
    altar.beamMesh.material.color.setHex(0xffcc55);
    altar.beamMesh.material.opacity = 0.78;
    altar.beamMesh.scale.set(2.4, 1, 2.4);

    if (this.atmosphereFX) {
      this.atmosphereFX.spawnTakeoffBurst(altar.position);
      this.atmosphereFX.spawnBlockDebris(altar.x, altar.y + 2, altar.z, '#ffcf56', 32);
    }

    const scaleNotes = [523.25, 587.33, 659.25, 783.99, 1046.5];
    this.playChordNote(scaleNotes[(this.altarsLit - 1) % scaleNotes.length]);

    const rewardMsgs = [
      '🔥 点亮第 1 座祭坛！解锁「强力推进气旋」(+250 星辉)',
      '🔥 点亮第 2 座祭坛！飞索抓钩 (Q) 牵引速度提升！(+250 星辉)',
      '🔥 点亮第 3 座祭坛！海湾上空降下璀璨落日流星雨！(+250 星辉)',
      '🔥 点亮第 4 座祭坛！滑翔升力与掠海波光大幅强化！(+250 星辉)',
      '👑 五大落日祭坛全部觉醒！永恒黄金时刻达成！(+500 星辉)'
    ];
    if (this.altarsLit === 5) this.score += 250;
    this.player.setMode(this.player.mode, `${altar.name} · ${rewardMsgs[this.altarsLit - 1]}`);
    this.notifyHud();
  }

  notifyHud() {
    if (this.onHudUpdate) {
      this.onHudUpdate({
        score: Math.floor(this.score),
        ringsCollected: this.ringsCollected,
        totalRings: this.totalRings,
        combo: this.combo,
        altarsLit: this.altarsLit,
        totalAltars: this.totalAltars,
        isWaveSkimming: this.isWaveSkimming,
        skyWalkEnabled: this.skyWalkEnabled
      });
    }
  }

  update(dt, time) {
    const pPos = this.player.position;

    // 1. Update combo timer
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.notifyHud();
      }
    }

    // 2. Update Grappling Hook visual tether line
    if (this.grappleActive) {
      this.grappleTimer -= dt;
      if (this.grappleTimer <= 0 || pPos.distanceTo(this.grappleTarget) < 2.5) {
        this.grappleActive = false;
        this.grappleLine.visible = false;
      } else {
        this.grappleLine.visible = true;
        const handStart = new THREE.Vector3(0.35, -0.25, -0.5).applyMatrix4(this.camera.matrixWorld);
        const posAttr = this.grappleLine.geometry.attributes.position;
        posAttr.setXYZ(0, handStart.x, handStart.y, handStart.z);
        posAttr.setXYZ(1, this.grappleTarget.x, this.grappleTarget.y, this.grappleTarget.z);
        posAttr.needsUpdate = true;
      }
    }

    // 3. Sky-Walk Auto-Bridge (V key): automatically place selected hotbar block beneath feet!
    if (this.skyWalkEnabled && this.player.mode === 'WALKING') {
      const bx = Math.floor(pPos.x);
      const by = Math.floor(pPos.y - 0.15);
      const bz = Math.floor(pPos.z);
      if (by >= SEA_LEVEL && this.world.getBlock(bx, by, bz) === BLOCK.AIR) {
        const placeId = this.player.selectedBlockId || BLOCK.OAK_PLANKS;
        this.world.setBlock(bx, by, bz, placeId);
      }
    }

    // 4. Update & Check Aerial Sky-Rings (落日风之星环)
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    for (const ring of this.rings) {
      ring.innerMesh.rotation.z = time * 1.8 + ring.index;
      const pulse = 1.0 + Math.sin(time * 3.5 + ring.index) * 0.06;
      ring.group.scale.setScalar(pulse);

      if (ring.collected) {
        ring.respawnTimer -= dt;
        if (ring.respawnTimer <= 0) {
          ring.collected = false;
          ring.group.visible = true;
        }
        continue;
      }

      const dist = pPos.distanceTo(ring.position);
      if (dist < 4.3) {
        ring.collected = true;
        ring.group.visible = false;
        ring.respawnTimer = 18.0; // Respawn after 18s so course can be re-flown infinitely

        this.ringsCollected = Math.min(this.totalRings, this.ringsCollected + 1);
        this.combo++;
        this.comboTimer = 9.0;
        const pts = 100 * this.combo;
        this.score += pts;

        // Give exhilarating speed & lift boost!
        this.player.glideSpeed = Math.min(21.0, this.player.glideSpeed + 4.8);
        this.player.velocity.y = Math.max(this.player.velocity.y + 4.2, 3.8);

        if (this.atmosphereFX) {
          this.atmosphereFX.spawnTakeoffBurst(ring.position);
        }
        const note = pentatonic[(this.combo - 1) % pentatonic.length];
        this.playChordNote(note);

        this.player.setMode(
          this.player.mode,
          `✨ 穿过落日星环！连击 x${this.combo} (+${pts} 星辉 · 速度激增)`
        );
        this.notifyHud();
      }
    }

    // 5. Update & Check Ancient Sunset Altars (五大远古落日祭坛)
    for (const altar of this.altars) {
      altar.crystalMesh.rotation.y = time * 1.5;
      altar.crystalMesh.rotation.x = Math.sin(time * 1.2) * 0.35;
      altar.cageMesh.rotation.y = -time * 0.9;
      altar.crystalMesh.position.y = Math.sin(time * 2.4 + altar.index) * 0.25;

      if (!altar.lit && pPos.distanceTo(altar.position) < 4.5) {
        this.igniteAltar(altar);
      }
    }

    // 6. Update Thermal Updraft Geysers (上升热气流柱)
    if (this.updraftMaterial) {
      this.updraftMaterial.uniforms.uTime.value = time;
    }
    for (const u of this.updrafts) {
      const horizDist = Math.hypot(pPos.x - u.x, pPos.z - u.z);
      if (horizDist < u.radius && pPos.y >= u.baseY - 1 && pPos.y <= u.baseY + 40) {
        this.player.velocity.y = Math.min(15.5, this.player.velocity.y + 28.0 * dt);
        if (this.player.mode === 'WALKING') {
          this.player.takeOff();
          this.player.setMode('GLIDING', '🌪️ 乘上山海上升热气流 · 扶摇直上！');
        }
      }
    }

    // 7. Check Sky Launch Pads built via Blueprint (B key)
    for (const pad of this.jumpPads) {
      if (pPos.distanceTo(pad) < 1.8) {
        this.player.takeOff();
        this.player.velocity.y = 22.0;
        this.player.setMode('GLIDING', '🚀 弹射跳台超级升空！');
      }
    }

    // 8. Check Ocean Wave-Skimming along the Sun Road (🌊 掠海破浪)
    const heightAboveSea = pPos.y - (SEA_LEVEL + 0.32);
    const wasSkimming = this.isWaveSkimming;
    this.isWaveSkimming = (
      this.player.mode === 'GLIDING' &&
      heightAboveSea > 0.15 &&
      heightAboveSea < 3.2 &&
      pPos.z < 12
    );

    if (this.isWaveSkimming) {
      // Sustain altitude and speed while skimming the waves!
      this.player.velocity.y = Math.max(this.player.velocity.y, -0.25);
      this.player.glideSpeed = Math.max(this.player.glideSpeed, 14.8);
      this.score += dt * 15;
      if (!wasSkimming) {
        this.player.setMode('GLIDING', '🌊 掠海破浪加成中！贴海飞行保持升力 (+15 星辉/秒)');
        this.notifyHud();
      }
    } else if (wasSkimming) {
      this.notifyHud();
    }

    // 9. Animate Leaping Sunset Dolphins & Shooting Stars
    for (const d of this.dolphins) {
      const cycle = (time * d.speed + d.phase) % (Math.PI * 2);
      const yArc = Math.sin(cycle) * 3.6;
      d.group.position.set(
        d.centerX + Math.sin(time * 0.3 + d.phase) * 3.0,
        SEA_LEVEL - 0.8 + yArc,
        d.centerZ - Math.cos(cycle) * 4.5
      );
      d.group.rotation.x = -Math.cos(cycle) * 0.75;
      d.group.visible = d.group.position.y > SEA_LEVEL - 0.6;
    }

    for (const s of this.shootingStars) {
      s.timer += dt;
      if (s.timer > 6.5) {
        s.timer = 0;
        s.pos.set(
          (Math.random() - 0.5) * 520,
          170 + Math.random() * 140,
          -360 - Math.random() * 220
        );
      }
      if (s.timer < 1.8) {
        s.line.visible = true;
        s.line.position.copy(s.pos).addScaledVector(s.vel, s.timer);
        s.line.material.opacity = Math.sin((s.timer / 1.8) * Math.PI);
      } else {
        s.line.visible = false;
      }
    }
  }
}
