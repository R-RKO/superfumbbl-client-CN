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
