import * as THREE from 'three';
import { WeaponDef, WeaponId } from '../types';
import { PropsAndFX } from '../world/PropsAndFX';

export function createDefaultArsenal(): Record<WeaponId, WeaponDef> {
  return {
    fists: {
      id: 'fists',
      name: 'Unarmed / Melee',
      cnName: '徒手格斗',
      slot: 1,
      damage: 34,
      fireRate: 2.4,
      range: 2.6,
      spread: 0.05,
      pellets: 1,
      automatic: false,
      driveByAllowed: false,
      magSize: 999,
      ammo: 999,
      maxAmmo: 999,
      price: 0
    },
    pistol: {
      id: 'pistol',
      name: 'Combat Pistol 9mm',
      cnName: '战术手枪',
      slot: 2,
      damage: 36,
      fireRate: 4.5,
      range: 85,
      spread: 0.016,
      pellets: 1,
      automatic: false,
      driveByAllowed: true,
      magSize: 15,
      ammo: 180,
      maxAmmo: 360,
      price: 200
    },
    smg: {
      id: 'smg',
      name: 'Micro SMG',
      cnName: '微型冲锋枪 (支持车载射击)',
      slot: 3,
      damage: 24,
      fireRate: 11.5,
      range: 75,
      spread: 0.038,
      pellets: 1,
      automatic: true,
      driveByAllowed: true,
      magSize: 30,
      ammo: 240,
      maxAmmo: 600,
      price: 450
    },
    shotgun: {
      id: 'shotgun',
      name: 'Pump Shotgun',
      cnName: '泵动式霰弹枪',
      slot: 4,
      damage: 22,
      fireRate: 1.35,
      range: 42,
      spread: 0.085,
      pellets: 7,
      automatic: false,
      driveByAllowed: false,
      magSize: 8,
      ammo: 56,
      maxAmmo: 120,
      price: 650
    },
    rifle: {
      id: 'rifle',
      name: 'Carbine Rifle M4',
      cnName: '卡宾突击步枪',
      slot: 5,
      damage: 35,
      fireRate: 9.2,
      range: 135,
      spread: 0.018,
      pellets: 1,
      automatic: true,
      driveByAllowed: false,
      magSize: 30,
      ammo: 210,
      maxAmmo: 600,
      price: 900
    },
    rpg: {
      id: 'rpg',
      name: 'RPG-7 Launcher',
      cnName: 'RPG 火箭筒',
      slot: 6,
      damage: 350,
      fireRate: 0.65,
      range: 160,
      spread: 0.008,
      pellets: 1,
      automatic: false,
      isProjectile: true,
      driveByAllowed: false,
      magSize: 1,
      ammo: 8,
      maxAmmo: 20,
      price: 1500
    }
  };
}

export interface ActiveRocket {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  fromPlayer: boolean;
}

export class ProjectileManager {
  private scene: THREE.Scene;
  private fx: PropsAndFX;
  public rockets: ActiveRocket[] = [];

  private rocketGeo = new THREE.ConeGeometry(0.14, 0.65, 8);
  private rocketMat = new THREE.MeshBasicMaterial({ color: 0xff9e00 });

  constructor(scene: THREE.Scene, fx: PropsAndFX) {
    this.scene = scene;
    this.fx = fx;
    this.rocketGeo.rotateX(Math.PI / 2);
  }

  public spawnRocket(origin: THREE.Vector3, dir: THREE.Vector3, fromPlayer: boolean): void {
    const m = new THREE.Mesh(this.rocketGeo, this.rocketMat);
    m.position.copy(origin);
    m.lookAt(origin.clone().add(dir));
    this.scene.add(m);
    this.rockets.push({
      mesh: m,
      pos: origin.clone(),
      vel: dir.clone().normalize().multiplyScalar(58),
      life: 3.2,
      fromPlayer
    });
  }

  public update(
    dt: number,
    checkHit: (pos: THREE.Vector3) => boolean,
    onDetonate: (pos: THREE.Vector3, fromPlayer: boolean) => void
  ): void {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.pos.addScaledVector(r.vel, dt);
      r.mesh.position.copy(r.pos);

      if (Math.random() < 0.75) {
        this.fx.spawnTireSmoke(r.pos);
      }

      if (r.pos.y <= 0.25 || r.life <= 0 || checkHit(r.pos)) {
        onDetonate(r.pos.clone(), r.fromPlayer);
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }
  }
}
