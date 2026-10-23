import { FONT_DISPLAY_FAMILY } from './fontStacks';
/**
 * Fit a coach status title onto its rank badge (Astra r3 P3): MEASURED widths in the house display font, not a
 * character-count estimate. The text area is the badge minus 7% padding each side (86% of the badge) and at most
 * ~72% of its height. Largest font from ~22% of the badge down to a 6 px floor (0.5 px steps) at which the words lay
 * out greedily in at most two lines that each fit the width ("Emerging Star" -> EMERGING / STAR). If even the floor
 * cannot fit a word (EXPERIENCED at 40 px), the line is compressed horizontally (scaleX) to the text width.
 */

/** Width in px of `text` (already upper-cased) at `px` font size. */
export type MeasureText = (text: string, px: number) => number;

export interface BadgeTitleFit { px: number; lines: string[]; scaleX: number }

export const BADGE_TEXT_FLOOR_PX = 6;
const MAX_LINES = 2;

function layout(words: string[], px: number, width: number, measure: MeasureText): string[] {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(`${last} ${word}`, px) <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Lines keep the title's own case (the badge upper-cases them in CSS); widths are measured upper-cased. */
export function fitBadgeTitle(title: string, size: number, measureCaps: MeasureText): BadgeTitleFit {
  const measure: MeasureText = (text, px) => measureCaps(text.toUpperCase(), px);
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { px: BADGE_TEXT_FLOOR_PX, lines: [], scaleX: 1 };
  const width = size * 0.86;
  const height = size * 0.72;
  const start = Math.max(BADGE_TEXT_FLOOR_PX, Math.floor(size * 0.22 * 2) / 2);
  for (let px = start; px >= BADGE_TEXT_FLOOR_PX; px -= 0.5) {
    const lines = layout(words, px, width, measure);
    if (lines.length <= MAX_LINES && lines.length * px <= height && lines.every((line) => measure(line, px) <= width)) {
      return { px, lines, scaleX: 1 };
    }
  }
  // The floor: one word per line at most two lines (the longest words get their own), squeezed to the width.
  const px = BADGE_TEXT_FLOOR_PX;
  let lines = layout(words, px, width, measure);
  if (lines.length > MAX_LINES) lines = [lines.slice(0, -1).join(' '), lines[lines.length - 1]!];
  const widest = Math.max(...lines.map((line) => measure(line, px)));
  return { px, lines, scaleX: widest > width ? Math.max(0.5, width / widest) : 1 };
}

export const BADGE_TEXT_FONT = `800 {px}px ${FONT_DISPLAY_FAMILY}`;
/** Without a canvas (tests, a renderer that refuses 2D): a conservative 0.68 em per capital - wider than Nuffle's caps. */
export const estimateTextWidth: MeasureText = (text, px) => text.length * px * 0.68;

let ctx: CanvasRenderingContext2D | null | undefined;
/** Canvas measureText in the house font, falling back to the estimate when no 2D context is available. */
export const measureBadgeText: MeasureText = (text, px) => {
  if (ctx === undefined) {
    const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    try { ctx = !jsdom && typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx = null; }
  }
  if (!ctx) return estimateTextWidth(text, px);
  ctx.font = BADGE_TEXT_FONT.replace('{px}', String(px));
  return ctx.measureText(text).width;
};
