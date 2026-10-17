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
//   KO       = the victim team's turns left in the CURRENT DRIVE (owner 10-15: KO recovery tracked by drive)
//   casualty = the turns left in the game
// THE DRIVE (owner 10-15). How long the drive in progress runs is not known at the attack, so every attack's KO term
// is PROVISIONAL: the turns left in the half, until the drive ends (a touchdown, the end of the half, the end of the
// game); it is then FINALISED to the turns the victim's team actually started from the attack to the drive's end
// (diceStats.advanceTurnsLost). Nothing is ever estimated beyond the drive in progress.
// KO RECOVERY. The roll at the next kick-off (bb2025 StepEndTurn.recoverKnockout: a D6, recovered on a roll above 1
// whose total with the Bloodweiser Kegs and Bugman's XXXXXX modifiers is above 3 - DiceInterpreter.
// isRecoveringFromKnockout; no reroll, no apothecary) is its OWN trial, credited to the attacker who caused the KO:
// expected = P(fail) x the turns of the drive that follows, actual = that drive's turns when it fails, else 0 - the
// drive provisional (the rest of the half) until it ends, like the attack's own. A failed roll keeps the chain going
// (the next kick-off rolls again); a passed roll, or a new KO of the player, ends it.
// Every score is a whole number of turns, so each attack is an exact distribution on a lattice (outcomeKey).
//
// CROWD PUSHES (owner 10-15: "crowd surfs should be modelled"). A defender pushed off the pitch gets no armour roll: the
// server rolls the injury straight away (InjuryTypeCrowd.java: armour broken, 2D6 injury with the victim's Stunty /
// Thick Skull, Mighty Blow only when a Fan Interaction prayer names the blocker as the attacker - bb2025
// StepPushback.java:176-187), and a result short of a KO or casualty sends him to the RESERVES for the rest of the
// drive. So a crowd stun scores like a KO without its recovery roll: the turns left in the half (`crowdStun`), counted
// live like a KO (the drive in progress, approximated by the rest of the half - the same "one drive per half" estimate).
// Whether a push goes into the crowd is the server's call, not the attacker's: UtilServerPushback.findPushbackSquares
// offers the free pitch squares of the three away from the attacker, and pushes into the crowd only when none of them
// is free and at least one is off the pitch (crowdPushForced).
// CHAIN PUSHES (owner 10-16: "surfs from chain pushes"). All three squares on the pitch and taken: the pushing coach
// (the acting team: UtilServerPushback.findPushbackSquares homeChoice = isHomePlaying) picks one of them, its player is
// pushed on in that square's direction (StepPushback: the picked square becomes the next starting square), to the first
// free square, off the pitch (a crowd injury for THAT player), or on through another full row (chainPushOutcome). A
// chained player with Stand Firm (bb2025 StandFirmBehaviour: tackle zones, cancelled by Juggernaut on a Blitz only for
// an opposing player, automatic when Rooted) cancels the WHOLE push (the stack is cleared); a chained player with Side
// Step (tackle zones and a free square next to him; the attacker's Grab cancels it only for the block's defender) steps
// to a free square. Both are that player's coach's call. The chain is resolved from the pre-block board as a game:
// the attacker takes the result that is best for his team, each skill owner's coach the best for his (a surf of an
// opposing player > no surf > a surf of the attacker's own team-mate; between two surfs, the larger expected cost). A
// surf of the attacker's own team-mate is a trial for the DEFENDING team (as the blocker's own fall is).
// STEADY FOOTING (bb2025 StepSteadyFooting.java: MINMUM_ROLL 6, isSkillRollSuccessful): a player knocked down by the
// block (the defender, or the blocker on his own skull / both down - StepDropFallingPlayers.java:176, :213) rolls a D6
// BEFORE the injury is reported; a 6 keeps him standing and nothing is rolled against him. No once-per-turn limit; a
// confused or hypnotized player cannot use it. A crowd push never goes through it (StepPushback hands the crowd injury
// straight to the apothecary step), nor does the Chainsaw hit (StepBlockChainsaw.java:162-166 publishes no Steady
// Footing context). So P(the armour roll) = P(knock-down) x 5/6 for a player who has it (STEADY_FOOTING_FAIL6). A team
// reroll of the Steady Footing roll is not modelled, as rerolls of the block dice are not.

import { distKey, injuryLevelFor, parseDist, type InjuryLevel } from './diceLuck';

export const TURNS_PER_HALF = 8;

