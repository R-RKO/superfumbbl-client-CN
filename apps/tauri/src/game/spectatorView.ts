/**
 * Owner 10-11 (Kildash bug report): which end each team is drawn at while SPECTATING or REVIEWING a game.
 *
 * The automatic field flip the store feeds the renderer (`state.fieldFlip.flip`, the spectator checkpoint's
 * `fieldFlip`) is `true` when the AWAY team should be drawn defending the bottom (ns) / left (ew) end. The renderer
 * mirrors the pitch on it, and the coach's own 180 degree view flip (`settings.pitchFlipped`, when present) is XORed
 * on top inside the renderer. This module only decides that automatic value; play mode never consults it (the local
 * coach is presented at the bottom and the flip stays false there).
 *
 *  - `drive` (default): follow the drive, the offence attacks up the screen (flip = !offenseIsHome) - the
 *    behaviour before this setting existed, byte for byte.
 *  - `home`: the home team always at the bottom (flip = false).
 *  - `away`: the away team always at the bottom (flip = true).
 *  - `mine`: the viewer's own team at the bottom when the viewer coached one of the two teams; a game the viewer was
 *    not in follows the drive.
 */
export type SpectatorView = 'drive' | 'home' | 'away' | 'mine';
export const SPECTATOR_VIEWS: readonly SpectatorView[] = ['drive', 'home', 'away', 'mine'];
export const DEFAULT_SPECTATOR_VIEW: SpectatorView = 'drive';

/** A stored value the Settings select cannot produce (missing, corrupt, a future option) reads as the default. */
export function normalizeSpectatorView(value: unknown): SpectatorView {
  return SPECTATOR_VIEWS.includes(value as SpectatorView) ? value as SpectatorView : DEFAULT_SPECTATOR_VIEW;
}

/** The viewer's coach name on the server being watched: the same identity the Discord presence uses for "my team"
 *  (App.vue presenceSpec: fork target = coach40k, otherwise the FUMBBL coach name). */
export function viewerCoachName(s: { activeServerTarget: string; coach: string; coach40k: string }): string {
  return s.activeServerTarget === 'fork' ? s.coach40k : s.coach;
}

/** Which side the viewer coached, by coach name trimmed and case-folded (the rule `myPlayTeam` in store.ts and
 *  `presenceFor` in discordPresence.ts use). Null when the name is empty or matches neither team. */
export function viewerSide(
  teams: { teamHome?: { coach?: unknown } | null; teamAway?: { coach?: unknown } | null } | null | undefined,
  coach: string,
): 'home' | 'away' | null {
  const me = coach.trim().toLowerCase();
  if (!me || !teams) return null;
  const norm = (team: { coach?: unknown } | null | undefined) => String(team?.coach ?? '').trim().toLowerCase();
  if (norm(teams.teamHome) === me) return 'home';
  if (norm(teams.teamAway) === me) return 'away';
  return null;
}

/** The flip a choice fixes for the whole game without knowing the drive: 'home', 'away', or 'mine' when the viewer
 *  coached one of the teams. Null when the drive decides ('drive', or 'mine' for a game the viewer was not in). */
export function spectatorFixedFlip(view: SpectatorView, side: 'home' | 'away' | null): boolean | null {
  switch (view) {
    case 'home': return false;
    case 'away': return true;
    case 'mine': return side ? side === 'away' : null;
    default: return null;
  }
}

/** The automatic (spectator / replay / review) field flip for a view choice. */
export function spectatorFieldFlip(view: SpectatorView, offenseIsHome: boolean, side: 'home' | 'away' | null): boolean {
  return spectatorFixedFlip(view, side) ?? !offenseIsHome;
}
