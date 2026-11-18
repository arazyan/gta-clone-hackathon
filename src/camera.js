// Unified dual-camera rig: 3D third-person chase + 2.5D isometric (same scene).
import * as THREE from 'three';
import { S } from './state.js';
import { sfx } from './audio.js';

export class CameraRig {
  constructor(aspect) {
    this.persp = new THREE.PerspectiveCamera(60, aspect, 0.1, 600);
    this.ortho = new THREE.OrthographicCamera(-40, 40, 25, -25, 0.1, 600);
    this.persp.position.set(0, 8, -12);
    this.ortho.position.set(40, 45, 40);
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
    this.transition = 0;
    this.isoHalf = 30;
  }

  get camera() { return S.cameraMode === 'iso' ? this.ortho : this.persp; }

  toggle() {
    S.cameraMode = S.cameraMode === '3d' ? 'iso' : '3d';
    this.transition = 0.55;
    sfx.skycam();
    window.dispatchEvent(new CustomEvent('gtv-skycam', { detail: S.cameraMode }));
  }

  addShake(n) { this.shake = Math.min(1.5, this.shake + n); }

  resize(aspect) {
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
    this.aspect = aspect;
  }

  update(dt, target) {
    const { pos, heading, speed, maxSpeed, vehicle } = target;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const sp = Math.min(1, speed / (maxSpeed || 30));
    const damp = 1 - Math.exp(-4.5 * dt);

    if (S.cameraMode === '3d') {
      const dist = vehicle ? 9.5 + sp * 2.5 : 7;
      const height = vehicle ? 4.2 + sp * 1.2 : 3.4;
      const desired = new THREE.Vector3(
        pos.x - fx * dist,
        pos.y + height,
        pos.z - fz * dist
      );
      // pull camera in if a building blocks the view
      const cols = this._world ? this._world.nearbyColliders(pos.x, pos.z) : [];
      let t = 1;
      for (let s = 0.2; s <= 1; s += 0.2) {
        const px = pos.x + (desired.x - pos.x) * s;
        const pz = pos.z + (desired.z - pos.z) * s;
        const py = pos.y + (desired.y - pos.y) * s;
        for (const c of cols) {
          if (px > c.minX - 0.5 && px < c.maxX + 0.5 && pz > c.minZ - 0.5 && pz < c.maxZ + 0.5 && py < c.h + 0.5) {
            t = Math.min(t, Math.max(0.15, s - 0.2));
          }
        }
      }
      desired.lerpVectors(new THREE.Vector3(pos.x, pos.y + 2, pos.z), desired, t);
      this.persp.position.lerp(desired, damp);
      this.lookAt.lerp(new THREE.Vector3(pos.x + fx * 4, pos.y + 1.6, pos.z + fz * 4), damp);
      this.persp.fov = 60 + sp * 12;
      this.persp.updateProjectionMatrix();
      this.persp.lookAt(this.lookAt);
    } else {
      const desired = new THREE.Vector3(pos.x + 38, pos.y + 44, pos.z + 38);
      this.ortho.position.lerp(desired, 1 - Math.exp(-6 * dt));
      this.lookAt.lerp(new THREE.Vector3(pos.x + fx * sp * 6, pos.y, pos.z + fz * sp * 6), damp);
      const half = 26 + sp * 16;
      this.isoHalf += (half - this.isoHalf) * damp;
      const a = this.aspect || 1.7;
      this.ortho.left = -this.isoHalf * a; this.ortho.right = this.isoHalf * a;
      this.ortho.top = this.isoHalf; this.ortho.bottom = -this.isoHalf;
      this.ortho.updateProjectionMatrix();
      this.ortho.lookAt(this.lookAt);
    }

    // shake
    if (this.shake > 0.01) {
      const cam = this.camera;
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      cam.position.z += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake *= Math.exp(-4 * dt);
    }
    if (this.transition > 0) this.transition -= dt;
  }
}