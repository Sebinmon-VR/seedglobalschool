import gsap from 'gsap';

/** Header (scrolled state, active link), full-screen menu with hover imagery, footer year. */
export function initChrome({ lenis, reduced }) {
  const body = document.body;
  const header = document.getElementById('header');
  const menu = document.getElementById('menu');
  const btn = document.getElementById('menu-toggle');
  const menuImg = document.getElementById('menu-img');

  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a, .menu__list a').forEach((a) => {
    if (a.getAttribute('href').split('#')[0] === here) a.classList.add('is-active');
  });
  document.querySelectorAll('.js-year').forEach((el) => (el.textContent = new Date().getFullYear()));

  const setMenu = (open) => {
    body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.menu-btn__label').textContent = open ? 'Close' : 'Menu';
    menu.setAttribute('aria-hidden', String(!open));
    if (open) {
      lenis?.stop();
      if (!reduced) {
        gsap.fromTo(menu.querySelectorAll('.menu__list a'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.3 });
        gsap.fromTo(menuImg, { scale: 1.15 }, { scale: 1, duration: 1.6, ease: 'expo.out', delay: 0.2 });
      }
    } else {
      lenis?.start();
    }
  };
  btn.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && body.classList.contains('menu-open') && setMenu(false));

  // the picture beside the menu changes with the hovered page
  menu.querySelectorAll('.menu__list a[data-img]').forEach((a) => {
    const pre = new Image();
    pre.src = a.dataset.img;
    a.addEventListener('pointerenter', () => {
      if (menuImg.getAttribute('src') === a.dataset.img) return;
      gsap.to(menuImg, {
        autoAlpha: 0.2, duration: 0.2,
        onComplete: () => {
          menuImg.src = a.dataset.img;
          gsap.to(menuImg, { autoAlpha: 1, duration: 0.5 });
        },
      });
    });
  });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return { setMenu };
}
