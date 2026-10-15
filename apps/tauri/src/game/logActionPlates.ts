import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { playerServerSide, teamServerSide, type ServerSide } from '@fumbbl40k/ffb-pitch';

/**
 * Owner 10-15 (Settings > Display > Log > Log style "Graphical"): each match-log line is a row whose left cell shows the
 * bare icon of the action the line belongs to (the art the pitch already uses, see LogActionPlate.vue), preceded by the
 * icon of the reroll source when the line is a reroll, and whose background is tinted with the acting team's colour.
 *
 * Decided at FORMAT time from the report the line came from, never by re-reading the line's text:
 *   kind   - the action icon (null = no action icon; the cell stays empty so the text aligns);
 *   side   - the SERVER side of the acting team (null = no single owning team -> a neutral row); the view maps it to the
 *            displayed side exactly like the log dice (displayDiceSide: the local coach is home/blue while playing,
 *            native home/away for spectators and replays);
 *   source - the reroll source that actually provided this line's reroll, as the server named it ("Team ReRoll",
 *            "Pro", "Team Mascot", "Brawler", ...); absent when the line is not a reroll.
 */
export const LOG_ACTION_KINDS = ['block', 'pass', 'handoff', 'catch', 'dodge', 'foul', 'reroll', 'mascot', 'rush', 'pickup'] as const;
export type LogActionKind = (typeof LOG_ACTION_KINDS)[number];

export interface LogActionPlate {
  kind: LogActionKind | null;
  side: ServerSide | null;
  source?: string;
}

/** Display name of each action icon (its accessible label). */
export const LOG_ACTION_LABELS: Readonly<Record<LogActionKind, string>> = {
  block: 'Block', pass: 'Pass', handoff: 'Hand-off', catch: 'Catch', dodge: 'Dodge', foul: 'Foul',
  reroll: 'Reroll', mascot: 'Team Mascot', rush: 'Rush', pickup: 'Pick-up',
};

type Report = Record<string, unknown>;

/** The formatter's cursor context: the block attacker latched by the `block` report that opens a block sequence, the
 *  receiver named by the last `handOver` report (consumed by the catch roll it leads to), and the reroll source that
 *  last PROVIDED a reroll (consumed by the rerolled roll line it leads to). */
