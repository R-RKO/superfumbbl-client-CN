/**
 * Owner 10-21: the movement-remaining badge (assets/decorations/move-remaining, art 12..0) worn at the top-right of
 * the acting player's activation decoration and on each planned-path step. Pure rules, no Pixi.
 *
 * remaining = max(0, MA - normal moves used this activation). Rushes are never counted: once the normal allowance is
 * spent the badge stays at 0 (currentMove can exceed MA by the rushes taken - still 0). A value above the art's top
 * (12) clamps to the 12 badge; a missing or invalid value draws no badge, never a misleading number.
 */

/** The highest value the art carries (move-remaining-12.png). */
export const MOVE_BADGE_MAX = 12;

/** Normal movement left: `ma` (the effective allowance) less `currentMove` (normal squares used), floored at 0.
 *  Null when either input is not a finite number or MA is negative. */
export function moveRemaining(ma: unknown, currentMove: unknown): number | null {
  const allowance = typeof ma === 'number' ? ma : Number.NaN;
  if (!Number.isFinite(allowance) || allowance < 0) return null;
  const used = currentMove == null ? 0 : typeof currentMove === 'number' ? currentMove : Number.NaN;
  if (!Number.isFinite(used)) return null;
  return Math.max(0, Math.floor(allowance) - Math.max(0, Math.floor(used)));
}

/** The art index (0..12) for a remaining value; null = draw no badge. */
export function moveBadgeIndex(remaining: number | null | undefined): number | null {
  if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return null;
  return Math.min(MOVE_BADGE_MAX, Math.max(0, Math.floor(remaining)));
}

/** Server PlayerAction wire names whose activation may move (upstream PlayerAction.isMoving(), plus the later phases
 *  of the same activation that keep the decoration up: a blitz after its block, the selecting phases, the pass /
 *  hand-off / foul / gaze / team-mate throw / punt stage after the walk). Pure block, multiple block, stand up,
 *  stab, chainsaw, vomit, breathe fire, chomp, bombs, keg and the like never move and wear no badge. */
export const MOVE_BADGE_ACTIONS: ReadonlySet<string> = new Set([
  'move',
  'blitz', 'blitzMove', 'blitzSelect', 'standUpBlitz', 'kickEmBlitz', 'putridRegurgitationBlitz', 'putridRegurgitationMove',
  'foul', 'foulMove',
  'gaze', 'gazeMove', 'gazeSelect',
  'pass', 'passMove', 'hailMaryPass',
  'handOver', 'handOverMove',
  'throwTeamMate', 'throwTeamMateMove',
  'kickTeamMate', 'kickTeamMateMove',
  'secureTheBall',
  'punt', 'puntMove',
]);

/** Whether a declared action's decoration carries the movement-remaining badge. */
export function activationShowsMoveBadge(playerAction: string | null | undefined): boolean {
  return typeof playerAction === 'string' && MOVE_BADGE_ACTIONS.has(playerAction);
}


/** Owner 10-21 (Astra P2): the badge's NORMAL movement left from server-derived inputs only. `ma` = the effective MA
 *  (null / invalid -> null: no badge; never the planner's MA-6 fallback nor its MA-9 cap). `down` = still prone /
 *  stunned in the model: the ordinary stand-up costs min(3, MA) (upstream MINIMUM_MOVE_TO_STAND_UP), a free stand
 *  (Jump Up, canStandUpForFree) costs nothing; once stood the server's currentMove already carries the cost, so it is
 *  never charged twice. `onTheBall` = a kick-off return / pass block window: its own fixed allowance of 3. */
export function moveBadgeNormalLeft(
  ma: number | null | undefined,
  currentMove: unknown,
  opts: { down?: boolean; standsForFree?: boolean; onTheBall?: boolean } = {},
): number | null {
  if (typeof ma !== 'number' || !Number.isFinite(ma) || ma < 0) return null;
  const allowance = Math.floor(ma);
  if (opts.onTheBall) return moveRemaining(3, currentMove);
  const standCost = opts.down && !opts.standsForFree ? Math.min(3, allowance) : 0;
  return moveRemaining(allowance - standCost, currentMove);
}

/** Owner 10-21: in the east-west view the badge moves to the side AWAY from an end zone when the player stands this
 *  many squares or fewer from it (counted in screen columns: the end-zone column itself is 0, so the end zone and the
 *  two squares in front of it). */
export const MOVE_BADGE_ENDZONE_MARGIN = 2;

/** Owner 10-21: which side of the feet the activation badge sits on, from the square AS DRAWN. Default right; the left
 *  half of the screen -> left; in the east-west view, within MOVE_BADGE_ENDZONE_MARGIN of an end zone -> the side
 *  opposite that end zone (wins over the half rule). Screen column = the projection's WIDTH axis (N-S: game y over
 *  15 columns; E-W: game x over 26), reversed when the field is flipped (spectator drive-north / pitch flip); the
 *  centre column of the odd N-S width counts as right. */
export function moveBadgeSide(square: readonly [number, number], orientation: 'ns' | 'ew', flipped = false): 'left' | 'right' {
  const cols = orientation === 'ns' ? 15 : 26;
  const raw = orientation === 'ns' ? square[1] : square[0];
  const w = flipped ? cols - 1 - raw : raw;
  if (orientation === 'ew') {
    if (w <= MOVE_BADGE_ENDZONE_MARGIN) return 'right'; // the left end zone is near: away from it
    if (w >= cols - 1 - MOVE_BADGE_ENDZONE_MARGIN) return 'left'; // the right end zone is near
  }
  return w < (cols - 1) / 2 ? 'left' : 'right';
}
