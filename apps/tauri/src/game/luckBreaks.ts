// Owner 10-16: the LUCK row counts UNLIKELY EVENTS - lucky breaks against the number expected - in place of the signed
// turns figure. Pure maths (no game model, no Vue): diceStats.ts reads the reports and feeds these helpers.
//
// AN EVENT is any resolved roll or attack outcome the dice pane already measures: every action roll the Action dice
// row scores (dodge, rush, pick-up, pass, catch, jump ...), every block roll the Block dice row scores, every armour and
// injury roll the Armour / Injury figures score, every KO recovery roll, and every Turns lost trial's outcome (a block's
// knock-down chain, the blocker's own fall, a chain-push surf). Each event's outcomes carry the chance p the rows
// already compute BEFORE the dice fell, and the team the outcome favours:
//   a roll against a target     success favours the roller's team, failure the opponent
//   a block roll                a good result (score +1) favours the blocking team, a bad one (-1) the defending team
//   armour                      broken favours the attacker's team, held the victim's
//   injury                      a KO or a casualty favours the attacker's team; a stun favours the victim's team only
//                               when removal was the likelier result of that roll (owner 10-16), else nobody's
//   KO recovery                 failed favours the opponent of the player's team, recovered his team
//   a Turns lost trial          an injury (stun, KO, casualty, crowd) favours the credited team, nothing the victim's
// AN UNLIKELY OUTCOME has p <= UNLIKELY_P. When it happens it is a LUCKY BREAK for the team it favours and a BAD
// BREAK for the other team (so one team's lucky breaks are exactly the other team's bad breaks).
// EXPECTED lucky breaks of a team = sum over every event of P(an unlikely outcome in its favour): for a roll with
// success chance s, s to the roller's team when s <= UNLIKELY_P, 1 - s to the opponent when 1 - s <= UNLIKELY_P; for a
// many-outcome event, the summed chance of its unlikely outcomes in that team's favour. Expected bad breaks mirror it.
// Overlap: a block's Turns lost trial and the armour / injury rolls it leads to are separate events by the owner's
// list; both sides count both, so actual and expected stay comparable.

/** Owner 10-16 (threshold assumption): an outcome this unlikely or rarer is a break. One constant: 1/4 or 1/6 later. */
export const UNLIKELY_P = 1 / 3;
/** Float slack so that exactly 1/3 (2 of 6, 12 of 36) counts as unlikely. */
const EPS = 1e-9;

/** One outcome of an event: its chance before the dice fell and the team it favours (null = neither). */
export interface BreakOutcome { p: number; favours: string | null }

/** One break as it happened, kept for the Luck story and the chart. */
export interface BreakEntry {
  /** The event's place in the one order of Luck events (rolls and Turns lost trials alike; negative on trials kept
   *  before that order existed). */
  seq: number;
  /** A lucky break for the team whose log holds it (else a bad break). */
  lucky: boolean;
  /** What happened ("5+ dodge made", "Armour broken" ...) and who rolled / attacked. */
  label: string; player: string; playerName: string;
  /** When: the half, the team turns started in it before this one (`slot`, play order from 0), and the turn number. */
  half: number; slot: number; turn: number;
  /** The chance of what happened. */
  p: number;
  /** The index in LuckBreaks.played of the team turn it happened in (Astra chart r3: a backward Time-out can repeat a
   *  slot), absent when not known. */
  col?: number;
  /** When it fell in no played turn (no regular-play frame ended in its slot yet): how many turns had been played then;
   *  the chart gives it a column of its own right after them. */
  after?: number;
}
/** A team's breaks. */
export interface LuckBreaks {
  lucky: number; luckyExpected: number; luckyVar: number;
  bad: number; badExpected: number; badVar: number;
  /** Events scored (both teams count every event). */
  events: number;
  log: BreakEntry[];
  /** Owner 10-16 (the Luck chart, Astra chart r1): the team turns actually played, in play order - a kick-off
   *  Time-out moves the turn markers without a turn being played, so the axis is never read from the markers alone. */
  played?: { half: number; slot: number; turn: number }[];
}
export function emptyBreaks(): LuckBreaks { return { lucky: 0, luckyExpected: 0, luckyVar: 0, bad: 0, badExpected: 0, badVar: 0, events: 0, log: [] }; }

export const isUnlikely = (p: number, threshold = UNLIKELY_P): boolean => p > 0 && p <= threshold + EPS;

/** What one event adds to a team's breaks: its expected lucky / bad breaks (and their variances), and whether the
 *  outcome that happened was a lucky (+1) or bad (-1) break for it, else 0. */
export interface BreakDelta { luckyExpected: number; luckyVar: number; badExpected: number; badVar: number; happened: -1 | 0 | 1; p: number | null }
/**
 * One event for `team` (one of the two teams): `outcomes` with their chances, `happened` the index of the outcome that
 * happened (null = not known; only the expectation is added). The expectation depends on the outcomes alone.
 */
export function breakDelta(outcomes: readonly BreakOutcome[], happened: number | null, team: string, threshold = UNLIKELY_P): BreakDelta {
  let lucky = 0, bad = 0;
  for (const o of outcomes) {
    if (!o.favours || !isUnlikely(o.p, threshold)) continue;
    if (o.favours === team) lucky += o.p; else bad += o.p;
  }
  const hit = happened == null ? null : outcomes[happened] ?? null;
  const counts = !!hit && !!hit.favours && isUnlikely(hit.p, threshold);
  return {
    luckyExpected: lucky, luckyVar: lucky * (1 - lucky), badExpected: bad, badVar: bad * (1 - bad),
    happened: !counts ? 0 : hit!.favours === team ? 1 : -1, p: counts ? hit!.p : null,
  };
}
/** A roll against a target: success chance `s` for the roller's team `roller`, failure for `other`. */
export function rollOutcomes(s: number, roller: string, other: string): BreakOutcome[] { return [{ p: s, favours: roller }, { p: 1 - s, favours: other }]; }

/**
 * Owner 10-16 (ruling): an injury roll's outcomes from its counts of 36 ([stun, KO, casualty]): a KO or a casualty
 * favours the attacker's team; a stun is the victim team's break only when removal (KO or casualty) was likelier than
 * the stun on that roll, else it favours nobody.
 */
export function injuryRollOutcomes(counts: readonly [number, number, number], victimTeam: string, attackerTeam: string): BreakOutcome[] {
  const [stun, ko, cas] = counts;
  return [{ p: stun / 36, favours: ko + cas > stun ? victimTeam : null }, { p: ko / 36, favours: attackerTeam }, { p: cas / 36, favours: attackerTeam }];
}
/** "1 in X" for a chance (rounded; at least 1 in 2 never reads for a break, which is 1 in 3 or rarer). */
export function oneInX(p: number): string { return `1 in ${Math.max(1, Math.round(1 / p)).toLocaleString()}`; }
