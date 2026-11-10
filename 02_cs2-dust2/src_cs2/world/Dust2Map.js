// Counter-Strike: Dust II — Complete Authentic de_dust2 Level, Physics, Wallbang & NavGraph
import * as THREE from 'three';
import { createWorldBox } from './Materials.js';
import { Dust2Props } from './Dust2Props.js';

export class Dust2Map {
  constructor(scene, matLib) {
    this.scene = scene;
    this.matLib = matLib;
    this.m = matLib.mats;
    this.props = new Dust2Props(matLib);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.solids = [];         // { minX, maxX, minY, maxY, minZ, maxZ, surface }
    this.ramps = [];          // { minX, maxX, minZ, maxZ, axis, yAtMin, yAtMax, surface }
    this.raycastMeshes = [];  // Meshes for hitscan & wallbang raycasting
    this.radarPolys = [];     // 2D rects for authentic Dust2 HUD radar
    this.animatedPalms = [];

    this.bombsites = {
      A: { name: 'A', minX: 25.0, maxX: 35.5, minZ: -35.5, maxZ: -25.5, y: 2.0, center: new THREE.Vector3(30.2, 2.0, -30.2) },
      B: { name: 'B', minX: -34.5, maxX: -24.5, minZ: -30.5, maxZ: -20.5, y: 0.0, center: new THREE.Vector3(-29.5, 0.0, -25.5) }
    };

    this.spawns = {
      T: [
        new THREE.Vector3(-1.5, 1.6, 41.5),
        new THREE.Vector3(-8.5, 1.6, 42.5),
        new THREE.Vector3(6.5, 1.6, 42.5),
        new THREE.Vector3(-18.0, 1.6, 41.5),
        new THREE.Vector3(15.5, 1.6, 41.5)
      ],
      CT: [
        new THREE.Vector3(14.0, -1.6, -29.0),
        new THREE.Vector3(11.5, -1.6, -26.0),
        new THREE.Vector3(16.8, -1.6, -26.5),
        new THREE.Vector3(12.5, -1.6, -32.0),
        new THREE.Vector3(17.2, -1.6, -31.5)
      ]
    };

    this.calloutZones = [];
    this.waypoints = {};

    this._buildMap();
    this._buildSkylineAndProps();
    this._buildCallouts();
    this._buildNavGraph();
  }

  // ==================== GEOMETRY & PHYSICS PRIMITIVE BUILDERS ====================

  _addSlab(minX, maxX, topY, minZ, maxZ, mat, surface = 'sand', radarColor = '#c8b48a', thickness = 2.4) {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const mesh = createWorldBox(w, thickness, d, mat, 0.26);
    mesh.position.set((minX + maxX) * 0.5, topY - thickness * 0.5, (minZ + maxZ) * 0.5);
    mesh.userData = { surface, penetrable: false };
    this.root.add(mesh);
    this.raycastMeshes.push(mesh);

    this.solids.push({
      minX, maxX,
      minY: topY - thickness, maxY: topY,
      minZ, maxZ,
      surface
    });

    if (radarColor) {
      this.radarPolys.push({ minX, maxX, minZ, maxZ, color: radarColor, type: 'floor' });
    }
    return mesh;
  }

  _addCeiling(minX, maxX, minY, maxY, minZ, maxZ, mat) {
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    const mesh = createWorldBox(w, h, d, mat, 0.26);
    mesh.position.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    mesh.userData = { surface: 'stone', penetrable: false };
    this.root.add(mesh);
    this.raycastMeshes.push(mesh);

    this.solids.push({ minX, maxX, minY, maxY, minZ, maxZ, surface: 'stone' });
    return mesh;
  }

  _addWall(minX, maxX, minY, maxY, minZ, maxZ, mat = null, surface = 'stone', withParapet = true) {
    const useMat = mat || this.m.sandstonePlaster;
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    const mesh = createWorldBox(w, h, d, useMat, 0.25);
    mesh.position.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    mesh.userData = { surface, penetrable: false };
    this.root.add(mesh);
    this.raycastMeshes.push(mesh);

    if (withParapet && h >= 3.2) {
      const trim = createWorldBox(w + 0.12, 0.24, d + 0.12, this.m.sandstoneTrim, 0.35);
      trim.position.set((minX + maxX) * 0.5, maxY + 0.10, (minZ + maxZ) * 0.5);
      this.root.add(trim);
    }

    this.solids.push({ minX, maxX, minY, maxY, minZ, maxZ, surface });
    this.radarPolys.push({ minX, maxX, minZ, maxZ, color: '#5b4c3a', type: 'wall' });
    return mesh;
  }

