import * as THREE from 'three';
import { clamp, lerp, easeInOut, smoothstep } from './utils.js';

/**
 * Each chapter of the page owns a "stage" in the life of the tree (and the
 * children who planted it). The director interpolates between these
 * keyframes as the visitor scrolls.
 *   shift > 0 => tree sits on the right of the screen (text on the left)
 *   age       => 0 little pre-primary children … 1 teenage graduates
 *   water     => how hard the watering can is pouring
 *   grad      => graduation gowns + caps (and the cap toss at 1)
 */
const DAY = {
  skyTop: '#cfe1d8', skyBottom: '#f6efe3', sunColor: '#fff0cf',
  hemiSky: '#e4f4ff', hemiGround: '#7a6646',
  sun: 2.6, hemi: 1.25, sunGlow: 0.75, stars: 0, fireflies: 0, pollen: 0.6, wind: 0.7, petals: 0, soil: 1,
  water: 0, grad: 0, fill: 0.65,
};

export const STAGES = {
  hero: {
    ...DAY, tx: 0, ty: 0.5, tz: 0, dist: 7.6, az: 14, el: 19, shift: 0.2,
    grow: 0, roots: 0, leaves: 1, bloom: 0, fruit: 0, age: 0,
    skyTop: '#dbe5d8', skyBottom: '#f6efe3', wind: 0.5,
  },
  roots: {
    ...DAY, tx: 0, ty: -1.2, tz: 0, dist: 10.2, az: -16, el: -4, shift: -0.26,
    grow: 0.075, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.04, water: 1, soil: 0.16,
    skyTop: '#06120f', skyBottom: '#12302a', sunColor: '#ffd9a0', hemiSky: '#a6dccd', hemiGround: '#3a2a1a',
    sun: 1.5, hemi: 0.8, sunGlow: 0.1, stars: 0.35, fireflies: 0.4, pollen: 0.9, wind: 0.4, fill: 0.45,
  },
  trunk: {
    ...DAY, tx: 0, ty: 2.2, tz: 0, dist: 11, az: 28, el: 10, shift: 0.25,
    grow: 0.43, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.18, water: 0.85, soil: 0.96,
    skyTop: '#cde0d6', skyBottom: '#f4eee3',
  },
  branches: {
    ...DAY, tx: 0, ty: 4.0, tz: 0, dist: 13.8, az: -32, el: 13, shift: -0.26,
    grow: 0.8, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.34,
    skyTop: '#bcd5da', skyBottom: '#f0f0e7',
  },
  leaves: {
    ...DAY, tx: 0, ty: 4.9, tz: 0, dist: 13.8, az: 42, el: 7, shift: 0.25,
    grow: 1, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.5,
    skyTop: '#c8dcbf', skyBottom: '#f4f0e2', wind: 0.9,
  },
  canopy: {
    ...DAY, tx: 0, ty: 5.0, tz: 0, dist: 15, az: -10, el: 12, shift: -0.26,
    grow: 1, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.63,
    skyTop: '#0e2622', skyBottom: '#35553f', sunColor: '#ffcf8f', hemiSky: '#a8cdb6', hemiGround: '#2a2416',
    sun: 1.8, hemi: 0.8, sunGlow: 0.5, pollen: 0.9, fireflies: 0.3, fill: 0.95,
  },
  bloom: {
    ...DAY, tx: 0, ty: 5.4, tz: 0, dist: 13, az: -46, el: 5, shift: 0.25,
    grow: 1, roots: 1, leaves: 1, bloom: 1, fruit: 0, age: 0.76, petals: 1,
    skyTop: '#f1ccd3', skyBottom: '#fbf1ea', sunColor: '#ffe6e0', hemiSky: '#fff0f4', pollen: 0.8,
  },
  fruit: {
    ...DAY, tx: 0, ty: 4.6, tz: 0, dist: 14.6, az: 30, el: 6, shift: -0.26,
    grow: 1, roots: 1, leaves: 1, bloom: 1, fruit: 1, age: 0.9, petals: 0.35,
    skyTop: '#eea063', skyBottom: '#fbe0bf', sunColor: '#ffb469', hemiSky: '#ffe2c4', hemiGround: '#6e5232',
    sun: 2.5, hemi: 1.05, sunGlow: 1.1, pollen: 0.9,
  },
  harvest: {
    ...DAY, tx: 0, ty: 3.3, tz: 0.8, dist: 15.5, az: 6, el: 7, shift: 0.25,
    grow: 1, roots: 1, leaves: 1, bloom: 1, fruit: 1, age: 1, grad: 1, petals: 0.12,
    skyTop: '#0f1730', skyBottom: '#a65a4e', sunColor: '#ffb48a', hemiSky: '#8da7d6', hemiGround: '#2a1d18',
    sun: 2.0, hemi: 0.95, sunGlow: 1.0, stars: 0.8, fireflies: 0.9, pollen: 0.2, wind: 0.5, fill: 1.5,
  },
};

