// Counter-Strike: Dust II — 5v5 Competitive Match Loop, Economy, C4 Rules & Combat Director
import * as THREE from 'three';
import { WEAPONS, WEAPON_SLOTS, EQUIPMENT_SHOP } from '../config/WeaponsData.js';
import { BotAgent } from './BotAI.js';

export class MatchManager {
  constructor({ scene, map, fx, sound, player, hud }) {
    this.scene = scene;
    this.map = map;
    this.fx = fx;
    this.sound = sound;
    this.player = player;
    this.hud = hud;

    this.bots = [];
    this.difficulty = 'normal';
    this.startMoneyMode = 800; // 800 (Competitive) or 16000 (Max Money)

    this.scoreCT = 0;
    this.scoreT = 0;
    this.roundNumber = 0;
    this.ctLossStreak = 1;
    this.tLossStreak = 1;

    // Phase: 'FREEZE' | 'LIVE' | 'ROUND_END'
    this.phase = 'FREEZE';
    this.phaseTimer = 5.0;
    this.buyTimer = 25.0;

    // Bomb Objective State
    this.matchState = {
      bombPlanted: false,
      plantedSite: null,
      plantedBombPos: null,
      bombTimer: 40.0,
      c4BeepTimer: 0,
      activeDefuser: null,
      tTargetSite: 'A'
    };

    this.callbacks = {
      onFireHitscan: (shooter, origin, dir, weaponDef) => this.resolveHitscan(shooter, origin, dir, weaponDef),
      onPlayerKnifeAttack: (shooter, heavy) => this.resolveKnife(shooter, heavy),
      onHEDetonate: (pos, thrower) => this.resolveHEExplosion(pos, thrower),
      onFlashDetonate: (pos, thrower) => this.resolveFlashbang(pos, thrower),
      onUtilityThrown: (thrower, nadeType) => this.onUtilityThrown(thrower, nadeType),
      isBombPlanted: () => this.matchState.bombPlanted,
      onBombPlanted: (planter, site) => this.onBombPlanted(planter, site),
      canPlayerDefuse: (plr) => this.canPlayerDefuse(plr),
      onBombDefused: (defuser) => this.onBombDefused(defuser),
      onPickupC4: (plr) => {
        this.hud.showRadioMessage('T · 战术播报', '你已拾取 C4 炸弹！前往 A 或 B 包点按住 [E] 或 [左键] 下包');
      }
    };
  }

  startNewMatch({ playerTeam = 'CT', difficulty = 'normal', startMoney = 800 }) {
    this.difficulty = difficulty;
    this.startMoneyMode = startMoney;

    // Clear old bots
    for (const b of this.bots) b.destroy(this.scene);
    this.bots = [];

    this.scoreCT = 0;
    this.scoreT = 0;
    this.roundNumber = 0;
    this.ctLossStreak = 1;
    this.tLossStreak = 1;

    // Configure Player
    this.player.kills = 0;
    this.player.deaths = 0;
    this.player.assists = 0;
    this.player.money = startMoney;
    this.player.giveDefaultLoadout(playerTeam);

    // Spawn 4 Allied Bots + 5 Enemy Bots = True 5v5 Dust2 Match!
    const ctBotCount = playerTeam === 'CT' ? 4 : 5;
    const tBotCount  = playerTeam === 'T'  ? 4 : 5;

    for (let i = 0; i < ctBotCount; i++) {
      const bot = new BotAgent(i, 'CT', this.scene, this.map, this.fx, this.sound, i === 0);
      bot.difficulty = difficulty;
      bot.money = startMoney;
      this.bots.push(bot);
    }
    for (let i = 0; i < tBotCount; i++) {
      const bot = new BotAgent(i, 'T', this.scene, this.map, this.fx, this.sound, i === 0);
      bot.difficulty = difficulty;
      bot.money = startMoney;
      this.bots.push(bot);
    }

    this.startNextRound();
  }

  getAllParticipants() {
    return [this.player, ...this.bots];
  }

  getTeamMembers(team) {
    return this.getAllParticipants().filter((p) => p.team === team);
  }

