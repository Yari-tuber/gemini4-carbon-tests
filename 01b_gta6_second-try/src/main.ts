import * as THREE from 'three';
import { WeaponId } from './types';
import { InputManager } from './core/InputManager';
import { AudioEngine } from './core/AudioEngine';
import { CameraRig } from './core/CameraRig';
import { Environment } from './world/Environment';
import { CityBuilder } from './world/CityBuilder';
import { PropsAndFX } from './world/PropsAndFX';
import { ProjectileManager } from './entities/Weapons';
import { VehicleSystem } from './entities/VehicleSystem';
import { PedAndPoliceSystem } from './entities/PedAndPolice';
import { PlayerSystem } from './entities/PlayerSystem';
import { MissionManager } from './gameplay/MissionManager';
import { HudController } from './ui/HudController';

class GTA6Game {
  private canvas: HTMLCanvasElement;
  private input: InputManager;
  private audio: AudioEngine;
  private env: Environment;
  private camRig: CameraRig;
  private fx: PropsAndFX;
  private city: CityBuilder;
  private vehicles: VehicleSystem;
  private police: PedAndPoliceSystem;
  private player: PlayerSystem;
  private projectiles: ProjectileManager;
  private missions: MissionManager;
  private hud: HudController;

  private started = false;
  private isDeadOrBusted = false;
  private respawnTimer = 0;
  private lastTime = performance.now();

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.input = new InputManager(this.canvas);
    this.audio = new AudioEngine();
    this.env = new Environment(this.canvas);
    this.camRig = new CameraRig(window.innerWidth / window.innerHeight);
    this.env.setCamera(this.camRig.camera);

    this.fx = new PropsAndFX(this.env.scene);
    this.city = new CityBuilder(
      this.env.scene,
      this.env.renderer.capabilities.getMaxAnisotropy()
    );
    this.env.roadMaterial = this.city.roadMaterial;

    this.vehicles = new VehicleSystem(this.env.scene, this.city, this.fx, this.audio);
    this.police = new PedAndPoliceSystem(
      this.env.scene,
      this.city,
      this.vehicles,
      this.fx,
      this.audio
    );
    this.player = new PlayerSystem(this.env.scene, this.city, this.fx, this.audio);
    this.projectiles = new ProjectileManager(this.env.scene, this.fx);

    this.missions = new MissionManager(
      this.env.scene,
      this.city,
      this.player,
      this.vehicles,
      this.police,
      this.fx,
      this.audio
    );

    this.hud = new HudController(this.city, this.player, this.police, this.audio);

