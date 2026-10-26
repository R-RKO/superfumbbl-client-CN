import type { GameJson } from '@fumbbl40k/ffb-protocol';

/**
 * Owner 10-26: "Let's ensure our client displays a splash to all seats when Pastries are used or declined."
 *
 * Pure, server-derived outcome detection for Bretonnian Pastries (spec-bretonnian-pastries-2026-10-23; server
 * BB2025 StepApothecary.handleKnockoutReserve). The server opens `useInducement {teamId,
 * inducementTypeArray:["bretonnianPastries"], playerId}` after a KO; one step execution then answers it, so ONE frame
 * carries the dialog clear together with either:
 *  - USED: report `bretonnianPastriesRoll {teamId, playerId, roll, successful}` + the inducement's `uses` bumped
 *    (successful: the player goes to RESERVE; a natural 1: the KO stands);
 *  - DECLINED: no report, `uses` untouched, the KO applied.
 *
 * A USE is the report itself (whatever the dialog state). A DECLINE is inferred only on the frame that CLOSES the
 * offer (the pastries dialog for that player was the model's dialog at frame start and is not after it) and only on
 * AFFIRMATIVE server evidence of the decline branch, all of it in that frame: no pastries report for that player, the
 * team's Pastries entry present before and after with `uses` unchanged and still below `value`, the player now
 * Knocked-out (the KO the decline applies) or the offer handed on to the same team's next player (multiblock), and
 * the game not over (Sol r1: a dialog merely replaced, missing data or any other state is no decline). Never while the dialog is still open, never from a timer. A re-sent identical offer
 * (a new object with the same team / player) is still the same open offer.
 */

export const PASTRIES_INDUCEMENT = 'bretonnianPastries';
const PASTRIES_REPORT = 'bretonnianPastriesRoll';
const PLAYER_STATE_KNOCKED_OUT = 0x05;

/** `uses` = the team's Pastries uses in the same model (null: the model carries no Pastries entry). */
export interface PastriesOffer { teamId: string; playerId: string; uses: number | null }

export type PastriesOutcome =
  | { kind: 'success' | 'failed'; teamId: string; playerId: string; roll: number | null }
  | { kind: 'declined'; teamId: string; playerId: string };

/** The model's open Pastries offer: a `useInducement` dialog offering exactly Bretonnian Pastries for one player. */
export function pastriesOfferOf(model: GameJson | null | undefined): PastriesOffer | null {
  const d = (model?.dialogParameter ?? null) as Record<string, unknown> | null;
  if (!d || d.dialogId !== 'useInducement') return null;
  const types = Array.isArray(d.inducementTypeArray) ? d.inducementTypeArray.map(String) : [];
  const cards = Array.isArray(d.cards) ? d.cards : [];
  if (types.length !== 1 || types[0] !== PASTRIES_INDUCEMENT || cards.length > 0) return null;
  const playerId = String(d.playerId ?? '');
  const teamId = String(d.teamId ?? '');
  if (!playerId || !teamId) return null;
  return { teamId, playerId, uses: model ? pastriesEntry(model, teamId)?.uses ?? null : null };
}

/** The team's Pastries entry in the model's inducement set ({value, uses}); null when the model carries none. */
function pastriesEntry(model: GameJson, teamId: string): { value: number; uses: number } | null {
  const side = String(model.teamHome?.teamId ?? '') === teamId ? 'home' : String(model.teamAway?.teamId ?? '') === teamId ? 'away' : null;
  if (!side) return null;
  const turnData = (side === 'home' ? model.turnDataHome : model.turnDataAway) as { inducementSet?: { inducementArray?: unknown[] } } | undefined;
  const entry = (turnData?.inducementSet?.inducementArray ?? [])
    .find((e) => String((e as { inducementType?: unknown } | null)?.inducementType ?? '') === PASTRIES_INDUCEMENT) as { value?: unknown; uses?: unknown } | undefined;
  if (!entry) return null;
  const value = Number(entry.value ?? 1);
  const uses = Number(entry.uses ?? 0);
  return Number.isFinite(value) && Number.isFinite(uses) ? { value, uses } : null;
}

function playerStateBase(model: GameJson, playerId: string): number | null {
  const data = model.fieldModel?.playerDataArray?.find((p) => p.playerId === playerId) as { playerState?: unknown } | undefined;
  const raw = data?.playerState;
  if (typeof raw === 'number') return raw & 0xff;
  if (raw && typeof raw === 'object') {
    const n = (raw as { id?: unknown; base?: unknown }).id ?? (raw as { base?: unknown }).base;
    if (typeof n === 'number') return n & 0xff;
  }
  return null;
}

/** Sol r3: a closed offer whose decline KO is still to come (bb2025 StepApothecaryMultiple applies and syncs each
 *  injury separately after the last decision: the clearing frame can carry another player's KO, his own lands in the
 *  next one). Bounded by server FRAMES, never by time; any contradicting evidence drops it. */
