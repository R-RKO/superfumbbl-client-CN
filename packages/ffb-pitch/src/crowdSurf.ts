/**
 * Owner 10-13 ("The player token for a surfed player is staying on the pitch it leaves the square on. It should be
 * visibly pushed off the pitch into the outside."): where a crowd-pushed player is DRAWN once he leaves the pitch.
 *
 * The server sends no off-pitch square for a crowd push (g1951682 #2631: `fieldModelRemovePlayer` + a `pushback`
 * report; the injury report and the dugout box follow in #2633), so the client derives the presentation square:
 * one step from his last pitch square in the push direction (pusher -> pushed). When that step stays on the pitch
 * (a chain push, or no pusher known), the nearest edge's outward neighbour is used. Presentation only.
 */
export const PITCH_COLUMNS = 26;
export const PITCH_ROW_COUNT = 15;

type Sq = readonly [number, number];

function onPitch(x: number, y: number): boolean {
  return x >= 0 && x < PITCH_COLUMNS && y >= 0 && y < PITCH_ROW_COUNT;
}

/** The off-pitch square one step beyond `from` (an edge square). Null when `from` is not a pitch square. */
export function surfLandingSquare(from: readonly number[] | null | undefined, pusher?: readonly number[] | null): [number, number] | null {
  if (!from || !onPitch(from[0]!, from[1]!)) return null;
  const [x, y] = [from[0]!, from[1]!];
  if (pusher && onPitch(pusher[0]!, pusher[1]!)) {
    const dx = Math.sign(x - pusher[0]!), dy = Math.sign(y - pusher[1]!);
    const step: [number, number] = [x + dx, y + dy];
    if ((dx !== 0 || dy !== 0) && Math.max(Math.abs(x - pusher[0]!), Math.abs(y - pusher[1]!)) === 1 && !onPitch(step[0], step[1])) return step;
  }
  const dTop = y, dBottom = PITCH_ROW_COUNT - 1 - y, dLeft = x, dRight = PITCH_COLUMNS - 1 - x;
  const nearest = Math.min(dTop, dBottom, dLeft, dRight);
  // sidelines first on a corner: the long stands are where the crowd is
  if (nearest === dTop) return [x, -1];
  if (nearest === dBottom) return [x, PITCH_ROW_COUNT];
  if (nearest === dLeft) return [-1, y];
  return [PITCH_COLUMNS, y];
}

/** The outward unit step of an off-pitch landing square (where the stand is, seen from the pitch). */
export function surfOutward(landing: Sq): [number, number] {
  return [landing[0] < 0 ? -1 : landing[0] >= PITCH_COLUMNS ? 1 : 0, landing[1] < 0 ? -1 : landing[1] >= PITCH_ROW_COUNT ? 1 : 0];
}

/** Is `square` a valid surf landing: off the pitch, one step from a pitch square. */
export function isSurfLanding(square: readonly number[] | null | undefined): square is [number, number] {
  if (!square || square.length < 2) return false;
  const [x, y] = [square[0]!, square[1]!];
  if (onPitch(x, y)) return false;
  return x >= -1 && x <= PITCH_COLUMNS && y >= -1 && y <= PITCH_ROW_COUNT;
}

function wireSquare(value: unknown): [number, number] | null {
  return Array.isArray(value) && value.length >= 2 && Number.isInteger(value[0]) && Number.isInteger(value[1]) ? [value[0] as number, value[1] as number] : null;
}

/** Owner 10-20 (Astra P2-3): a square in the crowd a SERVER report names for a thrown / swooping player - off the pitch
 *  and at most CROWD_SQUARE_REACH squares beyond it (a Swoop's distance roll is one d6 from a pitch square; ReportSwoopPlayer
 *  keeps the full endpoint). A crowd push's surf landing (one step out) is one too. */
export const CROWD_SQUARE_REACH = 6;
export function isCrowdSquare(square: readonly number[] | null | undefined): square is [number, number] {
  if (!square || square.length < 2 || !Number.isInteger(square[0]) || !Number.isInteger(square[1])) return false;
  const [x, y] = [square[0]!, square[1]!];
  if (onPitch(x, y)) return false;
  return x >= -CROWD_SQUARE_REACH && x < PITCH_COLUMNS + CROWD_SQUARE_REACH && y >= -CROWD_SQUARE_REACH && y < PITCH_ROW_COUNT + CROWD_SQUARE_REACH;
}

/**
 * Owner 10-20 ("We're not surfacing to the user that the player is thrown out of bounds. Let's change the animation to
 * end at the last scatter square, even if it's off-pitch."): the off-pitch square a thrown / kicked / swooping player
 * leaves the pitch onto, AS THE SERVER'S OWN REPORT SENDS IT. The flight's wire animation ends on the last IN-BOUNDS
 * square (`lastValid`: upstream bb2025 StepInitScatterPlayer `scatterResult.getLastValidCoordinate()`); the report says
 * where he actually went:
 *  - `scatterPlayer` (ReportScatterPlayer): its endCoordinate - the scatter stops on the first square off the pitch, so
 *    it must be one step from `lastValid` (g1954978 #1440: [7,13] -> [8,15], animation end [9,14]);
 *  - `swoopPlayer` with outOfBounds (ReportSwoopPlayer, StepInitScatterPlayer.swoop): its endCoordinate as sent - the
 *    full distance roll along the swoop line, possibly several squares beyond the edge (Astra P2-3: never a square of
 *    our own inference). `swoop` = the swoopPlayer report of an earlier frame of the same throw (the Swoop Distance
 *    reroll offer sits between the roll and the flight).
 * Anything else = null (the caller keeps its existing behaviour). Presentation only.
 */
export function thrownCrowdLanding(
  lastValid: readonly number[] | null | undefined,
  reports: readonly Record<string, unknown>[],
  swoop?: { start: readonly number[]; end: readonly number[]; outOfBounds: boolean } | null,
): [number, number] | null {
  if (!lastValid || !onPitch(lastValid[0]!, lastValid[1]!)) return null;
  const scatter = reports.find((report) => String(report.reportId) === 'scatterPlayer');
  if (scatter) {
    const end = wireSquare(scatter.endCoordinate);
    return end && isSurfLanding(end) && Math.max(Math.abs(end[0] - lastValid[0]!), Math.abs(end[1] - lastValid[1]!)) === 1 ? end : null;
  }
  const report = reports.find((candidate) => String(candidate.reportId) === 'swoopPlayer');
  const line = report
    ? { end: wireSquare(report.endCoordinate), outOfBounds: report.outOfBounds === true }
    : swoop ? { end: wireSquare(swoop.end), outOfBounds: swoop.outOfBounds === true } : null;
  return line?.outOfBounds && isCrowdSquare(line.end) ? line.end : null;
}
