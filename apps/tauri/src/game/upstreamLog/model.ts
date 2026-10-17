import { decodePlayerSkills, effectiveStat, type GameJson, type PlayerJson, type TeamJson } from '@fumbbl40k/ffb-protocol';
import type { TeamSide } from '../teamSide';
import { UPSTREAM_LOG_TABLES } from './tables.generated';
import type { UpstreamRollModifierRow, UpstreamRulesTables, UpstreamSkillRow } from './tables';

/**
 * The upstream client renders reports against its Game model; this is the same reading of our GameJson (the wire
 * shape of that model): players, teams, skills and their properties, stats with modifiers, field state.
 */

export type Report = Record<string, unknown>;
export type UpstreamRules = 'BB2020' | 'BB2025';

export function rulesOf(game: GameJson | null): UpstreamRules {
  const value = game?.gameOptions?.gameOptionArray?.find((o) => o.gameOptionId === 'rulesVersion')?.gameOptionValue;
  return value === 'BB2020' || value === 'BB2016' ? 'BB2020' : 'BB2025';
}

export function tablesOf(game: GameJson | null): UpstreamRulesTables {
  return UPSTREAM_LOG_TABLES[rulesOf(game)];
}

export const COMMON_TABLES = UPSTREAM_LOG_TABLES.COMMON;

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
/** StringTool.isProvided. */
export function provided(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
export function bool(value: unknown): boolean {
  return value === true;
}
export function ints(value: unknown): number[] {
  return Array.isArray(value) ? value.map((v) => num(v)) : [];
}
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}
/** ArrayTool.isProvided: a non-empty array. */
export function arrayProvided(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

export function teamHome(game: GameJson | null): TeamJson | null {
  return game?.teamHome ?? null;
}
export function teamAway(game: GameJson | null): TeamJson | null {
  return game?.teamAway ?? null;
}
export function teamById(game: GameJson | null, teamId: unknown): TeamJson | null {
  if (!game || typeof teamId !== 'string') return null;
  if (game.teamHome?.teamId === teamId) return game.teamHome;
  if (game.teamAway?.teamId === teamId) return game.teamAway;
  return null;
}
export function isHomeTeamId(game: GameJson | null, teamId: unknown): boolean {
  return !!game && game.teamHome?.teamId === teamId;
}

export function playerById(game: GameJson | null, playerId: unknown): PlayerJson | null {
  if (!game || typeof playerId !== 'string' || !playerId) return null;
  return game.teamHome?.playerArray?.find((p) => p.playerId === playerId)
    ?? game.teamAway?.playerArray?.find((p) => p.playerId === playerId)
    ?? null;
}
export function sideOfPlayer(game: GameJson | null, player: PlayerJson | null): TeamSide | null {
  if (!game || !player) return null;
  if (game.teamHome?.playerArray?.some((p) => p.playerId === player.playerId)) return 'home';
  if (game.teamAway?.playerArray?.some((p) => p.playerId === player.playerId)) return 'away';
  return null;
}
export function actingPlayer(game: GameJson | null): PlayerJson | null {
  return playerById(game, game?.actingPlayer?.playerId);
}
export function playerName(player: PlayerJson | null): string {
  return String(player?.playerName ?? 'null');
}

/** PlayerGender (an unknown gender reads as NEUTRAL, PlayerGender.fromOrdinal's default). */
export function gender(player: PlayerJson | null) {
  const g = String(player?.playerGender ?? 'neutral');
  return COMMON_TABLES.genders[g] ?? COMMON_TABLES.genders.neutral!;
}
export function genitive(player: PlayerJson | null): string { return gender(player).genitive; }
export function dative(player: PlayerJson | null): string { return gender(player).dative; }
export function nominative(player: PlayerJson | null): string { return gender(player).nominative; }
export function self(player: PlayerJson | null): string { return gender(player).self; }
export function verbForm(player: PlayerJson | null, singular: string, plural: string): string {
  return gender(player).plural ? plural : singular;
}

/** Player.getSkillsIncludingTemporaryOnes, as skill rows of this ruleset (unknown names are left out). */
function playerSkillRows(game: GameJson | null, player: PlayerJson | null): { name: string; row: UpstreamSkillRow }[] {
  if (!player) return [];
  const skills = tablesOf(game).skills;
  const out: { name: string; row: UpstreamSkillRow }[] = [];
  const seen = new Set<string>();
  // upstream iterates the base skills before the temporary ones
  const decoded = decodePlayerSkills(player);
  for (const entry of [...decoded.filter((d) => d.source === null), ...decoded.filter((d) => d.source !== null)]) {
    const name = canonicalSkill(game, entry.name);
    const row = name ? skills[name] : undefined;
    if (!name || !row || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, row });
  }
  return out;
}

