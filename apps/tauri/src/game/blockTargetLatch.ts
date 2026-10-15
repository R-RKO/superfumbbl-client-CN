/**
 * UAT 1.0.208 (coach JLeav, owner option A): the server's block dice dots show from a Block/Blitz declaration until
 * the coach clicks a target. This is the host's "a target has been clicked" signal for the renderer.
 *
 * "Clicked" is live while a target stage, the block chooser card, or a block/blitz plan with a target is up. It then
 * LATCHES for the activation: committing clears the stage before the server's hasBlocked arrives (and the Chainsaw
 * card can sit in between), so the dots must not come back over every decorated opponent meanwhile. The latch is
 * keyed by the acting player AND the action family, so a new activation, a turn end, or a re-declare to a different
 * action (Block -> Blitz) releases it; the server's own Block -> chainsaw or blitzMove -> blitz re-declare during a
 * commit keeps it.
 */

/** The latch key for the acting player and action, or '' when there is no block-family activation. */
export function blockTargetLatchKey(actingPlayerId: string | null | undefined, playerAction: string | null | undefined): string {
  const id = String(actingPlayerId ?? '');
  const action = String(playerAction ?? '');
  if (!id) return '';
  const family = action === 'block' || action === 'chainsaw' ? 'block'
    : action === 'blitz' || action === 'blitzMove' ? 'blitz'
      : '';
  return family ? `${id}|${family}` : '';
}

/** The next latch value: set while a target choice is live, kept while the key is unchanged, released otherwise. */
export function nextBlockTargetLatch(previous: string | null, key: string, live: boolean): string | null {
  if (!key) return null;
  if (live) return key;
  return previous === key ? previous : null;
}

/** Whether the renderer should treat the target as clicked. */
export function blockTargetChosen(latch: string | null, key: string, live: boolean): boolean {
  return live || (!!key && latch === key);
}
