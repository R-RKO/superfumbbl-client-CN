/**
 * Controller support P2b (owner ruling 10-07): on the inducements screen the pad's B removes picks in REVERSE order of
 * adding — one undo stack per selection session across every pane (inducements, star players, mercenaries), whatever
 * card is focused. Nothing left to remove → B is inert (it never backs out of the screen).
 *
 * The stack is client-side: the coach's own adds push onto it; it is seeded from the current selection (the server's
 * pick order) when the screen is (re-)entered, and reconciled with every authoritative picks update — a pick removed
 * another way (the ✕, Clear, a server refusal) drops its latest occurrence, a pick the stack does not know about yet
 * is appended.
 */
export type PickCounts = Readonly<Record<string, number>>;

/** Seed from the current selection, in its own (server) order: each key once per copy picked. */
export function seedUndoStack(picks: PickCounts): string[] {
  const out: string[] = [];
  for (const [key, qty] of Object.entries(picks)) for (let i = 0; i < Math.max(0, qty | 0); i++) out.push(key);
  return out;
}

/** Make `stack` agree with `picks`: surplus occurrences go (latest first), missing copies are appended. */
export function reconcileUndoStack(stack: readonly string[], picks: PickCounts): string[] {
  const out = [...stack];
  const counts = new Map<string, number>();
  for (const key of out) counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const [key, have] of counts) {
    let surplus = have - Math.max(0, (picks[key] ?? 0) | 0);
    for (let i = out.length - 1; i >= 0 && surplus > 0; i--) if (out[i] === key) { out.splice(i, 1); surplus--; }
  }
  for (const [key, qty] of Object.entries(picks)) {
    const missing = Math.max(0, qty | 0) - (counts.get(key) ?? 0);
    for (let i = 0; i < missing; i++) out.push(key);
  }
  return out;
}

/** The pick B removes: the most recently added one that is still picked and removable; null = B is inert. */
export function undoTarget(stack: readonly string[], picks: PickCounts, removable: (key: string) => boolean = () => true): string | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const key = stack[i]!;
    if ((picks[key] ?? 0) > 0 && removable(key)) return key;
  }
  return null;
}

/** Drop the latest occurrence of `key` (after B sent its remove). */
export function popUndo(stack: readonly string[], key: string): string[] {
  const out = [...stack];
  const i = out.lastIndexOf(key);
  if (i >= 0) out.splice(i, 1);
  return out;
}
