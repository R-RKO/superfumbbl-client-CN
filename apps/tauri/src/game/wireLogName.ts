// Owner 10-22 ("Option A", second client window): two clients can run at once, and both may watch the same game, so
// every wire-log file name carries a tag unique to this client instance: `wire-g<gameId>-<iso>-<tag>.jsonl`. The tag is
// drawn once per page load (6 lowercase base-36 characters); the bug report keeps attaching this window's own file
// because it attaches the path the store's append returned (state.wireLogFile), never a directory scan.

function drawInstanceTag(): string {
  try {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  } catch {
    return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  }
}

/** This client instance's wire-log tag (fixed for the page's life). */
export const WIRE_LOG_INSTANCE_TAG: string = drawInstanceTag();

/** The wire-log file name for one game: `wire-g<gameId>-<ISO, ':' and '.' as '-'>-<instance tag>.jsonl`. The prefix up
 *  to the ISO date is unchanged, so bugReport.ts's wireLogGameId still reads the game id. */
export function wireLogFileName(gameId: number | string, at: Date = new Date(), tag: string = WIRE_LOG_INSTANCE_TAG): string {
  return `wire-g${gameId}-${at.toISOString().replace(/[:.]/g, '-')}-${tag}.jsonl`;
}
