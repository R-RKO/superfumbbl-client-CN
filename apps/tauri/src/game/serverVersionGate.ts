// Owner 10-17: "If FFB-server's version has changed since our last approved version, we should put a hard-stop in the
// client so that users cannot play until a fix is deployed." Background: upstream christerk/ffb PR #325 changed the
// apothecary choice command's shape; a client on the old shape would wedge silently on the new server (the command
// fails to deserialise and is dropped). The server announces its version on every connect (serverVersion), before any
// join leaves, so the gate sits there.
//
// Rules (owner 10-17): playing (a coach seat) is refused on a server version not on the approved list; spectating and
// replays are allowed (read-only); the dev / fork edition is never blocked; the coach is directed to the main FUMBBL
// client. Approving a new server version is a client patch: vet the upstream release, add its version here, ship.
import { ref } from 'vue';
import type { ClientMode, ServerCommandVersion } from '@fumbbl40k/ffb-protocol';

/** FFB server versions this client has been vetted against. A list, so a server rollback stays approved.
 *  3.3.1 = the live fumbbl.com game server on 2026-10-17 (asked directly: connect -> clientRequestVersion), the server
 *  every UAT game of 1.0.221-1.0.235 ran against. (An old capture said 3.2.3; Astra caught that before it shipped.) */
export const APPROVED_FFB_SERVER_VERSIONS: readonly string[] = ['3.3.1'];

export interface ServerVersionBlock {
  /** The server's announced version. */
  serverVersion: string;
  /** The Java client version the server expects (for the message and the bug report). */
  expectsClient: string;
  /** The game the coach was joining, when known. */
  gameId: number | null;
  /** The coach, when known (the "play with the FUMBBL client" link goes to the coach page, where FUMBBL's Play lives). */
  coach: string | null;
  approved: readonly string[];
}

/** The live block (the modal reads it); null = none. */
export const serverVersionBlock = ref<ServerVersionBlock | null>(null);
/** The last server version announced to this client (bug reports carry it). */
export const lastServerVersion = ref<string | null>(null);

export function serverVersionApproved(serverVersion: string, approved: readonly string[] = APPROVED_FFB_SERVER_VERSIONS): boolean {
  const v = serverVersion.trim();
  return v !== '' && approved.includes(v);
}

/** The refusal message for a join, or null when the join may go out. `enforced` = the public edition. */
export function serverVersionRefusal(
  version: Pick<ServerCommandVersion, 'serverVersion' | 'clientVersion'>,
  mode: ClientMode,
  opts: { enforced: boolean; approved?: readonly string[] },
): string | null {
  if (!opts.enforced) return null;
  if (mode !== 'player') return null; // spectate / replay: read-only, allowed (owner 10-17)
  const approved = opts.approved ?? APPROVED_FFB_SERVER_VERSIONS;
  if (serverVersionApproved(String(version.serverVersion ?? ''), approved)) return null;
  return `FUMBBL's game server is now version ${String(version.serverVersion ?? '?')}; this Super FUMBBL build is approved for ${approved.join(', ')}. Playing is disabled until a compatible update is released. Use the main FUMBBL client to play.`;
}

/** The FUMBBL page to play with the main client: the coach's own page (its current games carry FUMBBL's Play button).
 *  Astra 10-17: never a match page built from the FFB game id - the website's match ids are another namespace. */
export function fumbblPlayUrl(coach: string | null): string {
  const c = coach?.trim() ?? '';
  return c ? `https://fumbbl.com/~${encodeURIComponent(c)}` : 'https://fumbbl.com';
}
