/**
 * Controller support P2b (owner rounds 2-3): per-card pad rules that are data, not layout.
 *  - Reroll card: a focused LIST of the server's options, Team Reroll first (and focused); Y = the single skill
 *    reroll when exactly one is offered.
 *  - Raise the Dead: A = Zombie, X = Skeleton (by the server's position label).
 */
export interface PadRerollOption { source: string }

/** The team-pool sources (everything else on the card is a skill / modifier option). */
export const TEAM_REROLL_SOURCES: ReadonlySet<string> = new Set(['Team ReRoll', 'Mascot TRR', 'Team Mascot']);

/** Team Reroll first, every other option in the server's order. */
export function padRerollOrder<T extends PadRerollOption>(options: readonly T[]): T[] {
  const team = options.filter((o) => o.source === 'Team ReRoll');
  return [...team, ...options.filter((o) => o.source !== 'Team ReRoll')];
}

/** The source Y takes: the only skill reroll offered, else null. */
export function padRerollYSource(options: readonly PadRerollOption[]): string | null {
  const skills = options.filter((o) => !TEAM_REROLL_SOURCES.has(o.source));
  return skills.length === 1 ? skills[0]!.source : null;
}

/** Raise the Dead position pick: which pad button a position answers to. */
export function raiseDeadPadKey(label: string): 'A' | 'X' | null {
  if (/zombie/i.test(label)) return 'A';
  if (/skeleton/i.test(label)) return 'X';
  return null;
}
