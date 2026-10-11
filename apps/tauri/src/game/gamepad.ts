/**
 * Controller support P1 (owner 10-07, spec-controller-support.md): a dependency-free poller over the browser Gamepad
 * API. WebView2 / WKWebView / WebKitGTK expose Xbox pads (and DualShock / DualSense) through the W3C "standard"
 * mapping, so one table names every input.
 *
 * Split in two so the logic is testable without a browser:
 *  - `readFrame(gamepads, prev, now)` is PURE: it maps one snapshot of `navigator.getGamepads()` to the input events
 *    of that frame (edges, chords, trigger tap / hold, stick directions with repeat, analog sticks) and returns the
 *    next state.
 *  - `createGamepadPoller()` is the rAF loop: it runs only while a pad is connected and publishes on the bus.
 *
 * Chords (owner 10-07, o66md): LB and RT are the chord modifiers. While one is held every other button emits
 * `LB+<Button>` / `RT+<Button>` instead of `<Button>` (LB wins when both are held). LB still reports its own plain
 * press (main-screen blade cycling); its release carries `wasModifier: true` when it served as a modifier. A button
 * pressed as part of a chord releases as the chord too, even when the modifier was let go first.
 *
 * Trigger gestures (zoom by default): LT / RT released within 300 ms emits a press of `LT(tap)` / `RT(tap)` just before
 * the release; held past 300 ms it emits a press of `LT(hold)` / `RT(hold)` (continuous) and, on release, the matching
 * release. LT is not a chord modifier, so other buttons never interrupt it. RT is: a button pressed while RT is down
 * makes it the modifier — no tap, and a running hold ends (release `RT(hold)`). RT is not a precision modifier
 * (precision moved to L3).
 *
 * "View" is standard button 8 (View / Back). The Series controller's Share key is an OS key the Gamepad API never
 * reports (owner round 2).
 */

export const PAD_BUTTONS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L3', 'R3', 'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight',
] as const;
export type PadButton = (typeof PAD_BUTTONS)[number];
export type PadStick = 'left' | 'right';
export type PadDirection = 'Up' | 'Down' | 'Left' | 'Right';

/** Radial deadzone default for each stick (owner round 2: 0.15; Settings > Controls 0.05-0.40 per stick). */
export const STICK_DEADZONE = 0.15;
export const STICK_DEADZONE_MIN = 0.05;
export const STICK_DEADZONE_MAX = 0.4;
/** LT / RT are analog with hysteresis (Astra review): pressed above TRIGGER_PRESS, released only below
 *  TRIGGER_THRESHOLD (XInput's recommended trigger threshold) — no bounce taps, and drift never starts a hold. */
export const TRIGGER_PRESS = 0.5;
export const TRIGGER_THRESHOLD = 0.12;
/** The chord modifiers, in precedence order (owner 10-07: LB replaced LT). */
export const PAD_MODIFIERS = ['LB', 'RT'] as const;
export type PadModifier = (typeof PAD_MODIFIERS)[number];
/** The analog triggers, which carry the tap / hold gesture. */
export const PAD_TRIGGERS = ['LT', 'RT'] as const;
export type PadTrigger = (typeof PAD_TRIGGERS)[number];
/** A trigger released within this = a tap (one step); held longer = the hold gesture (continuous). */
export const TRIGGER_TAP_MS = 300;

/** A stick counts as deliberate use (switches auto mode) past deadzone + this for ENGAGE_POLLS polls in a row. */
export const ENGAGE_MARGIN = 0.1;
export const ENGAGE_POLLS = 2;

