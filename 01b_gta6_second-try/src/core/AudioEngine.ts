import { RadioStationId, VehicleKind, WeaponId } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Continuous engine sound
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Police siren sound
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenPhase = 0;

  // Procedural radio sequencer
  public currentStation: RadioStationId = 'flash_synth';
  public inVehicleForRadio = false;
  private radioTimer = 0;
  private radioStep = 0;

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.45;
    this.masterGain.connect(this.ctx.destination);

    // Create white noise buffer for drums, gunshots, explosions, crashes, ocean/tires
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Engine synth setup
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;
    this.engineGain.gain.value = 0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Siren setup
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenOsc.type = 'triangle';
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);
    this.sirenOsc.start();
  }

  public getStationTitle(station: RadioStationId = this.currentStation): string {
    switch (station) {
      case 'flash_synth':
        return '🎵 FLASH Synth FM 86 (罪恶城复古合成波)';
      case 'leonida_bass':
        return '🎵 LEONIDA 104.5 Trap & Bass (迈阿密低音电台)';
      case 'vrock':
        return '🎵 V-ROCK Tropical 98.9 (海岸摇滚)';
      case 'off':
        return '🔇 电台已关闭 RADIO OFF';
    }
  }

  public cycleRadio(): string {
    const order: RadioStationId[] = ['flash_synth', 'leonida_bass', 'vrock', 'off'];
    const idx = order.indexOf(this.currentStation);
    this.currentStation = order[(idx + 1) % order.length];
    this.playUiClick(780);
    return this.getStationTitle();
  }

  public update(
    dt: number,
    inVehicle: boolean,
    vehicleKind: VehicleKind | null,
    speedAbs: number,
    throttle: boolean,
    drifting: boolean,
    nearestPoliceDist: number,
    wantedLevel: number
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // 1. Update Vehicle Engine Synth
    if (inVehicle && vehicleKind && this.engineGain && this.engineOsc1 && this.engineOsc2 && this.engineFilter) {
      const gearRatio = (speedAbs % 14) / 14;
      let baseFreq = 48;
      if (vehicleKind === 'supercar' || vehicleKind === 'convertible') baseFreq = 72;
      else if (vehicleKind === 'bike') baseFreq = 88;
      else if (vehicleKind === 'helicopter') baseFreq = 32;
      else if (vehicleKind === 'boat') baseFreq = 54;

      const rpmFreq = baseFreq + speedAbs * 1.65 + gearRatio * 34 + (throttle ? 16 : 0);
      this.engineOsc1.frequency.setTargetAtTime(rpmFreq, now, 0.05);
      this.engineOsc2.frequency.setTargetAtTime(
        vehicleKind === 'helicopter' ? rpmFreq * 0.5 : rpmFreq * 1.5,
        now,
        0.05
      );
      this.engineFilter.frequency.setTargetAtTime(220 + speedAbs * 14 + (throttle ? 180 : 0), now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.085 + (throttle ? 0.04 : 0), now, 0.08);

      if (drifting && speedAbs > 10 && Math.random() < dt * 12) {
        this.playTireScreechBlip();
      }
    } else if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    }

    // 2. Update Police Siren
    if (this.sirenGain && this.sirenOsc) {
      if (wantedLevel > 0 && nearestPoliceDist < 95) {
        this.sirenPhase += dt * 4.4;
        const sirenFreq = 680 + Math.sin(this.sirenPhase) * 260;
        const atten = Math.max(0, 1 - nearestPoliceDist / 95) * 0.095;
        this.sirenOsc.frequency.setTargetAtTime(sirenFreq, now, 0.03);
        this.sirenGain.gain.setTargetAtTime(atten, now, 0.08);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }

    // 3. Procedural Radio Sequencer while driving
    this.inVehicleForRadio = inVehicle;
    if (inVehicle && this.currentStation !== 'off') {
      const stepDur =
        this.currentStation === 'flash_synth'
          ? 0.128
          : this.currentStation === 'leonida_bass'
          ? 0.115
          : 0.11;
      this.radioTimer += dt;
      if (this.radioTimer >= stepDur) {
        this.radioTimer -= stepDur;
        this.triggerRadioStep(this.currentStation, this.radioStep);
        this.radioStep = (this.radioStep + 1) % 32;
      }
    }
  }

  private triggerRadioStep(station: RadioStationId, step: number): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    if (station === 'flash_synth') {
      // 80s Vice City Synthwave: Kick on 0,4,8,12..., gated snare on 4,12, octave bass + neon arp!
      if (step % 4 === 0) this.playSynthKick(t, 0.11);
      if (step % 8 === 4) this.playNoisePerc(t, 0.065, 1400, 0.14);
      if (step % 2 === 1) this.playNoisePerc(t, 0.022, 6500, 0.04);

      // Chord root progression: Am - F - C - G (in Hz)
      const bar = Math.floor(step / 8);
      const bassRoots = [110, 87.31, 130.81, 98.0];
      const root = bassRoots[bar % 4];
      this.playNote(t, step % 2 === 0 ? root : root * 2, 'sawtooth', 0.052, 0.11, 680);

      const arpMultipliers = [2, 2.5, 3, 4, 3, 2.5, 2, 3];
      if (step % 2 === 0) {
        const arpFreq = root * arpMultipliers[(step / 2) % arpMultipliers.length];
        this.playNote(t, arpFreq, 'triangle', 0.038, 0.22, 2400);
      }
    } else if (station === 'leonida_bass') {
      // Miami 808 Club Beat
      if (step === 0 || step === 6 || step === 10 || step === 16 || step === 22 || step === 28) {
        this.playSynthKick(t, 0.14);
      }
      if (step % 8 === 4) this.playNoisePerc(t, 0.06, 2200, 0.09);
      if (step % 2 === 0 || step % 7 === 0) this.playNoisePerc(t, 0.02, 8000, 0.03);

      const pluckNotes = [293.66, 349.23, 440, 392.0, 349.23, 329.63, 293.66, 261.63];
      if (step % 4 === 0 || step % 4 === 3) {
        this.playNote(t, pluckNotes[step % pluckNotes.length], 'sine', 0.048, 0.16, 1800);
      }
    } else if (station === 'vrock') {
      // Driving Coast Rock
      if (step % 4 === 0 || step % 8 === 6) this.playSynthKick(t, 0.1);
      if (step % 8 === 4) this.playNoisePerc(t, 0.075, 1800, 0.12);
      this.playNoisePerc(t, 0.022, 5200, 0.04);
      const riff = [164.81, 164.81, 196.0, 220.0, 246.94, 220.0, 196.0, 146.83];
      if (step % 2 === 0) {
        const f = riff[(step / 2) % riff.length];
        this.playNote(t, f, 'sawtooth', 0.045, 0.13, 1500);
        this.playNote(t, f * 1.5, 'sawtooth', 0.032, 0.13, 1500);
      }
    }
  }

  private playSynthKick(t: number, vol: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  private playNoisePerc(t: number, vol: number, freq: number, dur: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  private playNote(
    t: number,
    freq: number,
    type: OscillatorType,
    vol: number,
    dur: number,
    cutoff: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(240, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  public playGunshot(weaponId: WeaponId): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    if (weaponId === 'fists') {
      this.playSynthKick(t, 0.22);
      return;
    }

    const dur = weaponId === 'shotgun' ? 0.28 : weaponId === 'rpg' ? 0.45 : 0.14;
    const cutoff =
      weaponId === 'smg' ? 2400 : weaponId === 'shotgun' ? 950 : weaponId === 'rpg' ? 600 : 1750;
    const vol = weaponId === 'shotgun' ? 0.36 : weaponId === 'smg' ? 0.2 : 0.28;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + dur + 0.02);

    // Punch transient
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(weaponId === 'rpg' ? 190 : 260, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playExplosion(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(820, t);
    filter.frequency.exponentialRampToValueAtTime(55, t + 1.15);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + 1.25);

    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.75);
    sg.gain.setValueAtTime(0.55, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.82);
  }

  public playTireScreechBlip(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    this.playNoisePerc(t, 0.045, 2900 + Math.random() * 500, 0.09);
  }

  public playCrash(intensity = 1): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    this.playNoisePerc(t, Math.min(0.35, 0.16 * intensity), 680, 0.22);
  }

  public playHorn(isPolice: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    this.playNote(t, isPolice ? 880 : 392, 'sawtooth', 0.16, 0.28, 1800);
    this.playNote(t, isPolice ? 1140 : 493.88, 'sawtooth', 0.14, 0.28, 1800);
  }

  public playSwitchThump(stepIndex: number): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const freqs = [150, 115, 210];
    this.playNote(t, freqs[stepIndex % 3], 'triangle', 0.26, 0.18, 900);
    this.playSynthKick(t, 0.24);
  }

  public playCashSound(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    this.playNote(t, 1046.5, 'sine', 0.14, 0.12, 4000);
    this.playNote(t + 0.08, 1567.98, 'sine', 0.16, 0.24, 4500);
  }

  public playMissionPassed(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Iconic Vice Synth Brass Fanfare
    const notes = [293.66, 349.23, 440.0, 587.33, 523.25, 659.25];
    notes.forEach((f, idx) => {
      this.playNote(t + idx * 0.13, f, 'sawtooth', 0.16, 0.55, 2600);
      this.playNote(t + idx * 0.13, f * 0.5, 'triangle', 0.12, 0.55, 1200);
    });
  }

  public playWastedBoom(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    this.playNote(t, 110, 'sawtooth', 0.32, 1.1, 420);
    this.playNote(t, 55, 'sine', 0.4, 1.2, 240);
  }

  public playUiClick(freq = 640): void {
    if (!this.ctx || !this.masterGain) return;
    this.playNote(this.ctx.currentTime, freq, 'sine', 0.07, 0.06, 3000);
  }
}
