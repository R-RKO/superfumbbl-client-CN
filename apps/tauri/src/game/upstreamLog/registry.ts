import type { GameJson } from '@fumbbl40k/ffb-protocol';
import type { Report, UpstreamRules } from './model';
import type { UpstreamPrinter } from './printer';

/** One upstream ReportMessageBase.render, ported: it prints the report through the printer. */
export type UpstreamRenderer = (report: Report, out: UpstreamPrinter, game: GameJson | null) => void;

/** A renderer for both rulesets (upstream COMMON, or BB2020 + BB2025 "mixed"), or one per ruleset. */
export type UpstreamRendererSet = UpstreamRenderer | Partial<Record<UpstreamRules, UpstreamRenderer>>;

export function resolveRenderer(set: UpstreamRendererSet | undefined, rules: UpstreamRules): UpstreamRenderer | null {
  if (!set) return null;
  if (typeof set === 'function') return set;
  return set[rules] ?? null;
}

/** "Succeeded on a roll of N+" / "Roll a N+ to succeed" (null when the roll was rerolled, as upstream). */
export function neededRollText(report: Report, successful: boolean): string | null {
  if (report.reRolled === true) return null;
  const min = typeof report.minimumRoll === 'number' ? report.minimumRoll : 0;
  return successful ? `Succeeded on a roll of ${min}+` : `Roll a ${min}+ to succeed`;
}
