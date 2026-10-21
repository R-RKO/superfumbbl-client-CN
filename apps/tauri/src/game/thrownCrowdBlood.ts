import { isCrowdSquare, thrownCrowdLanding, type BloodSpotRelocation } from '@fumbbl40k/ffb-pitch';
import { injuryTypeName } from './casualtyRollProjection';

/**
 * Owner 10-20 ("Blood splatter should go on the outside sideline square"): which server blood spots belong to a thrown /
 * kicked / swooping team-mate's CROWD injury, and the crowd square each is drawn on instead (renderer bloodDecalSpots).
 *
 * The server names the LAST IN-BOUNDS square (the flight animation's endCoordinate) for that spot (g1954978 #1443:
 * fieldModelAddBloodSpot [9,14]); his crowd square is the one his flight's report put him on (crowdSurf.ts
 * thrownCrowdLanding: [8,15]). A pure fold over the command stream, so the live applier and the spectator checkpoint
 * (durable: playback, seek and return-to-live agree, Astra P2-1 10-20) derive the same list:
 *   1. a swoopPlayer report is remembered for the flight that follows it (the Swoop Distance window sits between);
 *   2. a throwTeamMate / kickTeamMate animation with an off-pitch report square records the flight (FLIGHT_AGE frames);
 *   3. his crowd injury (an `injury` report of a crowd type with no `pushback` naming him) turns it into an EXIT
 *      (EXIT_AGE frames: the removal can wait behind an apothecary offer, #1442 -> #1443);
 *   4. each fieldModelAddBloodSpot (appended to bloodspotArray in wire order: index = count before + its rank) on an
 *      exit's last in-bounds square - carrying his injury result, when the report named one (Astra P2-4: a second
 *      spot on that square, e.g. a KO, is not his) - becomes a relocation of THAT spot, and the exit is spent.
 * Presentation only: the model is never changed.
 */
export interface ThrownCrowdProjection {
  swoop: { start: [number, number]; end: [number, number]; outOfBounds: boolean } | null;
  flights: { playerId: string; from: [number, number]; to: [number, number]; age: number }[];
  /** `injury` = his injury report's result (the PlayerState its blood spot carries), null when it names none. */
  exits: { playerId: string; from: [number, number]; to: [number, number]; injury: number | null; age: number }[];
  relocations: BloodSpotRelocation[];
}
const FLIGHT_AGE = 3;
const EXIT_AGE = 12;

export function createThrownCrowdProjection(): ThrownCrowdProjection {
  return { swoop: null, flights: [], exits: [], relocations: [] };
}

const square = (value: unknown): [number, number] | null =>
  Array.isArray(value) && value.length >= 2 && Number.isInteger(value[0]) && Number.isInteger(value[1]) ? [value[0] as number, value[1] as number] : null;
