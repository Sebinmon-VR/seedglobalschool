import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng, lerp, clamp, smoothstep, makeBarkTexture } from './utils.js';
import { patchWood, patchFoliage } from './shaders.js';
import { islandRadiusAt } from './Island.js';

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function perpendicular(v, angle, out = new THREE.Vector3()) {
  const ref = Math.abs(v.y) < 0.98 ? UP : X_AXIS;
  const b1 = new THREE.Vector3().crossVectors(v, ref).normalize();
  const b2 = new THREE.Vector3().crossVectors(v, b1).normalize();
  return out.copy(b1).multiplyScalar(Math.cos(angle)).addScaledVector(b2, Math.sin(angle));
}

/* ------------------------------------------------------------------ */
/*  Branch skeleton generator (shared by tree + roots)                 */
/* ------------------------------------------------------------------ */
function generateSkeleton(cfg, rng) {
  const branches = [];
  const tmp = new THREE.Vector3();

  function add(start, dir, length, radius, t0, depth) {
    const segs = cfg.segments[depth];
    const pts = [start.clone()];
    const d = dir.clone().normalize();
    let p = start.clone();
    for (let i = 1; i <= segs; i++) {
      d.addScaledVector(rng.unitVector(tmp), cfg.wobble[depth]);
      d.y += cfg.tropism[depth];
      d.normalize();
      p = p.clone().addScaledVector(d, length / segs);
      if (cfg.constrain) cfg.constrain(p);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const branch = {
      curve, length, depth,
      r0: radius,
      r1: Math.max(cfg.minRadius, radius * cfg.taper[depth]),
      t0, t1: t0 + length * cfg.speed[depth],
    };
    branches.push(branch);
    if (depth >= cfg.maxDepth) return;

    const n = cfg.children[depth];
    const hasLeader = cfg.leader[depth];
    const lateral = hasLeader ? n - 1 : n;
    for (let i = 0; i < n; i++) {
      const isLeader = hasLeader && i === n - 1;
      const u = isLeader
        ? 0.96
        : lerp(cfg.spawn[depth][0], cfg.spawn[depth][1], (i + rng.range(0.15, 0.85)) / lateral);
      const pos = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const az = i * 2.39996 + rng.range(0, 1.1) + depth * 1.3;
      const perp = perpendicular(tan, az);
      const ang = THREE.MathUtils.degToRad(
        isLeader ? rng.range(4, 14) : rng.range(cfg.angle[depth][0], cfg.angle[depth][1]),
      );
      const cdir = tan.clone().multiplyScalar(Math.cos(ang)).addScaledVector(perp, Math.sin(ang));
      cdir.y += isLeader ? 0.05 : cfg.lift[depth];
      cdir.normalize();
      let lenScale = isLeader ? rng.range(0.62, 0.74) : rng.range(cfg.lengthScale[depth][0], cfg.lengthScale[depth][1]);
      if (depth === 0 && !isLeader) lenScale *= 1.18 - 0.42 * u; // lower limbs reach further -> rounded crown
      const rAtU = lerp(branch.r0, branch.r1, u);
      add(
        pos, cdir, length * lenScale,
        Math.max(cfg.minRadius, rAtU * (isLeader ? 0.86 : cfg.childRadius)),
        lerp(branch.t0, branch.t1, u),
        depth + 1,
      );
    }
  }

  add(cfg.origin, cfg.dir, cfg.length, cfg.radius, 0, 0);
  const maxT = Math.max(...branches.map((b) => b.t1));
  for (const b of branches) {
    b.t0 /= maxT;
    b.t1 /= maxT;
  }
  return branches;
}

/* ------------------------------------------------------------------ */
/*  Tube mesh with per-vertex growth data                              */
/* ------------------------------------------------------------------ */
function buildTubes(branches, { radial, tubular, flare = 0, uvScale = 1.4 }) {
  let vCount = 0;
  let iCount = 0;
  for (const b of branches) {
    const tub = tubular[b.depth];
    const rad = radial[b.depth];
    vCount += (tub + 1) * (rad + 1);
    iCount += tub * rad * 6;
  }
  const position = new Float32Array(vCount * 3);
  const normal = new Float32Array(vCount * 3);
  const center = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const growT = new Float32Array(vCount);
  const index = new Uint32Array(iCount);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  let v = 0;
  let ii = 0;

  for (const b of branches) {
    const tub = tubular[b.depth];
    const rad = radial[b.depth];
    const frames = b.curve.computeFrenetFrames(tub, false);
    const base = v;
    for (let i = 0; i <= tub; i++) {
      const u = i / tub;
      b.curve.getPointAt(u, P);
      let r = lerp(b.r0, b.r1, u);
      if (b.depth === 0 && flare) r *= 1 + flare * Math.pow(1 - u, 7);
      if (i === tub) r *= 0.3;
      const fn = frames.normals[i];
      const fb = frames.binormals[i];
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2;
        const s = Math.sin(a);
        const c = -Math.cos(a);
        N.set(c * fn.x + s * fb.x, c * fn.y + s * fb.y, c * fn.z + s * fb.z).normalize();
        position[v * 3] = P.x + r * N.x;
        position[v * 3 + 1] = P.y + r * N.y;
        position[v * 3 + 2] = P.z + r * N.z;
        normal[v * 3] = N.x;
        normal[v * 3 + 1] = N.y;
        normal[v * 3 + 2] = N.z;
        center[v * 3] = P.x;
        center[v * 3 + 1] = P.y;
        center[v * 3 + 2] = P.z;
        uv[v * 2] = (j / rad) * Math.max(1, Math.round(r * 9));
        uv[v * 2 + 1] = (u * b.length) / uvScale;
        growT[v] = lerp(b.t0, b.t1, u);
        v++;
      }
    }
    for (let i = 0; i < tub; i++) {
      for (let j = 0; j < rad; j++) {
        const a = base + i * (rad + 1) + j;
        const bb = base + (i + 1) * (rad + 1) + j;
        const c = bb + 1;
        const d = a + 1;
        index[ii++] = a; index[ii++] = bb; index[ii++] = d;
        index[ii++] = bb; index[ii++] = c; index[ii++] = d;
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  g.setAttribute('aGrowT', new THREE.BufferAttribute(growT, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ */
/*  Foliage geometries                                                 */
/* ------------------------------------------------------------------ */
function makeLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.34, 0.2, 0.3, 0.72, 0, 1);
  shape.bezierCurveTo(-0.3, 0.72, -0.34, 0.2, 0, 0);
  const g = new THREE.ShapeGeometry(shape, 7);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.45 - y * y * 0.18); // fold along midrib + curl back
  }
  g.translate(0, 0.04, 0);
  g.computeVertexNormals();
  return g;
}

function makeBlossomGeometry() {
  const petals = [];
  const petal = new THREE.Shape();
  petal.moveTo(0, 0);
  petal.bezierCurveTo(0.16, 0.08, 0.16, 0.3, 0, 0.36);
  petal.bezierCurveTo(-0.16, 0.3, -0.16, 0.08, 0, 0);
  const base = new THREE.ShapeGeometry(petal, 5);
  const pinkDeep = new THREE.Color('#e86f93');
  const white = new THREE.Color('#fff2f5');
  for (let k = 0; k < 5; k++) {
    const g = base.clone();
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, y * y * 0.9); // cup the petal upwards
      c.copy(pinkDeep).lerp(white, clamp(y / 0.3));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.rotateZ((k / 5) * Math.PI * 2);
    petals.push(g);
  }
  const center = new THREE.IcosahedronGeometry(0.06, 1);
  const cc = new Float32Array(center.attributes.position.count * 3);
  const gold = new THREE.Color('#ffcf4a');
  for (let i = 0; i < center.attributes.position.count; i++) cc.set([gold.r, gold.g, gold.b], i * 3);
  center.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  center.translate(0, 0, 0.03);
  const nonIndexed = [...petals, center].map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return n;
  });
  const merged = mergeGeometries(nonIndexed);
  merged.computeVertexNormals();
  return merged;
}

