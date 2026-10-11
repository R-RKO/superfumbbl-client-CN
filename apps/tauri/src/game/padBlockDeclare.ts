/**
 * Controller support P2b (owner round 3): the controller-only BLOCK DECLARATION modal. When my acting player's block /
 * blitz target is an adjacent opponent who could instead take one of the player's special attacks, the pad gets a
 * modal: A = Block, X = the special, B = Cancel (the old "use your special action?" ask, controller mode only).
 *
 * Eligibility is NEVER invented here: `offers` is exactly what the existing attack menu offers on that target
 * (availableActions.blockAlternativeOffers + chompAvailable, the same list openO66Menu builds), and the choice goes
 * through the same pending-kind / explicit-choice seams and confirmAggroStage() send as the menu + confirm.
 */
import { ref, watch, type Ref, type WatchStopHandle } from 'vue';

export interface PadBlockDeclareInput {
  controller: boolean;
  stage: { kind: 'block' | 'blitz'; target: string; stage: 1 | 2 } | null;
  /** deriveClientState of the game. */
  attackState: string;
  adjacentEnemyIds: readonly string[];
  /** The kind already chosen for this attack (menu), if any. */
  pendingKind: string | null;
  /** A menu pick already made the choice explicit. */
  explicitChoice: boolean;
  /** The special attacks the existing menu offers (menu order). */
  offers: readonly string[];
}

/** The specials to offer, or null when the modal should not show. */
export function padBlockDeclareKinds(input: PadBlockDeclareInput): string[] | null {
  const st = input.stage;
  if (!input.controller || !st || st.stage !== 2) return null;
  if (input.attackState !== 'BLOCK' && input.attackState !== 'BLITZ') return null;
  if (!input.adjacentEnemyIds.includes(st.target)) return null;
  if (input.pendingKind != null || input.explicitChoice) return null;
  const kinds = [...new Set(input.offers)];
  return kinds.length ? kinds : null;
}


/** What the production watcher reads (SpectateView supplies the live sources). Every getter is reactive. */
export interface PadBlockDeclareSources {
  /** The applied-frame counter (gameStore.state.appliedFrameSeq) — re-evaluates on every server frame, so the
   *  declare's ack (state becomes BLOCK / BLITZ) opens the modal and later frames re-validate the offers. */
  frame(): number;
  /** Everything else, read fresh on each evaluation: null = the modal cannot show (no game / not playing / no actor). */
  input(): PadBlockDeclareInput | null;
  /** Reactive inputs that change between frames (aggro stage, input method, pending kinds). */
  deps(): unknown[];
}
export interface PadBlockDeclareWatch {
  readonly modal: Ref<{ target: string; kinds: string[] } | null>;
  /** Re-evaluate now (tests / explicit refresh). */
  evaluate(): void;
  stop: WatchStopHandle;
}
/**
 * Astra P1-2: the PRODUCTION modal watcher. It depends on the applied frame as well as the local stage, so a fresh
 * quick Block — whose stage 2 is set synchronously with the declare, BEFORE the server acknowledges it — opens the
 * modal when the ack frame lands; while open, each frame re-validates the offers (gone → the modal closes).
 */
export function createPadBlockDeclareWatch(sources: PadBlockDeclareSources): PadBlockDeclareWatch {
  const modal = ref<{ target: string; kinds: string[] } | null>(null);
  const evaluate = (): void => {
    const input = sources.input();
    const kinds = input ? padBlockDeclareKinds(input) : null;
    const next = kinds && input?.stage ? { target: input.stage.target, kinds } : null;
    const cur = modal.value;
    if (!next) { if (cur) modal.value = null; return; }
    if (cur && cur.target === next.target && cur.kinds.join() === next.kinds.join()) return;
    modal.value = next;
  };
  const stop = watch(() => [sources.frame(), ...sources.deps()], evaluate, { immediate: true });
  return { modal, evaluate, stop };
}
