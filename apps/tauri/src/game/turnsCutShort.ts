// Owner 10-16: "TURNS CUT SHORT" - a second Luck line that weights a turnover-causing failure by WHEN it happened in
// the team's turn. Pure maths; diceStats.ts reads the reports and feeds these helpers.
//
// TURNOVER-CAPABLE ROLLS mirror what the client itself treats as a turnover (turnPresentation.ts turnoverArmStep):
// a failed dodge, rush, leap, pick-up, pass (the thrower's) or catch (of the own team's pass or hand-off) by the side
// whose turn it is, and the blocker's own fall on his block (his knock-down arms it). Bone Head, Really Stupid, Animal
// Savagery, Bloodlust and the rest are not: the client does not treat them as turnovers. The turnover itself is the
// client's verdict at the turnEnd (turnEndIsTurnover): a successful reroll, Steady Footing or a fresh activation in
// between disarms it.
// THE SHARE of a turn still unused at a roll = (players of the acting team on the pitch not yet activated this turn,
// the acting player INCLUDED - his activation is not complete) / (the team's players on the pitch at the turn's start).
// A turnover on the first action costs 1.0 of a turn, on the last activation 1/N.
// EXPECTED per roll = P(failure) (the Action dice row's chance; for a block, the chance the blocker falls, Steady
// Footing included) x the share, booked at the roll (its first roll: rerolls are not modelled, as elsewhere). ACTUAL =
// the share of the roll that armed the turnover, when the turn did end in one. One-sided: only the acting team's line
// moves; the opponent is never credited.
// STREAKS: a first-action turnover (share >= FIRST_ACTION_SHARE) in consecutive turns of the same team is flagged in the
// story; STREAK_WEIGHT multiplies the cost of the second and later ones (1 = flagged only).

/** Owner 10-16: 1 = a streak is only flagged; 2 doubles the cost of the second and later consecutive first-action turnovers. */
export const STREAK_WEIGHT = 1;
/** A turnover with at least this share of the turn left is a "first action" one. */
export const FIRST_ACTION_SHARE = 0.8;

/** One turnover as it happened (the story and the chart). */
export interface CutShortEntry {
  seq: number;
  label: string; player: string; playerName: string;
  half: number; slot: number; turn: number;
  /** The share of the turn left, and the cost booked (the share, x STREAK_WEIGHT on a streak). */
  share: number; cost: number;
  firstAction: boolean; streak: boolean;
  /** Where it sits on the chart's axis (as BreakEntry.col / after). */
  col?: number; after?: number;
}
export interface CutShort {
  actual: number; expected: number;
  /** Sum of share^2 x p x (1 - p) over the rolls (the gauge marker only). */
  variance: number;
  /** Turnover-capable rolls scored. */
  rolls: number;
  log: CutShortEntry[];
}
export function emptyCutShort(): CutShort { return { actual: 0, expected: 0, variance: 0, rolls: 0, log: [] }; }

/** The share of the turn still unused: `unused` players (the acting one included) of `atStart`, held to 0..1. */
export function turnShare(unused: number, atStart: number): number {
  if (!(atStart > 0)) return 1;
  return Math.max(0, Math.min(1, Math.max(1, unused) / atStart));
}
/** The cost of a turnover with `share` left: a streak (a first-action turnover after one in the team's previous turn)
 *  is weighted by `weight`. */
export function cutCost(share: number, streak: boolean, weight = STREAK_WEIGHT): number { return streak ? share * weight : share; }
