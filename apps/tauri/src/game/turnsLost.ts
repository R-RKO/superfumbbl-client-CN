// Owner 10-15: the Dice pane's injury figure is TURNS LOST - "the number of missed turns against the number of expected
// missed turns in a game, surfaced against the expected odds of removal on each block thrown. This weights early
// removals much higher and late removals very little, which reflects the impact on the game."
//
// Pure maths (no game model, no Vue). diceStats.ts reads the game state and the reports and feeds these helpers.
//
// TURNS LEFT (the one definition used for the actual AND the expected figure). A team's `turnNr` (turnData) counts the
// team turns it has STARTED this half: the server raises it as the team's turn begins (step/bb2025/StepEndTurn.java
// :323-348, including the scoring team's lost turn on an off-turn touchdown) and resets it to 0 at each half
// (mechanic/bb2025/StateMechanic.java:59-60); a half is over once both teams reach 8 (UtilServerSteps.checkEndOfHalf).
// So, for the VICTIM's team at the moment of the attack:
//   turns left in the half = max(0, 8 - turnNr)      the victim team's turns not yet started this half
//   turns left in the game = that + 8 in the first half (+ 0 in the second half and in overtime)
// During the opponent's turn N the victim team has started N - 1 or N turns (who received decides); during its own turn N
// it has started N, and the turn in progress is not counted (it is under way; the player misses what is left of it).
// Overtime turns are never expected, but are counted in the actual figure when they are played.
//
// SCORES (turns the victim misses, by injury result):
//   stunned  = min(1, turns left in the half)  - one team turn; nothing when no turn of the half is left
//   KO       = the turns left in the half, plus the next drive's turns when the KO recovery roll fails
//   casualty = the turns left in the game
// The KO EXPECTATION uses a "one drive per half" estimate: the drive in progress is taken to run to the end of the
// half (which is what "the rest of the half" already assumes), so a failed recovery roll at the next kick-off costs the
// whole next half: 8 turns after a first-half KO, nothing after a second-half or overtime KO (no regulation half
// follows). The recovery fails on (KO weight) faces of 6 (diceLuck.koWeight6: 3 without kegs). This keeps every score a
// whole number of turns (an exact distribution on a lattice) and a pure function of the game state at the attack. The
// ACTUAL KO figure is counted live instead: every team turn the victim's team starts during the injury's drive, and
// during any later drive while the player is still in the KO box (diceStats.advanceTurnsLost).

import { distKey, injuryLevelFor, parseDist, type InjuryLevel } from './diceLuck';

export const TURNS_PER_HALF = 8;

/** The turn state the scores are read from: the half, each team's started turns, and the drive in progress. */
export interface TurnClock { half: number; turnHome: number; turnAway: number; /** `${half}|${home score + away score}`: a touchdown or a new half starts a new drive. */ drive: string }

/** Team turns the victim's team has not started yet this half. */
export function turnsLeftInHalf(turnNr: number): number { return Math.max(0, TURNS_PER_HALF - Math.max(0, Math.floor(turnNr))); }
/** Team turns the victim's team has not started yet in regulation (overtime is never expected). */
export function turnsLeftInGame(half: number, turnNr: number): number { return turnsLeftInHalf(turnNr) + (half === 1 ? TURNS_PER_HALF : 0); }
/** The victim team's place in the game, in team turns started: half 1 turn t = t, half 2 turn t = 8 + t, overtime 16 + t. */
export function turnIndex(half: number, turnNr: number): number { return (Math.max(1, half) - 1) * TURNS_PER_HALF + Math.max(0, Math.floor(turnNr)); }

