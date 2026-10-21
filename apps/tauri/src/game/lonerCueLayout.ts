/** Owner 10-20: "Ensure the loner pill splash appears below block panes or any other reroll pane/die toast." The
 *  failed-Loner pill sits half a tile below the player's
 *  token; any pane up on screen that its footprint would touch (the block chooser card, the reroll prompt card / bar,
 *  the action die + FAILED plate, the injury pill, a reroll toast) pushes it further DOWN, below that pane's bottom
 *  with a clear gap - never covering or covered by it. Positional only (no z-order trick); re-evaluated every frame
 *  with the panes' real footprints. Pure. */
export interface CueRect { left: number; top: number; right: number; bottom: number;
  /** Owner 10-20: a PANE the cue centres on when it is pushed past it (block chooser, multi-block panel, reroll card /
   *  bar) - "the loner pill is not centered to the block pane there and should be". Toasts, pills and dice do not. */
  centre?: boolean }

/** Owner 10-20: after a failed Loner the original dice tumble again this long after the reroll arrives - the team
 *  reroll toast's beat (store REROLL_BEAT_MS), so the order reads dice -> toast -> tumble -> pill. */
export const LONER_RETUMBLE_DELAY_MS = 1100;

/** Gap between the cue and the pane above it, px. */
export const LONER_CUE_GAP_PX = 6;

/** The board viewport the cue must stay inside (px, the cue's own coordinate space), and the bottom edge of the
 *  player's token the cue must stay ABOVE when it has to flip up (Astra r2 P3-1). */
export interface CueViewport { width: number; height: number; flipBottom: number }

const overlaps = (x: number, y: number, size: { width: number; height: number }, gap: number) => (p: CueRect) => {
  const half = size.width / 2;
  return p.right > x - half - gap && p.left < x + half + gap && p.bottom > y - gap && p.top < y + size.height + gap;
};

/** The cue's placement: `x` is its horizontal centre, `y` its top. `baseY` = half a tile below the token. Panes that
 *  intersect the cue's footprint (padded by the gap) push it below their bottom; a pane pushed into then re-checks the
 *  others, so a stack (die plate, then injury pill under it) ends below all of them.
 *  Astra r2 P3-1 (viewport-aware): `x` is clamped inside the viewport; when the downward stack would leave the bottom
 *  edge, the cue flips ABOVE the token (its bottom at `flipBottom`) and stacks upward over the panes there; only when
 *  neither fits is it clamped inside the viewport (the one case separation cannot be kept). */
export function placeLonerCue(x: number, baseY: number, size: { width: number; height: number }, panes: readonly CueRect[], gap = LONER_CUE_GAP_PX, viewport?: CueViewport): { x: number; y: number } {
  const clampX = (v: number) => viewport && viewport.width > size.width ? Math.min(Math.max(v, size.width / 2), viewport.width - size.width / 2) : v;
  const tokenX = clampX(x);
  // Owner 10-20: pushed past a pane, the cue centres on THAT pane (the last one it was pushed past decides); a stack
  // re-checks the others at the new centre.
  let cx = tokenX;
  let y = baseY;
  for (let guard = 0; guard <= panes.length * 2; guard++) {
    const hit = panes.filter(overlaps(cx, y, size, gap)).filter((p) => p.bottom + gap > y)
      .reduce<CueRect | null>((low, p) => (!low || p.bottom > low.bottom ? p : low), null);
    if (!hit) break;
    y = hit.bottom + gap;
    if (hit.centre) cx = clampX((hit.left + hit.right) / 2);
  }
  if (!viewport || y + size.height <= viewport.height) return { x: cx, y };
  let ux = tokenX;
  let up = viewport.flipBottom - size.height;
  for (let guard = 0; guard <= panes.length * 2; guard++) {
    const hit = panes.filter(overlaps(ux, up, size, gap))
      .reduce<CueRect | null>((high, p) => (!high || p.top < high.top ? p : high), null);
    if (!hit) break;
    up = hit.top - gap - size.height;
    if (hit.centre) ux = clampX((hit.left + hit.right) / 2);
  }
  if (up >= 0) return { x: ux, y: up };
  return { x: cx, y: Math.max(0, Math.min(y, viewport.height - size.height)) };
}
