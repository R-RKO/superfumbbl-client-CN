// Owner 10-26: "Can we have a version check added to the client? If Version is < CurrentVersion then the client should
// refuse join and force an update at handshake." An OUTDATED public client takes no coach seat until it updates.
//
// Rules (Yularen spec 10-26):
//  - CurrentVersion = the newest version the regular update check (App.vue runUpdateCheck: the app-patch channel, then
//    the installer updater / latest release) last saw. No second manifest fetch: this module only reads its record.
//  - The gate rides the server-version join gate (gameSessionFactory.serverVersionJoinGate): it is consulted after the
//    server announced its version and BEFORE any CLIENT_JOIN leaves. It is synchronous - it never waits on the network.
//  - Public edition, older: REFUSE (no join, socket closed, "update required" modal).
//    Fork edition or a dev-lettered build (1.0.293b): WARN with the same modal and "Continue anyway"; the join is not held.
//  - Spectate / replay: never refused; a non-blocking "update available" notice.
//  - Fail open (owner law: latches fail open): no completed check yet -> the join goes and a one-line notice says the
//    version could not be checked; a later check (already scheduled by App.vue) gates the next join.
//  - A game this client already took a seat in is never refused on reconnect (a patch published mid-match must not
//    lock the coach out of their own game on a network drop). A seat is recorded only from the server's acceptance
//    (SERVER_JOIN for this coach as a player, gameSessionFactory), keyed by server + coach + game - never from a verdict.
import { ref } from 'vue';
import type { ClientMode } from '@fumbbl40k/ffb-protocol';
import { t } from '../i18n';
import { showCornerNotice } from './cornerNotice';
import { FORK_EDITION } from './edition';
import { isDevCut } from './updateCheck';
import { isNewerVersion, publishedVersion, type PublishedVersionRecord } from './updateSignal';

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/** "1.0.293b" / "1.0.293o66kj" / "v1.0.293" -> "1.0.293"; anything without a leading X.Y.Z -> null. */
export function bareAppVersion(appVersion: string): string | null {
  const m = /^v?(\d+\.\d+\.\d+)/.exec(appVersion.trim());
  return m ? m[1]! : null;
}

export type ClientVersionVerdict =
  | { kind: 'allow' }
  /** The newest published version is not known yet: the join goes (fail open) with a notice. */
  | { kind: 'unknown' }
  | { kind: 'refuse' | 'warn' | 'readOnlyNotice'; current: string; latest: string };

/** The pure decision. `exempt` = fork edition or a dev-lettered build (warn, never refuse). */
export function decideClientVersion(input: {
  appVersion: string;
  published: PublishedVersionRecord | null;
  mode: ClientMode;
  forkEdition: boolean;
}): ClientVersionVerdict {
  const current = bareAppVersion(input.appVersion);
  if (!current) return { kind: 'allow' }; // an unstamped build ('dev', the web preview) is not on the release line
  if (!input.published) return input.mode === 'player' ? { kind: 'unknown' } : { kind: 'allow' };
  const latest = input.published.version;
  if (!latest || !isNewerVersion(latest, current)) return { kind: 'allow' };
  if (input.mode !== 'player') return { kind: 'readOnlyNotice', current, latest };
  const exempt = input.forkEdition || isDevCut(input.appVersion);
  return { kind: exempt ? 'warn' : 'refuse', current, latest };
}

export interface ClientVersionBlock {
  /** refuse = public edition (the join did not leave); warn = fork / dev cut (the join went; Continue anyway). */
  kind: 'refuse' | 'warn';
  /** The running build's bare version. */
  current: string;
  /** The newest published version. */
  latest: string;
  gameId: number | null;
}

/** The live block (App.vue's modal reads it); null = none. */
export const clientVersionBlock = ref<ClientVersionBlock | null>(null);

/** Seats the server accepted this run (`server|coach|game`): a reconnect to one is never refused. */
const seatedGames = new Set<string>();
/** A game is named by its id or (a join by name) its EXACT transmitted name (Sol r4: no case / space folding - a
 *  variant may be another game); the two never collide (`id:` / `name:`). */
const seatKey = (serverUrl: string, coach: string, game: number | string) =>
  `${serverUrl}|${coach.toLowerCase()}|${typeof game === 'number' ? `id:${game}` : `name:${game}`}`;