/* Opening scenes for the inner pages: each page has its own view of the tree */
Object.assign(STAGES, {
  // About: a cut-away of the whole tree, roots glowing through the soil
  aboutHero: {
    ...DAY, tx: 0, ty: 1.2, tz: 0, dist: 15.5, az: 22, el: 3, shift: 0.24,
    grow: 0.7, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.4, soil: 0.3,
    skyTop: '#d4e6dd', skyBottom: '#f6efe3', fill: 0.8,
  },
  // Academics: a young tree in clear morning light, seen from below the canopy
  academicsHero: {
    ...DAY, tx: 0, ty: 4.2, tz: 0, dist: 15.5, az: 60, el: 15, shift: 0.24,
    grow: 0.9, roots: 1, leaves: 1, bloom: 0, fruit: 0, age: 0.4,
    skyTop: '#bad7e0', skyBottom: '#f3f2e8',
  },
  // Admissions: golden fruit at golden hour
  admissionsHero: {
    ...DAY, tx: 0, ty: 4.8, tz: 0, dist: 14.5, az: -26, el: 8, shift: 0.24,
    grow: 1, roots: 1, leaves: 1, bloom: 1, fruit: 1, age: 0.9, petals: 0.3,
    skyTop: '#eea063', skyBottom: '#fbe0bf', sunColor: '#ffb469', hemiSky: '#ffe2c4', hemiGround: '#6e5232',
    sun: 2.5, hemi: 1.05, sunGlow: 1.1, pollen: 0.9,
  },
  // Events: a tree in full pink blossom, petals drifting
  eventsHero: {
    ...DAY, tx: 0, ty: 5.6, tz: 0, dist: 14, az: 74, el: 6, shift: 0.24,
    grow: 1, roots: 1, leaves: 1, bloom: 1, fruit: 0, age: 0.7, petals: 1,
    skyTop: '#f1ccd3', skyBottom: '#fbf1ea', sunColor: '#ffe6e0', hemiSky: '#fff0f4', pollen: 0.8,
  },
  // Gallery: the canopy at night, full of fireflies
  galleryHero: {
    ...DAY, tx: 0, ty: 5.0, tz: 0, dist: 16, az: -60, el: 13, shift: 0.24,
    grow: 1, roots: 1, leaves: 1, bloom: 0.6, fruit: 0, age: 0.7,
    skyTop: '#06151d', skyBottom: '#123b38', sunColor: '#9fc3ff', hemiSky: '#7aa7c7', hemiGround: '#1a1a14',
    sun: 0.9, hemi: 0.55, sunGlow: 0.2, stars: 1, fireflies: 1, pollen: 0.1, fill: 0.9,
  },
  // Contact: the whole tree at dusk, ready to welcome visitors
  contactHero: {
    ...DAY, tx: 0, ty: 3.8, tz: 0, dist: 17.5, az: -14, el: 8, shift: 0.24,
    grow: 1, roots: 1, leaves: 1, bloom: 1, fruit: 1, age: 1, petals: 0.12,
    skyTop: '#0f1730', skyBottom: '#a65a4e', sunColor: '#ffb48a', hemiSky: '#8da7d6', hemiGround: '#2a1d18',
    sun: 2.0, hemi: 0.95, sunGlow: 1.0, stars: 0.8, fireflies: 0.9, pollen: 0.2, fill: 1.4,
  },
});

