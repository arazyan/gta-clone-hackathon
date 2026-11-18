// Low-poly mesh factories. All arcade-stylized for 60fps.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  }
  return matCache.get(key);
}
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = false;
  return m;
}
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = mat(0x151515);
function wheel(x, y, z) {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.position.set(x, y, z);
  return w;
}

// kind: sedan | sport | police | suv | lowrider | taxi
export function makeCar(color = 0x8899aa, kind = 'sedan') {
  const g = new THREE.Group();
  const sport = kind === 'sport';
  const suv = kind === 'suv';
  const low = kind === 'lowrider';
  const bodyH = suv ? 0.9 : sport ? 0.55 : 0.7;
  const bodyY = suv ? 0.75 : sport ? 0.5 : 0.6;
  const len = suv ? 4.6 : sport ? 4.4 : 4.2;
  const wid = suv ? 2.1 : 1.9;
  g.add(box(wid, bodyH, len, color, 0, bodyY, 0));
  const cabH = suv ? 0.75 : 0.55;
  const cab = box(wid * 0.85, cabH, len * (suv ? 0.55 : 0.45), sport ? 0x222233 : 0x334455, 0, bodyY + bodyH / 2 + cabH / 2 - 0.05, suv ? 0 : -0.2, { transparent: true, opacity: 0.9 });
  g.add(cab);
  // headlights / taillights
  g.add(box(0.3, 0.15, 0.06, 0xffffcc, -wid / 2 + 0.35, bodyY, len / 2 + 0.01, { emissive: 0x888855 }));
  g.add(box(0.3, 0.15, 0.06, 0xffffcc, wid / 2 - 0.35, bodyY, len / 2 + 0.01, { emissive: 0x888855 }));
  g.add(box(0.3, 0.15, 0.06, 0xff3333, -wid / 2 + 0.35, bodyY, -len / 2 - 0.01, { emissive: 0x661111 }));
  g.add(box(0.3, 0.15, 0.06, 0xff3333, wid / 2 - 0.35, bodyY, -len / 2 - 0.01, { emissive: 0x661111 }));
  const wheels = [];
  const wy = 0.38, wx = wid / 2 - 0.1, wz = len / 2 - 0.9;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = wheel(x, wy, z); wheels.push(w); g.add(w);
  }
  if (kind === 'police') {
    g.add(box(wid * 0.6, 0.18, 0.5, 0x222222, 0, bodyY + bodyH / 2 + cabH + 0.08, -0.2));
    const rl = box(0.35, 0.16, 0.45, 0xff2222, -0.35, bodyY + bodyH / 2 + cabH + 0.18, -0.2, { emissive: 0xaa0000 });
    const bl = box(0.35, 0.16, 0.45, 0x2244ff, 0.35, bodyY + bodyH / 2 + cabH + 0.18, -0.2, { emissive: 0x0000aa });
    g.add(rl, bl);
    g.userData.lightbar = [rl, bl];
  }
  if (low) { g.add(box(wid + 0.1, 0.12, len * 0.9, 0xdddddd, 0, 0.32, 0)); }
  g.userData = { ...g.userData, wheels, kind, len, wid, roof: cab };
  return g;
}

export function makeTank(color = 0x5a6b4a) {
  const g = new THREE.Group();
  g.add(box(3.2, 1.1, 6.2, color, 0, 1.0, 0));
  g.add(box(3.6, 0.7, 6.4, 0x333a2e, 0, 0.45, 0)); // tracks
  g.add(box(0.5, 0.5, 6.4, 0x222619, -1.7, 0.45, 0));
  g.add(box(0.5, 0.5, 6.4, 0x222619, 1.7, 0.45, 0));
  const turret = new THREE.Group();
  turret.position.set(0, 1.85, -0.3);
  turret.add(box(2.0, 0.8, 2.4, color, 0, 0, 0));
  const barrel = box(0.28, 0.28, 4.2, 0x3a4433, 0, 0.1, 2.6);
  turret.add(barrel);
  g.add(turret);
  g.userData = { turret, barrel, kind: 'tank', len: 6.4, wid: 3.4, wheels: [] };
  return g;
}

export function makeBike(kind = 'bmx', color = 0xcc3333) {
  const g = new THREE.Group();
  const frame = box(0.16, 0.16, 1.5, color, 0, 0.62, 0);
  frame.rotation.x = 0.15;
  g.add(frame);
  g.add(box(0.1, 0.5, 0.1, color, 0, 0.85, -0.45)); // seat post
  g.add(box(0.35, 0.08, 0.3, 0x222222, 0, 1.08, -0.45)); // seat
  g.add(box(0.1, 0.55, 0.1, 0x888888, 0, 0.9, 0.65)); // fork
  g.add(box(0.7, 0.08, 0.08, 0x888888, 0, 1.16, 0.65)); // handlebars
  const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12);
  wg.rotateZ(Math.PI / 2);
  const w1 = new THREE.Mesh(wg, wheelMat); w1.position.set(0, 0.34, 0.75);
  const w2 = new THREE.Mesh(wg, wheelMat); w2.position.set(0, 0.34, -0.75);
  g.add(w1, w2);
  g.userData = { wheels: [w1, w2], kind, len: 1.8, wid: 0.7 };
  return g;
}

