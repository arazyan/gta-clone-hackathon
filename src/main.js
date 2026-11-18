// GRAND THEFT VIBE — boot & main loop.
import * as THREE from 'three';
import { S, on, addCash, setWanted, damagePlayer, markChapterDone, say } from './state.js';
import { initInput, down, driveInput, onCheat, keys } from './input.js';
import { initAudio, resumeAudio, updateEngine, updateSiren, sfx, setRadio } from './audio.js';
import { World, LOC } from './world.js';
import { FX } from './fx.js';
import { Traffic, resolveVehicleCollisions } from './traffic.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { hud } from './hud.js';
import { MissionManager } from './missions/base.js';
import { Ch5 } from './missions/ch5.js';
import { allVehicles } from './vehicles.js';
import { updateDarkHumor, randomHospitalBill } from './darkhumor.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const world = new World(scene);
const fx = new FX(scene);
const traffic = new Traffic(scene, world, fx);
const player = new Player(scene, world, fx, traffic);
const rig = new CameraRig(window.innerWidth / window.innerHeight);
rig._world = world;
window._gtvPlayer = player;

const ctx = { scene, world, fx, traffic, player, rig };
const missions = new MissionManager(ctx, { 5: Ch5 });

hud.init();
initInput(canvas);

// ---------------- menu ----------------
const menu = document.getElementById('menu');
const chapterList = document.getElementById('chapter-list');
const CHAPTERS = [
  { n: 5, title: 'CH.5 — AH SHIT, HERE WE GO AGAIN', desc: 'BMX alley cold open → 5-Star Rhino turret-boost → HESOYAM → Pay \'n\' Spray neon-pink finale' },
  { n: 0, title: 'FREE ROAM — LOS SANTOS SANDBOX', desc: 'The whole city: traffic, carjacking, police, radio, cheats, sky-cam. Just vibe.' },
];
function buildMenu() {
  chapterList.innerHTML = '';
  for (const c of CHAPTERS) {
    const b = document.createElement('button');
    b.className = 'chapter-btn';
    const done = S.chapterDone.includes(c.n);
    b.innerHTML = `<span class="num">${c.n === 0 ? '∞' : c.n}</span><span><b>${c.title}</b><span class="desc">${c.desc}</span></span>${done ? '<span class="done">✓ PASSED</span>' : ''}`;
    b.onclick = () => startGame(c.n);
    chapterList.appendChild(b);
  }
}
buildMenu();

function startGame(ch) {
  initAudio(); resumeAudio();
  menu.classList.add('hidden');
  hud.show();
  S.mode = 'playing';
  missions.start(ch);
  if (ch === 0) {
    player.setCharacter('FRANKLIN', 0x3a6a3a, 0x224422);
    player.teleport(0, 20, Math.PI);
    // give the player a ride in free roam
    say('Narrator', 'LOS SANTOS. Population: you, and 15 recycled sedans. Go cause problems.', 4);
  }
  hud.cashPop(0);
}

window.addEventListener('gtv-next-chapter', e => {
  if (missions.chNum > 0) markChapterDone(missions.chNum);
  buildMenu();
  missions.start(e.detail);
  if (e.detail === 0) {
    player.setCharacter('FRANKLIN', 0x3a6a3a, 0x224422);
    player.teleport(LOC.paynspray.x, LOC.paynspray.z + 14, Math.PI);
    say('Narrator', 'FREE ROAM UNLOCKED. The city is yours. Type HESOYAM. Press V. Just vibe.', 4.5);
  }
});

// back to menu
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && S.mode === 'playing') {
    S.mode = 'menu';
    menu.classList.remove('hidden');
    hud.hide();
    buildMenu();
    setRadio(-1); S.radio = -1;
  }
  if (e.code === 'KeyV' && S.mode === 'playing' && !S.dead) rig.toggle();
});

// ---------------- screen states ----------------
on('wasted', () => {
  if (S.dead) return;
  hud.wasted(() => {
    hud.notify(randomHospitalBill(), 'cheat');
    missions.respawn();
  });
});
window.addEventListener('gtv-busted', () => {
  if (S.dead) return;
  say('Cop', 'You have the right to remain silent. Your data, however, is already sold.', 3);
  hud.wasted(() => {
    addCash(-100);
    hud.notify('BUSTED: $100 "processing fee". The charges were dropped. The fee was not.', 'cheat');
    missions.respawn();
  }, true);
});

