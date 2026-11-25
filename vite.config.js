import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

const root = import.meta.dirname;
const pages = ['index', 'about', 'academics', 'admissions', 'events', 'news', 'post', 'gallery', 'contact', 'disclosure'];

/** Tiny build-time include: <!-- @include header.html --> pulls in partials/header.html */
function htmlIncludes() {
  return {
    name: 'seed-html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_, file) =>
          fs.readFileSync(resolve(root, 'partials', file), 'utf-8'),
        );
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.replace(/\\/g, '/').includes('/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

/**
 * site-images.json: every picture the pages use (public/assets/img/...), with where it
 * appears. The SEED Web Admin panel reads this list for its "Website images" section,
 * where staff can replace any picture; src/cms/site.js then shows the replacement.
 */
const PAGE_NAMES = {
  index: 'Home', about: 'About', academics: 'Academics', admissions: 'Admissions', events: 'Events', news: 'News',
  post: 'Articles', gallery: 'Gallery', contact: 'Contact', disclosure: 'Disclosure', header: 'Menu', footer: 'Footer',
};
const ENTITIES = { amp: '&', quot: '"', '#39': "'", rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', nbsp: ' ' };
const decode = (s) => s.replace(/&(\w+|#\d+);/g, (m, e) => ENTITIES[e] ?? m);
const humanize = (key) => key.split('/').pop().replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function collectSiteImages() {
  const sources = [...pages.map((p) => [p, `${p}.html`]), ['header', 'partials/header.html'], ['footer', 'partials/footer.html']];
  const found = new Map();
  for (const [name, file] of sources) {
    const html = fs.readFileSync(resolve(root, file), 'utf-8');
    for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) {
      const alt = decode(tag.match(/\balt="([^"]*)"/)?.[1] || tag.match(/\bdata-title="([^"]*)"/)?.[1] || '');
      for (const [, src, key] of tag.matchAll(/\b(?:src|data-full|data-img|data-thumb)="(assets\/img\/([^"]+)\.(?:webp|jpe?g|png|gif|avif))"/gi)) {
        const entry = found.get(key) || { key, src, label: '', pages: [] };
        if (!entry.label && alt) entry.label = alt;
        if (!entry.pages.includes(PAGE_NAMES[name])) entry.pages.push(PAGE_NAMES[name]);
        found.set(key, entry);
      }
    }
  }
  const order = Object.values(PAGE_NAMES);
  return [...found.values()]
    .map((e) => ({ ...e, label: e.label || humanize(e.key), group: e.pages.find((p) => p !== 'Menu' && p !== 'Footer') || e.pages[0] }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.label.localeCompare(b.label));
}

function siteImagesManifest() {
  const json = () => JSON.stringify({ generated: new Date().toISOString(), images: collectSiteImages() }, null, 2);
  return {
    name: 'seed-site-images',
    configureServer(server) {
      server.middlewares.use('/site-images.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(json());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'site-images.json', source: json() });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [htmlIncludes(), siteImagesManifest()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
