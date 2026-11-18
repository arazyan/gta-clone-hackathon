// Arcade vehicle controller: weighted drift physics, damage, fire timer.
import * as THREE from 'three';
import { S } from './state.js';
import { sfx } from './audio.js';

export const VEHICLE_STATS = {
  sedan:   { maxSpeed: 27, accel: 14, grip: 7.5, steer: 2.1, mass: 1200, r: 1.5 },
  sport:   { maxSpeed: 38, accel: 22, grip: 8.5, steer: 2.4, mass: 1100, r: 1.5 },
  police:  { maxSpeed: 33, accel: 18, grip: 8.0, steer: 2.3, mass: 1400, r: 1.5 },
  suv:     { maxSpeed: 28, accel: 13, grip: 7.0, steer: 1.9, mass: 2000, r: 1.7 },
  lowrider:{ maxSpeed: 24, accel: 12, grip: 6.5, steer: 2.0, mass: 1500, r: 1.5 },
  taxi:    { maxSpeed: 26, accel: 13, grip: 7.5, steer: 2.1, mass: 1300, r: 1.5 },
  tank:    { maxSpeed: 15, accel: 10, grip: 12,  steer: 1.4, mass: 28000, r: 2.4 },
  bmx:     { maxSpeed: 12, accel: 9,  grip: 9,   steer: 2.6, mass: 90, r: 0.6 },
  sanchez: { maxSpeed: 28, accel: 16, grip: 8.5, steer: 2.5, mass: 200, r: 0.7 },
};

let VID = 0;
export const allVehicles = [];
export class Vehicle {
  constructor(mesh, kind, opts = {}) {
    this.id = ++VID;
    allVehicles.push(this);
    this.mesh = mesh;
    this.kind = kind;
    this.stats = { ...VEHICLE_STATS[kind] || VEHICLE_STATS.sedan, ...opts.stats };
    this.heading = opts.heading || 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.y = 0;
    this.hp = 100;
    this.fireTimer = -1;
    this.dead = false;
    this.driver = null;          // 'player' | 'ai' | null
    this.mass = opts.mass || this.stats.mass;
    this.color = opts.color || 0x8899aa;
    this.ai = null;              // AI state obj
    this.turretAngle = 0;        // tank
    this.noBrakes = false;
    this.speedBoost = 1;
    this.gripMul = 1;
    this.bags = 0;               // ch3 cluckin bags
    this.bounceT = 0;
    this.name = opts.name || kind.toUpperCase();
    mesh.position.set(opts.x || 0, 0, opts.z || 0);
    mesh.rotation.y = this.heading;
    this.syncMesh();
  }

  get pos() { return this.mesh.position; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get forwardSpeed() {
    return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  applyImpulse(ix, iz) { this.vx += ix / this.mass; this.vz += iz / this.mass; }

  damage(n, fx, silent = false) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 15 && this.fireTimer < 0 && this.kind !== 'bmx' && this.kind !== 'sanchez') {
      this.fireTimer = 4.0;
      if (this.driver === 'player') {
        // hud warning handled via event
        window.dispatchEvent(new CustomEvent('gtv-hoodfire'));
      }
    }
    if (this.hp <= 0) this.explode(fx);
    else if (!silent && n > 8 && this.driver === 'player') sfx.crash();
  }

  explode(fx) {
    if (this.dead) return;
    this.dead = true;
    const p = this.pos;
    fx.explosion(p.x, p.y, p.z, this.kind === 'tank');
    sfx.bigExplosion();
    this.mesh.visible = false;
    window.dispatchEvent(new CustomEvent('gtv-vehicle-exploded', { detail: this }));
    // area damage
    window.dispatchEvent(new CustomEvent('gtv-explosion', { detail: { x: p.x, z: p.z, r: this.kind === 'tank' ? 14 : 9, dmg: 80, src: this } }));
  }

  repair() {
    this.hp = 100; this.fireTimer = -1;
    this.mesh.visible = true; this.dead = false;
  }

  update(dt, input, world, fx) {
    if (this.dead) return;
    const st = this.stats;
    const f = this.forward();
    const l = { x: f.z, z: -f.x };
    let vf = this.vx * f.x + this.vz * f.z;
    let vl = this.vx * l.x + this.vz * l.z;

    const maxS = st.maxSpeed * this.speedBoost;
    let throttle = input.throttle;
    if (this.noBrakes && throttle < 0) throttle = 0;

    if (throttle > 0) vf += st.accel * throttle * dt;
    else if (throttle < 0) {
      if (vf > 1) vf -= st.accel * 1.6 * dt;         // brake
      else vf -= st.accel * 0.6 * dt;                 // reverse
    }
    // drag + rolling resistance
    vf -= vf * 0.35 * dt;
    if (Math.abs(throttle) < 0.01) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);
    vf = Math.max(-maxS * 0.35, Math.min(maxS, vf));

