import gsap from 'gsap';
import { EVENTS, MONTHS, MONTH_NAMES } from '../data/events.js';

const MONTH_INDEX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const TAG_LABEL = { celebration: 'Celebration', learning: 'Learning', sports: 'Sports', arts: 'Arts', community: 'Community', milestone: 'Milestone' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Events calendar, gallery filters, cinema video player and signature tiles. */
export function initMedia({ reduced, openVideo, scrollToEl }) {
  /* ---------- events calendar ---------- */
  const monthsEl = document.getElementById('cal-months');
  const listEl = document.getElementById('cal-list');
  if (monthsEl && listEl) {
    const titleEl = document.getElementById('cal-title');
    const noteEl = document.getElementById('cal-note');
    const nowKey = Object.keys(MONTH_INDEX).find((k) => MONTH_INDEX[k] === new Date().getMonth());
    const startKey = MONTHS.includes(nowKey) ? nowKey : 'Jun';
    const show = (m) => {
      monthsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.month === m)));
      titleEl.textContent = MONTH_NAMES[m];
      noteEl.textContent = m === nowKey ? 'This month at SEED' : `${EVENTS[m]?.length ?? 0} highlights`;
      listEl.innerHTML = (EVENTS[m] || [])
        .map((e) => `<li><span class="cal__date"><b>${esc(e.day)}</b><small>${esc(m)}</small></span><div><h4>${esc(e.title)}</h4><p>${esc(e.note)}</p></div><span class="tag">${TAG_LABEL[e.tag] || ''}</span></li>`)
        .join('');
      if (!reduced) gsap.fromTo(listEl.children, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out', stagger: 0.05 });
    };
    MONTHS.forEach((m) => {
      const b = document.createElement('button');
      b.setAttribute('role', 'tab');
      b.dataset.month = m;
      b.innerHTML = `${MONTH_NAMES[m]}<small>${EVENTS[m]?.length ?? 0}</small>`;
      if (m === nowKey) b.classList.add('is-now');
      b.addEventListener('click', () => show(m));
      monthsEl.appendChild(b);
    });
    show(startKey);
  }

  /* ---------- gallery filters ---------- */
  const filterBtns = [...document.querySelectorAll('[data-filter]')];
  const tiles = [...document.querySelectorAll('#photo-grid .tile')];
  filterBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filterBtns.forEach((b) => b.classList.toggle('is-on', b === btn));
      tiles.forEach((t) => t.classList.toggle('is-hidden', f !== 'all' && t.dataset.cat !== f));
      const shown = tiles.filter((t) => !t.classList.contains('is-hidden'));
      if (!reduced) gsap.fromTo(shown, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out', stagger: 0.04 });
      window.dispatchEvent(new Event('seed:layout'));
    }),
  );

  /* ---------- cinema: episode list drives the big screen ---------- */
  const screen = document.getElementById('screen');
  if (screen) {
    const poster = document.getElementById('screen-poster');
    const thumb = document.getElementById('screen-thumb');
    const title = document.getElementById('screen-title');
    const eps = [...document.querySelectorAll('#episodes button')];
    let current = eps[0];
    const play = () => {
      screen.querySelector('iframe')?.remove();
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${current.dataset.id}?autoplay=1&rel=0`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.title = title.textContent;
      screen.appendChild(f);
      poster.hidden = true;
    };
    const select = (btn) => {
      current = btn;
      eps.forEach((b) => b.classList.toggle('is-on', b === btn));
      title.textContent = `${btn.querySelector('strong').textContent} · ${btn.querySelector('em').textContent}`;
      thumb.src = btn.dataset.thumb;
      thumb.classList.toggle('is-zoom', btn.hasAttribute('data-zoom'));
      play();
    };
    poster.addEventListener('click', play);
    eps.forEach((b) => b.addEventListener('click', () => select(b)));
  }

  /* ---------- signature tiles ---------- */
  document.querySelectorAll('.mtile').forEach((card) => {
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const go = () => {
      if (card.dataset.video) openVideo(card.dataset.video, card.dataset.title);
      else if (card.dataset.href) location.href = card.dataset.href;
      else if (card.dataset.open) scrollToEl(document.getElementById(card.dataset.open));
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go()));
  });
}
