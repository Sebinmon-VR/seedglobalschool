import { cms, cmsEnabled } from './api.js';
import { esc, safeUrl } from './format.js';

/**
 * Site-wide things controlled from the admin panel:
 *  - pictures replaced under "Website images" (the built-in image shows until then)
 *  - the scrolling notice ticker in the top bar (notices marked "Show in ticker")
 *  - a "Live now" badge while an event is live (Go live button, or between its start and end)
 */
export function initCmsSite() {
  if (!cmsEnabled) return;
  cms
    .home()
    .then((home) => {
      swapSiteImages(home.site_images || {});
      renderTicker(home.ticker || []);
      renderLiveBadge(home.live_events || []);
    })
    .catch((err) => console.info('[SEED] Control panel content is unavailable:', err.message));
}

/**
 * Replace built-in pictures (assets/img/<key>.webp) with the ones uploaded in the panel.
 * Keys match the list in site-images.json, e.g. "team/principal" or "gallery/yoga-day".
 */
const IMG_PATH = /(?:^|\/)assets\/img\/(.+)\.(?:webp|jpe?g|png|gif|avif)$/i;
function swapSiteImages(replacements) {
  if (!Object.keys(replacements).length) return;
  const lookup = (value) => {
    const m = String(value || '').match(IMG_PATH);
    return (m && safeUrl(replacements[m[1]])) || null;
  };
  // links and lightbox sources: just point them at the new file
  for (const attr of ['data-full', 'data-img', 'data-thumb']) {
    document.querySelectorAll(`[${attr}*="assets/img/"]`).forEach((el) => {
      const url = lookup(el.getAttribute(attr));
      if (url) el.setAttribute(attr, url);
    });
  }
  // visible pictures: load the new file first so the old one never blinks out
  document.querySelectorAll('img[src*="assets/img/"]').forEach((img) => {
    const url = lookup(img.getAttribute('src'));
    if (!url) return;
    img.removeAttribute('srcset');
    if (img.loading === 'lazy' && !img.complete) {
      img.src = url;
      return;
    }
    const next = new Image();
    next.src = url;
    next.decode().then(
      () => (img.src = url),
      () => (img.src = url),
    );
  });
}

function renderTicker(items) {
  const el = document.getElementById('cms-ticker');
  if (!el || !items.length) return;
  const links = (hidden) =>
    items
      .map(
        (n) =>
          `<a href="news.html#notice-${n.id}"${n.priority === 'urgent' ? ' class="is-urgent"' : ''}${hidden ? ' tabindex="-1"' : ''}>${esc(n.title)}</a>`,
      )
      .join('');
  // two identical sets so the loop is seamless; the copy is hidden from screen readers
  el.innerHTML = `<span class="ticker__label">Notices</span>
    <div class="ticker__window"><div class="ticker__track">
      <span class="ticker__set">${links(false)}</span><span class="ticker__set" aria-hidden="true">${links(true)}</span>
    </div></div>`;
  const chars = items.reduce((n, i) => n + i.title.length, 0);
  el.style.setProperty('--ticker-dur', `${Math.max(18, chars * 0.22 + items.length * 2)}s`);
  el.hidden = false;
}

function renderLiveBadge(events) {
  if (!events.length || document.body.classList.contains('page--news')) return;
  const e = events[0];
  const a = document.createElement('a');
  a.className = 'live-pill';
  a.href = 'news.html#live';
  a.setAttribute('data-cms', '');
  a.innerHTML = `<span class="live-dot" aria-hidden="true"></span><strong>Live now</strong><span class="live-pill__title">${esc(e.title)}</span>`;
  document.body.appendChild(a);
  // visible near the top of the page; fades out once the visitor scrolls into the content
  const update = () => a.classList.toggle('is-away', window.scrollY > window.innerHeight * 0.6);
  window.addEventListener('scroll', update, { passive: true });
  update();
}