export interface ReadFrameOptions {
  deadzoneLeft?: number;
  deadzoneRight?: number;
  /** A pad first seen in this poll starts re-baselined (what it holds is silent until let go) — set by the poller for
   *  its first poll and the first poll after a suspend (Astra review: a pad plugged in during blur). */
  rebaselineNewPads?: boolean;
}
export function clampDeadzone(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : STICK_DEADZONE;
  return Math.min(STICK_DEADZONE_MAX, Math.max(STICK_DEADZONE_MIN, n));
}
/** A stick counts as pointing in a direction once its (deadzoned) magnitude passes this. */
export const DIRECTION_THRESHOLD = 0.5;
/** Stick-as-direction repeat: the first step fires at once, the second after 350 ms, then every 125 ms. */
export const DIRECTION_REPEAT_FIRST_MS = 350;
export const DIRECTION_REPEAT_MS = 125;

/** The slice of the DOM `Gamepad` the poller reads (tests pass plain objects). */
export interface GamepadLike {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number }>;
  readonly axes: ReadonlyArray<number>;
}

export interface StickValue { x: number; y: number }

export type PadEvent =
  | { type: 'connected'; pad: number; id: string; standard: boolean }
  | { type: 'disconnected'; pad: number; id: string }
  /** `input` is a button name or a chord (`LT+DpadUp`). */
  | { type: 'press'; pad: number; input: string }
  /** `cancelled`: a forced release (window blur / hidden, the floor moving to another pad) — never acted on. */
  | { type: 'release'; pad: number; input: string; wasModifier?: boolean; cancelled?: boolean }
  /** Analog stick after the deadzone, every frame it is off-centre plus once when it returns to centre. `y` is
   *  positive DOWN (the Gamepad API convention). */
  | { type: 'stick'; pad: number; stick: PadStick; x: number; y: number; engaged?: boolean }
  /** Stick-as-direction step (with repeat). */
  | { type: 'direction'; pad: number; stick: PadStick; direction: PadDirection; repeat: boolean };

interface StickRepeat { direction: PadDirection | null; nextAt: number; count: number }

interface PadMemory {
  id: string;
  /** The pad reported the "standard" mapping (Astra P2-5: a flip at the same index / id is a reconnect). */
  standard?: boolean;
  buttons: Record<PadButton, boolean>;
  /** Buttons whose current hold began as a chord → the modifier it began under (they release as that chord). */
  chorded: Map<PadButton, PadModifier>;
  /** Each modifier served as one during its current hold. */
  modifierUsed: Record<PadModifier, boolean>;
  /** When each trigger went down, and whether its hold gesture is running. */
  triggerDownAt: Record<PadTrigger, number>;
  holdActive: Record<PadTrigger, boolean>;
  /** Buttons held through a forced release (blur / hidden / losing the floor): their eventual release is silent and
   *  a held trigger neither taps nor holds until pressed again (re-baseline). */
  suppressed: Set<PadButton>;
  /** Re-baseline on the next poll (set by suspendPads: the buttons held THEN become suppressed). */
  rebaseline: boolean;
  sticks: Record<PadStick, StickValue>;
  /** Consecutive polls each stick spent past deadzone + ENGAGE_MARGIN (Astra review P2.1: drift never switches). */
  engagedPolls: Record<PadStick, number>;
  repeat: Record<PadStick, StickRepeat>;
}

export interface PadFrameState {
  pads: Map<number, PadMemory>;
  /** Owner (10-07): with several pads the LAST USED one is active — only its input is reported. */
  activePad: number | null;
}

export function emptyFrameState(): PadFrameState { return { pads: new Map(), activePad: null }; }

function blankButtons(): Record<PadButton, boolean> {
  return Object.fromEntries(PAD_BUTTONS.map((b) => [b, false])) as Record<PadButton, boolean>;
}

/** Radial deadzone: inside → 0; outside, the remaining travel is rescaled to 0..1 so the stick still reaches full. */
export function applyDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): StickValue {
  const fx = Number.isFinite(x) ? x : 0;
  const fy = Number.isFinite(y) ? y : 0;
  const magnitude = Math.hypot(fx, fy);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return { x: (fx / magnitude) * scaled, y: (fy / magnitude) * scaled };
}

