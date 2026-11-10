import * as THREE from 'three';

// ============================================================================
// GTA VI: Vice City (Leonida) — Open World Map, Art Deco District,
// Vice Beach, Downtown Skyscrapers, Marina, Stunt Ramps & Collision System
// ============================================================================

export class ViceCityMap {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // { minX, maxX, minZ, maxZ, height, type, label }
    this.buildingsForRadar = []; // { x, z, w, d, color, name }
    this.roadsForRadar = []; // { x, z, w, d }
    this.stuntRamps = []; // { x, z, w, d, dirX, dirZ, height, length, name }
    this.explosiveProps = []; // { mesh, x, y, z, radius, exploded }
    this.neonAnimatedMeshes = [];
    this.ferrisWheelWheel = null;

    // Key Interactive Landmarks
    this.landmarks = {
      payNSpray: { x: -20, z: -42, radius: 7.5, name: "Vice Pay 'n' Spray 喷漆改装店" },
      convenienceStore: { x: 48, z: 24, radius: 5.5, name: '24/7 Leonida 超市 (按 E 抢劫收银机)' },
      helipadElevator: { x: -68, z: -12, radius: 4.0, topX: -85, topY: 48.2, topZ: 0, name: 'Vice Tower 摩天楼顶停机坪电梯 (按 E 登顶)' },
      helipadTop: { x: -85, y: 48.2, z: 0, name: 'Vice Tower Helipad' },
      marinaDock: { x: 126, z: 118, name: 'Vice Marina 游艇码头' },
      oceanDriveDiner: { x: 52, z: -35, name: 'Ocean Drive 霓虹餐厅' }
    };

