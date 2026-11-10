import * as THREE from 'three';
import { BuildingCollider, StuntRamp, WorldPOI } from '../types';

export interface ExplosiveBarrel {
  mesh: THREE.Group;
  position: THREE.Vector3;
  exploded: boolean;
  respawnTimer: number;
}

export class CityBuilder {
  public colliders: BuildingCollider[] = [];
  public stuntRamps: StuntRamp[] = [];
  public pois: WorldPOI[] = [];
  public explosiveProps: ExplosiveBarrel[] = [];

  public readonly roadsX = [-320, -180, -40, 100, 220];
  public readonly roadsZ = [-320, -160, 0, 160, 320];
  public readonly roadWidth = 22;

  public roadMaterial!: THREE.MeshStandardMaterial;
  private palmCrowns: THREE.Object3D[] = [];
  private neonMaterials: THREE.MeshStandardMaterial[] = [];
  private ferrisWheelHub: THREE.Group | null = null;
  private skyBlimp: THREE.Group | null = null;
  private blimpAngle = 0;

  // Pre-rendered static map canvas for fast, crisp GTA Minimap radar
  public minimapBgCanvas: HTMLCanvasElement;
  public readonly mapBounds = { minX: -430, maxX: 550, minZ: -430, maxZ: 430 };

  constructor(scene: THREE.Scene, maxAnisotropy = 4) {
    this.minimapBgCanvas = document.createElement('canvas');
    this.minimapBgCanvas.width = 512;
    this.minimapBgCanvas.height = 512;

    this.buildGroundAndBeach(scene, maxAnisotropy);
    this.buildRoadNetwork(scene, maxAnisotropy);
    this.buildOceanDriveArtDeco(scene, maxAnisotropy);
    this.buildDowntownAndDistricts(scene, maxAnisotropy);
    this.buildSpecialLandmarks(scene);
    this.buildStarfishIslandAndMarina(scene);
    this.buildPalmTreesAndStreetlights(scene);
    this.buildStuntRamps(scene);
    this.buildSkylineSpectacles(scene);

    this.bakeMinimapBackground();
  }

