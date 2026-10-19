import type { PlayerJson, TeamJson } from '@fumbbl40k/ffb-protocol';
import { decodePlayerSkills, normalizeSkillName } from '@fumbbl40k/ffb-protocol';

/** Owner 10-18 ("Let's only display the [Hatred] icon if a player on the opposition team has the trait that the player
 *  has hatred for"): Hatred (upstream bb2025/Hatred.java) is valued by KEYWORD - the wire carries the hated keyword(s)
 *  as the skill's value ("undead", "orc", temporary grants as "Hatred_Orc"; several joined by ';', each mapped through
 *  Keyword.forName, case-insensitive). A position's `keywords` array lists the keywords its players carry. The icon is
 *  worth drawing only while someone on the OTHER team carries a hated keyword.
 *  Astra 10-18 r1: the base value falls back to the POSITION's (upstream RosterPlayer.java:211-212: own value, else
 *  the position's - the common wire shape puts "troll" on the position, nothing on the player); a zapped opponent (a
 *  frog) carries no keywords (ZappedPosition). The gate drives the pitch badge only (owner 10-19): the badge shows on
 *  the union of the hated keywords; cards, rosters and the apothecary card always list Hatred.
 *  Fail soft: a Hatred whose keyword was not captured (bare "Hatred"), or an opponent roster without keyword data at all,
 *  keeps the icon - hiding on missing data would hide a real hatred. Settings-gated (hatredIconNeedsTarget, pitch icons only). */

export interface HatredPositionLike {
  positionId?: unknown;
  skillArray?: readonly string[];
  skillValues?: readonly (string | null | undefined)[] | null;
  skillDisplayValues?: readonly (string | null | undefined)[] | null;
  keywords?: unknown;
}

const text = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function positionOf(team: TeamJson | null | undefined, player: Pick<PlayerJson, 'positionId'>): HatredPositionLike | undefined {
  const positions = (team?.roster as { positionArray?: HatredPositionLike[] } | undefined)?.positionArray ?? [];
  return positions.find((position) => String(position.positionId) === String(player.positionId));
}

/** The keywords the player hates, lower-case: the player's own base value, else the position's (RosterPlayer:212),
 *  plus every temporary grant's. Empty when none was captured. */
export function hatedKeywords(player: PlayerJson, position?: HatredPositionLike | null): Set<string> {
  const out = new Set<string>();
  const add = (value: unknown) => { for (const part of String(value ?? '').split(';')) { const k = text(part); if (k) out.add(k); } };
  let baseSeen = false;
  for (const skill of decodePlayerSkills(player)) {
    if (normalizeSkillName(skill.name) !== 'hatred') continue;
    if (skill.source === null) { baseSeen = true; if (skill.value) add(skill.value); }
    else if (skill.value) add(skill.value);
  }
  if (baseSeen && position?.skillArray) {
    const own = decodePlayerSkills(player).some((skill) => skill.source === null && normalizeSkillName(skill.name) === 'hatred' && !!skill.value);
    if (!own) {
      const index = position.skillArray.findIndex((name) => normalizeSkillName(name) === 'hatred');
      if (index >= 0) add(position.skillDisplayValues?.[index] || position.skillValues?.[index]);
    }
  }
  return out;
}

/** The keywords carried by the players a team actually has (their positions' `keywords`), lower-case; null when the
 *  roster carries no keyword data at all (an older ruleset / a roster without the field). A zapped player (a frog)
 *  carries none (upstream ZappedPosition.getKeywords). */
export function teamPlayerKeywords(team: TeamJson): Set<string> | null {
  const positions = (team.roster as { positionArray?: HatredPositionLike[] } | undefined)?.positionArray ?? [];
  const byId = new Map<string, unknown>();
  let anyData = false;
  for (const position of positions) {
    if (Array.isArray(position.keywords)) { anyData = true; byId.set(String(position.positionId), position.keywords); }
  }
  if (!anyData) return null;
  const out = new Set<string>();
  for (const player of team.playerArray) {
    if (String((player as { playerKind?: unknown }).playerKind ?? '') === 'zappedPlayer') continue;
    const keywords = byId.get(String(player.positionId));
    if (Array.isArray(keywords)) for (const k of keywords) { const v = text(k); if (v) out.add(v); }
  }
  return out;
}

/** Does the Hatred icon (the one pitch badge) apply for `player` against `opponents` right now? Union over keywords. */
export function hatredIconApplies(player: PlayerJson, opponents: TeamJson | null | undefined, position?: HatredPositionLike | null): boolean {
  if (!opponents) return true;
  const hated = hatedKeywords(player, position);
  if (hated.size === 0) return true;
  const present = teamPlayerKeywords(opponents);
  if (present === null) return true;
  for (const k of hated) if (present.has(k)) return true;
  return false;
}
