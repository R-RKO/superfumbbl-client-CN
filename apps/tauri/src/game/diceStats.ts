// Owner 09-17: per-game DICE STATISTICS, tallied from the server's report stream as frames are applied (live play,
// spectate and replay all pass through applyFrameContents). Everything here is derived from stated report fields —
// no client-side dice are ever counted. Feeds the end screen's Dice tab and the Statistics rows for failed
// blocks / dodges.
//
// Attribution: a roll belongs to the team (and player) that ROLLED it. Armour and injury dice are rolled by the
// attacking side, so they ride the attacker latched from the opening `block` report (or the acting player, as the
// log formatter does); dodge / rush / pickup / catch rolls belong to their playerId.
// Owner 10-13: armour and injury stats are ONLY the rolls a team made against its opponent. A roll with no attacker
// on the other team (a failed dodge / rush / jump, a crowd push, Ball & Chain, a team-mate landing on a player, a
// Stab or Chainsaw kickback on oneself) is nobody's attack, so it counts for neither team: no totals, no faces, no
// luck trial, and the victim's team gets no inverted trial for it.
import { reactive } from 'vue';
import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { effectiveArmour, effectiveStat, playerSkillValue } from '@fumbbl40k/ffb-protocol';
import { dodgeSkillCancelledAt, hasSkill as hasSkillWithGrants } from './logic/availableActions';
import { breatheFirePassed } from './breatheFireOutcome';
import {
  actionTrial, injuryTypeFamily, addCount, addTrial, armourBreakThreshold, armourModifierValue, binaryKey, blockFaceScores, blockRollKey, blockRollScore, EITHER_BY_TYPE,
  emptyBucket, emptyLuck, injuryKey, injuryModifierValue, injuryScore6, injuryTrial, koWeight6, likelihoodOf, parseDist, twoD6AtLeast,
  type ArmourRollInput, type BlockMatchup, type DiceLuck, type InjuryLevel, type Likelihood, type LuckBucket, type LuckRow,
} from './diceLuck';
import {
  blockArmourTiers, blockKnockdownChance, bookedTurns, expectedTurns, reportArmourTiers, turnIndex, turnsKey, turnsScore, TURNS_PER_HALF,
  type ArmourTier, type TurnClock,
} from './turnsLost';

export { normalCdf, oneInOdds, type DiceLuck, type Likelihood } from './diceLuck';

export type D6 = 1 | 2 | 3 | 4 | 5 | 6;

/** Owner 10-01 (S67): dodge ATTEMPTS grouped by the number they needed. `attempts` counts first rolls; a re-roll
 *  resolves its attempt as passed-after-re-roll or failed-after-re-roll. Failures with no re-roll = attempts - the
 *  other three. */
export interface DodgeTargetTally {
  attempts: number; passFirst: number; passReroll: number; failReroll: number;
  /** Owner 10-01 r4: attempts with the Dodge SKILL re-roll BUILT IN (the player had Dodge, unused this turn and not
   *  cancelled by Tackle) - whether or not it was needed; `builtFails` = those whose first roll failed (and so were
   *  re-rolled by the skill). Absent on rows tallied before r4. */
  built?: number; builtFails?: number;
}
export interface DiceTally {
  /** Face counts, index 1..6 (index 0 unused). Every D6 the side rolled: dodge, rush, pickup, catch, pass, armour, injury… */
  d6: number[];
  /** Block-die face counts, index 1..6 (1 attacker down, 2 both down, 3-4 push, 5 stumble, 6 pow). */
  block: number[];
  /** 2D6 armour totals and injury totals, one entry per roll. */
  armour: number[];
  injury: number[];
  /** Owner 09-17: dodge-die face counts (index 1..6); "action" dice = every other D6 that is not an armour,
   *  injury or dodge die (see actionFaces). */
  dodgeFaces: number[];
  /** Owner 10-01 (S67): dodge attempts by target number (keys 2..6; absent on tallies cached before this field). */
  dodgeByTarget?: Record<number, DodgeTargetTally>;
  /** Armour and injury FACE counts (index 1..6) so actionFaces can subtract them from the all-D6 tally. */
  armourFaces: number[];
  injuryFaces: number[];
  /** Two-or-more-dice blocks where EVERY die came up attacker-down or both-down for a blocker without Block. */
  oneNinth: number;
  /** Two-or-more-dice blocks where every die came up attacker-down (double skulls). */
  oneThirtySixth: number;
  blocks: number;
  /** Blocks whose CHOSEN result put the attacker down (attacker down; both down without Block or Wrestle). */
  failedBlocks: number;
  dodges: number;
  /** Dodge attempts that ended failed (a re-roll that then succeeds cancels the failure). */
  failedDodges: number;
  /** Owner 09-17: pickup attempts and the ones that ended failed, same re-roll rule as dodges. */
  pickups: number;
  failedPickups: number;
  /** Owner 09-22: rush (Go For It) attempts and the ones that ended failed, same re-roll rule. */
  rushes: number;
  failedRushes: number;
  /** Owner 09-17 (fun facts): ordered sequences — every D6 face, every block-die face, and every success-tested
   *  roll (a D6 against a stated minimum) as it happened. */
  d6Seq: number[];
  blockSeq: number[];
  tests: { target: number; ok: boolean; face: number }[];
  /** Owner 09-25 (fun facts): one entry per completed team turn — how many players were activated before the
   *  turn ended, and whether it ended in a turnover. */
  turns: { half: number; turn: number; activations: number; turnover: boolean }[];
  /** Owner 10-09: the Likelihood rows' trials - every measured roll scored against its fair chance (diceLuck.ts).
   *  Absent on tallies cached before this field: those rows read "not measured". */
  luck?: DiceLuck;
}

export interface DiceStats {
  gameId: string | null;
  seen: Set<number>;
  teams: Record<string, DiceTally>;
  players: Record<string, DiceTally>;
  /** Report-stream context that spans reports: the attacker of the block sequence in progress. */
  lastBlockAttacker: string | null;
  lastFailedDodge: { playerId: string; teamId: string } | null;
  /** Owner 10-01 r4: the source of the last `reRoll` report per player (a re-rolled dodge reads whether the Dodge skill paid for it). */
  lastRerollSource?: { playerId: string; source: string } | null;
  /** S67 r5 (review): the dodge attempt a reroll belongs to - ONE attempt lands in ONE field of the column of its
   *  FIRST roll, whatever the rerolled roll's own target or command. `passed`/`built` = what the first roll tallied. */
  openDodges?: Record<string, { target: number | null; passed: boolean; built: boolean }>;
  lastFailedPickup: { playerId: string; teamId: string } | null;
  lastFailedRush: { playerId: string; teamId: string } | null;
  /** Owner 09-25: the turn in progress per team — the distinct players activated so far (not serialised). */
  activeTurn: Record<string, { half: number; turn: number; players: Set<string> }>;
  /** Owner 10-09 (luck trials): the defender of the block in progress, whether a `block` report has announced a NEW
   *  roll since the last `blockRoll`, whether that roll rerolled only some of its dice, and the rolls waiting for
   *  the `blockChoice` report (it states who picks). */
  lastBlockDefender?: string | null;
  blockRollArmed?: boolean;
  blockRollPartial?: boolean;
  pendingBlockRolls?: { attacker: string | null; defender: string | null; faces: number[]; blitz: boolean; defenderTacklezones: boolean }[];
  /** The acting player when `lastBlockAttacker` was latched: a different acting player means the latch is stale. */
  lastBlockActing?: string | null;
  /** The block-roll reroll in progress was REFUSED by its own roll (a failed Pro / Loner / Team Mascot): the dice that
   *  follow are re-stated, not rolled. Lives only between a `block` report and its `blockRoll`, inside one frame. */
  rerollGateFailed?: boolean;
  /** Rolls of a Multiple Block that were reported and already counted "not measured", per defender: the rest of that
   *  defender's rolls are counted at its `blockChoice`. */
  multiBlockCounted?: Record<string, number>;
  /** `commandNr|defender|dice` of the last armour / injury roll taken as a trial (one roll is one trial). */
  lastArmourTrial?: string | null;
  lastInjuryTrial?: string | null;
  /** Owner 10-10: how much of the game a SPECTATED game's tallies cover (spectatorDiceLedger.ts). Absent = not a
   *  spectated game (play / replay / demo): the pane says nothing. */
  coverage?: DiceCoverage;
  /** Who feeds these tallies (claimDiceStats): a seat / mode change in the SAME game starts them afresh, because each
   *  feeder numbers its commands in its own key space (`seen`). */
  owner?: string;
  /** Bumped whenever the tallies are REPLACED by a rebuild (a pre-join import landing): what was saved from them
   *  before is out of date. */
  revision?: number;
  /** The spectator ledger's turnover context (turnPresentation.ts turnoverArmStep): it rides the tallies so that it
   *  crosses the join boundary with them. */
  turnover?: { turnoverArmed: boolean; turnoverAfterInjury: boolean };
  /** Owner 10-15 (turns lost): the turn state at the end of the last frame taken in - the state an attack in the next
   *  frame was made in (the model handed in is the one AFTER the frame, which may already have ended the turn). */
  turnClock?: TurnClock | null;
  /** The attack whose expected turns were booked at the BLOCK (or Chainsaw roll), per victim: its injury report books
   *  the actual turns against it (or nothing when it was unmeasured). Dropped at every turn end. */
  turnsLinks?: Record<string, TurnsLink>;
  /** Knock-outs counted live, and casualties counted on into overtime (see advanceTurnsLost). */
  turnsOpen?: TurnsEntry[];
  turnsSeq?: number;
  /** The model's defender at the end of the last frame taken in (a Chainsaw attack clears it as it resolves). */
  turnDefender?: string | null;
  /** `commandNr|defender|dice` of the last injury report taken for turns lost (one attack is one trial). */
  lastTurnsTrial?: string | null;
}
/** What one attack's result booked, so a Piling On reroll of it can take it back. */
export interface TurnsBooking { value: number; level: InjuryLevel | null; entry: number | null }
export interface TurnsLink { attacker: string; measured: boolean; booked?: TurnsBooking | null; /** The trial booked at the attack (taken back if its report turns out unmeasurable). */ key?: string }
export interface TurnsEntry {
  id: number; kind: 'ko' | 'cas';
  /** The attacking team and player the turns are counted for. */
  teamId: string; attacker: string;
  victimTeamId: string; playerId: string;
  /** The drive the injury happened in (TurnClock.drive). */
  drive: string;
  /** The victim team's turn index (turnsLost.turnIndex) counted up to so far. */
  idx: number;
  /** Turns added live so far. */
  added: number;
  /** Turns booked up front at the injury (a regulation casualty's), still counted. */
  booked: number;
  /** The victim team's turn index at the injury. */
  start: number;
  /** The lowest index it may be re-synchronised to (a casualty counts only overtime turns live: 16). */
  floor: number;
  /** Over: the player is back, or the booking was taken back. */
  done?: boolean;
}

/** The tally counters the Statistics rows read ("attempts / failed"), per team. */
export const DICE_ROW_KEYS = ['failedBlocks', 'dodges', 'failedDodges', 'pickups', 'failedPickups', 'rushes', 'failedRushes'] as const;
export type DiceRowTotals = Pick<DiceTally, typeof DICE_ROW_KEYS[number]>;
/**
 * Owner 10-10: the Statistics rows of a SPECTATED game AT THE DISPLAYED POSITION. The tallies themselves are folded
 * at ingress and run ahead of the picture (by the playback backlog; without bound while paused or reviewing), so a
 * pane a viewer can open DURING the game reads these instead: the ledger publishes the totals as they stood at the
 * command on screen. `gameId` null = no spectated game is on screen (play / replay / demo read their own tallies).
 */