  private createAsphaltTexture(isHorizontal: boolean, aniso: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#1f2128';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle asphalt grain
    for (let i = 0; i < 1600; i++) {
      const g = 26 + Math.floor(Math.random() * 18);
      ctx.fillStyle = `rgb(${g},${g},${g + 4})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }

    ctx.save();
    if (isHorizontal) {
      ctx.translate(128, 128);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-128, -128);
    }

    // Sidewalk curb lines
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(4, 0, 5, 256);
    ctx.fillRect(247, 0, 5, 256);

    // Double yellow center line
    ctx.fillStyle = '#eab308';
    ctx.fillRect(123, 0, 3, 256);
    ctx.fillRect(130, 0, 3, 256);

    // White dashed lane dividers
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    for (let y = 12; y < 256; y += 42) {
      ctx.fillRect(66, y, 3, 22);
      ctx.fillRect(187, y, 3, 22);
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = aniso;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createSkyscraperTextures(
    baseHex: string,
    windowWarmHex: string,
    windowCoolHex: string,
    aniso: number
  ): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d')!;

    const ec = document.createElement('canvas');
    ec.width = 256;
    ec.height = 512;
    const ectx = ec.getContext('2d')!;

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 512);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, 256, 512);

    const cols = 8;
    const rows = 20;
    const padX = 6;
    const padY = 6;
    const w = (256 - padX * (cols + 1)) / cols;
    const h = (512 - padY * (rows + 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = padX + col * (w + padX);
        const y = padY + r * (h + padY);
        const lit = Math.random() < 0.56;
        if (lit) {
          const winCol = Math.random() < 0.55 ? windowWarmHex : windowCoolHex;
          ctx.fillStyle = winCol;
          ctx.fillRect(x, y, w, h);
          ectx.fillStyle = winCol;
          ectx.fillRect(x, y, w, h);
        } else {
          ctx.fillStyle = '#131926';
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    const map = new THREE.CanvasTexture(c);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = aniso;
    map.colorSpace = THREE.SRGBColorSpace;

    const emissiveMap = new THREE.CanvasTexture(ec);
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.anisotropy = aniso;
    emissiveMap.colorSpace = THREE.SRGBColorSpace;

    return { map, emissiveMap };
  }

  private createNeonSignMesh(
    text: string,
    width: number,
    height: number,
    fgColor: string,
    bgColor = '#120822'
  ): THREE.Mesh {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 112);

    ctx.font = '900 54px "Bebas Neue", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fgColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 256, 67);
    ctx.fillStyle = fgColor;
    ctx.fillText(text, 256, 67);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(fgColor),
      emissiveMap: tex,
      emissiveIntensity: 2.1,
      roughness: 0.25
    });
    this.neonMaterials.push(mat);

    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  }

  private buildGroundAndBeach(scene: THREE.Scene, aniso: number): void {
    // Main City Concrete / Grass Island Base (X: -390..248, Z: -390..390)
    const cityBaseGeo = new THREE.BoxGeometry(640, 2.0, 790);
    const cityBaseMat = new THREE.MeshStandardMaterial({
      color: 0x30343f,
      roughness: 0.88
    });
    const cityBase = new THREE.Mesh(cityBaseGeo, cityBaseMat);
    cityBase.position.set(-72, -1.0, 0);
    cityBase.receiveShadow = true;
    scene.add(cityBase);

    // Lush Tropical Grass Park strips along Ocean Drive boardwalk
    const parkMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 });
    const oceanPark = new THREE.Mesh(new THREE.PlaneGeometry(14, 740), parkMat);
    oceanPark.rotation.x = -Math.PI / 2;
    oceanPark.position.set(238, 0.02, 0);
    oceanPark.receiveShadow = true;
    scene.add(oceanPark);

    // Ocean Drive Pastel Boardwalk
    const boardwalkMat = new THREE.MeshStandardMaterial({ color: 0xd8c3a5, roughness: 0.72 });
    const boardwalk = new THREE.Mesh(new THREE.PlaneGeometry(8, 750), boardwalkMat);
    boardwalk.rotation.x = -Math.PI / 2;
    boardwalk.position.set(248, 0.03, 0);
    boardwalk.receiveShadow = true;
    scene.add(boardwalk);

    // Golden Vice Beach Sand (sloping gently into Atlantic turquoise surf X: 251..335)
    const sandCanvas = document.createElement('canvas');
    sandCanvas.width = 128;
    sandCanvas.height = 128;
    const sctx = sandCanvas.getContext('2d')!;
    sctx.fillStyle = '#ead2a8';
    sctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 600; i++) {
      sctx.fillStyle = Math.random() > 0.5 ? '#dfbe8b' : '#f3e1c0';
      sctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const sandTex = new THREE.CanvasTexture(sandCanvas);
    sandTex.wrapS = THREE.RepeatWrapping;
    sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(12, 75);
    sandTex.anisotropy = aniso;
    sandTex.colorSpace = THREE.SRGBColorSpace;

    const beachGeo = new THREE.PlaneGeometry(92, 780, 8, 8);
    beachGeo.rotateX(-Math.PI / 2);
    // Gentle slope down into ocean on the East edge
    const posAttr = beachGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i); // -46 .. +46
      if (lx > 18) {
        const t = (lx - 18) / 28;
        posAttr.setY(i, -t * 1.25);
      }
    }
    beachGeo.computeVertexNormals();

    const beachMesh = new THREE.Mesh(
      beachGeo,
      new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9 })
    );
    beachMesh.position.set(294, 0.02, 0);
    beachMesh.receiveShadow = true;
    scene.add(beachMesh);

    // Iconic Miami Pastel Lifeguard Towers & Umbrellas along Vice Beach
    const hutColors = [0xff5d8f, 0x00bbf9, 0xfee440, 0x9b5de5, 0x00f5d4];
    for (let i = 0; i < 5; i++) {
      const hz = -260 + i * 130;
      if (Math.abs(hz) < 25) continue; // Keep pier jump clear
      this.buildLifeguardTower(scene, 276, hz, hutColors[i % hutColors.length]);
    }

    // Colorful beach umbrellas
    const umbColors = [0xff2e93, 0x00f0ff, 0xffbe0b, 0xff5400, 0x8338ec];
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const coneGeo = new THREE.ConeGeometry(1.65, 0.65, 8);

    for (let z = -310; z <= 310; z += 26) {
      if (Math.abs(z) < 24 || Math.abs(z - 160) < 20) continue;
      const ux = 286 + (Math.random() - 0.5) * 18;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.1;
      const top = new THREE.Mesh(
        coneGeo,
        new THREE.MeshStandardMaterial({
          color: umbColors[Math.abs(z) % umbColors.length],
          roughness: 0.5
        })
      );
      top.position.y = 2.25;
      top.castShadow = true;
      g.add(pole, top);
      g.position.set(ux, 0, z);
      scene.add(g);
    }
  }

  private buildLifeguardTower(scene: THREE.Scene, x: number, z: number, colorHex: number): void {
    const group = new THREE.Group();
    const woodWhite = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.7 });
    const pastelMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.55 });

    // 4 stilts
    const stiltGeo = new THREE.BoxGeometry(0.22, 2.2, 0.22);
    [
      [-1.3, -1.3],
      [1.3, -1.3],
      [-1.3, 1.3],
      [1.3, 1.3]
    ].forEach(([sx, sz]) => {
      const st = new THREE.Mesh(stiltGeo, woodWhite);
      st.position.set(sx, 1.1, sz);
      st.castShadow = true;
      group.add(st);
    });

    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.22, 3.8), woodWhite);
    deck.position.y = 2.2;
    deck.castShadow = true;
    group.add(deck);

    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.3, 2.8), pastelMat);
    cabin.position.y = 3.45;
    cabin.castShadow = true;
    group.add(cabin);

    // Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.0, 4), woodWhite);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.1;
    roof.castShadow = true;
    group.add(roof);

    group.position.set(x, 0, z);
    scene.add(group);
    this.colliders.push({ minX: x - 1.8, maxX: x + 1.8, minZ: z - 1.8, maxZ: z + 1.8, height: 5.5 });
  }

  private buildRoadNetwork(scene: THREE.Scene, aniso: number): void {
    const texNS = this.createAsphaltTexture(false, aniso);
    texNS.repeat.set(1, 34);

    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: texNS,
      roughness: 0.45,
      metalness: 0.14
    });

    // North-South Avenues
    for (const rx of this.roadsX) {
      const geo = new THREE.PlaneGeometry(this.roadWidth, 760);
      geo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(geo, this.roadMaterial);
      road.position.set(rx, 0.04, 0);
      road.receiveShadow = true;
      scene.add(road);
    }

    // East-West Streets
    const texEW = this.createAsphaltTexture(true, aniso);
    texEW.repeat.set(28, 1);
    const ewMat = new THREE.MeshStandardMaterial({
      map: texEW,
      roughness: 0.45,
      metalness: 0.14
    });

    for (const rz of this.roadsZ) {
      const geo = new THREE.PlaneGeometry(610, this.roadWidth);
      geo.rotateX(-Math.PI / 2);
      const road = new THREE.Mesh(geo, ewMat);
      road.position.set(-65, 0.045, rz);
      road.receiveShadow = true;
      scene.add(road);
    }

    // Intersection zebra pads so junctions look clean
    const interMat = new THREE.MeshStandardMaterial({ color: 0x22252d, roughness: 0.42, metalness: 0.14 });
    for (const rx of this.roadsX) {
      for (const rz of this.roadsZ) {
        const box = new THREE.Mesh(new THREE.PlaneGeometry(this.roadWidth + 0.4, this.roadWidth + 0.4), interMat);
        box.rotation.x = -Math.PI / 2;
        box.position.set(rx, 0.05, rz);
        box.receiveShadow = true;
        scene.add(box);
      }
    }
  }

  private buildOceanDriveArtDeco(scene: THREE.Scene, _aniso: number): void {
    // Iconic Art Deco Boutique Hotels facing East onto Ocean Drive (X = 188, facing X = 220)
    const decoHotels = [
      { z: 95, name: 'OCEAN VIEW', pastel: 0xffc8dd, neon: '#ff2e93', h: 21 },
      { z: 42, name: 'CLEVELANDER', pastel: 0xbde0fe, neon: '#00f0ff', h: 18 },
      { z: -42, name: 'VICE PALMS', pastel: 0xcaffbf, neon: '#38ef7d', h: 22 },
      { z: -95, name: 'THE COLONY', pastel: 0xffe5ec, neon: '#3a86ff', h: 20 },
      { z: -215, name: 'CLUB MALIBU', pastel: 0xe0aaff, neon: '#ff007f', h: 17 },
      { z: 215, name: 'FLAMINGO ART', pastel: 0xffd6a5, neon: '#ff9e00', h: 19 }
    ];

    for (const h of decoHotels) {
      const bx = 186;
      const bw = 34;
      const bd = 36;
      const group = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({ color: h.pastel, roughness: 0.62 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(bw, h.h, bd), bodyMat);
      body.position.y = h.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Stepped Art Deco crown tower
      const crown = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.55, 5.5, bd * 0.55), bodyMat);
      crown.position.set(4, h.h + 2.75, 0);
      crown.castShadow = true;
      group.add(crown);

      // Glowing Neon Horizontal Eyebrow Strips & Vertical Fin
      const neonMat = new THREE.MeshStandardMaterial({
        color: h.neon,
        emissive: new THREE.Color(h.neon),
        emissiveIntensity: 2.6,
        roughness: 0.2
      });
      this.neonMaterials.push(neonMat);

      for (let floorY = 5; floorY < h.h; floorY += 5) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, bd + 0.5), neonMat);
        strip.position.set(bw / 2 + 0.15, floorY, 0);
        group.add(strip);
      }

      const vertFin = new THREE.Mesh(new THREE.BoxGeometry(1.1, h.h + 6, 0.9), neonMat);
      vertFin.position.set(bw / 2 + 0.35, (h.h + 6) / 2, 0);
      group.add(vertFin);

      // Hotel Neon Sign facing Ocean Drive (East +X)
      const sign = this.createNeonSignMesh(h.name, 16, 4.0, h.neon);
      sign.rotation.y = Math.PI / 2;
      sign.position.set(bw / 2 + 0.45, h.h - 2.2, 0);
      group.add(sign);

      group.position.set(bx, 0, h.z);
      scene.add(group);

      this.colliders.push({
        minX: bx - bw / 2,
        maxX: bx + bw / 2,
        minZ: h.z - bd / 2,
        maxZ: h.z + bd / 2,
        height: h.h,
        label: h.name
      });
    }

    // Register Safehouse & Colony Repo POIs
    this.pois.push({
      id: 'safehouse',
      name: 'Ocean View Safehouse',
      cnName: '海景霓虹酒店安全屋',
      icon: 'safehouse',
      color: '#ff2e93',
      position: new THREE.Vector3(208, 0, 95)
    });
  }

  private buildDowntownAndDistricts(scene: THREE.Scene, aniso: number): void {
    const texWarm = this.createSkyscraperTextures('#232a3a', '#ffd180', '#70e1f5', aniso);
    const texCyan = this.createSkyscraperTextures('#182438', '#80ffdb', '#ff758f', aniso);
    const texLuxury = this.createSkyscraperTextures('#2e253d', '#ffe066', '#ff4d94', aniso);

    const towerMats = [texWarm, texCyan, texLuxury].map(
      (t) =>
        new THREE.MeshStandardMaterial({
          map: t.map,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: t.emissiveMap,
          emissiveIntensity: 0.92,
          roughness: 0.28,
          metalness: 0.48
        })
    );

    // Populate city blocks between roads while leaving reserved plots for special landmarks!
    const blockCentersX = [-250, -110, 30, 145];
    const blockCentersZ = [-240, -80, 80, 240];

    const reservedPlots = [
      { x: -78, z: 45 }, // LTD Gasoline
      { x: -78, z: -195 }, // Pay 'n' Spray
      { x: -148, z: -45 }, // Leonida National Bank
      { x: -148, z: 115 }, // Ammu-Nation
      { x: -78, z: 215 } // VCPD Precinct
    ];

    let idx = 0;
    for (const cx of blockCentersX) {
      for (const cz of blockCentersZ) {
        // Subdivide each city block into 2x2 parcels
        const subOffsets = [
          [-28, -32],
          [28, -32],
          [-28, 32],
          [28, 32]
        ];
        for (const [ox, oz] of subOffsets) {
          const px = cx + ox;
          const pz = cz + oz;

          // Skip Ocean Drive front parcels already occupied by Art Deco hotels
          if (px > 160) continue;

          // Skip reserved interactive landmark plots
          const isReserved = reservedPlots.some(
            (r) => Math.abs(r.x - px) < 38 && Math.abs(r.z - pz) < 38
          );
          if (isReserved) continue;

          idx++;
          const isDowntown = px < -60 && Math.abs(pz) < 190;
          const w = 32 + (idx % 3) * 5;
          const d = 32 + ((idx + 1) % 3) * 5;
          const h = isDowntown
            ? 48 + ((idx * 17) % 58) // Soaring Downtown Vice Skyscrapers up to 106m!
            : 18 + ((idx * 13) % 26);

          const mat = towerMats[idx % towerMats.length];
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          mesh.position.set(px, h / 2, pz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);

          // Add glowing rooftop neon crown trim on tall Downtown skyscrapers
          if (h > 55) {
            const trimColor = idx % 2 === 0 ? 0x00f0ff : 0xff2e93;
            const crownTrim = new THREE.Mesh(
              new THREE.BoxGeometry(w + 0.8, 0.9, d + 0.8),
              new THREE.MeshStandardMaterial({
                color: trimColor,
                emissive: trimColor,
                emissiveIntensity: 2.4
              })
            );
            crownTrim.position.set(px, h + 0.45, pz);
            scene.add(crownTrim);
          }

          this.colliders.push({
            minX: px - w / 2,
            maxX: px + w / 2,
            minZ: pz - d / 2,
            maxZ: pz + d / 2,
            height: h
          });
        }
      }
    }
  }

  private buildSpecialLandmarks(scene: THREE.Scene): void {
    // 1. LTD GASOLINE & CONVENIENCE STORE (X = -78, Z = +45) — Robbable + Explosive Gas Pumps!
    {
      const gx = -78;
      const gz = 45;
      const store = new THREE.Mesh(
        new THREE.BoxGeometry(22, 7.5, 18),
        new THREE.MeshStandardMaterial({ color: 0xf1faee, roughness: 0.6 })
      );
      store.position.set(gx - 10, 3.75, gz);
      store.castShadow = true;
      store.receiveShadow = true;
      scene.add(store);
      this.colliders.push({ minX: gx - 21, maxX: gx + 1, minZ: gz - 9, maxZ: gz + 9, height: 7.5, label: 'LTD Store' });

      // Forecourt Canopy facing Washington Ave (X = -40)
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(16, 1.2, 22),
        new THREE.MeshStandardMaterial({ color: 0xe63946, emissive: 0x660708, emissiveIntensity: 0.7 })
      );
      canopy.position.set(gx + 14, 6.4, gz);
      canopy.castShadow = true;
      scene.add(canopy);

      const ltdSign = this.createNeonSignMesh('LTD GASOLINE 24/7', 15, 3.2, '#ff4d6d', '#1b0a18');
      ltdSign.rotation.y = Math.PI / 2;
      ltdSign.position.set(gx + 22.1, 6.4, gz);
      scene.add(ltdSign);

      // Explosive Gas Pumps!
      for (const pzOff of [-5.5, 5.5]) {
        const pumpGroup = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 2.2, 1.8),
          new THREE.MeshStandardMaterial({ color: 0xd90429, emissive: 0x590d22, emissiveIntensity: 0.5 })
        );
        body.position.y = 1.1;
        pumpGroup.add(body);
        pumpGroup.position.set(gx + 14, 0, gz + pzOff);
        scene.add(pumpGroup);

        this.explosiveProps.push({
          mesh: pumpGroup,
          position: new THREE.Vector3(gx + 14, 1.0, gz + pzOff),
          exploded: false,
          respawnTimer: 0
        });
      }

      this.pois.push({
        id: 'ltd_store',
        name: 'LTD Convenience Store',
        cnName: 'LTD 24h 便利店 (可持枪抢劫)',
        icon: 'store',
        color: '#ff9e00',
        position: new THREE.Vector3(gx + 4, 0, gz)
      });
    }

    // 2. PAY 'N' SPRAY AUTO GARAGE (X = -78, Z = -195) — Open Drive-In Bay!
    {
      const sx = -78;
      const sz = -195;
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x1d2d44, roughness: 0.5 });

      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 3), wallMat);
      leftWall.position.set(sx, 4.5, sz - 9);
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 3), wallMat);
      rightWall.position.set(sx, 4.5, sz + 9);
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(3, 9, 21), wallMat);
      backWall.position.set(sx - 11, 4.5, sz);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(25, 1.4, 21), wallMat);
      roof.position.set(sx, 9.5, sz);
      scene.add(leftWall, rightWall, backWall, roof);

      // Colliders only on walls so cars drive right into the center bay (sz - 6 .. sz + 6)!
      this.colliders.push({ minX: sx - 12, maxX: sx + 12, minZ: sz - 10.5, maxZ: sz - 7.5, height: 9 });
      this.colliders.push({ minX: sx - 12, maxX: sx + 12, minZ: sz + 7.5, maxZ: sz + 10.5, height: 9 });
      this.colliders.push({ minX: sx - 12.5, maxX: sx - 9.5, minZ: sz - 10, maxZ: sz + 10, height: 9 });

      const spraySign = this.createNeonSignMesh("PAY 'N' SPRAY", 15, 3.6, '#00f0ff', '#081c29');
      spraySign.rotation.y = Math.PI / 2;
      spraySign.position.set(sx + 12.6, 8.2, sz);
      scene.add(spraySign);

      // Glowing floor pad inside garage
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 10),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.28 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(sx + 2, 0.08, sz);
      scene.add(pad);

      this.pois.push({
        id: 'pay_n_spray',
        name: "Pay 'n' Spray",
        cnName: "Pay 'n' Spray 喷漆修车消星行",
        icon: 'spray',
        color: '#00f0ff',
        position: new THREE.Vector3(sx + 4, 0, sz)
      });
    }

    // 3. LEONIDA NATIONAL BANK (X = -148, Z = -45) — Grand Heist Target!
    {
      const bx = -148;
      const bz = -45;
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.35, metalness: 0.2 });
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0x996b00,
        emissiveIntensity: 0.65,
        metalness: 0.7,
        roughness: 0.2
      });

      const bankBody = new THREE.Mesh(new THREE.BoxGeometry(34, 28, 36), marbleMat);
      bankBody.position.set(bx, 14, bz);
      bankBody.castShadow = true;
      bankBody.receiveShadow = true;
      scene.add(bankBody);

      // Classical columns facing Leonida Downtown Ave (X = -180, so West side bx - 18)
      const colGeo = new THREE.CylinderGeometry(0.9, 1.0, 14, 12);
      for (let cz = -12; cz <= 12; cz += 6) {
        const col = new THREE.Mesh(colGeo, goldMat);
        col.position.set(bx - 18.2, 7, bz + cz);
        col.castShadow = true;
        scene.add(col);
      }

      const bankSign = this.createNeonSignMesh('LEONIDA NATIONAL BANK', 22, 4.2, '#ffd166', '#1c1608');
      bankSign.rotation.y = -Math.PI / 2;
      bankSign.position.set(bx - 17.2, 18.5, bz);
      scene.add(bankSign);

      this.colliders.push({ minX: bx - 17, maxX: bx + 17, minZ: bz - 18, maxZ: bz + 18, height: 28, label: 'Bank' });

      this.pois.push({
        id: 'leonida_bank',
        name: 'Leonida National Bank',
        cnName: '雷奥奈达国家银行 (大劫案)',
        icon: 'bank',
        color: '#ffd166',
        position: new THREE.Vector3(bx - 21, 0, bz)
      });
    }

    // 4. AMMU-NATION GUN STORE (X = -148, Z = +115)
    {
      const ax = -148;
      const az = 115;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(26, 11, 24),
        new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.7 })
      );
      bldg.position.set(ax, 5.5, az);
      bldg.castShadow = true;
      scene.add(bldg);
      this.colliders.push({ minX: ax - 13, maxX: ax + 13, minZ: az - 12, maxZ: az + 12, height: 11 });

      const gunSign = this.createNeonSignMesh('AMMU-NATION GUNS', 18, 3.8, '#ff6b35', '#210b05');
      gunSign.rotation.y = -Math.PI / 2;
      gunSign.position.set(ax - 13.2, 8.2, az);
      scene.add(gunSign);

      this.pois.push({
        id: 'ammu_nation',
        name: 'Ammu-Nation',
        cnName: 'Ammu-Nation 武器与防弹衣店',
        icon: 'gun',
        color: '#ff6b35',
        position: new THREE.Vector3(ax - 17, 0, az)
      });
    }

    // 5. VCPD HEADQUARTERS & HELIPAD (X = -78, Z = +215)
    {
      const px = -78;
      const pz = 215;
      const hq = new THREE.Mesh(
        new THREE.BoxGeometry(30, 16, 28),
        new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.5 })
      );
      hq.position.set(px, 8, pz);
      hq.castShadow = true;
      scene.add(hq);
      this.colliders.push({ minX: px - 15, maxX: px + 15, minZ: pz - 14, maxZ: pz + 14, height: 16 });

      const pdSign = this.createNeonSignMesh('VCPD HEADQUARTERS', 18, 3.5, '#38bdf8', '#06152b');
      pdSign.rotation.y = Math.PI / 2;
      pdSign.position.set(px + 15.2, 12.5, pz);
      scene.add(pdSign);
    }
  }

  private buildStarfishIslandAndMarina(scene: THREE.Scene): void {
    // Marina Wooden Pier at (X = 322..385, Z = 160) for Speedboats!
    const pierWood = new THREE.MeshStandardMaterial({ color: 0x7f5539, roughness: 0.85 });
    const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(68, 0.7, 14), pierWood);
    pierDeck.position.set(352, 0.35, 160);
    pierDeck.castShadow = true;
    pierDeck.receiveShadow = true;
    scene.add(pierDeck);

    this.pois.push({
      id: 'marina_dock',
      name: 'Vice Marina Speedboats',
      cnName: '罪恶湾快艇码头 (可驾驶快艇)',
      icon: 'boat',
      color: '#38bdf8',
      position: new THREE.Vector3(368, 0.6, 160)
    });

    // North Marina Ground Helipad at (X = 265, Z = -320)
    const padCircle = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11.5, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.6 })
    );
    padCircle.position.set(265, 0.2, -320);
    scene.add(padCircle);

    const hRing = new THREE.Mesh(
      new THREE.RingGeometry(6.5, 7.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide })
    );
    hRing.rotation.x = -Math.PI / 2;
    hRing.position.set(265, 0.43, -320);
    scene.add(hRing);

    this.pois.push({
      id: 'marina_helipad',
      name: 'Vice Helipad',
      cnName: '海湾武装直升机停机坪',
      icon: 'heli',
      color: '#a855f7',
      position: new THREE.Vector3(265, 0.4, -320)
    });

    // Starfish Cay Luxury Cartel Island out in the Atlantic (X = 465, Z = 0)
    const islandGeo = new THREE.CylinderGeometry(58, 68, 2.2, 24);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0xd9c39e, roughness: 0.85 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.set(465, -0.35, 0);
    island.receiveShadow = true;
    scene.add(island);

    const lawn = new THREE.Mesh(
      new THREE.CylinderGeometry(44, 45, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 })
    );
    lawn.position.set(465, 0.8, 0);
    lawn.receiveShadow = true;
    scene.add(lawn);

    // Cartel Villa on Starfish Island
    const villa = new THREE.Mesh(
      new THREE.BoxGeometry(24, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0xfff0f3, roughness: 0.5 })
    );
    villa.position.set(478, 6.8, 0);
    villa.castShadow = true;
    scene.add(villa);
    this.colliders.push({ minX: 466, maxX: 490, minZ: -16, maxZ: 16, height: 13 });

    // Causeway Bridge connecting Ocean Drive (X=230) across the surf to Starfish Island (X=415) with a Stunt Gap!
    const bridgeDeck1 = new THREE.Mesh(
      new THREE.BoxGeometry(92, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.5 })
    );
    bridgeDeck1.position.set(276, 0.45, 0);
    bridgeDeck1.receiveShadow = true;
    scene.add(bridgeDeck1);

    const bridgeDeck2 = new THREE.Mesh(
      new THREE.BoxGeometry(62, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.5 })
    );
    bridgeDeck2.position.set(392, 0.75, 0);
    bridgeDeck2.receiveShadow = true;
    scene.add(bridgeDeck2);
  }

  private buildPalmTreesAndStreetlights(scene: THREE.Scene): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c583c, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2b9348,
      roughness: 0.65,
      side: THREE.DoubleSide
    });

    // Reusable curved palm frond geometry
    const frondGeo = new THREE.PlaneGeometry(0.95, 4.4, 1, 4);
    const fPos = frondGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fPos.count; i++) {
      const y = fPos.getY(i); // -2.2 .. +2.2
      const norm = (y + 2.2) / 4.4; // 0 at base, 1 at tip
      fPos.setY(i, norm * 4.2);
      fPos.setZ(i, -Math.pow(norm, 2.0) * 1.65);
      fPos.setX(i, fPos.getX(i) * (1.0 - norm * 0.72));
    }
    frondGeo.computeVertexNormals();

    const spawnPalm = (x: number, z: number, scale = 1) => {
      const palm = new THREE.Group();
      const segGeo = new THREE.CylinderGeometry(0.24, 0.34, 2.2, 7);
      let curX = 0;
      let curY = 0;
      const leanDir = (Math.sin(x * 0.3 + z * 0.2) > 0 ? 1 : -1) * 0.14;
      for (let s = 0; s < 4; s++) {
        const seg = new THREE.Mesh(segGeo, trunkMat);
        seg.position.set(curX, curY + 1.05, 0);
        seg.rotation.z = -leanDir * (s + 0.5);
        seg.scale.setScalar(1 - s * 0.08);
        seg.castShadow = true;
        palm.add(seg);
        curX += Math.sin(leanDir * (s + 0.5)) * 2.05;
        curY += Math.cos(leanDir * (s + 0.5)) * 2.05;
      }

      const crown = new THREE.Group();
      crown.position.set(curX, curY, 0);
      for (let f = 0; f < 7; f++) {
        const frond = new THREE.Mesh(frondGeo, leafMat);
        frond.rotation.y = (f / 7) * Math.PI * 2;
        frond.rotation.x = 1.08 + (f % 2) * 0.18;
        frond.castShadow = true;
        crown.add(frond);
      }
      palm.add(crown);
      this.palmCrowns.push(crown);

      palm.position.set(x, 0, z);
      palm.scale.setScalar(scale);
      scene.add(palm);
    };

    // Line Ocean Drive & Vice Beach with lush coconut palms!
    for (let z = -340; z <= 340; z += 22) {
      if (this.roadsZ.some((rz) => Math.abs(z - rz) < 15)) continue;
      spawnPalm(234, z, 0.95 + (Math.abs(z) % 3) * 0.12);
      spawnPalm(253, z + 8, 1.05);
      if (Math.abs(z) % 44 === 0) {
        spawnPalm(206, z, 0.92);
      }
    }

    // Palm boulevard along Collins Ave (X=100) and Causeway (Z=0)
    for (let z = -300; z <= 300; z += 36) {
      if (this.roadsZ.some((rz) => Math.abs(z - rz) < 16)) continue;
      spawnPalm(113, z, 0.9);
      spawnPalm(87, z, 0.9);
    }
    for (let x = -300; x <= 180; x += 38) {
      if (this.roadsX.some((rx) => Math.abs(x - rx) < 16)) continue;
      spawnPalm(x, 13, 0.92);
      spawnPalm(x, -13, 0.92);
    }
    // Starfish Island palms
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      spawnPalm(465 + Math.cos(ang) * 34, Math.sin(ang) * 34, 1.1);
    }

    // Neon Vice Streetlights along avenues
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, metalness: 0.6, roughness: 0.4 });
    const bulbGeo = new THREE.BoxGeometry(1.4, 0.18, 0.4);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffd6ec,
      emissive: 0xff66b3,
      emissiveIntensity: 2.8
    });
    this.neonMaterials.push(bulbMat);

    for (const rx of [-180, -40, 100, 220]) {
      for (let z = -300; z <= 300; z += 60) {
        if (this.roadsZ.some((rz) => Math.abs(z - rz) < 16)) continue;
        const g = new THREE.Group();
        const p = new THREE.Mesh(poleGeo, poleMat);
        p.position.y = 3.75;
        const b = new THREE.Mesh(bulbGeo, bulbMat);
        b.position.set(-0.6, 7.45, 0);
        g.add(p, b);
        g.position.set(rx + 12.2, 0, z);
        scene.add(g);
      }
    }
  }

  private buildStuntRamps(scene: THREE.Scene): void {
    const rampConfigs: StuntRamp[] = [
      // Launch across the Atlantic gap onto Starfish Island bridge!
      { id: 'ramp_island', x: 325, z: 0, width: 10, length: 16, height: 3.6, dirX: 1, dirZ: 0 },
      // Ocean Drive Beachfront Flyover Jump
      { id: 'ramp_ocean', x: 220, z: 225, width: 8, length: 14, height: 3.2, dirX: 0, dirZ: -1 },
      // Downtown Bank Escape Ramp
      { id: 'ramp_downtown', x: -180, z: -95, width: 8, length: 14, height: 3.1, dirX: 0, dirZ: -1 }
    ];

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      emissive: 0x663d00,
      emissiveIntensity: 0.45,
      roughness: 0.5
    });

    for (const r of rampConfigs) {
      this.stuntRamps.push(r);

      // Build wedge geometry rising along local +Z
      const geo = new THREE.BufferGeometry();
      const hw = r.width / 2;
      const hl = r.length / 2;
      const h = r.height;

      const vertices = new Float32Array([
        // Sloped top quad (two tris): rises from z=-hl (y=0.05) to z=+hl (y=h)
        -hw, 0.05, -hl,
         hw, 0.05, -hl,
         hw, h,     hl,
        -hw, 0.05, -hl,
         hw, h,     hl,
        -hw, h,     hl,
        // Back vertical face at z=+hl
        -hw, 0,    hl,
         hw, 0,    hl,
         hw, h,    hl,
        -hw, 0,    hl,
         hw, h,    hl,
        -hw, h,    hl,
        // Left side triangle
        -hw, 0,    -hl,
        -hw, h,     hl,
        -hw, 0,     hl,
        // Right side triangle
         hw, 0,    -hl,
         hw, 0,     hl,
         hw, h,     hl
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, rampMat);
      mesh.position.set(r.x, 0, r.z);
      mesh.rotation.y = Math.atan2(r.dirX, r.dirZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  public getRampHeightAt(x: number, z: number): { height: number; ramp: StuntRamp | null } {
    for (const r of this.stuntRamps) {
      const dx = x - r.x;
      const dz = z - r.z;
      // Project onto ramp forward & right vectors
      const fwd = dx * r.dirX + dz * r.dirZ;
      const right = Math.abs(-dx * r.dirZ + dz * r.dirX);
      const hl = r.length / 2;
      if (right <= r.width / 2 && fwd >= -hl && fwd <= hl) {
        const t = (fwd + hl) / r.length;
        return { height: t * r.height, ramp: r };
      }
    }
    return { height: 0, ramp: null };
  }

  public isWaterAt(x: number, z: number): boolean {
    // Causeway bridge & Marina pier stay dry!
    if (Math.abs(z) < 8.5 && x >= 230 && x <= 425) return false;
    if (Math.abs(z - 160) < 7.5 && x >= 320 && x <= 387) return false;
    // Starfish Island is dry!
    const distIsland = Math.hypot(x - 465, z);
    if (distIsland < 56) return false;

    // East of Vice Beach shoreline or beyond outer island edges is Ocean!
    if (x > 327 || x < -392 || z < -395 || z > 395) return true;
    return false;
  }

  public getDistrictName(x: number, z: number): string {
    if (Math.hypot(x - 465, z) < 68) return 'STARFISH ISLAND 海星岛';
    if (x > 250) return 'VICE BEACH 罪恶海滩';
    if (x > 165) return 'OCEAN DRIVE 海洋霓虹大道';
    if (x < -120 && Math.abs(z) < 170) return 'DOWNTOWN 罪恶城市中心';
    if (z < -220) return 'NORTH MARINA 北部海湾';
    if (x < -230) return 'VICE PORT 罪恶港工业区';
    return 'WASHINGTON BEACH 华盛顿海滩区';
  }

  private buildSkylineSpectacles(scene: THREE.Scene): void {
    // 1. Giant Neon Vice Beach Ferris Wheel at (X = 266, Z = -62) — visible right from Title Orbit & Ocean Drive!
    const fwGroup = new THREE.Group();
    const strutMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, metalness: 0.6, roughness: 0.3 });
    const legGeo = new THREE.CylinderGeometry(0.4, 0.65, 28, 8);
    for (const sx of [-2.4, 2.4]) {
      for (const sz of [-8, 8]) {
        const leg = new THREE.Mesh(legGeo, strutMat);
        leg.position.set(sx, 13, sz * 0.5);
        leg.rotation.x = sz > 0 ? -0.32 : 0.32;
        fwGroup.add(leg);
      }
    }

    const hub = new THREE.Group();
    hub.position.set(0, 25, 0);
    const pinkNeon = new THREE.MeshStandardMaterial({
      color: 0xff2e93,
      emissive: 0xff2e93,
      emissiveIntensity: 3.0
    });
    const cyanNeon = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.8
    });
    this.neonMaterials.push(pinkNeon, cyanNeon);

    const outerRim = new THREE.Mesh(new THREE.TorusGeometry(18, 0.36, 10, 36), pinkNeon);
    outerRim.rotation.y = Math.PI / 2;
    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.25, 8, 28), cyanNeon);
    innerRim.rotation.y = Math.PI / 2;
    hub.add(outerRim, innerRim);

    const spokeGeo = new THREE.CylinderGeometry(0.12, 0.12, 36, 6);
    for (let s = 0; s < 6; s++) {
      const sp = new THREE.Mesh(spokeGeo, strutMat);
      sp.rotation.x = (s / 6) * Math.PI;
      hub.add(sp);
    }

    const gondolaGeo = new THREE.BoxGeometry(2.2, 1.8, 1.8);
    for (let g = 0; g < 12; g++) {
      const ang = (g / 12) * Math.PI * 2;
      const cab = new THREE.Mesh(gondolaGeo, g % 2 === 0 ? pinkNeon : cyanNeon);
      cab.position.set(0, Math.sin(ang) * 18, Math.cos(ang) * 18);
      hub.add(cab);
    }

    fwGroup.add(hub);
    fwGroup.position.set(268, 0, -64);
    scene.add(fwGroup);
    this.ferrisWheelHub = hub;

    // 2. Cruising Leonida Sky Blimp
    const blimp = new THREE.Group();
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(9, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.4 })
    );
    balloon.scale.set(1.0, 1.0, 2.8);
    const stripe = new THREE.Mesh(
      new THREE.SphereGeometry(9.08, 20, 14),
      pinkNeon
    );
    stripe.scale.set(1.02, 0.22, 2.82);
    const gondola = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.2, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    gondola.position.set(0, -9.5, 0);
    const bannerL = this.createNeonSignMesh('LEONIDA · VICE CITY', 18, 3.8, '#00f0ff', '#100826');
    bannerL.rotation.y = Math.PI / 2;
    bannerL.position.set(9.2, 0, 0);
    const bannerR = bannerL.clone();
    bannerR.rotation.y = -Math.PI / 2;
    bannerR.position.set(-9.2, 0, 0);

    blimp.add(balloon, stripe, gondola, bannerL, bannerR);
    blimp.position.set(80, 118, 0);
    scene.add(blimp);
    this.skyBlimp = blimp;

    // 3. Glowing Ground Rings at Interactive Landmarks so players spot them effortlessly
    for (const poi of this.pois) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.0, 2.55, 24),
        new THREE.MeshBasicMaterial({
          color: poi.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.72
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(poi.position.x, poi.position.y + 0.08, poi.position.z);
      scene.add(ring);
    }
  }

  public update(dt: number, isNightLike: boolean): void {
    const t = performance.now() * 0.0018;
    // Rotate Vice Beach Neon Ferris Wheel
    if (this.ferrisWheelHub) {
      this.ferrisWheelHub.rotation.x += dt * 0.22;
    }

    // Cruise Sky Blimp in a wide majestic loop over Vice City
    if (this.skyBlimp) {
      this.blimpAngle += dt * 0.045;
      const bx = 60 + Math.cos(this.blimpAngle) * 210;
      const bz = Math.sin(this.blimpAngle) * 240;
      this.skyBlimp.position.set(bx, 118 + Math.sin(t) * 2.0, bz);
      this.skyBlimp.rotation.y = Math.atan2(-Math.sin(this.blimpAngle) * 210, Math.cos(this.blimpAngle) * 240);
    }

    // Gentle tropical sea breeze swaying palm tree crowns
    for (let i = 0; i < this.palmCrowns.length; i++) {
      const c = this.palmCrowns[i];
      c.rotation.z = Math.sin(t + i * 0.7) * 0.055;
      c.rotation.x = Math.cos(t * 0.8 + i) * 0.04;
    }

    // Make neon signs extra vibrant after dusk
    const targetEmissive = isNightLike ? 2.5 : 1.15;
    for (let i = 0; i < this.neonMaterials.length; i++) {
      this.neonMaterials[i].emissiveIntensity = THREE.MathUtils.lerp(
        this.neonMaterials[i].emissiveIntensity,
        targetEmissive,
        dt * 2
      );
    }

    // Respawn explosive gas pumps after 30s
    for (const exp of this.explosiveProps) {
      if (exp.exploded) {
        exp.respawnTimer -= dt;
        if (exp.respawnTimer <= 0) {
          exp.exploded = false;
          exp.mesh.visible = true;
        }
      }
    }
  }

  private bakeMinimapBackground(): void {
    const ctx = this.minimapBgCanvas.getContext('2d')!;
    const W = this.minimapBgCanvas.width;
    const H = this.minimapBgCanvas.height;
    const { minX, maxX, minZ, maxZ } = this.mapBounds;

    const toPxX = (wx: number) => ((wx - minX) / (maxX - minX)) * W;
    const toPxY = (wz: number) => ((wz - minZ) / (maxZ - minZ)) * H;

    // Ocean water background
    ctx.fillStyle = '#0c2d48';
    ctx.fillRect(0, 0, W, H);

    // Main City landmass
    ctx.fillStyle = '#1f2633';
    ctx.fillRect(
      toPxX(-392),
      toPxY(-395),
      toPxX(252) - toPxX(-392),
      toPxY(395) - toPxY(-395)
    );

    // Vice Beach Sand strip
    ctx.fillStyle = '#8d7b58';
    ctx.fillRect(
      toPxX(250),
      toPxY(-390),
      toPxX(328) - toPxX(250),
      toPxY(390) - toPxY(-390)
    );

    // Starfish Island circle
    ctx.fillStyle = '#2d4a3e';
    ctx.beginPath();
    ctx.arc(toPxX(465), toPxY(0), ((56) / (maxX - minX)) * W, 0, Math.PI * 2);
    ctx.fill();

    // Causeway & Marina Pier
    ctx.fillStyle = '#64748b';
    ctx.fillRect(toPxX(225), toPxY(-8), toPxX(425) - toPxX(225), toPxY(8) - toPxY(-8));
    ctx.fillRect(toPxX(324), toPxY(153), toPxX(388) - toPxX(324), toPxY(167) - toPxY(153));

    // Roads
    ctx.fillStyle = '#4b5563';
    const rwX = (this.roadWidth / (maxX - minX)) * W;
    const rwZ = (this.roadWidth / (maxZ - minZ)) * H;
    for (const rx of this.roadsX) {
      ctx.fillRect(toPxX(rx) - rwX / 2, toPxY(-380), rwX, toPxY(380) - toPxY(-380));
    }
    for (const rz of this.roadsZ) {
      ctx.fillRect(toPxX(-370), toPxY(rz) - rwZ / 2, toPxX(240) - toPxX(-370), rwZ);
    }

    // Building footprints
    ctx.fillStyle = '#334155';
    for (const b of this.colliders) {
      ctx.fillRect(
        toPxX(b.minX),
        toPxY(b.minZ),
        Math.max(2, toPxX(b.maxX) - toPxX(b.minX)),
        Math.max(2, toPxY(b.maxZ) - toPxY(b.minZ))
      );
    }
  }
}
