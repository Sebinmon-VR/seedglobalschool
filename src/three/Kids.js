import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundHeight } from './Island.js';
import { clamp, lerp, smoothstep } from './utils.js';

/*
 * The children who plant the seed, water it and grow up with the tree. At the
 * end they step forward together under the full-grown tree and wave.
 * They use professionally modelled, rigged and animated glTF characters
 * listed in /assets/models/kids/kids.json (see README).
 * If no models are present the scene simply runs without children.
 */

const BASE = 'assets/models/kids/';
const DEG = Math.PI / 180;
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/* where each child stands around the tree, and where they gather at the end */
const SLOTS = [
  { role: 'planter', angle: 52, frontAngle: -33 },
  { role: 'waterer', angle: -58, frontAngle: -11 },
  { role: 'clap', angle: 128, frontAngle: 11 },
  { role: 'wave', angle: -128, frontAngle: 33 },
];

/* animation clips: names from kids.json, else matched by these patterns */
const CLIP_PATTERNS = {
  idle: /idle|breath|stand/i,
  wave: /wave|hello|greet/i,
  cheer: /cheer|victory|celebrat|happy|jump/i,
  clap: /clap|applau|yes|thumb/i,
  kneel: /kneel|plant|crouch|pick|gather|sit/i,
};
const BONE_PATTERNS = {
  handR: /(right.?hand|hand[._ ]?r|r[._ ]hand|palm\d?[._]r)$/i,
};

/* ---------- props (watering can) ---------- */
const PROP_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
function part(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...s)));
  const c = new THREE.Color(color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
// all props are built for a 1-unit-tall child and scaled with the child
const PROPS = {
  can: () => mergeGeometries([
    part(new THREE.CylinderGeometry(0.045, 0.05, 0.075, 18), '#2f9e6e', { pos: [0, -0.01, 0] }),
    part(new THREE.CylinderGeometry(0.046, 0.046, 0.012, 18), '#f2a93b', { pos: [0, 0.025, 0] }),
    part(new THREE.CylinderGeometry(0.006, 0.009, 0.12, 8), '#2f9e6e', { pos: [0, 0.012, 0.072], rot: [Math.PI / 2 - 0.55, 0, 0] }),
    part(new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), '#2f9e6e', { pos: [0, 0.03, -0.005], rot: [0, Math.PI / 2, 0] }),
  ]),
};

/* ------------------------------------------------------------------ */
class ModelKid {
  constructor(gltf, slot, cfg, shadows) {
    this.slot = slot;
    this.cfg = cfg;
    this.phase = Math.random() * 10;
    this.model = SkeletonUtils.clone(gltf.scene);
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
    // normalise to 1 unit tall, feet at y=0, facing +Z
    this.model.rotation.y = cfg.facing ?? 0;
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const h = Math.max(0.001, box.max.y - box.min.y);
    this.inner = new THREE.Group();
    this.inner.add(this.model);
    this.model.position.y = -box.min.y;
    this.inner.scale.setScalar(1 / h);
    this.root = new THREE.Group();
    this.root.add(this.inner);

    // animation
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const key of Object.keys(CLIP_PATTERNS)) {
      const wanted = cfg.clips?.[key];
      const clip =
        (wanted && gltf.animations.find((c) => c.name === wanted)) ||
        gltf.animations.find((c) => CLIP_PATTERNS[key].test(c.name));
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(key === 'idle' ? 1 : 0);
      action.play();
      action.time = Math.random() * clip.duration;
      this.actions[key] = action;
    }
    this.weights = Object.fromEntries(Object.keys(this.actions).map((k) => [k, k === 'idle' ? 1 : 0]));

