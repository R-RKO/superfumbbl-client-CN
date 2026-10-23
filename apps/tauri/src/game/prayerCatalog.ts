import { $t } from '../i18n';
export interface PrayerCatalogEntry {
  roll: number;
  name: string;
  icon: string;
  animationType: string;
  text: (team: string) => string;
  /** Authoritative table effect. Player-changing prayers defer this line until the server names recipients. */
  effect: string;
  /** Exact ReportPlayerEvent suffix emitted by the upstream handler, when this prayer changes players. */
  playerEventMessage?: string;
  /** Effect is resolved only after a server dialog and a later authoritative playerEvent. */
  deferredEffect?: boolean;
  /** The prayer grants a later once-per-game use; resolution is announced from that later report. */
  laterInvocation?: boolean;
  /** Owner 09-08: short label for the coach-panel active-prayer tag when the full name runs long; log text keeps `name`. */
  tag?: string;
}

/** BB2025 Prayers to Nuffle D16 table, in authoritative roll order. */
export const PRAYER_TABLE: readonly PrayerCatalogEntry[] = [
  { roll: 1, name: 'Treacherous Trapdoor', tag: 'Trapdoor', icon: '🕳️', animationType: 'prayerTrapdoor', text: (t) => $t('hud.prayers.prayerTable.tPraysForA', { t }), get effect() { return $t('hud.prayers.prayerTable.trapdoorsAppearAPlayer'); } },
  { roll: 2, name: 'Friends with the Ref', icon: '🤝', animationType: 'friendsWithTheRef', text: (t) => $t('hud.prayers.prayerTable.tMakesFriendsWith', { t }), get effect() { return $t('hud.prayers.prayerTable.argueTheCallSucceeds'); } },
  { roll: 3, name: 'Stiletto', icon: '🗡️', animationType: 'stiletto', text: (t) => $t('hud.prayers.prayerTable.tPraysForA2', { t }), get effect() { return $t('hud.prayers.prayerTable.oneRandomAvailablePlayer'); }, playerEventMessage: 'gains Stab' },
  { roll: 4, name: 'Iron Man', icon: '🦾', animationType: 'ironMan', text: (t) => $t('hud.prayers.prayerTable.tPraysForIron', { t }), get effect() { return $t('hud.prayers.prayerTable.oneChosenAvailablePlayer'); }, playerEventMessage: 'gains 1 AV' },
  { roll: 5, name: 'Knuckle Dusters', icon: '👊', animationType: 'knuckleDusters', text: (t) => $t('hud.prayers.prayerTable.tPraysForKnuckle', { t }), get effect() { return $t('hud.prayers.prayerTable.oneChosenAvailablePlayer2'); }, playerEventMessage: 'gains Mighty Blow (+1)' },
  { roll: 6, name: 'Bad Habits', icon: '🚬', animationType: 'badhabits', text: (t) => $t('hud.prayers.prayerTable.tSSquadPicks', { t }), get effect() { return $t('hud.prayers.prayerTable.d3RandomOpposingPlayers'); }, playerEventMessage: 'gains Loner (2+)' },
  { roll: 7, name: 'Greasy Cleats', icon: '🥾', animationType: 'greasyCleats', text: (t) => $t('hud.prayers.prayerTable.tPraysForGreasy', { t }), get effect() { return $t('hud.prayers.prayerTable.oneRandomOpposingPlayer'); }, playerEventMessage: 'loses 1 MA' },
  { roll: 8, name: 'Blessing of Nuffle', icon: '🙏', animationType: 'blessedStatueOfNuffle', text: (t) => $t('hud.prayers.prayerTable.tReceivesTheBlessing', { t }), get effect() { return $t('hud.prayers.prayerTable.oneRandomAvailablePlayer2'); }, playerEventMessage: 'gains Pro' },
  { roll: 9, name: 'Moles under the Pitch', tag: 'Moles', icon: '🐁', animationType: 'molesUnderThePitch', text: (t) => $t('hud.prayers.prayerTable.tPraysForMoles', { t }), get effect() { return $t('hud.prayers.prayerTable.rushesByOpposingPlayers'); } },
  { roll: 10, name: 'Perfect Passing', icon: '🎯', animationType: 'perfectPassing', text: (t) => $t('hud.prayers.prayerTable.tPraysForPerfect', { t }), get effect() { return $t('hud.prayers.prayerTable.completionsGenerate2Spp'); } },
  { roll: 11, name: 'Dazzling Catching', icon: '🧤', animationType: 'dazzlingCatching', text: (t) => $t('hud.prayers.prayerTable.tPraysForDazzling', { t }), get effect() { return $t('hud.prayers.prayerTable.caughtPassesGenerate1'); } },
  { roll: 12, name: 'Fan Interaction', icon: '📣', animationType: 'fanInteraction', text: (t) => $t('hud.prayers.prayerTable.tWhipsUpA', { t }), get effect() { return $t('hud.prayers.prayerTable.crowdPushCasualtiesGenerate'); } },
  { roll: 13, name: 'Fouling Frenzy', icon: '🥊', animationType: 'foulingFrenzy', text: (t) => $t('hud.prayers.prayerTable.tPraysForA3', { t }), get effect() { return $t('hud.prayers.prayerTable.foulCasualtiesGenerate2'); } },
  { roll: 14, name: 'Throw a Rock', icon: '🪨', animationType: 'throwARockPrayer', text: (t) => $t('hud.prayers.prayerTable.tPraysToThrow', { t }), get effect() { return $t('hud.prayers.prayerTable.onceThisGameA'); }, laterInvocation: true },
  { roll: 15, name: 'Under Scrutiny', icon: '🔍', animationType: 'underScrutiny', text: (t) => $t('hud.prayers.prayerTable.tSStarComes', { t }), get effect() { return $t('hud.prayers.prayerTable.opposingFoulsAreAlways'); } },
  { roll: 16, name: 'Intensive Training', icon: '🏋️', animationType: 'intensiveTraining', text: (t) => $t('hud.prayers.prayerTable.tPraysForIntensive', { t }), get effect() { return $t('hud.prayers.prayerTable.oneRandomAvailablePlayer3'); }, deferredEffect: true },
] as const;

/** Owner 09-06: an ACTIVE prayer as the wire carries it in turnData.inducementSet.prayers (the upstream Prayer
 *  name, e.g. "friendsWithTheRef" / "Friends with the Ref", or an object carrying `name`) -> catalog entry. Matched
 *  on letters only against the animation id and the display name; null for anything unknown. */
export function prayerForWireValue(value: unknown): PrayerCatalogEntry | null {
  const raw = typeof value === 'string' ? value
    : value && typeof value === 'object' ? String((value as { name?: unknown; prayer?: unknown }).name ?? (value as { prayer?: unknown }).prayer ?? '') : '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return null;
  return PRAYER_TABLE.find((e) => e.animationType.toLowerCase().replace(/[^a-z]/g, '') === key
    || e.name.toLowerCase().replace(/[^a-z]/g, '') === key) ?? null;
}

export function prayerForRoll(value: unknown): PrayerCatalogEntry | null {
  const roll = Number(value);
  return Number.isInteger(roll) && roll >= 1 && roll <= PRAYER_TABLE.length
    ? PRAYER_TABLE[roll - 1] ?? null
    : null;
}

/** Resolve only exact upstream prayer-effect messages; generic playerEvent reports remain ordinary narrative. */
export function prayerForPlayerEventMessage(value: unknown): PrayerCatalogEntry | null {
  const message = String(value ?? '').trim();
  return PRAYER_TABLE.find((entry) => entry.playerEventMessage === message) ?? null;
}
