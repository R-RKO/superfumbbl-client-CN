import type { GameJson } from '@fumbbl40k/ffb-protocol';

export interface SwoopChoiceCopy {
  title: string;
  body: string;
  accept: string;
  decline: string;
  rulesVersion: 'BB2025' | 'legacy';
}

function rulesVersion(game: GameJson | null | undefined): string {
  return String(game?.gameOptions?.gameOptionArray
    ?.find((option) => option.gameOptionId === 'rulesVersion')?.gameOptionValue ?? '')
    .trim().toUpperCase();
}

/** Rules-scoped Swoop decision copy. BB2025 is the current/default ruleset and explicitly grants a reroll of
 * the Right Stuff landing test. Older rulesets keep neutral legacy copy rather than inheriting that guarantee. */
export function swoopChoiceCopy(
  game: GameJson | null | undefined,
  skill: unknown,
): SwoopChoiceCopy | null {
  if (String(skill ?? '').trim().toLowerCase() !== 'swoop') return null;
  const version = rulesVersion(game);
  if (version === 'BB2016' || version === 'BB2020') {
    return {
      title: 'Use Swoop?',
      body: 'Choose Swoop or continue with the normal scatter.',
      accept: 'Swoop',
      decline: 'Scatter Normally',
      rulesVersion: 'legacy',
    };
  }
  return {
    title: 'Use Swoop instead of scattering normally?',
    body: 'Swoop may reroll the Right Stuff landing test.',
    accept: 'Swoop',
    decline: 'Scatter Normally',
    rulesVersion: 'BB2025',
  };
}

/** BB2025 Swoop distance with the default game option: a d6, so six possible squares. */
export const SWOOP_PATH_MAX_SQUARES = 6;

/** One square of a Swoop possible path. `outOfBounds`: past the end zone / sideline - that distance result ends with
 * the player in the crowd, so the renderer draws an X in the tile. */
export interface SwoopPathSquare {
  square: [number, number];
  outOfBounds: boolean;
}

const SWOOP_DIRECTION_DELTAS: Readonly<Record<string, readonly [number, number]>> = {
  NORTH: [0, -1], NORTHEAST: [1, -1], EAST: [1, 0], SOUTHEAST: [1, 1],
  SOUTH: [0, 1], SOUTHWEST: [-1, 1], WEST: [-1, 0], NORTHWEST: [-1, -1],
};
const D6_DISTANCES: readonly number[] = [1, 2, 3, 4, 5, 6];
/** Upstream PlayerState.IN_THE_AIR: the server has started the swoop flight (StepInitScatterPlayer). */
const PLAYER_STATE_IN_THE_AIR = 0x15;

const onPitch = (x: number, y: number) => x >= 0 && x <= 25 && y >= 0 && y <= 14;

/** The possible swoop distances, from the server's game option (StepInitScatterPlayer.swoop, GameOptionId
 * SWOOP_DISTANCE): 0 or absent = a d6 (1..6); N > 0 = the fixed distance N only. */
export function swoopDistanceOutcomes(game: GameJson | null | undefined): number[] {
  const raw = game?.gameOptions?.gameOptionArray?.find((option) => option.gameOptionId === 'swoopDistance')?.gameOptionValue;
  const fixed = Number.parseInt(String(raw ?? '0'), 10);
  return Number.isFinite(fixed) && fixed > 0 ? [fixed] : [...D6_DISTANCES];
}

/** The squares from `from` along one direction at each possible distance (default the d6's 1..6); squares past the
 * pitch edge are kept and flagged. */
export function swoopLinePreview(
  from: readonly [number, number],
  delta: readonly [number, number],
  distances: readonly number[] = D6_DISTANCES,
): SwoopPathSquare[] {
  const [dx, dy] = delta;
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return [];
  return [...distances].sort((a, b) => a - b).map((distance) => {
    const x = from[0] + dx * distance;
    const y = from[1] + dy * distance;
    return { square: [x, y] as [number, number], outOfBounds: !onPitch(x, y) };
  });
}

/** Owner 10-19 (Punt-style aim preview for Swoop, the PICK): one line per SERVER-OFFERED cardinal square (StepSwoop's
 * moveSquareArray via UtilServerPlayerSwoop), marking every possible distance. Squares on the pitch are path marks;
 * every square past the end zone / sideline is still drawn, flagged out of bounds. Directions come only from the
 * offered squares; anything not cardinally adjacent to `from` is ignored. */
