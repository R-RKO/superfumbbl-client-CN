/**
 * Owner 10-13: on a rerolled block the rerolled dice tumble again, so the coach (and the opponent, spectators and
 * replay viewers) can see a reroll happened. This module decides WHETHER a reroll actually rolled dice and WHICH dice,
 * from what the server sent only. It never infers an index by comparing faces (server-derived law, Astra 10-13).
 *
 * Upstream BB2025 (christerk/ffb master):
 *  - Brawler / Hatred replace the FIRST Both Down / Skull die (StepBlockRoll.handleImplicitReRollIndex, the same loop
 *    in mutliblock/StepBlockRollMultiple; BlockResultFactory.forRoll: 1 = Skull, 2 = Both Down). That is the server's
 *    own rule, applied to the dice it last sent.
 *  - Pro, the single-die skills and Savage Blow replace chosen indexes. A Multiple Block row carries them on the wire
 *    (`proIndex`, `reRolledDice`: BlockRollProperties.toJsonValue). The single-block dialog and reports carry none
 *    (ReportBlockReRoll, ReportBlockRoll, DialogBlockRollPropertiesParameter), so only the chooser's own command index
 *    is exact; an observer tumbles every die (an honest "a reroll happened" cue).
 *  - A team reroll / Team Mascot / Leader rerolls every die.
 *  - A failed use (Pro roll, Mascot roll) resends the unchanged roll: no tumble (`successful` on reRoll / mascotUsed).
 */

/** Every die index of a roll of `count` dice. */
export function allBlockDiceIndices(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_v, i) => i);
}

export interface RerolledBlockDiceInput {
  /** The dice the server sent before the reroll (null when unknown: every die then tumbles). */
  previous: readonly number[] | null;
  /** The dice the server resent after the reroll. */
  next: readonly number[];
  /** `blockReRoll.blockRoll`: the rerolled faces only (absent for a full reroll). */
  rerolledFaces?: readonly number[] | null;
  /** `blockReRoll.reRollSource` (or the generic `reRoll.reRollSource`). */
  source?: string | null;
  /** The die indexes the local coach's own command named (Pro / single-die skills / Savage Blow). */
  ownIndices?: readonly number[] | null;
  /** A Multiple Block row's wire indexes: `reRolledDice` and `proIndex`. */
  wire?: { reRolledDice?: readonly number[] | null; proIndex?: number | null } | null;
}

const BOTH_DOWN = 2;
const SKULL = 1;

function validIndices(indices: readonly number[] | null | undefined, count: number): number[] | null {
  if (!indices || indices.length === 0) return null;
  const unique = [...new Set(indices)];
  if (unique.some((i) => !Number.isInteger(i) || i < 0 || i >= count)) return null;
  return unique.sort((a, b) => a - b);
}

/**
 * The die indexes a successful reroll replaced, ascending. Never empty for a non-empty roll: when the wire does not
 * name the replaced die (an observer of a single-block chosen-die reroll, unknown previous dice, a full reroll) every
 * die tumbles.
 */
export function rerolledBlockDiceIndices(input: RerolledBlockDiceInput): number[] {
  const { previous, next } = input;
  const count = next.length;
  const all = allBlockDiceIndices(count);
  if (count === 0) return all;
  const faces = input.rerolledFaces && input.rerolledFaces.length > 0 ? input.rerolledFaces : null;
  // A full reroll (team reroll, Mascot, Leader ...): no rerolled-faces report, or one naming every die.
  if (!faces || faces.length >= count) return all;
  const source = String(input.source ?? '').toLowerCase();
  if (faces.length === 1 && (source === 'brawler' || source === 'hatred')) {
    // The server rule: the first Both Down / Skull of the roll it last sent.
    if (!previous || previous.length !== count) return all;
    const index = previous.findIndex((v) => v === (source === 'brawler' ? BOTH_DOWN : SKULL));
    return index >= 0 ? [index] : all;
  }
  const own = validIndices(input.ownIndices, count);
  if (own && own.length === faces.length) return own;
  const wireDice = validIndices(input.wire?.reRolledDice, count);
  if (wireDice && wireDice.length === faces.length) return wireDice;
  const pro = input.wire?.proIndex;
  if (faces.length === 1 && typeof pro === 'number' && Number.isInteger(pro) && pro >= 0 && pro < count) return [pro];
  return all;
}

