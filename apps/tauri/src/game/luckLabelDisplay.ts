import { t } from '../i18n';

/**
 * i18n 10-23 (Astra r1 #1): the Luck statistics keep their outcome / attack labels as invariant English DATA
 * (diceStats parses `rec.outcome` to score the result, and the labels are stored with each break). These helpers
 * localise them at the LAST render step only. Unknown text renders unchanged.
 */
const OUTCOME_KEYS: Readonly<Record<string, string>> = {
  'Stun': 'luck.outcome.stun',
  'KO': 'luck.outcome.ko',
  'Casualty': 'luck.outcome.casualty',
  'Crowd surf stun': 'luck.outcome.crowdSurfStun',
  'Crowd surf ko': 'luck.outcome.crowdSurfKo',
  'Crowd surf casualty': 'luck.outcome.crowdSurfCasualty',
  'Nothing (no knock-down)': 'luck.outcome.nothing',
  'Armour held': 'luck.outcome.armourHeld',
  'Steady Footing': 'luck.outcome.steadyFooting',
};

export function luckOutcomeDisplay(outcome: string): string {
  const key = OUTCOME_KEYS[outcome];
  return key ? t(key) : outcome;
}

export function luckAttackDisplay(label: string): string {
  const uphill = /^(\d+)-die uphill block \(−(\d+)\)$/.exec(label);
  if (uphill) return t('luck.attack.uphillBlock', { n: Number(uphill[1]) });
  const block = /^(\d+)-die block$/.exec(label);
  if (block) return t('luck.attack.block', { n: Number(block[1]) });
  if (label === 'chainsaw') return t('luck.attack.chainsaw');
  return label;
}

/** `labelHead` ("Stun on 2-die block vs " / "Stun on ") in the active locale. */
export function luckHeadDisplay(head: string): string {
  const m = /^(.*?) on (?:(.*) vs )?$/.exec(head);
  if (!m) return head;
  const outcome = luckOutcomeDisplay(m[1]!);
  return m[2] === undefined ? t('luck.headFall', { outcome }) : t('luck.head', { outcome, label: luckAttackDisplay(m[2]) });
}

/** `labelTail` ("'s own 2-die block" / "") in the active locale. */
export function luckTailDisplay(tail: string): string {
  const m = /^'s own (.*)$/.exec(tail);
  return m ? t('luck.tailFall', { label: luckAttackDisplay(m[1]!) }) : tail;
}