    // bones for props
    this.bones = {};
    for (const key of Object.keys(BONE_PATTERNS)) {
      const wanted = cfg.bones?.[key];
      let found = null;
      this.model.traverse((o) => {
        if (found) return;
        if (wanted ? o.name === wanted : BONE_PATTERNS[key].test(o.name)) found = o;
      });
      this.bones[key] = found;
    }
  }

  update(dt, target) {
    // ease clip weights toward targets; idle fills the rest
    const keys = Object.keys(this.actions);
    let sum = 0;
    for (const k of keys) {
      if (k === 'idle') continue;
      const t = target[k] ?? 0;
      this.weights[k] += (t - this.weights[k]) * Math.min(1, dt * 6);
      sum += this.weights[k];
    }
    if (this.actions.idle) this.weights.idle = Math.max(0, 1 - sum);
    for (const k of keys) this.actions[k].setEffectiveWeight(this.weights[k]);
    this.mixer.update(dt);
  }
}

/* ------------------------------------------------------------------ */
class Droplets {
  constructor(count = 90) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: '#a9dcff', size: 0.045, transparent: true, opacity: 0.85, depthWrite: false }));
    this.points.frustumCulled = false;
    this.cursor = 0;
    this.acc = 0;
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -99;
  }
  update(dt, emitter, rate, dir) {
    if (emitter && rate > 0) {
      this.acc += dt * rate;
      while (this.acc > 1) {
        this.acc -= 1;
        const i = this.cursor++ % this.count;
        this.pos.set([emitter.x + (Math.random() - 0.5) * 0.03, emitter.y, emitter.z + (Math.random() - 0.5) * 0.03], i * 3);
        this.vel.set([dir.x * 0.9 + (Math.random() - 0.5) * 0.25, 0.25 + Math.random() * 0.2, dir.z * 0.9 + (Math.random() - 0.5) * 0.25], i * 3);
        this.life[i] = 1;
      }
    }
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.vel[i * 3 + 1] -= 6.5 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < groundHeight(this.pos[i * 3], this.pos[i * 3 + 2])) {
        this.life[i] = 0;
        this.pos[i * 3 + 1] = -99;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
export class Kids {
  constructor({ shadows = true } = {}) {
    this.shadows = shadows;
    this.group = new THREE.Group();
    this.kids = [];
    this.props = [];
    this.droplets = new Droplets();
    this.group.add(this.droplets.points);
    this.dropping = false;
    this.impactAt = -99;
    this.appear = 0;
    this._v = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this.ready = this.load();
  }

  /** Load kids.json and the character models it lists. Missing files → no kids. */
  async load() {
    let cfg;
    try {
      const res = await fetch(`${BASE}kids.json`, { cache: 'no-cache' });
      if (!res.ok) return false;
      cfg = await res.json();
    } catch {
      return false;
    }
    const loader = new GLTFLoader();
    const files = (cfg.models || []).map((m) => (typeof m === 'string' ? { file: m } : m));
    const gltfs = await Promise.all(files.map((m) => loader.loadAsync(BASE + m.file).catch((e) => (console.warn('[SEED] kid model failed', m.file, e), null))));
    const order = cfg.slots || SLOTS.map((_, i) => i % files.length);
    SLOTS.forEach((slot, i) => {
      const mi = order[i] ?? i % files.length;
      const gltf = gltfs[mi];
      if (!gltf) return;
      const kid = new ModelKid(gltf, slot, { ...cfg, ...files[mi], clips: { ...cfg.clips, ...files[mi].clips }, bones: { ...cfg.bones, ...files[mi].bones } }, this.shadows);
      // watering can, sized for a 1-unit child and scaled with it
      if (slot.role === 'waterer') {
        kid.can = this.prop(PROPS.can(), PROP_MAT);
        kid.spout = new THREE.Vector3(0, 0.05, 0.13);
      }
      this.kids.push(kid);
      this.group.add(kid.root);
    });
    return this.kids.length > 0;
  }

  prop(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = this.shadows;
    m.visible = false;
    this.group.add(m);
    return m;
  }

  seedFalling() {
    this.dropping = true;
    gsap.to(this, { appear: 1, duration: 0.6, ease: 'power2.out' });
  }
  seedLanded() {
    this.dropping = false;
    this.impactAt = gsap.ticker.time;
  }
  skipIntro() {
    this.appear = 1;
    this.impactAt = gsap.ticker.time - 10;
  }

  update(t, dt, s) {
    if (!this.kids.length) {
      this.droplets.update(dt, null, 0, this._dir);
      return;
    }
    const sinceImpact = t - this.impactAt;
    const grow = s.grow;
    const gather = clamp(s.gather);
    const introCheer = smoothstep(0, 0.12, sinceImpact) * (1 - smoothstep(1.6, 2.2, sinceImpact));
    const sprouting = smoothstep(0.004, 0.02, grow) * (1 - smoothstep(0.1, 0.16, grow));
    const age = clamp(s.age);
    const height = lerp(1.05, 1.7, age);
    const spread = lerp(1.4, 2.6, age);
    const pop = easeOutBack(clamp(this.appear));
    const g = smoothstep(0, 1, gather);
    let pouring = false;

    for (const kid of this.kids) {
      const { role, angle, frontAngle } = kid.slot;
      const w = { cheer: 0, wave: 0, clap: 0, kneel: 0 };
      let rad = spread;
      if (role === 'planter') {
        w.kneel = smoothstep(1.6, 2.4, sinceImpact) * (1 - smoothstep(0.03, 0.12, grow));
        rad = lerp(rad, 0.75, w.kneel);
      }
      const hold = role === 'waterer' ? (1 - smoothstep(0.25, 0.4, age)) * (1 - gather) : 0;
      const pour = role === 'waterer' ? clamp(s.water) * hold : 0;
      if (role === 'waterer') rad = lerp(rad, 1.15, pour);
      if (role === 'clap' || role === 'wave') w.clap = sprouting;
      if (role === 'wave') w.wave = Math.pow(Math.max(0, Math.sin(t * 0.45 + 1)), 8) * (1 - g) * (1 - w.clap);
      // gathered at the end: every child waves now and then, a little out of step
      w.wave = Math.max(w.wave, g * Math.pow(Math.max(0, Math.sin(t * 0.5 + kid.phase)), 6));
      w.cheer = introCheer;
      if (w.cheer > 0) w.kneel *= 1 - w.cheer;

      let x = Math.sin(angle * DEG) * rad;
      let z = Math.cos(angle * DEG) * rad;
      x = lerp(x, Math.sin(frontAngle * DEG) * 3.0, g);
      z = lerp(z, Math.cos(frontAngle * DEG) * 3.0, g);
      kid.root.position.set(x, groundHeight(x, z) - 0.01, z);
      const faceTree = Math.atan2(-x, -z);
      let face = lerpAngle(faceTree, 0, 0.5);
      if (w.kneel > 0 || pour > 0) face = lerpAngle(face, faceTree, Math.max(w.kneel, pour));
      face = lerpAngle(face, 0, gather);
      kid.root.rotation.y = face;
      const sc = height * Math.max(0.0001, pop);
      kid.root.scale.setScalar(sc);

      kid.update(dt, w);
      kid.root.updateMatrixWorld(true);

      if (kid.can) {
        kid.can.visible = hold > 0.02 && !!kid.bones.handR;
        if (kid.can.visible) {
          kid.bones.handR.getWorldPosition(this._v);
          kid.can.position.copy(this._v);
          kid.can.quaternion.setFromEuler(new THREE.Euler(pour * 0.8, face, 0, 'YXZ'));
          kid.can.scale.setScalar(sc * hold);
          if (pour > 0.35) {
            pouring = true;
            const tip = this._v.copy(kid.spout).multiplyScalar(sc).applyQuaternion(kid.can.quaternion).add(kid.can.position);
            this.droplets.update(dt, tip, 60 * pour, this._dir.set(Math.sin(face), 0, Math.cos(face)));
          }
        }
      }
    }
    if (!pouring) this.droplets.update(dt, null, 0, this._dir);
  }
}
