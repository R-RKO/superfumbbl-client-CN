/**
 * Owner 2026-10-10: "let's add Middle Mouse Button as a default button for enabling/disabling player portraits."
 *
 * Restated the same day: "The middle mouse button for player portrait should disable player portraits" /
 * "Until clicked again".
 *
 * Read as the PLAYER CARD - the docked card with the player's portrait, name, stats and skills that a click on a player
 * opens (SpectateView `popup`). User-facing wording is "Player portraits". A middle mouse button click on the pitch
 * flips the persisted setting `playerCardMode` between
 *  - 'auto'   = cards on: a click on a player opens their card (how the client always behaved), and
 *  - 'called' = cards off: pitch clicks open no card; an open card closes; the explicit opens still work (a roster
 *    row).
 * The setting is the ordinary persisted one, so the choice survives a restart.
 *
 * HOTFIX SHAPE (lifted from codex/controller-public ahead of the controls registry): same file, same setting key and
 * values, same togglePlayerCardMode / middleClickDecision / notice texts. On that branch `bound` comes from the
 * binding table (Settings > Controls) and the ownership check from the crosshair gate; here the middle button is
 * fixed and the ownership check is the small one below. When that branch merges, its version of this file wins.
 */
import { isAssignTouchdownPickKey, isMvpPickKey } from './endGamePick';

export type PlayerCardMode = 'auto' | 'called';
export const PLAYER_CARDS_ON_NOTICE = 'Player portraits on';
export const PLAYER_CARDS_OFF_NOTICE = 'Player portraits off';

export interface PlayerCardToggleDeps {
  settings: { playerCardMode: PlayerCardMode };
  /** Close the card that is open (cards were just turned off). */
  closeCard(): void;
  /** The small corner notice. */
  notice(text: string): void;
}
/** Flip the mode; returns the new one. */
export function togglePlayerCardMode(deps: PlayerCardToggleDeps): PlayerCardMode {
  const next: PlayerCardMode = deps.settings.playerCardMode === 'called' ? 'auto' : 'called';
  deps.settings.playerCardMode = next;
  if (next === 'called') deps.closeCard();
  deps.notice(next === 'auto' ? PLAYER_CARDS_ON_NOTICE : PLAYER_CARDS_OFF_NOTICE);
  return next;
}

/** The one action the middle button carries until the binding table ships. */
export type PlayerCardAction = 'playerCardsToggle';
export const MIDDLE_CLICK_ACTIONS: readonly PlayerCardAction[] = ['playerCardsToggle'];

export interface MiddleClickInput {
  /** The actions bound to the middle mouse button (fixed here; the binding table on the controller branch). */
  bound: readonly PlayerCardAction[];
  /** Something else owns input: Settings / the wizard, the Game Menu or a context menu, a card or confirmation, a
   *  text field in focus. */
  blocked: boolean;
}
export interface MiddleClickDecision {
  /** The click is the binding's: the pitch must not also treat it as a left click. */
  consume: boolean;
  /** The actions to offer, in order, until one handles it. */
  run: readonly PlayerCardAction[];
}
/**
 * A middle-button CLICK on the pitch (press and release without a drag; a drag pans the camera as before).
 * Unbound → not consumed: the click keeps what it did before the binding existed (the pitch treats it as a left
 * click). Bound → always consumed (never a left click as well), and the action runs unless something else owns input.
 */
export function middleClickDecision(input: MiddleClickInput): MiddleClickDecision {
  if (!input.bound.length) return { consume: false, run: [] };
  return { consume: true, run: input.blocked ? [] : input.bound };
}

// --- who owns input (hotfix-local; the controller branch derives this from its crosshair gate) --------------------

const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);
/** The focused element takes typed text (an input that is not a check box / button, a textarea, a select, an
 *  editable region): the middle click leaves the mode alone. Duck-typed so it is testable without a DOM. */
export function textFieldOwnsInput(focused: unknown): boolean {
  const el = focused as { tagName?: unknown; type?: unknown; isContentEditable?: unknown } | null | undefined;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has(String(el.type ?? 'text').toLowerCase());
  return el.isContentEditable === true;
}