export interface DisplayedDiceRows {
  gameId: string | null; teams: Record<string, DiceRowTotals>;
  /** The position on screen has no entry of its own (it was never folded, or its entry was dropped): `teams` are the
   *  LAST KNOWN rows and do not advance. Never the head totals. */
  held?: boolean;
}
/** No spectated game's picture is on screen any more (another feeder owns the tallies): the rows guard nothing. */
export function clearDisplayedDiceRows(rows: DisplayedDiceRows): void { rows.gameId = null; rows.teams = {}; rows.held = false; }
export const displayedDiceRows = reactive<DisplayedDiceRows>({ gameId: null, teams: {} }) as DisplayedDiceRows;

/** Owner 10-10: what a spectated game's dice tallies cover. `before` = the rolls from before the join: `none` (joined
 *  before any were made), `imported` (taken from the game's replay data), `missing` (no replay data). `gap` = the
 *  live feed dropped and came back with commands missing in between. */
export interface DiceCoverage { before: 'none' | 'imported' | 'missing'; gap: boolean }
export type DiceCoverageNote = 'whole' | 'before-join-missing' | 'gap';
/** The one line the Dice pane shows for a coverage (null = say nothing: not a spectated game). */
export function diceCoverageNote(coverage: DiceCoverage | null | undefined): DiceCoverageNote | null {
  if (!coverage) return null;
  if (coverage.before === 'missing') return 'before-join-missing';
  return coverage.gap ? 'gap' : 'whole';
}
/** The pane's wording (owner to rule). */
export const DICE_COVERAGE_TEXT: Readonly<Record<DiceCoverageNote, string>> = {
  whole: 'Whole game',
  'before-join-missing': 'Dice from before you joined are not included.',
  gap: 'Dice rolled while the live feed was down are not included.',
};

export function emptyTally(): DiceTally {
  return { d6: [0, 0, 0, 0, 0, 0, 0], block: [0, 0, 0, 0, 0, 0, 0], armour: [], injury: [],
    dodgeFaces: [0, 0, 0, 0, 0, 0, 0], armourFaces: [0, 0, 0, 0, 0, 0, 0], injuryFaces: [0, 0, 0, 0, 0, 0, 0], oneNinth: 0, oneThirtySixth: 0,
    blocks: 0, failedBlocks: 0, dodges: 0, failedDodges: 0, pickups: 0, failedPickups: 0, rushes: 0, failedRushes: 0, d6Seq: [], blockSeq: [], tests: [], turns: [],
    luck: emptyLuck() };
}

export function emptyDiceStats(gameId: string | null = null): DiceStats {
  return { gameId, seen: new Set(), teams: {}, players: {}, lastBlockAttacker: null, lastFailedDodge: null, lastFailedPickup: null, lastFailedRush: null, activeTurn: {} };
}

/** Replace everything `target` holds with `source`'s tallies and report-stream context, in place (the end screen
 *  holds on to the one reactive `diceStats` object). */
export function adoptDiceStats(target: DiceStats, source: DiceStats): void {
  const fresh = emptyDiceStats(source.gameId);
  const keys = new Set([...Object.keys(target), ...Object.keys(fresh), ...Object.keys(source)]) as Set<keyof DiceStats>;
  const from = { ...fresh, openDodges: {}, pendingBlockRolls: [], multiBlockCounted: {}, turnsLinks: {}, turnsOpen: [], ...source } as Record<string, unknown>;
  for (const key of keys) {
    if (key in from) (target as unknown as Record<string, unknown>)[key] = from[key];
    else delete (target as unknown as Record<string, unknown>)[key];
  }
}

/** Make `owner` the feeder of `stats` for `gameId`: a different owner or game starts the tallies afresh. Returns true
 *  when it did. (Before 10-10 only a game change did - a spectated game then PLAYED kept `seen` keys from the other
 *  feeder's numbering and silently skipped rolls.) */
export function claimDiceStats(stats: DiceStats, owner: string, gameId: string | null): boolean {
  if (stats.owner === owner && stats.gameId === gameId) return false;
  adoptDiceStats(stats, { ...emptyDiceStats(gameId), owner });
  return true;
}

/** The live tally the end screen reads. Reset whenever a different game's frames start arriving. */
export const diceStats = reactive<DiceStats>(emptyDiceStats()) as DiceStats;

type Report = Record<string, unknown>;
type PlayerLike = { playerId: string; positionId?: string; skillArray?: string[] };
type TeamLike = { teamId: string; playerArray: PlayerLike[]; roster?: { positionArray?: { positionId: string; skillArray?: string[] }[] } };

function isD6(v: unknown): v is D6 { return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6; }

function teamOf(game: GameJson | null, playerId: string | null): TeamLike | null {
  if (!game || !playerId) return null;
  const home = game.teamHome as unknown as TeamLike;
  const away = game.teamAway as unknown as TeamLike;
  if (home.playerArray.some((p) => p.playerId === playerId)) return home;
  if (away.playerArray.some((p) => p.playerId === playerId)) return away;
  return null;
}

function hasSkill(team: TeamLike | null, playerId: string | null, ...names: string[]): boolean {
  if (!team || !playerId) return false;
  const player = team.playerArray.find((p) => p.playerId === playerId);
  if (!player) return false;
  const position = team.roster?.positionArray?.find((p) => p.positionId === player.positionId);
  const skills = [...(player.skillArray ?? []), ...(position?.skillArray ?? [])].map((s) => String(s).toLowerCase());
  return names.some((n) => skills.includes(n.toLowerCase()));
}

/** Owner 10-01 r4: was the Dodge skill re-roll BUILT IN to this dodge? The player has Dodge, has not used it this turn
 *  (`usedSkills`), and no opposing Tackle stood next to the square dodged FROM (the last track number; unknown = not
 *  cancelled). Read at the roll's own frame, so a dodge that passed first time is still counted. */
function dodgeRerollBuiltIn(game: GameJson | null, team: TeamLike | null, playerId: string | null): boolean {
  // r5 (review): a Dodge GRANTED for the game (prayer, card) counts - the server's own check reads the union
  if (!game || !team || !playerId || !(hasSkill(team, playerId, 'Dodge') || hasSkillWithGrants(game, playerId, 'Dodge'))) return false;
  const player = team.playerArray.find((p) => p.playerId === playerId) as { usedSkills?: unknown } | undefined;
  const used = Array.isArray(player?.usedSkills) ? (player!.usedSkills as unknown[]).map((s) => String(s).toLowerCase()) : [];
  if (used.includes('dodge')) return false;
  const track = ((game.fieldModel as unknown as { trackNumberArray?: { number?: unknown; coordinate?: unknown }[] } | undefined)?.trackNumberArray ?? [])
    .filter((t) => typeof t?.number === 'number' && Array.isArray(t.coordinate))
    .sort((a, b) => Number(b.number) - Number(a.number))[0];
  const origin = track ? (track.coordinate as [number, number]) : null;
  return !(origin && dodgeSkillCancelledAt(game, playerId, [Number(origin[0]), Number(origin[1])]));
}

function tallyFor(stats: DiceStats, teamId: string | null, playerId: string | null): DiceTally[] {
  const out: DiceTally[] = [];
  if (teamId) out.push(stats.teams[teamId] ??= emptyTally());
  if (playerId) out.push(stats.players[playerId] ??= emptyTally());
  return out;
}

/** Report ids whose `roll` (or `rolls`) field is an ordinary D6 rolled by `playerId`. */
const D6_ROLL_FIELDS: Record<string, string[]> = {
  dodgeRoll: ['roll'], goForItRoll: ['roll'], pickUpRoll: ['roll'], catchRoll: ['roll'], passRoll: ['roll'],
  interceptionRoll: ['roll'], jumpRoll: ['roll'], leapRoll: ['roll'], standUpRoll: ['roll'], confusionRoll: ['roll'],
  wildAnimalRoll: ['roll'], reallyStupidRoll: ['roll'], takeRootRoll: ['roll'], boneHeadRoll: ['roll'],
  alwaysHungryRoll: ['roll'], escapeRoll: ['roll'], rightStuffRoll: ['roll'], safeThrowRoll: ['roll'],
  foulAppearanceRoll: ['roll'], dauntlessRoll: ['roll'], regenerationRoll: ['roll'], bloodLustRoll: ['roll'],
  hypnoticGazeRoll: ['roll'], animalSavageryRoll: ['roll'], unchannelledFuryRoll: ['roll'], breatheFire: ['roll'],
  steadyFootingRoll: ['roll'], argueTheCall: ['roll'], bribesRoll: ['roll'], throwInRoll: ['roll'],
  kickTeamMateRoll: ['rolls'], scatterBall: [], thrownPlayerRoll: ['rolls'],
  // Astra F4 (10-09): the rest of upstream's ReportSkillRoll family (report/ReportSkillRoll.java:107-123 - one D6 as
  // `roll`, a `minimumRoll`, a `successful`): each is a D6 the side rolled and an action trial.
  chainsawRoll: ['roll'], animosityRoll: ['roll'], throwTeamMateRoll: ['roll'], jumpUpRoll: ['roll'], weepingDaggerRoll: ['roll'],
  projectileVomit: ['roll'], lookIntoMyEyesRoll: ['roll'], balefulHex: ['roll'], allYouCanEat: ['roll'], catchOfTheDay: ['roll'],
  gettingEvenRoll: ['roll'], saboteurRoll: ['roll'], chompRoll: ['roll'],
};

function pushD6(tallies: DiceTally[], value: unknown, category?: 'armourFaces' | 'injuryFaces' | 'dodgeFaces'): void {
  if (!isD6(value)) return;
  for (const t of tallies) {
    t.d6[value] = (t.d6[value] ?? 0) + 1;
    t.d6Seq.push(value);
    if (category) t[category][value] = (t[category][value] ?? 0) + 1;
  }
}
/** A D6 rolled against a stated minimum (dodge, rush, pickup, catch, pass…): recorded in order for the streak facts. */
function pushTest(tallies: DiceTally[], r: Record<string, unknown>): void {
  const target = Number(r.minimumRoll);
  if (!isD6(r.roll) || !Number.isInteger(target) || target < 2 || target > 6 || typeof r.successful !== 'boolean') return;
  for (const t of tallies) t.tests.push({ target, ok: r.successful, face: r.roll });
}
/** Every D6 that is not an armour, injury or dodge die (index 1..6). */
export function actionFaces(t: DiceTally): number[] {
  return t.d6.map((n, i) => Math.max(0, n - (t.armourFaces[i] ?? 0) - (t.injuryFaces[i] ?? 0) - (t.dodgeFaces[i] ?? 0)));
}
/** 2D6 total counts, index 2..12 (0 and 1 unused). */
export function twoD6Totals(values: readonly number[]): number[] {
  const out = new Array<number>(13).fill(0);
  for (const v of values) if (v >= 2 && v <= 12) out[v] = (out[v] ?? 0) + 1;
  return out;
}
/** The fair share of each 2D6 total, index 2..12. */
export const TWO_D6_SHARE = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((n) => n / 36);

// ---- luck trials (owner 10-09; the maths and the rules mirrors live in diceLuck.ts) ----

/** skipInjuryParts values that hide the armour / the injury part (report/logcontrol/SkipInjuryParts.java:3-10). */
const ARMOUR_PART_HIDDEN = new Set(['ARMOUR', 'ARMOUR_AND_CAS', 'ARMOUR_AND_INJURY', 'EVERYTHING_BUT_CAS']);
const INJURY_PART_HIDDEN = new Set(['INJURY', 'ARMOUR_AND_INJURY', 'EVERYTHING_BUT_CAS']);