/** The dominant direction of a deadzoned stick, or null below DIRECTION_THRESHOLD. */
export function stickDirection(value: StickValue): PadDirection | null {
  if (Math.hypot(value.x, value.y) < DIRECTION_THRESHOLD) return null;
  if (Math.abs(value.x) >= Math.abs(value.y)) return value.x < 0 ? 'Left' : 'Right';
  return value.y < 0 ? 'Up' : 'Down';
}

function readButtons(pad: GamepadLike, was: Record<PadButton, boolean>): Record<PadButton, boolean> {
  const out = blankButtons();
  PAD_BUTTONS.forEach((name, i) => {
    const button = pad.buttons[i];
    if (!button) return;
    const value = Number.isFinite(button.value) ? button.value : 0;
    out[name] = name === 'LT' || name === 'RT'
      ? value > TRIGGER_PRESS || (was[name] && value >= TRIGGER_THRESHOLD) // hysteresis
      : !!button.pressed || value > TRIGGER_PRESS;
  });
  return out;
}

/** Publishes releases for everything `memory` holds (chords as chords, triggers ending any hold, sticks re-centred)
 *  as CANCELLED events, and suppresses those buttons until they are let go. */
function releaseAllHeld(memory: PadMemory, padIndex: number, out: PadEvent[]): void {
  for (const trigger of PAD_TRIGGERS) {
    if (memory.holdActive[trigger]) out.push({ type: 'release', pad: padIndex, input: `${trigger}(hold)`, cancelled: true });
    memory.holdActive[trigger] = false;
  }
  for (const name of PAD_BUTTONS) {
    if (!memory.buttons[name] || memory.suppressed.has(name)) continue;
    const mod = memory.chorded.get(name);
    out.push({ type: 'release', pad: padIndex, input: mod ? `${mod}+${name}` : name, wasModifier: true, cancelled: true });
    memory.suppressed.add(name);
  }
  memory.chorded.clear();
  memory.modifierUsed = { LB: false, RT: false };
  for (const stick of ['left', 'right'] as const) {
    const v = memory.sticks[stick];
    // The receiver re-centres; the pad's own stick memory is kept, so a still-tilted stick is not "fresh" input
    // (it never steals the floor back, and resumes as continuing motion).
    if (v.x !== 0 || v.y !== 0) out.push({ type: 'stick', pad: padIndex, stick, x: 0, y: 0 });
  }
}

/**
 * Astra review: window blur / document hidden. Releases everything the ACTIVE pad holds (cancelled events), and marks
 * every pad to re-baseline on its next poll: whatever is held then stays silent until let go, so no gesture resumes
 * with a frozen tab's elapsed time. Pure: returns the events and the next state.
 */
export function suspendPads(prev: PadFrameState): { events: PadEvent[]; state: PadFrameState } {
  const events: PadEvent[] = [];
  const next: PadFrameState = { pads: new Map(), activePad: prev.activePad };
  for (const [index, before] of prev.pads) {
    const memory = cloneMemory(before);
    const out: PadEvent[] = [];
    releaseAllHeld(memory, index, out);
    if (index === prev.activePad) events.push(...out);
    memory.rebaseline = true;
    next.pads.set(index, memory);
  }
  return { events, state: next };
}

function cloneMemory(before: PadMemory): PadMemory {
  return {
    id: before.id, buttons: { ...before.buttons }, chorded: new Map(before.chorded), modifierUsed: { ...before.modifierUsed },
    triggerDownAt: { ...before.triggerDownAt }, holdActive: { ...before.holdActive },
    suppressed: new Set(before.suppressed), rebaseline: before.rebaseline,
    sticks: { left: { ...before.sticks.left }, right: { ...before.sticks.right } },
    engagedPolls: { ...before.engagedPolls },
    repeat: { left: { ...before.repeat.left }, right: { ...before.repeat.right } },
  };
}

