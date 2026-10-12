import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { sppEarnedThisGame } from './sppEarned';

/** A player's SPP as the player card shows it: `total` = the server's PlayerResult.currentSpps (what they came into
 *  the game with), `earned` = this game's exact gain (the green "+N"). */
export interface PlayerSpp { total: number; earned: number }

/** SPP for a decision card, read from the live game exactly as the player card reads it. Null when the player has no
 *  PlayerResult (or no numeric currentSpps), so the card omits the line instead of printing a made-up zero. */
export function playerSppFor(game: GameJson, playerId: string): PlayerSpp | null {
  const teams = [
    { team: game.teamHome, results: game.gameResult?.teamResultHome?.playerResults },
    { team: game.teamAway, results: game.gameResult?.teamResultAway?.playerResults },
  ];
  for (const { team, results } of teams) {
    if (!team?.playerArray?.some((p) => p.playerId === playerId)) continue;
    const r = results?.find((x) => x.playerId === playerId) as unknown as Record<string, unknown> | undefined;
    if (!r) return null;
    const total = Number(r.currentSpps);
    if (r.currentSpps == null || !Number.isFinite(total)) return null;
    return { total, earned: sppEarnedThisGame(r, (team as { specialRules?: string[] }).specialRules) };
  }
  return null;
}