function luckOf(t: DiceTally, row: LuckRow): LuckBucket { return (t.luck ??= emptyLuck())[row]; }
function turnsOf(t: DiceTally): LuckBucket { return (t.luck ??= emptyLuck()).turns ??= emptyBucket(); }
/** The skill union the dodge helper reads: the player's own + roster position skills, or one granted for the game. */
function has(game: GameJson | null, playerId: string | null, name: string): boolean {
  return !!game && !!playerId && (hasSkill(teamOf(game, playerId), playerId, name) || hasSkillWithGrants(game, playerId, name));
}
function playerJson(game: GameJson | null, playerId: string | null): (PlayerLike & Record<string, unknown>) | null {
  return (teamOf(game, playerId)?.playerArray.find((p) => p.playerId === playerId) as (PlayerLike & Record<string, unknown>) | undefined) ?? null;
}
function otherTeam(game: GameJson | null, team: TeamLike | null): TeamLike | null {
  if (!game || !team) return null;
  const home = game.teamHome as unknown as TeamLike;
  return home.teamId === team.teamId ? (game.teamAway as unknown as TeamLike) : home;
}
/** Mighty Blow's value for this attacker (skill/bb2025/MightyBlow.java:4 - default 1): the player's own, else the roster position's. */
function mightyBlowValue(game: GameJson | null, attackerId: string | null): number {
  const player = playerJson(game, attackerId);
  if (!player) return 1;
  const own = playerSkillValue(player as never, 'Mighty Blow');
  if (own != null && own > 0) return own;
  const position = (teamOf(game, attackerId)?.roster?.positionArray ?? []).find((p) => p.positionId === player.positionId) as { skillArray?: string[]; skillValues?: (string | null)[] } | undefined;
  const at = (position?.skillArray ?? []).indexOf('Mighty Blow');
  const value = at >= 0 ? Number(position?.skillValues?.[at]) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : 1;
}
function gameOption(game: GameJson | null, id: string): string | null {
  const options = (game as unknown as { gameOptions?: { gameOptionArray?: { gameOptionId?: unknown; gameOptionValue?: unknown }[] } } | null)?.gameOptions?.gameOptionArray ?? [];
  const hit = options.find((o) => o.gameOptionId === id);
  return hit ? String(hit.gameOptionValue) : null;
}
/** The KO weight for a victim on `team` (diceLuck.koWeight6): that team's Bloodweiser Kegs + Bugman's XXXXXX in the
 *  game model at this frame (turnData inducementSet; inducement/bb2025/InducementCollection.java:61-62, :139-141).
 *  No inducement data in the model = no kegs = the owner's 0.5. */
function koWeightFor(game: GameJson | null, team: TeamLike | null): number {
  if (!game || !team) return koWeight6(0);
  const home = (game.teamHome as unknown as TeamLike).teamId === team.teamId;
  const set = ((home ? game.turnDataHome : game.turnDataAway) as { inducementSet?: { inducementArray?: unknown[] } } | undefined)?.inducementSet?.inducementArray ?? [];
  let modifier = 0;
  for (const entry of set as { inducementType?: unknown; value?: unknown }[]) {
    if (entry?.inducementType === 'bloodweiserBabes' || entry?.inducementType === 'bugmansXXXXXX') modifier += Number(entry.value) || 0;
  }
  return koWeight6(modifier);
}

/** A D6 against a stated minimum is one action trial for the roller - every roll, a rerolled one included.
 *  No stated minimum (absent, or the 0 an unset one serialises as) = not a trial. */
function pushActionLuck(tallies: DiceTally[], r: Record<string, unknown>, ruleUnknown = false): void {
  const minimum = Number(r.minimumRoll);
  if (!isD6(r.roll) || r.minimumRoll == null || !Number.isInteger(minimum) || minimum < 1 || typeof r.successful !== 'boolean') return;
  // Astra N6: whether a roll is measured must not depend on how the die fell. `ruleUnknown` is decided from the
  // report's kind and the roller alone (see passingRuleUnknown); the cross-check below is only a last-resort guard -
  // it fired on none of the 518 target rolls in the capture fixtures.
  const trial = ruleUnknown ? null : actionTrial(minimum, r.roll, r.successful);
  for (const t of tallies) {
    const bucket = luckOf(t, 'action');
    // UNMEASURED: the roll's rule is not "a 6 always passes, a 1 always fails, else roll >= minimum"
    if (!trial) { bucket.unmeasured += 1; continue; }
    addTrial(bucket, trial.key, trial.x6);
    addCount(bucket, 'passed', r.successful ? 1 : 0);
    addCount(bucket, 'expected', trial.p);
  }
}

/** A pass or a throw / kick of a team-mate by a player with no Passing stat fumbles on EVERY face, whatever minimum
 *  the report states (skillbehaviour/bb2025/ThrowTeamMateBehaviour.java:87-93, :131-137; mechanics/bb2025/
 *  PassMechanic.java:74, :99): not a fair-dice trial for any face - the whole roll is unmeasured. */
function passingRuleUnknown(game: GameJson | null, id: string, playerId: string | null): boolean {
  if (id !== 'passRoll' && id !== 'throwTeamMateRoll') return false;
  const player = playerJson(game, playerId);
  if (!player) return true;
  return !(Number(player.passing) > 0) || !(effectiveStat(player as never, 'PA') > 0);
}
/** PlayerState.hasTacklezones (PlayerState.java:230-233): standing, moving or blocked, and neither confused nor
 *  hypnotized. A state this model does not carry reads as having them (the ordinary case for a player being blocked). */
function defenderHasTacklezones(game: GameJson | null, playerId: string | null): boolean {
  const data = (game?.fieldModel?.playerDataArray as { playerId?: string; playerState?: unknown }[] | undefined)?.find((d) => d.playerId === playerId);
  const state = Number(data?.playerState);
  if (!data || !Number.isFinite(state)) return true;
  const base = state & 0xff;
  return (base === 0x01 || base === 0x02 || base === 0x0c) && (state & 0x200) === 0 && (state & 0x800) === 0;
}
/** The blocker of a block-family report that names none: the latched one while the same player is still acting,
 *  else the acting player (Astra N3: a Multiple Block's first rolls come with no `block` report to refresh the latch,
 *  so the previous blocker - possibly on the other team - must never be used). */
function currentBlocker(stats: DiceStats, actingId: string | null): string | null {
  if (actingId && (stats.lastBlockAttacker == null || stats.lastBlockActing !== actingId)) {
    stats.lastBlockAttacker = actingId;
    stats.lastBlockActing = actingId;
  }
  return stats.lastBlockAttacker ?? actingId;
}

/*
 * WHICH injury reports are an attack roll (owner 10-13: only the rolls you made against your opponent count).
 * Audited against upstream fumbbl40k-server (every InjuryType in ffb-common/.../injury and every handleInjury call
 * site; wire names, "ForSpp" / "WithChainsaw" stripped by injuryTypeFamily). An opposing `attackerId` alone is NOT
 * proof: upstream passes the BLOCK DEFENDER as "attacker" when the blocker himself falls and on a failed Blitz rush
 * (bb2025/shared/StepDropFallingPlayers.java:192, :202), and the acting player as "attacker" for Wrestle on a
 * Ball & Chain player (WrestleBehaviour.java:95; the roll is the hard-coded [5,5] of InjuryTypeBallAndChain).
 *
 *  COUNTS for the attacker's team (stated attacker, on the other team from the victim):
 *    block, blockProne, blockStunned (+ForSpp)  EXCEPT the blocker's own fall (Skull / Both Down): the stated "attacker"
 *                                               is the model's block DEFENDER and the victim the acting player
 *    saboteur, sabotaged                        sabotage by the opposing player (victim may be the acting player)
 *    foul (+ForSpp, +WithChainsaw), chainsaw, stab, breatheFire, projectileVomit, quickBite, bitten,
 *    pilingOnArmor, pilingOnInjury   (pilingOnKnockedOut passes a null attacker and rolls no dice, so it never counts)
 *    (a kickback on oneself names a same-team victim, so the team test drops it)
 *  COUNTS for the ACTING player when the victim is on the other team: the thrower of record at the moment of the
 *    hit. The stated attacker is NEVER used: it names the SPP / skill beneficiary, not the owner: bombForSpp = the
 *    ORIGINAL bombardier (StepPass.java:165, StepSpecialEffect.java:178), who is not the thrower once a catcher
 *    re-throws or fumbles (StepEndBomb.java:154); ttmHitPlayerForSpp = the thrown player (Lethal Flight) or the
 *    thrower / kicker for the KTM SPP property (StepInitScatterPlayer.java:310, :318-322);
 *    a victim on the acting player's own team counts for nobody. The acting player is not always the original
 *    thrower either (Swoop re-actors to the swooper, StepSwoop.java:233), and that is the intent:
 *    bomb (+ForSpp), ttmHitPlayer (+ForSpp), startedBlastin, kegHit
 *  COUNTS for NOBODY (no opposing attack, or environmental):
 *    dropDodge, dropDodgeForSpp (Arm Bar supplies the opposing player but it is a failed dodge), dropGfi, dropLeap,
 *    crowdpush, crowdpushForSpp, ktmCrowd, trapdoorFall (+ForSpp: environmental), ttmLanding, eatPlayer,
 *    ktmInjury, ktmFumbleInjury, ktmFumbleApoKoInjury, fireball, lightning, throwARock (inducement / spell /
 *    fan: no player in the report to credit)
 *  SYNTHETIC dice, ignored: ballAndChain (a fixed [5,5], not rolled)
 *  Anything unknown: nobody.
 */
const ATTACK_FAMILIES = new Set(['block', 'blockProne', 'blockStunned', 'saboteur', 'sabotaged', 'foul', 'chainsaw', 'stab', 'breatheFire',
  'projectileVomit', 'quickBite', 'bitten', 'pilingOnArmor', 'pilingOnInjury']);
const BLOCK_FALL_FAMILIES = new Set(['block', 'blockProne', 'blockStunned']);
const ACTING_ATTACK_FAMILIES = new Set(['bomb', 'ttmHitPlayer', 'startedBlastin', 'kegHit']);

/**
 * The attacker whose armour / injury roll an `injury` report is, or null when it is nobody's attack (see the table
 * above). Always on the OTHER team from the defender.
 */
function inflictingAttacker(stats: DiceStats, game: GameJson | null, r: Report, actingId: string | null): string | null {
  const type = String(r.injuryType ?? '');
  const family = injuryTypeFamily(type);
  const defenderId = typeof r.defenderId === 'string' ? r.defenderId : null;
  const stated = typeof r.attackerId === 'string' ? r.attackerId : null;
  let attacker: string | null = null;
  if (family === '' || BLOCK_FALL_FAMILIES.has(family) || family === 'foul') {
    // a block / foul report that names no attacker: the latched blocker / acting player, as the log formatter does
    attacker = stated ?? stats.lastBlockAttacker ?? actingId;
    // the blocker's own fall: upstream names the block defender as the attacker and the acting player as the victim
    // Upstream's fall is the exact mirror of a block: the "attacker" is the model's block DEFENDER and the victim is the
    // acting player; a real block has the acting player as the attacker. (Victim = acting alone proves nothing: a stale
    // actor can be blocked. Game 1949262 command 1363 is a genuine Skull fall, rejected correctly by this rule.)
    if (family !== 'foul' && stated && defenderId && defenderId === (actingId ?? stats.lastBlockAttacker) && stated === (game as { defenderId?: string } | null)?.defenderId) return null;
  } else if (ATTACK_FAMILIES.has(family)) attacker = stated;
  else if (ACTING_ATTACK_FAMILIES.has(family)) attacker = actingId;
  const a = teamOf(game, attacker), d = teamOf(game, defenderId);
  return attacker && a && d && a.teamId !== d.teamId ? attacker : null;
}

