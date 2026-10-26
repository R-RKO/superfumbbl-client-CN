// Owner 10-15: the match-start beta notice. Copy and version live here so the owner can reword or retire it: bump
// BETA_NOTICE_VERSION with new copy (it is part of the once-per-game key); set BETA_NOTICE_ENABLED false to retire it.

export const BETA_NOTICE_VERSION = 1;
export const BETA_NOTICE_ENABLED = false; // owner 10-26: "Go ahead and remove this splash" (retired, not deleted: re-enable with new copy + a version bump)
export const BETA_NOTICE_TITLE = 'Beta notice';
export const BETA_NOTICE_TEXT = 'Movement flows have been adjusted, please report any oddities immediately.';
export const BETA_NOTICE_BUTTON = 'Acknowledge';

/** Games (by id, per notice version) whose notice the coach acknowledged this session. Session-only on purpose: the
 *  notice is once per game JOINED, not once per install. */
const acknowledged = new Set<string>();
const key = (gameId: string) => `${BETA_NOTICE_VERSION}:${gameId}`;

/** The notice is due for a SEATED coach (never a spectator or a replay) once the game state has loaded, once per game
 *  joined (a mid-game join gets it on join). Pure: sends nothing, holds no server frame. */
export function betaNoticeDue(input: { seatedCoach: boolean; replay: boolean; gameId: string | number | null | undefined }): boolean {
  if (!BETA_NOTICE_ENABLED || !input.seatedCoach || input.replay) return false;
  const id = input.gameId == null ? '' : String(input.gameId);
  return id !== '' && !acknowledged.has(key(id));
}

export function acknowledgeBetaNotice(gameId: string | number | null | undefined): void {
  if (gameId == null || String(gameId) === '') return;
  acknowledged.add(key(String(gameId)));
}

/** @internal tests only */
export function resetBetaNoticeForTests(): void { acknowledged.clear(); }
