// Player: on-foot controller, carjacking loop, hitscan shooting, tank cannon.
import * as THREE from 'three';
import { makePed } from './entities.js';
import { S, WEAPONS, damagePlayer, setWanted, say } from './state.js';
import { down, mouse } from './input.js';
import { sfx } from './audio.js';
import { allVehicles } from './vehicles.js';

const _v = new THREE.Vector3();
// player model offset in vehicle-local space (front is +z, left is +x)
const SEAT_CAR = new THREE.Vector3(0.42, 0.05, -0.15);
const SEAT_BIKE = new THREE.Vector3(0, 0.38, -0.3);
export class Player {
  constructor(scene, world, fx, traffic) {
    this.scene = scene; this.world = world; this.fx = fx; this.traffic = traffic;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.vehicle = null;
    this.mesh = makePed(0x3a6a3a, { cap: 0x224422 });
    scene.add(this.mesh);
    this.fireCooldown = 0;
    this.aiming = false;
    this.projectiles = [];
    this.walkPhase = 0;
    this.aimPoint = new THREE.Vector3();
    this.enterCooldown = 0;
  }

  setCharacter(name, shirt, cap) {
    S.playerName = name;
    this.scene.remove(this.mesh);
    this.mesh = makePed(shirt, { cap, mask: name === 'MICHAEL' || name === 'TREVOR' });
    this.scene.add(this.mesh);
    this.mesh.visible = true;
    if (this.vehicle) this.syncSeat();
  }

  teleport(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    if (this.vehicle) {
      this.vehicle.pos.set(x, 0, z);
      this.vehicle.heading = heading;
      this.vehicle.vx = this.vehicle.vz = 0;
    }
  }