/**
 * The armour roll and the injury roll of one `injury` report, as luck trials for the ATTACKER's team (and the
 * attacker) only: the roll as it fell (a break / a removal is good). The defender's team gets no inverted trial.
 */
/** The armour roll of an `injury` report, as diceLuck.armourBreakThreshold reads it. */
function armourInputFor(game: GameJson | null, r: Report, attackerId: string, armour: [number, number]): ArmourRollInput {
  const defenderId = typeof r.defenderId === 'string' ? r.defenderId : null;
  const names = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  const attackerTeam = teamOf(game, attackerId), own = teamOf(game, defenderId);
  return {
    av: effectiveArmour(playerJson(game, defenderId) as never), total: armour[0] + armour[1], broken: r.armorBroken === true, injuryType: String(r.injuryType ?? ''),
    armourModifiers: names(r.armorModifiers), injuryModifiers: names(r.injuryModifiers), hasInjuryRoll: Array.isArray(r.injuryRoll) && r.injuryRoll.length === 2,
    mightyBlow: mightyBlowValue(game, attackerId),
    attackerHasClaws: has(game, attackerId, 'Claws') || has(game, attackerId, 'Claw'),
    chainsawInvolved: has(game, attackerId, 'Chainsaw') || has(game, defenderId, 'Chainsaw'),
    defenderHasIronHardSkin: has(game, defenderId, 'Iron Hard Skin'),
    sameTeam: !!attackerTeam && !!own && attackerTeam.teamId === own.teamId,
    clawDoesNotStack: gameOption(game, 'clawDoesNotStack') !== 'false',
    mbStacksAgainstChainsaw: gameOption(game, 'mbStacksAgainstChainsaw') === 'true',
  };
}

function noteInjuryReportLuck(stats: DiceStats, game: GameJson | null, commandNr: number | null, r: Report, attackerId: string, armour: [number, number] | null, injury: [number, number] | null): void {
  const defenderId = typeof r.defenderId === 'string' ? r.defenderId : null;
  const own = teamOf(game, defenderId);
  const them = otherTeam(game, own);
  const defender = playerJson(game, defenderId);
  if (!game || !own || !them || !defender) return; // nobody to score it for
  const theirs = tallyFor(stats, them.teamId, attackerId);
  const names = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  const injuryModifiers = names(r.injuryModifiers);
  const mightyBlow = mightyBlowValue(game, attackerId);

  if (armour && typeof r.armorBroken === 'boolean') {
    const key = `${commandNr}|${defenderId}|${armour[0]},${armour[1]}`;
    if (commandNr == null || key !== stats.lastArmourTrial) {
      stats.lastArmourTrial = key;
      const threshold = armourBreakThreshold(armourInputFor(game, r, attackerId, armour));
      // UNMEASURED: see armourBreakThreshold - an unvalued modifier, a result that disagrees with this client's
      // armour value, or a break whose left-over modifiers cannot be read
      if (threshold == null) { for (const t of theirs) luckOf(t, 'armour').unmeasured += 1; }
      else {
        const breaks = twoD6AtLeast(threshold); // of 36
        for (const t of theirs) {
          const b = luckOf(t, 'armour');
          addTrial(b, binaryKey(breaks, 36), r.armorBroken ? 6 : 0);
          addCount(b, 'theirRolls', 1); addCount(b, 'theirBroken', r.armorBroken ? 1 : 0); addCount(b, 'theirExpected', breaks / 36);
        }
      }
    }
  }

  if (injury) {
    const key = `${commandNr}|${defenderId}|${injury[0]},${injury[1]}`;
    if (commandNr == null || key !== stats.lastInjuryTrial) {
      stats.lastInjuryTrial = key;
      const trial = injuryTrial({ dice: injury, modifiers: injuryModifiers, thickSkull: has(game, defenderId, 'Thick Skull'), mightyBlow, statedState: Number(r.injury) & 0xff });
      // UNMEASURED: an unvalued modifier, or a stated result that is not this table's for the roll
      if (!trial) { for (const t of theirs) luckOf(t, 'injury').unmeasured += 1; }
      else {
        const ko6 = koWeightFor(game, own); // the VICTIM's team's kegs
        const expected6 = parseDist(injuryKey(trial.counts, ko6, false)).mean6;
        for (const [list, mine, side] of [[theirs, false, 'their']] as const) {
          for (const t of list) {
            const b = luckOf(t, 'injury');
            addTrial(b, injuryKey(trial.counts, ko6, mine), injuryScore6(trial.level, ko6, mine));
            addCount(b, `${side}Rolls`, 1);
            if (trial.level === 1) addCount(b, `${side}Kos`, 1);
            if (trial.level === 2) addCount(b, `${side}Casualties`, 1);
            addCount(b, `${side}Value`, injuryScore6(trial.level, ko6, false) / 6);
            addCount(b, `${side}Expected`, expected6 / 6);
          }
        }
      }
    }
  }
}

// ---- turns lost (owner 10-15; the definitions and the maths live in turnsLost.ts) ----
//
// EXPECTED turns, summed at the ATTACK over every attack a team makes on its opponent (owner 10-15: "indicative of the
// entire probability state" - an attack that misses still adds its chance):
//   expected += P(the attack reaches the armour roll)
//             x Σ over the ways the armour can break: P(2D6 breaks it that way)            (turnsLost.ArmourTier)
//             x Σ over the injury results: P(result | that way's injury modifier, the victim's table: Stunty, Thick Skull)
//             x turns(result, now)                                                         (turnsLost.turnsScore)
// P(reaches the armour roll), per kind of attack:
//   block            P(the defender is knocked down): the dice count and who picks (the `blockChoice`), and the match-up
//                    the Block dice row already reads (Block, Wrestle, Dodge, Tackle, Juggernaut on a Blitz, tackle zones)
//                    - turnsLost.blockKnockdownChance. Booked at the `blockChoice`, whatever is then picked; its armour from
//                    the model (AV, Mighty Blow, Claws, Chainsaw, Iron Hard Skin - turnsLost.blockArmourTiers). Rerolls of
//                    the block dice are not modelled: the chance is the dice count's own. A push into the crowd is not a
//                    knock-down here and counts for nobody (a crowd push is nobody's attack).
//   Chainsaw attack  the Chainsaw roll's own chance, (7 - minimum) / 6 (a 2+: 5/6), then armour +3 (none through Iron
//                    Hard Skin), no injury modifier (InjuryTypeChainsaw) - booked at its first `chainsawRoll`.
//   everything else  1 at the armour roll, read from the attack's own report (diceLuck.armourBreakThreshold and the
//                    armour-or-injury hand-over, turnsLost.reportArmourTiers): a foul (the victim is already down: assists
//                    +1 / -1 each on the armour only - InjuryTypeFoul.java:59-63 - and Dirty Player / A Sneaky Pair on the
//                    armour when the roll without them fails, else on the injury; no Mighty Blow), a Chainsaw foul (the
//                    Chainsaw roll is not modelled there), a stab, Breathe Fire, Projectile Vomit, bites, sabotage, bombs,
//                    thrown players, kegs, Then I Started Blastin. A hit that breaks armour with no armour roll reaches the
//                    injury roll with certainty.
//   Piling On        a reroll of an attack already counted: no new chance; its result replaces the earlier one.
// ACTUAL turns: the turns the victims actually missed from those attacks' results (turnsLost header): a stun and a
// casualty booked at the injury, a knock-out counted live (advanceTurnsLost), a casualty counted on into overtime.
// A sent-off fouler costs his own team, not the opponent: nothing here. An attack whose chance cannot be read soundly
// (an unvalued modifier, a Multiple Block, a block whose `blockChoice` was not seen) is UNMEASURED for both figures.

/** The turn state of a model: null when it carries no half / turn data (the turns row then goes unmeasured). */
export function readTurnClock(game: GameJson | null): TurnClock | null {
  if (!game) return null;
  const half = Number(game.half);
  const home = Number((game.turnDataHome as { turnNr?: unknown } | undefined)?.turnNr);
  const away = Number((game.turnDataAway as { turnNr?: unknown } | undefined)?.turnNr);
  if (!Number.isInteger(half) || half < 1 || half > 3 || !Number.isFinite(home) || !Number.isFinite(away)) return null;
  const result = game.gameResult as { teamResultHome?: { score?: unknown }; teamResultAway?: { score?: unknown } } | undefined;
  const score = (Number(result?.teamResultHome?.score) || 0) + (Number(result?.teamResultAway?.score) || 0);
  return { half, turnHome: home, turnAway: away, drive: `${half}|${score}` };
}
function clockTurnOf(game: GameJson, clock: TurnClock, teamId: string): number {
  return (game.teamHome as unknown as TeamLike).teamId === teamId ? clock.turnHome : clock.turnAway;
}
function playerBaseState(game: GameJson, playerId: string): number | null {
  const data = (game.fieldModel?.playerDataArray as { playerId?: string; playerState?: unknown }[] | undefined)?.find((d) => d.playerId === playerId);
  const state = Number(data?.playerState);
  return data && Number.isFinite(state) ? state & 0xff : null;
}
const KNOCKED_OUT = 5, RESERVE = 9, FALLING = 11;
function fallingWithTacklezones(game: GameJson, playerId: string): boolean {
  const data = (game.fieldModel?.playerDataArray as { playerId?: string; playerState?: unknown }[] | undefined)?.find((d) => d.playerId === playerId);
  const state = Number(data?.playerState);
  return Number.isFinite(state) && (state & 0xff) === FALLING && (state & 0x200) === 0 && (state & 0x800) === 0;
}
function turnsUnmeasured(tallies: DiceTally[]): void { for (const t of tallies) turnsOf(t).unmeasured += 1; }
function addTurnsTrial(tallies: DiceTally[], key: string, sign: 1 | -1 = 1): void {
  const expected = expectedTurns(key);
  for (const t of tallies) {
    const b = turnsOf(t);
    if (sign > 0) addTrial(b, key, 0); // the actual turns are added as they are lost (bookTurns, advanceTurnsLost)
    else { b.n -= 1; b.kinds[key] = (b.kinds[key] ?? 0) - 1; if (b.kinds[key]! <= 0) delete b.kinds[key]; }
    addCount(b, 'attacks', sign); addCount(b, 'expected', sign * expected);
  }
}
function addLostTurns(stats: DiceStats, teamId: string, attacker: string, turns: number, result: InjuryLevel | null, sign: 1 | -1): void {
  for (const t of tallyFor(stats, teamId, attacker)) {
    const b = turnsOf(t);
    b.x6 += sign * turns * 6;
    addCount(b, 'lost', sign * turns);
    if (result != null) addCount(b, result === 0 ? 'stuns' : result === 1 ? 'kos' : 'casualties', sign);
  }
}
/** Book an attack's result for the attacking team: a stun and a casualty now, a knock-out live (an open entry). */
function bookTurns(stats: DiceStats, game: GameJson, clock: TurnClock, teamId: string, attacker: string, victimTeamId: string, playerId: string, level: InjuryLevel | null): TurnsBooking {
  if (level == null) return { value: 0, level: null, entry: null };
  const turnNr = clockTurnOf(game, clock, victimTeamId);
  const value = level === 2 && clock.half >= 3 ? 0 : bookedTurns(level, turnsScore(clock.half, turnNr, 0));
  addLostTurns(stats, teamId, attacker, value, level, 1);
  if (level === 0) return { value, level, entry: null };
  const id = stats.turnsSeq = (stats.turnsSeq ?? 0) + 1;
  // a regulation casualty's turns are booked above (none for an overtime one, Astra r1 #4: a golden goal can end the
  // game before they are played); overtime turns are counted on as they start (from turn index 16)
  const start = turnIndex(clock.half, turnNr);
  const floor = level === 1 ? 0 : Math.max(start, 2 * TURNS_PER_HALF);
  (stats.turnsOpen ??= []).push({ id, kind: level === 1 ? 'ko' : 'cas', teamId, attacker, victimTeamId, playerId, drive: clock.drive, idx: Math.max(start, floor), added: 0, booked: value, start, floor });
  return { value: 0, level, entry: id };
}
function unbookTurns(stats: DiceStats, teamId: string, attacker: string, booking: TurnsBooking | null | undefined): void {
  if (!booking) return;
  let value = booking.value;
  const entry = booking.entry == null ? null : (stats.turnsOpen ?? []).find((e) => e.id === booking.entry);
  if (entry) { value += entry.booked + entry.added; entry.done = true; }
  addLostTurns(stats, teamId, attacker, value, booking.level, -1);
}
/**
 * Count the turns the victims of open knock-outs (and casualties, into overtime) miss as the victim's team starts its
 * turns. A knock-out counts every team turn started during the injury's drive (the player cannot come back in it,
 * apothecary or not), and in any later drive while the player is still knocked out (a failed recovery roll at that
 * kick-off); the first later drive where the player is no longer knocked out ends it. Idempotent: an index counted
 * once is never counted again, so a re-applied frame or a replay seek adds nothing.
 */
