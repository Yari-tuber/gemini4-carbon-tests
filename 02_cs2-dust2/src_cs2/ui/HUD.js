// Counter-Strike: Dust II — Authentic CS2 Tactical HUD, Rotating Dust2 Radar, Buy Menu & Scoreboard
import { WEAPONS, WEAPON_SLOTS, EQUIPMENT_SHOP } from '../config/WeaponsData.js';

export class HUD {
  constructor(map) {
    this.map = map;
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');
    this.crosshairCanvas = document.getElementById('crosshair-canvas');
    this.chCtx = this.crosshairCanvas.getContext('2d');

    // DOM Elements
    this.elCallout = document.getElementById('hud-callout');
    this.elMoney = document.getElementById('hud-money');
    this.elMoneyDelta = document.getElementById('hud-money-delta');
    this.elTimer = document.getElementById('hud-timer');
    this.elScoreCT = document.getElementById('hud-score-ct');
    this.elScoreT = document.getElementById('hud-score-t');
    this.elPipsCT = document.getElementById('hud-pips-ct');
    this.elPipsT = document.getElementById('hud-pips-t');
    this.elHP = document.getElementById('hud-hp');
    this.elArmor = document.getElementById('hud-armor');
    this.elHelmBadge = document.getElementById('hud-helm-badge');
    this.elKitBadge = document.getElementById('hud-kit-badge');
    this.elAmmoMag = document.getElementById('hud-ammo-mag');
    this.elAmmoRes = document.getElementById('hud-ammo-res');
    this.elWeaponName = document.getElementById('hud-weapon-name');
    this.elWeaponList = document.getElementById('hud-weapon-slots');
    this.elKillfeed = document.getElementById('hud-killfeed');
    this.elRadio = document.getElementById('hud-radio');
    this.elActionHint = document.getElementById('hud-action-hint');
    this.elProgressWrap = document.getElementById('hud-progress-wrap');
    this.elProgressLabel = document.getElementById('hud-progress-label');
    this.elProgressFill = document.getElementById('hud-progress-fill');
    this.elRoundBanner = document.getElementById('hud-round-banner');
    this.elBannerTitle = document.getElementById('banner-title');
    this.elBannerSub = document.getElementById('banner-sub');
    this.elScopeOverlay = document.getElementById('scope-overlay');
    this.elFlashOverlay = document.getElementById('flash-overlay');
    this.elSmokeOverlay = document.getElementById('smoke-overlay');
    this.elDamageOverlay = document.getElementById('damage-overlay');
    this.elBuyMenu = document.getElementById('buy-menu');
    this.elBuyToast = document.getElementById('buy-toast');
    this.elBuyMoney = document.getElementById('buy-money-val');
    this.elBuyGrid = document.getElementById('buy-grid');
    this.elScoreboard = document.getElementById('scoreboard-modal');
    this.elSbCT = document.getElementById('sb-ct-rows');
    this.elSbT = document.getElementById('sb-t-rows');

    this.hitmarkerTimer = 0;
    this.hitmarkerHead = false;
    this.hitmarkerKill = false;
    this.damageAlpha = 0;
    this.damageAngle = 0;
    this.radioTimer = 0;
    this.moneyDeltaTimer = 0;

    this.buyMenuOpen = false;
    this.crosshairColor = '#38ff7a';
    this.onBuyItem = null;
  }

  triggerHitmarker(isHeadshot = false, isKill = false) {
    this.hitmarkerTimer = isKill ? 0.28 : 0.18;
    this.hitmarkerHead = isHeadshot;
    this.hitmarkerKill = isKill;
  }

  triggerDamageIndicator(attackerPos, playerPos, playerYaw) {
    this.damageAlpha = 0.85;
    if (attackerPos && playerPos) {
      const dx = attackerPos.x - playerPos.x;
      const dz = attackerPos.z - playerPos.z;
      const worldAngle = Math.atan2(-dx, -dz);
      this.damageAngle = worldAngle - playerYaw;
    }
  }