export function makeHeli() {
  const g = new THREE.Group();
  g.add(box(0.7, 0.55, 1.5, 0x2266cc, 0, 0, 0));
  g.add(box(0.5, 0.4, 0.5, 0x99ccff, 0, 0.1, 0.7, { transparent: true, opacity: 0.8 }));
  g.add(box(0.18, 0.18, 1.2, 0x2266cc, 0, 0.1, -1.2));
  g.add(box(0.08, 0.5, 0.3, 0xcc2222, 0, 0.35, -1.75));
  const rotor = new THREE.Group();
  rotor.position.y = 0.45;
  rotor.add(box(2.6, 0.04, 0.14, 0x333333));
  rotor.add(box(0.14, 0.04, 2.6, 0x333333));
  g.add(rotor);
  g.add(box(0.08, 0.3, 1.0, 0x444444, -0.35, -0.45, 0));
  g.add(box(0.08, 0.3, 1.0, 0x444444, 0.35, -0.45, 0));
  g.userData = { rotor, kind: 'heli' };
  return g;
}

export function makePed(shirt = 0x4477aa, opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin || 0xd9a066;
  const torso = box(0.5, 0.65, 0.3, shirt, 0, 1.05, 0);
  const head = box(0.32, 0.32, 0.32, skin, 0, 1.6, 0);
  const legL = box(0.18, 0.7, 0.2, opts.pants || 0x2a2a3a, -0.13, 0.35, 0);
  const legR = box(0.18, 0.7, 0.2, opts.pants || 0x2a2a3a, 0.13, 0.35, 0);
  const armL = box(0.14, 0.6, 0.18, shirt, -0.34, 1.05, 0);
  const armR = box(0.14, 0.6, 0.18, shirt, 0.34, 1.05, 0);
  g.add(torso, head, legL, legR, armL, armR);
  if (opts.hardhat) g.add(box(0.4, 0.14, 0.4, 0xffcc00, 0, 1.8, 0));
  if (opts.cap) g.add(box(0.36, 0.1, 0.36, opts.cap, 0, 1.78, 0));
  if (opts.mask) g.add(box(0.34, 0.2, 0.1, 0x222222, 0, 1.62, 0.17));
  g.userData = { legL, legR, armL, armR, head, kind: 'ped', walkPhase: Math.random() * 6 };
  return g;
}

export function makeAlien(frozen = false) {
  const g = new THREE.Group();
  const glow = { emissive: 0x22ff44 };
  g.add(box(0.4, 0.7, 0.3, 0x33dd55, 0, 0.9, 0, glow));
  const head = box(0.55, 0.45, 0.4, 0x44ff66, 0, 1.55, 0, glow);
  g.add(head);
  g.add(box(0.12, 0.1, 0.05, 0x000000, -0.14, 1.6, 0.21));
  g.add(box(0.12, 0.1, 0.05, 0x000000, 0.14, 1.6, 0.21));
  g.add(box(0.12, 0.6, 0.12, 0x33dd55, -0.3, 0.9, 0, glow));
  g.add(box(0.12, 0.6, 0.12, 0x33dd55, 0.3, 0.9, 0, glow));
  if (frozen) {
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.4, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45, emissive: 0x224466 })
    );
    ice.position.y = 1.1;
    g.add(ice);
  }
  return g;
}

export function makeTrainCar(color = 0x7a4a2a, loco = false) {
  const g = new THREE.Group();
  if (loco) {
    g.add(box(3, 2.6, 9, 0x333a44, 0, 1.9, 0));
    g.add(box(2.6, 1.2, 3, 0x222831, 0, 3.6, -2));
    g.add(box(0.8, 0.8, 0.8, 0x111111, 0, 3.6, 3));
    g.add(box(3.2, 0.5, 9.2, 0x111111, 0, 0.5, 0));
  } else {
    g.add(box(3, 2.8, 10, color, 0, 2.0, 0));
    g.add(box(3.2, 0.5, 10.2, 0x111111, 0, 0.5, 0));
    g.add(box(3.05, 0.15, 10.05, 0x5a3a22, 0, 3.45, 0)); // roof walkway
  }
  return g;
}

export function makeMarker(color = 0xffd24a, radius = 2.2, height = 3) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
  );
  m.position.y = height / 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.7, radius, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
  const g = new THREE.Group();
  g.add(m, ring);
  g.userData = { cyl: m, ring };
  return g;
}

export function makeBarrel(color = 0xcc4422) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12), mat(color));
  b.position.y = 0.55;
  g.add(b);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 6, 16), mat(0x333333)).translateY(0.85));
  return g;
}