export function advanceTurnsLost(stats: DiceStats, game: GameJson | null): void {
  const clock = readTurnClock(game);
  if (!game || !clock || !stats.turnsOpen?.length) return;
  // Astra r2 #3: team turns START only in regular play. Outside it (set-up, kick-off) a turn marker can move without a
  // turn being played (a kick-off Time-out moves both by one, either way - StepApplyKickoffResult.handleTimeout): the
  // entries follow the marker without counting
  const regular = String(game.turnMode ?? '') === 'regular';
  for (const e of stats.turnsOpen) {
    if (e.done) continue;
    const state = playerBaseState(game, e.playerId);
    // Astra r2 #2: a casualty saved to the reserves (an apothecary's Badly Hurt, Regeneration) was never out for the
    // game: its up-front booking is taken back and it is counted from the injury like a knock-out (the rest of that
    // drive; nothing once he is available again)
    if (e.kind === 'cas' && state === RESERVE) {
      addLostTurns(stats, e.teamId, e.attacker, e.booked + e.added, null, -1);
      Object.assign(e, { kind: 'ko', idx: e.start, floor: 0, booked: 0, added: 0 });
    }
    // Astra r1 #3: a later drive with the player no longer knocked out ends it, whether or not a turn has started yet
    // (a recovered player can be knocked out again before his team's next turn: a new entry, never two)
    if (e.kind === 'ko' && clock.drive !== e.drive && state !== KNOCKED_OUT) { e.done = true; continue; }
    const cur = turnIndex(clock.half, clockTurnOf(game, clock, e.victimTeamId));
    if (!regular) { e.idx = Math.max(cur, e.floor); continue; }
    if (cur <= e.idx) continue;
    // Astra r1 #2 / r2 #1: a team turn has started and the player is back ON the pitch in the injury's own drive - an
    // apothecary turned the KO into a stun (StepApothecary.java:516-518), and the turn start has already turned him
    // over (prone, unable to act: UtilPlayer.refreshPlayersForTurnStart). It costs what a stun costs: this one turn.
    if (e.kind === 'ko' && state != null && state !== KNOCKED_OUT && state !== RESERVE) {
      e.done = true;
      if (e.added === 0) { e.added = 1; addLostTurns(stats, e.teamId, e.attacker, 1, null, 1); }
      continue;
    }
    const add = cur - e.idx;
    e.idx = cur; e.added += add;
    addLostTurns(stats, e.teamId, e.attacker, add, null, 1);
  }
}
function turnsScoreFor(game: GameJson, clock: TurnClock, victim: TeamLike) {
  return turnsScore(clock.half, clockTurnOf(game, clock, victim.teamId), koWeightFor(game, victim));
}

/** A `blockChoice`: one block thrown. Books its expected turns (see the chain above) and links the victim to it. */
function noteBlockTurns(stats: DiceStats, game: GameJson | null, attacker: string | null, nrOfDice: number | null, defender: string | null, multi: boolean, clock: TurnClock | null,
  atRoll: { defenderTacklezones: boolean; blitz: boolean } | null): void {
  const a = teamOf(game, attacker), d = teamOf(game, defender);
  if (!game || !attacker || !defender || !a || !d || a.teamId === d.teamId) return;
  const links = (stats.turnsLinks ??= {});
  const tallies = tallyFor(stats, a.teamId, attacker);
  const dice = nrOfDice == null ? 0 : Math.abs(nrOfDice);
  const defenderJson = playerJson(game, defender);
  const ironHardSkin = has(game, defender, 'Iron Hard Skin');
  // Astra r2 #4: an ordinary block never uses the ATTACKER's Chainsaw (StepDropFallingPlayers.java:135 builds
  // InjuryTypeBlock(REGULAR, false)): only a defender carrying one adds the +3
  const chainsaw = has(game, defender, 'Chainsaw');
  // UNMEASURED: a Multiple Block (who picks cannot be read), no dice count, no turn data, a Chainsaw block under
  // mbStacksAgainstChainsaw (see diceLuck.armourBreakThreshold), or a Ball & Chain victim (Astra r4 #4: knocked down
  // with no armour roll and a stun read as a KO, UtilServerInjury + BallAndChain.java - not modelled here)
  if (multi || !clock || !Number.isInteger(dice) || dice < 1 || dice > 3 || !defenderJson || has(game, defender, 'Ball & Chain') || has(game, defender, 'Ball and Chain')
    || (chainsaw && !ironHardSkin && gameOption(game, 'mbStacksAgainstChainsaw') === 'true')) {
    turnsUnmeasured(tallies);
    links[defender] = { attacker, measured: false };
    return;
  }
  // Astra r1 #1: the match-up as it stood when the dice were ROLLED (latched at the blockRoll): by the blockChoice a
  // knocked-down defender is already FALLING and would read as having no tackle zones
  // (a blockRoll and its blockChoice in ONE frame both read the falling defender: falling, not confused or hypnotized,
  // is a defender who stood with his tackle zones when the dice were rolled)
  const tacklezones = (atRoll ? atRoll.defenderTacklezones : defenderHasTacklezones(game, defender)) || fallingWithTacklezones(game, defender);
  const matchup: BlockMatchup = {
    attackerBlock: has(game, attacker, 'Block'), attackerWrestle: has(game, attacker, 'Wrestle'), attackerTackle: has(game, attacker, 'Tackle'),
    defenderBlock: tacklezones && has(game, defender, 'Block'), defenderDodge: has(game, defender, 'Dodge'),
    defenderWrestle: tacklezones && has(game, defender, 'Wrestle'),
    attackerJuggernautBlitz: (!!atRoll?.blitz || actingAction(game) === 'blitz') && has(game, attacker, 'Juggernaut'),
  };
  const reach = blockKnockdownChance(dice, nrOfDice! > 0, blockFaceScores(matchup), matchup.defenderBlock);
  const tiers = blockArmourTiers({
    av: effectiveArmour(defenderJson as never), mightyBlow: has(game, attacker, 'Mighty Blow') ? mightyBlowValue(game, attacker) : 0,
    claws: has(game, attacker, 'Claws') || has(game, attacker, 'Claw'), chainsaw, ironHardSkin,
    clawDoesNotStack: gameOption(game, 'clawDoesNotStack') !== 'false',
  });
  const key = turnsKey(reach, tiers, { stunty: has(game, defender, 'Stunty'), thickSkull: has(game, defender, 'Thick Skull') }, turnsScoreFor(game, clock, d));
  addTurnsTrial(tallies, key);
  links[defender] = { attacker, measured: true, key };
}
/** The first roll of a Chainsaw attack (a block made with the chainsaw): its chance to hit, then armour +3. */
function noteChainsawTurns(stats: DiceStats, game: GameJson | null, attacker: string | null, r: Report, clock: TurnClock | null): void {
  if (r.reRolled === true || actingAction(game) === 'foul') return; // a Chainsaw foul is counted at its armour roll
  // Astra r3 #1: a Chainsaw attack that resolves inside this frame has already cleared the defender
  // (StepEndBlocking.java:422): the one the last frame left is the target
  const defender = (game as { defenderId?: unknown } | null)?.defenderId ?? stats.turnDefender;
  const victim = typeof defender === 'string' ? defender : null;
  const a = teamOf(game, attacker), d = teamOf(game, victim);
  if (!game || !attacker || !victim || !a || !d || a.teamId === d.teamId) return;
  const links = (stats.turnsLinks ??= {});
  const tallies = tallyFor(stats, a.teamId, attacker);
  const minimum = Number(r.minimumRoll);
  const defenderJson = playerJson(game, victim);
  if (!clock || !defenderJson || !Number.isInteger(minimum) || minimum < 1) { turnsUnmeasured(tallies); links[victim] = { attacker, measured: false }; return; }
  const target = Math.min(6, Math.max(2, minimum));
  const av = effectiveArmour(defenderJson as never);
  const tiers: ArmourTier[] = [{ threshold: has(game, victim, 'Iron Hard Skin') ? av : av - 3, injuryShift: 0 }];
  const key = turnsKey({ num: 7 - target, den: 6 }, tiers, { stunty: has(game, victim, 'Stunty'), thickSkull: has(game, victim, 'Thick Skull') }, turnsScoreFor(game, clock, d));
  addTurnsTrial(tallies, key);
  links[victim] = { attacker, measured: true, key };
}
/** Injury types whose injury roll never takes Mighty Blow (MightyBlow.java: foul, stab, vomit-like, Chainsaw); a thrown
 *  player landing on an opponent takes Lethal Flight instead (InjuryTypeTTMHitPlayerForSpp.java:33-58, Astra r4 #2). */
const NO_MB_INJURY = new Set(['foul', 'stab', 'projectileVomit', 'breatheFire', 'chainsaw', 'ttmHitPlayer',
  // Astra r4 #1: InjuryTypeSabotaged applies no injury modifier at all
  'sabotaged']);
/** The families whose chance was booked at the block (or the Chainsaw roll): the report books only the result. */
function linkedFamily(family: string): boolean { return BLOCK_FALL_FAMILIES.has(family) || family === 'chainsaw' || family.startsWith('pilingOn'); }

/** An `injury` report of an attack on the opponent: the turns its result cost, and for the attacks counted at the
 *  armour roll, their expected turns too. */
