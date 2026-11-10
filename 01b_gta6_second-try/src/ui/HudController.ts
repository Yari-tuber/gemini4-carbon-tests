import * as THREE from 'three';
import { WeaponDef, WeaponId, WeatherMode } from '../types';
import { CityBuilder } from '../world/CityBuilder';
import { PlayerSystem } from '../entities/PlayerSystem';
import { PedAndPoliceSystem } from '../entities/PedAndPolice';
import { ActiveMissionHudInfo } from '../gameplay/MissionManager';
import { AudioEngine } from '../core/AudioEngine';

export class HudController {
  private city: CityBuilder;
  private player: PlayerSystem;
  private police: PedAndPoliceSystem;
  private audio: AudioEngine;

  // Cached DOM Elements
  private hudLayer = document.getElementById('hud-layer')!;
  private radarFrame = document.getElementById('radar-frame')!;
  private radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
  private radarCtx: CanvasRenderingContext2D;
  private districtLabel = document.getElementById('district-label')!;

  private barHealth = document.getElementById('bar-health')!;
  private barArmor = document.getElementById('bar-armor')!;
  private barSpecial = document.getElementById('bar-special')!;

  private starEls = Array.from(document.querySelectorAll('#wanted-stars .star'));
  private cashDisplay = document.getElementById('cash-display')!;
  private cashDelta = document.getElementById('cash-delta')!;
  private charBadge = document.getElementById('char-badge')!;
  private weaponHudName = document.getElementById('weapon-hud-name')!;
  private weaponHudAmmo = document.getElementById('weapon-hud-ammo')!;
  private worldClock = document.getElementById('world-clock')!;

  private missionTitle = document.getElementById('mission-title')!;
  private missionObj = document.getElementById('mission-obj')!;
  private interactPrompt = document.getElementById('interact-prompt')!;

  private socialToast = document.getElementById('social-toast')!;
  private socialUser = document.getElementById('social-user')!;
  private socialText = document.getElementById('social-text')!;

  private vehiclePopup = document.getElementById('vehicle-popup')!;
  private radioBadge = document.getElementById('radio-badge')!;
  private speedoPanel = document.getElementById('speedo-panel')!;
  private speedValue = document.getElementById('speed-value')!;
  private gearIndicator = document.getElementById('gear-indicator')!;
  private subtitleBar = document.getElementById('subtitle-bar')!;
  private hitmarker = document.getElementById('hitmarker')!;
  private crosshair = document.getElementById('crosshair')!;
  private screenFx = document.getElementById('screen-fx')!;
  private pointerHint = document.getElementById('pointer-hint')!;

  // Overlays
  private wheelOverlay = document.getElementById('weapon-wheel-overlay')!;
  private wheelHost = document.getElementById('wheel-slots-host')!;
  private wheelSelTitle = document.getElementById('wheel-sel-title')!;
  private wheelSelDesc = document.getElementById('wheel-sel-desc')!;

  private phonePanel = document.getElementById('phone-panel')!;
  private phoneTime = document.getElementById('phone-time')!;

  private shopModal = document.getElementById('shop-modal')!;
  private shopGrid = document.getElementById('shop-items-grid')!;

  private bigBanner = document.getElementById('big-banner')!;
  private bannerMain = document.getElementById('banner-main')!;
  private bannerSub = document.getElementById('banner-sub')!;

  public isWheelOpen = false;
  public isPhoneOpen = false;
  public isShopOpen = false;

  private subtitleTimer = 0;
  private bannerTimer = 0;
  private socialToastTimer = 0;
  private vehiclePopupTimer = 0;
  private cashDeltaTimer = 0;
  private hitmarkerTimer = 0;
  private damageFlashTimer = 0;
  private lastVehicleId = -1;

  // Phone / Shop Action Handler injected from main.ts
  public onPhoneAction: (action: string) => void = () => {};
  public onBuyShopItem: (itemId: string) => void = () => {};