/** The turn state the scores are read from: the half, each team's started turns, and the drive in progress. */
export interface TurnClock { half: number; turnHome: number; turnAway: number; /** `${half}|${home score + away score}`: a touchdown or a new half starts a new drive. */ drive: string;
  /** Owner 10-16 (the Luck chart): the home team is the acting team. */
  homePlaying?: boolean; regular?: boolean }

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
  /** A stun from a crowd push: the player is in the reserves for the rest of the drive (see the header). */
  crowdStun: number;
}
export function turnsScore(half: number, turnNr: number, koFail6: number): TurnsScore {
  const halfLeft = turnsLeftInHalf(turnNr);
  return {
    stun: Math.min(1, halfLeft), crowdStun: halfLeft,
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

/** The crowd push of a block: `num` of the block's `reach.den` dice outcomes send the defender into the crowd, whose
 *  injury roll takes `injuryShift` (Mighty Blow under Fan Interaction, else 0) on the victim's table. */
export interface CrowdReach { num: number; injuryShift: number }
/**
 * The fair distribution of the turns one attack costs the victim's team, as a diceLuck distribution key (score in
 * sixths = 6 x turns): P(the attack reaches the armour roll) x P(the armour breaks, tier by tier) x P(each injury result
 * on the victim's table with that tier's injury modifier) x its cost, the KO split by its recovery roll; plus, for a
 * block with a crowd push, P(the defender goes into the crowd) x P(each injury result, no armour roll) x its crowd
 * cost (a stun = `crowdStun`). Exact counts over reachDen x 36 x 36 x 6, reduced.
 */
export function turnsKey(reach: { num: number; den: number }, tiers: readonly ArmourTier[], table: { stunty: boolean; thickSkull: boolean }, score: TurnsScore, crowd?: CrowdReach | null): string {
  const points = new Map<number, number>();
  const add = (turns: number, count: number) => { if (count > 0) points.set(turns * 6, (points.get(turns * 6) ?? 0) + count); };
  const unit = 36 * 36 * 6;
  const surf = crowd ? crowd.num : 0;
  add(0, (reach.den - reach.num - surf) * unit);
  // the crowd: no armour roll (every armour outcome counts as broken), so each injury total weighs 36 x 6
  if (crowd && surf > 0) for (let b1 = 1; b1 <= 6; b1++) for (let b2 = 1; b2 <= 6; b2++) {
    const level = injuryLevelFor(b1 + b2 + crowd.injuryShift, table.stunty, table.thickSkull);
    if (level === 0) add(score.crowdStun, surf * 36 * 6);
    else if (level === 2) add(score.cas, surf * 36 * 6);
    else { add(score.ko, surf * 36 * (6 - score.koFail6)); add(score.koFailed, surf * 36 * score.koFail6); }
  }
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
/** The variance of a distribution key, in turns squared: sum p x turns^2 - expected^2 over every outcome (0 included). */
export function varianceTurns(key: string): number { return parseDist(key).var36 / 36; }

/** One attack's outcomes as exact counts of `den`: no injury (`nothing`), a stun, a KO, a casualty, and a stun in the
 *  crowd (scored like a KO: the rest of the drive). Valued by outcomeKey once the drive's turns are known. */
export interface AttackOutcomes { den: number; nothing: number; stun: number; ko: number; cas: number; crowdStun: number }
/**
 * The chain of turnsKey as outcome counts: P(the attack reaches the armour roll) x P(the armour breaks, tier by tier)
 * x P(each injury result on the victim's table), plus P(the crowd) x P(each injury result, no armour roll). Exact counts
 * over reach.den x 36 x 36, reduced.
 */
export function attackOutcomes(reach: { num: number; den: number }, tiers: readonly ArmourTier[], table: { stunty: boolean; thickSkull: boolean }, crowd?: CrowdReach | null): AttackOutcomes {
  const o = { nothing: 0, stun: 0, ko: 0, cas: 0, crowdStun: 0 };
  const surf = crowd ? crowd.num : 0;
  o.nothing += (reach.den - reach.num - surf) * 36 * 36;
  if (crowd && surf > 0) for (let b1 = 1; b1 <= 6; b1++) for (let b2 = 1; b2 <= 6; b2++) {
    const level = injuryLevelFor(b1 + b2 + crowd.injuryShift, table.stunty, table.thickSkull);
    if (level === 0) o.crowdStun += surf * 36; else if (level === 2) o.cas += surf * 36; else o.ko += surf * 36;
  }
  for (let a1 = 1; a1 <= 6; a1++) for (let a2 = 1; a2 <= 6; a2++) {
    const tier = tiers.find((t) => a1 + a2 >= t.threshold);
    if (!tier) { o.nothing += reach.num * 36; continue; }
    for (let b1 = 1; b1 <= 6; b1++) for (let b2 = 1; b2 <= 6; b2++) {
      const level = injuryLevelFor(b1 + b2 + tier.injuryShift, table.stunty, table.thickSkull);
      if (level === 0) o.stun += reach.num; else if (level === 2) o.cas += reach.num; else o.ko += reach.num;
    }
  }
  let den = reach.den * 36 * 36;
  let g = den;
  for (const v of Object.values(o)) g = gcd(g, v);
  den /= g;
  return { den, nothing: o.nothing / g, stun: o.stun / g, ko: o.ko / g, cas: o.cas / g, crowdStun: o.crowdStun / g };
}
/** The distribution key of an attack's outcomes, with a stun worth `stun` turns, a KO and a crowd stun `drive` (the
 *  victim team's turns of the drive), a casualty `cas`. */
export function outcomeKey(o: AttackOutcomes, values: { stun: number; drive: number; cas: number }): string {
  return distKey(o.den, [[0, o.nothing], [values.stun * 6, o.stun], [values.drive * 6, o.ko + o.crowdStun], [values.cas * 6, o.cas]]);
}
/** P(a KO recovery roll fails), as faces of 6 (DiceInterpreter.isRecoveringFromKnockout: recovers when roll > 1 and
 *  roll + modifier > 3). */
export function koRecoveryFail6(modifier: number): number {
  let fail = 0;
  for (let roll = 1; roll <= 6; roll++) if (!(roll > 1 && roll + modifier > 3)) fail += 1;
  return fail;
}

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
  const o = blockOutcomeChance(dice, attackerChooses, scores, defenderBlock, null);
  return { num: o.down, den: o.den };
}
/** Whether the face the picker takes from `faces` knocks the defender down (see blockKnockdownChance). */
function pickFace(faces: readonly number[], attackerChooses: boolean, scores: readonly number[], defenderBlock: boolean): number {
  let best: { face: number; score: number; down: boolean } | null = null;
  for (const face of faces) {
    const cand = { face, score: scores[face] ?? 0, down: defenderDownOn(face, scores, defenderBlock) };
    if (!best) { best = cand; continue; }
    const better = attackerChooses
      ? cand.score > best.score || (cand.score === best.score && cand.down && !best.down)
      : cand.score < best.score || (cand.score === best.score && !cand.down && best.down);
    if (better) best = cand;
  }
  return best?.face ?? 0;
}
/** Owner 10-15 (the blocker's own fall): a face that knocks the ATTACKER down with an armour roll - a skull, and a both
 *  down that the attacker falls on (score -1: neither Block nor Wrestle, not turned into a push by Juggernaut). */
export function attackerDownOn(face: number, scores: readonly number[]): boolean {
  return face === 1 || (face === 2 && (scores[2] ?? 0) < 0);
}
/**
 * The block's outcomes for `dice` dice, as exact counts of 6^dice: `down` = knocked down with an armour roll, `surf` =
 * pushed into the crowd. `crowd` null = no crowd push this block (blockKnockdownChance). With a crowd push forced
 * (crowdPushForced, and no Stand Firm / Side Step - the caller decides), every face that pushes the defender sends him
 * into the crowd instead of to the armour roll: a push, a stumble (a push with Dodge, a knock-down without), a pow, and
 * a both down when Juggernaut on a Blitz may turn it into a push (`bothDownPushes`, JuggernautBehaviour). The picker is
 * taken to rank the crowd above every other result (the attacker) or below it (the defender): an injury roll with no
 * armour roll is worse for the defender than any knock-down. A pick among faces that do not push follows
 * blockKnockdownChance.
 */
export function blockOutcomeChance(dice: number, attackerChooses: boolean, scores: readonly number[], defenderBlock: boolean,
  crowd: { bothDownPushes: boolean; chain?: { attackerWants: boolean } } | null): { down: number; surf: number; attackerDown: number; den: number } {
  const den = 6 ** dice;
  let down = 0, surf = 0, attackerDown = 0;
  const pushes = (face: number) => !!crowd && (face >= 3 || (face === 2 && crowd.bothDownPushes));
  for (let combo = 0; combo < den; combo++) {
    const faces: number[] = [];
    for (let k = 0, c = combo; k < dice; k++, c = Math.floor(c / 6)) faces.push((c % 6) + 1);
    const still = faces.filter((f) => !pushes(f));
    if (crowd?.chain) {
      // owner 10-16 (chain push): a face that pushes surfs the player at the end of the chain, and the defender still
      // falls on it as usual (a pow, a stumble without Dodge). The picker ranks that surf above every other result when
      // it is good for his side (an opposing player for the attacker; the attacker's own team-mate for the defender),
      // below every other result when it is not.
      const pushing = faces.filter((f) => pushes(f));
      const wants = attackerChooses ? crowd.chain.attackerWants : !crowd.chain.attackerWants;
      const pool = pushing.length > 0 && (wants || still.length === 0) ? pushing : still;
      // Astra footing r3 #2: faces are ranked by what they do here - a both down Juggernaut turns into a push is a push
      const ranked = crowd.bothDownPushes ? scores.map((v, f) => (f === 2 ? 0 : v)) : scores;
      const face = pickFace(pool, attackerChooses, ranked, defenderBlock);
      if (pushes(face)) surf += 1;
      // Astra footing r1 #3: a both down Juggernaut turns into a push knocks nobody down (JuggernautBehaviour: the
      // result becomes a push-back, the defender's state restored)
      const converted = face === 2 && pushes(face);
      if (!converted && defenderDownOn(face, scores, defenderBlock)) down += 1;
      if (!converted && attackerDownOn(face, scores)) attackerDown += 1;
      continue;
    }
    if (still.length < faces.length && (attackerChooses || still.length === 0)) { surf += 1; continue; }
    const face = pickFace(still, attackerChooses, scores, defenderBlock);
    if (defenderDownOn(face, scores, defenderBlock)) down += 1;
    if (attackerDownOn(face, scores)) attackerDown += 1;
  }
  return { down, surf, attackerDown, den };
}

/** P(a Steady Footing roll fails), as faces of 6: it keeps the player up on a 6 only (StepSteadyFooting.java:46, :214). */
export const STEADY_FOOTING_FAIL6 = 5;

/** FieldCoordinateBounds.FIELD: the pitch squares (x 0..25, y 0..14). */
export function onPitch(x: number, y: number): boolean { return x >= 0 && x <= 25 && y >= 0 && y <= 14; }
/**
 * Whether pushing the defender back from the attacker goes into the crowd (UtilServerPushback.findPushbackSquares,
 * PushbackMode.REGULAR): the three squares away from the attacker, kept when on the pitch; a free one is always taken;
 * none free and fewer than three on the pitch = the crowd; three on the pitch and all taken = a chain push (false).
 * null when the two are not adjacent (no block geometry to read).
 */
export function crowdPushForced(attacker: readonly [number, number], defender: readonly [number, number], occupied: (x: number, y: number) => boolean): boolean | null {
  const squares = pushbackSquares(attacker, defender);
  if (!squares) return null;
  const inside = squares.filter(([sx, sy]) => onPitch(sx, sy));
  if (inside.length === 3) return false;
  return inside.every(([sx, sy]) => occupied(sx, sy));
}
/** StepPushback.freeSquareAroundDefender: an empty pitch square next to the defender (Side Step needs one). */
export function freeSquareAround(defender: readonly [number, number], occupied: (x: number, y: number) => boolean): boolean {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const x = defender[0] + dx, y = defender[1] + dy;
    if ((dx || dy) && onPitch(x, y) && !occupied(x, y)) return true;
  }
  return false;
}
/** The three push-back squares of a player at `at` pushed from `from` (UtilServerPushback.findPushbackSquares,
 *  PushbackMode.REGULAR, in the server's order), null when the two are not adjacent. */
export function pushbackSquares(from: readonly [number, number], at: readonly [number, number]): [number, number][] | null {
  const dx = at[0] - from[0], dy = at[1] - from[1];
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) return null;
  const [x, y] = at;
  return dx === 0 ? [[x - 1, y + dy], [x, y + dy], [x + 1, y + dy]]
    : dy === 0 ? [[x + dx, y - 1], [x + dx, y], [x + dx, y + 1]]
    : [[x + dx, y], [x + dx, y + dy], [x, y + dy]];
}

