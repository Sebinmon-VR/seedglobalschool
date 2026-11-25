import { cms, cmsEnabled } from './api.js';
import { fmtDate, safeUrl } from './format.js';
import { postCard } from './cards.js';

/** Article page (post.html?slug=...): one news post from the admin panel, plus "More news". */
export async function initPost() {
  const $ = (id) => document.getElementById(id);
  const article = $('post');
  const slug = new URLSearchParams(location.search).get('slug');

  const unavailable = (offline) => {
    $('post-title').textContent = offline ? 'This article can’t be loaded right now' : 'We couldn’t find that article';
    $('post-excerpt').textContent = offline
      ? 'Please check your connection and try again in a moment.'
      : 'It may have been moved or taken down. You’ll find all our latest news on the news page.';
    $('post-excerpt').hidden = false;
    $('post-meta').textContent = '';
    $('post-body').innerHTML = '<a class="btn btn--gold" href="news.html#news">See all news</a>';
    article.setAttribute('aria-busy', 'false');
    document.title = 'News | SEED Global School';
  };

  if (!slug || !cmsEnabled) return unavailable(false);

  let post;
  try {
    post = await cms.post(slug);
  } catch (err) {
    return unavailable(err.status !== 404);
  }

  document.title = `${post.title} | SEED Global School`;
  if (post.excerpt) document.querySelector('meta[name="description"]')?.setAttribute('content', post.excerpt);
  $('post-crumb').textContent = post.category || 'Article';
  $('post-meta').textContent = [post.category, fmtDate(post.published_at)].filter(Boolean).join(' · ');
  $('post-title').textContent = post.title;
  if (post.excerpt) {
    $('post-excerpt').textContent = post.excerpt;
    $('post-excerpt').hidden = false;
  }
  const cover = safeUrl(post.cover_image_url);
  if (cover) {
    $('post-cover-img').src = cover;
    $('post-cover').hidden = false;
  }

  // The panel sanitises post HTML on the server (sanitize-html allow-list), so it is
  // inserted as-is. Tables get a scroll wrapper so they don't widen the page on phones.
  const body = $('post-body');
  body.innerHTML = post.content || '';
  body.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
  });
  body.querySelectorAll('table').forEach((t) => {
    const wrap = document.createElement('div');
    wrap.className = 'article__table';
    t.replaceWith(wrap);
    wrap.appendChild(t);
  });

  const url = location.href;
  $('post-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`${post.title}\n${url}`)}`;
  const copy = $('post-copy');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = 'Link copied';
    } catch {
      copy.textContent = 'Copy the address bar link';
    }
    setTimeout(() => (copy.textContent = 'Copy link'), 2400);
  });
  $('post-aside').hidden = false;
  article.setAttribute('aria-busy', 'false');
  window.dispatchEvent(new Event('seed:layout'));

  try {
    const { items } = await cms.posts({ limit: 4 });
    const others = items.filter((p) => p.slug !== post.slug).slice(0, 3);
    if (others.length) {
      $('more-list').innerHTML = others.map(postCard).join('');
      $('more-news').hidden = false;
      window.dispatchEvent(new Event('seed:layout'));
    }
  } catch {
    /* "More news" is optional */
  }
}
