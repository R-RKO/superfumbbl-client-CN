import { t } from '../i18n';
/**
 * Owner 08-18: plain-language reasons for the spectate connect-error modal (App.vue).
 * Pure/testable seam — maps a raw transport error string to a short, actionable
 * sentence. Fail-open: an error this function doesn't recognize is returned
 * VERBATIM (never suppressed to nothing) so an unmapped failure still tells the
 * user something rather than showing a blank/generic message.
 */
export function friendlySpectateError(raw: string): string {
  const text = raw.trim();
  if (/WebSocket connection to .* failed/i.test(text)) {
    return t('replay.text.couldnTReachThe');
  }
  if (/not connected/i.test(text)) {
    return t('replay.text.connectionDroppedBeforeThe');
  }
  if (!text) return t('replay.text.theConnectionFailedFor');
  return text;
}

/** Preserve the server's authoritative pre-game rejection instead of letting the
 * following normal WebSocket close (usually code 1000) replace it. */
export function spectateServerStatusError(
  serverStatus: string | null | undefined,
  message: string | null | undefined,
): { message: string; detail: string } {
  const status = serverStatus?.trim() ?? '';
  const authoritative = message?.trim() || status || t('replay.authoritative.theServerRejectedThe');
  if (/wrong password/i.test(status) || /wrong password/i.test(authoritative)) {
    return {
      message: t('replay.text.fumbblRejectedTheSpectator'),
      get detail() { return t('replay.text.fumbblServerStatusAuthoritative', { authoritative }); },
    };
  }
  return {
    message: authoritative,
    detail: status && status !== authoritative
      ? t('replay.text.fumbblServerStatusStatus', { status, authoritative })
      : t('replay.text.fumbblServerStatusAuthoritative', { authoritative }),
  };
}