  showMoneyDelta(delta) {
    if (!this.elMoneyDelta) return;
    this.elMoneyDelta.textContent = `${delta >= 0 ? '+' : '-'}$${Math.abs(delta)}`;
    this.elMoneyDelta.style.color = delta >= 0 ? '#4dff88' : '#ff5a52';
    this.elMoneyDelta.style.opacity = '1';
    this.moneyDeltaTimer = 2.2;
  }

  showRadioMessage(sender, text) {
    this.elRadio.innerHTML = `<span class="radio-tag">[无线电 · ${sender}]</span> ${text}`;
    this.elRadio.style.opacity = '1';
    this.radioTimer = 5.2;
  }

  pushKillfeed({ killerName, killerTeam, victimName, victimTeam, weaponId, isHeadshot, isWallbang }) {
    const row = document.createElement('div');
    row.className = 'kf-row';
    const wName = (WEAPONS[weaponId] && WEAPONS[weaponId].name) || weaponId.toUpperCase();
    const kClass = killerTeam === 'CT' ? 'team-ct-txt' : 'team-t-txt';
    const vClass = victimTeam === 'CT' ? 'team-ct-txt' : 'team-t-txt';
    const wbTag = isWallbang ? `<span class="kf-badge wb">穿墙</span>` : '';
    const hsTag = isHeadshot ? `<span class="kf-badge hs">爆头</span>` : '';

    row.innerHTML = `
      <span class="${kClass}">${killerName}</span>
      <span class="kf-weapon">${wName}</span>
      ${wbTag}${hsTag}
      <span class="${vClass}">${victimName}</span>
    `;
    this.elKillfeed.appendChild(row);
    while (this.elKillfeed.children.length > 6) {
      this.elKillfeed.removeChild(this.elKillfeed.firstChild);
    }
    setTimeout(() => {
      row.style.opacity = '0';
      setTimeout(() => { if (row.parentNode) row.parentNode.removeChild(row); }, 400);
    }, 5800);
  }

  showRoundBanner(winningTeam, reasonText, scoreCT, scoreT) {
    this.elRoundBanner.classList.remove('hidden', 'ct-win', 't-win');
    this.elRoundBanner.classList.add(winningTeam === 'CT' ? 'ct-win' : 't-win');
    this.elBannerTitle.textContent = winningTeam === 'CT'
      ? 'COUNTER-TERRORISTS WIN · 反恐精英获胜'
      : 'TERRORISTS WIN · 恐怖分子获胜';
    this.elBannerSub.textContent = `${reasonText}  |  当前比分 CT ${scoreCT} : ${scoreT} T`;
  }

  hideRoundBanner() {
    this.elRoundBanner.classList.add('hidden');
  }

  // ==================== CS2 BUY MENU ====================

  toggleBuyMenu(forceState = null, player, match) {
    const next = forceState !== null ? forceState : !this.buyMenuOpen;
    if (next && !match.canPlayerBuy()) {
      this.showRadioMessage('军火库提示', '当前不在购买时间内（每回合前 28 秒可按 B 购买）');
      return false;
    }
    this.buyMenuOpen = next;
    this.elBuyMenu.classList.toggle('hidden', !this.buyMenuOpen);
    if (this.buyMenuOpen) {
      this.renderBuyMenu(player);
    }
    return this.buyMenuOpen;
  }

