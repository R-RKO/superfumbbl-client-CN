import { type GameJson } from '@fumbbl40k/ffb-protocol';
import { injuryTypeName } from './casualtyRollProjection';
import { turnSideIsHome } from './blastinSecondBeat';

const TURNOVER_FAIL_IDS = new Set(['dodgeRoll', 'goForItRoll', 'pickUpRoll', 'passRoll', 'catchRoll', 'leapRoll']);

export interface TurnPresentationContext {
  turnoverArmed: boolean;
  turnoverAfterInjury: boolean;
}

export interface TurnPresentationBefore {
  homePlaying: boolean;
  homeTurn: number;
  awayTurn: number;
  playingPlayerIds: string[];
}

/** Capture only the facts needed after publication; do not retain another model graph. */
export function captureTurnPresentationBefore(game: GameJson): TurnPresentationBefore {
  const side = turnSideIsHome(game) ? game.teamHome : game.teamAway;
  return {
    homePlaying: turnSideIsHome(game), // S46: the Blastin' second-beat flip is not a turn change
    homeTurn: Number(game.turnDataHome?.turnNr ?? 0),
    awayTurn: Number(game.turnDataAway?.turnNr ?? 0),
    playingPlayerIds: side.playerArray.map((player) => player.playerId),
  };
}

export const createTurnPresentationContext = (): TurnPresentationContext => ({
  turnoverArmed: false,
  turnoverAfterInjury: false,
});

export interface TurnTeamPresentation {
  side: 'home' | 'away';
  coach: string;
  teamName: string;
  logo: string | null;
}

export interface TurnPresentation {
  context: TurnPresentationContext;
  clearMoveTrail: boolean;
  splash: ({ kind: 'turnover'; afterInjury: boolean } | { kind: 'turnStart' }) & TurnTeamPresentation | null;
  toast: ({ turn: number; context: 'normal' | 'afterTurnover' } & TurnTeamPresentation) | null;
}

function teamPresentation(game: GameJson, side: 'home' | 'away'): TurnTeamPresentation {
  const team = side === 'home' ? game.teamHome : game.teamAway;
  return {
    side,
    coach: String(team.coach ?? ''),
    teamName: String(team.teamName ?? ''),
    logo: (team.roster as { logoUrl?: string } | undefined)?.logoUrl ?? null,
  };
}

/**
 * The turnover heuristic's per-report step - the ONE implementation (the live frame presenter, the review transport
 * and the spectator dice ledger all fold through turnoverArmStep below). FFB has no turnover flag on the wire
 * (ReportTurnEnd carries only playerIdTouchdown): a failing roll by the side whose turn it is ARMS, and the next
 * non-touchdown turnEnd in regular play fires. Only a roll owned by the playing side counts (owner 08-19) - opponent
 * reactions publish the same report ids; a successful opponent interception is the explicit exception.
 */
export function turnoverArmAfterReport(
  armed: boolean,
  report: Readonly<Record<string, unknown>>,
  playingPlayerIds: ReadonlySet<string>,
): boolean {
  const id = String(report.reportId ?? '');
  if (id === 'interceptionRoll') return report.successful === true ? true : armed;
  // Owner 09-06 (game 945): Swift as the Breeze turns a failed dodgeRoll into a success via the SAME-frame
  // `modifiedDodgeResultSuccessful` report (skill only, no playerId): the modification is the disarm.
  if (id === 'modifiedDodgeResultSuccessful') return false;
  // Owner 09-14 (g1942502): a SUCCESSFUL Steady Footing keeps the player on their feet (upstream bb2025
  // StepSteadyFooting publishes END_TURN=false, no armour / injury follows): it DISARMS the failed roll before it.
  // A failed one changes nothing here - the knockdown's injury report arms on its own.
  if (id === 'steadyFootingRoll') {
    const pid = String(report.playerId ?? '');
    return pid && playingPlayerIds.has(pid) && report.successful === true ? false : armed;
  }
  // Owner 09-19 (g1944287 seq 3552-3618): a catchRoll failed on a SCATTER is no turnover. A fresh activation by the
  // playing side (ReportPlayerAction) proves the turn did not end - a real turnover closes the turn first.
  if (id === 'playerAction') {
    const pid = String(report.actingPlayerId ?? report.playerId ?? '');
    return pid && playingPlayerIds.has(pid) ? false : armed;
  }
  if (!TURNOVER_FAIL_IDS.has(id)) return armed;
  const playerId = String(report.playerId ?? '');
  if (!playerId || !playingPlayerIds.has(playerId)) return armed;
  if (report.successful === false) return true;
  if (report.successful === true) return false;
  return armed;
}

