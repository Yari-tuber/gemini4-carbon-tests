import * as THREE from 'three';

// Sun direction: ~21 deg off -Z axis so X and Z voxel faces receive distinct golden vs amber vs twilight shading,
// and elevation ~5.4 deg above the sea horizon for an iconic low-hanging orange sun & horizon sun-road.
const SUN_AZIMUTH = 0.37; // radians West-of-North (-X, -Z quadrant)
const SUN_ELEVATION = 0.0945; // ~5.41 degrees above horizon

export const SUN_DIR = new THREE.Vector3(
  -Math.sin(SUN_AZIMUTH) * Math.cos(SUN_ELEVATION),
  Math.sin(SUN_ELEVATION),
  -Math.cos(SUN_AZIMUTH) * Math.cos(SUN_ELEVATION)
).normalize();

// Shadow-casting sun direction shares exact azimuth, slightly raised (~10.2 deg)
// so every tree & cliff casts ~5.5x height razor-clean diagonal shadows across hills and water.
const SHADOW_ELEVATION = 0.178;
export const SHADOW_SUN_DIR = new THREE.Vector3(
  -Math.sin(SUN_AZIMUTH) * Math.cos(SHADOW_ELEVATION),
  Math.sin(SHADOW_ELEVATION),
  -Math.cos(SUN_AZIMUTH) * Math.cos(SHADOW_ELEVATION)
).normalize();

export const WORLD_CONFIG = {
  SEED: 20261111,
  CHUNK_SIZE: 16,
  CHUNK_HEIGHT: 96,
  SEA_LEVEL: 22,
  WATER_SURFACE_Y: 22.86,
  RENDER_RADIUS: 9, // 19x19 chunks = 304x304m detailed voxel world + 3400m seamless horizon ocean
  SHADOW_MAP_SIZE: 4096,
  SHADOW_FRUSTUM: 138,
};

export const PLAYER_CONFIG = {
  // High-altitude scenic overlook poised right above the crescent bay coastline, aligned with the sun-road!
  SPAWN_POS: new THREE.Vector3(22, 68, 58),
  // Yaw faces right down the golden ocean sun-road toward the low orange sun
  SPAWN_YAW: SUN_AZIMUTH - 0.02,
  SPAWN_PITCH: -0.155, // ~ -8.9 degrees: frames violet-rose upper sky, crisp orange sun, bay, beaches & forests!

  WIDTH: 0.6,
  HEIGHT: 1.8,
  EYE_HEIGHT: 1.62,
  SNEAK_EYE_HEIGHT: 1.42,

  GRAVITY: 25.0,
  JUMP_SPEED: 8.4,
  WALK_SPEED: 4.6,
  SPRINT_SPEED: 6.8,
  SNEAK_SPEED: 2.1,
  SWIM_SPEED: 3.8,

  // Glider parameters (smooth, buoyant, effortless control)
  GLIDE_BASE_SPEED: 10.8,
  GLIDE_MIN_SPEED: 6.2,
  GLIDE_MAX_SPEED: 21.0,
  GLIDE_SINK_RATE: 1.95,      // Gentle scenic descent (~26s from spawn if untouched)
  GLIDE_UPDRAFT_ACCEL: 15.5,  // Spacebar climb while gliding
  GLIDE_TAKEOFF_BOOST: 11.5,  // Upward impulse when taking off from ground (F or Double-Space)
  REACH_DISTANCE: 7.0,
};
