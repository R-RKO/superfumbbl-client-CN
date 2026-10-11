/**
 * "Graduate C" display lettering (owner 10-11): the first letter of each word is drawn in the Nuffle display font,
 * 25% larger; everything after it is drawn in Graduate, whose lowercase glyphs are small capitals. This module is the
 * ONE casing rule both surfaces share (the Esc Game Menu in the DOM, the end-zone lettering in Pixi): it only decides
 * which characters are leads and what case each character is handed to the fonts in. It draws nothing.
 *
 * Rules (locale-independent: String.prototype.toUpperCase / toLowerCase, never the toLocale* forms):
 *  0. CASE IS FOLDED FIRST, on the whole word, so every casing of one name is the same string before any letter is
 *     picked. The fold changes CASE ONLY, never the content of a name: NFC (canonical composition; no compatibility
 *     folding, so "Orcs²", "™", full-width letters, half-width kana, Hangul compatibility jamo and Arabic presentation
 *     forms stay exactly what was typed), then the whole word lowercased. Lowercasing maps the capital sharp S to
 *     "ß"; every sigma is then re-lowercased in context, so a Greek final sigma is chosen by its place in the word
 *     whichever sigma was typed ("ΟΣ", "ος" and "οσ" are one word).
 *     A letter whose capital is SEVERAL letters ("ß" gives "SS") as the lead: the first of them is the lead, the
 *     others go, lowercased, to the front of the rest - so "ßtar", "ẞtar", "SSTAR" and "sstar" are all S + "star".
 *     Inside a word such a letter stays as folded ("Straße", "STRAẞE" and "straße" are all S + "traße"; "STRASSE" is
 *     a different spelling and stays "strasse"). Single-character typographic ligatures are NOT unified with their
 *     spelled-out letters by this rule (no compatibility folding); nothing depends on them matching.
 *  1. The input is split on Unicode whitespace; runs of spaces collapse, leading and trailing spaces go. Each piece
 *     is a WORD.
 *  2. A word is cut into PARTS after every hyphen, dash or slash ("Nurgle-Rotters" = "Nurgle-" + "Rotters"), so each
 *     hyphen part gets its own lead. Apostrophes and full stops do NOT cut ("O'Malley's" and "A.C." have one lead).
 *  3. In a part, punctuation and symbols before the first letter or digit are kept as written, at the normal size
 *     ("'Ard" = "'" + lead A + "rd"; "(Reserves)" = "(" + lead R + "eserves)").
 *  4. The LEAD is the part's first letter (one grapheme of the folded word), uppercased. A part whose first letter or
 *     digit is a DIGIT has no lead ("#1", "2nd", "40k"), and neither has a part whose first letter belongs to a script
 *     without case (a kanji is not enlarged). A part with no letter at all ("&", "/") has no lead.
 *  5. Everything after the lead stays in the folded LOWERCASE, so Graduate draws small capitals: "ORCLAND RAIDERS", "orcland raiders"
 *     and "Orcland Raiders" all come out as O+"rcland" R+"aiders". Initials follow the same rule ("FC" = F+"c").
 *  6. Grapheme clusters stay whole (a letter keeps its combining marks; an emoji sequence is never split).
 *
 * Characters neither font carries are left to the font stack's fallback by the caller; nothing here can throw on them.
 */

/** One hyphen part of a word. `before` and `rest` are drawn in Graduate at the normal size, `lead` in Nuffle, larger. */
export interface DisplayCapsPart {
  /** Punctuation that precedes the lead, as written. */
  before: string;
  /** The part's first letter, uppercased; '' when the part has no lead (rule 4). */
  lead: string;
  /** Everything after the lead, lowercased (the trailing hyphen included). */
  rest: string;
}
export type DisplayCapsWord = DisplayCapsPart[];

/** A drawable run: consecutive characters in one font at one size. Words are joined by a single-space run. */
export interface DisplayCapsRun { text: string; lead: boolean }

/** How much larger than the rest the lead letter is drawn (owner 10-11: "25% larger"). */
export const DISPLAY_CAPS_LEAD_SCALE = 1.25;

const PART_BREAK = /^[-‐-―−/]/u;
const LETTER = /^\p{L}/u;
const DIGIT = /^\p{N}/u;

type SegmenterLike = { segment(input: string): Iterable<{ segment: string }> };
let segmenter: SegmenterLike | null | undefined;

// What stays attached to the character before it when the runtime has no Intl.Segmenter: combining marks, variation
// selectors (U+FE00-FE0F, U+E0100-E01EF), the zero-width joiner, emoji skin-tone modifiers (U+1F3FB-1F3FF), tag
// characters (U+E0020-E007F, the subdivision flags) and the enclosing keycap.
const CLUSTER_EXTEND = /^[\p{M}\u200d\ufe00-\ufe0f\u20e3\u{1f3fb}-\u{1f3ff}\u{e0020}-\u{e007f}\u{e0100}-\u{e01ef}]/u;
const REGIONAL_INDICATOR = /^[\u{1f1e6}-\u{1f1ff}]$/u;

/**
 * Grapheme clusters without Intl.Segmenter: a base keeps its combining marks, variation selectors, emoji modifiers
 * and tag sequences; whatever follows a zero-width joiner stays in the same cluster (family and profession emoji);
 * regional indicators stay in PAIRS (a flag is two of them). Never throws.
 * NOT covered (the platform segmenter does these; every engine the client ships on has it): Indic conjuncts joined
 * by a virama, Hangul jamo sequences, and prepended marks - such a cluster can come out in two pieces here.
 * Linear in the length of `text`: one pass, the state carried in two flags, each cluster joined once.
 */
