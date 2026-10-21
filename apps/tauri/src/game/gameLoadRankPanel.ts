import { ref, shallowRef, watch, type Ref } from 'vue';
import { fetchFumbblCoachProfile, type CoachProfileFetch, type FumbblCoachProfile } from './fumbblCoachProfile';
import { FUMBBL_WS_URL } from './settings';

/**
 * Game-load rank panel (owner 10-20: "a small panel like this appear at game load showing both your local rank panel
 * and the opposing coach's"). Modern view only (SpectateView.vue mounts it; Classic untouched).
 *
 * - Once per game load: when a game is on the board (the renderer has mounted) and the store is NOT fast-forwarding
 *   (catch-up skips every splash - store.ts "fast-forward: skip the splash"), the panel shows both coaches; a load
 *   that starts in catch-up shows it once the catch-up ends. The key is
 *   the mode + gameId and is remembered for the session, so a reconnect to the same game, a replay seek, or a
 *   catch-up pass never re-shows it. Event splashes do not re-fire for past events on a reconnect either.
 * - Sides: home left / away right; on a coach seat the LOCAL coach is on the left and the opponent on the right.
 * - Only for a game from the official FUMBBL server (lookupAllowed: the live/spectate connect URL or the server-replay
 *   URL is FUMBBL's game server; file replays, demo and fork/test servers get name + team only, zero requests).
 * - Data: fetchFumbblCoachProfile for both coach names (the same module and session cache as the Play screen coach
 *   card, so the local coach's data is reused): at most 6 fumbbl.com requests per game load, 3 when one coach is
 *   already cached, 0 when both are; no per-game or per-team pulls, no polling. Fail-soft per coach: name + team only.
 * - Never a latch: nothing waits on it. The panel is pointer-events: none; a click or key press anywhere dismisses it
 *   (the event still reaches the board), else it clears after `durationMs()` (presentationMs(6000) in the view).
 */

export interface RankPanelTeam { coach: string; team: string }
export interface RankPanelSide extends RankPanelTeam { side: 'home' | 'away'; profile: FumbblCoachProfile | null }
export interface RankPanelState { key: string; seq: number; left: RankPanelSide; right: RankPanelSide }

export interface GameLoadRankPanelDeps {
  /** e.g. `live:1954978`; null while no game is loaded */
  gameKey: () => string | null;
  teams: () => { home: RankPanelTeam; away: RankPanelTeam } | null;
  mySeat: () => 'home' | 'away' | null;
  boardReady: () => boolean;
  catchingUp: () => boolean;
  /** a reactive counter that changes on every catch-up start / end and replay seek (store.catchUpSignal) */
  catchUpSignal: () => number;
  fetchFn: () => CoachProfileFetch;
  /** true only when this game verifiably comes from the official FUMBBL server (see officialFumbblGameServer) */
  lookupAllowed: () => boolean;
  durationMs: () => number;
  /** session memory of shown game keys (defaults to the module-level set) */
  shown?: Set<string>;
  /** where click / key dismissal is listened for (defaults to window) */
  target?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null;
}

const sessionShown = new Set<string>();
/** Test seam: forget which games showed the panel this session. */
export function resetGameLoadRankPanelSession(): void { sessionShown.clear(); }

export function gameLoadRankPanelKey(mode: 'live' | 'spectate' | 'replay', gameId: unknown): string | null {
  const id = typeof gameId === 'number' || typeof gameId === 'string' ? String(gameId).trim() : '';
  return id && id !== '0' ? `${mode}:${id}` : null;
}

/** The store half of the deps, shared by SpectateView and its tests (the store is passed in, not imported). */
export interface RankPanelStore {
  game: { value: unknown };
  replay: { active: boolean };
  isPlaying: { value: boolean };
  mySeat: { value: 'home' | 'away' | null };
  isPlaybackCatchingUp: () => boolean;
  catchUpSignal: { value: number };
  /** the game server this game came from (live / spectate connect URL, server-replay URL); null for file replays / demo */
  gameServerUrl: () => string | null;
}

