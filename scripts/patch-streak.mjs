// Rescopes the streak card's "Total Contributions" panel to the rolling year.
//
// The streak card counts all-time from account creation; the 3D skyline counts
// GitHub's rolling 365-day window. Shown side by side those totals disagree
// (1,094 vs 878) and read as a bug. The upstream fork has no option to match
// them: hide_total_contributions is unsupported and starting_year only works in
// whole years, so the closest it gets is 905.
//
// Since CI already fetches and commits this SVG, patch it here instead. The
// numbers come from the same GraphQL field the skyline uses, so both cards end
// up reporting one figure over one window.
//
// The card ships HTML comment anchors, so the edit targets a known element
// rather than matching loose text. If upstream ever drops them the guards below
// fail the build rather than silently committing an unpatched card.

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "profile-cards-custom/5-streak.svg";

const total = process.env.STREAK_TOTAL;
const from = process.env.STREAK_FROM;
const to = process.env.STREAK_TO;

if (!total || !from || !to) {
  console.error("STREAK_TOTAL, STREAK_FROM and STREAK_TO must all be set");
  process.exit(1);
}

// Match the card's own subtitle format, e.g. "Jan 28, 2020". Forced to UTC so a
// runner in another timezone can't shift the date by a day.
const pretty = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const replaceAnchoredText = (svg, anchor, value) => {
  const re = new RegExp(
    `(<!--\\s*${anchor}\\s*-->\\s*<g[^>]*>\\s*<text[^>]*>)([\\s\\S]*?)(</text>)`,
  );
  const matches = svg.match(new RegExp(re, "g")) || [];
  if (matches.length !== 1) {
    console.error(
      `expected exactly 1 "${anchor}" anchor, found ${matches.length} - upstream markup changed`,
    );
    process.exit(1);
  }
  return svg.replace(re, (_m, open, old, close) => {
    // Preserve the original indentation of the text content.
    const indent = old.match(/^\s*/)?.[0] ?? "";
    const trail = old.match(/\s*$/)?.[0] ?? "";
    console.log(`  ${anchor}: ${old.trim()} -> ${value}`);
    return `${open}${indent}${value}${trail}${close}`;
  });
};

let svg = readFileSync(FILE, "utf8");

svg = replaceAnchoredText(
  svg,
  "Total Contributions big number",
  Number(total).toLocaleString("en-US"),
);
svg = replaceAnchoredText(
  svg,
  "Total Contributions range",
  `${pretty(from)} - ${pretty(to)}`,
);

writeFileSync(FILE, svg);

// The card must still be a card after the edit.
const out = readFileSync(FILE, "utf8");
for (const marker of ["<svg", "Total Contributions", "Current Streak", "Longest Streak"]) {
  if (!out.includes(marker)) {
    console.error(`patched SVG lost "${marker}"`);
    process.exit(1);
  }
}

console.log(`patched ${FILE}`);