const onPitch = (sq: readonly number[] | null): sq is [number, number] => !!sq && sq[0]! >= 0 && sq[0]! < 26 && sq[1]! >= 0 && sq[1]! < 15;
const same = (a: readonly number[] | null, b: readonly number[] | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

/** `bloodSpotsBefore` = bloodspotArray.length before this command applied. */
export function reduceThrownCrowdProjection(
  previous: ThrownCrowdProjection,
  command: Record<string, unknown> | null | undefined,
  bloodSpotsBefore: number,
): ThrownCrowdProjection {
  if (!command) return previous;
  const reports = ((command.reportList as { reports?: Record<string, unknown>[] } | null | undefined)?.reports ?? []);
  const changes = ((command.modelChangeList as { modelChangeArray?: { modelChangeId?: string; modelChangeValue?: unknown }[] } | null | undefined)?.modelChangeArray ?? []);
  const animation = command.animation as { animationType?: unknown; thrownPlayerId?: unknown; startCoordinate?: unknown; endCoordinate?: unknown } | null | undefined;
  const flightAnim = !!animation && ['throwTeamMate', 'kickTeamMate'].includes(String(animation.animationType ?? '')) && animation.thrownPlayerId != null;
  const touches = flightAnim || reports.length > 0 || changes.some((c) => c.modelChangeId === 'fieldModelAddBloodSpot');
  if (!touches && previous.flights.length === 0 && previous.exits.length === 0) return previous;
  let swoop = previous.swoop;
  let flights = previous.flights.map((f) => ({ ...f, age: f.age + 1 })).filter((f) => f.age <= FLIGHT_AGE);
  let exits = previous.exits.map((e) => ({ ...e, age: e.age + 1 })).filter((e) => e.age <= EXIT_AGE);
  const swoopReport = reports.find((report) => String(report.reportId) === 'swoopPlayer');
  if (swoopReport) {
    const start = square(swoopReport.startCoordinate), end = square(swoopReport.endCoordinate);
    if (start && end) swoop = { start, end, outOfBounds: swoopReport.outOfBounds === true };
  }
  if (flightAnim) {
    const id = String(animation!.thrownPlayerId);
    const priorSwoop = swoop;
    swoop = null; // consumed by this flight
    const end = square(animation!.endCoordinate);
    flights = flights.filter((f) => f.playerId !== id);
    if (onPitch(end)) {
      const start = square(animation!.startCoordinate);
      const crowd = thrownCrowdLanding(end, reports, priorSwoop && same(priorSwoop.start, start) ? priorSwoop : null);
      if (crowd) flights.push({ playerId: id, from: end, to: crowd, age: 0 });
    }
  }
  for (const report of reports) {
    const id = String(report.defenderId ?? report.playerId ?? '');
    if (!id || String(report.reportId) !== 'injury' || !injuryTypeName(report.injuryType).toLowerCase().includes('crowd')) continue;
    if (reports.some((other) => String(other.reportId) === 'pushback' && String(other.defenderId ?? '') === id)) continue;
    const flight = flights.find((f) => f.playerId === id);
    const injury = Number.isFinite(Number(report.injury)) && report.injury != null ? Number(report.injury) & 0xff : null;
    if (flight) exits = [...exits.filter((e) => e.playerId !== id), { playerId: id, from: flight.from, to: flight.to, injury, age: 0 }];
  }
  let relocations = previous.relocations;
  let rank = 0;
  for (const change of changes) {
    if (change.modelChangeId !== 'fieldModelAddBloodSpot') continue;
    const index = bloodSpotsBefore + rank++;
    const value = change.modelChangeValue as { coordinate?: unknown; injury?: unknown } | null;
    const at = square(value?.coordinate);
    const base = Number.isFinite(Number(value?.injury)) ? Number(value?.injury) & 0xff : null;
    const exit = exits.find((e) => same(e.from, at) && (e.injury === null || e.injury === base));
    if (!exit || !isCrowdSquare(exit.to)) continue;
    relocations = [...relocations, { index, from: [exit.from[0], exit.from[1]], to: [exit.to[0], exit.to[1]] }];
    exits = exits.filter((e) => e !== exit);
  }
  return { swoop, flights, exits, relocations };
}

/** Checkpoint validation of the projection's shape. */
export function validThrownCrowdProjection(value: unknown): value is ThrownCrowdProjection {
  const sq = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger);
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!object(value) || Object.keys(value).sort().join(',') !== 'exits,flights,relocations,swoop') return false;
  const swoop = value.swoop;
  if (swoop !== null && !(object(swoop) && sq(swoop.start) && sq(swoop.end) && typeof swoop.outOfBounds === 'boolean')) return false;
  const leg = (v: unknown) => object(v) && typeof v.playerId === 'string' && sq(v.from) && sq(v.to) && Number.isSafeInteger(v.age);
  const exit = (v: unknown) => leg(v) && (((v as { injury?: unknown }).injury === null) || Number.isSafeInteger((v as { injury?: unknown }).injury));
  if (!Array.isArray(value.flights) || !value.flights.every(leg) || !Array.isArray(value.exits) || !value.exits.every(exit)) return false;
  return Array.isArray(value.relocations) && value.relocations.every((r) => object(r) && Number.isSafeInteger(r.index) && sq(r.from) && sq(r.to));
}