function makeFruitGeometry() {
  const body = new THREE.SphereGeometry(0.14, 18, 14);
  body.scale(1, 1.12, 1);
  body.translate(0, -0.2, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.1, 6);
  stem.translate(0, -0.05, 0);
  const paint = (g, hex) => {
    const c = new THREE.Color(hex);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) arr.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g.toNonIndexed();
  };
  return mergeGeometries([paint(body, '#ffffff'), paint(stem, '#5a3a20')]);
}

/* ------------------------------------------------------------------ */
/*  Foliage scattering                                                 */
/* ------------------------------------------------------------------ */
function scatter(branches, rng, { depths, perBranch, uRange, jitter = 0.05, filter }) {
  const out = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  for (const b of branches) {
    const count = perBranch[b.depth];
    if (!depths.includes(b.depth) || !count) continue;
    for (let i = 0; i < count; i++) {
      const u = rng.range(uRange[0], uRange[1]);
      b.curve.getPointAt(u, P);
      b.curve.getTangentAt(u, T);
      const pos = P.clone().addScaledVector(rng.unitVector(), jitter);
      if (filter && !filter(pos, b, u)) continue;
      out.push({ pos, tan: T.clone(), wood: lerp(b.t0, b.t1, u), depth: b.depth });
    }
  }
  return out;
}

