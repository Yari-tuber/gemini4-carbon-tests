import * as THREE from 'three';

// ============================================================================
// GTA VI: Vice City (Leonida) — Campaign Missions ("Trust."), Interactive
// Store Robbery, Pay 'n' Spray & SnapVice Social Media Feed
// ============================================================================

export const CAMPAIGN_MISSIONS = [
  {
    id: 'mission_trust',
    title: 'MISSION 01 · "TRUST." (亡命鸳鸯)',
    reward: 25000,
    stages: [
      {
        objective: '前往海洋大道粉红光圈，按 [F] 登上敞篷跑车与杰森汇合',
        target: { x: 68, y: 0.1, z: -32, radius: 5.5 },
        requireVehicle: true,
        dialogue: 'Lucia: "Stick to the plan, Jason. One last score on Ocean Drive — Trust?"  Jason: "Trust."'
      },
      {
        objective: '驾驶跑车沿 Ocean Drive 全速驶向北端交接点 (按 Shift 氮气加速 / Space 漂移)',
        target: { x: 74, y: 0.1, z: -125, radius: 8.5 },
        requireVehicle: true,
        triggerWanted: 2,
        dialogue: 'Jason: "Hold on! VCPD scanners just lit up — floor it down Ocean Drive!"'
      },
      {
        objective: "甩开警车！前往 Pay 'n' Spray 喷漆店 (-20, -42) 消星，或直接冲向游艇码头撤离点",
        target: { x: 112, y: 0.1, z: 118, radius: 9.0 },
        requireVehicle: false,
        clearWantedOnArrive: true,
        dialogue: 'Lucia: "Marina dock is right ahead! Lose the heat and the cash is ours!"'
      }
    ]
  },
  {
    id: 'mission_neon_drift',
    title: 'MISSION 02 · OCEAN DRIVE HEAT (霓虹狂飙)',
    reward: 45000,
    stages: [
      {
        objective: '驾驶任意跑车前往海洋大道南端起点光圈',
        target: { x: 74, y: 0.1, z: 110, radius: 8.0 },
        requireVehicle: true,
        dialogue: 'Street Host: "Welcome to Vice Midnight Sprint! Hit the neon checkpoints and launch the ramp!"'
      },
      {
        objective: '冲过中段检查点，并直接飞跃前方的粉红特技跳台 (Stunt Ramp)!',
        target: { x: 82, y: 0.5, z: -14, radius: 9.5 },
        requireVehicle: true,
        dialogue: 'Lucia: "Hit that neon ramp at full nitro boost!"'
      },
      {
        objective: '冲刺抵达 THE COLONY HOTEL 终点线！',
        target: { x: 74, y: 0.1, z: -135, radius: 9.5 },
        requireVehicle: true,
        dialogue: 'Jason: "New Ocean Drive record! That is how Leonida rolls!"'
      }
    ]
  },
  {
    id: 'mission_sky_heist',
    title: 'MISSION 03 · LEONIDA SKY HEIST (摩天夺机)',
    reward: 100000,
    stages: [
      {
        objective: '前往海滩停机坪 (105, -72) 或乘摩天楼电梯 (-68, -12) 登上 Vice Maverick 直升机',
        target: { x: 105, y: 0.2, z: -72, radius: 9.0 },
        requireHelicopter: true,
        dialogue: 'Lucia: "Grab the Maverick chopper! Press [Space/E] to ascend and [WASD] to fly!"'
      },
      {
        objective: '驾驶直升机飞越海星码头霓虹摩天轮上空 (Starfish Pier)',
        target: { x: 134, y: 22.0, z: -35, radius: 16.0 },
        requireHelicopter: true,
        dialogue: 'Jason: "Look at Vice Beach from up here! Pure neon paradise."'
      },
      {
        objective: '驾驶直升机降落在 Vice Tower 摩天楼顶停机坪 (-85, 48, 0) 完成任务！',
        target: { x: -85, y: 48.2, z: 0, radius: 11.0 },
        requireHelicopter: false,
        dialogue: 'Lucia: "Touchdown on the penthouse helipad. Vice City belongs to us now!"'
      }
    ]
  }
];

