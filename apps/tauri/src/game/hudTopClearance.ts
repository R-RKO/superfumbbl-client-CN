/** Bug 10-13 (JLeav, sideways): how far down the pitch host the fixed TOP HUD reaches (the coach plates, the
 *  scoreboard, the turn timer). The renderer keeps E-W's top sideline band (INJURED / KO / RESERVES, the turn track)
 *  below this line when the coach scrolls to the top, instead of sliding it under the plates. */


/** One HUD element, in pitch-host px. */
export interface HudTopBox {
  /** Untransformed layout box (offsetTop / offsetHeight, hanging tabs included). */
  top: number;
  bottom: number;
  /** The largest scale the element is drawn at: a coach plate grows while its coach is playing, so the clearance is
   *  taken at that size and does not jump (and move the camera) every turn. */
  scale: number;
  /** Host y of the transform origin: the line that stays put while the element scales. */
  originY: number;
  /** Stable key for the top-band hysteresis (e.g. 'coach-home'). */
  id?: string;
}

/** An element whose drawn top is below this fraction of the host height is not top chrome (a plate the coach moved
 *  down the screen). */
export const HUD_TOP_BAND_FRACTION = 0.4;
/** Astra P2-2: hysteresis - an element already counted as top chrome stays counted until its top passes this
 *  fraction, so a plate dragged across the 40% line does not make the gutter (and the camera) snap back and forth. */
export const HUD_TOP_BAND_RELEASE_FRACTION = 0.5;
/** The clearance never takes more than this fraction of the host height. */
export const HUD_TOP_CLEARANCE_MAX_FRACTION = 0.35;
/** Breathing room between the lowest HUD edge and the dugout wall. */
export const HUD_TOP_GAP_PX = 6;

/** The clearance plus the ids counted as top chrome (feed `included` back as `previous` on the next measure). */
export function measureHudTop(
  boxes: readonly HudTopBox[],
  hostHeight: number,
  previous: ReadonlySet<string> = new Set(),
): { clearance: number; included: Set<string> } {
  const included = new Set<string>();
  if (!(hostHeight > 0)) return { clearance: 0, included };
  let bottom = 0;
  for (const box of boxes) {
    const scale = Number.isFinite(box.scale) && box.scale > 0 ? box.scale : 1;
    if (![box.top, box.bottom, box.originY].every(Number.isFinite) || box.bottom <= box.top) continue;
    const top = box.originY + (box.top - box.originY) * scale;
    const end = box.originY + (box.bottom - box.originY) * scale;
    const limit = box.id != null && previous.has(box.id) ? HUD_TOP_BAND_RELEASE_FRACTION : HUD_TOP_BAND_FRACTION;
    if (top > hostHeight * limit) continue;
    if (box.id != null) included.add(box.id);
    bottom = Math.max(bottom, end);
  }
  if (bottom <= 0) return { clearance: 0, included };
  return { clearance: Math.ceil(Math.min(bottom + HUD_TOP_GAP_PX, hostHeight * HUD_TOP_CLEARANCE_MAX_FRACTION)), included };
}

/** Screen px from the host top that the top HUD covers; 0 when nothing sits at the top. */
export function hudTopClearance(boxes: readonly HudTopBox[], hostHeight: number, previous?: ReadonlySet<string>): number {
  return measureHudTop(boxes, hostHeight, previous).clearance;
}

/** Astra P2-1: a coach plate's box from live DOM numbers. `offsetTop` / `offsetHeight` are its untransformed layout;
 *  `renderedTop` / `renderedHeight` its current getBoundingClientRect, and `children` the rendered rects of what hangs
 *  off it (the RES/OUT tab, the prayer tag translated below the panel), all in client px. The children are mapped back
 *  into the panel's layout space through the CURRENT rendered scale (so a CSS translation or a running grow transition
 *  is accounted for), then the whole box is drawn at `playingScale` around the panel's transform origin. */