function noteInjuryTurns(stats: DiceStats, game: GameJson | null, commandNr: number | null, r: Report, attackerId: string, armour: [number, number] | null, injury: [number, number] | null, clock: TurnClock | null): void {
  const defenderId = typeof r.defenderId === 'string' ? r.defenderId : null;
  const own = teamOf(game, defenderId), attackerTeam = teamOf(game, attackerId);
  if (!game || !defenderId || !own || !attackerTeam || own.teamId === attackerTeam.teamId) return;
  if (!armour && !injury) return; // the twin report that shows neither roll (skipInjuryParts EVERYTHING_BUT_CAS)
  const key = `${commandNr}|${defenderId}|${armour ?? ''}|${injury ?? ''}`;
  if (commandNr != null && key === stats.lastTurnsTrial) return;
  stats.lastTurnsTrial = key;
  const family = injuryTypeFamily(String(r.injuryType ?? ''));
  const tallies = tallyFor(stats, attackerTeam.teamId, attackerId);
  const broken = r.armorBroken === true;
  const base = Number(r.injury) & 0xff;
  const level: InjuryLevel | null = !broken ? null : base === 4 ? 0 : base === KNOCKED_OUT ? 1 : base >= 6 && base <= 8 ? 2 : null;
  const names = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  const injuryModifiers = names(r.injuryModifiers);
  const mightyBlow = mightyBlowValue(game, attackerId);
  // a stated modifier this client cannot value (Ram, Slayer, Niggling Injury ...): not a fair-dice outcome
  const unvalued = names(r.armorModifiers).some((name) => armourModifierValue(name, mightyBlow) == null)
    || injuryModifiers.some((name) => injuryModifierValue(name, mightyBlow) == null);
  if (linkedFamily(family)) {
    const link = stats.turnsLinks?.[defenderId];
    if (!link || link.attacker !== attackerId) { if (!family.startsWith('pilingOn')) turnsUnmeasured(tallies); return; }
    if (!link.measured || !clock) return;
    if (unvalued) {
      // Astra r1 #5: the attack is unmeasured for BOTH figures - take back its expected trial and anything booked
      unbookTurns(stats, attackerTeam.teamId, attackerId, link.booked);
      if (link.key) addTurnsTrial(tallies, link.key, -1);
      turnsUnmeasured(tallies);
      link.measured = false; link.booked = null;
      return;
    }
    // one attack, one result: a Piling On reroll (or a repeat) replaces what was booked for it
    unbookTurns(stats, attackerTeam.teamId, attackerId, link.booked);
    link.booked = bookTurns(stats, game, clock, attackerTeam.teamId, attackerId, own.teamId, defenderId, level);
    return;
  }
  if (!clock || unvalued) { turnsUnmeasured(tallies); return; }
  const ironHardSkin = has(game, defenderId, 'Iron Hard Skin');
  let tiers: ArmourTier[] | null = null;
  if (armour) {
    const input = armourInputFor(game, r, attackerId, armour);
    const threshold = armourBreakThreshold(input);
    // in hand: stated on either roll; through Iron Hard Skin a roll that does not break states nothing, so the
    // skill's owner says it (Astra r1 #6) - it would have landed on the injury roll. The owner is the STATED attacker
    // (the fouler; for a thrown player's Lethal Flight, the thrown player), else the one credited.
    const stated = typeof r.attackerId === 'string' ? r.attackerId : null;
    const owner = stated ?? attackerId;
    const eitherNames = EITHER_BY_TYPE[family] ?? [];
    // Astra r4 #1: A Sneaky Pair also needs its partner marking the victim (ASneakyPair.java), which this client does
    // not read. Through Iron Hard Skin a held roll would not say whether it applied and a broken one would, so such an
    // attack is unmeasured whichever way the armour fell
    const sneakyUnknown = ironHardSkin && eitherNames.includes('A Sneaky Pair') && has(game, owner, 'A Sneaky Pair');
    const either: (number | null)[] = eitherNames
      .filter((name) => input.armourModifiers.includes(name) || injuryModifiers.includes(name) || (ironHardSkin && name !== 'A Sneaky Pair' && has(game, owner, name)))
      .map((name) => armourModifierValue(name, mightyBlow));
    // Astra r3 #2: an injury-only modifier lands on the injury roll whichever way the armour broke. Of the ones this
    // client values that is Mighty Blow off a block (MightyBlow.java: any injury roll by the stated attacker that is not
    // a foul, a stab, a vomit-like or a Chainsaw hit, when it was not used on the armour). It is read from the stated
    // attacker's skills, so a held armour roll gets the same chance; a broken roll that states otherwise is unmeasured.
    const mbInjury = !NO_MB_INJURY.has(family) && !input.armourModifiers.includes('Mighty Blow') && stated != null && has(game, stated, 'Mighty Blow') ? mightyBlowValue(game, stated) : 0;
    // Astra r4 #2: a stated Mighty Blow is the stated attacker's (a rethrown bomb's original bombardier), valued as his
    const statedMb = stated != null ? mightyBlowValue(game, stated) : mightyBlow;
    const statedOnly = injuryModifiers.filter((name) => !eitherNames.includes(name)).reduce((s, name) => s + (injuryModifierValue(name, statedMb) ?? 0), 0);
    const disagrees = broken && !!injury && statedOnly !== mbInjury;
    if (threshold != null && !disagrees && !sneakyUnknown && either.every((v) => v != null)) {
      tiers = reportArmourTiers(threshold, either as number[], ironHardSkin).map((t) => ({ ...t, injuryShift: t.injuryShift + mbInjury }));
    }
  } else if (broken && injury) {
    // broken with no armour roll (a hit that goes straight to the injury roll): reached with certainty
    const values = injuryModifiers.map((name) => injuryModifierValue(name, mightyBlow));
    if (values.every((v) => v != null)) tiers = [{ threshold: 2, injuryShift: (values as number[]).reduce((s, v) => s + v, 0) }];
  }
  if (!tiers) { turnsUnmeasured(tallies); return; }
  // Astra r4 #3: a thrown player landing on a victim adds only Lethal Flight to the injury roll
  // (InjuryTypeTTMHitPlayerForSpp.java:55-62), never Stunty, and the server picks the Stunty table from the stated modifiers
  // (Astra r5: only the ForSpp type skips Stunty; the ordinary ttmHitPlayer uses the usual factory, InjuryTypeTTMHitPlayer.java:45)
  const stuntyFromSkill = String(r.injuryType ?? '') !== 'ttmHitPlayerForSpp' && has(game, defenderId, 'Stunty');
  const table = { stunty: injuryModifiers.includes('Stunty') || stuntyFromSkill, thickSkull: has(game, defenderId, 'Thick Skull') };
  addTurnsTrial(tallies, turnsKey({ num: 1, den: 1 }, tiers, table, turnsScoreFor(game, clock, own)));
  bookTurns(stats, game, clock, attackerTeam.teamId, attackerId, own.teamId, defenderId, level);
}

function blockTallies(stats: DiceStats, game: GameJson | null, attacker: string | null): DiceTally[] {
  return tallyFor(stats, teamOf(game, attacker)?.teamId ?? null, attacker);
}
/** Rolls still waiting for a `blockChoice` when the block moves on were never resolved: UNMEASURED (who picked is unknown). */
function dropPendingBlockRolls(stats: DiceStats, game: GameJson | null): void {
  for (const p of stats.pendingBlockRolls ?? []) for (const t of blockTallies(stats, game, p.attacker)) luckOf(t, 'block').unmeasured += 1;
  stats.pendingBlockRolls = [];
}
/** A `block` report: the dice are about to be rolled (or rolled again) - step/bb2025/block/StepBlockRoll.java:199-200. */
function noteBlockAnnounced(stats: DiceStats, game: GameJson | null, attacker: string | null, defender: string | null): void {
  const pending = stats.pendingBlockRolls ?? [];
  if (pending.some((p) => p.attacker !== attacker || (p.defender && defender && p.defender !== defender))) dropPendingBlockRolls(stats, game);
  stats.lastBlockDefender = defender;
  stats.blockRollArmed = true;
  stats.blockRollPartial = false;
  stats.rerollGateFailed = false;
}
function actingAction(game: GameJson | null): string {
  return String((game?.actingPlayer as { playerAction?: unknown } | undefined)?.playerAction ?? '');
}
/**
 * One block ROLL is one trial. The server re-states the same dice without rolling (a `blockRoll` with no `block`
 * report before it, when a reroll is declined - StepBlockRoll.java:191-194): that is not a new roll. A roll that
 * rerolled only SOME dice (a `blockReRoll` report first: Pro, Brawler ...) keeps dice of the roll already counted, so
 * it is UNMEASURED. The trial is settled at the `blockChoice`, which states who picks (nrOfDice < 0 = the defender):
 * `choosingTeamId` here names who answers the reroll dialog, not who picks the result (:349-357).
 *
 * MULTIPLE BLOCK (Astra F5): its first rolls are made with NO `block` / `blockRoll` report
 * (step/bb2025/mutliblock/StepBlockRollMultiple.java:223-240), only its rerolls are reported (:249, :262-263 - the
 * one path that states a defender on `blockRoll`), and its dice count is absolute (:226), so who picks cannot be
 * read. Scoring only the rerolled ones would be a biased sample: EVERY roll of a Multiple Block is UNMEASURED - the
 * reported ones here, the unreported first roll of each defender at its `blockChoice`.
 */
function noteBlockRollLuck(stats: DiceStats, game: GameJson | null, id: string, attacker: string | null, defender: string | null, faces: number[]): void {
  if (id === 'blockReRoll') { stats.blockRollPartial = true; stats.rerollGateFailed = false; return; } // dice were rolled
  const gateFailed = stats.rerollGateFailed === true;
  stats.rerollGateFailed = false;
  if (defender != null || actingAction(game) === 'multipleBlock') {
    stats.blockRollArmed = false; stats.blockRollPartial = false;
    // Astra N4: a failed reroll roll (Loner, Pro) still re-states the unchanged dice here
    // (StepBlockRollMultiple.java:246-264: the report is added whether or not useReRoll passed) - a repeat, not a roll
    if (gateFailed) return;
    const key = defender ?? stats.lastBlockDefender ?? '';
    const counted = (stats.multiBlockCounted ??= {});
    counted[key] = (counted[key] ?? 0) + 1;
    for (const t of blockTallies(stats, game, attacker)) luckOf(t, 'block').unmeasured += 1;
    return;
  }
  if (!stats.blockRollArmed) return;
  stats.blockRollArmed = false;
  if (stats.blockRollPartial) {
    stats.blockRollPartial = false;
    for (const t of blockTallies(stats, game, attacker)) luckOf(t, 'block').unmeasured += 1;
    return;
  }
  const target = defender ?? stats.lastBlockDefender ?? null;
  (stats.pendingBlockRolls ??= []).push({ attacker, defender: target, faces, blitz: actingAction(game) === 'blitz', defenderTacklezones: defenderHasTacklezones(game, target) });
}
function settleBlockRollLuck(stats: DiceStats, game: GameJson | null, attacker: string | null, nrOfDice: number | null, choiceDefender: string | null): void {
  const pending = stats.pendingBlockRolls ?? [];
  stats.pendingBlockRolls = [];
  const counted = stats.multiBlockCounted ?? {};
  const multi = actingAction(game) === 'multipleBlock' || (choiceDefender != null && choiceDefender in counted);
  if (multi) {
    // the defender's first roll was never reported: count it now (its reported rerolls were counted as they came)
    for (const t of blockTallies(stats, game, attacker)) luckOf(t, 'block').unmeasured += 1 + pending.length;
    if (choiceDefender != null) delete counted[choiceDefender];
    return;
  }
  // Juggernaut needs the action to be a Blitz: read where the roll was made and again here (the action is `blitz`
  // from the blitz's block onward - PlayerAction.BLITZ, JuggernautBehaviour.java:45)
  const blitzNow = actingAction(game) === 'blitz';
  for (const p of pending) {
    const defender = p.defender ?? choiceDefender;
    const tallies = blockTallies(stats, game, p.attacker);
    const attackerTeam = teamOf(game, p.attacker), defenderTeam = teamOf(game, defender);
    const dice = p.faces.length;
    // UNMEASURED: no stated dice count / sign, a count that is not this roll's, or a player this model cannot resolve
    if (nrOfDice == null || nrOfDice === 0 || Math.abs(nrOfDice) !== dice || dice < 1 || dice > 3 || !attackerTeam || !defenderTeam) {
      for (const t of tallies) luckOf(t, 'block').unmeasured += 1;
      continue;
    }
    const attackerChooses = nrOfDice > 0;
    const scores = blockFaceScores({
      attackerBlock: has(game, p.attacker, 'Block'), attackerWrestle: has(game, p.attacker, 'Wrestle'), attackerTackle: has(game, p.attacker, 'Tackle'),
      // Astra N1: a defender without tackle zones (confused, hypnotized ...) can use neither Block nor Wrestle
      defenderBlock: p.defenderTacklezones && has(game, defender, 'Block'), defenderDodge: has(game, defender, 'Dodge'),
      defenderWrestle: p.defenderTacklezones && has(game, defender, 'Wrestle'),
      attackerJuggernautBlitz: (p.blitz || blitzNow) && has(game, p.attacker, 'Juggernaut'),
    });
    const key = blockRollKey(dice, attackerChooses, scores);
    const score = blockRollScore(p.faces, attackerChooses, scores);
    const dist = parseDist(key);
    const chance = (s6: number) => dist.points.find((pt) => pt.s6 === s6)?.p ?? 0;
    for (const t of tallies) {
      const b = luckOf(t, 'block');
      addTrial(b, key, score * 6);
      if (score > 0) addCount(b, 'good', 1);
      if (score < 0) addCount(b, 'bad', 1);
      addCount(b, 'goodExpected', chance(6)); addCount(b, 'badExpected', chance(-6));
    }
  }
}

