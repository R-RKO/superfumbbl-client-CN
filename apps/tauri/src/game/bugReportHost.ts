/**
 * Owner 2026-10-13: "The Bug report button should be visible on the FUMBBL.Com / Play / Spectate / Replay blade menus as
 * well." The Report dialog (components/BugReportModal.vue) is shared by two hosts: the in-game view (SpectateView) and
 * the console shell's blade ribbon (App.vue). This is what differs between them; everything else (the screenshot-first
 * flow, the payload builder, the transport, the copy) lives once in the component.
 */
import { gameServiceFromTarget, wireLogBasename, type BugReportDevLogEntry, type BugReportGameService, type BugReportLogEntry } from './bugReport';
import { ref } from 'vue';
import { WIRE_LOG_INSTANCE_TAG } from './wireLogName';
import type { PitchFrame } from './bugReportScreenshot';

export interface BugReportPitch {
  /** The mounted renderer's frame capture (PitchRenderer.captureFrame). */
  capture: () => PitchFrame | null;
  /** The pitch's live canvas, punched out of the DOM snapshot. */
  element: Element | null;
}

export interface BugReportHost {
  /** Read once, when Report is pressed: the live pitch, or null (the shell has no pitch). */
  pitch: () => BugReportPitch | null;
  /** The game the report is about, or null (no game: the shell). */
  gameId: () => number | string | null;
  gameService: () => BugReportGameService;
  /** Path (or bare name) of the wire log to attach; '' = none. Only its basename crosses to the Tauri reader. */
  wireLogPath: () => string;
  /** The attachments-list line when there is no wire log. */
  noWireLogLine: string;
  /** The attachments-list line for the wire log (default `Wire log: <name>`). */
  wireLogLine?: (fileName: string) => string;
  logEntries: () => readonly BugReportLogEntry[];
  devLogEntries: () => readonly BugReportDevLogEntry[];
  /** The payload's `context` object, read when Send is pressed. */
  context: () => Record<string, unknown>;
  /** The named wire log could not be read when Send was pressed (the report went without it). */
  onWireLogUnreadable?: () => void;
}

// ---- the most recent wire log, for a report filed from the shell ------------------------------------------------
// The store clears `state.wireLogFile` when a game is left, so the shell (shown only with no game loaded) would never
// see one. App.vue watches the store's path and remembers the last non-empty one here, in memory and in localStorage so
// it survives a restart. The Tauri reader (read_bug_report_log) takes the basename and refuses anything else, so a
// remembered name can only ever read a log the app itself wrote. A file that has since gone is sent without (the read
// degrades to null) and forgotten, so the next report says "No game log".

const LAST_WIRE_LOG_KEY = 'sf.lastWireLogFile';
/** A ref, so the dialog's attachments list follows it. null = not read from storage yet. */
const lastWireLog = ref<string | null>(null);

// Owner 10-22 (second client window): two windows share localStorage, so the per-WINDOW copy lives in sessionStorage.
// localStorage is only the restart fallback, read when this window has none AND the second-client setting is off; with
// the setting on, a window offers only a log carrying its own instance tag (wireLogName.ts), never the other window's.

/** Whether the second-client setting is effectively on. settings.ts registers it at load (this module stays free of
 *  the settings import); unregistered = off, the single-window behaviour. */
// `var`, not `let`: settings.ts registers during an import cycle (bugReport -> settings), before this module body has
// run; a `let` would still be in its temporal dead zone there. Unset = off.
// eslint-disable-next-line no-var
var secondClientProbe: (() => boolean) | undefined;
function secondClientEnabled(): boolean { return secondClientProbe?.() === true; }
export function setWireLogSecondClientProbe(probe: () => boolean): void { secondClientProbe = probe; }

/** True when this window may attach `path`: always with the setting off; with it on, only its own tagged file. */
export function isOwnWindowWireLog(path: string): boolean {
  if (!secondClientEnabled()) return true;
  return wireLogBasename(path).endsWith(`-${WIRE_LOG_INSTANCE_TAG}.jsonl`);
}

export function rememberWireLogFile(path: string): void {
  const value = (path || '').trim();
  if (!value) return;
  lastWireLog.value = value;
  try { globalThis.sessionStorage?.setItem(LAST_WIRE_LOG_KEY, value); } catch { /* storage blocked: memory only */ }
  try { globalThis.localStorage?.setItem(LAST_WIRE_LOG_KEY, value); } catch { /* storage blocked: memory only */ }
}

export function lastWireLogFile(): string {
  if (lastWireLog.value === null) {
    let value = '';
    try { value = globalThis.sessionStorage?.getItem(LAST_WIRE_LOG_KEY) ?? ''; } catch { value = ''; }
    if (!value && !secondClientEnabled()) {
      try { value = globalThis.localStorage?.getItem(LAST_WIRE_LOG_KEY) ?? ''; } catch { value = ''; }
    }
    lastWireLog.value = value;
  }
  return lastWireLog.value && isOwnWindowWireLog(lastWireLog.value) ? lastWireLog.value : '';
}

function clearStoredWireLog(): void {
  try { globalThis.sessionStorage?.removeItem(LAST_WIRE_LOG_KEY); } catch { /* ignore */ }
  try { globalThis.localStorage?.removeItem(LAST_WIRE_LOG_KEY); } catch { /* ignore */ }
}

/** The remembered log could not be read (deleted, or never there): stop offering it. */
export function forgetWireLogFile(): void {
  lastWireLog.value = '';
  clearStoredWireLog();
}

/** Test seam. */
export function resetLastWireLogFile(): void {
  lastWireLog.value = null;
  clearStoredWireLog();
}

/** The blade names the coach sees on the ribbon, for the attachments list (context.blade carries the raw view id). */
const BLADE_LABELS: Record<string, string> = {
  home: 'FUMBBL.COM', play: 'Play', spectate: 'Spectate', replay: 'Replay', team: 'Team', console: 'Protocol console',
};
export function bladeLabel(view: string): string {
  return BLADE_LABELS[view] ?? view;
}

/** What the shell's host reads (App.vue passes the live `settings` and `gameStore.state`). */
export interface ShellReportDeps {
  /** The current console view (App.vue `view`): rides as context.blade. */
  blade: () => string;
  settings: { activeServerTarget: string; coach40k: string; coach: string };
  state: { log: readonly BugReportLogEntry[]; devLog: readonly BugReportDevLogEntry[]; sessionState: unknown };
}

/**
 * Owner 2026-10-13: the Report host for the console shell's blade ribbon. No game is loaded there, so: no pitch (the
 * window screenshot is the DOM alone), gameId null, the MOST RECENT wire log if one is remembered (else "No game log"),
 * and context.blade = which blade the coach reported from. The service is the active server target, as in a game.
 */
export function createShellReportHost(deps: ShellReportDeps): BugReportHost {
  return {
    pitch: () => null,
    gameId: () => null,
    gameService: () => gameServiceFromTarget(deps.settings.activeServerTarget),
    wireLogPath: () => lastWireLogFile(),
    wireLogLine: (fileName) => `Wire log: ${fileName} (your most recent game)`,
    noWireLogLine: 'No game log',
    onWireLogUnreadable: forgetWireLogFile,
    logEntries: () => deps.state.log,
    devLogEntries: () => deps.state.devLog,
    context: () => ({
      blade: deps.blade(),
      coach40k: deps.settings.coach40k || null,
      fumbblCoach: deps.settings.coach || null,
      wireLogFile: wireLogBasename(lastWireLogFile()) || null,
      serverTarget: deps.settings.activeServerTarget,
      sessionState: deps.state.sessionState,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  };
}