/** What each injury result costs the victim's team at this moment, in whole turns (see the header). */
export interface TurnsScore {
  stun: number;
  /** The KO when the next recovery roll passes, and when it fails (`koFail6` faces of 6). */
  ko: number; koFailed: number; koFail6: number;
  cas: number;
}
export function turnsScore(half: number, turnNr: number, koFail6: number): TurnsScore {
  const halfLeft = turnsLeftInHalf(turnNr);
  return {
    stun: Math.min(1, halfLeft),
    ko: halfLeft, koFailed: halfLeft + (half === 1 ? TURNS_PER_HALF : 0), koFail6: Math.max(0, Math.min(6, Math.round(koFail6))),
    cas: turnsLeftInGame(half, turnNr),
  };
}
/** The actual cost booked at the injury itself: a stun and a casualty are booked whole, a KO is counted live (0 here). */
export function bookedTurns(level: InjuryLevel, score: TurnsScore): number { return level === 0 ? score.stun : level === 2 ? score.cas : 0; }

/** One way the armour can break, in the server's order of trying: the lowest 2D6 total that breaks it this way, and the
 *  injury modifier total that is left for the injury roll when it breaks this way. */
export interface ArmourTier { threshold: number; injuryShift: number }

/**
 * A block's armour tiers from the model (InjuryTypeBlock.java:66-160):
 *  - the plain roll first; Mighty Blow then still goes to the injury roll (MightyBlow.java:19-33);
 *  - with Chainsaw in play (attacker or defender, no Iron Hard Skin, mbStacksAgainstChainsaw off - the caller leaves it
 *    unmeasured when on): the +3 is added if the plain roll fails; Mighty Blow is never added to the armour (:83-86);
 *  - else Claws alone (AV counts as 8), then Mighty Blow: with Claws stacking on top of Claws, not stacking on the
 *    plain AV (:96-117); a break with Mighty Blow leaves nothing for the injury roll;
 *  - Iron Hard Skin: no armour modifier from a skill at all; Mighty Blow lands on the injury roll.
 */
export function blockArmourTiers(i: { av: number; mightyBlow: number; claws: boolean; chainsaw: boolean; ironHardSkin: boolean; clawDoesNotStack: boolean }): ArmourTier[] {
  const mb = Math.max(0, i.mightyBlow);
  const tiers: ArmourTier[] = [{ threshold: i.av, injuryShift: mb }];
  if (i.ironHardSkin) return tiers;
  if (i.chainsaw) return [...tiers, { threshold: i.av - 3, injuryShift: mb }];
  const clawsAv = Math.min(8, i.av);
  if (i.claws) tiers.push({ threshold: clawsAv, injuryShift: mb });
  if (mb > 0) tiers.push({ threshold: i.claws && !i.clawDoesNotStack ? clawsAv - mb : i.av - mb, injuryShift: 0 });
  return tiers;
}

/**
 * The armour tiers of an attack read from its own report (fouls, stabs, bites, bombs ...): `threshold` = the lowest
 * total that breaks it with everything in hand (diceLuck.armourBreakThreshold), `either` = the armour-OR-injury
 * modifiers in hand in the server's order of trying (Dirty Player, then A Sneaky Pair on a foul: InjuryTypeFoul.java
 * :66-84), each going to the armour only when the roll without it fails, else to the injury roll. That is the better of
 * its two uses: it breaks the armour when it can, and adds to the injury otherwise. Iron Hard Skin: nothing reaches the
 * armour; the modifiers all land on the injury roll.
 */
export function reportArmourTiers(threshold: number, either: readonly number[], ironHardSkin: boolean): ArmourTier[] {
  const total = either.reduce((a, v) => a + v, 0);
  if (ironHardSkin) return [{ threshold, injuryShift: total }];
  const tiers: ArmourTier[] = [];
  let left = total;
  for (let k = 0; k <= either.length; k++) {
    tiers.push({ threshold: threshold + left, injuryShift: left });
    left -= either[k] ?? 0;
  }
  return tiers;
}

function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }

