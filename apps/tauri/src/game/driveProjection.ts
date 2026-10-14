import type { GameJson } from '@fumbbl40k/ffb-protocol';

export const DRIVE_PROVENANCES = ['snapshotEstimate', 'kickoff', 'setup'] as const;
export interface DriveProjection { offenseIsHome: boolean; provenance: (typeof DRIVE_PROVENANCES)[number] }

/**
 * Owner 10-13 ("the pitch flip should occur in spectator mode at the touchdown ... before setup occurs"): the next
 * drive is known once the server has finished the drive transition and entered the KICKING team's setup: turnMode
 * 'setup', setupOffense false and homePlaying = the kicking team, so the offence is the side NOT playing. Once the
 * receiving team sets up (setupOffense true) homePlaying moves back and forth (receiver, then the kicker places the
 * kick), so only the kicking-team half of the setup is read. Null when the model is not in that state.
 */
export function setupDriveOffenseIsHome(game: { turnMode?: unknown; setupOffense?: unknown; homePlaying?: unknown }): boolean | null {
  if (String(game.turnMode ?? '') !== 'setup' || game.setupOffense !== false || typeof game.homePlaying !== 'boolean') return null;
  return !game.homePlaying;
}

/**
 * When the setup state above is SETTLED (Astra P2, 10-13). Upstream bb2025 StepEndTurn sets turnMode SETUP and
 * setupOffense false (and the scorer as homePlaying) BEFORE it may suspend on Argue the Call / Bribe dialogs, and
 * those intermediate model changes reach the wire. The step's completing pass then emits the `turnEnd` report and, at
 * a half end, StateMechanic.startHalf assigns the new half's kicker - both in that one pass, so in one frame. Hence:
 *  - a received frame adopts the setup reading only when it carries the `turnEnd` report (the completing frame; the
 *    touchdown one is the frame store.ts holds behind the scorer's walk). A setup frame without it never turns the
 *    drive (a pending transition, or the later frames of the kicking team's setup).
 *  - a frame carrying the `receiveChoice` report adopts it too (the overtime coin toss after a tied half two names
 *    the real kicker after startHalf's parity one; that turnEnd + startHalf(3) frame is provisional, see below).
 *  - a seed (join snapshot, reconnect seed, replay seek seed: no previous projection, no reports) adopts it only
 *    with no dialog pending: every suspension of that transition waits on a server dialog (dialogParameter set),
 *    while the settled kicking-team setup waits on the coach's setup with none. Otherwise the estimate below stands
 *    and the next drive's turnEnd (or the kick-off) corrects it.
 */
function setupReadingSettled(previous: DriveProjection | null, reports: readonly Record<string, unknown>[], game: GameJson): boolean {
  // Astra P2 (10-13, overtime): the receive choice is the server's own answer to who kicks. StepReceiveChoice sets
  // homePlaying = the kicking team and setupOffense false and emits `receiveChoice` (no turnEnd) - after a tied half
  // two, that frame is still in the setup the half end entered, and it can overrule startHalf's parity kicker.
  if (reports.some((r) => String(r.reportId ?? '') === 'receiveChoice')) return true;
  if (reports.some((r) => String(r.reportId ?? '') === 'turnEnd')) {
    // The completing frame of a tied half two carries startHalf(3) and only a PARITY kicker: StepEndTurn queues the
    // overtime kick-off with a fresh coin toss and receive choice, which settles the drive instead. A touchdown inside
    // overtime has no startHalf report and settles on its own frame as usual.
    return !reports.some((r) => String(r.reportId ?? '') === 'startHalf' && Number(r.half) > 2);
  }
  return !previous && reports.length === 0 && game.dialogParameter == null;
}

export function reduceDriveProjection(previous: DriveProjection | null, reports: readonly Record<string, unknown>[], game: GameJson): DriveProjection {
  const setupOffense = setupDriveOffenseIsHome(game);
  if (setupOffense !== null && setupReadingSettled(previous, reports, game)) {
    return previous?.provenance === 'setup' && previous.offenseIsHome === setupOffense
      ? previous : { offenseIsHome: setupOffense, provenance: 'setup' };
  }
  const scatter = reports.find((r) => r.reportId === 'kickoffScatter');
  // A drive already read from its setup is the server's own kicking team: the kick-off never turns it again (a short
  // or out-of-bounds kick lands on the kicking side yet the receiving team is unchanged).
  if (previous?.provenance !== 'setup' && Array.isArray(scatter?.ballCoordinateEnd) && typeof scatter.ballCoordinateEnd[0] === 'number' && Number.isFinite(scatter.ballCoordinateEnd[0])) {
    return { offenseIsHome: scatter.ballCoordinateEnd[0] <= 12, provenance: 'kickoff' };
  }
  if (previous) return previous;
  const fm = game.fieldModel;
  const ball = fm.ballCoordinate;
  if (fm.ballInPlay && !fm.ballMoving && Array.isArray(ball)) {
    const carrier = fm.playerDataArray.find((p) => p.playerCoordinate?.[0] === ball[0] && p.playerCoordinate?.[1] === ball[1]);
    if (carrier) return { offenseIsHome: game.teamHome.playerArray.some((p) => p.playerId === carrier.playerId), provenance: 'snapshotEstimate' };
  }
  return { offenseIsHome: Number(game.half ?? 1) === 2 ? !game.homeFirstOffense : !!game.homeFirstOffense, provenance: 'snapshotEstimate' };
}
