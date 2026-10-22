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
 */
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
}

export function createBlockDiceRowProvider<R extends ProvidedBlockDiceRow>(deps: BlockDiceRowProviderDeps<R>) {
  let building: Promise<R | null> | null = null;
  let rehoming: Promise<R | null> | null = null;
  const track = (promise: Promise<R | null>, clear: () => void): Promise<R | null> => {
    void promise.finally(clear).catch(() => undefined);
    return promise;
  };
  return {
    ensure(): Promise<R | null> {
      // A first build still in flight wins over the row object it has already published.
      if (building) return building;
      const row = deps.current();
      if (row) {
        const host = deps.host();
        if (!host) return Promise.resolve(null);
        if (row.host === host) return rehoming ?? Promise.resolve(row);
        const pending = deps.rehome(row, host);
        rehoming = pending;
        return track(pending, () => { if (rehoming === pending) rehoming = null; });
      }
      const pending = deps.build();
      building = pending;
      return track(pending, () => { if (building === pending) building = null; });
    },
    /** Forget in-flight promises (row disposed): the next ensure() starts over. */
    reset(): void {
      building = null;
      rehoming = null;
    },
  };
}