/**
 * One poll. Pure: `prev` is not mutated. `now` is a millisecond clock (performance.now in the loop).
 * Non-"standard" pads are reported on connect (`standard: false`) but produce no input events — the button
 * indices would mean something else.
 */
export function readFrame(gamepads: ArrayLike<GamepadLike | null | undefined>, prev: PadFrameState, now: number, options: ReadFrameOptions = {}): { events: PadEvent[]; state: PadFrameState } {
  const events: PadEvent[] = [];
  const next: PadFrameState = { pads: new Map(), activePad: prev.activePad };
  /** Per pad: this frame's input events, and whether it saw fresh input (a press edge, or a stick leaving centre). */
  const perPad: { index: number; input: PadEvent[]; fresh: boolean; memory: PadMemory; before?: PadMemory }[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < gamepads.length; i++) {
    const pad = gamepads[i];
    if (!pad || !pad.connected) continue;
    seen.add(pad.index);
    const standard = pad.mapping === 'standard';
    const before = prev.pads.get(pad.index);
    // Astra P2-5: the mapping is part of the pad's identity — Steam Input starting (or stopping) while the app runs
    // flips a pad at the same index / id between non-standard and standard; that is a disconnect + connect.
    const samePad = !!before && before.id === pad.id && (before.standard ?? standard) === standard;
    if (!samePad) {
      if (before) events.push({ type: 'disconnected', pad: pad.index, id: before.id });
      events.push({ type: 'connected', pad: pad.index, id: pad.id, standard });
    }
    const memory: PadMemory = samePad && before
      ? { ...cloneMemory(before), standard }
      : { id: pad.id, standard, buttons: blankButtons(), chorded: new Map(), modifierUsed: { LB: false, RT: false },
        triggerDownAt: { LT: 0, RT: 0 }, holdActive: { LT: false, RT: false }, suppressed: new Set(), rebaseline: options.rebaselineNewPads === true,
        sticks: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } },
        engagedPolls: { left: 0, right: 0 },
        repeat: { left: { direction: null, nextAt: 0, count: 0 }, right: { direction: null, nextAt: 0, count: 0 } } };
    next.pads.set(pad.index, memory);
    if (!standard) continue;
    const input: PadEvent[] = [];
    const wasOffCentre = { left: memory.sticks.left.x !== 0 || memory.sticks.left.y !== 0, right: memory.sticks.right.x !== 0 || memory.sticks.right.y !== 0 };

    const was = memory.buttons;
    const held = readButtons(pad, was);
    if (memory.rebaseline) {
      // First poll after a suspend: whatever is held now is the baseline — silent until let go.
      memory.rebaseline = false;
      for (const name of PAD_BUTTONS) if (held[name]) memory.suppressed.add(name);
    }
    // Suppressed buttons: no edges; their release only lifts the suppression.
    for (const name of [...memory.suppressed]) {
      if (!held[name]) memory.suppressed.delete(name);
    }
    const live = (name: PadButton): boolean => !memory.suppressed.has(name);
    const wasSuppressed = new Set((before && before.id === pad.id ? before.suppressed : new Set<PadButton>()));
    const endHold = (trigger: PadTrigger): void => {
      if (!memory.holdActive[trigger]) return;
      memory.holdActive[trigger] = false;
      input.push({ type: 'release', pad: pad.index, input: `${trigger}(hold)` });
    };
    /** A modifier that had another button pressed while down: RT loses its tap and a running hold ends. */
    const markUsed = (mod: PadModifier): void => {
      memory.modifierUsed[mod] = true;
      if (mod === 'RT') endHold('RT');
    };
    // Triggers first (their press starts the tap / hold window), then LB, so a button pressed on the same frame as a
    // modifier already chords.
    for (const trigger of PAD_TRIGGERS) {
      if (!live(trigger)) continue;
      if (held[trigger] && !was[trigger]) {
        memory.triggerDownAt[trigger] = now;
        memory.holdActive[trigger] = false;
        if (trigger === 'RT') memory.modifierUsed.RT = false;
        input.push({ type: 'press', pad: pad.index, input: trigger });
      }
    }
    const order: PadButton[] = ['LB', ...PAD_BUTTONS.filter((b) => b !== 'LB' && b !== 'LT' && b !== 'RT')];
    for (const name of order) {
      if (!live(name)) continue;
      if (held[name] && !was[name]) {
        const mod: PadModifier | null = PAD_MODIFIERS.find((m) => m !== name && held[m] && live(m)) ?? null;
        if (name === 'LB') memory.modifierUsed.LB = false;
        if (mod) {
          memory.chorded.set(name, mod);
          markUsed(mod);
          input.push({ type: 'press', pad: pad.index, input: `${mod}+${name}` });
        } else input.push({ type: 'press', pad: pad.index, input: name });
      } else if (!held[name] && was[name] && !wasSuppressed.has(name)) {
        const mod = memory.chorded.get(name);
        memory.chorded.delete(name);
        if (mod) input.push({ type: 'release', pad: pad.index, input: `${mod}+${name}` });
        else if (name === 'LB' && memory.modifierUsed.LB) input.push({ type: 'release', pad: pad.index, input: 'LB', wasModifier: true });
        else input.push({ type: 'release', pad: pad.index, input: name });
        if (name === 'LB') memory.modifierUsed.LB = false;
      }
    }
    for (const trigger of PAD_TRIGGERS) {
      if (!live(trigger) || wasSuppressed.has(trigger)) continue;
      const used = trigger === 'RT' && memory.modifierUsed.RT;
      if (!held[trigger] && was[trigger]) {
        // Astra review: a release first seen after the 300 ms boundary with the hold never begun (a poll gap) is
        // still a TAP — the press time is known and nothing else happened.
        if (memory.holdActive[trigger]) endHold(trigger);
        else if (!used) input.push({ type: 'press', pad: pad.index, input: `${trigger}(tap)` });
        input.push(used ? { type: 'release', pad: pad.index, input: trigger, wasModifier: true } : { type: 'release', pad: pad.index, input: trigger });
        if (trigger === 'RT') memory.modifierUsed.RT = false;
      } else if (held[trigger] && !used && !memory.holdActive[trigger] && now - memory.triggerDownAt[trigger] > TRIGGER_TAP_MS) {
        memory.holdActive[trigger] = true;
        input.push({ type: 'press', pad: pad.index, input: `${trigger}(hold)` });
      }
    }
    memory.buttons = held;

    const axes: Record<PadStick, StickValue> = {
      left: applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, clampDeadzone(options.deadzoneLeft)),
      right: applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, clampDeadzone(options.deadzoneRight)),
    };
    for (const stick of ['left', 'right'] as const) {
      const value = axes[stick];
      const old = memory.sticks[stick];
      const moving = value.x !== 0 || value.y !== 0;
      const raw = stick === 'left' ? Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) : Math.hypot(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const deadzone = clampDeadzone(stick === 'left' ? options.deadzoneLeft : options.deadzoneRight);
      memory.engagedPolls[stick] = raw > deadzone + ENGAGE_MARGIN ? memory.engagedPolls[stick] + 1 : 0;
      const engaged = memory.engagedPolls[stick] >= ENGAGE_POLLS;
      if (moving || old.x !== 0 || old.y !== 0) input.push({ type: 'stick', pad: pad.index, stick, x: value.x, y: value.y, engaged });
      memory.sticks[stick] = value;
      const direction = stickDirection(value);
      const repeat = memory.repeat[stick];
      if (!direction) memory.repeat[stick] = { direction: null, nextAt: 0, count: 0 };
      else if (direction !== repeat.direction) {
        input.push({ type: 'direction', pad: pad.index, stick, direction, repeat: false });
        memory.repeat[stick] = { direction, nextAt: now + DIRECTION_REPEAT_FIRST_MS, count: 1 };
      } else if (now >= repeat.nextAt) {
        input.push({ type: 'direction', pad: pad.index, stick, direction, repeat: true });
        memory.repeat[stick] = { direction, nextAt: now + DIRECTION_REPEAT_MS, count: repeat.count + 1 };
      }
    }
    const fresh = input.some((e) => e.type === 'press'
      || (e.type === 'stick' && (e.x !== 0 || e.y !== 0) && !wasOffCentre[e.stick]));
    perPad.push({ index: pad.index, input, fresh, memory, before });
  }
  for (const [index, memory] of prev.pads) {
    if (!seen.has(index)) events.push({ type: 'disconnected', pad: index, id: memory.id });
  }
  // Last used pad wins: the active pad keeps the floor while it has fresh input; otherwise the first pad with fresh
  // input takes it. A pad that loses the floor re-centres its sticks (the camera never keeps gliding on it).
  if (next.activePad !== null && !next.pads.has(next.activePad)) {
    // Astra review P1: the active pad left mid-pan — re-centre its off-centre sticks BEFORE dropping it, so the
    // camera never keeps gliding on a stick that will never report again.
    const gone = prev.pads.get(next.activePad);
    for (const stick of ['left', 'right'] as const) {
      const v = gone?.sticks[stick];
      if (v && (v.x !== 0 || v.y !== 0)) events.splice(events.findIndex((e) => e.type === 'disconnected' && e.pad === next.activePad), 0, { type: 'stick', pad: next.activePad, stick, x: 0, y: 0 });
    }
    next.activePad = null;
  }
  const current = perPad.find((p) => p.index === next.activePad);
  const taker = current?.fresh ? current : perPad.find((p) => p.fresh);
  if (taker && taker.index !== next.activePad) {
    // Astra review: the old pad's releases for everything it still holds (triggers ending holds, sticks re-centred)
    // go out BEFORE the taker's input; what it holds stays silent until let go.
    const old = perPad.find((p) => p.index === next.activePad);
    if (old) {
      // The old pad's own input this frame (incl. its releases) first, then the forced releases of what it still holds.
      events.push(...old.input.filter((e) => e.type === 'release' || (e.type === 'stick' && e.x === 0 && e.y === 0)));
      releaseAllHeld(old.memory, old.index, events);
    }
    next.activePad = taker.index;
  }
  const active = perPad.find((p) => p.index === next.activePad);
  if (active) events.push(...active.input);
  return { events, state: next };
}

