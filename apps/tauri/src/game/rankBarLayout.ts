/**
 * Game-load rank bar layout (owner 10-21 browser check): the in-game match-up bar must lay out cleanly at every width.
 * Pure math over the banner's own metrics (components/WaitingVsBanner.vue, every size x --vs-scale):
 *
 *   bar  = min(880 x 1.3, area - 32)                        (the width cap, kept at every step)
 *   side = (bar - 2 border - 2 x 16L padding - 2 x 14L grid gap - 66L VS medallion) / 2
 *   text column = side - 64L crest - 12L gap - badge - 12L gap      (badge = round(64L x k), k = 1.3 -> 1)
 *
 * In that column the RECORD line must fit on ONE line, so the bar steps down (rankBarSteps) until it does: the +30%
 * growth first (L and the type T together, 1.3 -> 1; owner: the growth is secondary to a clean layout), then the record
 * line alone (to 0.8), then the badge (to the crest's size), then the type (to 0.8). Team names never break inside a word: they wrap only at spaces, at most two
 * lines, with the name's font shrunk to fit (a single word wider than the column at the floor is the only overflow).
 * All widths are MEASURED in the banner's fonts (canvas measureText), or a conservative estimate without a canvas.
 */

export const RANK_BAR_LAYOUT_SCALE = 1.3;

/** The banner's base type (WaitingVsBanner.vue): `max(<floor>px, <n>rem)` at the given root font size. */
export const bannerType = {
  team: (rootPx: number) => Math.max(16, 1.25 * rootPx),
  coach: (rootPx: number) => Math.max(16, 0.95 * rootPx),
  meta: (rootPx: number) => Math.max(13, 0.82 * rootPx),
};

export type MeasureKind = 'team' | 'record';
/** Width in px of `text` in the banner's font for `kind` at `px` (team names upper-cased, record in small capitals). */
export type MeasureBarText = (text: string, px: number, kind: MeasureKind) => number;

export interface RankBarLayoutInput {
  areaWidth: number;
  rootPx: number;
  layoutScale: number;
  teamNames: readonly [string, string];
  records: readonly [string, string];
  measure: MeasureBarText;
}

export interface RankBarLayout {
  barWidth: number;
  /** the layout scale (--vs-scale: crest, gaps, padding, VS medallion) */
  layoutScale: number;
  sideWidth: number;
  badgeSize: number;
  column: number;
  /** the uniform type scale (--vs-type) */
  typeScale: number;
  /** the record line's own extra factor (<= 1) on top of typeScale */
  recordFit: number;
  recordPx: number;
  recordWidth: number;
  /** false only when even the last step could not fit the record line (it then overflows rather than wraps) */
  recordFits: boolean;
  /** per side: the team name's factor (<= 1) on top of typeScale, and its lines (word boundaries only) */
  teamFit: [number, number];
  teamLines: [string[], string[]];
}

function greedyLines(words: readonly string[], fits: (line: string) => boolean): string[] {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && fits(`${last} ${word}`)) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Largest factor (1 down to `floor`, 0.025 steps) at which `text` lays out on word boundaries in <= maxLines lines. */
export function fitWords(
  text: string, basePx: number, width: number, maxLines: number, floor: number,
  measure: (line: string, px: number) => number,
): { fit: number; lines: string[] } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { fit: 1, lines: [] };
  for (let fit = 1; fit >= floor - 1e-9; fit -= 0.025) {
    const px = basePx * fit;
    const lines = greedyLines(words, (line) => measure(line, px) <= width);
    if (lines.length <= maxLines && lines.every((line) => measure(line, px) <= width)) return { fit: Number(fit.toFixed(3)), lines };
  }
  const px = basePx * floor;
  let lines = greedyLines(words, (line) => measure(line, px) <= width);
  if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')];
  return { fit: floor, lines };
}

interface Step { L: number; badgeK: number; T: number; recordFit: number }
/** The reductions, in order, until the record line fits on one line: the +30% growth goes first (layout and type
 *  together, 1.3 -> 1), then the record line alone (to 0.8), then the badge (1.3 -> 1x the crest), then the type
 *  (to 0.8), and as a last resort the crests / gaps / medallion below the waiting board's size (to 0.8). The bar's width stays at its cap (min(880 x 1.3, area - 32)) throughout. */
export function rankBarSteps(maxScale: number): Step[] {
  const steps: Step[] = [];
  for (let L = maxScale; L >= 1 - 1e-9; L -= 0.05) steps.push({ L: Number(L.toFixed(3)), badgeK: 1.3, T: Number(L.toFixed(3)), recordFit: 1 });
  for (let r = 0.95; r >= 0.8 - 1e-9; r -= 0.05) steps.push({ L: 1, badgeK: 1.3, T: 1, recordFit: Number(r.toFixed(3)) });
  for (const k of [1.2, 1.1, 1]) steps.push({ L: 1, badgeK: k, T: 1, recordFit: 0.8 });
  for (let t = 0.95; t >= 0.8 - 1e-9; t -= 0.05) steps.push({ L: 1, badgeK: 1, T: Number(t.toFixed(3)), recordFit: 0.8 });
  // last resort (a very long record in a narrow area): the crests, gaps and VS medallion below the waiting board's size
  for (const L of [0.95, 0.9, 0.85, 0.8]) steps.push({ L, badgeK: 1, T: 0.8, recordFit: 0.8 });
  return steps;
}

