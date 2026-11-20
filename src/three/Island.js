import * as THREE from 'three';
import { createRng, makeNoise, clamp, lerp } from './utils.js';
import { patchGrass, patchFoliage } from './shaders.js';

/** Radius/height profile of the floating earth island (r, y). */
export const ISLAND_PROFILE = [
  [6.0, 0.0], [6.1, -0.14], [5.98, -0.5], [5.55, -1.0], [4.85, -1.62],
  [3.95, -2.22], [2.95, -2.78], [1.9, -3.25], [0.9, -3.6], [0.0, -3.75],
];
export const ISLAND_RADIUS = 6.0;

const smoothstep01 = (t) => t * t * (3 - 2 * t);

export function islandRadiusAt(y) {
  for (let i = 0; i < ISLAND_PROFILE.length - 1; i++) {
    const [r0, y0] = ISLAND_PROFILE[i];
    const [r1, y1] = ISLAND_PROFILE[i + 1];
    if (y <= y0 && y >= y1) return lerp(r0, r1, (y0 - y) / (y0 - y1));
  }
  return y > 0 ? ISLAND_RADIUS : 0;
}

const noise = makeNoise(11);

/** Height of the grassy top surface at (x, z). */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const edge = clamp(r / ISLAND_RADIUS);
  const dome = 0.16 * (1 - edge * edge);
  const n = noise(x * 0.45, 0.3, z * 0.45) * 0.09 * (1 - Math.pow(edge, 6));
  const dip = -0.02 * Math.exp(-r * r * 8);
  return dome + n + dip;
}

