import { englishText, lt, type LocalText } from '../i18n';
/** Owner 09-07: the log line for a serverJoin broadcast — "<Coach> joined as <Seat>" for a player seat (Home /
 *  Away by the game's coach names, "a coach" when the seat is not yet known) and "<Coach> is now spectating the
 *  game." for a spectator. Null when the broadcast carries no coach (nothing worth a line). */
export function joinLogMessage(
  cmd: { coach?: unknown; clientMode?: unknown },
  game: { teamHome?: { coach?: unknown }; teamAway?: { coach?: unknown } } | null | undefined,
): LocalText | null {
  const coach = typeof cmd.coach === 'string' ? cmd.coach.trim() : '';
  if (!coach) return null;
  const mode = String(cmd.clientMode ?? '').toLowerCase();
  if (mode === 'spectator') return lt('log.join.spectating', { coach });
  const same = (c: unknown) => typeof c === 'string' && c.trim().toLowerCase() === coach.toLowerCase();
  const seat = same(game?.teamHome?.coach) ? lt('log.join.seatHome') : same(game?.teamAway?.coach) ? lt('log.join.seatAway') : null;
  return lt('log.join.joinedAs', { coach, seat: seat ?? lt('log.join.aCoach') });
}
/** The line as the log stores it (English; the view localises the message - Astra r2). */
export function joinLogLine(
  cmd: { coach?: unknown; clientMode?: unknown },
  game: { teamHome?: { coach?: unknown }; teamAway?: { coach?: unknown } } | null | undefined,
): string | null {
  const message = joinLogMessage(cmd, game);
  return message ? englishText(message) : null;
}
