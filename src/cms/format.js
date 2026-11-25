/** Small helpers for showing control-panel content safely and in the school's time zone. */

const TZ = 'Asia/Kolkata';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const parts = (iso, opts) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...opts }).format(d);
};

/** "5 Dec 2026" */
export const fmtDate = (iso) => parts(iso, { day: 'numeric', month: 'short', year: 'numeric' }) || '';
/** { day: "05", month: "Dec" } for the calendar-style date blocks */
export const dayMonth = (iso) => ({
  day: parts(iso, { day: '2-digit' }) || '',
  month: parts(iso, { month: 'short' }) || '',
});
/** "10:30 am" */
export const fmtTime = (iso) => (parts(iso, { hour: 'numeric', minute: '2-digit', hour12: true }) || '').toLowerCase();
/** "Fri 5 Dec · 10:30 am" (adds the year when it isn't this year) */
export function fmtWhen(iso) {
  const sameYear = parts(iso, { year: 'numeric' }) === parts(new Date().toISOString(), { year: 'numeric' });
  const date = parts(iso, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return date ? `${date} · ${fmtTime(iso)}` : '';
}
export const isoDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

/** Plain text (notices, event descriptions) → escaped paragraphs with line breaks. */
export const paragraphs = (text) =>
  String(text ?? '')
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`)
    .join('');

/** Embed URLs from the panel, switched to YouTube's privacy-enhanced player like the rest of the site. */
export function playerUrl(embed, { autoplay = false } = {}) {
  try {
    const u = new URL(embed);
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      u.hostname = 'www.youtube-nocookie.com';
      u.searchParams.set('rel', '0');
      if (autoplay) u.searchParams.set('autoplay', '1');
    } else if (u.hostname === 'player.vimeo.com' && autoplay) {
      u.searchParams.set('autoplay', '1');
    } else if (u.hostname.endsWith('facebook.com') && autoplay) {
      u.searchParams.set('autoplay', 'true');
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Only follow http(s) links from the panel. */
export const safeUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
};