/**
 * The fair distribution of the turns one attack costs the victim's team, as a diceLuck distribution key (score in
 * sixths = 6 x turns): P(the attack reaches the armour roll) x P(the armour breaks, tier by tier) x P(each injury result
 * on the victim's table with that tier's injury modifier) x its cost, the KO split by its recovery roll. Exact counts
 * over reachDen x 36 x 36 x 6, reduced.
 */
export function turnsKey(reach: { num: number; den: number }, tiers: readonly ArmourTier[], table: { stunty: boolean; thickSkull: boolean }, score: TurnsScore): string {
  const points = new Map<number, number>();
  const add = (turns: number, count: number) => { if (count > 0) points.set(turns * 6, (points.get(turns * 6) ?? 0) + count); };
  const unit = 36 * 36 * 6;
  add(0, (reach.den - reach.num) * unit);
  for (let a1 = 1; a1 <= 6; a1++) for (let a2 = 1; a2 <= 6; a2++) {
    const tier = tiers.find((t) => a1 + a2 >= t.threshold);
    if (!tier) { add(0, reach.num * 36 * 6); continue; }
    for (let b1 = 1; b1 <= 6; b1++) for (let b2 = 1; b2 <= 6; b2++) {
      const level = injuryLevelFor(b1 + b2 + tier.injuryShift, table.stunty, table.thickSkull);
      if (level === 0) add(score.stun, reach.num * 6);
      else if (level === 2) add(score.cas, reach.num * 6);
      else { add(score.ko, reach.num * (6 - score.koFail6)); add(score.koFailed, reach.num * score.koFail6); }
    }
  }
  let den = reach.den * unit;
  let g = den;
  for (const count of points.values()) g = gcd(g, count);
  den /= g;
  return distKey(den, [...points.entries()].map(([s6, count]) => [s6, count / g] as const));
}
/** The expected turns of a distribution key. */
export function expectedTurns(key: string): number { return parseDist(key).mean6 / 6; }

/** A block die face (1 attacker down .. 6 pow) and whether it puts the DEFENDER on the ground with an armour roll,
 *  under the same match-up reading as diceLuck.blockFaceScores (`scores` = its result, index 1..6):
 *  pow always; a stumble when it is a knock-down (no Dodge, or Tackle); both down when it is a knock-down for the
 *  attacker (+1), or when both players fall (-1: the attacker has neither Block nor Wrestle) and the defender has no
 *  Block. Both down at 0 is nobody falling with an armour roll (Block on both sides, a Wrestle, Juggernaut's push). */
export function defenderDownOn(face: number, scores: readonly number[], defenderBlock: boolean): boolean {
  if (face === 6) return true;
  if (face === 5) return (scores[5] ?? 0) > 0;
  if (face === 2) return (scores[2] ?? 0) > 0 || ((scores[2] ?? 0) < 0 && !defenderBlock);
  return false;
}
/**
 * P(the block knocks the defender down) for `dice` dice, as exact counts of 6^dice: every combination of faces, the
 * picker taking the face with the best result for them (diceLuck.blockRollScore: the attacker the highest, the
 * defender the lowest), a tie going to the face that is better for them (the attacker: the defender down; the
 * defender: staying up).
 */
export function blockKnockdownChance(dice: number, attackerChooses: boolean, scores: readonly number[], defenderBlock: boolean): { num: number; den: number } {
  const den = 6 ** dice;
  let num = 0;
  for (let combo = 0; combo < den; combo++) {
    let best: { score: number; down: boolean } | null = null;
    for (let k = 0, c = combo; k < dice; k++, c = Math.floor(c / 6)) {
      const face = (c % 6) + 1;
      const cand = { score: scores[face] ?? 0, down: defenderDownOn(face, scores, defenderBlock) };
      if (!best) { best = cand; continue; }
      const better = attackerChooses
        ? cand.score > best.score || (cand.score === best.score && cand.down && !best.down)
        : cand.score < best.score || (cand.score === best.score && !cand.down && best.down);
      if (better) best = cand;
    }
    if (best?.down) num += 1;
  }
  return { num, den };
}
