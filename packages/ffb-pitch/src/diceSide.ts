import type { BlockDieSide } from './blockDieSurface';

/**
 * Owner 10-13 (home/away dice): which colour a rolled die wears. Ownership is the TEAM that owns the die (the acting /
 * rolling player's team for an action die, `blockRoll.choosingTeamId` for block dice), never the die's screen
 * position. The colour follows the DISPLAYED side, the same mapping the log names, chat toasts and auras use:
 *   playing  -> the local coach's own dice are home (blue), the opponent's away (red), whichever server seat they hold;
 *   spectating / replay -> the server's home team is blue, away red.
 * Unknown ownership is null: the caller draws the neutral face.
 */
export type ServerSide = 'home' | 'away';

interface TeamLike { teamId?: unknown; playerArray?: readonly { playerId?: unknown }[] }
interface GameLike { teamHome?: TeamLike | null; teamAway?: TeamLike | null }

/** Server side of the owning team -> displayed side. `viewerSeat` = the local coach's server seat while playing, null
 *  for spectators and replays (native home/away). */
export function displayDiceSide(owner: ServerSide | null | undefined, viewerSeat: ServerSide | null | undefined): BlockDieSide | null {
  if (owner !== 'home' && owner !== 'away') return null;
  if (viewerSeat !== 'home' && viewerSeat !== 'away') return owner;
  return owner === viewerSeat ? 'home' : 'away';
}

function teamIdOf(team: TeamLike | null | undefined): string | null {
  return typeof team?.teamId === 'string' && team.teamId.length > 0 ? team.teamId : null;
}

/** Exact team id -> server side; unknown or ambiguous ids are null. */
export function teamServerSide(game: GameLike | null | undefined, teamId: unknown): ServerSide | null {
  if (typeof teamId !== 'string' || teamId.length === 0) return null;
  const home = teamIdOf(game?.teamHome) === teamId;
  const away = teamIdOf(game?.teamAway) === teamId;
  return home === away ? null : home ? 'home' : 'away';
}

/** Player id -> the server side of the team that owns the player; unknown or ambiguous ids are null. */
export function playerServerSide(game: GameLike | null | undefined, playerId: unknown): ServerSide | null {
  if (typeof playerId !== 'string' || playerId.length === 0) return null;
  const home = !!game?.teamHome?.playerArray?.some((p) => p.playerId === playerId);
  const away = !!game?.teamAway?.playerArray?.some((p) => p.playerId === playerId);
  return home === away ? null : home ? 'home' : 'away';
}
