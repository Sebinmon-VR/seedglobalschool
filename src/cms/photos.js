import { cms } from './api.js';
import { esc, safeUrl } from './format.js';
import { pager, appear } from './list.js';

/**
 * Photos from the panel's Photo gallery, with album filters and "More photos".
 * Used on the Gallery page ("Latest photos") and the News page.
 * Resolves to true when there is at least one published photo.
 */
export async function loadPhotoFeed({ list, more, filters, reduced, perPage = 9 }) {
  let album = '';
  const p = pager({ list, more, reduced, fetchPage: (page) => cms.gallery({ page, limit: perPage, album }), render: photoTile });
  const [first, albums] = await Promise.all([p.next(), cms.albums().catch(() => ({ items: [] }))]);
  if (!first?.total) return false;

  const names = (albums.items || []).map((a) => a.album).filter(Boolean);
  if (filters && names.length > 1) {
    filters.innerHTML = ['', ...names]
      .map((n) => `<button type="button" data-album="${esc(n)}"${n ? '' : ' class="is-on"'} aria-pressed="${n ? 'false' : 'true'}">${esc(n || 'All')}</button>`)
      .join('');
    filters.hidden = false;
    filters.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-album]');
      if (!btn || btn.dataset.album === album) return;
      album = btn.dataset.album;
      filters.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('is-on', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      p.reset();
      try {
        if (await p.next()) appear([...list.children], reduced);
      } catch (err) {
        console.info('[SEED] Could not load the album:', err.message);
      }
    });
  }
  return true;
}

export function photoTile(g) {
  const url = safeUrl(g.url);
  if (!url) return '';
  // the panel fills in a title from the file name ("IMG 2034"), so prefer the caption or album
  const label = g.caption || g.album || g.title || '';
  return `<figure class="tile"><button data-full="${esc(url)}" aria-label="${esc(label ? `Open photo: ${label}` : 'Open photo')}"><img src="${esc(url)}" alt="${esc(g.caption || g.title || '')}" loading="lazy" decoding="async" /></button>${label ? `<figcaption>${esc(label)}</figcaption>` : ''}</figure>`;
}
