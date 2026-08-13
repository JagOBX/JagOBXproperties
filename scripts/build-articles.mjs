// Turns content/articles/*.md into static pages under docs/articles/.
//
// Each page is plain HTML with inlined CSS and no JavaScript, so it loads fast
// and is trivially readable by search crawlers and AI answer engines. Also
// writes the article index, sitemap.xml, robots.txt and llms.txt.
//
// Run with: npm run build:articles

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "content", "articles");
const OUT = path.join(ROOT, "docs");
const SITE = "https://jagobxproperties.com";
const BRAND = "Jag Outer Banks Properties";

// Matches the palette in src/App.jsx. Contrast ratios here are the AA-compliant
// values from the site audit — don't lighten them without re-checking.
const C = {
  navy: "#1C1B20",
  navyDeep: "#131216",
  teal: "#096169",
  tealOnDark: "#0FA3B1",
  sand: "#F0E6DE",
  coral: "#0B737D",
  coralDark: "#085961",
  salmonInk: "#A05151",
  foam: "#FCF8F4",
  ink: "#201C1E",
  slate: "#615A5D",
  meta: "#6C6C62",
  focus: "#FFD23B",
};

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Minimal front matter parser: a --- fenced block of key: value pairs at the
// top of the file. Values may be quoted; `faq` is a list of Q/A pairs written
// as `- q: ...` / `  a: ...`.
function parseFrontMatter(raw) {
  if (!raw.startsWith("---")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: raw };
  const head = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s*\n/, "");
  const data = {};
  let faq = null;
  let current = null;
  for (const line of head.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const listItem = line.match(/^\s*-\s*q:\s*(.*)$/);
    if (listItem) {
      current = { q: unquote(listItem[1]), a: "" };
      (faq ||= []).push(current);
      continue;
    }
    const answer = line.match(/^\s+a:\s*(.*)$/);
    if (answer && current) {
      current.a = unquote(answer[1]);
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) {
      current = null;
      if (kv[2] === "" && kv[1] === "faq") continue;
      data[kv[1]] = unquote(kv[2]);
    }
  }
  if (faq) data.faq = faq;
  return { data, body };
}