/** A player standing in a chain push, as the pre-block board shows him (see the header). */
export interface ChainPlayer {
  id: string;
  /** On the attacker's team. */
  own: boolean;
  /** Rooted: never moved (StandFirmBehaviour: an automatic Stand Firm - the whole push is cancelled). */
  rooted: boolean;
  /** Stand Firm he can use here (tackle zones, not cancelled by Juggernaut on a Blitz): his coach may cancel the push. */
  standFirm: boolean;
  /** Side Step he can use (tackle zones): with a free square next to him his coach may step him there. */
  sideStep: boolean;
}
export type ChainResult = { kind: 'none' } | { kind: 'capped' } | { kind: 'surf'; victim: string; own: boolean };
/** The longest chain resolved (players pushed after the defender); a longer one, or one that comes back to a square
 *  already in it, is not read (the caller leaves the block unmeasured, whatever the dice did). */
export const CHAIN_DEPTH_CAP = 8;
/**
 * `defenderStops`: the defender himself can stop the push (Stand Firm, or Side Step with a free square): his coach's
 * call like a chained player's.
 * Owner 10-16: how a push of the defender at `defender` by the attacker at `attacker` resolves when all three of its
 * squares are on the pitch and taken (a chain push), from the board before the block. null = not a chain push (a free
 * square, the crowd straight away, or not adjacent). The attacker picks the square at every full row; Stand Firm and
 * Side Step are their owners' coaches' calls; each side takes what is best for it, ranked by `value(id, own)` (the
 * expected turns a crowd injury costs that player's team): a surf of an opposing player first (the costlier the
 * better), then no surf, then a surf of the attacker's own team-mate (the cheaper the better). `capped` when any branch
 * is longer than `cap` or comes back to a square already in the chain.
 */
