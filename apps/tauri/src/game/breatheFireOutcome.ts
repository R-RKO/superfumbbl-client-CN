/** Owner 10-10: a Breathe Fire 4+ was stamped as a failure. ReportBreatheFire's `successful` is true ONLY for the
 *  knock-down (StepBreatheFire: `successful = result == BreatheFireResult.KNOCK_DOWN`), so reading it as pass/fail
 *  marks "no effect" and "placed prone" rolls as failures. The report also carries the server's own result as
 *  `status` (BreatheFireResult name) - that is the outcome; only FAILURE (a 1, or an effective 1 against a strong
 *  opponent) is a failed roll. */
export type BreatheFireOutcome = 'failure' | 'noEffect' | 'prone' | 'knockDown';

const OUTCOME_BY_STATUS: Readonly<Record<string, BreatheFireOutcome>> = {
  FAILURE: 'failure', NO_EFFECT: 'noEffect', PRONE: 'prone', KNOCK_DOWN: 'knockDown',
};

/** The server's stated result, or null when the report does not carry one this client knows. */
export function breatheFireOutcome(report: Record<string, unknown>): BreatheFireOutcome | null {
  return typeof report.status === 'string' ? OUTCOME_BY_STATUS[report.status] ?? null : null;
}

/** Whether the roll passed its stated minimum (`minimumRoll` = the roll that avoids the turnover). The server's
 *  `status` decides; a report without one falls back to the roll against that minimum, and with neither the
 *  report's own `successful` stands. */
export function breatheFirePassed(report: Record<string, unknown>): boolean | null {
  const outcome = breatheFireOutcome(report);
  if (outcome) return outcome !== 'failure';
  const roll = Number(report.roll), minimum = Number(report.minimumRoll);
  if (Number.isInteger(roll) && roll >= 1 && roll <= 6 && Number.isInteger(minimum) && minimum >= 2 && minimum <= 6) {
    return roll !== 1 && roll >= minimum;
  }
  return typeof report.successful === 'boolean' ? report.successful : null;
}

/** Astra 10-10: the server offers a reroll on EVERY first Breathe Fire result short of the knock-down
 *  (StepBreatheFire: askForReRollIfAvailable in the `!successful` branch), so a roll that is NOT failed - "no effect",
 *  "placed prone" - can still be the subject of an open reroll offer. A rerolled result is never offered again. */
export function breatheFireRerollMayBeOfferedUnfailed(report: Record<string, unknown>): boolean {
  if (report.reRolled === true) return false;
  const outcome = breatheFireOutcome(report);
  if (outcome) return outcome === 'noEffect' || outcome === 'prone';
  return report.successful === false && breatheFirePassed(report) === true;
}

/** Is this reroll offer (the dialog's `reRolledAction`, upstream ReRolledActions.BREATHE_FIRE = "Breathe Fire") the
 *  Breathe Fire one? The prompt's own die is tied to that roll only through this. */
export function isBreatheFireReRollAction(reRolledAction: unknown): boolean {
  // Astra 10-10: some reroll actions arrive as a fully qualified skill class (the Pass wire does); match the last
  // dotted segment so such a form could not slip back to the ordinary prompt branch.
  const name = String(reRolledAction ?? '').split('.').pop() ?? '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '') === 'breathefire';
}
