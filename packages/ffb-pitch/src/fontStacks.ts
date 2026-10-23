/**
 * Script support (owner 10-23: "just bundle alternate language support that can display the necessary glyphs"): the
 * ONE source of every font stack that names a bundled display face (Nuffle, Graduate, SNES Italic). Those faces are
 * Latin-only, so each stack ends in system faces that carry Cyrillic and Greek (Segoe UI, Arial, Noto Sans) and then
 * Simplified Chinese, Japanese and Korean (Windows: Microsoft YaHei, Yu Gothic, Malgun Gothic; macOS: PingFang SC,
 * Hiragino Sans, Apple SD Gothic Neo; Linux: Noto Sans CJK, pulled in by the .deb's fonts-noto-cjk dependency). The
 * Latin face each stack starts with is unchanged.
 *
 * Last resort (Astra 10-23 P2, owner "Noto fallback fonts seems reasonable"): a host with none of those system faces
 * (an AppImage on a bare distribution) still gets glyphs from four BUNDLED subsets of Noto (SIL OFL 1.1), listed after
 * the system faces and before `sans-serif` (FALLBACK_FONT_FACES; provenance in docs/art-provenance/fonts-fallback.md).
 * Each is registered with a unicode-range, so the browser only fetches one when a character in its range is on screen
 * AND no system face before it has the glyph.
 *
 * Canvas code builds `ctx.font` with `canvasFont`; CSS reads the same values through custom properties
 * (`--font-display`, `--font-graduate`, `--font-snes`, `--font-fallback`, `--font-body`) that the client writes onto
 * the root element at startup (apps/tauri/src/game/fontStacks.ts: installFontStackVariables), so the two cannot drift.
 */

import { FALLBACK_UNICODE_RANGES } from './fallbackFontRanges.generated';

/** One bundled last-resort face: its family name, its file under the app's public root, the code points it covers. */
export interface FallbackFontFace { family: string; url: string; unicodeRange: string }

/** The bundled Noto subsets (apps/tauri/public/fonts/fallback/), in stack order. Each unicode-range is GENERATED from
 *  the shipped file's own cmap (scripts/build-fallback-fonts.py -> fallbackFontRanges.generated.ts; Astra 10-23 P2):
 *  a host never fetches the SC file for a character only the JP file carries (e.g. U+4E21), and Latin punctuation
 *  never fetches a CJK file. */
const fallbackFace = (family: string, file: string): FallbackFontFace => ({
  family, url: `/fonts/fallback/${file}`, unicodeRange: FALLBACK_UNICODE_RANGES[family] ?? 'U+E000',
});
export const FALLBACK_FONT_FACES: readonly FallbackFontFace[] = [
  fallbackFace('SF Fallback Sans', 'SFFallbackSans.woff2'),
  fallbackFace('SF Fallback CJK SC', 'SFFallbackCJKSC.woff2'),
  fallbackFace('SF Fallback CJK JP', 'SFFallbackCJKJP.woff2'),
  fallbackFace('SF Fallback CJK KR', 'SFFallbackCJKKR.woff2'),
];

/** System faces after the Latin display face: Cyrillic / Greek first, then the CJK faces of each platform, then the
 *  bundled last-resort faces, then the generic family. */
export const FONT_SCRIPT_TAIL = '"Segoe UI", Arial, "Noto Sans", "Microsoft YaHei", "PingFang SC", "Hiragino Sans", "Yu Gothic", '
  + '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK SC", "Noto Sans CJK JP", "Noto Sans CJK KR", '
  + `${FALLBACK_FONT_FACES.map((face) => `"${face.family}"`).join(', ')}, sans-serif`;

/** Nuffle (the display face) and the script tail. */
export const FONT_DISPLAY_FAMILY = `Nuffle, ${FONT_SCRIPT_TAIL}`;
/** Graduate (small capitals), Nuffle for what it lacks, then the script tail. */
export const FONT_GRADUATE_FAMILY = `Graduate, Nuffle, ${FONT_SCRIPT_TAIL}`;
/** SNES Italic (the wordmark face), Nuffle, then the script tail. */
export const FONT_SNES_FAMILY = `SNES, Nuffle, ${FONT_SCRIPT_TAIL}`;
/** The script tail alone: a word in a script none of the display faces carries (kana, kanji, Hangul...) is drawn
 *  WHOLE in this, never split into a Nuffle lead and Graduate rest. */
export const FONT_FALLBACK_FAMILY = FONT_SCRIPT_TAIL;
/** Body text (log, chat, panels): the Arial / Helvetica stack, then the script tail. */
export const FONT_BODY_FAMILY = `Arial, Helvetica, ${FONT_SCRIPT_TAIL}`;

/** The CSS custom property each stack is published as (name -> value). */
export const FONT_STACK_CSS_VARIABLES: Readonly<Record<string, string>> = {
  '--font-display': FONT_DISPLAY_FAMILY,
  '--font-graduate': FONT_GRADUATE_FAMILY,
  '--font-snes': FONT_SNES_FAMILY,
  '--font-fallback': FONT_FALLBACK_FAMILY,
  '--font-body': FONT_BODY_FAMILY,
};

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'emoji', 'math']);

/** `family` with each name quoted unless it is a generic family or a single plain identifier; existing quotes kept. */
export function quoteFontFamilies(family: string): string {
  return family.split(',').map((raw) => raw.trim()).filter((name) => name.length > 0).map((name) => {
    if (/^["'].*["']$/.test(name)) return name;
    if (GENERIC_FAMILIES.has(name.toLowerCase())) return name;
    if (/^[A-Za-z_][\w-]*$/.test(name)) return name;
    return `"${name.replace(/"/g, '')}"`;
  }).join(', ');
}

/** A valid `ctx.font` shorthand: `[weight ]<size>px <families>`. A non-finite or non-positive size falls back to 1 px
 *  (an invalid shorthand is silently ignored by the canvas, which would keep the PREVIOUS font). */
export function canvasFont(sizePx: number, family: string = FONT_DISPLAY_FAMILY, weight?: string | number): string {
  const px = Number.isFinite(sizePx) && sizePx > 0 ? sizePx : 1;
  const w = weight === undefined || weight === '' ? '' : `${weight} `;
  return `${w}${px}px ${quoteFontFamilies(family)}`;
}