  nearestVehicle(maxDist = 3.8) {
    let best = null, bd = maxDist;
    for (const v of allVehicles) {
      if (v.dead || !v.mesh.visible || v === this.vehicle) continue;
      const d = Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z);
      if (d < bd + v.stats.r) { bd = d; best = v; }
    }
    return best;
  }

  enterVehicle(v) {
    if (!v || v.dead) return;
    if (v.driver === 'ai') {
      // carjack! eject driver
      const ped = this.traffic.spawnPed({ x: v.pos.x, z: v.pos.z });
      ped.x = v.pos.x + Math.cos(v.heading) * 2; ped.z = v.pos.z - Math.sin(v.heading) * 2;
      ped.flee = 5;
      if (v.kind === 'police') setWanted(Math.max(S.wanted, 2));
      else if (S.wanted < 1 && Math.random() < 0.5) setWanted(1);
      this.traffic.scarePeds(v.pos.x, v.pos.z);
    }
    if (this.vehicle && this.vehicle !== v) this.setCabGlass(this.vehicle, false);
    v.driver = 'player';
    v.ai = null;
    this.vehicle = v;
    this.setCabGlass(v, true);
    this.syncSeat();
    sfx.pickup();
    window.dispatchEvent(new CustomEvent('gtv-enter-vehicle', { detail: v }));
  }

  exitVehicle() {
    const v = this.vehicle;
    if (!v) return;
    const f = v.forward();
    const side = { x: f.z, z: -f.x };
    this.pos.set(v.pos.x + side.x * 2.2, 0, v.pos.z + side.z * 2.2);
    const res = this.world.collideCircle(this.pos.x, this.pos.z, 0.5);
    this.pos.x = res.x; this.pos.z = res.z;
    this.heading = v.heading;
    if (v.speed > 12) {
      damagePlayer(8, 'dive');
      this.pos.x += side.x * 2; this.pos.z += side.z * 2;
    }
    v.driver = null;
    this.vehicle = null;
    this.leaveSeat(v);
    window.dispatchEvent(new CustomEvent('gtv-exit-vehicle', { detail: v }));
  }

  // Make the cabin see-through while the player drives, so the driver is visible.
  setCabGlass(v, on) {
    const roof = v.mesh.userData.roof;
    if (!roof) return;
    if (on) {
      if (!roof.userData.origMat) {
        roof.userData.origMat = roof.material;
        roof.material = roof.material.clone();
        roof.material.opacity = 0.3;
      }
    } else if (roof.userData.origMat) {
      roof.material.dispose();
      roof.material = roof.userData.origMat;
      roof.userData.origMat = null;
    }
  }

  // Seat the player model on/in the current vehicle (call after vehicle.update).
  syncSeat() {
    const v = this.vehicle;
    if (!v) return;
    const m = this.mesh, ud = m.userData;
    const bike = v.kind === 'bmx' || v.kind === 'sanchez';
    m.visible = v.kind !== 'tank' && !v.dead;
    const off = bike ? SEAT_BIKE : SEAT_CAR;
    m.scale.setScalar(bike ? 1 : 0.85);
    m.position.copy(off).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
    m.quaternion.copy(v.mesh.quaternion);
    if (bike) {
      // pedalling legs, hands on the bars
      this.walkPhase += v.forwardSpeed * 0.02;
      const p = Math.sin(this.walkPhase * 6) * 0.45;
      ud.legL.rotation.x = -0.9 + p; ud.legR.rotation.x = -0.9 - p;
      ud.armL.rotation.x = ud.armR.rotation.x = -1.0;
    } else {
      ud.legL.rotation.x = ud.legR.rotation.x = -1.4;
      ud.armL.rotation.x = ud.armR.rotation.x = -1.1;
    }
  }

  leaveSeat(v) {
    if (v) this.setCabGlass(v, false);
    const m = this.mesh, ud = m.userData;
    m.visible = true;
    m.scale.setScalar(1);
    m.rotation.set(0, this.heading, 0);
    m.position.set(this.pos.x, 0, this.pos.z);
    ud.legL.rotation.x = ud.legR.rotation.x = ud.armL.rotation.x = ud.armR.rotation.x = 0;
  }

  // aim point from camera ray onto plane y=1.2
  updateAim(camera) {
    _v.set(mouse.ndcX, mouse.ndcY, 0.5).unproject(camera);
    const dir = _v.sub(camera.position).normalize();
    const t = (1.2 - camera.position.y) / (dir.y || -0.001);
    if (t > 0 && t < 500) this.aimPoint.copy(camera.position).addScaledVector(dir, t);
    else this.aimPoint.set(this.pos.x + Math.sin(this.heading) * 20, 1.2, this.pos.z + Math.cos(this.heading) * 20);
  }

  shoot() {
    const w = WEAPONS[S.weapon];
    if (this.fireCooldown > 0) return;
    const ammo = S.ammo[S.weapon];
    if (ammo.clip <= 0) {
      if (ammo.total > 0) {
        const take = Math.min(w.name === 'RPG' ? 1 : 30, ammo.total);
        ammo.clip = take; ammo.total -= take;
        sfx.uiBeep();
      }
      return;
    }
    this.fireCooldown = w.rate;
    ammo.clip--;

    const origin = this.vehicle
      ? new THREE.Vector3(this.vehicle.pos.x, this.vehicle.pos.y + 1.3, this.vehicle.pos.z)
      : new THREE.Vector3(this.pos.x, 1.4, this.pos.z);

    let dirX, dirZ;
    if (this.vehicle && this.vehicle.kind === 'tank') {
      const aimH = Math.atan2(this.aimPoint.x - origin.x, this.aimPoint.z - origin.z);
      this.vehicle.turretAngle = aimH - this.vehicle.heading;
      dirX = Math.sin(aimH); dirZ = Math.cos(aimH);
      // turret recoil boost!
      const recoil = 300000;
      this.vehicle.applyImpulse(-dirX * recoil, -dirZ * recoil);
      sfx.bigExplosion();
      this.fx.burst(origin.x + dirX * 5, 1.5, origin.z + dirZ * 5, 20, 10, 0.4, 0xffaa44, 3);
      this.spawnProjectile(origin.x + dirX * 5, 1.5, origin.z + dirZ * 5, dirX * 60, dirZ * 60, 200, 12);
      window.dispatchEvent(new CustomEvent('gtv-tank-fired'));
      return;
    }
    if (this.vehicle) {
      const f = this.vehicle.forward();
      dirX = f.x; dirZ = f.z;
    } else {
      const dx = this.aimPoint.x - origin.x, dz = this.aimPoint.z - origin.z;
      const d = Math.hypot(dx, dz) || 1;
      dirX = dx / d; dirZ = dz / d;
      this.heading = Math.atan2(dirX, dirZ);
    }

    if (w.explosive) {
      sfx.gunshot();
      this.spawnProjectile(origin.x + dirX * 1.5, 1.4, origin.z + dirZ * 1.5, dirX * 45, dirZ * 45, w.dmg, 10);
      return;
    }

    w.name === 'MICRO SMG' ? sfx.smg() : sfx.gunshot();
    this.fx.muzzle(origin.x + dirX * 0.8, 1.4, origin.z + dirZ * 0.8);
    this.traffic.scarePeds(origin.x, origin.z, 25);

    // hitscan
    const hit = this.hitscan(origin.x, origin.z, dirX, dirZ, w.range);
    const end = hit
      ? new THREE.Vector3(hit.x, hit.y || 1.2, hit.z)
      : new THREE.Vector3(origin.x + dirX * w.range, 1.3, origin.z + dirZ * w.range);
    this.fx.tracer(origin, end);
    if (hit) {
      this.fx.sparks(hit.x, hit.y || 1.2, hit.z, 5);
      if (hit.ped) this.traffic.killPed(hit.ped, dirX * 4, dirZ * 4, true);
      if (hit.vehicle) {
        hit.vehicle.damage(w.dmg, this.fx);
        if (hit.vehicle.driver === 'ai' && hit.vehicle.kind === 'police') setWanted(Math.max(S.wanted, 2));
      }
    }
    if (S.wanted === 0 && !this.vehicle) {
      // firing a gun in public gets attention
      if (Math.random() < 0.35) setWanted(1);
    }
  }

  hitscan(ox, oz, dx, dz, range) {
    let best = null, bestT = range;
    const test = (px, pz, r, obj, y) => {
      const rx = px - ox, rz = pz - oz;
      const t = rx * dx + rz * dz;
      if (t < 0 || t > bestT) return;
      const perp = Math.abs(rx * dz - rz * dx);
      if (perp < r) { bestT = t; best = { x: ox + dx * t, z: oz + dz * t, y, ...obj }; }
    };
    for (const p of this.traffic.peds) if (!p.dead) test(p.x, p.z, 0.6, { ped: p }, 1.2);
    for (const p of this.traffic.copPeds) if (!p.dead) test(p.x, p.z, 0.6, { ped: p }, 1.2);
    for (const v of allVehicles) {
      if (v.dead || v === this.vehicle || !v.mesh.visible) continue;
      test(v.pos.x, v.pos.z, v.stats.r, { vehicle: v }, 1.2);
    }
    // buildings block
    for (const c of this.world.nearbyColliders(ox + dx * bestT * 0.5, oz + dz * bestT * 0.5)) {
      // ray vs AABB (2D slab)
      let tmin = 0, tmax = bestT;
      for (const [o, d, mn, mx] of [[ox, dx, c.minX, c.maxX], [oz, dz, c.minZ, c.maxZ]]) {
        if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) { tmin = 1e9; break; } }
        else {
          let t1 = (mn - o) / d, t2 = (mx - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) break;
        }
      }
      if (tmin < bestT && tmin > 0 && tmin <= tmax) {
        bestT = tmin; best = { x: ox + dx * tmin, z: oz + dz * tmin, y: 1.3, wall: true };
      }
    }
    return best;
  }

  spawnProjectile(x, y, z, vx, vz, dmg, r) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, x, y, z, vx, vz, dmg, r, life: 3 });
  }

  updateProjectiles(dt) {
    for (let k = this.projectiles.length - 1; k >= 0; k--) {
      const p = this.projectiles[k];
      p.life -= dt;
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      this.fx.smoke(p.x, p.y, p.z, false);
      let boom = p.life <= 0;
      // hit vehicles / peds / walls
      for (const v of allVehicles) {
        if (v.dead || v === this.vehicle) continue;
        if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < v.stats.r + 0.5) { boom = true; break; }
      }
      const res = this.world.collideCircle(p.x, p.z, 0.3);
      if (res.hit) boom = true;
      if (boom) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(k, 1);
        this.fx.explosion(p.x, 0.5, p.z);
        sfx.explosion();
        window.dispatchEvent(new CustomEvent('gtv-explosion', { detail: { x: p.x, z: p.z, r: p.r, dmg: p.dmg } }));
      }
    }
  }

  update(dt, camera, allowInput = true) {
    this.fireCooldown -= dt;
    this.enterCooldown -= dt;
    this.updateAim(camera);
    this.aiming = mouse.rmb && !this.vehicle;

    if (allowInput) {
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (down(k)) S.weapon = i; });
    }

    if (allowInput && down('KeyF') && this.enterCooldown <= 0) {
      this.enterCooldown = 0.4;
      if (this.vehicle) this.exitVehicle();
      else this.enterVehicle(this.nearestVehicle());
    }

    if (this.vehicle) {
      const v = this.vehicle;
      this.pos.copy(v.pos);
      // drive-by / tank fire
      if (mouse.lmb) {
        if (v.kind === 'tank') { if (this.fireCooldown <= 0) this.shoot(); }
        else this.shoot();
      }
      // horn
      if (down('KeyE') && this.enterCooldown <= -0.2) {
        // handled via event for ch3; play sound with cooldown
        if (!this._hornT || performance.now() - this._hornT > 600) {
          this._hornT = performance.now();
          sfx.horn();
          this.traffic.scarePeds(v.pos.x, v.pos.z, 15);
          window.dispatchEvent(new CustomEvent('gtv-horn'));
        }
      }
      // hydraulics bounce (lowrider)
      if (down('Space') && v.kind === 'lowrider' && v.speed < 6 && v.bounceT <= 0) {
        v.bounceT = 0.45; sfx.bounce();
      }
      return;
    }

    // on foot: camera-relative movement
    let mx = 0, mz = 0;
    if (allowInput) {
      if (down('KeyW') || down('ArrowUp')) mz += 1;
      if (down('KeyS') || down('ArrowDown')) mz -= 1;
      if (down('KeyA') || down('ArrowLeft')) mx -= 1;
      if (down('KeyD') || down('ArrowRight')) mx += 1;
    }
    const camYaw = Math.atan2(this.pos.x - camera.position.x, this.pos.z - camera.position.z);
    const speed = this.aiming ? 2.2 : (down('ShiftLeft') || down('ShiftRight') ? 7.5 : 4.5);
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = (-mx * cos + mz * sin) / len;
      const wz = (mx * sin + mz * cos) / len;
      this.pos.x += wx * speed * dt;
      this.pos.z += wz * speed * dt;
      if (!this.aiming) this.heading = Math.atan2(wx, wz);
      this.walkPhase += dt * speed * 1.8;
    }
    if (this.aiming) {
      this.heading = Math.atan2(this.aimPoint.x - this.pos.x, this.aimPoint.z - this.pos.z);
    }
    const res = this.world.collideCircle(this.pos.x, this.pos.z, 0.5);
    this.pos.x = res.x; this.pos.z = res.z;

    if (allowInput && mouse.lmb) this.shoot();

    // mesh
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const sw = (mx || mz) ? Math.sin(this.walkPhase) * 0.55 : 0;
    const ud = this.mesh.userData;
    ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
    ud.armL.rotation.x = this.aiming ? -1.4 : -sw * 0.7;
    ud.armR.rotation.x = this.aiming ? -1.4 : sw * 0.7;
  }
}