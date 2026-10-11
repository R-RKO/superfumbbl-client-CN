/**
 * Controller support P2b (owner round 2, spec-controller-support.md "Haptics"): rumble on the active pad through the
 * Gamepad API's `vibrationActuator` — dice landing 60 ms weak, turnover 2 x 120 ms strong, casualty 200 ms strong.
 * Behind Settings > Controls "Rumble" (`controllerRumble`) and only while the controller is the active input.
 *
 * Driven by the presentation's own sound cues (game/sounds.ts onSoundCue), so a rumble lands on the same beat as the
 * sound — and is muted by the same fast-forward suppression: `block` = block dice landing, `sad_trombone` = the
 * turnover sting, `injury` / `rip` = a casualty.
 */
export type HapticEvent = 'dice' | 'turnover' | 'casualty';
export interface RumblePulse { duration: number; weak: number; strong: number; delayBefore: number }

export const HAPTIC_PATTERNS: Record<HapticEvent, readonly RumblePulse[]> = {
  dice: [{ duration: 60, weak: 1, strong: 0, delayBefore: 0 }],
  turnover: [{ duration: 120, weak: 0.4, strong: 1, delayBefore: 0 }, { duration: 120, weak: 0.4, strong: 1, delayBefore: 100 }],
  casualty: [{ duration: 200, weak: 0.4, strong: 1, delayBefore: 0 }],
};

export const SOUND_HAPTICS: Readonly<Record<string, HapticEvent>> = {
  block: 'dice',
  sad_trombone: 'turnover',
  injury: 'casualty',
  rip: 'casualty',
};

/** The slice of a DOM GamepadHapticActuator used here. */
export interface ActuatorLike {
  playEffect?(type: 'dual-rumble', params: { startDelay?: number; duration: number; weakMagnitude: number; strongMagnitude: number }): Promise<unknown>;
}
export interface HapticPadLike { connected: boolean; mapping?: string; timestamp?: number; vibrationActuator?: ActuatorLike | null }

export interface HapticsDeps {
  enabled(): boolean;
  pads(): ArrayLike<HapticPadLike | null | undefined>;
  /** Timer for the later pulses (defaults to setTimeout). A second playEffect issued while the first runs PREEMPTS it
   *  (Astra P2-7), so each pulse is started only after the previous one ended. */
  schedule?(fn: () => void, ms: number): unknown;
}

/** The pad to rumble: the most recently used connected one (highest timestamp). */
export function activeHapticPad(pads: ArrayLike<HapticPadLike | null | undefined>): HapticPadLike | null {
  let best: HapticPadLike | null = null;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (!p || !p.connected || !p.vibrationActuator?.playEffect) continue;
    if (!best || (p.timestamp ?? 0) > (best.timestamp ?? 0)) best = p;
  }
  return best;
}

/** The later pulses still waiting on a timer (default scheduler only). */
const pendingPulses = new Set<ReturnType<typeof setTimeout>>();
function scheduleTracked(fn: () => void, ms: number): void {
  const handle = setTimeout(() => { pendingPulses.delete(handle); fn(); }, ms);
  pendingPulses.add(handle);
}
/** Astra P3 10-10: drop every queued follow-up pulse (controller support was unticked). */
export function cancelPendingHaptics(): void {
  for (const handle of pendingPulses) clearTimeout(handle);
  pendingPulses.clear();
}
export function pendingHapticCount(): number { return pendingPulses.size; }

/** Plays `event` on the active pad; false when gated off or no pad can rumble. Pulses are scheduled with startDelay. */
export function playHaptic(event: HapticEvent, deps: HapticsDeps): boolean {
  if (!deps.enabled()) return false;
  let pads: ArrayLike<HapticPadLike | null | undefined> = [];
  try { pads = deps.pads(); } catch { return false; }
  const pad = activeHapticPad(pads);
  if (!pad) return false;
  const schedule = deps.schedule ?? scheduleTracked;
  const pulses = HAPTIC_PATTERNS[event];
  const play = (i: number): void => {
    const pulse = pulses[i];
    if (!pulse) return;
    if (i > 0 && !deps.enabled()) return; // Astra P3 10-10: rumble / controller support went off while a later pulse waited
    try {
      void pad.vibrationActuator!.playEffect!('dual-rumble', { startDelay: 0, duration: pulse.duration, weakMagnitude: pulse.weak, strongMagnitude: pulse.strong })
        ?.catch?.(() => undefined);
    } catch { return; }
    const nextPulse = pulses[i + 1];
    if (nextPulse) schedule(() => play(i + 1), pulse.duration + nextPulse.delayBefore);
  };
  if (pulses[0]!.delayBefore > 0) schedule(() => play(0), pulses[0]!.delayBefore); else play(0);
  return true;
}

/** The browser pads (navigator.getGamepads), or none. */
export function browserHapticPads(): ArrayLike<HapticPadLike | null> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return navigator.getGamepads() as unknown as ArrayLike<HapticPadLike | null>;
}

/** A sound cue → its rumble (if any). */
export function hapticForSound(soundId: string, deps: HapticsDeps): boolean {
  const event = SOUND_HAPTICS[soundId];
  return event ? playHaptic(event, deps) : false;
}
