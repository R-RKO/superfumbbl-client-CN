// Owner 10-16: the Luck chart - a subpane opened from the Luck popover that plots each team's NET LUCK turn by turn
// (lucky breaks minus bad breaks in that team turn: above the axis lucky, below unlucky) as a DASHED line, and the
// running average of that net value over the team turns played so far (cumulative net / team turns played) as a SOLID
// line - the team's overall luck trend. Pure: drawn from the breaks the tallies already hold (luckBreaks.ts), so a
// replay seek or pause draws the same chart. Inline SVG, no chart library.
//
// THE X AXIS is the team turns in play order: in each half, one tick per team turn started (BreakEntry.slot: the team
// turns started in the half before the one in progress), labelled with the turn number, and a thin divider between
// halves (overtime when it was played). A half the game has moved past is drawn whole (16 team turns); the half in
// progress up to the team turn under way.

import type { BreakEntry, LuckBreaks } from './luckBreaks';
import type { CutShortEntry } from './turnsCutShort';
import { pgBreakLine, pgCutShortLine } from './postGameProjection';
/** A chart entry: a break (lucky +1 / bad -1, listed once from the lucky side), or a turn cut short (owner 10-16:
 *  minus its cost, one-sided, listed for its own team). */
type ChartEntry = BreakEntry & { weight?: number; oneSided?: string };

export type LuckSide = 'home' | 'away';
export interface LuckChartSlot {
  half: number; slot: number; label: string;
  /** Centre of the column, and the column's left edge and width (the hover / focus target). */
  x: number; left: number; width: number;
  /** Net luck per team in this team turn. */
  net: Record<LuckSide, number>;
  /** Its breaks, each once (home's view: a home lucky break or an away lucky break), in the story popover's format. */
  lines: { side: LuckSide; text: string }[];
}
export interface LuckChartSeries { side: LuckSide; kind: 'turn' | 'average'; values: number[]; points: string; label: string }
export interface LuckChart {
  width: number; height: number;
  plot: { left: number; right: number; top: number; bottom: number; zero: number };
  slots: LuckChartSlot[];
  /** x of the divider before each half after the first. */
  dividers: number[];
  yTicks: { y: number; label: string }[];
  series: LuckChartSeries[];
  /** No break in the game yet. */
  empty: boolean;
}

export const LUCK_CHART_W = 600;
export const LUCK_CHART_H = 220;
const PAD = { left: 30, right: 8, top: 12, bottom: 26 };
/** 16 team turns in a regulation half (8 each). */
const HALF_SLOTS = 16;

const key = (half: number, slot: number) => `${half}|${slot}`;

/**
 * The chart for the two teams' breaks. `clock` = the game's half and the team turns each side has started in it (the
 * model's turnData), null when unknown (the axis then runs to the last break). `names` label the series.
 */
