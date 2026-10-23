import { t } from '../i18n';
/**
 * S43: what the "unanswered server prompt" panel says. Pure text projection of one server dialog: nothing here
 * answers, infers or computes anything. Every value shown is a value the server sent (names are looked up in the
 * received game; a value that cannot be looked up is shown as sent).
 */

export interface UnknownDialogRow { label: string; value: string; raw: boolean; shortened: boolean }
export type UnknownDialogAsked = 'you' | 'opponent' | 'unstated';
export interface UnknownDialogView {
  title: string;
  /** One sentence: what the server is asking. */
  what: string;
  /** True when the dialog id is not in the client's registry at all. */
  isNew: boolean;
  asked: UnknownDialogAsked;
  askedText: string;
  rows: UnknownDialogRow[];
  /** Values beyond the rows the panel lists (they are all in Copy details). */
  moreCount: number;
}
export interface UnknownDialogLookup {
  myTeamId: string | null;
  teamName(teamId: string): string | null;
  player(playerId: string): { name: string; nr: number | null; teamId: string | null } | null;
}

export const UNKNOWN_DIALOG_TITLE = 'The server is asking something this client cannot answer yet';

/**
 * One plain-English sentence per registry entry marked `unhandled`, paraphrased from the official client's own dialog
 * title and text (ffb-client-logic/src/main/java/com/fumbbl/ffb/client/dialog/, commit b7f355af4). `source` names the file.
 */
export const UNKNOWN_DIALOG_WORDS: Readonly<Record<string, { what: string; source: string }>> = {
  information: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerIsShowing'); }, source: 'DialogInformation.java' },
  teamChoice: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerWantsA'); }, source: 'DialogTeamChoice.java ("Select Team")' },
  reRollForTargets: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether'); }, source: 'DialogReRollForTargets.java ("Use a Re-roll")' },
  reRollBlockForTargets: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether2'); }, source: 'DialogReRollBlockForTargets.java ("Block Roll")' },
  useIgors: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksFor'); }, source: 'DialogUseIgorsHandler.java ("Select players to use igor for")' },
  useMortuaryAssistants: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksFor2'); }, source: 'DialogUseMortuaryAssistantsHandler.java' },
  winningsReRoll: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether3'); }, source: 'DialogWinningsReRoll.java ("Re-roll Winnings")' },
  pilingOn: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether4'); }, source: 'DialogPilingOn.java ("Use Piling On")' },
  useIgor: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether5'); }, source: 'DialogUseIgor.java ("Use Igor")' },
  useMortuaryAssistant: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether6'); }, source: 'DialogUseMortuaryAssistant.java' },
  opponentBlockSelection: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksA'); }, source: 'DialogOpponentBlockSelectionHandler.java ("Select Block Results")' },
  useChainsaw: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether7'); }, source: 'DialogUseChainsaw.java ("Use Chainsaw")' },
  briberyAndCorruptionReRoll: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether8'); }, source: 'DialogBriberyAndCorruption.java' },
  penaltyShootout: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerIsShowing2'); }, source: 'DialogPenaltyShootout.java ("Penalty Shootout")' },
  opponentBlockSelectionProperties: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksA'); }, source: 'DialogOpponentBlockSelectionPropertiesHandler.java ("Select Block Results")' },
  pickUpChoice: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksWhether9'); }, source: 'DialogPickUpChoice.java ("Attempt to pick up the ball?")' },
  selectPosition: { get what() { return t('dialogs.unknown.unknownDialogWords.theServerAsksFor3'); }, source: 'DialogSelectPosition.java ("Position Choice")' },
};

/** `reRollModifierChoice` -> "Re-roll modifier choice". */
export function readableDialogName(id: string): string {
  const words = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  const text = words.replace(/\bre roll\b/g, 'reroll');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : id;
}

