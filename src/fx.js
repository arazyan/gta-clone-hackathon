// Pooled particle FX: sparks, smoke, glass, geysers, snow, explosions, tracers.
import * as THREE from 'three';

const MAX = 3000;
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -1000;

    // snow (separate looping system)
    this.snowN = 900;
    this.snowPos = new Float32Array(this.snowN * 3);
    for (let i = 0; i < this.snowN; i++) {
      this.snowPos[i * 3] = (Math.random() - 0.5) * 120;
      this.snowPos[i * 3 + 1] = Math.random() * 40;
      this.snowPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
    this.snow.visible = false;
    this.snow.frustumCulled = false;
    scene.add(this.snow);

    // tracers pool
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
    // explosion flash lights pool
    this.flashes = [];
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b, grav = 9) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }

  burst(x, y, z, n, speed, life, color, grav = 9, spread = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z,
        Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + speed * 0.3, Math.sin(a) * Math.cos(b) * s,
        life * (0.6 + Math.random() * 0.7), c.r, c.g, c.b, grav);
    }
  }

  explosion(x, y, z, big = false) {
    this.burst(x, y + 1, z, big ? 90 : 45, big ? 18 : 11, 0.9, 0xff8833, 4);
    this.burst(x, y + 1, z, big ? 50 : 25, big ? 12 : 7, 1.4, 0x333333, -2);
    this.burst(x, y + 1, z, 20, 16, 0.4, 0xffee88, 6);
    const light = new THREE.PointLight(0xff8833, big ? 8 : 4, big ? 60 : 30);
    light.position.set(x, y + 3, z);
    this.scene.add(light);
    this.flashes.push({ light, t: 0.35 });
  }

  glass(x, y, z, n = 60) {
    for (let k = 0; k < n; k++) {
      this.spawn(x + (Math.random() - 0.5) * 14, y + Math.random() * 5, z,
        (Math.random() - 0.5) * 14, Math.random() * 9, 4 + Math.random() * 12,
        1.4, 0.65, 0.85, 0.95, 14);
    }
  }

  geyser(x, z) {
    this.geysers ||= [];
    this.geysers.push({ x, z, t: 4 });
  }

  sparks(x, y, z, n = 8) { this.burst(x, y, z, n, 6, 0.35, 0xffcc44, 12); }
  smoke(x, y, z, dark = true) {
    this.spawn(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.8, 1.5 + Math.random(), (Math.random() - 0.5) * 0.8,
      1.2, dark ? 0.15 : 0.6, dark ? 0.15 : 0.6, dark ? 0.15 : 0.6, -1);
  }
  fire(x, y, z) {
    this.spawn(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5),
      0.5, 1, 0.45 + Math.random() * 0.3, 0.1, -3);
  }
  sparkle(x, y, z) { this.burst(x, y + 1, z, 12, 3, 0.7, 0x88ffee, -1); }
  muzzle(x, y, z) { this.burst(x, y, z, 4, 3, 0.12, 0xffdd66, 0); }

  tracer(from, to, color = 0xffe08a) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, m);
    this.scene.add(line);
    this.tracers.push({ line, t: 0.09 });
  }

  setSnow(on, center) {
    this.snow.visible = on;
    if (on && center) this.snow.position.set(center.x, 0, center.z);
  }

  update(dt, center) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1000; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05 && this.grav[i] > 0) {
        this.pos[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] *= -0.3;
        this.vel[i * 3] *= 0.7; this.vel[i * 3 + 2] *= 0.7;
      }
      const f = this.life[i] / this.maxLife[i];
      // fade via darkening (points have no per-point alpha)
      const fade = Math.min(1, f * 2);
      // keep color; shrink handled globally — cheap approach: move dead below
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (let k = this.tracers.length - 1; k >= 0; k--) {
      const t = this.tracers[k]; t.t -= dt;
      t.line.material.opacity = Math.max(0, t.t / 0.09);
      if (t.t <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); this.tracers.splice(k, 1); }
    }
    for (let k = this.flashes.length - 1; k >= 0; k--) {
      const f = this.flashes[k]; f.t -= dt;
      f.light.intensity *= 0.85;
      if (f.t <= 0) { this.scene.remove(f.light); this.flashes.splice(k, 1); }
    }
    if (this.geysers) {
      for (let k = this.geysers.length - 1; k >= 0; k--) {
        const g = this.geysers[k]; g.t -= dt;
        for (let n = 0; n < 4; n++) {
          this.spawn(g.x, 0.5, g.z, (Math.random() - 0.5) * 2, 9 + Math.random() * 5, (Math.random() - 0.5) * 2, 1.1, 0.6, 0.75, 0.95, 12);
        }
        if (g.t <= 0) this.geysers.splice(k, 1);
      }
    }
    if (this.snow.visible) {
      if (center) this.snow.position.set(center.x, 0, center.z);
      for (let i = 0; i < this.snowN; i++) {
        this.snowPos[i * 3 + 1] -= (4 + (i % 3)) * dt;
        this.snowPos[i * 3] += Math.sin(i + performance.now() * 0.001) * dt * 0.6;
        if (this.snowPos[i * 3 + 1] < 0) this.snowPos[i * 3 + 1] = 40;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}