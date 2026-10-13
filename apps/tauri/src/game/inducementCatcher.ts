/**
 * Presentation only. While the inducement screen is up, `.induce-catcher` (SpectateView) takes presses that land in
 * the gaps between the panes, so a coach who is still BUYING cannot click through to the pitch, the HUD, or a z-46
 * surface under the old phase container (owner 10-09).
 *
 * Coordinator 10-13 (after g1952884): the gaps pass through to the pitch whenever no one can buy any more:
 * - the read-only review snapshot (induceRevealHold: both coaches confirmed, panes held until setup), and
 * - a Prayers to Nuffle pitch pick (Iron Man, Knuckle Dusters, Blessed Statue of Nuffle), which the server can open
 *   while those panes are still on screen. A prayer recipient pick must never be blocked.
 * The panes themselves stay visible and keep their own pointer handling.
 */

/** playerChoice modes whose recipient is picked on the pitch during the prayer sequence. */
const PRAYER_PICK_PREFIXES = ['pchoice:knuckleDusters:', 'pchoice:ironMan:', 'pchoice:blessedStatueOfNuffle:'] as const;

export function isPrayerBoardPickKey(key: string | null | undefined): boolean {
  return !!key && PRAYER_PICK_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export interface InducementCatcherInput {
  /** The inducement screen is mounted (SpectateView `inducePhaseOpen`). */
  phaseOpen: boolean;
  /** The local coach holds the live buy dialog (SpectateView `induceCanAct`). */
  canBuy: boolean;
  /** The read-only review snapshot is on screen (SpectateView `induceRevealHoldSnapshot`). */
  reviewHold: boolean;
  /** Key of the open player pick, if any (`gameStore.state.playerPick?.key`). */
  playerPickKey: string | null | undefined;
}

/** True when presses between the panes must reach the pitch instead of the catcher. */
export function inducementGapsPassThrough(input: InducementCatcherInput): boolean {
  if (!input.phaseOpen || input.canBuy) return false;
  return input.reviewHold || isPrayerBoardPickKey(input.playerPickKey);
}

/** The catcher is mounted only while the screen is up and its gaps must not pass through. */
export function inducementCatcherActive(input: InducementCatcherInput): boolean {
  return input.phaseOpen && !inducementGapsPassThrough(input);
}
