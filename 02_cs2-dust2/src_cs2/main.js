// Counter-Strike: Dust II — Main Engine Entry, Source-2 Lighting, Sky Dome & Input Director
import * as THREE from 'three';
import { MaterialLibrary } from './world/Materials.js';
import { Dust2Map } from './world/Dust2Map.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { ProjectilesAndFX } from './gameplay/ProjectilesAndFX.js';
import { PlayerController } from './gameplay/PlayerController.js';
import { MatchManager } from './gameplay/MatchManager.js';
import { HUD } from './ui/HUD.js';
import { WEAPON_SLOTS } from './config/WeaponsData.js';

class CounterStrikeDust2App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');

    // Renderer with ACES Filmic Tone Mapping & Crisp Soft Shadows (Source 2 Dust2 warmth!)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.autoClear = false;

    // World Scene & Viewmodel Foreground Scene (prevents weapon barrel wall-clipping!)
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xead9be, 0.0042);

    this.viewmodelScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.08, 340);

    this._setupLightingAndSky();

    // Build PBR Materials, Authentic de_dust2 Map, Audio, VFX, Player, HUD & 5v5 Match Manager
    this.sound = new SoundEngine();
    this.matLib = new MaterialLibrary();
    this.map = new Dust2Map(this.scene, this.matLib);
    this.fx = new ProjectilesAndFX(this.scene, this.map, this.sound);
    this.player = new PlayerController(this.camera, this.viewmodelScene, this.map, this.fx, this.sound);
    this.hud = new HUD(this.map);
    this.match = new MatchManager({
      scene: this.scene,
      map: this.map,
      fx: this.fx,
      sound: this.sound,
      player: this.player,
      hud: this.hud
    });

    this.hud.onBuyItem = (itemId) => this.match.buyItemForPlayer(itemId);

    // Menu & PointerLock State
    this.gameStarted = false;
    this.menuOpen = true;
    this.selectedTeam = 'CT';
    this.selectedDiff = 'normal';
    this.selectedMoney = 800;

    this.elMainMenu = document.getElementById('main-menu');
    this.elPauseHint = document.getElementById('click-to-resume');

    this._setupMenuUI();
    this._setupControls();

    this.clock = new THREE.Clock();
    this.orbitAngle = 0;
    window.addEventListener('resize', () => this._onResize());

    this._animate();
  }

  _setupLightingAndSky() {
    // Procedural Moroccan Desert Sky Dome
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 256;
    const ctx = skyCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#3a7bd5');
    grad.addColorStop(0.42, '#7db2e8');
    grad.addColorStop(0.68, '#dfcfa8');
    grad.addColorStop(1.0, '#e5cca0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(220, 32, 20),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
    );
    this.scene.add(skyDome);

    // Generate Physically-Based Desert Sky & Sand Environment Map so metallic weapons & props gleam!
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envDome = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
    );
    envScene.add(envDome);
    const envSun = new THREE.Mesh(
      new THREE.SphereGeometry(4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    envSun.position.set(16, 24, 12);
    envScene.add(envSun);
    const envRT = pmrem.fromScene(envScene, 0.03);
    this.scene.environment = envRT.texture;
    this.viewmodelScene.environment = envRT.texture;
    pmrem.dispose();

    // Glowing Desert Sun Disc
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff6d6, fog: false })
    );
    sunDisc.position.set(85, 128, 65);
    this.scene.add(sunDisc);

    // Warm Hemisphere Sky/Sand Bounce Light (World + Viewmodel)
    const hemi = new THREE.HemisphereLight(0xa8d0f8, 0xd8b27c, 0.95);
    this.scene.add(hemi);

    // High-Resolution Directional Desert Sun with Wide Dust2 Shadow Frustum
    const sun = new THREE.DirectionalLight(0xfff0d4, 2.35);
    sun.position.set(48, 76, 38);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -64;
    sun.shadow.camera.right = 64;
    sun.shadow.camera.top = 64;
    sun.shadow.camera.bottom = -64;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 185;
    sun.shadow.bias = -0.00045;
    this.scene.add(sun);

    // Viewmodel dedicated realistic lighting so weapon metal/wood gleams crisply
    const vmHemi = new THREE.HemisphereLight(0xcbe2ff, 0xc8a472, 1.15);
    this.viewmodelScene.add(vmHemi);
    const vmDir = new THREE.DirectionalLight(0xfff1d6, 1.95);
    vmDir.position.set(2, 4, 2);
    this.viewmodelScene.add(vmDir);

    // Subtle Floating Desert Dust Motes
    const dustCount = 320;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3]     = (Math.random() - 0.5) * 105;
      dustPos[i * 3 + 1] = Math.random() * 8.5 - 1.0;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xf5e2bc,
      size: 0.11,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);
  }

  _setupMenuUI() {
    // Team choice buttons
    document.querySelectorAll('[data-team]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-team]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedTeam = btn.dataset.team;
      });
    });

    // Difficulty choice buttons
    document.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-diff]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedDiff = btn.dataset.diff;
      });
    });

    // Starting money mode buttons
    document.querySelectorAll('[data-money]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-money]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedMoney = parseInt(btn.dataset.money, 10);
      });
    });

    // Sensitivity slider
    const sensInput = document.getElementById('sens-slider');
    const sensVal = document.getElementById('sens-val');
    if (sensInput) {
      sensInput.addEventListener('input', () => {
        const v = parseFloat(sensInput.value);
        sensVal.textContent = v.toFixed(2);
        this.player.sensitivity = v * 0.00105;
      });
    }

    // Deploy / Start Match button
    document.getElementById('btn-deploy').addEventListener('click', () => {
      this.sound.init();
      this.elMainMenu.classList.add('hidden');
      this.menuOpen = false;
      this.hud.toggleBuyMenu(false, this.player, this.match);

      if (!this.gameStarted || this.player.team !== this.selectedTeam ||
          this.match.difficulty !== this.selectedDiff || this.match.startMoneyMode !== this.selectedMoney) {
        this.gameStarted = true;
        this.match.startNewMatch({
          playerTeam: this.selectedTeam,
          difficulty: this.selectedDiff,
          startMoney: this.selectedMoney
        });
      }
      this._requestPointerLock();
    });

    // Close buy menu button
    document.getElementById('btn-close-buy').addEventListener('click', () => {
      this.hud.toggleBuyMenu(false, this.player, this.match);
      this._requestPointerLock();
    });

    // Click to resume banner
    this.elPauseHint.addEventListener('click', () => {
      if (!this.menuOpen && !this.hud.buyMenuOpen) {
        this._requestPointerLock();
      }
    });
  }

  _requestPointerLock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {
      // Ignore browser gesture timing errors
    }
  }

  _setupControls() {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked) {
        this.player.mouseDownLeft = false;
        this.player.mouseDownRight = false;
        if (this.gameStarted && !this.menuOpen && !this.hud.buyMenuOpen) {
          this.elPauseHint.classList.remove('hidden');
        }
      } else {
        this.elPauseHint.classList.add('hidden');
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.menuOpen || this.hud.buyMenuOpen) return;
      if (document.pointerLockElement !== this.canvas) {
        this._requestPointerLock();
        return;
      }
      this.sound.init();
      if (e.button === 0) {
        this.player.mouseDownLeft = true;
        this.player.justPressedLeft = true;
      } else if (e.button === 2) {
        this.player.mouseDownRight = true;
        this.player.toggleScope();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.mouseDownLeft = false;
      if (e.button === 2) this.player.mouseDownRight = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && !this.menuOpen && !this.hud.buyMenuOpen) {
        this.player.onMouseMove(e.movementX, e.movementY);
      }
    });

    // Mouse wheel weapon cycle
    window.addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== this.canvas || this.hud.buyMenuOpen || !this.player.alive) return;
      const available = [1, 2, 3, 4, 5].filter((s) =>
        s === 3 || (s === 4 ? this.player.slots[4].length > 0 : !!this.player.slots[s])
      );
      const idx = available.indexOf(this.player.activeSlot);
      const next = available[(idx + (e.deltaY > 0 ? 1 : -1) + available.length) % available.length];
      this.player.equipSlot(next);
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.gameStarted) this.hud.setScoreboardVisible(true, this.match);
        return;
      }

      if (e.code === 'KeyM') {
        // Open Team / Match Settings modal
        this.menuOpen = !this.menuOpen;
        this.elMainMenu.classList.toggle('hidden', !this.menuOpen);
        if (this.menuOpen) {
          this.elPauseHint.classList.add('hidden');
          document.exitPointerLock?.();
        } else {
          this._requestPointerLock();
        }
        return;
      }

      if (!this.gameStarted || this.menuOpen) return;

      // Buy Menu Toggle (`B` key)
      if (e.code === 'KeyB') {
        const opened = this.hud.toggleBuyMenu(null, this.player, this.match);
        if (opened) {
          this.elPauseHint.classList.add('hidden');
          document.exitPointerLock?.();
        } else {
          this._requestPointerLock();
        }
        return;
      }

      if (e.code === 'Escape' && this.hud.buyMenuOpen) {
        this.hud.toggleBuyMenu(false, this.player, this.match);
        this._requestPointerLock();
        return;
      }

      if (this.hud.buyMenuOpen) return;

      // Weapon Slots 1-5 & CS Shortcuts (Q, R, F, G)
      if (e.code === 'Digit1') this.player.equipSlot(WEAPON_SLOTS.PRIMARY);
      else if (e.code === 'Digit2') this.player.equipSlot(WEAPON_SLOTS.SECONDARY);
      else if (e.code === 'Digit3') this.player.equipSlot(WEAPON_SLOTS.MELEE);
      else if (e.code === 'Digit4') this.player.equipSlot(WEAPON_SLOTS.GRENADE);
      else if (e.code === 'Digit5') this.player.equipSlot(WEAPON_SLOTS.C4);
      else if (e.code === 'KeyQ' && !e.repeat) this.player.quickSwitch();
      else if (e.code === 'KeyR' && !e.repeat) this.player.startReload();
      else if (e.code === 'KeyF' && !e.repeat) this.player.startInspect();
      else if (e.code === 'KeyG' && !e.repeat) this.player.dropCurrentWeapon();
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.hud.setScoreboardVisible(false, this.match);
      }
    });
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.player.vmCamera.aspect = w / h;
    this.player.vmCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    this.map.update(elapsed);
    if (this.dustPoints) {
      this.dustPoints.rotation.y = elapsed * 0.015;
    }

    if (!this.gameStarted) {
      // Cinematic aerial preview camera showcasing Dust2 before deploying!
      this.orbitAngle += dt * 0.14;
      const r = 34;
      this.camera.position.set(
        Math.cos(this.orbitAngle) * r + 6,
        13.5 + Math.sin(this.orbitAngle * 1.5) * 2.5,
        Math.sin(this.orbitAngle) * r - 8
      );
      this.camera.lookAt(4, 1.5, -12);

      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const uiBlocked = this.menuOpen || this.hud.buyMenuOpen;
    this.match.update(dt, uiBlocked);
    this.fx.update(dt, this.match.callbacks);
    this.hud.update(dt, this.player, this.match, this.fx);

    // Dual-pass render: 1) Dust2 World + Bots + Smoke  2) Depth-cleared First-Person Weapon & Gloves!
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewmodelScene, this.player.vmCamera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__cs2App = new CounterStrikeDust2App();
});