/** The four Likelihood rows of a tally, and all of them together. A tally without trial data reads "not measured". */
export function armourLikelihood(t: DiceTally): Likelihood { return likelihoodOf([t.luck?.armour]); }
export function injuryLikelihood(t: DiceTally): Likelihood { return likelihoodOf([t.luck?.injury]); }
/** Owner 10-15: the Turns lost row (not part of All dice). A tally kept before it reads "not measured". */
export function turnsLikelihood(t: DiceTally): Likelihood { return likelihoodOf([t.luck?.turns]); }
export function actionLikelihood(t: DiceTally): Likelihood { return likelihoodOf([t.luck?.action]); }
export function blockLikelihood(t: DiceTally): Likelihood { return likelihoodOf([t.luck?.block]); }
export function allDiceLikelihood(t: DiceTally): Likelihood { return likelihoodOf([t.luck?.armour, t.luck?.injury, t.luck?.action, t.luck?.block]); }

/** Feed one applied frame's reports. `commandNr` de-duplicates re-applied frames (replay seeks re-run history). */
export function ingestDiceReports(stats: DiceStats, gameId: string | null, commandNr: number | null, reports: readonly Report[], game: GameJson | null): void {
  if (gameId !== stats.gameId) {
    const fresh = emptyDiceStats(gameId);
    stats.gameId = fresh.gameId; stats.seen = fresh.seen; stats.teams = fresh.teams; stats.players = fresh.players;
    stats.lastBlockAttacker = null; stats.lastFailedDodge = null; stats.lastFailedPickup = null; stats.lastFailedRush = null;
    stats.activeTurn = {}; stats.lastRerollSource = null; stats.openDodges = {};
    stats.lastBlockDefender = null; stats.blockRollArmed = false; stats.blockRollPartial = false; stats.pendingBlockRolls = []; stats.multiBlockCounted = {};
    stats.lastBlockActing = null; stats.rerollGateFailed = false;
    stats.lastArmourTrial = null; stats.lastInjuryTrial = null;
    stats.turnClock = null; stats.turnDefender = null; stats.turnsLinks = {}; stats.turnsOpen = []; stats.turnsSeq = 0; stats.lastTurnsTrial = null;
    delete stats.coverage; delete stats.turnover; delete stats.revision;
  }
  if (commandNr != null) {
    if (stats.seen.has(commandNr)) return;
    stats.seen.add(commandNr);
  }
  const actingId = typeof game?.actingPlayer?.playerId === 'string' ? game.actingPlayer.playerId : null;
  stats.rerollGateFailed = false; // the gate and its dice share a frame (see below)
  // Owner 10-15 (turns lost): the turn an attack in this frame was made in. `game` is the model AFTER the frame, so
  // until a `turnEnd` report has gone by it is the state the last frame left (turnClock); after one, this model.
  let turnEnded = false;
  const rollClock = (): TurnClock | null => (turnEnded || !stats.turnClock ? readTurnClock(game) : stats.turnClock);
  for (const r of reports) {
    if (String(r.reportId ?? '') === 'turnEnd') { turnEnded = true; stats.turnsLinks = {}; }
    // r4: remember who paid for a re-roll; the re-rolled roll that follows reads it (falls through: nothing else consumes it)
    if (String(r.reportId ?? '') === 'reRoll' && typeof r.playerId === 'string') stats.lastRerollSource = { playerId: r.playerId, source: String(r.reRollSource ?? '') };
    // Astra N4 / N4-R1 / N4-R2: the block-roll reroll GATE. Upstream adds, in one step result, `block`, then whatever
    // UtilServerReRoll.useReRoll reports, then `blockRoll` (StepBlockRollMultiple.java:249-263). Only a report in that
    // slot is the gate - the flag is dropped at every frame start and at every `block` / `blockReRoll` / `blockRoll`,
    // so a failed Pro from another roll or turn, or the modifier-test reroll report of
    // AbstractStepModifierMultipleBlock.java:154-157 (a different step), can never be mistaken for it. The last gate
    // report decides (mechanic/bb2025/RollMechanic.java:277-330): a reroll that needed its own roll and failed it
    // (`reRoll` with roll > 0: Pro, Loner; report/ReportReRoll.java:79-83), or a failed Team Mascot with no team
    // reroll to fall back on (`mascotUsed`, RollMechanic.java:295-305, :387-391).
    if (stats.blockRollArmed) {
      const gate = String(r.reportId ?? '');
      if (gate === 'reRoll') stats.rerollGateFailed = Number(r.roll) > 0 && r.successful === false;
      else if (gate === 'mascotUsed') stats.rerollGateFailed = r.successful === false && r.reRollUsed !== true;
    }
    const id = String(r.reportId ?? '');
    const playerId = typeof r.playerId === 'string' ? r.playerId : null;

    if (id === 'block') {
      const attacker = typeof r.attackerId === 'string' ? r.attackerId : playerId ?? actingId;
      stats.lastBlockAttacker = attacker;
      stats.lastBlockActing = actingId;
      const team = teamOf(game, attacker);
      for (const t of tallyFor(stats, team?.teamId ?? null, attacker)) t.blocks += 1;
      noteBlockAnnounced(stats, game, attacker, typeof r.defenderId === 'string' ? r.defenderId : null);
      continue;
    }
    if (id === 'blockRoll' || id === 'blockReRoll') {
      const attacker = typeof r.attackerId === 'string' ? r.attackerId : currentBlocker(stats, actingId);
      const team = teamOf(game, attacker);
      const faces = Array.isArray(r.blockRoll) ? (r.blockRoll as unknown[]).filter(isD6) : [];
      const tallies = tallyFor(stats, team?.teamId ?? null, attacker);
      for (const face of faces) for (const t of tallies) { t.block[face] = (t.block[face] ?? 0) + 1; t.blockSeq.push(face); }
      if (faces.length >= 2) {
        const allSkull = faces.every((f) => f === 1);
        const allBad = faces.every((f) => f === 1 || f === 2);
        if (allSkull) for (const t of tallies) t.oneThirtySixth += 1;
        if (allBad && (allSkull || !hasSkill(team, attacker, 'Block'))) for (const t of tallies) t.oneNinth += 1;
      }
      noteBlockRollLuck(stats, game, id, attacker, typeof r.defenderId === 'string' ? r.defenderId : null, faces);
      continue;
    }
    if (id === 'blockChoice') {
      const attacker = typeof r.attackerId === 'string' ? r.attackerId : currentBlocker(stats, actingId);
      const team = teamOf(game, attacker);
      const chosen = Array.isArray(r.blockRoll) && typeof r.diceIndex === 'number' ? (r.blockRoll as unknown[])[r.diceIndex] : null;
      const result = String(r.blockResult ?? '');
      const attackerDown = chosen === 1 || /attacker.?down|skull/i.test(result);
      const bothDown = chosen === 2 || /both.?down/i.test(result);
      const failed = attackerDown || (bothDown && !hasSkill(team, attacker, 'Block', 'Wrestle'));
      if (failed) for (const t of tallyFor(stats, team?.teamId ?? null, attacker)) t.failedBlocks += 1;
      {
        const choiceDefender = typeof r.defenderId === 'string' ? r.defenderId : stats.lastBlockDefender ?? null;
        const multi = actingAction(game) === 'multipleBlock' || (typeof r.defenderId === 'string' && r.defenderId in (stats.multiBlockCounted ?? {}));
        const rolled = [...(stats.pendingBlockRolls ?? [])].reverse().find((p) => p.attacker === attacker && (p.defender == null || p.defender === choiceDefender));
        noteBlockTurns(stats, game, attacker, typeof r.nrOfDice === 'number' ? r.nrOfDice : null, choiceDefender, multi, rollClock(),
          rolled ? { defenderTacklezones: rolled.defenderTacklezones, blitz: rolled.blitz } : null);
      }
      settleBlockRollLuck(stats, game, attacker, typeof r.nrOfDice === 'number' ? r.nrOfDice : null, typeof r.defenderId === 'string' ? r.defenderId : null);
      continue;
    }
    if (id === 'injury') {
      const attacker = inflictingAttacker(stats, game, r, actingId);
      if (!attacker) continue; // owner 10-13: not a roll made against an opponent - counted for neither team
      const team = teamOf(game, attacker);
      const tallies = tallyFor(stats, team?.teamId ?? null, attacker);
      // Owner 10-09: BB2025 reports one injury TWICE (server/mechanic/bb2025/StateMechanic.java:122-171): first with
      // skipInjuryParts "CAS" (the armour and injury rolls), then "EVERYTHING_BUT_CAS" (the casualty part) - both carry
      // the same dice. The flag says which parts that report SHOWS, so a roll is counted where it is shown, once.
      const skip = String(r.skipInjuryParts ?? 'NONE');
      const armour = !ARMOUR_PART_HIDDEN.has(skip) && Array.isArray(r.armorRoll) ? (r.armorRoll as unknown[]).filter(isD6) : [];
      const injury = !INJURY_PART_HIDDEN.has(skip) && Array.isArray(r.injuryRoll) ? (r.injuryRoll as unknown[]).filter(isD6) : [];
      for (const v of armour) pushD6(tallies, v, 'armourFaces');
      for (const v of injury) pushD6(tallies, v, 'injuryFaces');
      if (armour.length === 2) for (const t of tallies) t.armour.push(armour[0]! + armour[1]!);
      if (injury.length === 2) for (const t of tallies) t.injury.push(injury[0]! + injury[1]!);
      noteInjuryReportLuck(stats, game, commandNr, r, attacker, armour.length === 2 ? [armour[0]!, armour[1]!] : null, injury.length === 2 ? [injury[0]!, injury[1]!] : null);
      noteInjuryTurns(stats, game, commandNr, r, attacker, armour.length === 2 ? [armour[0]!, armour[1]!] : null, injury.length === 2 ? [injury[0]!, injury[1]!] : null, rollClock());
      continue;
    }
    if (id === 'dodgeRoll') {
      const team = teamOf(game, playerId);
      const tallies = tallyFor(stats, team?.teamId ?? null, playerId);
      pushD6(tallies, r.roll, 'dodgeFaces');
      pushTest(tallies, r); pushActionLuck(tallies, r);
      const reRolled = r.reRolled === true;
      const successful = r.successful === true;
      const need = Number(r.minimumRoll);
      const builtIn = !reRolled && successful && dodgeRerollBuiltIn(game, team, playerId);
      const skillRerolled = reRolled && stats.lastRerollSource?.playerId === playerId && stats.lastRerollSource.source.toLowerCase() === 'dodge';
      if (reRolled) stats.lastRerollSource = null;
      // r5 (review): a reroll resolves the player's OPEN attempt - it files under that attempt's column and REPLACES
      // its first outcome. (Diving Tackle: the first roll is reported passed, the tackle fails it, then it is rerolled.)
      // r6 (review): one open attempt PER PLAYER, so another player's dodge in between cannot orphan a reroll
      const opens = (stats.openDodges ??= {});
      const open = reRolled && playerId ? opens[playerId] ?? null : null;
      const ownTarget = Number.isFinite(need) ? Math.min(6, Math.max(2, Math.round(need))) : null;
      const target = open ? open.target ?? ownTarget : ownTarget;
      // r6 (review): a reroll whose first roll was never seen (joined mid-attempt) is not charted - the Dodges row
      // does not count it either, so the two always agree
      if (target != null && (!reRolled || open)) {
        for (const t of tallies) {
          const by = (t.dodgeByTarget ??= {});
          const row = (by[target] ??= { attempts: 0, passFirst: 0, passReroll: 0, failReroll: 0 });
          if (!reRolled) {
            row.attempts += 1;
            // r4: a first-time pass still had the skill re-roll built in if the player could have used it
            if (successful) { row.passFirst += 1; if (builtIn) row.built = (row.built ?? 0) + 1; }
          } else {
            if (open?.passed) row.passFirst = Math.max(0, row.passFirst - 1);
            if (successful) row.passReroll += 1; else row.failReroll += 1;
            // r4: a first roll re-rolled BY THE DODGE SKILL was a built-in re-roll. r6 (review): `built` is about the
            // skill being AVAILABLE - an attempt counted built stays built whichever source the coach then picked
            if (skillRerolled) { if (!open?.built) row.built = (row.built ?? 0) + 1; row.builtFails = (row.builtFails ?? 0) + 1; }
          }
        }
      }
      if (!reRolled && playerId) opens[playerId] = { target, passed: successful, built: builtIn };
      else if (open) {
        // the reroll failed an attempt whose first roll was reported passed: it now counts as failed
        if (open.passed && !successful) for (const t of tallies) t.failedDodges += 1;
        delete opens[playerId!];
      }
      if (!reRolled) {
        for (const t of tallies) t.dodges += 1;
        if (!successful) { for (const t of tallies) t.failedDodges += 1; stats.lastFailedDodge = playerId && team ? { playerId, teamId: team.teamId } : null; }
        else stats.lastFailedDodge = null;
      } else if (successful && open && !open.passed) { // r6: keyed on the player's own open attempt, not a single last-failed slot
        // The failed attempt was re-rolled into a success: it no longer counts as failed.
        for (const t of tallies) t.failedDodges = Math.max(0, t.failedDodges - 1);
        stats.lastFailedDodge = null;
      }
      continue;
    }
    if (id === 'goForItRoll') {
      const team = teamOf(game, playerId);
      const tallies = tallyFor(stats, team?.teamId ?? null, playerId);
      pushD6(tallies, r.roll);
      pushTest(tallies, r); pushActionLuck(tallies, r);
      const reRolled = r.reRolled === true;
      const successful = r.successful === true;
      if (!reRolled) {
        for (const t of tallies) t.rushes += 1;
        if (!successful) { for (const t of tallies) t.failedRushes += 1; stats.lastFailedRush = playerId && team ? { playerId, teamId: team.teamId } : null; }
        else stats.lastFailedRush = null;
      } else if (successful && stats.lastFailedRush?.playerId === playerId) {
        for (const t of tallies) t.failedRushes = Math.max(0, t.failedRushes - 1);
        stats.lastFailedRush = null;
      }
      continue;
    }
    if (id === 'pickUpRoll') {
      const team = teamOf(game, playerId);
      const tallies = tallyFor(stats, team?.teamId ?? null, playerId);
      pushD6(tallies, r.roll);
      pushTest(tallies, r); pushActionLuck(tallies, r);
      const reRolled = r.reRolled === true;
      const successful = r.successful === true;
      if (!reRolled) {
        for (const t of tallies) t.pickups += 1;
        if (!successful) { for (const t of tallies) t.failedPickups += 1; stats.lastFailedPickup = playerId && team ? { playerId, teamId: team.teamId } : null; }
        else stats.lastFailedPickup = null;
      } else if (successful && stats.lastFailedPickup?.playerId === playerId) {
        for (const t of tallies) t.failedPickups = Math.max(0, t.failedPickups - 1);
        stats.lastFailedPickup = null;
      }
      continue;
    }
    const fields = D6_ROLL_FIELDS[id];
    if (fields) {
      const team = teamOf(game, playerId ?? actingId);
      const tallies = tallyFor(stats, team?.teamId ?? null, playerId ?? actingId);
      for (const f of fields) {
        const v = r[f];
        if (Array.isArray(v)) for (const x of v) pushD6(tallies, x);
        else pushD6(tallies, v);
      }
      if (fields.includes('roll')) {
        // Breathe Fire's `successful` means "knocked down"; the trial against its minimum is the server's result.
        const bf = id === 'breatheFire' ? breatheFirePassed(r) : null;
        const tested = bf === null ? r : { ...r, successful: bf };
        pushTest(tallies, tested);
        pushActionLuck(tallies, tested, passingRuleUnknown(game, id, playerId ?? actingId));
      }
      if (id === 'chainsawRoll') noteChainsawTurns(stats, game, playerId ?? actingId, r, rollClock());
    }
  }
  // turns lost: knock-outs missing the turns that started in this frame; then this frame's state is the next one's
  advanceTurnsLost(stats, game);
  const end = readTurnClock(game);
  if (end) stats.turnClock = end;
  const target = (game as { defenderId?: unknown } | null)?.defenderId;
  stats.turnDefender = typeof target === 'string' ? target : null;
}

