import { fieldDeltaOnScreen, type Orientation } from '@fumbbl40k/ffb-pitch';

/**
 * Owner 10-15 ("represent the relative direction to the viewer's perspective"): direction-bearing log lines (scatter,
 * kick-off scatter, throw-in, deviate, punt, swoop, placed ball, Ball & Chain) show the direction as the viewer sees it
 * on screen - an arrow and a word - computed at RENDER time from the stored field direction, so the line follows a
 * projection change (orientation, the user's pitch flip, the spectator drive-north flip). The stored text keeps the
 * field direction ("NE (field)"), so replays and bug-report text logs stay deterministic.
 *
 * Direction names are the server's (upstream Direction: North / Northeast / ... / Northwest), already turned into the
 * reading client's own field frame by the report's transform(), the same frame the renderer draws the field in.
 */
export const FIELD_DIRECTIONS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'] as const;
export type FieldDirection = (typeof FIELD_DIRECTIONS)[number];

/** Game-coordinate step of each direction (the inverse of upstream FieldCoordinate.getDirection: y grows south). */
export const FIELD_DIRECTION_DELTA: Readonly<Record<FieldDirection, [number, number]>> = {
  North: [0, -1], Northeast: [1, -1], East: [1, 0], Southeast: [1, 1],
  South: [0, 1], Southwest: [-1, 1], West: [-1, 0], Northwest: [-1, -1],
};
/** Compact field notation for the stored / bug-report text. */
export const FIELD_DIRECTION_ABBR: Readonly<Record<FieldDirection, string>> = {
  North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SW', West: 'W', Northwest: 'NW',
};

export function isFieldDirection(value: unknown): value is FieldDirection {
  return typeof value === 'string' && (FIELD_DIRECTIONS as readonly string[]).includes(value);
}

/** Screen arrow + word for a field direction under a projection. Null for an unknown name. */
export function screenDirection(field: unknown, orientation: Orientation, flipped: boolean): { arrow: string; word: string } | null {
  if (!isFieldDirection(field)) return null;
  const [dx, dy] = FIELD_DIRECTION_DELTA[field];
  const { right, up } = fieldDeltaOnScreen(dx, dy, orientation, flipped);
  const h = Math.sign(right), v = Math.sign(up);
  const table: Record<string, { arrow: string; word: string }> = {
    '0,1': { arrow: '↑', word: 'up' }, '1,1': { arrow: '↗', word: 'up-right' }, '1,0': { arrow: '→', word: 'right' },
    '1,-1': { arrow: '↘', word: 'down-right' }, '0,-1': { arrow: '↓', word: 'down' }, '-1,-1': { arrow: '↙', word: 'down-left' },
    '-1,0': { arrow: '←', word: 'left' }, '-1,1': { arrow: '↖', word: 'up-left' },
  };
  return table[`${h},${v}`] ?? null;
}

/** "↗ up-right" for the view; the stored field form when the name is unknown. */
export function screenDirectionText(field: unknown, orientation: Orientation, flipped: boolean): string {
  const dir = screenDirection(field, orientation, flipped);
  return dir ? `${dir.arrow} ${dir.word}` : String(field ?? '?');
}