export function plateLayoutBox(o: {
  offsetTop: number;
  offsetHeight: number;
  renderedTop: number;
  renderedHeight: number;
  children: ReadonlyArray<{ top: number; bottom: number }>;
  playingScale: number;
  /** Transform-origin y relative to the panel's layout top. */
  originOffset: number;
  id?: string;
}): HudTopBox {
  const current = o.offsetHeight > 0 && o.renderedHeight > 0 ? o.renderedHeight / o.offsetHeight : 1;
  let top = 0;
  let bottom = o.offsetHeight;
  for (const child of o.children) {
    if (!Number.isFinite(child.top) || !Number.isFinite(child.bottom) || child.bottom <= child.top) continue;
    top = Math.min(top, (child.top - o.renderedTop) / current);
    bottom = Math.max(bottom, (child.bottom - o.renderedTop) / current);
  }
  return { top: o.offsetTop + top, bottom: o.offsetTop + bottom, scale: o.playingScale, originY: o.offsetTop + o.originOffset, id: o.id };
}

/** Astra P2-2: the host's sync loop. `sync()` measures and applies, unless a hold is open (a HUD panel or the timer is
 *  being dragged / resized) or `blocked()` says so; releasing the last hold syncs once, through `defer` (the host's
 *  nextTick). The top-band hysteresis set is carried between measures. */
export function createHudClearanceSync(o: {
  measure: (previous: ReadonlySet<string>) => { clearance: number; included: Set<string> } | null;
  apply: (clearance: number) => void;
  blocked?: () => boolean;
  defer?: (run: () => void) => void;
}): { sync: () => void; hold: () => () => void } {
  let holds = 0;
  let included: Set<string> = new Set();
  const sync = (): void => {
    if (holds > 0 || o.blocked?.()) return;
    const result = o.measure(included);
    if (!result) return;
    included = result.included;
    o.apply(result.clearance);
  };
  const hold = (): (() => void) => {
    holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds = Math.max(0, holds - 1);
      if (!holds) (o.defer ?? ((run) => run()))(sync);
    };
  };
  return { sync, hold };
}

/** Vertical transform-origin offset in px from a computed `transform-origin` (browsers resolve it to px; percentages and
 *  keywords are handled too, against the element's layout height). */
export function originOffsetY(transformOrigin: string, height: number): number {
  const tokens = transformOrigin.trim().split(/\s+/).filter(Boolean);
  // CSS allows the vertical keyword first ("top left"); otherwise the second value is the y one (default centre).
  const verticalFirst = tokens[0] === 'top' || tokens[0] === 'bottom' || tokens[1] === 'left' || tokens[1] === 'right';
  const token = (verticalFirst ? tokens[0] : tokens[1]) ?? 'center';
  if (token === 'top') return 0;
  if (token === 'bottom') return height;
  if (token === 'center') return height / 2;
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return 0;
  return token.endsWith('%') ? (value / 100) * height : value;
}

/** The measured top HUD elements of the pitch host: coach plates (with what hangs off them) and the scoreboard + timer.
 *  `playingScale(id, el, style)` is the plate's grown size. Returns the clearance in CANVAS px (host px minus the
 *  canvas's offset in the host), the hysteresis ids, and the elements measured (for the host's ResizeObserver). */
export function measureHudTopDom(
  host: HTMLElement,
  o: {
    playingScale: (id: 'coach-home' | 'coach-away', el: HTMLElement, style: CSSStyleDeclaration) => number;
    canvasTop: number | null;
    previous?: ReadonlySet<string>;
  },
): { clearance: number; included: Set<string>; elements: HTMLElement[] } {
  const hostRect = host.getBoundingClientRect();
  const boxes: HudTopBox[] = [];
  const elements: HTMLElement[] = [];
  for (const [id, selector] of [['coach-home', '.coach-panel.home'], ['coach-away', '.coach-panel.away']] as const) {
    const el = host.querySelector<HTMLElement>(selector);
    if (!el || !el.getClientRects().length) continue;
    elements.push(el);
    const style = getComputedStyle(el);
    const rendered = el.getBoundingClientRect();
    const children = Array.from(el.querySelectorAll<HTMLElement>('[data-panel-overhang], .prayer-tag'))
      .filter((child) => child.getClientRects().length)
      .map((child) => child.getBoundingClientRect());
    boxes.push(plateLayoutBox({
      offsetTop: el.offsetTop,
      offsetHeight: el.offsetHeight,
      renderedTop: rendered.top,
      renderedHeight: rendered.height,
      children,
      playingScale: o.playingScale(id, el, style),
      originOffset: originOffsetY(style.transformOrigin, el.offsetHeight),
      id,
    }));
  }
  for (const [id, selector] of [['scoreboard', '.hud-center.scoreboard'], ['timer', '.turn-timer']] as const) {
    const el = host.querySelector<HTMLElement>(selector);
    if (!el || !el.getClientRects().length) continue;
    elements.push(el);
    const r = el.getBoundingClientRect();
    boxes.push({ top: r.top - hostRect.top, bottom: r.bottom - hostRect.top, scale: 1, originY: r.top - hostRect.top, id });
  }
  const { clearance, included } = measureHudTop(boxes, host.clientHeight, o.previous);
  // Host px -> canvas px: the pitch canvas need not start at the host's top edge (it sits 12 px down today).
  const canvasOffset = (o.canvasTop ?? hostRect.top) - hostRect.top;
  return { clearance: clearance > 0 ? Math.max(0, clearance - canvasOffset) : 0, included, elements };
}

