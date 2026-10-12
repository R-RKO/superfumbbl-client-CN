/**
 * Owner 10-12: "For the intensive training prayer to nuffle, can we target the player with the camera, put an arrow
 * over their head on the pitch, and pop their portrait (if portraits are enabled) when the selection box pops?"
 *
 * Presentation only. While the Intensive Training skill card is up (the owning coach's `selectSkill` card, or the
 * read-only "X is choosing" wait the other coach, spectators and the replayer see), the chosen player gets:
 *  - the camera, through the renderer's Auto Director nudge (Auto Director off = the camera never moves),
 *  - an arrow over their head (the locate cue's look in its own renderer slot, held while the card is up, following
 *    the player and the projection),
 *  - their player card ("Player portraits"), only when portraits are on (`playerCardMode` 'auto').
 * Nothing here sends, waits or holds. The surface clears when the card goes (answered, replaced by another dialog,
 * game reset or disconnect: the store nulls the card in each case) and when the host unmounts.
 */
import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { isIntensiveTrainingMode } from './passiveSpectatorProjection';

export interface IntensiveTrainingFocusTarget {
  /** One live dialog occurrence (the store's dialog instance key). */
  key: string;
  playerId: string;
  /** The owning coach's interactive card (false = the read-only wait). */
  mine: boolean;
}

export interface IntensiveTrainingFocusState {
  selectSkill: { playerId: string; mode: string; instanceKey: string } | null | undefined;
  prayerChoiceWait: { instanceKey: string } | null | undefined;
}

/** The player the Intensive Training card is about, or null when no such card is up. */
export function intensiveTrainingFocusTarget(
  st: IntensiveTrainingFocusState,
  g: GameJson | null | undefined,
): IntensiveTrainingFocusTarget | null {
  const card = st.selectSkill;
  if (card && card.playerId && isIntensiveTrainingMode(card.mode)) {
    return { key: card.instanceKey, playerId: card.playerId, mine: true };
  }
  const wait = st.prayerChoiceWait;
  if (!wait || !g) return null;
  // The wait card carries no player: read it from the live dialog the wait was raised for (an Iron Man / Knuckle
  // Dusters player pick shares the wait card but is a playerChoice, so it never matches here).
  const dp = g.dialogParameter as { dialogId?: string; playerId?: string; skillChoiceMode?: string } | null | undefined;
  if (dp?.dialogId !== 'selectSkill' || !dp.playerId || !isIntensiveTrainingMode(dp.skillChoiceMode)) return null;
  return { key: wait.instanceKey, playerId: String(dp.playerId), mine: false };
}

type Rect = { left: number; right: number; top: number; bottom: number };
type PlaceFn = (
  anchor: { x: number; y: number } | null | undefined,
  viewport: { width: number; height: number },
  opts?: { avoid?: Rect | null; card?: { width: number; height: number; dx: number; dy: number } | null },
) => { x: number; y: number };

/** Where the centred card (CSS translate(-50%, -50%), centre at `base`) must sit so it covers neither the player's
 *  token nor the arrow over their head: the shared occlusion dodge (store reRollPromptScreenPosition, passed in),
 *  with the keep-out box stretched upward by 1.5 token heights for the arrow. Null = the CSS default spot is clear. */
export function intensiveCardAnchor(
  place: PlaceFn,
  token: Rect | null,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
  base: { x: number; y: number },
): { x: number; y: number } | null {
  if (!token || card.width <= 0 || card.height <= 0) return null;
  const avoid = { ...token, top: token.top - (token.bottom - token.top) * 1.5 };
  const box = { width: card.width, height: card.height, dx: -card.width / 2, dy: -card.height / 2 };
  const clear = base.x + box.dx >= avoid.right || base.x + box.dx + box.width <= avoid.left
    || base.y + box.dy >= avoid.bottom || base.y + box.dy + box.height <= avoid.top;
  if (clear) return null;
  return place(base, viewport, { avoid, card: box });
}