type Maybe<T> = T | null | undefined;
/** The store slice read for "a decision card is up" (shapes as in game/store.ts state; the same list as the
 *  controller branch's crosshairGateInput `cardOpen`). */
export interface DecisionCardStoreState {
  reRollPrompt?: Maybe<{ mine: boolean }>;
  skillChoice?: Maybe<{ mine: boolean; using?: boolean }>;
  blockPartial?: Maybe<{ mine: boolean }>;
  multiBlockResolution?: Maybe<{ rolls: { isOwnChoice: boolean | null }[] }>;
  followupChoice?: Maybe<object>;
  apothecaryChoice?: Maybe<{ mine: boolean }>;
  apothecaryD16?: Maybe<{ mine: boolean }>;
  injuryInteraction?: Maybe<{ mine: boolean }>;
  bloodlust?: Maybe<{ stage: string }>;
  kickSkill?: Maybe<object>;
  yesNo?: Maybe<object>;
  blitzBlockChoice?: Maybe<object>;
  foulChoiceHold?: Maybe<object>;
  coinChoicePrompt?: Maybe<object>;
  receiveChoicePrompt?: Maybe<object>;
  selectSkill?: Maybe<object>;
  selectPosition?: Maybe<object>;
  selectWeather?: Maybe<object>;
  keywordChoice?: Maybe<object>;
  cardChoice?: Maybe<object>;
  cardBuy?: Maybe<object>;
  inducementBuy?: Maybe<object>;
  inducementUse?: Maybe<object>;
  wizardTargetConfirm?: Maybe<object>;
  sendOff?: Maybe<object>;
  playerPick?: Maybe<{ key: string; declinable: boolean }>;
}
/** A decision card owns input: a reroll / skill / block-dice / follow-up / apothecary / yes-no / list / inducement
 *  card, a declinable or pane-only player pick. A PITCH pick (push square, kick aim, touchback receiver) is not a
 *  card: the pitch stays the coach's. */
export function decisionCardOpen(st: DecisionCardStoreState): boolean {
  return !!st.reRollPrompt?.mine || (!!st.skillChoice?.mine && !st.skillChoice.using) || !!st.followupChoice
    || !!st.yesNo || !!st.blitzBlockChoice || !!st.foulChoiceHold
    || (!!st.playerPick && (st.playerPick.declinable || isMvpPickKey(st.playerPick.key) || isAssignTouchdownPickKey(st.playerPick.key)))
    || (!!st.bloodlust && st.bloodlust.stage !== 'bite')
    || !!st.blockPartial?.mine || !!st.multiBlockResolution?.rolls.some((r) => r.isOwnChoice === true)
    || !!st.selectSkill || !!st.selectPosition || !!st.selectWeather || !!st.keywordChoice
    || !!st.coinChoicePrompt || !!st.receiveChoicePrompt
    || !!st.apothecaryChoice?.mine || !!st.apothecaryD16?.mine || !!st.injuryInteraction?.mine
    || !!st.kickSkill || !!st.cardChoice || !!st.cardBuy || !!st.inducementBuy || !!st.inducementUse
    || !!st.wizardTargetConfirm || !!st.sendOff;
}

export interface PlayerCardsInputOwnership {
  /** Settings or the setup wizard is open. */
  shellModalOpen: boolean;
  gameMenuOpen: boolean;
  contextMenuOpen: boolean;
  /** Another modal of the game view (the bug-report form, the unanswered-prompt panel). */
  modalOpen: boolean;
  /** An End Activation / End Turn confirmation, or a rail activation prompt. */
  confirmationOpen: boolean;
  /** decisionCardOpen(store state). */
  decisionCardOpen: boolean;
  /** textFieldOwnsInput(document.activeElement). */
  textFieldFocused: boolean;
}
/** True = the middle click is swallowed (never a left click) but the mode does not flip. */
export function playerCardsToggleBlocked(o: PlayerCardsInputOwnership): boolean {
  return o.shellModalOpen || o.gameMenuOpen || o.contextMenuOpen || o.modalOpen || o.confirmationOpen
    || o.decisionCardOpen || o.textFieldFocused;
}