    // lateral grip (drift!)
    let grip = st.grip * this.gripMul;
    if (input.handbrake && this.kind !== 'tank' && this.kind !== 'bmx') grip = 1.1;
    if (S.focusActive) grip *= 1.6;
    vl *= Math.exp(-grip * dt);

    // steering
    const speedFactor = Math.max(-1, Math.min(1, vf / 7));
    let steerRate = st.steer * (input.handbrake ? 1.5 : 1);
    if (S.focusActive) steerRate *= 1.25;
    this.heading += input.steer * steerRate * speedFactor * dt;

    const nf = this.forward();
    const nl = { x: nf.z, z: -nf.x };
    this.vx = nf.x * vf + nl.x * vl;
    this.vz = nf.z * vf + nl.z * vl;

    // vertical
    const grav = performance.now() < S.cheats.lowGravUntil ? 3.5 : 22;
    this.vy -= grav * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; }

    let nx = this.pos.x + this.vx * dt;
    let nz = this.pos.z + this.vz * dt;

    // world collision
    const res = world.collideCircle(nx, nz, st.r);
    if (res.hit) {
      const impact = this.speed;
      nx = res.x; nz = res.z;
      if (impact > 6) {
        this.damage(impact * 0.9, fx);
        fx.sparks(nx, 1, nz, 10);
        if (this.driver === 'player') {
          sfx.crash();
          window.dispatchEvent(new CustomEvent('gtv-crash', { detail: impact }));
        }
        // bounce
        this.vx *= -0.25; this.vz *= -0.25;
        // hydrant check
        for (const h of world.hydrants) {
          if (h.alive && Math.hypot(h.x - nx, h.z - nz) < 2.2) {
            world.destroyHydrant(h.idx, fx);
          }
        }
        if (res.hit.tag === 'glass') {
          window.dispatchEvent(new CustomEvent('gtv-glass-hit', { detail: this }));
        }
        if (res.hit.tag === 'barrier') {
          window.dispatchEvent(new CustomEvent('gtv-barrier-hit', { detail: this }));
        }
      } else {
        this.vx *= 0.5; this.vz *= 0.5;
      }
    }

    this.pos.x = nx; this.pos.z = nz; this.pos.y = this.y + (this.bounceT > 0 ? Math.sin(this.bounceT * 14) * 0.35 : 0);
    if (this.bounceT > 0) this.bounceT -= dt;

    // fire timer
    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
      fx.fire(this.pos.x + f.x * 1.5, this.pos.y + 1, this.pos.z + f.z * 1.5);
      fx.smoke(this.pos.x, this.pos.y + 1.4, this.pos.z);
      if (this.fireTimer <= 0) this.explode(fx);
    } else if (this.hp < 35 && Math.random() < 0.3) {
      fx.smoke(this.pos.x + f.x * 1.5, this.pos.y + 1, this.pos.z + f.z * 1.5);
    }

    this.syncMesh();
  }

  syncMesh() {
    this.mesh.rotation.y = this.heading;
    const ud = this.mesh.userData;
    if (ud.wheels) {
      const spin = this.forwardSpeed * 0.12;
      for (const w of ud.wheels) w.rotation.x += spin;
    }
    if (this.kind === 'bmx' || this.kind === 'sanchez') {
      this.mesh.rotation.z = THREE.MathUtils.clamp(-(this.vx * Math.cos(this.heading) - this.vz * Math.sin(this.heading)) * 0.02, -0.4, 0.4);
    }
    if (ud.turret) ud.turret.rotation.y = this.turretAngle;
    // lowrider sag with bags (ch3)
    if (this.bags > 0) {
      this.mesh.rotation.z = -this.bags * 0.012;
      this.mesh.position.y = this.y - this.bags * 0.02 + (this.bounceT > 0 ? Math.sin(this.bounceT * 14) * 0.35 : 0);
    }
    // police lightbar flash
    if (ud.lightbar) {
      const t = Math.floor(performance.now() / 250) % 2;
      ud.lightbar[0].material.emissiveIntensity = t ? 2 : 0.3;
      ud.lightbar[1].material.emissiveIntensity = t ? 0.3 : 2;
    }
  }
}