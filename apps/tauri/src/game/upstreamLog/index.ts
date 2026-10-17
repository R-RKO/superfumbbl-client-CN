/**
 * The FUMBBL log style (owner 10-16: "duplicate upstream's log formatter and use it as a setting"): every report
 * rendered the way the upstream Java client renders it (ffb-client-logic client/report/*Message.java through
 * client/StatusReport.java), as lines of text with upstream's indent, text styles and the player / team names.
 *
 * upstreamLogLines advances the per-log StatusReport bookkeeping (the indent upstream carries from report to report,
 * the "header printed once" flags), so it must see every report of a log in server order, logged or not.
 */
import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { COMMON_MESSAGES } from './messages/common';
import { MIXED_MESSAGES } from './messages/mixed';
import { RULES_MESSAGES } from './messages/rules';
import { rulesOf, type Report } from './model';
import { UpstreamPrinter } from './printer';
import { resolveRenderer, type UpstreamRendererSet } from './registry';
import { createUpstreamLogState, type UpstreamLogLine, type UpstreamLogState } from './types';

export type { UpstreamLogLine, UpstreamLogSpan, UpstreamLogState, UpstreamSpanStyle, UpstreamLineSpace } from './types';
export { createUpstreamLogState } from './types';

/** Every renderer, keyed by wire reportId. Ruleset-specific ones win, as upstream's Scanner picks the most recent rules. */
export const UPSTREAM_RENDERERS: Readonly<Record<string, UpstreamRendererSet>> = (() => {
  const out: Record<string, UpstreamRendererSet> = {};
  for (const table of [COMMON_MESSAGES, MIXED_MESSAGES, RULES_MESSAGES]) {
    for (const [id, set] of Object.entries(table)) {
      const prior = out[id];
      out[id] = prior && typeof prior !== 'function' && typeof set !== 'function' ? { ...prior, ...set } : set;
    }
  }
  return out;
})();

/**
 * Report ids upstream prints nothing for in BB2020 / BB2025: `none`, `gameOptions` (its renderer is empty), and the
 * BB2016-only reports with no BB2020 / BB2025 renderer (upstream would throw "Unhandled report id"; the server never
 * sends them for these rulesets).
 */
export const UPSTREAM_SILENT_REPORTS: ReadonlySet<string> = new Set([
  'none', 'gameOptions', 'spectators', 'kickoffRiot', 'kickoffThrowARock', 'winningsRoll', 'fanFactorRoll',
  'inducementsBought', 'cardsBought', 'kickTeamMateRoll', 'noPlayersToField', 'swoopDistanceRoll',
]);

/**
 * Reports upstream renders through data the client cannot port: CardEffectRoll asks the BB2016 card itself for its
 * text (Card.cardReport), which no BB2020 / BB2025 game sends. Listed so the coverage test knows.
 */
export const UPSTREAM_UNPORTED_REPORTS: ReadonlySet<string> = new Set(['cardEffectRoll']);

