import * as THREE from 'three';
import { CityBuilder } from '../world/CityBuilder';
import { PlayerSystem } from '../entities/PlayerSystem';
import { VehicleInstance, VehicleSystem } from '../entities/VehicleSystem';
import { PedAndPoliceSystem } from '../entities/PedAndPolice';
import { PropsAndFX } from '../world/PropsAndFX';
import { AudioEngine } from '../core/AudioEngine';

export interface ActiveMissionHudInfo {
  title: string;
  objective: string;
  gpsTarget: THREE.Vector3 | null;
  gpsColor: string;
}

export class MissionManager {
  private scene: THREE.Scene;
  private city: CityBuilder;
  private player: PlayerSystem;
  private vehicles: VehicleSystem;
  private police: PedAndPoliceSystem;
  private fx: PropsAndFX;
  private audio: AudioEngine;

  // Story progression: 0 -> Mission 1 available, 1 -> Mission 2 available, 2 -> Mission 3 (repeatable heist)
  public storyIndex = 0;
  public activeStage = 0; // 0 = waiting at start corona, 1..N = in-mission steps

  private markerMesh: THREE.Mesh;
  private markerRing: THREE.Mesh;
  public markerPos = new THREE.Vector3(-74, 0, 45);
  public customGpsWaypoint: THREE.Vector3 | null = null;

  private repoTargetCar: VehicleInstance | null = null;
  private payNSprayCooldown = 0;
  private storeRobCooldown = 0;
  private socialTimer = 14;

  // Street Race Checkpoint System
  public raceActive = false;
  private raceCheckpoints: THREE.Vector3[] = [
    new THREE.Vector3(220, 0, 140),
    new THREE.Vector3(220, 0, -140),
    new THREE.Vector3(100, 0, -160),
    new THREE.Vector3(100, 0, 160),
    new THREE.Vector3(220, 0, 95)
  ];
  private raceIdx = 0;
  private raceTimer = 0;
  private raceGateMesh: THREE.Mesh | null = null;

  // Callbacks to UI
  public onSubtitle: (text: string, duration?: number) => void = () => {};
  public onBanner: (main: string, sub: string, color: string) => void = () => {};
  public onSocialPost: (handle: string, text: string) => void = () => {};
  public onCashChange: (delta: number) => void = () => {};

  constructor(
    scene: THREE.Scene,
    city: CityBuilder,
    player: PlayerSystem,
    vehicles: VehicleSystem,
    police: PedAndPoliceSystem,
    fx: PropsAndFX,
    audio: AudioEngine
  ) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.vehicles = vehicles;
    this.police = police;
    this.fx = fx;
    this.audio = audio;

    // Iconic GTA Glowing Mission Corona Cylinder
    const cylGeo = new THREE.CylinderGeometry(2.6, 2.6, 5.5, 24, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0xff2e93,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.markerMesh = new THREE.Mesh(cylGeo, cylMat);
    this.scene.add(this.markerMesh);

    const ringGeo = new THREE.RingGeometry(2.2, 2.75, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      side: THREE.DoubleSide
    });
    this.markerRing = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(this.markerRing);