const canonicalSkills = new WeakMap<object, Map<string, string>>();
/** SkillFactory.forName: case-insensitive, Ball & Chain aliases; null for a skill this ruleset does not know. */
export function canonicalSkill(game: GameJson | null, skill: unknown): string | null {
  if (typeof skill !== 'string') return null;
  const skills = tablesOf(game).skills;
  let byLower = canonicalSkills.get(skills);
  if (!byLower) {
    byLower = new Map(Object.keys(skills).map((name) => [name.toLowerCase(), name]));
    canonicalSkills.set(skills, byLower);
  }
  const lower = skill.toLowerCase();
  return byLower.get(lower) ?? (lower === 'ball & chain' || lower === 'ball &amp; chain' ? byLower.get('ball and chain') ?? null : null);
}
export function skillRow(game: GameJson | null, skill: unknown): UpstreamSkillRow | null {
  const name = canonicalSkill(game, skill);
  return name ? tablesOf(game).skills[name] ?? null : null;
}
/** InducementTypeFactory.forName (case-insensitive). */
export function inducementType(game: GameJson | null, name: unknown) {
  if (typeof name !== 'string') return null;
  const lower = name.toLowerCase();
  const entry = Object.entries(tablesOf(game).inducementTypes).find(([key]) => key.toLowerCase() === lower);
  return entry ? { name: entry[0], ...entry[1] } : null;
}
/** SeriousInjuryFactory.forName: null for a name this ruleset does not know. */
export function seriousInjury(game: GameJson | null, name: unknown) {
  return typeof name === 'string' ? tablesOf(game).seriousInjuries[name] ?? null : null;
}
export function skillHasProperty(game: GameJson | null, skill: unknown, property: string): boolean {
  return skillRow(game, skill)?.props.includes(property) ?? false;
}
/** Player.getSkillWithProperty: the first skill with the property, or null. */
export function skillWithProperty(game: GameJson | null, player: PlayerJson | null, property: string): string | null {
  return playerSkillRows(game, player).find((s) => s.row.props.includes(property))?.name ?? null;
}
/** Player.hasSkillProperty / UtilCards.hasSkillWithProperty. */
export function hasSkillProperty(game: GameJson | null, player: PlayerJson | null, property: string): boolean {
  return skillWithProperty(game, player, property) !== null;
}
/** UtilCards.hasUncanceledSkillWithProperty. */
export function hasUncanceledSkillWithProperty(game: GameJson | null, player: PlayerJson | null, property: string): boolean {
  const rows = playerSkillRows(game, player);
  return rows.some((s) => s.row.props.includes(property)) && !rows.some((s) => s.row.cancels.includes(property));
}
/** UtilCards.hasSkillToCancelProperty. */
export function hasSkillToCancelProperty(game: GameJson | null, player: PlayerJson | null, property: string): boolean {
  return playerSkillRows(game, player).some((s) => s.row.cancels.includes(property));
}
/** UtilCards.hasUnusedSkillWithProperty (Player.isUsed reads the player's usedSkills). */
export function hasUnusedSkillWithProperty(game: GameJson | null, player: PlayerJson | null, property: string): boolean {
  const used = new Set((player?.usedSkills ?? []).map(String));
  return playerSkillRows(game, player).some((s) => s.row.props.includes(property) && !used.has(s.name));
}