/** The official FUMBBL game server - the host of FUMBBL_WS_URL, the URL the 'fumbbl' server target connects to. */
export function officialFumbblGameServer(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.toLowerCase() === new URL(FUMBBL_WS_URL).hostname.toLowerCase();
  } catch {
    return false;
  }
}
export function storeRankPanelDeps(store: RankPanelStore): Pick<GameLoadRankPanelDeps, 'gameKey' | 'teams' | 'mySeat' | 'catchingUp' | 'catchUpSignal' | 'lookupAllowed'> {
  type Team = { coach?: unknown; teamName?: unknown } | undefined;
  const text = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    gameKey: () => gameLoadRankPanelKey(store.replay.active ? 'replay' : store.isPlaying.value ? 'live' : 'spectate',
      (store.game.value as { gameId?: unknown } | null)?.gameId),
    teams: () => {
      const g = store.game.value as { teamHome?: Team; teamAway?: Team } | null;
      if (!g?.teamHome || !g.teamAway) return null;
      return {
        home: { coach: text(g.teamHome.coach), team: text(g.teamHome.teamName) },
        away: { coach: text(g.teamAway.coach), team: text(g.teamAway.teamName) },
      };
    },
    mySeat: () => store.mySeat.value,
    catchingUp: () => store.isPlaybackCatchingUp(),
    catchUpSignal: () => store.catchUpSignal.value,
    lookupAllowed: () => officialFumbblGameServer(store.gameServerUrl()),
  };
}

export function useGameLoadRankPanel(deps: GameLoadRankPanelDeps): {
  panel: Ref<RankPanelState | null>;
  dismiss: () => void;
  stop: () => void;
} {
  const shown = deps.shown ?? sessionShown;
  const target = deps.target === undefined ? (typeof window !== 'undefined' ? window : null) : deps.target;
  const panel = shallowRef<RankPanelState | null>(null);
  const seq = ref(0);
  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  let lastKey: string | null | undefined;
  let lastSignal = deps.catchUpSignal();

  const onInput = (): void => dismiss();
  function listen(on: boolean): void {
    if (!target) return;
    for (const type of ['pointerdown', 'keydown'] as const) {
      if (on) target.addEventListener(type, onInput, { capture: true, passive: true } as AddEventListenerOptions);
      else target.removeEventListener(type, onInput, { capture: true } as EventListenerOptions);
    }
  }
  function dismiss(): void {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (panel.value) listen(false);
    panel.value = null;
  }

  function side(which: 'home' | 'away', team: RankPanelTeam): RankPanelSide {
    return { side: which, coach: team.coach.trim(), team: team.team.trim(), profile: null };
  }

  function update(): void {
    const key = deps.gameKey();
    // Astra r3 (P2): a panel belongs to ONE game. Any key change - a reset (null), a switch to another game (seen
    // before or not) - takes the old panel down BEFORE the early returns below.
    if (key !== lastKey) {
      lastKey = key;
      dismiss();
    }
    // A catch-up of the SAME game (a reconnect's fast-forward, a replay seek) takes a showing panel down too (Astra r4).
    // Watched through the store's reactive signal, not the flag: a synchronous seek restores the flag before this runs.
    const signal = deps.catchUpSignal();
    if (signal !== lastSignal) {
      lastSignal = signal;
      if (panel.value) dismiss();
    }
    if (panel.value && deps.catchingUp()) dismiss();
    if (!key || shown.has(key) || !deps.boardReady()) return;
    // Waiting out a catch-up: its end bumps catchUpSignal, which re-runs this (no timer, no polling).
    if (deps.catchingUp()) return;
    const teams = deps.teams();
    if (!teams || (!teams.home.coach.trim() && !teams.away.coach.trim())) return;
    shown.add(key);
    dismiss();
    const awayLeft = deps.mySeat() === 'away';
    const left = side(awayLeft ? 'away' : 'home', awayLeft ? teams.away : teams.home);
    const right = side(awayLeft ? 'home' : 'away', awayLeft ? teams.home : teams.away);
    const mySeq = ++seq.value;
    panel.value = { key, seq: mySeq, left, right };
    listen(true);
    timer = setTimeout(dismiss, Math.max(0, deps.durationMs()));
    // Astra r3 (P2): a FUMBBL lookup only for a game verified to come from the official FUMBBL server (a fork / test
    // server's coach names are not FUMBBL accounts - a namesake's rank must never show). Otherwise name + team only.
    if (!deps.lookupAllowed()) return;
    const fetchFn = deps.fetchFn();
    for (const which of ['left', 'right'] as const) {
      const name = panel.value[which].coach;
      if (!name) continue;
      void fetchFumbblCoachProfile(name, fetchFn).then((profile) => {
        const current = panel.value;
        if (!current || current.seq !== mySeq) return;
        panel.value = { ...current, [which]: { ...current[which], profile } };
      });
    }
  }

  const stopWatch = watch(
    () => [deps.gameKey(), deps.boardReady(), deps.catchUpSignal(), deps.teams()?.home.coach, deps.teams()?.away.coach],
    update,
    { immediate: true },
  );
  return { panel, dismiss, stop: () => { stopWatch(); dismiss(); } };
}
