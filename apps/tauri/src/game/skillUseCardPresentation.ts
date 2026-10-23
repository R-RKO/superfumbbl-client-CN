import { prettySkillName } from './logic/prettySkillName';
import { t } from '../i18n';

export interface PassSkillUseCardInput {
  label?: string;
  roll?: number;
  result?: string;
  needed?: number;
}

export interface HmpScatterSkillUseCardInput {
  label?: string;
  hmpScatter?: {
    ordinal: number;
    direction: string;
    showNeverUse: boolean;
  };
}

/** The Savage Mauling election is delivered in the same sync as the injury
 * report. Project the server's final PlayerState result; never recompute it
 * from the dice or from a later field-model update. */
/** Injury result names by casualty base 4..8; the spectator checkpoint validator reads this list. */
export const INJURY_RESULT_NAMES = ['Stun', 'KO', 'Badly Hurt', 'Serious Injury', 'Death'] as const;
export type InjuryResultName = (typeof INJURY_RESULT_NAMES)[number];
export function savageMaulingInjuryResult(
  reports: readonly Record<string, unknown>[],
  playerId: string,
): InjuryResultName | undefined {
  const report = reports.find((candidate) => candidate.reportId === 'injury'
    && String(candidate.attackerId ?? '') === playerId);
  const injury = typeof report?.injury === 'number' ? report.injury & 0xff : -1;
  return injury >= 4 && injury <= 8 ? INJURY_RESULT_NAMES[injury - 4] : undefined;
}

/** Old Pro's skill-use prompt shares a frame with the chainsaw injury report.
 * Preserve the two authoritative armour dice so the coach can judge the
 * single-die reroll; malformed or unrelated reports stay fail-soft. */
export function oldProArmorDice(
  reports: readonly Record<string, unknown>[],
  playerId: string,
  skill: string,
): [number, number] | undefined {
  if (skill.toLowerCase().replace(/[^a-z]/g, '') !== 'oldpro') return undefined;
  const report = reports.find((candidate) => candidate.reportId === 'injury'
    && String(candidate.attackerId ?? '') === playerId);
  const dice = report?.armorRoll;
  if (!Array.isArray(dice) || dice.length !== 2
      || !dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6)) return undefined;
  return [Number(dice[0]), Number(dice[1])];
}

/** Exact copy projection from server-reported Pass roll fields. Missing or
 *  unexpected fields fall back to the generic skill-use card. */
export function passSkillUseCardCopy(input: PassSkillUseCardInput | null | undefined): {
  title: string; // i18n 10-23: localised 'Use Pass?'
  rollLine: string;
  needLine: string;
} | null {
  if (input?.label !== 'Pass') return null;
  if (!Number.isInteger(input.roll) || input.roll! < 1 || input.roll! > 6) return null;
  if (input.result !== 'Inaccurate'
    && input.result !== 'Wildly Inaccurate'
    && input.result !== 'Fumble') return null;
  if (!Number.isInteger(input.needed) || input.needed! < 2 || input.needed! > 6) return null;
  return {
    get title() { return t('dialogs.skillUse.text.usePass'); },
    rollLine: t('dialogs.skillUse.text.rolledRollResult', { roll: input.roll, result: input.result }),
    needLine: t('dialogs.skillUse.text.needNeeded', { needed: input.needed }),
  };
}

/** S40: a skillUse dialog with a modifying skill is the official three-way choice (DialogSkillUse.create):
 *  "Use <skill> or <modifyingSkill>?". The modified result is the server's own modifiedPassResult, in the
 *  result-name format of the pass card; absent when the report did not ride the dialog's frame. */
export function modifyingSkillCardCopy(
  input: { label?: string; modifyingSkill?: string; modifiedResult?: string } | null | undefined,
): { title: string; modifierLabel: string; resultLine: string | null } | null {
  const raw = input?.modifyingSkill?.trim();
  if (!input || !raw) return null;
  const modifierLabel = prettySkillName(raw);
  return {
    get title() { return t('dialogs.skillUse.text.useP0OrModifierlabel', { p0: input.label ?? 'the skill', modifierLabel }); },
    modifierLabel,
    resultLine: input.modifiedResult ? `${modifierLabel}: ${input.modifiedResult}` : null,
  };
}

/** Blast It! is offered once for each of Hail Mary Pass's three scatter rolls.
 * Keep the prompt self-describing from the server's own dialog flag and report;
 * malformed/non-HMP skill cards deliberately retain the generic presentation. */
export function hmpScatterSkillUseCardCopy(input: HmpScatterSkillUseCardInput | null | undefined): {
  title: string;
  contextLine: string;
} | null {
  if (input?.label !== 'Blast It!') return null;
  const scatter = input.hmpScatter;
  if (!scatter || !Number.isInteger(scatter.ordinal) || scatter.ordinal < 1 || scatter.ordinal > 3) return null;
  if (!scatter.direction.trim()) return null;
  return {
    title: scatter.showNeverUse
      ? t('dialogs.skillUse.text.useBlastItTo')
      : t('dialogs.skillUse.text.rerollThisScatter'),
    contextLine: t('dialogs.skillUse.text.scatterOrdinalOf3', { ordinal: scatter.ordinal, direction: scatter.direction }),
  };
}
