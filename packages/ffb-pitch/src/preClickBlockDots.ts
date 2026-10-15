/**
 * UAT 1.0.208 (coach JLeav), owner option A (10-15): "like base FUMBBL, the dots for how many dice appear before
 * clicking the target." When the local coach declares a Block (or a Blitz reaches its block step), the server
 * broadcasts a dice decoration for every legal target (fieldModelAddDiceDecoration, signed nrOfDice: negative = the
 * defender chooses). From the declaration until a target is clicked, those decorations are drawn verbatim as the
 * block-dice dots. After the click the existing post-click preview takes over unchanged.
 *
 * Pure part: model in, dots out. Server-derived only: counts and signs come from the decorations, never computed.
 */

export interface PreClickBlockDot {
  square: [number, number];
  /** Number of block dice (the absolute decoration value). */
  dice: number;
  /** True when the defender chooses (a negative decoration). */
  opponentChoice: boolean;
}

/** The declared actions this covers: a plain Block (and a standalone chainsaw attack, re-declared as `chainsaw`)
 *  and the block step of a Blitz. Other decorated states (Fury second block, Maximum Carnage, Vicious Vines,
 *  a remote attacker) keep their own render paths. */
export const PRE_CLICK_BLOCK_ACTIONS: ReadonlySet<string> = new Set(['block', 'chainsaw', 'blitz', 'blitzMove']);

const BLITZ_ACTIONS: ReadonlySet<string> = new Set(['blitz', 'blitzMove']);

export interface PreClickBlockDotsInput {
  /** Live modern (Order 66) play, where the renderer knows the local coach's side. */
  live: boolean;
  actingPlayer?: { playerId?: string | null; playerAction?: string | null; hasBlocked?: boolean | null } | null;
  homePlaying?: boolean | null;
  /** Is the acting player on the home team? null when unknown. */
  actorIsHome: boolean | null;
  /** The local coach's side (home = true). */
  friendlyIsHome: boolean;
  diceDecorationArray?: readonly unknown[] | null;
  /** A target has been clicked (the host's target stage, the declared-target narrowing, or an armed preview). */
  targetChosen: boolean;
  /** The server's game.defenderId: a non-Blitz block with a server-set defender is past target choice. */
  defenderId?: string | null;
}

/** The dots to draw before the target click: null when this is not the local coach's own pre-click block choice;
 *  [] when it is but the server has no decorations up (the caller then draws nothing at all). */
export function preClickBlockDots(input: PreClickBlockDotsInput): PreClickBlockDot[] | null {
  if (!input.live || input.targetChosen) return null;
  const acting = input.actingPlayer;
  const actingId = String(acting?.playerId ?? '');
  if (!actingId || input.actorIsHome === null) return null;
  if (input.actorIsHome !== input.friendlyIsHome || !!input.homePlaying !== input.friendlyIsHome) return null;
  const action = String(acting?.playerAction ?? '');
  if (!PRE_CLICK_BLOCK_ACTIONS.has(action)) return null;
  if (acting?.hasBlocked === true) return null;
  if (String(input.defenderId ?? '') && !BLITZ_ACTIONS.has(action)) return null;
  const out: PreClickBlockDot[] = [];
  for (const raw of input.diceDecorationArray ?? []) {
    const decoration = raw as { coordinate?: unknown; nrOfDice?: unknown } | null;
    const c = decoration?.coordinate;
    if (!Array.isArray(c) || c.length !== 2) continue;
    const x = Number(c[0]);
    const y = Number(c[1]);
    const signed = Number(decoration?.nrOfDice);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(signed) || signed === 0) continue;
    const dot: PreClickBlockDot = { square: [x, y], dice: Math.abs(signed), opponentChoice: signed < 0 };
    const at = out.findIndex((d) => d.square[0] === x && d.square[1] === y);
    if (at >= 0) out[at] = dot; // one square, one set of dots: the latest decoration wins
    else out.push(dot);
  }
  return out;
}
