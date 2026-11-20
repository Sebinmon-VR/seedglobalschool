import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

const root = import.meta.dirname;
const pages = ['index', 'about', 'academics', 'admissions', 'events', 'gallery', 'contact', 'disclosure'];

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

export default defineConfig({
  base: './',
  plugins: [htmlIncludes()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
