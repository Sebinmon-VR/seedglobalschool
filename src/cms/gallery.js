import { cmsEnabled } from './api.js';
import { loadPhotoFeed } from './photos.js';
import { relayout } from './list.js';

/**
 * Gallery page: photos posted in the admin panel's Photo gallery appear under
 * "Latest photos", above the site's built-in photos. Hidden until there is one.
 */
export async function initGallery({ reduced }) {
  const block = document.getElementById('latest-photos');
  if (!block || !cmsEnabled) return;
  try {
    const has = await loadPhotoFeed({
      list: document.getElementById('photo-list'),
      more: document.getElementById('photo-more'),
      filters: document.getElementById('album-filters'),
      reduced,
    });
    block.hidden = !has;
    if (has) relayout();
  } catch (err) {
    console.info('[SEED] Could not load photos from the control panel:', err.message);
  }
}
