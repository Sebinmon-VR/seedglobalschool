import gsap from 'gsap';
import { cms, cmsEnabled } from '../cms/api.js';

const WHATSAPP = '918593990033';
// form field → admin panel enquiry field
const FIELD_MAP = { child: 'student_name', parent: 'parent_name', phone: 'phone', program: 'class_applying', message: 'message' };

const whatsappUrl = (form, d) => {
  const text = [
    `Hello SEED Global School! ${form.dataset.intro || 'I would like to enquire about admission.'}`,
    `Name: ${d.parent}`,
    `Phone: ${d.phone}`,
    d.child ? `Child: ${d.child}` : null,
    d.program ? `Programme: ${d.program}` : null,
    d.message ? `Message: ${d.message}` : null,
  ].filter(Boolean).join('\n');
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
};

/**
 * Enquiry forms → the admission enquiries inbox in the SEED Web Admin panel.
 * Without a panel connection they open WhatsApp with a pre-filled message, as before.
 * If the panel can't be reached, the visitor is offered the same WhatsApp message.
 */
export function initForms() {
  document.querySelectorAll('form.enquiry').forEach((form) => {
    const status = form.querySelector('.enquiry__status');
    const button = form.querySelector('[type="submit"]');
    const say = (text, error = false) => {
      status.replaceChildren(text);
      status.classList.toggle('is-error', error);
    };
    let sending = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;
      let ok = true;
      form.querySelectorAll('[required]').forEach((f) => {
        const valid = f.value.trim() !== '' && (f.type !== 'tel' || /^[+\d][\d\s-]{6,}$/.test(f.value.trim()));
        f.setAttribute('aria-invalid', String(!valid));
        if (!valid) ok = false;
      });
      if (!ok) {
        say('Please fill in the highlighted fields, with a valid phone number.', true);
        gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        return;
      }
      const d = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

      if (!cmsEnabled) {
        window.open(whatsappUrl(form, d), '_blank', 'noopener');
        say('Thank you! Opening WhatsApp so you can send your message.');
        form.reset();
        return;
      }

      sending = true;
      button.disabled = true;
      say('Sending…');
      try {
        await cms.sendEnquiry({
          student_name: d.child || 'General enquiry',
          parent_name: d.parent,
          phone: d.phone,
          class_applying: d.program,
          message: d.message,
          source: form.dataset.source || 'Website',
          website: d.website, // honeypot: real visitors leave it empty
        });
        say('Thank you! Your enquiry has reached the school office. We’ll call you back soon.');
        form.reset();
      } catch (err) {
        if (err.status === 422 && err.fields) {
          for (const [field, key] of Object.entries(FIELD_MAP)) {
            if (err.fields[key]) form.elements[field]?.setAttribute('aria-invalid', 'true');
          }
          say(err.message, true);
        } else if (err.status === 429) {
          say(err.message, true);
        } else {
          const link = Object.assign(document.createElement('a'), { href: whatsappUrl(form, d), target: '_blank', rel: 'noopener', textContent: 'send it on WhatsApp' });
          status.replaceChildren('We couldn’t send your enquiry just now. Please ', link, ' or call +91 85939 90033.');
          status.classList.add('is-error');
        }
      } finally {
        sending = false;
        button.disabled = false;
      }
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