export class MissionAndPhoneSystem {
  constructor(scene, cityMap, protagonists, vehicleManager, wantedSystem, audioEngine, hud) {
    this.scene = scene;
    this.cityMap = cityMap;
    this.protagonists = protagonists;
    this.vehicleManager = vehicleManager;
    this.wanted = wantedSystem;
    this.audio = audioEngine;
    this.hud = hud;

    this.missionIndex = 0;
    this.stageIndex = 0;
    this.allMissionsCompleted = false;
    this.payNSprayCooldown = 0;
    this.robberyCooldown = 0;

    // 3D Glowing Corona Cylinder Marker for active mission objective
    const coronaGeo = new THREE.CylinderGeometry(3.2, 3.2, 5.5, 28, 1, true);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xff2a85,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    this.scene.add(this.coronaMesh);

    const ringGeo = new THREE.RingGeometry(2.8, 3.4, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.coronaRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
    );
    this.scene.add(this.coronaRing);

    // SnapVice Social Media Feed items (GTA 6 Trailer 1 signature feature!)
    this.snapFeed = [
      {
        user: '@LeonidaGatorWatch',
        tag: 'TRENDING · 2.4M',
        text: '🐊 Just saw Lucia & Jason tearing up Ocean Drive in a convertible! Leonida is unreal tonight 🔥 #ViceCity #GTA6',
        time: 'Just now'
      },
      {
        user: '@OceanDriveQueen',
        tag: 'LIVE · VICE BEACH',
        text: '🌴 Sunset over the Colony Hotel hitting different today. Watch out for street racers near the neon ramp! 🏎️💨',
        time: '1m ago'
      },
      {
        user: '@VCPD_Scanner',
        tag: 'ALERT · LEONIDA',
        text: '🚨 High-speed supercars spotted near 24/7 Leonida Mart. All units standby on Ocean Drive.',
        time: '3m ago'
      }
    ];

    this._syncMissionMarker();
  }

  getCurrentMission() {
    if (this.allMissionsCompleted) return null;
    return CAMPAIGN_MISSIONS[this.missionIndex];
  }

  getCurrentStage() {
    const m = this.getCurrentMission();
    if (!m) return null;
    return m.stages[this.stageIndex];
  }

  _syncMissionMarker() {
    const stage = this.getCurrentStage();
    if (!stage) {
      this.coronaMesh.visible = false;
      this.coronaRing.visible = false;
      return;
    }
    this.coronaMesh.visible = true;
    this.coronaRing.visible = true;
    this.coronaMesh.position.set(stage.target.x, stage.target.y + 2.75, stage.target.z);
    this.coronaRing.position.set(stage.target.x, stage.target.y + 0.08, stage.target.z);
    if (stage.dialogue) {
      this.hud.showSubtitle(stage.dialogue, 6.0);
    }
  }

  pushSnapVicePost(user, tag, text) {
    this.snapFeed.unshift({ user, tag, text, time: 'LIVE' });
    if (this.snapFeed.length > 8) this.snapFeed.pop();
    this.hud.renderSnapViceFeed(this.snapFeed);
    this.hud.showSnapToast(user, text);
  }

  restartMissions() {
    this.missionIndex = 0;
    this.stageIndex = 0;
    this.allMissionsCompleted = false;
    this._syncMissionMarker();
  }

  tryInteractContextAction() {
    const actor = this.protagonists.getActiveActor();
    const pos = actor.pos;

    // 1. Check Vice Tower Rooftop Helipad Elevator at (-68, -12)
    const elev = this.cityMap.landmarks.helipadElevator;
    if (Math.hypot(pos.x - elev.x, pos.z - elev.z) < 5.5) {
      actor.pos.set(elev.topX + 4, elev.topY, elev.topZ + 4);
      actor.vel.set(0, 0, 0);
      this.audio.playCharacterSwitchWhoosh();
      this.hud.showSubtitle('已乘高速电梯抵达 Vice Tower 摩天楼顶停机坪！按 [F] 驾驶直升机！', 4.5);
      return true;
    }

    // Also allow taking elevator back down from rooftop
    if (pos.y > 40 && Math.hypot(pos.x - elev.topX, pos.z - elev.topZ) < 12 && !this.protagonists.currentVehicle) {
      actor.pos.set(elev.x, 0.05, elev.z);
      this.audio.playCharacterSwitchWhoosh();
      return true;
    }

    // 2. Check 24/7 Leonida Convenience Store Robbery at (58, 24)
    const store = this.cityMap.landmarks.convenienceStore;
    if (Math.hypot(pos.x - 58, pos.z - store.z) < 7.5 && this.robberyCooldown <= 0) {
      this.robberyCooldown = 20;
      const loot = 3500 + Math.floor(Math.random() * 2500);
      this.protagonists.cash += loot;
      this.audio.playCashPickup();
      this.wanted.addWantedHeat(160, 'Armed Robbery at 24/7 Leonida Mart!');
      this.hud.showBigBanner('STORE ROBBED!', `24/7 LEONIDA MART · +$${loot.toLocaleString()}`, '#00ff88');
      this.pushSnapVicePost(
        '@LeonidaBreaking',
        'VIRAL · 500K VIEWS',
        `💸 Someone just robbed the 24/7 Mart on Ocean Drive for $${loot.toLocaleString()} and bolted!! #FloridaMan #Leonida`
      );
      return true;
    }

    return false;
  }

