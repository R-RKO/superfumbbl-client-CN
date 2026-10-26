import type { GameJson } from '@fumbbl40k/ffb-protocol';
export interface FollowupProjection {
  attackerId: string | null;
  defenderId: string | null;
  vacated: [number, number] | null;
  /** Owner 10-25 (Sol r6): `vacated` only from an observed push (null = not observed); `from` = the attacker's square
   *  when the question armed, `fromObserved` = the question OPENED in an observed event (so `from` is where he will
   *  follow from) rather than already open in a snapshot (which may hold the follow move already). */
  pending: { attackerId: string; from: [number, number]; vacated: [number, number] | null; resolvingAge: number; fromObserved: boolean } | null;
  outcome: { attackerId: string; square: [number, number]; followed: boolean } | null;
}
export const createFollowupProjection = (): FollowupProjection => ({ attackerId: null, defenderId: null, vacated: null, pending: null, outcome: null });
const square = (g: GameJson, id: string): [number, number] | null => {
  const c = g.fieldModel.playerDataArray.find(p => p.playerId === id)?.playerCoordinate;
  return c && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] >= 0 && c[0] < 26 && c[1] >= 0 && c[1] < 15 ? [c[0], c[1]] : null;
};
import { PINNED_STATE_BITS as PINNED_BITS } from './pushPresentation';
/** Upstream StepFollowup publishes FOLLOWUP_CHOICE=false with NO dialog for a pinned attacker, Vicious Vines and
 *  Multiple Block (the synchronous Multiple Block sequence has no follow-up step at all): the attacker cannot follow. */
export function followUpImpossible(game: GameJson, attackerId: string): boolean {
  const action = String((game.actingPlayer as { playerAction?: unknown } | undefined)?.playerAction ?? '');
  if (action === 'multipleBlock' || action === 'viciousVines') return true;
  const state = Number(game.fieldModel.playerDataArray.find((p) => p.playerId === attackerId)?.playerState ?? 0);
  return (state & PINNED_BITS) !== 0;
}
/** Owner 10-25 (follow/stay = a server signal, never a frame count): what the server sent for a push-or-better block
 *  that has NO followupChoice dialog. 'forced' = the attacker stepped onto the vacated square without being asked
 *  (Frenzy / forceFollowup, a used Taunt-style forceOpponentToFollowUp) - owner 10-25: not announced; 'stay' = a used
 *  Fend (ReportSkillUse stayAwayFromOpponent, used, by the defender) or, on the push frame itself, an attacker who
 *  cannot follow (followUpImpossible); null = no signal yet (a Fend / crowd-push apothecary dialog may still be open,
 *  or the followupChoice dialog is still to come). */
export function followUpSignalWithoutDialog(game: GameJson, watch: { attackerId: string; defenderId: string; vacated: readonly [number, number] },
  reports: readonly Record<string, unknown>[], pushFrame: boolean): 'stay' | 'forced' | null {
  const at = square(game, watch.attackerId);
  if (at && at[0] === watch.vacated[0] && at[1] === watch.vacated[1]) return 'forced';
  if (reports.some((r) => String(r.reportId) === 'skillUse' && r.used === true && String(r.skillUse ?? '') === 'stayAwayFromOpponent'
    && String(r.playerId ?? '') === watch.defenderId)) return 'stay';
  if (pushFrame && followUpImpossible(game, watch.attackerId)) return 'stay';
  return null;
}
/** Owner 10-25 (Sol r1 P2-5): a used Stand Firm (upstream bb2025 StandFirmBehaviour: ReportSkillUse AVOID_PUSH, used,
 *  then FOLLOWUP_CHOICE=false and an empty pushback stack - nobody moves, no followupChoice dialog) ends a push-or-better
 *  block with a stay. AVOID_PUSH is Stand Firm's alone; the player may be the block defender or a chain-push victim. */