export function rankBarLayout(input: RankBarLayoutInput): RankBarLayout {
  const barWidth = Math.min(880 * input.layoutScale, Math.max(0, input.areaWidth - 32));
  const meta = bannerType.meta(input.rootPx);
  const recordWidthAt = (px: number) => Math.max(0, ...input.records.map((r) => (r ? input.measure(r, px, 'record') : 0)));
  const steps = rankBarSteps(input.layoutScale);
  const geometry = (step: Step) => {
    const sideWidth = (barWidth - 4 - 2 * 16 * step.L - 2 * 14 * step.L - 66 * step.L) / 2;
    const badgeSize = Math.round(64 * step.L * step.badgeK);
    return { sideWidth, badgeSize, column: Math.max(0, sideWidth - 64 * step.L - 12 * step.L - badgeSize - 12 * step.L) };
  };
  let chosen = steps[steps.length - 1]!;
  let fits = false;
  for (const step of steps) {
    const g = geometry(step);
    if (recordWidthAt(meta * step.T * step.recordFit) <= g.column) { chosen = step; fits = true; break; }
  }
  const g = geometry(chosen);
  const recordPx = meta * chosen.T * chosen.recordFit;
  const teamBase = bannerType.team(input.rootPx) * chosen.T;
  const team = input.teamNames.map((name) => fitWords(name, teamBase, g.column, 2, 0.6, (line, px) => input.measure(line, px, 'team')));
  return {
    barWidth, layoutScale: chosen.L, sideWidth: g.sideWidth, badgeSize: g.badgeSize, column: g.column,
    typeScale: chosen.T, recordFit: chosen.recordFit, recordPx, recordWidth: recordWidthAt(recordPx), recordFits: fits,
    teamFit: [team[0]!.fit, team[1]!.fit],
    teamLines: [team[0]!.lines, team[1]!.lines],
  };
}

/**
 * Vertical placement. The waiting board shows the banner in its centred overlay column, directly above the waiting
 * card (WaitingBoardView.vue `.waiting-board-overlay`: flex column, justify-content center, gap 16 px) - measured in
 * the browser at about a third of the way down the pitch (y 160-240 of 600, centre ~ H / 3). The game view has no card,
 * so the bar's centre goes to H / 3 - but never over the in-game top HUD band (coach panels, scoreboard, clock): its
 * top is at least the HUD's bottom + 12 px.
 */
export function rankBarTop(input: { height: number; barHeight: number; hudBottom: number }): number {
  const third = input.height / 3 - input.barHeight / 2;
  return Math.round(Math.max(input.hudBottom + 12, third, 0));
}

/** The fonts the two measured lines RENDER with (Astra r3): the panel reads them from the rendered elements'
 *  computed style (the record line inherits the selected UI font - Nuffle by default - in small capitals). */
export interface BarFonts { team: string; teamWeight: string; record: string; recordWeight: string }
export const DEFAULT_BAR_FONTS: BarFonts = {
  team: "Nuffle, system-ui, sans-serif", teamWeight: 'normal',
  record: "Nuffle, system-ui, sans-serif", recordWeight: 'normal',
};
export const barFontString = (kind: MeasureKind, px: number, fonts: BarFonts): string => (kind === 'team'
  ? `${fonts.teamWeight} ${px}px ${fonts.team}`
  : `small-caps ${fonts.recordWeight} ${px}px ${fonts.record}`);
/** Without a canvas: generous per-character widths (wider than the real fonts). */
export const estimateBarText: MeasureBarText = (text, px, kind) => text.length * px * (kind === 'team' ? 0.72 : 0.6);

let ctx: CanvasRenderingContext2D | null | undefined;
/** Canvas measureText in the given rendered fonts (+ the banner's 0.04em tracking); the estimate without a canvas. */
export function makeMeasureBarText(fonts: BarFonts): MeasureBarText {
  return (text, px, kind) => {
    if (ctx === undefined) {
      const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
      try { ctx = !jsdom && typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx = null; }
    }
    if (!ctx) return estimateBarText(text, px, kind);
    ctx.font = barFontString(kind, px, fonts);
    const shown = kind === 'team' ? text.toUpperCase() : text;
    return ctx.measureText(shown).width + 0.04 * px * Math.max(0, shown.length - 1);
  };
}
export const measureBarText: MeasureBarText = makeMeasureBarText(DEFAULT_BAR_FONTS);
/** The computed family / weight of a rendered element (null when it is not in the DOM). */
export function renderedFont(el: Element | null | undefined): { family: string; weight: string } | null {
  if (!el || typeof getComputedStyle !== 'function') return null;
  const style = getComputedStyle(el);
  return style.fontFamily ? { family: style.fontFamily, weight: style.fontWeight || 'normal' } : null;
}
