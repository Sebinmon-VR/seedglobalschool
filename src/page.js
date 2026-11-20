import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initChrome } from './ui/chrome.js';
import { initLightbox } from './ui/lightbox.js';
import { initForms, initTabs } from './ui/forms.js';
import { initMedia } from './ui/media.js';
import { initJourney } from './journey.js';

/* Inner pages: About, Academics, Admissions, Events, Gallery, Contact, Disclosure */
gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hasJourney = !!document.querySelector('[data-stage]');
if (hasJourney && !location.hash) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}
const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToEl = (el) => {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -100, duration: 1.6 });
  else el.scrollIntoView({ block: 'start' });
};

initChrome({ lenis, reduced });
const journey = hasJourney ? initJourney({ lenis, reduced, intro: 'fade' }) : null;
const { openVideo } = initLightbox({ lenis });
initForms();
initTabs(reduced);
initMedia({ reduced, openVideo, scrollToEl });

// same-page anchors scroll smoothly
document.querySelectorAll('a[href*="#"]').forEach((a) => {
  const [path, hash] = a.getAttribute('href').split('#');
  const here = location.pathname.split('/').pop() || 'index.html';
  if (!hash || (path && path !== here)) return;
  a.addEventListener('click', (e) => {
    const el = document.getElementById(hash);
    if (!el) return;
    e.preventDefault();
    document.body.classList.remove('menu-open');
    scrollToEl(el);
  });
});

/* ---------- reveal animations ---------- */
if (!reduced) {
  document.querySelectorAll('.section [data-split], .page-hero [data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'words,lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.words, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
    });
  });
  // reveal as soon as an item enters the viewport (IntersectionObserver is reliable with smooth scroll)
  const items = [...document.querySelectorAll('[data-reveal]')].filter((el) => !el.closest('.chapter'));
  if ('IntersectionObserver' in window) {
    gsap.set(items, { autoAlpha: 0, y: 30 });
    let queue = [];
    let timer = null;
    const flush = () => {
      gsap.to(queue, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true });
      queue = [];
      timer = null;
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        queue.push(en.target);
      });
      if (queue.length && !timer) timer = setTimeout(flush, 30);
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.01 });
    items.forEach((el) => io.observe(el));
  }
  gsap.utils.toArray('.page-hero__banner img, .frame-img img').forEach((img) => {
    gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  document.querySelectorAll('.section [data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const plain = el.hasAttribute('data-plain');
    const obj = { v: plain ? end - 30 : 0 };
    const fmt = (v) => (plain ? String(Math.round(v)) : Math.round(v).toLocaleString('en-IN'));
    el.textContent = fmt(obj.v);
    gsap.to(obj, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(obj.v)), scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
}

window.addEventListener('seed:layout', () => ScrollTrigger.refresh());
window.addEventListener('load', async () => {
  await journey?.ready;
  ScrollTrigger.refresh();
  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => (lenis ? lenis.scrollTo(el, { offset: -100, immediate: true }) : el.scrollIntoView()), 60);
  }
});