/** The server accepted this coach's seat in this game (SERVER_JOIN; the served id from the first game state). */
export function noteSeatTaken(serverUrl: string, coach: string, game: number | string): void {
  if (typeof game === 'number' ? game > 0 : game !== '') seatedGames.add(seatKey(serverUrl, coach, game));
}
function seatAccepted(join: { gameId: number | null; gameName?: string | null; coach?: string | null; serverUrl?: string | null }): boolean {
  if (!join.coach || !join.serverUrl) return false;
  return (!!join.gameId && seatedGames.has(seatKey(join.serverUrl, join.coach, join.gameId)))
    || (!!join.gameName && seatedGames.has(seatKey(join.serverUrl, join.coach, join.gameName)));
}

let envOverride: { appVersion?: string; forkEdition?: boolean } | null = null;
/** @internal test seam: stand in for __APP_VERSION__ / FORK_EDITION (null = restore). */
export function overrideClientVersionEnvForTest(env: { appVersion?: string; forkEdition?: boolean } | null): void { envOverride = env; }
/** The published version a fork / dev warning was already shown for this run (asked once, not on every join). */
let warnedFor: string | null = null;
/** @internal test seam */
export function resetClientVersionGateForTest(): void { seatedGames.clear(); clientVersionBlock.value = null; envOverride = null; warnedFor = null; }

/** The refusal reason for a join, or null when it may go out. Called by the session's join gate (synchronous). */
export function clientVersionJoinGate(
  join: { mode: ClientMode; gameId: number | null; gameName?: string | null; coach?: string | null; serverUrl?: string | null },
  deps: { appVersion?: string; forkEdition?: boolean; published?: PublishedVersionRecord | null } = {},
): string | null {
  const verdict = decideClientVersion({
    appVersion: deps.appVersion ?? envOverride?.appVersion ?? APP_VERSION,
    published: deps.published !== undefined ? deps.published : publishedVersion.value,
    mode: join.mode,
    forkEdition: deps.forkEdition ?? envOverride?.forkEdition ?? FORK_EDITION,
  });
  if (verdict.kind === 'refuse' && seatAccepted(join)) {
    console.info(`[client-version] ${verdict.current} < ${verdict.latest}: reconnect to game ${join.gameId ?? join.gameName} allowed (seated before)`);
    clientVersionBlock.value = null; // Sol r5: an older refusal (another game) never stays over this live connection
    return null;
  }
  switch (verdict.kind) {
    case 'refuse':
      clientVersionBlock.value = { kind: 'refuse', current: verdict.current, latest: verdict.latest, gameId: join.gameId };
      console.warn(`[client-version] join refused: Super FUMBBL ${verdict.current} < published ${verdict.latest}`);
      return t('clientVersion.refusal', { current: verdict.current, latest: verdict.latest });
    case 'warn':
      console.warn(`[client-version] fork / dev build ${verdict.current} < published ${verdict.latest}: warned, join continues`);
      if (warnedFor !== verdict.latest) { // Sol r2: asked once per published version, never again on every join funnel
        warnedFor = verdict.latest;
        clientVersionBlock.value = { kind: 'warn', current: verdict.current, latest: verdict.latest, gameId: join.gameId };
      }
      return null;
    case 'readOnlyNotice':
      clientVersionBlock.value = null; // a later allowed launch supersedes an old block (as the server-version gate does)
      showCornerNotice('report', t('clientVersion.updateAvailable', { current: verdict.current, latest: verdict.latest }), 8000);
      return null;
    case 'unknown':
      clientVersionBlock.value = null;
      console.warn('[client-version] the latest Super FUMBBL version could not be checked; joining anyway');
      showCornerNotice('report', t('clientVersion.couldNotCheck'), 5000);
      return null;
    default:
      clientVersionBlock.value = null;
      return null;
  }
}

/** A replay launch (its handshake is not gated): the same non-blocking notice when an update is known. */
export function noteClientVersionForReplay(): void {
  clientVersionJoinGate({ mode: 'replay', gameId: null });
}

/** The block no longer applies (a later check found this build current): clear it. */
export function clientVersionBlockStillApplies(block: ClientVersionBlock, published: PublishedVersionRecord | null, appVersion: string = envOverride?.appVersion ?? APP_VERSION): boolean {
  const current = bareAppVersion(appVersion);
  if (!current || !published) return true; // nothing newer learned: keep it
  return !!published.version && isNewerVersion(published.version, current) && block.current === current;
}
