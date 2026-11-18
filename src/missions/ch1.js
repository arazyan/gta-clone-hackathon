// Ch.1 "Cold Open & Frozen Aliens" — GTA V Prologue, North Yankton.
import * as THREE from 'three';
import { Chapter } from './base.js';
import { makeCar, makePed, makeAlien } from '../entities.js';
import { Vehicle } from '../vehicles.js';
import { LOC } from '../world.js';
import { S, addCash, setWanted, say, damagePlayer } from '../state.js';
import { hud } from '../hud.js';
import { down } from '../input.js';
import { sfx } from '../audio.js';

export class Ch1 extends Chapter {
  start() {
    const { world, player, traffic } = this;
    const bk = LOC.bank;
    this.player.setCharacter('MICHAEL', 0x2a2a3a, 0x1a1a2a);
    player.teleport(bk.x, bk.z + 12, Math.PI);
    S.playerColor = '#5a9adf';

    say('Narrator', 'NORTH YANKTON. 2004. A bank, a plan, and three men who should not be left alone.', 4.5);
    this.after(4.6, () => say('Michael', 'Alright. Nobody be a hero. Heroes end up in the frozen ground.', 3.5));

    // hostages
    this.hostages = [];
    for (let k = 0; k < 3; k++) {
      const mesh = makePed(0xdddddd, { pants: 0x444455 });
      const h = { mesh, x: bk.x - 6 + k * 5, z: bk.z + 6, inCloset: false };
      mesh.position.set(h.x, 0, h.z);
      this.addMesh(mesh);
      this.hostages.push(h);
    }
    this.closetMarker = this.marker(world.closetPos.x, world.closetPos.z, 0x4a9adf, 2);

    // getaway sedan (parked, icy)
    const sedanMesh = makeCar(0xcc2222, 'sedan');
    this.sedan = this.addVehicle(new Vehicle(sedanMesh, 'sedan', {
      x: bk.x + 34, z: bk.z + 18, heading: Math.PI / 2, color: 0xcc2222, name: 'GETAWAY SEDAN',
    }));
    this.sedan.gripMul = 0.28; // ice

    // frozen alien under the bridge
    this.alien = makeAlien(true);
    this.alien.position.set(LOC.alienBridge.x, 0, LOC.alienBridge.z);
    this.addMesh(this.alien);
    this.loreFound = false;

    this.setStep(0);
  }

  setStep(n) {
    this.step = n;
    const bk = LOC.bank;
    if (n === 0) this.obj('<b>HERD THE HOSTAGES:</b> Aim (RMB) at them to scare them into the blue closet marker. Do NOT shoot.', world.closetPos);
    if (n === 1) { this.obj('<b>THE VAULT:</b> Press <b>T</b> to open your iFruit and detonate the thermite charge.', { x: bk.x, z: bk.z - 9 }); this.prompt('[T] OPEN iFruit PHONE'); }
    if (n === 2) this.obj('<b>GRAB THE CASH</b> — walk into the vault.', { x: bk.x, z: bk.z - 10.5 });
    if (n === 3) this.obj('<b>GET TO THE RED GETAWAY SEDAN.</b> Ludendorff PD is incoming!', { x: this.sedan.pos.x, z: this.sedan.pos.z });
    if (n === 4) this.obj('<b>ICE ROAD GETAWAY:</b> reach the railroad crossing. Watch for the alien under the bridge...', LOC.crossing);
  }

