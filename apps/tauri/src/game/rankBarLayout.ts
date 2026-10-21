/**
 * Game-load rank bar layout (owner 10-21 browser check): the in-game match-up bar must lay out cleanly at every width.
 * Pure math over the banner's own metrics (components/WaitingVsBanner.vue, every size x --vs-scale):
 *
 *   bar  = min(880 x 1.3, area - 32)                        (the width cap, kept at every step)
 *   side = (bar - 4 border - 2 x 16L padding - 2 x 14L grid gap - (66L + 4) VS medallion) / 2
 *   text column = side - (64L + 2) crest - 12L gap - badge - 12L gap      (badge = round(64L x k), k = 1.3 -> 1)
 *
 * In that column the RECORD line must fit on ONE line, so the bar steps down (rankBarSteps) until it does: the +30%
 * growth first (L and the type T together, 1.3 -> 1; owner: the growth is secondary to a clean layout), then the record
 * line alone (to 0.8), then the badge (to the crest's size), then the type (to 0.8). Team names never break inside a word: they wrap only at spaces, at most two
 * lines, with the name's font shrunk to fit (a single word wider than the column at the floor is the only overflow).
 * All widths are MEASURED in the banner's fonts (canvas measureText), or a conservative estimate without a canvas.
 */

export const RANK_BAR_LAYOUT_SCALE = 1.3;
/** owner (1.0.252 follow-up): "increase the size of text a bit" - the bar's type ~15% over the banner's */
export const RANK_BAR_TYPE_BOOST = 1.15;
/** ...and "add some vertical space": the rank bar's vertical padding and text-row gaps x 1.25 (--vs-pad-y) */
export const RANK_BAR_PAD_Y = 1.25;

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
  /** every detail line of both sides (each must fit on ONE line) */
  records: readonly string[];
  /** owner 1.0.252 follow-up: the bar's text ~15% larger than the banner's (T starts at L x typeBoost) */
  typeBoost?: number;
  /** the most detail lines either side shows (record / rating: 0-2) */
  detailLineCount?: number;
  /** the rank bar's extra vertical room (--vs-pad-y) before any height shrink */
  padY?: number;
  /** Astra r1 (1.0.252 follow-up): the most height the bar may take - from the HUD's bottom + 12 px to the pitch centre */
  heightBudget?: number;
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
  /** per input line (`records`): it fits the column on one line at the chosen size */
  lineFits: boolean[];
  /** the vertical padding / row-gap factor chosen (--vs-pad-y) */
  padY: number;
  /** the bar's estimated height (border + padding + the tallest of crest / badge / medallion / text column) */
  barHeight: number;
  /** the height budget was met (or there was none) */
  heightFits: boolean;
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

export interface Step { L: number; badgeK: number; T: number; recordFit: number; padY: number }
/** The reductions, in order, until the record line fits on one line: the +30% growth goes first (layout and type
 *  together, 1.3 -> 1), then the record line alone (to 0.8), then the badge (1.3 -> 1x the crest), then the type
 *  (to 0.8), and as a last resort the crests / gaps / medallion below the waiting board's size (to 0.8). The bar's width stays at its cap (min(880 x 1.3, area - 32)) throughout. */
export function rankBarSteps(maxScale: number, typeBoost = 1, padY = 1): Step[] {
  const steps: Step[] = [];
  const b = typeBoost;
  const p = padY;
  const r3 = (n: number) => Number(n.toFixed(3));
  for (let L = maxScale; L >= 1 - 1e-9; L -= 0.05) steps.push({ L: r3(L), badgeK: 1.3, T: r3(L * b), recordFit: 1, padY: p });
  for (let r = 0.95; r >= 0.8 - 1e-9; r -= 0.05) steps.push({ L: 1, badgeK: 1.3, T: r3(b), recordFit: r3(r), padY: p });
  for (const k of [1.2, 1.1, 1]) steps.push({ L: 1, badgeK: k, T: r3(b), recordFit: 0.8, padY: p });
  // the type comes down only once the width has run out at the badge's smallest size
  for (let t = b - 0.05; t >= 0.8 - 1e-9; t -= 0.05) steps.push({ L: 1, badgeK: 1, T: r3(t), recordFit: 0.8, padY: p });
  // then the extra vertical room goes back toward the banner's own (height budget, Astra r1)
  for (let q = p - 0.1; q >= 1 - 1e-9; q -= 0.1) steps.push({ L: 1, badgeK: 1, T: 0.8, recordFit: 0.8, padY: r3(q) });
  if (p > 1) steps.push({ L: 1, badgeK: 1, T: 0.8, recordFit: 0.8, padY: 1 });
  // last resort (a very long record in a narrow area): the crests, gaps and VS medallion below the waiting board's size
  for (const L of [0.95, 0.9, 0.85, 0.8]) steps.push({ L, badgeK: 1, T: 0.8, recordFit: 0.8, padY: 1 });
  return steps;
}

