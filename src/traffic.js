// Spatial-ring traffic pool, pedestrian pool, police pursuit AI with vision cones.
import * as THREE from 'three';
import { makeCar, makePed } from './entities.js';
import { Vehicle, allVehicles } from './vehicles.js';
import { S, setWanted, damagePlayer, say } from './state.js';
import { isRoadTile, tileCenter, GRID } from './world.js';
import { sfx } from './audio.js';

const CAR_COLORS = [0x8899aa, 0xaa8866, 0x6688aa, 0x99aa66, 0xaa6677, 0x7766aa, 0xcccccc, 0x445566, 0xbb9955];
const SHIRTS = [0x4477aa, 0xaa4444, 0x44aa66, 0xaaaa44, 0x8844aa, 0xdddddd, 0x333344];

function randNode(nearX, nearZ, ahead = 0, dirX = 0, dirZ = 0) {
  // pick a road node ~60-90m from position, biased ahead of velocity
  for (let tries = 0; tries < 30; tries++) {
    const i = Math.floor(Math.random() * GRID), j = Math.floor(Math.random() * GRID);
    if (!isRoadTile(i, j)) continue;
    const x = tileCenter(i), z = tileCenter(j);
    const d = Math.hypot(x - nearX, z - nearZ);
    if (d < 45 || d > 110) continue;
    if (ahead && (x - nearX) * dirX + (z - nearZ) * dirZ < 0) continue;
    return { x, z, i, j };
  }
  return { x: tileCenter(4), z: tileCenter(4), i: 4, j: 4 };
}

export class Traffic {
  constructor(scene, world, fx) {
    this.scene = scene; this.world = world; this.fx = fx;
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.copPeds = [];
    this.escapeTimer = 0;
    this.shootTimers = new Map();
    for (let k = 0; k < 15; k++) this.spawnCar();
    for (let k = 0; k < 25; k++) this.spawnPed();
  }

  spawnCar(near = null, kind = null) {
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const k = kind || (Math.random() < 0.12 ? 'taxi' : 'sedan');
    const mesh = makeCar(k === 'taxi' ? 0xe6c83a : color, k);
    this.scene.add(mesh);
    const v = new Vehicle(mesh, k, { color });
    const p = near || { x: 0, z: 0 };
    const n = randNode(p.x, p.z);
    v.pos.set(n.x + (Math.random() - 0.5) * 6, 0, n.z + (Math.random() - 0.5) * 6);
    v.heading = Math.random() * Math.PI * 2;
    v.driver = 'ai';
    v.ai = { target: this.nextNode(n), node: n, wait: 0 };
    this.cars.push(v);
    return v;
  }