  update(dt) {
    const { player, world, traffic, fx } = this;
    const bk = LOC.bank;
    const pp = this.playerPos();

    if (this.step === 0) {
      let allIn = true;
      for (const h of this.hostages) {
        if (!h.inCloset) {
          // tremble
          h.mesh.rotation.y = Math.sin(performance.now() * 0.02 + h.x) * 0.3;
          // aim cone herding
          if (player.aiming && Math.hypot(player.aimPoint.x - h.x, player.aimPoint.z - h.z) < 3.5) {
            const dx = world.closetPos.x - h.x, dz = world.closetPos.z - h.z;
            const d = Math.hypot(dx, dz) || 1;
            h.x += (dx / d) * 3.4 * dt; h.z += (dz / d) * 3.4 * dt;
            h.mesh.rotation.y = Math.atan2(dx, dz);
            if (Math.random() < dt * 0.7) say('Guard', 'Please! I have a goldfish! He needs me!', 2);
          }
          if (Math.hypot(h.x - world.closetPos.x, h.z - world.closetPos.z) < 2.2) {
            h.inCloset = true;
            sfx.pickup();
          } else allIn = false;
        }
        h.mesh.position.set(h.x, 0, h.z);
      }
      if (allIn) {
        this.scene.remove(this.closetMarker);
        say('Michael', 'Good. Stay in there. The closet is the safest room in America right now.', 3);
        this.setStep(1);
      }
    }

    if (this.step === 1 && down('KeyT')) {
      this.setStep(1.5);
      this.prompt(null);
      hud.showPhone([
        { label: '🔥 DETONATE THERMITE (vault)', cls: 'danger', onClick: () => this.detonate() },
        { label: 'Call Mom (she\'s disappointed)', onClick: () => { say('Michael', '...She says I should\'ve been a dentist.', 3); this.setStep(1); } },
      ]);
    }

    if (this.step === 2 && this.near(pp, bk.x, bk.z - 10.5, 3)) {
      addCash(179000);
      hud.notify('+$179,000 — "Money you will definitely keep and not lose in 3 minutes."', 'cheat');
      say('Michael', 'A hundred seventy-nine grand. What could possibly go wrong in the next three minutes?', 3.5);
      this.setStep(2.5);
      this.after(1.2, () => this.guardAmbush());
    }

    if (this.step === 3) {
      if (player.vehicle === this.sedan) {
        traffic.clearPolice();
        setWanted(2);
        this.setStep(4);
        // train approaches the crossing
        world.trainSpeed = 24;
        world.trainX = LOC.crossing.x - 150;
        world.trainDir = 1;
        world.train.rotation.y = 0;
        sfx.trainHorn();
        say('Trevor', 'DRIVE! The train don\'t care about your character arc!', 3);
      }
    }

    if (this.step === 4) {
      // alien easter egg
      if (!this.loreFound && this.near(pp, LOC.alienBridge.x, LOC.alienBridge.z, 13)) {
        this.loreFound = true;
        S.stats.lore += 50;
        hud.notify('+50 Lore Discovered (Eyes on the Road!) — Frozen PNG Alien, North Yankton, 2004.', 'lore');
        say('Trevor', 'WAIT. Was that— an ALIEN?! Under the bridge?! Nobody\'s gonna believe us. Perfect.', 4);
        sfx.pickup();
      }
      // crossing climax
      if (!this.crashed && this.near(pp, LOC.crossing.x, LOC.crossing.z, 15)) {
        this.crashed = true;
        this.trainCrash();
      }
    }
  }

  detonate() {
    const { world, fx, rig } = this;
    const bk = LOC.bank;
    world.vaultDoor.visible = false;
    // remove door collider
    const i = world.colliders.indexOf(world.vaultDoorCollider);
    if (i >= 0) world.colliders.splice(i, 1);
    for (const list of world.hash.values()) {
      const j = list.indexOf(world.vaultDoorCollider);
      if (j >= 0) list.splice(j, 1);
    }
    fx.explosion(bk.x, 1, bk.z - 9);
    sfx.explosion();
    rig.addShake(1);
    hud.flash(1);
    say('Michael', 'Thermite. The only key that never gets lost.', 2.5);
    this.vaultMarker = this.marker(bk.x, bk.z - 10.5);
    this.setStep(2);
  }

