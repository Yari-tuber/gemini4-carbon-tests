// Counter-Strike: Dust II — Spatial WebAudio Synthesizer & Radio Announcer

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.reverbConvolver = null;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.listenerYaw = 0;
    this.muted = false;
    this.volume = 0.78;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;

    // Subtle compressor so AWP + HE grenades punch hard without clipping
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.18;

    this.masterGain.connect(compressor);
    compressor.connect(this.ctx.destination);

    // Pre-generate 2 seconds of white noise buffer
    const sampleRate = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2.0, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Desert canyon impulse response for realistic exterior/tunnel slapback
    this.reverbConvolver = this.ctx.createConvolver();
    const irLen = Math.floor(sampleRate * 0.65);
    const irBuf = this.ctx.createBuffer(2, irLen, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const chData = irBuf.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        chData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.4) * 0.35;
      }
    }
    this.reverbConvolver.buffer = irBuf;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.22;
    this.reverbConvolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  updateListener(pos, yaw) {
    this.listenerPos.x = pos.x;
    this.listenerPos.y = pos.y;
    this.listenerPos.z = pos.z;
    this.listenerYaw = yaw;
  }

  // Create stereo pan + distance gain node for 3D world sounds
  _createSpatialBus(worldPos, maxDist = 65, refDist = 5) {
    if (!this.ctx) return null;
    const out = this.ctx.createGain();
    if (!worldPos) {
      out.gain.value = 1.0;
      out.connect(this.masterGain);
      return out;
    }

    const dx = worldPos.x - this.listenerPos.x;
    const dy = worldPos.y - this.listenerPos.y;
    const dz = worldPos.z - this.listenerPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist) return null;

    const atten = Math.max(0, Math.min(1, refDist / Math.max(refDist, dist) * (1 - dist / maxDist * 0.65)));
    out.gain.value = atten;

    // Compute left/right pan relative to listener camera right vector
    const rightX = Math.cos(this.listenerYaw);
    const rightZ = -Math.sin(this.listenerYaw);
    const horizDist = Math.max(0.5, Math.hypot(dx, dz));
    const panVal = Math.max(-0.92, Math.min(0.92, (dx * rightX + dz * rightZ) / horizDist));

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = panVal;
      out.connect(panner);
      panner.connect(this.masterGain);
      panner.connect(this.reverbConvolver);
    } else {
      out.connect(this.masterGain);
    }
    return out;
  }

  _noiseBurst(dest, startTime, duration, filterType, freq, q, peakGain, endFreq = null) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, startTime);
    if (endFreq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startTime + duration);
    }
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(peakGain, startTime + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(dest);

    src.start(startTime, Math.random() * 0.5);
    src.stop(startTime + duration + 0.02);
  }

  _tone(dest, startTime, duration, type, startFreq, endFreq, peakGain) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq && endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peakGain, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(g);
    g.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  playGunshot(weaponId, worldPos = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, weaponId === 'awp' ? 110 : 80, 7);
    if (!bus) return;
    const t = this.ctx.currentTime;

    switch (weaponId) {
      case 'ak47':
        // Iconic AK-47 metallic bark + heavy low-mid punch
        this._tone(bus, t, 0.13, 'sawtooth', 165, 42, 0.72);
        this._noiseBurst(bus, t, 0.22, 'bandpass', 1150, 0.9, 0.95, 320);
        this._noiseBurst(bus, t, 0.06, 'highpass', 2600, 1.4, 0.52);
        // AK bolt carrier clack
        this._tone(bus, t + 0.035, 0.04, 'triangle', 1950, 920, 0.16);
        if (!worldPos) bus.connect(this.reverbConvolver);
        break;

      case 'm4a1s':
      case 'usp': {
        // Crisp suppressed thwip + gas hiss
        const p = weaponId === 'm4a1s' ? 1.0 : 0.82;
        this._tone(bus, t, 0.065, 'sine', 240, 68, 0.42 * p);
        this._noiseBurst(bus, t, 0.095, 'bandpass', 2200, 1.8, 0.55 * p, 900);
        this._noiseBurst(bus, t + 0.01, 0.05, 'highpass', 4200, 1.2, 0.28 * p);
        break;
      }

      case 'awp':
        // Earth-shattering AWP cannon boom + canyon echo + bolt cycle
        this._tone(bus, t, 0.36, 'sawtooth', 120, 26, 1.0);
        this._tone(bus, t, 0.22, 'sine', 78, 28, 0.95);
        this._noiseBurst(bus, t, 0.52, 'lowpass', 1800, 0.8, 1.15, 180);
        this._noiseBurst(bus, t, 0.14, 'highpass', 2100, 1.1, 0.75);
        if (!worldPos) {
          bus.connect(this.reverbConvolver);
          // Bolt-action chk-chk 0.38s later
          this._noiseBurst(bus, t + 0.42, 0.06, 'bandpass', 3100, 3.0, 0.28);
          this._tone(bus, t + 0.43, 0.05, 'triangle', 1400, 2100, 0.14);
          this._noiseBurst(bus, t + 0.68, 0.06, 'bandpass', 2600, 3.0, 0.30);
          this._tone(bus, t + 0.69, 0.05, 'triangle', 2000, 1250, 0.15);
        }
        break;

      case 'ssg08':
        this._tone(bus, t, 0.20, 'sawtooth', 190, 48, 0.75);
        this._noiseBurst(bus, t, 0.28, 'bandpass', 1550, 1.1, 0.85, 380);
        if (!worldPos) {
          this._noiseBurst(bus, t + 0.34, 0.05, 'bandpass', 3200, 3.2, 0.22);
          this._noiseBurst(bus, t + 0.54, 0.05, 'bandpass', 2800, 3.2, 0.24);
        }
        break;

      case 'deagle':
        // Heavy hand-cannon boom
        this._tone(bus, t, 0.22, 'sawtooth', 145, 35, 0.88);
        this._noiseBurst(bus, t, 0.30, 'bandpass', 1050, 0.85, 1.0, 260);
        this._noiseBurst(bus, t, 0.08, 'highpass', 2900, 1.2, 0.55);
        if (!worldPos) bus.connect(this.reverbConvolver);
        break;

      case 'xm1014':
        this._tone(bus, t, 0.18, 'sawtooth', 130, 34, 0.85);
        this._noiseBurst(bus, t, 0.26, 'lowpass', 1600, 0.7, 0.98, 280);
        break;

      case 'mp9':
      case 'mac10':
        this._tone(bus, t, 0.075, 'triangle', 230, 65, 0.52);
        this._noiseBurst(bus, t, 0.11, 'bandpass', 1750, 1.3, 0.65, 580);
        break;

      case 'famas':
      case 'galil':
        this._tone(bus, t, 0.11, 'sawtooth', 180, 48, 0.65);
        this._noiseBurst(bus, t, 0.18, 'bandpass', 1350, 1.0, 0.82, 380);
        if (!worldPos) bus.connect(this.reverbConvolver);
        break;

      default:
        // Glock / P250 snappy pistol pop
        this._tone(bus, t, 0.085, 'triangle', 260, 72, 0.55);
        this._noiseBurst(bus, t, 0.12, 'bandpass', 1650, 1.2, 0.68, 520);
        break;
    }
  }

  playKnife(mode = 'slash', hitType = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (mode === 'draw') {
      // Metallic blade unsheathe shing!
      this._noiseBurst(this.masterGain, t, 0.14, 'bandpass', 4800, 5.5, 0.24, 6800);
      this._tone(this.masterGain, t + 0.01, 0.12, 'sine', 2900, 4400, 0.09);
      return;
    }
    // Whoosh
    this._noiseBurst(this.masterGain, t, 0.11, 'bandpass', 1400, 1.5, 0.28, 520);
    if (hitType === 'flesh') {
      this._noiseBurst(this.masterGain, t + 0.02, 0.12, 'lowpass', 950, 1.2, 0.65, 220);
      this._tone(this.masterGain, t + 0.02, 0.09, 'sawtooth', 180, 65, 0.42);
    } else if (hitType === 'wall') {
      this._tone(this.masterGain, t + 0.015, 0.10, 'triangle', 3400, 1900, 0.25);
      this._noiseBurst(this.masterGain, t + 0.015, 0.06, 'highpass', 3800, 2.5, 0.30);
    }
  }

  playReload(reloadDuration = 2.4) {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Mag release click + slide out
    this._noiseBurst(this.masterGain, t + 0.12, 0.06, 'bandpass', 2600, 3.0, 0.25);
    this._tone(this.masterGain, t + 0.14, 0.05, 'triangle', 1200, 750, 0.14);
    // Fresh mag slap in
    const magIn = t + reloadDuration * 0.52;
    this._noiseBurst(this.masterGain, magIn, 0.07, 'bandpass', 1900, 2.4, 0.34);
    this._tone(this.masterGain, magIn, 0.06, 'triangle', 420, 960, 0.22);
    // Bolt rack clack-clack
    const boltT = t + reloadDuration * 0.80;
    this._noiseBurst(this.masterGain, boltT, 0.055, 'bandpass', 3200, 3.2, 0.28);
    this._noiseBurst(this.masterGain, boltT + 0.09, 0.055, 'bandpass', 2800, 3.0, 0.30);
  }

  playScopeZoom() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._tone(this.masterGain, t, 0.045, 'sine', 1400, 1950, 0.14);
    this._noiseBurst(this.masterGain, t, 0.035, 'bandpass', 3600, 4.0, 0.15);
  }

  playImpact(type = 'stone', worldPos = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 55, 6);
    if (!bus) return;
    const t = this.ctx.currentTime;

    if (type === 'headshot_helmet') {
      // Iconic CS metallic helmet DINK!!
      this._tone(bus, t, 0.22, 'sine', 2680, 2420, 0.58);
      this._tone(bus, t, 0.15, 'triangle', 4150, 3850, 0.35);
      this._noiseBurst(bus, t, 0.08, 'highpass', 3200, 2.0, 0.45);
    } else if (type === 'headshot') {
      // Unarmored headshot crunch
      this._noiseBurst(bus, t, 0.14, 'bandpass', 1600, 1.2, 0.65, 500);
      this._tone(bus, t, 0.09, 'sawtooth', 620, 190, 0.42);
    } else if (type === 'flesh') {
      this._noiseBurst(bus, t, 0.09, 'lowpass', 850, 1.0, 0.45, 240);
    } else if (type === 'wood') {
      this._noiseBurst(bus, t, 0.08, 'bandpass', 950, 1.8, 0.42, 420);
      this._tone(bus, t, 0.05, 'triangle', 380, 170, 0.24);
    } else if (type === 'metal') {
      this._tone(bus, t, 0.16, 'triangle', 2200 + Math.random() * 600, 1400, 0.34);
      this._noiseBurst(bus, t, 0.05, 'highpass', 3500, 2.5, 0.28);
    } else {
      // Stone / sand ricochet snap
      this._noiseBurst(bus, t, 0.07, 'bandpass', 2400, 1.6, 0.32, 900);
    }
  }

  playFootstep(surface = 'sand', worldPos = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 28, 3.5);
    if (!bus) return;
    const t = this.ctx.currentTime;
    const pitchJitter = 0.9 + Math.random() * 0.22;

    if (surface === 'wood') {
      this._tone(bus, t, 0.06, 'triangle', 190 * pitchJitter, 95, 0.24);
      this._noiseBurst(bus, t, 0.05, 'bandpass', 850 * pitchJitter, 2.0, 0.18);
    } else if (surface === 'metal') {
      this._tone(bus, t, 0.08, 'triangle', 680 * pitchJitter, 340, 0.20);
      this._noiseBurst(bus, t, 0.05, 'bandpass', 2400, 3.0, 0.22);
    } else if (surface === 'stone') {
      this._noiseBurst(bus, t, 0.055, 'bandpass', 1450 * pitchJitter, 1.6, 0.20);
      this._tone(bus, t, 0.04, 'sine', 140, 70, 0.15);
    } else {
      // Desert sand crunch
      this._noiseBurst(bus, t, 0.075, 'bandpass', 1950 * pitchJitter, 1.1, 0.19, 1100);
    }
  }

  playGrenadeBounce(worldPos) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 38, 4);
    if (!bus) return;
    const t = this.ctx.currentTime;
    this._tone(bus, t, 0.07, 'triangle', 1850, 1250, 0.26);
    this._noiseBurst(bus, t, 0.04, 'bandpass', 2900, 3.5, 0.22);
  }

  playHEExplosion(worldPos) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 95, 10);
    if (!bus) return;
    const t = this.ctx.currentTime;
    this._tone(bus, t, 0.55, 'sawtooth', 95, 22, 1.0);
    this._tone(bus, t, 0.42, 'sine', 62, 20, 0.95);
    this._noiseBurst(bus, t, 0.85, 'lowpass', 1100, 0.7, 1.15, 110);
    bus.connect(this.reverbConvolver);
  }

  playFlashbang(worldPos, blindIntensity = 0) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 85, 8);
    const t = this.ctx.currentTime;
    if (bus) {
      this._noiseBurst(bus, t, 0.24, 'bandpass', 2600, 1.0, 0.95, 700);
      this._tone(bus, t, 0.14, 'sawtooth', 420, 90, 0.7);
    }
    // Authentic CS high-pitched tinnitus ear-ringing when flashed!
    if (blindIntensity > 0.25) {
      const dur = 1.2 + blindIntensity * 2.6;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3650, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(Math.min(0.18, blindIntensity * 0.18), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  playSmokeBloom(worldPos) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 55, 6);
    if (!bus) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(bus, t, 1.1, 'bandpass', 1650, 0.8, 0.58, 650);
  }

  playC4KeyBeep(digitIdx = 0) {
    this.init();
    if (!this.ctx || this.muted) return;
    const freqs = [1320, 1480, 1560, 1480, 1640, 1380, 1760];
    const t = this.ctx.currentTime;
    this._tone(this.masterGain, t, 0.065, 'sine', freqs[digitIdx % freqs.length], null, 0.22);
  }

  playC4Tick(worldPos, urgency = 0) {
    this.init();
    if (!this.ctx || this.muted) return;
    const bus = this._createSpatialBus(worldPos, 85, 12);
    if (!bus) return;
    const t = this.ctx.currentTime;
    const freq = 2350 + urgency * 550;
    this._tone(bus, t, 0.085, 'sine', freq, freq * 0.98, 0.36);
  }

  playC4Explosion() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._tone(this.masterGain, t, 1.4, 'sawtooth', 78, 18, 1.0);
    this._noiseBurst(this.masterGain, t, 1.9, 'lowpass', 950, 0.6, 1.15, 65);
  }

  playDefuseStart() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(this.masterGain, t, 0.09, 'bandpass', 3400, 4.0, 0.32);
    this._tone(this.masterGain, t + 0.05, 0.08, 'sine', 980, 1320, 0.20);
  }

  playBuySound() {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(this.masterGain, t, 0.06, 'bandpass', 2400, 3.0, 0.25);
    this._tone(this.masterGain, t + 0.02, 0.08, 'triangle', 740, 1120, 0.18);
  }

  playRadioBeep(text = null) {
    this.init();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Walkie-talkie PTT squelch
    this._noiseBurst(this.masterGain, t, 0.045, 'bandpass', 2100, 3.5, 0.14);
    this._tone(this.masterGain, t + 0.01, 0.05, 'sine', 1680, 1680, 0.09);

    if (text && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        utter.rate = 1.08;
        utter.pitch = 0.84;
        utter.volume = 0.65;
        window.speechSynthesis.speak(utter);
      } catch (_) {
        // Ignore if speech synthesis unavailable
      }
    }
  }
}