export function standFirmStayReported(reports: readonly Record<string, unknown>[]): boolean {
  return reports.some((r) => String(r.reportId) === 'skillUse' && r.used === true && String(r.skillUse ?? '') === 'avoidPush');
}
/** Owner 10-25 (Sol r2 / r3): a push stopped by a ROOTED or CHOMPED player - the block defender or a chain-push victim.
 *  Upstream bb2025 TakeRootBehaviour / MonstrousMouthBehaviour clear the whole pushback stack, publish
 *  FOLLOWUP_CHOICE=false and null the starting pushback square, so StepPushback reports ReportPushback naming that
 *  player; nobody moves and no followupChoice dialog comes - a stay, read from that report and the server-sent state. */
export function pushStoppedByPinnedPlayer(game: GameJson, reports: readonly Record<string, unknown>[]): boolean {
  return reports.some((r) => {
    if (String(r.reportId) !== 'pushback') return false;
    const pid = String(r.defenderId ?? r.playerId ?? '');
    const state = Number(game.fieldModel.playerDataArray.find((p) => p.playerId === pid)?.playerState ?? 0);
    return (state & PINNED_BITS) !== 0;
  });
}
/** Keeps only observed push origins. A mid-decision snapshot cannot establish a vacated square.
 *  Owner 10-25: the live rule - a followupChoice question resolves on the FIRST frame without its dialog (the server's
 *  only stay signal; a follow's coordinate lands before the clear); a push-or-better block without the dialog resolves
 *  on followUpSignalWithoutDialog. `pending.resolvingAge` stays 0 (kept for the checkpoint shape). */
export function reduceFollowupProjection(previous: FollowupProjection, before: GameJson, game: GameJson,
  lastFrom: ReadonlyMap<string, [number, number]>, reports: readonly Record<string, unknown>[]): FollowupProjection {
  const result = structuredClone(previous);
  result.outcome = null;
  const attackerId = game.actingPlayer?.playerId || null;
  const defenderId = String((game as { defenderId?: string }).defenderId || '') || null;
  const freshBlock = reports.some(r => r.reportId === 'blockRoll' || r.reportId === 'block');
  if (freshBlock) result.pending = null;
  if (attackerId !== result.attackerId || defenderId !== result.defenderId || freshBlock) {
    result.attackerId = attackerId; result.defenderId = defenderId; result.vacated = null;
  }
  const pushFrame = !!defenderId && lastFrom.has(defenderId);
  if (defenderId && pushFrame) result.vacated = [...lastFrom.get(defenderId)!];
  const offered = game.dialogParameter?.dialogId === 'followupChoice';
  if (offered && attackerId && result.pending?.attackerId !== attackerId) {
    const fromObserved = before.dialogParameter?.dialogId !== 'followupChoice';
    const from = square(before, attackerId);
    result.pending = from ? { attackerId, from, vacated: result.vacated ? [...result.vacated] : null, resolvingAge: 0, fromObserved } : null;
  }
  const pending = result.pending;
  if (pending) {
    const at = square(game, pending.attackerId);
    // Sol r6: the observed vacated square; else a move AWAY from his armed square (only the follow moves him while the
    // question is open). Never a guessed square.
    const followed = !!at && (pending.vacated
      ? at[0] === pending.vacated[0] && at[1] === pending.vacated[1]
      : at[0] !== pending.from[0] || at[1] !== pending.from[1]);
    if (followed || !offered) {
      // a stay with neither the push nor the question's opening observed (a snapshot taken mid-question) is not told
      // apart from a follow already in that snapshot - no outcome
      if (followed || pending.vacated || pending.fromObserved) {
        result.outcome = { attackerId: pending.attackerId, square: at ?? [...pending.from], followed };
      }
      result.pending = null;
      result.vacated = null;
    }
  } else if (!offered && attackerId && defenderId && (standFirmStayReported(reports) || pushStoppedByPinnedPlayer(game, reports))) {
    const at = square(game, attackerId);
    if (at) result.outcome = { attackerId, square: at, followed: false };
    result.vacated = null;
  } else if (!offered && attackerId && defenderId && result.vacated) {
    const signal = followUpSignalWithoutDialog(game, { attackerId, defenderId, vacated: result.vacated }, reports, pushFrame);
    if (signal !== null) {
      const at = signal === 'stay' ? square(game, attackerId) : null;
      if (at) result.outcome = { attackerId, square: at, followed: false };
      result.vacated = null;
    }
  }
  return result;
}
