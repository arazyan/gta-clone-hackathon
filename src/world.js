// Procedural 16x16 city grid + special chapter locations + collision world.
import * as THREE from 'three';
import { mat, makeTrainCar } from './entities.js';

export const TILE = 24, GRID = 16, HALF = TILE * GRID / 2; // 192
export const tileCenter = i => (i - (GRID - 1) / 2) * TILE;
export const tileAt = x => Math.floor((x + HALF) / TILE);
export const isRoadTile = (i, j) => i % 4 === 0 || j % 4 === 0;
export const isRoad = (x, z) => {
  const i = tileAt(x), j = tileAt(z);
  if (i < 0 || j < 0 || i >= GRID || j >= GRID) return false;
  return isRoadTile(i, j);
};

export const LOC = {
  bank: { x: -156, z: -120 },
  crossing: { x: -72, z: -156 },
  alienBridge: { x: -120, z: -132 },
  cluckin: { x: -48, z: -132 },
  tracksZ: -156,
  dealership: { x: 60, z: 60 },
  construction: { x: 120, z: -60 },
  mansion: { x: 156, z: -108 },
  studio: { x: -120, z: 108 },
  garage: { x: -36, z: 144 },
  franklin: { x: 96, z: 156 },
  barbershop: { x: 144, z: 156 },
  paynspray: { x: 24, z: -84 },
  alley: { x: -168, z: 36 },
  beachDrive: { x: 0, z: 168 },
  tankDrop: { x: -120, z: 84 },
};

