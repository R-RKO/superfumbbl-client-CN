/**
 * Owner 10-22: WHENEVER A GAME LOADS, the FUMBBL.com pane goes back to the fumbbl.com home page.
 *
 * A Gamefinder page left running in the shell's Home webview (src-tauri/src/fumbbl_home.rs) after a direct-challenge
 * join kept beeping on new offers/draws although the coach was no longer in the queue. sendHomePark only ran when the
 * floating window was dismissed. This loads FUMBBL_HOME_URL (fumbbl_home_navigate: one ordinary page load, login kept,
 * NOT fumbbl_home_park's blank page) ONCE per loaded game. It never shows or hides the pane - visibility stays the
 * surface driver's (game/fumbblHome.ts homeSurface), whose serialised loop runs the load - and it never throws.
 *
 * Called only once the game MODEL has arrived (App.vue's gameId watch), never at join start: a Gamefinder join's JNLP
 * has already been downloaded, read and handed to the native queue by then (fumbbl_home.rs complete_jnlp), and the
 * game socket is the client's own - nothing of the join still depends on the page.
 */
export interface HomeOnGameLoadDeps {
  /** The page to load (game/fumbblHome.ts FUMBBL_HOME_URL). */
  url: string;
  /** Queue the page load in the surface driver's serialised loop (homeSurface.navigateHome): it re-checks there, at
   *  run time, that no park was asked for first (Astra 10-22). */
  navigate: (url: string) => void;
  /** Running inside the desktop shell (defaults to the window check every fumbblHome helper uses). */
  inTauri?: () => boolean;
  /** Session memory of games already handled (defaults to the module-level one). */
  seen?: Set<unknown>;
}

function defaultInTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

const sessionSeen = new Set<unknown>();
/** Test seam. */
export function resetHomeOnGameLoadSession(): void { sessionSeen.clear(); }

/** The key a loaded game is remembered by: its gameId (a number or numeric string, never 0 / empty); null = no game. */
export function homeOnGameLoadKey(gameId: unknown): string | null {
  const id = typeof gameId === 'number' || typeof gameId === 'string' ? String(gameId).trim() : '';
  return id && id !== '0' ? id : null;
}

/**
 * Ask for the Home webview to load the fumbbl.com home page for `gameId`, once per game per session: a reconnect or
 * reload of the same game does nothing; a new gameId asks again. Resolves true when the load was queued. Never throws
 * (the driver swallows a rejected navigate: no webview yet, a stopped webview, an older shell).
 */
export async function navigateHomeOnGameLoad(gameId: unknown, deps: HomeOnGameLoadDeps): Promise<boolean> {
  try {
    if (!(deps.inTauri ?? defaultInTauri)()) return false;
    const key = homeOnGameLoadKey(gameId);
    if (key === null) return false;
    const seen = deps.seen ?? sessionSeen;
    if (seen.has(key)) return false;
    seen.add(key); // once per game, whatever the outcome: a failure is not retried on every model update
    deps.navigate(deps.url);
    return true;
  } catch {
    return false;
  }
}
