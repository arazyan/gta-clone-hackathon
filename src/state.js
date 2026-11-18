// Central mutable game state (60Hz refs) + tiny event bus for HUD (event-driven).
export const S = {
  mode: 'menu',            // menu | playing
  chapter: 0,              // 0 = free roam, 1..5
  step: 0,
  timeScale: 1,
  cameraMode: '3d',        // 3d | iso
  health: 100, armor: 0, ability: 100,
  cash: 0,
  wanted: 0, wantedCooldown: 0, bustedTimer: 0,
  respect: 0,
  dead: false, wasted: false,
  focusActive: false,
  snow: false,
  radio: -1,               // -1 off, 0..2 stations
  weapon: 0,               // index into WEAPONS
  ammo: [ { clip: 12, total: 60 }, { clip: 30, total: 120 }, { clip: 1, total: 8 } ],
  cheats: { invincibleUntil: 0, lowGravUntil: 0 },
  waypoint: null,          // {x,z} purple
  objective: null,         // {x,z,label} yellow GPS target
  stats: { cgi: 0, lore: 0, calories: 0 },
  playerName: 'FRANKLIN',
  playerColor: '#67c23a',
  checkpoint: null,        // respawn {x,z,heading,vehicle}
  chapterDone: JSON.parse(localStorage.getItem('gtv_done') || '[]'),
  freeRoamUnlocked: localStorage.getItem('gtv_freeroam') === '1',
};

export const WEAPONS = [
  { name: 'PISTOL', dmg: 25, rate: 0.28, auto: false, range: 90 },
  { name: 'MICRO SMG', dmg: 12, rate: 0.09, auto: true, range: 70 },
  { name: 'RPG', dmg: 200, rate: 1.2, auto: false, range: 160, explosive: true },
];

const listeners = {};
export function on(ev, fn) { (listeners[ev] ||= []).push(fn); }
export function emit(ev, data) { (listeners[ev] || []).forEach(fn => fn(data)); }

export function addCash(n) {
  S.cash = Math.max(0, S.cash + n);
  emit('cash', n);
}
export function setWanted(n) {
  const prev = S.wanted;
  S.wanted = Math.max(0, Math.min(5, n));
  if (S.wanted !== prev) emit('wanted', S.wanted);
}
export function damagePlayer(n, src) {
  if (S.dead) return;
  if (performance.now() < S.cheats.invincibleUntil) { emit('sparkle'); return; }
  if (S.armor > 0) { const a = Math.min(S.armor, n * 0.7); S.armor -= a; n -= a; }
  S.health -= n;
  emit('damage', n);
  if (S.health <= 0) { S.health = 0; emit('wasted', src); }
}
export function markChapterDone(ch) {
  if (!S.chapterDone.includes(ch)) {
    S.chapterDone.push(ch);
    localStorage.setItem('gtv_done', JSON.stringify(S.chapterDone));
  }
  if (ch === 5) { S.freeRoamUnlocked = true; localStorage.setItem('gtv_freeroam', '1'); }
}

// subtitle queue -------------------------------------------------------
export const CHAR_COLORS = {
  Franklin: '#67c23a', Michael: '#5a9adf', Trevor: '#ff9d3a',
  Smoke: '#ffd24a', Lamar: '#7ad07a', CJ: '#67c23a', Simeon: '#df8adf',
  Guard: '#cccccc', Cop: '#8ab4ff', Dispatch: '#ff8a8a', Smoke2: '#ffd24a',
  Narrator: '#ffffff', Jimmy: '#ffe08a', Michael2: '#5a9adf', Worker: '#ffcc66',
  General: '#aaffaa',
};
export function say(who, text, dur = 3.2) { emit('say', { who, text, dur }); }