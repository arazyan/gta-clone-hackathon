// Ch.5 "Ah Shit, Here We Go Again" — BMX cold open, 5-star Rhino chaos, Pay 'n' Spray finale.
import * as THREE from 'three';
import { Chapter } from './base.js';
import { makeBike, makeTank, makeCar, makePed, mat } from '../entities.js';
import { Vehicle } from '../vehicles.js';
import { LOC } from '../world.js';
import { S, setWanted, addCash, say } from '../state.js';
import { hud } from '../hud.js';
import { down } from '../input.js';
import { sfx, setRadio } from '../audio.js';
import { DISPATCH_LINES } from '../darkhumor.js';

export class Ch5 extends Chapter {
  start() {
    const { player, world } = this;
    const al = LOC.alley;
    player.setCharacter('CJ', 0xdddddd, null);
    S.playerColor = '#67c23a';
    player.teleport(al.x, al.z + 14, Math.PI);

    say('CJ', 'Ah shit, here we go again. Worst place in the world... Rollin\' Heights, Los Santos.', 4.5);
    this.after(4.6, () => say('CJ', 'Five years on the East Coast, and the first thing I see is my own damn alley.', 4));

    // BMX at the end of the alley
    this.bmx = this.addVehicle(new Vehicle(makeBike('bmx', 0xcc3333), 'bmx', {
      x: al.x, z: al.z - 12, heading: Math.PI, name: 'BMX',
    }));
    this.bmxMarker = this.marker(al.x, al.z - 12, 0xffd24a, 1.6);
    this.obj('<b>COLD OPEN:</b> walk down the alley to your BMX.', { x: al.x, z: al.z - 12 });

    // tank drop
    this.tank = this.addVehicle(new Vehicle(makeTank(0x5a6b4a), 'tank', {
      x: LOC.tankDrop.x, z: LOC.tankDrop.z, heading: 0, name: 'RHINO',
    }));
    this.ctx.world.psDoor.visible = false; // garage open until the finale

    // barricades on the gauntlet route
    this.barricades = [];
    for (const [x, z] of [[-160, 12], [-130, 12], [-120, 50]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 1.2), mat(0xdd6622));
      b.position.set(x, 0.5, z);
      this.addMesh(b);
      const stripes = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.3, 1.25), mat(0x222222));
      stripes.position.set(x, 0.75, z);
      this.addMesh(stripes);
      this.barricades.push({ x, z, cool: 0 });
    }

    this.listen('gtv-enter-vehicle', e => this.onEnter(e.detail));
    this.step = 0;
  }

  onEnter(v) {
    if (v === this.bmx && this.step === 0) {
      this.step = 1;
      this.scene.remove(this.bmxMarker);
      setWanted(5);
      hud.flash(2);
      sfx.trainHorn();
      say('Dispatch', 'Suspect is riding a bicycle without a bell. Deploy the US Armed Forces.', 4.5);
      this.after(4.6, () => say('Dispatch', DISPATCH_LINES[0], 4));
      hud.notify('⭐⭐⭐⭐⭐ 5-STAR LOCKDOWN — bunny-hop (SPACE) the barricades!', 'cheat');
      const pp = this.playerPos();
      for (let k = 0; k < 3; k++) this.traffic.spawnCop(pp);
      this.tankMarker = this.marker(LOC.tankDrop.x, LOC.tankDrop.z, 0xffd24a, 3);
      this.obj('<b>BMX GAUNTLET:</b> pedal (W) + bunny-hop (SPACE) over barricades. Reach the Rhino drop!', LOC.tankDrop);
    }
    if (v === this.tank && this.step <= 2) {
      this.step = 2;
      S.ammo[2] = { clip: 1, total: 999 }; // Rhino: unlimited cannon shells
      if (this.tankMarker) this.scene.remove(this.tankMarker);
      say('CJ', 'A tank?! In MY neighborhood?! ...Okay, actually this tracks.', 3.5);
      hud.notify('RHINO ONLINE: aim turret BACKWARD (mouse) + LMB = explosive recoil boost!', 'cheat');
      this.after(3.6, () => say('Dispatch', 'Suspect has acquired a Rhino. Upgrade to "extremely concerned". Overtime authorized.', 4));
      // army response
      this.armyTanks = [];
      for (const [x, z] of [[-60, 130], [-180, 130]]) {
        const t = this.addVehicle(new Vehicle(makeTank(0x4a5a3a), 'tank', { x, z, name: 'ARMY RHINO' }));
        t.driver = 'ai';
        t.fireT = 2 + Math.random() * 2;
        this.armyTanks.push(t);
      }
      this.shells = [];
      // searchlight cone
      this.lightCone = new THREE.Mesh(
        new THREE.ConeGeometry(6, 30, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
      );
      this.addMesh(this.lightCone);
      this.psMarker = this.marker(LOC.paynspray.x, LOC.paynspray.z + 2, 0x67e05a, 3);
      this.obj('<b>SURVIVE THE 5-STAR GAUNTLET</b> — then smash into PAY \'N\' SPRAY. Hood fire = 4 seconds to bail!', LOC.paynspray);
    }
  }

  update(dt) {
    const { player, fx, rig, world } = this;
    const pp = this.playerPos();
    const v = player.vehicle;

    // BMX bunny hop
    if (v === this.bmx && down('Space') && v.y <= 0.01) {
      v.vy = 7.5; sfx.bounce();
    }
    // barricade hits
    if (v && (v === this.bmx || v.kind === 'tank')) {
      for (const b of this.barricades) {
        b.cool -= dt;
        if (b.cool <= 0 && Math.hypot(pp.x - b.x, pp.z - b.z) < 3 && v.y < 0.8 && v.speed > 3) {
          b.cool = 1.5;
          v.damage(v === this.bmx ? 30 : 8, fx);
          v.vx *= 0.4; v.vz *= 0.4;
          fx.sparks(b.x, 1, b.z, 14);
          sfx.crash();
          rig.addShake(0.5);
          if (v === this.bmx) say('CJ', 'Spike strips! Who spikes a BICYCLE?!', 2.5);
        }
      }
    }

    // army tanks AI + shells
    if (this.armyTanks) {
      for (const t of this.armyTanks) {
        if (t.dead) continue;
        const dx = pp.x - t.pos.x, dz = pp.z - t.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        const desired = Math.atan2(dx, dz);
        let diff = desired - t.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        t.update(dt, { throttle: d > 25 ? 0.7 : 0.1, steer: Math.max(-1, Math.min(1, diff * 2)), handbrake: false }, world, fx);
        t.turretAngle = desired - t.heading;
        t.fireT -= dt;
        if (t.fireT <= 0 && d < 95) {
          t.fireT = 3.2 + Math.random() * 1.5;
          const sx = t.pos.x + Math.sin(desired) * 5, sz = t.pos.z + Math.cos(desired) * 5;
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), new THREE.MeshBasicMaterial({ color: 0x333333 }));
          mesh.position.set(sx, 1.8, sz);
          this.scene.add(mesh);
          this.shells.push({ mesh, x: sx, z: sz, vx: (dx / d) * 42, vz: (dz / d) * 42, life: 2.6 });
          sfx.explosion();
          fx.burst(sx, 1.8, sz, 10, 6, 0.3, 0xffaa44, 2);
        }
      }
      for (let k = this.shells.length - 1; k >= 0; k--) {
        const s = this.shells[k];
        s.life -= dt;
        s.x += s.vx * dt; s.z += s.vz * dt;
        s.mesh.position.set(s.x, 1.8, s.z);
        let boom = s.life <= 0;
        if (v && Math.hypot(v.pos.x - s.x, v.pos.z - s.z) < v.stats.r + 1) boom = true;
        if (world.collideCircle(s.x, s.z, 0.3).hit) boom = true;
        if (boom) {
          this.scene.remove(s.mesh);
          this.shells.splice(k, 1);
          fx.explosion(s.x, 0.5, s.z);
          sfx.explosion();
          window.dispatchEvent(new CustomEvent('gtv-explosion', { detail: { x: s.x, z: s.z, r: 8, dmg: 35 } }));
        }
      }
      // searchlight follows
      if (this.lightCone) {
        const t = performance.now() * 0.001;
        this.lightCone.position.set(pp.x + Math.sin(t) * 8, 15, pp.z + Math.cos(t * 0.7) * 8);
        this.lightCone.rotation.x = Math.PI;
      }
    }

    // Pay 'n' Spray trigger
    if (this.step === 2 && v && !v.dead && this.near(pp, LOC.paynspray.x, LOC.paynspray.z + 1, 6)) {
      this.respray(v);
    }
  }

  respray(v) {
    this.step = 3;
    const { fx, rig, world } = this;
    const ps = LOC.paynspray;
    this.obj(null);
    if (this.psMarker) this.scene.remove(this.psMarker);
    // roll inside
    v.pos.set(ps.x, 0, ps.z - 6);
    v.vx = v.vz = 0; v.heading = Math.PI;
    v.fireTimer = -1;
    world.psDoor.visible = true;
    sfx.doorSlam();
    S.timeScale = 0.6;
    say('CJ', 'Please let this work. Please let this work—', 2);
    this.after(0.7, () => {
      sfx.spray();
      hud.notify('PSSSHHH-PSSSHHH 🎨', 'cheat');
      this.after(1.6, () => {
        // HOT NEON PINK
        const body = v.mesh.children[0];
        body.material = body.material.clone();
        body.material.color.set(0xff4ad8);
        if (v.mesh.userData.turret) {
          v.mesh.userData.turret.children.forEach(c => {
            c.material = c.material.clone(); c.material.color.set(0xff4ad8);
          });
        }
        v.hp = 100; v.color = 0xff4ad8;
        world.psDoor.visible = false;
        sfx.doorSlam();
        v.applyImpulse(0, 90000);
        S.timeScale = 1;
        // stars blink & vanish
        setWanted(0);
        this.traffic.clearPolice();
        if (this.armyTanks) for (const t of this.armyTanks) { t.dead = true; this.scene.remove(t.mesh); }
        hud.flash(2);
        this.after(0.8, () => say('General', 'Wait... where did the gray tank go?', 3));
        this.after(3.9, () => say('Cop', 'Must have been the wind.', 2.8));
        this.after(6.8, () => say('General', 'This one is neon pink. Clearly an innocent civilian. Move along!', 3.5));
        this.after(10.4, () => {
          this.pass({
            sub: 'The Army was fooled by hot pink paint. Institutions: exposed. Vibe: immaculate.',
            respect: 9999,
            cash: 50000,
            medals: [
              'Ah Shit, Here We Go Again — said the line',
              'Turret-Boost Speedrun — physics is a suggestion',
              'Neon Pink Civilian — must have been the wind',
            ],
            btn: 'ENTER FREE ROAM →',
            cb: () => window.dispatchEvent(new CustomEvent('gtv-next-chapter', { detail: 0 })),
          });
        });
      });
    });
  }

  respawn() {
    const { player } = this;
    const al = LOC.alley;
    if (this.step >= 2) {
      this.tank.repair();
      this.tank.pos.set(LOC.tankDrop.x, 0, LOC.tankDrop.z);
      this.tank.heading = 0; this.tank.vx = this.tank.vz = 0;
      player.enterVehicle(this.tank);
      this.step = 2;
      this.obj('<b>SURVIVE & RESPRAY</b> — Pay \'n\' Spray saves lives (and wanted levels).', LOC.paynspray);
    } else if (this.step === 1) {
      this.bmx.repair();
      this.bmx.pos.set(al.x, 0, al.z - 14);
      this.bmx.heading = Math.PI; this.bmx.vx = this.bmx.vz = 0;
      player.enterVehicle(this.bmx);
    } else {
      player.teleport(al.x, al.z + 14, Math.PI);
    }
  }
}