import * as THREE from 'three';
import gsap from 'gsap';
import { groundHeight } from './Island.js';
import { smoothstep, makeDotTexture } from './utils.js';

function makeSeedTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#8a5a2e');
  grd.addColorStop(0.5, '#a8743c');
  grd.addColorStop(1, '#6e4220');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * 256;
    g.fillStyle = i % 2 ? 'rgba(60,34,14,0.28)' : 'rgba(214,170,110,0.18)';
    g.fillRect(x, 0, 6 + (i % 3) * 3, 128);
  }
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(50,28,10,${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The seed: two lathe halves that fall from the sky on load and split open
 * when the sprout emerges.
 */
export class Seed {
  constructor({ shadows = true } = {}) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);

    const pts = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = (t - 0.5) * 0.44;
      const r = 0.155 * Math.pow(Math.sin(Math.PI * t), 0.72) * (1 - 0.3 * t);
      pts.push(new THREE.Vector2(Math.max(r, 0.0005), y));
    }

    this.shellMaterial = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: makeSeedTexture(),
      roughness: 0.35,
      clearcoat: 0.9,
      clearcoatRoughness: 0.2,
      emissive: '#ffc46b',
      emissiveIntensity: 0,
    });
    const capMaterial = new THREE.MeshStandardMaterial({
      color: '#f4e4c1',
      roughness: 0.7,
      side: THREE.DoubleSide,
      emissive: '#ffe08a',
      emissiveIntensity: 0,
    });
    this.capMaterial = capMaterial;

    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => shape.lineTo(p.x, p.y));
    [...pts].reverse().forEach((p) => shape.lineTo(-p.x, p.y));
    const capGeo = new THREE.ShapeGeometry(shape, 1);
    capGeo.scale(0.96, 0.98, 1);

    this.halves = [0, 1].map((k) => {
      const half = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 28, k * Math.PI, Math.PI), this.shellMaterial);
      shell.castShadow = shadows;
      const cap = new THREE.Mesh(capGeo, capMaterial);
      cap.rotation.y = k ? Math.PI / 2 : -Math.PI / 2;
      cap.position.x = k ? -0.001 : 0.001;
      half.add(shell, cap);
      this.inner.add(half);
      return half;
    });

    this.inner.scale.setScalar(2.1);
    // planted: standing slightly tilted, half buried in the mud
    this.restY = groundHeight(0, 0) + 0.1;
    this.drop = { y: 0, spin: 0 };
    this.squash = { v: 0 };
    this.restRotation = new THREE.Euler(0.14, 0.6, 0.34);
    this.inner.rotation.copy(this.restRotation);
    this.dropped = false;

    /* impact FX: dust burst + shock ring */
    const count = 140;
    const g = new THREE.BufferGeometry();
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const cc = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2.4;
      vel.set([Math.cos(a) * sp, 1.2 + Math.random() * 2.8, Math.sin(a) * sp], i * 3);
      life[i] = 0.7 + Math.random() * 0.9;
      cc.set(Math.random() < 0.5 ? '#ffd36b' : Math.random() < 0.5 ? '#fff1b8' : '#9ccc5a');
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.burstUniforms = { uT: { value: 99 }, uPixel: { value: 1 }, uMap: { value: makeDotTexture() } };
    this.burst = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.burstUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec3 aVel; attribute float aLife; attribute vec3 aColor;
          uniform float uT; uniform float uPixel;
          varying float vA; varying vec3 vC;
          void main(){
            float t = uT;
            vec3 p = aVel * t * 0.55 + vec3(0.0, -2.6, 0.0) * t * t;
            p.y = max(p.y, 0.02);
            vA = clamp(1.0 - t / aLife, 0.0, 1.0);
            vC = aColor;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (6.0 + 7.0 * (1.0 - vA)) * uPixel / -mv.z;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; varying float vA; varying vec3 vC;
          void main(){
            float a = texture2D(uMap, gl_PointCoord).a * vA;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vC * 1.4, a);
          }`,
      }),
    );
    this.burst.frustumCulled = false;
    this.burst.position.y = this.restY - 0.15;

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 72),
      new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = groundHeight(0, 0) + 0.03;
    this.glow = new THREE.PointLight('#ffcf7a', 0, 4, 2);
    this.glow.position.set(0, 0.6, 0);
    this.group.add(this.burst, this.ring, this.glow);
    this._open = 0;
  }

  /** Seed falls from the sky and plunges straight into the mud, half buried. */
  playDrop({ onStart, onImpact, reduced = false } = {}) {
    onStart?.();
    if (reduced) {
      this.drop.y = 0;
      this.inner.rotation.copy(this.restRotation);
      this.dropped = true;
      return Promise.resolve();
    }
    this.drop.y = 9;
    const rot = this.inner.rotation;
    rot.set(-0.5, 2.4, 0.4);
    this.shellMaterial.emissiveIntensity = 1.4;
    this.glow.intensity = 6;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => { this.dropped = true; resolve(); } });
      // fall until the tip touches the mud, then sink in with a soft squelch
      tl.to(this.drop, { y: 0.42, duration: 1.2, ease: 'power3.in' })
        .add(() => this.impact(onImpact))
        .to(this.drop, { y: 0, duration: 0.55, ease: 'power4.out' })
        .to(this.squash, { v: 1, duration: 0.12, ease: 'power2.out' }, '<')
        .to(this.squash, { v: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, '>-0.02');
      tl.to(rot, { x: this.restRotation.x, y: this.restRotation.y, z: this.restRotation.z, duration: 1.5, ease: 'power3.out' }, 0.2);
      tl.to(this.shellMaterial, { emissiveIntensity: 0, duration: 1.2, ease: 'power2.out' }, 1.2);
      tl.to(this.glow, { intensity: 0, duration: 1.4, ease: 'power2.out' }, 1.25);
    });
  }

  impact(cb) {
    this.burstUniforms.uT.value = 0;
    gsap.to(this.burstUniforms.uT, { value: 2.2, duration: 2.2, ease: 'none' });
    this.ring.scale.setScalar(0.2);
    this.ring.material.opacity = 0.7;
    gsap.to(this.ring.scale, { x: 2.6, y: 2.6, z: 2.6, duration: 1.2, ease: 'power3.out' });
    gsap.to(this.ring.material, { opacity: 0, duration: 1.4, ease: 'power2.out' });
    this.glow.intensity = 9;
    cb?.();
  }

  /** World position of the seed's tip, where the first sprout appears. */
  topPoint(target) {
    this.inner.updateWorldMatrix(true, false);
    return this.inner.localToWorld(target.set(0, 0.17, 0));
  }

  /** open: 0 = intact, 1 = cracked & sunk (sprout has emerged). */
  update(open, time, pointScale) {
    this.burstUniforms.uPixel.value = pointScale;
    const o = smoothstep(0, 1, open);
    this.inner.visible = open < 0.999; // once the tree is up, the old seed coat is gone
    const [a, b] = this.halves;
    a.position.x = o * 0.075;
    a.rotation.z = -o * 0.75;
    b.position.x = -o * 0.075;
    b.rotation.z = o * 0.75;
    this.capMaterial.emissiveIntensity = Math.sin(o * Math.PI) * 0.9;
    const idle = this.dropped && o < 0.02 ? Math.sin(time * 2.2) * 0.012 : 0; // seed "breathes"
    this.inner.position.y = this.restY + this.drop.y + idle - o * 0.16;
    const sq = this.squash.v * 0.14;
    const k = 2.1 * (1 - o * 0.35);
    this.inner.scale.set(k * (1 + sq), k * (1 - sq), k * (1 + sq));
  }
}
