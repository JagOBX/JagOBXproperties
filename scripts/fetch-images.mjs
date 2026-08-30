#!/usr/bin/env node
//
// Downloads article photos listed in content/images/sources.json from Wikimedia
// Commons, compresses them, and rewrites the generated half of CREDITS.md.
//
// Why fetch rather than commit binaries: the licence and the author line are
// facts that live on Commons, not in this repo. Reading them at fetch time means
// the credit printed under a photo is whatever Commons currently says, and a
// file whose licence has been changed or revoked fails loudly here instead of
// sitting on a commercial site under a stale credit.
//
// This script also enforces the no-repeated-picture rule. See checkNoReuse.
//
// Run with: npm run fetch:images

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "content", "images");
const ARTICLES = path.join(ROOT, "content", "articles");
const PUBLISHED = path.join(ROOT, "docs", "images");
const MANIFEST = path.join(DIR, "sources.json");
const CREDITS = path.join(DIR, "CREDITS.md");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "JagOBXproperties-image-fetcher/1.0 (https://jagobxproperties.com)";

// Ceiling for a published photo. The hand-added images sit between 50 and
// 110 KB; a raw Commons thumbnail can be ten times that. This doubles as the
// "already compressed" test when deciding whether a cached file can be reused,
// so the ladder below must actually be able to reach it.
const MAX_BYTES = 220 * 1024;

// Tried in order, first result under MAX_BYTES wins. The article column is
// 720px wide, so 1200 covers a retina render of a full-width figure. Detailed
// subjects (stone, foliage, texture) need the later steps.
const LADDER = [
  { width: 1200, quality: 78 },
  { width: 1200, quality: 68 },
  { width: 1000, quality: 66 },
  { width: 900, quality: 62 },
];

// Licences that allow commercial use. Anything else (NonCommercial, NoDerivs,
// "fair use", unknown) is refused: this is a business site, not a wiki.
const ALLOWED = /^(public domain|cc0|cc by(?:[- ]sa)?[- ]?\d?(\.\d)?)/i;

const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const kb = (n) => `${Math.round(n / 1024)} KB`;

