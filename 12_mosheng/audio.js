/**
 * 墨生 · 字即世界 — Procedural WebAudio Guqin, Guzheng & Natural Soundscape Engine
 *
 * Tuned to D-Major / B-Minor Pentatonic (宫商角徵羽: D E F# A B) matching original video acoustics.
 */
(function (global) {
  "use strict";

  // D Pentatonic across octaves (Hz)
  const PENTA = [
    73.42,  // D2 (0)
    82.41,  // E2 (1)
    92.50,  // F#2 (2)
    110.00, // A2 (3)
    123.47, // B2 (4)
    146.83, // D3 (5)
    164.81, // E3 (6)
    185.00, // F#3 (7)
    220.00, // A3 (8)
    246.94, // B3 (9)
    293.66, // D4 (10)
    329.63, // E4 (11)
    369.99, // F#4 (12)
    440.00, // A4 (13)
    493.88, // B4 (14)
    587.33, // D5 (15)
    659.25, // E5 (16)
    739.99, // F#5 (17)
    880.00  // A5 (18)
  ];

  class InkAudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = false;
      this.initialized = false;
      this.masterGain = null;
      this.reverbNode = null;
      this.noiseBuffer = null;

      // Continuous environmental beds
      this.windGain = null;
      this.windFilter = null;
      this.rainGain = null;
      this.fireGain = null;
      this.brushGain = null;
      this.brushFilter = null;

      this._lastBrushNoteAt = 0;
      this._crackleTimer = 0;
      this._ambientTimer = 3.5;
    }

    unlock(enableSound = true) {
      if (!this.initialized) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        this._buildGraph();
        this.initialized = true;
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      if (enableSound) {
        this.setEnabled(true);
      }
      return this.enabled;
    }

    setEnabled(flag) {
      if (!this.initialized && flag) {
        this.unlock(true);
        return;
      }
      this.enabled = !!flag;
      if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        if (this.enabled && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(this.enabled ? 0.78 : 0.0001, now, 0.08);
      }
    }

    toggle() {
      if (!this.initialized) {
        this.unlock(true);
        return true;
      }
      this.setEnabled(!this.enabled);
      return this.enabled;
    }

    _buildGraph() {
      const ctx = this.ctx;

      // Compressor + Master
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.008;
      comp.release.value = 0.25;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.0001;
      comp.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      this.dryBus = ctx.createGain();
      this.dryBus.gain.value = 0.72;
      this.dryBus.connect(comp);

      // Algorithmic stereo mountain-hall impulse response (3.2s)
      this.reverbNode = ctx.createConvolver();
      this.reverbNode.buffer = this._createReverbBuffer(3.2, 2.5);
      this.wetBus = ctx.createGain();
      this.wetBus.gain.value = 0.52;
      this.reverbNode.connect(this.wetBus);
      this.wetBus.connect(comp);

      // Shared 4-second pink-ish noise buffer
      this.noiseBuffer = this._createPinkNoiseBuffer(4.0);

      // Continuous Wind Bed
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = "bandpass";
      this.windFilter.frequency.value = 340;
      this.windFilter.Q.value = 1.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.0;
      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.dryBus);
      this.windGain.connect(this.reverbNode);
      windSrc.start();

      // Continuous Rain Bed
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = "bandpass";
      rainFilter.frequency.value = 1650;
      rainFilter.Q.value = 0.7;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0.0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.dryBus);
      rainSrc.start();

      // Continuous Brush / Water Swish Bed
      const brushSrc = ctx.createBufferSource();
      brushSrc.buffer = this.noiseBuffer;
      brushSrc.loop = true;
      this.brushFilter = ctx.createBiquadFilter();
      this.brushFilter.type = "bandpass";
      this.brushFilter.frequency.value = 520;
      this.brushFilter.Q.value = 2.0;
      this.brushGain = ctx.createGain();
      this.brushGain.gain.value = 0.0;
      brushSrc.connect(this.brushFilter);
      this.brushFilter.connect(this.brushGain);
      this.brushGain.connect(this.dryBus);
      this.brushGain.connect(this.reverbNode);
      brushSrc.start();
    }

    _createReverbBuffer(seconds, decay) {
      const ctx = this.ctx;
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const white = Math.random() * 2 - 1;
          lp = lp * 0.72 + white * 0.28;
          data[i] = lp * Math.pow(1 - t, decay);
        }
      }
      return buf;
    }

    _createPinkNoiseBuffer(seconds) {
      const ctx = this.ctx;
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const out = buf.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
          b6 = white * 0.115926;
        }
      }
      return buf;
    }

    /**
     * Synthesize an expressive Guqin / Guzheng plucked string note
     */
    pluckGuqin(freq, opts = {}) {
      if (!this.enabled || !this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime + (opts.delay || 0);
      const dur = opts.duration || 3.4;
      const vol = opts.volume !== undefined ? opts.volume : 0.22;
      const glide = opts.glide || 1.0; // subtle pitch bend (吟猱)
      const brightness = opts.brightness || 4.2;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sawtooth";
      osc2.type = "triangle";

      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.0018, now);
      if (glide !== 1.0) {
        osc1.frequency.exponentialRampToValueAtTime(freq * glide, now + Math.min(0.45, dur * 0.3));
        osc2.frequency.exponentialRampToValueAtTime(freq * glide * 1.0015, now + Math.min(0.45, dur * 0.3));
      }

      // Woody body resonance low-pass envelope
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 2.2;
      filter.frequency.setValueAtTime(Math.min(7500, freq * brightness * 2.2), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(160, freq * 1.45), now + dur * 0.72);

      // Subtle stereo pan
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan && opts.pan !== undefined) {
        pan.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, opts.pan)), now);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(vol * 0.42, now + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      // Fingernail / plectrum transient click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = "sine";
      clickOsc.frequency.setValueAtTime(freq * 4.0, now);
      clickGain.gain.setValueAtTime(vol * 0.28, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc1.connect(filter);
      osc2.connect(filter);
      clickOsc.connect(clickGain);
      clickGain.connect(filter);
      filter.connect(gain);

      if (pan) {
        gain.connect(pan);
        pan.connect(this.dryBus);
        pan.connect(this.reverbNode);
      } else {
        gain.connect(this.dryBus);
        gain.connect(this.reverbNode);
      }

      osc1.start(now);
      osc2.start(now);
      clickOsc.start(now);
      osc1.stop(now + dur + 0.05);
      osc2.stop(now + dur + 0.05);
      clickOsc.stop(now + 0.05);
    }

    /**
     * Crystalline Guqin harmonic overtone (泛音)
     */
    playHarmonic(freq, opts = {}) {
      if (!this.enabled || !this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime + (opts.delay || 0);
      const dur = opts.duration || 2.8;
      const vol = opts.volume !== undefined ? opts.volume : 0.14;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 2.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      osc2.connect(g2);
      g2.connect(gain);
      osc1.connect(gain);

      gain.connect(this.dryBus);
      gain.connect(this.reverbNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur + 0.05);
      osc2.stop(now + dur + 0.05);
    }

    /**
     * Trigger character-specific musical motif & sound effect
     */
    playCharSound(char, normX = 0.5) {
      if (!this.enabled || !this.ctx) return;
      const pan = (normX - 0.5) * 1.4;

      switch (char) {
        case "山": {
          // Deep resonant valley Guqin fifths (exact match to 00:04-00:09)
          this.pluckGuqin(PENTA[0], { volume: 0.28, duration: 4.5, brightness: 3.4, pan });
          this.pluckGuqin(PENTA[3], { delay: 0.09, volume: 0.22, duration: 4.2, brightness: 3.6, pan });
          this.pluckGuqin(PENTA[5], { delay: 0.21, volume: 0.18, duration: 3.8, glide: 0.985, pan });
          break;
        }
        case "月": {
          // Luminous moonlight harmonics
          this.pluckGuqin(PENTA[5], { volume: 0.18, duration: 4.0, pan });
          this.playHarmonic(PENTA[12], { delay: 0.08, volume: 0.15, duration: 3.6 });
          this.playHarmonic(PENTA[14], { delay: 0.24, volume: 0.13, duration: 3.8 });
          this.playHarmonic(PENTA[15], { delay: 0.42, volume: 0.11, duration: 4.0 });
          break;
        }
        case "竹": {
          // Crisp hollow bamboo knock + clean mid pentatonic chord
          this._playWoodTap(420, 0.16, pan);
          this._playWoodTap(640, 0.11, pan, 0.07);
          this.pluckGuqin(PENTA[7], { delay: 0.04, volume: 0.20, duration: 2.8, brightness: 5.0, pan });
          this.pluckGuqin(PENTA[9], { delay: 0.14, volume: 0.16, duration: 2.8, brightness: 5.0, pan });
          break;
        }
        case "梅": {
          // Delicate cascading Guzheng grace-note bloom (matches 00:15)
          [9, 10, 12, 14, 17].forEach((idx, i) => {
            this.pluckGuqin(PENTA[idx], {
              delay: i * 0.065,
              volume: 0.15 - i * 0.015,
              duration: 2.6,
              brightness: 5.5,
              pan
            });
          });
          break;
        }
        case "鱼": {
          // Liquid water droplet + warm gliding string (matches 00:18)
          this._playWaterDrop(580, pan);
          this.pluckGuqin(PENTA[6], { delay: 0.03, volume: 0.21, duration: 3.0, glide: 1.035, pan });
          this.pluckGuqin(PENTA[10], { delay: 0.16, volume: 0.15, duration: 2.6, pan });
          break;
        }
        case "鸟": {
          // Flute-like bird chirps + airy high pluck (matches 00:19-00:21)
          this._playBirdChirp(1180, 1560, 0.0, pan);
          this._playBirdChirp(1420, 1120, 0.14, pan * 0.7);
          this.pluckGuqin(PENTA[13], { delay: 0.05, volume: 0.16, duration: 2.4, pan });
          this.pluckGuqin(PENTA[15], { delay: 0.18, volume: 0.14, duration: 2.4, pan });
          break;
        }
        case "蝶": {
          // Fluttering grace trill
          this.playHarmonic(PENTA[14], { volume: 0.13, duration: 2.2 });
          this.playHarmonic(PENTA[16], { delay: 0.09, volume: 0.12, duration: 2.2 });
          this.playHarmonic(PENTA[17], { delay: 0.18, volume: 0.11, duration: 2.5 });
          break;
        }
        case "龙": {
          // Majestic deep dragon breath + sweeping Guqin glissando (matches 00:34-00:36)
          this._playDragonRoar();
          [0, 2, 3, 5, 7, 8, 10, 12].forEach((idx, i) => {
            this.pluckGuqin(PENTA[idx], {
              delay: i * 0.055,
              volume: 0.20,
              duration: 4.2,
              brightness: 4.8,
              pan: (i / 7 - 0.5) * 1.1
            });
          });
          break;
        }
        case "风": {
          // Sweeping wind swell + open strings (matches 00:30-00:33)
          this.pluckGuqin(PENTA[2], { volume: 0.20, duration: 3.8, pan });
          this.pluckGuqin(PENTA[7], { delay: 0.12, volume: 0.17, duration: 3.6, glide: 1.02, pan });
          this._gustWindBurst();
          break;
        }
        case "雨": {
          this._playWaterDrop(740, pan);
          this._playWaterDrop(520, -pan * 0.5, 0.11);
          this.playHarmonic(PENTA[10], { delay: 0.05, volume: 0.13, duration: 3.0 });
          this.playHarmonic(PENTA[12], { delay: 0.20, volume: 0.11, duration: 3.0 });
          break;
        }
        case "雪": {
          this.playHarmonic(PENTA[15], { volume: 0.12, duration: 3.5 });
          this.playHarmonic(PENTA[17], { delay: 0.18, volume: 0.10, duration: 3.8 });
          this.playHarmonic(PENTA[14], { delay: 0.36, volume: 0.09, duration: 4.0 });
          break;
        }
        case "火": {
          // Warm hearth chord + ignition whoosh (matches 00:51)
          this._playFireWhoosh(pan);
          this.pluckGuqin(PENTA[3], { volume: 0.24, duration: 3.8, pan });
          this.pluckGuqin(PENTA[7], { delay: 0.08, volume: 0.20, duration: 3.5, pan });
          this.pluckGuqin(PENTA[10], { delay: 0.18, volume: 0.16, duration: 3.4, pan });
          break;
        }
        case "水": {
          this._playWaterDrop(460, pan);
          this._playWaterDrop(690, pan * 0.6, 0.09);
          this._playWaterDrop(860, -pan * 0.4, 0.19);
          this.pluckGuqin(PENTA[5], { delay: 0.04, volume: 0.20, duration: 3.4, glide: 0.98, pan });
          break;
        }
        case "雷": {
          // Sharp thunder crack + deep rolling sub rumble + dramatic low Guqin strike (matches 00:58)
          this._playThunder(pan);
          this.pluckGuqin(PENTA[0], { delay: 0.02, volume: 0.30, duration: 4.6, brightness: 6.0, pan });
          this.pluckGuqin(PENTA[4], { delay: 0.08, volume: 0.22, duration: 4.0, brightness: 5.2, pan });
          break;
        }
        case "夜": {
          // Ascending nocturnal harmonic arpeggio (exact match to 00:45!)
          [4, 7, 9, 12, 14, 17].forEach((idx, i) => {
            if (i < 2) {
              this.pluckGuqin(PENTA[idx], { delay: i * 0.10, volume: 0.22, duration: 4.5 });
            } else {
              this.playHarmonic(PENTA[idx], { delay: i * 0.11, volume: 0.14, duration: 4.2 });
            }
          });
          break;
        }
        case "昼": {
          // Warm sunrise pentatonic bloom
          [0, 5, 7, 10, 13, 15].forEach((idx, i) => {
            this.pluckGuqin(PENTA[idx], { delay: i * 0.09, volume: 0.19 - i * 0.015, duration: 4.0 });
          });
          break;
        }
        case "空": {
          // Zen temple singing bowl dissolving into stillness
          this.playHarmonic(PENTA[5], { volume: 0.20, duration: 5.2 });
          this.playHarmonic(PENTA[10], { delay: 0.05, volume: 0.14, duration: 5.0 });
          this.playHarmonic(PENTA[15], { delay: 0.12, volume: 0.09, duration: 4.8 });
          break;
        }
        default: {
          const idx = Math.abs(char.charCodeAt(0)) % 14;
          this.pluckGuqin(PENTA[idx], { volume: 0.20, duration: 3.2, pan });
          break;
        }
      }
    }

    /**
     * Continuous brush/water drag sonic feedback
     */
    onBrushMove(speed, isWater, pigmentIndex, normX, normY) {
      if (!this.enabled || !this.ctx || !this.brushGain) return;
      const now = this.ctx.currentTime;
      const clamped = Math.min(1.0, speed / 38);
      const freq = isWater ? 780 + clamped * 650 : 320 + clamped * 480 + (1 - normY) * 240;
      this.brushFilter.frequency.setTargetAtTime(freq, now, 0.04);
      this.brushGain.gain.setTargetAtTime(clamped * (isWater ? 0.22 : 0.13), now, 0.04);

      // Occasional expressive string / droplet note while painting
      if (clamped > 0.35 && now - this._lastBrushNoteAt > (isWater ? 0.22 : 0.32)) {
        this._lastBrushNoteAt = now;
        const scaleIdx = Math.max(0, Math.min(PENTA.length - 1, Math.floor((1.0 - normY) * 14)));
        if (isWater) {
          this._playWaterDrop(420 + (1 - normY) * 480, (normX - 0.5) * 1.2);
        } else if (pigmentIndex === 2) {
          // Cinnabar sings with lyrical vibrato
          this.pluckGuqin(PENTA[scaleIdx + 2] || PENTA[scaleIdx], {
            volume: 0.11,
            duration: 2.4,
            glide: 1.022,
            pan: (normX - 0.5) * 1.2
          });
        } else {
          this.playHarmonic(PENTA[scaleIdx], {
            volume: 0.08,
            duration: 2.1
          });
        }
      }
    }

    onBrushEnd() {
      if (!this.ctx || !this.brushGain) return;
      this.brushGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.12);
    }

    /**
     * Per-frame continuous soundscape modulation based on active weather & fire
     */
    updateEnvironment(dt, envState) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;

      // Wind bed
      const windLevel = Math.min(1.0, Math.abs(envState.windStrength || 0));
      if (this.windGain && this.windFilter) {
        this.windGain.gain.setTargetAtTime(windLevel * 0.26, now, 0.25);
        this.windFilter.frequency.setTargetAtTime(240 + windLevel * 460 + Math.sin(now * 0.9) * 65, now, 0.2);
      }

      // Rain bed
      const rainLevel = Math.min(1.0, envState.rainIntensity || 0);
      if (this.rainGain) {
        this.rainGain.gain.setTargetAtTime(rainLevel * 0.16, now, 0.35);
      }

      // Fire crackle stochastic micro-pops
      if (envState.fireCount > 0) {
        this._crackleTimer -= dt;
        if (this._crackleTimer <= 0) {
          this._crackleTimer = 0.08 + Math.random() * 0.26;
          this._playFireCrackle(Math.min(1, envState.fireCount * 0.5));
        }
      }

      // Sparse meditative ambient harmonic note when creatures inhabit the world
      if (envState.entityCount > 2) {
        this._ambientTimer -= dt;
        if (this._ambientTimer <= 0) {
          this._ambientTimer = 4.5 + Math.random() * 5.5;
          const pool = envState.isNight ? [5, 7, 9, 12, 14] : [3, 5, 7, 10, 12];
          const idx = pool[Math.floor(Math.random() * pool.length)];
          this.playHarmonic(PENTA[idx], { volume: 0.055, duration: 3.8 });
        }
      }
    }

    _playWoodTap(freq, vol, pan = 0, delay = 0) {
      const ctx = this.ctx;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.58, now + 0.06);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.dryBus);
      gain.connect(this.reverbNode);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    _playWaterDrop(freq, pan = 0, delay = 0) {
      const ctx = this.ctx;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.72, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.48, now + 0.085);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.reverbNode);
      gain.connect(this.dryBus);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    _playBirdChirp(f1, f2, delay = 0, pan = 0) {
      const ctx = this.ctx;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f1, now);
      osc.frequency.exponentialRampToValueAtTime(f2, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(f1 * 1.12, now + 0.16);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.085, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
      osc.connect(gain);
      gain.connect(this.reverbNode);
      gain.connect(this.dryBus);
      osc.start(now);
      osc.stop(now + 0.22);
    }

    _gustWindBurst() {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 2.2;
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(680, now + 1.1);
      filter.frequency.exponentialRampToValueAtTime(260, now + 3.4);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.dryBus);
      gain.connect(this.reverbNode);
      src.start(now);
      src.stop(now + 3.7);
    }

    _playDragonRoar() {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      // Deep resonant sub-bass + breathy formant sweep
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(68, now);
      osc.frequency.exponentialRampToValueAtTime(92, now + 0.55);
      osc.frequency.exponentialRampToValueAtTime(54, now + 2.4);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 3.5;
      filter.frequency.setValueAtTime(180, now);
      filter.frequency.exponentialRampToValueAtTime(460, now + 0.6);
      filter.frequency.exponentialRampToValueAtTime(120, now + 2.5);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.dryBus);
      gain.connect(this.reverbNode);
      osc.start(now);
      osc.stop(now + 2.7);
    }

    _playFireWhoosh() {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.7);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.dryBus);
      src.start(now);
      src.stop(now + 0.8);
    }

    _playFireCrackle(scale = 0.5) {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800 + Math.random() * 2200;
      filter.Q.value = 3.0;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05 * scale, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.dryBus);
      src.start(now, Math.random() * 2.0, 0.04);
    }

    _playThunder() {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      // Sharp lightning crack + rolling low-pass thunder
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 1.8;
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(165, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(75, now + 2.8);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.dryBus);
      gain.connect(this.reverbNode);
      src.start(now);
      src.stop(now + 3.1);
    }
  }

  global.InkAudioEngine = InkAudioEngine;
})(window);