type FocusRenderer = {
  /** App initialised and a game installed: only then do the camera and arrow calls land. */
  isReady(): boolean;
  nudgeToPlayer(playerId: string): boolean;
  /** True when the arrow is drawn now. */
  setFocusArrow(playerId: string | null): boolean;
};

export interface IntensiveTrainingFocusDeps {
  renderer(): FocusRenderer | null | undefined;
  /** Settings "Player portraits" on (`playerCardMode` 'auto'). */
  portraitsOn(): boolean;
  /** Open the player card for this player (no focus change). */
  openCard(playerId: string): void;
  /** The player the open card shows, or null when no card is open. */
  cardPlayerId(): string | null;
  closeCard(): void;
}

export interface IntensiveTrainingFocus {
  /** Call with the current target whenever it may have changed (and again once a renderer exists: a cold join, a
   *  reconnect or a mode switch can open the view on a card that is already up). The same occurrence already on
   *  this renderer is a no-op; the same occurrence not yet on a renderer gets the camera and arrow now, once. */
  sync(target: IntensiveTrainingFocusTarget | null): void;
  /** The player the surface is on, or null. */
  activePlayerId(): string | null;
  dispose(): void;
}

export function createIntensiveTrainingFocus(deps: IntensiveTrainingFocusDeps): IntensiveTrainingFocus {
  /** `applied` = the renderer that took BOTH the camera call (anchor found; the Auto Director decides whether it moves)
   *  and a drawn arrow: null = still eligible for a retry. `arrowOn` = the renderer whose arrow slot this surface set
   *  (even when the arrow could not be drawn yet), so a clear always reaches it. `cardRefreshed` = the cold-join card
   *  was reopened once on a ready renderer, so its portrait resolved. */
  let active: {
    key: string; playerId: string; openedCard: boolean;
    applied: FocusRenderer | null; arrowOn: FocusRenderer | null; cardRefreshed: boolean;
  } | null = null;

  const clear = () => {
    if (!active) return;
    const was = active;
    active = null;
    was.arrowOn?.setFocusArrow(null);
    // Close only the card this surface opened, and only while it still shows that player (a card the coach opened
    // on someone else meanwhile is theirs).
    if (was.openedCard && deps.cardPlayerId() === was.playerId) deps.closeCard();
  };
  /** `retry`: a later pass for an occurrence first seen without a ready renderer. The player card opened then had no
   *  portrait to capture (the portrait is rendered by the pitch): reopen it once, if it still shows the player. */
  const applyToRenderer = (retry: boolean) => {
    const renderer = deps.renderer() ?? null;
    if (!active || !renderer || active.applied === renderer || !renderer.isReady()) return;
    if (active.arrowOn && active.arrowOn !== renderer) active.arrowOn.setFocusArrow(null); // a replaced renderer drops it
    const aimed = renderer.nudgeToPlayer(active.playerId);
    const drawn = renderer.setFocusArrow(active.playerId);
    active.arrowOn = renderer;
    if (aimed && drawn) active.applied = renderer;
    if (retry && !active.cardRefreshed && deps.cardPlayerId() === active.playerId) {
      active.cardRefreshed = true;
      deps.openCard(active.playerId);
    }
  };

  return {
    sync(target) {
      if (active && target && active.key === target.key && active.playerId === target.playerId) {
        applyToRenderer(true);
        return;
      }
      clear();
      if (!target) return;
      let openedCard = false;
      if (deps.portraitsOn()) {
        openedCard = deps.cardPlayerId() !== target.playerId;
        deps.openCard(target.playerId);
      }
      active = { key: target.key, playerId: target.playerId, openedCard, applied: null, arrowOn: null, cardRefreshed: false };
      // A ready renderer now: the card just opened captured its portrait, nothing to refresh later.
      if (deps.renderer()?.isReady()) active.cardRefreshed = true;
      applyToRenderer(false);
    },
    activePlayerId: () => active?.playerId ?? null,
    dispose: clear,
  };
}