/** Player.getSkillIntValue(skill): DEFAULT evaluator = the default value; MODIFIER = highest; ROLL = lowest. */
export function skillIntValue(game: GameJson | null, player: PlayerJson | null, skill: string | null): number {
  if (!player || !skill) return 0;
  const row = tablesOf(game).skills[skill];
  if (!row) return 0;
  if (row.evaluator !== 'MODIFIER' && row.evaluator !== 'ROLL') return row.defaultValue;
  // Player.getSkillIntValue: the temporary values plus the base value - the player's own, else its roster
  // position's (RosterPlayer.getSkillValueExcludingTemporaryOnes)
  const decoded = decodePlayerSkills(player).filter((d) => canonicalSkill(game, d.name) === skill);
  const raw = decoded.filter((d) => d.source !== null).map((d) => d.value);
  const base = decoded.find((d) => d.source === null);
  raw.push(base?.value ?? positionSkillValue(game, player, skill));
  const values = raw.filter((v): v is string => v !== null && v !== undefined)
    .map((v) => Number.parseInt(String(v).replace(/[^0-9-]/g, ''), 10)).filter((v) => Number.isFinite(v));
  if (!values.length) return row.defaultValue;
  return row.evaluator === 'MODIFIER' ? Math.max(...values) : Math.min(...values);
}

/** RosterPosition.getSkillValue: the position's value for the skill (parallel skillArray / skillValues). */
function positionSkillValue(game: GameJson | null, player: PlayerJson, skill: string): string | null {
  const team = sideOfPlayer(game, player) === 'home' ? game?.teamHome : game?.teamAway;
  const positions = (team?.roster as { positionArray?: { positionId?: unknown; skillArray?: unknown[]; skillValues?: unknown[] }[] } | undefined)?.positionArray ?? [];
  const position = positions.find((p) => p.positionId === player.positionId);
  const index = (position?.skillArray ?? []).findIndex((name) => canonicalSkill(game, name) === skill);
  const value = index >= 0 ? position?.skillValues?.[index] : null;
  return value == null || String(value).trim() === '' ? null : String(value);
}

export function agilityWithModifiers(player: PlayerJson | null): number { return player ? effectiveStat(player, 'AG') : 0; }
export function passingWithModifiers(player: PlayerJson | null): number { return player ? effectiveStat(player, 'PA') : 0; }
export function strengthWithModifiers(player: PlayerJson | null): number { return player ? effectiveStat(player, 'ST') : 0; }
export function movementWithModifiers(player: PlayerJson | null): number { return player ? effectiveStat(player, 'MA') : 0; }

/** FieldModel.getPlayerState base (PlayerState & 0xff). */
export function playerStateValue(game: GameJson | null, playerId: unknown): number | null {
  const data = game?.fieldModel?.playerDataArray?.find((d) => d.playerId === playerId);
  return typeof data?.playerState === 'number' ? data.playerState : null;
}
export function playerCoordinate(game: GameJson | null, playerId: unknown): [number, number] | null {
  const data = game?.fieldModel?.playerDataArray?.find((d) => d.playerId === playerId);
  const c = data?.playerCoordinate;
  return Array.isArray(c) && c.length === 2 ? [Number(c[0]), Number(c[1])] : null;
}
/** FieldCoordinate.isBoxCoordinate: the dugout columns (negative x home, x >= 26 away). */
export function isBoxCoordinate(c: [number, number] | null): boolean {
  return !!c && (c[0] < 0 || c[0] > 25);
}
/** FieldModel.getPlayer(coordinate). */
export function playerAt(game: GameJson | null, c: unknown): PlayerJson | null {
  if (!Array.isArray(c) || c.length !== 2) return null;
  const data = game?.fieldModel?.playerDataArray?.find((d) => Array.isArray(d.playerCoordinate)
    && d.playerCoordinate[0] === c[0] && d.playerCoordinate[1] === c[1]);
  return data ? playerById(game, data.playerId) : null;
}

