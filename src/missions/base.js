// Chapter base class + mission manager.
import * as THREE from 'three';
import { makeMarker } from '../entities.js';
import { allVehicles } from '../vehicles.js';
import { S, setWanted, addCash } from '../state.js';
import { hud } from '../hud.js';
import { setRadio } from '../audio.js';

export class Chapter {
  constructor(ctx) {
    this.ctx = ctx;
    this.timers = [];
    this.markers = [];
    this.meshes = [];
    this.vehicles = [];
    this.listeners = [];
    this.step = 0;
    this.done = false;
  }
  get scene() { return this.ctx.scene; }
  get world() { return this.ctx.world; }
  get player() { return this.ctx.player; }
  get traffic() { return this.ctx.traffic; }
  get fx() { return this.ctx.fx; }
  get rig() { return this.ctx.rig; }

  after(t, fn) { this.timers.push({ t, fn }); }
  listen(ev, fn) { window.addEventListener(ev, fn); this.listeners.push([ev, fn]); }
  marker(x, z, color = 0xffd24a, r = 2.4) {
    const m = makeMarker(color, r);
    m.position.set(x, 0, z);
    this.scene.add(m);
    this.markers.push(m);
    return m;
  }
  addMesh(m) { this.scene.add(m); this.meshes.push(m); return m; }
  addVehicle(v) {
    if (!v.mesh.parent) this.scene.add(v.mesh);
    this.vehicles.push(v);
    return v;
  }
  obj(text, target = null) { hud.setObjective(text, target); }
  prompt(t) { hud.prompt(t); }

  tickTimers(dt) {
    for (let k = this.timers.length - 1; k >= 0; k--) {
      const t = this.timers[k];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(k, 1); t.fn(); }
    }
    // pulse markers
    for (const m of this.markers) {
      const s = 1 + Math.sin(performance.now() * 0.004) * 0.08;
      m.userData.cyl.scale.set(s, 1, s);
      m.userData.ring.rotation.z += dt * 1.5;
    }
  }

  near(p, x, z, r) { return Math.hypot(p.x - x, p.z - z) < r; }
  playerPos() { return this.player.vehicle ? this.player.vehicle.pos : this.player.pos; }

  pass(opts) {
    this.done = true;
    hud.passed(opts);
  }

  cleanup() {
    for (const [ev, fn] of this.listeners) window.removeEventListener(ev, fn);
    for (const m of this.markers) this.scene.remove(m);
    for (const m of this.meshes) this.scene.remove(m);
    for (const v of this.vehicles) {
      v.dead = true;
      this.scene.remove(v.mesh);
      const i = allVehicles.indexOf(v);
      if (i >= 0) allVehicles.splice(i, 1);
    }
    hud.setObjective(null);
    hud.prompt(null);
    hud.specialBar(null);
    hud.hidePhone();
    hud.allies = [];
    document.getElementById('order-game').classList.add('hidden');
    this.timers = [];
  }

  respawn() {}
}

export class MissionManager {
  constructor(ctx, chapters) {
    this.ctx = ctx;
    this.chapters = chapters; // {1: class, ...}
    this.current = null;
    this.chNum = 0;
  }

  start(ch) {
    if (this.current) this.current.cleanup();
    this.chNum = ch;
    S.chapter = ch;
    S.step = 0;
    S.health = 100; S.armor = 0; S.ability = 100;
    S.dead = false; S.timeScale = 1; S.focusActive = false;
    S.bustedTimer = 0;
    S.waypoint = null;
    setWanted(0);
    this.ctx.traffic.clearPolice();
    this.ctx.world.setSnow(ch === 1);
    this.ctx.fx.setSnow(ch === 1, this.ctx.player.pos);
    // detach player from any vehicle
    if (this.ctx.player.vehicle) {
      const v = this.ctx.player.vehicle;
      v.driver = null;
      this.ctx.player.vehicle = null;
      this.ctx.player.leaveSeat(v);
    }
    setRadio(-1);
    S.radio = -1;
    if (ch === 0) {
      this.current = null;
      hud.notify('FREE ROAM — the city is yours. Type HESOYAM. Press V for sky-cam.');
      hud.setObjective(null);
    } else {
      this.current = new this.chapters[ch](this.ctx);
      this.current.start();
    }
  }

  update(dt) {
    if (this.current && !this.current.done) {
      this.current.tickTimers(dt);
      this.current.update(dt);
    }
  }

  respawn() {
    const p = this.ctx.player;
    S.health = 100; S.armor = 0;
    S.dead = false;
    setWanted(0);
    this.ctx.traffic.clearPolice();
    addCash(-100);
    if (this.current && !this.current.done) this.current.respawn();
    else {
      p.teleport(0, 0, 0);
    }
  }
}