/**
 * Owner 10-11: "Let's use local logs as the first indication of which games to pull."
 *
 * The recent-games lists read one matches page per team, capped (fumbblRecentMatches: RECENT_TEAM_CAP), and FUMBBL's
 * team list carries no last-played date. This is the client's own record of which of the local coach's teams were
 * played on this machine and when: `{ teamId, at }`, newest first, at most PLAYED_TEAMS_MAX distinct teams per FUMBBL
 * coach account. It is written when an official FUMBBL game hands the seated coach its game state (the store's
 * connectAsPlayer; never a fork game, a test game, a spectated game or a replay) and read, synchronously, to put those
 * teams at the head of the team order.
 *
 * SHAPE: a list of `{ account, teams }`. The coach name is a VALUE, never an object key: the settings serializer
 * deletes every KEY that looks like a credential (settings.stripSecretFields: password / token / secret), so a coach
 * called "SecretCoach" keyed by name would lose the record on every save. No field name here matches that pattern.
 *
 * LOCAL ONLY: it lives in the settings blob / file (`settings.recentPlayedTeams`) and is removed from the settings copy
 * a bug report attaches (bugReport.sanitizeSettingsJsonForReport). Accounts are never mixed: one entry per coach name.
 *
 * Every reader takes whatever is stored (a hand-edited file, an older shape, a wrong type) and keeps only well-formed
 * rows; nothing here throws, and an unreadable record is simply "no local teams" (the status order).
 */
import { RECENT_LOCAL_TEAM_MAX_AGE_MS } from './fumbblRecentMatches';
import { settings } from './settings';

export interface PlayedTeam { teamId: number; at: number }
/** One FUMBBL coach account's teams, most recently played first. `account` = playedTeamsAccountKey(coach name). */
export interface PlayedTeamsAccount { account: string; teams: PlayedTeam[] }
export type PlayedTeamsRecord = PlayedTeamsAccount[];

export const PLAYED_TEAMS_MAX = 64;
/** Coach accounts kept on one machine (the most recently recorded first). */
export const PLAYED_ACCOUNTS_MAX = 16;
/** A row stamped later than now by more than this was written under a wrong clock: it is not "recent". */
export const PLAYED_TEAMS_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
/** How much of a stored list is ever looked at (a damaged or hand-made file cannot make a read expensive). */
const SCAN_LIMIT = 1024;

/** One key per FUMBBL coach account: the name trimmed, ASCII letters folded (FUMBBL admits a name ignoring case). */
export function playedTeamsAccountKey(coach: unknown): string {
  return typeof coach === 'string' ? coach.trim().replace(/[A-Z]/g, (c) => c.toLowerCase()) : '';
}

