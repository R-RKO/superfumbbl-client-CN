import { decodePlayerSkills, effectiveStat, normalizeSkillName, playerHasSkill, type GameJson, type PlayerJson } from '@fumbbl40k/ffb-protocol';
import { isOnPitch } from './geometry';
import { hasTackleZones } from './playerState';

type Square = readonly [number, number];

/** One server move square's minimum rolls (0 = not required). */
export interface ServerMoveRoll {
  gfi: number;
  dodge: number;
  /** True when the server priced this square as a JUMP (actingPlayer.leaping): `dodge` is then the jump target. */
  jump?: boolean;
}

const squareKey = (x: number, y: number): string => `${x},${y}`;

/**
 * The server's own per-square prices from fieldModel.moveSquareArray. While the acting player is leaping,
 * UtilServerPlayerMove (fumbbl40k-server ffb-server/.../util/UtilServerPlayerMove.java:149-154) writes the JUMP
 * minimum roll into `minimumRollDodge`, so those entries are flagged `jump` and must be drawn as the jump target.
 * Server-derived only: no client math.
 */
export function serverMoveSquareRolls(game: GameJson | null | undefined): Map<string, ServerMoveRoll> {
  const out = new Map<string, ServerMoveRoll>();
  if (!game) return out;
  const leaping = !!(game.actingPlayer as { leaping?: boolean } | undefined)?.leaping;
  const squares = (game.fieldModel?.moveSquareArray ?? []) as {
    coordinate?: unknown; minimumRollDodge?: unknown; minimumRollGfi?: unknown;
  }[];
  for (const square of squares) {
    const c = square?.coordinate;
    if (!Array.isArray(c) || c.length < 2) continue;
    const x = Number(c[0]);
    const y = Number(c[1]);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const dodge = Number(square.minimumRollDodge);
    const gfi = Number(square.minimumRollGfi);
    out.set(squareKey(x, y), {
      gfi: Number.isFinite(gfi) && gfi > 0 ? gfi : 0,
      dodge: Number.isFinite(dodge) && dodge > 0 ? dodge : 0,
      ...(leaping ? { jump: true } : {}),
    });
  }
  return out;
}

function findPlayer(game: GameJson, playerId: string): { player: PlayerJson; home: boolean } | null {
  const home = game.teamHome.playerArray.find((p) => String(p.playerId) === playerId);
  if (home) return { player: home, home: true };
  const away = game.teamAway.playerArray.find((p) => String(p.playerId) === playerId);
  return away ? { player: away, home: false } : null;
}

/** Opponents with tackle zones adjacent to `square` (UtilPlayer.findAdjacentPlayersWithTacklezones, start excluded). */
function adjacentOpponents(game: GameJson, opponentIds: Set<string>, square: Square): PlayerJson[] {
  const out: PlayerJson[] = [];
  const byId = new Map([...game.teamHome.playerArray, ...game.teamAway.playerArray].map((p) => [String(p.playerId), p]));
  for (const data of game.fieldModel.playerDataArray) {
    if (!opponentIds.has(String(data.playerId)) || !isOnPitch(data.playerCoordinate)) continue;
    if (!hasTackleZones(Number(data.playerState ?? 0))) continue;
    const [px, py] = data.playerCoordinate;
    const dx = Math.abs(px - square[0]);
    const dy = Math.abs(py - square[1]);
    if (Math.max(dx, dy) !== 1) continue;
    const player = byId.get(String(data.playerId));
    if (player) out.push(player);
  }
  return out;
}

/**
 * Client PROJECTION of the BB2025 jump target for a jump the server has NOT priced (the legacy planner's
 * planJumpOver). Wherever the server sent the square's minimumRollDodge, show that instead (serverMoveSquareRolls).
 *
 * Mirrors fumbbl40k-server ffb-common:
 *  - base: player AG with modifiers (AgilityMechanic bb2025 minimumRollJump :54-56), result Math.max(2, AG + sum)
 *    with no upper clamp (minimumRoll :147-149);
 *  - JumpModifierFactory (factory/mixed :84-145): +N tackle zones, N = MAX(opposing zones on the square left,
 *    opposing zones on the landing square) (numberOfTacklezones :136-144), skipped with Pogo
 *    (ignoreTacklezonesWhenJumping); +1 TOTAL when any opposing Prehensile Tail marks the square left (every
 *    tail-count entry in modifiers/mixed/JumpModifierCollection :19-26 has modifier 1; the count only selects the
 *    entry), cancelled by Pogo;
 *  - skill modifiers: Very Long Legs -1 (skill/bb2025/VeryLongLegs :30, base or temporary); Leap -1 only when the
 *    other modifiers sum above 1, or above 0 with more than one modifier (skill/bb2025/Leap :27-36), and only from
 *    a BASE Leap: the factory evaluates it over Player.getSkills() (JumpModifierFactory :102-106), which excludes
 *    temporary grants such as Intensive Training. Diving Tackle never applies here
 *    (skill/mixed/DivingTackle :46-50 appliesToContext false; it is a later StepJump re-check);
 *  - actingPlayer.jumpsWithoutModifiers drops every modifier (UtilServerPlayerMove :151).
 *
 * Returns null when the player's AG is unknown, never a guessed "2+".
 */
export function jumpTargetForPlayer(
  game: GameJson | null | undefined,
  playerId: string | null | undefined,
  from: Square,
  to: Square,
): number | null {
  if (!game) return null;
  const id = String(playerId ?? '');
  const found = id ? findPlayer(game, id) : null;
  if (!found) return null;
  const { player, home } = found;
  if ((player as { agility?: unknown }).agility == null) return null;
  const agility = effectiveStat(player, 'AG');
  if (!Number.isFinite(agility) || agility <= 0) return null;

  const acting = game.actingPlayer as { playerId?: string | null; jumpsWithoutModifiers?: boolean } | undefined;
  if (String(acting?.playerId ?? '') === id && acting?.jumpsWithoutModifiers) return Math.max(2, agility);

  const opponentIds = new Set((home ? game.teamAway : game.teamHome).playerArray.map((p) => String(p.playerId)));
  const pogo = playerHasSkill(player, 'Pogo');
  const modifiers: number[] = [];
  if (!pogo) {
    const fromZones = adjacentOpponents(game, opponentIds, from).length;
    const toZones = adjacentOpponents(game, opponentIds, to).length;
    const zones = Math.min(8, Math.max(fromZones, toZones));
    if (zones > 0) modifiers.push(zones);
    const tails = adjacentOpponents(game, opponentIds, from).filter((p) => playerHasSkill(p, 'Prehensile Tail')).length;
    if (tails > 0) modifiers.push(1);
  }
  if (playerHasSkill(player, 'Very Long Legs')) modifiers.push(-1);
  const sum = modifiers.reduce((a, b) => a + b, 0);
  const baseLeap = decodePlayerSkills(player).some((s) => s.source === null && normalizeSkillName(s.name) === normalizeSkillName('Leap'));
  const leap = baseLeap && (sum > 1 || (sum > 0 && modifiers.length > 1)) ? -1 : 0;
  return Math.max(2, agility + sum + leap);
}
