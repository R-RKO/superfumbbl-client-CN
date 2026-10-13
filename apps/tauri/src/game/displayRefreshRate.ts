import { ref } from 'vue';

/**
 * Owner 10-13: "Match display" FPS option. The render loop is capped at the monitor refresh rate, measured with a
 * short requestAnimationFrame sample. The render loop stays bounded at all times: an unmeasured display resolves to 60.
 */

export const DISPLAY_RATE_FALLBACK = 60;
export const DISPLAY_RATE_MIN = 30;
export const DISPLAY_RATE_MAX = 240;
/** Fewer frame intervals than this is too noisy to trust. */
export const MIN_INTERVAL_SAMPLES = 20;
export const DEFAULT_SAMPLE_FRAMES = 60;

export type FpsCapSetting = number | 'display';

/** Median of a list of numbers (null when empty). */
export function medianOf(values: readonly number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Round a refresh rate in Hz to the nearest integer, clamped to 30..240. */
export function roundRefreshRate(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return DISPLAY_RATE_FALLBACK;
  const clamped = Math.min(DISPLAY_RATE_MAX, Math.max(DISPLAY_RATE_MIN, hz));
  return Math.round(clamped);
}

/** Frame intervals (ms) to refresh rate in Hz, or null when there are too few usable samples. The median shrugs off
 *  dropped frames and GC hiccups. */
export function estimateRefreshRate(intervalsMs: readonly number[]): number | null {
  const usable = intervalsMs.filter((v) => Number.isFinite(v) && v > 0);
  if (usable.length < MIN_INTERVAL_SAMPLES) return null;
  const median = medianOf(usable);
  if (median === null || median <= 0) return null;
  return roundRefreshRate(1000 / median);
}

/** Resolve the stored setting to the NUMBER the renderer receives. Never 0 / unbounded. */
export function resolveFpsCap(cap: FpsCapSetting | undefined, measuredHz: number | null | undefined): number {
  if (cap === 'display') {
    return typeof measuredHz === 'number' && Number.isFinite(measuredHz) && measuredHz > 0
      ? roundRefreshRate(measuredHz)
      : DISPLAY_RATE_FALLBACK;
  }
  return typeof cap === 'number' && Number.isFinite(cap) && cap > 0 ? cap : DISPLAY_RATE_FALLBACK;
}

/** Settings label for the "Match display" choice. */
export function matchDisplayLabel(measuredHz: number | null | undefined): string {
  return measuredHz ? `Match display (${measuredHz} Hz)` : 'Match display (measuring)';
}

/** Sample `frames` requestAnimationFrame intervals. Resolves null when the page is hidden (rAF is throttled or paused
 *  there) or becomes hidden mid-sample, or when rAF is missing. */
export function sampleRefreshRate(frames = DEFAULT_SAMPLE_FRAMES): Promise<number | null> {
  const doc = typeof document === 'undefined' ? null : document;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  if (!doc || !raf || doc.hidden) return Promise.resolve(null);
  return new Promise((resolve) => {
    const intervals: number[] = [];
    let last: number | null = null;
    const tick = (now: number): void => {
      if (doc.hidden) { resolve(null); return; }
      if (last !== null) intervals.push(now - last);
      last = now;
      if (intervals.length >= frames) resolve(estimateRefreshRate(intervals));
      else raf(tick);
    };
    raf(tick);
  });
}

/** Latest measured refresh rate (Hz), null until the first successful sample. Reactive. */
export const measuredRefreshHz = ref<number | null>(null);

/** A busy frame loop (load, GC, heavy animation) reads LOW, never high. The FIRST reading is provisional: it is shown
 *  at once, a confirming sample follows, and the higher of the two is kept. Afterwards a higher reading is accepted at
 *  once, but a LOWER one only when a second sample agrees (within 2 Hz). Pure; see tests. */
export function acceptMeasurement(
  current: number | null,
  candidate: number,
  pendingLower: number | null,
  provisional = false,
): { value: number | null; pendingLower: number | null; confirm: boolean; provisional: boolean } {
  if (current === null) return { value: candidate, pendingLower: null, confirm: true, provisional: true };
  if (provisional) return { value: Math.max(current, candidate), pendingLower: null, confirm: false, provisional: false };
  if (candidate >= current) return { value: candidate, pendingLower: null, confirm: false, provisional: false };
  if (pendingLower !== null && Math.abs(pendingLower - candidate) <= 2) return { value: candidate, pendingLower: null, confirm: false, provisional: false };
  return { value: current, pendingLower: candidate, confirm: true, provisional: false };
}

export const CONFIRM_DELAY_MS = 2000;
let inFlight: Promise<void> | null = null;
let pendingLower: number | null = null;
let provisional = false;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
export function refreshDisplayRate(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = sampleRefreshRate().then((hz) => {
    if (hz === null) return;
    const next = acceptMeasurement(measuredRefreshHz.value, hz, pendingLower, provisional);
    pendingLower = next.pendingLower;
    provisional = next.provisional;
    if (next.value !== measuredRefreshHz.value) measuredRefreshHz.value = next.value;
    if (next.confirm) {
      if (confirmTimer) clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirmTimer = null; void refreshDisplayRate(); }, CONFIRM_DELAY_MS);
    }
  }).finally(() => { inFlight = null; });
  return inFlight;
}

let tracking = false;
/** Listener installation is idempotent but EVERY call requests a measurement. Samples again on window resize (a move to another screen resizes the window) and when the
 *  window becomes visible again. Never samples while hidden. */
export function trackDisplayRate(): void {
  if (typeof window === 'undefined') return;
  if (tracking) { void refreshDisplayRate(); return; }
  tracking = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const later = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void refreshDisplayRate(); }, 400);
  };
  window.addEventListener('resize', later);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) later(); });
  // Owner-visible gap: a window dragged to another monitor does not always resize. Tauri reports the move itself.
  if ('__TAURI_INTERNALS__' in window) {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().onMoved(later))
      .catch(() => { /* API unavailable: resize + screen-signature polling still cover it */ });
  }
  void refreshDisplayRate();
}

/** Browser fallback: screen size / pixel ratio change when the window lands on another monitor. */
export function screenSignature(): string {
  if (typeof screen === 'undefined' || typeof window === 'undefined') return '';
  return `${screen.width}x${screen.height}@${window.devicePixelRatio}`;
}

let signature = '';
let pollTimer: ReturnType<typeof setInterval> | null = null;
export const SCREEN_POLL_MS = 10_000;
/** Slow screen-signature check, on only while Settings is open. A changed signature triggers a re-sample. */
export function setDisplayRatePolling(on: boolean): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (!on || typeof window === 'undefined') return;
  signature = screenSignature();
  pollTimer = setInterval(() => {
    const now = screenSignature();
    if (now !== signature) { signature = now; void refreshDisplayRate(); }
  }, SCREEN_POLL_MS);
}