function validTeamId(value: unknown): number | null {
  const id = typeof value === 'string' && /^\d{1,15}$/.test(value.trim()) ? Number(value) : value;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** The well-formed rows of one stored `teams` value: one per team, newest first. */
function cleanRows(stored: unknown): PlayedTeam[] {
  if (!Array.isArray(stored)) return [];
  const rows: PlayedTeam[] = [];
  for (const entry of stored.slice(0, SCAN_LIMIT)) {
    if (!entry || typeof entry !== 'object') continue;
    const teamId = validTeamId((entry as { teamId?: unknown }).teamId);
    const at = (entry as { at?: unknown }).at;
    if (teamId === null || typeof at !== 'number' || !Number.isFinite(at)) continue;
    rows.push({ teamId, at });
  }
  const seen = new Set<number>();
  return rows.sort((a, b) => b.at - a.at).filter((row) => (seen.has(row.teamId) ? false : (seen.add(row.teamId), true)));
}

/** The stored record as it can be trusted: one entry per account, in stored order. Anything else (the first build's
 *  object-by-name shape included) is no record. */
function cleanAccounts(record: unknown): PlayedTeamsAccount[] {
  if (!Array.isArray(record)) return [];
  const byKey = new Map<string, PlayedTeam[]>();
  for (const entry of record.slice(0, SCAN_LIMIT)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const key = playedTeamsAccountKey((entry as { account?: unknown }).account);
    if (!key) continue;
    const rows = cleanRows((entry as { teams?: unknown }).teams);
    byKey.set(key, byKey.has(key) ? cleanRows([...byKey.get(key)!, ...rows]) : rows);
  }
  return [...byKey].map(([account, teams]) => ({ account, teams }));
}

function accountRows(record: unknown, coach: unknown): PlayedTeam[] {
  const key = playedTeamsAccountKey(coach);
  if (!key) return [];
  return cleanAccounts(record).find((entry) => entry.account === key)?.teams ?? [];
}

/**
 * The team ids `coach` played on this machine, most recent first. Any other account's rows are never returned.
 * With `now`, only the rows played within `maxAge` before it (the lists' lead: an old row says nothing about recent
 * games) and not after it (beyond the clock tolerance: a row from a wrong clock would otherwise lead for years).
 */
export function playedTeamIds(record: unknown, coach: unknown, now?: number, maxAge = RECENT_LOCAL_TEAM_MAX_AGE_MS): number[] {
  try {
    const rows = accountRows(record, coach);
    if (now === undefined) return rows.map((row) => row.teamId);
    if (!Number.isFinite(now)) return [];
    return rows.filter((row) => row.at >= now - maxAge && row.at <= now + PLAYED_TEAMS_CLOCK_TOLERANCE_MS).map((row) => row.teamId);
  } catch { return []; }
}

/**
 * `record` with `teamId` played at `at` for `coach` (newest wins, bounded). Returns `record` itself when nothing is
 * recorded. `at` is the moment of writing: a stored row of this account later than it (beyond the clock tolerance) was
 * stamped under a wrong clock and is dropped, so one bad clock does not pin a team.
 */
export function withPlayedTeam(record: PlayedTeamsRecord, coach: unknown, teamId: unknown, at: number, max = PLAYED_TEAMS_MAX): PlayedTeamsRecord {
  const key = playedTeamsAccountKey(coach);
  const id = validTeamId(teamId);
  if (!key || id === null || !Number.isFinite(at)) return record;
  const accounts = cleanAccounts(record);
  const rest = (accounts.find((entry) => entry.account === key)?.teams ?? [])
    .filter((row) => row.teamId !== id && row.at <= at + PLAYED_TEAMS_CLOCK_TOLERANCE_MS);
  const mine: PlayedTeamsAccount = { account: key, teams: [{ teamId: id, at }, ...rest].sort((a, b) => b.at - a.at).slice(0, max) };
  return [mine, ...accounts.filter((entry) => entry.account !== key)].slice(0, PLAYED_ACCOUNTS_MAX);
}

/**
 * The seated coach's own team in a game state the server just handed a PLAYER session, or null when nothing is to be
 * recorded: not an official FUMBBL join, a test game, or neither team is this coach's (never a guess).
 */
export function playedTeamOfSnapshot(snapshot: unknown, coach: unknown, official: boolean): number | null {
  if (!official || !snapshot || typeof snapshot !== 'object') return null;
  const game = snapshot as { testing?: unknown; teamHome?: unknown; teamAway?: unknown };
  if (game.testing === true) return null;
  const key = playedTeamsAccountKey(coach);
  if (!key) return null;
  for (const team of [game.teamHome, game.teamAway]) {
    if (!team || typeof team !== 'object') continue;
    const t = team as { coach?: unknown; teamId?: unknown };
    if (playedTeamsAccountKey(t.coach) === key) return validTeamId(t.teamId);
  }
  return null;
}

/** The store's hook: an official game state reached the seated coach. Never throws (it sits on the join path). */
export function noteOfficialGameJoined(snapshot: unknown, coach: unknown, official: boolean, now = Date.now()): void {
  try {
    const teamId = playedTeamOfSnapshot(snapshot, coach, official);
    if (teamId === null) return;
    const next = withPlayedTeam(settings.recentPlayedTeams, coach, teamId, now);
    if (next !== settings.recentPlayedTeams) settings.recentPlayedTeams = next;
  } catch { /* the record is a hint for a list order: a failed write changes nothing else */ }
}

/** The local coach's teams played in the last 30 days, for the lists. A read that fails is an empty list (the status order). */
export function localPlayedTeamIds(coach: unknown, now = Date.now()): number[] {
  try { return playedTeamIds(settings.recentPlayedTeams, coach, now); } catch { return []; }
}
