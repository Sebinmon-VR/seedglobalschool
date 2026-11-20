import * as THREE from 'three';
import { createRng, makeDotTexture } from './utils.js';

/** Gradient sky dome with sun glow and stars (for the night finale). */
export class Sky {
  constructor() {
    this.uniforms = {
      uTop: { value: new THREE.Color('#cfe9e3') },
      uBottom: { value: new THREE.Color('#fbf4e6') },
      uSunDir: { value: new THREE.Vector3(0.45, 0.35, -0.8).normalize() },
      uSunColor: { value: new THREE.Color('#fff1c9') },
      uSunStrength: { value: 0.6 },
      uStars: { value: 0 },
      uTime: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(140, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor;
          uniform float uSunStrength; uniform float uStars; uniform float uTime;
          varying vec3 vDir;
          float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uBottom, uTop, smoothstep(-0.25, 0.75, h));
            float sun = max(dot(d, uSunDir), 0.0);
            col += uSunColor * (pow(sun, 40.0) * 0.9 + pow(sun, 6.0) * 0.25) * uSunStrength;
            if (uStars > 0.001) {
              vec3 sp = d * 220.0;
              vec3 cell = floor(sp);
              float s = hash(cell);
              float r = length(fract(sp) - 0.5);
              float star = step(0.993, s) * smoothstep(0.32, 0.0, r) * smoothstep(-0.1, 0.3, h);
              star *= 0.55 + 0.45 * sin(uTime * 2.0 + s * 80.0);
              col += vec3(star) * uStars;
            }
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
}

/** Drifting pollen by day, fireflies by night. */
export class Motes {
  constructor({ count = 520 } = {}) {
    const rng = createRng(5);
    const g = new THREE.BufferGeometry();
    const base = new Float32Array(count * 3);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rng.next()) * 10.5;
      const a = rng.range(0, Math.PI * 2);
      base.set([Math.cos(a) * r, rng.range(-3, 12), Math.sin(a) * r], i * 3);
      data.set([rng.range(0, 6.28), rng.range(0.15, 0.6), rng.range(0.25, 0.9), rng.next()], i * 4);
    }
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(data, 4));
    this.uniforms = {
      uTime: { value: 0 },
      uPixel: { value: 1 },
      uPollen: { value: 0.5 },
      uFireflies: { value: 0 },
      uMap: { value: makeDotTexture() },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec4 aData;
          uniform float uTime; uniform float uPixel; uniform float uPollen; uniform float uFireflies;
          varying float vA; varying float vKind;
          void main(){
            float ph = aData.x, sp = aData.y, amp = aData.z;
            vKind = aData.w;
            vec3 p = position;
            p.x += sin(uTime * sp + ph) * amp;
            p.y += sin(uTime * sp * 0.7 + ph * 2.0) * amp * 0.6 + mod(uTime * sp * 0.25 + ph, 3.0) * 0.3;
            p.z += cos(uTime * sp * 0.9 + ph) * amp;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float tw = 0.55 + 0.45 * sin(uTime * (1.5 + sp * 3.0) + ph * 3.0);
            float firefly = step(0.55, vKind) * uFireflies;
            vA = (uPollen * 0.55 + firefly * tw * 1.4);
            gl_PointSize = (mix(5.0, 12.0, vKind) + firefly * 10.0) * uPixel / -mv.z;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform float uFireflies;
          varying float vA; varying float vKind;
          void main(){
            float a = texture2D(uMap, gl_PointCoord).a * vA;
            if (a < 0.004) discard;
            vec3 pollen = vec3(1.0, 0.94, 0.72);
            vec3 fly = vec3(1.0, 0.86, 0.38);
            gl_FragColor = vec4(mix(pollen, fly, uFireflies), a);
          }`,
      }),
    );
    this.points.frustumCulled = false;
  }
}

/** Blossom petals drifting down from the canopy. */
export class Petals {
  constructor({ count = 260 } = {}) {
    const rng = createRng(77);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.05, 0.03, 0.05, 0.1, 0, 0.12);
    shape.bezierCurveTo(-0.05, 0.1, -0.05, 0.03, 0, 0);
    const geo = new THREE.InstancedBufferGeometry().copy(new THREE.ShapeGeometry(shape, 3));
    geo.instanceCount = count;
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rng.next()) * 5.2;
      const a = rng.range(0, Math.PI * 2);
      off.set([Math.cos(a) * r, Math.sin(a) * r, rng.range(0.35, 0.9), rng.next()], i * 4);
    }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    this.uniforms = { uTime: { value: 0 }, uAmount: { value: 0 } };
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          attribute vec4 aOff;
          uniform float uTime; uniform float uAmount;
          varying float vA; varying float vShade;
          mat3 rotXY(float a, float b){
            float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
            return mat3(cb, 0.0, -sb, 0.0, 1.0, 0.0, sb, 0.0, cb) * mat3(1.0, 0.0, 0.0, 0.0, ca, sa, 0.0, -sa, ca);
          }
          void main(){
            float sp = aOff.z, ph = aOff.w;
            float fall = 10.0;
            float t = mod(uTime * sp * 0.6 + ph * fall, fall);
            vec3 c = vec3(aOff.x, 9.2 - t, aOff.y);
            c.x += sin(uTime * 0.9 + ph * 12.0) * 0.6 + t * 0.12;
            c.z += cos(uTime * 0.7 + ph * 9.0) * 0.5;
            vec3 p = rotXY(uTime * (1.0 + sp * 2.0) + ph * 6.0, uTime * 0.8 + ph * 3.0) * position;
            vShade = 0.75 + 0.25 * sin(uTime * 3.0 + ph * 20.0);
            vA = uAmount * smoothstep(9.2, 8.2, c.y) * smoothstep(0.0, 0.6, c.y);
            vec4 mv = modelViewMatrix * vec4(c + p * 1.4, 1.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying float vShade;
          void main(){
            if (vA < 0.01) discard;
            gl_FragColor = vec4(vec3(1.0, 0.78, 0.86) * vShade, vA);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.mesh.frustumCulled = false;
  }
}
