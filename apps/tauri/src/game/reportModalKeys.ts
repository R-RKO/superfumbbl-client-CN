/**
 * Owner 2026-10-13: "Bug reports should swallow all keyboard entry. Currently if the confirm dialog is up, it sends the
 * command through." The keyboard side of SpectateView's Report modal, kept out of the view so the production handlers
 * can be driven by real KeyboardEvents in a test (Astra review of e2eaf71ab).
 *  - onReportModalKeydown: the modal root's own @keydown (the root also stops keydown/keyup from bubbling). Tab and
 *    Shift+Tab cycle inside the report; Escape closes it unless a send is in flight; nothing else is handled here.
 *  - onReportOwnedKey: a key the open report owns that still reached the game's window handler (its target is outside
 *    the modal: the body, or a HUD button). Enter / Space are cancelled so no underlying button (End Turn) is pressed
 *    natively; Tab is cancelled and focus pulled back into the report.
 */
import { gameKeyDecision, reportOutsideKey } from './playerCards';
import { trapDialogFocus, visibleFocusTargets } from './settingsDialog';

/** Focus the report's description (or its first control). */
export function focusReportDialogIn(root: HTMLElement | null): void {
  if (!root) return;
  (root.querySelector<HTMLElement>('.br-text') ?? visibleFocusTargets(root)[0])?.focus();
}

export function onReportModalKeydown(event: KeyboardEvent, root: HTMLElement | null, busy: boolean, close: () => void): void {
  trapDialogFocus(event, root);
  if (gameKeyDecision({ reportOpen: true, reportBusy: busy, textFieldFocused: false, key: event.key }) !== 'closeReport') return;
  event.preventDefault();
  close();
}

export function onReportOwnedKey(event: KeyboardEvent, root: HTMLElement | null): void {
  if (event.target instanceof Node && root?.contains(event.target)) return; // the modal root handles its own keys
  const outside = reportOutsideKey(event.key);
  if (outside.preventDefault) event.preventDefault();
  if (outside.pullFocus) focusReportDialogIn(root);
}