const COLOR_KEYS = ['skyTop', 'skyBottom', 'sunColor', 'hemiSky', 'hemiGround'];

function materialise(stage) {
  const s = { ...stage };
  for (const k of COLOR_KEYS) s[k] = new THREE.Color(stage[k]);
  return s;
}

export class Director {
  constructor(sections) {
    this.sections = sections;
    this.states = sections.map((el) => materialise(STAGES[el.dataset.stage] || STAGES.hero));
    this.numKeys = Object.keys(this.states[0]).filter((k) => !COLOR_KEYS.includes(k));
    this.current = materialise(STAGES[sections[0].dataset.stage]);
    this.target = materialise(STAGES[sections[0].dataset.stage]);
    this.index = 0;
    this.progress = 0;
    this.measure();
  }

  /**
   * Desktop: each chapter is a pinned "frame". The stage is reached shortly
   * after the frame pins (arrive), held while the visitor reads, then the tree
   * grows on toward the next stage (leave → next arrive).
   * Mobile: one keyframe per chapter, reached while its open window is on screen.
   */
  measure() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const narrow = window.innerWidth < 900;
    this.max = max;
    const keys = [];
    this.anchors = [];
    this.sections.forEach((el, i) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (i === 0) {
        keys.push({ y: 0, i });
        this.anchors.push(0);
        return;
      }
      if (narrow) {
        const y = top + vh * 0.1;
        keys.push({ y, i });
        this.anchors.push(y);
        return;
      }
      const pin = Math.max(0, el.offsetHeight - vh);
      const arrive = top + pin * Number(el.dataset.arrive ?? 0.12);
      const leave = top + pin * Number(el.dataset.leave ?? 0.68);
      keys.push({ y: arrive, i }, { y: leave, i });
      this.anchors.push(arrive);
    });
    // keep strictly increasing and inside the scroll range
    let prev = -1;
    for (const k of keys) {
      k.y = clamp(k.y, prev + 1, max);
      prev = k.y;
    }
    this.keys = keys;
  }

  /** Recompute target from scroll position then ease the current state toward it. */
  update(scrollY, dt, snap = false) {
    const K = this.keys;
    let j = 0;
    while (j < K.length - 2 && scrollY >= K[j + 1].y) j++;
    const a = K[j];
    const b = K[j + 1] ?? a;
    const t = b.y > a.y ? clamp((scrollY - a.y) / (b.y - a.y)) : 0;
    const e = easeInOut(t);
    const from = this.states[a.i];
    const to = this.states[b.i];
    for (const k of this.numKeys) this.target[k] = lerp(from[k], to[k], e);
    for (const k of COLOR_KEYS) this.target[k].copy(from[k]).lerp(to[k], e);

    const f = snap ? 1 : 1 - Math.exp(-dt * 5);
    for (const k of this.numKeys) this.current[k] += (this.target[k] - this.current[k]) * f;
    for (const k of COLOR_KEYS) this.current[k].lerp(this.target[k], f);

    this.index = a.i === b.i ? a.i : t > 0.5 ? b.i : a.i;
    this.progress = clamp(scrollY / this.max);
    return this.current;
  }

  /** How open the seed is (0 intact → 1 sprouted). */
  get seedOpen() {
    return smoothstep(0.0, 0.05, this.current.grow);
  }
}
