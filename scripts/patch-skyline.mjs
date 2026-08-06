// Reworks the generated 3D contribution card so every panel reflects the same
// body of work.
//
// The generator builds its language donut and its radar from
// contributionsCollection.commitContributionsByRepository, which GitHub only
// ever populates with PUBLIC repositories. Private work arrives as the opaque
// restrictedContributionsCount with no per-repo or per-language breakdown. The
// result is a card whose calendar counts 878 contributions while its radar
// counts 76 and its donut claims Astro is the dominant language, because one
// public site repo outweighs the four public repos it can see.
//
// So:
//   - the donut is redrawn from repository language data, which DOES include
//     private repos (passed in via SKYLINE_LANGS)
//   - the radar is removed; its five axes cannot be recomputed for private work
//     (GitHub exposes no private issue/PR/review breakdown)
//   - the star and fork counters are removed; they are public-only too and
//     both read 0
//
// Every edit is guarded: if the generator's markup shifts, this fails the build
// rather than silently committing a mangled card.

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "profile-3d-contrib/profile-3d.svg";

const RADAR_ANCHOR = '<g transform="translate(980, 284.5)">';
const DONUT_ANCHOR = '<g transform="translate(130, 130)">';
const LEGEND_ANCHOR = '<g transform="translate(273, 0)">';

// Geometry lifted from the generator's own output so the redrawn donut lines up
// with the panel it replaces.
const OUTER_R = 117;
const INNER_R = 65;
const LEGEND_STEP = 32.5;
const LEGEND_CENTER_Y = 130;
const SWATCH = 21.666666666666668;
const OTHER_COLOR = "#444444";
// Six named slices keeps Python visible rather than folded into "other", where
// a tie on repo count would otherwise drop it.
const MAX_SLICES = 6;

const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

/**
 * Returns [start, end) of the element beginning at `start`, matching nesting.
 *
 * Self-closing tags open and close in one token, and comments may contain
 * anything at all; counting either as an opener drifts the depth and silently
 * returns the wrong range instead of failing.
 */
const elementRange = (svg, start) => {
  const tag = svg.slice(start + 1).match(/^[a-zA-Z][\w:.-]*/)?.[0];
  if (!tag) die(`no tag name at offset ${start}`);

  const comments = [...svg.matchAll(/<!--[\s\S]*?-->/g)].map((m) => [
    m.index,
    m.index + m[0].length,
  ]);
  const inComment = (i) => comments.some(([a, b]) => i >= a && i < b);

  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "g");
  re.lastIndex = start;
  let depth = 0;
  for (let m; (m = re.exec(svg)); ) {
    if (inComment(m.index)) continue;
    const token = m[0];
    if (token.startsWith("</")) {
      depth -= 1;
    } else if (token.endsWith("/>")) {
      if (m.index === start) return [start, m.index + token.length];
      continue;
    } else {
      depth += 1;
    }
    if (depth === 0) return [start, m.index + token.length];
  }
  return die(`unbalanced <${tag}> from offset ${start}`);
};

const cutOnce = (svg, anchor, what) => {
  const occurrences = svg.split(anchor).length - 1;
  if (occurrences !== 1) {
    die(`expected exactly 1 ${what} anchor, found ${occurrences} - generator markup changed`);
  }
  const [from, to] = elementRange(svg, svg.indexOf(anchor));
  return svg.slice(0, from) + svg.slice(to);
};

// Each element fades in one step later than the one before it: i+1 leading
// zeros, a five-step ramp, then it holds at 1. Every list is padded to the same
// length (rows + 5) so the shared 3s duration keeps them in step — the
// generator's own output is this formula with 4 rows.
//
// The list MUST end at 1. Capping it at a fixed 9 truncates the ramp once there
// are five or more rows, leaving those elements part-faded for the whole
// animation and then snapping them to full opacity when SMIL reverts to the
// base value.
const stagger = (i, rows) => {
  const v = [...Array(i + 1).fill("0"), "0.2", "0.4", "0.6", "0.8", "1"];
  while (v.length < rows + 5) v.push("1");
  return v.join(";");
};

const animate = (i, rows) =>
  `<animate attributeName="fill-opacity" values="${stagger(i, rows)}" dur="3s" repeatCount="1"></animate>`;

