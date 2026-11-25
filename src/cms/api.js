/**
 * Connection to the SEED Web Admin control panel (github.com/Sebinmon-VR/seedwebadmin).
 *
 * The panel's public API supplies the news, notices, events, live streams, photos and
 * videos shown on the website, and its inbox receives the admission enquiry forms.
 *
 * The panel's address can be changed at build time with VITE_CMS_URL, for example
 *   VITE_CMS_URL=http://localhost:4000 npm run dev
 * Set it to an empty string to switch the connection off: the news page then shows a
 * "coming soon" note and the forms fall back to WhatsApp.
 */
const DEFAULT_URL = 'https://seedwebadmin.azurewebsites.net';

export const CMS_URL = String(import.meta.env.VITE_CMS_URL ?? DEFAULT_URL).trim().replace(/\/+$/, '');
export const cmsEnabled = /^https?:\/\/[^/]/.test(CMS_URL);
const API = `${CMS_URL}/api/public`;

export class CmsError extends Error {
  constructor(message, status = 0, fields = null) {
    super(message);
    this.status = status; // 0 = offline, blocked (CORS) or timed out
    this.fields = fields; // per-field validation errors from the enquiry form
  }
}

async function request(path, { params, method = 'GET', body, timeout = 12000 } = {}) {
  if (!cmsEnabled) throw new CmsError('The control panel is not connected.');
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: ctrl.signal,
      credentials: 'omit',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new CmsError('Could not reach the school office server.');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) throw new CmsError(data?.error || `Request failed (${res.status}).`, res.status, data?.fields || null);
  return data;
}

let homeRequest = null;

export const cms = {
  /** Everything a page header needs: ticker notices, live events, settings (shared by all callers). */
  home: () => (homeRequest ??= request('/home')),
  notices: (params) => request('/notices', { params }),
  posts: (params) => request('/posts', { params }),
  post: (slug) => request(`/posts/${encodeURIComponent(slug)}`),
  events: (params) => request('/events', { params }),
  gallery: (params) => request('/gallery', { params }),
  albums: () => request('/gallery/albums'),
  videos: (params) => request('/videos', { params }),
  sendEnquiry: (data) => request('/enquiries', { method: 'POST', body: data, timeout: 20000 }),
};