/** Astra P2 (10-13, 2nd + 3rd pass): ONE idempotent end for a HUD drag / resize. It ends on, whichever comes first:
 *  - pointerup / pointercancel for THIS drag's pointer (window or document),
 *  - lostpointercapture for this pointer on the source OR on the document (a captured element removed from the DOM
 *    hands the lost capture to the document, Pointer Events spec),
 *  - the source leaving the DOM (MutationObserver, plus a check on every move of this pointer),
 *  - window blur, or `endAll()` on unmount.
 *  Events carrying another pointerId (a late cancel for a finished pointer) are ignored; events with no pointerId
 *  (blur, synthetic events) end it. The source captures the pointer so a release outside the window still reaches it. */
export function createHudDragEnds(
  windowTarget: EventTarget = window,
  documentTarget: EventTarget | null = typeof document !== 'undefined' ? document : null,
): {
  bind: (source: EventTarget | null, pointerId: number, end: () => void) => () => void;
  endAll: () => void;
} {
  const open = new Set<() => void>();
  const bind = (source: EventTarget | null, pointerId: number, end: () => void): (() => void) => {
    const capture = source as { setPointerCapture?: (id: number) => void } | null;
    try { capture?.setPointerCapture?.(pointerId); } catch { /* no active pointer (synthetic event): the listeners still end it */ }
    const node = source as { isConnected?: boolean } | null;
    const disconnected = (): boolean => node?.isConnected === false;
    const forThisPointer = (event: Event): boolean => {
      const id = (event as { pointerId?: unknown }).pointerId;
      return typeof id !== 'number' || id === pointerId;
    };
    let done = false;
    const listeners: Array<[EventTarget, string, (event: Event) => void, boolean]> = [];
    let observer: MutationObserver | null = null;
    const finish = (): void => {
      if (done) return;
      done = true;
      for (const [target, type, fn, capturePhase] of listeners) target.removeEventListener(type, fn, capturePhase);
      observer?.disconnect();
      open.delete(finish);
      end();
    };
    const on = (target: EventTarget | null, type: string, fn: (event: Event) => void, capturePhase = false): void => {
      if (!target) return;
      target.addEventListener(type, fn, capturePhase);
      listeners.push([target, type, fn, capturePhase]);
    };
    const endFor = (event: Event): void => { if (forThisPointer(event)) finish(); };
    on(windowTarget, 'pointerup', endFor);
    on(windowTarget, 'pointercancel', endFor);
    on(windowTarget, 'blur', finish);
    on(documentTarget, 'pointercancel', endFor, true);
    on(documentTarget, 'lostpointercapture', endFor, true);
    on(source, 'lostpointercapture', endFor);
    on(windowTarget, 'pointermove', (event) => { if (forThisPointer(event) && disconnected()) finish(); }, true);
    if (node && typeof MutationObserver !== 'undefined' && documentTarget && (documentTarget as Node).nodeType !== undefined) {
      observer = new MutationObserver(() => { if (disconnected()) finish(); });
      observer.observe(documentTarget as Node, { childList: true, subtree: true });
    }
    open.add(finish);
    if (disconnected()) finish(); // the source was already gone
    return finish;
  };
  const endAll = (): void => { for (const finish of [...open]) finish(); };
  return { bind, endAll };
}