  _addRamp(minX, maxX, minZ, maxZ, axis, yAtMin, yAtMax, mat, surface = 'stone', radarColor = '#bfa87c') {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const dy = yAtMax - yAtMin;
    const run = axis === 'Z' ? d : w;
    const slopeLen = Math.hypot(run, dy);
    const angle = Math.atan2(dy, run);
    const thick = 1.2;

    const geo = new THREE.BoxGeometry(
      axis === 'X' ? slopeLen : w,
      thick,
      axis === 'Z' ? slopeLen : d
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { surface, penetrable: false };

    const midX = (minX + maxX) * 0.5;
    const midZ = (minZ + maxZ) * 0.5;
    const midY = (yAtMin + yAtMax) * 0.5;

    // Offset normal downward by thick/2 so top face aligns with exact mathematical ramp plane!
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    if (axis === 'Z') {
      mesh.rotation.x = -angle;
      mesh.position.set(midX, midY - (thick * 0.5) * cosA, midZ + (thick * 0.5) * sinA);
    } else {
      mesh.rotation.z = angle;
      mesh.position.set(midX + (thick * 0.5) * sinA, midY - (thick * 0.5) * cosA, midZ);
    }

    this.root.add(mesh);
    this.raycastMeshes.push(mesh);

    this.ramps.push({ minX, maxX, minZ, maxZ, axis, yAtMin, yAtMax, surface });
    if (radarColor) {
      this.radarPolys.push({ minX, maxX, minZ, maxZ, color: radarColor, type: 'floor' });
    }
    return mesh;
  }

  _addCrate(cx, bottomY, cz, w, h, d, type = 'wood') {
    const { group, hitMesh } = this.props.createDetailedCrate(w, h, d, type);
    group.position.set(cx, bottomY, cz);
    this.root.add(group);
    this.raycastMeshes.push(hitMesh);

    this.solids.push({
      minX: cx - w * 0.5, maxX: cx + w * 0.5,
      minY: bottomY, maxY: bottomY + h,
      minZ: cz - d * 0.5, maxZ: cz + d * 0.5,
      surface: type === 'military' ? 'metal' : 'wood'
    });
    this.radarPolys.push({
      minX: cx - w * 0.5, maxX: cx + w * 0.5,
      minZ: cz - d * 0.5, maxZ: cz + d * 0.5,
      color: type === 'military' ? '#586949' : '#9c784c',
      type: 'prop'
    });
  }

  _addBarrel(cx, bottomY, cz, color = 0x3b556b) {
    const { group, hitMesh } = this.props.createBarrel(color);
    group.position.set(cx, bottomY, cz);
    this.root.add(group);
    this.raycastMeshes.push(hitMesh);
    this.solids.push({
      minX: cx - 0.38, maxX: cx + 0.38,
      minY: bottomY, maxY: bottomY + 1.05,
      minZ: cz - 0.38, maxZ: cz + 0.38,
      surface: 'metal'
    });
  }

  // ==================== FULL AUTHENTIC DE_DUST2 CONSTRUCTION ====================

  _buildMap() {
    // Broad desert ground plane outside boundaries so horizon looks infinite
    const outerDesert = createWorldBox(260, 1.0, 260, this.m.desertSand, 0.18);
    outerDesert.position.set(0, -3.5, 0);
    this.root.add(outerDesert);

    // -------------------------------------------------------------------------
    // 1. T SPAWN, SUICIDE & OUTSIDE TUNNELS / OUTSIDE LONG (South: Z +22..+48)
    // -------------------------------------------------------------------------
    this._addSlab(-34, 26, 1.6, 36, 48, this.m.cobblePaving, 'stone', '#d2be96');
    // T Spawn Outer Perimeter Walls
    this._addWall(-35, 27, -2, 7.2, 48, 49.2, this.m.sandstoneWarm);
    this._addWall(-35.2, -34, -2, 7.2, 36, 49, this.m.sandstoneWarm);
    this._addWall(26, 27.2, -2, 7.2, 42, 49, this.m.sandstoneWarm);

    // T Spawn -> Suicide Alley (X: -5.5..0, Z: 30..36) & T-Mid Ramp (X: 0..5.5, Z: 30..36)
    this._addSlab(-5.5, 0.0, 0.4, 30, 36, this.m.desertSand, 'sand', '#ccb588');
    this._addRamp(0.0, 5.5, 30, 36, 'Z', 0.4, 1.6, this.m.cobblePaving, 'stone');
    // Low divider trim on Suicide drop
    this._addWall(-0.25, 0.15, 0.2, 1.65, 33, 36, this.m.sandstoneTrim, 'stone', false);
    // Cover boxes in Suicide
    this._addCrate(-4.3, 0.4, 32.8, 1.2, 1.15, 1.2, 'wood');

    // Massive South-West Building Block separating T Spawn/Mid from B Tunnels (X: -22..-5.5, Z: 4..36)
    this._addWall(-22, -5.5, -2, 7.8, 4, 36, this.m.sandstonePlaster);

    // South-East Building Block separating T Spawn from T-Ramp (X: 5.5..18, Z: 30..36)
    this._addWall(5.5, 18, -2, 7.5, 30, 36, this.m.sandstoneWarm);

    // East T Spawn -> Outside Long Ramp & Courtyard (X: 18..35, Z: 28..42)
    this._addRamp(18, 26, 36, 42, 'X', 1.6, 0.2, this.m.desertSand, 'sand');
    this._addSlab(26, 35, 0.2, 36, 42, this.m.desertSand, 'sand');
    this._addSlab(18, 35, 0.0, 28, 36, this.m.desertSand, 'sand');
    this._addWall(18, 36, -2, 7.2, 42, 43.2, this.m.sandstonePlaster);
    this._addWall(35, 36.2, -2, 7.2, 28, 43.2, this.m.sandstonePlaster);

    // Top-Mid to Outside Long Connector (T-Ramp: X: 5.5..18, Z: 23..30)
    this._addRamp(5.5, 18, 23, 30, 'X', 0.35, 0.0, this.m.desertSand, 'sand');

    // -------------------------------------------------------------------------
    // 2. LONG HOUSE (A门房), BLUE CONTAINER, PIT & LONG A (East: X +24..+48)
    // -------------------------------------------------------------------------
    // Giant Central-East Building Block separating Catwalk/Mid from Long A (X: 11..24, Z: -11..23)
    this._addWall(11, 24, -2, 8.2, -11, 23, this.m.sandstonePlaster);

    // Long House Indoor Floor & Roof (X: 24..35, Z: 16..28)
    this._addSlab(24, 35, 0.0, 16, 28, this.m.cobblePaving, 'stone', '#bba67e');
    this._addCeiling(24, 35, 4.1, 6.8, 16, 28, this.m.sandstoneWarm);
    // South wall of Long House (Z = 28) with wide arched entrance at X: 26.8..32.2
    this._addWall(24, 26.8, 0, 6.8, 27.6, 28.3, this.m.sandstonePlaster, 'stone', false);
    this._addWall(32.2, 35, 0, 6.8, 27.6, 28.3, this.m.sandstonePlaster, 'stone', false);
    this._addCeiling(26.8, 32.2, 3.3, 6.8, 27.5, 28.4, this.m.sandstoneTrim);

    // East wall of Long House (separating Long House from Pit: X = 35, Z: 16..28)
    this._addWall(34.6, 35.4, -2, 6.8, 16, 28, this.m.sandstonePlaster);

    // North wall of Long House (Z = 16): Iconic LONG DOUBLE DOORS (A门) at X = 29.5!
    this._addWall(24, 27.7, 0, 6.8, 15.7, 16.3, this.m.sandstonePlaster, 'stone', false);
    this._addWall(31.3, 35.0, 0, 6.8, 15.7, 16.3, this.m.sandstonePlaster, 'stone', false);
    const longDoors = this.props.createDoubleDoors({
      cx: 29.5, y: 0, cz: 16.0, axis: 'Z',
      openingWidth: 3.1, doorHeight: 3.2, wallHeight: 4.2,
      leftAngle: 0.62, rightAngle: -0.58, gapWidth: 0.95 // Wide enough to rush through!
    });
    this.root.add(longDoors.group);
    this.solids.push(...longDoors.colliders);
    this.raycastMeshes.push(...longDoors.raycastMeshes);

    // Warm indoor lantern in Long House
    const lhLight = this.props.createTunnelLight(true);
    lhLight.position.set(29.5, 4.05, 22.0);
    this.root.add(lhLight);

    // Long Corner & Blue Shipping Container (X: 24..48, Z: 4..16)
    this._addSlab(24, 48, 0.0, 4, 16, this.m.desertSand, 'sand');
    // Building extension West of Long A (X: 24..31, Z: -18..4)
    this._addWall(24, 31, -2, 7.8, -18, 4, this.m.sandstoneWarm);

    // Iconic Blue Shipping Container angled outside Long Doors!
    const blueGroup = new THREE.Group();
    blueGroup.position.set(29.2, 0.0, 8.8);
    blueGroup.rotation.y = 0.26;
    const blueMesh = createWorldBox(2.45, 2.55, 5.6, this.m.blueContainer, 0.35);
    blueMesh.position.y = 1.275;
    blueMesh.userData = { surface: 'metal', penetrable: false };
    blueGroup.add(blueMesh);
    this.root.add(blueGroup);
    this.raycastMeshes.push(blueMesh);
    // Compound AABB approximation for angled container
    this.solids.push(
      { minX: 27.8, maxX: 30.6, minY: 0, maxY: 2.55, minZ: 6.1, maxZ: 11.5, surface: 'metal' }
    );
    this.radarPolys.push({ minX: 27.8, maxX: 30.6, minZ: 6.1, maxZ: 11.5, color: '#2d6399', type: 'prop' });

    // PIT (A大坑: X: 35..48, Z: 16..34, sloping down to Y = -1.45)
    this._addRamp(35, 44.5, 16, 27, 'Z', 0.0, -1.45, this.m.desertSand, 'sand', '#bca477');
    this._addSlab(35, 48, -1.45, 27, 34, this.m.desertSand, 'sand', '#b1996c');
    // Pit Side Plat along East wall (X: 44.5..48, Z: 16..27)
    this._addSlab(44.5, 48, -0.25, 16, 27, this.m.cobblePaving, 'stone', '#c4ae84');
    this._addWall(44.2, 44.6, -1.5, 0.65, 18.5, 25.5, this.m.sandstoneTrim, 'stone', false);
    // Pit Perimeter Walls
    this._addWall(35, 49, -3, 6.8, 34, 35.2, this.m.sandstoneWarm);
    this._addWall(48, 49.2, -3, 6.8, -27, 35.2, this.m.sandstonePlaster);

    // LONG A BOULEVARD (X: 31..48, Z: -18..4)
    this._addSlab(31, 48, 0.0, -18, 4, this.m.desertSand, 'sand');
    // A Car (A大烧焦警车 at X = 45.2, Z = -7.5)
    const aCar = this.props.createWreckedCar(0x6e7b85, -0.22);
    aCar.group.position.set(45.2, 0.0, -7.5);
    this.root.add(aCar.group);
    this.raycastMeshes.push(...aCar.rayMeshes);
    this.solids.push({ minX: 44.1, maxX: 46.3, minY: 0, maxY: 1.38, minZ: -9.6, maxZ: -5.4, surface: 'metal' });
    this._addBarrel(46.8, 0.0, -10.4, 0x733b2c);
    this._addCrate(31.9, 0.0, -2.5, 1.1, 1.1, 1.1, 'wood');

    // LONG CROSS & A RAMP (Z: -27..-16)
    this._addSlab(25, 36, 0.0, -25, -18, this.m.desertSand, 'sand');
    this._addRamp(36, 48, -27, -16, 'Z', 2.0, 0.0, this.m.cobblePaving, 'stone', '#ccb78e');
    // Retaining wall between Long Cross and A Ramp
    this._addWall(35.5, 36.1, -0.2, 2.3, -25, -19, this.m.sandstoneTrim, 'stone', false);

    // -------------------------------------------------------------------------
    // 3. BOMBSITE A, GOOSE, SHORT A & CATWALK
    // -------------------------------------------------------------------------
    // Bombsite A Elevated Platform (Y = +2.0m)
    this._addSlab(22, 36, 2.0, -42, -25, this.m.cobblePaving, 'stone', '#dcc89e', 4.0);
    this._addSlab(36, 48, 2.0, -42, -27, this.m.cobblePaving, 'stone', '#dcc89e', 4.0);

    // North & East Outer Walls of A Site + Goose
    this._addWall(20, 49, -2, 8.2, -43.2, -42, this.m.sandstoneWarm);
    this._addWall(48, 49.2, -2, 8.2, -43.2, -27, this.m.sandstoneWarm);
    // Goose Alcove Wall & Iconic GOOSE Graffiti!
    this._addWall(35, 36.2, 2.0, 6.2, -42, -38.5, this.m.sandstoneTrim, 'stone', false);
    const gooseSign = this.matLib.createWallDecal('GOOSE', '', '#20262b', 2.6, 1.3);
    gooseSign.position.set(41.5, 3.7, -41.92);
    this.root.add(gooseSign);

    // A Site Bombsite Marker & Crates
    const aFloorDecal = this.matLib.createBombsiteFloorZone(8.5, 8.5, 'A');
    aFloorDecal.position.set(30.2, 2.02, -30.2);
    this.root.add(aFloorDecal);
    const aWallSign = this.matLib.createWallDecal('A', 'BOMBSITE', '#b82520', 2.2, 1.5);
    aWallSign.position.set(29.8, 4.1, -41.92);
    this.root.add(aWallSign);

    // Default A Ordnance Crates & Safe Plant Stack
    this._addCrate(30.2, 2.0, -28.8, 1.5, 1.25, 1.5, 'military');
    this._addCrate(31.8, 2.0, -28.8, 1.3, 1.15, 1.3, 'military');
    this._addCrate(30.2, 3.25, -28.8, 1.2, 1.05, 1.2, 'wood');
    this._addCrate(26.2, 2.0, -34.2, 1.35, 1.2, 1.35, 'wood');
    this._addCrate(26.2, 2.0, -35.6, 1.35, 1.2, 1.35, 'wood');
    this._addBarrel(38.5, 2.0, -35.0, 0x4b5c3e);

    // South Parapet of A Plat (leaves Elevator drop open at X: 22..25.5!)
    this._addWall(25.5, 34.2, 2.0, 2.92, -25.3, -24.8, this.m.sandstoneTrim, 'stone', false);

    // -------------------------------------------------------------------------
    // 4. MID, XBOX, CATWALK & SHORT A STAIRS
    // -------------------------------------------------------------------------
    // Main Mid Alley (X: -5.5..+5.5, Z: -10..+30)
    this._addRamp(-5.5, 5.5, 14, 30, 'Z', 0.0, 0.4, this.m.desertSand, 'sand');
    this._addSlab(-5.5, 5.5, 0.0, -10, 14, this.m.desertSand, 'sand');
    // Cover Green Box at Top Mid Right
    this._addCrate(4.4, 0.15, 18.5, 1.25, 1.2, 1.25, 'military');

    // Catwalk Ledge along East side of Mid (X: 5.5..11, Z: -11..16, Y = +1.3m)
    this._addRamp(5.5, 11, 16, 23, 'Z', 1.3, 0.3, this.m.cobblePaving, 'stone');
    this._addSlab(5.5, 11, 1.3, -11, 16, this.m.cobblePaving, 'stone', '#d4c096', 2.0);

    // XBOX in Mid! (Allows jumping from Mid / Lower Tunnels right onto Catwalk!)
    // Step crate (0.56m) + Main Xbox (1.10m) -> Catwalk (1.30m)
    this._addCrate(2.9, 0.0, -7.8, 1.15, 0.56, 1.25, 'wood');
    this._addCrate(4.35, 0.0, -7.8, 1.65, 1.10, 1.65, 'military');
    // North wall behind Xbox separating Mid from Short A (Z = -10, X: 2.5..5.5)
    this._addWall(0.5, 5.5, 0.0, 6.8, -10.3, -9.7, this.m.sandstonePlaster);

    // Short A Corner & Stairs up to Bombsite A (X: 5.5..22, Z: -19..-11)
    this._addSlab(5.5, 13.5, 1.3, -19, -11, this.m.cobblePaving, 'stone', '#d4c096', 1.8);
    this._addRamp(13.5, 22.0, -19, -12.5, 'X', 1.3, 2.0, this.m.cobblePaving, 'stone', '#d8c59c');
    // Short A Walkway connecting Stairs into Bombsite A (X: 18..24, Z: -26..-19, Y = 2.0)
    this._addSlab(18.5, 24.0, 2.0, -26, -19, this.m.cobblePaving, 'stone', '#dcc89e', 0.65);
    // Short A Protective Walls (preventing falling into CT Spawn except intentional jump!)
    this._addWall(5.2, 5.8, 0.0, 6.5, -19, -10, this.m.sandstonePlaster);
    this._addWall(5.5, 18.5, 1.0, 6.5, -19.4, -18.8, this.m.sandstoneWarm);
    this._addWall(11.0, 24.0, 1.3, 6.8, -12.5, -11.0, this.m.sandstonePlaster);
    // Ninja Boxes at Short A!
    this._addCrate(22.6, 2.0, -14.2, 1.25, 1.25, 1.25, 'wood');
    this._addCrate(22.6, 3.25, -14.2, 1.1, 1.05, 1.1, 'wood');

    // -------------------------------------------------------------------------
    // 5. MID DOUBLE DOORS, CT MID & CT SPAWN
    // -------------------------------------------------------------------------
    // Iconic MID DOUBLE DOORS at Z = -10, centered at X = -1.5 (exact sniper lane from Suicide X = -1.5!)
    this._addWall(-6.0, -3.3, 0, 6.8, -10.3, -9.7, this.m.sandstonePlaster, 'stone', false);
    const midDoors = this.props.createDoubleDoors({
      cx: -1.5, y: 0.0, cz: -10.0, axis: 'Z',
      openingWidth: 3.15, doorHeight: 3.2, wallHeight: 6.8,
      leftAngle: 0.56, rightAngle: -0.52, gapWidth: 0.88 // Sniper gap + smooth walk-through!
    });
    this.root.add(midDoors.group);
    this.solids.push(...midDoors.colliders);
    this.raycastMeshes.push(...midDoors.raycastMeshes);

    // CT Mid Floor (X: -20..+4.5, Z: -34..-10, Y = 0.0)
    this._addSlab(-20, 4.5, 0.0, -34, -10, this.m.cobblePaving, 'stone', '#c4b393');
    // North boundary wall of CT Mid
    this._addWall(-20.5, 10.5, -2, 7.5, -35.2, -34.0, this.m.sandstonePlaster);
    // South wall of CT Mid West (separating CT Mid from Lower/Upper Tunnels: Z = -10, X: -20..-6)
    this._addWall(-20, -6.0, -2, 7.5, -10.4, -9.6, this.m.sandstonePlaster);
    // Mid-to-B Crate outside Mid Doors
    this._addCrate(3.4, 0.0, -13.5, 1.35, 1.25, 1.35, 'wood');

    // Slope East from CT Mid down into CT Spawn (X: 4.5..10.5, Z: -34..-19, Y: 0.0 -> -1.6)
    this._addRamp(4.5, 10.5, -34, -19, 'X', 0.0, -1.6, this.m.cobblePaving, 'stone', '#b3a284');

    // CT SPAWN (警家: X: 10.5..20, Z: -36..-19, Y = -1.6m, tucked beside/under Short A Overpass!)
    this._addSlab(10.5, 20.0, -1.6, -36, -19, this.m.cobblePaving, 'stone', '#a6967a');
    this._addWall(10.0, 22.5, -3, 7.5, -37.2, -36.0, this.m.sandstoneWarm);
    // Retaining wall under A Site at X = 21.8, Z: -36..-25
    this._addWall(21.4, 22.2, -2.5, 2.0, -36, -25, this.m.sandstoneTrim, 'stone', false);
    this._addSlab(20.0, 21.8, -1.6, -36, -25, this.m.cobblePaving, 'stone', '#a6967a');
    // CT Ramp going East up to Long Cross / Elevator (X: 18.5..25.5, Z: -25..-19, Y: -1.6 -> 0.0)
    this._addRamp(18.5, 25.5, -25, -19, 'X', -1.6, 0.0, this.m.cobblePaving, 'stone', '#b5a486');
    // CT Spawn tactical crates
    this._addCrate(15.2, -1.6, -34.2, 1.4, 1.2, 1.4, 'military');

    // Directional Wall Signs in CT Mid (`← A` and `B →`)
    const signToB = this.matLib.createWallDecal('← B', '', '#b82520', 1.8, 0.9);
    signToB.position.set(-8.5, 2.4, -33.92);
    this.root.add(signToB);
    const signToA = this.matLib.createWallDecal('A →', '', '#b82520', 1.8, 0.9);
    signToA.position.set(2.5, 2.4, -33.92);
    this.root.add(signToA);

    // -------------------------------------------------------------------------
    // 6. OUTSIDE TUNNELS, UPPER B TUNNELS & LOWER B TUNNELS (West: X -36..-5.5)
    // -------------------------------------------------------------------------
    // T Spawn -> Outside Tunnels Wide Steps/Ramp (X: -34..-22, Z: 28..36, Y: 0.4..1.6)
    this._addRamp(-34, -22, 29, 36, 'Z', 0.4, 1.6, this.m.cobblePaving, 'stone');
    this._addSlab(-36, -22, 0.4, 22, 29, this.m.desertSand, 'sand');
    this._addWall(-37.2, -36, -2, 7.2, 22, 36.5, this.m.sandstoneWarm);

    // UPPER B TUNNELS (Vaulted Stone Hall: X: -36..-22, Z: -2..22, Y = +0.2m)
    this._addRamp(-34, -24, 20, 22.5, 'Z', 0.2, 0.4, this.m.tunnelMasonry, 'stone');
    this._addSlab(-36, -22, 0.2, -2, 20.2, this.m.tunnelMasonry, 'stone', '#9a907e');
    this._addCeiling(-36.5, -21.5, 4.1, 7.2, -10, 22.5, this.m.tunnelMasonry);
    // West wall of Upper Tunnels
    this._addWall(-37.2, -36, -2, 7.2, -10, 22.5, this.m.tunnelMasonry, 'stone', false);
    // South wall flanks of Tunnel Entrance (Z = 22)
    this._addWall(-36, -33.2, 0, 7.2, 21.6, 22.4, this.m.tunnelMasonry, 'stone', false);
    this._addWall(-24.8, -22, 0, 7.2, 21.6, 22.4, this.m.tunnelMasonry, 'stone', false);
    // East wall of Upper Tunnels (leaves Z: -2..+4 open for Stairs to Lower B!)
    this._addWall(-22.5, -21.8, -2, 7.2, -10, -2.0, this.m.tunnelMasonry, 'stone', false);
    // Iconic Stone Pillars inside Upper B Tunnels + Cover Crates
    this._addWall(-27.2, -25.8, 0.2, 4.1, 11.2, 12.6, this.m.tunnelMasonry, 'stone', false);
    this._addWall(-32.6, -31.2, 0.2, 4.1, 5.2, 6.6, this.m.tunnelMasonry, 'stone', false);
    this._addCrate(-34.8, 0.2, 13.5, 1.3, 1.2, 1.3, 'wood');

    // Warm Ceiling Lights inside Upper & Lower Tunnels
    for (const [lx, ly, lz] of [[-29, 4.0, 16], [-29, 4.0, 4], [-31.5, 4.0, -6], [-11, 3.2, -2]]) {
      const tl = this.props.createTunnelLight(true);
      tl.position.set(lx, ly, lz);
      this.root.add(tl);
    }

    // TUNNEL STAIRS -> LOWER B TUNNELS (X: -22..-5.5, Z: -6..+4)
    this._addRamp(-22, -14, -2, 4, 'X', 0.2, -0.9, this.m.tunnelMasonry, 'stone', '#8b8272');
    this._addSlab(-14, -9.0, -0.9, -6, 4, this.m.tunnelMasonry, 'stone', '#837a6b');
    this._addRamp(-9.0, -5.5, -6, 1.5, 'X', -0.9, 0.0, this.m.tunnelMasonry, 'stone', '#948a79');
    this._addCeiling(-22, -5.5, 3.3, 6.8, -6.5, 4.5, this.m.tunnelMasonry);
    // Walls enclosing Lower Tunnels
    this._addWall(-22, -5.5, -2.5, 6.8, 4.0, 4.8, this.m.tunnelMasonry, 'stone', false);
    this._addWall(-22, -5.5, -2.5, 6.8, -6.8, -6.0, this.m.tunnelMasonry, 'stone', false);
    this._addCrate(-12.8, -0.9, 2.6, 1.25, 1.15, 1.25, 'wood');

    // UPPER B TUNNEL EXIT CORRIDOR -> BOMBSITE B (X: -35..-28, Z: -10..-2)
    this._addRamp(-35, -28, -10, -2, 'Z', 0.0, 0.2, this.m.tunnelMasonry, 'stone', '#9e9482');
    this._addWall(-28.0, -22.0, -2, 7.2, -10.2, -2.0, this.m.tunnelMasonry, 'stone', false);
    this._addWall(-36.2, -35.0, -2, 7.2, -10.2, -2.0, this.m.tunnelMasonry, 'stone', false);

    // -------------------------------------------------------------------------
    // 7. BOMBSITE B, B CAR, BACK PLAT, B DOORS & B WINDOW (North-West: X -45..-20, Z -40..-10)
    // -------------------------------------------------------------------------
    this._addSlab(-45, -20, 0.0, -40, -10, this.m.cobblePaving, 'stone', '#d4c19a');
    // Outer Walls of Bombsite B
    this._addWall(-46.2, -45, -2, 7.8, -41, -9.5, this.m.sandstoneWarm);
    this._addWall(-46.2, -19.5, -2, 7.8, -41.2, -40, this.m.sandstonePlaster);
    this._addWall(-46.2, -35, -2, 7.8, -10.2, -9.4, this.m.sandstoneWarm);

    // B Car / Closet (死点 / B车 at X = -41.5, Z = -14.8)
    const bCar = this.props.createWreckedCar(0x8e6b4e, 0.34);
    bCar.group.position.set(-41.5, 0.0, -14.8);
    this.root.add(bCar.group);
    this.raycastMeshes.push(...bCar.rayMeshes);
    this.solids.push({ minX: -42.6, maxX: -40.4, minY: 0, maxY: 1.38, minZ: -16.9, maxZ: -12.7, surface: 'metal' });
    this._addCrate(-43.6, 0.0, -11.2, 1.3, 1.2, 1.3, 'wood');

    // Back Plat (B后平台: X: -45..-31, Z: -40..-32.5, Y = +0.85m)
    this._addSlab(-45, -31, 0.85, -40, -32.5, this.m.cobblePaving, 'stone', '#dfcda6', 1.2);
    this._addRamp(-31, -27.5, -39.5, -34.0, 'X', 0.85, 0.0, this.m.cobblePaving, 'stone');
    this._addCrate(-38.5, 0.85, -34.0, 1.4, 1.2, 1.3, 'wood');
    this._addCrate(-43.2, 0.85, -36.5, 1.4, 1.25, 1.4, 'military');

    // Bombsite B Zone, Big Box / Double Stack & Military Crates
    const bFloorDecal = this.matLib.createBombsiteFloorZone(8.5, 8.5, 'B');
    bFloorDecal.position.set(-29.5, 0.02, -25.5);
    this.root.add(bFloorDecal);
    const bWallSign = this.matLib.createWallDecal('B', 'BOMBSITE', '#b82520', 2.2, 1.5);
    bWallSign.position.set(-29.5, 2.8, -39.92);
    this.root.add(bWallSign);

    // Iconic B Default & Double Stack Crates
    this._addCrate(-29.5, 0.0, -25.2, 1.65, 1.3, 1.65, 'military');
    this._addCrate(-29.5, 1.3, -25.2, 1.35, 1.15, 1.35, 'wood');
    this._addCrate(-27.8, 0.0, -25.2, 1.35, 1.15, 1.35, 'military');
    this._addBarrel(-33.2, 0.0, -26.8, 0x3f5642);

    // EAST WALL OF BOMBSITE B (X = -20): B DOORS & B WINDOW!
    // Segment 1 (South of B Doors: Z -16.4..-10)
    this._addWall(-20.3, -19.7, 0, 7.0, -16.4, -10.0, this.m.sandstonePlaster, 'stone', false);
    // B DOUBLE DOORS (centered at X = -20, Z = -18.0, axis = 'X')
    const bDoors = this.props.createDoubleDoors({
      cx: -20.0, y: 0.0, cz: -18.0, axis: 'X',
      openingWidth: 3.1, doorHeight: 3.2, wallHeight: 7.0,
      leftAngle: 0.58, rightAngle: -0.54, gapWidth: 0.92
    });
    this.root.add(bDoors.group);
    this.solids.push(...bDoors.colliders);
    this.raycastMeshes.push(...bDoors.raycastMeshes);

    // Segment 2 (Between B Doors & B Window: Z -26.8..-19.6)
    this._addWall(-20.3, -19.7, 0, 7.0, -26.8, -19.6, this.m.sandstonePlaster, 'stone', false);

    // B WINDOW (狗洞: Z -30.4..-26.8, sill height Y = 0.85m, lintel Y = 2.85m -> 2.0m tall opening!)
    this._addWall(-20.35, -19.65, 0, 0.85, -30.4, -26.8, this.m.sandstoneTrim, 'stone', false);
    this._addCeiling(-20.35, -19.65, 2.85, 7.0, -30.4, -26.8, this.m.sandstonePlaster);
    // Scaffolding step crates on BOTH sides of B Window so players & bots hop right through!
    this._addCrate(-21.2, 0.0, -28.6, 1.2, 0.46, 2.4, 'wood');
    this._addCrate(-18.8, 0.0, -28.6, 1.2, 0.46, 2.4, 'wood');

    // Segment 3 (North of B Window: Z -40..-30.4)
    this._addWall(-20.3, -19.7, 0, 7.0, -40.2, -30.4, this.m.sandstonePlaster, 'stone', false);
  }

  // ==================== MOROCCAN SKYLINE, PALMS, DOMES & DETAILS ====================

  _buildSkylineAndProps() {
    // Minaret Domes around the Dust2 horizon (visible from Mid, A Site, B Site, T Spawn!)
    const minaretCoords = [
      [17.5, 8.2, -6.0, 1.05],
      [-14.0, 7.8, 18.0, 1.15],
      [34.0, 7.0, -47.0, 1.25],
      [-32.0, 7.2, -46.0, 1.10]
    ];
    for (const [mx, my, mz, s] of minaretCoords) {
      const m = this.props.createMinaretDome(s);
      m.position.set(mx, my, mz);
      this.root.add(m);
    }

    // Desert Palm Trees at iconic Dust2 spots (Top Mid, Long A outside wall, T Spawn, B Site skyline)
    const palmPlacements = [
      [8.5, 0.3, 27.5, 9.2, -0.7, -0.4],
      [39.5, 0.0, 14.5, 9.8, -0.8, 0.3],
      [-12.0, 1.6, 46.8, 8.8, 0.5, -0.5],
      [-43.5, 0.85, -38.8, 8.6, 0.7, 0.4],
      [46.8, 2.0, -39.5, 9.0, -0.6, 0.4]
    ];
    for (const [px, py, pz, h, lx, lz] of palmPlacements) {
      const palm = this.props.createPalmTree(h, lx, lz);
      palm.position.set(px, py, pz);
      this.root.add(palm);
      this.animatedPalms.push(palm);
    }

    // Shuttered Moroccan Windows & Striped Market Awnings along facades
    const windowSpecs = [
      [10.95, 4.6, 4.0, -Math.PI / 2],
      [10.95, 4.6, -4.0, -Math.PI / 2],
      [-5.45, 4.5, 12.0, Math.PI / 2],
      [-5.45, 4.5, 22.0, Math.PI / 2],
      [30.95, 4.5, -8.0, Math.PI / 2],
      [47.95, 4.6, 2.0, -Math.PI / 2],
      [-28.0, 5.2, -39.95, 0]
    ];
    for (const [wx, wy, wz, ry] of windowSpecs) {
      const win = this.props.createShutteredWindow(1.35, 1.85);
      win.position.set(wx, wy, wz);
      win.rotation.y = ry;
      this.root.add(win);
    }

    // Striped Cloth Awnings at Long A, Mid & B Site
    const awningSpecs = [
      [31.05, 3.8, -12.0, Math.PI / 2, 4.6],
      [-5.45, 3.9, 18.0, Math.PI / 2, 4.2],
      [-37.0, 4.2, -39.9, 0, 5.0]
    ];
    for (const [ax, ay, az, ry, w] of awningSpecs) {
      const aw = this.props.createAwning(w, 1.8);
      aw.position.set(ax, ay, az);
      aw.rotation.y = ry;
      this.root.add(aw);
    }

    // Overhead CT Spawn Arch Bridge connecting Short A & A Site visually
    const bridgeArch = createWorldBox(9.5, 1.4, 3.6, this.m.sandstoneWarm, 0.28);
    bridgeArch.position.set(15.2, 4.6, -22.5);
    this.root.add(bridgeArch);
  }

  update(time) {
    // Gentle desert breeze on palm fronds
    for (let i = 0; i < this.animatedPalms.length; i++) {
      const crown = this.animatedPalms[i].userData.crown;
      if (crown) {
        crown.rotation.z = Math.sin(time * 1.4 + i * 1.7) * 0.035;
        crown.rotation.x = Math.cos(time * 1.1 + i) * 0.025;
      }
    }
  }

  // ==================== PHYSICS: MOVEMENT, RAMPS, CROUCH-JUMP ====================

  // Query highest floor / ramp beneath (x, z) reachable from current footY
  getSupportingFloorY(x, footY, z, radius = 0.38, maxStepUp = 0.50) {
    let bestY = -50;
    let bestSurface = 'sand';

    // Check smooth ramps first
    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      if (x + radius * 0.5 >= r.minX && x - radius * 0.5 <= r.maxX &&
          z + radius * 0.5 >= r.minZ && z - radius * 0.5 <= r.maxZ) {
        const t = r.axis === 'Z'
          ? Math.max(0, Math.min(1, (z - r.minZ) / (r.maxZ - r.minZ)))
          : Math.max(0, Math.min(1, (x - r.minX) / (r.maxX - r.minX)));
        const ry = r.yAtMin + (r.yAtMax - r.yAtMin) * t;
        if (ry <= footY + maxStepUp + 0.22 && ry > bestY) {
          bestY = ry;
          bestSurface = r.surface;
        }
      }
    }

    // Check solid AABB slabs & crates
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (x + radius > s.minX && x - radius < s.maxX &&
          z + radius > s.minZ && z - radius < s.maxZ) {
        if (s.maxY <= footY + maxStepUp && s.maxY > bestY) {
          bestY = s.maxY;
          bestSurface = s.surface;
        }
      }
    }

