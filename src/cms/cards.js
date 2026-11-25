import { esc, fmtDate, safeUrl } from './format.js';

/** A news card (the site's .prog card), used on the news page and under each article. */
export function postCard(p) {
  const cover = safeUrl(p.cover_image_url);
  const img = cover
    ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async" />`
    : '<span class="prog__ph"><img src="assets/img/logo-footer.png" alt="" width="104" height="62" /></span>';
  const meta = [p.category, fmtDate(p.published_at)].filter(Boolean).map(esc).join(' · ');
  return `<a class="prog" href="post.html?slug=${encodeURIComponent(p.slug)}">
    <figure>${img}</figure>
    <span class="prog__tag">${meta}</span>
    <h3>${esc(p.title)}</h3>
    ${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}
  </a>`;
}
