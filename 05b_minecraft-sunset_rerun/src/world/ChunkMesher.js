import * as THREE from 'three';
import { WORLD_CONFIG } from '../config.js';
import { BLOCK, BLOCK_DEFS } from './BlockRegistry.js';

const { CHUNK_SIZE, CHUNK_HEIGHT, WATER_SURFACE_Y, SEA_LEVEL } = WORLD_CONFIG;

const FACES = [
  { // +Y Top
    name: 'top', dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [0, 0], ao: [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]] },
      { pos: [1, 1, 1], uv: [1, 0], ao: [[1, 1, 0], [0, 1, 1], [1, 1, 1]] },
      { pos: [1, 1, 0], uv: [1, 1], ao: [[1, 1, 0], [0, 1, -1], [1, 1, -1]] },
      { pos: [0, 1, 0], uv: [0, 1], ao: [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]] },
    ],
  },
  { // -Y Bottom
    name: 'bottom', dir: [0, -1, 0],
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], ao: [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]] },
      { pos: [1, 0, 0], uv: [1, 0], ao: [[1, -1, 0], [0, -1, -1], [1, -1, -1]] },
      { pos: [1, 0, 1], uv: [1, 1], ao: [[1, -1, 0], [0, -1, 1], [1, -1, 1]] },
      { pos: [0, 0, 1], uv: [0, 1], ao: [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]] },
    ],
  },
  { // +Z South
    name: 'side', dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0], ao: [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]] },
      { pos: [1, 0, 1], uv: [1, 0], ao: [[1, 0, 1], [0, -1, 1], [1, -1, 1]] },
      { pos: [1, 1, 1], uv: [1, 1], ao: [[1, 0, 1], [0, 1, 1], [1, 1, 1]] },
      { pos: [0, 1, 1], uv: [0, 1], ao: [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]] },
    ],
  },
  { // -Z North
    name: 'side', dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0], ao: [[1, 0, -1], [0, -1, -1], [1, -1, -1]] },
      { pos: [0, 0, 0], uv: [1, 0], ao: [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]] },
      { pos: [0, 1, 0], uv: [1, 1], ao: [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]] },
      { pos: [1, 1, 0], uv: [0, 1], ao: [[1, 0, -1], [0, 1, -1], [1, 1, -1]] },
    ],
  },
  { // +X East
    name: 'side', dir: [1, 0, 0],
    corners: [
      { pos: [1, 0, 1], uv: [0, 0], ao: [[1, 0, 1], [1, -1, 0], [1, -1, 1]] },
      { pos: [1, 0, 0], uv: [1, 0], ao: [[1, 0, -1], [1, -1, 0], [1, -1, -1]] },
      { pos: [1, 1, 0], uv: [1, 1], ao: [[1, 0, -1], [1, 1, 0], [1, 1, -1]] },
      { pos: [1, 1, 1], uv: [0, 1], ao: [[1, 0, 1], [1, 1, 0], [1, 1, 1]] },
    ],
  },
  { // -X West
    name: 'side', dir: [-1, 0, 0],
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], ao: [[-1, 0, -1], [-1, -1, 0], [-1, -1, -1]] },
      { pos: [0, 0, 1], uv: [1, 0], ao: [[-1, 0, 1], [-1, -1, 0], [-1, -1, 1]] },
      { pos: [0, 1, 1], uv: [1, 1], ao: [[-1, 0, 1], [-1, 1, 0], [-1, 1, 1]] },
      { pos: [0, 1, 0], uv: [0, 1], ao: [[-1, 0, -1], [-1, 1, 0], [-1, 1, -1]] },
    ],
  },
];

const AO_CURVE = [0.34, 0.56, 0.78, 1.0];

function isAoOccluder(id) {
  if (id === BLOCK.AIR || id === BLOCK.WATER) return false;
  const def = BLOCK_DEFS[id];
  if (!def || def.crossQuad || id === BLOCK.GLASS) return false;
  return true;
}