const unquote = (v) => v.trim().replace(/^["'](.*)["']$/, "$1");

function layout({ title, description, canonical, schema, body, hero }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:site_name" content="${esc(BRAND)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:image" content="${SITE}/og-image.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@JagOBX" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700&family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0; background: ${C.foam}; color: ${C.ink};
        font-family: 'Work Sans', system-ui, sans-serif; font-size: 17px; line-height: 1.7;
      }
      .wrap { max-width: 720px; margin: 0 auto; padding: 0 1.25rem; }
      a { color: ${C.teal}; }
      :focus-visible { outline: 3px solid ${C.coral}; outline-offset: 2px; border-radius: 2px; }
      .on-dark :focus-visible { outline-color: ${C.focus}; }

      .skip-link {
        position: absolute; left: 0.5rem; top: -100px; z-index: 20;
        background: ${C.foam}; color: ${C.ink}; font-weight: 700;
        padding: 0.75rem 1.15rem; border-radius: 4px; text-decoration: none;
        border: 2px solid ${C.coral}; transition: top 0.15s ease;
      }
      .skip-link:focus { top: 0.5rem; }

      header.site { background: ${C.navy}; }
      header.site .wrap {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; padding-top: 0.9rem; padding-bottom: 0.9rem; flex-wrap: wrap;
      }
      .brand {
        font-family: 'Big Shoulders Display', sans-serif; font-weight: 700;
        font-size: 1.3rem; color: ${C.foam}; text-decoration: none; letter-spacing: 0.02em;
      }
      .brand span { color: #FF8080; }
      header.site nav { display: flex; gap: 1.25rem; }
      header.site nav a { color: ${C.foam}; text-decoration: none; font-size: 14px; }
      header.site nav a:hover { text-decoration: underline; }

      main { padding: 0 0 3.5rem; }

      /* Hero band. Uses the article photo when there is one, brand colour when
         there is not, so a photo-less article still looks deliberate. */
      .hero {
        background: ${C.navy}; color: ${C.foam}; padding: 3rem 0 2.5rem; margin-bottom: 2.5rem;
        background-size: cover; background-position: center;
      }
      .hero .wrap { position: relative; }
      .hero h1 { color: ${C.foam}; }
      /* Lightened from the flat-navy values so they still clear 4.5:1 against the
         brightest part of a photo hero. Measured, not guessed: see the contrast
         sweep in the build notes before changing either the colours or the
         overlay alpha above. */
      .hero .kicker { color: #FFC9C9; }
      .hero .byline { color: ${C.sand}; margin-bottom: 0; }
      .hero .crumb { color: ${C.sand}; }
      .hero .crumb a { color: ${C.sand}; }
      .hero-lede { font-size: 1.15rem; color: ${C.sand}; margin: 0.75rem 0 0; max-width: 34em; }

      figure { margin: 2rem 0; }
      figure img { width: 100%; height: auto; border-radius: 6px; display: block; }
      figcaption { font-size: 14px; color: ${C.meta}; margin-top: 0.5rem; }

      .glance { margin: 0 0 2.5rem; border-top: 2px solid ${C.ink}; }
      .glance div {
        display: flex; gap: 1.25rem; align-items: baseline;
        padding: 0.7rem 0; border-bottom: 1px solid ${C.sand};
      }
      .glance dt {
        flex: 0 0 7rem; font-family: 'JetBrains Mono', monospace; font-size: 11px;
        letter-spacing: 0.08em; text-transform: uppercase; color: ${C.meta}; margin: 0;
      }
      .glance dd { margin: 0; font-size: 16px; font-weight: 500; line-height: 1.5; }
      @media (max-width: 480px) {
        .glance div { display: block; padding: 0.65rem 0; }
        .glance dt { margin-bottom: 0.15rem; }
      }

      .property { display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap; }
      .property img { width: 190px; height: 130px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
      .property-body { flex: 1; min-width: 220px; }
      .crumb {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        letter-spacing: 0.06em; color: ${C.meta}; margin: 0 0 1rem;
      }
      .kicker {
        font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.1em;
        text-transform: uppercase; color: ${C.salmonInk}; margin: 0 0 0.5rem;
      }
      h1 {
        font-family: 'Big Shoulders Display', sans-serif; font-weight: 700;
        font-size: clamp(2rem, 6vw, 3rem); line-height: 1.08; margin: 0 0 0.75rem;
        text-wrap: balance;
      }
      h2 {
        font-family: 'Big Shoulders Display', sans-serif; font-weight: 700;
        font-size: clamp(1.4rem, 4vw, 1.9rem); margin: 2.25rem 0 0.6rem; line-height: 1.15;
      }
      h3 { font-size: 1.1rem; margin: 1.75rem 0 0.4rem; }
      p { margin: 0 0 1.1rem; text-wrap: pretty; }
      ul, ol { margin: 0 0 1.1rem; padding-left: 1.25rem; }
      li { margin-bottom: 0.4rem; }
      blockquote {
        margin: 1.5rem 0; padding: 0.25rem 0 0.25rem 1rem;
        border-left: 4px solid ${C.sand}; color: ${C.slate};
      }
      .byline { color: ${C.meta}; font-size: 14px; margin: 0 0 2rem; }

      .summary {
        background: ${C.sand}; border-radius: 6px; padding: 1.25rem 1.5rem; margin: 0 0 2rem;
      }
      .summary p:last-child { margin-bottom: 0; }
      .summary h2 {
        font-size: 1.1rem; font-family: 'Work Sans', sans-serif; margin: 0 0 0.5rem;
        text-transform: uppercase; letter-spacing: 0.06em;
      }

      .facts { width: 100%; border-collapse: collapse; margin: 0 0 2rem; font-size: 15px; }
      .facts th, .facts td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid ${C.sand}; vertical-align: top; }
      .facts th { width: 34%; font-weight: 600; }

      .cta {
        background: ${C.sand}; border-radius: 6px; padding: 1.5rem; margin: 2.5rem 0 0;
      }
      .cta h2 { margin-top: 0; }
      .btn {
        display: inline-flex; align-items: center; gap: 0.45rem; min-height: 48px;
        padding: 0.85rem 1.6rem; border-radius: 3px; text-decoration: none;
        background: ${C.coral}; color: #fff; font-weight: 700; font-size: 15px;
      }
      .btn:hover { background: ${C.coralDark}; }

      .card-list { list-style: none; padding: 0; margin: 2rem 0 0; }
      .card-list li { border-top: 1px solid ${C.sand}; padding: 1.25rem 0; margin: 0;
        display: grid; grid-template-columns: 200px 1fr; gap: 1.25rem; align-items: start; }
      .card-list li.no-thumb { grid-template-columns: 1fr; }
      .card-thumb { display: block; border-radius: 6px; overflow: hidden; }
      .card-thumb img { display: block; width: 100%; height: 130px; object-fit: cover; }
      .card-list h2 { margin: 0 0 0.3rem; }
      .card-list a { text-decoration: none; }
      .card-list a:hover h2 { text-decoration: underline; }
      .card-list p { margin: 0.25rem 0 0; color: ${C.slate}; font-size: 15px; }
      @media (max-width: 620px) {
        .card-list li { grid-template-columns: 1fr; gap: 0.85rem; }
        .card-thumb img { height: 180px; }
      }

      footer.site { background: ${C.navyDeep}; color: ${C.sand}; padding: 2.5rem 0; margin-top: 3rem; }
      footer.site a { color: ${C.tealOnDark}; }
      footer.site p { margin: 0.35rem 0; font-size: 14px; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
      }
      @media (max-width: 430px) {
        .wrap { padding: 0 0.9rem; }
        .brand { font-size: 1.05rem; }
      }
    </style>
    ${schema.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n    ")}
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header class="site on-dark">
      <div class="wrap">
        <a class="brand" href="/">JAGOBX <span>PROPERTIES</span></a>
        <nav aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/articles/">Articles</a>
        </nav>
      </div>
    </header>
    ${hero || ""}
    <main id="main-content" tabindex="-1">
      <div class="wrap">
${body}
      </div>
    </main>
    <footer class="site on-dark">
      <div class="wrap">
        <p><strong>${esc(BRAND)}</strong></p>
        <p>Outer Banks vacation rentals, Corolla to Nags Head.</p>
        <p><a href="/">Browse the properties</a></p>
      </div>
    </footer>
  </body>
</html>
`;
}

// The facts box under the summary. A single column of labelled rows rather than a
// tiled grid: the grid left an empty cell whenever the fact count was odd, which
// read as a blank panel, and values like the address and the season never fitted
// a narrow column anyway.
function glance(d) {
  const rows = [
    ["Where", d.location],
    ["Cost", d.cost],
    ["Season", d.season],
    ["Time needed", d.duration],
    ["Good for", d.goodFor],
    ["Address", d.address],
  ].filter(([, v]) => v);
  if (!rows.length) return "";
  return `<dl class="glance">
${rows.map(([k, v]) => `  <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n")}
</dl>`;
}

// Copies content/images into docs/images so articles can reference photos at
// /images/<file>. Anything dropped in that folder is published as-is.
function copyImages() {
  const src = path.join(ROOT, "content", "images");
  if (!fs.existsSync(src)) return [];
  const dest = path.join(OUT, "images");
  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp|avif|svg)$/i.test(f));
  files.forEach((f) => fs.copyFileSync(path.join(src, f), path.join(dest, f)));
  return files;
}

// House style: no em dashes, en dashes, or a hyphen used as a connector. They are
// the clearest tell that a machine wrote the text. Fail the build rather than
// publish a piece that breaks the rule, so it gets fixed at the source.
function checkStyle(file, raw) {
  const problems = [];
  raw.split("\n").forEach((line, i) => {
    if (/[\u2014\u2013]/.test(line)) {
      problems.push(`line ${i + 1}: em or en dash -> ${line.trim().slice(0, 90)}`);
    } else if (/\S \u002D \S/.test(line) && !line.trim().startsWith("|")) {
      problems.push(`line ${i + 1}: hyphen used as punctuation -> ${line.trim().slice(0, 90)}`);
    }
  });
  if (problems.length) {
    throw new Error(
      `${file} breaks house style. Rewrite with commas, full stops, colons or parentheses.\n  ` +
        problems.join("\n  ")
    );
  }
}

// House rule: every section of an article carries a picture. A wall of text with
// one photo at the top reads as filler, so the build refuses to publish an
// article where a heading is followed by prose and nothing else. Write the image
// into the Markdown itself, at the end of the section it belongs to:
//
//   ![Someone climbing the dune](/images/climb.jpg "Photo by Name, CC BY-SA 4.0")
//
// The title text becomes the caption, which is also where the credit goes.
function checkSectionImages(file, body, hasLeadPhoto) {
  const lines = body.split("\n");
  const sections = [];
  let current = { heading: "(intro)", line: 1, text: [] };
  lines.forEach((line, i) => {
    if (/^##\s+/.test(line)) {
      sections.push(current);
      current = { heading: line.replace(/^##\s+/, "").trim(), line: i + 1, text: [] };
    } else {
      current.text.push(line);
    }
  });
  sections.push(current);

  // The intro is exempt when the front matter already puts a photo above it.
  const bare = sections.filter(
    (s, i) =>
      !(i === 0 && hasLeadPhoto) &&
      s.text.join("\n").trim() &&
      !/!\[[^\]]*\]\([^)]+\)/.test(s.text.join("\n"))
  );
  if (bare.length) {
    throw new Error(
      `${file} has sections with no image. Every section needs one, written as ` +
        `![alt text](/images/file.jpg "Caption. Photo by Name, licence.")\n  ` +
        bare.map((s) => `line ${s.line}: ${s.heading}`).join("\n  ")
    );
  }
}

// marked renders a lone image as <p><img></p>. Promote those to real figures so
// the caption shows, the credit is visible, and the box is reserved before the
// image loads.
function figurise(html) {
  return html.replace(
    /<p>\s*<img src="([^"]+)" alt="([^"]*)"(?: title="([^"]*)")?\s*\/?>\s*<\/p>/g,
    (_, src, alt, title) =>
      `<figure><img src="${src}" alt="${alt}"${sizeAttrs(src)} loading="lazy" decoding="async" />` +
      (title ? `<figcaption>${title}</figcaption>` : "") +
      `</figure>`
  );
}

// The property photos already live inside src/App.jsx as data URLs. Rather than
// duplicating them in the repo, pull each listing's cover shot out at build time
// and write it as a real image file, so article pages can show a photo of the
// place being recommended. Fails quietly if the app source is not present.
function extractListingPhotos() {
  const appPath = path.join(ROOT, "src", "App.jsx");
  const out = {};
  if (!fs.existsSync(appPath)) return out;
  const src = fs.readFileSync(appPath, "utf8");

  const arrays = {};
  const arrayRe = /const\s+(\w+Images)\s*=\s*\[([\s\S]*?)\n\]/g;
  let m;
  while ((m = arrayRe.exec(src))) {
    arrays[m[1]] = [...m[2].matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)].map((x) => x[1]);
  }

  const listingRe = /id:\s*"([\w-]+)"[\s\S]*?images:\s*(\w+)[\s\S]*?coverIndex:\s*(\d+)/g;
  const dir = path.join(OUT, "images");
  while ((m = listingRe.exec(src))) {
    const [, id, arrayName, idx] = m;
    const photos = arrays[arrayName];
    if (!photos || !photos[Number(idx)]) continue;
    fs.mkdirSync(dir, { recursive: true });
    const file = `listing-${id}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(photos[Number(idx)], "base64"));
    out[id] = `/images/${file}`;
  }
  return out;
}

// Intrinsic pixel size of an image in content/images, read straight from the
// file header. Lazy-loaded images with no width and height collapse to zero
// height until they load, which both shifts the layout and can hide them
// entirely, so every <img> this script writes gets real dimensions.
function imageSize(webPath) {
  const file = path.join(ROOT, "content", "images", path.basename(webPath || ""));
  if (!webPath || !fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15, skipping the four that are not frame headers.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc, 0xd8].includes(marker)) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  const head = buf.slice(0, 400).toString("utf8");
  const w = head.match(/\bwidth="(\d+)"/);
  const h = head.match(/\bheight="(\d+)"/);
  return w && h ? { w: Number(w[1]), h: Number(h[1]) } : null;
}

const sizeAttrs = (webPath) => {
  const s = imageSize(webPath);
  return s ? ` width="${s.w}" height="${s.h}"` : "";
};

// Names and towns for the locator map. Read from the same source of truth as the
// photos so a new property shows up on every article map without a second edit.
function extractListings() {
  const appPath = path.join(ROOT, "src", "App.jsx");
  if (!fs.existsSync(appPath)) return [];
  const src = fs.readFileSync(appPath, "utf8");
  const re = /id:\s*"([\w-]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*location:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    out.push({ id: m[1], name: m[2], town: m[3].replace(/,\s*[A-Z]{2}\s*$/, "").trim() });
  }
  return out;
}

function buildArticle(file, listingPhotos = {}, listings = []) {
  const raw = fs.readFileSync(path.join(SRC, file), "utf8");
  checkStyle(file, raw);
  const { data, body } = parseFrontMatter(raw);
  checkSectionImages(file, body, Boolean(data.photo));
  const slug = data.slug || file.replace(/\.md$/, "");
  const url = `${SITE}/articles/${slug}/`;

  if (!data.title || !data.description) {
    throw new Error(`${file}: front matter needs at least "title" and "description".`);
  }

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: data.title,
      description: data.description,
      datePublished: data.date,
      dateModified: data.updated || data.date,
      author: { "@type": "Organization", name: BRAND, url: SITE },
      publisher: { "@type": "Organization", name: BRAND, url: SITE },
      mainEntityOfPage: url,
      image: data.hero || data.photo ? `${SITE}${data.hero || data.photo}` : undefined,
      about: data.attraction
        ? { "@type": "TouristAttraction", name: data.attraction, address: data.address || data.location }
        : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Articles", item: `${SITE}/articles/` },
        { "@type": "ListItem", position: 3, name: data.title, item: url },
      ],
    },
  ];

  if (data.attraction) {
    schema.push({
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      name: data.attraction,
      description: data.description,
      address: data.address
        ? { "@type": "PostalAddress", streetAddress: data.address, addressRegion: "NC", addressCountry: "US" }
        : undefined,
      isAccessibleForFree: data.cost ? /free/i.test(data.cost) : undefined,
    });
  }

  if (Array.isArray(data.faq) && data.faq.length) {
    schema.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  const faqHtml = Array.isArray(data.faq) && data.faq.length
    ? `<h2>Common questions</h2>\n${data.faq
        .map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`)
        .join("\n")}`
    : "";

  if (!data.listingPhoto && data.listing && listingPhotos[data.listing]) {
    data.listingPhoto = listingPhotos[data.listing];
  }
  const propertyPhoto = data.listingPhoto
    ? `<img src="${esc(data.listingPhoto)}" alt="${esc(data.listingPhotoAlt || "One of our Outer Banks rentals")}" loading="lazy" />`
    : "";
  const cta = `<div class="cta">
  <div class="property">
    ${propertyPhoto}
    <div class="property-body">
      <h2>Staying nearby?</h2>
      <p>${esc(data.ctaText || "We rent hand-picked places across the Outer Banks, from Corolla to Nags Head.")}</p>
      <a class="btn" href="/">Browse the properties</a>
    </div>
  </div>
</div>`;

  // A photo makes the hero; without one the brand colour carries it.
  const heroStyle = data.hero
    ? ` style="background-image: linear-gradient(rgba(20,22,26,0.66), rgba(20,22,26,0.80)), url('${esc(data.hero)}')"`
    : "";
  const heroBand = `<div class="hero on-dark"${heroStyle}>
      <div class="wrap">
        <p class="crumb"><a href="/">Home</a> / <a href="/articles/">Articles</a></p>
        <p class="kicker">${esc(data.kicker || "Outer Banks guide")}</p>
        <h1>${esc(data.title)}</h1>
        ${data.lede ? `<p class="hero-lede">${esc(data.lede)}</p>` : ""}
        <p class="byline">${data.date ? `Published ${esc(formatDate(data.date))}` : ""}${
          data.readTime ? ` \u00b7 ${esc(data.readTime)}` : ""
        }</p>
      </div>
    </div>`;

  const figure = data.photo
    ? `<figure><img src="${esc(data.photo)}" alt="${esc(data.photoAlt || data.attraction || data.title)}"${sizeAttrs(data.photo)} loading="lazy" />${
        data.photoCaption ? `<figcaption>${esc(data.photoCaption)}</figcaption>` : ""
      }</figure>`
    : "";

  const html = layout({
    title: data.title,
    description: data.description,
    canonical: url,
    schema: schema.map((s) => JSON.parse(JSON.stringify(s))),
    hero: heroBand,
    body: `        ${data.summary ? `<div class="summary"><h2>In short</h2><p>${esc(data.summary)}</p></div>` : ""}
        ${glance(data)}
        ${figure}
${figurise(marked.parse(body))}
        ${faqHtml}
        ${cta}`,
  });

  const dir = path.join(OUT, "articles", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  return { ...data, slug, url };
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildIndex(articles) {
  const items = articles
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (a) => `          <li${a.hero || a.photo ? "" : ' class="no-thumb"'}>
            ${
              a.hero || a.photo
                ? `<a class="card-thumb" href="/articles/${a.slug}/" tabindex="-1" aria-hidden="true"><img src="${esc(
                    a.hero || a.photo
                  )}"${sizeAttrs(a.hero || a.photo)} alt="" loading="lazy" /></a>`
                : ""
            }
            <div class="card-body">
              <a href="/articles/${a.slug}/">
                <h2>${esc(a.title)}</h2>
              </a>
              <p>${esc(a.description)}</p>
            </div>
          </li>`
    )
    .join("\n");

  const html = layout({
    title: `Outer Banks Guides & Attractions | ${BRAND}`,
    description:
      "Guides to Outer Banks attractions, beaches and things to do, from Corolla to Nags Head, written for people planning a trip.",
    canonical: `${SITE}/articles/`,
    hero: `<div class="hero on-dark">
      <div class="wrap">
        <p class="crumb"><a href="/">Home</a> / Articles</p>
        <p class="kicker">Guides</p>
        <h1>Things to do on the Outer Banks</h1>
        <p class="hero-lede">Straight guides to the attractions worth your time between Corolla and Nags Head: what they cost, when to go, and what to expect when you get there.</p>
      </div>
    </div>`,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Outer Banks Guides & Attractions",
        url: `${SITE}/articles/`,
        publisher: { "@type": "Organization", name: BRAND, url: SITE },
      },
    ],
    body: `        <ul class="card-list">
${items || '          <li class="no-thumb"><p>New guides are on the way.</p></li>'}
        </ul>`,
  });

  fs.mkdirSync(path.join(OUT, "articles"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "articles", "index.html"), html);
}

function buildSitemap(articles) {
  const urls = [
    { loc: `${SITE}/`, priority: "1.0" },
    { loc: `${SITE}/articles/`, priority: "0.8" },
    ...articles.map((a) => ({ loc: a.url, priority: "0.7", lastmod: a.updated || a.date })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), xml);

  fs.writeFileSync(
    path.join(OUT, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
  );
}

// A plain-language map of the site for AI answer engines.
function buildLlmsTxt(articles) {
  const body = `# ${BRAND}

> Outer Banks vacation rentals and local attraction guides, covering Corolla to
> Nags Head, North Carolina.

${BRAND} rents a small, hand-picked set of vacation properties on the Outer Banks
and publishes guides to the attractions near them. Guides are written from local
knowledge and checked against official sources.

## Properties

- [Browse all properties](${SITE}/): current vacation rentals with full photo
  galleries and direct booking links.

## Guides

${articles
  .slice()
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .map((a) => `- [${a.title}](${a.url}): ${a.description}`)
  .join("\n")}
`;
  fs.writeFileSync(path.join(OUT, "llms.txt"), body);
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.log("No content/articles directory — skipping article build.");
    return;
  }
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".md"));
  const listingPhotos = extractListingPhotos();
  const listings = extractListings();
  copyImages();
  const articles = files.map((f) => buildArticle(f, listingPhotos, listings));
  buildIndex(articles);
  buildSitemap(articles);
  buildLlmsTxt(articles);
  console.log(`Built ${articles.length} article page(s), index, sitemap, robots.txt and llms.txt.`);
}

main();