    this._buildTextures();
    this._buildGroundAndBeach();
    this._buildRoadNetwork();
    this._buildOceanDriveHotels();
    this._buildDowntownSkyscrapers();
    this._buildInteractiveLandmarks();
    this._buildViceBeachAndPier();
    this._buildStuntRamps();
    this._buildPalmTreesAndStreetLights();
  }

  _buildTextures() {
    // 1. Asphalt Road Texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const rctx = roadCanvas.getContext('2d');
    rctx.fillStyle = '#1d1e26';
    rctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      rctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
      rctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // Double yellow center line
    rctx.fillStyle = '#f5b932';
    rctx.fillRect(249, 0, 4, 512);
    rctx.fillRect(259, 0, 4, 512);
    // Dashed white lane dividers
    rctx.fillStyle = 'rgba(240, 245, 255, 0.78)';
    for (let y = 0; y < 512; y += 64) {
      rctx.fillRect(126, y + 10, 4, 34);
      rctx.fillRect(382, y + 10, 4, 34);
    }
    // Sidewalk curbs
    rctx.fillStyle = '#ff47b6';
    rctx.fillRect(0, 0, 8, 512);
    rctx.fillStyle = '#00f0ff';
    rctx.fillRect(504, 0, 8, 512);

    this.roadTex = new THREE.CanvasTexture(roadCanvas);
    this.roadTex.wrapS = THREE.RepeatWrapping;
    this.roadTex.wrapT = THREE.RepeatWrapping;

    // 2. Skyscraper Lit Window Grid Texture
    const winCanvas = document.createElement('canvas');
    winCanvas.width = 256;
    winCanvas.height = 512;
    const wctx = winCanvas.getContext('2d');
    wctx.fillStyle = '#121629';
    wctx.fillRect(0, 0, 256, 512);
    const palette = ['#ffe39f', '#ffd27d', '#ff6ec7', '#63f5ff', '#222944', '#191f38'];
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 8; col++) {
        const lit = Math.random() > 0.36;
        wctx.fillStyle = lit ? palette[Math.floor(Math.random() * palette.length)] : '#171c30';
        wctx.fillRect(col * 32 + 4, row * 16 + 3, 24, 10);
      }
    }
    this.skyscraperTex = new THREE.CanvasTexture(winCanvas);
    this.skyscraperTex.wrapS = THREE.RepeatWrapping;
    this.skyscraperTex.wrapT = THREE.RepeatWrapping;
  }

  _createNeonSignTexture(title, subtitle, bgHex, borderHex, textHex) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 160);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);

    ctx.shadowColor = textHex;
    ctx.shadowBlur = 18;
    ctx.fillStyle = textHex;
    ctx.font = '900 52px "Segoe UI", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 82);

    ctx.shadowBlur = 8;
    ctx.fillStyle = borderHex;
    ctx.font = '700 24px "Segoe UI", sans-serif';
    ctx.fillText(subtitle, 256, 126);

    return new THREE.CanvasTexture(c);
  }

  _buildGroundAndBeach() {
    // Main urban mainland ground (-360..95)
    const cityGroundGeo = new THREE.PlaneGeometry(460, 720);
    cityGroundGeo.rotateX(-Math.PI / 2);
    const cityGroundMat = new THREE.MeshStandardMaterial({
      color: 0x262936,
      roughness: 0.78,
      metalness: 0.1
    });
    const cityGround = new THREE.Mesh(cityGroundGeo, cityGroundMat);
    cityGround.position.set(-132, 0.0, 0);
    cityGround.receiveShadow = true;
    this.scene.add(cityGround);

    // Lush Grass / Park Median strip along Ocean Drive (x = 84..94)
    const parkGeo = new THREE.PlaneGeometry(12, 560);
    parkGeo.rotateX(-Math.PI / 2);
    const parkMat = new THREE.MeshStandardMaterial({
      color: 0x2d6e4e,
      roughness: 0.88
    });
    const parkStrip = new THREE.Mesh(parkGeo, parkMat);
    parkStrip.position.set(89, 0.03, 0);
    parkStrip.receiveShadow = true;
    this.scene.add(parkStrip);

    // Ocean Drive Pastel Boardwalk (x = 94..100)
    const walkGeo = new THREE.PlaneGeometry(6.5, 560);
    walkGeo.rotateX(-Math.PI / 2);
    const walkMat = new THREE.MeshStandardMaterial({
      color: 0xe3cdb3,
      roughness: 0.65
    });
    const boardwalk = new THREE.Mesh(walkGeo, walkMat);
    boardwalk.position.set(97, 0.05, 0);
    boardwalk.receiveShadow = true;
    this.scene.add(boardwalk);

    // Vice Beach Golden Sand (x = 100..136, gently sloping into the Atlantic Ocean)
    const beachGeo = new THREE.PlaneGeometry(42, 640, 16, 64);
    beachGeo.rotateX(-Math.PI / 2);
    const pos = beachGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i); // -21..+21
      const t = (lx + 21) / 42; // 0 at boardwalk, 1 at ocean
      pos.setY(i, 0.04 - t * t * 1.15);
    }
    beachGeo.computeVertexNormals();
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xf4dcab,
      roughness: 0.85,
      metalness: 0.02
    });
    const beachMesh = new THREE.Mesh(beachGeo, beachMat);
    beachMesh.position.set(118, 0, 0);
    beachMesh.receiveShadow = true;
    this.scene.add(beachMesh);
  }

  _buildRoadNetwork() {
    // North-South Avenues:
    // x = 74 (Ocean Drive!), x = 14 (Vice Blvd), x = -56 (Downtown Ave), x = -130 (Leonida Pkwy)
    this.nsRoads = [74, 14, -56, -130];
    // East-West Streets:
    // z = -160, -80, 0, 80, 160
    this.ewRoads = [-160, -80, 0, 80, 160];

    const roadWidth = 16;

    // Build N-S Avenues
    this.nsRoads.forEach((rx) => {
      const len = 460;
      const tex = this.roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, len / 22);
      const geo = new THREE.PlaneGeometry(roadWidth, len);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.36, // Wet neon specular sheen!
        metalness: 0.25
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(rx, 0.04, 0);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.roadsForRadar.push({ x: rx, z: 0, w: roadWidth, d: len });
    });

    // Build E-W Cross Streets (from -165 to +78)
    this.ewRoads.forEach((rz) => {
      const len = 246;
      const centerX = -43;
      const tex = this.roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, len / 22);
      const geo = new THREE.PlaneGeometry(roadWidth, len);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.36,
        metalness: 0.25
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(centerX, 0.045, rz);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.roadsForRadar.push({ x: centerX, z: rz, w: len, d: roadWidth });
    });
  }

  _addBuildingCollider(x, z, w, d, h, color, name = '') {
    this.colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      height: h,
      type: 'building',
      label: name
    });
    this.buildingsForRadar.push({ x, z, w, d, color, name });
  }

  _buildOceanDriveHotels() {
    // Iconic Ocean Drive Art Deco Hotels along x = 50 (facing East toward Ocean Drive x = 74 & Vice Beach!)
    const hotels = [
      {
        z: -135, w: 22, d: 30, h: 17,
        name: 'THE COLONY HOTEL', sub: 'OCEAN DRIVE · 1935',
        wallColor: '#e8f4f8', trimColor: '#00f0ff', neonHex: '#00f0ff'
      },
      {
        z: -98, w: 22, d: 28, h: 19,
        name: 'VICE PALMS', sub: 'RESORT & COCKTAILS',
        wallColor: '#ffe6f2', trimColor: '#ff3ca6', neonHex: '#ff47b6'
      },
      {
        z: -52, w: 20, d: 26, h: 15,
        name: 'FLAMINGO LOUNGE', sub: 'DINER & NEON BAR',
        wallColor: '#fff5e4', trimColor: '#ff8a3d', neonHex: '#ff9d3b'
      },
      {
        z: -18, w: 22, d: 28, h: 21,
        name: 'LEONIDA CLUB', sub: 'VIP ROOFTOP POOL',
        wallColor: '#e5fff5', trimColor: '#19ffaa', neonHex: '#00ffaa'
      },
      {
        z: 52, w: 22, d: 26, h: 18,
        name: 'OCEAN VIEW HOTEL', sub: 'VICE BEACH SOUTH',
        wallColor: '#f5e8ff', trimColor: '#b55cff', neonHex: '#d580ff'
      },
      {
        z: 108, w: 24, d: 32, h: 20,
        name: 'STARLIGHT MOTEL', sub: 'VACANCY · 24 HRS',
        wallColor: '#fff0f5', trimColor: '#ff477e', neonHex: '#ff47b6'
      },
      {
        z: 142, w: 22, d: 24, h: 16,
        name: 'JACK OF HEARTS', sub: 'NIGHTCLUB & CABARET',
        wallColor: '#1f1638', trimColor: '#ff2a85', neonHex: '#ff2a85'
      }
    ];

    const hotelX = 50;
    hotels.forEach((cfg) => {
      const group = new THREE.Group();
      group.position.set(hotelX, 0, cfg.z);

      // Main Art Deco body
      const bodyGeo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: cfg.wallColor,
        roughness: 0.55,
        metalness: 0.08
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = cfg.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Stepped Art Deco central spire crown
      const crownGeo = new THREE.BoxGeometry(cfg.w * 0.65, 4.2, cfg.d * 0.55);
      const crownMat = new THREE.MeshStandardMaterial({
        color: cfg.trimColor,
        emissive: cfg.neonHex,
        emissiveIntensity: 0.45,
        roughness: 0.3
      });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(1.8, cfg.h + 2.1, 0);
      group.add(crown);

      // Horizontal Art Deco neon eyebrow ledges facing Ocean Drive (+X)
      const floors = Math.floor(cfg.h / 4.2);
      const neonMat = new THREE.MeshBasicMaterial({ color: cfg.neonHex });
      for (let f = 1; f <= floors; f++) {
        const ledgeGeo = new THREE.BoxGeometry(1.1, 0.32, cfg.d * 0.92);
        const ledge = new THREE.Mesh(ledgeGeo, neonMat);
        ledge.position.set(cfg.w / 2 + 0.35, f * 3.8, 0);
        group.add(ledge);
      }

      // Vertical Neon Tube pillars on the front corners
      const pillarGeo = new THREE.BoxGeometry(0.45, cfg.h + 3.0, 0.45);
      [-cfg.d * 0.42, 0, cfg.d * 0.42].forEach((pz) => {
        const pil = new THREE.Mesh(pillarGeo, neonMat);
        pil.position.set(cfg.w / 2 + 0.25, (cfg.h + 3.0) / 2, pz);
        group.add(pil);
      });

      // Glowing Billboard Sign facing Ocean Drive (+X)
      const signTex = this._createNeonSignTexture(
        cfg.name,
        cfg.sub,
        '#120924',
        cfg.trimColor,
        cfg.neonHex
      );
      const signGeo = new THREE.PlaneGeometry(cfg.d * 0.78, 3.6);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.rotation.y = Math.PI / 2;
      signMesh.position.set(cfg.w / 2 + 0.62, cfg.h - 2.2, 0);
      group.add(signMesh);

      // Sidewalk Café Umbrellas & tables in front of each hotel (x = hotelX + cfg.w/2 + 2.5)
      for (let uz = -cfg.d * 0.32; uz <= cfg.d * 0.32; uz += 7.5) {
        const umbPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6),
          new THREE.MeshStandardMaterial({ color: 0xdddddd })
        );
        umbPole.position.set(cfg.w / 2 + 2.8, 1.25, uz);
        group.add(umbPole);

        const umbTop = new THREE.Mesh(
          new THREE.ConeGeometry(1.85, 0.75, 8),
          new THREE.MeshStandardMaterial({
            color: cfg.trimColor,
            emissive: cfg.neonHex,
            emissiveIntensity: 0.2
          })
        );
        umbTop.position.set(cfg.w / 2 + 2.8, 2.55, uz);
        group.add(umbTop);
      }

      this.scene.add(group);
      this._addBuildingCollider(hotelX, cfg.z, cfg.w, cfg.d, cfg.h, cfg.trimColor, cfg.name);
    });
  }

  _buildDowntownSkyscrapers() {
    // High-rise blocks between x = -22, x = -90, x = -165
    const towers = [
      // Vice Tower (with Rooftop Helipad at x = -85, z = 0, h = 48!)
      { x: -85, z: 0, w: 28, d: 28, h: 48, neon: '#00f0ff', name: 'VICE TOWER (HELIPAD)' },
      // VCPD Police Headquarters
      { x: -85, z: -115, w: 30, d: 26, h: 28, neon: '#3b82ff', name: 'VCPD HEADQUARTERS' },
      // Other Downtown & Crosstown Skyscrapers
      { x: -20, z: -120, w: 24, d: 28, h: 42, neon: '#ff47b6', name: 'SCHLONGBERG SACHS TOWER' },
      { x: -20, z: 120, w: 26, d: 26, h: 38, neon: '#ffb82e', name: 'MAZE BANK LEONIDA' },
      { x: -85, z: 42, w: 24, d: 24, h: 56, neon: '#b55cff', name: 'LEONIDA SKY CENTER' },
      { x: -85, z: 120, w: 28, d: 28, h: 44, neon: '#00ffaa', name: 'STARFISH PLAZA' },
      { x: -165, z: -115, w: 30, d: 30, h: 52, neon: '#ff3ca6', name: 'VICE NEWS MEDIA TOWER' },
      { x: -165, z: -38, w: 28, d: 28, h: 64, neon: '#00f0ff', name: 'OMNI LEONIDASPIRE' },
      { x: -165, z: 38, w: 28, d: 28, h: 46, neon: '#ff9d3b', name: 'DEL PERRO EAST' },
      { x: -165, z: 118, w: 30, d: 28, h: 36, neon: '#d580ff', name: 'VICE PORT LOGISTICS' }
    ];

    towers.forEach((t) => {
      const group = new THREE.Group();
      group.position.set(t.x, 0, t.z);

      const tex = this.skyscraperTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(2, Math.max(2, Math.floor(t.h / 10)));

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.72,
        roughness: 0.25,
        metalness: 0.65
      });

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), mat);
      mesh.position.y = t.h / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Neon roof perimeter frame
      const roofFrame = new THREE.Mesh(
        new THREE.BoxGeometry(t.w + 0.6, 0.9, t.d + 0.6),
        new THREE.MeshBasicMaterial({ color: t.neon })
      );
      roofFrame.position.y = t.h;
      group.add(roofFrame);

      // Special Rooftop Helipad on Vice Tower (x = -85, z = 0)
      if (t.name.includes('HELIPAD')) {
        const padGeo = new THREE.CylinderGeometry(9.5, 9.5, 0.4, 24);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x252a38, roughness: 0.6 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = t.h + 0.2;
        group.add(pad);

        // Glowing 'H' ring
        const ringGeo = new THREE.RingGeometry(6.8, 7.6, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = t.h + 0.42;
        group.add(ring);

        // Ground elevator glow pad at (-68, 0, -12)
        const elevPad = new THREE.Mesh(
          new THREE.CylinderGeometry(2.6, 2.6, 0.25, 20),
          new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.78 })
        );
        elevPad.position.set(17, 0.14, -12);
        group.add(elevPad);
      }

      // Rooftop billboard on select towers
      const signTex = this._createNeonSignTexture(
        t.name.split(' ')[0] + ' ' + (t.name.split(' ')[1] || ''),
        'LEONIDA · VICE CITY',
        '#0c0820',
        t.neon,
        '#ffffff'
      );
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(t.w * 0.82, 4.2),
        new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
      );
      sign.position.set(0, t.h + 2.6, t.d / 2 - 0.5);
      group.add(sign);

      this.scene.add(group);
      this._addBuildingCollider(t.x, t.z, t.w, t.d, t.h, t.neon, t.name);
    });
  }

  _buildInteractiveLandmarks() {
    // 1. Vice Pay 'n' Spray Auto Garage at (x = -20, z = -42)
    const pnsGroup = new THREE.Group();
    pnsGroup.position.set(-20, 0, -42);

    const garageWallMat = new THREE.MeshStandardMaterial({ color: 0x2b1d42, roughness: 0.5 });
    // Left, Right & Roof so cars can drive straight onto the glowing respray pad!
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 1.5), garageWallMat);
    leftWall.position.set(0, 3.5, -6.5);
    pnsGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 1.5), garageWallMat);
    rightWall.position.set(0, 3.5, 6.5);
    pnsGroup.add(rightWall);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 14.5), garageWallMat);
    roof.position.set(0, 7.2, 0);
    pnsGroup.add(roof);

    const signTex = this._createNeonSignTexture(
      "PAY 'N' SPRAY",
      'INSTANT RESPRAY · CLEAR WANTED ★',
      '#1a0933',
      '#00ffaa',
      '#ff47b6'
    );
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 3.4),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    sign.rotation.y = Math.PI / 2;
    sign.position.set(8.1, 9.2, 0);
    pnsGroup.add(sign);

    // Glowing floor bay marker
    const bayMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.45 });
    const bayPad = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), bayMat);
    bayPad.rotateX(-Math.PI / 2);
    bayPad.position.set(0, 0.08, 0);
    pnsGroup.add(bayPad);

    this.scene.add(pnsGroup);
    this.buildingsForRadar.push({ x: -20, z: -42, w: 16, d: 14, color: '#00ffaa', name: "Pay 'n' Spray" });

    // 2. LTD Gasoline Station at (x = -20, z = 48) with Explosive Fuel Pumps!
    const gasGroup = new THREE.Group();
    gasGroup.position.set(-20, 0, 48);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.0, 20),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f8, emissive: 0xff3b56, emissiveIntensity: 0.35 })
    );
    canopy.position.set(0, 6.8, 0);
    gasGroup.add(canopy);

    const gasSignTex = this._createNeonSignTexture('LTD GASOLINE', '24HR FUEL · EXPLOSIVE', '#1a0c1e', '#ff3b56', '#ffd24c');
    const gasSign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.0),
      new THREE.MeshBasicMaterial({ map: gasSignTex, side: THREE.DoubleSide })
    );
    gasSign.rotation.y = Math.PI / 2;
    gasSign.position.set(8.1, 8.6, 0);
    gasGroup.add(gasSign);

    // 4 Shootable / Ram-Explosive Red Fuel Pumps
    [-5.5, 5.5].forEach((pz) => {
      [-2.5, 2.5].forEach((px) => {
        const pump = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 2.3, 0.9),
          new THREE.MeshStandardMaterial({
            color: 0xff2942,
            emissive: 0xff2942,
            emissiveIntensity: 0.35
          })
        );
        pump.position.set(px - 20, 1.15, pz + 48);
        this.scene.add(pump);
        this.explosiveProps.push({
          mesh: pump,
          x: px - 20,
          y: 1.15,
          z: pz + 48,
          radius: 2.2,
          exploded: false
        });
      });
    });

    this.scene.add(gasGroup);
    this.buildingsForRadar.push({ x: -20, z: 48, w: 16, d: 20, color: '#ff3b56', name: 'LTD Gasoline' });

    // 3. 24/7 Leonida Convenience Store at (x = 48, z = 20)
    const storeGroup = new THREE.Group();
    storeGroup.position.set(48, 0, 20);
    const storeBody = new THREE.Mesh(
      new THREE.BoxGeometry(16, 7.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xfff3e2, roughness: 0.6 })
    );
    storeBody.position.y = 3.75;
    storeGroup.add(storeBody);

    const storeSignTex = this._createNeonSignTexture('24/7 LEONIDA MART', 'PRESS [E] TO ROB CASH REGISTER', '#0f291e', '#00ff88', '#ffeb3b');
    const storeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.0),
      new THREE.MeshBasicMaterial({ map: storeSignTex })
    );
    storeSign.rotation.y = Math.PI / 2;
    storeSign.position.set(8.1, 6.2, 0);
    storeGroup.add(storeSign);

    // Robbery interactive corona marker in front of the door (x = 58, z = 20)
    const robCorona = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.25, 20),
      new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.72 })
    );
    robCorona.position.set(10, 0.14, 4);
    storeGroup.add(robCorona);

    this.scene.add(storeGroup);
    this._addBuildingCollider(48, 20, 16, 16, 7.5, '#00ff88', '24/7 Leonida Mart');
  }

  _buildViceBeachAndPier() {
    // 1. Iconic Pastel Lifeguard Towers along Vice Beach (x = 112)
    const towerColors = ['#ff5e97', '#00e5ff', '#ffbe3b', '#8c52ff'];
    [-110, -45, 25, 85].forEach((tz, idx) => {
      const col = towerColors[idx % towerColors.length];
      const lg = new THREE.Group();
      lg.position.set(112, 0, tz);

      // Stilts
      const stiltGeo = new THREE.BoxGeometry(3.2, 2.4, 3.2);
      const stiltMat = new THREE.MeshStandardMaterial({ color: 0xe8d5b7 });
      const stilts = new THREE.Mesh(stiltGeo, stiltMat);
      stilts.position.y = 1.2;
      lg.add(stilts);

      // Cabin
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 2.6, 3.6),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })
      );
      cabin.position.y = 3.7;
      cabin.castShadow = true;
      lg.add(cabin);

      // Peaked roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.1, 1.3, 4),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 5.65;
      lg.add(roof);

      this.scene.add(lg);
      this._addBuildingCollider(112, tz, 3.6, 3.6, 5.5, col, 'Lifeguard Tower');
    });

    // 2. Starfish Boardwalk Pier & Neon Ferris Wheel at (x = 136, z = -35)
    const pierGroup = new THREE.Group();
    pierGroup.position.set(134, 0, -35);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(46, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x7c5836, roughness: 0.8 })
    );
    deck.position.set(0, 1.6, 0);
    pierGroup.add(deck);

    // Neon Ferris Wheel on the Pier!
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(10, 16.5, 0);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(12.5, 0.45, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0xff3ca6 })
    );
    wheelGroup.add(rim);

    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(8.2, 0.3, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    wheelGroup.add(innerRim);

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 25, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffe26a : 0xff47b6 })
      );
      spoke.rotation.z = ang;
      wheelGroup.add(spoke);
    }

    this.ferrisWheelWheel = wheelGroup;
    pierGroup.add(wheelGroup);

    // Support legs
    [-1.8, 1.8].forEach((lz) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 17, 8),
        new THREE.MeshStandardMaterial({ color: 0xdddddd })
      );
      leg.position.set(10, 8.8, lz);
      pierGroup.add(leg);
    });

    this.scene.add(pierGroup);
    this.buildingsForRadar.push({ x: 134, z: -35, w: 46, d: 16, color: '#ff3ca6', name: 'Starfish Pier' });

    // 3. Vice Marina Boat Dock at (x = 128, z = 118)
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x8b6742, roughness: 0.75 })
    );
    dock.position.set(128, 0.45, 118);
    this.scene.add(dock);
    this.buildingsForRadar.push({ x: 128, z: 118, w: 34, d: 10, color: '#c29b68', name: 'Vice Marina Dock' });
  }

  _buildStuntRamps() {
    // 2 Unique Stunt Jump Ramps on Ocean Drive & Vice Marina!
    const ramps = [
      {
        x: 82, z: -12, w: 6.5, length: 13, height: 3.6,
        dirX: 0, dirZ: -1, // Jump North along Ocean Drive!
        name: 'Ocean Drive Neon Jump'
      },
      {
        x: 98, z: 95, w: 7.0, length: 14, height: 4.2,
        dirX: 1, dirZ: 0, // Jump East toward Vice Marina & Ocean!
        name: 'Vice Marina Bay Launch'
      }
    ];

    ramps.forEach((r) => {
      this.stuntRamps.push(r);

      // Build wedge geometry
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(r.length, 0);
      shape.lineTo(r.length, r.height);
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: r.w,
        bevelEnabled: false
      });
      extrudeGeo.translate(-r.length / 2, 0, -r.w / 2);

      const mat = new THREE.MeshStandardMaterial({
        color: 0xff2a85,
        emissive: 0xff2a85,
        emissiveIntensity: 0.35,
        roughness: 0.4
      });
      const mesh = new THREE.Mesh(extrudeGeo, mat);
      mesh.position.set(r.x, 0.02, r.z);
      if (r.dirZ === -1) {
        mesh.rotation.y = Math.PI / 2;
      }
      this.scene.add(mesh);
    });
  }

  _buildPalmTreesAndStreetLights() {
    // Tropical Miami Coconut Palm Trees along Ocean Drive, Beach & Boulevards
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a563b, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x289c5a,
      roughness: 0.65,
      side: THREE.DoubleSide
    });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff47b6 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const createPalm = (x, z, scale = 1.0,wrapNeon = false) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);

      // Slightly curved segmented trunk
      const segs = 5;
      for (let s = 0; s < segs; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28 - s * 0.03, 0.32 - s * 0.03, 1.9, 7),
          trunkMat
        );
        seg.position.set(s * 0.14, s * 1.75 + 0.9, 0);
        seg.rotation.z = -s * 0.04;
        seg.castShadow = true;
        g.add(seg);
      }

      // Neon LED ring wrap around Ocean Drive palms!
      if (wrapNeon) {
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(0.33, 0.35, 3.2, 8),
          Math.abs(z) % 20 < 10 ? neonPinkMat : neonCyanMat
        );
        ring.position.set(0.15, 2.6, 0);
        g.add(ring);
      }

      // Crown fronds
      const topX = 0.62;
      const topY = 8.9;
      for (let f = 0; f < 7; f++) {
        const ang = (f / 7) * Math.PI * 2;
        const frond = new THREE.Mesh(
          new THREE.ConeGeometry(0.85, 3.9, 4),
          leafMat
        );
        frond.position.set(topX + Math.cos(ang) * 1.4, topY - 0.2, Math.sin(ang) * 1.4);
        frond.rotation.z = -Math.PI / 2.6;
        frond.rotation.y = -ang;
        frond.castShadow = true;
        g.add(frond);
      }

      g.scale.setScalar(scale);
      this.scene.add(g);
    };

    // Line Ocean Drive (x = 64 and x = 84) with glowing neon-wrapped palms!
    for (let z = -180; z <= 180; z += 16) {
      createPalm(64.5, z, 1.05, true);
      createPalm(84.5, z + 8, 1.1, true);
      // Beach palms
      if (z % 32 === 0) {
        createPalm(103 + (Math.random() - 0.5) * 5, z + 4, 0.95 + Math.random() * 0.25, false);
      }
    }

    // Line Vice Blvd (x = 4 and x = 24)
    for (let z = -160; z <= 160; z += 24) {
      createPalm(4.2, z, 0.95, false);
      createPalm(23.8, z + 12, 0.95, false);
    }
  }

  getGroundHeight(x, z) {
    // Check Stunt Ramps first so cars launch smoothly into the air!
    for (const r of this.stuntRamps) {
      const dx = x - r.x;
      const dz = z - r.z;
      if (r.dirZ === -1) {
        // Ramp runs from z = r.z + r.length/2 down to r.z - r.length/2
        if (Math.abs(dx) <= r.w / 2 && Math.abs(dz) <= r.length / 2) {
          const t = (r.length / 2 - dz) / r.length; // 0 at south entry, 1 at north lip
          return Math.max(0, t * r.height);
        }
      } else if (r.dirX === 1) {
        if (Math.abs(dz) <= r.w / 2 && Math.abs(dx) <= r.length / 2) {
          const t = (dx + r.length / 2) / r.length; // 0 at west entry, 1 at east lip
          return Math.max(0, t * r.height);
        }
      }
    }

    // Starfish Pier deck height
    if (x >= 111 && x <= 157 && z >= -43 && z <= -27) {
      return 2.2;
    }

    // Vice Marina dock height
    if (x >= 111 && x <= 145 && z >= 113 && z <= 123) {
      return 0.9;
    }

    // Vice Beach gentle slope into the Atlantic Ocean
    if (x > 97) {
      const t = Math.min(1.5, Math.max(0, (x - 97) / 42));
      return 0.04 - t * t * 1.15;
    }

    return 0.04;
  }

  resolveHorizontalCollision(x, z, y, radius = 0.8) {
    let outX = x;
    let outZ = z;
    let hit = false;
    let hitBuilding = null;

    for (const c of this.colliders) {
      // Allow flying or rooftop standing above building height!
      if (y >= c.height - 0.3) continue;

      const closestX = Math.max(c.minX, Math.min(outX, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(outZ, c.maxZ));
      const dx = outX - closestX;
      const dz = outZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        hit = true;
        hitBuilding = c;
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          outX += (dx / dist) * push;
          outZ += (dz / dist) * push;
        } else {
          // Inside box center fallback
          outX = c.maxX + radius;
        }
      }
    }

    return { x: outX, z: outZ, hit, hitBuilding };
  }

  getRoofHeightAt(x, z) {
    for (const c of this.colliders) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        return c.height;
      }
    }
    return 0;
  }

  getDistrictName(x, z) {
    if (x > 122) return 'ATLANTIC OCEAN · 雷奥奈达海域';
    if (x > 92) return 'VICE BEACH · 罪恶海滩';
    if (x > 38) return 'OCEAN DRIVE · 海洋大道装饰艺术区';
    if (x > -35) return 'VICE BOULEVARD · 罪恶大道商业区';
    if (z < -60) return 'VCPD CIVIC CENTER · 警局与市政中心';
    return 'DOWNTOWN VICE CITY · 罪恶都市金融中心';
  }

  update(dt) {
    if (this.ferrisWheelWheel) {
      this.ferrisWheelWheel.rotation.z += dt * 0.32;
    }
  }
}
