import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { turnSideIsHome } from './blastinSecondBeat';

/** Durable board/coach-panel facts. No receive trackers, effects or renderer sequence numbers. */
export interface BoardProjection {
  playingIsHome: boolean | null;
  sawActiveBit: boolean;
  turnKey: string;
  activePlayerId: string | null;
  actedPlayers: string[];
}
export function createBoardProjection(): BoardProjection {
  return { playingIsHome: null, sawActiveBit: false, turnKey: '', activePlayerId: null, actedPlayers: [] };
}
/** Turn modes the server enters INSIDE a coach's activation and leaves again with the same acting player (the blitz
 *  target pick: regular -> selectBlitzTarget -> regular). They are not a turn boundary: Elyod 10-16 (1.0.228, three
 *  reports) could not End a blitz after its block because the flip back to regular had nulled the receive-time
 *  acting mirror and marked the actor cleared (the P0 #2 boundary reset), so the cancel was refused as "nothing
 *  declared"; a Jump toggle (a fresh declaration echo) un-wedged it. */
/** Owner 10-16 (regression sweep): every mode the fork server enters INSIDE a coach's turn and leaves again
 *  (setTurnMode(getLastTurnMode()) in StepSelectBlitzTarget / StepSelectGazeTarget / StepLookIntoMyEyes /
 *  StepInitBlocking (selectBlockKind) / StepRaidingParty / StepHitAndRun / StepThenIStartedBlastin / StepPlaceBall
 *  (safePairOfHands), and the passing / bomb / wizard / trickster / illegal-substitution sub-modes the behaviours set
 *  and their end steps restore). None of them is a team turn; the side / turn numbers in the key still are. */
const MID_ACTIVATION_SUB_MODES: Record<string, string> = Object.fromEntries(['selectBlitzTarget', 'selectGazeTarget', 'selectBlockKind',
  'raidingParty', 'hitAndRun', 'thenIStartedBlastin', 'safePairOfHands', 'trickster', 'dumpOff', 'interception', 'bombHome', 'bombAway',
  'bombHomeBlitz', 'bombAwayBlitz', 'wizard', 'illegalSubstitution'].map((mode) => [mode, 'regular']));
export const MID_ACTIVATION_TURN_MODES: ReadonlySet<string> = new Set(Object.keys(MID_ACTIVATION_SUB_MODES));
export function boardTurnKey(g: GameJson): string {
  const mode = MID_ACTIVATION_SUB_MODES[String(g.turnMode)] ?? g.turnMode;
  return `${mode}:${turnSideIsHome(g)}:${g.turnDataHome?.turnNr}:${g.turnDataAway?.turnNr}`; // S46: the Blastin' second-beat flip is not a turn change
}
export function reduceBoardProjection(previous: BoardProjection, game: GameJson, input: {
  recoveringPlayers: readonly string[];
  reports: readonly Record<string, unknown>[];
  /** Player-seat acknowledgement policy; spectator/replay readers pass the cursor's acting id. */
  acknowledgedActingId: string | null;
  followupAttackerId: string | null;
}): BoardProjection {
  const rawHome = turnSideIsHome(game);
  const playingIsHome = previous.playingIsHome === null || game.turnMode !== 'betweenTurns'
    ? rawHome : previous.playingIsHome;
  const players = game.fieldModel.playerDataArray;
  const homeIds = new Set(game.teamHome.playerArray.map((p) => p.playerId));
  const movingId = players.find((p) => (p.playerState & 0xff) === 2)?.playerId ?? null;
  const activeBitId = players.find((p) => (p.playerState & 0x100) !== 0 && homeIds.has(p.playerId) === rawHome)?.playerId ?? null;
  const activeByState = input.acknowledgedActingId ?? movingId;
  const sawActiveBit = previous.sawActiveBit || !!activeBitId || !!activeByState;
  const acting = game.actingPlayer?.playerId ?? null;
  const notation = input.reports.map((r) => r.actingPlayerId ?? r.playerId ?? r.defenderId).find((id): id is string => typeof id === 'string') ?? null;
  const over = game.turnMode === 'endGame' || !!game.finished
    || !!game.gameResult?.teamResultHome?.conceded || !!game.gameResult?.teamResultAway?.conceded;
  let activePlayerId = over ? null : sawActiveBit ? activeByState : activeByState ?? acting ?? notation;
  if (!over && acting && input.followupAttackerId === acting) activePlayerId = acting;
  const turnKey = boardTurnKey(game);
  if (turnKey !== previous.turnKey) activePlayerId = null;
  const actedPlayers = over ? [] : players.filter((p) => {
    if (p.playerId === activePlayerId || (p.playerState & 0x100) !== 0 || homeIds.has(p.playerId) !== playingIsHome) return false;
    const base = p.playerState & 0xff;
    if (base !== 1 && !(base === 3 && !input.recoveringPlayers.includes(p.playerId))) return false;
    const c = p.playerCoordinate;
    return !!c && c[0] >= 0 && c[0] <= 25 && c[1] >= 0 && c[1] <= 14;
  }).map((p) => p.playerId);
  return { playingIsHome, sawActiveBit, turnKey, activePlayerId, actedPlayers };
}
