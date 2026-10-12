/**
 * Owner 10-12 (Astra P2): where a popped quick-bar tooltip goes. Candidates, in order: above the button (climbing over
 * the Pause / Go Live / logo row and the bar), below the bar, beside the bar on the left, beside it on the right. Each
 * candidate is clamped into the viewport and then RE-CHECKED: it must sit fully inside the viewport (edge margin) and
 * cover none of the avoided rects or the button. The first that passes wins; when none does (or the tip is bigger than
 * the viewport) the result is null and the tip is not shown.
 */
export interface TipRect { left: number; top: number; right: number; bottom: number }
export interface TipPlacement { left: number; top: number; side: 'above' | 'below' | 'beside-left' | 'beside-right' }

export const TIP_GAP_PX = 6;
export const TIP_EDGE_PX = 8;

const overlaps = (a: TipRect, b: TipRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function placeQuickBarTip(opts: {
  button: TipRect;
  /** The bar and its neighbouring controls; empty rects (not rendered) are ignored. */
  avoid: TipRect[];
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}): TipPlacement | null {
  const { button, width: w, height: h, viewportWidth: vw, viewportHeight: vh } = opts;
  if (w <= 0 || h <= 0 || w > vw - 2 * TIP_EDGE_PX || h > vh - 2 * TIP_EDGE_PX) return null; // cannot be contained
  const blockers = [...opts.avoid.filter((r) => r.right > r.left && r.bottom > r.top), button];
  const clampX = (x: number) => Math.max(TIP_EDGE_PX, Math.min(x, vw - w - TIP_EDGE_PX));
  const clampY = (y: number) => Math.max(TIP_EDGE_PX, Math.min(y, vh - h - TIP_EDGE_PX));
  const rectAt = (left: number, top: number): TipRect => ({ left, top, right: left + w, bottom: top + h });
  const hits = (tip: TipRect) => blockers.filter((r) => overlaps(tip, r));
  const fits = (tip: TipRect) => tip.left >= TIP_EDGE_PX && tip.top >= TIP_EDGE_PX
    && tip.right <= vw - TIP_EDGE_PX && tip.bottom <= vh - TIP_EDGE_PX && hits(tip).length === 0;
  const union = blockers.reduce<TipRect>((u, r) => ({
    left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom),
  }), { ...button });
  const centredX = clampX(button.left + (button.right - button.left) / 2 - w / 2);

  // Above: just over the button, climbing over every blocker it would cover.
  let aboveTop = button.top - TIP_GAP_PX - h;
  for (let guard = 0; guard <= blockers.length; guard++) {
    const hit = hits(rectAt(centredX, aboveTop));
    if (!hit.length) break;
    aboveTop = Math.min(...hit.map((r) => r.top)) - TIP_GAP_PX - h;
  }
  // Below: just under the button, dropping under every blocker it would cover.
  let belowTop = button.bottom + TIP_GAP_PX;
  for (let guard = 0; guard <= blockers.length; guard++) {
    const hit = hits(rectAt(centredX, belowTop));
    if (!hit.length) break;
    belowTop = Math.max(...hit.map((r) => r.bottom)) + TIP_GAP_PX;
  }
  const besideY = clampY(button.bottom - h);
  const candidates: [TipPlacement['side'], number, number][] = [
    ['above', centredX, clampY(aboveTop)],
    ['below', centredX, clampY(belowTop)],
    ['beside-left', clampX(union.left - TIP_GAP_PX - w), besideY],
    ['beside-right', clampX(union.right + TIP_GAP_PX), besideY],
  ];
  for (const [side, left, top] of candidates) {
    if (fits(rectAt(left, top))) return { left, top, side };
  }
  return null; // nowhere clear of the bar: show nothing rather than cover it
}

/** Astra P2: press order for the quick bar. `take()` numbers a press; `isLatest(n)` is false once a newer press exists,
 *  so an async press (Sprites pack activation) cannot replace the feedback of a press made while it was pending. */
export function createPressOrder(): { take(): number; isLatest(press: number): boolean } {
  let seq = 0;
  return { take: () => ++seq, isLatest: (press) => press === seq };
}