export function displayGraphemesFallback(text: string): string[] {
  const out: string[] = [];
  let cluster: string[] = [];
  let joinNext = false; // the cluster ends in a zero-width joiner: the next code point belongs to it
  let flagHalf = false; // the cluster is ONE regional indicator still waiting for its pair
  for (const point of text) {
    const extend = CLUSTER_EXTEND.test(point);
    if (cluster.length && (extend || joinNext)) {
      cluster.push(point);
    } else if (cluster.length && flagHalf && REGIONAL_INDICATOR.test(point)) {
      cluster.push(point);
      flagHalf = false;
    } else {
      if (cluster.length) out.push(cluster.join(''));
      cluster = [point];
      flagHalf = REGIONAL_INDICATOR.test(point);
    }
    joinNext = point === '\u200d';
  }
  if (cluster.length) out.push(cluster.join(''));
  return out;
}

/** Grapheme clusters of `text`: Intl.Segmenter where the runtime has it, displayGraphemesFallback otherwise. The ONE
 *  segmentation the casing rule and the canvas compositor share, so neither ever handles half a cluster. */
export function displayGraphemes(text: string): string[] {
  if (segmenter === undefined) {
    try {
      const ctor = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => SegmenterLike }).Segmenter;
      segmenter = ctor ? new ctor('en', { granularity: 'grapheme' }) : null;
    } catch {
      segmenter = null;
    }
  }
  if (segmenter) {
    try {
      return Array.from(segmenter.segment(text), (entry) => entry.segment);
    } catch {
      /* fall through to the built-in rules */
    }
  }
  return displayGraphemesFallback(text);
}

/** Rule 0: one string for every casing of a word; case only, content untouched. Never throws. */
function foldWord(word: string): string {
  const lower = word.normalize('NFC').toLowerCase();
  // An already-lowercase sigma is not re-chosen by toLowerCase: hand every sigma back as a capital and lowercase
  // again, so the final form depends on its place in the word only.
  return /[\u03c3\u03c2]/u.test(lower) ? lower.replace(/[\u03c3\u03c2]/gu, '\u03a3').toLowerCase() : lower;
}

function splitWord(word: string): DisplayCapsWord {
  const parts: DisplayCapsWord = [];
  let before = '';
  let lead = '';
  let rest = '';
  let seeking = true;
  const flush = (): void => {
    if (before || lead || rest) parts.push({ before, lead, rest });
    before = ''; lead = ''; rest = ''; seeking = true;
  };
  for (const cluster of displayGraphemes(foldWord(word))) {
    if (seeking && LETTER.test(cluster)) {
      seeking = false;
      const upper = cluster.toUpperCase();
      if (upper !== cluster) {
        // a cased letter: the lead. A capital of several letters ("ß" gives "SS") leads with its first; the others
        // open the rest, lowercased.
        const [first = upper, ...others] = displayGraphemes(upper);
        lead = first;
        rest += others.join('').toLowerCase();
      } else rest += cluster; // a script without case: no lead, never enlarged
    } else if (seeking && DIGIT.test(cluster)) {
      seeking = false;
      rest += cluster;
    } else if (seeking) {
      before += cluster;
      if (PART_BREAK.test(cluster)) flush();
    } else {
      rest += cluster;
      if (PART_BREAK.test(cluster)) flush();
    }
  }
  flush();
  return parts;
}

/**
 * The most text the lettering ever handles, in UTF-16 code units: anything longer is CUT here, before any other work,
 * so no caller can hand the casing rule or the canvas compositor an unbounded string. The lettering only ever draws
 * a team name or a short label: the client's own team-name field allows 60 characters (TeamBuilderView) and the
 * longest name in the captured games is 31, so 120 is twice anything a real name reaches. The menu labels are far
 * below it.
 */
export const DISPLAY_CAPS_MAX_LENGTH = 120;

/** `input` cut to DISPLAY_CAPS_MAX_LENGTH on a code point boundary (a surrogate pair is never halved). */
export function clipDisplayText(input: string): string {
  const text = String(input ?? '');
  if (text.length <= DISPLAY_CAPS_MAX_LENGTH) return text;
  const lastKept = text.charCodeAt(DISPLAY_CAPS_MAX_LENGTH - 1);
  const halved = lastKept >= 0xd800 && lastKept <= 0xdbff; // a high surrogate whose pair would be cut off
  return text.slice(0, halved ? DISPLAY_CAPS_MAX_LENGTH - 1 : DISPLAY_CAPS_MAX_LENGTH);
}

/** The words of `input`, each cut into its lead / rest parts (see the rules above). The single entry both surfaces
 *  use (displayCapsRuns goes through it): the input is clipped first. Never throws; '' gives []. */
export function displayCapsWords(input: string): DisplayCapsWord[] {
  return clipDisplayText(input).split(/\s+/u).filter((word) => word.length > 0).map(splitWord);
}

/** `displayCapsWords` flattened to drawable runs, adjacent same-font runs merged, one space between words. */
export function displayCapsRuns(input: string): DisplayCapsRun[] {
  const runs: DisplayCapsRun[] = [];
  const push = (text: string, lead: boolean): void => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && last.lead === lead && !lead) last.text += text;
    else runs.push({ text, lead });
  };
  displayCapsWords(input).forEach((word, index) => {
    if (index > 0) push(' ', false);
    for (const part of word) {
      push(part.before, false);
      push(part.lead, true);
      push(part.rest, false);
    }
  });
  return runs;
}
