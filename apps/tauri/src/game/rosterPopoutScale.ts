/**
 * Owner 10-18 (sv398's report: the list stopped at eleven players and a taller window only added blank space):
 * the two axes do two different things. TALLER adds rows at the base size, up to the full SIXTEEN (players 17+
 * scroll); WIDER scales the whole content (text, portraits, badges) up: scale = max(1, widthFit). Height never scales.
 * (Owner 10-02's rule was eleven rows, then scale by height-and-width.)
 */
export const ROSTER_POPOUT_ROWS = 16;
/** The window opens showing this many rows (fewer when neither team has that many); drag it taller for the rest. */
export const ROSTER_POPOUT_DEFAULT_ROWS = 11;

export interface RosterPopoutMetrics {
  /** The frame's inner size, px. */
  frameHeight: number;
  frameWidth: number;
  /** Measured at scale 1: the header bar, the body minus its list (padding + team switch), one row. */
  headH: number;
  chromeH: number;
  rowH: number;
  /** The frame's inner width the base (scale 1) layout was designed at. */
  baseWidth: number;
}

/** Height that shows `rows` rows at scale 1. */
export function rosterPopoutHeightFor(m: Pick<RosterPopoutMetrics, 'headH' | 'chromeH' | 'rowH'>, rows: number): number {
  return m.headH + m.chromeH + rows * m.rowH;
}

export function rosterPopoutScale(m: Pick<RosterPopoutMetrics, 'frameWidth' | 'baseWidth'> & Partial<RosterPopoutMetrics>): number {
  if (!(m.baseWidth > 0) || !(m.frameWidth > 0)) return 1;
  return Math.max(1, Math.floor((m.frameWidth / m.baseWidth) * 100) / 100); // floored: the base width never spills a sliver
}