export interface LogActionContext {
  lastBlockAttackerId: string | null;
  lastHandOverCatcherId?: string | null;
  lastRerollSource?: string | null;
  /** The player the pending grant's reRoll report named (null for a team-level grant such as the Mascot). */
  lastRerollPlayerId?: string | null;
  /** The team of a team-level grant (mascotUsed names only its team). */
  lastRerollTeamId?: string | null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function actingPlayerId(game: GameJson | null): string | null {
  return str((game?.actingPlayer as { playerId?: unknown } | undefined)?.playerId);
}
/** First resolvable player id -> its server side. */
function sideOfFirst(game: GameJson | null, ...ids: unknown[]): ServerSide | null {
  for (const id of ids) {
    const playerId = str(id);
    if (playerId) return playerServerSide(game, playerId);
  }
  return null;
}
function blockAttackerSide(report: Report, game: GameJson | null, context: LogActionContext | null): ServerSide | null {
  return sideOfFirst(game, report.attackerId, report.playerId, actingPlayerId(game), context?.lastBlockAttackerId);
}

const MASCOT_SOURCE = 'Team Mascot';
/** Owner 10-15: a reroll source whose reRoll report `roll` is a GATE roll that can deny the reroll (Pro and its
 *  fallbacks, Loner, a team reroll whose Loner check older shapes fold into the report). An absent source is the team
 *  reroll. Any other source (Blind Rage...) reports the replacement's own roll there. Shared with the reRoll line. */
export function isGateRerollSource(source: string | null | undefined): boolean {
  const named = typeof source === 'string' && source.trim() ? source.trim() : 'Team ReRoll';
  const key = named.toLowerCase().replace(/[^a-z]/g, '');
  return /^pro\b/i.test(named) || key === 'loner' || key.includes('teamreroll');
}
/** Hand-off latch after the receiver's failed first catch: only its reroll still belongs to the Hand-off. */
const HANDOFF_RETRY = 'retry:';
/** Gate-only sources: they roll to let the reroll ALREADY being spent go ahead (Loner gates a team reroll), so they
 *  are never the provider themselves. */
const GATE_SOURCES = new Set(['loner']);
/** The source a granting report provides; null when it provided none; undefined when the report grants nothing.
 *  Wire shapes (bug-report wire logs, apps/tauri/test/fixtures/g1950459-rush-burst-wire.jsonl,
 *  g999-blitz-turnover-wire.jsonl):
 *   - an ungated reroll reports roll 0 and successful FALSE (`Team ReRoll`, successful false, roll 0, then the rerolled
 *     roll): `successful` only means something for a GATED roll (roll > 0), the same rule the formatter's line uses;
 *   - a gated source (Pro, Loner) reports its roll: successful false = denied ("FAILED | no reroll");
 *   - Loner follows the Team ReRoll it gates (TRR, then Loner passed): it keeps the latched provider;
 *   - a working Mascot reports only mascotUsed (successful, no reRoll report); a failed Mascot that falls back reports
 *     mascotUsed (successful false) THEN reRoll "Team ReRoll". */
function providedSource(report: Report, context: LogActionContext | null): string | null | undefined {
  const id = String(report.reportId ?? '');
  if (id === 'reRoll' || id === 'blockReRoll') {
    const roll = Number(report.roll);
    const named = str(report.reRollSource);
    // Only a GATE roll can deny the reroll: Pro (and its fallbacks), Loner, and a team reroll (whose Loner check older
    // shapes fold into the same report). Other sources report the REPLACEMENT's own roll / result there (fixture
    // g1951755-frenzy-blitz-chainpush-wire.jsonl: reRoll "Blind Rage" successful false roll 3, then the rerolled
    // Dauntless roll), which never takes the reroll back.
    const gated = isGateRerollSource(named) && Number.isInteger(roll) && roll > 0;
    if (gated && report.successful === false) return null;
    if (named && GATE_SOURCES.has(named.toLowerCase().replace(/[^a-z]/g, ''))) return context?.lastRerollSource ?? null;
    // A reRoll without a source reads "rerolls (team reroll)" in the log (the formatter's own default); a blockReRoll
    // without one names none.
    return named ?? (id === 'reRoll' ? 'Team ReRoll' : null);
  }
  if (id === 'mascotUsed') return report.successful === true ? MASCOT_SOURCE : null;
  return undefined;
}

/** Advance the context latches from a report. Idempotent: the live store calls it for every report, displayed or not
 *  (handOver carries no dice, so the live log never formats it), and logActionPlate calls it again when the report is
 *  formatted. Consumption happens only in logActionPlate. */
export function latchLogActionContext(report: Report, context: LogActionContext): void {
  const id = String(report.reportId ?? '');
  if (id === 'handOver') context.lastHandOverCatcherId = str(report.catcherId);
  const source = providedSource(report, context);
  // A partial block reroll is reRoll -> block -> blockReRoll (the replaced die) -> blockRoll (the full new set; fixture
  // block-brawler-reroll-wire.jsonl cmd 55): blockReRoll keeps the grant pending (its own named source, else the one
  // already latched) so that final blockRoll still reads as the reroll.
  if (source !== undefined) {
    if (id === 'blockReRoll') {
      context.lastRerollSource = source ?? context.lastRerollSource ?? null;
    } else {
      context.lastRerollSource = source;
      context.lastRerollPlayerId = source ? str(report.playerId) : null;
      context.lastRerollTeamId = source ? str(report.teamId) : null;
    }
  }
  // The die selection ends a block's dice sequence, and a turn end ends everything: any grant still pending is stale.
  if (id === 'blockChoice' || id === 'turnEnd') clearPendingReroll(context);
}

function clearPendingReroll(context: LogActionContext): void {
  context.lastRerollSource = null;
  context.lastRerollPlayerId = null;
  context.lastRerollTeamId = null;
}

/** Is `report` the roll a pending reroll grant leads to? A roll flagged reRolled; a full block reroll, which the server
 *  sends as a fresh unflagged blockRoll (mascotUsed / reRoll -> block -> blockRoll); or the granted player's own next
 *  roll even when flagged reRolled:false - the server does that for the replacement Pass roll (fixture
 *  wire-g992-hmpscatter-cmd422-433.json: reRoll "Pass" then passRoll reRolled:false). Grant reports themselves never
 *  qualify. Shared by the "Rerolled | " lead (reportFormatter) and the Graphical source icon, read before consumption. */
export function pendingRerollApplies(report: Report, context: Pick<LogActionContext, 'lastRerollSource' | 'lastRerollPlayerId' | 'lastRerollTeamId'> | null | undefined, game: GameJson | null = null): boolean {
  if (providedSource(report, null) !== undefined) return false;
  if (typeof context?.lastRerollSource !== 'string' || !context.lastRerollSource) return false;
  const id = String(report.reportId ?? '');
  if (report.reRolled === true || id === 'blockRoll') return true;
  if (report.reRolled !== false) return false;
  const player = str(report.playerId);
  if (!player) return false;
  if (context.lastRerollPlayerId) return player === context.lastRerollPlayerId;
  // A team-level grant (a working Mascot names only its team): the granting team's player's next roll - the server
  // clears the reroll source before the replacement Hail Mary pass, so that roll arrives reRolled:false too.
  const team = context.lastRerollTeamId ? teamServerSide(game, context.lastRerollTeamId) : null;
  return !!team && playerServerSide(game, player) === team;
}

/** What icon a reroll source shows: the team reroll icon, an inducement icon, or the source's skill icon. */
export type RerollSourceIcon = { kind: 'trr' } | { kind: 'resource'; name: string } | { kind: 'skill'; skill: string };
export function rerollSourceIcon(source: string): RerollSourceIcon {
  const key = source.toLowerCase().replace(/[^a-z]/g, '');
  if (key.includes('mascot') && !/^pro\b/i.test(source.trim())) return { kind: 'resource', name: 'team_mascot' };
  if (key.includes('bribery')) return { kind: 'resource', name: 're_roll_argue' };
  // Brilliant Coaching grants a TEAM reroll and has no art of its own: the TRR icon. (Pump up the Crowd and Star of
  // the Show have their own skill art, so they fall through to the skill icon below.)
  if (key.includes('teamreroll') || key.includes('brilliantcoaching')) return { kind: 'trr' };
  // "Pro", and Pro with a fallback ("Pro TRR", "Pro Mascot TRR"): the final Pro roll decided the reroll.
  if (/^pro\b/i.test(source.trim())) return { kind: 'skill', skill: 'Pro' };
  const leaf = source.includes('.') ? source.slice(source.lastIndexOf('.') + 1) : source;
  const skill = leaf.replace(/[_$]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
    .replace(/(^|\s)([a-z])/g, (_m, sp: string, c: string) => sp + c.toUpperCase());
  return { kind: 'skill', skill: skill || source };
}

/** The two icons a Graphical row's left cell shows: [source][action]. The source is dropped when it would repeat the
 *  action's own art (a Team ReRoll source on a Reroll line: both are the team reroll icon), so no row shows one icon
 *  twice. */
export function logRowIcons(plate: LogActionPlate | null | undefined): { source: RerollSourceIcon | null; action: LogActionKind | null } {
  if (!plate) return { source: null, action: null };
  const source = plate.source ? rerollSourceIcon(plate.source) : null;
  const repeats = source && ((source.kind === 'trr' && plate.kind === 'reroll')
    || (source.kind === 'resource' && source.name === 'team_mascot' && plate.kind === 'mascot'));
  return { source: repeats ? null : source, action: plate.kind };
}

/** The wire playerAction -> action kind, for the (debug-log) playerAction line. */
export function logActionForPlayerAction(action: unknown): LogActionKind | null {
  switch (String(action ?? '')) {
    case 'block': case 'blitz': case 'blitzMove': case 'multipleBlock': return 'block';
    case 'pass': case 'passMove': return 'pass';
    case 'handOver': case 'handOverMove': return 'handoff';
    case 'foul': case 'foulMove': return 'foul';
    default: return null;
  }
}

/**
 * The row decoration for the lines of `report` (every line of a multi-line report, e.g. an injury's dice line and its
 * effect sentences, belongs to the same action). `fallbackSide` is the report's dice owner (reportDiceOwner): the row
 * tint of a line whose report maps to no action icon. Null = nothing to show (neutral row, empty icon cell).
 * Advances the context: latches from handOver / reroll grants, consumes them on the catch / rerolled roll they lead to.
 */
export function logActionPlate(report: Report, game: GameJson | null, context: LogActionContext | null = null, fallbackSide: ServerSide | null = null): LogActionPlate | null {
  if (context) latchLogActionContext(report, context);
  const action = logActionKindPlate(report, game, context);
  // The reroll source: a granting report's own line shows what it provided (nothing when it failed); a rerolled roll
  // line shows the source the latch holds, consumed here so it can never decorate a later, unrelated reroll.
  let source: string | null = null;
  const id = String(report.reportId ?? '');
  const provided = providedSource(report, context);
  // (mascotUsed is excluded: its line's own action icon already is the Mascot; its grant feeds the latch only.)
  if (provided !== undefined && id !== 'mascotUsed') source = provided;
  // The roll the grant leads to: a roll flagged reRolled, or a full block reroll, which the server sends as a fresh
  // blockRoll with no flag (mascotUsed / reRoll -> block -> blockRoll). Consumed, so it decorates nothing later.
  if (pendingRerollApplies(report, context, game)) {
    source = context?.lastRerollSource ?? null;
    if (context) clearPendingReroll(context);
  } else if (report.reRolled === false && context) {
    // Any other roll the server states was NOT rerolled ends a pending grant (it can only be stale by then).
    clearPendingReroll(context);
  }
  const side = action ? action.side : fallbackSide;
  const kind = action?.kind ?? null;
  if (!kind && !source && !side) return null;
  return source ? { kind, side, source } : { kind, side };
}

function logActionKindPlate(report: Report, game: GameJson | null, context: LogActionContext | null): { kind: LogActionKind; side: ServerSide | null } | null {
  const id = String(report.reportId ?? '');
  const plate = (kind: LogActionKind, side: ServerSide | null) => ({ kind, side });
  const rollerSide = () => sideOfFirst(game, report.playerId) ?? teamServerSide(game, report.teamId);
  switch (id) {
    case 'block': case 'blockRoll': case 'blockChoice':
      return plate('block', blockAttackerSide(report, game, context));
    case 'pushback':
      // The pushed player is the defender; the action is the attacker's.
      return plate('block', sideOfFirst(game, actingPlayerId(game), context?.lastBlockAttackerId));
    case 'blockReRoll':
      return plate('reroll', sideOfFirst(game, report.playerId) ?? teamServerSide(game, report.choosingTeamId) ?? blockAttackerSide(report, game, context));
    case 'reRoll':
      return plate('reroll', rollerSide());
    case 'passRoll':
      return plate('pass', rollerSide());
    case 'passDeviate': case 'modifiedPassResult':
      return plate('pass', sideOfFirst(game, report.playerId, actingPlayerId(game)));
    case 'handOver':
      // ReportHandOver names only the receiver; the giver is the acting player, a team-mate of the receiver.
      return plate('handoff', sideOfFirst(game, actingPlayerId(game), report.catcherId));
    case 'catchRoll': {
      // The receiver's catch roll right after a `handOver` report is the Hand-off's catch (owner 10-15 asked for
      // Hand-off icons), and so is its reroll: a failed first attempt leaves a RETRY latch that only the receiver's
      // next catch flagged reRolled matches. Anything else (a bounce, whoever takes it; a later unrelated catch)
      // clears the latch and is a plain Catch on the catcher's own team.
      const latch = context?.lastHandOverCatcherId ?? null;
      const catcher = str(report.playerId);
      if (context) context.lastHandOverCatcherId = null;
      if (catcher && latch === catcher) {
        if (context && report.successful === false) context.lastHandOverCatcherId = `${HANDOFF_RETRY}${catcher}`;
        return plate('handoff', sideOfFirst(game, catcher));
      }
      if (catcher && latch === `${HANDOFF_RETRY}${catcher}` && report.reRolled === true) return plate('handoff', sideOfFirst(game, catcher));
      return plate('catch', rollerSide());
    }
    case 'interceptionRoll':
      return plate('catch', rollerSide());
    case 'dodgeRoll':
      return plate('dodge', rollerSide());
    case 'modifiedDodgeResultSuccessful':
      return plate('dodge', sideOfFirst(game, report.playerId, actingPlayerId(game)));
    case 'goForItRoll':
      return plate('rush', rollerSide());
    case 'pickUpRoll':
      return plate('pickup', rollerSide());
    case 'foul':
      return plate('foul', sideOfFirst(game, report.playerId, report.attackerId, actingPlayerId(game)));
    case 'referee':
      // ReportReferee names no fouler; it is the acting player (the same source the formatter's line uses).
      return plate('foul', sideOfFirst(game, actingPlayerId(game)));
    case 'mascotUsed':
      return plate('mascot', teamServerSide(game, report.teamId) ?? sideOfFirst(game, report.playerId));
    case 'playerAction': {
      const kind = logActionForPlayerAction(report.playerAction);
      return kind ? plate(kind, sideOfFirst(game, report.actingPlayerId, report.playerId)) : null;
    }
    case 'injury': {
      const type = String(report.injuryType ?? '').toLowerCase();
      if (type.startsWith('foul')) return plate('foul', sideOfFirst(game, report.attackerId, actingPlayerId(game)));
      if (type.startsWith('block')) return plate('block', sideOfFirst(game, report.attackerId));
      // A failed dodge / rush: the falling player is the one acting.
      if (type === 'dropdodge') return plate('dodge', sideOfFirst(game, report.defenderId, report.playerId));
      if (type === 'dropgfi') return plate('rush', sideOfFirst(game, report.defenderId, report.playerId));
      return null;
    }
    default:
      return null;
  }
}

/** A stored row decoration is trusted only in exactly this shape (spectator checkpoint rows are validated field by
 *  field): kind + side, plus a non-empty source string when present; never all-empty. */
export function isLogActionPlate(value: unknown): value is LogActionPlate {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value).sort().join(',');
  const plate = value as { kind?: unknown; side?: unknown; source?: unknown };
  const kindOk = plate.kind === null || (LOG_ACTION_KINDS as readonly unknown[]).includes(plate.kind);
  const sideOk = plate.side === null || plate.side === 'home' || plate.side === 'away';
  const sourceOk = keys === 'kind,side' || (keys === 'kind,side,source' && typeof plate.source === 'string' && plate.source.length > 0);
  return kindOk && sideOk && sourceOk && (plate.kind !== null || plate.side !== null || plate.source !== undefined);
}
