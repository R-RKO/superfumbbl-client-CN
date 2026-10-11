/**
 * Controller support is OPT-IN (owner 2026-10-10): Settings > Controls "Enable controller support", default off.
 *
 * This module owns everything that makes the client listen to a gamepad, so that "off" is one switch and not a set of
 * flags scattered over the app:
 *  - while STOPPED nothing reads a pad: no poller (no requestAnimationFrame loop, no gamepadconnected / blur / focus /
 *    visibilitychange listeners), no mouse / key "last device used" tracking, no pad event listener, no card pad
 *    interceptor, no rumble on sound cues. The active input is 'mouse', the cursor is shown, and the card focus layer
 *    (ring / badges / `padFocusOwnsInput`) is disabled. The client behaves as it did before controller support.
 *  - `start()` wires all of it; `stop()` unwinds all of it at once (a running camera pan / trigger hold / chord layer
 *    is neutralised, the pad list is emptied, the cursor comes back) with no restart.
 *
 * The opt-in itself (`createControllerOptIn`): ticking the box only ASKS — the notice below, one button. The setting
 * turns on when the coach acknowledges; closing the notice any other way leaves it off. Unticking turns it off at once.
 */
import { ref, type Ref } from 'vue';
import {
  CONTROL_PRIORITY_GAME, activeInput, connectedPadCount, connectedPads, heldModifiers, registerPadInterceptor, trackMouseKeyboardUse,
  type ActiveInput, type ControllerRouter, type InputMethod, type InputSwitcher,
} from './controls';
import { handlePadFocusEvent, setPadFocusEnabled } from './cardFocus';
import { browserGamepadHost, createGamepadPoller, gamepadBus, type GamepadPollerHost, type PadBus, type PadEvent, type ReadFrameOptions } from './gamepad';
import { cancelPendingHaptics } from './haptics';
import { onSoundCue } from './sounds';

/** The owner's wording, verbatim (2026-10-10). Shown every time the box goes from off to on. */
export const CONTROLLER_SUPPORT_NOTICE = "Controller Support is mostly untested. Support for these exist but have not been tested in each case. If you're using a controller and an issue occurs, please use your mouse to select whatever you need to.";
export const CONTROLLER_SUPPORT_NOTICE_TITLE = 'Controller Support';
export const CONTROLLER_SUPPORT_NOTICE_BUTTON = 'OK';

/** The input method in force: the coach's choice while controller support is on, the keyboard / mouse pin while off
 *  (so a stored `inputMethod: 'controller'` cannot put the client in controller mode behind an unticked box). */
export function effectiveInputMethod(settings: { controllerSupportEnabled: boolean; inputMethod: InputMethod }): InputMethod {
  return settings.controllerSupportEnabled ? settings.inputMethod : 'keyboard';
}

export interface ControllerRuntimeDeps {
  /** The pad source; null = this engine has no Gamepad API (the runtime then runs without a poller). */
  host?: () => GamepadPollerHost | null;
  /** Where mouse / key use is observed (the window). */
  inputTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  switcher: InputSwitcher;
  router: ControllerRouter;
  bus?: PadBus;
  pollerOptions?: () => ReadFrameOptions;
  /** Every pad event, before the router (the Settings stick readout). */
  onPadEvent?(event: PadEvent): void;
  /** A sound cue while running (rumble). */
  onSoundCue?(soundId: string): void;
  /** The active-input state forced back to 'mouse' on stop (defaults to the exported `activeInput`). */
  state?: { value: ActiveInput };
  /** After everything is torn down (hide the toast, show the cursor, reset the readout). */
  onStopped?(): void;
  /** Put the OS cursor back, unconditionally (best effort). Called when the window loses focus while running and on
   *  stop, so a hidden cursor can never outlive the pad's use of it (Astra 10-10). */
  restoreCursor?(): void;
}
export interface ControllerRuntime {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createControllerRuntime(deps: ControllerRuntimeDeps): ControllerRuntime {
  const bus = deps.bus ?? gamepadBus;
  const state = deps.state ?? activeInput;
  let teardown: Array<() => void> | null = null;
  return {
    get running() { return teardown !== null; },
    start() {
      if (teardown) return;
      const undo: Array<() => void> = [];
      teardown = undo;
      setPadFocusEnabled(true);
      undo.push(() => setPadFocusEnabled(false));
      if (deps.onSoundCue) undo.push(onSoundCue((id) => deps.onSoundCue?.(id)));
      undo.push(registerPadInterceptor(handlePadFocusEvent, CONTROL_PRIORITY_GAME));
      undo.push(trackMouseKeyboardUse(deps.inputTarget, deps.switcher, state));
      const onBlur = (): void => { try { deps.restoreCursor?.(); } catch { /* best effort */ } };
      deps.inputTarget.addEventListener('blur', onBlur);
      undo.push(() => deps.inputTarget.removeEventListener('blur', onBlur));
      undo.push(bus.onAction((event) => { deps.onPadEvent?.(event); deps.router(event); }));
      const host = (deps.host ?? browserGamepadHost)();
      if (host) undo.push(createGamepadPoller(host, bus, deps.pollerOptions));
      deps.switcher.sync(); // a pinned 'controller' method takes effect at once
    },
    stop() {
      const undo = teardown;
      if (!undo) return;
      teardown = null;
      // The poller first (no further events), then the listeners, then every piece of live state.
      for (const fn of undo.reverse()) { try { fn(); } catch { /* keep unwinding */ } }
      deps.router.neutralise(); // a pad pan / trigger hold / chord layer never outlives the box
      connectedPads.value = [];
      connectedPadCount.value = 0;
      heldModifiers.value = { LB: false, RT: false };
      state.value = 'mouse';
      deps.switcher.sync(); // the effective method is the mouse pin now: cursor shown
      cancelPendingHaptics(); // a queued follow-up rumble pulse never fires after the box is unticked
      try { deps.restoreCursor?.(); } catch { /* best effort */ }
      deps.onStopped?.();
    },
  };
}

// --- the opt-in box ------------------------------------------------------------------------------------------------

export interface ControllerOptIn {
  /** The "mostly untested" notice is up. */
  noticeOpen: Ref<boolean>;
  /** The Settings box changed: ticking asks first (the setting stays off), unticking turns it off at once. */
  boxChanged(checked: boolean): void;
  /** The coach pressed the notice's one button: controller support turns on. */
  acknowledge(): void;
  /** The notice was closed any other way (Escape, a click outside, Settings closing): it stays off. */
  dismiss(): void;
}
export function createControllerOptIn(settings: { controllerSupportEnabled: boolean }): ControllerOptIn {
  const noticeOpen = ref(false);
  return {
    noticeOpen,
    boxChanged(checked) {
      if (!checked) { noticeOpen.value = false; settings.controllerSupportEnabled = false; return; }
      if (!settings.controllerSupportEnabled) noticeOpen.value = true; // every off -> on asks
    },
    acknowledge() {
      if (!noticeOpen.value) return;
      noticeOpen.value = false;
      settings.controllerSupportEnabled = true;
    },
    dismiss() { noticeOpen.value = false; },
  };
}
