import type { InducementSetJson, TurnDataJson } from '@fumbbl40k/ffb-protocol';
import { t, terms } from '../../i18n';

/**
 * Coach-panel resource chip: one icon per remaining charge-family (re-rolls,
 * apothecaries, purchased inducements/prayers/cards). Owner ruling 2026-08-17:
 * a used inducement DISAPPEARS from the panel — every count here must come
 * from a field the server actively decrements, never a purchase-time snapshot.
 */
export interface InducementChip {
  icon: string;
  count: number;
  label: string;
  pool?: 'base' | 'drive' | 'single-use';
  badge?: string;
}

type CoachPanelTurnData = Pick<TurnDataJson, 'reRolls' | 'apothecaries' | 'inducementSet'> & {
  wanderingApothecaries?: unknown;
  rerollBrilliantCoachingOneDrive?: unknown;
  rerollPumpUpTheCrowdOneDrive?: unknown;
  rerollShowStarOneDrive?: unknown;
  singleUseReRolls?: unknown;
};

function remaining(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Resource icons for coach-panel inducement charges. This begins with upstream
 * slot-icon parity and includes owner-supplied client art for additional types. */
const INDUCEMENT_ICONS: Record<string, string> = {
  bribes: 'bribe',
  prayers: 'prayer',
  wizard: 'wizard',
  masterChef: 'master_chef',
  halflingMasterChef: 'master_chef',
  bloodweiserKegs: 'bloodweiser_keg',
  bloodweiserBabes: 'bloodweiser_keg',
  bugmansXXXXXX: 'bloodweiser_keg',
  biasedRef: 'biased_ref',
  igor: 'igor',
  igors: 'igor',
  mortuaryAssistant: 'mortuary_assistant',
  plagueDoctor: 'plague_doctor',
  wanderingApothecaries: 'wandering_apothecary',
  weatherMage: 'weather_mage',
  dwarfenWisdom: 'dwarfen_wisdom',
  teamMascot: 'team_mascot',
  briberyAndCorruption: 're_roll_argue',
};

/**
 * Bug (owner screenshot 2026-08-17): `wanderingApothecaries` is bought as a
 * regular inducementSet entry (`inducementSetAddInducement`), but the server
 * NEVER sends a matching inducementSet uses-decrement when one is consumed —
 * consumption rides `turnDataSetApothecaries`/`turnDataSetWanderingApothecaries`
 * on TurnData instead (server log game_861, frame commandNr 444: `{"modelChangeId":
 * "turnDataSetWanderingApothecaries","modelChangeKey":"home","modelChangeValue":1},
 * {"modelChangeId":"turnDataSetApothecaries","modelChangeKey":"home","modelChangeValue":1}`,
 * no inducementSet change in the same frame). So the purchase-time
 * inducementArray entry's `value - uses` is a frozen snapshot for this one
 * type; it must be overridden with the live turnData.wanderingApothecaries
 * count (and dropped once that hits zero) instead of trusted as-is.
 */
/** sv398 10-18: the chip's hover text showed the wire key ("briberyAndCorruption"). The known inducements by name; an
 *  unknown key reads as its words ("someNewThing" -> "Some New Thing"), never the raw key. */
const INDUCEMENT_CHIP_LABELS: Readonly<Record<string, string>> = {
  briberyAndCorruption: 'Bribery and Corruption', bribes: 'Bribes', halflingMasterChef: 'Halfling Master Chef',
  wanderingApothecaries: 'Wandering Apothecary', biasedRef: 'Biased Referee', teamMascot: 'Team Mascot',
  partTimeCoach: 'Part-time Assistant Coaches', tempCheerleader: 'Temp Agency Cheerleaders', weatherMage: 'Weather Mage',
  wizard: 'Wizard', bloodweiserBabes: 'Bloodweiser Kegs', bugmansXXXXXX: "Bugman's XXXXXX", josefBugman: 'Josef Bugman',
  mortuaryAssistant: 'Mortuary Assistant', plagueDoctor: 'Plague Doctor', riotousRookies: 'Riotous Rookies',
  throwARock: 'Throw a Rock', dwarfenWisdom: 'Wisdom of the White Dwarf', infamousStaff: 'Infamous Coaching Staff',
  extraTeamTraining: 'Extra Team Training', starPlayers: 'Star Players', mercenaries: 'Mercenaries', card: 'Cards', prayers: 'Prayers',
};
export function inducementChipLabel(type: string): string {
  const known = INDUCEMENT_CHIP_LABELS[type];
  if (known) return known;
  const words = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : type;
}
export function buildInducementChips(turnData: CoachPanelTurnData): InducementChip[] {
  // `reRolls` is the server's aggregate team-reroll total: each drive-scoped
  // grant increments it as well as its source counter, and consumption/expiry
  // decrements both. Subtract the source counters so the ordinary chip remains
  // the purchased/base pool instead of double-counting the temporary chips.
  const drivePools = [
    { count: remaining(turnData.rerollBrilliantCoachingOneDrive), badge: 'BC', source: 'Brilliant Coaching' },
    { count: remaining(turnData.rerollPumpUpTheCrowdOneDrive), badge: 'PU', source: 'Pump Up The Crowd' },
    { count: remaining(turnData.rerollShowStarOneDrive), badge: 'STAR', source: 'Star of the Show' },
  ];
  const driveTotal = drivePools.reduce((sum, pool) => sum + pool.count, 0);
  const chips: InducementChip[] = [{
    icon: 're_roll',
    count: Math.max(0, remaining(turnData.reRolls) - driveTotal),
    get label() { return t('hud.coachPanel.chips.baseTeamRerolls'); },
    pool: 'base',
  }];
  for (const pool of drivePools) {
    if (pool.count > 0) chips.push({
      icon: 're_roll',
      count: pool.count,
      get label() { return t('hud.coachPanel.text.sourceRerollExpiresAt', { source: terms(pool.source) }); },
      pool: 'drive',
      badge: pool.badge,
    });
  }
  const singleUse = remaining(turnData.singleUseReRolls);
  if (singleUse > 0) chips.push({
    icon: 're_roll',
    count: singleUse,
    get label() { return t('hud.coachPanel.text.singleUseRerolls'); },
    pool: 'single-use',
    badge: '1×',
  });
  if ((turnData.apothecaries ?? 0) > 0) chips.push({ icon: 'apothecary', count: turnData.apothecaries, get label() { return t('hud.coachPanel.text.apothecary'); } });

  const set = turnData.inducementSet as InducementSetJson;
  const byType = new Map<string, number>();
  for (const entry of set.inducementArray as { inducementType?: string; value?: number; uses?: number }[]) {
    const remaining = Math.max(0, (entry.value ?? 1) - (entry.uses ?? 0));
    if (remaining > 0) byType.set(entry.inducementType ?? 'card', (byType.get(entry.inducementType ?? 'card') ?? 0) + remaining);
  }

  if (byType.has('wanderingApothecaries')) {
    const live = typeof turnData.wanderingApothecaries === 'number'
      ? turnData.wanderingApothecaries
      : byType.get('wanderingApothecaries')!;
    if (live > 0) byType.set('wanderingApothecaries', live);
    else byType.delete('wanderingApothecaries');
  }

  for (const [type, count] of byType) {
    const icon = INDUCEMENT_ICONS[type];
    if (icon) chips.push({ icon, count, label: inducementChipLabel(type) }); // unmapped types have no coach-panel chip
  }
  if (set.prayers.length > 0) chips.push({ icon: 'prayer', count: set.prayers.length, get label() { return t('hud.coachPanel.text.prayers'); } });
  const cards = set.cardsAvailable.length + set.cardsActive.length;
  if (cards > 0) chips.push({ icon: 'card', count: cards, get label() { return t('hud.coachPanel.text.cards'); } });
  return chips;
}

/**
 * Owner 10-13 (`settings.hideZeroRerolls`): drop the BASE team-reroll chip when its count is 0. The temporary
 * pools (Brilliant Coaching / Pump Up / Star of the Show / single-use) are already only pushed above 0, so the base
 * chip is the only reroll chip that can read "0". Pure view filter: the count is re-derived from turn data on
 * every build, so the chip returns the moment the count is above 0 again (next half resets the Team Rerolls).
 */
export function hideZeroRerollChips(chips: InducementChip[], hide: boolean): InducementChip[] {
  if (!hide) return chips;
  return chips.filter((c) => !(c.icon === 're_roll' && c.count <= 0));
}

/** Icon key of the text-only Cheering Fans chip (no art; SpectateView renders "FANS +N" text for it). */
export const CHEERING_FANS_CHIP_ICON = 'cheering_fans';

/**
 * Pending BB2025 Cheering Fans block assist. Render only server state: the server sets
 * turnData.cheeringFansBlockAssist (turnDataSetCheeringFansBlockAssist) on the kickoff result and zeroes it when the
 * assist is consumed by the first block roll, so the chip is present exactly while the value is above 0.
 * Returns null otherwise (so replay seek/pause, which rebuild turnData, give the same answer).
 */
export function cheeringFansChip(turnData: object | null | undefined): InducementChip | null {
  const count = remaining((turnData as { cheeringFansBlockAssist?: unknown } | null | undefined)?.cheeringFansBlockAssist);
  if (count <= 0) return null;
  return {
    icon: CHEERING_FANS_CHIP_ICON,
    count,
    get label() { return t('hud.coachPanel.text.cheeringFansCountOffensive', { count }); },
  };
}