  guardAmbush() {
    const { player, traffic } = this;
    const bk = LOC.bank;
    this.guard = makePed(0x3a4a5a, { cap: 0x223344 });
    this.guard.position.set(bk.x + 1.5, 0, bk.z - 6);
    this.addMesh(this.guard);
    this.setStep(2.7);
    this.obj('<b>THE GUARD GRABBED MICHAEL!</b>', null);
    say('Guard', 'I saw your face! I\'ll remember you! I\'ll remember ALL of this!', 3.5);
    this.after(3.6, () => {
      say('Michael', 'You forget a thousand things every day, pal. Make sure this is one of \'em. The human mind, see, it\'s a sieve—', 4.5);
      this.prompt('[ALT] SWITCH TO TREVOR & SKIP MONOLOGUE WITH GUN');
      this.after(4.6, () => say('Michael', '—a magnificent, leaky vessel of trivia, and I, for one, have made peace with—', 4));
      this.after(9, () => say('Michael', '—which brings me to paragraph three of my prepared statement regarding memory, mortality and—', 4));
      this.after(14, () => this.trevorSwitch()); // monologue ends, guard gets nervous
    });
    this.listen('keydown', e => {
      if ((e.code === 'AltLeft' || e.code === 'AltRight') && this.step === 2.7) this.trevorSwitch();
    });
  }

  trevorSwitch() {
    if (this.step !== 2.7) return;
    const { player, fx, rig, traffic } = this;
    this.prompt(null);
    hud.flash(3);
    sfx.skycam();
    rig.addShake(0.8);
    player.setCharacter('TREVOR', 0xaa8866, null);
    S.playerColor = '#ff9d3a';
    // Trevor "skips the monologue with gun"
    if (this.guard) {
      fx.sparks(this.guard.position.x, 1.4, this.guard.position.z, 12);
      this.guard.rotation.x = -Math.PI / 2;
      this.guard.position.y = 0.3;
      sfx.gunshot();
    }
    say('Trevor', 'HE\'LL REMEMBER NUTHIN\'! Mike, you talk like a TED Talk with a hostage!', 3.5);
    this.after(3.6, () => say('Michael', '...I had a THIRD paragraph, Trevor.', 3));
    setWanted(2);
    // blizzard shootout waves
    const bk = LOC.bank;
    for (let k = 0; k < 4; k++) traffic.spawnCopPed({ x: bk.x, z: bk.z + 14 });
    traffic.spawnCop({ x: bk.x, z: bk.z + 20 });
    traffic.spawnCop({ x: bk.x + 20, z: bk.z + 10 });
    this.sedanMarker = this.marker(this.sedan.pos.x, this.sedan.pos.z);
    this.setStep(3);
  }

  trainCrash() {
    const { player, world, fx, rig } = this;
    const v = player.vehicle;
    this.obj(null);
    sfx.trainHorn();
    say('Trevor', 'TRAIN!! TRAIN TRAIN TRAIN—', 2);
    this.after(0.8, () => {
      // clipped in the rear fender
      if (v && !v.dead) {
        v.applyImpulse(9000, -4000);
        v.damage(55, fx, true);
        v.heading += 1.2;
      }
      fx.sparks(v ? v.pos.x : LOC.crossing.x, 1, v ? v.pos.z : LOC.crossing.z, 30);
      fx.explosion(LOC.crossing.x + 4, 0.5, LOC.crossing.z, false);
      sfx.bigExplosion();
      rig.addShake(1.5);
      S.timeScale = 0.3;
      hud.flash(2);
      this.after(1.8, () => {
        S.timeScale = 1;
        world.trainSpeed = 0;
        hud.freezeFrame('9 YEARS LATER: LOS SANTOS', () => {
          this.pass({
            sub: 'The prologue is over. The chaos is forever.',
            respect: 100,
            cash: 0,
            medals: [
              'Monologue Skipped — Trevor approves',
              'Eyes on the Road (+50 Lore if you saw the alien)',
              'Train: 1 — Getaway Sedan: 0',
            ],
            btn: 'CHAPTER 2 →',
            cb: () => window.dispatchEvent(new CustomEvent('gtv-next-chapter', { detail: 2 })),
          });
        });
      });
    });
  }

  respawn() {
    const { player } = this;
    const bk = LOC.bank;
    if (this.step >= 4) {
      this.sedan.repair();
      this.sedan.pos.set(bk.x + 34, 0, bk.z + 18);
      this.sedan.heading = Math.PI / 2;
      this.sedan.vx = this.sedan.vz = 0;
      player.enterVehicle(this.sedan);
      this.crashed = false;
      this.ctx.world.trainX = LOC.crossing.x - 150;
    } else {
      player.teleport(bk.x, bk.z + 12, Math.PI);
      if (this.step === 2.7) this.trevorSwitch();
    }
  }
}