  update(dt) {
    if (this.payNSprayCooldown > 0) this.payNSprayCooldown -= dt;
    if (this.robberyCooldown > 0) this.robberyCooldown -= dt;

    const actor = this.protagonists.getActiveActor();
    const veh = this.protagonists.currentVehicle;
    const pos = veh ? new THREE.Vector3(veh.x, veh.y, veh.z) : actor.pos;

    // Animate Mission Corona
    if (this.coronaMesh.visible) {
      this.coronaMesh.rotation.y += dt * 1.8;
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
      this.coronaRing.scale.setScalar(pulse);
    }

    // Check Pay 'n' Spray Garage at (-20, -42)
    const pns = this.cityMap.landmarks.payNSpray;
    if (veh && this.payNSprayCooldown <= 0 && Math.hypot(pos.x - pns.x, pos.z - pns.z) < pns.radius) {
      this.payNSprayCooldown = 8.0;
      this.vehicleManager.resprayVehicle(veh);
      this.wanted.clearWanted();
      this.audio.playCashPickup();
      this.hud.showBigBanner("PAY 'N' SPRAY", 'VEHICLE REPAIRED & WANTED STARS CLEARED ★', '#00f0ff');
      this.pushSnapVicePost(
        '@ViceCustoms',
        'OCEAN DRIVE GARAGE',
        `🎨 Fresh neon candy respray at Vice Pay 'n' Spray! Cops walked right past 'em 💀🔥`
      );
    }

    // Check Active Campaign Mission Stage
    const mission = this.getCurrentMission();
    const stage = this.getCurrentStage();
    if (!mission || !stage) return;

    const dist = Math.hypot(pos.x - stage.target.x, pos.y - stage.target.y, pos.z - stage.target.z);
    if (dist <= stage.target.radius) {
      if (stage.requireHelicopter && (!veh || veh.type !== 'helicopter')) {
        // Auto-board helicopter if player walked into marker next to it
        const nearHeli = this.vehicleManager.findNearestVehicle(pos, 10);
        if (nearHeli && nearHeli.type === 'helicopter') {
          this.protagonists.currentVehicle = nearHeli;
        } else {
          return;
        }
      } else if (stage.requireVehicle && !veh) {
        const nearCar = this.vehicleManager.findNearestVehicle(pos, 8);
        if (nearCar) {
          this.protagonists.currentVehicle = nearCar;
        } else {
          return;
        }
      }

      if (stage.triggerWanted) {
        this.wanted.addWantedHeat(stage.triggerWanted * 105, 'VCPD Heist Ambush!');
      }
      if (stage.clearWantedOnArrive) {
        this.wanted.clearWanted();
      }

      // Advance stage or complete mission!
      this.stageIndex++;
      if (this.stageIndex >= mission.stages.length) {
        // MISSION PASSED!
        this.protagonists.cash += mission.reward;
        this.audio.playMissionPassedStinger();
        this.hud.showBigBanner(
          'MISSION PASSED',
          `${mission.title} · RESPECT + $${mission.reward.toLocaleString()}`,
          '#ff47b6'
        );
        this.pushSnapVicePost(
          '@ViceUnderground',
          'BREAKING · 1.8M',
          `🔥 Lucia & Jason just pulled off "${mission.title}" in broad Leonida neon! +$${mission.reward.toLocaleString()} 💰`
        );

        this.missionIndex++;
        this.stageIndex = 0;
        if (this.missionIndex >= CAMPAIGN_MISSIONS.length) {
          this.allMissionsCompleted = true;
        }
      } else {
        this.audio.playCashPickup();
      }
      this._syncMissionMarker();
    }
  }
}
