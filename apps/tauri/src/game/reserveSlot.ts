import type { GameJson } from '@fumbbl40k/ffb-protocol';

/**
 * Reserve-box slot for a CLIENT_SETUP_PLAYER that pulls one of our players back to the dugout.
 *
 * Upstream contract (FFB FieldCoordinate / UtilBox / BoxComponent, Garcangel 2026-10-26 on game 1957304 command 51):
 *  - a box coordinate is `[boxX, slot]` with slot in 0..29 (`BoxComponent.MAX_BOX_ELEMENTS = 30`); the Java client
 *    draws slots 0..29 only, so a slot of -1 leaves the player invisible until `UtilBox.refreshBoxes` renumbers;
 *  - the sender always uses the HOME-side x (`RSV_HOME_X = -1`); `UtilServerSetup.setupPlayer` transforms the away
 *    coach's coordinate to the away box (`RSV_AWAY_X = 30`) itself, so the MODEL holds our reserves at -1 (home) or
 *    30 (away) while the wire from either seat carries -1;
 *  - the server refuses a slot another player already holds (it re-sends both positions instead of moving), so the
 *    free slot is read from the model on OUR side's x, plus the slots claimed earlier in the same frame.
 */
export const RESERVE_BOX_WIRE_X = -1;
export const RESERVE_BOX_HOME_X = -1;
export const RESERVE_BOX_AWAY_X = 30;
export const RESERVE_BOX_SLOTS = 30;

/** The x the MODEL stores our reserves at: -1 when we are the home coach, 30 when away (null: side unknown). */
export function reserveBoxModelX(g: GameJson | null | undefined, myTeamId: string | null | undefined): number | null {
  if (!g || !myTeamId) return null;
  if (String(g.teamHome?.teamId ?? '') === myTeamId) return RESERVE_BOX_HOME_X;
  if (String(g.teamAway?.teamId ?? '') === myTeamId) return RESERVE_BOX_AWAY_X;
  return null;
}

/**
 * The first free reserve slot (0..29) on our side, skipping `claimed` slots from earlier sends this frame. Returns the
 * wire coordinate `[-1, slot]`. A side we cannot place (unknown team) counts BOTH boxes as occupied so the slot is
 * still never shared with a player the model shows. When every slot is taken the last slot (29) is returned: still a
 * legal box coordinate the Java client draws, and the server will re-send positions rather than lose the player.
 */
export function freeReserveWireCoordinate(
  g: GameJson | null | undefined, myTeamId: string | null | undefined, claimed: ReadonlySet<number>,
): [number, number] {
  const sideX = reserveBoxModelX(g, myTeamId);
  const occupied = new Set<number>();
  for (const d of (g?.fieldModel?.playerDataArray ?? []) as { playerCoordinate?: [number, number] | null }[]) {
    const c = d.playerCoordinate;
    if (!Array.isArray(c)) continue;
    const inOurBox = sideX === null ? c[0] === RESERVE_BOX_HOME_X || c[0] === RESERVE_BOX_AWAY_X : c[0] === sideX;
    if (inOurBox) occupied.add(c[1]);
  }
  for (let slot = 0; slot < RESERVE_BOX_SLOTS; slot++) {
    if (!occupied.has(slot) && !claimed.has(slot)) return [RESERVE_BOX_WIRE_X, slot];
  }
  return [RESERVE_BOX_WIRE_X, RESERVE_BOX_SLOTS - 1];
}
