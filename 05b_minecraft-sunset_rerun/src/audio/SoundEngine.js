// Procedural WebAudio Soundscape & Minecraft Tactile Foley Engine (Zero external audio assets)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.windGain = null;
    this.windFilter = null;
    this.oceanGain = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this._initialized = true;

    // Shared 2-second pink-ish noise buffer
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 1.6;
    }

    this._setupContinuousAmbience();
  }

  _setupContinuousAmbience() {
    if (!this.ctx) return;

    // 1. Glider Wind Rush Loop
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuf;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 380;
    this.windFilter.Q.value = 0.9;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    windSrc.start();

    // 2. Distant Gentle Sunset Ocean Surf Loop
    const seaSrc = this.ctx.createBufferSource();
    seaSrc.buffer = this.noiseBuf;
    seaSrc.loop = true;

    const seaFilter = this.ctx.createBiquadFilter();
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 260;

    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.value = 0.025;

    seaSrc.connect(seaFilter);
    seaFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.ctx.destination);
    seaSrc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.windGain && this.oceanGain) {
      this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      this.oceanGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  updateAmbience(playerY, seaLevel, elapsed) {
    if (!this.ctx || this.muted || !this.oceanGain) return;
    const altAboveSea = Math.max(0, playerY - seaLevel);
    const wavePulse = 0.72 + 0.28 * Math.sin(elapsed * 0.65);
    const seaVol = Math.exp(-altAboveSea * 0.032) * 0.055 * wavePulse + 0.008;
    this.oceanGain.gain.setTargetAtTime(seaVol, this.ctx.currentTime, 0.15);
  }

  updateGlideWind(airSpeed, isGliding) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    if (this.muted || !isGliding) {
      this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      return;
    }
    const norm = Math.max(0, Math.min(1.5, (airSpeed - 5.0) / 14.0));
    this.windFilter.frequency.setTargetAtTime(280 + norm * 520, this.ctx.currentTime, 0.1);
    this.windGain.gain.setTargetAtTime(0.022 + norm * 0.065, this.ctx.currentTime, 0.1);
  }

  _burst(freq, duration, vol, type = 'lowpass', pitchEnd = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.35, t);
    if (pitchEnd) {
      src.playbackRate.exponentialRampToValueAtTime(pitchEnd, t + duration);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t, Math.random() * 0.8, duration + 0.02);
  }

  _tone(freqStart, freqEnd, duration, vol, wave = 'triangle') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playStep(mat = 'grass') {
    if (mat === 'stone') this._burst(950, 0.065, 0.055, 'bandpass');
    else if (mat === 'wood') {
      this._burst(620, 0.07, 0.05, 'bandpass');
      this._tone(165, 95, 0.055, 0.035);
    } else if (mat === 'sand') this._burst(1650, 0.085, 0.045, 'bandpass');
    else this._burst(1250, 0.075, 0.048, 'lowpass');
  }

  playBlockBreak(mat = 'grass') {
    if (mat === 'glass') {
      this._tone(1420, 680, 0.11, 0.06, 'sine');
      this._burst(2800, 0.12, 0.07, 'highpass');
    } else if (mat === 'stone') {
      this._burst(1100, 0.13, 0.11, 'bandpass', 0.55);
      this._tone(220, 105, 0.09, 0.055);
    } else if (mat === 'wood') {
      this._burst(780, 0.12, 0.10, 'bandpass');
      this._tone(190, 92, 0.09, 0.065);
    } else {
      this._burst(1450, 0.13, 0.095, 'lowpass', 0.65);
    }
  }

  playBlockPlace(mat = 'grass') {
    this._burst(900, 0.08, 0.08, 'bandpass');
    this._tone(240, 150, 0.075, 0.055);
  }

  playTakeoff() {
    this._burst(680, 0.38, 0.12, 'bandpass', 1.65);
    this._tone(190, 420, 0.28, 0.045, 'sine');
  }

  playJump() {
    this._burst(550, 0.08, 0.04, 'lowpass');
  }

  playLand(inWater = false) {
    if (inWater) {
      this._burst(950, 0.28, 0.12, 'bandpass', 0.55);
    } else {
      this._burst(480, 0.12, 0.085, 'lowpass');
      this._tone(130, 68, 0.09, 0.05);
    }
  }
}
