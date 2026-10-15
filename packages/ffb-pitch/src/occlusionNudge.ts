/**
 * UAT (coach Ion, 1.0.205): "a sprite was in the way, I had to change sprite sets to make a block."
 *
 * Owner's design: while the coach is choosing a block target, a legal target whose figure is hidden behind a player
 * drawn in front of it is NUDGED toward a side of its own square until it shows. Purely visual: the board square,
 * the square hit-test and every piece of server state are unchanged.
 *
 * This module is the pure part: rectangles in, offsets out (all in the pitch's world / token-layer units, so pitch
 * flip, East-West orientation and the camera zoom are already folded into the inputs). The renderer measures the
 * live token rects and applies the offset.
 */

export interface Rect { x: number; y: number; w: number; h: number }
export interface Offset { dx: number; dy: number }

/** A target is "occluded" when LESS than half of its figure rect is visible. Half the figure (head and torso of a
 *  standing player) is enough to recognise and click it; a higher bar would shuffle players in every ordinary scrum,
 *  where partial overlap of neighbouring figures is normal and harmless. The nudge stops as soon as it reaches it. */
export const OCCLUSION_VISIBLE_THRESHOLD = 0.5;
/** Search step (world px). Small enough that the nudge stops close to the least movement that frees the target. */
export const OCCLUSION_NUDGE_STEP = 1.5;
/** When no direction within the clamp reaches the threshold, a partial nudge is used only if it uncovers at least
 *  this much more of the figure (fraction of its area); otherwise the target stays put (moving it would not help). */
export const OCCLUSION_MIN_GAIN = 0.15;

export const ZERO_OFFSET: Readonly<Offset> = Object.freeze({ dx: 0, dy: 0 });

function area(r: Rect): number { return Math.max(0, r.w) * Math.max(0, r.h); }

function intersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export function shiftRect(r: Rect, o: Offset): Rect { return { x: r.x + o.dx, y: r.y + o.dy, w: r.w, h: r.h }; }

/** Area of `target` covered by the UNION of `covers` (overlaps between covers are counted once). Coordinate
 *  compression over the clipped rects: exact, and cheap for the handful of figures around one square. */
export function coveredArea(target: Rect, covers: readonly Rect[]): number {
  const clipped: Rect[] = [];
  for (const c of covers) {
    const i = intersect(target, c);
    if (i) clipped.push(i);
  }
  if (clipped.length === 0) return 0;
  if (clipped.length === 1) return area(clipped[0]!);
  const xs = [...new Set(clipped.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  const ys = [...new Set(clipped.flatMap((r) => [r.y, r.y + r.h]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i]! + xs[i + 1]!) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const cy = (ys[j]! + ys[j + 1]!) / 2;
      if (clipped.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h)) {
        total += (xs[i + 1]! - xs[i]!) * (ys[j + 1]! - ys[j]!);
      }
    }
  }
  return total;
}

/** Fraction (0..1) of `target` NOT covered by `occluders`. A degenerate (zero-area) target counts as fully visible. */
export function visibleFraction(target: Rect, occluders: readonly Rect[]): number {
  const a = area(target);
  if (a <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - coveredArea(target, occluders) / a));
}

/** How far (world px, each >= 0) the target's figure may travel in each screen direction. The renderer derives these
 *  from the target's OWN square: the figure's centre may reach that square's side, never beyond it. */
export interface NudgeLimits { left: number; right: number; up: number; down: number }

export interface NudgeOptions {
  limits: NudgeLimits;
  /** Other legal targets' figure rects: the nudge never pushes this figure further onto another target. */
  avoid?: readonly Rect[];
  threshold?: number;
  step?: number;
  minGain?: number;
}

/** Search order = tie-break order: sideways first (the owner's "nearest square side"), then back, then forward. */
const DIRECTIONS: readonly { ux: number; uy: number; key: keyof NudgeLimits }[] = [
  { ux: -1, uy: 0, key: 'left' },
  { ux: 1, uy: 0, key: 'right' },
  { ux: 0, uy: -1, key: 'up' },
  { ux: 0, uy: 1, key: 'down' },
];

/**
 * The offset that frees `target` from `occluders` fastest: walk each direction in small steps up to its clamp and
 * take the SHORTEST distance at which the visible fraction reaches the threshold (ties: left, right, up, down). A
 * step that would overlap another target more than the figure already does ends that direction. When no direction
 * reaches the threshold, the best partial nudge is used if it gains at least `minGain`; otherwise no nudge.
 * Already visible (or nothing in front) -> {0, 0}.
 */
export function chooseOcclusionNudge(target: Rect, occluders: readonly Rect[], options: NudgeOptions): Offset {
  const threshold = options.threshold ?? OCCLUSION_VISIBLE_THRESHOLD;
  const step = Math.max(0.25, options.step ?? OCCLUSION_NUDGE_STEP);
  const minGain = options.minGain ?? OCCLUSION_MIN_GAIN;
  const avoid = options.avoid ?? [];
  const base = visibleFraction(target, occluders);
  if (base >= threshold) return { dx: 0, dy: 0 };
  // Per other target (a lower overlap with one must never pay for a new overlap with another).
  const baseAvoid = avoid.map((r) => coveredArea(target, [r]));

  let winner: { d: number; o: Offset } | null = null;
  let partial: { v: number; d: number; o: Offset } | null = null;
  for (const dir of DIRECTIONS) {
    const limit = Math.max(0, options.limits[dir.key] || 0);
    if (limit <= 0) continue;
    for (let d = Math.min(step, limit); ; d = Math.min(d + step, limit)) {
      if (winner && d >= winner.d) break; // cannot beat the shortest freeing distance found so far
      const o = { dx: dir.ux * d, dy: dir.uy * d };
      const moved = shiftRect(target, o);
      if (avoid.some((r, i) => coveredArea(moved, [r]) > baseAvoid[i]! + 1e-6)) break;
      const v = visibleFraction(moved, occluders);
      if (v >= threshold) { winner = { d, o }; break; }
      if (!partial || v > partial.v + 1e-9) partial = { v, d, o };
      if (d >= limit) break;
    }
  }
  if (winner) return winner.o;
  if (partial && partial.v - base >= minGain) return partial.o;
  return { dx: 0, dy: 0 };
}

