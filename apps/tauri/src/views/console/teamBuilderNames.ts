import { data } from '../../i18n';

/** A generated player's fallback NAME is model DATA sent to config-web: invariant English (Astra r1/r2 #9). */
export function fallbackPlayerName(index: number): string {
  return data(`Player ${index + 1}`);
}
