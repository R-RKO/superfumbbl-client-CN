/** Owner 10-15 (poordecision report): the combined Disturbing Presence modifier on the pass / catch / interception roll
 *  tags. Rolled dice take the count from the server's report: bb2025 passRoll / catchRoll / interceptionRoll carry
 *  `rollModifiers` names, and the Disturbing Presence entry is exactly one of "1 Disturbing Presence" or
 *  "<n> Disturbing Presences" (n = 2..11) [ffb-common modifiers/PassModifierCollection.java, CatchModifierCollection.java,
 *  InterceptionModifierCollection.java; GenerifiedModifierFactory picks the single entry whose multiplier equals
 *  UtilDisturbingPresence.findOpposingDisturbingPresences]. Wire sample (Nurgle game, 09-25):
 *  `"rollModifiers":["1 Tacklezone","2 Disturbing Presences"]`. Nothing is recomputed for a rolled die. */
const DP_MODIFIER = /^\s*(\d+)\s+Disturbing\s+Presences?\s*$/i;

/** The Disturbing Presence count the server applied to a roll (0 when its modifiers carry none or are malformed). */
export function disturbingPresenceFromRollModifiers(modifiers: unknown): number {
  if (!Array.isArray(modifiers)) return 0;
  let total = 0;
  for (const modifier of modifiers) {
    if (typeof modifier !== 'string') continue;
    const match = DP_MODIFIER.exec(modifier);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isInteger(n) && n > 0) total += n;
  }
  return total;
}

/** The tag text for a combined Disturbing Presence modifier, "DP −2" (U+2212 minus, as the aura's "−N" chip); null
 *  when there is nothing to show. */
export function disturbingPresenceTagText(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0) return null;
  return `DP −${count}`;
}
