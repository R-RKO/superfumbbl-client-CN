/**
 * Controller support P2b (owner addition 10-07): HOLDING a chord modifier (LB, RT) surfaces the chord layer on the
 * interface — every control tagged `data-pad-action="<actionId>"` whose controller binding is `<modifier>+<button>`
 * shows that button's glyph as a badge while the modifier is held (the overlay fades them ~150 ms after release).
 * Bindings are read live, so a rebound chord shows its new button.
 */
import { getBinding, isControlActionId, type ControlActionId, type ControlSettings } from './controls';

export type ChordModifier = 'LB' | 'RT';
export const CHORD_BADGE_FADE_MS = 150;

/** The button a held modifier reaches `id` with (its first chord binding under that modifier), or null. */
export function chordButtonFor(settings: ControlSettings, id: ControlActionId, modifier: ChordModifier): string | null {
  const b = getBinding(settings, id).controller;
  for (const input of [b.primary, b.secondary]) {
    if (input.startsWith(`${modifier}+`)) return input.slice(modifier.length + 1);
  }
  return null;
}

export interface ChordBadge<T> { target: T; actionId: ControlActionId; glyph: string }
/** Every tagged target reachable under the held modifiers (LB wins when both are held, as in the poller). */
export function chordBadges<T>(
  settings: ControlSettings,
  held: { LB: boolean; RT: boolean },
  targets: readonly { target: T; actionId: string | null | undefined }[],
): ChordBadge<T>[] {
  const modifier: ChordModifier | null = held.LB ? 'LB' : held.RT ? 'RT' : null;
  if (!modifier) return [];
  const out: ChordBadge<T>[] = [];
  for (const t of targets) {
    if (!t.actionId || !isControlActionId(t.actionId)) continue;
    const glyph = chordButtonFor(settings, t.actionId, modifier);
    if (glyph) out.push({ target: t.target, actionId: t.actionId, glyph });
  }
  return out;
}
