import type { StatsMechanic } from '@fumbbl40k/ffb-protocol';

/**
 * How a characteristic is WRITTEN and whether a change to it is an IMPROVEMENT, by the game's ruleset
 * (statsMechanicFor(game), upstream StatsMechanic). Display only: no rules logic reads this (dodge / pass targets come
 * from the server).
 *
 *   BB2020 / BB2025 (mechanics/mixed): AG, PA and AV are roll targets, written "3+"; a LOWER AG / PA is the better
 *     one; a player without a passing characteristic shows "–".
 *   BB2016 (mechanics/bb2016): plain numbers (statSuffix ""), a HIGHER AG is the better one, and there is no PA at all
 *     (drawPassing false).
 */
export type DisplayStat = 'MA' | 'ST' | 'AG' | 'PA' | 'AV';

const NONE = '–';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** The characteristics a card lists for this ruleset, in order (BB2016 has no PA). */
export function displayedStats(mechanic: StatsMechanic): DisplayStat[] {
  return mechanic.drawPassing ? ['MA', 'ST', 'AG', 'PA', 'AV'] : ['MA', 'ST', 'AG', 'AV'];
}

/** A characteristic as the card writes it. A missing value is "–"; PA 0 is "no passing characteristic". */
export function formatStat(stat: DisplayStat, value: number | null | undefined, mechanic: StatsMechanic): string {
  if (value == null) return NONE;
  if (stat === 'MA' || stat === 'ST') return String(value);
  if (stat === 'PA' && (!mechanic.drawPassing || !value)) return NONE;
  return `${value}${mechanic.statSuffix}`;
}

/**
 * The NET difference between a player's stat and the position's, in steps, signed by the ruleset: positive = better,
 * negative = worse, 0 = the same. null = it cannot be told (no position stat, or no passing characteristic on either
 * side - a PA of 0 is "–", not a number to compare).
 */
export function statNet(stat: DisplayStat, current: number | null | undefined, base: number | null | undefined, mechanic: StatsMechanic): number | null {
  if (!finite(current) || !finite(base)) return null;
  if (stat === 'PA') return mechanic.drawPassing && current !== 0 && base !== 0 ? base - current : null;
  if (stat === 'AG') return mechanic.improvementIncreasesValue ? current - base : base - current;
  return current - base;
}

export interface StatFlags { reduced: boolean; increased: boolean }

/**
 * The card's colouring for one characteristic: red (reduced) when the net is worse, green (increased) when better,
 * neither when equal - never both. A stat can be improved by an advancement AND reduced by an injury; the net decides.
 * When the net says nothing (equal, or unknown), a lasting injury that names the stat still reads red unless an
 * advancement of that stat ("+AG" in the server's skill list) is what cancelled it.
 */
export function statFlags(
  stat: DisplayStat,
  current: number | null | undefined,
  base: number | null | undefined,
  mechanic: StatsMechanic,
  injured: boolean,
  advanced: boolean,
): StatFlags {
  const net = statNet(stat, current, base, mechanic);
  if (net !== null && net > 0) return { reduced: false, increased: true };
  if (net !== null && net < 0) return { reduced: true, increased: false };
  return { reduced: injured && !advanced, increased: false };
}

export interface CardStat extends StatFlags { label: DisplayStat; value: string }

interface StatLine { movement?: number | null; strength?: number | null; agility?: number | null; passing?: number | null; armour?: number | null }

/**
 * The player card's statline. `effective` carries the stats after temporary modifiers (Greasy Cleats' -1 MA, Iron
 * Man's +1 AV): they are what the card shows and what the net is taken from.
 */
export function cardStatLine(
  player: StatLine & { lastingInjuries?: readonly unknown[] | null; skillArray?: readonly unknown[] | null },
  position: StatLine | null | undefined,
  mechanic: StatsMechanic,
  effective: { MA?: number; AV?: number } = {},
): CardStat[] {
  const current: Record<DisplayStat, number | null | undefined> = {
    MA: effective.MA ?? player.movement, ST: player.strength, AG: player.agility, PA: player.passing, AV: effective.AV ?? player.armour,
  };
  const base: Record<DisplayStat, number | null | undefined> = {
    MA: position?.movement, ST: position?.strength, AG: position?.agility, PA: position?.passing, AV: position?.armour,
  };
  // a lasting injury naming the stat, or a temporary modifier holding it under the player's own value
  const permanent: Partial<Record<DisplayStat, number | null | undefined>> = { MA: player.movement, AV: player.armour };
  const injured = (stat: DisplayStat) => (player.lastingInjuries ?? []).some((injury) => String(injury).includes(`(-${stat})`))
    || (finite(current[stat]) && finite(permanent[stat]) && current[stat]! < permanent[stat]!);
  const advanced = (stat: DisplayStat) => (player.skillArray ?? []).some((skill) => String(skill).trim().toUpperCase() === `+${stat}`);
  return displayedStats(mechanic).map((stat) => ({
    label: stat,
    value: formatStat(stat, current[stat], mechanic),
    ...statFlags(stat, current[stat], base[stat], mechanic, injured(stat), advanced(stat)),
  }));
}

/** A roster POSITION's statline (inducement cards): no comparison, the ruleset's writing only. */
export function positionStatLine(position: StatLine, mechanic: StatsMechanic): { k: DisplayStat; v: string }[] {
  const value: Record<DisplayStat, number | null | undefined> = {
    MA: position.movement, ST: position.strength, AG: position.agility, PA: position.passing, AV: position.armour,
  };
  return displayedStats(mechanic).map((stat) => ({ k: stat, v: formatStat(stat, value[stat], mechanic) }));
}
