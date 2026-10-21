/** The injury pill's copy (the token-bound toast below the injured player, SpectateView `.ko-toast`). Pure: every word
 *  comes from the server's injury / apothecary reports as the store's InjuryEvent carries them - never recomputed
 *  from dice. Owner 10-20: the pill IS the injury result on the pitch (no injury dice there); an injury roll of 10+
 *  names the casualty itself. (An apothecary's outcome is NOT on the pill: the fix-up toast replaces the pill.) */

const DEAD_BASE = 0x08;

/** Owner 2026-07-08 / 10-05: a casualty names the injury from the server's result string ("Seriously Hurt (MNG)",
 *  "Serious Injury (NI)", "Smashed Knee (-MA)", "Dead (RIP)") as TWO centred lines - "<Player> is" / "<Casualty>".
 *  A plain Badly Hurt (no result string) reads "is Badly Hurt!". */
export function injuryPhraseLines(splash: { player: string; seriousInjury?: string | null; injuryBase: number }): [string, string] {
  const who = splash.player || 'The player';
  const s = (splash.seriousInjury ?? '').toLowerCase();
  if (s.includes('rip') || s.includes('dead') || s.includes('killed')) return [`${who} is`, 'KILLED!'];
  if (s.includes('knee')) return [`${who} has`, 'smashed their knee!'];
  if (s.includes('arm')) return [`${who} has`, 'broken their arm!'];
  if (s.includes('hip')) return [`Call Lifeline! ${who} has`, 'dislocated their hip!'];
  if (s.includes('shoulder')) return [`${who} has`, 'broken their shoulder!'];
  if (s.includes('head') || s.includes('eye') || s.includes('concussion') || s.includes('skull') || s.includes('neck'))
    return [`${who} receives a`, 'Head Injury!'];
  if (s.includes('niggling') || s.includes('(ni)')) return [`${who} receives a`, 'Niggling Injury!'];
  if (s.includes('seriously hurt') || s.includes('mng')) return [`${who} is`, 'Seriously Hurt!'];
  if (splash.injuryBase === DEAD_BASE) return [`${who} is`, 'KILLED!']; // DEAD state, no result string
  return [`${who} is`, 'Badly Hurt!']; // no lasting-injury string -> the coarse casualty
}

/** Owner 10-09: the stat a lasting injury cut, read from the server's own result string ("Smashed Knee (-MA)"). */
export function injuryStatTag(seriousInjury: string | null | undefined): string {
  const match = /\(\s*(-\s*(?:MA|ST|AG|PA|AV))\s*\)/i.exec(seriousInjury ?? '');
  return match ? `(${match[1]!.replace(/\s+/g, '').toUpperCase()})` : '';
}

/** The two casualty lines with the stat tag on the second ("smashed their knee! (-MA)"). */
export function casualtyPillLines(splash: { player: string; seriousInjury?: string | null; injuryBase: number }): [string, string] {
  const [lead, casualty] = injuryPhraseLines(splash);
  const tag = injuryStatTag(splash.seriousInjury);
  return [lead, tag ? `${casualty} ${tag}` : casualty];
}

/** Owner 10-20 (Astra P1-5): a Decay player's SECOND casualty, as the server reported it (`seriousInjuryDecay`, else the
 *  `injuryDecay` state), for its own line on the pill - "Decay: smashed their knee! (-MA)". Null when there is none or
 *  it is not a casualty. Never derived from dice. */
export function decayPillLine(splash: { player: string; seriousInjuryDecay?: string | null; injuryDecay?: number | null }): string | null {
  const base = splash.injuryDecay ?? null;
  if (!splash.seriousInjuryDecay && (base === null || base < 0x06 || base > 0x08)) return null;
  const [, casualty] = injuryPhraseLines({ player: splash.player, seriousInjury: splash.seriousInjuryDecay ?? null, injuryBase: base ?? 0x07 });
  const tag = injuryStatTag(splash.seriousInjuryDecay);
  return `Decay: ${tag ? `${casualty} ${tag}` : casualty}`;
}