  constructor(
    city: CityBuilder,
    player: PlayerSystem,
    police: PedAndPoliceSystem,
    audio: AudioEngine
  ) {
    this.city = city;
    this.player = player;
    this.police = police;
    this.audio = audio;

    this.radarCtx = this.radarCanvas.getContext('2d')!;

    this.buildWeaponWheelDOM();
    this.bindPhoneEvents();
    this.buildShopDOM();
  }

  public showHud(): void {
    this.hudLayer.classList.remove('hidden');
  }

  public isAnyMenuBlockingPointer(): boolean {
    return this.isWheelOpen || this.isPhoneOpen || this.isShopOpen;
  }

  private buildWeaponWheelDOM(): void {
    const ids: WeaponId[] = ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'rpg'];
    const radius = 148;
    ids.forEach((id, idx) => {
      const angle = (idx / ids.length) * Math.PI * 2 - Math.PI / 2;
      const cx = 210 + Math.cos(angle) * radius;
      const cy = 210 + Math.sin(angle) * radius;

      const slot = document.createElement('div');
      slot.className = 'wheel-slot';
      slot.dataset.wid = id;
      slot.style.left = `${cx}px`;
      slot.style.top = `${cy}px`;

      const def = this.player.arsenal[id];
      slot.innerHTML = `
        <div class="wheel-slot-name">[${idx + 1}] ${def.cnName.split(' ')[0]}</div>
        <div class="wheel-slot-ammo" id="wslot-ammo-${id}">${id === 'fists' ? '∞' : def.ammo}</div>
      `;

      slot.addEventListener('mouseenter', () => {
        this.wheelSelTitle.textContent = def.cnName;
        this.wheelSelDesc.textContent = `伤害 ${def.damage} · 射程 ${def.range}m`;
      });
      slot.addEventListener('click', () => {
        this.player.equipWeapon(id);
        this.audio.playUiClick(820);
        this.setWeaponWheelOpen(false);
      });

      this.wheelHost.appendChild(slot);
    });
  }

  public setWeaponWheelOpen(open: boolean): void {
    if (this.isWheelOpen === open) return;
    this.isWheelOpen = open;
    this.wheelOverlay.classList.toggle('visible', open);
    if (open) {
      // Refresh ammo counts & highlight current weapon
      const slots = this.wheelHost.querySelectorAll('.wheel-slot');
      slots.forEach((el) => {
        const wid = (el as HTMLElement).dataset.wid as WeaponId;
        el.classList.toggle('selected', wid === this.player.currentWeaponId);
        const ammoEl = document.getElementById(`wslot-ammo-${wid}`);
        if (ammoEl) {
          ammoEl.textContent = wid === 'fists' ? '∞' : `${this.player.arsenal[wid].ammo}`;
        }
      });
      this.wheelSelTitle.textContent = this.player.currentWeapon.cnName;
    }
  }

  private bindPhoneEvents(): void {
    const buttons = this.phonePanel.querySelectorAll('.phone-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        if (action) {
          this.audio.playUiClick(740);
          this.onPhoneAction(action);
        }
      });
    });
  }

  public togglePhone(forceState?: boolean): void {
    const next = forceState ?? !this.isPhoneOpen;
    this.isPhoneOpen = next;
    this.phonePanel.classList.toggle('open', next);
    this.audio.playUiClick(next ? 680 : 480);
  }

  private buildShopDOM(): void {
    const items: Array<{ id: string; title: string; desc: string; price: number }> = [
      { id: 'armor', title: '🛡️ 重型凯夫拉防弹衣', desc: '护甲恢复至 100%', price: 300 },
      { id: 'medkit', title: '❤️ 急救医疗包', desc: '生命值恢复至 100%', price: 150 },
      { id: 'pistol', title: '🔫 战术手枪弹药补给', desc: '+120 发 9mm 弹药', price: 200 },
      { id: 'smg', title: '🔫 微型冲锋枪 + 弹药', desc: '+180 发车载冲锋弹', price: 450 },
      { id: 'shotgun', title: '💥 泵动式霰弹枪 + 弹药', desc: '+40 发鹿弹', price: 650 },
      { id: 'rifle', title: '🎯 M4 卡宾步枪 + 弹药', desc: '+180 发步枪弹', price: 900 },
      { id: 'rpg', title: '🚀 RPG-7 火箭筒 + 6枚火箭弹', desc: '警用直升机与路障克星', price: 1500 },
      { id: 'special', title: '⚡ 雷奥奈达肾上腺素', desc: '充满双主角子弹时间能量', price: 250 }
    ];

    this.shopGrid.innerHTML = '';
    for (const it of items) {
      const btn = document.createElement('button');
      btn.className = 'shop-item-btn';
      btn.innerHTML = `
        <div style="font-weight:800;font-size:14px;margin-bottom:3px;">${it.title}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:6px;">${it.desc}</div>
        <div style="color:#6ee778;font-weight:800;font-family:'Rajdhani',sans-serif;">$${it.price}</div>
      `;
      btn.addEventListener('click', () => {
        this.onBuyShopItem(it.id);
      });
      this.shopGrid.appendChild(btn);
    }

    document.getElementById('close-shop-btn')?.addEventListener('click', () => {
      this.setShopOpen(false);
    });
  }

  public setShopOpen(open: boolean): void {
    this.isShopOpen = open;
    this.shopModal.classList.toggle('open', open);
    this.audio.playUiClick(open ? 700 : 450);
  }

  public showSubtitle(text: string, duration = 4.5): void {
    this.subtitleBar.textContent = text;
    this.subtitleBar.classList.add('visible');
    this.subtitleTimer = duration;
  }

  public showBanner(main: string, sub: string, colorHex = '#ffd166', duration = 4.0): void {
    this.bannerMain.textContent = main;
    this.bannerMain.style.color = colorHex;
    this.bannerSub.textContent = sub;
    this.bigBanner.classList.add('visible');
    this.bannerTimer = duration;
  }

  public showSocialPost(handle: string, text: string): void {
    this.socialUser.textContent = handle;
    this.socialText.textContent = text;
    this.socialToast.classList.add('visible');
    this.socialToastTimer = 6.5;
  }

  public showCashDelta(delta: number): void {
    this.cashDelta.textContent = `${delta >= 0 ? '+' : '-'}$${Math.abs(delta).toLocaleString()}`;
    this.cashDelta.style.color = delta >= 0 ? '#6ee778' : '#f87171';
    this.cashDelta.classList.add('show');
    this.cashDeltaTimer = 2.2;
  }

  public triggerHitmarker(isKill: boolean): void {
    this.hitmarker.classList.add('active');
    this.hitmarker.classList.toggle('kill', isKill);
    this.hitmarkerTimer = 0.14;
  }

  public triggerDamageFlash(): void {
    this.screenFx.classList.add('damage');
    this.damageFlashTimer = 0.24;
  }

  public update(
    dt: number,
    clockStr: string,
    camYaw: number,
    isPointerLocked: boolean,
    isAiming: boolean,
    missionInfo: ActiveMissionHudInfo,
    promptText: string | null
  ): void {
    const p = this.player.active;

    // Timers
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitleBar.classList.remove('visible');
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bigBanner.classList.remove('visible');
    }
    if (this.socialToastTimer > 0) {
      this.socialToastTimer -= dt;
      if (this.socialToastTimer <= 0) this.socialToast.classList.remove('visible');
    }
    if (this.cashDeltaTimer > 0) {
      this.cashDeltaTimer -= dt;
      if (this.cashDeltaTimer <= 0) this.cashDelta.classList.remove('show');
    }
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) this.hitmarker.classList.remove('active', 'kill');
    }
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      if (this.damageFlashTimer <= 0) this.screenFx.classList.remove('damage');
    }

    this.screenFx.classList.toggle('special-active', this.player.specialAbilityActive);
    this.pointerHint.classList.toggle('visible', !isPointerLocked && !this.isAnyMenuBlockingPointer());

    // Crosshair expansion
    this.crosshair.style.transform = `translate(-50%, -50%) scale(${isAiming ? 0.78 : 1.05})`;

    // Vital bars
    this.barHealth.style.width = `${(p.health / p.maxHealth) * 100}%`;
    this.barArmor.style.width = `${(p.armor / p.maxArmor) * 100}%`;
    this.barSpecial.style.width = `${p.specialCharge}%`;

    // Wanted Stars
    for (let i = 0; i < 5; i++) {
      const el = this.starEls[i];
      const active = i < this.police.wantedLevel;
      el.classList.toggle('active', active);
      el.classList.toggle('cooldown', active && this.police.inCooldown);
    }
    this.radarFrame.classList.toggle(
      'police-alert',
      this.police.wantedLevel > 0 && !this.police.inCooldown
    );

    // Cash, Protagonist Badge & Weapon HUD
    this.cashDisplay.textContent = `$${this.player.cash.toLocaleString()}`;
    this.charBadge.textContent = `${p.name} ${p.cnName}`;
    this.charBadge.classList.toggle('jason', p.id === 'jason');

    const w: WeaponDef = this.player.currentWeapon;
    this.weaponHudName.textContent = w.cnName.split(' ')[0];
    this.weaponHudAmmo.textContent = w.id === 'fists' ? '∞' : `${w.ammo}`;

    const district = this.city.getDistrictName(p.position.x, p.position.z);
    this.worldClock.textContent = `${clockStr} · ${district.split(' ')[0]}`;
    this.phoneTime.textContent = clockStr;
    this.districtLabel.textContent = district;

    // Mission & Prompt
    this.missionTitle.textContent = missionInfo.title;
    this.missionObj.textContent = missionInfo.objective;

    if (promptText) {
      this.interactPrompt.textContent = promptText;
      this.interactPrompt.classList.add('visible');
    } else {
      this.interactPrompt.classList.remove('visible');
    }

    // Vehicle Speedometer & Radio Badge
    const veh = this.player.currentVehicle;
    if (veh) {
      if (veh.id !== this.lastVehicleId) {
        this.lastVehicleId = veh.id;
        this.vehiclePopup.textContent = `${veh.spec.displayName} · ${veh.spec.cnName}`;
        this.vehiclePopup.classList.add('visible');
        this.vehiclePopupTimer = 3.5;
      }
      if (this.vehiclePopupTimer > 0) {
        this.vehiclePopupTimer -= dt;
        if (this.vehiclePopupTimer <= 0) this.vehiclePopup.classList.remove('visible');
      }

      this.speedoPanel.classList.add('visible');
      const mph = Math.round(Math.abs(veh.speed) * 2.4);
      this.speedValue.textContent = `${mph}`;
      const gear = veh.speed < -0.5 ? 'REV' : `GEAR ${Math.min(6, Math.max(1, Math.ceil(mph / 22)))}`;
      this.gearIndicator.textContent = veh.kind === 'helicopter' ? `ALT ${Math.round(veh.position.y)}m` : gear;

      this.radioBadge.classList.add('visible');
      this.radioBadge.textContent = this.audio.getStationTitle();
    } else {
      this.lastVehicleId = -1;
      this.speedoPanel.classList.remove('visible');
      this.radioBadge.classList.remove('visible');
      this.vehiclePopup.classList.remove('visible');
    }

    // Render GTA Rotating Minimap Radar + GPS Route!
    this.renderMinimap(p.position, camYaw, missionInfo);
  }

  private renderMinimap(
    playerPos: THREE.Vector3,
    camYaw: number,
    missionInfo: ActiveMissionHudInfo
  ): void {
    const ctx = this.radarCtx;
    const W = this.radarCanvas.width;
    const H = this.radarCanvas.height;
    const cx = W / 2;
    const cy = H * 0.62; // Offset slightly down like GTA V/VI radar so you see further ahead!
    const scale = 0.78; // Pixels per meter

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    // Rotate radar so camera forward (-sin(camYaw), -cos(camYaw)) points UP (0, -1) on canvas!
    ctx.rotate(camYaw);

    // Draw pre-baked Vice City map background
    const { minX, maxX, minZ, maxZ } = this.city.mapBounds;
    const worldW = maxX - minX;
    const worldH = maxZ - minZ;
    const drawX = (minX - playerPos.x) * scale;
    const drawY = (minZ - playerPos.z) * scale;
    ctx.drawImage(this.city.minimapBgCanvas, drawX, drawY, worldW * scale, worldH * scale);

    // Draw GPS Orthogonal Street Route Line to Objective!
    if (missionInfo.gpsTarget) {
      const tx = missionInfo.gpsTarget.x;
      const tz = missionInfo.gpsTarget.z;
      // Snap via nearest road avenue for authentic GTA Manhattan street routing
      let snapRx = this.city.roadsX[0];
      for (const rx of this.city.roadsX) {
        if (Math.abs(rx - playerPos.x) < Math.abs(snapRx - playerPos.x)) snapRx = rx;
      }

      ctx.strokeStyle = missionInfo.gpsColor;
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((snapRx - playerPos.x) * scale, 0);
      ctx.lineTo((snapRx - playerPos.x) * scale, (tz - playerPos.z) * scale);
      ctx.lineTo((tx - playerPos.x) * scale, (tz - playerPos.z) * scale);
      ctx.stroke();
    }

    // Draw Static Landmarks (POIs)
    for (const poi of this.city.pois) {
      const px = (poi.position.x - playerPos.x) * scale;
      const pz = (poi.position.z - playerPos.z) * scale;
      ctx.fillStyle = poi.color;
      ctx.beginPath();
      ctx.arc(px, pz, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Draw Partner Blip (Blue/Pink)
    if (!this.player.currentVehicle) {
      const mate = this.player.partner;
      const mx = (mate.position.x - playerPos.x) * scale;
      const mz = (mate.position.z - playerPos.z) * scale;
      ctx.fillStyle = mate.id === 'jason' ? '#38bdf8' : '#ff2e93';
      ctx.beginPath();
      ctx.arc(mx, mz, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Police Vision Cones & Hostile Blips!
    const flashBlue = Math.sin(performance.now() * 0.016) > 0;
    for (const npc of this.police.npcs) {
      if (npc.dead || npc.role === 'civilian') continue;
      const nx = (npc.position.x - playerPos.x) * scale;
      const nz = (npc.position.z - playerPos.z) * scale;

      if (npc.role === 'police' || npc.role === 'swat') {
        if (this.police.wantedLevel > 0) {
          // Vision cone
          ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
          ctx.beginPath();
          ctx.moveTo(nx, nz);
          const ang = Math.atan2(npc.rig.root.position.x - npc.position.x, 1) + npc.heading;
          ctx.arc(nx, nz, 28, Math.PI / 2 - npc.heading - 0.5, Math.PI / 2 - npc.heading + 0.5);
          void ang;
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = flashBlue ? '#3b82f6' : '#ef4444';
      } else {
        ctx.fillStyle = '#ef4444'; // Gang hostile red dot
      }
      ctx.beginPath();
      ctx.arc(nx, nz, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Draw Clamped Edge Objective Blip so player ALWAYS knows where the mission/GPS is!
    if (missionInfo.gpsTarget) {
      const wx = missionInfo.gpsTarget.x - playerPos.x;
      const wz = missionInfo.gpsTarget.z - playerPos.z;
      const cos = Math.cos(camYaw);
      const sin = Math.sin(camYaw);
      const rx = (wx * cos - wz * sin) * scale;
      const ry = (wx * sin + wz * cos) * scale;

      const bx = THREE.MathUtils.clamp(cx + rx, 12, W - 12);
      const by = THREE.MathUtils.clamp(cy + ry, 12, H - 12);

      ctx.fillStyle = missionInfo.gpsColor;
      ctx.beginPath();
      ctx.arc(bx, by, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Player Center White Triangle Arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6.2, 6.5);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.2, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
