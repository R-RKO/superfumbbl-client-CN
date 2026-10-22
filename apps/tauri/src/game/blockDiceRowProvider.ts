/**
 * Perf (JLeav 1.0.261): hands SpectateView its 3D block-dice row only when the row is READY to draw — built, its faces
 * for the current card loaded, sitting in the current card's host. The view flips `bpDice3dLive` (which hides the PNG
 * dice buttons) as soon as it holds a row, so a row handed out early leaves blank dice during the reveal (Astra round 2:
 * a replacement block card arriving while the first row was still loading got the half-built row).
 *
 *  - first build in flight  -> every caller gets the SAME in-flight promise (even though the row object already exists)
 *  - parked row, new host   -> re-home it and resolve once the card's faces are applied
 *  - re-home in flight      -> every caller gets that promise
 *  - ready in this host     -> the row
 *  - no host yet            -> null (nothing to draw into; the PNG dice stay)
 *  - warm-up in flight      -> wait for it (it is told to hurry: remaining idle steps are skipped), then the above
 *
 * Perf (owner 10-21, "Loading the 3D dice makes perfect sense"): warm() builds the row PARKED at game load, off the
 * critical path, through this same lifecycle - a block arriving mid warm-up shares it, never a second build.
 */
export interface BlockDiceWarmSignal {
  /** True once a block card wants the row: the warm-up stops yielding to idle slots and resolves promptly. */
  readonly urgent: boolean;
  /** Called once when the signal turns urgent (immediately when it already is). */
  onUrgent(listener: () => void): void;
}

export function createBlockDiceWarmSignal(): BlockDiceWarmSignal & { hurry(): void } {
  let urgent = false;
  const listeners: Array<() => void> = [];
  return {
    get urgent() { return urgent; },
    onUrgent(listener) {
      if (urgent) listener();
      else listeners.push(listener);
    },
    hurry() {
      if (urgent) return;
      urgent = true;
      listeners.splice(0).forEach((listener) => { try { listener(); } catch { /* fail open */ } });
    },
  };
}

export interface ProvidedBlockDiceRow {
  readonly host: HTMLElement | null;
}

export interface BlockDiceRowProviderDeps<R extends ProvidedBlockDiceRow> {
  /** The live row (null when none was built or it was disposed). */
  current(): R | null;
  /** The current card's dice host. */
  host(): HTMLElement | null;
  /** Build a fresh row in `host()`; resolves with it once its faces are loaded (null when cancelled / failed). */
  build(): Promise<R | null>;
  /** Move a parked row into `host` and resolve with it once the card's faces are applied (null when superseded). */
  rehome(row: R, host: HTMLElement): Promise<R | null>;
  /** Build (or re-face) the row PARKED and prewarm it; resolves when done or abandoned (never rejects). */
  warm?(signal: BlockDiceWarmSignal): Promise<R | null>;
}