/** ffb-common ReportId, in its own order (the wire names). */
export const UPSTREAM_REPORT_IDS: readonly string[] = [
  'none', 'nervesOfSteel', 'alwaysHungryRoll', 'argueTheCall', 'catchRoll', 'cloudBurster', 'confusionRoll', 'dauntlessRoll',
  'dodgeRoll', 'escapeRoll', 'foulAppearanceRoll', 'goForItRoll', 'interceptionRoll', 'leapRoll', 'passRoll', 'pickUpRoll',
  'rightStuffRoll', 'regenerationRoll', 'safeThrowRoll', 'tentaclesShadowingRoll', 'skillUse', 'reRoll', 'turnEnd',
  'playerAction', 'foul', 'handOver', 'injury', 'apothecaryRoll', 'apothecaryChoice', 'throwIn', 'scatterBall', 'block',
  'blockChoice', 'spectators', 'weather', 'coinThrow', 'receiveChoice', 'kickoffResult', 'kickoffScatter', 'extraReRoll',
  'kickoffRiot', 'kickoffTimeout', 'solidDefenceRoll', 'quickSnapRoll', 'kickoffSequenceActivationsCount',
  'kickoffSequenceActivationsExhausted', 'blitzRoll', 'kickoffOfficiousRef', 'officiousRefRoll', 'kickoffThrowARock',
  'pushback', 'referee', 'kickoffPitchInvasion', 'dodgySnackRoll', 'kickoffDodgySnack', 'throwTeamMateRoll', 'dedicatedFans',
  'scatterPlayer', 'swoopPlayer', 'timeoutEnforced', 'winnings', 'winningsRoll', 'fumbblResultUpload', 'fanFactorRoll',
  'mostValuablePlayers', 'defectingPlayers', 'jumpUpRoll', 'standUpRoll', 'bribesRoll', 'masterChefRoll', 'startHalf',
  'inducement', 'pilingOn', 'chainsawRoll', 'leader', 'secretWeaponBan', 'bloodLustRoll', 'hypnoticGazeRoll', 'biteSpectator',
  'animosityRoll', 'raiseDead', 'blockRoll', 'penaltyShootout', 'doubleHiredStarPlayer', 'doubleHiredStaff', 'spellEffectRoll',
  'wizardUse', 'gameOptions', 'passBlock', 'noPlayersToField', 'playCard', 'cardDeactivated', 'bombOutOfBounds', 'pettyCash',
  'freePettyCash', 'inducementsBought', 'cardsBought', 'cardEffectRoll', 'weepingDaggerRoll', 'kickTeamMateRoll',
  'riotousRookies', 'swarmingPlayersRoll', 'passDeviate', 'cardsAndInducementsBought', 'fanFactor', 'selectBlitzTarget',
  'selectGazeTarget', 'bombExplodesAfterCatch', 'placedBallDirection', 'fumblerooskie', 'animalSavagery', 'projectileVomit',
  'brilliantCoachingReRoll', 'pumpUpTheCrowdReRollLost', 'showStarReRollLost', 'kickTeamMateFumble', 'blockReRoll', 'trapDoor',
  'prayerAmount', 'prayerRoll', 'prayerEnd', 'prayerWasted', 'cheeringFans', 'briberyAndCorruptionReRoll', 'playerEvent',
  'stallerDetected', 'throwAtStallingPlayer', 'indomitable', 'oldPro', 'pickMeUp', 'skillWasted', 'twoForOne',
  'modifiedPassResult', 'modifiedDodgeResultSuccessful', 'raidingParty', 'event', 'hitAndRun', 'skillUseOtherPlayer',
  'thrownKeg', 'pumpUpTheCrowdReRoll', 'showStarReRoll', 'biasedRef', 'weatherMageRoll', 'weatherMageResult',
  'lookIntoMyEyesRoll', 'balefulHex', 'allYouCanEat', 'catchOfTheDay', 'breatheFire', 'thenIStartedBlastin',
  'prayersAndInducementsBought', 'throwAtPlayer', 'steadyFootingRoll', 'mascotUsed', 'teamEvent', 'teamCaptainRoll',
  'gettingEvenRoll', 'saboteurRoll', 'chompRoll', 'chompRemoved', 'puntDirectionRoll', 'puntDistanceRoll',
  'swoopDirectionRoll', 'swoopDistanceRoll', 'dwarfenWisdomRoll',
];

/** One StatusReport per log: the state lives beside the log's own context object (any object the caller keeps). */
const states = new WeakMap<object, UpstreamLogState>();

export function upstreamLogState(key: object): UpstreamLogState {
  let state = states.get(key);
  if (!state) {
    state = createUpstreamLogState();
    states.set(key, state);
  }
  return state;
}