const round = (n) => Number(n.toFixed(3));
// Slices start at 12 o'clock and sweep clockwise, matching the original.
const pt = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round(r * Math.cos(a)), round(r * Math.sin(a))];
};

const arcPath = (fromDeg, toDeg) => {
  // A lone slice spans the full circle, where the arc's start and end points
  // coincide. Renderers drop a degenerate arc entirely, collapsing the ring to
  // nothing, so draw it as two half arcs. Opposite sweep flags on the inner
  // pair keep the hole punched.
  if (toDeg - fromDeg >= 359.999) {
    const [xt, yt] = pt(OUTER_R, 0);
    const [xb, yb] = pt(OUTER_R, 180);
    const [it, jt] = pt(INNER_R, 0);
    const [ib, jb] = pt(INNER_R, 180);
    return (
      `M${xt},${yt}A${OUTER_R},${OUTER_R},0,0,1,${xb},${yb}A${OUTER_R},${OUTER_R},0,0,1,${xt},${yt}` +
      `M${it},${jt}A${INNER_R},${INNER_R},0,0,0,${ib},${jb}A${INNER_R},${INNER_R},0,0,0,${it},${jt}Z`
    );
  }
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  const [x0o, y0o] = pt(OUTER_R, fromDeg);
  const [x1o, y1o] = pt(OUTER_R, toDeg);
  const [x1i, y1i] = pt(INNER_R, toDeg);
  const [x0i, y0i] = pt(INNER_R, fromDeg);
  return (
    `M${x0o},${y0o}A${OUTER_R},${OUTER_R},0,${large},1,${x1o},${y1o}` +
    `L${x1i},${y1i}A${INNER_R},${INNER_R},0,${large},0,${x0i},${y0i}Z`
  );
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------

const raw = process.env.SKYLINE_LANGS;
if (!raw) die("SKYLINE_LANGS must be set to a JSON array of {name,color,value}");

let langs;
try {
  langs = JSON.parse(raw);
} catch {
  die("SKYLINE_LANGS is not valid JSON");
}
if (!Array.isArray(langs) || langs.length === 0) die("SKYLINE_LANGS is empty");

langs.sort((a, b) => b.value - a.value);
const top = langs.slice(0, MAX_SLICES);
const restValue = langs.slice(MAX_SLICES).reduce((n, l) => n + l.value, 0);
const slices = restValue > 0
  ? [...top, { name: "other", color: OTHER_COLOR, value: restValue }]
  : top;

const total = slices.reduce((n, s) => n + s.value, 0);
if (total <= 0) die("language values sum to zero");

let svg = readFileSync(FILE, "utf8");

// --- donut ------------------------------------------------------------------
if ((svg.split(DONUT_ANCHOR).length - 1) !== 1) die("donut anchor not unique");
{
  const [from, to] = elementRange(svg, svg.indexOf(DONUT_ANCHOR));
  let deg = 0;
  const paths = slices.map((s, i) => {
    const sweep = (s.value / total) * 360;
    const d = arcPath(deg, deg + sweep);
    deg += sweep;
    return (
      `<path d="${d}" style="fill: ${s.color};" class="stroke-bg" stroke-width="2px">` +
      `<title>${esc(s.name)} ${s.value}</title>${animate(i, slices.length)}</path>`
    );
  });
  svg = svg.slice(0, from) + `${DONUT_ANCHOR}${paths.join("")}</g>` + svg.slice(to);
}

// --- legend -----------------------------------------------------------------
if ((svg.split(LEGEND_ANCHOR).length - 1) !== 1) die("legend anchor not unique");
{
  const [from, to] = elementRange(svg, svg.indexOf(LEGEND_ANCHOR));
  // The block stays vertically centred on the donut however many rows it has.
  const firstText = LEGEND_CENTER_Y - ((slices.length - 1) * LEGEND_STEP) / 2;
  const rows = slices.map((s, i) => {
    const ty = firstText + i * LEGEND_STEP;
    return (
      `<rect x="0" y="${round(ty - SWATCH / 2)}" width="${SWATCH}" height="${SWATCH}" ` +
      `fill="${s.color}" class="stroke-bg" stroke-width="1px">${animate(i, slices.length)}</rect>`
    );
  });
  const labels = slices.map((s, i) => {
    const ty = firstText + i * LEGEND_STEP;
    return (
      `<text dominant-baseline="middle" x="26" y="${round(ty)}" class="fill-fg" ` +
      `font-size="${SWATCH}px">${esc(s.name)}${animate(i, slices.length)}</text>`
    );
  });
  svg = svg.slice(0, from) + `${LEGEND_ANCHOR}${rows.join("")}${labels.join("")}</g>` + svg.slice(to);
}

// --- radar ------------------------------------------------------------------
// Redrawn rather than removed. Its five axes come from contributionsCollection
// totals, which are public-only, so the shipped shape reports Commit 78 and
// Issue 0 next to a calendar counting 878. Every axis can be recomputed to
// include private work (commit history per repo, and search for issues, PRs and
// reviews), so recompute and reshape the polygon instead of dropping it.
{
  let radar;
  try {
    radar = JSON.parse(process.env.SKYLINE_RADAR || "null");
  } catch {
    die("SKYLINE_RADAR is not valid JSON - a data query probably returned nothing");
  }
  if (!radar) die("SKYLINE_RADAR must be set to {commit,issue,pullreq,review,repo}");

  if ((svg.split(RADAR_ANCHOR).length - 1) !== 1) die("radar anchor not unique");

  // Rings sit at 1, 10, 100, 1K, 10K, one unit apart; a zero axis is pinned
  // just inside the first ring, matching the generator's own output.
  const RING = 31.2;
  const radius = (v) => RING * Math.max(0.8, 1 + Math.log10(Math.max(v, 0) || 0.0001));

  const AXES = ["commit", "issue", "pullreq", "review", "repo"];
  const LABELS = { commit: "Commit", issue: "Issue", pullreq: "PullReq", review: "Review", repo: "Repo" };

  const points = AXES.map((axis, k) => {
    const v = Number(radar[axis]);
    if (!Number.isFinite(v)) die(`radar value for "${axis}" is not a number`);
    const r = radius(v);
    const th = (k * 72 * Math.PI) / 180;
    return `${round(r * Math.sin(th))},${round(-r * Math.cos(th))}`;
  }).join(" ");

  // Counted, not merely tested: a second match would mean patching one and
  // leaving the other stale, which is exactly the silent failure the guards
  // elsewhere in this file exist to prevent.
  const replaceUnique = (re, replacement, what) => {
    const hits = svg.match(new RegExp(re, "g")) || [];
    if (hits.length !== 1) {
      die(`expected exactly 1 ${what}, found ${hits.length} - generator markup changed`);
    }
    svg = svg.replace(re, replacement);
  };

  replaceUnique(
    /<polygon class="radar" points="[^"]*">/,
    `<polygon class="radar" points="${points}">`,
    "radar polygon",
  );

  // The per-axis figures are hover tooltips, so they must move with the shape.
  for (const axis of AXES) {
    replaceUnique(
      new RegExp(`(>${LABELS[axis]}<title>)[^<]*(</title>)`),
      `$1${Number(radar[axis]).toLocaleString("en-US")}$2`,
      `radar tooltip for "${LABELS[axis]}"`,
    );
  }
}

