// ============================================================================
// GTA VI: Vice City (Leonida) — Procedural WebAudio Engine & Vice FM Radio
// Provides engine RPM synthesis, tire screech, sirens, weapons, explosions,
// UI stingers, and 4 procedural Vice City FM Radio stations.
// ============================================================================

export const RADIO_STATIONS = [
  {
    id: 'flash_fm',
    name: 'FLASH FM 102.8',
    genre: '80s Vice Synthpop',
    dj: 'DJ Toni',
    color: '#ff47b6',
    bpm: 118
  },
  {
    id: 'leonida_bass',
    name: 'LEONIDA HEAT 99.5',
    genre: 'Miami 808 Bass & Trap',
    dj: 'DJ Khaleda',
    color: '#00f0ff',
    bpm: 132
  },
  {
    id: 'espantoso',
    name: 'WAVE ESPANTOSO 105.1',
    genre: 'Tropical Latin Groove',
    dj: 'Fernando Martinez',
    color: '#ffb82e',
    bpm: 122
  },
  {
    id: 'nightride',
    name: 'NIGHTRIDE FM 88.4',
    genre: 'Ocean Drive Outrun',
    dj: 'Kavinsky AI',
    color: '#a955ff',
    bpm: 106
  },
  {
    id: 'off',
    name: 'RADIO OFF',
    genre: 'Engine Pure Sound',
    dj: '-',
    color: '#8892b0',
    bpm: 0
  }
];

