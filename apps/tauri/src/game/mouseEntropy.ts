/**
 * Owner 10-16: client-supplied entropy, as the FUMBBL Java client does it (ffb-client-logic MouseEntropySource +
 * ClientCommunication.send). Every client command may carry an optional one-byte `entropy` field; the server feeds it
 * into its Fortuna pool (ServerCommunication: `getFortuna().addEntropy(...)`). The Java client harvests two bits per
 * pointer move (the low bits of x and y, xor'd), no more often than every 10 ms, and attaches a byte to the next
 * outgoing command once eight bits are collected. A client that never sends it is protocol-legal, but every coach on
 * this client would then contribute nothing to the server's pool; this mirrors upstream so the wire is the same.
 */
export const MIN_UPDATE_PERIOD_MS = 10;

let data = 0;
let bits = 0;
let lastUpdateAt = 0;
let lastX = Number.NaN;
let lastY = Number.NaN;

/** Report a pointer position (CSS pixels; any consistent frame will do). Same square or too soon: ignored. */
export function reportPointerPosition(x: number, y: number, now: number = Date.now()): void {
  const ix = Math.trunc(x);
  const iy = Math.trunc(y);
  if ((ix === lastX && iy === lastY) || now - lastUpdateAt < MIN_UPDATE_PERIOD_MS) return;
  const b = (ix & 0x3) ^ (iy & 0x3);
  data = ((data << 2) | b) & 0xff;
  bits += 2;
  lastUpdateAt = now;
  lastX = ix;
  lastY = iy;
}

export function hasEnoughEntropy(): boolean {
  return bits >= 8;
}

/** The collected byte as the SIGNED value Java's `(byte)` serialises (-128..127); resets the bit count. */
export function takeEntropy(): number {
  bits = 0;
  return data > 127 ? data - 256 : data;
}

/** Attach the entropy byte to an outgoing client command when enough has been collected; otherwise unchanged. */
export function withEntropy<T extends Record<string, unknown>>(command: T): T | (T & { entropy: number }) {
  return hasEnoughEntropy() ? { ...command, entropy: takeEntropy() } : command;
}

/** Test hook. */
export function resetMouseEntropy(): void {
  data = 0; bits = 0; lastUpdateAt = 0; lastX = Number.NaN; lastY = Number.NaN;
}

/** Window-level pointer harvest (the Java client converts every mouse event to its root component; the window is
 *  our equivalent). Returns the detach function. */
export function installMouseEntropy(target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const onMove = (ev: Event) => {
    const p = ev as PointerEvent;
    reportPointerPosition(p.clientX, p.clientY);
  };
  target.addEventListener('pointermove', onMove, { passive: true });
  return () => target.removeEventListener('pointermove', onMove);
}