/**
 * One command's reports through the heuristic, then the drive-boundary disarm. `playingPlayerIds` = the roster of the
 * side whose turn it was BEFORE the command. `knockedDown` names the playing-side player whose knockdown armed it in
 * this command (the live presenter logs it).
 *
 * Injury arming: a Knocked Down player always rolls Armour (an `injury` report); Wrestle places prone with none. A
 * crowd removal turns over through its own clause, a vampire's bite / a failed Right Stuff landing do not end the
 * turn, and a SAME-TEAM attacker knocking a team-mate down is no turnover (g868, bb2025 StepPushback:179-200).
 * `betweenTurns` is NOT a drive boundary - it is the transit mode of the server's own turn flip, which precedes the
 * turnEnd report (g868 nr144-148): only a real drive boundary (setup / kickoff / endGame ...) disarms.
 */
export function turnoverArmStep(
  previous: Readonly<TurnPresentationContext>,
  playingPlayerIds: ReadonlySet<string>,
  reports: readonly Readonly<Record<string, unknown>>[],
  turnModeAfter: unknown,
): { context: TurnPresentationContext; knockedDown: string | null } {
  const context: TurnPresentationContext = { ...previous };
  let knockedDown: string | null = null;
  for (const report of reports) {
    const id = String(report.reportId);
    if (id === 'injury') {
      const fallen = String(report.defenderId ?? report.playerId ?? '');
      const injuryType = injuryTypeName(report.injuryType).toLowerCase();
      const nonKnockdown = /crowd|bitten|quickbite|ttmlanding/.test(injuryType);
      const attacker = String(report.attackerId ?? '');
      const sameTeamBlock = !!attacker && playingPlayerIds.has(attacker);
      if (fallen && !nonKnockdown && !sameTeamBlock && playingPlayerIds.has(fallen)) {
        if (!context.turnoverArmed) knockedDown = fallen;
        context.turnoverArmed = true;
        context.turnoverAfterInjury = true;
      }
      continue;
    }
    context.turnoverArmed = turnoverArmAfterReport(context.turnoverArmed, report, playingPlayerIds);
    if (!context.turnoverArmed) context.turnoverAfterInjury = false;
  }
  const mode = String(turnModeAfter ?? '');
  if (mode !== 'regular' && mode !== 'betweenTurns') {
    context.turnoverArmed = false;
    context.turnoverAfterInjury = false;
  }
  return { context, knockedDown };
}
/** Does this command's turnEnd close the turn as a TURNOVER? (`context` = after turnoverArmStep for the command.) */
export function turnEndIsTurnover(context: Readonly<TurnPresentationContext>, turnEnd: Readonly<Record<string, unknown>>, turnModeAfter: unknown): boolean {
  return !turnEnd.playerIdTouchdown && context.turnoverArmed && String(turnModeAfter ?? '') === 'regular';
}

/**
 * Deterministic turn-boundary projection. Persist the returned context with the
 * cursor; a turnEnd can arrive several commands after the failure that armed it.
 */
export function turnPresentation(
  previous: Readonly<TurnPresentationContext>,
  before: Readonly<TurnPresentationBefore>,
  after: GameJson,
  reports: readonly Record<string, unknown>[],
): TurnPresentation {
  const endingSide: 'home' | 'away' = before.homePlaying ? 'home' : 'away';
  const incomingSide: 'home' | 'away' = endingSide === 'home' ? 'away' : 'home';
  const mode = String(after.turnMode ?? '');
  const { context } = turnoverArmStep(previous, new Set(before.playingPlayerIds), reports, mode);
  const turnEnd = reports.find((report) => String(report.reportId) === 'turnEnd');
  let splash: TurnPresentation['splash'] = null;
  let toast: TurnPresentation['toast'] = null;
  if (turnEnd) {
    if (turnEnd.playerIdTouchdown) {
      context.turnoverArmed = false;
      context.turnoverAfterInjury = false;
    } else if (context.turnoverArmed && mode === 'regular') {
      const afterInjury = context.turnoverAfterInjury;
      context.turnoverArmed = false;
      context.turnoverAfterInjury = false;
      const team = teamPresentation(after, endingSide);
      splash = { kind: 'turnover', afterInjury, ...team };
      const incoming = teamPresentation(after, incomingSide);
      const turn = Number((incomingSide === 'home' ? after.turnDataHome : after.turnDataAway)?.turnNr ?? 0);
      if (turn >= 1) toast = { ...incoming, turn, context: 'afterTurnover' };
    } else if (mode === 'regular') {
      const team = teamPresentation(after, incomingSide);
      splash = { kind: 'turnStart', ...team };
      const turn = Number((incomingSide === 'home' ? after.turnDataHome : after.turnDataAway)?.turnNr ?? 0);
      if (turn >= 1) toast = { ...team, turn, context: 'normal' };
    }
  } else if (mode === 'regular') {
    const side: 'home' | 'away' = turnSideIsHome(after) ? 'home' : 'away';
    const beforeTurn = side === 'home' ? before.homeTurn : before.awayTurn;
    const turn = Number((side === 'home' ? after.turnDataHome : after.turnDataAway)?.turnNr ?? 0);
    if (turn >= 1 && turn > beforeTurn) toast = { ...teamPresentation(after, side), turn, context: 'normal' };
  }

  return { context, clearMoveTrail: !!turnEnd, splash, toast };
}
