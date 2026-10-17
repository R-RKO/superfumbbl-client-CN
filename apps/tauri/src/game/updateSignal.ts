import { ref } from 'vue';
import { parseVersion } from './updateCheck';

/**
 * Owner 10-17: the newest version an update check found (a staged app patch or a newer installer), kept apart from the
 * prompt so it is known even while the prompt is withheld (mid-game, mid-join). After a bug report is sent the coach is
 * told, by a toast, that a newer build exists and may already fix what they reported: the report is still wanted, so
 * nothing about this runs BEFORE the send and nothing here opens the prompt or starts a download.
 */
export const updateAvailableVersion = ref<string | null>(null);

/** a > b as X.Y.Z (false when either does not parse) */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = parseVersion(a), pb = parseVersion(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) { if (pa[i]! !== pb[i]!) return pa[i]! > pb[i]!; }
  return false;
}
/** The newer of a recorded version and a found one (a second check surface never lowers the record). */
export function newerVersion(current: string | null, found: string): string {
  return current && !isNewerVersion(found, current) ? current : found;
}
let checker: (() => Promise<void>) | null = null;
/** App.vue installs its update check (launch / hourly / menu-return are its own triggers; this one is on demand). */
export function setUpdateChecker(fn: (() => Promise<void>) | null): void { checker = fn; }

/** Run a check now (never throws) and return the toast text when a newer build than `appVersion` is known. */
export async function updateHintAfterReport(appVersion: string): Promise<string | null> {
  try { await checker?.(); } catch { /* the check logs its own failures */ }
  const version = updateAvailableVersion.value;
  if (!version || !isNewerVersion(version, appVersion)) return null;
  return `Thanks for the report. Super FUMBBL ${version} is available (you are on ${appVersion}) and may already fix this: update from the menu when your game is over.`;
}
