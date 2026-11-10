// Counter-Strike: Dust II — 5v5 Tactical Bot AI (Navigation, Strats, Economy, Plant & Retake)
import * as THREE from 'three';
import { WEAPONS } from '../config/WeaponsData.js';
import { CharacterRig } from '../models/CharacterModel.js';

const CT_NAMES = ['Phoenix', 'SAS_Ghost', 'Stone', 'Viper', 'warden'];
const T_NAMES  = ['Krew_1337', 'Tariq', 'Razvan', 'DustKing', 'Sirocco'];

const DIFFICULTY_PRESETS = {
  easy:   { reaction: 0.52, aimJitter: 0.068, burstRate: 0.55, headChance: 0.10 },
  normal: { reaction: 0.30, aimJitter: 0.036, burstRate: 0.80, headChance: 0.22 },
  hard:   { reaction: 0.16, aimJitter: 0.016, burstRate: 1.00, headChance: 0.42 }
};

export class BotAgent {
  constructor(index, team, scene, map, fx, sound, isSniperAnchor = false) {
    this.index = index;
    this.team = team;
    this.isPlayer = false;
    this.isSniperAnchor = isSniperAnchor;
    this.name = `BOT ${team === 'CT' ? CT_NAMES[index % CT_NAMES.length] : T_NAMES[index % T_NAMES.length]}`;

    this.map = map;
    this.fx = fx;
    this.sound = sound;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.crouching = false;
    this.grounded = true;

    this.alive = true;
    this.hp = 100;
    this.armor = 0;
    this.hasHelmet = false;
    this.hasDefuser = false;
    this.hasC4 = false;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;

    this.primaryId = null;
    this.secondaryId = team === 'CT' ? 'usp' : 'glock';
    this.activeWeaponId = this.secondaryId;
    this.mag = 12;
    this.fireCooldown = 0;
    this.reloadTimer = 0;

    // AI State
    this.difficulty = 'normal';
    this.path = [];
    this.goalNode = null;
    this.holdTimer = 0;
    this.stuckTimer = 0;
    this.lastProgressPos = new THREE.Vector3();
    this.targetEnemy = null;
    this.reactionTimer = 0;
    this.strafeDir = 1;
    this.strafeSwitchTimer = 0;
    this.blindTimer = 0;
    this.plantTimer = 0;
    this.defuseTimer = 0;
    this.stepAccum = 0;

    this.rig = new CharacterRig(this, team);
    scene.add(this.rig.root);
    this.rig.setHeldWeapon(this.activeWeaponId);
  }

  destroy(scene) {
    scene.remove(this.rig.root);
  }

  getEyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + (this.crouching ? 1.06 : 1.54), this.pos.z);
  }

  buyEquipmentForRound() {
    this.secondaryId = this.team === 'CT' ? 'usp' : 'glock';

    // Pistol / Eco / Force / Full-Buy logic
    if (this.money >= 5600 && this.isSniperAnchor) {
      if (!this.primaryId || this.primaryId !== 'awp') {
        this.primaryId = 'awp';
        this.money -= 4750;
      }
      if (!this.hasHelmet && this.money >= 1000) {
        this.armor = 100; this.hasHelmet = true; this.money -= 1000;
      }
    } else if (this.money >= 3700) {
      const rifle = this.team === 'CT' ? 'm4a1s' : 'ak47';
      const cost = WEAPONS[rifle].price;
      if (!this.primaryId) {
        this.primaryId = rifle;
        this.money -= cost;
      }
      if (!this.hasHelmet && this.money >= 1000) {
        this.armor = 100; this.hasHelmet = true; this.money -= 1000;
      } else if (this.armor < 50 && this.money >= 650) {
        this.armor = 100; this.money -= 650;
      }
    } else if (this.money >= 2000) {
      const smg = this.team === 'CT' ? 'mp9' : 'mac10';
      if (!this.primaryId) {
        this.primaryId = smg;
        this.money -= WEAPONS[smg].price;
      }
      if (this.armor < 50 && this.money >= 650) {
        this.armor = 100; this.money -= 650;
      }
    } else if (this.money >= 650 && this.armor === 0) {
      this.armor = 100;
      this.money -= 650;
    }

    if (this.team === 'CT' && !this.hasDefuser && this.money >= 400) {
      this.hasDefuser = true;
      this.money -= 400;
    }

    this.activeWeaponId = this.primaryId || this.secondaryId;
    const wDef = WEAPONS[this.activeWeaponId];
    this.mag = wDef.magSize;
    this.rig.setHeldWeapon(this.activeWeaponId);
  }

  respawnAt(spawnVec, goalNodeId) {
    this.alive = true;
    this.hp = 100;
    this.pos.copy(spawnVec);
    this.vel.set(0, 0, 0);
    this.blindTimer = 0;
    this.plantTimer = 0;
    this.defuseTimer = 0;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.crouching = false;
    this.targetEnemy = null;
    this.rig.resetAlive();

    this.activeWeaponId = this.primaryId || this.secondaryId;
    this.mag = WEAPONS[this.activeWeaponId].magSize;
    this.rig.setHeldWeapon(this.activeWeaponId);

    this.setGoalNode(goalNodeId);
  }

  setGoalNode(goalNodeId) {
    if (!goalNodeId || !this.map.waypoints[goalNodeId]) return;
    this.goalNode = goalNodeId;
    const startId = this.map.getNearestWaypoint(this.pos);
    this.path = this.map.findPath(startId, goalNodeId);
  }

  applyFlashbang(flashPos) {
    if (!this.alive) return;
    const eye = this.getEyePosition();
    const dist = eye.distanceTo(flashPos);
    if (dist > 34) return;
    if (!this.map.hasLineOfSight(eye, flashPos, [])) return;

    const toFlash = new THREE.Vector3().subVectors(flashPos, eye).normalize();
    const look = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const dot = look.dot(toFlash);
    if (dot > -0.1) {
      this.blindTimer = Math.max(this.blindTimer, (dot > 0.4 ? 3.1 : 1.6) * (1 - dist / 38));
      this.targetEnemy = null;
    }
  }

  takeDamage(rawDamage, armorPen, part, attacker, weaponId, isWallbang = false) {
    if (!this.alive) return 0;

    let mult = 1.0;
    if (part === 'HEAD') mult = 4.0;
    else if (part === 'STOMACH') mult = 1.25;
    else if (part === 'LEGS') mult = 0.75;

    let dmg = rawDamage * mult;
    const armored = (part === 'HEAD' && this.hasHelmet) || ((part === 'CHEST' || part === 'STOMACH') && this.armor > 0);
    if (armored) {
      this.armor = Math.max(0, Math.round(this.armor - dmg * (1 - armorPen) * 0.5));
      dmg *= armorPen;
      if (part === 'HEAD') this.sound.playImpact('headshot_helmet', this.pos);
      else this.sound.playImpact('flesh', this.pos);
    } else {
      if (part === 'HEAD') this.sound.playImpact('headshot', this.pos);
      else this.sound.playImpact('flesh', this.pos);
    }

    const finalDmg = Math.max(1, Math.round(dmg));
    this.hp = Math.max(0, this.hp - finalDmg);
    this.rig.triggerFlinch();

    // Snap attention towards attacker if not blinded
    if (attacker && attacker.alive && this.blindTimer <= 0 && !this.targetEnemy) {
      this.targetEnemy = attacker;
      this.reactionTimer = 0.14;
    }

    if (this.hp <= 0) {
      this.die(attacker ? new THREE.Vector3().subVectors(this.pos, attacker.pos) : null);
    }
    return finalDmg;
  }

  die(bulletDir = null) {
    if (!this.alive) return;
    this.alive = false;
    this.rig.setHeldWeapon(null);
    this.rig.triggerDeath(bulletDir);

    // Drop primary weapon & C4 onto ground!
    if (this.primaryId) {
      const def = WEAPONS[this.primaryId];
      this.fx.dropWeapon(this.primaryId, this.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), this.mag, def.reserveAmmo);
      this.primaryId = null;
    }
    if (this.hasC4) {
      this.fx.dropWeapon('c4', this.pos.clone().add(new THREE.Vector3(0.25, 0.7, 0)), 1, 0);
      this.hasC4 = false;
    }
  }

  update(dt, { freezeTime, enemies, matchState, matchCallbacks }) {
    if (!this.alive) {
      this.rig.update(dt, { pos: this.pos, yaw: this.yaw, dead: true });
      return;
    }

    const preset = DIFFICULTY_PRESETS[this.difficulty] || DIFFICULTY_PRESETS.normal;
    if (this.blindTimer > 0) this.blindTimer = Math.max(0, this.blindTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      if (this.reloadTimer <= 0) {
        this.mag = WEAPONS[this.activeWeaponId].magSize;
      }
    }

    if (freezeTime) {
      const { floorY } = this.map.getSupportingFloorY(this.pos.x, this.pos.y, this.pos.z, 0.38, 0.6);
      if (floorY > -20) this.pos.y = floorY;
      this.rig.update(dt, { pos: this.pos, yaw: this.yaw, speed: 0, crouching: false, hasC4: this.hasC4, dead: false });
      return;
    }

    // 1. Scan for visible living enemies (occluded by walls AND Smoke Grenades!)
    const myEye = this.getEyePosition();
    let visibleEnemy = null;
    let bestEnemyDist = Infinity;

    if (this.blindTimer <= 0.25) {
      for (const en of enemies) {
        if (!en.alive) continue;
        const enEye = en.getEyePosition();
        const d = myEye.distanceTo(enEye);
        if (d > 68) continue;

        // FOV check (~135 deg unless already engaging or very close)
        const toEn = new THREE.Vector3().subVectors(enEye, myEye).normalize();
        const look = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        if (d > 8 && look.dot(toEn) < -0.28 && this.targetEnemy !== en) continue;

        if (this.map.hasLineOfSight(myEye, enEye, this.fx.activeSmokes)) {
          if (d < bestEnemyDist) {
            bestEnemyDist = d;
            visibleEnemy = en;
          }
        }
      }
    }

    if (visibleEnemy) {
      if (this.targetEnemy !== visibleEnemy) {
        this.targetEnemy = visibleEnemy;
        this.reactionTimer = preset.reaction * (0.8 + Math.random() * 0.45);
      }
    } else {
      this.targetEnemy = null;
    }

    // 2. Objective Actions (T Plant C4 / Pickup dropped C4 / CT Retake & Defuse!)
    let isDoingObjective = false;

    // T Bot picks up dropped C4 if nearby
    if (this.team === 'T' && !matchState.bombPlanted) {
      for (let i = this.fx.droppedItems.length - 1; i >= 0; i--) {
        const d = this.fx.droppedItems[i];
        if (d.isC4) {
          if (this.pos.distanceTo(d.pos) < 2.0) {
            this.hasC4 = true;
            this.fx.fxGroup.remove(d.mesh);
            this.fx.droppedItems.splice(i, 1);
            this.setGoalNode(Math.random() < 0.5 ? 'a_site' : 'b_site');
          } else if (!this.hasC4 && this.index === 0 && this.path.length === 0) {
            const nearC4Node = this.map.getNearestWaypoint(d.pos);
            this.setGoalNode(nearC4Node);
          }
        }
      }
    }

    // T Bomb Carrier plants C4 when inside Bombsite A or B and clear of immediate duel
    if (this.team === 'T' && this.hasC4 && !matchState.bombPlanted && !visibleEnemy) {
      const site = this.map.getBombsiteAt(this.pos);
      if (site) {
        isDoingObjective = true;
        this.crouching = true;
        this.vel.set(0, 0, 0);
        this.plantTimer += dt;
        if (this.plantTimer >= 3.2) {
          this.hasC4 = false;
          this.plantTimer = 0;
          this.crouching = false;
          matchCallbacks.onBombPlanted(this, site);
        }
      } else {
        this.plantTimer = 0;
      }
    } else {
      this.plantTimer = 0;
    }

    // CT Bot Retakes & Defuses Planted C4!
    if (this.team === 'CT' && matchState.bombPlanted && matchState.plantedBombPos) {
      const targetSiteNode = matchState.plantedSite === 'A' ? 'a_site' : 'b_site';
      if (this.goalNode !== targetSiteNode && this.pos.distanceTo(matchState.plantedBombPos) > 5.5) {
        this.setGoalNode(targetSiteNode);
      }

      const distToBomb = this.pos.distanceTo(matchState.plantedBombPos);
      if (distToBomb < 2.2 && !visibleEnemy) {
        if (!matchState.activeDefuser || matchState.activeDefuser === this) {
          matchState.activeDefuser = this;
          isDoingObjective = true;
          this.crouching = true;
          this.vel.set(0, 0, 0);
          if (this.defuseTimer === 0) this.sound.playDefuseStart();
          const reqTime = this.hasDefuser ? 5.0 : 10.0;
          this.defuseTimer += dt;
          if (this.defuseTimer >= reqTime) {
            this.defuseTimer = 0;
            matchCallbacks.onBombDefused(this);
          }
        }
      } else {
        if (matchState.activeDefuser === this) matchState.activeDefuser = null;
        this.defuseTimer = 0;
      }
    }

    // 3. Movement & Combat Engagement
    let moveWish = new THREE.Vector3();

    if (!isDoingObjective) {
      if (this.blindTimer > 0.35) {
        // Blinded stagger!
        this.crouching = false;
        moveWish.set(Math.cos(this.index * 2.1), 0, Math.sin(this.index * 2.1));
      } else if (this.targetEnemy && visibleEnemy) {
        // Combat Aiming, Strafe-Peeking & Burst Firing!
        const enPos = visibleEnemy.pos.clone();
        const aimHeight = Math.random() < preset.headChance ? 1.50 : 1.12;
        const aimPoint = new THREE.Vector3(enPos.x, enPos.y + (visibleEnemy.crouching ? 0.85 : aimHeight), enPos.z);
        const dirToTarget = new THREE.Vector3().subVectors(aimPoint, myEye);
        const horizDist = Math.hypot(dirToTarget.x, dirToTarget.z);

        const desiredYaw = Math.atan2(-dirToTarget.x, -dirToTarget.z);
        const desiredPitch = Math.atan2(dirToTarget.y, horizDist);

        // Smooth angular turn toward enemy
        let yawDiff = desiredYaw - this.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        this.yaw += yawDiff * Math.min(1, dt * 11.5);
        this.pitch += (desiredPitch - this.pitch) * Math.min(1, dt * 11.5);

        // Tactical counter-strafe / crouch during firefight
        this.strafeSwitchTimer -= dt;
        if (this.strafeSwitchTimer <= 0) {
          this.strafeSwitchTimer = 0.45 + Math.random() * 0.55;
          this.strafeDir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1);
          this.crouching = horizDist > 14 && Math.random() < 0.38;
        }
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        moveWish.copy(right).multiplyScalar(this.strafeDir * 0.55);

        // Reaction countdown -> Shoot!
        this.reactionTimer -= dt;
        if (this.reactionTimer <= 0 && this.fireCooldown <= 0 && this.reloadTimer <= 0 && Math.abs(yawDiff) < 0.25) {
          this._botFireAt(myEye, aimPoint, preset, matchCallbacks);
        }
      } else {
        // Waypoint Path Following across Dust2!
        this.crouching = false;
        this.pitch += (0 - this.pitch) * Math.min(1, dt * 6);

        // Direct approach to planted bomb if CT and close
        let navTarget = null;
        if (this.team === 'CT' && matchState.bombPlanted && matchState.plantedBombPos &&
            this.pos.distanceTo(matchState.plantedBombPos) < 8.5) {
          navTarget = matchState.plantedBombPos;
        } else if (this.path.length > 0) {
          navTarget = this.path[0];
          const dXZ = Math.hypot(navTarget.x - this.pos.x, navTarget.z - this.pos.z);
          if (dXZ < 1.75) {
            this.path.shift();
            navTarget = this.path[0] || null;
          }
        } else {
          // Reached goal node — patrol or roam after brief hold
          this.holdTimer -= dt;
          if (this.holdTimer <= 0) {
            this.holdTimer = 3.5 + Math.random() * 4.0;
            this._pickNextTacticalNode(matchState);
          }
        }

        if (navTarget) {
          const dx = navTarget.x - this.pos.x;
          const dz = navTarget.z - this.pos.z;
          const len = Math.hypot(dx, dz);
          if (len > 0.1) {
            moveWish.set(dx / len, 0, dz / len);
            const targetYaw = Math.atan2(-moveWish.x, -moveWish.z);
            let yd = targetYaw - this.yaw;
            while (yd > Math.PI) yd -= Math.PI * 2;
            while (yd < -Math.PI) yd += Math.PI * 2;
            this.yaw += yd * Math.min(1, dt * 8.5);
          }
        }
      }
    }

    // Apply Bot Physics & Dust2 Collision
    const wDef = WEAPONS[this.activeWeaponId];
    const speed = (this.crouching ? 2.6 : 5.45) * (wDef.moveSpeed || 0.9);
    this.vel.x = moveWish.x * speed;
    this.vel.z = moveWish.z * speed;

    // Anti-stuck hop if blocked on crate/door edge
    if (moveWish.lengthSq() > 0.2) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.1) {
        if (this.pos.distanceTo(this.lastProgressPos) < 0.35 && this.grounded) {
          this.vel.y = 5.8;
          this.grounded = false;
        }
        this.lastProgressPos.copy(this.pos);
        this.stuckTimer = 0;
      }
    }

    if (!this.grounded) {
      this.vel.y -= 18.0 * dt;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.map.resolveHorizontal(this.pos, 0.38, this.crouching ? 1.18 : 1.70, 0.54);
    this.pos.y += this.vel.y * dt;

    const { floorY, surface } = this.map.getSupportingFloorY(this.pos.x, this.pos.y, this.pos.z, 0.38, 0.58);
    if (this.pos.y <= floorY + 0.05 && this.vel.y <= 0.1) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.grounded = true;
    } else if (this.grounded && floorY > this.pos.y - 0.42 && this.vel.y <= 0) {
      this.pos.y = floorY;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }

    // Spatialized Bot Footsteps!
    const actualSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && actualSpeed > 3.2 && !this.crouching) {
      this.stepAccum += actualSpeed * dt;
      if (this.stepAccum > 2.5) {
        this.stepAccum = 0;
        this.sound.playFootstep(surface, this.pos);
      }
    }

    this.rig.update(dt, {
      pos: this.pos,
      yaw: this.yaw,
      pitch: this.pitch,
      speed: actualSpeed,
      crouching: this.crouching,
      blinded: this.blindTimer > 0.35,
      hasC4: this.hasC4,
      dead: false
    });
  }

  _botFireAt(eyePos, aimPoint, preset, matchCallbacks) {
    const def = WEAPONS[this.activeWeaponId];
    if (this.mag <= 0) {
      this.reloadTimer = def.reloadTime || 2.3;
      return;
    }

    this.mag -= 1;
    // Slight burst cadence so bots tap/burst realistically instead of laser-beaming
    const baseInterval = 60 / def.rpm;
    this.fireCooldown = def.sniper ? baseInterval * 1.15 : baseInterval / preset.burstRate + (this.mag % 4 === 0 ? 0.16 : 0);

    this.sound.playGunshot(def.id, this.pos);

    const dir = new THREE.Vector3().subVectors(aimPoint, eyePos).normalize();
    const jitter = preset.aimJitter * (this.blindTimer > 0 ? 3.5 : 1.0);
    dir.x += (Math.random() - 0.5) * 2 * jitter;
    dir.y += (Math.random() - 0.5) * 2 * jitter;
    dir.z += (Math.random() - 0.5) * 2 * jitter;
    dir.normalize();

    if (matchCallbacks && matchCallbacks.onFireHitscan) {
      matchCallbacks.onFireHitscan(this, eyePos, dir, def);
    }

    if (this.mag <= 0) {
      this.reloadTimer = def.reloadTime || 2.3;
    }
  }

  _pickNextTacticalNode(matchState) {
    if (this.team === 'T') {
      if (matchState.bombPlanted) {
        const holdA = ['a_site', 'goose', 'short_stairs', 'a_ramp'];
        const holdB = ['b_site', 'b_car', 'b_back', 'b_doors_in'];
        const pool = matchState.plantedSite === 'A' ? holdA : holdB;
        this.setGoalNode(pool[this.index % pool.length]);
      } else {
        this.setGoalNode(matchState.tTargetSite === 'A' ? 'a_site' : 'b_site');
      }
    } else {
      if (matchState.bombPlanted) {
        this.setGoalNode(matchState.plantedSite === 'A' ? 'a_site' : 'b_site');
      } else {
        // Late-round CT flank / info check
        const ctPatrols = ['a_cross', 'a_site', 'catwalk', 'ct_mid', 'b_site'];
        this.setGoalNode(ctPatrols[(this.index + Math.floor(Math.random() * 2)) % ctPatrols.length]);
      }
    }
  }
}