export function chainPushOutcome(attacker: readonly [number, number], defender: readonly [number, number], playerAt: (x: number, y: number) => ChainPlayer | null,
  value: (id: string, own: boolean) => number, cap = CHAIN_DEPTH_CAP, defenderStops = false): ChainResult | null {
  const occupied = (x: number, y: number) => playerAt(x, y) != null;
  const first = pushbackSquares(attacker, defender);
  if (!first) return null;
  const inside = first.filter(([x, y]) => onPitch(x, y));
  if (inside.length < 3 || inside.some(([x, y]) => !occupied(x, y))) return null;
  type Scored = { score: number; result: ChainResult } | 'capped';
  const NONE = { score: 1000, result: { kind: 'none' } as ChainResult };
  const surf = (p: ChainPlayer): Scored => {
    const v = value(p.id, p.own);
    return { score: p.own ? 500 - v : 2000 + v, result: { kind: 'surf', victim: p.id, own: p.own } };
  };
  /** The attacker picks among the full row ahead of the player at `at` (pushed from `from`). */
  const row = (from: readonly [number, number], at: readonly [number, number], depth: number, path: Set<string>): Scored => {
    const squares = pushbackSquares(from, at)!;
    const on = squares.filter(([x, y]) => onPitch(x, y));
    if (on.some(([x, y]) => !occupied(x, y))) return NONE;
    if (on.length < 3) return surf(playerAt(at[0], at[1])!);
    if (depth >= cap) return 'capped';
    let best: { score: number; result: ChainResult } | null = null;
    for (const sq of on) {
      const key = `${sq[0]},${sq[1]}`;
      if (path.has(key)) return 'capped';
      const next = new Set(path); next.add(key);
      const got = node(at, sq, depth + 1, next);
      if (got === 'capped') return 'capped';
      if (!best || got.score > best.score) best = got;
    }
    return best!;
  };
  /** A chained player at `at`, pushed from `from`. */
  const node = (from: readonly [number, number], at: readonly [number, number], depth: number, path: Set<string>): Scored => {
    const p = playerAt(at[0], at[1])!;
    if (p.rooted) return NONE;
    const on = row(from, at, depth, path);
    if (on === 'capped') return 'capped';
    const stop = p.standFirm || (p.sideStep && freeSquareAround(at, occupied));
    if (!stop) return on;
    // his coach's call: stop the push (no surf) or let it run
    return p.own ? (on.score >= NONE.score ? on : NONE) : (on.score <= NONE.score ? on : NONE);
  };
  const got = row(attacker, defender, 0, new Set([`${defender[0]},${defender[1]}`, `${attacker[0]},${attacker[1]}`]));
  if (got === 'capped') return { kind: 'capped' };
  // Astra footing r1 #4: the defender's own Stand Firm / Side Step (`defenderStops`) is his coach's call too - used
  // unless the chain would surf one of the attacker's team-mates
  return defenderStops && got.score > NONE.score ? NONE.result : got.result;
}