// special zones clear buildings: [minI,maxI,minJ,maxJ] in tile coords
const CLEAR = [
  [0, 2, 1, 3],    // bank plaza
  [4, 6, 1, 2],    // cluckin + tracks south side
  [9, 11, 9, 11],  // dealership
  [12, 14, 4, 6],  // construction
  [13, 15, 2, 4],  // mansion
  [1, 3, 11, 13],  // studio
  [5, 7, 13, 15],  // parking garage
  [11, 12, 14, 15],// franklin
  [13, 14, 14, 15],// barbershop
  [8, 9, 4, 5],    // pay n spray
  [0, 1, 8, 10],   // alley
  [7, 8, 14, 15],  // beach driveway
  [2, 3, 10, 11],  // tank drop
];
function inClear(i, j) {
  return CLEAR.some(([a, b, c, d]) => i >= a && i <= b && j >= c && j <= d);
}

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 5; x < 58; x += 12) {
      g.fillStyle = Math.random() < 0.25 ? '#ffe9a0' : '#2a3440';
      g.fillRect(x, y, 7, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textPlane(text, w, h, bg = '#1a1a2a', fg = '#ffd24a', font = 'bold 48px Impact') {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => g.fillText(ln, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * 56));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  return m;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];       // {minX,maxX,minZ,maxZ,h,tag}
    this.hash = new Map();
    this.hydrants = [];        // {x,z,alive,idx}
    this.roadNodes = [];
    this.trainSpeed = 0; this.trainX = -100; this.trainDir = 1;
    this.build(scene);
  }

  addCollider(minX, maxX, minZ, maxZ, h = 10, tag = 'building') {
    const c = { minX, maxX, minZ, maxZ, h, tag };
    this.colliders.push(c);
    const i0 = Math.max(0, tileAt(minX)), i1 = Math.min(GRID - 1, tileAt(maxX));
    const j0 = Math.max(0, tileAt(minZ)), j1 = Math.min(GRID - 1, tileAt(maxZ));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = i + ',' + j;
      if (!this.hash.has(k)) this.hash.set(k, []);
      this.hash.get(k).push(c);
    }
    return c;
  }

  nearbyColliders(x, z) {
    const i = tileAt(x), j = tileAt(z), out = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const list = this.hash.get((i + di) + ',' + (j + dj));
      if (list) out.push(...list);
    }
    return out;
  }

  // circle vs AABB push-out; returns {x,z,hit,impact}
  collideCircle(x, z, r) {
    let hit = null;
    for (const c of this.nearbyColliders(x, z)) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (r - d);
        if (d2 > 0.0001) { x += (dx / d) * push; z += (dz / d) * push; }
        else { x += push; }
        hit = c;
      }
    }
    // city bounds
    const B = HALF + 14;
    x = Math.max(-B, Math.min(B, x)); z = Math.max(-B, Math.min(B, z));
    return { x, z, hit };
  }

  build(scene) {
    // lights & sky
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a6a4a, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
    this.sun.position.set(80, 140, 60);
    scene.add(this.sun);
    this.skyColor = new THREE.Color(0x87b5e0);
    scene.background = this.skyColor;
    this.fog = new THREE.Fog(0x87b5e0, 90, 340);
    scene.fog = this.fog;

    // ground
    this.groundMat = new THREE.MeshLambertMaterial({ color: 0x6a7a5a });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), this.groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
    scene.add(ground);

    // beach + ocean
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, 40), mat(0xe8d8a0));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, 190);
    scene.add(sand);
    this.oceanMat = new THREE.MeshLambertMaterial({ color: 0x2a6a9a });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), this.oceanMat);
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.1, 360);
    scene.add(ocean);

    // roads (merged) + lane dashes
    this.roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
    const roadGeos = [];
    const dashGeo = new THREE.BoxGeometry(0.35, 0.02, 2.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8a0 });
    const dashes = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const x = tileCenter(i), z = tileCenter(j);
      if (isRoadTile(i, j)) {
        const p = new THREE.PlaneGeometry(TILE, TILE);
        p.rotateX(-Math.PI / 2); p.translate(x, 0.01, z);
        roadGeos.push(p);
        this.roadNodes.push({ x, z, i, j });
        if (i % 4 === 0 && j % 4 !== 0) dashes.push([x, z, 0]);
        if (j % 4 === 0 && i % 4 !== 0) dashes.push([x, z, Math.PI / 2]);
      } else {
        // sidewalk pad
        const p = new THREE.PlaneGeometry(TILE, TILE);
        p.rotateX(-Math.PI / 2); p.translate(x, 0.02, z);
        roadGeos.push(p); // same mat? use separate below
      }
    }
    // separate sidewalk mesh (lighter)
    const sidewalkGeos = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      if (!isRoadTile(i, j)) {
        const p = new THREE.PlaneGeometry(TILE, TILE);
        p.rotateX(-Math.PI / 2); p.translate(tileCenter(i), 0.03, tileCenter(j));
        sidewalkGeos.push(p);
      }
    }
    const merge = geos => {
      // manual merge (positions only, non-indexed)
      let total = 0;
      const nis = geos.map(g => g.toNonIndexed());
      nis.forEach(g => total += g.attributes.position.count);
      const pos = new Float32Array(total * 3);
      let off = 0;
      for (const g of nis) { pos.set(g.attributes.position.array, off); off += g.attributes.position.array.length; }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.computeVertexNormals();
      return out;
    };
    const roadsOnly = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      if (isRoadTile(i, j)) {
        const p = new THREE.PlaneGeometry(TILE, TILE);
        p.rotateX(-Math.PI / 2); p.translate(tileCenter(i), 0.01, tileCenter(j));
        roadsOnly.push(p);
      }
    }
    scene.add(new THREE.Mesh(merge(roadsOnly), this.roadMat));
    this.sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
    scene.add(new THREE.Mesh(merge(sidewalkGeos), this.sidewalkMat));
    const dashInst = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    dashes.forEach(([x, z, rot], k) => {
      e.set(0, rot, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
      dashInst.setMatrixAt(k, m4);
    });
    scene.add(dashInst);

    // buildings (instanced, window texture)
    const winTex = windowTexture();
    const bMat = new THREE.MeshLambertMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.25 });
    const spots = [];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      if (isRoadTile(i, j) || inClear(i, j)) continue;
      spots.push([tileCenter(i), tileCenter(j), i, j]);
    }
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    bGeo.translate(0, 0.5, 0);
    const buildings = new THREE.InstancedMesh(bGeo, bMat, spots.length);
    const palette = [0x8a9aa8, 0xa89a8a, 0x7a8a9a, 0xb0a898, 0x6a7a8a, 0x9a8a7a, 0x88909a, 0xa0a8b0];
    const col = new THREE.Color();
    spots.forEach(([x, z], k) => {
      const h = 8 + Math.random() * 34;
      const w = 17 + Math.random() * 3, d = 17 + Math.random() * 3;
      m4.compose(new THREE.Vector3(x, 0, z), q.identity(), new THREE.Vector3(w, h, d));
      buildings.setMatrixAt(k, m4);
      col.setHex(palette[Math.floor(Math.random() * palette.length)]);
      buildings.setColorAt(k, col);
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
    });
    buildings.instanceColor.needsUpdate = true;
    scene.add(buildings);

    // street lights + hydrants (instanced)
    const lampSpots = [], hydSpots = [];
    for (const n of this.roadNodes) {
      if ((n.i + n.j) % 3 === 0 && n.i % 4 === 0 && n.j % 4 !== 0) lampSpots.push([n.x + 10, n.z]);
      if ((n.i * 7 + n.j * 3) % 5 === 0 && n.j % 4 === 0 && n.i % 4 !== 0) hydSpots.push([n.x, n.z + 10]);
    }
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 6);
    poleGeo.translate(0, 3, 0);
    const lampInst = new THREE.InstancedMesh(poleGeo, mat(0x444444), lampSpots.length);
    lampSpots.forEach(([x, z], k) => { m4.makeTranslation(x, 0, z); lampInst.setMatrixAt(k, m4); });
    scene.add(lampInst);
    const headGeo = new THREE.BoxGeometry(0.8, 0.2, 0.4);
    const headInst = new THREE.InstancedMesh(headGeo, mat(0xffffcc, { emissive: 0x666633 }), lampSpots.length);
    lampSpots.forEach(([x, z], k) => { m4.makeTranslation(x - 0.4, 6, z); headInst.setMatrixAt(k, m4); });
    scene.add(headInst);

    const hydGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.8, 8);
    hydGeo.translate(0, 0.4, 0);
    this.hydrantInst = new THREE.InstancedMesh(hydGeo, mat(0xcc3333), hydSpots.length);
    hydSpots.forEach(([x, z], k) => {
      m4.makeTranslation(x, 0, z);
      this.hydrantInst.setMatrixAt(k, m4);
      this.hydrants.push({ x, z, alive: true, idx: k });
    });
    scene.add(this.hydrantInst);

    // palm trees on beach
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 7, 6); trunkGeo.translate(0, 3.5, 0);
    const leafGeo = new THREE.ConeGeometry(2.6, 2.2, 7); leafGeo.translate(0, 7.6, 0);
    const palms = [];
    for (let x = -180; x <= 180; x += 24) palms.push([x + Math.random() * 8, 178 + Math.random() * 8]);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, mat(0x8a6a4a), palms.length);
    const leafInst = new THREE.InstancedMesh(leafGeo, mat(0x3a8a3a), palms.length);
    palms.forEach(([x, z], k) => { m4.makeTranslation(x, 0, z); trunkInst.setMatrixAt(k, m4); leafInst.setMatrixAt(k, m4); });
    scene.add(trunkInst, leafInst);

    this.buildTracks(scene);
    this.buildLocations(scene);
  }

  buildTracks(scene) {
    const z = LOC.tracksZ;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 40, 8), mat(0x5a5248));
    bed.rotation.x = -Math.PI / 2; bed.position.set(0, 0.04, z);
    scene.add(bed);
    const railGeo = new THREE.BoxGeometry(HALF * 2 + 40, 0.15, 0.15);
    for (const dz of [-0.9, 0.9]) {
      const rail = new THREE.Mesh(railGeo, mat(0x999999));
      rail.position.set(0, 0.15, z + dz);
      scene.add(rail);
    }
    const sleeperGeo = new THREE.BoxGeometry(0.5, 0.1, 3);
    const count = Math.floor((HALF * 2 + 40) / 2.4);
    const sleepers = new THREE.InstancedMesh(sleeperGeo, mat(0x4a3a2a), count);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < count; k++) {
      m4.makeTranslation(-HALF - 20 + k * 2.4, 0.08, z);
      sleepers.setMatrixAt(k, m4);
    }
    scene.add(sleepers);

    // train
    this.train = new THREE.Group();
    const loco = makeTrainCar(0, true);
    this.train.add(loco);
    this.trainCars = [loco];
    for (let k = 0; k < 4; k++) {
      const car = makeTrainCar([0x7a4a2a, 0x4a6a7a, 0x6a7a4a, 0x7a5a6a][k]);
      car.position.z = 0; car.position.x = -(k + 1) * 11.5;
      this.train.add(car);
      this.trainCars.push(car);
    }
    this.train.position.set(this.trainX, 0, z);
    scene.add(this.train);
  }

  buildLocations(scene) {
    const B = (w, h, d, color, x, y, z, opts) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
      m.position.set(x, y, z); scene.add(m); return m;
    };

    // ---- BANK (ch1) ----
    const bk = LOC.bank;
    B(26, 10, 18, 0xd8d0c0, bk.x, 5, bk.z - 6);
    // side walls only — central corridor leads to the vault
    this.addCollider(bk.x - 13, bk.x - 2.5, bk.z - 15, bk.z + 3, 10, 'bank');
    this.addCollider(bk.x + 2.5, bk.x + 13, bk.z - 15, bk.z + 3, 10, 'bank');
    this.addCollider(bk.x - 13, bk.x + 13, bk.z - 15, bk.z - 13.5, 10, 'bank');
    const sign = textPlane('LUDENDORFF BANK', 18, 2.4, '#22303a', '#e8e0d0');
    sign.position.set(bk.x, 8.5, bk.z + 3.05); scene.add(sign);
    // columns
    for (const dx of [-8, -3, 3, 8]) B(1.2, 8, 1.2, 0xc8c0b0, bk.x + dx, 4, bk.z + 5);
    // vault door (blocks corridor until thermite)
    this.vaultDoor = B(4.6, 5, 0.6, 0x666670, bk.x, 2.5, bk.z - 9.2);
    this.vaultDoorCollider = this.addCollider(bk.x - 2.4, bk.x + 2.4, bk.z - 9.6, bk.z - 8.8, 5, 'vaultdoor');
    // supply closet zone marker pos
    this.closetPos = { x: bk.x + 10, z: bk.z - 2 };
    B(4, 4, 4, 0xb8b0a0, bk.x + 11, 2, bk.z - 4);

    // ---- alien bridge (ch1 easter egg) ----
    const ab = LOC.alienBridge;
    B(16, 1.2, 10, 0x7a8a9a, ab.x, 5.5, ab.z);
    B(1.5, 5.5, 10, 0x6a7a8a, ab.x - 7.5, 2.75, ab.z);
    B(1.5, 5.5, 10, 0x6a7a8a, ab.x + 7.5, 2.75, ab.z);
    this.addCollider(ab.x - 8.3, ab.x - 6.7, ab.z - 5, ab.z + 5, 5, 'bridge');
    this.addCollider(ab.x + 6.7, ab.x + 8.3, ab.z - 5, ab.z + 5, 5, 'bridge');

    // ---- CLUCKIN BELL (ch3) ----
    const cb = LOC.cluckin;
    B(14, 6, 12, 0xcc4422, cb.x, 3, cb.z - 8);
    this.addCollider(cb.x - 7, cb.x + 7, cb.z - 14, cb.z - 2, 6, 'cluckin');
    const cbSign = textPlane("CLUCKIN' BELL", 13, 2.6, '#aa2211', '#ffe08a');
    cbSign.position.set(cb.x, 5.2, cb.z - 1.95); scene.add(cbSign);
    B(1, 4, 1, 0x888888, cb.x + 8, 2, cb.z - 2);
    const menu = textPlane('DRIVE THRU\nMENU', 3, 3, '#222', '#ffd24a', 'bold 60px Impact');
    menu.position.set(cb.x + 8, 4.5, cb.z - 2); scene.add(menu);

    // ---- DEALERSHIP (ch2/ch4) ----
    const dl = LOC.dealership;
    B(24, 8, 18, 0x3a4a5a, dl.x, 4, dl.z - 8);
    this.addCollider(dl.x - 12, dl.x + 12, dl.z - 17, dl.z - 1, 8, 'dealership');
    // glass front (destructible in ch4)
    this.glassWall = B(20, 6, 0.4, 0x9fd8ff, dl.x, 3, dl.z + 1, { transparent: true, opacity: 0.4 });
    this.glassCollider = this.addCollider(dl.x - 10, dl.x + 10, dl.z + 0.6, dl.z + 1.4, 6, 'glass');
    const dlSign = textPlane('PREMIUM DELUXE MOTORSPORT', 22, 2.2, '#111', '#ffd24a', 'bold 40px Impact');
    dlSign.position.set(dl.x, 7.2, dl.z + 1.3); scene.add(dlSign);
    // employee of the month portrait inside
    this.portrait = textPlane('EMPLOYEE\nOF THE MONTH', 6, 7, '#3a2a10', '#ffd24a', 'bold 56px Impact');
    this.portrait.position.set(dl.x, 4, dl.z - 16.8); scene.add(this.portrait);
    this.simeonDesk = B(3, 1.2, 1.6, 0x6a4a2a, dl.x, 0.6, dl.z - 10);

    // ---- CONSTRUCTION (ch4) ----
    const cn = LOC.construction;
    for (const [dx, dz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) B(1, 16, 1, 0xddaa22, cn.x + dx, 8, cn.z + dz);
    this.scaffoldFloors = [];
    for (const y of [4, 8, 12]) {
      const f = B(18, 0.5, 18, 0x9a8a6a, cn.x, y, cn.z);
      this.scaffoldFloors.push(f);
    }
    B(18, 0.5, 18, 0x9a8a6a, cn.x, 0.25, cn.z);
    const crane = B(1.2, 26, 1.2, 0xddaa22, cn.x + 14, 13, cn.z);
    B(16, 1, 1, 0xddaa22, cn.x + 8, 25, cn.z);
    // TOP FUN van
    this.topFunVan = B(2.4, 2.6, 6, 0x2266aa, cn.x - 16, 1.3, cn.z + 12);
    const vanSign = textPlane('TOP FUN', 5, 1.6, '#2266aa', '#ffffff');
    vanSign.rotation.y = Math.PI / 2;
    vanSign.position.set(cn.x - 17.25, 1.8, cn.z + 12); scene.add(vanSign);
    this.addCollider(cn.x - 17.2, cn.x - 14.8, cn.z + 9, cn.z + 15, 2.6, 'van');

    // ---- MANSION (ch4) ----
    const mn = LOC.mansion;
    B(18, 9, 14, 0xf0e8d8, mn.x, 4.5, mn.z - 8);
    this.addCollider(mn.x - 9, mn.x + 9, mn.z - 15, mn.z - 1, 9, 'mansion');
    B(20, 0.3, 12, 0xb8b0a0, mn.x, 0.15, mn.z + 6);

    // ---- MOVIE STUDIO (ch2) ----
    const st = LOC.studio;
    B(20, 12, 16, 0x8a7a6a, st.x - 10, 6, st.z - 10);
    this.addCollider(st.x - 20, st.x, st.z - 18, st.z - 2, 12, 'studio');
    const stSign = textPlane('RICHARDS MAJESTIC', 18, 2.4, '#2a2a3a', '#e8d8a0');
    stSign.position.set(st.x - 10, 10.5, st.z - 1.9); scene.add(stSign);
    this.studioBarrier = B(10, 1.4, 0.4, 0xdddddd, st.x + 6, 0.7, st.z + 4);
    this.barrierCollider = this.addCollider(st.x + 1, st.x + 11, st.z + 3.7, st.z + 4.3, 1.4, 'barrier');

    // ---- PARKING GARAGE (ch2) ----
    const pg = LOC.garage;
    for (const y of [0.2, 4, 8]) B(20, 0.5, 16, 0x8a8a8a, pg.x, y, pg.z);
    for (const [dx, dz] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) B(1, 12, 1, 0x7a7a7a, pg.x + dx, 6, pg.z + dz);
    // roof ramp
    const ramp = B(8, 0.4, 10, 0x9a9a9a, pg.x, 9.4, pg.z + 11);
    ramp.rotation.x = -0.32;
    this.garageRamp = { x: pg.x, z: pg.z + 11, y: 8.2 };
    const pgSign = textPlane('PARKING', 8, 2, '#1a3a5a', '#ffffff');
    pgSign.position.set(pg.x, 11, pg.z - 8.2); scene.add(pgSign);

    // ---- FRANKLIN HOUSE + BARBERSHOP (ch2) ----
    const fr = LOC.franklin;
    B(12, 6, 10, 0xc8a878, fr.x, 3, fr.z - 6);
    this.addCollider(fr.x - 6, fr.x + 6, fr.z - 11, fr.z - 1, 6, 'franklin');
    const bs = LOC.barbershop;
    B(10, 5, 8, 0x6a4a8a, bs.x, 2.5, bs.z - 5);
    this.addCollider(bs.x - 5, bs.x + 5, bs.z - 9, bs.z - 1, 5, 'barbershop');
    const bsSign = textPlane('BARBERSHOP', 9, 1.8, '#3a2a5a', '#ff8adf');
    bsSign.position.set(bs.x, 4.2, bs.z - 0.95); scene.add(bsSign);

    // ---- PAY N SPRAY (ch5) ----
    const ps = LOC.paynspray;
    B(12, 6, 10, 0x4a4a52, ps.x, 3, ps.z - 6);
    this.addCollider(ps.x - 6, ps.x + 6, ps.z - 11, ps.z - 3.4, 6, 'paynspray');
    this.psDoor = B(8, 4.6, 0.4, 0x6a6a72, ps.x, 2.3, ps.z - 1);
    const psSign = textPlane("PAY 'N' SPRAY", 11, 2, '#222', '#67e05a');
    psSign.position.set(ps.x, 5.4, ps.z - 0.7); scene.add(psSign);

    // ---- ALLEY (ch5) ----
    const al = LOC.alley;
    B(6, 12, 34, 0x8a5a4a, al.x - 5, 6, al.z);
    B(6, 12, 34, 0x7a5a4a, al.x + 5, 6, al.z);
    this.addCollider(al.x - 8, al.x - 2, al.z - 17, al.z + 17, 12, 'alley');
    this.addCollider(al.x + 2, al.x + 8, al.z - 17, al.z + 17, 12, 'alley');

    // ---- railroad crossing sign (ch1) ----
    const cr = LOC.crossing;
    B(0.3, 4, 0.3, 0xdddddd, cr.x + 6, 2, cr.z + 6);
    const xsign = textPlane('RAILROAD\nCROSSING', 3, 2, '#111', '#ffd24a', 'bold 50px Impact');
    xsign.position.set(cr.x + 6, 4.5, cr.z + 6); scene.add(xsign);
  }

  setSnow(on) {
    if (on) {
      this.groundMat.color.set(0xe8eef4);
      this.roadMat.color.set(0xb8c4d0);
      this.sidewalkMat.color.set(0xd8e0e8);
      this.skyColor.set(0xc8d4e0);
      this.fog.color.set(0xc8d4e0); this.fog.near = 30; this.fog.far = 160;
      this.sun.intensity = 0.8; this.hemi.intensity = 0.8;
    } else {
      this.groundMat.color.set(0x6a7a5a);
      this.roadMat.color.set(0x3a3d42);
      this.sidewalkMat.color.set(0x9a9a92);
      this.skyColor.set(0x87b5e0);
      this.fog.color.set(0x87b5e0); this.fog.near = 90; this.fog.far = 340;
      this.sun.intensity = 1.4; this.hemi.intensity = 0.9;
    }
  }

  updateTrain(dt) {
    if (this.trainSpeed === 0) return;
    this.trainX += this.trainSpeed * this.trainDir * dt;
    if (this.trainX > HALF + 60) { this.trainX = HALF + 60; this.trainDir = -1; this.train.rotation.y = Math.PI; }
    if (this.trainX < -HALF - 60) { this.trainX = -HALF - 60; this.trainDir = 1; this.train.rotation.y = 0; }
    this.train.position.x = this.trainX;
  }

  destroyHydrant(idx, fx) {
    const h = this.hydrants[idx];
    if (!h || !h.alive) return;
    h.alive = false;
    const m4 = new THREE.Matrix4().makeScale(0, 0, 0);
    m4.setPosition(h.x, -10, h.z);
    this.hydrantInst.setMatrixAt(idx, m4);
    this.hydrantInst.instanceMatrix.needsUpdate = true;
    fx.geyser(h.x, h.z);
  }
}