export class ViceAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.initialized = false;

    // Continuous vehicle sound nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.skidNoiseGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;

    // Radio state
    this.stationIndex = 0; // Default FLASH FM
    this.radioPlaying = false;
    this.stepCounter = 0;
    this.nextNoteTime = 0;
    this.radioTimer = null;
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

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.26;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.72;
      this.sfxGain.connect(this.masterGain);

      // Setup continuous engine oscillators
      this._setupEngineLoop();
      this.initialized = true;
    } catch (err) {
      console.warn('WebAudio init skipped:', err);
    }
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  _setupEngineLoop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    this.engineFilter = filter;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 48;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 96;

    this.engineOsc1.connect(filter);
    this.engineOsc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);

    // Tire skid / wind white noise buffer
    const bufSize = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const skidSource = this.ctx.createBufferSource();
    skidSource.buffer = this.noiseBuffer;
    skidSource.loop = true;

    const skidFilter = this.ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1350;
    skidFilter.Q.value = 3.2;

    this.skidNoiseGain = this.ctx.createGain();
    this.skidNoiseGain.gain.value = 0.0;

    skidSource.connect(skidFilter);
    skidFilter.connect(this.skidNoiseGain);
    this.skidNoiseGain.connect(this.sfxGain);
    skidSource.start(now);

    // Police siren continuous oscillator
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 650;

    const sirenFilter = this.ctx.createBiquadFilter();
    sirenFilter.type = 'lowpass';
    sirenFilter.frequency.value = 1800;

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;

    this.sirenOsc.connect(sirenFilter);
    sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc.start(now);
  }

  updateVehicleAudio(inVehicle, speedRatio, isDrifting, isBoosting, vehicleType, sirenActive, dt) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (inVehicle) {
      const absSpd = Math.min(1.3, Math.abs(speedRatio));
      // Simulate 5-speed gearbox RPM curve
      const gearProgress = (absSpd * 4.2) % 1.0;
      const rpmFactor = 0.35 + gearProgress * 0.65 + (isBoosting ? 0.35 : 0);

      let baseFreq = 45;
      if (vehicleType === 'cheetah' || vehicleType === 'banshee') baseFreq = 64;
      else if (vehicleType === 'helicopter') baseFreq = 32;
      else if (vehicleType === 'boat') baseFreq = 52;

      const f1 = baseFreq * (0.8 + rpmFactor * 2.1);
      this.engineOsc1.frequency.setTargetAtTime(f1, now, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(f1 * (vehicleType === 'helicopter' ? 1.5 : 2.02), now, 0.04);
      this.engineFilter.frequency.setTargetAtTime(220 + rpmFactor * 680, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.11 + Math.min(0.12, absSpd * 0.1), now, 0.06);

      // Tire screech on drift
      const skidTarget = (isDrifting && absSpd > 0.18 && vehicleType !== 'helicopter' && vehicleType !== 'boat')
        ? Math.min(0.18, absSpd * 0.22)
        : 0.0;
      this.skidNoiseGain.gain.setTargetAtTime(skidTarget, now, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0.0, now, 0.08);
      this.skidNoiseGain.gain.setTargetAtTime(0.0, now, 0.05);
    }

    // Police siren wail (player police car OR nearby police pursuit)
    if (sirenActive) {
      this.sirenPhase += dt * 2.8;
      const wail = 620 + Math.sin(this.sirenPhase) * 290;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.045, now, 0.08);
    } else {
      this.sirenGain.gain.setTargetAtTime(0.0, now, 0.1);
    }

    // Update procedural Vice FM radio sequencer when inside a vehicle
    this.setRadioActive(inVehicle && RADIO_STATIONS[this.stationIndex].id !== 'off');
    if (this.radioPlaying) {
      this._StepRadioSequencer();
    }
  }

  setRadioStation(index) {
    this.init();
    this.stationIndex = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    this.playRadioStatic();
    const st = RADIO_STATIONS[this.stationIndex];
    if (st.id === 'off') {
      this.setRadioActive(false);
    } else {
      this.stepCounter = 0;
      if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.08;
    }
    return st;
  }

  cycleRadioStation(dir = 1) {
    return this.setRadioStation(this.stationIndex + dir);
  }

  getCurrentStation() {
    return RADIO_STATIONS[this.stationIndex];
  }

  setRadioActive(active) {
    if (!this.initialized || !this.ctx) return;
    if (active && !this.radioPlaying) {
      this.radioPlaying = true;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    } else if (!active && this.radioPlaying) {
      this.radioPlaying = false;
    }
  }

  _StepRadioSequencer() {
    if (!this.ctx || !this.radioPlaying) return;
    const st = RADIO_STATIONS[this.stationIndex];
    if (!st || st.id === 'off') return;

    const secondsPer16th = 60 / st.bpm / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this._scheduleRadioStep(st.id, this.stepCounter, this.nextNoteTime, secondsPer16th);
      this.nextNoteTime += secondsPer16th;
      this.stepCounter = (this.stepCounter + 1) % 32;
    }
  }

  _scheduleRadioStep(stationId, step, time, stepDur) {
    // Kick on 0, 4, 8, 12 (or syncopated for Latin/808)
    const isKick = stationId === 'leonida_bass'
      ? (step % 16 === 0 || step % 16 === 3 || step % 16 === 6 || step % 16 === 10)
      : (step % 4 === 0);
    const isSnare = (step % 8 === 4);
    const isHat = (step % 2 === 1);

    if (isKick) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(stationId === 'leonida_bass' ? 115 : 135, time);
      osc.frequency.exponentialRampToValueAtTime(36, time + 0.14);
      g.gain.setValueAtTime(0.35, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.19);
    }

    if (isSnare) {
      this._playNoiseBurst(time, 0.11, 1200, 0.16, this.musicGain);
    } else if (isHat) {
      this._playNoiseBurst(time, 0.035, 6500, 0.06, this.musicGain);
    }

    // Melodic synth bass & Vice City arpeggio chords
    const scales = {
      flash_fm: [220, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33], // A minor / C major 80s synthpop
      leonida_bass: [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 130.81],
      espantoso: [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63],
      nightride: [196.0, 233.08, 293.66, 349.23, 392.0, 466.16, 392.0, 293.66]
    };
    const notes = scales[stationId] || scales.flash_fm;
    const noteFreq = notes[step % notes.length] * (step >= 16 ? 1.122 : 1.0);

    if (step % 2 === 0 || stationId === 'flash_fm') {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = stationId === 'leonida_bass' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(noteFreq * 0.5, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);
      filter.frequency.exponentialRampToValueAtTime(380, time + stepDur * 1.6);

      g.gain.setValueAtTime(0.14, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.8);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + stepDur * 1.9);
    }
  }

  _playNoiseBurst(time, duration, filterFreq, gainVal, targetNode) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = filterFreq;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(targetNode || this.sfxGain);
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  playRadioStatic() {
    this.init();
    if (!this.ctx) return;
    this._playNoiseBurst(this.ctx.currentTime, 0.14, 900, 0.18, this.sfxGain);
  }

  playGunshot(weaponId = 'pistol') {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (weaponId === 'unarmed') {
      // Punch whoosh
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.14);
      return;
    }

    if (weaponId === 'rpg') {
      // Rocket launch whoosh + ignition
      this._playNoiseBurst(now, 0.45, 420, 0.38, this.sfxGain);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.44);
      return;
    }

    // Gunfire transient punch + noise tail
    const dur = weaponId === 'shotgun' ? 0.28 : weaponId === 'rifle' ? 0.16 : 0.13;
    const startFreq = weaponId === 'shotgun' ? 160 : weaponId === 'smg' ? 280 : 220;

    this._playNoiseBurst(now, dur, 350, weaponId === 'shotgun' ? 0.48 : 0.32, this.sfxGain);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + dur * 0.8);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  playExplosion() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep sub-bass boom + long rumble noise
    this._playNoiseBurst(now, 1.15, 90, 0.65, this.sfxGain);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.95);
    g.gain.setValueAtTime(0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.05);
  }

  playCharacterSwitchWhoosh() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._playNoiseBurst(now, 0.25, 600, 0.25, this.sfxGain);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.28);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  playCashPickup() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [880, 1174.66, 1760];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = now + idx * 0.045;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playMissionPassedStinger() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Iconic GTA Vice City style synth brass chord fanfare
    const chord = [220, 277.18, 329.63, 440, 554.37, 659.25];
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 1.65);
    });
  }
}
