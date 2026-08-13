// Builds a stylised locator map for an article: the barrier island strip with
// its towns, the attraction pinned in its town, and the properties numbered
// below with a legend. Deliberately a diagram rather than a photograph, so
// nothing in it can be subtly wrong the way a generated "photo" of a real place
// can be.
//
// Positions are by town, not by milepost, because the exact mileposts of two of
// the three properties are not known. A diagram implying precision it does not
// have would be worse than one that does not.

const C = {
  teal: "#096169",
  sand: "#F0E6DE",
  salmonInk: "#A05151",
  foam: "#FCF8F4",
  ink: "#201C1E",
  meta: "#6C6C62",
  water: "#DCE7E6",
  ocean: "#C6D9D8",
  rule: "#D9CCC2",
};

// North to south, the way the islands actually run.
const TOWNS = [
  "Corolla",
  "Duck",
  "Southern Shores",
  "Kitty Hawk",
  "Kill Devil Hills",
  "Nags Head",
];

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function locatorMap({ attraction, town, properties = [] }) {
  const W = 720;
  const H = 340;
  const padX = 40;
  const stripTop = 128;
  const stripH = 46;
  const span = W - padX * 2;
  const step = span / (TOWNS.length - 1);
  const x = (t) => padX + TOWNS.indexOf(t) * step;

  const ax = x(town);
  // Keep the attraction label inside the frame near either edge.
  const anchor = ax > W - 190 ? "end" : ax < 190 ? "start" : "middle";
  const labelX = anchor === "end" ? W - padX : anchor === "start" ? padX : ax;

  const usable = properties.filter((p) => TOWNS.includes(p.town));

  // Spread pins that share a town so they never sit on top of each other.
  const byTown = {};
  usable.forEach((p) => ((byTown[p.town] ||= []).push(p)));
  const placed = [];
  Object.entries(byTown).forEach(([t, list]) => {
    const width = 30 * (list.length - 1);
    list.forEach((p, i) => placed.push({ ...p, px: x(t) - width / 2 + i * 30 }));
  });

  const pinY = stripTop + stripH + 24;
  const pins = placed
    .map(
      (p, i) => `  <g>
    <line x1="${p.px}" y1="${stripTop + stripH}" x2="${p.px}" y2="${pinY - 9}" stroke="${C.teal}" stroke-width="1.5" />
    <circle cx="${p.px}" cy="${pinY}" r="9.5" fill="${C.teal}" />
    <text x="${p.px}" y="${pinY + 4}" text-anchor="middle" font-family="'Work Sans',sans-serif" font-size="11" font-weight="700" fill="${C.foam}">${i + 1}</text>
  </g>`
    )
    .join("\n");

  const legend = placed
    .map((p, i) => {
      const ly = pinY + 48 + i * 24;
      return `  <g>
    <circle cx="${padX + 8}" cy="${ly - 4}" r="8.5" fill="${C.teal}" />
    <text x="${padX + 8}" y="${ly}" text-anchor="middle" font-family="'Work Sans',sans-serif" font-size="10.5" font-weight="700" fill="${C.foam}">${i + 1}</text>
    <text x="${padX + 26}" y="${ly}" font-family="'Work Sans',sans-serif" font-size="13.5" font-weight="600" fill="${C.ink}">${esc(p.name)}</text>
    <text x="${padX + 26 + 8.2 * p.name.length}" y="${ly}" font-family="'Work Sans',sans-serif" font-size="13" fill="${C.meta}">${esc(p.town)}${p.drive ? ", " + esc(p.drive) + " away" : ""}</text>
  </g>`;
    })
    .join("\n");

  const townLabels = TOWNS.map((t, i) => {
    const tx = x(t);
    const active = t === town;
    // Pull the end labels inward so they never clip the frame.
    const tAnchor = i === 0 ? "start" : i === TOWNS.length - 1 ? "end" : "middle";
    const tLabelX = i === 0 ? padX : i === TOWNS.length - 1 ? W - padX : tx;
    return `  <g>
    <line x1="${tx}" y1="${stripTop}" x2="${tx}" y2="${stripTop + stripH}" stroke="${active ? C.salmonInk : C.rule}" stroke-width="${active ? 2 : 1}" />
    <text x="${tLabelX}" y="${stripTop + stripH - 6}" text-anchor="${tAnchor}" font-family="'JetBrains Mono',monospace" font-size="9.5" letter-spacing="0.05em" fill="${active ? C.salmonInk : C.meta}"${active ? ' font-weight="600"' : ""}>${esc(t.toUpperCase())}</text>
  </g>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="mapTitle mapDesc">
  <title id="mapTitle">Where ${esc(attraction)} sits on the Outer Banks</title>
  <desc id="mapDesc">A diagram of the Outer Banks running from Corolla in the north to Nags Head in the south. ${esc(attraction)} is marked in ${esc(town)}${
    placed.length
      ? ". Our rental properties are numbered: " +
        placed.map((p, i) => `${i + 1}, ${esc(p.name)} in ${esc(p.town)}${p.drive ? ", about ${p.drive} away".replace("${p.drive}", esc(p.drive)) : ""}`).join("; ") +
        "."
      : "."
  }</desc>

  <rect width="${W}" height="${H}" fill="${C.foam}" />

  <text x="${padX}" y="34" font-family="'JetBrains Mono',monospace" font-size="10" letter-spacing="0.1em" fill="${C.salmonInk}">WHERE IT IS</text>

  <!-- Roanoke Sound, west of the islands -->
  <rect x="0" y="${stripTop - 40}" width="${W}" height="40" fill="${C.water}" />
  <text x="${padX}" y="${stripTop - 48}" font-family="'JetBrains Mono',monospace" font-size="9.5" letter-spacing="0.08em" fill="${C.meta}">ROANOKE SOUND</text>

  <!-- The barrier island itself -->
  <rect x="0" y="${stripTop}" width="${W}" height="${stripH}" fill="${C.sand}" />

  <!-- Atlantic, east -->
  <rect x="0" y="${stripTop + stripH}" width="${W}" height="9" fill="${C.ocean}" />
  <text x="${W - padX}" y="${stripTop + stripH + 22}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="9.5" letter-spacing="0.08em" fill="${C.meta}">ATLANTIC</text>

  <!-- The road running the length of it -->
  <line x1="0" y1="${stripTop + stripH / 2 + 6}" x2="${W}" y2="${stripTop + stripH / 2 + 6}" stroke="${C.rule}" stroke-width="2" stroke-dasharray="7 6" />

${townLabels}

  <!-- The attraction -->
  <g>
    <line x1="${ax}" y1="${stripTop}" x2="${ax}" y2="${stripTop - 26}" stroke="${C.salmonInk}" stroke-width="2" />
    <circle cx="${ax}" cy="${stripTop - 34}" r="10" fill="${C.salmonInk}" />
    <text x="${ax}" y="${stripTop - 30}" text-anchor="middle" font-size="11" fill="${C.foam}" font-family="'Work Sans',sans-serif">★</text>
    <text x="${labelX}" y="${stripTop - 56}" text-anchor="${anchor}" font-family="'Big Shoulders Display','Work Sans',sans-serif" font-size="21" font-weight="700" fill="${C.ink}">${esc(attraction)}</text>
  </g>

${pins}

${legend}

  <text x="${W - padX}" y="${H - 16}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="9.5" letter-spacing="0.06em" fill="${C.meta}">DIAGRAM, NOT TO SCALE</text>
</svg>
`;
}