export function swoopPathPreview(
  from: [number, number] | null | undefined,
  offers: readonly (readonly [number, number])[],
  distances: readonly number[] = D6_DISTANCES,
): SwoopPathSquare[][] {
  if (!from) return [];
  const paths: SwoopPathSquare[][] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    const dx = offer[0] - from[0];
    const dy = offer[1] - from[1];
    if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
    const key = `${dx},${dy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push(swoopLinePreview(from, [dx, dy], distances));
  }
  return paths;
}

const SWOOP_ROLL_REROLLED_ACTIONS = new Set(['Swoop Direction', 'Swoop Distance']);

/** Owner 10-19 (g1060): between the direction result and the flight the server parks a reroll offer for the swooping
 * player (reRolledAction "Swoop Direction", then "Swoop Distance"). The rolled direction is server truth: the
 * Swoop Direction indicator square (MoveSquare at from + direction, StepSwoop / SwoopBehaviour) or, once the distance
 * marker has replaced it, the swoopDirectionRoll report's direction for that player.
 * Null outside that window, and also (Astra P2) once this seat has ANSWERED that offer (`answered`: the server keeps the
 * dialog until its next step) or the flight has started (the swooper is IN_THE_AIR: the throwTeamMate frame #163 sets
 * it while the dialog stays up until #165). */
export function swoopRolledDirection(
  game: GameJson | null | undefined,
  reportedDirection: { playerId: string; direction: string } | null | undefined,
  answered = false,
): [number, number] | null {
  const acting = game?.actingPlayer as { playerId?: string | null; playerAction?: string | null } | undefined;
  const actingId = String(acting?.playerId ?? '');
  if (!game || answered || !actingId || String(acting?.playerAction ?? '') !== 'swoop') return null;
  const dialog = game.dialogParameter as { dialogId?: string; playerId?: string; reRolledAction?: string } | null | undefined;
  if (String(dialog?.dialogId ?? '') !== 'reRollProperties' || String(dialog?.playerId ?? '') !== actingId
      || !SWOOP_ROLL_REROLLED_ACTIONS.has(String(dialog?.reRolledAction ?? ''))) return null;
  const swooper = (game.fieldModel?.playerDataArray ?? []).find((d) => d.playerId === actingId);
  const from = swooper?.playerCoordinate;
  if (!from || ((swooper?.playerState ?? 0) & 0xff) === PLAYER_STATE_IN_THE_AIR) return null;
  if (dialog?.reRolledAction === 'Swoop Direction') {
    const markers = ((game.fieldModel as { moveSquareArray?: { coordinate?: [number, number] }[] }).moveSquareArray ?? [])
      .map((m) => m.coordinate).filter((c): c is [number, number] => Array.isArray(c));
    if (markers.length === 1) {
      const dx = markers[0]![0] - from[0];
      const dy = markers[0]![1] - from[1];
      if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) return [dx, dy];
    }
  }
  if (reportedDirection?.playerId !== actingId) return null;
  const delta = SWOOP_DIRECTION_DELTAS[String(reportedDirection.direction).replace(/[^a-z]/gi, '').toUpperCase()];
  return delta ? [delta[0], delta[1]] : null;
}

/** The Swoop reroll window the server has parked for the acting swooper ("Swoop Direction" / "Swoop Distance"), or
 * null: not swooping, another dialog, this seat already answered it, or the flight has started (IN_THE_AIR). */
export function swoopRerollWindow(
  game: GameJson | null | undefined,
  answered = false,
): 'Swoop Direction' | 'Swoop Distance' | null {
  const acting = game?.actingPlayer as { playerId?: string | null; playerAction?: string | null } | undefined;
  const actingId = String(acting?.playerId ?? '');
  if (!game || answered || !actingId || String(acting?.playerAction ?? '') !== 'swoop') return null;
  const dialog = game.dialogParameter as { dialogId?: string; playerId?: string; reRolledAction?: string } | null | undefined;
  const action = String(dialog?.reRolledAction ?? '');
  if (String(dialog?.dialogId ?? '') !== 'reRollProperties' || String(dialog?.playerId ?? '') !== actingId
      || !SWOOP_ROLL_REROLLED_ACTIONS.has(action)) return null;
  const swooper = (game.fieldModel?.playerDataArray ?? []).find((d) => d.playerId === actingId);
  if (!swooper?.playerCoordinate || ((swooper.playerState ?? 0) & 0xff) === PLAYER_STATE_IN_THE_AIR) return null;
  return action as 'Swoop Direction' | 'Swoop Distance';
}

/** Owner 10-19 ("Roll 2 = Distance: destination marker should be drawn here with the reroll prompt at the location"):
 * the server's swoop end square while the Swoop Distance reroll is offered. Server truth = the swoopPlayer report
 * (start must be the swooper's square), cross-checked with the single move square the server adds on the end square
 * when it is on the pitch (StepInitScatterPlayer: MoveSquare at lastValidCoordinate). Out of bounds: the report's
 * off-pitch end square, flagged (drawn as the red X), only when no move square is live. A disagreeing report and move
 * square draw nothing; an on-pitch report with no move square draws nothing (the server always adds one). */
export function swoopDistanceDestination(
  game: GameJson | null | undefined,
  from: readonly [number, number] | null,
  report: { start: [number, number]; end: [number, number]; outOfBounds: boolean } | null | undefined,
): SwoopPathSquare | null {
  if (!game || !from) return null;
  const markers = ((game.fieldModel as { moveSquareArray?: { coordinate?: [number, number] }[] } | undefined)?.moveSquareArray ?? [])
    .map((m) => m.coordinate).filter((c): c is [number, number] => Array.isArray(c));
  const marker = markers.length === 1 ? markers[0]! : null;
  const fresh = report && report.start[0] === from[0] && report.start[1] === from[1] ? report : null;
  // Astra P3: the live move square is the current server truth. With one present, a report is accepted only when it
  // names that very square (a retained [15,8]->[28,8] report never overrides a current [21,8] marker); an off-pitch
  // report is accepted only when no move square contradicts it.
  if (marker) {
    if (!onPitch(marker[0], marker[1])) return null;
    if (fresh && (fresh.outOfBounds || fresh.end[0] !== marker[0] || fresh.end[1] !== marker[1])) return null;
    return { square: [marker[0], marker[1]], outOfBounds: false };
  }
  if (!fresh) return null;
  const [x, y] = fresh.end;
  return fresh.outOfBounds || !onPitch(x, y) ? { square: [x, y], outOfBounds: true } : null;
}

export interface SwoopIndicatorInputs {
  /** The live server model. */
  game: GameJson | null | undefined;
  /** Seat gates: playing with Order 66 on, and this seat controls the acting player. */
  coaching: boolean;
  /** The acting player's square (null when off the pitch). */
  from: [number, number] | null;
  /** The swoopDirectionRoll report direction (store `ballDirection`). */
  reportedDirection: { playerId: string; direction: string } | null | undefined;
  /** The swoopPlayer report (store `swoopDestination`). */
  reportedDestination?: { start: [number, number]; end: [number, number]; outOfBounds: boolean } | null;
  /** This seat already answered the live dialog occurrence. */
  dialogAnswered: boolean;
  /** Client state is SWOOP. */
  swoopState: boolean;
  /** A reroll card is up for this seat. */
  reRollPromptUp: boolean;
  /** The validated Swoop coordinate offers (swoopCoordinateSquares). */
  offers: readonly (readonly [number, number])[];
  /** A throwTeamMate flight cue for the acting player is on screen. */
  flightCueForActing: boolean;
}

export interface SwoopIndicator {
  from: [number, number];
  /** Chevron paths (the pick, and the Swoop Direction window). */
  paths: SwoopPathSquare[][];
  /** The Swoop Distance window: the server's end square (marker / red X), also the reroll card's anchor. */
  destination: SwoopPathSquare | null;
}

/** The view's whole Swoop indicator gate (SpectateView feeds it reactive state). Three server-derived windows:
 *  - the PICK: SWOOP state, StepSwoop's cardinal offers live (>= 2), no reroll card up - one chevron path per offer;
 *  - Roll 1, the Swoop Direction reroll offer: the chevron path along the rolled direction;
 *  - Roll 2, the Swoop Distance reroll offer: NO path - the destination marker on the server's end square.
 * Both roll windows end once this seat has answered the offer or the flight has started. Paths mark the possible
 * distances of the server's swoopDistance option. Null = cleared. */
export function swoopIndicator(inputs: SwoopIndicatorInputs): SwoopIndicator | null {
  const { game, from } = inputs;
  if (!game || !inputs.coaching || !from || inputs.flightCueForActing) return null;
  const window = swoopRerollWindow(game, inputs.dialogAnswered);
  if (window === 'Swoop Distance') {
    const destination = swoopDistanceDestination(game, from, inputs.reportedDestination);
    return destination ? { from, paths: [], destination } : null;
  }
  const distances = swoopDistanceOutcomes(game);
  if (window === 'Swoop Direction') {
    const rolled = swoopRolledDirection(game, inputs.reportedDirection, inputs.dialogAnswered);
    return rolled ? { from, paths: [swoopLinePreview(from, rolled, distances)], destination: null } : null;
  }
  if (!inputs.swoopState || inputs.reRollPromptUp || inputs.offers.length < 2) return null;
  const paths = swoopPathPreview(from, inputs.offers, distances);
  return paths.length ? { from, paths, destination: null } : null;
}
