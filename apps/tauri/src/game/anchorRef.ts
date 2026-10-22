/**
 * Perf (JLeav 1.0.261): screen-anchor refs for the view's per-frame trackers.
 *
 * SpectateView follows camera pans / zoom for its pitch-anchored cards and pills with requestAnimationFrame loops that
 * assign a FRESH object (`pos.value = { x, y }`) every frame. A plain ref treats every new object as a change, so each
 * frame re-rendered the whole view (and, through it, every log row) and the next layout read forced a full reflow:
 * ~120 full renders a second for as long as e.g. the block dice card was up. An anchor ref only triggers when the value
 * it is given differs structurally (plain objects / arrays compared by their fields), so a still camera costs nothing
 * and a moving one renders exactly as before.
 *
 * Values are kept as given (no deep reactive proxy): the trackers always replace the whole value, never mutate it.
 */
import { customRef, type Ref } from 'vue';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Structural equality for plain JSON-like data (objects, arrays, primitives); anything else compares by identity. */
export function samePlainValue(a: unknown, b: unknown, depth = 6): boolean {
  if (Object.is(a, b)) return true;
  if (depth <= 0) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!samePlainValue(a[i], b[i], depth - 1)) return false;
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!samePlainValue(a[key], b[key], depth - 1)) return false;
    }
    return true;
  }
  return false;
}

/** A ref that ignores assignments structurally equal to its current value (see the module note). */
export function anchorRef<T>(initial: T): Ref<T> {
  let value = initial;
  return customRef<T>((track, trigger) => ({
    get() {
      track();
      return value;
    },
    set(next: T) {
      if (samePlainValue(value, next)) return;
      value = next;
      trigger();
    },
  }));
}
