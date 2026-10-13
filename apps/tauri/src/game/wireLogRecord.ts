import type { RailDiagnostic } from './railDiagnostics';

/** Structured rail telemetry shares the per-game JSONL with inbound/outbound wire records so bug reports retain
 * the exact diagnostic occurrence. It deliberately carries no command payload or credentials. */
export function railDiagnosticWireRecord(seq: number, t: number, diagnostic: Readonly<RailDiagnostic>) {
  return {
    seq,
    t,
    dir: 'diagnostic' as const,
    category: 'rail' as const,
    diagnostic: { ...diagnostic },
  };
}

/** Owner 09-27 (game 1947111: a Taunt decision "never resolved" — the log could not tell a slow opponent from a
 *  stalled socket): CONNECTION records ride the same per-game JSONL. Events: `state` (session state change),
 *  `close` (code + reason), `error`, `pong` (round-trip + gap since the previous pong) and `pong-overdue` (no pong
 *  for longer than expected — logging only, nothing reconnects). No payloads, no credentials. */
/** P1 10-06 (g1950446: "joined" then no game state, and the trail could not say whether the opponent was in or the join
 *  carried a team): `join-accepted` (how many PLAYER seats the server's serverJoin lists) and `team-list` (the server
 *  asked for a team — row count only). */
export type ConnectionWireEvent = 'state' | 'close' | 'error' | 'pong' | 'pong-overdue' | 'join-start' | 'join-error' | 'join-accepted' | 'team-list' | 'server-join' | 'game-time' | 'long-frame';
/** Owner 09-27: a join that never reaches a game has no per-game wire file — its connection records go to a dated
 *  connection log instead, so a failed rejoin leaves evidence. */
export function connectionLogFileName(now: Date): string {
  return `connection-${now.toISOString().slice(0, 10)}.jsonl`;
}
export function connectionWireRecord(seq: number, t: number, event: ConnectionWireEvent, detail: Readonly<Record<string, string | number | boolean | null>> = {}) {
  return { seq, t, dir: 'connection' as const, event, ...detail };
}
/** The pong-overdue ladder: a line when the silence first passes 20 s, again at 60 s, then once per further minute.
 *  Returns the stage reached for `silenceMs` (0 = not overdue); a caller logs when the stage rises. */
export function pongOverdueStage(silenceMs: number): number {
  if (!(silenceMs >= 20_000)) return 0;
  if (silenceMs < 60_000) return 1;
  return 1 + Math.floor(silenceMs / 60_000);
}

/** Lag-investigation diagnostics (10-13, coach "laggy on opponent turn after a spectator joined"): compact connection
 *  records only. `server-join` = coach name + player and spectator counts; `game-time` = one server clock sample, at
 *  most one per 10 s; `long-frame` = a main-thread frame gap over 250 ms, at most 20 per minute, never while hidden.
 *  No chat text, no names beyond the coach name the join line already logs. */
export const GAME_TIME_LOG_INTERVAL_MS = 10_000;
export const LONG_FRAME_THRESHOLD_MS = 250;
export const LONG_FRAME_MAX_PER_MINUTE = 20;
export function serverJoinDetail(cmd: { coach?: unknown; playerNames?: unknown; spectators?: unknown }): Record<string, string | number | null> {
  return {
    coach: typeof cmd.coach === 'string' ? cmd.coach : null,
    players: Array.isArray(cmd.playerNames) ? cmd.playerNames.length : null,
    spectators: typeof cmd.spectators === 'number' ? cmd.spectators : null,
  };
}
/** Returns true when a sample taken at `now` should be written (first sample, then once per interval). */
export function createIntervalGate(intervalMs: number): (now: number) => boolean {
  let last = -Infinity;
  return (now) => { if (now - last < intervalMs) return false; last = now; return true; };
}
export function createLongFrameDetector(opts: { thresholdMs?: number; maxPerMinute?: number } = {}) {
  const threshold = opts.thresholdMs ?? LONG_FRAME_THRESHOLD_MS;
  const cap = opts.maxPerMinute ?? LONG_FRAME_MAX_PER_MINUTE;
  let lastFrame: number | null = null;
  let windowStart = 0;
  let inWindow = 0;
  return {
    /** Call once per animation frame. Returns the record detail to write, or null. */
    sample(now: number, hidden: boolean): { kind: 'longFrame'; ms: number; at: number } | null {
      if (hidden) { lastFrame = null; return null; }
      const prev = lastFrame;
      lastFrame = now;
      if (prev == null) return null;
      const ms = now - prev;
      if (!(ms > threshold)) return null;
      if (now - windowStart >= 60_000) { windowStart = now; inWindow = 0; }
      if (inWindow >= cap) return null;
      inWindow += 1;
      return { kind: 'longFrame', ms: Math.round(ms), at: Math.round(now) };
    },
    reset() { lastFrame = null; },
  };
}