  nextNode(from, preferDir = null) {
    const opts = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of dirs) {
      const i = from.i + di, j = from.j + dj;
      if (i < 0 || j < 0 || i >= GRID || j >= GRID) continue;
      if (!isRoadTile(i, j)) continue;
      // must stay on road line
      if (di !== 0 && from.j % 4 !== 0) continue;
      if (dj !== 0 && from.i % 4 !== 0) continue;
      opts.push({ x: tileCenter(i), z: tileCenter(j), i, j, di, dj });
    }
    if (!opts.length) return from;
    if (preferDir) {
      const straight = opts.find(o => o.di === preferDir.di && o.dj === preferDir.dj);
      if (straight && Math.random() < 0.65) return straight;
    }
    return opts[Math.floor(Math.random() * opts.length)];
  }

  spawnPed(near = null) {
    const shirt = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    const mesh = makePed(shirt);
    this.scene.add(mesh);
    const p = near || { x: 0, z: 0 };
    const n = randNode(p.x, p.z);
    const ped = {
      mesh, x: n.x + (Math.random() - 0.5) * 18, z: n.z + (Math.random() - 0.5) * 18,
      heading: Math.random() * 6.28, speed: 1.2 + Math.random(), target: null,
      flee: 0, dead: false, deadT: 0, vy: 0, y: 0, vx: 0, vz: 0,
    };
    this.pickPedTarget(ped);
    this.peds.push(ped);
    return ped;
  }

  pickPedTarget(ped) {
    ped.target = { x: ped.x + (Math.random() - 0.5) * 30, z: ped.z + (Math.random() - 0.5) * 30 };
  }

  spawnCop(near, kind = 'police') {
    const mesh = makeCar(0x1a2a3a, 'police');
    this.scene.add(mesh);
    const v = new Vehicle(mesh, 'police', { color: 0x1a2a3a });
    const a = Math.random() * Math.PI * 2;
    v.pos.set(near.x + Math.cos(a) * 55, 0, near.z + Math.sin(a) * 55);
    v.heading = Math.atan2(near.x - v.pos.x, near.z - v.pos.z);
    v.driver = 'ai';
    v.ai = { cop: true };
    this.cops.push(v);
    return v;
  }

  spawnCopPed(near) {
    const mesh = makePed(0x2a3a5a, { cap: 0x1a2a3a });
    this.scene.add(mesh);
    const a = Math.random() * Math.PI * 2;
    const ped = {
      mesh, x: near.x + Math.cos(a) * 30, z: near.z + Math.sin(a) * 30,
      heading: 0, speed: 3.4, target: null, flee: 0, dead: false, deadT: 0, cop: true, shootT: 1 + Math.random(),
      vy: 0, y: 0, vx: 0, vz: 0,
    };
    this.copPeds.push(ped);
    return ped;
  }

  clearPolice() {
    for (const c of this.cops) { this.scene.remove(c.mesh); c.dead = true; }
    for (const p of this.copPeds) this.scene.remove(p.mesh);
    this.cops = []; this.copPeds = [];
    setWanted(0);
    this.escapeTimer = 0;
  }

  nearestCopDist(p) {
    let d = 1e9;
    for (const c of this.cops) if (!c.dead) d = Math.min(d, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
    for (const c of this.copPeds) if (!c.dead) d = Math.min(d, Math.hypot(c.x - p.x, c.z - p.z));
    return d;
  }

  killPed(ped, impulseX = 0, impulseZ = 0, byPlayer = false) {
    if (ped.dead) return;
    ped.dead = true; ped.deadT = 3;
    ped.vx = impulseX; ped.vz = impulseZ; ped.vy = 4;
    ped.mesh.rotation.x = -Math.PI / 2;
    if (byPlayer && !ped.cop) {
      if (S.wanted < 1) setWanted(1);
    }
    if (ped.cop) {
      // killing cop escalates
      setWanted(Math.max(S.wanted, Math.min(5, S.wanted + 1)));
    }
  }

  update(dt, player, playerVehicle) {
    const pp = playerVehicle ? playerVehicle.pos : player.pos;
    const dirX = playerVehicle ? playerVehicle.vx : 0, dirZ = playerVehicle ? playerVehicle.vz : 0;

    // ---- traffic ----
    for (const v of this.cars) {
      if (v.dead) {
        // recycle after a while
        v.ai.respawn = (v.ai.respawn || 8) - dt;
        if (v.ai.respawn <= 0) {
          v.repair();
          const n = randNode(pp.x, pp.z, 1, dirX, dirZ);
          v.pos.set(n.x, 0, n.z); v.vx = v.vz = 0;
          v.ai.target = this.nextNode(n); v.ai.node = n; v.ai.respawn = null;
        }
        continue;
      }
      const t = v.ai.target;
      const dx = t.x - v.pos.x, dz = t.z - v.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7) {
        v.ai.node = t;
        v.ai.target = this.nextNode(t, { di: t.di || 0, dj: t.dj || 0 });
      }
      const desired = Math.atan2(dx, dz);
      let diff = desired - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      let throttle = 0.75;
      // brake if player car directly ahead
      if (playerVehicle) {
        const pd = Math.hypot(playerVehicle.pos.x - v.pos.x, playerVehicle.pos.z - v.pos.z);
        if (pd < 8) throttle = 0.1;
      }
      if (Math.abs(diff) > 1.2) throttle = 0.3;
      v.update(dt, { throttle, steer, handbrake: false }, this.world, this.fx);
      // recycle far cars
      if (Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) > 130) {
        const n = randNode(pp.x, pp.z, 1, dirX, dirZ);
        v.pos.set(n.x, 0, n.z); v.vx = v.vz = 0;
        v.heading = Math.atan2(pp.x - n.x, pp.z - n.z);
        v.ai.node = n; v.ai.target = this.nextNode(n);
      }
    }

    // ---- pedestrians ----
    const allPeds = [...this.peds, ...this.copPeds];
    for (const ped of allPeds) {
      if (ped.dead) {
        ped.deadT -= dt;
        ped.vy -= 20 * dt;
        ped.y = Math.max(0, ped.y + ped.vy * dt);
        ped.x += ped.vx * dt; ped.z += ped.vz * dt;
        ped.vx *= 0.95; ped.vz *= 0.95;
        ped.mesh.position.set(ped.x, ped.y, ped.z);
        if (ped.deadT <= 0) {
          if (ped.cop) { this.scene.remove(ped.mesh); this.copPeds.splice(this.copPeds.indexOf(ped), 1); }
          else {
            const n = randNode(pp.x, pp.z);
            ped.x = n.x + (Math.random() - 0.5) * 16; ped.z = n.z + (Math.random() - 0.5) * 16;
            ped.dead = false; ped.mesh.rotation.x = 0; ped.y = 0;
            this.pickPedTarget(ped);
          }
        }
        continue;
      }
      if (ped.cop) {
        // chase & shoot
        const dx = pp.x - ped.x, dz = pp.z - ped.z;
        const d = Math.hypot(dx, dz);
        ped.heading = Math.atan2(dx, dz);
        if (d > 12) { ped.x += (dx / d) * ped.speed * dt; ped.z += (dz / d) * ped.speed * dt; }
        ped.shootT -= dt;
        if (ped.shootT <= 0 && d < 34 && S.wanted > 0) {
          ped.shootT = 1.1 + Math.random() * 0.8;
          const from = new THREE.Vector3(ped.x, 1.4, ped.z);
          const to = new THREE.Vector3(pp.x + (Math.random() - 0.5) * 1.5, 1.2, pp.z + (Math.random() - 0.5) * 1.5);
          this.fx.tracer(from, to, 0xff8866);
          sfx.smg();
          if (Math.random() < 0.45) damagePlayer(5 + S.wanted, 'cop');
        }
      } else {
        if (ped.flee > 0) {
          ped.flee -= dt;
          const dx = ped.x - pp.x, dz = ped.z - pp.z;
          const d = Math.hypot(dx, dz) || 1;
          ped.heading = Math.atan2(dx, dz);
          ped.x += (dx / d) * 4.5 * dt; ped.z += (dz / d) * 4.5 * dt;
        } else {
          const t = ped.target;
          const dx = t.x - ped.x, dz = t.z - ped.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.5) this.pickPedTarget(ped);
          else {
            ped.heading = Math.atan2(dx, dz);
            ped.x += (dx / d) * ped.speed * dt; ped.z += (dz / d) * ped.speed * dt;
          }
        }
        // run over by vehicles
        for (const v of allVehicles) {
          if (v.dead || v.speed < 5) continue;
          if (Math.hypot(v.pos.x - ped.x, v.pos.z - ped.z) < v.stats.r + 0.6) {
            this.killPed(ped, v.vx * 0.6, v.vz * 0.6, v.driver === 'player');
            if (v.driver === 'player') sfx.crash();
            break;
          }
        }
      }
      const res = this.world.collideCircle(ped.x, ped.z, 0.4);
      ped.x = res.x; ped.z = res.z;
      ped.mesh.position.set(ped.x, ped.y || 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // walk anim
      ped.mesh.userData.walkPhase += dt * (ped.flee > 0 || ped.cop ? 11 : 6);
      const sw = Math.sin(ped.mesh.userData.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = sw;
      ped.mesh.userData.legR.rotation.x = -sw;
      ped.mesh.userData.armL.rotation.x = -sw * 0.7;
      ped.mesh.userData.armR.rotation.x = sw * 0.7;
      // recycle
      if (!ped.cop && Math.hypot(ped.x - pp.x, ped.z - pp.z) > 120) {
        const n = randNode(pp.x, pp.z);
        ped.x = n.x + (Math.random() - 0.5) * 16; ped.z = n.z + (Math.random() - 0.5) * 16;
        this.pickPedTarget(ped);
      }
    }

    // ---- police cars ----
    const targetCount = S.wanted === 0 ? 0 : Math.min(8, S.wanted * 2);
    const alive = this.cops.filter(c => !c.dead).length;
    if (alive < targetCount && Math.random() < dt * 1.5) this.spawnCop(pp);
    if (S.wanted >= 3 && this.copPeds.length < S.wanted && Math.random() < dt * 0.8) this.spawnCopPed(pp);

    for (const c of this.cops) {
      if (c.dead) continue;
      const dx = pp.x - c.pos.x, dz = pp.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      let diff = desired - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.5));
      const throttle = d > 6 ? 1 : 0.2;
      c.update(dt, { throttle, steer, handbrake: Math.abs(diff) > 1.6 && c.speed > 12 }, this.world, this.fx);
      if (d > 160) {
        const a = Math.random() * Math.PI * 2;
        c.pos.set(pp.x + Math.cos(a) * 70, 0, pp.z + Math.sin(a) * 70);
        c.vx = c.vz = 0;
      }
    }

    // ---- escape logic ----
    if (S.wanted > 0) {
      const nd = this.nearestCopDist(pp);
      if (nd > 48) {
        this.escapeTimer += dt;
        if (this.escapeTimer > 5) {
          this.escapeTimer = 0;
          setWanted(S.wanted - 1);
          if (S.wanted === 0) {
            for (const c of this.cops) { c.dead = true; this.scene.remove(c.mesh); }
            for (const p of this.copPeds) this.scene.remove(p.mesh);
            this.cops = []; this.copPeds = [];
          }
        }
      } else {
        this.escapeTimer = 0;
      }
    }

    // busted check (on foot, cop close)
    if (!playerVehicle && S.wanted > 0 && !S.dead) {
      let close = false;
      for (const p of this.copPeds) if (!p.dead && Math.hypot(p.x - pp.x, p.z - pp.z) < 3) close = true;
      for (const c of this.cops) if (!c.dead && c.speed < 3 && Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z) < 4) close = true;
      if (close) {
        S.bustedTimer += dt;
        if (S.bustedTimer > 1.6) { S.bustedTimer = 0; window.dispatchEvent(new CustomEvent('gtv-busted')); }
      } else S.bustedTimer = Math.max(0, S.bustedTimer - dt * 2);
    }
  }

  scarePeds(x, z, r = 22) {
    for (const p of this.peds) if (!p.dead && Math.hypot(p.x - x, p.z - z) < r) p.flee = 3.5;
  }
}

