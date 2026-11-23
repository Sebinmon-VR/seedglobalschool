# SEED Global School: website

An immersive 3D scrolling website for SEED Global School (Maranchery, Ponnani, Kerala).

When the page loads, a seed drops onto a floating island of earth. As the visitor scrolls, it grows into a tree, and the page moves through nine "chapters". Each stage of the tree stands for a stage in a child's growth at SEED. Each chapter holds while its text appears, then the tree grows on into the next stage:

| Tree stage | The child | Chapter content | Scene |
|---|---|---|---|
| Seed | Arrives | Hero: "Foster blooming minds" | The seed falls, bounces and lands with a golden dust burst |
| Roots | Belonging | Feeling safe and known; school facts | The camera dives below ground and roots glow through the soil |
| Sapling | Pre-Primary (age 4–6): first independence | Montessori areas | The seed cracks open and the trunk rises |
| Branches | Primary (Grade 1–3): curiosity reaching out | Primary subjects | Branches spread out |
| Leaves | Upper Primary (Grade 4–7): knowledge | Labs, library, SEED Talks | Thousands of leaves open |
| Canopy | Character | The eight values | The full canopy at dusk |
| Blossom | Talents | Events and gallery photos | Blossoms and falling petals |
| Fruit | Confidence | Prizes and Achievers' Day | Golden fruit at golden hour |
| New seeds | Ready for the world; a new child begins | Admissions and campus visit | The grown tree at dusk, with fireflies |

The `data-stage` keys behind these (in `src/three/Director.js`) are `hero`, `roots`, `trunk`, `branches`, `leaves`, `canopy`, `bloom`, `fruit` and `harvest`. The Academics page reuses `trunk`, `branches` and `leaves` for Pre-Primary, Primary and Upper Primary.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (always open through this, not by double-clicking index.html)
npm run build      # production build → dist/
npm run preview    # serve the production build
```

To deploy, upload the contents of `dist/` to any static host.

## Pages

| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | The 3D seed-to-tree journey, with a short caption per stage linking to the pages below |
| About | `about.html` | Story, vision and mission, values, Principal's message, Heads of School, the Trust |
| Academics | `academics.html` | Pre-Primary, Primary and Upper Primary, curriculum, SEED Smile, SEED Aspire, MTTC, campus |
| Admissions | `admissions.html` | Who can apply, the 4 steps, fee and calendar documents, enquiry form |
| Events | `events.html` | Month-by-month calendar and signature celebrations |
| Gallery | `gallery.html` | Filterable photo gallery, prize-winner posters, video player |
| Contact | `contact.html` | Address, phones and email, map, message form, careers |
| Disclosure | `disclosure.html` | CBSE Mandatory Public Disclosure |

The header, full-screen menu and footer are shared. They live in `partials/header.html` and `partials/footer.html` and are pulled into every page at build time with `<!-- @include header.html -->`.

## Updating content

| What | Where |
|---|---|
| Page text | The page's own `.html` file |
| Navigation, menu, footer | `partials/header.html`, `partials/footer.html` |
| **Events calendar** | `src/data/events.js` (the current month is highlighted automatically) |
| Gallery photos | `public/assets/img/gallery/` + the `#photo-grid` figures in `gallery.html` (`data-cat` drives the filters) |
| Videos | `#episodes` list in `gallery.html` (YouTube IDs + thumbnails) |
| CBSE documents | `public/docs/` + `disclosure.html` |
| Styles | `src/styles/main.css` (deep green, ivory and gold; Playfair Display + Inter) |

## Children characters (planting → growing up)

The scene supports rigged, animated **glTF/GLB** characters. When they're present, the children:

- look up as the seed falls and cheer when it lands
- kneel to plant it, and water it with a watering can
- grow taller chapter by chapter
- step forward together under the full-grown tree at the end and wave

To add them:

1. Put the `.glb` files in `public/assets/models/kids/`.
2. Copy `kids.example.json` to `kids.json` and list the files.
   - `clips` maps our actions (`idle`, `wave`, `cheer`, `clap`, `kneel`) to the animation names in the files.
   - `bones` names the right-hand bone, where the watering can attaches.
   - `slots` picks which model stands in each of the 4 places: planter, waterer, clapper and waver.
3. Reload the page. If `kids.json` is missing, the site runs without children.

**Model requirements:** GLB, humanoid rig, including at least an Idle clip (Wave, Jump or Cheer, Clap and Kneel are used if present). Under about 8 MB each, licensed for web use.

**Ways to get them:**

- **From a character sheet** (front, side and back views): an image-to-3D service with auto-rigging, such as Meshy or Tripo, can turn a turnaround image into a rigged, animated GLB.
- **Buy** a stylised "cartoon kids" pack that includes GLB files and animations.

## Tech

Vite · Three.js (procedural tree, GPU growth shaders) · GSAP (ScrollTrigger, SplitText) · Lenis smooth scroll.
Fonts: Playfair Display (headings) and Inter (text).

Add `?debug` to the URL to get `__world`, `__director` and `__lenis` in the browser console.

## Content to confirm with the school

- **Principal's message:** only the opening line is used (see `TODO` in `about.html`).
- **Key personnel photos:** check that each photo matches the right name (see `NOTE` in `about.html`).
- **Admission steps:** the four steps are a suggested journey.
- **Calendar:** events are taken from the 2025–26 academic calendar. Update `src/data/events.js` when the 2026–27 calendar is out.
- **Enquiry form:** it opens WhatsApp with a pre-filled message. It can be connected to email or a CRM.
