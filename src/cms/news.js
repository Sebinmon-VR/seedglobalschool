import gsap from 'gsap';
import { cms, cmsEnabled } from './api.js';
import { esc, fmtDate, dayMonth, fmtWhen, fmtTime, isoDate, paragraphs, playerUrl, safeUrl } from './format.js';
import { EVENTS, MONTHS, MONTH_NAMES } from '../data/events.js';
import { postCard } from './cards.js';

/**
 * News & notices page (news.html): everything managed in the SEED Web Admin panel.
 * Sections stay hidden until they have something to show; if the panel can't be
 * reached (or has no content yet) a friendly "coming soon" section is shown instead.
 */
const PER_PAGE = { notices: 8, posts: 6, events: 8, photos: 9, videos: 6 };
const MONTH_INDEX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const $ = (id) => document.getElementById(id);
const toNodes = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return [...t.content.children];
};

export function initNews({ reduced, openFrame, openFile, scrollToEl }) {
  const relayout = () => window.dispatchEvent(new Event('seed:layout'));
  const appear = (nodes) => {
    if (!reduced && nodes.length) gsap.fromTo(nodes, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 });
  };

  /** "Load more" pagination for one list. */
  function pager({ list, more, fetchPage, render }) {
    let page = 0;
    let busy = false;
    let generation = 0; // bumped by reset(), so a reply for an old filter is dropped
    const next = async () => {
      if (busy) return null;
      busy = true;
      more.disabled = true;
      const mine = generation;
      try {
        const data = await fetchPage(page + 1);
        if (mine !== generation) return null;
        const nodes = toNodes(data.items.map(render).join(''));
        list.append(...nodes);
        page = data.page;
        more.hidden = page >= data.pages;
        if (page > 1) appear(nodes);
        relayout();
        return data;
      } finally {
        if (mine === generation) {
          busy = false;
          more.disabled = false;
        }
      }
    };
    more.addEventListener('click', () => next().catch((err) => console.info('[SEED] Could not load more:', err.message)));
    return {
      next,
      reset() {
        generation += 1;
        page = 0;
        busy = false;
        more.disabled = false;
        list.replaceChildren();
      },
    };
  }

  /* ---------- the "Coming up" chapter: the academic calendar until the panel has events ---------- */
  function renderComingUp(items) {
    $('coming-up').innerHTML = items.map((i) => `<li><strong>${esc(i.title)}</strong><span>${esc(i.when)}</span></li>`).join('');
  }
  function fromCalendar(n) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = [];
    for (const m of MONTHS) {
      for (const e of EVENTS[m] || []) {
        let d = new Date(today.getFullYear(), MONTH_INDEX[m], Number(e.day));
        if (d < today) d = new Date(today.getFullYear() + 1, MONTH_INDEX[m], Number(e.day));
        all.push({ title: e.title, when: `${Number(e.day)} ${MONTH_NAMES[m]}`, date: d });
      }
    }
    return all.sort((a, b) => a.date - b.date).slice(0, n);
  }
  renderComingUp(fromCalendar(4));

  /* ---------- live now ---------- */
  async function loadLive() {
    const { items } = await cms.events({ when: 'live', limit: 3 });
    if (!items.length) return false;
    $('live-list').innerHTML = items.map(liveBlock).join('');
    $('live').hidden = false;
    return true;
  }
  function liveBlock(e) {
    const embed = e.live_embed_url && playerUrl(e.live_embed_url);
    const link = safeUrl(e.live_url);
    const cover = safeUrl(e.cover_image_url);
    const screen = embed
      ? `<div class="cinema__screen"><iframe src="${esc(embed)}" title="${esc(e.title)}: live stream" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
      : cover
        ? `<div class="cinema__screen live__cover"><img src="${esc(cover)}" alt="" /></div>`
        : '';
    return `<article class="cinema live${screen ? '' : ' live--plain'}">
      <div class="cinema__side">
        <p class="kicker live__kicker"><span class="live-dot" aria-hidden="true"></span>Live now</p>
        <h2 class="section-title">${esc(e.title)}</h2>
        <p class="live__when">${esc([fmtWhen(e.start_at), e.venue].filter(Boolean).join(' · '))}</p>
        ${e.description ? `<div class="live__text">${paragraphs(e.description)}</div>` : ''}
        ${link ? `<a class="link-arrow link-arrow--light" href="${esc(link)}" target="_blank" rel="noopener">${embed ? 'Open the stream' : 'Watch the live stream'}</a>` : ''}
      </div>
      ${screen}
    </article>`;
  }

  /* ---------- notice board ---------- */
  async function loadNotices() {
    const p = pager({
      list: $('notice-list'),
      more: $('notice-more'),
      fetchPage: (page) => cms.notices({ page, limit: PER_PAGE.notices }),
      render: noticeItem,
    });
    const first = await p.next();
    return !!first?.total;
  }
  function noticeItem(n) {
    const { day, month } = dayMonth(n.published_at);
    const priority = ['important', 'urgent'].includes(n.priority) ? n.priority : 'normal';
    const flags = [
      priority !== 'normal' && `<span class="notice__flag">${priority === 'urgent' ? 'Urgent' : 'Important'}</span>`,
      n.is_pinned && '<span>Pinned</span>',
      n.category && `<span>${esc(n.category)}</span>`,
    ]
      .filter(Boolean)
      .join('');
    const file = safeUrl(n.attachment_url);
    return `<li class="notice notice--${priority}" id="notice-${Number(n.id)}">
      <time class="cal__date" datetime="${isoDate(n.published_at)}" title="${esc(fmtDate(n.published_at))}"><b>${esc(day)}</b><small>${esc(month)}</small></time>
      <div class="notice__main">
        ${flags ? `<p class="notice__meta">${flags}</p>` : ''}
        <h3>${esc(n.title)}</h3>
        ${n.body ? `<div class="notice__text">${paragraphs(n.body)}</div>` : ''}
        ${file ? `<a class="link-arrow notice__file" href="${esc(file)}" target="_blank" rel="noopener">${esc(n.attachment_name || 'Download the attachment')}</a>` : ''}
      </div>
    </li>`;
  }

  /* ---------- news posts ---------- */
  async function loadPosts() {
    const p = pager({
      list: $('post-list'),
      more: $('post-more'),
      fetchPage: (page) => cms.posts({ page, limit: PER_PAGE.posts }),
      render: postCard,
    });
    const first = await p.next();
    return !!first?.total;
  }

  /* ---------- upcoming events ---------- */
  async function loadEvents() {
    const p = pager({
      list: $('event-list'),
      more: $('event-more'),
      fetchPage: (page) => cms.events({ when: 'upcoming', page, limit: PER_PAGE.events }),
      render: eventItem,
    });
    const first = await p.next();
    if (!first?.total) return false;
    const next = first.items.filter((e) => e.state !== 'cancelled').slice(0, 4);
    if (next.length) {
      renderComingUp(next.map((e) => ({ title: e.title, when: fmtWhen(e.start_at) })));
      $('coming-all').hidden = false;
      $('coming-cal').hidden = true;
      $('coming-note').textContent = 'Straight from the school office. Dates and times are in IST.';
    }
    return true;
  }
  function eventItem(e) {
    const { day, month } = dayMonth(e.start_at);
    const cancelled = e.state === 'cancelled';
    const sameDay = e.end_at && dayMonth(e.end_at).day === day && dayMonth(e.end_at).month === month;
    const when = e.end_at ? `${fmtWhen(e.start_at)} – ${sameDay ? fmtTime(e.end_at) : fmtWhen(e.end_at)}` : fmtWhen(e.start_at);
    return `<li class="${cancelled ? 'is-cancelled' : ''}">
      <time class="cal__date" datetime="${isoDate(e.start_at)}"><b>${esc(day)}</b><small>${esc(month)}</small></time>
      <div>
        <h4>${esc(e.title)}</h4>
        <p class="event__when">${esc([when, e.venue].filter(Boolean).join(' · '))}</p>
        ${e.description ? `<div class="event__text">${paragraphs(e.description)}</div>` : ''}
      </div>
      <span class="tag${cancelled ? ' tag--muted' : ''}">${cancelled ? 'Cancelled' : 'Upcoming'}</span>
    </li>`;
  }

  /* ---------- photos, with album filters ---------- */
  async function loadPhotos() {
    let album = '';
    const p = pager({
      list: $('photo-list'),
      more: $('photo-more'),
      fetchPage: (page) => cms.gallery({ page, limit: PER_PAGE.photos, album }),
      render: photoTile,
    });
    const [first, albums] = await Promise.all([p.next(), cms.albums().catch(() => ({ items: [] }))]);
    if (!first?.total) return false;
    const names = (albums.items || []).map((a) => a.album).filter(Boolean);
    if (names.length > 1) {
      const wrap = $('album-filters');
      wrap.innerHTML = ['', ...names]
        .map((n) => `<button type="button" data-album="${esc(n)}"${n ? '' : ' class="is-on"'} aria-pressed="${n ? 'false' : 'true'}">${esc(n || 'All')}</button>`)
        .join('');
      wrap.hidden = false;
      wrap.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-album]');
        if (!btn || btn.dataset.album === album) return;
        album = btn.dataset.album;
        wrap.querySelectorAll('button').forEach((b) => {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        p.reset();
        try {
          if (await p.next()) appear([...$('photo-list').children]);
        } catch (err) {
          console.info('[SEED] Could not load the album:', err.message);
        }
      });
    }
    return true;
  }
  function photoTile(g) {
    const url = safeUrl(g.url);
    if (!url) return '';
    // the panel fills in a title from the file name ("IMG 2034"), so prefer the caption or album
    const label = g.caption || g.album || g.title || '';
    return `<figure class="tile"><button data-full="${esc(url)}" aria-label="${esc(label ? `Open photo: ${label}` : 'Open photo')}"><img src="${esc(url)}" alt="${esc(g.caption || g.title || '')}" loading="lazy" decoding="async" /></button>${label ? `<figcaption>${esc(label)}</figcaption>` : ''}</figure>`;
  }

  /* ---------- videos ---------- */
  const videos = new Map();
  async function loadVideos() {
    const p = pager({
      list: $('video-list'),
      more: $('video-more'),
      fetchPage: (page) => cms.videos({ page, limit: PER_PAGE.videos }),
      render: videoTile,
    });
    const first = await p.next();
    if (!first?.total) return false;
    const list = $('video-list');
    const play = (tile) => tile && playVideo(videos.get(tile.dataset.video));
    list.addEventListener('click', (e) => play(e.target.closest('.mtile')));
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tile = e.target.closest('.mtile');
      if (!tile) return;
      e.preventDefault();
      play(tile);
    });
    return true;
  }
  function videoTile(v) {
    videos.set(String(v.id), v);
    const thumb = safeUrl(v.thumbnail_url);
    const meta = [v.category, fmtDate(v.created_at)].filter(Boolean).map(esc).join(' · ');
    return `<article class="mtile" data-video="${Number(v.id)}" tabindex="0" role="button" aria-label="Play video: ${esc(v.title)}">
      <div class="mtile__img${thumb ? '' : ' mtile__img--empty'}">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" />` : '<img class="mtile__logo" src="assets/img/logo-footer.png" alt="" width="104" height="62" />'}<span class="mtile__play" aria-hidden="true"></span></div>
      ${meta ? `<p class="mtile__when">${meta}</p>` : ''}<h4>${esc(v.title)}</h4>${v.description ? `<p>${esc(v.description)}</p>` : ''}
    </article>`;
  }
  function playVideo(v) {
    if (!v) return;
    const file = v.source === 'upload' && safeUrl(v.video_url);
    if (file) return openFile(file, v.title, safeUrl(v.thumbnail_url));
    const embed = v.embed_url && playerUrl(v.embed_url, { autoplay: true });
    if (embed) return openFrame(embed, v.title);
    const link = safeUrl(v.video_url);
    if (link) window.open(link, '_blank', 'noopener');
  }

  /* ---------- put it together ---------- */
  function finish(found) {
    const any = found.some(Boolean);
    $('news-empty').hidden = any;
    // alternate the section backgrounds across whichever sections are showing
    document.querySelectorAll('.cms-section').forEach((s) => s.classList.remove('section--tint'));
    [...document.querySelectorAll('.cms-section:not([hidden])')].forEach((s, i) => s.classList.toggle('section--tint', i % 2 === 1));
    // hero buttons only point at sections that exist; while something is live the
    // hero leads with the stream ("Watch live", then the notice board)
    document.querySelectorAll('.chapter--hero .actions a[href^="#"]').forEach((a) => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      a.hidden = !target || target.hidden;
    });
    if (!$('live').hidden) {
      $('hero-news').hidden = true;
      $('hero-notices').classList.replace('btn--gold', 'btn--outline');
    }
    relayout();
    // deep links such as news.html#notice-12 (from the ticker)
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) {
      let el = document.getElementById(id);
      if (!el && id.startsWith('notice-')) el = $('notices');
      if (el && !el.closest('[hidden]')) {
        el.classList.add('is-target');
        requestAnimationFrame(() => scrollToEl(el));
      }
    }
  }

  if (!cmsEnabled) {
    finish([]);
    return;
  }
  const sections = { live: loadLive, notices: loadNotices, news: loadPosts, upcoming: loadEvents, photos: loadPhotos, videos: loadVideos };
  Promise.all(
    Object.entries(sections).map(async ([id, load]) => {
      try {
        const has = await load();
        if (id !== 'live') $(id).hidden = !has;
        return has;
      } catch (err) {
        console.info(`[SEED] Could not load ${id} from the control panel:`, err.message);
        return false;
      }
    }),
  ).then(finish);
}
