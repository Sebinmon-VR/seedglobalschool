import * as THREE from 'three';
import { Tree } from './Tree.js';
import { Island } from './Island.js';
import { Seed } from './Seed.js';
import { Sky, Motes, Petals } from './Atmosphere.js';
import { Kids } from './Kids.js';
import { clamp } from './utils.js';

const DEG = Math.PI / 180;

export class World {
  /**
   * quality   => scene density (leaves, grass, particles)
   * antialias => MSAA (cheap on phone GPUs, so phones keep it on)
   * maxDpr    => sharpest pixel ratio to start at; if frames run slow the
   *              resolution steps down automatically (see adaptResolution)
   */
  constructor(canvas, { quality = 1, shadows = true, antialias = quality >= 1, maxDpr = quality >= 1 ? 1.75 : 1.4 } = {}) {
    this.quality = quality;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.minDpr = Math.min(this.dpr, 1);
    this.adaptive = true;
    this.perf = { frames: 0, sum: 0, n: 0, last: 0 };
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    this.camera.position.set(0, 1.5, 6);
    this.target = new THREE.Vector3();

    /* ---------- lights ---------- */
    this.hemi = new THREE.HemisphereLight('#e4f4ff', '#7a6646', 1.25);
    this.sun = new THREE.DirectionalLight('#fff0cf', 2.6);
    this.sun.position.set(7, 14, 6);
    this.sun.castShadow = shadows;
    if (shadows) {
      const s = this.sun.shadow;
      s.mapSize.set(2048, 2048);
      s.camera.left = -9;
      s.camera.right = 9;
      s.camera.top = 12;
      s.camera.bottom = -6;
      s.camera.near = 2;
      s.camera.far = 40;
      s.bias = -0.0005;
      s.normalBias = 0.03;
      s.radius = 3;
    }
    this.rim = new THREE.DirectionalLight('#bfe6ff', 0.6);
    this.rim.position.set(-8, 6, -7);
    // soft key light that travels with the camera so the children's faces stay bright
    this.fill = new THREE.DirectionalLight('#fff3e3', 0.7);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.rim, this.fill, this.fill.target);

    /* ---------- objects ---------- */
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);

    this.tree = new Tree({ quality, shadows });
    this.island = new Island({ quality, shadows, uniforms: this.tree.uniforms });
    this.seed = new Seed({ shadows });
    this.motes = new Motes({ count: Math.round(520 * quality) });
    this.petals = new Petals({ count: Math.round(260 * quality) });
    this.kids = new Kids({ shadows });

    this.root = new THREE.Group();
    this.root.add(this.island.group, this.tree.group, this.seed.group, this.kids.group, this.motes.points, this.petals.mesh);
    this.state = null;
    this.lastTime = 0;
    this.scene.add(this.root);

    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this._up = new THREE.Vector3();
    this.shake = 0;
    this.size = { w: 1, h: 1 };
    this.pointScale = 10;
    this.resize();
  }

  resize() {
    // size to the canvas box itself (CSS: 100vw x 100lvh) so the picture is never
    // stretched when a phone's address bar shows or hides
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.size = { w, h };
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.85 ? 50 : 40;
    this.camera.updateProjectionMatrix();
    this.narrow = window.innerWidth < 900;
    this.pointScale = this.renderer.getPixelRatio() * h * 0.012;
  }

  setDpr(dpr) {
    this.dpr = dpr;
    this.resize();
  }

  /**
   * Keep scrolling smooth on slower devices: if frames average under ~45 fps,
   * drop the resolution a step (never below minDpr). Long gaps (tab hidden,
   * scene off screen) and the first couple of seconds are ignored.
   */
  adaptResolution(time) {
    const p = this.perf;
    const dt = time - p.last;
    p.last = time;
    if (!this.adaptive || ++p.frames < 120 || dt <= 0 || dt > 0.25) return;
    p.sum += dt;
    if (++p.n < 90) return;
    const avg = p.sum / p.n;
    p.sum = 0;
    p.n = 0;
    if (avg > 1 / 45 && this.dpr > this.minDpr) {
      this.setDpr(Math.max(this.minDpr, Math.round((this.dpr - 0.25) * 100) / 100));
      p.frames = 60; // let the new size settle before measuring again
    }
  }

  setPointer(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  /** Apply an interpolated scroll state (see Director). */
  apply(s, time) {
    this.state = s;
    const U = this.tree.uniforms;
    U.uGrow.value = s.grow;
    U.uRoots.value = s.roots;
    U.uLeaves.value = s.leaves;
    U.uBloom.value = s.bloom;
    U.uFruit.value = s.fruit;
    U.uWind.value = s.wind;
    this.island.setSoilOpacity(s.soil);

    const sky = this.sky.uniforms;
    sky.uTop.value.copy(s.skyTop);
    sky.uBottom.value.copy(s.skyBottom);
    sky.uSunColor.value.copy(s.sunColor);
    sky.uSunStrength.value = s.sunGlow;
    sky.uStars.value = s.stars;
    sky.uTime.value = time;

    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sun;
    this.hemi.intensity = s.hemi;
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.rim.intensity = 0.35 + s.stars * 0.5;

    this.motes.uniforms.uPollen.value = s.pollen;
    this.motes.uniforms.uFireflies.value = s.fireflies;
    this.petals.uniforms.uAmount.value = s.petals;

    /* camera: spherical coordinates around a look-at target */
    const p = this.pointer;
    p.sx += (p.x - p.sx) * 0.05;
    p.sy += (p.y - p.sy) * 0.05;
    let dist = s.dist;
    let shift = s.shift;
    let shiftY = 0;
    if (this.narrow) {
      const portrait = this.size.w / this.size.h < 0.8;
      dist *= portrait ? 1.5 : 1.2;
      shift = 0;
      shiftY = portrait ? 0.16 : 0.06; // lift the tree into the upper half on phones
    }
    const az = (s.az + p.sx * 4) * DEG;
    const el = clamp(s.el - p.sy * 2.5, -20, 80) * DEG;
    this.target.set(s.tx, s.ty, s.tz);
    this.camera.position.set(
      this.target.x + Math.sin(az) * Math.cos(el) * dist,
      this.target.y + Math.sin(el) * dist,
      this.target.z + Math.cos(az) * Math.cos(el) * dist,
    );
    // gentle breathing drift
    this.camera.position.y += Math.sin(time * 0.35) * 0.06 * dist * 0.1;
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.9;
    }
    this.camera.lookAt(this.target);
    this.fill.position.copy(this.camera.position).add(this._up.set(0, 2.5, 0));
    this.fill.target.position.copy(this.target);
    this.fill.intensity = s.fill;
    const { w, h } = this.size;
    this.camera.setViewOffset(w, h, -shift * w, shiftY * h, w, h);
  }

  render(time, open) {
    const dt = Math.min(Math.max(time - this.lastTime, 0), 0.05);
    this.lastTime = time;
    this.seed.update(open, time, this.pointScale);
    this.seed.topPoint(this.tree.sproutBase);
    this.tree.update(time);
    if (this.state) this.kids.update(time, dt, this.state);
    this.motes.uniforms.uTime.value = time;
    this.motes.uniforms.uPixel.value = this.pointScale;
    this.petals.uniforms.uTime.value = time;
    this.sky.mesh.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.adaptResolution(time);
  }
}