export interface PastriesPendingDecline { teamId: string; playerId: string; uses: number; framesLeft: number }
const PENDING_DECLINE_FRAMES = 3;
/** Base states that end a pending decline without a KO (got up, another box, banned). */
const PENDING_DECLINE_CONTRADICTED = new Set([0x01, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0d]);

function gameOver(after: GameJson): boolean {
  const finished = (after as { finished?: unknown }).finished; // a timestamp (or true) once the game is over
  return (finished != null && finished !== false && finished !== '') || String(after.turnMode ?? '') === 'endGame';
}
function dialogNames(after: GameJson, playerId: string): boolean {
  const d = (after.dialogParameter ?? null) as { playerId?: unknown; playerIds?: unknown } | null;
  if (!d) return false;
  return String(d.playerId ?? '') === playerId || (Array.isArray(d.playerIds) && d.playerIds.map(String).includes(playerId));
}
const hasReportFor = (reports: readonly Record<string, unknown>[], playerId: string) =>
  reports.some((r) => String(r.reportId ?? '') === PASTRIES_REPORT && String(r.playerId ?? '') === playerId);

/**
 * The Pastries outcomes one applied frame shows, and the pending decline it leaves. `before` = the open offer in the
 * model at frame start, `pending` = the pending decline carried from the previous frame (null: none), `after` = the
 * model after the frame's changes, `reports` = the frame's reports.
 */
export function pastriesStep(
  before: PastriesOffer | null, pending: PastriesPendingDecline | null,
  reports: readonly Record<string, unknown>[], after: GameJson | null | undefined,
): { outcomes: PastriesOutcome[]; pending: PastriesPendingDecline | null } {
  const outcomes: PastriesOutcome[] = [];
  for (const r of reports) {
    if (String(r.reportId ?? '') !== PASTRIES_REPORT || typeof r.successful !== 'boolean') continue;
    const playerId = String(r.playerId ?? '');
    if (!playerId) continue;
    const roll = Number(r.roll);
    outcomes.push({ kind: r.successful ? 'success' : 'failed', teamId: String(r.teamId ?? ''), playerId, roll: Number.isFinite(roll) && roll > 0 ? roll : null });
  }
  if (!after) return { outcomes, pending: null };
  let nextPending: PastriesPendingDecline | null = null;
  // 1. The pending decline from an earlier closing frame: confirmed only by his KO landing; anything else ends it.
  if (pending) {
    const entry = pastriesEntry(after, pending.teamId);
    const state = playerStateBase(after, pending.playerId);
    const offer = pastriesOfferOf(after);
    const contradicted = gameOver(after) || hasReportFor(reports, pending.playerId) || (offer?.playerId === pending.playerId)
      || dialogNames(after, pending.playerId) || !entry || entry.uses !== pending.uses || state === null || PENDING_DECLINE_CONTRADICTED.has(state);
    if (!contradicted && state === PLAYER_STATE_KNOCKED_OUT) outcomes.push({ kind: 'declined', teamId: pending.teamId, playerId: pending.playerId });
    else if (!contradicted && pending.framesLeft > 1) nextPending = { ...pending, framesLeft: pending.framesLeft - 1 };
  }
  // 2. The offer open at frame start.
  if (!before) return { outcomes, pending: nextPending };
  const still = pastriesOfferOf(after);
  if (still && still.playerId === before.playerId && still.teamId === before.teamId) return { outcomes, pending: nextPending }; // still open
  if (hasReportFor(reports, before.playerId) || gameOver(after)) return { outcomes, pending: nextPending };
  const entry = pastriesEntry(after, before.teamId);
  if (!entry || before.uses === null || entry.uses !== before.uses || entry.uses >= entry.value) return { outcomes, pending: nextPending }; // no proof the Pastries were kept
  // The decline's KO applied - or (Sol r2, bb2025 StepApothecaryMultiple.offerKnockoutReserve) the server handing the
  // still-unused Pastries straight on to the SAME team's next Knocked-out player: it offers the next one only once this
  // one's decision is in without a use, and applies every KO later, after the last decision.
  const handedOn = !!still && still.teamId === before.teamId && still.playerId !== before.playerId;
  const state = playerStateBase(after, before.playerId);
  if (handedOn || state === PLAYER_STATE_KNOCKED_OUT) {
    outcomes.push({ kind: 'declined', teamId: before.teamId, playerId: before.playerId });
    return { outcomes, pending: nextPending };
  }
  // Sol r3: cleared outright (no other dialog took its place) with his KO still to land - pending, frame-bounded.
  if (!after.dialogParameter && state !== null && !PENDING_DECLINE_CONTRADICTED.has(state)) {
    return { outcomes, pending: { teamId: before.teamId, playerId: before.playerId, uses: entry.uses, framesLeft: PENDING_DECLINE_FRAMES } };
  }
  return { outcomes, pending: nextPending };
}

/** One frame's outcomes with no pending decline carried in (see pastriesStep). */
export function pastriesOutcomes(before: PastriesOffer | null, reports: readonly Record<string, unknown>[], after: GameJson | null | undefined): PastriesOutcome[] {
  return pastriesStep(before, null, reports, after).outcomes;
}