export class Island {
  constructor({ quality = 1, shadows = true, uniforms }) {
    this.group = new THREE.Group();
    this.uniforms = uniforms;
    const rng = createRng(93);

    /* ---------- soil body (lathe, low-poly) ---------- */
    const pts = ISLAND_PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
    const soilGeo = new THREE.LatheGeometry(pts, 56);
    const pos = soilGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const palette = [new THREE.Color('#5a3b25'), new THREE.Color('#7b5133'), new THREE.Color('#946640'), new THREE.Color('#6b4630'), new THREE.Color('#a77a4f')];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      if (y < -0.08 && y > -3.7) {
        const n = noise(x * 0.55, y * 0.9, z * 0.55);
        const k = 1 + n * 0.14;
        x *= k;
        z *= k;
        y += noise(x * 0.8, y * 0.5 + 9, z * 0.8) * 0.18;
      }
      pos.setXYZ(i, x, y, z);
      // stratified soil colours
      const band = Math.floor(clamp(-y / 3.75) * 5 + noise(x * 0.4, y * 2.2, z * 0.4) * 1.4);
      c.copy(palette[clamp(band, 0, palette.length - 1)]);
      if (y > -0.22) c.set('#3f6b34'); // grassy lip
      c.offsetHSL(0, 0, noise(x * 2, y * 2, z * 2) * 0.05);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    soilGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    soilGeo.computeVertexNormals();
    this.soilMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
      transparent: true,
      opacity: 1,
    });
    this.soil = new THREE.Mesh(soilGeo, this.soilMaterial);
    this.soil.renderOrder = 2;
    this.group.add(this.soil);

    /* ---------- grassy top ---------- */
    // a ring geometry (not a circle) so we have concentric rings to sculpt
    const ringGeo = new THREE.RingGeometry(0.001, ISLAND_RADIUS + 0.06, 96, 30);
    ringGeo.rotateX(-Math.PI / 2);
    const tp = ringGeo.attributes.position;
    const tc = new Float32Array(tp.count * 3);
    const grassA = new THREE.Color('#4f9a4a');
    const grassB = new THREE.Color('#7dbb5a');
    const earth = new THREE.Color('#6f8f3e'); // a slightly earthier green under the seed
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i);
      const z = tp.getZ(i);
      const r = Math.hypot(x, z);
      tp.setY(i, r > ISLAND_RADIUS - 0.02 ? -0.04 : groundHeight(x, z));
      c.copy(grassA).lerp(grassB, clamp(noise(x * 0.7, 4.2, z * 0.7) * 0.9 + 0.5));
      c.lerp(earth, smoothstep01(clamp((0.32 - r) / 0.2)) * 0.35); // barely-there soil right under the seed
      tc.set([c.r, c.g, c.b], i * 3);
    }
    ringGeo.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    ringGeo.computeVertexNormals();
    this.top = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.top.receiveShadow = shadows;
    this.group.add(this.top);

    /* ---------- grass blades ---------- */
    const bladeGeo = new THREE.PlaneGeometry(0.055, 0.3, 1, 4);
    bladeGeo.translate(0, 0.15, 0);
    const bp = bladeGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const t = bp.getY(i) / 0.3;
      bp.setX(i, bp.getX(i) * (1 - t * 0.92));
      bp.setZ(i, t * t * 0.05);
    }
    bladeGeo.computeVertexNormals();
    const bladeMat = patchGrass(
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 }),
      { uTime: uniforms.uTime, uWind: uniforms.uWind },
    );
    const bladeCount = Math.round(6500 * quality);
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const bladeColors = ['#3f8a3e', '#56a046', '#6db352', '#89c25d', '#4a9445', '#a3cf6a'];
    for (let i = 0; i < bladeCount; i++) {
      const r = Math.sqrt(rng.range(0.42 * 0.42, 5.8 * 5.8));
      const a = rng.range(0, Math.PI * 2);
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      p.y = groundHeight(p.x, p.z) - 0.01;
      e.set(rng.range(-0.25, 0.25), rng.range(0, Math.PI * 2), rng.range(-0.25, 0.25));
      q.setFromEuler(e);
      const h = rng.range(0.55, 1.35) * (r > 4.6 ? 0.55 : 1); // shorter at the rim so the camera never skims giant blades
      s.set(rng.range(0.8, 1.3), h, 1);
      m.compose(p, q, s);
      blades.setMatrixAt(i, m);
      blades.setColorAt(i, c.set(rng.pick(bladeColors)));
    }
    blades.receiveShadow = shadows;
    blades.frustumCulled = false;
    this.group.add(blades);

    /* ---------- wildflowers that bloom with the tree ---------- */
    const flowerGeo = new THREE.IcosahedronGeometry(0.05, 0);
    flowerGeo.translate(0, 0.32, 0);
    const flowerMat = patchFoliage(
      new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.08 }),
      { uTime: uniforms.uTime, uWind: uniforms.uWind, uProg: uniforms.uBloom, uGrow: uniforms.uGrow },
      { flutter: 0.15 },
    );
    const flowerCount = Math.round(260 * quality);
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    const fBirth = new Float32Array(flowerCount);
    const fWood = new Float32Array(flowerCount);
    const fPhase = new Float32Array(flowerCount);
    const flowerColors = ['#ffd84a', '#ff8fb1', '#ffffff', '#c9a7ff', '#ffb24a'];
    for (let i = 0; i < flowerCount; i++) {
      const r = Math.sqrt(rng.range(1.4 * 1.4, 5.6 * 5.6));
      const a = rng.range(0, Math.PI * 2);
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      p.y = groundHeight(p.x, p.z) - 0.02;
      q.setFromEuler(e.set(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2)));
      const k = rng.range(0.7, 1.2);
      m.compose(p, q, s.set(k, k, k));
      flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, c.set(rng.pick(flowerColors)));
      fBirth[i] = rng.range(0, 0.85);
      fWood[i] = 0;
      fPhase[i] = rng.next();
    }
    flowerGeo.setAttribute('aBirth', new THREE.InstancedBufferAttribute(fBirth, 1));
    flowerGeo.setAttribute('aWood', new THREE.InstancedBufferAttribute(fWood, 1));
    flowerGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(fPhase, 1));
    flowers.frustumCulled = false;
    this.group.add(flowers);

    /* ---------- rocks ---------- */
    const rockMat = new THREE.MeshStandardMaterial({ color: '#a59d8f', roughness: 0.95, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(0.14, 0.42), 0), rockMat);
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(3.2, 5.4);
      rock.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      rock.position.y = groundHeight(rock.position.x, rock.position.z) + 0.02;
      rock.scale.set(rng.range(0.9, 1.6), rng.range(0.5, 0.9), rng.range(0.9, 1.4));
      rock.rotation.set(rng.next() * 3, rng.next() * 3, rng.next() * 3);
      rock.castShadow = shadows;
      rock.receiveShadow = shadows;
      this.group.add(rock);
    }

    /* ---------- hanging root tendrils under the island ---------- */
    const tendrilMat = new THREE.MeshStandardMaterial({ color: '#6b4a30', roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const a = rng.range(0, Math.PI * 2);
      const y0 = rng.range(-3.4, -1.2);
      const r0 = islandRadiusAt(y0) * 0.92;
      const start = new THREE.Vector3(Math.cos(a) * r0, y0, Math.sin(a) * r0);
      const len = rng.range(0.6, 1.8);
      const curve = new THREE.CatmullRomCurve3([
        start,
        start.clone().add(new THREE.Vector3(rng.range(-0.2, 0.2), -len * 0.5, rng.range(-0.2, 0.2))),
        start.clone().add(new THREE.Vector3(rng.range(-0.3, 0.3), -len, rng.range(-0.3, 0.3))),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, rng.range(0.015, 0.04), 5), tendrilMat);
      this.group.add(tube);
    }
  }

  setSoilOpacity(v) {
    this.soilMaterial.opacity = v;
    this.soilMaterial.depthWrite = v > 0.95;
  }
}
