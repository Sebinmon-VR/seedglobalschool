import gsap from 'gsap';

/** Full-screen viewer for gallery photos, prize posters and videos. */
export function initLightbox({ lenis }) {
  const box = document.getElementById('lightbox');
  if (!box) return { openVideo: () => {}, openFrame: () => {}, openFile: () => {} };
  const stage = box.querySelector('.lightbox__stage');
  const caption = box.querySelector('.lightbox__caption');
  let shots = [];
  let idx = 0;
  let lastFocus = null;
  const visible = () => [...document.querySelectorAll('.tile:not(.is-hidden) button[data-full], .poster button[data-full]')];
  const captionOf = (btn) => btn.closest('figure')?.querySelector('figcaption')?.innerText.replace(/\s+/g, ' ').trim() || '';

  const showImage = (i) => {
    idx = (i + shots.length) % shots.length;
    const shot = shots[idx];
    const img = new Image();
    img.src = shot.dataset.full;
    img.alt = shot.querySelector('img')?.alt || '';
    stage.replaceChildren(img);
    caption.textContent = captionOf(shot);
    gsap.fromTo(img, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  };
  const open = (fn) => {
    lastFocus = document.activeElement;
    box.hidden = false;
    lenis?.stop();
    gsap.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 });
    fn();
    box.querySelector('.lightbox__close').focus();
  };
  const close = () =>
    gsap.to(box, {
      autoAlpha: 0, duration: 0.3,
      onComplete: () => {
        box.hidden = true;
        box.classList.remove('is-video');
        stage.replaceChildren();
        if (!document.body.classList.contains('menu-open')) lenis?.start();
        lastFocus?.focus();
      },
    });
  /** Any embeddable player (YouTube, Vimeo, Facebook). */
  const openFrame = (src, title = '') =>
    open(() => {
      box.classList.add('is-video');
      const f = document.createElement('iframe');
      f.src = src;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.title = title;
      stage.replaceChildren(f);
      caption.textContent = title;
    });
  /** A video file uploaded to the admin panel. */
  const openFile = (src, title = '', poster = null) =>
    open(() => {
      box.classList.add('is-video');
      const v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      if (poster) v.poster = poster;
      v.setAttribute('aria-label', title);
      stage.replaceChildren(v);
      caption.textContent = title;
    });
  const openVideo = (id, title = '') => openFrame(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tile button[data-full], .poster button[data-full]');
    if (!btn) return;
    shots = visible();
    open(() => showImage(shots.indexOf(btn)));
  });
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.querySelector('.lightbox__nav--prev').addEventListener('click', () => showImage(idx - 1));
  box.querySelector('.lightbox__nav--next').addEventListener('click', () => showImage(idx + 1));
  box.addEventListener('click', (e) => e.target === box && close());
  window.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (!box.classList.contains('is-video')) {
      if (e.key === 'ArrowRight') showImage(idx + 1);
      if (e.key === 'ArrowLeft') showImage(idx - 1);
    }
  });
  return { openVideo, openFrame, openFile };
}
