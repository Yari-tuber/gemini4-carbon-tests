// Fast deterministic seeded 2D & 3D Simplex/Perlin noise + FBM utilities for Voxel World Generation

export class SeededNoise {
  constructor(seed = 20261109) {
    this.p = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;

    let s = seed >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255];
      this.permMod12[i] = this.p[i] % 12;
    }
  }

  // 2D Simplex Noise in range [-1, 1]
  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const grad3 = [
      1, 1, -1, 1, 1, -1, -1, -1,
      1, 0, -1, 0, 1, 0, -1, 0,
      0, 1, 0, -1, 0, 1, 0, -1
    ];

    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.p[jj]] * 2;
    const gi1 = this.permMod12[ii + i1 + this.p[jj + j1]] * 2;
    const gi2 = this.permMod12[ii + 1 + this.p[jj + 1]] * 2;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  // Fractal Brownian Motion 2D
  fbm2D(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  // Ridged Multifractal 2D for scenic coastal mountain ridges and cliffs
  ridged2D(x, y, octaves = 4, lacunarity = 2.1, gain = 0.5) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let weight = 1.0;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      let v = 1.0 - Math.abs(this.noise2D(x * frequency + i * 17.3, y * frequency - i * 11.7));
      v = v * v * weight;
      weight = Math.max(0.0, Math.min(1.0, v * 1.8));
      total += v * amplitude;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  // Fast 2D hash in [0, 1)
  hash2D(x, z) {
    let n = Math.imul(x, 374761393) + Math.imul(z, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
}
