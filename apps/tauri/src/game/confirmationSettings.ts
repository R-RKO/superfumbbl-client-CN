import type { EndActivationConfirmKind } from './logic/order66Interaction';
import { t } from '../i18n';

/** Owner 10-04: "let's make the confirmation modals toggleable in Settings. Each confirmation modal should have its
 *  own line item that users can disable in settings."
 *
 *  These are the CLIENT's own "are you sure" prompts - never a server dialog (the client does not answer those for
 *  the coach). Turning one off means the gesture goes straight through, exactly as the prompt's confirm button would
 *  have sent it. All default ON, except the opt-in prompts in CONFIRMATION_OPT_IN (owner 10-13: Confirm kick-off
 *  square, default OFF so the kick-off click keeps sending at once). */
export interface ConfirmationSettings {
  confirmEndTurn: boolean;
  confirmEndBlitz: boolean;
  confirmBlitzToMove: boolean;
  confirmEndPunt: boolean;
  confirmEndHandOff: boolean;
  confirmEndPass: boolean;
  /** Owner 10-07: a declared Foul asks before it is cancelled or ended, like Blitz / Hand-off / Pass. */
  confirmFoul: boolean;
  confirmEndActivation: boolean;
  confirmSetup: boolean;
  confirmConcedeOffer: boolean;
  /** Owner 10-13: "Add a setting for 'Confirm Kick Off Square'. When enabled, the user will need to select confirm on
   *  a modal to confirm their target square." Default OFF (opt-in). */
  confirmKickoffSquare: boolean;
}
export type ConfirmationSettingKey = keyof ConfirmationSettings;

export const CONFIRMATION_DEFAULTS: ConfirmationSettings = {
  confirmEndTurn: true,
  confirmEndBlitz: true,
  confirmBlitzToMove: true,
  confirmEndPunt: true,
  confirmEndHandOff: true,
  confirmEndPass: true,
  confirmFoul: true,
  confirmEndActivation: true,
  confirmSetup: true,
  confirmConcedeOffer: true,
  confirmKickoffSquare: false,
};

/** The prompts that default OFF: only an explicit `true` turns one on. */
export const CONFIRMATION_OPT_IN: ReadonlySet<ConfirmationSettingKey> = new Set<ConfirmationSettingKey>(['confirmKickoffSquare']);

/** The Settings rows, in display order. */
export const CONFIRMATION_SETTING_ROWS: readonly { key: ConfirmationSettingKey; label: string; hint: string }[] = [
  { key: 'confirmEndTurn', get label() { return t('settings.confirmationSettingRows.endTurnWithPlayers'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeEndingYour'); } },
  { key: 'confirmEndBlitz', get label() { return t('settings.confirmationSettingRows.endOrCancelA'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeARight'); } },
  { key: 'confirmBlitzToMove', get label() { return t('settings.confirmationSettingRows.keepBlitzConvertA'); }, get hint() { return t('settings.confirmationSettingRows.asksWhenYouClick'); } },
  { key: 'confirmEndHandOff', get label() { return t('settings.confirmationSettingRows.endOrCancelA2'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeARight2'); } },
  { key: 'confirmEndPass', get label() { return t('settings.confirmationSettingRows.endOrCancelA3'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeARight3'); } },
  { key: 'confirmFoul', get label() { return t('settings.confirmationSettingRows.cancelFoul'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeARight4'); } },
  { key: 'confirmEndPunt', get label() { return t('settings.confirmationSettingRows.endOrCancelA4'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeYourPunt'); } },
  { key: 'confirmEndActivation', get label() { return t('settings.confirmationSettingRows.endActivationWithEscape'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeEscapeEnds'); } },
  { key: 'confirmSetup', get label() { return t('settings.confirmationSettingRows.confirmSetup'); }, get hint() { return t('settings.confirmationSettingRows.asksBeforeALegal'); } },
  { key: 'confirmConcedeOffer', get label() { return t('settings.confirmationSettingRows.offerToConcedeAt'); }, get hint() { return t('settings.confirmationSettingRows.asksWhetherToConcede'); } },
  { key: 'confirmKickoffSquare', get label() { return t('settings.confirmationSettingRows.confirmKickOffSquare'); }, get hint() { return t('settings.confirmationSettingRows.asksYouToConfirm'); } },
];

const END_ACTIVATION_KEY: Record<EndActivationConfirmKind, ConfirmationSettingKey> = {
  blitz: 'confirmEndBlitz',
  punt: 'confirmEndPunt',
  handOver: 'confirmEndHandOff',
  pass: 'confirmEndPass',
  foul: 'confirmFoul',
  generic: 'confirmEndActivation',
};

/** Is the end-activation prompt of this kind switched on? */
export function endActivationConfirmEnabled(kind: EndActivationConfirmKind, settings: Partial<ConfirmationSettings>): boolean {
  return settings[END_ACTIVATION_KEY[kind]] !== false;
}

/** Fail-closed read of the stored settings blob: only an explicit `false` turns a prompt off (and, for an opt-in
 *  prompt, only an explicit `true` turns it on - a missing or junk value keeps the default). */
export function normalizeConfirmationSettings(raw: Record<string, unknown> | null | undefined): ConfirmationSettings {
  const out = { ...CONFIRMATION_DEFAULTS };
  for (const key of Object.keys(CONFIRMATION_DEFAULTS) as ConfirmationSettingKey[]) {
    out[key] = CONFIRMATION_OPT_IN.has(key) ? raw?.[key] === true : raw?.[key] !== false;
  }
  return out;
}