    return { floorY: bestY, surface: bestSurface };
  }

  // Push cylinder (x, z, radius) out of all horizontal walls overlapping [footY + stepUp .. footY + height]
  resolveHorizontal(pos, radius = 0.40, height = 1.72, stepUp = 0.50) {
    const minCheckY = pos.y + stepUp;
    const maxCheckY = pos.y + height;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.solids.length; i++) {
        const s = this.solids[i];
        if (s.maxY <= minCheckY || s.minY >= maxCheckY) continue;

        // Closest point on AABB in XZ to circle center
        const cx = Math.max(s.minX, Math.min(pos.x, s.maxX));
        const cz = Math.max(s.minZ, Math.min(pos.z, s.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          if (distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const push = radius - dist;
            pos.x += (dx / dist) * push;
            pos.z += (dz / dist) * push;
          } else {
            // Center inside AABB — push out via shallowest axis
            const penLeft = Math.abs(pos.x - s.minX);
            const penRight = Math.abs(s.maxX - pos.x);
            const penBack = Math.abs(pos.z - s.minZ);
            const penFront = Math.abs(s.maxZ - pos.z);
            const m = Math.min(penLeft, penRight, penBack, penFront);
            if (m === penLeft) pos.x = s.minX - radius;
            else if (m === penRight) pos.x = s.maxX + radius;
            else if (m === penBack) pos.z = s.minZ - radius;
            else pos.z = s.maxZ + radius;
          }
        }
      }
    }
  }

  // Check overhead ceiling clamp during jumps
  getCeilingY(x, footY, z, radius = 0.36) {
    let minCeil = 999;
    const headBase = footY + 1.0;
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (x + radius > s.minX && x - radius < s.maxX &&
          z + radius > s.minZ && z - radius < s.maxZ) {
        if (s.minY >= headBase && s.minY < minCeil) {
          minCeil = s.minY;
        }
      }
    }
    return minCeil;
  }

  // ==================== HITSCAN RAYCAST & WOOD DOOR WALLBANGING ====================

  // Traces bullet against world + character hitboxes with authentic CS wood penetration!
  // targetHitboxes: array of Meshes with userData { character, part: 'HEAD'|'CHEST'|'STOMACH'|'LEGS' }
  traceBullet(origin, direction, weaponDef, targetHitboxes, maxRange = 140) {
    const raycaster = new THREE.Raycaster(origin, direction.clone().normalize(), 0.05, maxRange);
    const allObjects = [...this.raycastMeshes, ...targetHitboxes];
    const hits = raycaster.intersectObjects(allObjects, false);

    let remainingPower = 1.0;
    let wallbanged = false;
    const impacts = [];
    const hitCharacters = new Set();

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const ud = h.object.userData || {};

      // Character Hitbox!
      if (ud.character) {
        if (hitCharacters.has(ud.character)) continue;
        hitCharacters.add(ud.character);

        return {
          hitType: 'character',
          character: ud.character,
          part: ud.part || 'CHEST',
          point: h.point,
          distance: h.distance,
          powerMultiplier: remainingPower,
          wallbanged,
          impacts
        };
      }

      // World geometry hit
      const surface = ud.surface || 'stone';
      impacts.push({
        point: h.point.clone(),
        normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0),
        surface
      });

      // Authentic CS Wallbang through Wooden Double Doors & Wooden Crates!
      if (ud.penetrable && weaponDef.penetration >= 1.0 && !wallbanged) {
        const loss = (ud.penLoss || 0.42) / Math.max(0.8, weaponDef.penetration * 0.65);
        remainingPower *= Math.max(0.28, 1.0 - loss);
        wallbanged = true;
        continue; // Bullet keeps flying through the door!!
      } else {
        // Stopped by solid sandstone wall / metal container
        return {
          hitType: 'world',
          surface,
          point: h.point,
          distance: h.distance,
          wallbanged,
          impacts
        };
      }
    }

    return { hitType: 'none', wallbanged, impacts };
  }

  // Fast Line-of-Sight check (used for Flashbang blind check & Bot vision, including Smoke occlusion!)
  hasLineOfSight(fromPos, toPos, activeSmokes = []) {
    const dir = new THREE.Vector3().subVectors(toPos, fromPos);
    const dist = dir.length();
    if (dist < 0.2) return true;
    dir.divideScalar(dist);

    // Check active Smoke Grenade spheres (radius 4.3m blocks vision!)
    for (let i = 0; i < activeSmokes.length; i++) {
      const sm = activeSmokes[i];
      const toCenter = new THREE.Vector3().subVectors(sm.position, fromPos);
      const proj = toCenter.dot(dir);
      if (proj > 0 && proj < dist) {
        const perpSq = toCenter.lengthSq() - proj * proj;
        if (perpSq < sm.radius * sm.radius) {
          return false; // Blocked by Smoke!
        }
      }
    }

    const rc = new THREE.Raycaster(fromPos, dir, 0.15, dist - 0.15);
    const hits = rc.intersectObjects(this.raycastMeshes, false);
    return hits.length === 0;
  }

  // ==================== CALLOUTS & NAVIGATION WAYPOINT GRAPH ====================

  getBombsiteAt(pos) {
    for (const key of ['A', 'B']) {
      const b = this.bombsites[key];
      if (pos.x >= b.minX && pos.x <= b.maxX &&
          pos.z >= b.minZ && pos.z <= b.maxZ &&
          Math.abs(pos.y - b.y) < 1.8) {
        return b;
      }
    }
    return null;
  }

  _buildCallouts() {
    this.calloutZones = [
      { minX: -35, maxX: 27, minZ: 36, maxZ: 49, name: 'T Spawn · 匪家' },
      { minX: -6, maxX: 1, minZ: 28, maxZ: 36, name: 'Suicide · 自杀巷' },
      { minX: -6, maxX: 6, minZ: 10, maxZ: 28, name: 'Top Mid · 中路坡顶' },
      { minX: -6, maxX: 5.5, minZ: -10, maxZ: 10, name: 'Mid · 中路 / Xbox' },
      { minX: 5.5, maxX: 11.5, minZ: -11, maxZ: 20, name: 'Catwalk · A小走廊' },
      { minX: 5.5, maxX: 23, minZ: -20, maxZ: -11, name: 'Short A · A小道' },
      { minX: 18, maxX: 36, minZ: 28, maxZ: 43, name: 'Outside Long · A门外' },
      { minX: 24, maxX: 35, minZ: 16, maxZ: 28, name: 'Long Doors · A门房' },
      { minX: 35, maxX: 49, minZ: 16, maxZ: 35, name: 'Pit · A大坑' },
      { minX: 24, maxX: 35, minZ: 4, maxZ: 16, name: 'Blue Box · 蓝箱' },
      { minX: 31, maxX: 49, minZ: -18, maxZ: 16, name: 'Long A · A大道' },
      { minX: 25, maxX: 49, minZ: -27, maxZ: -18, name: 'A Ramp · A斜坡' },
      { minX: 35, maxX: 49, minZ: -43, maxZ: -37, name: 'Goose · 鹅位' },
      { minX: 22, maxX: 49, minZ: -43, maxZ: -25, name: 'Bombsite A · A包点' },
      { minX: 10, maxX: 22, minZ: -37, maxZ: -19, name: 'CT Spawn · 警家' },
      { minX: -20, maxX: 10, minZ: -35, maxZ: -10, name: 'CT Mid · 警家连接/中门' },
      { minX: -37, maxX: -22, minZ: 22, maxZ: 36, name: 'Outside Tunnels · B洞外' },
      { minX: -37, maxX: -22, minZ: -10, maxZ: 22, name: 'Upper B Tunnels · B二层' },
      { minX: -22, maxX: -5.5, minZ: -7, maxZ: 5, name: 'Lower B Tunnels · B一层' },
      { minX: -46, maxX: -37, minZ: -19, maxZ: -10, name: 'B Car · B车死点' },
      { minX: -46, maxX: -30, minZ: -41, maxZ: -32, name: 'Back Plat · B后平台' },
      { minX: -46, maxX: -20, minZ: -41, maxZ: -10, name: 'Bombsite B · B包点' }
    ];
  }

  getCallout(pos) {
    for (let i = 0; i < this.calloutZones.length; i++) {
      const z = this.calloutZones[i];
      if (pos.x >= z.minX && pos.x <= z.maxX && pos.z >= z.minZ && pos.z <= z.maxZ) {
        return z.name;
      }
    }
    return 'Dust II';
  }

  _buildNavGraph() {
    const nodes = {
      t_spawn:      { x: 0.0,   y: 1.6,  z: 40.5, links: ['t_east', 't_west', 'top_mid'] },
      t_east:       { x: 21.0,  y: 1.2,  z: 39.0, links: ['t_spawn', 'out_long'] },
      t_west:       { x: -27.5, y: 1.4,  z: 38.5, links: ['t_spawn', 'out_tunnels'] },
      out_long:     { x: 28.5,  y: 0.0,  z: 32.0, links: ['t_east', 'long_house', 't_ramp'] },
      t_ramp:       { x: 11.5,  y: 0.2,  z: 26.5, links: ['out_long', 'top_mid'] },
      long_house:   { x: 29.5,  y: 0.0,  z: 22.0, links: ['out_long', 'long_doors'] },
      long_doors:   { x: 32.8,  y: 0.0,  z: 13.0, links: ['long_house', 'pit', 'long_a'] },
      pit:          { x: 40.5,  y: -1.4, z: 26.5, links: ['long_doors', 'long_a'] },
      long_a:       { x: 39.0,  y: 0.0,  z: -2.0, links: ['long_doors', 'pit', 'a_cross'] },
      a_cross:      { x: 35.0,  y: 0.0,  z: -20.5, links: ['long_a', 'a_ramp', 'ct_ramp'] },
      a_ramp:       { x: 41.0,  y: 1.4,  z: -23.5, links: ['a_cross', 'a_site'] },
      a_site:       { x: 30.2,  y: 2.0,  z: -31.0, links: ['a_ramp', 'goose', 'short_stairs'] },
      goose:        { x: 40.0,  y: 2.0,  z: -39.0, links: ['a_site'] },

      top_mid:      { x: 1.5,   y: 0.3,  z: 24.0, links: ['t_spawn', 't_ramp', 'cat_entry', 'mid'] },
      cat_entry:    { x: 8.2,   y: 1.3,  z: 14.0, links: ['top_mid', 'catwalk'] },
      catwalk:      { x: 8.2,   y: 1.3,  z: -5.0, links: ['cat_entry', 'short_corner'] },
      short_corner: { x: 9.5,   y: 1.3,  z: -15.5, links: ['catwalk', 'short_stairs'] },
      short_stairs: { x: 20.5,  y: 2.0,  z: -22.0, links: ['short_corner', 'a_site'] },

      mid:          { x: -1.5,  y: 0.0,  z: 2.0,  links: ['top_mid', 'lower_b', 'mid_doors'] },
      mid_doors:    { x: -1.5,  y: 0.0,  z: -10.0, links: ['mid', 'ct_mid'] },
      ct_mid:       { x: -6.5,  y: 0.0,  z: -21.0, links: ['mid_doors', 'b_doors_out', 'ct_spawn'] },
      ct_spawn:     { x: 14.5,  y: -1.6, z: -26.5, links: ['ct_mid', 'ct_ramp'] },
      ct_ramp:      { x: 23.0,  y: -0.4, z: -22.0, links: ['ct_spawn', 'a_cross'] },

      out_tunnels:  { x: -29.0, y: 0.4,  z: 26.0, links: ['t_west', 'upper_b'] },
      upper_b:      { x: -29.5, y: 0.2,  z: 9.0,  links: ['out_tunnels', 'tunnel_stairs', 'b_tunnels_exit'] },
      tunnel_stairs:{ x: -17.5, y: -0.4, z: 1.0,  links: ['upper_b', 'lower_b'] },
      lower_b:      { x: -9.5,  y: -0.8, z: -2.0, links: ['tunnel_stairs', 'mid'] },
      b_tunnels_exit:{ x: -31.5, y: 0.0, z: -9.5, links: ['upper_b', 'b_site', 'b_car'] },
      b_car:        { x: -38.5, y: 0.0,  z: -15.5, links: ['b_tunnels_exit', 'b_site'] },
      b_site:       { x: -29.5, y: 0.0,  z: -25.5, links: ['b_tunnels_exit', 'b_car', 'b_back', 'b_doors_in'] },
      b_back:       { x: -36.5, y: 0.85, z: -35.5, links: ['b_site'] },
      b_doors_in:   { x: -22.5, y: 0.0,  z: -18.0, links: ['b_site', 'b_doors_out'] },
      b_doors_out:  { x: -16.5, y: 0.0,  z: -18.0, links: ['b_doors_in', 'ct_mid'] }
    };
    this.waypoints = nodes;
  }

  getNearestWaypoint(pos) {
    let bestId = 'mid';
    let bestDist = Infinity;
    for (const [id, n] of Object.entries(this.waypoints)) {
      const d = (pos.x - n.x) ** 2 + (pos.z - n.z) ** 2 + ((pos.y - n.y) * 2.5) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    return bestId;
  }

  // Dijkstra shortest path between two waypoint IDs
  findPath(startId, goalId) {
    if (!this.waypoints[startId] || !this.waypoints[goalId]) return [];
    if (startId === goalId) return [this.waypoints[goalId]];

    const dist = {};
    const prev = {};
    const visited = new Set();
    const queue = Object.keys(this.waypoints);
    for (const k of queue) dist[k] = Infinity;
    dist[startId] = 0;

    while (queue.length > 0) {
      queue.sort((a, b) => dist[a] - dist[b]);
      const u = queue.shift();
      if (u === goalId || dist[u] === Infinity) break;
      visited.add(u);

      const nodeU = this.waypoints[u];
      for (const v of nodeU.links) {
        if (visited.has(v)) continue;
        const nodeV = this.waypoints[v];
        const edgeCost = Math.hypot(nodeU.x - nodeV.x, nodeU.z - nodeV.z);
        const alt = dist[u] + edgeCost;
        if (alt < dist[v]) {
          dist[v] = alt;
          prev[v] = u;
        }
      }
    }

    const path = [];
    let cur = goalId;
    while (cur && this.waypoints[cur]) {
      path.unshift(this.waypoints[cur]);
      if (cur === startId) break;
      cur = prev[cur];
    }
    return path;
  }
}