    this.setupMissionStartMarker();
  }

  private setupMissionStartMarker(): void {
    this.activeStage = 0;
    if (this.storyIndex === 0) {
      // Mission 1 at LTD Convenience Store
      this.setMarker(-74, 45, 0xff2e93);
    } else if (this.storyIndex === 1) {
      // Mission 2 at Colony Hotel on Ocean Drive
      this.setMarker(207, -95, 0x00f0ff);
    } else {
      // Mission 3 Grand Bank Heist at Leonida National Bank
      this.setMarker(-169, -45, 0xffd166);
    }
  }

  private setMarker(x: number, z: number, hexColor: number): void {
    this.markerPos.set(x, 0, z);
    this.markerMesh.position.set(x, 2.75, z);
    this.markerRing.position.set(x, 0.09, z);
    (this.markerMesh.material as THREE.MeshBasicMaterial).color.setHex(hexColor);
    this.markerMesh.visible = true;
    this.markerRing.visible = true;
  }

  private hideMarker(): void {
    this.markerMesh.visible = false;
    this.markerRing.visible = false;
  }

  public addCash(delta: number): void {
    this.player.cash = Math.max(0, this.player.cash + delta);
    this.onCashChange(delta);
    if (delta > 0) this.audio.playCashSound();
  }

  public failActiveMission(reason: string): void {
    if (this.activeStage === 0) return;
    this.onBanner('MISSION FAILED', reason, '#ef4444');
    this.repoTargetCar = null;
    this.setupMissionStartMarker();
  }

  public startStreetRace(): void {
    if (!this.raceGateMesh) {
      const torusGeo = new THREE.TorusGeometry(6.5, 0.35, 12, 28);
      const torusMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      this.raceGateMesh = new THREE.Mesh(torusGeo, torusMat);
      this.scene.add(this.raceGateMesh);
    }
    this.raceActive = true;
    this.raceIdx = 0;
    this.raceTimer = 65;
    this.syncRaceGate();
    this.onSubtitle('🏁 海洋大道霓虹街头竞速已开启！驾驶跑车在 65 秒内冲过全部 5 个青色光环！', 5.0);
  }

  private syncRaceGate(): void {
    if (!this.raceGateMesh) return;
    if (!this.raceActive) {
      this.raceGateMesh.visible = false;
      return;
    }
    const pt = this.raceCheckpoints[this.raceIdx];
    this.raceGateMesh.position.set(pt.x, 4.5, pt.z);
    this.raceGateMesh.visible = true;
  }

  public getHudInfo(): ActiveMissionHudInfo {
    if (this.raceActive) {
      const target = this.raceCheckpoints[this.raceIdx];
      return {
        title: `🏁 霓虹街头竞速 · 剩余 ${this.raceTimer.toFixed(1)}s`,
        objective: `全速冲刺通过检查点 (${this.raceIdx + 1}/${this.raceCheckpoints.length})！Shift 开启氮气加速！`,
        gpsTarget: target,
        gpsColor: '#00f0ff'
      };
    }

    if (this.storyIndex === 0) {
      if (this.activeStage === 0) {
        return {
          title: '主线任务 1 · 欢迎来到雷奥奈达',
          objective: '驾车前往华盛顿大道【LTD 便利店】粉色光柱开启双人劫案',
          gpsTarget: this.customGpsWaypoint ?? this.markerPos,
          gpsColor: this.customGpsWaypoint ? '#a855f7' : '#ffd166'
        };
      }
      if (this.activeStage === 1) {
        return {
          title: '欢迎来到雷奥奈达 · 亡命鸳鸯',
          objective:
            this.police.wantedLevel > 0
              ? '甩掉 VCPD 警车追捕（可驶入 Pay \'n\' Spray 喷漆消星或逃离视野）！'
              : '警报已解除！驾车返回海洋大道【海景霓虹酒店安全屋】光柱',
          gpsTarget:
            this.police.wantedLevel > 0
              ? this.customGpsWaypoint ?? new THREE.Vector3(-74, 0, -195)
              : this.markerPos,
          gpsColor: '#ffd166'
        };
      }
    } else if (this.storyIndex === 1) {
      if (this.activeStage === 0) {
        return {
          title: '主线任务 2 · 海洋大道夺车行动',
          objective: '前往海洋大道【THE COLONY 霓虹酒店】光柱接取超跑劫持合约',
          gpsTarget: this.customGpsWaypoint ?? this.markerPos,
          gpsColor: this.customGpsWaypoint ? '#a855f7' : '#00f0ff'
        };
      }
      if (this.activeStage === 1) {
        return {
          title: '海洋大道夺车行动 · 突破守卫',
          objective: '击败酒店门口的卡特尔武装保镖，抢走金色【猎豹复古超跑】！',
          gpsTarget: this.repoTargetCar ? this.repoTargetCar.position : this.markerPos,
          gpsColor: '#00f0ff'
        };
      }
      if (this.activeStage === 2) {
        return {
          title: '海洋大道夺车行动 · 极速交付',
          objective: '驾驶这辆猎豹超跑前往【北部海湾停机坪】交车点，切勿撞毁！',
          gpsTarget: this.markerPos,
          gpsColor: '#ffd166'
        };
      }
    } else {
      if (this.activeStage === 0) {
        return {
          title: '终极劫案 · 雷奥奈达国家银行大劫案',
          objective: '全副武装前往市中心【雷奥奈达国家银行】金色光柱引爆金库！',
          gpsTarget: this.customGpsWaypoint ?? this.markerPos,
          gpsColor: this.customGpsWaypoint ? '#a855f7' : '#ffd166'
        };
      }
      if (this.activeStage === 1) {
        return {
          title: '雷奥奈达大劫案 · 突破重围',
          objective:
            this.police.wantedLevel > 0
              ? '已抢得金库巨款！突破 4 星特警与武装直升机封锁，甩掉通缉后前往【海星岛】！'
              : '成功甩掉特警！跨海飞跃或乘快艇/直升机前往【海星岛庄园】分赃！',
          gpsTarget: this.markerPos,
          gpsColor: '#ffd166'
        };
      }
    }

    return {
      title: '罪恶城自由漫游 · FREE ROAM',
      objective: '自由探索雷奥奈达！按 P 打开手机导航或呼叫超跑/直升机',
      gpsTarget: this.customGpsWaypoint,
      gpsColor: '#a855f7'
    };
  }

  public update(dt: number): string | null {
    // Pulse mission marker ring
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.1;
    this.markerRing.scale.setScalar(pulse);
    this.markerMesh.rotation.y += dt * 1.2;

    if (this.payNSprayCooldown > 0) this.payNSprayCooldown -= dt;
    if (this.storeRobCooldown > 0) this.storeRobCooldown -= dt;

    const pPos = this.player.active.position;
    let promptText: string | null = null;

    // Clear custom GPS waypoint once reached
    if (this.customGpsWaypoint && pPos.distanceTo(this.customGpsWaypoint) < 16) {
      this.customGpsWaypoint = null;
    }

    // Street Race Update
    if (this.raceActive) {
      this.raceTimer -= dt;
      if (this.raceGateMesh) {
        this.raceGateMesh.rotation.y += dt * 1.8;
      }
      const cp = this.raceCheckpoints[this.raceIdx];
      if (Math.hypot(pPos.x - cp.x, pPos.z - cp.z) < 12.5) {
        this.audio.playCashSound();
        this.raceIdx++;
        if (this.raceIdx >= this.raceCheckpoints.length) {
          this.raceActive = false;
          this.syncRaceGate();
          this.addCash(25000);
          this.audio.playMissionPassed();
          this.onBanner('RACE WON!', '海洋大道街头车神 · +$25,000', '#00f0ff');
          this.onSocialPost('@ViceStreetKing', '这辆跑车刚刚刷爆了海洋大道霓虹圈速纪录！！🏎️⚡');
        } else {
          this.syncRaceGate();
        }
      } else if (this.raceTimer <= 0) {
        this.raceActive = false;
        this.syncRaceGate();
        this.onBanner('RACE TIME UP', '街头竞速超时，可在手机随时重开', '#ef4444');
      }
    }

    // 1. Check Pay 'n' Spray Garage Bay (-78, -195)
    if (
      this.player.currentVehicle &&
      Math.abs(pPos.x - -76) < 11 &&
      Math.abs(pPos.z - -195) < 6.5
    ) {
      if (this.payNSprayCooldown <= 0) {
        const v = this.player.currentVehicle;
        const needsService =
          this.police.wantedLevel > 0 || v.health < v.spec.maxHealth * 0.95;
        if (needsService) {
          if (this.player.cash >= 500 || this.activeStage > 0) {
            if (this.player.cash >= 500) this.addCash(-500);
            this.vehicles.resprayAndRepair(v);
            this.police.clearWanted();
            this.payNSprayCooldown = 8;
            this.fx.spawnTireSmoke(v.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
            this.onSubtitle('🎨 Pay \'n\' Spray：全新霓虹车漆已喷涂，载具 100% 修复，通缉星级已消除！', 4.5);
          } else {
            promptText = 'Pay \'n\' Spray 喷漆修车需要 $500';
          }
        } else {
          promptText = 'Pay \'n\' Spray：当前载具完好且无通缉';
        }
      }
    }

    // 2. Check Ammu-Nation Gun Store Entrance (-165, +115)
    if (!this.player.currentVehicle && pPos.distanceTo(new THREE.Vector3(-165, 0, 115)) < 8.5) {
      promptText = '按 [E] 进入 Ammu-Nation 购买重型武器与防弹衣';
    }

    // 3. Check Free-roam LTD Store Hold-Up (-74, +45) when not in Mission 1 start
    if (
      this.storyIndex > 0 &&
      this.activeStage === 0 &&
      !this.player.currentVehicle &&
      pPos.distanceTo(new THREE.Vector3(-74, 0, 45)) < 7.5
    ) {
      if (this.storeRobCooldown <= 0) {
        promptText = '按 [E] 持枪抢劫 LTD 便利店收银机 (+$2,500)';
      }
    }

    // 4. Active Story Mission State Machine
    this.updateMissionLogic(pPos);

    // 5. Ambient Viral LeonidaGram Social Media Posts
    this.socialTimer -= dt;
    if (this.socialTimer <= 0) {
      this.socialTimer = 24 + Math.random() * 14;
      this.triggerAmbientSocialPost();
    }

    return promptText;
  }

  public tryQuickRobStore(): boolean {
    const pPos = this.player.active.position;
    if (
      this.storeRobCooldown <= 0 &&
      !this.player.currentVehicle &&
      pPos.distanceTo(new THREE.Vector3(-74, 0, 45)) < 8.5
    ) {
      this.storeRobCooldown = 45;
      this.addCash(2500);
      this.police.reportCrime(38, 2);
      this.police.alertPanicNearby(pPos, 50);
      this.onSubtitle('💵 收银机已洗劫一空 (+$2,500)！VCPD 巡逻车正在赶来，快撤！', 4.5);
      this.onSocialPost('@LeonidaCCTV', '华盛顿大道 LTD 便利店又双叒被雌雄大盗抢了 💀🚓 #OnlyInLeonida');
      return true;
    }
    return false;
  }

  private updateMissionLogic(pPos: THREE.Vector3): void {
    const distToMarker = Math.hypot(pPos.x - this.markerPos.x, pPos.z - this.markerPos.z);

    // === MISSION 1: WELCOME TO LEONIDA ===
    if (this.storyIndex === 0) {
      if (this.activeStage === 0 && distToMarker < 5.0) {
        this.activeStage = 1;
        this.player.partnerFollowMode = true;
        this.fx.spawnCashBundle(new THREE.Vector3(-71, 0.2, 43), 1500);
        this.fx.spawnCashBundle(new THREE.Vector3(-71, 0.2, 47), 1500);
        this.addCash(3000);
        this.police.reportCrime(36, 2);
        this.police.alertPanicNearby(pPos, 55);
        this.setMarker(208, 95, 0x56d364);
        this.onSubtitle(
          '露西娅：“掩护我杰森！现金到手了，快上门口那辆红色肌肉车甩掉条子！”',
          6.0
        );
        this.onSocialPost('@ViceCitizen99', '天哪华盛顿大道便利店刚发生武装抢劫！一男一女开肌肉车冲出去了🔥');
      } else if (this.activeStage === 1) {
        if (this.police.wantedLevel === 0 && distToMarker < 7.5) {
          this.completeMission('MISSION PASSED', '欢迎来到雷奥奈达 · +$12,000', 12000, 1);
          this.onSubtitle('杰森：“干得漂亮，欢迎回到罪恶城，搭档。去海洋大道看看下一单大买卖。”', 5.5);
        }
      }
      return;
    }

    // === MISSION 2: OCEAN DRIVE REPO ===
    if (this.storyIndex === 1) {
      if (this.activeStage === 0 && distToMarker < 5.5) {
        this.activeStage = 1;
        this.hideMarker();
        // Spawn target Gold/Cyan Cheetah Supercar & 4 Cartel Guards
        this.repoTargetCar = this.vehicles.spawnVehicle('supercar', 211, -112, Math.PI, {
          paintHex: 0xffbe0b,
          missionTag: 'repo_car'
        });
        this.police.spawnNpc('gang', 207, -109, 'repo_guard');
        this.police.spawnNpc('gang', 207, -116, 'repo_guard');
        this.police.spawnNpc('gang', 214, -108, 'repo_guard');
        this.police.spawnNpc('gang', 214, -117, 'repo_guard');
        this.onSubtitle('联络人：“卡特尔老大的限量版猎豹超跑就在前面，解决保镖把它开去海湾码头！”', 5.5);
      } else if (this.activeStage === 1) {
        if (!this.repoTargetCar || this.repoTargetCar.exploded) {
          this.failActiveMission('目标超跑已被摧毁！');
          return;
        }
        if (this.player.currentVehicle === this.repoTargetCar) {
          this.activeStage = 2;
          this.police.reportCrime(35, 2);
          this.setMarker(242, -320, 0xffd166);
          this.onSubtitle('杰森：“这引擎声浪太顶了！踩死油门冲向北部海湾交车点！”', 5.0);
        }
      } else if (this.activeStage === 2) {
        if (!this.repoTargetCar || this.repoTargetCar.exploded) {
          this.failActiveMission('目标超跑在途中损毁！');
          return;
        }
        if (this.player.currentVehicle === this.repoTargetCar && distToMarker < 9.5) {
          this.completeMission('MISSION PASSED', '海洋大道夺车行动 · +$28,000', 28000, 2);
          this.repoTargetCar = null;
          this.onSubtitle('露西娅：“两万八美金轻松入账！现在我们有本钱去干雷奥奈达国家银行那票大的了！”', 6.0);
        }
      }
      return;
    }

    // === MISSION 3: THE LEONIDA NATIONAL BANK HEIST ===
    if (this.storyIndex >= 2) {
      if (this.activeStage === 0 && distToMarker < 6.0) {
        this.activeStage = 1;
        this.player.partnerFollowMode = true;

        // Explosive Vault Breach!
        const vaultPos = new THREE.Vector3(-166, 1.0, -45);
        this.fx.spawnExplosion(vaultPos);
        this.audio.playExplosion();
        for (let k = 0; k < 5; k++) {
          this.fx.spawnCashBundle(
            new THREE.Vector3(-169 + (Math.random() - 0.5) * 6, 0.3, -45 + (Math.random() - 0.5) * 8),
            5000
          );
        }
        this.addCash(25000);
        this.police.reportCrime(165, 4); // Instant 4-Star NOOSE SWAT + Helicopter Siege!
        this.police.spawnNpc('swat', -182, -32, 'bank_swat');
        this.police.spawnNpc('swat', -182, -58, 'bank_swat');
        this.police.spawnNpc('swat', -176, -25, 'bank_swat');

        // Escape target: Starfish Island Luxury Villa!
        this.setMarker(452, 0, 0x56d364);
        this.onSubtitle(
          '💥 金库大门已炸开！全城 4 星特警与武装直升机出动，甩掉通缉前往【海星岛庄园】！',
          6.5
        );
        this.onSocialPost(
          '@WeazelNewsLeonida',
          '🚨 突发新闻：市中心雷奥奈达国家银行金库被炸开！NOOSE 特警部队与直升机已全面封锁街区！'
        );
      } else if (this.activeStage === 1) {
        if (this.police.wantedLevel === 0 && distToMarker < 11.0) {
          this.completeMission('HEIST PASSED', '罪恶城惊天大劫案 · +$120,000', 120000, 2);
          this.onSubtitle('🎉 传奇达成！露西娅与杰森成功拿下雷奥奈达最大劫案！可随时返回银行再次挑战！', 6.5);
        }
      }
    }
  }

  private completeMission(bannerMain: string, bannerSub: string, reward: number, nextStoryIdx: number): void {
    this.storyIndex = nextStoryIdx;
    this.activeStage = 0;
    this.addCash(reward);
    this.audio.playMissionPassed();
    this.onBanner(bannerMain, bannerSub, '#ffd166');
    this.setupMissionStartMarker();
  }

  private triggerAmbientSocialPost(): void {
    const posts: Array<[string, string]> = [
      ['@OceanDriveVibes', '今晚海洋大道的粉紫霓虹灯和敞篷超跑绝配 🌴✨ #ViceCity'],
      ['@LeonidaMan_305', '刚看到有人开着快艇从罪恶湾码头全速飙过去，不愧是雷奥奈达 🚤🐊'],
      ['@ViceSynthFM', '正在收听 FLASH Synth FM 86，梦回黄金年代！🎵🌅'],
      ['@StarfishVIP', '跨海大桥那个黄色飞车跳台谁敢全速冲过去？赏金丰厚！🏎️💨']
    ];
    const [u, t] = posts[Math.floor(Math.random() * posts.length)];
    this.onSocialPost(u, t);
  }
}