/** Render one report as upstream would, advancing `state`. A report upstream renders nothing for gives []. */
export function renderUpstreamReport(report: Report, game: GameJson | null, state: UpstreamLogState): UpstreamLogLine[] {
  const id = String(report?.reportId ?? '');
  const renderer = resolveRenderer(UPSTREAM_RENDERERS[id], rulesOf(game));
  if (!renderer) return [];
  const out = new UpstreamPrinter(game, state);
  try {
    renderer(report, out, game);
  } catch {
    // upstream's renderer would throw out of the same place: the lines it printed before stay in its log
  }
  return out.finish();
}

/** The FUMBBL-style lines of a report for the log keyed by `logKey` (its ReportLogContext). */
export function upstreamLogLines(report: Report, game: GameJson | null, logKey: object): UpstreamLogLine[] {
  return renderUpstreamReport(report, game, upstreamLogState(logKey));
}

/** The plain text of upstream lines (one line each), e.g. for diagnostics. */
export function upstreamLinesText(lines: readonly UpstreamLogLine[]): string {
  return lines.map((line) => line.text).join('\n');
}
export { upstreamDirectionWord, upstreamLogRows, upstreamLogSegments, type UpstreamLogSegment, type UpstreamLogRowEntry } from './segments';

const SPAN_STYLES = new Set(['bold', 'roll', 'neededRoll', 'explanation', 'turn']);
const LINE_SPACES = new Set(['above', 'below', 'aboveBelow']);
const DIRECTIONS = new Set(['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest']);

/** Shape check for upstream lines carried by a checkpoint row (the spectator checkpoint validator). */
export function validUpstreamLogLines(value: unknown): value is UpstreamLogLine[] {
  if (!Array.isArray(value)) return false;
  return value.every((line) => {
    if (!line || typeof line !== 'object') return false;
    const l = line as Record<string, unknown>;
    const keys = Object.keys(l);
    if (!keys.every((k) => ['text', 'indent', 'space', 'spans', 'names', 'dirs', 'open', 'continues'].includes(k))) return false;
    if (('open' in l && l.open !== true) || ('continues' in l && l.continues !== true)) return false;
    if (typeof l.text !== 'string' || !Number.isInteger(l.indent) || (l.indent as number) < 0 || (l.indent as number) > 6) return false;
    if ('space' in l && !LINE_SPACES.has(String(l.space))) return false;
    const fits = (start: unknown, length: unknown) => Number.isInteger(start) && Number.isInteger(length) && (start as number) >= 0
      && (length as number) > 0 && (start as number) + (length as number) <= (l.text as string).length;
    if (!Array.isArray(l.spans) || !l.spans.every((s) => s && typeof s === 'object' && fits((s as { start?: unknown }).start, (s as { length?: unknown }).length)
      && SPAN_STYLES.has(String((s as { style?: unknown }).style)))) return false;
    if ('dirs' in l && !(Array.isArray(l.dirs) && l.dirs.every((d) => d && typeof d === 'object'
      && fits((d as { index?: unknown }).index, (d as { length?: unknown }).length)
      && DIRECTIONS.has(String((d as { direction?: unknown }).direction))
      && (!('lower' in d) || (d as { lower?: unknown }).lower === true)))) return false;
    return Array.isArray(l.names) && l.names.every((n) => n && typeof n === 'object'
      && fits((n as { index?: unknown }).index, (n as { length?: unknown }).length)
      && ((n as { team?: unknown }).team === 'home' || (n as { team?: unknown }).team === 'away')
      && (!('playerId' in n) || typeof (n as { playerId?: unknown }).playerId === 'string'));
  });
}

/** Shape check for the StatusReport bookkeeping a checkpoint carries. */
export function validUpstreamLogState(value: unknown): value is UpstreamLogState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  const keys = ['indent', 'pettyCashReportReceived', 'cardsBoughtReportReceived', 'inducementsBoughtReportReceived', 'open'];
  return Object.keys(s).length === keys.length && keys.every((k) => k in s) && Number.isInteger(s.indent)
    && typeof s.pettyCashReportReceived === 'boolean' && typeof s.cardsBoughtReportReceived === 'boolean'
    && typeof s.inducementsBoughtReportReceived === 'boolean' && typeof s.open === 'boolean';
}