/** A nudged target as the click resolver sees it: its DRAWN figure rect and the figures drawn in front of it. */
export interface NudgedHitEntry { id: string; rect: Rect; occluders: readonly Rect[] }

/** The nudged target whose VISIBLE figure is under the point (inside its drawn rect, outside every figure drawn in
 *  front of it), else null. When two qualify, the one whose rect centre is nearest the point wins. */
export function nudgedTargetAt(x: number, y: number, entries: readonly NudgedHitEntry[]): string | null {
  const inside = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  let best: { id: string; d: number } | null = null;
  for (const e of entries) {
    if (!inside(e.rect) || e.occluders.some(inside)) continue;
    const d = (x - (e.rect.x + e.rect.w / 2)) ** 2 + (y - (e.rect.y + e.rect.h / 2)) ** 2;
    if (!best || d < best.d) best = { id: e.id, d };
  }
  return best?.id ?? null;
}

/** Ease `current` toward `target` (frame-rate independent; `tauMs` = time constant). Snaps once within 0.05 px so a
 *  restore really ends at zero. */
export function easeOffset(current: Offset, target: Offset, dtMs: number, tauMs: number): Offset {
  const k = tauMs <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  const dx = current.dx + (target.dx - current.dx) * k;
  const dy = current.dy + (target.dy - current.dy) * k;
  return {
    dx: Math.abs(target.dx - dx) < 0.05 ? target.dx : dx,
    dy: Math.abs(target.dy - dy) < 0.05 ? target.dy : dy,
  };
}

/** Actions whose target choice the server marks with dice decorations (BB2025 block family). Only the server's
 *  decorated squares are ever nudged; this list only keeps the helper out of unrelated decorated states. */
export const BLOCK_TARGETING_ACTIONS: ReadonlySet<string> = new Set([
  'block', 'blitz', 'blitzMove', 'chainsaw', 'stab', 'multipleBlock', 'viciousVines', 'maximumCarnage',
  'putridRegurgitationBlock', 'putridRegurgitationBlitz', 'kickEmBlock', 'kickEmBlitz', 'breatheFire', 'chomp',
]);

export interface BlockTargetingInput {
  actingPlayer?: { playerId?: string | null; playerAction?: string | null; hasBlocked?: boolean | null } | null;
  homePlaying?: boolean | null;
  /** Is the acting player on the home team? null when unknown. */
  actorIsHome: boolean | null;
  friendlyIsHome: boolean;
  diceDecorationArray?: readonly unknown[] | null;
  /** A target choice the server re-opens after the block (Fury of the Blood God second target, Maximum Carnage). */
  secondTargetChoice?: boolean;
  /** The server's game.defenderId (a chosen target) and that player's square, when set. */
  defenderId?: string | null;
  defenderSquare?: readonly [number, number] | null;
}

const BLITZ_ACTIONS: ReadonlySet<string> = new Set(['blitz', 'blitzMove']);
/** Putrid Regurgitation's ADDITIONAL vomit attack is declared after the player has blocked. */
const AFTER_BLOCK_ACTIONS: ReadonlySet<string> = new Set(['putridRegurgitationBlock', 'putridRegurgitationBlitz']);

/** The squares to keep visible: the server's dice-decorated squares while the LOCAL coach's acting player is choosing
 *  a block-family target (my side, my turn). The choice is over once the player has blocked (except Putrid
 *  Regurgitation's after-block vomit and a server re-opened second target) or the server has set a defender; a Blitz
 *  keeps only its declared target (defenderId) until the block. Otherwise []. */
export function blockTargetingSquares(input: BlockTargetingInput): [number, number][] {
  const acting = input.actingPlayer;
  const actingId = String(acting?.playerId ?? '');
  if (!actingId || input.actorIsHome === null) return [];
  if (input.actorIsHome !== input.friendlyIsHome || !!input.homePlaying !== input.friendlyIsHome) return [];
  const action = String(acting?.playerAction ?? '');
  if (!BLOCK_TARGETING_ACTIONS.has(action)) return [];
  let only: readonly [number, number] | null = null;
  if (!input.secondTargetChoice) {
    if (acting?.hasBlocked === true && !AFTER_BLOCK_ACTIONS.has(action)) return [];
    if (String(input.defenderId ?? '')) {
      if (!BLITZ_ACTIONS.has(action) || !input.defenderSquare) return [];
      only = input.defenderSquare;
    }
  }
  const out: [number, number][] = [];
  for (const raw of input.diceDecorationArray ?? []) {
    const c = (raw as { coordinate?: unknown } | null)?.coordinate;
    if (!Array.isArray(c) || c.length !== 2) continue;
    const x = Number(c[0]);
    const y = Number(c[1]);
    if (only && (only[0] !== x || only[1] !== y)) continue;
    if (Number.isFinite(x) && Number.isFinite(y) && !out.some((s) => s[0] === x && s[1] === y)) out.push([x, y]);
  }
  return out;
}
