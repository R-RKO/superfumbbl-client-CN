/**
 * Owner 10-21: POOR CONNECTION indicator (quick bar, beside the spectator controls). Pure state machine: the current
 * quality plus streak counters, fed sample by sample (Astra 10-21: never re-derived from a bounded sample window, so
 * nothing is forgotten by eviction). store.ts feeds it from the session listeners that also write the wire log's
 * connection records — ahead of the wire-log gate, so it runs with logging off. Pings come from GameSession's own
 * 8 s timer (DEFAULT_PING_INTERVAL_MS), which never depended on the wire log.
 *
 * Rules (constants below):
 *  - 'lost'  on a socket close / error, until the next pong (that pong moves to 'poor', recovering). Overdue
 *            samples while lost keep it lost.
 *  - 'poor'  when POOR_STREAK consecutive pongs each took longer than POOR_RTT_MS, or on any pong-overdue sample
 *            (the store sends one every 5 s while a silence of 20 s+ lasts).
 *  - 'good'  again only after GOOD_STREAK consecutive pongs at or under POOR_RTT_MS with no overdue among them AND
 *            none within the last OVERDUE_WINDOW_MS (hysteresis: one quick pong never clears 'poor'). The window is
 *            checked on every sample and on settle(now) (the store calls it on its 5 s timer).
 * A pong with an unknown round trip (no timestamp echoed) counts as arrival only: it ends 'lost' but feeds neither streak.
 */

/** A round trip above this (ms) is slow. */
export const POOR_RTT_MS = 400;
/** Consecutive slow pongs that turn the indicator on. */
export const POOR_STREAK = 2;
/** Consecutive quick pongs (no overdue between) that turn it off again. */
export const GOOD_STREAK = 2;
/** A pong-overdue sample keeps the connection poor for at least this long (ms). */
export const OVERDUE_WINDOW_MS = 20_000;

export type ConnectionQuality = 'good' | 'poor' | 'lost';
export type ConnectionSample =
  | { kind: 'pong'; t: number; rttMs: number | null }
  | { kind: 'overdue'; t: number }
  | { kind: 'lost'; t: number };

export interface ConnectionState {
  readonly quality: ConnectionQuality;
  /** consecutive slow pongs */
  readonly slow: number;
  /** consecutive quick pongs since the last slow pong / overdue / loss */
  readonly quick: number;
  /** time of the latest overdue sample, null = none yet */
  readonly lastOverdueAt: number | null;
  /** the latest known round trip (ms) — the tooltip's value; null when none yet */
  readonly rttMs: number | null;
}

export const INITIAL_CONNECTION_STATE: ConnectionState = Object.freeze({ quality: 'good', slow: 0, quick: 0, lastOverdueAt: null, rttMs: null });

function overdueClear(s: ConnectionState, now: number): boolean {
  return s.lastOverdueAt == null || now - s.lastOverdueAt > OVERDUE_WINDOW_MS;
}

/** Promotes 'poor' to 'good' once the quick streak is complete and the overdue window has passed. */
export function settleConnection(s: ConnectionState, now: number): ConnectionState {
  if (s.quality === 'poor' && s.slow === 0 && s.quick >= GOOD_STREAK && overdueClear(s, now)) return { ...s, quality: 'good' };
  return s;
}

/** One transition. `sample.t` is the clock for the overdue window. */
export function stepConnection(s: ConnectionState, sample: ConnectionSample): ConnectionState {
  if (sample.kind === 'lost') return { ...s, quality: 'lost', slow: 0, quick: 0 };
  if (sample.kind === 'overdue') {
    return { ...s, quality: s.quality === 'lost' ? 'lost' : 'poor', quick: 0, lastOverdueAt: sample.t };
  }
  let quality: ConnectionQuality = s.quality === 'lost' ? 'poor' : s.quality;
  const rtt = sample.rttMs;
  if (rtt == null || !Number.isFinite(rtt)) return { ...s, quality };
  const slow = rtt > POOR_RTT_MS ? s.slow + 1 : 0;
  const quick = rtt > POOR_RTT_MS ? 0 : s.quick + 1;
  if (slow >= POOR_STREAK) quality = 'poor';
  return settleConnection({ ...s, quality, slow, quick, rttMs: rtt }, sample.t);
}

/** Convenience fold (tests / diagnostics): every sample in order, then settle at `now`. */
export function connectionQuality(samples: readonly ConnectionSample[], now: number = Date.now()): ConnectionQuality {
  let s = INITIAL_CONNECTION_STATE;
  for (const sample of samples) s = stepConnection(s, sample);
  return settleConnection(s, now).quality;
}

/** Pill copy for a quality; null = no pill. */
export function connectionQualityLabel(quality: ConnectionQuality): string | null {
  return quality === 'poor' ? 'Poor connection' : quality === 'lost' ? 'Connection lost' : null;
}

/** Silence (ms) after which the store records an overdue sample (matches the wire log's first pong-overdue rung). */
export const OVERDUE_SILENCE_MS = 20_000;

/** Astra 10-21 round 2: should this watchdog tick record an overdue sample? Never while the page is hidden (a
 *  background tab's timers are throttled, so pings stall and a healthy link would read as overdue); `quietSince` is
 *  the later of the last pong and the last hidden→visible resume, so the first post-resume gap is not counted. */
export function overdueSampleDue(opts: { hidden: boolean; now: number; quietSince: number }): boolean {
  return !opts.hidden && opts.now - opts.quietSince >= OVERDUE_SILENCE_MS;
}