export interface BlockRerollOutcome {
  /** The server rolled dice for this reroll (false: a failed Pro / Mascot use resent the unchanged roll). */
  rolled: boolean;
  faces: number[] | null;
  source: string | null;
  /** Owner 10-20: the use chain ended on a FAILED Loner roll (`reRoll` {reRollSource: 'Loner', successful: false}):
   *  nothing was rerolled (the server resent the unchanged roll), yet the original dice tumble again and land back on
   *  their own faces before the Loner pill. Present only when true. */
  lonerFailed?: true;
}

function isRerollReport(r: Record<string, unknown>): boolean {
  const id = String(r.reportId);
  return id === 'mascotUsed' || (id === 'reRoll' && r.reRollSource != null);
}

const BLOCK_ROLL_REPORTS = new Set(['block', 'blockReRoll', 'blockRoll']);
/** Reports bb2025 RollMechanic emits inside a reroll use, between its marker and the rerolled roll: the use chain
 *  itself (reRoll, mascotUsed) and the Team Captain save roll (checkTeamCaptain: teamCaptainRoll, after a successful
 *  Mascot and before a team reroll report). They never own the reroll, so the order scan steps over them. */
const REROLL_USE_REPORTS = new Set(['reRoll', 'mascotUsed', 'teamCaptainRoll']);
/** The team-type sources useTeamReRoll reports (findUsedTeamReRollSource; ffb-common ReRollSources names). Their
 *  ReportReRoll carries the `successful` flag useReRoll started with (false) - not an outcome: the reroll is spent and
 *  happens unless a following Loner report says it failed (checkForLoner). */
const TEAM_REROLL_SOURCES = new Set(['Team ReRoll', 'Leader', 'Brilliant Coaching ReRoll', 'Pump up the Crowd', 'Star of the Show']);

/**
 * True when the reroll report at `index` rerolled the BLOCK roll. ReportReRoll names no action, but the server emits
 * the reroll report and then the report of the roll it rerolled: a block reroll is followed by block / blockReRoll /
 * blockRoll (a failed use too: StepBlockRoll.showBlockRollDialog always ends with ReportBlockRoll), while a Dauntless
 * reroll (Blind Rage, or a team reroll of Dauntless) is followed by its dauntlessRoll (DauntlessBehaviour), so it is
 * never a block reroll even when the block roll shares the frame. A reroll report with no roll after it is not one.
 */
function rerollsTheBlockRoll(reports: readonly Record<string, unknown>[], index: number): boolean {
  for (let j = index + 1; j < reports.length; j++) {
    const id = String(reports[j]!.reportId);
    if (BLOCK_ROLL_REPORTS.has(id)) return true;
    if (REROLL_USE_REPORTS.has(id)) continue;
    if (/Roll$/.test(id)) return false; // another roll (dauntlessRoll, confusionRoll ...) owns it
  }
  return false;
}

/**
 * The block reroll of a frame, or null when the frame carries none (only block-roll rerolls count, see
 * rerollsTheBlockRoll: a Dauntless / Blind Rage reroll never does). A `blockReRoll` report means dice were rolled (the
 * server emits it with the new die). Otherwise the LAST deciding report of the use chain decides (rerollReportVerdict):
 * a chain (Pro fails, the Mascot rolls, Pro again; a Mascot falls back to the team reroll; a team reroll then the
 * Loner roll) ends on the report of the reroll that counted. A plain Mascot may send only `mascotUsed`
 * (RollMechanic.useMascot), so it counts as a reroll event too.
 */
export function blockRerollOutcome(reports: readonly Record<string, unknown>[]): BlockRerollOutcome | null {
  const block = reports.find((r) => String(r.reportId) === 'blockReRoll');
  const chain = reports.filter((r, i) => isRerollReport(r) && rerollsTheBlockRoll(reports, i));
  if (!block && chain.length === 0) return null;
  if (block) {
    const faces = Array.isArray(block.blockRoll) ? (block.blockRoll as unknown[]).map(Number).filter((v) => Number.isInteger(v)) : null;
    return { rolled: true, faces: faces && faces.length ? faces : null, source: block.reRollSource == null ? null : String(block.reRollSource) };
  }
  const last = chain[chain.length - 1]!;
  const isMascot = String(last.reportId) === 'mascotUsed';
  const lonerFailed = String(last.reportId) === 'reRoll' && String(last.reRollSource) === 'Loner' && last.successful === false;
  return {
    rolled: rerollReportVerdict(last),
    faces: null,
    source: isMascot ? 'Team Mascot' : String(last.reRollSource),
    ...(lonerFailed ? { lonerFailed: true as const } : {}),
  };
}

/** Whether a use-chain report, as the last one, means the dice were rerolled (bb2025 RollMechanic.useReRoll): a
 *  team-type reroll report always (its flag is not an outcome; a Loner roll after it would be the last report), the
 *  Loner / Pro / skill reRoll and mascotUsed reports by their own `successful`. */