// explosions hurt everything nearby
window.addEventListener('gtv-explosion', e => {
  const { x, z, r, dmg, src } = e.detail;
  const pp = player.vehicle ? player.vehicle.pos : player.pos;
  const d = Math.hypot(pp.x - x, pp.z - z);
  if (d < r) {
    if (player.vehicle && player.vehicle !== src) player.vehicle.damage(dmg * (1 - d / r), fx);
    damagePlayer(dmg * 0.6 * (1 - d / r), 'explosion');
    rig.addShake(0.8);
  }
  for (const v of allVehicles) {
    if (v.dead || v === src) continue;
    const dv = Math.hypot(v.pos.x - x, v.pos.z - z);
    if (dv < r) v.damage(dmg * (1 - dv / r), fx, true);
  }
  for (const p of [...traffic.peds, ...traffic.copPeds]) {
    if (!p.dead && Math.hypot(p.x - x, p.z - z) < r) traffic.killPed(p, (p.x - x) * 2, (p.z - z) * 2, false);
  }
});
window.addEventListener('gtv-vehicle-exploded', e => {
  if (e.detail === player.vehicle) {
    player.vehicle = null;
    player.mesh.visible = true;
    damagePlayer(999, 'explosion');
  }
});
window.addEventListener('gtv-crash', e => rig.addShake(Math.min(1, e.detail / 30)));

// ---------------- cheats ----------------
onCheat('HESOYAM', () => {
  if (S.mode !== 'playing') return;
  sfx.cheat();
  hud.notify('Cheat Activated', 'cheat');
  addCash(250000);
  S.health = 100; S.armor = 100;
  if (player.vehicle) { player.vehicle.repair(); hud.notify('Vehicle doors un-dented. 100% HP. Physics apologizes.', 'cheat'); }
  fx.sparkle(player.pos.x, 0, player.pos.z);
});
onCheat('RIPAZHA', () => {
  if (S.mode !== 'playing') return;
  sfx.cheat();
  hud.notify('Cheat Activated: RIPAZHA — cars fly for 10 seconds. Gravity is a social construct.', 'cheat');
  S.cheats.lowGravUntil = performance.now() + 10000;
  if (player.vehicle) player.vehicle.vy = 8;
});
onCheat('BAGUVIX', () => {
  if (S.mode !== 'playing') return;
  sfx.cheat();
  hud.notify('Cheat Activated: BAGUVIX — invincibility sparkles. Mortality: postponed.', 'cheat');
  S.cheats.invincibleUntil = performance.now() + 15000;
});

// ---------------- resize ----------------
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth / window.innerHeight);
});

// ---------------- main loop ----------------
let last = performance.now();
document.getElementById('loading').classList.add('hidden');
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.mode !== 'playing') { renderer.render(scene, rig.camera); return; }

  // Franklin's driving focus (Shift)
  const driving = !!player.vehicle;
  const wantFocus = driving && (down('ShiftLeft') || down('ShiftRight')) && S.ability > 1 && !S.dead;
  S.focusActive = wantFocus;
  if (wantFocus) {
    S.ability = Math.max(0, S.ability - 22 * dt);
    S.timeScale = 0.4;
    document.getElementById('vignette').className = 'focus';
  } else {
    S.ability = Math.min(100, S.ability + 7 * dt);
    if (!hud.wheelOpen && !S.dead) S.timeScale = 1;
    if (!S.dead) document.getElementById('vignette').className = '';
  }
  if (hud.wheelOpen && !S.dead) S.timeScale = 0.2;

  const sdt = dt * S.timeScale;
  const allowInput = !S.dead && !hud.wheelOpen;

  // player + vehicle
  player.update(sdt, rig.camera, allowInput);
  if (player.vehicle && !player.vehicle.dead) {
    player.vehicle.update(sdt, allowInput ? driveInput() : { throttle: 0, steer: 0, handbrake: false }, world, fx);
  }
  player.updateProjectiles(sdt);

  // world systems
  traffic.update(sdt, player, player.vehicle);
  resolveVehicleCollisions(fx);
  world.updateTrain(sdt);
  missions.update(sdt);
  fx.update(sdt, player.pos);
  fx.setSnow(S.chapter === 1, player.pos);
  updateDarkHumor(sdt);

  // camera (real dt for responsiveness)
  const v = player.vehicle;
  rig.update(dt, {
    pos: v ? v.pos : player.pos,
    heading: v ? v.heading : player.heading,
    speed: v ? v.speed : 0,
    maxSpeed: v ? v.stats.maxSpeed : 10,
    vehicle: v,
  });

  // audio
  updateEngine(v ? Math.min(1, v.speed / v.stats.maxSpeed) : 0, !!v, dt);
  const copD = traffic.nearestCopDist(player.pos);
  updateSiren(S.wanted > 0 ? Math.max(0, 1 - copD / 90) : 0);

  hud.update(dt, player, traffic);
  renderer.render(scene, rig.camera);
}
requestAnimationFrame(loop);