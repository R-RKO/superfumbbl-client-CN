import skillNames from '../assets/skillNames.json';
import { normalizeSkillName } from '@fumbbl40k/ffb-protocol';
import type { SkillConfigEntry } from './settings';

/**
 * The rows of Settings > Skill display > per-skill icons & markers, and the icon-setting lookup.
 *
 * Source of truth: assets/skillNames.json (every skill and trait the client has a badge for, spelled as the server
 * sends it; the asset creator's skill targets read the same file) plus Team Captain, which the roster sends as a
 * skill but which the asset creator never offered. A test pins the file against the badge index so a new badge
 * cannot go missing from the list again.
 *
 * Saved settings are never rewritten. Icon reads tolerate spelling differences in the saved key (see
 * resolveSkillConfigKey); marker settings and marking rules keep matching the exact wire spelling.
 */

/** Team Captain is a roster trait the server sends as a skill; it sits in the skill list, not under Traits. */
export const SKILL_CONFIG_EXTRA: readonly string[] = ['Team Captain'];
export const SKILL_CONFIG_AS_SKILL: ReadonlySet<string> = new Set(SKILL_CONFIG_EXTRA);

/** Star-player and special-rule traits: listed under their own "Star player traits" subheading after Traits. */
export const STAR_PLAYER_TRAITS: readonly string[] = [
  "\"Blastin' Solves Everything\"",
  "\"Excuse Me, Are You a Zoat?\"",
  "A Sneaky Pair",
  "All You Can Eat",
  "Baleful Hex",
  "Beer Barrel Bash!",
  "Black Ink",
  "Blast It!",
  "Blind Rage",
  "Bounding Leap",
  "Bugman's XXXXXX",
  "Catch of the Day",
  "Consummate Professional",
  "Crushing Blow",
  "Dwarfen Grit",
  "Dwarven Scourge",
  "Frenzied Rush",
  "Furious Outburst",
  "Fury of the Blood God",
  "Gored By The Bull",
  "Halfling Luck",
  "I'll be back!",
  "I'll Carry You",
  "Incorporeal",
  "Indomitable",
  "Kaboom!",
  "Keen Player",
  "Kick 'em while they're down!",
  "Krump and Smash",
  "Look Into My Eyes",
  "Lord of Chaos",
  "Master Assassin",
  "Maximum Carnage",
  "Mesmerising Dance",
  "Old Pro",
  "Primal Savagery",
  "Pump Up The Crowd",
  "Putrid Regurgitation",
  "Quick Bite",
  "Raiding Party",
  "Ram",
  "Reliable",
  "Savage Blow",
  "Savage Mauling",
  "Shot to Nothing",
  "Slashing Nails",
  "Slayer",
  "Sneakiest of the Lot",
  "Star of the Show",
  "Strong Passing Game",
  "Swift As The Breeze",
  "Tasty Morsel",
  "The Ballista",
  "The Flashing Blade",
  "Thinking Man's Troll",
  "Toxin Connoisseur",
  "Treacherous",
  "Unstoppable Momentum",
  "Vicious Vines",
  "Watch Out!",
  "Whirling Dervish",
  "Wisdom of the White Dwarf",
  "Woodland Fury",
  "Working in Tandem",
  "Yoink!",
];

export const SKILL_CONFIG_NAMES: readonly string[] = [...new Set([...(skillNames as string[]), ...SKILL_CONFIG_EXTRA])].sort((a, b) => a.localeCompare(b));

/** Keys that are not skill names (stat changes and the niggling injury); they are only ever matched exactly. */
function isExactOnlyKey(key: string): boolean {
  return /^[+-]/.test(key) || key === 'NI';
}

/** One key per skill, whatever the spelling: case, spaces and punctuation ignored, "&" read as "and". */
export function skillConfigKey(skill: string): string {
  return normalizeSkillName(String(skill).replace(/&/g, 'and'));
}

const STAR_KEYS: ReadonlySet<string> = new Set(STAR_PLAYER_TRAITS.map(skillConfigKey));
export function isStarPlayerTrait(skill: string): boolean {
  return STAR_KEYS.has(skillConfigKey(skill));
}

const NAME_BY_KEY: ReadonlyMap<string, string> = new Map(SKILL_CONFIG_NAMES.map((name) => [skillConfigKey(name), name] as const));

/**
 * Which saved key decides a skill's ICON behaviour. One rule, used for every icon read and for the Settings row writes:
 *   1. the skill's exact name, if saved;
 *   2. else a saved key that normalises to the same skill ("Side Step" / "Sidestep", "Timmm-Ber!" / "Timmm-ber!"):
 *      the row's own spelling first, then the first in sorted key order.
 * Nothing saved is ever renamed, merged or moved. Markers do not use this: they match the exact wire spelling.
 */
export function resolveSkillConfigKey(config: Record<string, SkillConfigEntry>, skill: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(config, skill)) return skill;
  if (isExactOnlyKey(skill)) return undefined;
  const key = skillConfigKey(skill);
  const matches = Object.keys(config).filter((stored) => !isExactOnlyKey(stored) && skillConfigKey(stored) === key).sort();
  if (!matches.length) return undefined;
  const own = NAME_BY_KEY.get(key);
  return own !== undefined && matches.includes(own) ? own : matches[0];
}

export function skillConfigEntryFor(config: Record<string, SkillConfigEntry>, skill: string): SkillConfigEntry | undefined {
  const key = resolveSkillConfigKey(config, skill);
  return key === undefined ? undefined : config[key];
}

/** The key a Settings row writes its icon change to: where its read currently resolves, else the row's own name. */
export function iconWriteKey(config: Record<string, SkillConfigEntry>, row: string): string {
  return resolveSkillConfigKey(config, row) ?? row;
}
