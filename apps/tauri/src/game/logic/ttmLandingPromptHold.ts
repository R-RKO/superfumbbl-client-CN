// Owner 10-13: "The reroll prompt for a failed landing roll on a TTM is appearing early and tracking the player. Let's
// make sure we time that to appear after the die toast and the user has landed on the ground."
//
// Upstream (bb2025 StepInitScatterPlayer -> StepRightStuff) sends the Throw Team-Mate flight and the landing roll as
// separate model syncs a few ms apart: the `throwTeamMate` animation (+ the thrown player's landing coordinate), then
// `rightStuffRoll` (failed) + the reroll dialog (reRolledAction "Right Stuff"). Both apply at once; the flight takes
// ~640 ms on screen, so the card used to surface on the first frame of the flight, anchored to the moving token.
//
// This hold defers ONLY the card's presentation (the model and the server's dialog are live; nothing is answered and
// no frame is held). The card is armed when, for the thrown player:
//   - the flight is over (every throw / landing-scatter cue noted for that player has run its course), AND
//   - the landing die has been on screen for its read beat (the view reports when it really shows the die).
// Every hold has a wake: that normal release, a bounded safety timer from the start (presents regardless), and
// `drop` (reset / seek / catch-up / game change: the arms are discarded, the caller re-surfaces the live dialog).
// A dialog the server withdrew meanwhile is the caller's concern: each arm re-checks its dialog instance.

export interface TtmLandingPromptHoldDeps {
  schedule(callback: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
  now(): number;
  /** Called whenever the held / released state changes (the store bumps a reactive revision). */
  onChange?(): void;
}

export interface TtmLandingHoldStart {
  /** The landing die's read beat once it is on screen. */
  readMs: number;
  /** Extra margin of the safety timer on top of the flight's remaining time and the read beat. */
  safetyMarginMs: number;
}

export interface TtmLandingPromptHold {
  /** A Throw Team-Mate flight / landing hop of `playerId` started now and lasts `ms` on screen. */
  noteFlight(playerId: string, ms: number): void;
  /** The failed landing die of `playerId` is being published: hold that player's landing prompt until the beat has
   *  played. Returns the callback the die's show report feeds (`msUntilShown` from now). Replaces an older hold. */
  begin(playerId: string, opts: TtmLandingHoldStart): (msUntilShown: number) => void;
  /** Queue `arm` behind the hold of `playerId`. False = nothing is held for that player: the caller arms now. */
  defer(playerId: string, arm: () => void, onDrop?: () => void): boolean;
  /** Is the landing prompt of `playerId` (or of anyone, without an id) still held? */
  held(playerId?: string): boolean;
  /** Present now: run every queued arm (in order) and end the hold. */
  release(): void;
  /** End the hold WITHOUT arming (reset / seek / catch-up / game change); each dropped arm's `onDrop` runs. */
  drop(): void;
  /** Test/inspection: when the hold will release on its own (absolute ms), null when not yet known. */
  readonly releaseAt: number | null;
}

interface Hold {
  playerId: string;
  arms: { arm: () => void; onDrop?: () => void }[];
  readEndsAt: number | null;
  releaseTimer: unknown;
  safetyTimer: unknown;
}

export function createTtmLandingPromptHold(deps: TtmLandingPromptHoldDeps): TtmLandingPromptHold {
  const flightEnds = new Map<string, number>();
  let hold: Hold | null = null;

  const flightEndOf = (playerId: string): number => {
    const end = flightEnds.get(playerId) ?? 0;
    if (end <= deps.now()) flightEnds.delete(playerId);
    return end;
  };
  const clearTimers = (h: Hold) => {
    if (h.releaseTimer !== null) deps.cancel(h.releaseTimer);
    if (h.safetyTimer !== null) deps.cancel(h.safetyTimer);
    h.releaseTimer = null;
    h.safetyTimer = null;
  };
  const finish = (h: Hold, run: boolean) => {
    if (hold !== h) return;
    hold = null;
    clearTimers(h);
    const arms = h.arms.splice(0);
    for (const entry of arms) {
      if (run) entry.arm();
      else entry.onDrop?.();
    }
    deps.onChange?.();
  };
  /** (Re)schedule the normal release for the later of the flight end and the die's read end. */
  const schedule = (h: Hold) => {
    if (hold !== h || h.readEndsAt === null) return;
    if (h.releaseTimer !== null) deps.cancel(h.releaseTimer);
    h.releaseTimer = null;
    const at = Math.max(h.readEndsAt, flightEndOf(h.playerId));
    const wait = at - deps.now();
    if (wait <= 0) { finish(h, true); return; }
    h.releaseTimer = deps.schedule(() => { h.releaseTimer = null; schedule(h); }, wait);
  };

  return {
    noteFlight(playerId, ms) {
      if (!playerId || !(ms > 0)) return;
      const end = deps.now() + ms;
      flightEnds.set(playerId, Math.max(flightEnds.get(playerId) ?? 0, end));
      if (hold?.playerId === playerId) schedule(hold);
    },
    begin(playerId, opts) {
      const prior = hold;
      if (prior) finish(prior, true); // an older landing's card is not held hostage by a newer one
      const h: Hold = { playerId, arms: [], readEndsAt: null, releaseTimer: null, safetyTimer: null };
      hold = h;
      const flightLeft = Math.max(0, flightEndOf(playerId) - deps.now());
      h.safetyTimer = deps.schedule(() => { h.safetyTimer = null; finish(h, true); },
        flightLeft + Math.max(0, opts.readMs) + Math.max(0, opts.safetyMarginMs));
      deps.onChange?.();
      let reported = false;
      return (msUntilShown: number) => {
        if (reported || hold !== h) return;
        reported = true;
        h.readEndsAt = deps.now() + Math.max(0, msUntilShown) + Math.max(0, opts.readMs);
        schedule(h);
      };
    },
    defer(playerId, arm, onDrop) {
      if (!hold || hold.playerId !== playerId) return false;
      hold.arms.push({ arm, onDrop });
      return true;
    },
    held(playerId) {
      return !!hold && (playerId === undefined || hold.playerId === playerId);
    },
    release() { if (hold) finish(hold, true); },
    drop() {
      flightEnds.clear();
      if (hold) finish(hold, false);
    },
    get releaseAt() {
      if (!hold || hold.readEndsAt === null) return null;
      return Math.max(hold.readEndsAt, flightEnds.get(hold.playerId) ?? 0);
    },
  };
}

/** The server's reRolledAction of the landing roll (upstream ReRolledActions.RIGHT_STUFF = "Right Stuff"). */
export function isRightStuffReRolledAction(value: unknown): boolean {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '') === 'rightstuff';
}
