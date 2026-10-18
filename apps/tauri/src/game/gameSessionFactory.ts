// Owner 10-17: every game session the app opens goes through here, so the two things each one needs ride along:
// client-supplied entropy on outgoing commands (owner 10-16) and the server-version gate (serverVersionGate.ts).
import { GameSession, type ClientMode, type ServerCommandVersion } from '@fumbbl40k/ffb-protocol';
import { FORK_EDITION } from './edition';
import { withEntropy } from './mouseEntropy';
import { APPROVED_FFB_SERVER_VERSIONS, lastServerVersion, serverVersionBlock, serverVersionRefusal } from './serverVersionGate';

export interface GameSessionTarget { url: string; compression?: boolean }

/** The join gate the session consults once the server has announced its version, before any join leaves. */
export function serverVersionJoinGate(version: ServerCommandVersion, join: { mode: ClientMode; gameId: number | null; coach: string | null }): string | null {
  lastServerVersion.value = String(version.serverVersion ?? '');
  const refusal = serverVersionRefusal(version, join.mode, { enforced: !FORK_EDITION });
  if (refusal) {
    serverVersionBlock.value = {
      serverVersion: String(version.serverVersion ?? '?'),
      expectsClient: String(version.clientVersion ?? ''),
      gameId: join.gameId,
      coach: join.coach,
      approved: APPROVED_FFB_SERVER_VERSIONS,
    };
  } else {
    serverVersionBlock.value = null; // Astra 10-17: a later allowed launch (a spectate, a replay) supersedes an old block
  }
  return refusal;
}

export function createGameSession(target: GameSessionTarget): GameSession {
  return new GameSession({ url: target.url, compression: target.compression ?? true, decorateOutgoing: withEntropy, joinGate: serverVersionJoinGate });
}
