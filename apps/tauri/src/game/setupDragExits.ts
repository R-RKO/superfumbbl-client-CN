/**
 * Owner 10-12 (pitch view flip, Astra reviews 4 and 5): the ways a setup drag can be LOST without the release the
 * view listens for. A lost drag must end (the renderer holds a waiting view change while one is in progress), and
 * only the drag's OWN loss may end it: another pointer's pointercancel (a touch while a pen drags) is not this drag.
 *
 * Exits: a pointercancel of the dragging pointer (any pointercancel when the pointer is not known), the window
 * losing focus, the page being hidden. The caller adds unmount. Returns the function that removes the listeners.
 * What the drag does on a normal release is the caller's and is not touched here.
 */
export function installSetupDragExits(pointerId: number | undefined, onLost: () => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
  const cancel = (event: PointerEvent): void => {
    if (pointerId !== undefined && event.pointerId !== pointerId) return; // another pointer's cancel: not this drag
    onLost();
  };
  const blur = (): void => onLost();
  const hidden = (): void => { if (document.visibilityState === 'hidden') onLost(); };
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', hidden);
  return () => {
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', hidden);
  };
}
