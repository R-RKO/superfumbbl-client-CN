import type { GameJson } from '@fumbbl40k/ffb-protocol';
import { turnSideIsHome } from './blastinSecondBeat';

export interface BlitzProjection { id: string; side: boolean; turnKey: string; targetId: string; visible: boolean;
  /** The server still holds this target as the SELECTED blitz target (fieldModel.targetSelectionState). Pure model
   *  fact, setting-independent, so a cached or replay-seeked projection never bakes the display setting in. */
  targetLive: boolean }
export type BlitzTargetMarkerMode = 'turn' | 'fumbbl';
export interface BlitzTokenView { blitzerId: string; targetId: string; side: boolean }
/** Settings > UI > Blitz target marker. 'turn' (default) keeps the blitzer and target badges for the whole turn once the
 *  blitz is used. 'fumbbl' matches base FUMBBL: the target marker is the player-state selected-blitz-target bit, which the
 *  server drops when it clears its target selection state at the end of the blitz block; the blitzer's own used marker
 *  (turnData.blitzingPlayerId) stays for the turn upstream, so it stays here too. */
export function blitzTokenView(blitz: BlitzProjection | null | undefined, mode: BlitzTargetMarkerMode): BlitzTokenView | null {
  if (!blitz?.visible) return null;
  const targetId = mode === 'fumbbl' && blitz.targetLive !== true ? '' : blitz.targetId;
  return { blitzerId: blitz.id, targetId, side: blitz.side };
}
export function currentTurnKey(g: GameJson): string {
  return `${g.half ?? 0}:${g.turnDataHome?.turnNr ?? 0}:${g.turnDataAway?.turnNr ?? 0}:${turnSideIsHome(g) ? 'H' : 'A'}`; // S46: held through the Blastin' second-beat flip
}
export function selectedBlitzTargetId(g: GameJson): string {
  const target = g.fieldModel.targetSelectionState as { targetSelectionStatus?: unknown; playerId?: unknown } | null;
  return target && String(target.targetSelectionStatus ?? '') === 'SELECTED' ? String(target.playerId ?? '') : '';
}
export function reduceBlitzProjection(previous: BlitzProjection | null, game: GameJson, block: { attackerId: string | null; defenderId: string | null }): BlitzProjection | null {
  const turnKey = currentTurnKey(game);
  let marker = previous?.turnKey === turnKey ? { ...previous } : null;
  const actorId = String(game.actingPlayer?.playerId ?? '');
  const declaring = !!actorId && /blitz/i.test(String(game.actingPlayer?.playerAction ?? ''));
  if (declaring) marker = { id: actorId, side: game.teamHome.playerArray.some((p) => p.playerId === actorId), turnKey, targetId: marker?.targetId ?? '', visible: false, targetLive: false };
  if (!marker) return null;
  const target = selectedBlitzTargetId(game);
  if (actorId === marker.id && target) marker.targetId = target;
  else if (block.attackerId === marker.id && block.defenderId) marker.targetId = block.defenderId;
  const used = !!(marker.side ? game.turnDataHome?.blitzUsed : game.turnDataAway?.blitzUsed);
  // Only the blitz occurrence's own selection counts: a later Gaze selection of the same player must not revive it.
  marker.targetLive = !!marker.targetId && target === marker.targetId && actorId === marker.id && declaring;
  marker.visible = used || (actorId === marker.id && declaring && !!target);
  return marker;
}
