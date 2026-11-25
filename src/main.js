import './styles/main.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initChrome } from './ui/chrome.js';
import { initJourney } from './journey.js';
import { initCmsSite } from './cms/site.js';

/* Home: the seed-to-tree journey (loader → seed drop → growth on scroll) */
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const lenis = reduced ? null : new Lenis({ lerp: 0.08, wheelMultiplier: 0.85, touchMultiplier: 1.15 });
lenis?.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((t) => lenis?.raf(t * 1000));

initChrome({ lenis, reduced });
initJourney({ lenis, reduced, intro: 'seed' });
initCmsSite(); // replaced pictures, notice ticker and "Live now" badge from the admin panel
window.addEventListener('load', () => ScrollTrigger.refresh());
