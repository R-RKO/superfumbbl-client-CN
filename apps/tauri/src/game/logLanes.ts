export type LogLane = 'match' | 'connection' | 'chat';
export interface OrderedLogRow<T> { entry: T; order: number; receivedWallAt: number }
export interface LogLanes<T> { match: OrderedLogRow<T>[]; connection: OrderedLogRow<T>[]; chat: OrderedLogRow<T>[] }
export const createLogLanes = <T>(): LogLanes<T> => ({ match: [], connection: [], chat: [] });

/** Match reports and client/connection notices: a ring per owner. */
export const LOG_LANE_LIMIT = 400;
/** RickWreckless 10-10: chat has its OWN ring. It used to share the 400-line ring with the client's own notices
 *  (one "play: STEP" line per square walked, hidden from the Log tab), so about twenty minutes of play pushed every
 *  earlier chat line out. A whole game's chat fits well inside this; the newest lines are never the ones dropped. */
export const CHAT_LANE_LIMIT = 2000;
const laneLimit = (owner: LogLane): number => owner === 'chat' ? CHAT_LANE_LIMIT : LOG_LANE_LIMIT;

/** Owner 10-15 (Graphical log): keep the newest `limit` ordinary rows; rows only the Graphical style shows (`isExtra`)
 *  ride along without counting against that limit (at most `limit` of them, never older than the oldest kept ordinary
 *  row), so they can never push Text-style history out of a ring. */
/** Owner 10-16: `isExtra` may name the style a row belongs to (a string); each style keeps its own `limit`, so the
 *  FUMBBL style's rows never push the Graphical style's out (true = one shared "extra" style). */
export function trimLogRows<R>(rows: readonly R[], limit: number, isExtra: (row: R) => boolean | string): R[] {
  const kept: R[] = [];
  let visible = 0;
  const extra = new Map<string, number>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    const style = isExtra(row);
    if (style) {
      const key = style === true ? 'extra' : style;
      const count = extra.get(key) ?? 0;
      if (count < limit) { kept.push(row); extra.set(key, count + 1); }
    } else {
      if (visible >= limit) break;
      kept.push(row);
      visible++;
    }
  }
  return kept.reverse();
}
/** Rows one log style shows alone (Graphical block-flow steps, FUMBBL-style upstream reports) ride along without
 *  counting against the ordinary rows. */
const graphicalOnlyRow = <T>(row: OrderedLogRow<T>): string | false => {
  const entry = row.entry as { graphicalOnly?: unknown; upstreamOnly?: unknown } | null;
  return entry?.graphicalOnly ? 'graphical' : entry?.upstreamOnly ? 'upstream' : false;
};

/** Every owner is bounded independently; replacing the cursor must never erase live chat/notices. */
export function appendLogLane<T>(lanes: LogLanes<T>, owner: LogLane, row: OrderedLogRow<T>, limit = laneLimit(owner)): void {
  lanes[owner].push(row);
  if (owner === 'match') {
    if (lanes.match.length > limit) lanes.match = trimLogRows(lanes.match, limit, graphicalOnlyRow);
    return;
  }
  if (lanes[owner].length > limit) lanes[owner].splice(0, lanes[owner].length - limit);
}
export function replaceMatchLogLane<T>(lanes: LogLanes<T>, rows: readonly OrderedLogRow<T>[], limit = LOG_LANE_LIMIT): void {
  lanes.match = trimLogRows(rows, limit, graphicalOnlyRow);
}
/** Put chat rows kept from an earlier connection to the same game back in front of whatever arrived since. */
export function restoreChatLane<T>(lanes: LogLanes<T>, rows: readonly OrderedLogRow<T>[], limit = CHAT_LANE_LIMIT): void {
  lanes.chat = [...rows, ...lanes.chat].sort((a, b) => a.order - b.order).slice(-limit);
}
/** One list in receive order. Each owner contributes at most its own ring, so a busy owner (the client's notices)
 *  can no longer evict another owner's lines (chat, match reports) from the composed log. */
export function composeLogLanes<T>(lanes: { match: readonly OrderedLogRow<T>[]; connection: readonly OrderedLogRow<T>[]; chat?: readonly OrderedLogRow<T>[] }, limit = LOG_LANE_LIMIT, chatLimit = CHAT_LANE_LIMIT): T[] {
  return [...trimLogRows(lanes.match, limit, graphicalOnlyRow), ...lanes.connection.slice(-limit), ...(lanes.chat ?? []).slice(-chatLimit)]
    .sort((a, b) => a.order - b.order).map((row) => row.entry);
}
