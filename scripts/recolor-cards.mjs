// Recolours the generated summary cards into the profile palette.
//
// github-profile-summary-cards only ships preset themes, so CI writes every
// theme to profile-summary-card-output/ and this step produces the palette
// matched copies that the README actually renders. Without it the cards in
// profile-cards-custom/ are hand-made and never refresh.
//
// graywhite is the base theme: it is the only preset whose colour layout
// matches the existing hand-made cards exactly (11 background, 6 ink, 1 black
// stroke, language colours untouched).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "profile-summary-card-output/graywhite";
const DEST = "profile-cards-custom";

const THEME_BG = /#ffffff/gi;
const THEME_INK = /#24292e/gi;

const BG = "#F2EDE3";
const INK = "#14161B";
const ACCENT = "#B84721";

const CARDS = [
  { file: "1-repos-per-language.svg", accentFills: false },
  { file: "2-most-commit-language.svg", accentFills: false },
  // The productive-time heat grid paints its dots with a fill="" attribute and
  // its axis labels with an inline `fill:` rule. Both are theme ink, but the
  // dots take the accent colour and only the labels stay ink.
  { file: "4-productive-time.svg", accentFills: true },
];

mkdirSync(DEST, { recursive: true });

for (const { file, accentFills } of CARDS) {
  let svg = readFileSync(join(SRC, file), "utf8");

  svg = svg.replace(THEME_BG, BG);
  if (accentFills) {
    svg = svg.replace(/fill="#24292e"/gi, `fill="${ACCENT}"`);
  }
  svg = svg.replace(THEME_INK, INK);

  writeFileSync(join(DEST, file), svg);
  console.log(`recoloured ${file}`);
}