// House rule: a picture appears once on the site. Repeating one across two
// guides makes the whole section look padded, which is the opposite of why the
// articles exist. Checked rather than remembered.
function checkNoReuse() {
  if (!fs.existsSync(ARTICLES)) return;
  const seen = new Map();
  const problems = [];

  for (const name of fs.readdirSync(ARTICLES).filter((f) => f.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(ARTICLES, name), "utf8");

    // Front matter hero and photo, plus every Markdown image in the body.
    const refs = [
      ...[...raw.matchAll(/^\s*(?:hero|photo|listingPhoto):\s*(\/images\/\S+)\s*$/gm)].map(
        (m) => m[1]
      ),
      ...[...raw.matchAll(/!\[[^\]]*\]\((\/images\/[^)\s"]+)/g)].map((m) => m[1]),
    ];

    for (const ref of refs) {
      const where = seen.get(ref);
      if (where) problems.push(`${ref}\n      used in ${where}\n      and again in ${name}`);
      else seen.set(ref, name);
    }
  }

  if (problems.length) {
    console.error("\nThe same picture is used more than once:");
    for (const p of problems) console.error(`  ${p}`);
    console.error("\nEvery article needs its own photographs. Pick a different shot.");
    process.exit(1);
  }
  console.log(`no-reuse check: ${seen.size} distinct images across the articles.`);
}

function checkManifest(images) {
  const problems = [];
  const byFile = new Map();
  const bySource = new Map();

  for (const item of images) {
    if (byFile.has(item.file)) problems.push(`two entries write to ${item.file}`);
    else byFile.set(item.file, item);

    // The real duplicate risk: the same Commons photo saved under two names,
    // which the reference check above cannot see.
    const prev = bySource.get(item.commons);
    if (prev) problems.push(`${item.file} and ${prev.file} are both "${item.commons}"`);
    else bySource.set(item.commons, item);
  }

  if (problems.length) {
    console.error("\nsources.json has duplicates:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
}

async function commonsInfo(titles, width) {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", titles.map((t) => `File:${t}`).join("|"));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("iiurlwidth", String(width));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const res = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`Commons API ${res.status} ${res.statusText}`);
  const data = await res.json();

  const out = new Map();
  for (const page of data.query?.pages || []) {
    if (page.missing) {
      out.set(page.title.replace(/^File:/, ""), { missing: true });
      continue;
    }
    const ii = page.imageinfo?.[0] || {};
    const e = ii.extmetadata || {};
    out.set(page.title.replace(/^File:/, ""), {
      url: ii.thumburl || ii.url,
      licence: strip(e.LicenseShortName?.value) || "unknown",
      artist: strip(e.Artist?.value) || "",
    });
  }
  return out;
}

async function downloadAndCompress(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length < 5000) throw new Error(`suspiciously small download (${raw.length} bytes)`);

  let best = null;
  let step = null;
  for (const rung of LADDER) {
    const out = await sharp(raw)
      .rotate()
      .resize({ width: rung.width, withoutEnlargement: true })
      .jpeg({ quality: rung.quality, mozjpeg: true })
      .toBuffer();
    if (!best || out.length < best.length) {
      best = out;
      step = rung;
    }
    if (out.length <= MAX_BYTES) break;
  }

  fs.writeFileSync(dest, best);
  return { before: raw.length, after: best.length, step, over: best.length > MAX_BYTES };
}

function rewriteCredits(rows) {
  const marker = "<!-- fetched:start -->";
  const endMarker = "<!-- fetched:end -->";
  const table = [
    marker,
    "",
    "## Fetched photos",
    "",
    "Generated by `npm run fetch:images` from `sources.json`. Do not edit by hand:",
    "the licence and credit columns are read from the Wikimedia Commons API each run.",
    "",
    "| File | Subject | Source | Licence | Credit needed |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.file} | ${r.subject} | Wikimedia Commons, ${r.commons} | ${r.licence} | ${
          r.artist || "none"
        } |`
    ),
    "",
    endMarker,
  ].join("\n");

  let existing = fs.existsSync(CREDITS) ? fs.readFileSync(CREDITS, "utf8") : "";
  const start = existing.indexOf(marker);
  const end = existing.indexOf(endMarker);
  if (start !== -1 && end !== -1) {
    existing = existing.slice(0, start) + table + existing.slice(end + endMarker.length);
  } else {
    existing = `${existing.trimEnd()}\n\n${table}\n`;
  }
  fs.writeFileSync(CREDITS, existing, "utf8");
}

async function main() {
  checkNoReuse();

  if (!fs.existsSync(MANIFEST)) {
    console.log("No content/images/sources.json, nothing to fetch.");
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const images = manifest.images || [];
  if (!images.length) {
    console.log("Manifest lists no images.");
    return;
  }
  checkManifest(images);

  // Ask Commons for a source a little larger than the output width so the
  // downscale has pixels to work with.
  const info = await commonsInfo(images.map((i) => i.commons), manifest.width || 1400);

  const rows = [];
  const problems = [];
  let fetched = 0;
  let reused = 0;

  for (const item of images) {
    const meta = info.get(item.commons);
    if (!meta || meta.missing) {
      problems.push(`${item.file}: not found on Commons as "${item.commons}"`);
      continue;
    }
    if (!ALLOWED.test(meta.licence)) {
      problems.push(
        `${item.file}: licence "${meta.licence}" does not clearly allow commercial use`
      );
      continue;
    }

    rows.push({ ...item, licence: meta.licence, artist: meta.artist });

    const dest = path.join(DIR, item.file);
    if (fs.existsSync(dest) && fs.statSync(dest).size <= MAX_BYTES) {
      console.log(`have   ${item.file}`);
      continue;
    }

    // docs/images is committed, so a photo published on a previous build is
    // already in the checkout. Reuse it rather than hitting Commons again, but
    // only if it is already compressed: the first build published raw
    // thumbnails, and those need replacing rather than preserving.
    const cached = path.join(PUBLISHED, item.file);
    if (fs.existsSync(cached)) {
      const size = fs.statSync(cached).size;
      if (size > 5000 && size <= MAX_BYTES) {
        fs.copyFileSync(cached, dest);
        reused += 1;
        console.log(`cached ${item.file} (${kb(size)})`);
        continue;
      }
      console.log(`stale  ${item.file} (${kb(size)} published, refetching)`);
    }

    const r = await downloadAndCompress(meta.url, dest);
    fetched += 1;
    console.log(
      `saved  ${item.file} (${kb(r.before)} -> ${kb(r.after)} at ${r.step.width}px q${
        r.step.quality
      }, ${meta.licence})`
    );
    if (r.over) {
      console.warn(
        `       still over ${kb(MAX_BYTES)}; it will be refetched next build. ` +
          `Pick a less detailed photo or add a lower rung to LADDER.`
      );
    }
  }

  if (problems.length) {
    console.error("\nRefusing to continue:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  rewriteCredits(rows);
  console.log(
    `\n${fetched} downloaded, ${reused} reused from docs/images. ${rows.length} credit rows written.`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