export function createBlockDiceRowProvider<R extends ProvidedBlockDiceRow>(deps: BlockDiceRowProviderDeps<R>) {
  let building: Promise<R | null> | null = null;
  let rehoming: Promise<R | null> | null = null;
  let warming: { promise: Promise<R | null>; hurry(): void } | null = null;
  // Astra r2 (latches fail open): every in-flight promise handed to callers is raced against an abort that resetAll()
  // (dispose) fires, so a build / re-home / warm-up that never settles (a disposed row's compile, a hung load) can
  // never leave a block's ensure() awaiting forever - it settles null and the caller falls through (lazy build / PNG).
  const aborts = new Set<() => void>();
  const abortable = (promise: Promise<R | null>): Promise<R | null> => {
    let abort!: () => void;
    const aborted = new Promise<null>((resolve) => { abort = () => resolve(null); });
    aborts.add(abort);
    const raced = Promise.race([promise, aborted]);
    void raced.finally(() => aborts.delete(abort)).catch(() => undefined);
    return raced;
  };
  const track = (promise: Promise<R | null>, clear: () => void): Promise<R | null> => {
    const raced = abortable(promise);
    void raced.finally(clear).catch(() => undefined);
    return raced;
  };
  const ensure = (): Promise<R | null> => {
    // A first build still in flight wins over the row object it has already published.
    if (building) return building;
    const warm = warming;
    if (warm) {
      // Shared, never duplicated: the warm-up hurries and this caller continues from its result (parked row ->
      // re-home; abandoned -> the lazy build), so the PNG dice stay until a row is ready in this card's host.
      warm.hurry();
      const next = () => { if (warming === warm) warming = null; return ensure(); };
      return warm.promise.then(next, next);
    }
    const row = deps.current();
    if (row) {
      const host = deps.host();
      if (!host) return Promise.resolve(null);
      if (row.host === host) return rehoming ?? Promise.resolve(row);
      const pending = track(deps.rehome(row, host), () => { if (rehoming === pending) rehoming = null; });
      rehoming = pending;
      return pending;
    }
    const pending = track(deps.build(), () => { if (building === pending) building = null; });
    building = pending;
    return pending;
  };
  return {
    ensure,
    /** Warm the row off the critical path (game load / settings change while parked). A build, re-home or warm-up
     *  already in flight is reused; no-op without a `warm` dep. */
    warm(): Promise<R | null> {
      if (building) return building;
      if (rehoming) return rehoming;
      if (warming) return warming.promise;
      if (!deps.warm) return Promise.resolve(null);
      const signal = createBlockDiceWarmSignal();
      let pending: Promise<R | null>;
      try {
        pending = abortable(deps.warm(signal).catch(() => null));
      } catch {
        return Promise.resolve(null);
      }
      const entry = { promise: pending, hurry: () => signal.hurry() };
      warming = entry;
      void pending.finally(() => { if (warming === entry) warming = null; });
      return pending;
    },
    /** True while a warm-up is in flight. */
    get warming(): boolean { return warming != null; },
    /** Forget the build / re-home promises (block card cleared, row parked): the next ensure() starts over. A warm-up
     *  in flight is kept (its row is parked by design). */
    reset(): void {
      building = null;
      rehoming = null;
    },
    /** Row disposed (game leave, seek, failure): forget everything, the warm-up included, and SETTLE every waiter
     *  (null) so its caller re-runs ensure() on a fresh build - never a disposed row (Astra r2). */
    resetAll(): void {
      building = null;
      rehoming = null;
      warming?.hurry();
      warming = null;
      const pending = [...aborts];
      aborts.clear();
      pending.forEach((abort) => abort());
    },
  };
}

export interface BlockDiceIdleStepDeps {
  /** Schedule `callback` in an idle slot (at most `timeoutMs` late); returns a cancel. Default: requestIdleCallback
   *  with a timeout, else a 50 ms timer. */
  requestIdle?: (callback: () => void, timeoutMs: number) => () => void;
  /** True while the view is busy presenting (a movement step / walk in flight): the step waits for the next slot. */
  busy(): boolean;
  timeoutMs?: number;
  /** Give up after this many busy slots (the warm-up is abandoned; the lazy build stays). */
  maxWaits?: number;
}

function defaultRequestIdle(callback: () => void, timeoutMs: number): () => void {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const handle = w.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => w.cancelIdleCallback?.(handle);
  }
  const handle = setTimeout(callback, 50);
  return () => clearTimeout(handle);
}

/** One warm-up step gate: resolves true in an idle slot while the view is not busy, false as soon as the signal turns
 *  urgent (a block card wants the row) or after `maxWaits` busy slots. Never a latch: it always resolves. */
export function blockDiceIdleStep(signal: BlockDiceWarmSignal, deps: BlockDiceIdleStepDeps): Promise<boolean> {
  if (signal.urgent) return Promise.resolve(false);
  const requestIdle = deps.requestIdle ?? defaultRequestIdle;
  const timeoutMs = deps.timeoutMs ?? 1000;
  const maxWaits = deps.maxWaits ?? 120;
  return new Promise<boolean>((resolve) => {
    let done = false;
    let cancel: (() => void) | null = null;
    let waits = 0;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      cancel?.();
      cancel = null;
      resolve(value);
    };
    const wait = () => {
      cancel = requestIdle(() => {
        cancel = null;
        if (done) return;
        if (signal.urgent) return finish(false);
        let busy = true;
        try { busy = deps.busy(); } catch { busy = false; }
        if (!busy) return finish(true);
        if (++waits >= maxWaits) return finish(false);
        wait();
      }, timeoutMs);
    };
    signal.onUrgent(() => finish(false));
    if (!done) wait();
  });
}
