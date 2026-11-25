import gsap from 'gsap';

/** Shared helpers for lists filled from the admin panel (news page, gallery page). */

export const toNodes = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return [...t.content.children];
};

/** Tell the page its height changed (scroll triggers re-measure). */
export const relayout = () => window.dispatchEvent(new Event('seed:layout'));

export function appear(nodes, reduced) {
  if (!reduced && nodes.length) gsap.fromTo(nodes, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 });
}

/** "Load more" pagination for one list. */
export function pager({ list, more, fetchPage, render, reduced }) {
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
      if (page > 1) appear(nodes, reduced);
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
