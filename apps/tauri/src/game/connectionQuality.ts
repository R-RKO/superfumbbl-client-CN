/**
 * Owner 10-21: connection indicator (quick bar, beside the spectator controls). Owner 10-22: a signal-bars ICON that is
 * always shown, with a WEAK tier between good and poor. Pure state machine: the current quality plus streak counters,
 * fed sample by sample (Astra 10-21: never re-derived from a bounded sample window, so nothing is forgotten by
 * eviction). store.ts feeds it from the session listeners that also write the wire log's connection records — ahead of
 * the wire-log gate, so it runs with logging off. Pings come from GameSession's own 8 s timer
 * (DEFAULT_PING_INTERVAL_MS), which never depended on the wire log.
 *
 * Rules (constants below):
 *  - 'lost'  on a socket close / error, until the next pong (that pong moves to 'poor', recovering). Overdue
 *            samples while lost keep it lost.
 *  - 'poor'  when POOR_STREAK consecutive pongs each took longer than POOR_RTT_MS, or on any pong-overdue sample
 *            (the store sends one every 5 s while a silence of 20 s+ lasts).
 *  - 'weak'  (from good) on ONE pong slower than POOR_RTT_MS, or WEAK_STREAK consecutive pongs each slower than
 *            WEAK_RTT_MS. Also where 'poor' recovers to when its last GOOD_STREAK pongs were at or under POOR_RTT_MS
 *            but not all at or under WEAK_RTT_MS.
 *  - 'good'  again only after GOOD_STREAK consecutive pongs at or under WEAK_RTT_MS (from weak or poor) with no
 *            overdue among them AND none within the last OVERDUE_WINDOW_MS (hysteresis: one quick pong never clears
 *            'poor' or 'weak'). The window is checked on every sample and on settle(now) (the store calls it on its 5 s
 *            timer).
 * A pong with an unknown round trip (no timestamp echoed) counts as arrival only: it ends 'lost' but feeds no streak.
 */

/** A round trip above this (ms) is slow: one turns good → weak, POOR_STREAK in a row turn it poor. */
export const POOR_RTT_MS = 400;
/** A round trip above this (ms) is elevated: WEAK_STREAK in a row turn good → weak; at or under it is calm. */
export const WEAK_RTT_MS = 250;
/** Consecutive slow pongs that turn the indicator poor. */
export const POOR_STREAK = 2;
/** Consecutive elevated pongs that turn good → weak. */
export const WEAK_STREAK = 2;
/** Consecutive calm pongs (no overdue between) that turn weak / poor back to good. */
export const GOOD_STREAK = 2;
/** A pong-overdue sample keeps the connection poor for at least this long (ms). */
export const OVERDUE_WINDOW_MS = 20_000;

export type ConnectionQuality = 'good' | 'weak' | 'poor' | 'lost';
export type ConnectionSample =
  | { kind: 'pong'; t: number; rttMs: number | null }
  | { kind: 'overdue'; t: number }
  | { kind: 'lost'; t: number };

export interface ConnectionState {
  readonly quality: ConnectionQuality;
  /** consecutive slow pongs (> POOR_RTT_MS) */
  readonly slow: number;
  /** consecutive elevated pongs (> WEAK_RTT_MS, slow ones included) */
  readonly elevated: number;
  /** consecutive pongs at or under POOR_RTT_MS since the last slow pong / overdue / loss */
  readonly quick: number;
  /** consecutive pongs at or under WEAK_RTT_MS since the last elevated pong / overdue / loss */
  readonly calm: number;
  /** time of the latest overdue sample, null = none yet */
  readonly lastOverdueAt: number | null;
  /** the latest known round trip (ms) — the tooltip's value; null when none yet */
  readonly rttMs: number | null;
}

export const INITIAL_CONNECTION_STATE: ConnectionState = Object.freeze({ quality: 'good', slow: 0, elevated: 0, quick: 0, calm: 0, lastOverdueAt: null, rttMs: null });

function overdueClear(s: ConnectionState, now: number): boolean {
  return s.lastOverdueAt == null || now - s.lastOverdueAt > OVERDUE_WINDOW_MS;
}

/** Recovery on the clock: 'poor' → 'good' (calm streak) or 'weak' (quick streak only); 'weak' → 'good' (calm streak).
 *  Both need the overdue window to have passed. */
export function settleConnection(s: ConnectionState, now: number): ConnectionState {
  if (!overdueClear(s, now)) return s;
  const calm = s.elevated === 0 && s.calm >= GOOD_STREAK;
  if (s.quality === 'poor' && s.slow === 0 && s.quick >= GOOD_STREAK) return { ...s, quality: calm ? 'good' : 'weak' };
  if (s.quality === 'weak' && calm) return { ...s, quality: 'good' };
  return s;
}

/** One transition. `sample.t` is the clock for the overdue window. */
export function stepConnection(s: ConnectionState, sample: ConnectionSample): ConnectionState {
  if (sample.kind === 'lost') return { ...s, quality: 'lost', slow: 0, elevated: 0, quick: 0, calm: 0 };
  if (sample.kind === 'overdue') {
    return { ...s, quality: s.quality === 'lost' ? 'lost' : 'poor', quick: 0, calm: 0, lastOverdueAt: sample.t };
  }
  let quality: ConnectionQuality = s.quality === 'lost' ? 'poor' : s.quality;
  const rtt = sample.rttMs;
  if (rtt == null || !Number.isFinite(rtt)) return { ...s, quality };
  const isSlow = rtt > POOR_RTT_MS;
  const isElevated = rtt > WEAK_RTT_MS;
  const slow = isSlow ? s.slow + 1 : 0;
  const elevated = isElevated ? s.elevated + 1 : 0;
  const quick = isSlow ? 0 : s.quick + 1;
  const calm = isElevated ? 0 : s.calm + 1;
  if (slow >= POOR_STREAK) quality = 'poor';
  else if (quality === 'good' && (slow >= 1 || elevated >= WEAK_STREAK)) quality = 'weak';
  return settleConnection({ ...s, quality, slow, elevated, quick, calm, rttMs: rtt }, sample.t);
}

/** Convenience fold (tests / diagnostics): every sample in order, then settle at `now`. */
export function connectionQuality(samples: readonly ConnectionSample[], now: number = Date.now()): ConnectionQuality {
  let s = INITIAL_CONNECTION_STATE;
  for (const sample of samples) s = stepConnection(s, sample);
  return settleConnection(s, now).quality;
}

/** Indicator copy (tooltip / aria-label lead) for a quality. */
export function connectionQualityLabel(quality: ConnectionQuality): string {
  return quality === 'good' ? 'Connection good' : quality === 'weak' ? 'Connection weak' : quality === 'poor' ? 'Poor connection' : 'Connection lost';
}

/** Silence (ms) after which the store records an overdue sample (matches the wire log's first pong-overdue rung). */
export const OVERDUE_SILENCE_MS = 20_000;

/** Astra 10-21 round 2: should this watchdog tick record an overdue sample? Never while the page is hidden (a
 *  background tab's timers are throttled, so pings stall and a healthy link would read as overdue); `quietSince` is
 *  the later of the last pong and the last hidden→visible resume, so the first post-resume gap is not counted. */
export function overdueSampleDue(opts: { hidden: boolean; now: number; quietSince: number }): boolean {
  return !opts.hidden && opts.now - opts.quietSince >= OVERDUE_SILENCE_MS;
}
