import { playerHasSkill, type GameJson } from '@fumbbl40k/ffb-protocol';

const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function prayerName(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const prayer = value as { name?: unknown; prayer?: unknown; prayerName?: unknown };
  return String(prayer.name ?? prayer.prayer ?? prayer.prayerName ?? '');
}

function hasMoles(game: GameJson, home: boolean): boolean {
  const prayers = (home ? game.turnDataHome : game.turnDataAway)?.inducementSet?.prayers ?? [];
  return prayers.some((prayer) => normalize(prayerName(prayer)) === 'molesunderthepitch');
}

/**
 * Presentation projection of the authoritative BB2025 Rush (Go For It) target.
 *
 * Server-provided `minimumRollGfi` values remain preferable wherever they exist. This
 * function covers client-plotted/reachable steps for which no per-square server value
 * is available. Rules mirrored (ffb-common):
 *  - base 2+, minimum 2, no upper clamp: DiceInterpreter.minimumRollGoingForIt = max(2, 2 + sum of modifiers)
 *  - Blizzard +1: bb2025/GoForItModifierCollection.java:13-18 (weather BLIZZARD; the setGfiRollToFive
 *    exclusion there is only ever set by the BB2016 Greased Shoes card, so it cannot occur in BB2025)
 *  - Moles under the Pitch +1: same file :20-26 (an OPPOSING team has the prayer)
 *  - Drunkard +1: skill/mixed/Drunkard.java:17 (the rushing player has the trait, incl. temporary skills)
 * All three are separate modifiers and stack.
 * Server GoForItModifier users checked: bb2025 collection (Blizzard, Moles), Drunkard, bb2016 Cards (Greased Shoes, not BB2025).
 * SwiftAsTheBreeze only registers canChooseToIgnoreRushModifierAfterRoll, a post-roll choice, not a target modifier.
 */
export function rushTargetForPlayer(game: GameJson | null | undefined, playerId: string | null | undefined): number {
  if (!game) return 2;

  const id = String(playerId ?? '');
  const home = game.teamHome.playerArray.find((player) => String(player.playerId) === id);
  const away = home ? undefined : game.teamAway.playerArray.find((player) => String(player.playerId) === id);
  const player = home ?? away;
  const blizzard = normalize(game.fieldModel.weather) === 'blizzard';
  const opposingMoles = home ? hasMoles(game, false) : away ? hasMoles(game, true) : false;
  const drunkard = player ? playerHasSkill(player as never, 'Drunkard') : false;

  return Math.max(2, 2 + Number(blizzard) + Number(opposingMoles) + Number(drunkard));
}
