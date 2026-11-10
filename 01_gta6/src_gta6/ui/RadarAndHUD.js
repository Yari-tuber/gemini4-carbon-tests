// ============================================================================
// GTA VI: Vice City (Leonida) — Rectangular Tilted GPS Radar Minimap,
// Wanted Stars, Weapon & Radio Radial Wheels, SnapVice Phone & Overlays
// ============================================================================

import { WEAPONS } from '../gameplay/WantedAndCombat.js';
import { RADIO_STATIONS } from '../audio/ViceAudioEngine.js';

export class RadarAndHUD {
  constructor(cityMap) {
    this.cityMap = cityMap;
    this.radarCanvas = document.getElementById('gta-radar-canvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

    // Cache DOM elements
    this.elCash = document.getElementById('hud-cash');
    this.elWanted = document.getElementById('hud-wanted-stars');
    this.elWeaponIcon = document.getElementById('hud-weapon-icon');
    this.elWeaponName = document.getElementById('hud-weapon-name');
    this.elDistrict = document.getElementById('hud-district');
    this.elVehicleName = document.getElementById('hud-vehicle-name');
    this.elSpeedo = document.getElementById('hud-speedo');
    this.elRadio = document.getElementById('hud-radio');
    this.elCharName = document.getElementById('hud-char-name');
    this.elCharRole = document.getElementById('hud-char-role');
    this.elHealthBar = document.getElementById('bar-health');
    this.elArmorBar = document.getElementById('bar-armor');
    this.elStaminaBar = document.getElementById('bar-stamina');
    this.elMissionTitle = document.getElementById('hud-mission-title');
    this.elMissionObj = document.getElementById('hud-mission-obj');
    this.elSubtitle = document.getElementById('hud-subtitle');
    this.elPrompt = document.getElementById('hud-context-prompt');
    this.elBigBanner = document.getElementById('gta-big-banner');
    this.elBannerTitle = document.getElementById('gta-banner-title');
    this.elBannerSub = document.getElementById('gta-banner-sub');
    this.elSnapFeedList = document.getElementById('snapvice-feed-list');
    this.elSnapToast = document.getElementById('snapvice-toast');

    this.subtitleTimer = 0;
    this.bannerTimer = 0;
    this.toastTimer = 0;
  }

  showSubtitle(text, duration = 5.0) {
    if (!this.elSubtitle) return;
    this.elSubtitle.textContent = text;
    this.elSubtitle.classList.add('visible');
    this.subtitleTimer = duration;
  }

  showBigBanner(title, subtitle, accentColor = '#ff47b6') {
    if (!this.elBigBanner) return;
    this.elBannerTitle.textContent = title;
    this.elBannerTitle.style.color = accentColor;
    this.elBannerSub.textContent = subtitle;
    this.elBigBanner.classList.add('active');
    this.bannerTimer = 4.2;
  }

  showSnapToast(user, text) {
    if (!this.elSnapToast) return;
    this.elSnapToast.innerHTML = `<strong>${user}</strong> <span>${text}</span>`;
    this.elSnapToast.classList.add('visible');
    this.toastTimer = 4.5;
  }

  renderSnapViceFeed(feedItems) {
    if (!this.elSnapFeedList) return;
    this.elSnapFeedList.innerHTML = feedItems
      .map(
        (item) => `
        <div class="snap-post">
          <div class="snap-post-header">
            <span class="snap-user">${item.user}</span>
            <span class="snap-tag">${item.tag}</span>
          </div>
          <div class="snap-post-body">${item.text}</div>
        </div>
      `
      )
      .join('');
  }

  updateHUD(dt, state) {
    const {
      protagonists,
      combat,
      missionSystem,
      audio,
      cameraYaw,
      nearVehicle,
      nearInteractText
    } = state;

    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0 && this.elSubtitle) {
        this.elSubtitle.classList.remove('visible');
      }
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.elBigBanner) {
        this.elBigBanner.classList.remove('active');
      }
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.elSnapToast) {
        this.elSnapToast.classList.remove('visible');
      }
    }

    const active = protagonists.getActiveActor();
    const veh = protagonists.currentVehicle;
    const pos = veh ? { x: veh.x, y: veh.y, z: veh.z } : active.pos;

    // 1. Cash, Health, Armor, Stamina
    if (this.elCash) {
      this.elCash.textContent = `$${protagonists.cash.toLocaleString()}`;
    }
    if (this.elHealthBar) this.elHealthBar.style.width = `${protagonists.health}%`;
    if (this.elArmorBar) this.elArmorBar.style.width = `${protagonists.armor}%`;
    if (this.elStaminaBar) this.elStaminaBar.style.width = `${protagonists.stamina}%`;

    // 2. Active Protagonist Badge (Lucia / Jason)
    if (this.elCharName) {
      this.elCharName.textContent = active.cfg.name;
      this.elCharName.style.color = active.cfg.accentColor;
    }
    if (this.elCharRole) {
      this.elCharRole.textContent = active.cfg.title + ' · [Tab] 切换角色';
    }

    // 3. Wanted Stars (1 to 6 Stars with police red/blue flash)
    if (this.elWanted) {
      if (combat.wantedStars === 0) {
        this.elWanted.innerHTML = '';
        this.elWanted.className = 'wanted-container';
      } else {
        let starsHTML = '';
        for (let i = 1; i <= 6; i++) {
          const activeStar = i <= combat.wantedStars;
          starsHTML += `<span class="star ${activeStar ? 'lit' : 'dim'}">★</span>`;
        }
        this.elWanted.innerHTML = starsHTML;
        this.elWanted.className = `wanted-container active ${combat.isEvading ? 'evading' : 'pursuit'}`;
      }
    }

    // 4. Weapon & District
    const w = combat.getEquippedWeapon();
    if (this.elWeaponIcon) this.elWeaponIcon.textContent = w.icon;
    if (this.elWeaponName) this.elWeaponName.textContent = `${w.name} [${w.ammo}]`;
    if (this.elDistrict) this.elDistrict.textContent = this.cityMap.getDistrictName(pos.x, pos.z);

    // 5. Vehicle Speedometer & Vice FM Radio
    if (veh) {
      const mph = Math.round(Math.abs(veh.speed) * 3.6);
      if (this.elVehicleName) this.elVehicleName.textContent = `${veh.cfg.name} (${veh.cfg.category})`;
      if (this.elSpeedo) this.elSpeedo.innerHTML = `<span class="mph-num">${mph}</span> <small>MPH</small>`;
      const st = audio.getCurrentStation();
      if (this.elRadio) {
        this.elRadio.textContent = `📻 ${st.name} (${st.genre}) · [R] 切台`;
        this.elRadio.style.color = st.color;
      }
    } else {
      if (this.elVehicleName) this.elVehicleName.textContent = 'ON FOOT · 徒步探索模式';
      const walkMph = Math.round(Math.hypot(active.vel.x, active.vel.z) * 2.2);
      if (this.elSpeedo) this.elSpeedo.innerHTML = `<span class="mph-num">${walkMph}</span> <small>MPH</small>`;
      if (this.elRadio) {
        this.elRadio.textContent = '📻 步入任何车辆即可收听 Vice FM 电台';
        this.elRadio.style.color = '#a8b2d1';
      }
    }

    // 6. Active Campaign Mission Box
    const curMission = missionSystem.getCurrentMission();
    const curStage = missionSystem.getCurrentStage();
    if (this.elMissionTitle && this.elMissionObj) {
      if (curMission && curStage) {
        this.elMissionTitle.textContent = curMission.title;
        this.elMissionObj.textContent = curStage.objective;
      } else {
        this.elMissionTitle.textContent = 'LEONIDA FREE ROAM · 罪恶都市自由模式';
        this.elMissionObj.textContent = '已完成全部主线！可随时按 [P] 打开手机重玩任务、召唤超跑直升机或体验特技跳台';
      }
    }

    // 7. Context Interaction Prompt ([F] Enter Vehicle / [E] Interact)
    if (this.elPrompt) {
      if (nearInteractText) {
        this.elPrompt.textContent = nearInteractText;
        this.elPrompt.classList.add('visible');
      } else if (!veh && nearVehicle) {
        this.elPrompt.textContent = `按 [F] 驾驶 / 劫持 ${nearVehicle.cfg.name}`;
        this.elPrompt.classList.add('visible');
      } else if (veh) {
        this.elPrompt.textContent = veh.type === 'helicopter'
          ? '直升机: [Space/E] 升空 · [Shift/C] 下降 · [WASD] 飞行 · [F] 离机'
          : '驾驶: [WASD] 操控 · [Space] 手刹漂移 · [Shift] 氮气加速 · [R] 电台 · [F] 下车';
        this.elPrompt.classList.add('visible');
      } else {
        this.elPrompt.classList.remove('visible');
      }
    }

    // 8. Draw Tilted Rectangular GTA Radar Minimap
    this._drawRadarMinimap(pos, cameraYaw, protagonists, combat, missionSystem);
  }

  _drawRadarMinimap(playerPos, cameraYaw, protagonists, combat, missionSystem) {
    const ctx = this.radarCtx;
    if (!ctx) return;
    const W = this.radarCanvas.width;
    const H = this.radarCanvas.height;
    const scale = 1.15; // pixels per world meter

    ctx.clearRect(0, 0, W, H);

    // Background dark mainland
    ctx.fillStyle = '#141724';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H * 0.58);
    // Rotate radar with camera yaw so Up is always camera forward!
    ctx.rotate(cameraYaw + Math.PI);

    const toRadarX = (wx) => (wx - playerPos.x) * scale;
    const toRadarY = (wz) => (wz - playerPos.z) * scale;

    // 1. Draw Vice Beach Sand & Atlantic Ocean
    const beachLeft = toRadarX(96);
    ctx.fillStyle = '#d9c193';
    ctx.fillRect(beachLeft, toRadarY(-400), 28 * scale, 800 * scale);

    const oceanLeft = toRadarX(120);
    ctx.fillStyle = '#0d4f6c';
    ctx.fillRect(oceanLeft, toRadarY(-400), 500 * scale, 800 * scale);

    // 2. Draw Road Network
    ctx.fillStyle = '#383d52';
    for (const r of this.cityMap.roadsForRadar) {
      ctx.fillRect(
        toRadarX(r.x - r.w / 2),
        toRadarY(r.z - r.d / 2),
        r.w * scale,
        r.d * scale
      );
    }

    // 3. Draw Buildings
    for (const b of this.cityMap.buildingsForRadar) {
      ctx.fillStyle = '#25293a';
      ctx.strokeStyle = b.color || '#ff47b6';
      ctx.lineWidth = 1;
      const bx = toRadarX(b.x - b.w / 2);
      const by = toRadarY(b.z - b.d / 2);
      ctx.fillRect(bx, by, b.w * scale, b.d * scale);
      ctx.strokeRect(bx, by, b.w * scale, b.d * scale);
    }

    // 4. Draw GPS Navigation Route Line to active mission objective!
    const stage = missionSystem.getCurrentStage();
    if (stage) {
      const tx = toRadarX(stage.target.x);
      const ty = toRadarY(stage.target.z);

      ctx.strokeStyle = '#ff3ca6';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      // L-shaped street-aligned GPS path
      ctx.lineTo(tx, 0);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing Mission Waypoint Blip
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(tx, ty, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 5. Draw Landmarks (Pay 'n' Spray, Helipad, Store)
    const pns = this.cityMap.landmarks.payNSpray;
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.arc(toRadarX(pns.x), toRadarY(pns.z), 4.5, 0, Math.PI * 2);
    ctx.fill();

    const heli = this.cityMap.landmarks.helipadTop;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(toRadarX(heli.x), toRadarY(heli.z), 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 6. Draw Partner Blip (Jason / Lucia)
    const partner = protagonists.getPartnerActor();
    if (!protagonists.currentVehicle) {
      ctx.fillStyle = partner.cfg.accentColor;
      ctx.beginPath();
      ctx.arc(toRadarX(partner.pos.x), toRadarY(partner.pos.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Draw Police Blips (Flashing Red/Blue)
    const flashRed = Math.sin(performance.now() * 0.015) > 0;
    for (const cop of combat.copsOnFoot) {
      ctx.fillStyle = flashRed ? '#ff2942' : '#2979ff';
      ctx.beginPath();
      ctx.arc(toRadarX(cop.x), toRadarY(cop.z), 4.0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const v of protagonists.vehicleManager?.vehicles || []) {
      if (v.isPolicePursuit && !v.exploded) {
        ctx.fillStyle = flashRed ? '#2979ff' : '#ff2942';
        ctx.beginPath();
        ctx.arc(toRadarX(v.x), toRadarY(v.z), 5.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // 8. Draw Player White Arrow in Center of Radar
    ctx.save();
    ctx.translate(W / 2, H * 0.58);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North 'N' indicator badge on radar border
    const northAngle = cameraYaw + Math.PI - Math.PI / 2;
    const nx = W / 2 + Math.cos(northAngle) * (W * 0.42);
    const ny = H * 0.58 + Math.sin(northAngle) * (H * 0.38);
    ctx.fillStyle = '#0c0e18';
    ctx.beginPath();
    ctx.arc(nx, ny, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }
}
