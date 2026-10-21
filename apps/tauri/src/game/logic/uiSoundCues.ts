import { ACTION_DIE_TUMBLE_MS } from '@fumbbl40k/ffb-pitch';

/**
 * Owner 10-19: the client-only UI cues (planner waypoint, cancel, turn clock, failed roll). Pure decisions only; the
 * view plays the sounds. Presentation-only: nothing here reads or sends the wire.
 */

/** The renderer's action-die pop-in (renderer.ts ACTION_DIE_IN_MS). The die tumbles after it. */
const ACTION_DIE_POP_IN_MS = 180;
/** A failed die's cue sounds as the die settles on its face (pop-in + tumble), with the FAILED plate under it. */
export const ROLL_FAILED_CUE_DELAY_MS = ACTION_DIE_POP_IN_MS + ACTION_DIE_TUMBLE_MS;
/** Astra 10-19 (P3): a reroll tumbles the die already on screen in place - no pop-in. */
export const ROLL_FAILED_REROLL_CUE_DELAY_MS = ACTION_DIE_TUMBLE_MS;

type CueRoll = { failed?: boolean; rerollSkill?: string; rerollTeam?: boolean };
/** Unscaled ms from a batch's show until its failed die settles, or null when no die in it failed. */
export function failedRollCueDelayMs(rolls: readonly CueRoll[]): number | null {
  const failed = rolls.filter((roll) => roll.failed === true);
  if (failed.length === 0) return null;
  return failed.every((roll) => !!roll.rerollSkill || !!roll.rerollTeam) ? ROLL_FAILED_REROLL_CUE_DELAY_MS : ROLL_FAILED_CUE_DELAY_MS;
}

/** Owner 10-21 (RickWreckless, g1955268: "Sure hands pickup that fails then succeeds plays the success noise first then
 *  the fail"): the frame sounds that announce a roll's SUCCESS, by the server roll report they belong to. Upstream sets
 *  PICKUP (StepPickUp) and CATCH (StepCatchScatterThrowIn) only when the roll that settles the ball succeeded. The DODGE
 *  sound is not one: StepMove sets it on the move into the square, a frame before the dodge roll is made. */
const SUCCESS_SOUND_ROLL_REPORT: Readonly<Record<string, string>> = { pickup: 'pickUpRoll', catch: 'catchRoll' };
/**
 * Owner 10-21 (rule A): the frame's success sound when its rolls end in a REROLLED SUCCESS - a failed roll (in this
 * frame or an earlier one) followed by any reroll whose result passed. That sound rides the last roll's landing (after
 * the failed die's cue and the reroll beat), never the start of the frame's beat. Null for a frame with no reroll (it
 * keeps its timing) and for a chain that ends in failure (the server sends no success sound then).
 */
export function rerollChainSuccessSound(reports: readonly Record<string, unknown>[], frameSound: unknown): string | null {
  const sound = typeof frameSound === 'string' ? frameSound : '';
  const reportId = SUCCESS_SOUND_ROLL_REPORT[sound];
  if (!reportId) return null;
  const rolls = reports.filter((report) => String(report.reportId) === reportId);
  const last = rolls[rolls.length - 1];
  return last && last.reRolled === true && last.successful === true ? sound : null;
}
/** Unscaled ms from a die's show until it settles on its face: a rerolled die tumbles in place, any other pops in first. */
export function dieSettleMs(roll: CueRoll | null | undefined): number {
  return roll && (!!roll.rerollSkill || !!roll.rerollTeam) ? ROLL_FAILED_REROLL_CUE_DELAY_MS : ROLL_FAILED_CUE_DELAY_MS;
}
/** The success sound of a rerolled chain never crowds the failed die's cue: at least this long after it. */
export const REROLL_SUCCESS_AFTER_FAIL_CUE_MS = 150;

/** Seconds left on the clock when the one-minute warning sounds. */
export const TURN_CLOCK_MINUTE_S = 60;
/** The last-seconds countdown sounds once on each of these remaining values (10, 9, ... 1). */
export const TURN_CLOCK_COUNTDOWN_FROM_S = 10;

export type TurnClockCue = 'minute' | 'countdown' | null;

/**
 * The cue for a turn-clock change from `prev` to `next` whole seconds remaining. Only a falling clock on my own turn
 * cues: a new turn (the clock jumps back up), a server pause (unchanged) and a first reading (no `prev`) are silent.
 * The clock re-snaps to the server's ~1 s tick, so a skipped tick still crosses the minute once and still counts
 * the second it lands on.
 */
