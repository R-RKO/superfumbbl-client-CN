/**
 * Owner 10-20: "The team captain roll currently surfaces between a roll and its rerolled result. Let's suppress that
 * result in both the log and on-field presentation events until the rerolled action is resolved."
 *
 * bb2025 RollMechanic.checkTeamCaptain reports `teamCaptainRoll` INSIDE a reroll use, before the rerolled roll, in the
 * same frame (useMascot: mascotUsed, teamCaptainRoll; useTeamReRoll: teamCaptainRoll, reRoll, [Loner reRoll]; then the
 * step's rerolled roll report). Recorded wire (g1953918 #717, g1951013 #1582 / #1406, g1953777 #1245, g1918820): the
 * rerolled result is always in that same frame, or (a failed Loner roll) there is none.
 *
 * This module only picks the anchor: the report after whose log rows the captain's rows are emitted. The formatter
 * still reads every report in server order (its latches advance exactly as before) and the FUMBBL / Classic log keeps
 * the captain's upstream lines at the wire position; only the Text / Graphical rows of the captain move.
 */

/** The reroll use chain the server reports between the captain roll and the rerolled roll. */
const USE_CHAIN_REPORTS = new Set(['reRoll', 'mascotUsed']);
/** Rerolled-roll reports whose id does not end in "Roll". */
const ROLL_REPORTS_WITHOUT_SUFFIX = new Set(['blockReRoll', 'breatheFire', 'projectileVomit', 'pickMeUp', 'throwAtStallingPlayer']);

function isRolledResult(id: string): boolean {
  return ROLL_REPORTS_WITHOUT_SUFFIX.has(id) || (/Roll$/.test(id) && !USE_CHAIN_REPORTS.has(id) && id !== 'teamCaptainRoll');
}

/**
 * For each `teamCaptainRoll` of the frame (its index), the index of the report its log rows follow:
 * - the rerolled roll (stepping over the use chain and the `block` header a block reroll resends first);
 * - with no rerolled roll in the frame (a failed Loner roll ends the use), the last report of the use chain.
 * A captain roll with nothing after it to wait for is not in the map (its rows stay where they are).
 * Pure and deterministic: the same reports always give the same anchors.
 */
export function teamCaptainRowAnchors(reports: readonly Record<string, unknown>[]): Map<number, number> {
  const anchors = new Map<number, number>();
  reports.forEach((report, index) => {
    if (String(report?.reportId ?? '') !== 'teamCaptainRoll') return;
    let anchor = index;
    for (let j = index + 1; j < reports.length; j++) {
      const id = String(reports[j]?.reportId ?? '');
      if (USE_CHAIN_REPORTS.has(id)) { anchor = j; continue; }
      if (id === 'block') continue; // the block header in front of the rerolled block dice
      if (isRolledResult(id)) anchor = j;
      break;
    }
    if (anchor > index) anchors.set(index, anchor);
  });
  return anchors;
}

/**
 * The emission queue a log builder runs while it walks a frame's reports: `defer` parks a captain's row emitter
 * behind its anchor, `before(index)` emits every parked row whose anchor is already behind `index` (call it first
 * thing for each report, before anything can `continue`), `end()` emits the rest when the frame's walk ends. Nothing
 * outlives the frame: the hold is bounded by the frame itself.
 */
export function createTeamCaptainRowQueue(reports: readonly Record<string, unknown>[]) {
  const anchors = teamCaptainRowAnchors(reports);
  const parked: { anchor: number; emit: () => void }[] = [];
  const flush = (upTo: number) => {
    while (parked.length && parked[0]!.anchor < upTo) parked.shift()!.emit();
  };
  return {
    /** The anchor of the captain roll at `index`, or null when its rows stay at the wire position. */
    anchorOf: (index: number): number | null => anchors.get(index) ?? null,
    defer: (index: number, emit: () => void): void => {
      const anchor = anchors.get(index);
      if (anchor === undefined) { emit(); return; }
      parked.push({ anchor, emit });
      parked.sort((a, b) => a.anchor - b.anchor);
    },
    before: (index: number): void => flush(index),
    end: (): void => flush(Number.POSITIVE_INFINITY),
  };
}

/**
 * Owner 10-20 (on-field half): "let's do a splash below the rerolled toast that indicates when team captain works."
 * The frame's KEPT team reroll: a `teamCaptainRoll` the server reports successful (a failed one gets no splash - the
 * log row says it). `rerolledBlock`: the anchor the log uses (teamCaptainRowAnchors) is a rerolled block roll, so the
 * splash waits for the block's chosen result; otherwise it follows the rerolled die (or the reroll use when nothing
 * was rerolled). Null when the frame keeps no reroll.
 */
export function teamCaptainKept(reports: readonly Record<string, unknown>[]): { teamId: string; rerolledBlock: boolean } | null {
  const index = reports.findIndex((r) => String(r?.reportId ?? '') === 'teamCaptainRoll' && r.successful === true);
  if (index < 0) return null;
  const teamId = String(reports[index]!.teamId ?? '');
  if (!teamId) return null;
  const anchor = teamCaptainRowAnchors(reports).get(index);
  const anchorId = anchor === undefined ? '' : String(reports[anchor]?.reportId ?? '');
  return { teamId, rerolledBlock: anchorId === 'blockRoll' || anchorId === 'blockReRoll' };
}