function buildInstanced(geometry, material, depthMaterial, items, { orient, scale, colors, birth, rng }) {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const aBirth = new Float32Array(items.length);
  const aWood = new Float32Array(items.length);
  const aPhase = new Float32Array(items.length);
  items.forEach((it, i) => {
    orient(it, q);
    const k = scale(it);
    s.set(k, k, k);
    m.compose(it.pos, q, s);
    mesh.setMatrixAt(i, m);
    if (colors) mesh.setColorAt(i, c.set(rng.pick(colors)).offsetHSL(rng.range(-0.015, 0.015), 0, rng.range(-0.05, 0.05)));
    aBirth[i] = birth(it, i);
    aWood[i] = it.wood;
    aPhase[i] = rng.next();
  });
  geometry.setAttribute('aBirth', new THREE.InstancedBufferAttribute(aBirth, 1));
  geometry.setAttribute('aWood', new THREE.InstancedBufferAttribute(aWood, 1));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (depthMaterial) mesh.customDepthMaterial = depthMaterial;
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ */
/*  Tree                                                               */
/* ------------------------------------------------------------------ */
export class Tree {
  constructor({ quality = 1, shadows = true } = {}) {
    this.group = new THREE.Group();
    const rng = createRng(2017); // the year SEED was planted
    const u = (value) => ({ value });
    this.uniforms = {
      uTime: u(0),
      uWind: u(0.8),
      uGrow: u(0),
      uTaper: u(0.03),
      uRoots: u(0),
      uRootTaper: u(0.05),
      uLeaves: u(0),
      uBloom: u(0),
      uFruit: u(0),
    };
    const U = this.uniforms;

    /* ---------- trunk + branches ---------- */
    const treeCfg = {
      origin: new THREE.Vector3(0, -0.05, 0),
      dir: new THREE.Vector3(0.05, 1, 0.03),
      length: 3.7,
      radius: 0.34,
      maxDepth: 4,
      segments: [6, 5, 4, 3, 3],
      wobble: [0.07, 0.15, 0.2, 0.26, 0.3],
      tropism: [0.03, 0.07, 0.05, 0.03, 0.0],
      children: [8, 4, 3, quality < 1 ? 2 : 3],
      leader: [true, true, false, false],
      spawn: [[0.42, 0.9], [0.3, 0.92], [0.3, 0.95], [0.35, 0.95]],
      angle: [[38, 62], [28, 50], [26, 48], [24, 46]],
      lift: [0.12, 0.06, 0.02, -0.04],
      lengthScale: [[0.68, 0.86], [0.55, 0.74], [0.55, 0.74], [0.5, 0.7]],
      taper: [0.48, 0.42, 0.4, 0.36, 0.3],
      childRadius: 0.6,
      minRadius: 0.014,
      speed: [1, 1, 1, 1, 1],
    };
    const branches = generateSkeleton(treeCfg, rng);
    this.branches = branches;
    this.trunk = branches[0];

    const bark = makeBarkTexture();
    const woodMat = patchWood(
      new THREE.MeshStandardMaterial({ color: '#f1dcc4', map: bark, bumpMap: bark, bumpScale: 2.5, roughness: 0.9 }),
      { uTime: U.uTime, uWind: U.uWind, uGrow: U.uGrow, uTaper: U.uTaper },
      { tint: true },
    );
    const woodDepth = patchWood(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), {
      uTime: U.uTime, uWind: U.uWind, uGrow: U.uGrow, uTaper: U.uTaper,
    });
    const woodGeo = buildTubes(branches, {
      radial: [14, 10, 8, 6, 5],
      tubular: [28, 16, 10, 8, 6],
      flare: 0.95,
    });
    this.wood = new THREE.Mesh(woodGeo, woodMat);
    this.wood.customDepthMaterial = woodDepth;
    this.wood.castShadow = shadows;
    this.wood.receiveShadow = shadows;
    this.wood.frustumCulled = false;
    this.group.add(this.wood);

    /* ---------- roots ---------- */
    const rootCfg = {
      origin: new THREE.Vector3(0, 0.0, 0),
      dir: new THREE.Vector3(0, -1, 0),
      length: 2.1,
      radius: 0.2,
      maxDepth: 3,
      segments: [5, 4, 4, 3],
      wobble: [0.22, 0.32, 0.38, 0.42],
      tropism: [-0.03, -0.06, -0.05, -0.05],
      children: [8, 3, 3],
      leader: [false, false, false],
      spawn: [[0.02, 0.8], [0.15, 0.9], [0.2, 0.92]],
      angle: [[62, 88], [28, 58], [28, 58]],
      lift: [0.22, 0.02, 0.0],
      lengthScale: [[1.0, 1.45], [0.5, 0.75], [0.5, 0.7]],
      taper: [0.25, 0.3, 0.3, 0.3],
      childRadius: 0.62,
      minRadius: 0.012,
      speed: [1, 1, 1, 1],
      constrain: (p) => {
        p.y = clamp(p.y, -3.1, -0.12);
        const maxR = Math.max(0.3, islandRadiusAt(p.y) - 0.45);
        const r = Math.hypot(p.x, p.z);
        if (r > maxR) {
          p.x *= maxR / r;
          p.z *= maxR / r;
        }
      },
    };
    const roots = generateSkeleton(rootCfg, createRng(679584));
    const rootMat = patchWood(
      new THREE.MeshStandardMaterial({
        color: '#e7c89a',
        roughness: 0.7,
        emissive: '#e0a25a',
        emissiveIntensity: 0.55,
      }),
      { uTime: U.uTime, uWind: U.uWind, uGrow: U.uRoots, uTaper: U.uRootTaper },
      { sway: false },
    );
    this.roots = new THREE.Mesh(
      buildTubes(roots, { radial: [10, 7, 5, 4], tubular: [18, 12, 8, 6] }),
      rootMat,
    );
    this.roots.frustumCulled = false;
    this.group.add(this.roots);

    /* ---------- leaves ---------- */
    // leaves sit on every shoot (and the upper trunk) so the tree is leafy at every age
    const leafItems = scatter(branches, rng, {
      depths: [0, 1, 2, 3, 4],
      perBranch: [Math.round(18 * quality), Math.round(6 * quality), Math.round(4 * quality), Math.round(6 * quality), Math.round(10 * quality)],
      uRange: [0.2, 1],
      jitter: 0.08,
      filter: (pos, b, u) => b.depth > 0 || u > 0.5,
    });
    const leafMat = patchFoliage(
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.62, metalness: 0 }),
      { uTime: U.uTime, uWind: U.uWind, uProg: U.uLeaves, uGrow: U.uGrow },
      { flutter: 0.14, withWood: true },
    );
    const leafDepth = patchFoliage(
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
      { uTime: U.uTime, uWind: U.uWind, uProg: U.uLeaves, uGrow: U.uGrow },
      { flutter: 0.14, withWood: true },
    );
    const leafColors = ['#2f7d4f', '#3d9455', '#58ad62', '#1f6b4a', '#78bf68', '#2a8c6e', '#9ccc5a', '#47a06b'];
    const axis = new THREE.Vector3();
    const q2 = new THREE.Quaternion();
    this.leaves = buildInstanced(makeLeafGeometry(), leafMat, leafDepth, leafItems, {
      rng,
      colors: leafColors,
      orient: (it, q) => {
        const out = perpendicular(it.tan, rng.range(0, Math.PI * 2));
        axis.copy(out).addScaledVector(it.tan, 0.55).addScaledVector(rng.unitVector(), 0.45);
        axis.y += 0.3;
        axis.normalize();
        q.setFromUnitVectors(Y_AXIS, axis);
        q2.setFromAxisAngle(axis, rng.range(0, Math.PI * 2));
        q.premultiply(q2);
      },
      scale: (it) => rng.range(0.3, 0.5) * (it.depth === 4 ? 1 : 1.12),
      birth: () => rng.range(0.004, 0.05), // small delay after the wood appears
    });
    this.leaves.castShadow = shadows;
    this.leaves.receiveShadow = false;
    this.group.add(this.leaves);

    /* ---------- blossoms ---------- */
    const blossomItems = scatter(branches, rng, {
      depths: [3, 4],
      perBranch: [0, 0, 0, Math.round(1 * quality), Math.round(2 * quality)],
      uRange: [0.55, 1],
      jitter: 0.12,
    });
    const blossomMat = patchFoliage(
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, emissive: '#ff9fbf', emissiveIntensity: 0.12 }),
      { uTime: U.uTime, uWind: U.uWind, uProg: U.uBloom, uGrow: U.uGrow },
      { flutter: 0.05 },
    );
    this.blossoms = buildInstanced(makeBlossomGeometry(), blossomMat, null, blossomItems, {
      rng,
      colors: ['#ffffff', '#ffe3ec', '#ffd0de', '#fff6e8'],
      orient: (it, q) => {
        axis.copy(it.pos).setY(0).normalize().multiplyScalar(0.8);
        axis.y += 0.6;
        axis.addScaledVector(rng.unitVector(), 0.5).normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      },
      scale: () => rng.range(0.55, 0.85),
      birth: () => rng.range(0, 0.85),
    });
    this.group.add(this.blossoms);

    /* ---------- golden fruit ---------- */
    const fruitItems = scatter(branches, rng, {
      depths: [3],
      perBranch: [0, 0, 0, 1, 0],
      uRange: [0.45, 0.9],
      jitter: 0.02,
      filter: (p) => Math.hypot(p.x, p.z) > 1.2 && p.y > 3.2 && rng.next() < 0.55,
    });
    const fruitMat = patchFoliage(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        color: '#f6b733',
        roughness: 0.28,
        clearcoat: 0.9,
        clearcoatRoughness: 0.15,
        emissive: '#f08c1a',
        emissiveIntensity: 0.35,
      }),
      { uTime: U.uTime, uWind: U.uWind, uProg: U.uFruit, uGrow: U.uGrow },
      { flutter: 0.02, hang: true },
    );
    this.fruits = buildInstanced(makeFruitGeometry(), fruitMat, null, fruitItems, {
      rng,
      colors: ['#ffffff', '#fff1d6', '#ffe0b0'],
      orient: (it, q) => q.identity(),
      scale: () => rng.range(0.85, 1.15),
      birth: () => rng.range(0, 0.8),
    });
    this.fruits.castShadow = shadows;
    this.group.add(this.fruits);

    /* ---------- the seedling: a green stem with two round seed-leaves ---------- */
    const cotyShape = new THREE.Shape();
    cotyShape.moveTo(0, 0);
    cotyShape.bezierCurveTo(0.42, 0.05, 0.5, 0.7, 0, 0.8);
    cotyShape.bezierCurveTo(-0.5, 0.7, -0.42, 0.05, 0, 0);
    const cotyGeo = new THREE.ShapeGeometry(cotyShape, 10);
    const cp = cotyGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.abs(cp.getX(i)) * 0.35 - cp.getY(i) * cp.getY(i) * 0.15);
    cotyGeo.computeVertexNormals();
    cotyGeo.rotateX(-Math.PI / 2.4);
    const cotyMat = new THREE.MeshStandardMaterial({ color: '#86cf5c', side: THREE.DoubleSide, roughness: 0.45, emissive: '#3f7a1f', emissiveIntensity: 0.25 });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#6fb24a', roughness: 0.5 });
    this.sprout = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.5, 8).translate(0, -0.25, 0), stemMat);
    stem.castShadow = shadows;
    this.sprout.add(stem);
    for (let k = 0; k < 2; k++) {
      const leaf = new THREE.Mesh(cotyGeo, cotyMat);
      leaf.rotation.y = k * Math.PI + 0.4;
      leaf.scale.setScalar(0.62);
      leaf.castShadow = shadows;
      this.sprout.add(leaf);
    }
    this.sprout.scale.setScalar(0);
    this.group.add(this.sprout);
    this._tip = new THREE.Vector3();
    this.introSprout = 0; // set after the seed lands, before any scrolling
    this.sproutBase = new THREE.Vector3(0, 0.62, 0); // just above the planted seed

    // count for debugging / perf tuning
    this.stats = { branches: branches.length, roots: roots.length, leaves: leafItems.length, blossoms: blossomItems.length, fruits: fruitItems.length };
  }

  /** Called every frame. */
  update(time) {
    const U = this.uniforms;
    U.uTime.value = time;
    // seedling leaves ride the tip of the trunk while it is young
    const g = U.uGrow.value;
    const t = this.trunk;
    const local = clamp((g - t.t0) / (t.t1 - t.t0));
    this.trunk.curve.getPointAt(Math.max(0.001, local * 0.985), this._tip);
    // the little sprout peeks out of the seed first, then rides the growing tip
    const intro = this.introSprout;
    const k = intro * (1 - smoothstep(this.sproutBase.y - 0.25, this.sproutBase.y + 0.15, this._tip.y));
    this.sprout.position.copy(this._tip).lerp(this.sproutBase, k);
    const s = Math.max(smoothstep(0.004, 0.03, g), intro) * (1 - smoothstep(0.24, 0.34, g));
    this.sprout.scale.setScalar(Math.max(0.0001, s));
    this.sprout.rotation.set(Math.sin(time * 1.3) * 0.06, Math.sin(time * 0.8) * 0.2, Math.sin(time * 1.1) * 0.05);
  }
}