export function turnClockCue(prev: number | null | undefined, next: number, myTurn: boolean): TurnClockCue {
  if (!myTurn || prev == null || !Number.isFinite(prev) || !Number.isFinite(next) || next >= prev) return null;
  if (next >= 1 && next <= TURN_CLOCK_COUNTDOWN_FROM_S) return 'countdown';
  if (prev > TURN_CLOCK_MINUTE_S && next <= TURN_CLOCK_MINUTE_S) return 'minute';
  return null;
}

/**
 * Astra 10-19 (P2-3): the turn-clock cues of one turn. `turnClockCue` alone compared against whatever came before, so a
 * numeric fallback (240 s before any server snapshot) made the first REAL reading - e.g. 0:59 after a reconnect - cue,
 * and a re-snapping clock (11 -> 10 -> 11 -> 10) counted the same second twice. Here:
 * - the first authoritative reading of a turn (or after the reading was lost: `seconds` null) only initialises;
 * - each threshold is consumed once per turn: the minute once, each countdown second 10..1 once (seconds already at
 *   or below the reading that initialised the turn count as consumed);
 * - a new `turnKey` (game / half / turn numbers) starts over. Only `myTurn` readings cue.
 * Astra confirmation 10-19 (P2): the model's turn changes before the server's clock does - the sample on hand when the
 * key changes is the PREVIOUS turn's last one (e.g. the opponent's 0:09). A turn is initialised only from a LATER
 * sample (`sampleId` = the server clock sample's identity, e.g. its receipt time), never from the one carried over.
 * Astra round 3 (P3): "later" is judged against the last sample OBSERVED, independent of the key - a sample that is
 * already new when the key changes (a reconnect, a late first sample, turn and sample seen together) initialises at once.
 */
export function createTurnClockCueTracker(): {
  reading: (turnKey: string | null, seconds: number | null, myTurn: boolean, sampleId: number | null) => TurnClockCue;
} {
  let key: string | null = null;
  let prev: number | null = null;
  let lastSample: number | null = null;
  let minuteDone = false;
  const countdownDone = new Set<number>();
  return {
    reading(turnKey, seconds, myTurn, sampleId) {
      const freshSample = sampleId !== lastSample;
      lastSample = sampleId;
      if (turnKey == null || seconds == null || !Number.isFinite(seconds)) { key = null; prev = null; return null; }
      if (turnKey !== key) { key = turnKey; prev = null; }
      if (prev === null) {
        if (!freshSample) return null; // still the sample observed before the turn change: wait for this turn's own
        prev = seconds;
        minuteDone = seconds <= TURN_CLOCK_MINUTE_S;
        countdownDone.clear();
        for (let s = Math.max(1, Math.ceil(seconds)); s <= TURN_CLOCK_COUNTDOWN_FROM_S; s += 1) countdownDone.add(s);
        return null;
      }
      const cue = turnClockCue(prev, seconds, myTurn);
      prev = seconds;
      let out: TurnClockCue = null;
      if (cue === 'countdown' && !countdownDone.has(seconds)) { countdownDone.add(seconds); out = 'countdown'; }
      else if (cue === 'minute' && !minuteDone) out = 'minute';
      if (seconds <= TURN_CLOCK_MINUTE_S) minuteDone = true;
      return out;
    },
  };
}

/** Astra 10-19 (P2-2): the failed-roll cue is the PLAYING coach's own - never a spectator seat or a replay (at any
 *  speed), and never while catching up / fast-forwarding. */
export function rollFailedCueAllowed(mode: { playing: boolean; replay: boolean; catchingUp: boolean }): boolean {
  return mode.playing && !mode.replay && !mode.catchingUp;
}

/**
 * Astra 10-19 (P2-2): the failed-roll cue sounds once per die OCCURRENCE. A batch is re-published (a reroll stage, a
 * re-processed frame), so a FAILED die seen before must not cue again. A die's key is its occurrence (`dieKeys`, the
 * server command + its place in that frame) or, unknown, its batch seq + index (once per batch). Bounded memory;
 * `reset()` on a game change (command numbers restart).
 */
export function createFailedRollCueOnce(cap = 512): {
  admit: (seq: number, rolls: readonly { failed?: boolean }[], dieKeys?: readonly string[]) => boolean;
  reset: () => void;
} {
  const seen = new Set<string>();
  return {
    admit(seq, rolls, dieKeys) {
      let fresh = false;
      rolls.forEach((roll, i) => {
        if (roll.failed !== true) return;
        const key = dieKeys && dieKeys.length === rolls.length ? `die ${dieKeys[i]}` : `batch ${seq}#${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        fresh = true;
      });
      while (seen.size > cap) seen.delete(seen.values().next().value as string);
      return fresh;
    },
    reset() { seen.clear(); },
  };
}

/** A dice batch shows a FAILED plate. */
export function batchHasFailedRoll(rolls: readonly { failed?: boolean }[]): boolean {
  return rolls.some((roll) => roll.failed === true);
}