  startNextRound() {
    this.roundNumber += 1;
    this.fx.clearRoundObjects();

    this.phase = 'FREEZE';
    this.phaseTimer = 5.0; // Crisp 5-second CS freeze/buy prep time
    this.buyTimer = 28.0;

    this.matchState.bombPlanted = false;
    this.matchState.plantedSite = null;
    this.matchState.plantedBombPos = null;
    this.matchState.bombTimer = 40.0;
    this.matchState.c4BeepTimer = 0.8;
    this.matchState.activeDefuser = null;

    // Pick Dust2 T Attack Strategy for this round
    const strats = ['RUSH_B', 'LONG_A', 'SPLIT_A', 'MID_TO_B'];
    const strat = strats[Math.floor(Math.random() * strats.length)];
    this.matchState.tTargetSite = (strat === 'RUSH_B' || strat === 'MID_TO_B') ? 'B' : 'A';

    // Respawn CTs at CT Spawn
    const cts = this.getTeamMembers('CT');
    const ctGoals = ['a_cross', 'a_site', 'ct_mid', 'b_site', 'b_doors_in'];
    cts.forEach((p, idx) => {
      const sp = this.map.spawns.CT[idx % this.map.spawns.CT.length];
      if (p.isPlayer) {
        if (!p.alive) p.giveDefaultLoadout('CT');
        else p.refillAllAmmoForNewRound();
        p.respawnAt(sp);
        p.yaw = Math.PI * 0.15; // Face towards Mid/A
        p.pitch = 0;
      } else {
        p.hasC4 = false;
        p.buyEquipmentForRound();
        p.respawnAt(sp, ctGoals[idx % ctGoals.length]);
      }
    });

    // Respawn Ts at T Spawn & Assign 1 C4 Carrier!
    const ts = this.getTeamMembers('T');
    let tGoals = ['a_site', 'a_site', 'short_stairs', 'long_a', 'a_site'];
    if (strat === 'RUSH_B') tGoals = ['b_site', 'b_site', 'b_car', 'b_site', 'upper_b'];
    else if (strat === 'MID_TO_B') tGoals = ['b_site', 'b_doors_out', 'b_site', 'lower_b', 'b_site'];

    // Give C4 to player on T side (so player can experience planting!) or Bot 0 if player is CT
    const c4Holder = this.player.team === 'T' ? this.player : ts[0];

    ts.forEach((p, idx) => {
      const sp = this.map.spawns.T[idx % this.map.spawns.T.length];
      if (p.isPlayer) {
        if (!p.alive) p.giveDefaultLoadout('T');
        else p.refillAllAmmoForNewRound();
        if (c4Holder === p) p.giveWeapon('c4');
        p.respawnAt(sp);
        p.yaw = 0; // Face North straight down Suicide / Mid Doors!
        p.pitch = 0;
      } else {
        p.hasC4 = (c4Holder === p);
        p.buyEquipmentForRound();
        p.respawnAt(sp, p.hasC4 ? (this.matchState.tTargetSite === 'A' ? 'a_site' : 'b_site') : tGoals[idx % tGoals.length]);
      }
    });

    this.hud.hideRoundBanner();
    this.hud.showRadioMessage(
      `第 ${this.roundNumber} 回合 · 冻结准备`,
      `按 [B] 打开购买菜单购枪与护甲 · ${this.player.team === 'T' ? '进攻 A / B 包点安放 C4' : '防守 Dust2 A / B 包点'}`
    );
  }

  // ==================== BUY MENU PURCHASE HANDLER ====================

  canPlayerBuy() {
    return this.player.alive && (this.phase === 'FREEZE' || (this.phase === 'LIVE' && this.buyTimer > 0));
  }

