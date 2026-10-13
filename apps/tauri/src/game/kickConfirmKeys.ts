import { gameKeyDecision } from './playerCards';

/** Owner 10-13 (Settings > Confirm kick-off square; Astra kickconfirm-1/2): does this keydown confirm the open
 *  "Confirm Kickoff?" card with Enter? The landed key ownership rule (gameKeyDecision) decides FIRST: an open Report
 *  modal or a focused text control owns the key, so Enter there never confirms the card. Then a focused prompt button
 *  keeps its own native Enter, and a modified / repeated Enter is not a confirm. The caller runs the confirmation
 *  through runAction('confirm') (the same path as the confirm key), never directly. */
export interface KickConfirmEnterInput {
  cardOpen: boolean;
  key: string;
  reportOpen: boolean;
  reportBusy: boolean;
  /** textFieldOwnsInput / keyboardOwnedByTextControl on the event target. */
  textFieldFocused: boolean;
  /** A focused prompt button (or a keyboard-focused button outside the panel) owns its own Enter. */
  buttonOwnsKey: boolean;
  modified: boolean;
  repeat: boolean;
}

export function kickConfirmEnter(i: KickConfirmEnterInput): boolean {
  const owner = gameKeyDecision({ reportOpen: i.reportOpen, reportBusy: i.reportBusy, textFieldFocused: i.textFieldFocused, key: i.key });
  if (owner !== 'pass') return false;
  return i.cardOpen && i.key === 'Enter' && !i.modified && !i.repeat && !i.buttonOwnsKey;
}