    this.wireCallbacksAndUI();

    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camRig.resize(w / h);
      this.env.resize(w, h);
    });

    requestAnimationFrame((t) => this.loop(t));
  }

  private wireCallbacksAndUI(): void {
    // Title Screen Quality Selector & Start Button
    const qBtns = document.querySelectorAll('.quality-btn');
    qBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        qBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const q = (btn as HTMLElement).dataset.quality;
        this.env.setQuality(q === 'ultra');
      });
    });

    const startBtn = document.getElementById('start-game-btn')!;
    startBtn.addEventListener('click', () => {
      this.started = true;
      this.audio.init();
      document.getElementById('title-screen')?.classList.add('hidden');
      this.hud.showHud();
      this.input.requestLock();
      this.hud.showSubtitle(
        '🌴 欢迎来到雷奥奈达州罪恶城！走近豪车按 [F] 驾驶，按 [TAB] 切换露西娅与杰森，跟随左下方小地图黄线前往首个任务！',
        6.5
      );
    });

    // Mission <-> HUD callbacks
    this.missions.onSubtitle = (txt, dur) => this.hud.showSubtitle(txt, dur);
    this.missions.onBanner = (m, s, c) => this.hud.showBanner(m, s, c);
    this.missions.onSocialPost = (u, t) => this.hud.showSocialPost(u, t);
    this.missions.onCashChange = (d) => this.hud.showCashDelta(d);

    // Smartphone Actions
    this.hud.onPhoneAction = (action) => {
      const pPos = this.player.active.position;
      const fwdX = -Math.sin(this.camRig.yaw);
      const fwdZ = -Math.cos(this.camRig.yaw);

      switch (action) {
        case 'gps-mission':
          this.missions.customGpsWaypoint = null;
          this.hud.showSubtitle('📍 GPS 已重新锁定当前主线任务目标！', 3);
          break;
        case 'start-race':
          this.hud.togglePhone(false);
          this.input.requestLock();
          this.missions.startStreetRace();
          break;
        case 'gps-boat':
          this.missions.customGpsWaypoint = new THREE.Vector3(368, 0, 160);
          this.hud.showSubtitle('📍 GPS 导航已设置：罪恶湾快艇码头', 3);
          break;
        case 'gps-bank':
          this.missions.customGpsWaypoint = new THREE.Vector3(-169, 0, -45);
          this.hud.showSubtitle('📍 GPS 导航已设置：雷奥奈达国家银行', 3);
          break;
        case 'gps-paynspray':
          this.missions.customGpsWaypoint = new THREE.Vector3(-76, 0, -195);
          this.hud.showSubtitle("📍 GPS 导航已设置：Pay 'n' Spray 喷漆消星车行", 3);
          break;
        case 'gps-gunshop':
          this.missions.customGpsWaypoint = new THREE.Vector3(-165, 0, 115);
          this.hud.showSubtitle('📍 GPS 导航已设置：Ammu-Nation 武器店', 3);
          break;
        case 'gps-heli':
          this.missions.customGpsWaypoint = new THREE.Vector3(265, 0, -320);
          this.hud.showSubtitle('📍 GPS 导航已设置：北部海湾武装直升机停机坪', 3);
          break;
        case 'spawn-supercar': {
          const v = this.vehicles.spawnVehicle(
            'supercar',
            pPos.x + fwdX * 7,
            pPos.z + fwdZ * 7,
            this.camRig.yaw + Math.PI,
            { paintHex: 0xff2e93 }
          );
          this.fx.spawnTireSmoke(v.position);
          this.hud.showSubtitle('🏎️ 技师已将粉红霓虹【猎豹超跑】送达您面前！按 [F] 驾驶！', 4);
          break;
        }
        case 'spawn-heli': {
          if (this.player.cash < 1000) {
            this.hud.showSubtitle('❌ 现金不足 $1,000！可使用秘籍或抢劫获取资金。', 3);
            break;
          }
          this.missions.addCash(-1000);
          const h = this.vehicles.spawnVehicle(
            'helicopter',
            pPos.x + fwdX * 9,
            pPos.z + fwdZ * 9,
            this.camRig.yaw + Math.PI,
            { paintHex: 0x00f0ff }
          );
          this.fx.spawnTireSmoke(h.position);
          this.hud.showSubtitle('🚁 武装直升机已空投！按 [F] 登机，长按 [空格] 垂直拉升！', 4.5);
          break;
        }
        case 'bribe-cops':
          if (this.police.wantedLevel === 0) {
            this.hud.showSubtitle('当前没有被警方通缉！', 2.5);
          } else if (this.player.cash >= 1500) {
            this.missions.addCash(-1500);
            this.police.clearWanted();
            this.hud.showSubtitle('🕵️ 黑客已抹除 VCPD 通缉档案，全城警报解除！', 3.5);
          } else {
            this.hud.showSubtitle('❌ 现金不足 $1,500！', 2.5);
          }
          break;
        case 'full-arsenal':
          if (this.player.cash >= 800) {
            this.missions.addCash(-800);
            this.player.active.armor = 100;
            this.player.active.health = 100;
            Object.values(this.player.arsenal).forEach((w) => {
              w.ammo = w.maxAmmo;
            });
            this.hud.showSubtitle('💣 全套重型军火弹药与重型防弹衣已补满！', 3.5);
          } else {
            this.hud.showSubtitle('❌ 现金不足 $800！', 2.5);
          }
          break;
        case 'weather-sunset':
          this.env.setPresetWeather('sunset');
          this.hud.showSubtitle('🌅 天气已切换：罪恶城黄金粉紫晚霞 (18:20)', 3);
          break;
        case 'weather-night':
          this.env.setPresetWeather('night');
          this.hud.showSubtitle('🌃 天气已切换：海洋大道霓虹之夜 (23:00)', 3);
          break;
        case 'weather-day':
          this.env.setPresetWeather('day');
          this.hud.showSubtitle('☀️ 天气已切换：迈阿密热带晴空正午 (12:30)', 3);
          break;
        case 'weather-rain':
          this.env.setPresetWeather('rain');
          this.hud.showSubtitle('⛈️ 天气已切换：热带霓虹暴雨 (湿滑镜面路面)', 3);
          break;
        case 'cheat-money':
          this.missions.addCash(50000);
          this.player.active.health = 100;
          this.player.active.armor = 100;
          if (this.player.currentVehicle) {
            this.vehicles.resprayAndRepair(this.player.currentVehicle);
          }
          this.hud.showSubtitle('💵 秘籍激活 HESOYAM：+$50,000 现金、生命护甲全满、载具修复！', 4);
          break;
        case 'cheat-wanted':
          this.police.reportCrime(250, 5);
          this.hud.showSubtitle('🚨 秘籍激活：★★★★★ 五星全城特警与武装直升机全面围剿！', 4);
          this.hud.showSocialPost('@LeonidaAlert', '⚠️ 全州最高警报：罪恶城出现五星级极度危险目标！');
          break;
      }
    };

    // Ammu-Nation Shop Purchases
    this.hud.onBuyShopItem = (itemId) => {
      const prices: Record<string, number> = {
        armor: 300,
        medkit: 150,
        pistol: 200,
        smg: 450,
        shotgun: 650,
        rifle: 900,
        rpg: 1500,
        special: 250
      };
      const cost = prices[itemId] ?? 200;
      if (this.player.cash < cost) {
        this.hud.showSubtitle(`❌ 现金不足 $${cost}！`, 2.5);
        return;
      }
      this.missions.addCash(-cost);
      if (itemId === 'armor') this.player.active.armor = 100;
      else if (itemId === 'medkit') this.player.active.health = 100;
      else if (itemId === 'special') this.player.active.specialCharge = 100;
      else {
        const wid = itemId as WeaponId;
        const w = this.player.arsenal[wid];
        w.ammo = Math.min(w.maxAmmo, w.ammo + (wid === 'rpg' ? 6 : wid === 'shotgun' ? 40 : 180));
        this.player.equipWeapon(wid);
      }
      this.hud.showSubtitle('✅ 购买成功！欢迎再次光临 Ammu-Nation！', 2.5);
    };
  }

  private handleExplosionAOE(center: THREE.Vector3, fromPlayer = true): void {
    this.camRig.addShake(0.95);
    this.police.alertPanicNearby(center, 70);
    if (fromPlayer) {
      this.police.reportCrime(42, 2);
    }

    // Chain-detonate nearby explosive gas pumps
    for (const exp of this.city.explosiveProps) {
      if (!exp.exploded && exp.position.distanceTo(center) < 9.5) {
        exp.exploded = true;
        exp.respawnTimer = 35;
        exp.mesh.visible = false;
        this.fx.spawnExplosion(exp.position);
        this.audio.playExplosion();
      }
    }

    // Damage nearby NPCs
    for (const npc of this.police.npcs) {
      if (npc.dead) continue;
      const d = npc.position.distanceTo(center);
      if (d < 12.5) {
        const killed = this.police.damageNpc(npc, (1 - d / 12.5) * 260, fromPlayer);
        if (killed) this.hud.triggerHitmarker(true);
      }
    }

    // Damage nearby Vehicles
    for (const v of this.vehicles.vehicles) {
      if (v.exploded) continue;
      const d = v.position.distanceTo(center);
      if (d < 11.5 && d > 0.2) {
        this.vehicles.damageVehicle(v, (1 - d / 11.5) * 290, (pos) =>
          this.handleExplosionAOE(pos, fromPlayer)
        );
      }
    }

    // Check Police Helicopter if rocket exploded near it!
    if (this.police.chopperGroup && this.police.chopperPos.distanceTo(center) < 12) {
      if (this.police.damageChopper(300)) {
        this.hud.triggerHitmarker(true);
        this.hud.showSocialPost('@ViceSkyWatch', '卧槽！！有人用 RPG 把警用直升机打下来了！！💥🚁');
      }
    }

    // Damage player if standing right next to blast
    const pDist = this.player.active.position.distanceTo(center);
    if (pDist < 9.5) {
      this.hud.triggerDamageFlash();
      const died = this.player.applyDamage((1 - pDist / 9.5) * 75);
      if (died) this.triggerWasted();
    }
  }

  private fireCurrentWeapon(): void {
    const w = this.player.currentWeapon;
    if (this.player.currentVehicle && !w.driveByAllowed) {
      // Auto-select Micro SMG for authentic GTA drive-by shooting!
      if (this.player.arsenal.smg.ammo > 0) {
        this.player.equipWeapon('smg');
      } else {
        this.player.equipWeapon('pistol');
      }
      return;
    }

    if (w.id !== 'fists' && w.ammo <= 0) {
      this.audio.playUiClick(240);
      this.hud.showSubtitle('弹药耗尽！前往 Ammu-Nation 或打开手机补给弹药', 2.5);
      return;
    }

    this.player.fireCooldown = 1 / w.fireRate;
    if (w.id !== 'fists') w.ammo--;

    this.audio.playGunshot(w.id);

    // Melee combat (`fists`)
    if (w.id === 'fists') {
      this.player.active.rig.punchTimer = 0.26;
      const pPos = this.player.active.position;
      for (const npc of this.police.npcs) {
        if (!npc.dead && npc.position.distanceTo(pPos) < 2.5) {
          this.fx.spawnImpact(npc.position.clone().add(new THREE.Vector3(0, 1.2, 0)), true);
          const killed = this.police.damageNpc(npc, w.damage, true);
          this.hud.triggerHitmarker(killed);
          break;
        }
      }
      return;
    }

    // Firearm / RPG Ballistics from Camera Aim Ray
    const rayOrigin = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    this.camRig.getAimRay(rayOrigin, rayDir);

    const muzzleWorld = this.player.active.position
      .clone()
      .add(new THREE.Vector3(0, 1.42, 0))
      .addScaledVector(rayDir, 0.85);

    this.police.alertPanicNearby(muzzleWorld, 55);
    this.camRig.addShake(w.id === 'shotgun' ? 0.16 : w.id === 'rpg' ? 0.28 : 0.045);

    if (w.isProjectile) {
      this.projectiles.spawnRocket(muzzleWorld, rayDir, true);
      return;
    }

    for (let p = 0; p < w.pellets; p++) {
      const spreadScale = this.player.specialAbilityActive ? w.spread * 0.25 : w.spread;
      const dir = rayDir
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * spreadScale,
            (Math.random() - 0.5) * spreadScale,
            (Math.random() - 0.5) * spreadScale
          )
        )
        .normalize();

      let bestDist = w.range;
      let hitType: 'none' | 'npc' | 'vehicle' | 'building' | 'pump' | 'chopper' = 'none';
      let hitNpcIndex = -1;
      let hitVehicleIndex = -1;
      let hitPumpIndex = -1;

      // 1. Check Buildings along ray
      for (const b of this.city.colliders) {
        const t = this.intersectRayAABB(
          rayOrigin,
          dir,
          b.minX,
          0,
          b.minZ,
          b.maxX,
          b.height,
          b.maxZ
        );
        if (t !== null && t < bestDist) {
          bestDist = t;
          hitType = 'building';
        }
      }

      // 2. Check Explosive Gas Pumps
      for (let idx = 0; idx < this.city.explosiveProps.length; idx++) {
        const pump = this.city.explosiveProps[idx];
        if (pump.exploded) continue;
        const t = this.intersectRaySphere(rayOrigin, dir, pump.position, 1.45);
        if (t !== null && t < bestDist) {
          bestDist = t;
          hitType = 'pump';
          hitPumpIndex = idx;
        }
      }

      // 3. Check NPCs
      for (let idx = 0; idx < this.police.npcs.length; idx++) {
        const npc = this.police.npcs[idx];
        if (npc.dead) continue;
        const center = npc.position.clone().add(new THREE.Vector3(0, 1.05, 0));
        const t = this.intersectRaySphere(rayOrigin, dir, center, 0.85);
        if (t !== null && t < bestDist) {
          bestDist = t;
          hitType = 'npc';
          hitNpcIndex = idx;
        }
      }

      // 4. Check Vehicles (excluding player's own vehicle)
      for (let idx = 0; idx < this.vehicles.vehicles.length; idx++) {
        const v = this.vehicles.vehicles[idx];
        if (v === this.player.currentVehicle || v.exploded) continue;
        const center = v.position.clone().add(new THREE.Vector3(0, 0.9, 0));
        const t = this.intersectRaySphere(rayOrigin, dir, center, 2.0);
        if (t !== null && t < bestDist) {
          bestDist = t;
          hitType = 'vehicle';
          hitVehicleIndex = idx;
        }
      }

      // 5. Check Police Helicopter
      if (this.police.chopperGroup) {
        const t = this.intersectRaySphere(rayOrigin, dir, this.police.chopperPos, 3.4);
        if (t !== null && t < bestDist) {
          bestDist = t;
          hitType = 'chopper';
        }
      }

      const endPoint = rayOrigin.clone().addScaledVector(dir, bestDist);
      this.fx.spawnMuzzleAndTracer(muzzleWorld, endPoint, 0xffe066);

      if (hitType === 'npc' && hitNpcIndex >= 0) {
        const target = this.police.npcs[hitNpcIndex];
        this.fx.spawnImpact(endPoint, true);
        const killed = this.police.damageNpc(target, w.damage, true);
        this.hud.triggerHitmarker(killed);
        this.player.active.specialCharge = Math.min(100, this.player.active.specialCharge + 6);
      } else if (hitType === 'vehicle' && hitVehicleIndex >= 0) {
        const v = this.vehicles.vehicles[hitVehicleIndex];
        this.fx.spawnImpact(endPoint, false);
        this.hud.triggerHitmarker(false);
        this.vehicles.damageVehicle(v, w.damage, (pos) => this.handleExplosionAOE(pos, true));
      } else if (hitType === 'pump' && hitPumpIndex >= 0) {
        const pump = this.city.explosiveProps[hitPumpIndex];
        pump.exploded = true;
        pump.respawnTimer = 35;
        pump.mesh.visible = false;
        this.fx.spawnExplosion(pump.position);
        this.audio.playExplosion();
        this.handleExplosionAOE(pump.position, true);
      } else if (hitType === 'chopper') {
        this.fx.spawnImpact(endPoint, false);
        const down = this.police.damageChopper(w.damage);
        this.hud.triggerHitmarker(down);
      } else if (hitType === 'building') {
        this.fx.spawnImpact(endPoint, false);
      }
    }
  }

  private intersectRaySphere(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    center: THREE.Vector3,
    radius: number
  ): number | null {
    const ocX = origin.x - center.x;
    const ocY = origin.y - center.y;
    const ocZ = origin.z - center.z;
    const b = ocX * dir.x + ocY * dir.y + ocZ * dir.z;
    const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t > 0.5 ? t : null;
  }

  private intersectRayAABB(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number
  ): number | null {
    const invX = 1 / (dir.x || 1e-6);
    const invY = 1 / (dir.y || 1e-6);
    const invZ = 1 / (dir.z || 1e-6);

    const t1 = (minX - origin.x) * invX;
    const t2 = (maxX - origin.x) * invX;
    const t3 = (minY - origin.y) * invY;
    const t4 = (maxY - origin.y) * invY;
    const t5 = (minZ - origin.z) * invZ;
    const t6 = (maxZ - origin.z) * invZ;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax) return null;
    return tmin > 0.5 ? tmin : null;
  }

  private triggerWasted(): void {
    if (this.isDeadOrBusted) return;
    this.isDeadOrBusted = true;
    this.respawnTimer = 3.6;
    this.player.specialAbilityActive = false;
    this.audio.playWastedBoom();
    this.hud.showBanner('WASTED', '重伤倒地 · 正在海洋大道急救中心复活 (-$200)', '#ef4444', 3.5);
    this.missions.failActiveMission('主角已倒下');
  }

  private triggerBusted(): void {
    if (this.isDeadOrBusted) return;
    this.isDeadOrBusted = true;
    this.respawnTimer = 3.6;
    this.player.specialAbilityActive = false;
    this.audio.playWastedBoom();
    this.hud.showBanner('BUSTED', '被罪恶城警局逮捕 · 保释释放 (-$300)', '#38bdf8', 3.5);
    this.missions.failActiveMission('主角被警方逮捕');
  }

  private loop(now: number): void {
    requestAnimationFrame((t) => this.loop(t));

    const rawDt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    // Title Screen live background render
    if (!this.started) {
      this.camRig.updateTitleOrbit(rawDt);
      this.env.update(rawDt, new THREE.Vector3(210, 0, 20));
      this.city.update(rawDt, this.env.isNightLike());
      this.vehicles.update(
        rawDt,
        null,
        { throttle: 0, steer: 0, handbrake: false, boost: false, ascend: false, descend: false },
        new THREE.Vector3(210, 0, 20),
        this.city.colliders,
        () => {},
        () => {}
      );
      this.env.render(this.camRig.camera);
      this.input.endFrame();
      return;
    }

    // Handle Global UI Hotkeys (Weapon Wheel Q, Smartphone P / ArrowUp, Shop ESC/E)
    this.handleMenuInputs();
    this.input.uiBlockingPointer = this.hud.isAnyMenuBlockingPointer();
    if (this.input.uiBlockingPointer && this.input.isPointerLocked) {
      this.input.releaseLock();
    }

    // Time Dilation (Weapon Wheel Slow-Mo OR GTA Special Ability Bullet-Time OR Wasted/Busted Slow-Mo!)
    let timeScale = 1.0;
    if (this.isDeadOrBusted) timeScale = 0.28;
    else if (this.hud.isWheelOpen) timeScale = 0.25;
    else if (this.player.specialAbilityActive) timeScale = 0.44;
    else if (this.camRig.stuntCamTimer > 0) timeScale = 0.48;

    const dt = rawDt * timeScale;

    if (this.isDeadOrBusted) {
      this.respawnTimer -= rawDt;
      if (this.respawnTimer <= 0) {
        this.isDeadOrBusted = false;
        this.police.clearWanted();
        this.missions.addCash(-200);
        this.player.respawnAtSafehouseOrHospital(206, 95);
      }
    } else if (!this.camRig.isSkySwitching) {
      this.updateActiveGameplay(dt, rawDt);
    }

    // Update World, FX, Camera, Audio & HUD
    const focusPos = this.player.active.position;
    this.env.update(dt, focusPos);
    this.city.update(dt, this.env.isNightLike());

    this.fx.update(dt, focusPos, (cashAmt) => {
      this.missions.addCash(cashAmt);
    });

    this.projectiles.update(
      dt,
      (rPos) => {
        for (const b of this.city.colliders) {
          if (rPos.y < b.height && rPos.x > b.minX && rPos.x < b.maxX && rPos.z > b.minZ && rPos.z < b.maxZ) {
            return true;
          }
        }
        for (const v of this.vehicles.vehicles) {
          if (v !== this.player.currentVehicle && v.position.distanceTo(rPos) < 2.4) return true;
        }
        if (this.police.chopperGroup && this.police.chopperPos.distanceTo(rPos) < 4.0) return true;
        return false;
      },
      (boomPos, fromPlayer) => this.handleExplosionAOE(boomPos, fromPlayer)
    );

    const isAiming = this.input.mouseRight && !this.hud.isAnyMenuBlockingPointer();
    const veh = this.player.currentVehicle;

    this.camRig.update(
      rawDt,
      this.input.mouseDX,
      this.input.mouseDY,
      focusPos,
      veh ? veh.heading : this.player.active.heading,
      isAiming,
      Boolean(veh),
      veh ? veh.kind : null,
      veh ? veh.speed : 0,
      this.city.colliders
    );

    const nearestCopDist = this.police.getNearestPoliceDist(focusPos);
    this.audio.update(
      rawDt,
      Boolean(veh),
      veh ? veh.kind : null,
      veh ? Math.abs(veh.speed) : 0,
      this.input.isDown('KeyW'),
      Boolean(veh && this.input.isDown('Space')),
      nearestCopDist,
      this.police.wantedLevel
    );

    let promptText = this.missions.update(dt);
    if (!promptText && !veh) {
      const nearVeh = this.vehicles.findNearestEnterable(focusPos, 5.8);
      if (nearVeh) {
        promptText = `按 [F] 驾驶 ${nearVeh.spec.displayName} (${nearVeh.spec.cnName})`;
      }
    }

    this.hud.update(
      rawDt,
      this.env.getFormattedClock(),
      this.camRig.yaw,
      this.input.isPointerLocked,
      isAiming,
      this.missions.getHudInfo(),
      promptText
    );

    this.env.render(this.camRig.camera);
    this.input.endFrame();
  }

  private handleMenuInputs(): void {
    // Hold Q for Weapon Wheel
    const qDown = this.input.isDown('KeyQ');
    if (qDown !== this.hud.isWheelOpen && !this.hud.isShopOpen) {
      this.hud.setWeaponWheelOpen(qDown);
      if (!qDown) this.input.requestLock();
    }

    // Number keys 1-6 or Mouse Wheel for quick weapon select
    const slotMap: Record<string, WeaponId> = {
      Digit1: 'fists',
      Digit2: 'pistol',
      Digit3: 'smg',
      Digit4: 'shotgun',
      Digit5: 'rifle',
      Digit6: 'rpg'
    };
    for (const [code, wid] of Object.entries(slotMap)) {
      if (this.input.justPressed(code)) {
        this.player.equipWeapon(wid);
        this.audio.playUiClick(760);
      }
    }
    if (this.input.wheelDelta !== 0 && !this.hud.isAnyMenuBlockingPointer()) {
      const order: WeaponId[] = ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'rpg'];
      const curIdx = order.indexOf(this.player.currentWeaponId);
      const nextIdx = (curIdx + this.input.wheelDelta + order.length) % order.length;
      this.player.equipWeapon(order[nextIdx]);
    }

    // Toggle Smartphone with P or ArrowUp / ArrowDown
    if (this.input.justPressed('KeyP') || this.input.justPressed('ArrowUp')) {
      this.hud.togglePhone();
      if (!this.hud.isPhoneOpen) this.input.requestLock();
    }
    if (this.input.justPressed('ArrowDown') && this.hud.isPhoneOpen) {
      this.hud.togglePhone(false);
      this.input.requestLock();
    }

    // Close Shop with Escape or E
    if (this.hud.isShopOpen && (this.input.justPressed('Escape') || this.input.justPressed('KeyE'))) {
      this.hud.setShopOpen(false);
      this.input.requestLock();
      return;
    }

    // Contextual Interact Key E (Ammu-Nation Shop / Quick Store Robbery / Vehicle Horn & Siren)
    if (this.input.justPressed('KeyE')) {
      if (this.player.currentVehicle) {
        const v = this.player.currentVehicle;
        if (v.isPoliceUnit) v.sirenOn = !v.sirenOn;
        this.audio.playHorn(v.isPoliceUnit);
      } else {
        const pPos = this.player.active.position;
        if (pPos.distanceTo(new THREE.Vector3(-165, 0, 115)) < 8.5) {
          this.hud.setShopOpen(true);
        } else {
          this.missions.tryQuickRobStore();
        }
      }
    }

    // Radio Switch with R while driving
    if (this.input.justPressed('KeyR') && this.player.currentVehicle) {
      const title = this.audio.cycleRadio();
      this.hud.showSubtitle(title, 2.5);
    }

    // Headlight Toggle with H while driving
    if (this.input.justPressed('KeyH') && this.player.currentVehicle) {
      this.vehicles.headlightsEnabled = !this.vehicles.headlightsEnabled;
      this.audio.playUiClick(620);
      this.hud.showSubtitle(
        this.vehicles.headlightsEnabled ? '💡 远光车灯已开启' : '💡 远光车灯已关闭',
        2.0
      );
    }

    // Partner Co-op Call / Toggle with G
    if (this.input.justPressed('KeyG')) {
      this.player.partnerFollowMode = !this.player.partnerFollowMode;
      this.hud.showSubtitle(
        this.player.partnerFollowMode
          ? `🤝 已召集搭档 ${this.player.partner.cnName} 协同作战与副驾掩护射击！`
          : `✋ 搭档 ${this.player.partner.cnName} 已原地待命`,
        3.0
      );
    }

    // Protagonist Sky-Cam Switch with TAB!
    if (this.input.justPressed('Tab') && !this.camRig.isSkySwitching) {
      if (this.player.currentVehicle) {
        this.player.exitVehicle();
      }
      const fromPos = this.player.active.position.clone();
      const toPos = this.player.partner.position.clone();
      // If partner was right next to us, offset slightly if not following so Sky-Cam feels epic
      this.camRig.startSkySwitch(
        fromPos,
        toPos,
        () => {
          this.player.switchProtagonistMidpoint();
          this.hud.showSubtitle(
            `已切换至主角：${this.player.active.name} (${this.player.active.cnName})`,
            3.0
          );
        },
        (step) => this.audio.playSwitchThump(step)
      );
    }

    // Special Bullet-Time Ability (CapsLock or V)
    if (this.input.justPressed('CapsLock') || this.input.justPressed('KeyV')) {
      if (this.player.specialAbilityActive) {
        this.player.specialAbilityActive = false;
      } else if (this.player.active.specialCharge > 15) {
        this.player.specialAbilityActive = true;
        this.audio.playSwitchThump(2);
      }
    }
  }

  private updateActiveGameplay(dt: number, rawDt: number): void {
    // Drain or recharge Special Ability bar
    if (this.player.specialAbilityActive) {
      this.player.active.specialCharge = Math.max(0, this.player.active.specialCharge - rawDt * 14);
      if (this.player.active.specialCharge <= 0) {
        this.player.specialAbilityActive = false;
      }
    } else {
      this.player.active.specialCharge = Math.min(100, this.player.active.specialCharge + rawDt * 2.5);
    }

    // Enter / Exit / Carjack Vehicle with F
    if (this.input.justPressed('KeyF') && !this.hud.isAnyMenuBlockingPointer()) {
      if (this.player.currentVehicle) {
        this.player.exitVehicle();
        this.audio.playUiClick(520);
      } else {
        const targetVeh = this.vehicles.findNearestEnterable(this.player.active.position, 6.2);
        if (targetVeh) {
          if (targetVeh.driverType === 'npc' || targetVeh.driverType === 'police') {
            // Authentic Carjacking! Pull NPC driver out onto the street!
            const sideX = targetVeh.position.x - Math.cos(targetVeh.heading) * 2.0;
            const sideZ = targetVeh.position.z + Math.sin(targetVeh.heading) * 2.0;
            const ejected = this.police.spawnNpc(
              targetVeh.driverType === 'police' ? 'police' : 'civilian',
              sideX,
              sideZ
            );
            ejected.panicTimer = 10;
            this.police.reportCrime(targetVeh.isPoliceUnit ? 32 : 12, targetVeh.isPoliceUnit ? 2 : 1);
            this.hud.showSubtitle(
              targetVeh.isPoliceUnit
                ? '🚓 已强行夺取罪恶城警用巡逻车！按 [E] 开关警笛！'
                : `🏎️ 成功抢夺 ${targetVeh.spec.cnName}！按 [R] 切换罪恶城电台！`,
              3.5
            );
          }
          this.player.enterVehicle(targetVeh);
          this.audio.playUiClick(690);
        }
      }
    }

    // Shooting Input
    if (this.player.fireCooldown > 0) {
      this.player.fireCooldown -= rawDt;
    }
    if (!this.hud.isAnyMenuBlockingPointer() && this.player.fireCooldown <= 0) {
      const w = this.player.currentWeapon;
      const triggerPulled = w.automatic ? this.input.mouseLeft : this.input.mouseLeftJust;
      if (triggerPulled) {
        this.fireCurrentWeapon();
      }
    }

    // Movement / Vehicle Driving Controls
    const throttle = (this.input.isDown('KeyW') ? 1 : 0) - (this.input.isDown('KeyS') ? 1 : 0);
    const steer = (this.input.isDown('KeyA') ? 1 : 0) - (this.input.isDown('KeyD') ? 1 : 0);

    if (!this.player.currentVehicle) {
      const moveRight = (this.input.isDown('KeyD') ? 1 : 0) - (this.input.isDown('KeyA') ? 1 : 0);
      this.player.updateOnFoot(
        dt,
        throttle,
        moveRight,
        this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight'),
        this.input.justPressed('Space'),
        this.input.mouseRight && !this.hud.isAnyMenuBlockingPointer(),
        this.camRig.yaw,
        this.camRig.pitch,
        this.city.colliders
      );
    }

    this.vehicles.update(
      dt,
      this.player.currentVehicle,
      {
        throttle,
        steer,
        handbrake: this.input.isDown('Space'),
        boost: this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight'),
        ascend: this.input.isDown('Space'),
        descend: this.input.isDown('KeyC') || this.input.isDown('ControlLeft')
      },
      this.player.active.position,
      this.city.colliders,
      (boomPos) => {
        if (
          this.player.currentVehicle &&
          this.player.currentVehicle.position.distanceTo(boomPos) < 1.5
        ) {
          this.player.exitVehicle();
          this.triggerWasted();
        }
        this.handleExplosionAOE(boomPos, false);
      },
      (_rampId) => {
        if (this.camRig.stuntCamTimer <= 0) {
          this.camRig.stuntCamTimer = 1.65;
          this.missions.addCash(1500);
          this.hud.showBanner('UNIQUE STUNT JUMP', '极限飞车特技达成 · +$1,500', '#00f0ff', 2.8);
          this.hud.showSocialPost(
            '@ViceStuntClips',
            '🔥 刚刚有人开跑车直接从跨海跳台飞过去了！！太疯了！#ViceCityStunts'
          );
        }
      }
    );

    this.player.updatePartnerAndVehicleSync(
      dt,
      this.police.npcs,
      this.police.wantedLevel,
      this.city.colliders,
      (npc, dmg) => {
        this.police.damageNpc(npc, dmg, false);
      }
    );

    this.police.update(
      dt,
      this.player.active.position,
      this.player.currentVehicle,
      this.player.active.health,
      this.city.colliders,
      (dmg) => {
        this.hud.triggerDamageFlash();
        const died = this.player.applyDamage(dmg);
        if (died) this.triggerWasted();
      },
      () => this.triggerBusted(),
      () => {
        this.hud.showSubtitle('✨ 成功甩掉罪恶城警方视野，通缉星级已清零！', 4.0);
      }
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GTA6Game();
});