  buyItemForPlayer(itemId) {
    if (!this.canPlayerBuy()) {
      return { ok: false, msg: '已超过购买时间！仅可在回合初购买' };
    }

    // Check Equipment (Kevlar, Helmet, Defuse Kit)
    const equip = EQUIPMENT_SHOP.find((e) => e.id === itemId);
    if (equip) {
      if (equip.team !== 'BOTH' && equip.team !== this.player.team) {
        return { ok: false, msg: '当前阵营不可购买该装备' };
      }
      if (itemId === 'kevlar') {
        if (this.player.armor >= 100) return { ok: false, msg: '防弹衣已满' };
        if (this.player.money < 650) return { ok: false, msg: '资金不足 ($650)' };
        this.player.money -= 650;
        this.player.armor = 100;
        this.sound.playBuySound();
        return { ok: true, msg: '已购买 防弹衣' };
      }
      if (itemId === 'vesthelm') {
        if (this.player.armor >= 100 && this.player.hasHelmet) return { ok: false, msg: '已拥有全套护甲+头盔' };
        const price = this.player.armor >= 80 ? 350 : 1000;
        if (this.player.money < price) return { ok: false, msg: `资金不足 ($${price})` };
        this.player.money -= price;
        this.player.armor = 100;
        this.player.hasHelmet = true;
        this.sound.playBuySound();
        return { ok: true, msg: '已购买 防弹衣 + 头盔' };
      }
      if (itemId === 'defuser') {
        if (this.player.hasDefuser) return { ok: false, msg: '已拥有拆弹器' };
        if (this.player.money < 400) return { ok: false, msg: '资金不足 ($400)' };
        this.player.money -= 400;
        this.player.hasDefuser = true;
        this.sound.playBuySound();
        return { ok: true, msg: '已购买 拆弹器 (5秒拆包)' };
      }
    }

    // Check Weapons & Grenades
    const wDef = WEAPONS[itemId];
    if (!wDef) return { ok: false, msg: '未知武器' };
    if (wDef.team !== 'BOTH' && wDef.team !== this.player.team) {
      return { ok: false, msg: '敌方阵营专属武器' };
    }
    if (this.player.money < wDef.price) {
      return { ok: false, msg: `资金不足 ($${wDef.price})` };
    }

    const added = this.player.giveWeapon(itemId);
    if (!added) {
      return { ok: false, msg: '投掷物栏已达上限' };
    }

    this.player.money -= wDef.price;
    this.sound.playBuySound();
    return { ok: true, msg: `已购买 ${wDef.name}` };
  }

  addRewardMoney(participant, delta) {
    participant.money = Math.max(0, Math.min(16000, participant.money + delta));
    if (participant.isPlayer && delta !== 0) {
      this.hud.showMoneyDelta(delta);
    }
  }

  // ==================== COMBAT & OBJECTIVE RESOLUTION ====================