  renderBuyMenu(player) {
    this.elBuyMoney.textContent = `$ ${player.money.toLocaleString()}`;
    const team = player.team;

    const columns = [
      {
        title: '1 · 护甲与装备',
        items: EQUIPMENT_SHOP.filter((e) => e.team === 'BOTH' || e.team === team).map((e) => {
          const price = (e.id === 'vesthelm' && player.armor >= 80) ? 350 : e.price;
          const owned = (e.id === 'kevlar' && player.armor >= 100) ||
                        (e.id === 'vesthelm' && player.armor >= 100 && player.hasHelmet) ||
                        (e.id === 'defuser' && player.hasDefuser);
          return { id: e.id, name: e.name, zh: e.zhName, price, owned };
        })
      },
      {
        title: '2 · 手枪 Pistols',
        items: ['usp', 'glock', 'p250', 'deagle']
          .map((id) => WEAPONS[id])
          .filter((w) => w && (w.team === 'BOTH' || w.team === team))
          .map((w) => ({
            id: w.id, name: w.name, zh: w.zhName, price: w.price,
            owned: player.slots[WEAPON_SLOTS.SECONDARY]?.id === w.id
          }))
      },
      {
        title: '3 · 微冲/重武 Mid-Tier',
        items: ['mp9', 'mac10', 'xm1014']
          .map((id) => WEAPONS[id])
          .filter((w) => w && (w.team === 'BOTH' || w.team === team))
          .map((w) => ({
            id: w.id, name: w.name, zh: w.zhName, price: w.price,
            owned: player.slots[WEAPON_SLOTS.PRIMARY]?.id === w.id
          }))
      },
      {
        title: '4 · 步枪与狙击 Rifles',
        items: ['famas', 'galil', 'm4a1s', 'ak47', 'ssg08', 'awp']
          .map((id) => WEAPONS[id])
          .filter((w) => w && (w.team === 'BOTH' || w.team === team))
          .map((w) => ({
            id: w.id, name: w.name, zh: w.zhName, price: w.price,
            owned: player.slots[WEAPON_SLOTS.PRIMARY]?.id === w.id
          }))
      },
      {
        title: '5 · 战术投掷物 Utility',
        items: ['flashbang', 'smokegrenade', 'hegrenade']
          .map((id) => WEAPONS[id])
          .map((w) => {
            const count = player.slots[WEAPON_SLOTS.GRENADE].filter((g) => g === w.id).length;
            const max = w.id === 'flashbang' ? 2 : 1;
            return {
              id: w.id, name: w.name, zh: `${w.zhName} (${count}/${max})`,
              price: w.price, owned: count >= max
            };
          })
      }
    ];

    this.elBuyGrid.innerHTML = '';
    for (const col of columns) {
      const colDiv = document.createElement('div');
      colDiv.className = 'buy-col';
      colDiv.innerHTML = `<div class="buy-col-title">${col.title}</div>`;

      for (const it of col.items) {
        const canAfford = player.money >= it.price;
        const btn = document.createElement('button');
        btn.className = `buy-card ${it.owned ? 'owned' : ''} ${!canAfford && !it.owned ? 'locked' : ''}`;
        btn.innerHTML = `
          <div class="buy-card-top">
            <span class="buy-card-name">${it.name}</span>
            <span class="buy-card-price">${it.owned ? '已装备' : '$' + it.price}</span>
          </div>
          <div class="buy-card-zh">${it.zh}</div>
        `;
        btn.addEventListener('click', () => {
          if (this.onBuyItem) {
            const res = this.onBuyItem(it.id);
            this.elBuyToast.textContent = res.msg;
            this.elBuyToast.style.color = res.ok ? '#5eff96' : '#ff6c64';
            this.renderBuyMenu(player);
          }
        });
        colDiv.appendChild(btn);
      }
      this.elBuyGrid.appendChild(colDiv);
    }
  }

  // ==================== SCOREBOARD (TAB) ====================

  setScoreboardVisible(visible, match) {
    this.elScoreboard.classList.toggle('hidden', !visible);
    if (!visible || !match) return;

    const renderTeamRows = (container, list) => {
      const sorted = [...list].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      container.innerHTML = sorted.map((p) => `
        <tr class="${p.isPlayer ? 'me-row' : ''} ${!p.alive ? 'dead-row' : ''}">
          <td>${p.name} ${p.hasC4 || p.slots?.[5] ? '💣' : ''} ${p.hasDefuser ? '✂️' : ''}</td>
          <td>${p.alive ? p.hp + ' HP' : '阵亡'}</td>
          <td>$${p.money}</td>
          <td><b>${p.kills}</b></td>
          <td>${p.deaths}</td>
        </tr>
      `).join('');
    };

    renderTeamRows(this.elSbCT, match.getTeamMembers('CT'));
    renderTeamRows(this.elSbT, match.getTeamMembers('T'));
  }

  // ==================== MAIN HUD FRAME RENDER ====================