/** PlayerState.hasTacklezones: STANDING / MOVING / BLOCKED (and not confused / hypnotized). */
export function hasTacklezones(state: number | null): boolean {
  if (state === null) return false;
  const base = state & 0xff;
  const active = base === 1 || base === 2 || base === 12;
  return active && (state & 0x0200) === 0 && (state & 0x0800) === 0;
}

/** InducementSet.value(usage): the value of the first inducement whose type has the usage. */
export function inducementValue(game: GameJson | null, home: boolean, usage: string): number {
  const set = (home ? game?.turnDataHome : game?.turnDataAway)?.inducementSet;
  const types = tablesOf(game).inducementTypes;
  for (const entry of (set?.inducementArray ?? []) as Record<string, unknown>[]) {
    const type = types[String(entry?.inducementType ?? '')];
    if (type?.usages.includes(usage)) return num(entry.value);
  }
  return 0;
}

export function rollModifierRows(game: GameJson | null, factory: string, names: unknown): (UpstreamRollModifierRow & { name: string })[] {
  const table = tablesOf(game).rollModifiers[factory] ?? {};
  return strings(names).map((name) => {
    const row = table[name];
    return { name, modifier: row?.modifier ?? 0, included: row?.included ?? true, reportString: row?.reportString ?? name, ...(row?.useStrength ? { useStrength: true } : {}) };
  });
}

/** StatusReport.formatRollModifiers (getName()). */
export function formatRollModifiersByName(rows: readonly (UpstreamRollModifierRow & { name: string })[]): string {
  let out = '';
  for (const m of rows) {
    out += m.modifier > 0 ? ' - ' : ' + ';
    if (!m.included) out += `${Math.abs(m.modifier)} `;
    out += m.name;
  }
  return out;
}
/** AgilityMechanic.formatRollModifiers (getReportString()). */
export function formatRollModifiersByReportString(rows: readonly (UpstreamRollModifierRow & { name: string })[]): string {
  let out = '';
  for (const m of rows) {
    out += m.modifier > 0 ? ' - ' : ' + ';
    if (!m.included) out += `${Math.abs(m.modifier)} `;
    out += m.reportString;
  }
  return out;
}

/** StringTool.formatThousands. */
export function formatThousands(value: number): string {
  const s = String(Math.trunc(value));
  let out = '';
  let pos = 0;
  if (s.length % 3 > 0) {
    out += s.slice(0, s.length % 3);
    pos += s.length % 3;
  }
  while (pos < s.length) {
    if (pos > 0) out += ',';
    out += s.slice(pos, pos + 3);
    pos += 3;
  }
  return out;
}
/** StringTool.buildEnumeration. */
export function buildEnumeration(items: readonly string[]): string {
  return items.map((item, i) => (i === 0 ? item : `${i === items.length - 1 ? ' and ' : ', '}${item}`)).join('');
}

export const DIRECTION_MARK = '\ue100';
export const DIRECTION_END = '\ue101';
const FIELD_DIRECTION_NAMES = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
/** Direction.getName() of mapToLocal(direction): upstream turns a direction into the reader's screen frame (portrait
 *  pitch: East reads North). The word is marked here and the printer records it as a direction token, so the view
 *  can name it for the pitch as shown; the line text keeps the field direction. */
export function directionName(value: unknown): string {
  const name = String(value ?? 'null');
  return FIELD_DIRECTION_NAMES.includes(name) ? `${DIRECTION_MARK}${name}${DIRECTION_END}` : name;
}