  resolveHitscan(shooter, origin, dir, weaponDef) {
    const enemies = this.getTeamMembers(shooter.team === 'CT' ? 'T' : 'CT').filter((p) => p.alive);
    const hitboxes = [];
    for (const en of enemies) {
      if (en.isPlayer) {
        // Virtual hitbox cylinder/head boxes for the first-person Player so bots can hit player accurately!
        if (!en._playerHitProxies) {
          en._playerHitProxies = this._createPlayerHitProxies(en);
        }
        this._syncPlayerHitProxies(en);
        hitboxes.push(...en._playerHitProxies);
      } else if (en.rig) {
        en.rig.root.updateMatrixWorld(true);
        hitboxes.push(...en.rig.hitboxes);
      }
    }

    const trace = this.map.traceBullet(origin, dir, weaponDef, hitboxes, 150);

    // Visual bullet tracer
    const endPt = trace.point || origin.clone().addScaledVector(dir, 95);
    const tracerStart = origin.clone().addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.06, 0));
    this.fx.spawnTracer(tracerStart, endPt, weaponDef.silenced);

    // Wall / Door bullet holes & splinters
    for (const imp of trace.impacts) {
      this.fx.spawnImpactFX(imp.point, imp.normal, imp.surface, false, false);
      this.sound.playImpact(imp.surface, imp.point);
    }

    if (trace.hitType === 'character' && trace.character && trace.character.alive) {
      const victim = trace.character;
      const isHead = trace.part === 'HEAD';
      const distMod = Math.pow(weaponDef.rangeModifier || 0.96, trace.distance / 15.24);
      const rawDmg = weaponDef.damage * distMod * (trace.powerMultiplier || 1.0);

      const wasAlive = victim.alive;
      victim.takeDamage(rawDmg, weaponDef.armorPen, trace.part, shooter, weaponDef.id, trace.wallbanged);

      this.fx.spawnImpactFX(trace.point, dir.clone().negate(), 'flesh', true, isHead);

      if (shooter.isPlayer) {
        this.hud.triggerHitmarker(isHead, !victim.alive);
      }
      if (victim.isPlayer) {
        this.hud.triggerDamageIndicator(shooter.pos, this.player.pos, this.player.yaw);
      }

      if (wasAlive && !victim.alive) {
        this._onKill(shooter, victim, weaponDef.id, isHead, trace.wallbanged);
      }
    }
  }

  _createPlayerHitProxies(plr) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32));
    head.userData = { character: plr, part: 'HEAD' };
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.42));
    chest.userData = { character: plr, part: 'CHEST' };
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.42));
    legs.userData = { character: plr, part: 'LEGS' };
    return [head, chest, legs];
  }

  _syncPlayerHitProxies(plr) {
    const [head, chest, legs] = plr._playerHitProxies;
    const crouchShift = plr.crouching ? -0.45 : 0;
    head.position.set(plr.pos.x, plr.pos.y + 1.54 + crouchShift, plr.pos.z);
    chest.position.set(plr.pos.x, plr.pos.y + 1.08 + crouchShift * 0.65, plr.pos.z);
    legs.position.set(plr.pos.x, plr.pos.y + 0.42, plr.pos.z);
    head.updateMatrixWorld(true);
    chest.updateMatrixWorld(true);
    legs.updateMatrixWorld(true);
  }

  resolveKnife(shooter, heavy) {
    const eye = shooter.getEyePosition();
    const dir = shooter.getLookDirection();
    const range = heavy ? 2.15 : 2.35;

    const enemies = this.getTeamMembers(shooter.team === 'CT' ? 'T' : 'CT').filter((p) => p.alive);
    let hitEnemy = null;
    let bestDist = range;

    for (const en of enemies) {
      const center = en.pos.clone().add(new THREE.Vector3(0, 1.05, 0));
      const toEn = new THREE.Vector3().subVectors(center, eye);
      const d = toEn.length();
      if (d < bestDist && toEn.normalize().dot(dir) > 0.65) {
        bestDist = d;
        hitEnemy = en;
      }
    }

    if (hitEnemy) {
      // Check CS Backstab (`Right-Click` from behind = 180 instant kill!!)
      const enForward = new THREE.Vector3(-Math.sin(hitEnemy.yaw), 0, -Math.cos(hitEnemy.yaw));
      const stabDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const isBackstab = stabDir.dot(enForward) > 0.45;

      const dmg = heavy ? (isBackstab ? 180 : 65) : (isBackstab ? 90 : 40);
      const wasAlive = hitEnemy.alive;
      hitEnemy.takeDamage(dmg, 0.85, 'CHEST', shooter, 'knife', false);
      this.sound.playKnife(heavy ? 'stab' : 'slash', 'flesh');
      this.fx.spawnImpactFX(hitEnemy.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), dir.clone().negate(), 'flesh', true, isBackstab);
      this.hud.triggerHitmarker(isBackstab, !hitEnemy.alive);

      if (wasAlive && !hitEnemy.alive) {
        this._onKill(shooter, hitEnemy, 'knife', isBackstab, false);
      }
      return;
    }

    // Check wall clang
    const rc = new THREE.Raycaster(eye, dir, 0.05, 2.0);
    const wHits = rc.intersectObjects(this.map.raycastMeshes, false);
    if (wHits.length > 0) {
      this.sound.playKnife('slash', 'wall');
      this.fx.spawnImpactFX(wHits[0].point, dir.clone().negate(), 'metal', false, false);
    } else {
      this.sound.playKnife('slash', null);
    }
  }

  resolveHEExplosion(blastPos, thrower) {
    const radius = 9.5;
    for (const p of this.getAllParticipants()) {
      if (!p.alive) continue;
      // Avoid heavy friendly grenade teamkill
      if (thrower && p !== thrower && p.team === thrower.team) continue;

      const bodyPos = p.pos.clone().add(new THREE.Vector3(0, 0.95, 0));
      const dist = bodyPos.distanceTo(blastPos);
      if (dist > radius) continue;

      const hasLOS = this.map.hasLineOfSight(blastPos, bodyPos, []);
      const coverMult = hasLOS ? 1.0 : 0.35;
      const rawDmg = 98 * Math.pow(1 - dist / radius, 1.35) * coverMult;
      if (rawDmg < 2) continue;

      const wasAlive = p.alive;
      p.takeDamage(rawDmg, 0.58, 'CHEST', thrower, 'hegrenade', false);
      if (thrower && thrower.isPlayer && p !== thrower) {
        this.hud.triggerHitmarker(false, !p.alive);
      }
      if (wasAlive && !p.alive && thrower) {
        this._onKill(thrower, p, 'hegrenade', false, false);
      }
    }
  }

  resolveFlashbang(flashPos) {
    this.player.applyFlashbang(flashPos);
    for (const b of this.bots) {
      b.applyFlashbang(flashPos);
    }
  }

  onUtilityThrown(thrower, nadeType) {
    if (thrower.team === this.player.team) {
      const label = nadeType === 'flashbang' ? 'Flashbang out! (小心闪光)' : (nadeType === 'smokegrenade' ? 'Throwing Smoke! (封烟)' : 'Fire in the hole! (手雷投出)');
      this.hud.showRadioMessage(`${thrower.name}`, label);
      this.sound.playRadioBeep();
    }
  }

  onBombPlanted(planter, site) {
    if (this.matchState.bombPlanted || this.phase !== 'LIVE') return;
    this.matchState.bombPlanted = true;
    this.matchState.plantedSite = site.name;
    const plantPos = planter.pos.clone();
    const { floorY } = this.map.getSupportingFloorY(plantPos.x, plantPos.y + 0.4, plantPos.z, 0.25, 1.0);
    plantPos.y = floorY > -20 ? floorY + 0.02 : site.y;
    this.matchState.plantedBombPos = plantPos;
    this.matchState.bombTimer = 40.0;
    this.matchState.c4BeepTimer = 0.85;

    this.fx.spawnPlantedC4(plantPos);
    this.addRewardMoney(planter, 300);

    this.sound.playRadioBeep('Bomb has been planted.');
    this.hud.showRadioMessage('系统广播 · C4 已安放', `炸弹已在 [${site.name} 包点] 安放！40秒后引爆！`);
  }

  canPlayerDefuse(plr) {
    if (!this.matchState.bombPlanted || !this.matchState.plantedBombPos || this.phase !== 'LIVE') return false;
    return plr.pos.distanceTo(this.matchState.plantedBombPos) < 2.55;
  }

  onBombDefused(defuser) {
    if (this.phase !== 'LIVE' || !this.matchState.bombPlanted) return;
    this.addRewardMoney(defuser, 300);
    this.sound.playRadioBeep('Bomb has been defused. Counter-Terrorists win.');
    this._endRound('CT', 'C4 炸弹已被成功拆除！反恐精英获胜', 3500);
  }

  _onKill(killer, victim, weaponId, isHeadshot, isWallbang) {
    if (killer && killer !== victim && killer.team !== victim.team) {
      killer.kills += 1;
      const reward = (WEAPONS[weaponId] && WEAPONS[weaponId].killReward) || 300;
      this.addRewardMoney(killer, reward);
    }
    victim.deaths += 1;

    this.hud.pushKillfeed({
      killerName: killer ? killer.name : 'World',
      killerTeam: killer ? killer.team : 'T',
      victimName: victim.name,
      victimTeam: victim.team,
      weaponId,
      isHeadshot,
      isWallbang
    });

    this._checkEliminationWin();
  }

  _checkEliminationWin() {
    if (this.phase !== 'LIVE') return;
    const ctAlive = this.getTeamMembers('CT').filter((p) => p.alive).length;
    const tAlive  = this.getTeamMembers('T').filter((p) => p.alive).length;

    if (ctAlive === 0) {
      this.sound.playRadioBeep('Terrorists win.');
      this._endRound('T', '反恐精英全员阵亡 · 恐怖分子获胜', 3250);
    } else if (tAlive === 0 && !this.matchState.bombPlanted) {
      // Authentic CS: If bomb is NOT planted, wiping Ts wins immediately for CTs!
      // If bomb IS planted, CTs must still defuse the ticking C4!
      this.sound.playRadioBeep('Counter-Terrorists win.');
      this._endRound('CT', '恐怖分子全员歼灭 · 反恐精英获胜', 3250);
    }
  }

  _endRound(winningTeam, reasonText, winBonus = 3250) {
    if (this.phase === 'ROUND_END') return;
    this.phase = 'ROUND_END';
    this.phaseTimer = 5.2;

    if (winningTeam === 'CT') {
      this.scoreCT += 1;
      const lossBonus = Math.min(3400, 1400 + (this.tLossStreak - 1) * 500);
      this.tLossStreak += 1;
      this.ctLossStreak = Math.max(1, this.ctLossStreak - 1);

      for (const p of this.getTeamMembers('CT')) this.addRewardMoney(p, winBonus);
      for (const p of this.getTeamMembers('T')) this.addRewardMoney(p, lossBonus + (this.matchState.bombPlanted ? 800 : 0));
    } else {
      this.scoreT += 1;
      const lossBonus = Math.min(3400, 1400 + (this.ctLossStreak - 1) * 500);
      this.ctLossStreak += 1;
      this.tLossStreak = Math.max(1, this.tLossStreak - 1);

      for (const p of this.getTeamMembers('T')) this.addRewardMoney(p, winBonus);
      for (const p of this.getTeamMembers('CT')) this.addRewardMoney(p, lossBonus);
    }

    this.hud.showRoundBanner(winningTeam, reasonText, this.scoreCT, this.scoreT);
  }

  // ==================== MAIN MATCH TICK ====================

  update(dt, uiBlockingInput = false) {
    if (this.phase === 'FREEZE') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'LIVE';
        this.phaseTimer = 115.0; // Official CS 1:55 competitive round timer!
        this.sound.playRadioBeep("Let's roll.");
      }
    } else if (this.phase === 'LIVE') {
      if (this.buyTimer > 0) this.buyTimer = Math.max(0, this.buyTimer - dt);

      if (!this.matchState.bombPlanted) {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.sound.playRadioBeep('Counter-Terrorists win.');
          this._endRound('CT', '回合时间耗尽 · 反恐精英防守成功', 3250);
        }
      } else {
        // Planted C4 40-second Accelerating Countdown!
        this.matchState.bombTimer -= dt;
        const urgency = Math.max(0, Math.min(1, 1 - this.matchState.bombTimer / 40.0));
        this.matchState.c4BeepTimer -= dt;

        if (this.matchState.c4BeepTimer <= 0 && this.matchState.bombTimer > 0) {
          const interval = Math.max(0.11, 0.92 * Math.pow(1 - urgency, 1.55) + 0.08);
          this.matchState.c4BeepTimer = interval;
          this.sound.playC4Tick(this.matchState.plantedBombPos, urgency);
          if (this.fx.plantedC4Mesh && this.fx.plantedC4Mesh.userData.led) {
            const led = this.fx.plantedC4Mesh.userData.led;
            led.scale.setScalar(1.6);
            setTimeout(() => { if (led) led.scale.setScalar(1.0); }, 70);
          }
        }

        if (this.matchState.bombTimer <= 0) {
          // BOOM! C4 Detonates!
          const bPos = this.matchState.plantedBombPos.clone();
          this.fx.triggerC4SiteExplosion(bPos);
          for (const p of this.getAllParticipants()) {
            if (!p.alive) continue;
            const d = p.pos.distanceTo(bPos);
            if (d < 36) {
              p.takeDamage(500 * (1 - d / 38), 1.0, 'CHEST', null, 'c4', false);
            }
          }
          this.sound.playRadioBeep('Terrorists win.');
          this._endRound('T', `C4 炸弹引爆摧毁 ${this.matchState.plantedSite} 包点 · 恐怖分子获胜`, 3500);
        }
      }
    } else if (this.phase === 'ROUND_END') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        // Halftime check or continuous MR12 reset at 13 wins
        if (this.scoreCT >= 13 || this.scoreT >= 13) {
          this.startNewMatch({
            playerTeam: this.player.team,
            difficulty: this.difficulty,
            startMoney: this.startMoneyMode
          });
          return;
        }
        this.startNextRound();
      }
    }

    const isFreeze = this.phase === 'FREEZE';
    this.player.update(dt, {
      freezeTime: isFreeze,
      canMove: !uiBlockingInput,
      matchCallbacks: this.callbacks
    });

    const ctAliveList = this.getTeamMembers('CT');
    const tAliveList  = this.getTeamMembers('T');

    for (const bot of this.bots) {
      bot.update(dt, {
        freezeTime: isFreeze,
        enemies: bot.team === 'CT' ? tAliveList : ctAliveList,
        matchState: this.matchState,
        matchCallbacks: this.callbacks
      });
    }
  }
}
