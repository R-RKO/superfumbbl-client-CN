// Playback watchdog for the first-open intro video (owner 10-14). WebKitGTK without the GStreamer H.264 plugins can
// show a black frame that neither plays nor errors. The watchdog fails OPEN (onTimeout) on true inactivity only:
//  - before playback: IDLE_MS with no load/decode activity (progress / loadeddata / canplay / ...), total wait capped at MAX_MS;
//  - during playback: IDLE_MS with no ADVANCE of currentTime (a frozen frame), however many events still fire.
// While the autoplay-gesture (play) button shows it is fully suspended; resuming re-arms from scratch.
export const INTRO_IDLE_MS = 4000;
export const INTRO_MAX_MS = 15000;

export interface IntroWatchdog {
  start(): void;
  /** Load/decode activity event: re-arms the idle deadline until playback has advanced. */
  activity(): void;
  /** Sample currentTime (timeupdate): an advance re-arms the idle deadline and lifts the total cap. */
  sample(currentTime: number): void;
  /** true = gesture button showing (suspend); false = resumed (re-arm from scratch). */
  setGesture(showing: boolean): void;
  stop(): void;
}

export function createIntroWatchdog(onTimeout: () => void, idleMs = INTRO_IDLE_MS, maxMs = INTRO_MAX_MS): IntroWatchdog {
  let idle: ReturnType<typeof setTimeout> | null = null;
  let cap: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let gesture = false;
  let lastTime = 0;
  let advanced = false;
  const clear = (): void => {
    if (idle) { clearTimeout(idle); idle = null; }
    if (cap) { clearTimeout(cap); cap = null; }
  };
  const fire = (): void => {
    if (!running || gesture) return;
    clear();
    running = false;
    onTimeout();
  };
  const armIdle = (): void => {
    if (!running || gesture) return;
    if (idle) clearTimeout(idle);
    idle = setTimeout(fire, idleMs);
  };
  const begin = (): void => {
    clear();
    lastTime = 0;
    advanced = false;
    armIdle();
    cap = setTimeout(fire, maxMs);
  };
  return {
    start() { running = true; gesture = false; begin(); },
    activity() { if (running && !advanced) armIdle(); },
    sample(currentTime) {
      if (!running || gesture) return;
      if (currentTime > lastTime + 0.001) {
        lastTime = currentTime;
        advanced = true;
        if (cap) { clearTimeout(cap); cap = null; }
        armIdle();
      }
    },
    setGesture(showing) {
      if (!running) return;
      gesture = showing;
      if (showing) clear(); else begin();
    },
    stop() { running = false; clear(); },
  };
}