const LABELS: Readonly<Record<string, string>> = {
  get teamId() { return t('dialogs.unknown.labels.team'); }, get choosingTeamId() { return t('dialogs.unknown.labels.team'); }, get playerId() { return t('dialogs.unknown.labels.player'); }, get playerIds() { return t('dialogs.unknown.labels.players'); },
  get skill() { return t('dialogs.unknown.labels.skill'); }, get modifyingSkill() { return t('dialogs.unknown.labels.modifyingSkill'); }, get minimumRoll() { return t('dialogs.unknown.labels.rollNeeded'); },
  get roll() { return t('dialogs.unknown.labels.roll'); }, get rolls() { return t('dialogs.unknown.labels.rolls'); }, get oldRoll() { return t('dialogs.unknown.labels.currentRoll'); }, get rollsHome() { return t('dialogs.unknown.labels.homeRolls'); }, get rollsAway() { return t('dialogs.unknown.labels.awayRolls'); },
  get reRolledAction() { return t('dialogs.unknown.labels.rerolledAction'); }, get reRollSource() { return t('dialogs.unknown.labels.rerollSource'); }, get nrOfDice() { return t('dialogs.unknown.labels.numberOfDice'); },
  get blockRoll() { return t('dialogs.unknown.labels.blockRoll'); }, get blockRolls() { return t('dialogs.unknown.labels.blockRolls'); },
};
const RAW_MAX = 140;
const ROWS_MAX = 60;
export const SHORTENED_NOTE = 'shortened - full value in Copy details';

function readableKey(key: string): string {
  const text = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : key;
}

function compactJson(value: unknown): string {
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}
/** Cut one line at RAW_MAX; `shortened` says it was cut. */
function cut(text: string): { text: string; shortened: boolean } {
  return text.length > RAW_MAX ? { text: `${text.slice(0, RAW_MAX - 1)}…`, shortened: true } : { text, shortened: false };
}
function done(label: string, text: string, raw: boolean): UnknownDialogRow {
  const c = cut(text);
  return { label, value: c.text, raw, shortened: c.shortened };
}

const isScalar = (v: unknown): v is string | number | boolean => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
const isRollScalar = (v: unknown): v is number | string => typeof v === 'number' || (typeof v === 'string' && v !== '');
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function playerText(lookup: UnknownDialogLookup, id: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  const p = lookup.player(id);
  if (!p) return null;
  return p.nr != null ? `${p.name} (#${p.nr})` : p.name;
}

/** One element of an array of objects: `key: value` pairs, values as sent. */
function pairsLine(el: Record<string, unknown>): string {
  return Object.entries(el).map(([k, v]) => `${k}: ${Array.isArray(v) && v.every(isScalar) ? v.join(', ') : isScalar(v) ? String(v) : compactJson(v)}`).join(', ');
}
/** An array of objects: one element per line (each line cut on its own). */
function objectLines(label: string, value: unknown[], raw: boolean): UnknownDialogRow {
  const lines = value.map((el) => cut(pairsLine(el as Record<string, unknown>)));
  return { label, value: lines.map((l) => l.text).join('\n'), raw, shortened: lines.some((l) => l.shortened) };
}
const isObjectArray = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0 && v.every(isPlainObject);

function rowFor(key: string, value: unknown, lookup: UnknownDialogLookup): UnknownDialogRow {
  const rawRow = (): UnknownDialogRow => {
    if (isObjectArray(value)) return objectLines(key, value, true);
    if (typeof value === 'boolean') return done(key, String(value), true);
    return done(key, compactJson(value), true);
  };
  const label = LABELS[key];
  switch (key) {
    case 'teamId':
    case 'choosingTeamId':
      return typeof value === 'string' ? done(label!, lookup.teamName(value) ?? value, false) : rawRow();
    case 'playerId': {
      if (typeof value !== 'string' || !value) return rawRow();
      const p = playerText(lookup, value);
      if (p) return done(label!, p, false);
      // Some dialogs (opponentBlockSelection ...) write the TEAM id into playerId: show it as the team.
      const team = lookup.teamName(value);
      return team != null ? done('Team', team, false) : done(label!, value, false);
    }
    case 'playerIds':
      return Array.isArray(value) ? done(label!, value.map((id) => playerText(lookup, id) ?? String(id)).join(', ') || 'none', false) : rawRow();
    case 'minimumRoll':
      return typeof value === 'number' ? done(label!, `${value}+`, false) : rawRow();
    default:
  }
  if (!label) return rawRow();
  if (isScalar(value)) return done(label, typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value), false);
  if (value == null) return done(label, 'none', false);
  if (Array.isArray(value) && value.every(isRollScalar)) return done(label, value.join(', ') || 'none', false);
  if (isObjectArray(value)) return objectLines(label, value, false);
  return done(label, compactJson(value), true);
}