function rerollReportVerdict(report: Record<string, unknown>): boolean {
  if (String(report.reportId) === 'reRoll' && TEAM_REROLL_SOURCES.has(String(report.reRollSource))) return true;
  return report.successful === true;
}

/** The dice a tumble frame shows: the tumbling dice get a random face that always differs from their last frame;
 *  the kept dice show their real (settled) face throughout. */
export function blockTumbleFrameFaces(
  dice: readonly number[],
  tumbling: readonly number[],
  last?: readonly number[] | null,
  random: () => number = Math.random,
): number[] {
  const set = new Set(tumbling);
  return dice.map((value, i) => {
    if (!set.has(i)) return value;
    let face = 1 + Math.floor(random() * 6);
    if (last && last[i] === face) face = (face % 6) + 1;
    return face;
  });
}

export interface BlockTumbleTimers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultTimers: BlockTumbleTimers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface BlockTumbleFrame {
  key: string;
  faces: number[];
  /** The die indexes tumbling in this run (the rest stay settled). */
  tumbling: number[];
}

/**
 * One tumble run (the first roll and every reroll alike): the tumbling dice cycle random faces every `stepMs` for
 * `durationMs`, then the run ends and `onFrame(null)` is the wake (the chooser re-enables on it). Starting a new run
 * replaces the previous one; `stop()` ends it at once (reveals the real faces).
 */
export class BlockTumbleRun {
  private interval: unknown = null;
  private timeout: unknown = null;
  private frame: BlockTumbleFrame | null = null;

  constructor(
    private readonly onFrame: (frame: BlockTumbleFrame | null) => void,
    private readonly timers: BlockTumbleTimers = defaultTimers,
    private readonly random: () => number = Math.random,
  ) {}

  get current(): BlockTumbleFrame | null { return this.frame; }

  start(key: string, dice: readonly number[], tumbling: readonly number[], durationMs: number, stepMs: number): void {
    this.clearTimers();
    const indices = tumbling.filter((i) => Number.isInteger(i) && i >= 0 && i < dice.length);
    if (indices.length === 0) { this.set(null); return; }
    this.set({ key, tumbling: indices, faces: blockTumbleFrameFaces(dice, indices, null, this.random) });
    this.interval = this.timers.setInterval(() => {
      if (this.frame) this.set({ ...this.frame, faces: blockTumbleFrameFaces(dice, indices, this.frame.faces, this.random) });
    }, stepMs);
    this.timeout = this.timers.setTimeout(() => this.stop(), Math.max(0, durationMs));
  }

  /** Stop the face cycling but keep the run marked as tumbling: a 3D clip took over and owns the settle. The 3D settle
   *  rides animation frames, which a hidden tab pauses, so `backstopMs` (when given) ends the run on a timer anyway:
   *  the chooser gate always wakes. */
  handOff(backstopMs?: number): void {
    this.clearTimers();
    if (backstopMs !== undefined && this.frame) this.timeout = this.timers.setTimeout(() => this.stop(), Math.max(0, backstopMs));
  }

  stop(): void {
    this.clearTimers();
    this.set(null);
  }

  private set(frame: BlockTumbleFrame | null): void {
    this.frame = frame;
    this.onFrame(frame);
  }

  private clearTimers(): void {
    if (this.interval !== null) this.timers.clearInterval(this.interval);
    if (this.timeout !== null) this.timers.clearTimeout(this.timeout);
    this.interval = null;
    this.timeout = null;
  }
}

/** Margin past the tumble length before the timer backstop ends a 3D-owned run (frames paused, e.g. a hidden tab). */
export const BLOCK_TUMBLE_3D_BACKSTOP_MARGIN_MS = 150;

/**
 * Hand a running tumble to the 3D row: the row spins exactly the run's tumbling dice (a rerolled die that lands on its
 * old face still spins; kept dice never do), and the run stays the chooser gate until the row settles (onSettled ->
 * stop) or, without frames, until the timer backstop. Returns false when there was no run to hand off.
 */
export function handBlockTumbleTo3d(
  run: BlockTumbleRun,
  row: { play(results: readonly number[], durationMs: number, changedIndices?: readonly number[]): void },
  results: readonly number[],
  durationMs: number,
): boolean {
  const frame = run.current;
  if (!frame) return false;
  const tumbling = [...frame.tumbling];
  run.handOff(durationMs + BLOCK_TUMBLE_3D_BACKSTOP_MARGIN_MS);
  row.play(results, durationMs, tumbling);
  return true;
}
