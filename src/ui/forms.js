import gsap from 'gsap';

/** Enquiry forms → WhatsApp with a pre-filled message. Curriculum-style tabs. */
export function initForms() {
  document.querySelectorAll('form.enquiry').forEach((form) => {
    const status = form.querySelector('.enquiry__status');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      form.querySelectorAll('[required]').forEach((f) => {
        const valid = f.value.trim() !== '' && (f.type !== 'tel' || /^[+\d][\d\s-]{6,}$/.test(f.value.trim()));
        f.setAttribute('aria-invalid', String(!valid));
        if (!valid) ok = false;
      });
      if (!ok) {
        status.textContent = 'Please add your name, a valid phone number and a programme.';
        gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        return;
      }
      const d = Object.fromEntries(new FormData(form));
      const text = [
        `Hello SEED Global School! ${form.dataset.intro || 'I would like to enquire about admission.'}`,
        `Name: ${d.parent}`,
        `Phone: ${d.phone}`,
        d.child ? `Child: ${d.child}` : null,
        d.program ? `Programme: ${d.program}` : null,
        d.message ? `Message: ${d.message}` : null,
      ].filter(Boolean).join('\n');
      window.open(`https://wa.me/918593990033?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      status.textContent = 'Thank you! Opening WhatsApp so you can send your message.';
      form.reset();
    });
  });
}

export function initTabs(reduced) {
  document.querySelectorAll('.tabs').forEach((wrap) => {
    const tabs = [...wrap.querySelectorAll('[role="tab"]')];
    const select = (tab, focus = false) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const p = document.getElementById(t.getAttribute('aria-controls'));
        p.hidden = !on;
        if (on && !reduced) gsap.fromTo(p.querySelectorAll('li'), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out', stagger: 0.03 });
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length], true);
        if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length], true);
      });
    });
  });
}