// --- star and fork counters -------------------------------------------------
// Each is an icon <g> followed by its count <text>; both read 0 and neither can
// see private repositories.
for (const { iconX, textX, what } of [
  { iconX: "608", textX: "650", what: "star" },
  { iconX: "736", textX: "772", what: "fork" },
]) {
  svg = cutOnce(svg, `<g transform="translate(${iconX}, 802), scale(2)">`, `${what} icon`);
  const textRe = new RegExp(`<text[^>]*\\bx="${textX}"[^>]*>[\\s\\S]*?</text>`);
  if (!textRe.test(svg)) die(`no ${what} counter text at x=${textX} - generator markup changed`);
  svg = svg.replace(textRe, "");
}

// --- guards -----------------------------------------------------------------
for (const kept of [
  "<svg",
  "contributions",
  '<polygon class="radar"',
  ...slices.map((s) => s.name),
]) {
  if (!svg.includes(kept)) die(`patched SVG lost "${kept}"`);
}
if (!/>878</.test(svg) && !/>[\d,]+<\/text><text[^>]*>contributions</.test(svg)) {
  die("contribution total missing after patch");
}

writeFileSync(FILE, svg);
console.log(`patched ${FILE}`);
console.log(`  donut: ${slices.map((s) => `${s.name} ${s.value}`).join(", ")}`);
console.log("  removed: star counter, fork counter");
