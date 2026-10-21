/** One die button on the Modern multiple-block card (SpectateView `.multi-block-resolution`).
 *
 *  Owner 10-21: a die that is not the viewer's to click is read-only - dimmed, `disabled`, standard cursor (never
 *  not-allowed), its tooltip kept. Astra r1 P1: an ARMED Pro / Consummate reroll makes the row's dice clickable even
 *  on the opponent's-choice row (an uphill block: `isOwnChoice` false, the attacker may still reroll one die), so a
 *  die is read-only only when the row is neither my choice nor my armed reroll. */
export interface MultiBlockDieRow {
  targetId: string;
  isOwnChoice: boolean | null;
  pickable: boolean;
}
export interface MultiBlockDieArm {
  targetId: string;
  kind: 'pro' | 'consummate';
}
export interface MultiBlockDieContext {
  /** The multi-block dialog is this seat's to answer. */
  mine: boolean;
  /** The armed die-select reroll (Pro / Consummate), if any. */
  armed: MultiBlockDieArm | null;
  /** The row's dice are tumbling (a reroll's re-presentation). */
  tumbling: boolean;
}

export function multiBlockDieButtonState(row: MultiBlockDieRow, ctx: MultiBlockDieContext): { readonly: boolean; disabled: boolean } {
  const armedHere = ctx.armed?.targetId === row.targetId;
  const readonly = !ctx.mine || (!armedHere && (row.isOwnChoice !== true || !row.pickable));
  return { readonly, disabled: ctx.tumbling || readonly };
}

export type MultiBlockDieClick =
  | { kind: 'reroll'; source: 'Pro' | 'Consummate Professional'; dieIndex: number }
  | { kind: 'pick'; dieIndex: number }
  | null;

/** What a click on die `dieIndex` does: reroll it with the armed source, pick it, or nothing (read-only). */
export function multiBlockDieClick(row: MultiBlockDieRow, dieIndex: number, ctx: MultiBlockDieContext): MultiBlockDieClick {
  if (!ctx.mine || ctx.tumbling) return null;
  if (ctx.armed && ctx.armed.targetId === row.targetId) {
    return { kind: 'reroll', source: ctx.armed.kind === 'pro' ? 'Pro' : 'Consummate Professional', dieIndex };
  }
  if (row.isOwnChoice !== true || !row.pickable) return null; // the defender's choice: read-only
  return { kind: 'pick', dieIndex };
}
