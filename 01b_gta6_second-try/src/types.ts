import * as THREE from 'three';

export type ProtagonistId = 'lucia' | 'jason';

export type WeatherMode = 'sunset' | 'day' | 'night' | 'rain';

export type WeaponId = 'fists' | 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'rpg';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cnName: string;
  slot: number;
  damage: number;
  fireRate: number; // shots per sec
  range: number;
  spread: number;
  pellets: number;
  automatic: boolean;
  isProjectile?: boolean;
  driveByAllowed: boolean;
  magSize: number;
  ammo: number;
  maxAmmo: number;
  price: number;
}

export type VehicleKind =
  | 'supercar'
  | 'convertible'
  | 'muscle'
  | 'suv'
  | 'police'
  | 'swat'
  | 'bike'
  | 'boat'
  | 'helicopter';

export interface VehicleSpec {
  kind: VehicleKind;
  displayName: string;
  cnName: string;
  maxSpeed: number;
  accel: number;
  brake: number;
  turnSpeed: number;
  driftFactor: number;
  maxHealth: number;
  mass: number;
  halfWidth: number;
  halfLength: number;
  seatHeight: number;
}

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  label?: string;
}

export interface StuntRamp {
  x: number;
  z: number;
  width: number;
  length: number;
  height: number;
  dirX: number;
  dirZ: number;
  id: string;
  completed?: boolean;
}

export interface WorldPOI {
  id: string;
  name: string;
  cnName: string;
  icon: 'mission' | 'bank' | 'spray' | 'gun' | 'safehouse' | 'heli' | 'boat' | 'store';
  color: string;
  position: THREE.Vector3;
}

export type RadioStationId = 'off' | 'flash_synth' | 'leonida_bass' | 'vrock';