  update(dt, player, match, fx) {
    if (this.hitmarkerTimer > 0) this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - dt);
    if (this.damageAlpha > 0) this.damageAlpha = Math.max(0, this.damageAlpha - dt * 1.8);
    if (this.radioTimer > 0) {
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) this.elRadio.style.opacity = '0';
    }
    if (this.moneyDeltaTimer > 0) {
      this.moneyDeltaTimer -= dt;
      if (this.moneyDeltaTimer <= 0) this.elMoneyDelta.style.opacity = '0';
    }

    // 1. Flashbang Whiteout, Smoke Screen Haze & Directional Damage Vignette
    this.elFlashOverlay.style.opacity = player.flashAlpha.toFixed(3);
    const smokeDensity = fx.getSmokeOverlayAt(player.getEyePosition());
    this.elSmokeOverlay.style.opacity = smokeDensity.toFixed(3);

    if (this.damageAlpha > 0.01) {
      this.elDamageOverlay.style.opacity = this.damageAlpha.toFixed(2);
      const deg = (this.damageAngle * 180 / Math.PI).toFixed(1);
      this.elDamageOverlay.style.transform = `rotate(${deg}deg)`;
    } else {
      this.elDamageOverlay.style.opacity = '0';
    }

    // 2. Sniper Dual-Lens Scope Overlay (AWP / SSG 08)
    const activeDef = player.getActiveWeaponDef();
    const scoped = player.alive && player.scopeLevel > 0 && activeDef.sniper;
    this.elScopeOverlay.classList.toggle('hidden', !scoped);

    // 3. Top Header: Round Timer / Bomb Planted Alert & Team Scores + Alive Pips
    this.elScoreCT.textContent = match.scoreCT;
    this.elScoreT.textContent = match.scoreT;

    if (match.matchState.bombPlanted) {
      const bt = Math.max(0, match.matchState.bombTimer);
      this.elTimer.textContent = `💣 ${bt.toFixed(1)}s`;
      this.elTimer.classList.add('bomb-alert');
    } else {
      this.elTimer.classList.remove('bomb-alert');
      const sec = Math.max(0, Math.ceil(match.phaseTimer));
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, '0');
      this.elTimer.textContent = match.phase === 'FREEZE' ? `准备 ${m}:${s}` : `${m}:${s}`;
    }

    const ctMembers = match.getTeamMembers('CT');
    const tMembers  = match.getTeamMembers('T');
    this.elPipsCT.innerHTML = ctMembers.map((p) => `<span class="pip ct ${p.alive ? 'alive' : 'dead'}"></span>`).join('');
    this.elPipsT.innerHTML  = tMembers.map((p) => `<span class="pip t ${p.alive ? 'alive' : 'dead'}"></span>`).join('');

    // 4. Callout & Money
    this.elCallout.textContent = this.map.getCallout(player.pos);
    this.elMoney.textContent = `$ ${player.money.toLocaleString()}`;

    // 5. HP, Armor, Helmet & Defuse Kit
    this.elHP.textContent = player.hp;
    this.elHP.style.color = player.hp <= 25 ? '#ff4e45' : '#ffffff';
    this.elArmor.textContent = player.armor;
    this.elHelmBadge.style.display = player.hasHelmet && player.armor > 0 ? 'inline-block' : 'none';
    this.elKitBadge.style.display = player.team === 'CT' && player.hasDefuser ? 'inline-block' : 'none';

    // 6. Active Weapon & 5-Slot Inventory Stack
    const activeItem = player.getActiveItem();
    this.elWeaponName.textContent = `${activeDef.name} · ${activeDef.zhName}`;
    if (activeDef.magSize) {
      this.elAmmoMag.textContent = activeItem ? activeItem.mag : 0;
      this.elAmmoRes.textContent = `/ ${activeItem ? activeItem.reserve : 0}`;
    } else {
      this.elAmmoMag.textContent = '—';
      this.elAmmoRes.textContent = '';
    }

    this._renderWeaponSlots(player);

    // 7. Contextual Tactical Prompts & Plant/Defuse Progress Bar
    let hint = '';
    const inSite = this.map.getBombsiteAt(player.pos);
    if (player.alive) {
      if (player.team === 'T' && inSite && player.slots[WEAPON_SLOTS.C4] && !match.matchState.bombPlanted) {
        hint = `已进入 [${inSite.name} 包点] · 按住 [E] 或切出 C4 按住 [左键] 安放炸弹`;
      } else if (player.team === 'CT' && match.canPlayerDefuse(player)) {
        hint = `按住 [E] 拆除 C4 炸弹 (${player.hasDefuser ? '拆弹器 5.0 秒' : '无钳 10.0 秒'})`;
      } else if (match.phase === 'FREEZE') {
        hint = '回合冻结阶段 · 按 [B] 打开军火库购买 AK-47 / M4A1-S / AWP / 护甲与投掷物';
      }
    } else {
      hint = '你已阵亡 · 正在等待当前回合结束...';
    }
    this.elActionHint.textContent = hint;
    this.elActionHint.style.opacity = hint ? '1' : '0';

    if (player.plantProgress > 0) {
      this.elProgressWrap.classList.remove('hidden');
      this.elProgressLabel.textContent = '正在输入密码 7355608 安放 C4...';
      this.elProgressFill.style.width = `${Math.min(100, player.plantProgress * 100).toFixed(1)}%`;
    } else if (player.defuseProgress > 0) {
      this.elProgressWrap.classList.remove('hidden');
      this.elProgressLabel.textContent = player.hasDefuser ? '正在使用拆弹器快速拆除 C4...' : '正在拆除 C4 炸弹...';
      this.elProgressFill.style.width = `${Math.min(100, player.defuseProgress * 100).toFixed(1)}%`;
    } else if (player.reloadTimer > 0 && player.reloadDuration > 0) {
      this.elProgressWrap.classList.remove('hidden');
      this.elProgressLabel.textContent = '换弹中 Reloading...';
      const p = 1 - player.reloadTimer / player.reloadDuration;
      this.elProgressFill.style.width = `${(p * 100).toFixed(1)}%`;
    } else {
      this.elProgressWrap.classList.add('hidden');
    }

    // 8. Draw Dynamic CS Crosshair + Hitmarker & Live Rotating Dust2 Radar!
    this._drawCrosshair(player, scoped);
    this._drawDust2Radar(player, match, fx);
  }

  _renderWeaponSlots(player) {
    const entries = [];
    if (player.slots[1]) entries.push({ key: '1', name: WEAPONS[player.slots[1].id].name, active: player.activeSlot === 1 });
    if (player.slots[2]) entries.push({ key: '2', name: WEAPONS[player.slots[2].id].name, active: player.activeSlot === 2 });
    entries.push({ key: '3', name: 'M9 Bayonet', active: player.activeSlot === 3 });
    if (player.slots[4].length > 0) {
      const gNames = player.slots[4].map((g) => WEAPONS[g].name.split(' ')[0]).join(' · ');
      entries.push({ key: '4', name: gNames, active: player.activeSlot === 4 });
    }
    if (player.slots[5]) entries.push({ key: '5', name: 'C4 Explosive 💣', active: player.activeSlot === 5 });

    this.elWeaponList.innerHTML = entries.map((e) => `
      <div class="wslot ${e.active ? 'active' : ''}">
        <span class="wslot-name">${e.name}</span>
        <span class="wslot-key">${e.key}</span>
      </div>
    `).join('');
  }

  _drawCrosshair(player, scoped) {
    const c = this.crosshairCanvas;
    const ctx = this.chCtx;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!player.alive) return;

    const cx = c.width * 0.5;
    const cy = c.height * 0.5;

    // Draw CS Hitmarker X
    if (this.hitmarkerTimer > 0) {
      ctx.save();
      ctx.strokeStyle = this.hitmarkerHead ? '#ff3b30' : '#ffffff';
      ctx.lineWidth = this.hitmarkerKill ? 2.6 : 1.8;
      const g = 5, len = this.hitmarkerKill ? 12 : 9;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * g, cy + sy * g);
        ctx.lineTo(cx + sx * (g + len), cy + sy * (g + len));
        ctx.stroke();
      }
      ctx.restore();
    }

    if (scoped) return; // Sniper scope uses full-screen dual reticle

    // Dynamic CS Crosshair (tightens when counter-strafed, blooms when running/jumping!)
    const gap = Math.min(34, 3.5 + player.currentSpread * 290);
    const len = 7.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 3.6;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * gap, cy + dy * gap);
      ctx.lineTo(cx + dx * (gap + len), cy + dy * (gap + len));
      ctx.stroke();
    }

    ctx.strokeStyle = this.crosshairColor;
    ctx.lineWidth = 1.8;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * gap, cy + dy * gap);
      ctx.lineTo(cx + dx * (gap + len), cy + dy * (gap + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Live Rotating 2D Dust2 Radar Minimap!
  _drawDust2Radar(player, match, fx) {
    const c = this.radarCanvas;
    const ctx = this.radarCtx;
    const w = c.width;
    const h = c.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 1.75; // pixels per meter

    ctx.clearRect(0, 0, w, h);

    // Circular radar clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 3, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(14, 18, 22, 0.88)';
    ctx.fillRect(0, 0, w, h);

    // Transform world XZ around player so player look direction points UP (-Y on canvas)!
    // Player look in world XZ: (-sin(yaw), -cos(yaw)). Rotating world by -yaw puts -Z (yaw=0) straight UP!
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-player.pos.x, -player.pos.z);

    // 1. Draw Dust2 Floors, Crates & Walls
    for (let i = 0; i < this.map.radarPolys.length; i++) {
      const p = this.map.radarPolys[i];
      if (p.type === 'floor') {
        ctx.fillStyle = 'rgba(208, 188, 146, 0.28)';
      } else if (p.type === 'prop') {
        ctx.fillStyle = 'rgba(225, 195, 125, 0.55)';
      } else {
        ctx.fillStyle = 'rgba(95, 84, 68, 0.85)';
      }
      ctx.fillRect(p.minX, p.minZ, p.maxX - p.minX, p.maxZ - p.minZ);
    }

    // 2. Draw Active Smoke Clouds on Radar
    for (const sm of fx.activeSmokes) {
      ctx.fillStyle = 'rgba(210, 218, 224, 0.52)';
      ctx.beginPath();
      ctx.arc(sm.position.x, sm.position.z, sm.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw Bombsite A & B Labels
    for (const key of ['A', 'B']) {
      const b = this.map.bombsites[key];
      ctx.save();
      ctx.translate(b.center.x, b.center.z);
      ctx.rotate(-player.yaw);
      ctx.fillStyle = '#ff4b42';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, 0, 0);
      ctx.restore();
    }

    // 4. Draw Teammates & Spotted Enemies
    const allies = match.getTeamMembers(player.team);
    const enemies = match.getTeamMembers(player.team === 'CT' ? 'T' : 'CT');

    for (const al of allies) {
      if (al.isPlayer || !al.alive) continue;
      ctx.fillStyle = player.team === 'CT' ? '#58b4ff' : '#f5c249';
      ctx.beginPath();
      ctx.arc(al.pos.x, al.pos.z, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies appear on radar when spotted by any living ally!
    for (const en of enemies) {
      if (!en.alive) continue;
      let spotted = false;
      for (const al of allies) {
        if (!al.alive) continue;
        if (al.pos.distanceTo(en.pos) < 48 && this.map.hasLineOfSight(al.getEyePosition(), en.getEyePosition(), fx.activeSmokes)) {
          spotted = true;
          break;
        }
      }
      if (spotted) {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(en.pos.x, en.pos.z, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Planted C4 Pulsing Marker
    if (match.matchState.bombPlanted && match.matchState.plantedBombPos) {
      const bp = match.matchState.plantedBombPos;
      ctx.fillStyle = (Date.now() % 500 < 250) ? '#ff2a1f' : '#ffcf40';
      ctx.beginPath();
      ctx.arc(bp.x, bp.z, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Player center dot + FOV cone pointing UP
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 42, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // Outer tactical bezel ring
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
