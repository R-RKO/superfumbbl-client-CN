import { PlayerStateBase } from '@fumbbl40k/ffb-pitch';

/** Owner 10-18 ("Can we make sure injuries below Serious Injury do not persist on this screen? Seriously Hurt and Badly
 *  Hurt should only be present when it's an active condition."): the player card's ⚕ line.
 *
 *  `lastingInjuries` is the roster's injury list as the server sent it (SeriousInjury names: BB2020/25 "Seriously Hurt
 *  (MNG)", "Serious Injury (NI)", "Smashed Knee (-MA)", "Dead (RIP)"; BB2016 "Broken Ribs (MNG)", "Smashed Knee (NI)"
 *  ...). A "(MNG)" / Badly Hurt / Dead entry in it is HISTORY - an outcome of an earlier game, not a state the player is
 *  in now (a Reserves player with "Seriously Hurt (MNG)" on his card read as hurt; owner 07-08 already hid those strings
 *  for a player on the pitch). Those never show here any more. The player's CURRENT condition comes from this game's
 *  player result (`seriousInjury`), shown only while his state is a casualty (BADLY_HURT / SERIOUS_INJURY / RIP), so an
 *  apothecary's reversal or a Regeneration drops it with the state (Astra 10-18: base 7 covers Seriously Hurt, NI and
 *  the stat losses alike, so the state alone cannot pick which history entry is "active"). Permanent history (Niggling
 *  "(NI)") always shows; a historical stat loss never does (it renders as a red stat). */
const CASUALTY_BASES: ReadonlySet<number> = new Set([PlayerStateBase.BADLY_HURT, PlayerStateBase.SERIOUS_INJURY, PlayerStateBase.RIP]);
const TRANSIENT = /\(mng\)|\(rip\)|badly hurt|seriously hurt|\bdead\b|killed/i;
const STAT_LOSS = /\(-(MA|ST|AG|PA|AV)\)/;

export function cardInjuryLines(lastingInjuries: readonly string[], base: number | null, currentInjury: string | null | undefined): string[] {
  const out = lastingInjuries.filter((injury) => !STAT_LOSS.test(injury) && !TRANSIENT.test(injury));
  const current = typeof currentInjury === 'string' ? currentInjury.trim() : '';
  if (current && base !== null && CASUALTY_BASES.has(base) && !out.includes(current)) out.push(current);
  return out;
}
