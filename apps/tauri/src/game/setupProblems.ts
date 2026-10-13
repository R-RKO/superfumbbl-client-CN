import { isLeftWideColumn, isRightWideColumn, type SetupValidation } from '@fumbbl40k/ffb-pitch';

/** Owner 10-03: "If the user has setup incorrectly, the modal should pop and indicate what they did wrong with arrows
 *  on offending players." One line per failed setup condition (the same four the setup pane lists) and the placed
 *  players that cause it. An over-full wide zone names its players; a short line of scrimmage, or a wrong number of
 *  players on the pitch, has no single culprit, so it is text only. Empty `problems` = the setup is legal. */
export interface SetupProblemReview {
  problems: string[];
  offenders: string[];
}

/** Owner 10-12 (pitch view flip): "left" / "right" in the setup texts name the side of the SCREEN the zone is drawn on
 *  in the north / south view. The model's left wide zone (columns 0..3) is drawn on the right once that view is turned
 *  around, so the words swap with it; which players and counts each line means never changes. East / west keeps its
 *  wording (there the zones are top and bottom, flipped or not). */
export function wideZoneWordsSwapped(view: { pitchOrientation: 'ns' | 'ew'; pitchFlipped: boolean }): boolean {
  return view.pitchOrientation === 'ns' && view.pitchFlipped === true;
}
export function wideZoneWord(zone: 'left' | 'right', swapped: boolean): 'left' | 'right' {
  return swapped ? (zone === 'left' ? 'right' : 'left') : zone;
}

export function setupProblems(
  players: readonly { playerId: string; coord: [number, number] | null; inert?: boolean }[],
  validation: SetupValidation,
  wordsSwapped = false,
): SetupProblemReview {
  const problems: string[] = [];
  const offenders = new Set<string>();
  // Astra review 10-03: an inert player (Solid Defence / Dwarfen Wisdom lock) cannot be moved, so it is never pointed at.
  const placed = players.filter((player): player is { playerId: string; coord: [number, number] } => !!player.coord && player.inert !== true);
  if (!validation.losOk) {
    // The server's own minimum: min(minPlayersOnLos, available players without Keen Players).
    problems.push(`Only ${validation.onLos} on the line of scrimmage. You need ${validation.requiredOnLos} in the centre (the wide zones don't count).`);
  }
  if (!validation.leftOk) {
    problems.push(`${validation.leftWide} players in the ${wideZoneWord('left', wordsSwapped)} wide zone. The limit is ${validation.maxPerWideZone}.`);
    for (const player of placed) if (isLeftWideColumn(player.coord[1])) offenders.add(player.playerId);
  }
  if (!validation.rightOk) {
    problems.push(`${validation.rightWide} players in the ${wideZoneWord('right', wordsSwapped)} wide zone. The limit is ${validation.maxPerWideZone}.`);
    for (const player of placed) if (isRightWideColumn(player.coord[1])) offenders.add(player.playerId);
  }
  if (!validation.countOk) {
    problems.push(validation.placed < validation.required
      ? `${validation.placed} of ${validation.required} players placed. Field ${validation.required - validation.placed} more.`
      : `${validation.placed} players placed. The limit is ${validation.maxOnPitch}: send ${validation.placed - validation.maxOnPitch} back to reserves.`);
  }
  return { problems, offenders: [...offenders] };
}