/** Who the server addressed: the dialog's own teamId, else choosingTeamId, else the team of its playerId. */
export function unknownDialogAsked(payload: Record<string, unknown>, lookup: UnknownDialogLookup): UnknownDialogAsked {
  let teamId: string | null = null;
  if (typeof payload.teamId === 'string' && payload.teamId) teamId = payload.teamId;
  else if (typeof payload.choosingTeamId === 'string' && payload.choosingTeamId) teamId = payload.choosingTeamId;
  else if (typeof payload.playerId === 'string' && payload.playerId) {
    // The server sometimes writes the TEAM id into playerId (opponentBlockSelection): a team id is the team.
    teamId = lookup.player(payload.playerId)?.teamId ?? (lookup.teamName(payload.playerId) != null ? payload.playerId : null);
  }
  if (!teamId || !lookup.myTeamId) return 'unstated';
  return teamId === lookup.myTeamId ? 'you' : 'opponent';
}

export function describeUnknownDialog(
  id: string,
  payload: Record<string, unknown>,
  registered: boolean,
  lookup: UnknownDialogLookup,
): UnknownDialogView {
  const words = registered ? UNKNOWN_DIALOG_WORDS[id]?.what : undefined;
  const name = readableDialogName(id);
  const what = words ?? (registered
    ? t('dialogs.unknown.what.nameTheServerSent', { name })
    : t('dialogs.unknown.what.nameThisPromptIs', { name }));
  const asked = unknownDialogAsked(payload, lookup);
  const askedText = asked === 'you' ? t('dialogs.unknown.askedText.theServerIsAsking') : asked === 'opponent' ? t('dialogs.unknown.askedText.theServerIsAsking2') : t('dialogs.unknown.askedText.theServerDoesNot');
  const keys = Object.keys(payload).filter((k) => k !== 'dialogId');
  const rows = keys.slice(0, ROWS_MAX).map((k) => rowFor(k, payload[k], lookup));
  return { title: t('dialogs.unknown.title'), what, isNew: !registered, asked, askedText, rows, moreCount: Math.max(0, keys.length - ROWS_MAX) };
}

/**
 * S43: what the game's global key handler does while the panel is up. Enter, Space and Escape never reach a game
 * command (no planner confirm, no chat focus, no Esc cascade); Escape may close the open confirmation and nothing more.
 * Enter/Space on a focused button are cancelled so a keyboard can never press "Send End Turn" / "Send End Activation".
 */
export function unknownPanelKeyDecision(i: { panelUp: boolean; confirming: boolean; key: string; code: string; confirmKey: string; targetIsButton: boolean }):
  { handled: boolean; preventDefault: boolean; closeConfirmation: boolean } {
  const none = { handled: false, preventDefault: false, closeConfirmation: false };
  if (!i.panelUp) return none;
  if (i.key === 'Escape') return { handled: true, preventDefault: false, closeConfirmation: i.confirming };
  const gameKey = i.key === 'Enter' || i.code === 'Space' || i.code === 'Enter' || i.code === i.confirmKey;
  return gameKey ? { handled: true, preventDefault: i.targetIsButton, closeConfirmation: false } : none;
}