export function luckChart(home: LuckBreaks | null, away: LuckBreaks | null, clock: { half: number; turnHome: number; turnAway: number } | null,
  names: Record<LuckSide, string>, cut: Partial<Record<LuckSide, readonly CutShortEntry[]>> = {}): LuckChart {
  // owner 10-16: a turn cut short counts against its team's net in that turn (minus its cost)
  const cutEntries = (side: LuckSide): ChartEntry[] => (cut[side] ?? []).map((e) => ({ seq: e.seq, label: e.label, player: e.player, playerName: e.playerName, half: e.half, slot: e.slot,
    turn: e.turn, p: 1, lucky: false, col: e.col, after: e.after, weight: e.cost, oneSided: pgCutShortLine(e) }));
  const logs: Record<LuckSide, ChartEntry[]> = { home: [...(home?.log ?? []), ...cutEntries('home')], away: [...(away?.log ?? []), ...cutEntries('away')] };
  const all = [...logs.home, ...logs.away].filter((e) => e.half >= 1);
  const played = (home?.played?.length ?? 0) >= (away?.played?.length ?? 0) ? home?.played ?? [] : away?.played ?? [];
  // (Astra chart r6: a break before the first played turn - the opening kick-off - needs the played-turn axis too)
  if (played.length > 0 || all.some((e) => extraKey(e) != null)) return draw(fromPlayed(played, all), logs, names, all.length === 0);
  const lastHalf = Math.max(clock && clock.half >= 1 ? clock.half : 1, ...all.map((e) => e.half));
  const slots: LuckChartSlot[] = [];
  const dividerAt: number[] = [];
  for (let half = 1; half <= lastHalf; half++) {
    const seen = Math.max(0, ...all.filter((e) => e.half === half).map((e) => e.slot + 1));
    const started = clock && clock.half === half ? Math.max(0, clock.turnHome + clock.turnAway) : half < lastHalf ? HALF_SLOTS : 0;
    const count = Math.max(seen, half < lastHalf ? Math.max(HALF_SLOTS, started) : started, half === 1 ? 1 : 0);
    if (half > 1 && count > 0) dividerAt.push(slots.length);
    for (let slot = 0; slot < count; slot++) {
      slots.push({ half, slot, label: String(Math.floor(slot / 2) + 1), x: 0, left: 0, width: 0, net: { home: 0, away: 0 }, lines: [] });
    }
  }
  return draw(slots.map((s, i) => ({ ...s, divider: dividerAt.includes(i) })), logs, names, all.length === 0);
}
type AxisSlot = LuckChartSlot & { divider?: boolean; played?: number; extra?: string };
/** Astra chart r1: the axis from the team turns actually played (and any turn a break fell in), in play order. */
function fromPlayed(played: readonly { half: number; slot: number; turn: number }[], all: readonly BreakEntry[]): AxisSlot[] {
  // one column per turn played, in the order played (Astra chart r3: never merged by slot - a backward Time-out
  // repeats one)
  const cols: AxisSlot[] = played.map((p, i) => ({ half: p.half, slot: p.slot, label: String(p.turn), x: 0, left: 0, width: 0, net: { home: 0, away: 0 }, lines: [], played: i }));
  // Astra chart r4: a break in a slot no regular-play frame ended in (a recovery roll at a kick-off after an out-of-turn
  // touchdown ...) gets a column of its own, after the last column before it in play order
  // (Astra chart r5: placed by how many turns had been played when it happened - `after` - never by slot alone, so a
  // slot played later does not absorb it)
  const known = new Set(played.map((p) => key(p.half, p.slot)));
  const extra = new Map<string, BreakEntry>();
  const first = (k: string, e: BreakEntry) => { const had = extra.get(k); if (!had || Math.abs(e.seq) < Math.abs(had.seq)) extra.set(k, e); };
  for (const e of all) {
    const k = extraKey(e);
    if (k) first(k, e);
    else if (e.col == null && !known.has(key(e.half, e.slot))) first(key(e.half, e.slot), e);
  }
  // Astra chart r6: in the order they happened (the event index), never by slot number alone
  const list = [...extra.entries()].sort(([, a], [, b]) => (a.after ?? 0) - (b.after ?? 0) || Math.abs(a.seq) - Math.abs(b.seq));
  for (const [k, e] of list) {
    let at = 0;
    if (e.after != null) { const before = cols.findIndex((c) => c.played === e.after); at = before < 0 ? cols.length : before; }
    else cols.forEach((c, i) => { if (c.half < e.half || (c.half === e.half && c.slot < e.slot)) at = i + 1; });
    // a break before any played turn of its half (a kick-off) reads "Kick-off"
    const kickoff = !cols.slice(0, at).some((c) => c.half === e.half && c.played != null);
    cols.splice(at, 0, { half: e.half, slot: e.slot, label: kickoff ? 'Kick-off' : String(e.turn), x: 0, left: 0, width: 0, net: { home: 0, away: 0 }, lines: [], extra: k });
  }
  cols.forEach((c, i) => { c.divider = i > 0 && cols[i - 1]!.half !== c.half; });
  return cols;
}
/** A break that fell outside the played turns: its own column's key. */
function extraKey(e: BreakEntry): string | null { return e.col == null && e.after != null ? `${e.after}|${e.half}|${e.slot}` : null; }
function draw(slots: AxisSlot[], logs: Record<LuckSide, ChartEntry[]>, names: Record<LuckSide, string>, empty: boolean): LuckChart {
  // a key maps to its LAST column; a break that knows its column (and still matches it) goes there
  const at = new Map(slots.map((s, i) => [key(s.half, s.slot), i] as const));
  const byPlayed = new Map(slots.flatMap((s, i) => (s.played != null ? [[s.played, i] as const] : [])));
  for (const side of ['home', 'away'] as const) {
    for (const e of logs[side]) {
      const c = e.col != null ? byPlayed.get(e.col) : undefined;
      const own = c != null && slots[c]!.half === e.half && slots[c]!.slot === e.slot ? c : null;
      const xk = extraKey(e);
      const ex = xk ? slots.findIndex((s) => s.extra === xk) : -1;
      const i = own ?? (ex >= 0 ? ex : xk ? null : at.get(key(e.half, e.slot)) ?? null);
      if (i == null) continue;
      slots[i]!.net[side] += (e.lucky ? 1 : -1) * (e.weight ?? 1);
      // each break sits in both logs (lucky in one, bad in the other): list it from the lucky side only
      if (e.oneSided) slots[i]!.lines.push({ side, text: `${names[side]}: ${e.oneSided}` });
      else if (e.lucky) slots[i]!.lines.push({ side, text: `${names[side]}: ${pgBreakLine(e)}` });
    }
  }
  const plot = { left: PAD.left, right: LUCK_CHART_W - PAD.right, top: PAD.top, bottom: LUCK_CHART_H - PAD.bottom, zero: 0 };
  const step = (plot.right - plot.left) / Math.max(1, slots.length);
  slots.forEach((s, i) => { s.left = plot.left + step * i; s.width = step; s.x = s.left + step / 2; });
  const dividerXs = slots.flatMap((s, i) => (s.divider ? [plot.left + step * i] : []));
  // Astra chart r7: the average divides by the TURNS PLAYED so far - an off-turn column (a kick-off break) is not one
  // (an axis read from the turn markers alone counts every column)
  const isTurn = slots.map((s) => s.extra == null);
  for (const s of slots) { delete s.divider; delete s.played; delete s.extra; }
  const values: Record<LuckSide, { turn: number[]; average: number[] }> = { home: { turn: [], average: [] }, away: { turn: [], average: [] } };
  for (const side of ['home', 'away'] as const) {
    let sum = 0, turns = 0;
    slots.forEach((s, i) => { sum += s.net[side]; if (isTurn[i]) turns += 1; values[side].turn.push(s.net[side]); values[side].average.push(sum / Math.max(1, turns)); });
  }
  const peak = Math.max(1, ...(['home', 'away'] as const).flatMap((side) => [...values[side].turn, ...values[side].average].map(Math.abs)));
  const top = Math.ceil(peak);
  plot.zero = (plot.top + plot.bottom) / 2;
  const scale = (plot.bottom - plot.top) / 2 / top;
  const y = (v: number) => plot.zero - v * scale;
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  const series: LuckChartSeries[] = [];
  for (const side of ['home', 'away'] as const) {
    for (const kind of ['turn', 'average'] as const) {
      const vals = values[side][kind];
      series.push({ side, kind, values: vals, points: vals.map((v, i) => `${fmt(slots[i]!.x)},${fmt(y(v))}`).join(' '), label: `${names[side]} ${kind === 'turn' ? 'per turn' : 'average'}` });
    }
  }
  return {
    width: LUCK_CHART_W, height: LUCK_CHART_H, plot, slots,
    dividers: dividerXs,
    yTicks: [top, 0, -top].map((v) => ({ y: y(v), label: v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0' })),
    series, empty,
  };
}