/** The banner's borders (WaitingVsBanner.vue, content-box except the bar): `.vs-banner` 2 px each side (border-box, so
 *  inside its width), `.vs-crest` 1 px each side (outside its 64L box), `.vs-mark` 2 px each side (outside its 66L box).
 *  Astra r2: leaving them out made each text column 4 px narrower than estimated and the height estimate low. */
export const BAR_BORDER = 2 * 2;
export const CREST_BORDER = 2 * 1;
export const MARK_BORDER = 2 * 2;

/** Line height of the banner's text column (WaitingVsBanner.vue `.vs-text { line-height: 1.2 }`). */
const LINE = 1.2;

export function rankBarLayout(input: RankBarLayoutInput): RankBarLayout {
  const barWidth = Math.min(880 * input.layoutScale, Math.max(0, input.areaWidth - 32));
  const meta = bannerType.meta(input.rootPx);
  const recordWidthAt = (px: number) => Math.max(0, ...input.records.map((r) => (r ? input.measure(r, px, 'record') : 0)));
  const steps = rankBarSteps(input.layoutScale, input.typeBoost ?? 1, input.padY ?? 1);
  const detailCount = input.detailLineCount ?? 2;
  const budget = input.heightBudget;
  const evaluate = (step: Step) => {
    const sideWidth = (barWidth - BAR_BORDER - 2 * 16 * step.L - 2 * 14 * step.L - (66 * step.L + MARK_BORDER)) / 2;
    const badgeSize = Math.round(64 * step.L * step.badgeK);
    const column = Math.max(0, sideWidth - (64 * step.L + CREST_BORDER) - 12 * step.L - badgeSize - 12 * step.L);
    const recordPx = meta * step.T * step.recordFit;
    const teamBase = bannerType.team(input.rootPx) * step.T;
    const team = input.teamNames.map((name) => fitWords(name, teamBase, column, 2, 0.6, (line, px) => input.measure(line, px, 'team')));
    // the text column: team lines + the coach + the detail lines, with the two row gaps between its three blocks
    const textHeight = Math.max(...team.map((t) => Math.max(1, t.lines.length) * teamBase * t.fit * LINE))
      + bannerType.coach(input.rootPx) * step.T * LINE
      + detailCount * recordPx * LINE
      + (detailCount > 0 ? 2 : 1) * 3 * step.L * step.padY;
    const content = Math.max(64 * step.L + CREST_BORDER, badgeSize, 66 * step.L + MARK_BORDER, textHeight);
    const barHeight = BAR_BORDER + 2 * 10 * step.L * step.padY + content;
    return { sideWidth, badgeSize, column, recordPx, team, barHeight };
  };
  let chosen = steps[steps.length - 1]!;
  let fits = false;
  let heightFits = budget === undefined;
  for (const step of steps) {
    const e = evaluate(step);
    const widthOk = recordWidthAt(e.recordPx) <= e.column;
    const heightOk = budget === undefined || e.barHeight <= budget;
    if (widthOk && heightOk) { chosen = step; fits = true; heightFits = true; break; }
  }
  if (!fits) {
    // no step meets both: keep the first that fits the width (the height budget is the one to give)
    const widthOnly = steps.find((step) => { const e = evaluate(step); return recordWidthAt(e.recordPx) <= e.column; });
    if (widthOnly) { chosen = widthOnly; fits = true; heightFits = false; }
  }
  const e = evaluate(chosen);
  return {
    barWidth, layoutScale: chosen.L, sideWidth: e.sideWidth, badgeSize: e.badgeSize, column: e.column,
    typeScale: chosen.T, recordFit: chosen.recordFit, recordPx: e.recordPx, recordWidth: recordWidthAt(e.recordPx), recordFits: fits,
    lineFits: input.records.map((r) => !r || input.measure(r, e.recordPx, 'record') <= e.column),
    padY: chosen.padY, barHeight: e.barHeight, heightFits,
    teamFit: [e.team[0]!.fit, e.team[1]!.fit],
    teamLines: [e.team[0]!.lines, e.team[1]!.lines],
  };
}

/** The height the bar may take: from the HUD's bottom + 12 px down to the pitch centre (Astra r1). */
export function rankBarHeightBudget(input: { height: number; hudBottom: number }): number {
  return Math.max(0, input.height / 2 - (input.hudBottom + 12));
}

/**
 * Vertical placement. The waiting board shows the banner in its centred overlay column, directly above the waiting
 * card (WaitingBoardView.vue `.waiting-board-overlay`: flex column, justify-content center, gap 16 px) - measured in
 * the browser at about a third of the way down the pitch (y 160-240 of 600, centre ~ H / 3). The game view has no card,
 * so the bar's centre goes to H / 3 - but never over the in-game top HUD band (coach panels, scoreboard, clock): its
 * top is at least the HUD's bottom + 12 px - and its bottom no lower than the pitch centre (H / 2) when it fits there
 * (the layout sizes it to the budget between the two).
 */
export function rankBarTop(input: { height: number; barHeight: number; hudBottom: number }): number {
  const third = input.height / 3 - input.barHeight / 2;
  const aboveCentre = input.height / 2 - input.barHeight;
  return Math.round(Math.max(input.hudBottom + 12, Math.min(third, aboveCentre), 0));
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
