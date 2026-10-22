/** Owner 10-22 (g1955713) + Astra round 1 on a8a250fd1: a failed pass / catch die is held for the server's reroll
 *  offer that names its roller. The hold belongs to THAT offer: it is checked again whenever the die is published
 *  (a kick-off die is published late, behind the flight) and released as soon as that offer is gone - even when
 *  another player's reroll offer has replaced it in the same sync. Pure; the store and the view own the timing. */

type DialogLike = { dialogId?: unknown; playerId?: unknown; reRolledAction?: unknown } | null | undefined;
type HeldModal = { playerId: string; square: readonly [number, number]; opponentRerollPending?: boolean; rerollOfferPending?: boolean };

/** The identity of the reroll offer `dialog` makes to `playerId`, or null when it makes none. */
export function rerollOfferKey(dialog: DialogLike, playerId: string): string | null {
  if (!dialog || !playerId) return null;
  const id = String(dialog.dialogId ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!id.includes('reroll') || String(dialog.playerId ?? '') !== playerId) return null;
  return `${playerId}|${id}|${String(dialog.reRolledAction ?? '')}`;
}

/** The modal as it may be published NOW: its hold flags stay only while its roller's reroll offer is still open. */
export function withLiveOfferHold<T extends HeldModal>(modal: T, dialog: DialogLike): T {
  if (!modal.opponentRerollPending && !modal.rerollOfferPending) return modal;
  if (rerollOfferKey(dialog, modal.playerId) !== null) return modal;
  const { opponentRerollPending: _opp, rerollOfferPending: _own, ...rest } = modal;
  void _opp; void _own;
  return rest as T;
}

/** Tracks the pass / catch dice shown held and releases each one when the offer that held it is gone. */
export function createModalOfferHoldTracker(release: (square: [number, number]) => void) {
  let held: { playerId: string; key: string; square: [number, number] }[] = [];
  return {
    /** A modal die was just shown (with `dialog` the live model's dialog). */
    noteShown(modal: HeldModal, dialog: DialogLike): void {
      if (!modal.opponentRerollPending && !modal.rerollOfferPending) return;
      const square: [number, number] = [modal.square[0], modal.square[1]];
      const key = rerollOfferKey(dialog, modal.playerId);
      if (key === null) { release(square); return; } // its offer is already gone: never held by a stale flag
      held = held.filter((h) => !(h.square[0] === square[0] && h.square[1] === square[1]));
      held.push({ playerId: modal.playerId, key, square });
      if (held.length > 8) held = held.slice(-8);
    },
    /** The live dialog changed: release every die whose own offer is no longer the open one. */
    sync(dialog: DialogLike): void {
      const keep: typeof held = [];
      for (const h of held) {
        if (rerollOfferKey(dialog, h.playerId) === h.key) keep.push(h);
        else release(h.square);
      }
      held = keep;
    },
    clear(): void { held = []; },
    /** Astra r2: a hard boundary (reset / disconnect / leave) - every tracked die lets go of its hold. */
    releaseAll(): void {
      const all = held;
      held = [];
      for (const h of all) release(h.square);
    },
    heldCount: () => held.length,
  };
}

/** Owner 10-22 / Astra r2: the reroll caption a rerolled pass / catch result takes when it ANSWERS an offer made to its
 *  roller (the offer held that roller's failed die, so the result re-rolls it in place). Shared by the live frame
 *  publisher and the live-review publisher. `offerAnsweredFor` = the roller of the reroll offer this frame closed;
 *  `failedSameKindInFrame` = this frame already showed a failed die of that kind (an in-frame skill reroll - that chain
 *  keeps its own pop-in staging). */
export function modalRerollCaption(
  modal: { playerId: string; reRolled: boolean },
  reroll: { raw: string; isTeam: boolean } | null | undefined,
  offerAnsweredFor: string | null | undefined,
  failedSameKindInFrame: boolean,
): { rerollSkill: string; rerollTeam: boolean } | null {
  if (!modal.reRolled || !reroll || failedSameKindInFrame || !offerAnsweredFor || offerAnsweredFor !== modal.playerId) return null;
  return { rerollSkill: reroll.raw, rerollTeam: reroll.isTeam };
}
