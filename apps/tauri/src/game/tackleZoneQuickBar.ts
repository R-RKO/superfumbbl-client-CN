import type { AppSettings } from './settings';

/** Owner 10-12: the spectate / replay tackle-zone choices, in quick-bar cycle order (none -> home -> away -> all). */
export const SPECTATOR_TACKLE_ZONE_MODES = ['none', 'home', 'away', 'all'] as const;
export type SpectatorTackleZoneMode = (typeof SPECTATOR_TACKLE_ZONE_MODES)[number];

/**
 * Owner 10-12: the quick-bar Tackle zones button. Play cycles the seat-relative modes (opposition / friendly / both /
 * off, settings.tackleZoneMode, unchanged). Spectate and replay cycle absolute teams (none -> home -> away -> all,
 * settings.spectatorTackleZoneMode), drawn whoever's turn it is.
 */
export const SPECTATOR_TZ_LABELS: Record<SpectatorTackleZoneMode, string> = { none: 'None', home: 'Home', away: 'Away', all: 'All' };

/** Spectate and replay (every mode but play) use the spectator set. */
export function usesSpectatorTackleZones(viewMode: 'spectate' | 'play' | 'replay'): boolean {
  return viewMode !== 'play';
}

/** The next spectator mode in the cycle, from the stored one (an unknown value restarts at the first). */
export function nextSpectatorTackleZoneMode(mode: string): SpectatorTackleZoneMode {
  const modes = SPECTATOR_TACKLE_ZONE_MODES;
  return modes[(modes.indexOf(mode as SpectatorTackleZoneMode) + 1) % modes.length]!;
}

/** The button's title / popped tooltip for the spectator set. */
export function spectatorTackleZoneTitle(mode: string): string {
  return `Tackle zones: ${SPECTATOR_TZ_LABELS[mode as SpectatorTackleZoneMode] ?? SPECTATOR_TZ_LABELS.none}`;
}

/** What the renderer draws for spectators: 'none' in play, so play's zones stay on the o66OppTzActive path alone. */
export function rendererSpectatorTackleZoneMode(viewMode: 'spectate' | 'play' | 'replay', s: Pick<AppSettings, 'spectatorTackleZoneMode'>): SpectatorTackleZoneMode {
  return usesSpectatorTackleZones(viewMode) ? s.spectatorTackleZoneMode : 'none';
}
