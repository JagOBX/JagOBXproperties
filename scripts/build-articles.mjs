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

function layout({ title, description, canonical, schema, body, breadcrumb }) {
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

      main { padding: 2.5rem 0 3.5rem; }
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
      .card-list li { border-top: 1px solid ${C.sand}; padding: 1.25rem 0; margin: 0; }
      .card-list h2 { margin: 0 0 0.3rem; }
      .card-list a { text-decoration: none; }
      .card-list a:hover h2 { text-decoration: underline; }
      .card-list p { margin: 0.25rem 0 0; color: ${C.slate}; font-size: 15px; }

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
    <main id="main-content" tabindex="-1">
      <div class="wrap">
        ${breadcrumb ? `<p class="crumb">${breadcrumb}</p>` : ""}
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

function factsTable(d) {
  const rows = [
    ["Where", d.location],
    ["Address", d.address],
    ["Cost", d.cost],
    ["Season", d.season],
    ["Time needed", d.duration],
    ["Good for", d.goodFor],
  ].filter(([, v]) => v);
  if (!rows.length) return "";
  return `<table class="facts">
  <caption class="sr-only"></caption>
  <tbody>
${rows.map(([k, v]) => `    <tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("\n")}
  </tbody>
</table>`;
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

function buildArticle(file) {
  const raw = fs.readFileSync(path.join(SRC, file), "utf8");
  checkStyle(file, raw);
  const { data, body } = parseFrontMatter(raw);
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

  const cta = `<div class="cta">
  <h2>Staying nearby?</h2>
  <p>${esc(data.ctaText || "We rent hand-picked places across the Outer Banks, from Corolla to Nags Head.")}</p>
  <a class="btn" href="/">Browse the properties</a>
</div>`;

  const html = layout({
    title: data.title,
    description: data.description,
    canonical: url,
    schema: schema.map((s) => JSON.parse(JSON.stringify(s))),
    breadcrumb: `<a href="/">Home</a> / <a href="/articles/">Articles</a>`,
    body: `        <p class="kicker">${esc(data.kicker || "Outer Banks guide")}</p>
        <h1>${esc(data.title)}</h1>
        <p class="byline">${data.date ? `Published ${esc(formatDate(data.date))}` : ""}${
          data.readTime ? ` · ${esc(data.readTime)}` : ""
        }</p>
        ${data.summary ? `<div class="summary"><h2>In short</h2><p>${esc(data.summary)}</p></div>` : ""}
        ${factsTable(data)}
${marked.parse(body)}
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
      (a) => `          <li>
            <a href="/articles/${a.slug}/">
              <h2>${esc(a.title)}</h2>
            </a>
            <p>${esc(a.description)}</p>
          </li>`
    )
    .join("\n");

  const html = layout({
    title: `Outer Banks Guides & Attractions | ${BRAND}`,
    description:
      "Guides to Outer Banks attractions, beaches and things to do, from Corolla to Nags Head — written for people planning a trip.",
    canonical: `${SITE}/articles/`,
    breadcrumb: `<a href="/">Home</a> / Articles`,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Outer Banks Guides & Attractions",
        url: `${SITE}/articles/`,
        publisher: { "@type": "Organization", name: BRAND, url: SITE },
      },
    ],
    body: `        <p class="kicker">Guides</p>
        <h1>Things to do on the Outer Banks</h1>
        <p>Straight guides to the attractions worth your time between Corolla and Nags Head — what they cost, when to go, and what to expect when you get there.</p>
        <ul class="card-list">
${items || "          <li><p>New guides are on the way.</p></li>"}
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
  const articles = files.map(buildArticle);
  buildIndex(articles);
  buildSitemap(articles);
  buildLlmsTxt(articles);
  console.log(`Built ${articles.length} article page(s), index, sitemap, robots.txt and llms.txt.`);
}

main();
