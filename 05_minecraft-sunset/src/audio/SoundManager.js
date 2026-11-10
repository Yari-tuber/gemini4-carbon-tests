// Procedural WebAudio sound effects & sunset coastal ambience (zero external audio files needed)

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.windGain = null;
    this.surfGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.startAmbience();
    } catch (e) {
      // Ignore if browser blocks audio
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.windGain && this.ctx) {
      this.windGain.gain.setTargetAtTime(this.muted ? 0 : 0.04, this.ctx.currentTime, 0.1);
    }
    if (this.surfGain && this.ctx) {
      this.surfGain.gain.setTargetAtTime(this.muted ? 0 : 0.03, this.ctx.currentTime, 0.1);
    }
    return this.muted;
  }

  createNoiseBuffer(seconds = 2.0) {
    const rate = this.ctx.sampleRate;
    const length = rate * seconds;
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Pink/brownish filtered noise for natural wind & ocean waves
      data[i] = (lastOut + (0.04 * white)) / 1.04;
      lastOut = data[i];
      data[i] *= 2.8;
    }
    return buffer;
  }

  startAmbience() {
    if (!this.ctx) return;
    const noiseBuffer = this.createNoiseBuffer(3.0);

    // 1. High-altitude gliding wind loop
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 1.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.04;

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    windSource.start();
    this.windFilter = windFilter;

    // 2. Gentle ocean surf loop
    const surfSource = this.ctx.createBufferSource();
    surfSource.buffer = noiseBuffer;
    surfSource.loop = true;

    const surfFilter = this.ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 260;

    this.surfGain = this.ctx.createGain();
    this.surfGain.gain.value = 0.03;

    surfSource.connect(surfFilter);
    surfFilter.connect(this.surfGain);
    this.surfGain.connect(this.ctx.destination);
    surfSource.start();
  }

  updateAmbience(player, time) {
    if (!this.initialized || !this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const isGliding = player.mode === 'GLIDING';
    const speed = Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z);

    if (this.windGain && this.windFilter) {
      const targetWind = isGliding
        ? Math.min(0.14, 0.03 + (speed / 18.0) * 0.09)
        : 0.012;
      this.windGain.gain.setTargetAtTime(targetWind, now, 0.15);
      this.windFilter.frequency.setTargetAtTime(isGliding ? 320 + speed * 24 : 240, now, 0.15);
    }

    if (this.surfGain) {
      // Ocean wave swell modulation
      const wavePulse = 0.5 + 0.5 * Math.sin(time * 0.9);
      const altAtten = Math.max(0.15, 1.0 - Math.max(0, player.position.y - 14) / 55.0);
      this.surfGain.gain.setTargetAtTime((0.015 + wavePulse * 0.035) * altAtten, now, 0.2);
    }
  }

  playStep(type = 'grass', volume = 0.8) {
    if (!this.initialized || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const freqMap = { grass: 135, sand: 165, stone: 210, wood: 155 };
    const baseFreq = (freqMap[type] || 150) * (0.9 + Math.random() * 0.2);

    osc.type = type === 'stone' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.075);

    gain.gain.setValueAtTime(0.06 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  playBreak(type = 'stone') {
    if (!this.initialized || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.028;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime((190 - i * 30) * (0.85 + Math.random() * 0.3), t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.06);

      gain.gain.setValueAtTime(0.045, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  playPlace(type = 'stone') {
    if (!this.initialized || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.065);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playTakeoff() {
    if (!this.initialized || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.32);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }
}