// --- event bus ---------------------------------------------------------------------------------------------------

export type PadListener = (event: PadEvent) => void;

export interface PadBus {
  onAction(listener: PadListener): () => void;
  emit(event: PadEvent): void;
}

export function createPadBus(): PadBus {
  const listeners = new Set<PadListener>();
  return {
    onAction(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    emit(event) {
      for (const listener of [...listeners]) {
        try { listener(event); } catch (error) { console.warn('gamepad listener failed', error); }
      }
    },
  };
}

/** The app-wide bus the poller publishes on. */
export const gamepadBus = createPadBus();
export const onAction = (listener: PadListener): (() => void) => gamepadBus.onAction(listener);

// --- rAF loop -----------------------------------------------------------------------------------------------------

export type GamepadHostEvent = 'gamepadconnected' | 'gamepaddisconnected' | 'blur' | 'focus' | 'visibilitychange';
export interface GamepadPollerHost {
  getGamepads(): ArrayLike<GamepadLike | null | undefined>;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  now(): number;
  /** gamepad* / blur / focus on the window, visibilitychange on the document. */
  addEventListener(type: GamepadHostEvent, listener: () => void): void;
  removeEventListener(type: GamepadHostEvent, listener: () => void): void;
  /** The document is hidden (tab / window minimised). */
  hidden?(): boolean;
  /** The window has focus. */
  hasFocus?(): boolean;
}

export function browserGamepadHost(): GamepadPollerHost | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  const target = (type: GamepadHostEvent): Pick<Window, 'addEventListener' | 'removeEventListener'> =>
    (type === 'visibilitychange' && typeof document !== 'undefined' ? document : window);
  return {
    getGamepads: () => navigator.getGamepads() as unknown as ArrayLike<GamepadLike | null>,
    requestFrame: (cb) => window.requestAnimationFrame(cb),
    cancelFrame: (h) => window.cancelAnimationFrame(h),
    now: () => performance.now(),
    addEventListener: (type, listener) => target(type).addEventListener(type, listener),
    removeEventListener: (type, listener) => target(type).removeEventListener(type, listener),
    hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    hasFocus: () => typeof document === 'undefined' || typeof document.hasFocus !== 'function' || document.hasFocus(),
  };
}