export function buildChunkMeshes(cx, cz, getWorldBlock, getLocalBlockLight, atlas) {
  const wxBase = cx * CHUNK_SIZE;
  const wzBase = cz * CHUNK_SIZE;

  const pos = [];
  const norm = [];
  const uv = [];
  const ao = [];
  const blight = [];
  const matProps = [];
  const indices = [];
  let vertCount = 0;

  // Water mesh arrays
  const wPos = [];
  const wInfo = []; // [depth, shoreFoam]
  const wIndices = [];
  let wVertCount = 0;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = wzBase + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = wxBase + lx;
        const id = getWorldBlock(wx, y, wz);
        if (id === BLOCK.AIR) continue;

        // Water surface meshing
        if (id === BLOCK.WATER) {
          const above = getWorldBlock(wx, y + 1, wz);
          if (above !== BLOCK.WATER) {
            const topY = (y === SEA_LEVEL) ? (WATER_SURFACE_Y) : (y + 0.88);
            // Measure water column depth beneath this surface cell (up to 10 blocks)
            let depth = 1;
            for (let dy = 1; dy <= 10; dy++) {
              if (getWorldBlock(wx, y - dy, wz) === BLOCK.WATER) depth++;
              else break;
            }

            // Compute corner shore proximity for soft lapping surf foam
            const cornerShore = (dx, dz) => {
              const n1 = getWorldBlock(wx + dx, y, wz);
              const n2 = getWorldBlock(wx, y, wz + dz);
              const n3 = getWorldBlock(wx + dx, y, wz + dz);
              const s1 = n1 !== BLOCK.WATER && n1 !== BLOCK.AIR ? 1 : 0;
              const s2 = n2 !== BLOCK.WATER && n2 !== BLOCK.AIR ? 1 : 0;
              const s3 = n3 !== BLOCK.WATER && n3 !== BLOCK.AIR ? 1 : 0;
              return Math.min(1.0, (s1 + s2 + s3 * 0.7) * 0.55);
            };

            const c0 = cornerShore(-1, 1);
            const c1 = cornerShore(1, 1);
            const c2 = cornerShore(1, -1);
            const c3 = cornerShore(-1, -1);

            wPos.push(
              lx, topY, lz + 1,
              lx + 1, topY, lz + 1,
              lx + 1, topY, lz,
              lx, topY, lz
            );
            wInfo.push(
              depth, c0,
              depth, c1,
              depth, c2,
              depth, c3
            );
            wIndices.push(
              wVertCount, wVertCount + 1, wVertCount + 2,
              wVertCount, wVertCount + 2, wVertCount + 3
            );
            wVertCount += 4;
          }
          continue;
        }

        const def = BLOCK_DEFS[id];
        if (!def) continue;

        // Cross-quad flora (Tall Grass & Sunset Wildflowers)
        if (def.crossQuad) {
          const tileId = atlas.getBlockFaceTile(id, 'all');
          const [u0, v0, u1, v1] = atlas.getTileUV(tileId);
          const jx = (((wx * 73856093) ^ (wz * 19349663)) & 7) / 28.0 - 0.125;
          const jz = (((wx * 83492791) ^ (wz * 2971215073)) & 7) / 28.0 - 0.125;
          const x0 = lx + 0.12 + jx, x1 = lx + 0.88 + jx;
          const z0 = lz + 0.12 + jz, z1 = lz + 0.88 + jz;
          const y0 = y, y1 = y + 0.92;
          const flLight = getLocalBlockLight(wx, y, wz);
          const wind = def.wind || 1.0;
          const sss = def.sss || 1.0;

          const addPlantQuad = (ax, az, bx, bz, nx, nz) => {
            pos.push(
              ax, y0, az,
              bx, y0, bz,
              bx, y1, bz,
              ax, y1, az
            );
            norm.push(
              nx, 0.78, nz,
              nx, 0.78, nz,
              nx, 0.78, nz,
              nx, 0.78, nz
            );
            uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
            ao.push(0.76, 0.76, 1.0, 1.0);
            blight.push(flLight, flLight, flLight, flLight);
            // Bottom vertices stay anchored (wind = 0), top vertices sway!
            matProps.push(0, sss, 0, sss, wind, sss, wind, sss);
            indices.push(vertCount, vertCount + 1, vertCount + 2, vertCount, vertCount + 2, vertCount + 3);
            vertCount += 4;
          };

          // Diagonal 1 (both sides)
          addPlantQuad(x0, z0, x1, z1, -0.44, 0.44);
          addPlantQuad(x1, z1, x0, z0, 0.44, -0.44);
          // Diagonal 2 (both sides)
          addPlantQuad(x0, z1, x1, z0, 0.44, 0.44);
          addPlantQuad(x1, z0, x0, z1, -0.44, -0.44);
          continue;
        }

        // Standard solid / cutout block faces
        const wind = def.wind || 0.0;
        const sss = def.sss || 0.0;
        const selfEmissive = def.emissive || 0.0;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [dx, dy, dz] = face.dir;
          const nx = wx + dx, ny = y + dy, nz = wz + dz;
          const neighborId = getWorldBlock(nx, ny, nz);

          if (neighborId !== BLOCK.AIR && neighborId !== BLOCK.WATER) {
            const nDef = BLOCK_DEFS[neighborId];
            if (nDef) {
              if (nDef.opaque) continue;
              // Cull internal glass-to-glass faces, keep leaf-to-leaf silhouette richness on outer shell
              if (id === BLOCK.GLASS && neighborId === BLOCK.GLASS) continue;
              if (def.foliage && nDef.foliage && id === neighborId) {
                // Cull interior leaf faces when surrounded to boost FPS while keeping fluffy canopy!
                continue;
              }
            }
          }

          const tileId = atlas.getBlockFaceTile(id, face.name);
          const [u0, v0, u1, v1] = atlas.getTileUV(tileId);
          const neighborLight = selfEmissive > 0 ? 1.35 : getLocalBlockLight(nx, ny, nz);

          const cAo = [1, 1, 1, 1];
          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            pos.push(lx + corner.pos[0], y + corner.pos[1], lz + corner.pos[2]);
            norm.push(dx, dy, dz);
            uv.push(corner.uv[0] ? u1 : u0, corner.uv[1] ? v1 : v0);

            if (selfEmissive > 0) {
              cAo[c] = 1.0;
            } else {
              const s1 = isAoOccluder(getWorldBlock(wx + corner.ao[0][0], y + corner.ao[0][1], wz + corner.ao[0][2])) ? 1 : 0;
              const s2 = isAoOccluder(getWorldBlock(wx + corner.ao[1][0], y + corner.ao[1][1], wz + corner.ao[1][2])) ? 1 : 0;
              const sc = isAoOccluder(getWorldBlock(wx + corner.ao[2][0], y + corner.ao[2][1], wz + corner.ao[2][2])) ? 1 : 0;
              const aoLevel = (s1 && s2) ? 0 : (3 - (s1 + s2 + sc));
              // Foliage gets softer AO so tree crowns feel airy & sunlit
              cAo[c] = def.foliage ? (0.58 + AO_CURVE[aoLevel] * 0.42) : AO_CURVE[aoLevel];
            }
            ao.push(cAo[c]);
            blight.push(neighborLight);
            matProps.push(wind, sss);
          }

          // Flip quad diagonal when needed to avoid anisotropic AO interpolation artifacts
          if (cAo[0] + cAo[2] > cAo[1] + cAo[3]) {
            indices.push(
              vertCount, vertCount + 1, vertCount + 2,
              vertCount, vertCount + 2, vertCount + 3
            );
          } else {
            indices.push(
              vertCount + 1, vertCount + 2, vertCount + 3,
              vertCount + 1, vertCount + 3, vertCount
            );
          }
          vertCount += 4;
        }
      }
    }
  }

  let solidGeo = null;
  if (vertCount > 0) {
    solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    solidGeo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    solidGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    solidGeo.setAttribute('aAo', new THREE.Float32BufferAttribute(ao, 1));
    solidGeo.setAttribute('aBlockLight', new THREE.Float32BufferAttribute(blight, 1));
    solidGeo.setAttribute('aMatProps', new THREE.Float32BufferAttribute(matProps, 2));
    solidGeo.setIndex(indices);
    solidGeo.computeBoundingSphere();
  }

  let waterGeo = null;
  if (wVertCount > 0) {
    waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
    waterGeo.setAttribute('aWaterInfo', new THREE.Float32BufferAttribute(wInfo, 2));
    waterGeo.setIndex(wIndices);
    waterGeo.computeBoundingSphere();
  }

  return { solidGeo, waterGeo };
}
