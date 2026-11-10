/**
 * 墨生 · 字即世界 — Main Interactive Controller
 *
 * Connects:
 *   - InkFluidEngine (WebGL Navier-Stokes 4-pigment Xuan paper fluid solver)
 *   - InkAudioEngine (WebAudio D-Pentatonic Guqin/Guzheng & nature soundscape)
 *   - InkWorld       (17+ living ink creatures, landscapes, weather & mutual ecosystem)
 *   - Direct Chinese IME cursor-following input + built-in English Pinyin fallback
 *   - Brush drag (1 墨 / 2 朱 / 3 青) & Shift + drag clean water dilution (泼水)
 */
(function () {
  "use strict";

  const stage = document.getElementById("stage");
  const fluidCanvas = document.getElementById("fluid-canvas");
  const worldCanvas = document.getElementById("world-canvas");
  const imeInput = document.getElementById("ime-input");
  const pinyinEl = document.getElementById("pinyin-buffer");
  const poemRail = document.getElementById("poem-rail");
  const sealStamp = document.getElementById("seal-stamp");
  const btnAuto = document.getElementById("btn-auto");
  const btnSound = document.getElementById("btn-sound");
  const btnSnap = document.getElementById("btn-snap");
  const charBar = document.getElementById("char-bar");
  const pigmentItems = Array.from(document.querySelectorAll(".pigment-item"));
  const charTokens = Array.from(document.querySelectorAll(".char-token"));

  // Built-in Pinyin dictionary so typing works even when OS keyboard is in English mode
  const PINYIN_CANDIDATES = {
    shan: ["山"],
    yue: ["月"],
    zhu: ["竹"],
    mei: ["梅"],
    yu: ["鱼", "雨"],
    yushui: ["雨"],
    xiayu: ["雨"],
    niao: ["鸟"],
    die: ["蝶"],
    hudie: ["蝶"],
    long: ["龙"],
    feng: ["风", "峰"],
    xue: ["雪"],
    huo: ["火"],
    shui: ["水"],
    lei: ["雷"],
    ye: ["夜"],
    zhou: ["昼"],
    kong: ["空"],
    hua: ["梅"],
    chun: ["春"],
    yun: ["云"],
    xing: ["星"],
    hai: ["海"],
    jiang: ["江"],
    lin: ["林"],
    song: ["松"],
    he: ["鹤"],
    yan: ["燕"],
    li: ["鲤"],
    dian: ["电"],
    ri: ["日"]
  };

  // Curated poetic cycle for [ 自在 ] autonomous mode
  const AUTO_SEQUENCE = [
    "山", "月", "竹", "梅", "水", "鱼", "鸟", "蝶",
    "风", "龙", "夜", "火", "雷", "雨", "雪", "昼"
  ];

  let currentPoem = "";
  let poemFadeTimer = null;

  function updatePoemRail(poemText) {
    if (!poemText) return;
    currentPoem = poemText;
    if (poemFadeTimer) {
      clearTimeout(poemFadeTimer);
      poemFadeTimer = null;
    }
    if (poemRail.textContent && poemRail.textContent !== poemText) {
      poemRail.classList.remove("visible");
      poemFadeTimer = setTimeout(() => {
        poemRail.textContent = poemText;
        poemRail.classList.add("visible");
      }, 180);
    } else {
      poemRail.textContent = poemText;
      poemRail.classList.add("visible");
    }
  }

  // Instantiate core engines
  const fluid = new InkFluidEngine(fluidCanvas);
  const audio = new InkAudioEngine();
  const world = new InkWorld(worldCanvas, fluid, audio, updatePoemRail);

  // State
  let activePigment = 1; // 1 = 墨, 2 = 朱, 3 = 青
  let hasAutoUnlockedAudio = false;
  let isComposing = false;
  let justComposedAt = 0;
  let pinyinBuffer = "";

  let autoMode = false;
  let autoTimer = 1.2;
  let autoStepIndex = 0;

  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.46,
    prevX: window.innerWidth * 0.5,
    prevY: window.innerHeight * 0.46,
    stageX: window.innerWidth * 0.5,
    stageY: window.innerHeight * 0.46,
    stageClickedAt: 0,
    down: false,
    pointerId: null
  };

  // ---------------------------------------------------------------------------
  // Helpers: Audio Unlock, Cursor Sync, Pigment & Token Feedback
  // ---------------------------------------------------------------------------

  function ensureFirstGestureAudio(e) {
    if (hasAutoUnlockedAudio) return;
    if (e && e.target && e.target.closest && e.target.closest("#btn-sound")) {
      hasAutoUnlockedAudio = true;
      return;
    }
    hasAutoUnlockedAudio = true;
    const on = audio.unlock(true);
    btnSound.classList.toggle("active", !!on);
  }

  function syncImePosition(x, y) {
    const clampedX = Math.max(24, Math.min(window.innerWidth - 40, x));
    const clampedY = Math.max(24, Math.min(window.innerHeight - 40, y));
    imeInput.style.left = `${clampedX}px`;
    imeInput.style.top = `${clampedY}px`;
    pinyinEl.style.left = `${clampedX}px`;
    pinyinEl.style.top = `${clampedY}px`;
  }

  function focusIme() {
    if (document.activeElement !== imeInput) {
      try {
        imeInput.focus({ preventScroll: true });
      } catch (_) {
        imeInput.focus();
      }
    }
  }

  function setPigment(idx) {
    activePigment = idx;
    for (const el of pigmentItems) {
      el.classList.toggle("active", Number(el.dataset.pigment) === idx);
    }
  }

  function getBrushPigmentVector() {
    const isNight = world.nightMix > 0.5;
    if (activePigment === 2) {
      // 2 朱 (Cinnabar vermilion)
      return isNight ? [0.05, 1.18, 0.0, 0.08] : [0.04, 1.08, 0.0, 0.0];
    }
    if (activePigment === 3) {
      // 3 青 (Mineral azurite / malachite cyan-teal)
      return isNight ? [0.04, 0.0, 1.16, 0.14] : [0.06, 0.0, 1.05, 0.04];
    }
    // 1 墨 (Sumi carbon ink; subtly luminous silver-mist rim at night)
    return isNight ? [0.85, 0.0, 0.0, 0.42] : [0.96, 0.0, 0.0, 0.0];
  }

  function pulseToken(char) {
    const btn = charTokens.find((t) => t.dataset.char === char);
    if (!btn) return;
    btn.classList.remove("triggered");
    void btn.offsetWidth;
    btn.classList.add("triggered");
    setTimeout(() => btn.classList.remove("triggered"), 320);
  }

  function pickHarmoniousPosition(char) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rand = (a, b) => a + Math.random() * (b - a);

    // If the user clicked on the open Xuan paper very recently, honor that area
    if (performance.now() - pointer.stageClickedAt < 2200) {
      return {
        x: Math.max(w * 0.08, Math.min(w * 0.92, pointer.stageX + rand(-28, 28))),
        y: Math.max(h * 0.10, Math.min(h * 0.78, pointer.stageY + rand(-24, 24)))
      };
    }

    switch (char) {
      case "月":
        return { x: w * rand(0.24, 0.78), y: h * rand(0.16, 0.28) };
      case "山":
        return { x: w * rand(0.20, 0.80), y: h * rand(0.48, 0.68) };
      case "竹":
        return { x: w * (Math.random() < 0.5 ? rand(0.12, 0.34) : rand(0.66, 0.88)), y: h * rand(0.42, 0.66) };
      case "梅":
        return { x: w * (Math.random() < 0.5 ? rand(0.14, 0.38) : rand(0.62, 0.86)), y: h * rand(0.28, 0.56) };
      case "水":
      case "鱼":
        return { x: w * rand(0.24, 0.76), y: h * rand(0.54, 0.76) };
      case "鸟":
      case "蝶":
        return { x: w * rand(0.22, 0.78), y: h * rand(0.24, 0.52) };
      case "龙":
        return { x: w * rand(0.28, 0.72), y: h * rand(0.32, 0.56) };
      case "火":
        return { x: w * rand(0.24, 0.76), y: h * rand(0.56, 0.76) };
      case "雷":
        return { x: w * rand(0.25, 0.75), y: h * rand(0.26, 0.48) };
      default:
        return { x: w * rand(0.24, 0.76), y: h * rand(0.32, 0.64) };
    }
  }

  function spawnAtCursor(text) {
    if (!text) return;
    const chars = Array.from(text).filter((ch) => ch.trim().length > 0);
    if (chars.length === 0) return;

    const baseX = Math.max(48, Math.min(window.innerWidth - 48, pointer.x));
    const baseY = Math.max(48, Math.min(window.innerHeight - 96, pointer.y));

    chars.forEach((ch, idx) => {
      const delay = idx * 140;
      setTimeout(() => {
        const jitterX = idx === 0 ? 0 : (idx - (chars.length - 1) * 0.5) * 64;
        const jitterY = idx === 0 ? 0 : (Math.random() - 0.5) * 28;
        world.spawnCharacter(ch, baseX + jitterX, baseY + jitterY);
        pulseToken(ch);
      }, delay);
    });
  }

  // ---------------------------------------------------------------------------
  // Built-in English Pinyin Buffer UI
  // ---------------------------------------------------------------------------

  function findPinyinMatches(buf) {
    const key = buf.toLowerCase();
    if (!key) return [];
    if (PINYIN_CANDIDATES[key]) return PINYIN_CANDIDATES[key];
    // Prefix match preview
    const prefixKey = Object.keys(PINYIN_CANDIDATES).find((k) => k.startsWith(key));
    return prefixKey ? PINYIN_CANDIDATES[prefixKey] : [];
  }

  function renderPinyinBuffer() {
    if (!pinyinBuffer) {
      pinyinEl.classList.remove("visible");
      pinyinEl.textContent = "";
      return;
    }
    const matches = findPinyinMatches(pinyinBuffer);
    if (matches.length > 1) {
      const hint = matches.map((c, i) => `${i + 1}${c}`).join(" ");
      pinyinEl.textContent = `${pinyinBuffer} · ${hint}`;
    } else if (matches.length === 1) {
      pinyinEl.textContent = `${pinyinBuffer} · ${matches[0]}`;
    } else {
      pinyinEl.textContent = pinyinBuffer;
    }
    pinyinEl.classList.add("visible");
  }

  function commitPinyinCandidate(choiceIndex = 0) {
    if (!pinyinBuffer) return false;
    const matches = findPinyinMatches(pinyinBuffer);
    pinyinBuffer = "";
    renderPinyinBuffer();
    if (matches.length > 0) {
      const chosen = matches[Math.min(choiceIndex, matches.length - 1)];
      spawnAtCursor(chosen);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Pointer Interactions: Brush Painting & Shift+Drag Water Splash
  // ---------------------------------------------------------------------------

  function isInteractiveChrome(target) {
    if (!target || !target.closest) return false;
    return Boolean(
      target.closest(".brand-header") ||
      target.closest(".top-controls") ||
      target.closest(".bottom-dock")
    );
  }

  stage.addEventListener("pointerdown", (e) => {
    ensureFirstGestureAudio(e);

    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.prevX = e.clientX;
    pointer.prevY = e.clientY;
    syncImePosition(e.clientX, e.clientY);
    world.setCursor(e.clientX, e.clientY);

    if (isInteractiveChrome(e.target)) {
      return;
    }

    if (e.button !== 0 && e.pointerType === "mouse") return;

    pointer.down = true;
    pointer.pointerId = e.pointerId;
    pointer.stageX = e.clientX;
    pointer.stageY = e.clientY;
    pointer.stageClickedAt = performance.now();

    focusIme();

    const normX = e.clientX / Math.max(1, window.innerWidth);
    const normY = e.clientY / Math.max(1, window.innerHeight);

    if (e.shiftKey) {
      fluid.splashWater(normX, normY, (Math.random() - 0.5) * 28, (Math.random() - 0.5) * 28, 0.0022, 0.34);
      audio.onBrushMove(18, true, activePigment, normX, normY);
    } else {
      const pig = getBrushPigmentVector();
      fluid.splat(
        normX,
        normY,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        [pig[0] * 0.55, pig[1] * 0.55, pig[2] * 0.55, pig[3] * 0.55],
        0.00058
      );
    }
  });

  window.addEventListener("pointermove", (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const dx = x - pointer.prevX;
    const dy = y - pointer.prevY;
    const dist = Math.hypot(dx, dy);

    pointer.x = x;
    pointer.y = y;
    world.setCursor(x, y);
    syncImePosition(x, y);

    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);

    if (pointer.down) {
      const steps = Math.min(14, Math.max(1, Math.ceil(dist / 7)));
      const velX = dx * 9.6;
      const velY = dy * 9.6;

      if (e.shiftKey) {
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const sx = (pointer.prevX + dx * t) / w;
          const sy = (pointer.prevY + dy * t) / h;
          fluid.splashWater(sx, sy, velX, velY, 0.0021, 0.34);
        }
        // Pouring water over active fires creates steam & dampens flames
        for (const f of world.fires) {
          if (Math.hypot(f.x - x, f.y - y) < 68) {
            f.power = Math.max(0.1, f.power - 0.045);
            fluid.splat(x / w, (y - 16) / h, (Math.random() - 0.5) * 40, -110, [0.15, 0, 0, 0.55], 0.0016);
          }
        }
        audio.onBrushMove(dist, true, activePigment, x / w, y / h);
      } else {
        const pig = getBrushPigmentVector();
        // Calligraphy brush pressure (毛笔提按): slower movement = fuller stroke, faster = crisp hairline
        const speedNorm = Math.min(1, dist / 42);
        const radius = 0.00074 - speedNorm * 0.00034;
        const densityScale = (0.78 - speedNorm * 0.22) / Math.sqrt(steps);
        const strokePigment = [
          pig[0] * densityScale,
          pig[1] * densityScale,
          pig[2] * densityScale,
          pig[3] * densityScale
        ];

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const sx = (pointer.prevX + dx * t) / w;
          const sy = (pointer.prevY + dy * t) / h;
          fluid.splat(sx, sy, velX, velY, strokePigment, radius);
        }
        audio.onBrushMove(dist, false, activePigment, x / w, y / h);
      }
    } else if (dist > 2.2) {
      // Gentle ambient air wake as cursor glides across Xuan paper
      fluid.splat(x / w, y / h, dx * 2.4, dy * 2.4, null, 0.00095);
    }

    pointer.prevX = x;
    pointer.prevY = y;
  });

  function endPointerStroke() {
    if (!pointer.down) return;
    pointer.down = false;
    pointer.pointerId = null;
    audio.onBrushEnd();
  }

  window.addEventListener("pointerup", endPointerStroke);
  window.addEventListener("pointercancel", endPointerStroke);
  window.addEventListener("blur", endPointerStroke);

  // ---------------------------------------------------------------------------
  // Keyboard, OS Chinese IME & English Pinyin Fallback
  // ---------------------------------------------------------------------------

  imeInput.addEventListener("compositionstart", () => {
    isComposing = true;
    if (pinyinBuffer) {
      pinyinBuffer = "";
      renderPinyinBuffer();
    }
  });

  imeInput.addEventListener("compositionend", (e) => {
    isComposing = false;
    justComposedAt = performance.now();
    const committed = (e.data || imeInput.value || "").trim();
    imeInput.value = "";
    if (committed) {
      spawnAtCursor(committed);
    }
  });

  imeInput.addEventListener("input", () => {
    if (isComposing) return;
    const raw = imeInput.value;
    imeInput.value = "";
    if (!raw) return;

    // Ignore duplicate input event right after IME compositionend
    if (performance.now() - justComposedAt < 45) return;

    // Direct CJK or non-ASCII character input / paste
    if (/[^\x00-\x7F]/.test(raw)) {
      pinyinBuffer = "";
      renderPinyinBuffer();
      spawnAtCursor(raw.replace(/[\x00-\x7F]/g, ""));
      return;
    }

    // ASCII letters typed in English keyboard mode -> feed built-in Pinyin buffer
    const letters = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (letters) {
      pinyinBuffer = (pinyinBuffer + letters).slice(0, 12);
      renderPinyinBuffer();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    ensureFirstGestureAudio(e);

    if (isComposing || e.keyCode === 229) {
      return;
    }

    // Handle active English Pinyin buffer controls
    if (pinyinBuffer.length > 0) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        imeInput.value = "";
        commitPinyinCandidate(0);
        return;
      }
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        const matches = findPinyinMatches(pinyinBuffer);
        const choice = Number(e.key) - 1;
        if (choice < matches.length) {
          e.preventDefault();
          imeInput.value = "";
          commitPinyinCandidate(choice);
          return;
        }
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        pinyinBuffer = pinyinBuffer.slice(0, -1);
        renderPinyinBuffer();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        pinyinBuffer = "";
        renderPinyinBuffer();
        return;
      }
    }

    // Pigment shortcuts: 1 墨 · 2 朱 · 3 青
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      e.preventDefault();
      setPigment(Number(e.key));
      return;
    }

    // Ensure hidden textarea receives keystrokes for OS Chinese IME
    if (e.key.length === 1 && document.activeElement !== imeInput) {
      focusIme();
    }
  });

  // ---------------------------------------------------------------------------
  // UI Chrome Controls: Seal, Dock Tokens, Pigments, 自在 / 有声 / 留影
  // ---------------------------------------------------------------------------

  sealStamp.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureFirstGestureAudio(e);
    audio.playCharSound("山", 0.12);
    world.playIntro();
    focusIme();
  });

  charBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".char-token");
    if (!btn) return;
    e.stopPropagation();
    ensureFirstGestureAudio(e);

    const ch = btn.dataset.char;
    if (!ch) return;

    const pos = pickHarmoniousPosition(ch);
    world.spawnCharacter(ch, pos.x, pos.y);
    pulseToken(ch);
    focusIme();
  });

  for (const item of pigmentItems) {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      ensureFirstGestureAudio(e);
      const idx = Number(item.dataset.pigment);
      if (idx >= 1 && idx <= 3) {
        setPigment(idx);
      }
      focusIme();
    });
  }

  btnAuto.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureFirstGestureAudio(e);
    autoMode = !autoMode;
    btnAuto.classList.toggle("active", autoMode);
    if (autoMode) {
      autoTimer = 0.45;
    }
    focusIme();
  });

  btnSound.addEventListener("click", (e) => {
    e.stopPropagation();
    hasAutoUnlockedAudio = true;
    const enabled = audio.toggle();
    btnSound.classList.toggle("active", enabled);
    focusIme();
  });

  btnSnap.addEventListener("click", (e) => {
    e.stopPropagation();
    ensureFirstGestureAudio(e);
    btnSnap.classList.add("active");
    setTimeout(() => btnSnap.classList.remove("active"), 380);
    capturePaintingSnapshot();
    focusIme();
  });

  function capturePaintingSnapshot() {
    // Ensure fresh WebGL & 2D frames before reading pixels
    fluid.step(0.001);
    world.render();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const outW = Math.floor(window.innerWidth * dpr);
    const outH = Math.floor(window.innerHeight * dpr);

    const snapCanvas = document.createElement("canvas");
    snapCanvas.width = outW;
    snapCanvas.height = outH;
    const ctx = snapCanvas.getContext("2d");

    // 1. Xuan paper & Navier-Stokes mineral fluid layer
    ctx.drawImage(fluidCanvas, 0, 0, outW, outH);

    // 2. Living ink entities layer
    ctx.drawImage(worldCanvas, 0, 0, outW, outH);

    // 3. Paint traditional Cinnabar Seal ("墨生") & vertical poem onto scroll
    ctx.save();
    ctx.scale(dpr, dpr);

    const sx = 24;
    const sy = 24;
    const sw = 44;
    const sh = 84;
    ctx.fillStyle = "#9e1717";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(sx, sy, sw, sh, 5);
    } else {
      ctx.rect(sx, sy, sw, sh);
    }
    ctx.fill();

    ctx.strokeStyle = "rgba(250, 240, 226, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 3.5, sy + 3.5, sw - 7, sh - 7);

    ctx.fillStyle = "#f6f1e7";
    ctx.font = '600 24px "STKaiti", "Kaiti SC", "KaiTi", "Ma Shan Zheng", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("墨", sx + sw * 0.5, sy + 26);
    ctx.fillText("生", sx + sw * 0.5, sy + 58);

    // Vertical classical poem on right margin if visible
    if (currentPoem) {
      const isNight = world.nightMix > 0.5;
      ctx.fillStyle = isNight ? "rgba(232, 230, 220, 0.68)" : "rgba(42, 40, 36, 0.66)";
      ctx.font = '15px "STKaiti", "Kaiti SC", "KaiTi", "Ma Shan Zheng", serif';
      const chars = Array.from(currentPoem);
      const stepY = 21;
      const startY = window.innerHeight * 0.5 - ((chars.length - 1) * stepY) * 0.5;
      const rx = window.innerWidth - 36;
      chars.forEach((c, i) => {
        ctx.fillText(c, rx, startY + i * stepY);
      });
    }
    ctx.restore();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const link = document.createElement("a");
    link.download = `墨生-字即世界-${stamp}.png`;
    link.href = snapCanvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // ---------------------------------------------------------------------------
  // Autonomous Contemplation Mode ([ 自在 ])
  // ---------------------------------------------------------------------------

  function stepAutonomousMode(dt) {
    if (!autoMode) return;
    autoTimer -= dt;
    if (autoTimer > 0) return;

    autoTimer = 3.2 + Math.random() * 1.6;
    const ch = AUTO_SEQUENCE[autoStepIndex % AUTO_SEQUENCE.length];
    autoStepIndex++;

    // Gentle calligraphy ink breeze before spawning
    const nx = 0.22 + Math.random() * 0.56;
    const ny = 0.25 + Math.random() * 0.45;
    const angle = Math.random() * Math.PI * 2;
    const pig = Math.random() < 0.22 ? [0.05, 0.85, 0, 0] : [0.75, 0, 0, 0];
    fluid.splat(nx, ny, Math.cos(angle) * 95, Math.sin(angle) * 95, pig, 0.0012);

    const pos = pickHarmoniousPosition(ch);
    world.spawnCharacter(ch, pos.x, pos.y);
    pulseToken(ch);
  }

  // ---------------------------------------------------------------------------
  // Resize & Main Animation Loop
  // ---------------------------------------------------------------------------

  window.addEventListener("resize", () => {
    fluid.resize();
    world.resize();
  });

  let lastFrameTime = performance.now();

  function animate(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    stepAutonomousMode(dt);
    world.step(dt);
    fluid.step(dt);
    world.render();

    requestAnimationFrame(animate);
  }

  // Launch opening "墨 · 生" liquefaction ceremony once fonts settle (with fast fallback)
  syncImePosition(pointer.x, pointer.y);
  requestAnimationFrame(animate);

  let introPlayed = false;
  function triggerInitialIntro() {
    if (introPlayed) return;
    introPlayed = true;
    world.playIntro();
    focusIme();
  }

  if (document.fonts && document.fonts.ready) {
    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 220))
    ]).then(triggerInitialIntro);
  } else {
    setTimeout(triggerInitialIntro, 80);
  }
})();