// pairwise vehicle collisions (impulse chaos)
export function resolveVehicleCollisions(fx) {
  const list = allVehicles.filter(v => !v.dead && v.mesh.visible);
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const A = list[a], B = list[b];
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z;
      const rr = A.stats.r + B.stats.r;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      const overlap = rr - d;
      const total = A.mass + B.mass;
      A.pos.x -= nx * overlap * (B.mass / total);
      A.pos.z -= nz * overlap * (B.mass / total);
      B.pos.x += nx * overlap * (A.mass / total);
      B.pos.z += nz * overlap * (A.mass / total);
      const rvx = B.vx - A.vx, rvz = B.vz - A.vz;
      const rel = rvx * nx + rvz * nz;
      if (rel < 0) {
        const j = -(1.4) * rel / (1 / A.mass + 1 / B.mass);
        A.vx -= j * nx / A.mass; A.vz -= j * nz / A.mass;
        B.vx += j * nx / B.mass; B.vz += j * nz / B.mass;
        const impact = Math.abs(rel);
        if (impact > 7) {
          fx.sparks((A.pos.x + B.pos.x) / 2, 1, (A.pos.z + B.pos.z) / 2, 8);
          A.damage(impact * 0.5, fx, true);
          B.damage(impact * 0.5, fx, true);
          if (A.driver === 'player' || B.driver === 'player') sfx.crash();
        }
      }
    }
  }
}