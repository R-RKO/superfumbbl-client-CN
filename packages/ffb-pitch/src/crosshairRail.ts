/**
 * Controller support P2a (owner 10-07, spec-controller-support.md "Rail crosshair"; ramp: owner round 9): the pure
 * geometry of the pad crosshair's rails. From the target square four orthogonal rails run to the pitch edge (game
 * coordinates, so the same squares in both orientations — the renderer projects them). The opacity depends only on
 * the DISTANCE from the target, identically on both axes: 1 → 15 %, 2 → 15 %, 3 → 10 %, every farther square 5 %.
 */
import { PITCH_COLS, PITCH_ROWS } from './geometry';

export type RailSquare = { square: [number, number]; alpha: number };

/** Owner round 9: ray opacity by distance from the target (index = distance − 1); beyond the list: RAIL_ALPHA_FAR. */
export const RAIL_ALPHA_NEAR = [0.15, 0.15, 0.1] as const;
export const RAIL_ALPHA_FAR = 0.05;
/** The ray opacity at `distance` squares from the target (0 on the target itself). */
export function railAlphaAt(distance: number): number {
  const d = Math.abs(distance);
  if (d < 1) return 0;
  return RAIL_ALPHA_NEAR[d - 1] ?? RAIL_ALPHA_FAR;
}
/** Owner (o66mg feedback): the target square itself is NOT shaded — the hover outline (the dashed bracket square) is
 *  where the rays end. The rays are a neutral grey: white at the ray alphas reads as light grey over the turf. */
export const RAIL_COLOR = 0xffffff;
/** The crosshair slides between squares over this long (ease-out) so the rail glides. */
export const CROSSHAIR_GLIDE_MS = 120;

/** The rail squares of `target` (the target itself excluded), each with its opacity. Off-pitch target → []. */
export function railSquares(target: readonly [number, number], cols = PITCH_COLS, rows = PITCH_ROWS): RailSquare[] {
  const [tx, ty] = target;
  if (!(tx >= 0 && tx < cols && ty >= 0 && ty < rows)) return [];
  const out: RailSquare[] = [];
  const rays: [number, number, number][] = [
    [1, 0, cols - 1 - tx],
    [-1, 0, tx],
    [0, 1, rows - 1 - ty],
    [0, -1, ty],
  ];
  for (const [dx, dy, length] of rays) {
    for (let d = 1; d <= length; d++) {
      out.push({ square: [tx + dx * d, ty + dy * d], alpha: railAlphaAt(d) });
    }
  }
  return out;
}

/** Cubic ease-out over 0..1. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/** Where the crosshair points: a pitch square, or (setup) a reserve's dugout token. */
export type PitchCrosshairTarget = { square: [number, number] } | { dugoutPlayerId: string };

export function crosshairTargetKey(target: PitchCrosshairTarget | null): string {
  if (!target) return '';
  return 'square' in target ? `${target.square[0]},${target.square[1]}` : `dugout:${target.dugoutPlayerId}`;
}

/** One square slot of a rail lane during a glide: the square it occupies relative to the OLD target (`from`) and to the
 *  NEW target (`to`), with the ray alpha at each end. The renderer draws lerp(quad(from), quad(to), e) at
 *  lerp(alphaFrom, alphaTo, e), so the whole rail (both axes) travels with the target. */
export type RailLaneSlot = { from: [number, number]; to: [number, number]; alphaFrom: number; alphaTo: number };

/** Ray alpha of position `pos` on a lane of `length` squares whose target sits at `target` (0 on the target). */
export function laneAlpha(pos: number, target: number, length: number): number {
  if (pos === target || pos < 0 || pos >= length) return 0;
  return railAlphaAt(pos - target);
}

/** The two lanes (the target's row along game x, its column along game y) mapped from `from` to `to`. With
 *  from === to the non-zero slots are exactly railSquares(to). Off-pitch ends → []. */
export function railLanes(from: readonly [number, number], to: readonly [number, number], cols = PITCH_COLS, rows = PITCH_ROWS): RailLaneSlot[] {
  const on = (t: readonly [number, number]) => t[0] >= 0 && t[0] < cols && t[1] >= 0 && t[1] < rows;
  if (!on(from) || !on(to)) return [];
  const out: RailLaneSlot[] = [];
  for (let x = 0; x < cols; x++) {
    out.push({ from: [x, from[1]], to: [x, to[1]], alphaFrom: laneAlpha(x, from[0], cols), alphaTo: laneAlpha(x, to[0], cols) });
  }
  for (let y = 0; y < rows; y++) {
    out.push({ from: [from[0], y], to: [to[0], y], alphaFrom: laneAlpha(y, from[1], rows), alphaTo: laneAlpha(y, to[1], rows) });
  }
  return out;
}
