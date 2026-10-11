/**
 * The small corner notice (App.vue renders it): the controller's input-switch / connect / disconnect notes, and
 * (owner 10-10) "Player portraits on" / "Player portraits off" when the middle mouse button flips the player-card mode.
 * One notice at a time; a new one replaces the old.
 */
import { ref } from 'vue';

export type CornerNoticeKind = 'switch' | 'disconnect' | 'connect' | 'nonstandard' | 'player-cards';
export const cornerNotice = ref<{ kind: CornerNoticeKind; text: string } | null>(null);
export const CORNER_NOTICE_MS = 1500;
let timer: ReturnType<typeof setTimeout> | null = null;

export function hideCornerNotice(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  cornerNotice.value = null;
}
export function showCornerNotice(kind: CornerNoticeKind, text: string, durationMs: number = CORNER_NOTICE_MS): void {
  hideCornerNotice();
  cornerNotice.value = { kind, text };
  timer = setTimeout(hideCornerNotice, durationMs);
}
/** Only the controller's own notices (the box was unticked): a player-cards notice stays. */
export function hideControllerNotices(): void {
  if (cornerNotice.value && cornerNotice.value.kind !== 'player-cards') hideCornerNotice();
}