/**
 * Polls while at least one pad is connected; idle (no rAF) otherwise. Returns a stop function.
 * Astra review: window blur / document hidden releases everything (suspendPads: cancelled releases, holds end, sticks
 * re-centre) and pauses polling; focus / visible resumes, and the first poll re-baselines (held buttons stay silent).
 */
export function createGamepadPoller(host: GamepadPollerHost, bus: PadBus = gamepadBus, options: () => ReadFrameOptions = () => ({})): () => void {
  let state = emptyFrameState();
  let frame: number | null = null;
  let stopped = false;
  /** Astra review: a poller created hidden / unfocused starts suspended. */
  const shouldSuspend = (): boolean => !!host.hidden?.() || host.hasFocus?.() === false;
  let suspended = shouldSuspend();
  /** The next poll re-baselines pads it sees for the first time (start-up, and after every suspend). */
  let rebaselineNext = true;
  const tick = (): void => {
    frame = null;
    if (stopped || suspended) return;
    let pads: ArrayLike<GamepadLike | null | undefined> = [];
    try { pads = host.getGamepads() ?? []; } catch { pads = []; }
    const result = readFrame(pads, state, host.now(), { ...options(), rebaselineNewPads: rebaselineNext });
    rebaselineNext = false;
    state = result.state;
    for (const event of result.events) bus.emit(event);
    if (state.pads.size > 0) frame = host.requestFrame(tick);
  };
  const wake = (): void => {
    if (stopped || frame !== null) return;
    if (suspended && !shouldSuspend()) { suspended = false; rebaselineNext = true; }
    if (!suspended) frame = host.requestFrame(tick);
  };
  const suspend = (): void => {
    if (suspended) return;
    suspended = true;
    if (frame !== null) host.cancelFrame(frame);
    frame = null;
    const result = suspendPads(state);
    state = result.state;
    for (const event of result.events) bus.emit(event);
  };
  const resume = (): void => {
    if (!suspended || host.hidden?.()) return;
    suspended = false;
    rebaselineNext = true;
    wake();
  };
  const onVisibility = (): void => { if (host.hidden?.()) suspend(); else resume(); };
  host.addEventListener('gamepadconnected', wake);
  // A disconnect still needs one poll to emit the event (and stop when it was the last pad).
  host.addEventListener('gamepaddisconnected', wake);
  host.addEventListener('blur', suspend);
  host.addEventListener('focus', resume);
  host.addEventListener('visibilitychange', onVisibility);
  wake(); // a pad that was connected before the app loaded shows up on the first poll
  return () => {
    stopped = true;
    if (frame !== null) host.cancelFrame(frame);
    frame = null;
    host.removeEventListener('gamepadconnected', wake);
    host.removeEventListener('gamepaddisconnected', wake);
    host.removeEventListener('blur', suspend);
    host.removeEventListener('focus', resume);
    host.removeEventListener('visibilitychange', onVisibility);
  };
}
