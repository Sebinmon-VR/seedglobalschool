import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Director } from './three/Director.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * The 3D "journey" used by every page: a fixed WebGL scene whose tree, camera
 * and sky follow the page's [data-stage] chapters as the visitor scrolls.
 *   intro: 'seed' (home: loader + seed drop) | 'fade' (inner pages)
 */
export function initJourney({ lenis, reduced, intro = 'fade' }) {
  const sections = [...document.querySelectorAll('[data-stage]')];
  if (!sections.length) return null;
  const small = window.matchMedia('(max-width: 900px)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8; // not reported by Safari
  // Phones: sharp (MSAA, up to 2x resolution) with a slightly lighter scene; the
  // world steps resolution down by itself if a phone can't keep up.
  // Desktops: full scene, unless the machine looks weak.
  const renderSettings = small
    ? memory <= 2
      ? { quality: 0.6, shadows: false, antialias: true, maxDpr: 1.5 }
      : { quality: 0.85, shadows: false, antialias: true, maxDpr: 2 }
    : cores <= 4 || memory <= 4
      ? { quality: 0.6, shadows: false, antialias: false, maxDpr: 1.4 }
      : { quality: 1, shadows: true, antialias: true, maxDpr: 1.75 };
  const canvas = document.getElementById('webgl');
  const director = new Director(sections);
  const journeyEl = sections[sections.length - 1];

  /* ---------- growth rail built from this page's own chapters ---------- */
  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', 'Sections of this page');
  rail.innerHTML = `<span class="rail__track"><span class="rail__fill"></span></span><ol>${sections
    .map((s, i) => `<li><button data-goto="${i}"><span>${s.dataset.name || ''}</span></button></li>`)
    .join('')}</ol>`;
  document.body.appendChild(rail);
  const railFill = rail.querySelector('.rail__fill');
  const railButtons = [...rail.querySelectorAll('[data-goto]')];

  function goToStage(index) {
    director.measure();
    const y = (director.anchors[index] ?? 0) + (index ? 2 : 0);
    if (lenis) lenis.scrollTo(y, { duration: 2.2, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else window.scrollTo(0, y);
  }
  railButtons.forEach((b) => b.addEventListener('click', () => goToStage(Number(b.dataset.goto))));

  /* ---------- 3D world ---------- */
  let world = null;
  async function createWorld() {
    try {
      const { World } = await import('./three/World.js');
      world = new World(canvas, renderSettings);
      world.renderer.compile(world.scene, world.camera);
      if (intro !== 'seed') {
        world.kids.skipIntro();
        world.tree.introSprout = 1;
      }
      if (location.search.includes('debug')) Object.assign(window, { __world: world, __director: director, __lenis: lenis });
    } catch (err) {
      console.warn('[SEED] WebGL unavailable, falling back to a static background.', err);
      document.documentElement.classList.add('no-webgl');
      world = null;
    }
  }

  /* ---------- main loop (renders only while the journey is on screen) ---------- */
  let lastIndex = -1;
  let first = true;
  let journeyEnd = Infinity;
  const measureEnd = () => (journeyEnd = journeyEl.getBoundingClientRect().bottom + window.scrollY);
  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const y = window.scrollY;
    const state = director.update(y, dt, first);
    first = false;
    const inJourney = y < journeyEnd;
    if (world && inJourney) {
      world.apply(state, time);
      world.render(time, director.seedOpen);
    }
    rail.classList.toggle('is-hidden', !inJourney);
    railFill.style.transform = `scaleY(${Math.min(1, y / Math.max(1, journeyEnd - window.innerHeight))})`;
    if (director.index !== lastIndex) {
      lastIndex = director.index;
      document.body.classList.toggle('on-dark', inJourney && sections[lastIndex].dataset.theme === 'dark');
      railButtons.forEach((b, i) => {
        b.classList.toggle('is-active', i === lastIndex);
        b.classList.toggle('is-done', i < lastIndex);
      });
    }
  });

  /* ---------- captions ---------- */
  function prepareHero() {
    document.querySelectorAll('.display--hero .line').forEach((line) => {
      line.innerHTML = `<span class="line__inner" style="display:inline-block">${line.innerHTML}</span>`;
    });
    if (reduced) return;
    gsap.set('.display--hero .line__inner', { yPercent: 110 });
    gsap.set('[data-hero]', { autoAlpha: 0, y: 22 });
  }
  function playHero() {
    if (reduced) return;
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to('.display--hero .line__inner', { yPercent: 0, duration: 1.5, stagger: 0.12 })
      .to('[data-hero]', { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.3);
  }
  function setupChapters() {
    if (reduced) return;
    sections.forEach((chapter) => {
      chapter.querySelectorAll('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'words,lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: chapter, start: 'top 50%', once: true } }),
        });
      });
    });
    sections.slice(1).forEach((chapter) => {
      const items = chapter.querySelectorAll('[data-reveal]');
      const frame = chapter.querySelector('.frame');
      gsap.set(items, { autoAlpha: 0, y: 26 });
      gsap.set(frame, { '--scrim-o': 0 });
      ScrollTrigger.create({
        trigger: chapter, start: 'top 60%', once: true,
        onEnter: () => {
          gsap.to(frame, { '--scrim-o': 1, duration: 1.2, ease: 'power2.out' });
          gsap.to(items, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.25 });
        },
      });
    });
    // Desktop only: chapters are pinned, so each caption (and the wash behind it)
    // fades as the tree moves on to the next stage. On phones nothing is pinned and
    // captions simply scroll past, so they stay fully visible while being read.
    gsap.matchMedia().add('(min-width: 901px)', () => {
      sections.forEach((chapter, i) => {
        if (i === sections.length - 1) return;
        const leave = Number(chapter.dataset.leave ?? 0.68);
        const st = {
          trigger: chapter,
          start: () => (i === 0 ? 'top top' : `top+=${Math.max(0, chapter.offsetHeight - window.innerHeight) * leave} top`),
          end: () => (i === 0 ? 'bottom 75%' : 'bottom 55%'),
          scrub: true,
          invalidateOnRefresh: true,
        };
        gsap.to(chapter.querySelectorAll('.caption, .scroll-hint'), { autoAlpha: 0, y: -50, ease: 'none', scrollTrigger: st });
        gsap.fromTo(chapter.querySelector('.frame'), { '--scrim-o': 1 }, { '--scrim-o': 0, ease: 'none', immediateRender: false, scrollTrigger: { ...st } });
      });
    });
  }

  /* ---------- boot ---------- */
  async function boot() {
    prepareHero();
    if (intro === 'seed') {
      lenis?.stop();
      document.body.classList.add('is-loading');
      const count = document.getElementById('loader-count');
      const bar = document.getElementById('loader-bar');
      const progress = { v: 0 };
      const setP = () => {
        count.textContent = String(Math.round(progress.v)).padStart(3, '0');
        bar.style.transform = `scaleX(${progress.v / 100})`;
      };
      const fill = gsap.to(progress, { v: 86, duration: reduced ? 0.3 : 1.8, ease: 'power2.out', onUpdate: setP });
      await Promise.all([createWorld(), document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, reduced ? 200 : 1500))]);
      await fill;
      await gsap.to(progress, { v: 100, duration: 0.4, ease: 'power2.inOut', onUpdate: setP });
      const loader = document.getElementById('loader');
      await gsap.timeline()
        .to('.loader__center', { y: -24, autoAlpha: 0, duration: 0.5, ease: 'power2.in' })
        .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.1');
      loader.remove();
      document.body.classList.remove('is-loading');
    } else {
      gsap.set(canvas, { autoAlpha: 0 });
      await createWorld();
      gsap.to(canvas, { autoAlpha: 1, duration: 1.2, ease: 'power2.out' });
    }

    setupChapters();
    ScrollTrigger.refresh();
    director.measure();
    measureEnd();
    if (world && intro === 'seed') {
      world.seed.playDrop({
        reduced,
        onStart: () => (reduced ? world.kids.skipIntro() : world.kids.seedFalling()),
        onImpact: () => {
          world.shake = 0.1;
          world.kids.seedLanded();
          playHero();
          gsap.to(world.tree, { introSprout: 1, duration: 1.8, delay: 1.0, ease: 'back.out(1.6)' });
        },
      });
      if (reduced) world.tree.introSprout = 1;
    } else {
      playHero();
    }
    setTimeout(() => rail.classList.add('is-visible'), intro === 'seed' && !reduced ? 1800 : 600);
    lenis?.start();
  }

  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      world?.resize();
      // a phone's address bar showing/hiding changes only the height: don't
      // re-layout every scroll trigger for that (it makes the page jump)
      const widthChanged = window.innerWidth !== lastWidth;
      lastWidth = window.innerWidth;
      if (!widthChanged && window.innerWidth < 900) return;
      ScrollTrigger.refresh();
      director.measure();
      measureEnd();
    }, 150);
  });
  ScrollTrigger.addEventListener('refresh', () => {
    director.measure();
    measureEnd();
  });
  // the camera follows the mouse; ignore touch, or the scene wobbles while scrolling
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    world?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  const ready = boot();
  return { director, goToStage, ready };
}
