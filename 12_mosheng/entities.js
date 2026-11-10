/**
 * 墨生 · 字即世界 — Living Ink Entities, Weather Physics & Mutual Ecosystem
 */
(function (global) {
  "use strict";

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // Classical vertical verses matched 1:1 to video frames (poems_all.jpg) + remaining dock chars
  const CHAR_POEMS = {
    "山": "空山新雨后",
    "月": "海上生明月",
    "竹": "独坐幽篁里",
    "梅": "凌寒独自开",
    "鱼": "鱼戏莲叶间",
    "鸟": "月出惊山鸟",
    "蝶": "庄生晓梦迷蝴蝶",
    "龙": "飞龙在天",
    "风": "长风破浪会有时",
    "雨": "山色空蒙雨亦奇",
    "雪": "千山鸟飞绝",
    "火": "野火烧不尽",
    "水": "行到水穷处",
    "雷": "于无声处听惊雷",
    "夜": "轻罗小扇扑流萤",
    "昼": "天光云影共徘徊",
    "空": "本来无一物"
  };

  // Synonym mapping so ANY poetic character typed by the user comes alive
  const CHAR_SYNONYMS = {
    "峰": "山", "岳": "山", "岭": "山", "岩": "山", "石": "山",
    "蟾": "月", "魄": "月",
    "篁": "竹", "林": "竹", "松": "竹", "树": "竹", "柳": "竹",
    "花": "梅", "桃": "梅", "樱": "梅", "兰": "梅", "红": "梅",
    "鲤": "鱼", "鲲": "鱼", "虾": "鱼",
    "雁": "鸟", "鹤": "鸟", "燕": "鸟", "鸥": "鸟", "鸦": "鸟", "鹰": "鸟",
    "蛾": "蝶", "蜂": "蝶",
    "蛟": "龙", "螭": "龙",
    "飙": "风", "岚": "风", "云": "风", "雾": "风",
    "霖": "雨", "露": "雨",
    "冰": "雪", "霜": "雪",
    "炎": "火", "焰": "火", "灯": "火", "烛": "火",
    "江": "水", "河": "水", "海": "水", "湖": "水", "泉": "水", "浪": "水", "溪": "水",
    "电": "雷", "霆": "雷", "震": "雷",
    "暝": "夜", "星": "夜", "萤": "夜", "暮": "夜",
    "日": "昼", "阳": "昼", "晴": "昼", "晨": "昼", "春": "昼",
    "无": "空", "净": "空"
  };

  class InkWorld {
    constructor(canvas, fluidEngine, audioEngine, onPoemChange) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.fluid = fluidEngine;
      this.audio = audioEngine;
      this.onPoemChange = onPoemChange;

      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.time = 0;
      this.nightMix = 0;
      this.targetNight = 0;

      // Living world collections
      this.glyphGhosts = [];
      this.mountains = [];
      this.moons = [];
      this.bamboos = [];
      this.plums = [];
      this.petals = [];
      this.fishes = [];
      this.birds = [];
      this.butterflies = [];
      this.dragons = [];
      this.fires = [];
      this.embers = [];
      this.waters = [];
      this.ripples = [];
      this.lightnings = [];
      this.windStreaks = [];
      this.raindrops = [];
      this.snowflakes = [];
      this.fireflies = [];

      // Weather state
      this.windStrength = 0;
      this.windTarget = 0;
      this.windTimer = 0;
      this.rainIntensity = 0;
      this.rainTimer = 0;
      this.snowIntensity = 0;
      this.snowTimer = 0;
      this.snowAccumulation = 0;

      this.cursor = { x: this.width * 0.5, y: this.height * 0.5, active: false };
      this.clearing = false;
      this.clearFade = 1.0;

      this.resize();
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    }

    setCursor(x, y) {
      this.cursor.x = x;
      this.cursor.y = y;
      this.cursor.active = true;
    }

    /**
     * Opening ceremony matching 00:00 - 00:03 of original video:
     * "墨" lands -> liquefies into left vortex while "生" lands -> dissolves into right vortex
     */
    playIntro() {
      const cx = this.width * 0.5;
      const cy = this.height * 0.46;
      const offset = Math.min(122, this.width * 0.072);

      setTimeout(() => {
        this._spawnGlyphGhost("墨", cx - offset, cy, 136, 0.95);
        this.fluid.stampGlyph("墨", (cx - offset) / this.width, cy / this.height, {
          size: 0.165,
          pigment: [1.75, 0, 0, 0],
          swirlDelay: 0.36,
          swirlDuration: 0.92,
          swirlPower: 1.05,
          vortexRadius: 0.068,
          inPlaceSpiral: true,
          chirality: -1
        });
      }, 120);

      setTimeout(() => {
        this._spawnGlyphGhost("生", cx + offset, cy, 136, 0.95);
        this.fluid.stampGlyph("生", (cx + offset) / this.width, cy / this.height, {
          size: 0.165,
          pigment: [1.75, 0, 0, 0],
          swirlDelay: 0.32,
          swirlDuration: 0.92,
          swirlPower: 1.05,
          vortexRadius: 0.068,
          inPlaceSpiral: true,
          chirality: 1
        });
      }, 820);
    }

    _spawnGlyphGhost(char, x, y, size = 104, duration = 0.95, colorType = "ink") {
      this.glyphGhosts.push({
        char,
        x,
        y,
        size,
        age: 0,
        duration,
        colorType
      });
    }

    /**
     * Spawn any character at (x, y) — "字落成灵"
     */
    spawnCharacter(rawChar, x, y) {
      if (!rawChar || !rawChar.trim()) return;
      const char = rawChar.trim()[0];
      const mapped = CHAR_POEMS[char] ? char : (CHAR_SYNONYMS[char] || null);
      const normX = clamp(x / Math.max(1, this.width), 0.04, 0.96);
      const normY = clamp(y / Math.max(1, this.height), 0.05, 0.92);
      const px = normX * this.width;
      const py = normY * this.height;

      if (this.clearing) {
        this.clearing = false;
        this.clearFade = 1.0;
      }

      // Choose glyph ink pigment based on character semantics
      let glyphPigment = [1.45, 0.0, 0.0, 0.0];
      let ghostColor = "ink";
      if (mapped === "梅" || mapped === "蝶" || mapped === "火") {
        glyphPigment = [0.25, 1.45, 0.0, 0.0];
        ghostColor = "cinnabar";
      } else if (mapped === "水" || mapped === "雨") {
        glyphPigment = [0.55, 0.0, 0.95, 0.15];
      } else if (mapped === "雷" || mapped === "雪" || mapped === "月") {
        glyphPigment = this.nightMix > 0.5 ? [0.4, 0.0, 0.0, 1.25] : [1.25, 0.0, 0.0, 0.35];
      }

      // Stamp calligraphic glyph into fluid field + transient readable stroke ghost
      if (mapped !== "空") {
        this._spawnGlyphGhost(char, px, py, 98, 0.88, ghostColor);
        this.fluid.stampGlyph(char, normX, normY, {
          size: 0.135,
          pigment: glyphPigment,
          swirlDelay: 0.22,
          swirlPower: mapped === "风" || mapped === "龙" ? 1.35 : 0.95
        });
      }

      // Update right-margin vertical classical verse
      const poem = CHAR_POEMS[mapped || char];
      if (poem && this.onPoemChange) {
        this.onPoemChange(poem);
      }

      // Trigger WebAudio Guqin & nature sound
      if (this.audio) {
        this.audio.playCharSound(mapped || char, normX);
      }

      // Instantiate living entity / weather
      switch (mapped) {
        case "山":
          this._addMountain(px, py);
          break;
        case "月":
          this._addMoon(px, py);
          break;
        case "竹":
          this._addBamboo(px, py);
          break;
        case "梅":
          this._addPlum(px, py);
          break;
        case "鱼":
          this._addFishGroup(px, py, 3);
          break;
        case "鸟":
          this._addBirdFlock(px, py, 6);
          break;
        case "蝶":
          this._addButterflies(px, py, 3);
          break;
        case "龙":
          this._addDragon(px, py);
          break;
        case "风":
          this._triggerWind(px, py);
          break;
        case "雨":
          this._triggerRain(px, py);
          break;
        case "雪":
          this._triggerSnow(px, py);
          break;
        case "火":
          this._addFire(px, py);
          break;
        case "水":
          this._addWater(px, py);
          break;
        case "雷":
          this._triggerThunder(px, py);
          break;
        case "夜":
          this.setNight(true);
          break;
        case "昼":
          this.setNight(false);
          if (char === "春") {
            this._addButterflies(px, py, 2);
          }
          break;
        case "空":
          this.clearAll();
          break;
        default:
          // Any other Chinese character still blooms into living ink + spawns a spirit butterfly/ripple
          this.ripples.push({ x: px, y: py, r: 8, maxR: 110, alpha: 0.45 });
          break;
      }
    }

    setNight(isNight) {
      this.targetNight = isNight ? 1.0 : 0.0;
      document.body.classList.toggle("is-night", isNight);
      if (isNight && this.fireflies.length < 22) {
        for (let i = this.fireflies.length; i < 26; i++) {
          this.fireflies.push({
            x: rand(40, this.width - 40),
            y: rand(60, this.height - 90),
            vx: rand(-18, 18),
            vy: rand(-12, 12),
            phase: rand(0, TAU),
            size: rand(2.2, 4.2)
          });
        }
      }
    }

    clearAll() {
      this.clearing = true;
      this.windTarget = 0;
      this.rainTimer = 0;
      this.snowTimer = 0;
      this.fluid.washClear();
    }

    // -------------------------------------------------------------------------
    // Entity Constructors
    // -------------------------------------------------------------------------

    _addMountain(x, y) {
      const w = rand(360, 580);
      const h = rand(125, 215);
      const baseY = clamp(y + h * 0.48, this.height * 0.36, this.height * 0.86);
      const peakCount = 3 + Math.floor(Math.random() * 3);
      const peaks = [];
      for (let i = 0; i < peakCount; i++) {
        const frac = (i + 0.5) / peakCount + rand(-0.08, 0.08);
        const centerBias = 1.0 - Math.abs(frac - 0.5) * 1.15;
        peaks.push({
          t: clamp(frac, 0.12, 0.88),
          h: h * clamp(centerBias * rand(0.75, 1.18), 0.38, 1.08)
        });
      }
      // Generate vertical 披麻皴 texture ticks near peaks
      const strokes = [];
      for (const pk of peaks) {
        const count = 4 + Math.floor(Math.random() * 4);
        for (let k = 0; k < count; k++) {
          strokes.push({
            dt: rand(-0.07, 0.07),
            len: rand(18, 48),
            lean: rand(-6, 6),
            alpha: rand(0.16, 0.34),
            peakT: pk.t,
            peakH: pk.h
          });
        }
      }

      this.mountains.push({
        x,
        baseY,
        w,
        h,
        peaks,
        strokes,
        depth: rand(0.35, 0.95),
        grow: 0,
        snowFrost: 0
      });
      // Sort distant lighter mountains behind foreground darker ones
      this.mountains.sort((a, b) => a.depth - b.depth);
      if (this.mountains.length > 9) this.mountains.shift();
    }

    _addMoon(x, y) {
      const my = clamp(y, 85, this.height * 0.48);
      const mx = clamp(x, 90, this.width - 90);
      // Keep one primary moon (or gently relocate/rebirth) just like original painting
      this.moons = [{
        x: mx,
        y: my,
        r: rand(50, 58),
        grow: 0,
        phase: rand(0, TAU)
      }];
    }

    _addBamboo(x, y) {
      const baseX = clamp(x, 45, this.width - 45);
      const stalkCount = 3 + Math.floor(Math.random() * 2);
      const stalks = [];

      for (let s = 0; s < stalkCount; s++) {
        const sx = baseX + (s - (stalkCount - 1) * 0.5) * rand(16, 28);
        const targetTopY = clamp(y + rand(-65, 85), this.height * 0.18, this.height * 0.70);
        const totalH = this.height + 12 - targetTopY;
        const segCount = Math.max(5, Math.floor(totalH / rand(58, 76)));
        const segLen = totalH / segCount;
        const baseWidth = rand(5.2, 8.6) * (s === 1 ? 1.18 : 0.90);
        const lean = rand(-0.06, 0.06);
        const leaves = [];

        for (let i = 2; i <= segCount; i++) {
          if (Math.random() < 0.88 || i === segCount) {
            const side = (i % 2 === 0 ? 1 : -1) * (Math.random() < 0.2 ? -1 : 1);
            const twigAngle = -Math.PI * 0.5 + side * rand(0.45, 0.95);
            const twigLen = rand(24, 52);
            const leafCount = 4 + Math.floor(Math.random() * 4);
            const cluster = [];
            for (let l = 0; l < leafCount; l++) {
              cluster.push({
                angle: twigAngle + rand(-0.55, 0.55) + 0.35 * side,
                len: rand(44, 86),
                width: rand(6.2, 10.2),
                curve: rand(-0.18, 0.18),
                phase: rand(0, TAU)
              });
            }
            leaves.push({ nodeIndex: i, side, twigAngle, twigLen, cluster });
          }
        }

        stalks.push({
          x: sx,
          segCount,
          segLen,
          baseWidth,
          lean,
          tone: s % 2 === 0 ? 1.0 : 0.68,
          swayPhase: rand(0, TAU),
          leaves
        });
      }

      this.bamboos.push({
        x: baseX,
        stalks,
        grow: 0,
        swayAngle: 0,
        swayVel: 0
      });
      if (this.bamboos.length > 5) this.bamboos.shift();
    }

    _addPlum(x, y) {
      const fromRight = x >= this.width * 0.5;
      const rootX = fromRight ? this.width + 12 : -12;
      const rootY = clamp(y + rand(40, 130), this.height * 0.22, this.height * 0.78);
      const dir = fromRight ? -1 : 1;

      // Build gnarled angular 折枝梅 branch tree
      const segments = [];
      const blossoms = [];
      const span = clamp(Math.abs(x - rootX) + rand(50, 120), 240, this.width * 0.44);

      const buildBranch = (bx, by, angle, len, width, depth, startT) => {
        if (depth > 4 || width < 0.9) return;
        const ex = bx + Math.cos(angle) * len;
        const ey = by + Math.sin(angle) * len;
        const endT = Math.min(1.0, startT + 0.22);
        segments.push({ x1: bx, y1: by, x2: ex, y2: ey, w1: width, w2: width * 0.72, t0: startT, t1: endT });

        // Add blossoms on finer twigs
        if (depth >= 1) {
          const bCount = depth >= 2 ? 2 + Math.floor(Math.random() * 3) : 1;
          for (let b = 0; b < bCount; b++) {
            const f = rand(0.25, 1.0);
            const fx = lerp(bx, ex, f) + rand(-8, 8);
            const fy = lerp(by, ey, f) + rand(-8, 8);
            blossoms.push({
              x: fx,
              y: fy,
              r: rand(7.5, 13.0),
              isBud: Math.random() < 0.24,
              rot: rand(0, TAU),
              appearAt: endT + rand(0.02, 0.16),
              shade: rand(0, 1)
            });
          }
        }

        // Main continuation with sharp calligraphic 顿挫 bend
        const bend = (Math.random() < 0.5 ? 1 : -1) * rand(0.18, 0.44);
        buildBranch(ex, ey, angle + bend, len * rand(0.72, 0.86), width * 0.72, depth + 1, endT);

        // Side offshoot twig
        if (depth <= 3 && Math.random() < 0.78) {
          const sideSign = depth % 2 === 0 ? -1 : 1;
          buildBranch(
            lerp(bx, ex, 0.65),
            lerp(by, ey, 0.65),
            angle + sideSign * rand(0.48, 0.88),
            len * rand(0.48, 0.68),
            width * 0.52,
            depth + 2,
            endT
          );
        }
      };

      const initAngle = fromRight ? Math.PI + rand(0.22, 0.42) : -rand(0.22, 0.42);
      buildBranch(rootX, rootY, initAngle, span * 0.34, rand(9.5, 13.0), 0, 0.0);

      // Cinnabar ink splash at target
      this.fluid.splat(x / this.width, y / this.height, dir * 85, -35, [0.05, 1.35, 0, 0], 0.0022);

      this.plums.push({
        rootX,
        rootY,
        dir,
        segments,
        blossoms,
        grow: 0,
        sway: 0
      });
      if (this.plums.length > 4) this.plums.shift();

      // Ecosystem interaction: blooming plum branch naturally attracts a cinnabar butterfly!
      if (this.butterflies.length < 4) {
        setTimeout(() => {
          this._addButterflies(x + dir * 30, y - 20, 1, true);
        }, 900);
      }
    }

    _addFishGroup(x, y, count = 3) {
      for (let i = 0; i < count; i++) {
        const angle = rand(0, TAU);
        const speed = rand(46, 78);
        const spineLen = 8;
        const px = x + rand(-28, 28);
        const py = y + rand(-24, 24);
        const spine = [];
        for (let s = 0; s < spineLen; s++) {
          spine.push({ x: px - Math.cos(angle) * s * 6, y: py - Math.sin(angle) * s * 6 });
        }
        this.fishes.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(13, 19),
          phase: rand(0, TAU),
          swimFreq: rand(5.5, 7.8),
          redCrown: Math.random() < 0.48,
          spine
        });
      }
      if (this.fishes.length > 20) this.fishes.splice(0, this.fishes.length - 20);
    }

    _addBirdFlock(x, y, count = 6) {
      const baseAngle = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      for (let i = 0; i < count; i++) {
        const a = baseAngle + rand(-0.5, 0.5);
        const sp = rand(75, 125);
        this.birds.push({
          x: x + rand(-34, 34),
          y: y + rand(-28, 28),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          size: rand(11, 17),
          flapPhase: rand(0, TAU),
          flapSpeed: rand(6.8, 9.6),
          glideTimer: rand(0, 4)
        });
      }
      if (this.birds.length > 28) this.birds.splice(0, this.birds.length - 28);
    }

    _addButterflies(x, y, count = 2, silent = false) {
      for (let i = 0; i < count; i++) {
        const a = rand(0, TAU);
        this.butterflies.push({
          x: x + rand(-22, 22),
          y: y + rand(-22, 22),
          vx: Math.cos(a) * rand(35, 65),
          vy: Math.sin(a) * rand(35, 65),
          size: rand(8.5, 12.5),
          phase: rand(0, TAU),
          isCinnabar: i % 2 === 0 || Math.random() < 0.78,
          wanderAngle: a
        });
      }
      if (this.butterflies.length > 14) this.butterflies.splice(0, this.butterflies.length - 14);
    }

    _addDragon(x, y) {
      const numJoints = 42;
      const segSpacing = 14.5;
      const angle = rand(-Math.PI * 0.75, -Math.PI * 0.25);
      const joints = [];
      for (let i = 0; i < numJoints; i++) {
        joints.push({
          x: x - Math.cos(angle) * i * segSpacing * 0.4,
          y: y - Math.sin(angle) * i * segSpacing * 0.4,
          angle
        });
      }

      // Keep at most 2 dragons so composition stays poetic & 60fps
      if (this.dragons.length >= 2) {
        this.dragons.shift();
      }

      this.dragons.push({
        joints,
        segSpacing,
        headAngle: angle,
        speed: 185,
        phase: 0,
        grow: 0,
        whiskerL: { x, y },
        whiskerR: { x, y },
        roarGlow: 0,
        wanderTarget: { x: this.width * 0.5, y: this.height * 0.35, timer: 1.5 }
      });

      // Dramatic ink smoke eruption for dragon emergence (matches f_034 -> f_035)
      for (let k = 0; k < 4; k++) {
        const th = (k / 4) * TAU;
        this.fluid.splat(
          (x + Math.cos(th) * 24) / this.width,
          (y + Math.sin(th) * 24) / this.height,
          Math.cos(th) * 180,
          Math.sin(th) * 180,
          [1.2, 0.12, 0.18, 0.0],
          0.0024
        );
      }
    }

    _triggerWind(x, y) {
      const dir = x < this.width * 0.5 ? 1 : (x > this.width * 0.72 ? -1 : 1);
      this.windTarget = dir * 1.0;
      this.windTimer = 9.5;

      // Spawn sweeping calligraphic wind ribbons across canvas
      for (let i = 0; i < 16; i++) {
        this.windStreaks.push({
          x: dir > 0 ? rand(-240, this.width * 0.6) : rand(this.width * 0.4, this.width + 240),
          y: rand(60, this.height - 90),
          len: rand(140, 340),
          speed: dir * rand(280, 520),
          amp: rand(8, 24),
          phase: rand(0, TAU),
          alpha: rand(0.16, 0.34),
          life: 0,
          maxLife: rand(2.2, 4.4)
        });
      }

      // Sweep fluid ink clouds dramatically across the sky (matches f_033-f_034!)
      for (let band = 0; band < 5; band++) {
        const by = 0.2 + band * 0.14;
        const bx = clamp(x / this.width + rand(-0.18, 0.18), 0.08, 0.92);
        this.fluid.splat(bx, by, dir * 320, rand(-45, 45), [0.55, 0, 0, 0], 0.0038);
      }
    }

    _triggerRain(x, y) {
      this.rainTimer = 14.0;
      this.rainIntensity = 1.0;
    }

    _triggerSnow(x, y) {
      this.snowTimer = 16.0;
      this.snowIntensity = 1.0;
    }

    _addFire(x, y) {
      const fy = clamp(y, this.height * 0.35, this.height * 0.86);
      this.fires.push({
        x,
        y: fy,
        power: 1.0,
        grow: 0,
        phase: rand(0, TAU)
      });
      if (this.fires.length > 4) this.fires.shift();
    }

    _addWater(x, y) {
      const wy = clamp(y, this.height * 0.45, this.height * 0.88);
      this.waters.push({
        x,
        y: wy,
        w: rand(260, 440),
        grow: 0,
        phase: rand(0, TAU)
      });
      if (this.waters.length > 4) this.waters.shift();

      for (let i = 0; i < 3; i++) {
        this.ripples.push({ x, y: wy, r: 6 + i * 16, maxR: 130 + i * 35, alpha: 0.5 - i * 0.1 });
      }
      this.fluid.splashWater(x / this.width, wy / this.height, 0, 0, 0.0035, 0.65);

      // Mutual interaction: Water douses nearby Fire into rising white steam!
      for (let i = this.fires.length - 1; i >= 0; i--) {
        const f = this.fires[i];
        if (Math.hypot(f.x - x, f.y - wy) < 150) {
          this.fluid.splat(f.x / this.width, f.y / this.height, 0, -180, [0.2, 0, 0, 1.5], 0.0035);
          f.power -= 0.75;
          if (f.power <= 0.15) this.fires.splice(i, 1);
        }
      }
    }

    _triggerThunder(x, y) {
      // Build jagged forked lightning from top of sky through (x, y) (exact match to f_060.jpg!)
      const startX = clamp(x + rand(-90, 90), 80, this.width - 80);
      const mainPts = [{ x: startX, y: -10 }];
      const steps = 11;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const jitter = i === steps ? 0 : (1 - t * 0.4) * rand(-34, 34);
        mainPts.push({
          x: lerp(startX, x, t) + jitter,
          y: lerp(-10, y + 40, t)
        });
      }

      const branches = [];
      for (let b = 0; b < 3; b++) {
        const pivot = mainPts[3 + b * 2];
        if (!pivot) continue;
        const sub = [{ x: pivot.x, y: pivot.y }];
        let bx = pivot.x;
        let by = pivot.y;
        const dir = b % 2 === 0 ? 1 : -1;
        for (let s = 0; s < 4; s++) {
          bx += dir * rand(14, 34);
          by += rand(18, 36);
          sub.push({ x: bx, y: by });
        }
        branches.push(sub);
      }

      this.lightnings.push({
        mainPts,
        branches,
        x,
        y,
        age: 0,
        duration: 0.68
      });

      // Sky flash + expanding fluid shockwave ring (matches f_059 -> f_060!)
      this.fluid.flashIntensity = 0.26;
      const nx = x / this.width;
      const ny = y / this.height;
      this.fluid.splatRing(
        nx,
        ny,
        0.052,
        0.014,
        195,
        this.nightMix > 0.4 ? [0.18, 0.0, 0.0, 1.85] : [1.25, 0.0, 0.0, 0.85],
        1.25
      );

      // Mutual ecosystem interaction: startle nearby birds & fish, energize dragon!
      for (const b of this.birds) {
        const dx = b.x - x;
        const dy = b.y - y;
        const d = Math.hypot(dx, dy) + 1;
        if (d < 420) {
          b.vx += (dx / d) * 190;
          b.vy += (dy / d) * 190 - 40;
        }
      }
      for (const f of this.fishes) {
        const dx = f.x - x;
        const dy = f.y - y;
        const d = Math.hypot(dx, dy) + 1;
        if (d < 360) {
          f.vx += (dx / d) * 165;
          f.vy += (dy / d) * 165;
        }
      }
      for (const dr of this.dragons) {
        dr.roarGlow = 1.0;
        dr.wanderTarget = { x, y, timer: 1.8 };
      }
    }

    // -------------------------------------------------------------------------
    // Simulation Step
    // -------------------------------------------------------------------------

    step(dt) {
      const clampedDt = Math.min(dt, 0.033);
      this.time += clampedDt;

      // Smooth Day <-> Night interpolation (completes cleanly to exact 0.0 / 1.0 in ~0.85s)
      if (Math.abs(this.targetNight - this.nightMix) < 0.004) {
        this.nightMix = this.targetNight;
      } else {
        const dirN = Math.sign(this.targetNight - this.nightMix);
        const stepN = Math.abs(this.targetNight - this.nightMix) * clampedDt * 3.8 + clampedDt * 0.55;
        this.nightMix = clamp(this.nightMix + dirN * stepN, 0, 1);
      }
      this.fluid.nightMix = this.nightMix;

      // Clear wash animation ("空")
      if (this.clearing) {
        this.clearFade -= clampedDt * 1.4;
        if (this.clearFade <= 0) {
          this.glyphGhosts = [];
          this.mountains = [];
          this.moons = [];
          this.bamboos = [];
          this.plums = [];
          this.petals = [];
          this.fishes = [];
          this.birds = [];
          this.butterflies = [];
          this.dragons = [];
          this.fires = [];
          this.embers = [];
          this.waters = [];
          this.ripples = [];
          this.lightnings = [];
          this.windStreaks = [];
          this.raindrops = [];
          this.snowflakes = [];
          this.snowAccumulation = 0;
          this.clearing = false;
          this.clearFade = 1.0;
        }
      }

      // Wind decay & continuous fluid coupling
      if (this.windTimer > 0) {
        this.windTimer -= clampedDt;
        if (this.windTimer <= 0) this.windTarget = 0;
      }
      this.windStrength = lerp(this.windStrength, this.windTarget, clampedDt * 1.8);
      if (Math.abs(this.windStrength) > 0.08 && Math.random() < 0.45) {
        this.fluid.splat(
          rand(0.05, 0.95),
          rand(0.15, 0.78),
          this.windStrength * 110,
          rand(-14, 14),
          null,
          0.0042
        );
      }

      // Rain lifecycle
      if (this.rainTimer > 0) {
        this.rainTimer -= clampedDt;
      } else {
        this.rainIntensity = Math.max(0, this.rainIntensity - clampedDt * 0.45);
      }
      if (this.rainIntensity > 0.02) {
        const spawnN = Math.ceil(this.rainIntensity * 6);
        for (let i = 0; i < spawnN; i++) {
          if (this.raindrops.length < 240) {
            this.raindrops.push({
              x: rand(-120, this.width + 120),
              y: rand(-60, -10),
              speed: rand(560, 820),
              len: rand(16, 30),
              alpha: rand(0.16, 0.36)
            });
          }
        }
      }

      // Snow lifecycle
      if (this.snowTimer > 0) {
        this.snowTimer -= clampedDt;
        this.snowAccumulation = Math.min(1.0, this.snowAccumulation + clampedDt * 0.08);
      } else {
        this.snowIntensity = Math.max(0, this.snowIntensity - clampedDt * 0.35);
        this.snowAccumulation = Math.max(0, this.snowAccumulation - clampedDt * 0.02);
      }
      if (this.snowIntensity > 0.02 && this.snowflakes.length < 180) {
        for (let i = 0; i < 3; i++) {
          this.snowflakes.push({
            x: rand(-40, this.width + 40),
            y: rand(-30, -5),
            r: rand(1.8, 4.4),
            vy: rand(38, 78),
            phase: rand(0, TAU)
          });
        }
      }

      // Update Glyph Ghosts
      for (let i = this.glyphGhosts.length - 1; i >= 0; i--) {
        const g = this.glyphGhosts[i];
        g.age += clampedDt;
        if (g.age >= g.duration) this.glyphGhosts.splice(i, 1);
      }

      // Update Mountains, Moons, Waters
      for (const m of this.mountains) {
        m.grow = Math.min(1, m.grow + clampedDt * 1.05);
        m.snowFrost = lerp(m.snowFrost, this.snowAccumulation, clampedDt * 0.5);
      }
      for (const mn of this.moons) {
        mn.grow = Math.min(1, mn.grow + clampedDt * 1.15);
      }
      for (const wt of this.waters) {
        wt.grow = Math.min(1, wt.grow + clampedDt * 1.2);
      }

      // Update Bamboos (spring sway)
      for (const b of this.bamboos) {
        b.grow = Math.min(1, b.grow + clampedDt * 1.15);
        const breeze = Math.sin(this.time * 1.4 + b.x * 0.01) * 0.03 + this.windStrength * 0.24;
        const force = (breeze - b.swayAngle) * 14.0 - b.swayVel * 3.8;
        b.swayVel += force * clampedDt;
        b.swayAngle += b.swayVel * clampedDt;
      }

      // Update Plum branches & falling cinnabar petals
      for (const p of this.plums) {
        p.grow = Math.min(1, p.grow + clampedDt * 0.92);
        p.sway = Math.sin(this.time * 1.6) * 0.012 + this.windStrength * 0.055;
        if (p.grow > 0.8 && (Math.abs(this.windStrength) > 0.25 || Math.random() < 0.012) && p.blossoms.length > 0) {
          if (this.petals.length < 48 && Math.random() < 0.16) {
            const bl = p.blossoms[Math.floor(Math.random() * p.blossoms.length)];
            this.petals.push({
              x: bl.x,
              y: bl.y,
              vx: this.windStrength * 120 + rand(-18, 18),
              vy: rand(22, 48),
              r: rand(3.0, 5.2),
              rot: rand(0, TAU),
              vrot: rand(-3, 3),
              alpha: 0.9
            });
          }
        }
      }

      for (let i = this.petals.length - 1; i >= 0; i--) {
        const pt = this.petals[i];
        pt.vx = lerp(pt.vx, this.windStrength * 145 + Math.sin(this.time * 2.5 + pt.rot) * 28, clampedDt * 2.0);
        pt.x += pt.vx * clampedDt;
        pt.y += pt.vy * clampedDt;
        pt.rot += pt.vrot * clampedDt;
        if (pt.y > this.height - 20) pt.alpha -= clampedDt * 0.8;
        if (pt.alpha <= 0 || pt.x < -80 || pt.x > this.width + 80) {
          this.petals.splice(i, 1);
        }
      }

      // Update Fires & thermal fluid updrafts
      for (let i = this.fires.length - 1; i >= 0; i--) {
        const f = this.fires[i];
        f.grow = Math.min(1, f.grow + clampedDt * 1.8);
        if (this.rainIntensity > 0.3) {
          f.power -= clampedDt * 0.035 * this.rainIntensity;
        }
        if (f.power <= 0.12) {
          this.fires.splice(i, 1);
          continue;
        }
        // Inject rising warm smoke & buoyancy into WebGL Navier-Stokes solver!
        if (Math.random() < 0.65) {
          this.fluid.splat(
            f.x / this.width,
            (f.y - 34) / this.height,
            this.windStrength * 65 + rand(-16, 16),
            -95 * f.power,
            this.nightMix > 0.5 ? [0.18, 0.22, 0.0, 0.14] : [0.32, 0.24, 0.0, 0.0],
            0.0011
          );
        }
        // Spawn glowing sparks
        if (this.embers.length < 70 && Math.random() < 0.48) {
          this.embers.push({
            x: f.x + rand(-14, 14),
            y: f.y - rand(18, 46),
            vx: this.windStrength * 85 + rand(-24, 24),
            vy: -rand(55, 125),
            r: rand(1.4, 3.0),
            life: 0,
            maxLife: rand(0.9, 2.1)
          });
        }
      }

      for (let i = this.embers.length - 1; i >= 0; i--) {
        const em = this.embers[i];
        em.life += clampedDt;
        em.vx += this.windStrength * 40 * clampedDt;
        em.x += em.vx * clampedDt;
        em.y += em.vy * clampedDt;
        if (em.life >= em.maxLife) this.embers.splice(i, 1);
      }

      // Update Fishes (articulated spine + water attraction)
      this._stepFishes(clampedDt);

      // Update Birds (boid flocking + wind)
      this._stepBirds(clampedDt);

      // Update Butterflies (blossom seeking + playful flutter)
      this._stepButterflies(clampedDt);

      // Update Dragons (42-joint spine + intelligent world interaction + fluid wake)
      this._stepDragons(clampedDt);

      // Update Wind Streaks, Raindrops, Snowflakes, Ripples, Lightnings, Fireflies
      for (let i = this.windStreaks.length - 1; i >= 0; i--) {
        const ws = this.windStreaks[i];
        ws.life += clampedDt;
        ws.x += ws.speed * clampedDt;
        if (ws.life >= ws.maxLife) this.windStreaks.splice(i, 1);
      }

      for (let i = this.raindrops.length - 1; i >= 0; i--) {
        const rd = this.raindrops[i];
        rd.x += this.windStrength * 240 * clampedDt;
        rd.y += rd.speed * clampedDt;
        if (rd.y > this.height - rand(15, 110)) {
          if (this.ripples.length < 45 && Math.random() < 0.22) {
            this.ripples.push({ x: rd.x, y: rd.y, r: 2, maxR: rand(18, 38), alpha: 0.26 });
          }
          this.raindrops.splice(i, 1);
        }
      }

      for (let i = this.snowflakes.length - 1; i >= 0; i--) {
        const sn = this.snowflakes[i];
        sn.x += (this.windStrength * 110 + Math.sin(this.time * 1.8 + sn.phase) * 24) * clampedDt;
        sn.y += sn.vy * clampedDt;
        if (sn.y > this.height + 15) this.snowflakes.splice(i, 1);
      }

      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const rp = this.ripples[i];
        rp.r += 42 * clampedDt;
        rp.alpha -= 0.28 * clampedDt;
        if (rp.alpha <= 0 || rp.r >= rp.maxR) this.ripples.splice(i, 1);
      }

      for (let i = this.lightnings.length - 1; i >= 0; i--) {
        this.lightnings[i].age += clampedDt;
        if (this.lightnings[i].age >= this.lightnings[i].duration) {
          this.lightnings.splice(i, 1);
        }
      }

      if (this.nightMix > 0.05) {
        for (const ff of this.fireflies) {
          ff.phase += clampedDt * 2.4;
          ff.vx += rand(-28, 28) * clampedDt + this.windStrength * 18 * clampedDt;
          ff.vy += rand(-22, 22) * clampedDt;
          const sp = Math.hypot(ff.vx, ff.vy);
          if (sp > 36) {
            ff.vx = (ff.vx / sp) * 36;
            ff.vy = (ff.vy / sp) * 36;
          }
          ff.x = (ff.x + ff.vx * clampedDt + this.width) % this.width;
          ff.y = clamp(ff.y + ff.vy * clampedDt, 45, this.height - 65);
        }
      }

      // Sync continuous soundscape
      if (this.audio) {
        const entityCount =
          this.mountains.length +
          this.bamboos.length +
          this.plums.length +
          this.fishes.length +
          this.birds.length +
          this.dragons.length;
        this.audio.updateEnvironment(clampedDt, {
          windStrength: this.windStrength,
          rainIntensity: this.rainIntensity,
          fireCount: this.fires.length,
          entityCount,
          isNight: this.nightMix > 0.5
        });
      }
    }

    _stepFishes(dt) {
      for (const f of this.fishes) {
        f.phase += dt * f.swimFreq;

        // Gentle attraction to nearest water pond if present
        if (this.waters.length > 0) {
          const w = this.waters[0];
          const dx = w.x - f.x;
          const dy = w.y - f.y;
          const d = Math.hypot(dx, dy);
          if (d > 90 && d < 520) {
            f.vx += (dx / d) * 28 * dt;
            f.vy += (dy / d) * 28 * dt;
          }
        }

        // Gentle wandering
        const curAngle = Math.atan2(f.vy, f.vx) + Math.sin(f.phase * 0.35) * 0.8 * dt;
        let speed = Math.hypot(f.vx, f.vy);
        speed = lerp(speed, 58, dt * 1.4);
        f.vx = Math.cos(curAngle) * speed;
        f.vy = Math.sin(curAngle) * speed;

        // Soft margin turn-back
        const pad = 70;
        if (f.x < pad) f.vx += 95 * dt;
        if (f.x > this.width - pad) f.vx -= 95 * dt;
        if (f.y < pad) f.vy += 95 * dt;
        if (f.y > this.height - pad) f.vy -= 95 * dt;

        f.x += f.vx * dt;
        f.y += f.vy * dt;

        // Update undulating spine chain
        const headAng = Math.atan2(f.vy, f.vx);
        f.spine[0].x = f.x;
        f.spine[0].y = f.y;
        const segD = f.size * 0.38;
        for (let i = 1; i < f.spine.length; i++) {
          const prev = f.spine[i - 1];
          const cur = f.spine[i];
          const wag = Math.sin(f.phase - i * 0.65) * (i * 0.065);
          let dx = cur.x - prev.x;
          let dy = cur.y - prev.y;
          let ang = Math.atan2(dy, dx);
          if (!isFinite(ang)) ang = headAng + Math.PI;
          ang += wag * 0.25;
          cur.x = prev.x + Math.cos(ang) * segD;
          cur.y = prev.y + Math.sin(ang) * segD;
        }

        // Subtle fluid wake
        if (Math.random() < 0.08) {
          this.fluid.splat(f.x / this.width, f.y / this.height, f.vx * 0.35, f.vy * 0.35, null, 0.00045);
        }
      }
    }

    _stepBirds(dt) {
      for (const b of this.birds) {
        b.flapPhase += dt * b.flapSpeed;

        // Boid cohesion + separation
        let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0, count = 0;
        for (const other of this.birds) {
          if (other === b) continue;
          const dx = other.x - b.x;
          const dy = other.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < 130) {
            cohX += other.x;
            cohY += other.y;
            aliX += other.vx;
            aliY += other.vy;
            if (d < 42) {
              sepX -= dx / d;
              sepY -= dy / d;
            }
            count++;
          }
        }
        if (count > 0) {
          cohX = cohX / count - b.x;
          cohY = cohY / count - b.y;
          b.vx += (cohX * 0.25 + (aliX / count - b.vx) * 0.6 + sepX * 42) * dt;
          b.vy += (cohY * 0.25 + (aliY / count - b.vy) * 0.6 + sepY * 42) * dt;
        }

        // Wind push
        b.vx += this.windStrength * 55 * dt;

        // Prefer upper-mid sky
        if (b.y > this.height * 0.72) b.vy -= 85 * dt;
        if (b.y < 55) b.vy += 75 * dt;

        const sp = Math.hypot(b.vx, b.vy) || 1;
        const targetSp = clamp(sp, 68, 145);
        b.vx = (b.vx / sp) * targetSp;
        b.vy = (b.vy / sp) * targetSp;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Wrap horizontally, keep vertical soft bounds
        if (b.x < -50) b.x = this.width + 45;
        if (b.x > this.width + 50) b.x = -45;
      }
    }

    _stepButterflies(dt) {
      for (const bf of this.butterflies) {
        bf.phase += dt * 13.5;
        bf.wanderAngle += rand(-4.2, 4.2) * dt;

        let tx = Math.cos(bf.wanderAngle) * 58 + this.windStrength * 65;
        let ty = Math.sin(bf.wanderAngle) * 48 - 6;

        // Seek plum blossoms if available
        if (this.plums.length > 0 && this.plums[0].blossoms.length > 0) {
          const bl = this.plums[0].blossoms[0];
          const dx = bl.x - bf.x;
          const dy = bl.y - bf.y;
          const d = Math.hypot(dx, dy);
          if (d > 140) {
            tx += (dx / d) * 32;
            ty += (dy / d) * 32;
          }
        }

        bf.vx = lerp(bf.vx, tx, dt * 2.6);
        bf.vy = lerp(bf.vy, ty, dt * 2.6);
        bf.x += bf.vx * dt;
        bf.y += bf.vy * dt;

        if (bf.x < 40) bf.vx += 80 * dt;
        if (bf.x > this.width - 40) bf.vx -= 80 * dt;
        if (bf.y < 50) bf.vy += 80 * dt;
        if (bf.y > this.height - 75) bf.vy -= 80 * dt;
      }
    }

    _stepDragons(dt) {
      for (const dr of this.dragons) {
        dr.grow = Math.min(1, dr.grow + dt * 0.95);
        dr.phase += dt * 4.2;
        dr.roarGlow = Math.max(0, dr.roarGlow - dt * 1.2);

        // Choose graceful aerial target: cursor, butterfly, fire, moon, or figure-8 sky cruise
        dr.wanderTarget.timer -= dt;
        if (dr.wanderTarget.timer <= 0) {
          dr.wanderTarget.timer = rand(2.2, 4.2);
          if (this.fires.length > 0 && Math.random() < 0.36) {
            const f = this.fires[0];
            dr.wanderTarget.x = f.x + rand(-110, 110);
            dr.wanderTarget.y = f.y - rand(60, 150);
          } else if (this.butterflies.length > 0 && Math.random() < 0.38) {
            const bf = this.butterflies[0];
            dr.wanderTarget.x = bf.x;
            dr.wanderTarget.y = bf.y;
          } else if (this.moons.length > 0 && Math.random() < 0.35) {
            const mn = this.moons[0];
            dr.wanderTarget.x = mn.x + rand(-90, 90);
            dr.wanderTarget.y = mn.y + rand(-60, 80);
          } else {
            dr.wanderTarget.x = rand(this.width * 0.16, this.width * 0.84);
            dr.wanderTarget.y = rand(this.height * 0.16, this.height * 0.76);
          }
        }

        const head = dr.joints[0];
        const desiredAngle = Math.atan2(dr.wanderTarget.y - head.y, dr.wanderTarget.x - head.x);
        let diff = desiredAngle - dr.headAngle;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;

        // Smooth serpentine steering + living undulation
        dr.headAngle += clamp(diff, -2.4 * dt, 2.4 * dt) + Math.sin(dr.phase) * 1.15 * dt;
        const vx = Math.cos(dr.headAngle) * dr.speed;
        const vy = Math.sin(dr.headAngle) * dr.speed;

        head.x += vx * dt;
        head.y += vy * dt;
        head.angle = dr.headAngle;

        // Keep comfortably inside canvas with graceful banking
        const margin = 95;
        if (head.x < margin) dr.wanderTarget.x = this.width * 0.65;
        if (head.x > this.width - margin) dr.wanderTarget.x = this.width * 0.35;
        if (head.y < margin) dr.wanderTarget.y = this.height * 0.55;
        if (head.y > this.height - margin) dr.wanderTarget.y = this.height * 0.32;

        // Follow-the-leader IK with lateral serpentine wave
        const spacing = dr.segSpacing * (0.45 + 0.55 * dr.grow);
        for (let i = 1; i < dr.joints.length; i++) {
          const prev = dr.joints[i - 1];
          const cur = dr.joints[i];
          const dx = prev.x - cur.x;
          const dy = prev.y - cur.y;
          let ang = Math.atan2(dy, dx);
          // Add subtle sinusoidal body wave
          const wave = Math.sin(dr.phase - i * 0.26) * 0.055;
          ang += wave;
          cur.angle = ang;
          cur.x = prev.x - Math.cos(ang) * spacing;
          cur.y = prev.y - Math.sin(ang) * spacing;
        }

        // Continuously stir the WebGL Navier-Stokes ink fluid along dragon's path!
        this.fluid.splat(
          head.x / this.width,
          head.y / this.height,
          vx * 0.34,
          vy * 0.34,
          this.nightMix > 0.5 ? [0.06, 0.0, 0.03, 0.06] : [0.11, 0.0, 0.02, 0.0],
          0.00075
        );
        const tail = dr.joints[dr.joints.length - 1];
        if (Math.random() < 0.5) {
          this.fluid.splat(
            tail.x / this.width,
            tail.y / this.height,
            -vx * 0.22,
            -vy * 0.22,
            null,
            0.00065
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // Master Painter's-Order Render
    // -------------------------------------------------------------------------

    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      if (this.clearing) {
        ctx.globalAlpha = clamp(this.clearFade, 0, 1);
      }

      // 1. Moon & atmospheric halo (烘云托月)
      for (const mn of this.moons) {
        this._drawMoon(ctx, mn);
      }

      // 2. Distant Mountains & Waters
      for (const m of this.mountains) {
        this._drawMountain(ctx, m);
      }
      for (const w of this.waters) {
        this._drawWater(ctx, w);
      }
      for (const rp of this.ripples) {
        this._drawRipple(ctx, rp);
      }

      // 3. Wind hairline streamlines
      this._drawWindStreaks(ctx);

      // 4. Swimming Ink Fishes
      for (const f of this.fishes) {
        this._drawFish(ctx, f);
      }

      // 5. Campfires & glowing embers
      for (const f of this.fires) {
        this._drawFire(ctx, f);
      }
      this._drawEmbers(ctx);

      // 6. Segmented Ink Bamboos & Gnarled Plum Branches + Falling Petals
      for (const b of this.bamboos) {
        this._drawBamboo(ctx, b);
      }
      for (const p of this.plums) {
        this._drawPlum(ctx, p);
      }
      this._drawPetals(ctx);

      // 7. Flocking Ink Birds & Cinnabar Butterflies
      for (const b of this.birds) {
        this._drawBird(ctx, b);
      }
      for (const bf of this.butterflies) {
        this._drawButterfly(ctx, bf);
      }

      // 8. Majestic Articulated Chinese Ink Dragon
      for (const dr of this.dragons) {
        this._drawDragon(ctx, dr);
      }

      // 9. Night Fireflies (流萤), Rain, Snow, Forked Lightning
      if (this.nightMix > 0.05) {
        this._drawFireflies(ctx);
      }
      this._drawRainAndSnow(ctx);
      for (const lt of this.lightnings) {
        this._drawLightning(ctx, lt);
      }

      // 10. Transient Calligraphic Glyph Ghosts ("字落化墨")
      for (const g of this.glyphGhosts) {
        this._drawGlyphGhost(ctx, g);
      }

      ctx.restore();
    }

    _drawGlyphGhost(ctx, g) {
      const t = clamp(g.age / g.duration, 0, 1);
      const alpha = Math.pow(1 - t, 1.65) * 0.92;
      const scale = 0.94 + t * 0.16;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${g.size}px "STKaiti", "Kaiti SC", "KaiTi", "Ma Shan Zheng", "Noto Serif SC", serif`;

      let fill;
      if (g.colorType === "cinnabar") {
        fill = this.nightMix > 0.5 ? "rgba(218, 64, 58, 0.95)" : "rgba(156, 26, 26, 0.92)";
      } else {
        fill = this.nightMix > 0.5 ? "rgba(232, 234, 224, 0.92)" : "rgba(24, 26, 25, 0.92)";
      }
      ctx.shadowColor = fill;
      ctx.shadowBlur = 4 + t * 18;
      ctx.fillStyle = fill;
      ctx.fillText(g.char, 0, 0);
      ctx.restore();
    }

    _drawMoon(ctx, mn) {
      const ease = 1 - Math.pow(1 - mn.grow, 3);
      const r = mn.r * ease;
      if (r < 2) return;

      ctx.save();
      // Outer halo: smoky 烘云托月 in Day, luminous moonlight in Night
      const haloR = r * 3.1;
      const grad = ctx.createRadialGradient(mn.x, mn.y, r * 0.85, mn.x, mn.y, haloR);
      if (this.nightMix < 0.5) {
        const a = 0.24 * (1 - this.nightMix * 1.4);
        grad.addColorStop(0, `rgba(68, 72, 70, ${Math.max(0, a)})`);
        grad.addColorStop(0.45, `rgba(92, 96, 92, ${Math.max(0, a * 0.48)})`);
        grad.addColorStop(1, "rgba(120, 120, 115, 0)");
      } else {
        const a = 0.30 * this.nightMix;
        grad.addColorStop(0, `rgba(250, 246, 222, ${a})`);
        grad.addColorStop(0.4, `rgba(205, 214, 206, ${a * 0.42})`);
        grad.addColorStop(1, "rgba(180, 195, 195, 0)");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mn.x, mn.y, haloR, 0, TAU);
      ctx.fill();

      // Moon disc
      const discGrad = ctx.createRadialGradient(
        mn.x - r * 0.22,
        mn.y - r * 0.22,
        r * 0.1,
        mn.x,
        mn.y,
        r
      );
      const night = this.nightMix;
      const rCol = Math.round(lerp(242, 255, night));
      const gCol = Math.round(lerp(238, 252, night));
      const bCol = Math.round(lerp(225, 230, night));
      discGrad.addColorStop(0, `rgba(${rCol}, ${gCol}, ${bCol}, 0.96)`);
      discGrad.addColorStop(0.78, `rgba(${rCol - 12}, ${gCol - 12}, ${bCol - 14}, 0.92)`);
      discGrad.addColorStop(1, `rgba(${rCol - 24}, ${gCol - 22}, ${bCol - 24}, 0.84)`);

      ctx.fillStyle = discGrad;
      ctx.beginPath();
      ctx.arc(mn.x, mn.y, r, 0, TAU);
      ctx.fill();

      // Subtle ink-wash lunar sea mottling
      ctx.fillStyle = night > 0.5 ? "rgba(190, 188, 168, 0.16)" : "rgba(165, 162, 148, 0.16)";
      ctx.beginPath();
      ctx.arc(mn.x + r * 0.22, mn.y + r * 0.12, r * 0.36, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mn.x - r * 0.26, mn.y - r * 0.16, r * 0.24, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    _evalMountainY(m, t, growEase) {
      let h = 0;
      for (const pk of m.peaks) {
        const dist = (t - pk.t) / 0.20;
        h += pk.h * Math.exp(-dist * dist);
      }
      // Taper smoothly to zero at left & right foothills
      const edge = Math.sin(clamp(t, 0, 1) * Math.PI);
      return m.baseY - h * Math.pow(edge, 0.65) * growEase;
    }

    _drawMountain(ctx, m) {
      const ease = 1 - Math.pow(1 - m.grow, 3);
      const left = m.x - m.w * 0.5;
      const steps = 44;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left, m.baseY);
      let minTopY = m.baseY;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = left + t * m.w;
        const py = this._evalMountainY(m, t, ease);
        if (py < minTopY) minTopY = py;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(left + m.w, m.baseY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(m.x, minTopY, m.x, m.baseY);
      const d = m.depth;
      if (this.nightMix < 0.5) {
        const topA = lerp(0.22, 0.58, d) * (1 - this.nightMix * 0.5);
        grad.addColorStop(0, `rgba(42, 46, 44, ${topA})`);
        grad.addColorStop(0.55, `rgba(88, 92, 88, ${topA * 0.46})`);
        grad.addColorStop(1, "rgba(234, 228, 213, 0)");
      } else {
        const topA = lerp(0.16, 0.36, d);
        grad.addColorStop(0, `rgba(155, 162, 160, ${topA})`);
        grad.addColorStop(0.48, `rgba(52, 60, 62, ${topA * 0.65})`);
        grad.addColorStop(1, "rgba(8, 12, 13, 0)");
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Crisp wet-ink ridge line + snow frost
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = left + t * m.w;
        const py = this._evalMountainY(m, t, ease);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineWidth = 1.3;
      if (m.snowFrost > 0.08) {
        ctx.strokeStyle = `rgba(248, 248, 244, ${0.55 * m.snowFrost})`;
        ctx.lineWidth = 2.4;
      } else {
        ctx.strokeStyle =
          this.nightMix > 0.5
            ? `rgba(205, 212, 210, ${0.22 * d})`
            : `rgba(34, 38, 36, ${0.34 * d})`;
      }
      ctx.stroke();

      // Authentic 披麻皴 vertical brushwork ticks hanging from peaks
      if (d > 0.52) {
        ctx.lineWidth = 0.95;
        for (const st of m.strokes) {
          const t = clamp(st.peakT + st.dt, 0.08, 0.92);
          const sx = left + t * m.w;
          const sy = this._evalMountainY(m, t, ease) + 2;
          ctx.strokeStyle =
            this.nightMix > 0.5
              ? `rgba(195, 202, 200, ${st.alpha * 0.65})`
              : `rgba(38, 40, 38, ${st.alpha})`;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + st.lean * ease, sy + st.len * ease);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawBamboo(ctx, b) {
      const ease = 1 - Math.pow(1 - b.grow, 2.6);
      const isNight = this.nightMix > 0.5;
      ctx.save();

      for (const st of b.stalks) {
        const maxSeg = st.segCount * ease;
        let curX = st.x;
        let curY = this.height + 8;
        const nodes = [{ x: curX, y: curY, ang: -Math.PI * 0.5 }];

        // Draw segmented culm (竹竿与竹节)
        for (let i = 0; i < Math.ceil(maxSeg); i++) {
          const segFrac = clamp(maxSeg - i, 0, 1);
          const heightRatio = (i + 1) / st.segCount;
          const bend =
            st.lean * heightRatio +
            b.swayAngle * Math.pow(heightRatio, 1.65) +
            Math.sin(this.time * 1.8 + st.swayPhase) * 0.012 * heightRatio;
          const ang = -Math.PI * 0.5 + bend;
          const len = (st.segLen - 2.6) * segFrac;
          const nx = curX + Math.cos(ang) * len;
          const ny = curY + Math.sin(ang) * len;

          const w = lerp(st.baseWidth, st.baseWidth * 0.38, heightRatio);
          ctx.lineCap = "butt";
          ctx.lineWidth = w;
          ctx.strokeStyle = isNight
            ? `rgba(218, 218, 206, ${0.84 * st.tone})`
            : `rgba(26, 30, 28, ${0.86 * st.tone})`;
          ctx.beginPath();
          ctx.moveTo(curX, curY);
          ctx.lineTo(nx, ny);
          ctx.stroke();

          // Node scar tick (节疤)
          if (segFrac >= 0.98) {
            const perpX = -Math.sin(ang) * (w * 0.72);
            const perpY = Math.cos(ang) * (w * 0.72);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(nx - perpX, ny - perpY);
            ctx.lineTo(nx + perpX, ny + perpY);
            ctx.stroke();
          }

          curX = nx + Math.cos(ang) * 2.6;
          curY = ny + Math.sin(ang) * 2.6;
          nodes.push({ x: nx, y: ny, ang, bend });
        }

        // Draw side twigs & sharp lance-shaped calligraphic leaves (个字/介字竹叶)
        for (const lf of st.leaves) {
          if (lf.nodeIndex >= nodes.length) continue;
          const leafGrow = clamp((maxSeg - lf.nodeIndex + 0.6) * 1.4, 0, 1);
          if (leafGrow <= 0.02) continue;

          const nd = nodes[lf.nodeIndex];
          const tAng = lf.twigAngle + (nd.bend || 0) * 1.2;
          const tx = nd.x + Math.cos(tAng) * lf.twigLen * leafGrow;
          const ty = nd.y + Math.sin(tAng) * lf.twigLen * leafGrow;

          ctx.lineWidth = 1.05;
          ctx.strokeStyle = isNight
            ? `rgba(212, 212, 200, ${0.72 * st.tone})`
            : `rgba(34, 38, 36, ${0.75 * st.tone})`;
          ctx.beginPath();
          ctx.moveTo(nd.x, nd.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          ctx.fillStyle = isNight
            ? `rgba(222, 220, 208, ${0.86 * st.tone})`
            : `rgba(24, 28, 26, ${0.88 * st.tone})`;

          for (const blade of lf.cluster) {
            const flutter =
              Math.sin(this.time * 3.1 + blade.phase) * (0.04 + Math.abs(this.windStrength) * 0.14) +
              this.windStrength * 0.25;
            const ba = blade.angle + (nd.bend || 0) + flutter;
            const L = blade.len * leafGrow;
            const W = blade.width * leafGrow;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(ba);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(L * 0.36, -W * 0.62, L, blade.curve * L);
            ctx.quadraticCurveTo(L * 0.38, W * 0.52, 0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    _drawPlum(ctx, p) {
      const g = p.grow;
      const isNight = this.nightMix > 0.5;
      ctx.save();
      ctx.translate(p.rootX, p.rootY);
      ctx.rotate(p.sway);
      ctx.translate(-p.rootX, -p.rootY);

      // Angular calligraphic plum branches
      ctx.lineCap = "round";
      for (const seg of p.segments) {
        if (g <= seg.t0) continue;
        const f = clamp((g - seg.t0) / Math.max(0.01, seg.t1 - seg.t0), 0, 1);
        const ex = lerp(seg.x1, seg.x2, f);
        const ey = lerp(seg.y1, seg.y2, f);
        ctx.lineWidth = seg.w1;
        ctx.strokeStyle = isNight ? "rgba(210, 208, 196, 0.85)" : "rgba(30, 28, 26, 0.88)";
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // 5-petal Cinnabar Plum Blossoms (红梅与花蕊)
      for (const bl of p.blossoms) {
        if (g <= bl.appearAt) continue;
        const bf = clamp((g - bl.appearAt) * 3.8, 0, 1);
        const r = bl.r * bf;
        ctx.save();
        ctx.translate(bl.x, bl.y);
        ctx.rotate(bl.rot);

        if (bl.isBud) {
          ctx.fillStyle = bl.shade > 0.5 ? "rgba(198, 44, 42, 0.92)" : "rgba(166, 28, 28, 0.90)";
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.52, 0, TAU);
          ctx.fill();
        } else {
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU;
            const px = Math.cos(a) * r * 0.56;
            const py = Math.sin(a) * r * 0.56;
            ctx.fillStyle =
              k % 2 === 0 ? "rgba(194, 42, 40, 0.88)" : "rgba(218, 68, 64, 0.82)";
            ctx.beginPath();
            ctx.arc(px, py, r * 0.44, 0, TAU);
            ctx.fill();
          }
          // Calyx & fine stamens
          ctx.fillStyle = isNight ? "rgba(245, 230, 195, 0.9)" : "rgba(42, 26, 24, 0.85)";
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.16, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = isNight ? "rgba(245, 232, 195, 0.65)" : "rgba(48, 30, 28, 0.65)";
          ctx.lineWidth = 0.65;
          for (let s = 0; s < 5; s++) {
            const sa = (s / 5) * TAU + 0.3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(sa) * r * 0.38, Math.sin(sa) * r * 0.38);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }

    _drawPetals(ctx) {
      for (const pt of this.petals) {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.globalAlpha = clamp(pt.alpha, 0, 1);
        ctx.fillStyle = "rgba(198, 44, 42, 0.86)";
        ctx.beginPath();
        ctx.ellipse(0, 0, pt.r, pt.r * 0.65, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    _drawFish(ctx, f) {
      const isNight = this.nightMix > 0.5;
      const sp = f.spine;
      if (sp.length < 6) return;

      ctx.save();
      const headAng = Math.atan2(sp[0].y - sp[1].y, sp[0].x - sp[1].x);

      // Pectoral fins (胸鳍)
      const p1 = sp[2];
      const finSwing = Math.sin(f.phase) * 0.28;
      ctx.strokeStyle = isNight ? "rgba(210, 214, 204, 0.55)" : "rgba(46, 50, 48, 0.52)";
      ctx.lineWidth = 1.6;
      for (const side of [-1, 1]) {
        const fa = headAng + Math.PI * 0.68 * side + finSwing * side;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(
          p1.x + Math.cos(fa) * f.size * 0.55,
          p1.y + Math.sin(fa) * f.size * 0.55,
          p1.x + Math.cos(fa + 0.25 * side) * f.size * 0.85,
          p1.y + Math.sin(fa + 0.25 * side) * f.size * 0.85
        );
        ctx.stroke();
      }

      // Undulating Qi Baishi xieyi body polygon
      const leftPts = [];
      const rightPts = [];
      const widths = [0.24, 0.42, 0.44, 0.36, 0.26, 0.17, 0.10, 0.04];
      for (let i = 0; i < sp.length; i++) {
        const cur = sp[i];
        const next = sp[Math.min(sp.length - 1, i + 1)];
        const prev = sp[Math.max(0, i - 1)];
        const ang = Math.atan2(prev.y - next.y, prev.x - next.x);
        const nx = -Math.sin(ang) * f.size * widths[i];
        const ny = Math.cos(ang) * f.size * widths[i];
        leftPts.push({ x: cur.x + nx, y: cur.y + ny });
        rightPts.push({ x: cur.x - nx, y: cur.y - ny });
      }

      ctx.fillStyle = isNight ? "rgba(222, 224, 214, 0.86)" : "rgba(28, 31, 30, 0.86)";
      ctx.beginPath();
      ctx.moveTo(sp[0].x + Math.cos(headAng) * f.size * 0.28, sp[0].y + Math.sin(headAng) * f.size * 0.28);
      for (const pt of leftPts) ctx.lineTo(pt.x, pt.y);
      for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
      ctx.closePath();
      ctx.fill();

      // Gossamer bifurcated swallowtail (燕尾)
      const tail = sp[sp.length - 1];
      const tailPrev = sp[sp.length - 2];
      const tailAng = Math.atan2(tail.y - tailPrev.y, tail.x - tailPrev.x);
      ctx.fillStyle = isNight ? "rgba(210, 214, 204, 0.52)" : "rgba(52, 56, 54, 0.50)";
      for (const side of [-1, 1]) {
        const ta = tailAng + side * (0.34 + Math.sin(f.phase) * 0.08);
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.quadraticCurveTo(
          tail.x + Math.cos(ta) * f.size * 0.65,
          tail.y + Math.sin(ta) * f.size * 0.65,
          tail.x + Math.cos(ta + side * 0.15) * f.size * 1.15,
          tail.y + Math.sin(ta + side * 0.15) * f.size * 1.15
        );
        ctx.lineTo(tail.x + Math.cos(tailAng) * f.size * 0.35, tail.y + Math.sin(tailAng) * f.size * 0.35);
        ctx.closePath();
        ctx.fill();
      }

      // Optional cinnabar koi head crown (朱砂点额, seen in top_right_050.jpg!)
      if (f.redCrown) {
        ctx.fillStyle = "rgba(198, 48, 44, 0.88)";
        ctx.beginPath();
        ctx.arc(sp[1].x, sp[1].y, f.size * 0.19, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawBird(ctx, b) {
      const isNight = this.nightMix > 0.5;
      const ang = Math.atan2(b.vy, b.vx);
      const flap = Math.sin(b.flapPhase);
      const s = b.size;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);

      const col = isNight ? "rgba(228, 228, 218, 0.88)" : "rgba(26, 28, 27, 0.88)";
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineCap = "round";

      // Sleek calligraphic body stroke
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.48, s * 0.14, 0, 0, TAU);
      ctx.fill();

      // Expressive flapping brush wings
      const wingLift = flap * s * 0.78;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(s * 0.08, 0);
      ctx.quadraticCurveTo(-s * 0.15, -s * 0.45 - wingLift * 0.5, -s * 0.48, -s * 0.65 - wingLift);
      ctx.moveTo(s * 0.08, 0);
      ctx.quadraticCurveTo(-s * 0.15, s * 0.45 + wingLift * 0.5, -s * 0.48, s * 0.65 + wingLift);
      ctx.stroke();

      // Forked swallow tail
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, 0);
      ctx.lineTo(-s * 0.78, -s * 0.14);
      ctx.moveTo(-s * 0.42, 0);
      ctx.lineTo(-s * 0.78, s * 0.14);
      ctx.stroke();

      ctx.restore();
    }

    _drawButterfly(ctx, bf) {
      const ang = Math.atan2(bf.vy, bf.vx) + Math.PI * 0.5;
      const wingScale = 0.28 + 0.72 * Math.abs(Math.sin(bf.phase));
      const s = bf.size;

      ctx.save();
      ctx.translate(bf.x, bf.y);
      ctx.rotate(ang);

      const primary = bf.isCinnabar
        ? "rgba(202, 42, 38, 0.88)"
        : this.nightMix > 0.5
        ? "rgba(110, 224, 198, 0.85)"
        : "rgba(38, 108, 100, 0.85)";

      ctx.save();
      ctx.scale(wingScale, 1);
      ctx.fillStyle = primary;
      for (const side of [-1, 1]) {
        // Forewing
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(side * s * 1.25, -s * 0.95, side * s * 1.35, s * 0.15, 0, s * 0.12);
        ctx.fill();
        // Hindwing
        ctx.globalAlpha = 0.76;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.08);
        ctx.bezierCurveTo(side * s * 0.92, s * 0.2, side * s * 0.78, s * 0.95, 0, s * 0.52);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();

      // Slender body
      ctx.strokeStyle = this.nightMix > 0.5 ? "rgba(235, 232, 220, 0.85)" : "rgba(30, 26, 24, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.35);
      ctx.lineTo(0, s * 0.45);
      ctx.stroke();
      ctx.restore();
    }

    /**
     * Masterpiece Articulated Chinese Ink Dragon (exact match to f_038 Day & f_060 Night!)
     */
    _drawDragon(ctx, dr) {
      const joints = dr.joints;
      const N = joints.length;
      if (N < 10) return;

      const isNight = this.nightMix > 0.5;
      const g = dr.grow;

      // Day vs Night palette (matching f_038 dark-sumi/emerald/crimson & f_060 pearl-jade/mint/coral!)
      const bodyFill = isNight ? "#e4eae2" : "#181d1c";
      const scaleStroke = isNight ? "rgba(62, 78, 74, 0.62)" : "rgba(138, 152, 146, 0.45)";
      const bellyFill = isNight ? "#d85650" : "#a82422";
      const bellyLine = isNight ? "rgba(250, 218, 208, 0.52)" : "rgba(232, 168, 156, 0.42)";
      const finFill = isNight ? "#6ef0c6" : "#1e6853";
      const hornCol = isNight ? "#dcd8c6" : "#382a24";
      const clawCol = isNight ? "#f4f6f0" : "#1b1e1d";

      const halfWidthAt = (i) => {
        const t = i / (N - 1);
        let w;
        if (t < 0.12) w = lerp(16.5, 23.5, t / 0.12);
        else w = 23.5 * Math.pow(1 - (t - 0.12) / 0.88, 0.86) + 2.8;
        return w * (0.35 + 0.65 * g);
      };

      // Compute normals along spine; determine which side is "belly" vs "dorsal"
      const headSin = Math.cos(joints[0].angle);
      const dorsalSide = headSin >= 0 ? -1 : 1;

      ctx.save();

      // 1. Four Clawed Limbs (前足 idx=9, 后足 idx=24)
      const drawLegPair = (idx, scaleLeg, phaseOff) => {
        if (idx >= N) return;
        const j = joints[idx];
        const stride = Math.sin(dr.phase + phaseOff) * 0.25;
        const baseW = halfWidthAt(idx);
        const legAng = j.angle - dorsalSide * (Math.PI * 0.52) + stride;
        const thighL = 36 * scaleLeg * g;
        const shinL = 30 * scaleLeg * g;

        const hipX = j.x - Math.sin(j.angle) * dorsalSide * baseW * 0.55;
        const hipY = j.y + Math.cos(j.angle) * dorsalSide * baseW * 0.55;
        const kneeX = hipX + Math.cos(legAng) * thighL;
        const kneeY = hipY + Math.sin(legAng) * thighL;
        const shinAng = legAng + dorsalSide * 0.55;
        const wristX = kneeX + Math.cos(shinAng) * shinL;
        const wristY = kneeY + Math.sin(shinAng) * shinL;

        // Muscular upper & lower limb
        ctx.lineCap = "round";
        ctx.strokeStyle = bodyFill;
        ctx.lineWidth = 11.5 * scaleLeg * g;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.stroke();

        ctx.lineWidth = 8.0 * scaleLeg * g;
        ctx.beginPath();
        ctx.moveTo(kneeX, kneeY);
        ctx.lineTo(wristX, wristY);
        ctx.stroke();

        // Jade flame tuft at elbow
        ctx.fillStyle = finFill;
        ctx.beginPath();
        ctx.moveTo(kneeX, kneeY);
        ctx.quadraticCurveTo(
          kneeX - Math.cos(j.angle) * 22 * g,
          kneeY - Math.sin(j.angle) * 22 * g - 8,
          kneeX - Math.cos(j.angle) * 32 * g,
          kneeY - Math.sin(j.angle) * 32 * g
        );
        ctx.quadraticCurveTo(kneeX - Math.cos(j.angle) * 11 * g, kneeY + 7, kneeX, kneeY);
        ctx.fill();

        // 4 Fierce Curved Talons (龙爪)
        ctx.strokeStyle = clawCol;
        ctx.lineWidth = 2.6 * g;
        for (let c = -1.5; c <= 1.5; c += 1.0) {
          const ca = shinAng + c * 0.34;
          const cx1 = wristX + Math.cos(ca) * 13 * g;
          const cy1 = wristY + Math.sin(ca) * 13 * g;
          const cx2 = cx1 + Math.cos(ca + dorsalSide * 0.48) * 8.5 * g;
          const cy2 = cy1 + Math.sin(ca + dorsalSide * 0.48) * 8.5 * g;
          ctx.beginPath();
          ctx.moveTo(wristX, wristY);
          ctx.lineTo(cx1, cy1);
          ctx.lineTo(cx2, cy2);
          ctx.stroke();
        }
      };

      drawLegPair(9, 1.0, 0.0);
      drawLegPair(24, 0.92, 2.2);

      // Build dorsal & ventral ribbon edges
      const dorsalPts = [];
      const ventralPts = [];
      const midBellyPts = [];
      for (let i = 0; i < N; i++) {
        const j = joints[i];
        const w = halfWidthAt(i);
        const nx = -Math.sin(j.angle) * dorsalSide;
        const ny = Math.cos(j.angle) * dorsalSide;
        dorsalPts.push({ x: j.x + nx * w, y: j.y + ny * w });
        ventralPts.push({ x: j.x - nx * w, y: j.y - ny * w });
        midBellyPts.push({ x: j.x - nx * w * 0.36, y: j.y - ny * w * 0.36 });
      }

      // 2. Serrated Emerald-Jade Dorsal Fin Spikes (背鳍鬃刺)
      ctx.fillStyle = finFill;
      for (let i = 2; i < N - 2; i += 2) {
        const d0 = dorsalPts[i - 1];
        const d1 = dorsalPts[i];
        const d2 = dorsalPts[i + 1];
        const j = joints[i];
        const nx = -Math.sin(j.angle) * dorsalSide;
        const ny = Math.cos(j.angle) * dorsalSide;
        const spikeLen = (21 * (1 - i / N) + 6) * g;
        const tipX = d1.x + nx * spikeLen - Math.cos(j.angle) * spikeLen * 0.65;
        const tipY = d1.y + ny * spikeLen - Math.sin(j.angle) * spikeLen * 0.65;

        ctx.beginPath();
        ctx.moveTo(d0.x, d0.y);
        ctx.quadraticCurveTo(d1.x + nx * spikeLen * 0.6, d1.y + ny * spikeLen * 0.6, tipX, tipY);
        ctx.lineTo(d2.x, d2.y);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Full Tapered Body Polygon
      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(dorsalPts[0].x, dorsalPts[0].y);
      for (let i = 1; i < N; i++) ctx.lineTo(dorsalPts[i].x, dorsalPts[i].y);
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(ventralPts[i].x, ventralPts[i].y);
      ctx.closePath();
      ctx.fill();

      // 4. Crimson Segmented Belly Strip (丹红龙腹)
      ctx.fillStyle = bellyFill;
      ctx.beginPath();
      ctx.moveTo(midBellyPts[1].x, midBellyPts[1].y);
      for (let i = 2; i < N - 1; i++) ctx.lineTo(midBellyPts[i].x, midBellyPts[i].y);
      for (let i = N - 2; i >= 1; i--) ctx.lineTo(ventralPts[i].x, ventralPts[i].y);
      ctx.closePath();
      ctx.fill();

      // Belly scute cross-lines
      ctx.strokeStyle = bellyLine;
      ctx.lineWidth = 0.9;
      for (let i = 2; i < N - 2; i++) {
        ctx.beginPath();
        ctx.moveTo(midBellyPts[i].x, midBellyPts[i].y);
        ctx.lineTo(ventralPts[i].x, ventralPts[i].y);
        ctx.stroke();
      }

      // 5. Overlapping Crescent Dragon Scales (鱼鳞纹)
      ctx.strokeStyle = scaleStroke;
      ctx.lineWidth = 1.05;
      for (let i = 2; i < N - 3; i++) {
        const j = joints[i];
        const w = halfWidthAt(i);
        if (w < 4) continue;
        const nx = -Math.sin(j.angle) * dorsalSide;
        const ny = Math.cos(j.angle) * dorsalSide;
        for (const row of [0.05, 0.48]) {
          const sx = j.x + nx * w * row;
          const sy = j.y + ny * w * row;
          ctx.beginPath();
          ctx.arc(sx, sy, w * 0.34, j.angle + Math.PI * 0.55, j.angle + Math.PI * 1.45);
          ctx.stroke();
        }
      }

      // 6. Multi-Plume Calligraphic Tail Tuft (龙尾鬃毛)
      const tail = joints[N - 1];
      const tailAng = tail.angle + Math.PI;
      for (let p = -3; p <= 3; p++) {
        const pa = tailAng + p * 0.19 + Math.sin(dr.phase * 1.3 + p) * 0.08;
        const plen = (48 - Math.abs(p) * 5.5) * g;
        ctx.fillStyle = Math.abs(p) % 2 === 1 ? bellyFill : finFill;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.quadraticCurveTo(
          tail.x + Math.cos(pa + 0.18) * plen * 0.55,
          tail.y + Math.sin(pa + 0.18) * plen * 0.55,
          tail.x + Math.cos(pa) * plen,
          tail.y + Math.sin(pa) * plen
        );
        ctx.quadraticCurveTo(
          tail.x + Math.cos(pa - 0.15) * plen * 0.45,
          tail.y + Math.sin(pa - 0.15) * plen * 0.45,
          tail.x,
          tail.y
        );
        ctx.fill();
      }

      // 7. Horned Dragon Head, Mane, Jaws & Flowing Whiskers (龙头)
      const head = joints[0];
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(head.angle);
      if (dorsalSide > 0) {
        ctx.scale(1, -1);
      }
      ctx.scale(g * 1.38, g * 1.38);

      // Swept-back emerald mane plumes
      ctx.fillStyle = finFill;
      for (let m = 0; m < 5; m++) {
        const ma = Math.PI + (m - 2) * 0.26;
        const ml = 34 - Math.abs(m - 2) * 4;
        ctx.beginPath();
        ctx.moveTo(-4, (m - 2) * 4.2);
        ctx.quadraticCurveTo(
          Math.cos(ma) * ml * 0.6,
          Math.sin(ma) * ml * 0.6 - 5,
          Math.cos(ma) * ml,
          Math.sin(ma) * ml
        );
        ctx.lineTo(-8, (m - 2) * 3.0);
        ctx.closePath();
        ctx.fill();
      }

      // Branching Stag Antlers (鹿角)
      ctx.strokeStyle = hornCol;
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-2, -10);
      ctx.quadraticCurveTo(-18, -24, -36, -22);
      ctx.moveTo(-16, -20);
      ctx.lineTo(-26, -31);
      ctx.moveTo(-4, -7);
      ctx.quadraticCurveTo(-20, -17, -32, -14);
      ctx.stroke();

      // Lower Jaw + Crimson Mouth + Fangs
      const jawOpen = 0.22 + Math.sin(dr.phase * 0.7) * 0.08 + dr.roarGlow * 0.25;
      ctx.save();
      ctx.rotate(jawOpen);
      ctx.fillStyle = bellyFill;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(25, 6);
      ctx.lineTo(20, 11);
      ctx.lineTo(-4, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(-4, 7);
      ctx.quadraticCurveTo(12, 14, 26, 7);
      ctx.lineTo(22, 5);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Upper Skull & Snout
      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(-10, -11);
      ctx.quadraticCurveTo(6, -15, 18, -8);
      ctx.quadraticCurveTo(28, -9, 32, -2);
      ctx.lineTo(28, 3);
      ctx.lineTo(2, 4);
      ctx.lineTo(-10, 2);
      ctx.closePath();
      ctx.fill();

      // Sharp white fangs
      ctx.fillStyle = "#f8f6ee";
      for (const fx of [10, 17, 24]) {
        ctx.beginPath();
        ctx.moveTo(fx, 2.5);
        ctx.lineTo(fx + 2, 7.5);
        ctx.lineTo(fx + 4, 2.5);
        ctx.closePath();
        ctx.fill();
      }

      // Crimson nasal crest & eyebrow flame
      ctx.fillStyle = bellyFill;
      ctx.beginPath();
      ctx.arc(29, -4, 4.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, -9);
      ctx.quadraticCurveTo(9, -18, 16, -12);
      ctx.lineTo(7, -7);
      ctx.closePath();
      ctx.fill();

      // Fierce Dragon Eye
      ctx.fillStyle = "#fffdf4";
      ctx.beginPath();
      ctx.arc(8, -5, 4.0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#c92b27";
      ctx.beginPath();
      ctx.arc(8.6, -5, 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(9.0, -5, 1.2, 0, TAU);
      ctx.fill();

      // Two Long Sinuous Whiskers (龙须)
      ctx.strokeStyle = isNight ? "rgba(238, 242, 232, 0.85)" : "rgba(32, 36, 34, 0.82)";
      ctx.lineWidth = 1.35;
      const wWave = Math.sin(dr.phase * 1.4) * 10;
      ctx.beginPath();
      ctx.moveTo(26, -3);
      ctx.bezierCurveTo(38, -22 + wWave, 14, -42 - wWave, -8, -46 + wWave);
      ctx.moveTo(26, 1);
      ctx.bezierCurveTo(40, 18 - wWave, 18, 36 + wWave, -4, 42 - wWave);
      ctx.stroke();

      ctx.restore();
      ctx.restore();
    }

    _drawFire(ctx, f) {
      const g = f.grow * clamp(f.power, 0.2, 1.2);
      const sway = this.windStrength * 26 + Math.sin(this.time * 7.5 + f.phase) * 5.5;
      const h = (88 + Math.sin(this.time * 11.2 + f.phase) * 10) * g;
      const w = 26 * g;

      ctx.save();
      // Warm ambient glow on paper / night sky
      const glowR = 145 * g * (0.65 + this.nightMix * 0.65);
      const glow = ctx.createRadialGradient(f.x, f.y - h * 0.35, 6, f.x, f.y - h * 0.35, glowR);
      glow.addColorStop(0, `rgba(245, 138, 42, ${0.32 + this.nightMix * 0.22})`);
      glow.addColorStop(0.5, `rgba(205, 68, 28, ${0.12 + this.nightMix * 0.10})`);
      glow.addColorStop(1, "rgba(180, 45, 20, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(f.x, f.y - h * 0.35, glowR, 0, TAU);
      ctx.fill();

      // Crossed sumi-ink firewood logs (柴薪, matches f_059 bottom-left!)
      ctx.lineCap = "round";
      ctx.strokeStyle = this.nightMix > 0.5 ? "rgba(128, 78, 46, 0.92)" : "rgba(56, 38, 28, 0.90)";
      ctx.lineWidth = 6.5 * g;
      ctx.beginPath();
      ctx.moveTo(f.x - 28 * g, f.y + 4);
      ctx.lineTo(f.x + 28 * g, f.y - 5);
      ctx.moveTo(f.x - 24 * g, f.y - 5);
      ctx.lineTo(f.x + 26 * g, f.y + 5);
      ctx.stroke();

      // 3-layer painterly flame tongues
      const drawTongue = (widthMul, heightMul, color, wobble) => {
        const fw = w * widthMul;
        const fh = h * heightMul;
        const tipX = f.x + sway * heightMul + wobble;
        const tipY = f.y - fh;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(f.x - fw, f.y - 2);
        ctx.bezierCurveTo(
          f.x - fw * 1.15,
          f.y - fh * 0.45,
          tipX - fw * 0.38,
          f.y - fh * 0.78,
          tipX,
          tipY
        );
        ctx.bezierCurveTo(
          tipX + fw * 0.42,
          f.y - fh * 0.74,
          f.x + fw * 1.15,
          f.y - fh * 0.42,
          f.x + fw,
          f.y - 2
        );
        ctx.closePath();
        ctx.fill();
      };

      drawTongue(1.05, 1.04, "rgba(214, 72, 28, 0.85)", Math.sin(this.time * 9.3) * 4);
      drawTongue(0.76, 0.86, "rgba(246, 168, 44, 0.92)", -Math.cos(this.time * 12.1) * 3);
      drawTongue(0.46, 0.64, "rgba(255, 250, 224, 0.96)", Math.sin(this.time * 14.5) * 2);

      ctx.restore();
    }

    _drawEmbers(ctx) {
      for (const em of this.embers) {
        const a = 1 - em.life / em.maxLife;
        ctx.fillStyle = `rgba(252, 168, 62, ${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(em.x, em.y, em.r * a, 0, TAU);
        ctx.fill();
      }
    }

    _drawWater(ctx, w) {
      const g = w.grow;
      const isNight = this.nightMix > 0.5;
      ctx.save();
      ctx.lineCap = "round";
      for (let line = 0; line < 4; line++) {
        const ly = w.y + (line - 1.5) * 11;
        const span = w.w * (1 - line * 0.14) * g;
        ctx.lineWidth = 1.4 - line * 0.2;
        ctx.strokeStyle = isNight
          ? `rgba(155, 205, 200, ${0.28 - line * 0.05})`
          : `rgba(38, 86, 84, ${0.28 - line * 0.05})`;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const px = w.x - span * 0.5 + t * span;
          const py = ly + Math.sin(t * 9 + this.time * 2.4 + line + w.phase) * 3.5;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawRipple(ctx, rp) {
      const isNight = this.nightMix > 0.5;
      ctx.save();
      ctx.strokeStyle = isNight
        ? `rgba(205, 218, 215, ${rp.alpha})`
        : `rgba(48, 56, 54, ${rp.alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.38, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    _drawWindStreaks(ctx) {
      const isNight = this.nightMix > 0.5;
      ctx.save();
      ctx.lineCap = "round";
      for (const ws of this.windStreaks) {
        const t = ws.life / ws.maxLife;
        const a = Math.sin(t * Math.PI) * ws.alpha;
        ctx.strokeStyle = isNight
          ? `rgba(215, 220, 214, ${a * 0.75})`
          : `rgba(58, 62, 58, ${a})`;
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        for (let s = 0; s <= 18; s++) {
          const f = s / 18;
          const px = ws.x + f * ws.len;
          const py = ws.y + Math.sin(f * Math.PI * 2 + ws.phase + this.time * 3) * ws.amp;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawRainAndSnow(ctx) {
      const isNight = this.nightMix > 0.5;
      if (this.raindrops.length > 0) {
        ctx.save();
        ctx.lineWidth = 1.0;
        const dx = this.windStrength * 9.5;
        for (const rd of this.raindrops) {
          ctx.strokeStyle = isNight
            ? `rgba(198, 210, 212, ${rd.alpha})`
            : `rgba(54, 62, 64, ${rd.alpha})`;
          ctx.beginPath();
          ctx.moveTo(rd.x, rd.y);
          ctx.lineTo(rd.x + dx, rd.y + rd.len);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (this.snowflakes.length > 0) {
        ctx.save();
        for (const sn of this.snowflakes) {
          ctx.fillStyle = isNight ? "rgba(244, 246, 242, 0.82)" : "rgba(252, 251, 246, 0.88)";
          ctx.strokeStyle = "rgba(95, 100, 98, 0.25)";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(sn.x, sn.y, sn.r, 0, TAU);
          ctx.fill();
          if (!isNight) ctx.stroke();
        }
        ctx.restore();
      }
    }

    _drawFireflies(ctx) {
      ctx.save();
      for (const ff of this.fireflies) {
        const pulse = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ff.phase))) * this.nightMix;
        const r = ff.size * 3.8;
        const g = ctx.createRadialGradient(ff.x, ff.y, 0.5, ff.x, ff.y, r);
        g.addColorStop(0, `rgba(218, 250, 145, ${pulse * 0.92})`);
        g.addColorStop(0.38, `rgba(128, 216, 105, ${pulse * 0.42})`);
        g.addColorStop(1, "rgba(90, 185, 85, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ff.x, ff.y, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawLightning(ctx, lt) {
      const t = lt.age / lt.duration;
      const alpha = Math.pow(1 - t, 1.8);
      const isNight = this.nightMix > 0.5;

      ctx.save();
      ctx.lineJoin = "bevel";
      ctx.lineCap = "round";
      const mainCol = isNight
        ? `rgba(242, 248, 246, ${alpha * 0.96})`
        : `rgba(28, 34, 38, ${alpha * 0.92})`;
      ctx.shadowColor = isNight ? "rgba(210, 238, 240, 0.9)" : "rgba(80, 95, 105, 0.5)";
      ctx.shadowBlur = 16;

      ctx.strokeStyle = mainCol;
      ctx.lineWidth = 2.6 * (1 - t * 0.5);
      ctx.beginPath();
      lt.mainPts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      ctx.lineWidth = 1.25 * (1 - t * 0.5);
      for (const sub of lt.branches) {
        ctx.beginPath();
        sub.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  global.InkWorld = InkWorld;
})(window);