export function d6Total(t: DiceTally): number { return t.d6.reduce((a, b) => a + b, 0); }

// ---- activations per turn (owner 09-25) ----
function turnKeyFor(game: GameJson, team: TeamLike): { half: number; turn: number } {
  const home = (game.teamHome as unknown as TeamLike).teamId === team.teamId;
  const td = (home ? game.turnDataHome : game.turnDataAway) as { turnNr?: number } | undefined;
  return { half: Number(game.half ?? 0) || 0, turn: Number(td?.turnNr ?? 0) || 0 };
}
/** The server activated `playerId` (actingPlayerSetPlayerId, non-null): count it once for its team's current turn. */
export function noteActivation(stats: DiceStats, game: GameJson | null, playerId: string | null): void {
  const team = teamOf(game, playerId);
  if (!game || !team || !playerId) return;
  if (String(game.turnMode ?? '') !== 'regular') return;
  const key = turnKeyFor(game, team);
  const cur = stats.activeTurn[team.teamId];
  if (cur && (cur.half !== key.half || cur.turn !== key.turn)) {
    // a turn we never saw end (seek / missed frame): close it as a plain turn so the ledger stays honest
    (stats.teams[team.teamId] ??= emptyTally()).turns.push({ half: cur.half, turn: cur.turn, activations: cur.players.size, turnover: false });
    delete stats.activeTurn[team.teamId];
  }
  const track = stats.activeTurn[team.teamId] ??= { ...key, players: new Set<string>() };
  track.players.add(playerId);
}
/** The side's turn ended (turnEnd report): record the activation count and whether it was a turnover. */
export function noteTurnEnd(stats: DiceStats, game: GameJson | null, side: 'home' | 'away', turnover: boolean): void {
  if (!game) return;
  const team = (side === 'home' ? game.teamHome : game.teamAway) as unknown as TeamLike;
  if (!team?.teamId) return;
  const cur = stats.activeTurn[team.teamId];
  const key = cur ? { half: cur.half, turn: cur.turn } : turnKeyFor(game, team);
  (stats.teams[team.teamId] ??= emptyTally()).turns.push({ ...key, activations: cur?.players.size ?? 0, turnover });
  delete stats.activeTurn[team.teamId];
}
export function activationFacts(t: DiceTally): DiceFact[] {
  if (!t.turns.length) return [];
  const facts: DiceFact[] = [];
  const avg = t.turns.reduce((a, x) => a + x.activations, 0) / t.turns.length;
  const turnovers = t.turns.filter((x) => x.turnover);
  facts.push({ label: 'Activations per turn', value: avg.toFixed(1), detail: `${t.turns.length} turns · ${turnovers.length} turnover${turnovers.length === 1 ? '' : 's'}` });
  if (turnovers.length) {
    const worst = turnovers.reduce((a, x) => (x.activations < a.activations ? x : a));
    facts.push({ label: 'Fewest activations before a turnover', value: `${worst.activations}`, detail: `${worst.half}HT${worst.turn}` });
  }
  return facts;
}

// ---- fun facts (owner 09-17) ----
export interface DiceFact { label: string; value: string; detail: string }

function longestRun<T>(seq: readonly T[], keep: (v: T) => boolean): number {
  let best = 0, run = 0;
  for (const v of seq) { run = keep(v) ? run + 1 : 0; if (run > best) best = run; }
  return best;
}

/** The least likely string of consecutive SUCCESSFUL tested rolls: the run whose joint chance is smallest. */
export function luckiestStreak(t: DiceTally): { odds: number; targets: number[] } | null {
  let best: { odds: number; targets: number[] } | null = null;
  let p = 1, targets: number[] = [];
  const close = () => { if (targets.length >= 2 && (!best || p < best.odds)) best = { odds: p, targets: [...targets] }; };
  for (const test of t.tests) {
    if (test.ok) { p *= (7 - test.target) / 6; targets.push(test.target); }
    else { close(); p = 1; targets = []; }
  }
  close();
  return best;
}

export function diceFacts(t: DiceTally): DiceFact[] {
  const facts: DiceFact[] = [];
  const streak = luckiestStreak(t);
  if (streak) {
    const n = Math.max(1, Math.round(1 / streak.odds));
    facts.push({ label: 'Luckiest streak', value: `1 in ${n.toLocaleString()}`,
      detail: `${streak.targets.length} in a row\n${streak.targets.map((x) => `${x}+`).join(' · ')}` }); // two lines: count, then the dice
  }
  const noOnes = longestRun(t.d6Seq, (v) => v !== 1);
  if (t.d6Seq.length) facts.push({ label: 'Longest run without a 1', value: `${noOnes} dice`, detail: `of ${t.d6Seq.length} D6 rolled` });
  const sixes = longestRun(t.d6Seq, (v) => v === 6);
  if (sixes >= 2) facts.push({ label: 'Most sixes in a row', value: `${sixes}`, detail: `${t.d6[6] ?? 0} sixes all game` });
  const pows = longestRun(t.blockSeq, (v) => v === 6);
  if (t.blockSeq.length) facts.push({ label: 'Most pows in a row', value: `${pows}`, detail: `${t.block[6] ?? 0} pows in ${t.blockSeq.length} block dice` });
  const skulls = longestRun(t.blockSeq, (v) => v === 1);
  if (skulls >= 2) facts.push({ label: 'Most skulls in a row', value: `${skulls}`, detail: `${t.block[1] ?? 0} skulls all game` });
  if (t.armour.length) {
    const hi = Math.max(...t.armour); const lo = Math.min(...t.armour);
    facts.push({ label: 'Armour rolls', value: `${lo} – ${hi}`, detail: `${t.armour.length} rolls, average ${(t.armour.reduce((a, b) => a + b, 0) / t.armour.length).toFixed(1)}` });
  }
  if (t.injury.length) {
    const hi = Math.max(...t.injury);
    facts.push({ label: 'Biggest injury roll', value: `${hi}`, detail: `${t.injury.length} injury rolls` });
  }
  const failedSixes = t.tests.filter((x) => x.target === 6).length;
  const madeSixes = t.tests.filter((x) => x.target === 6 && x.ok).length;
  if (failedSixes) facts.push({ label: 'Needed a 6', value: `${madeSixes} of ${failedSixes}`, detail: madeSixes ? 'made it' : 'never landed' });
  facts.push(...activationFacts(t)); // owner 09-25
  return facts;
}
export function blockTotal(t: DiceTally): number { return t.block.reduce((a, b) => a + b, 0); }
