/**
 * Controller support P2b (owner round 2, spec-controller-support.md): the setup pad shortcuts as pure decisions.
 *  - D-pad left / right cycles my players (reserves, then placed) — crosshair.cycle over crosshairCycleOrder.
 *  - LB: place the current player on the next free line-of-scrimmage square, centre outward.
 *  - RB: send the current (placed) player to the reserves.
 * The view sends both through the existing setup wire (gameStore.setupPlace / setupRemove); the server validates.
 * Coordinates are the setup surface's own (home-relative: my half is x 0..12, the line of scrimmage is x = 12).
 */
export type SetupSquare = [number, number];
export interface PadSetupPlayer { playerId: string; coord: SetupSquare | null; inert?: boolean }

export const SETUP_LOS_COLUMN = 12;
/** Line-of-scrimmage rows, centre outward (7, 6, 8, 5, 9, …). */
export const LOS_ROWS_CENTRE_OUT: readonly number[] = (() => {
  const rows = [7];
  for (let d = 1; d <= 7; d++) rows.push(7 - d, 7 + d);
  return rows;
})();

/** The next free line-of-scrimmage square, centre outward; null when the line is full. `reserved` = squares a
 *  placement already sent is about to fill (the server echo has not landed yet). */
export function nextFreeLosSquare(players: readonly PadSetupPlayer[], reserved: readonly SetupSquare[] = []): SetupSquare | null {
  const taken = new Set([...players.filter((p) => p.coord).map((p) => p.coord!), ...reserved].map((c) => `${c[0]},${c[1]}`));
  for (const row of LOS_ROWS_CENTRE_OUT) {
    if (!taken.has(`${SETUP_LOS_COLUMN},${row}`)) return [SETUP_LOS_COLUMN, row];
  }
  return null;
}

export type PadSetupDecision =
  | { kind: 'place'; playerId: string; square: SetupSquare }
  | { kind: 'remove'; playerId: string }
  | { kind: 'none'; reason: 'no-player' | 'inert' | 'line-full' | 'already-on-line' | 'already-reserve' };

/** LB on the current player: a reserve or a player standing off the line moves to the next free LOS square. */
export function padSetupPlaceDecision(players: readonly PadSetupPlayer[], currentId: string | null, pending: PendingSnapshot = { players: new Set(), squares: [] }): PadSetupDecision {
  const p = currentId ? players.find((x) => x.playerId === currentId) : undefined;
  if (!p) return { kind: 'none', reason: 'no-player' };
  if (p.inert) return { kind: 'none', reason: 'inert' };
  if (pending.players.has(p.playerId) || (p.coord && p.coord[0] === SETUP_LOS_COLUMN)) return { kind: 'none', reason: 'already-on-line' };
  const square = nextFreeLosSquare(players, pending.squares);
  return square ? { kind: 'place', playerId: p.playerId, square } : { kind: 'none', reason: 'line-full' };
}

/** RB on the current player: a placed player goes back to the reserves. */
export function padSetupReserveDecision(players: readonly PadSetupPlayer[], currentId: string | null): PadSetupDecision {
  const p = currentId ? players.find((x) => x.playerId === currentId) : undefined;
  if (!p) return { kind: 'none', reason: 'no-player' };
  if (p.inert) return { kind: 'none', reason: 'inert' };
  if (!p.coord) return { kind: 'none', reason: 'already-reserve' };
  return { kind: 'remove', playerId: p.playerId };
}

/** Astra P2-6 / P2-d: placements sent but not yet echoed. Coordinates come from the server echo, so a rapid second LB
 *  would otherwise pick the same square. The SQUARE stays reserved until the server shows the player there (echo),
 *  shows the player somewhere else / back in reserves after the send (a roster change), drops the player, or the coach
 *  sends that player elsewhere (RB / another LB: `drop`). Time never un-reserves a square; PENDING_PLACEMENT_MS only
 *  ends the PLAYER's "on its way" state, so a refused placement can be re-sent. */
export const PENDING_PLACEMENT_MS = 3000;
export interface PendingSnapshot {
  /** Players whose placement is still on its way (not yet echoed, within PENDING_PLACEMENT_MS). */
  players: ReadonlySet<string>;
  /** Squares reserved by sent placements. */
  squares: SetupSquare[];
}
export interface PendingPlacements {
  current(players: readonly PadSetupPlayer[]): PendingSnapshot;
  add(playerId: string, square: SetupSquare, from: SetupSquare | null): void;
  /** The coach moved this player another way (RB to reserves): forget its entry at once. */
  drop(playerId: string): void;
  clear(): void;
}
const sameSquare = (a: SetupSquare | null, b: SetupSquare | null): boolean =>
  a === b || (!!a && !!b && a[0] === b[0] && a[1] === b[1]);
export function createPendingPlacements(now: () => number = () => Date.now()): PendingPlacements {
  const entries = new Map<string, { square: SetupSquare; from: SetupSquare | null; at: number }>();
  return {
    current(players) {
      const t = now();
      for (const [id, e] of [...entries]) {
        const p = players.find((x) => x.playerId === id);
        // Gone, echoed at the square, or moved by the server to anything other than where it stood at the send.
        if (!p || !sameSquare(p.coord, e.from)) entries.delete(id);
      }
      return {
        players: new Set([...entries].filter(([, e]) => t - e.at <= PENDING_PLACEMENT_MS).map(([id]) => id)),
        squares: [...entries.values()].map((e) => e.square),
      };
    },
    add(playerId, square, from) { entries.set(playerId, { square, from: from ? [from[0], from[1]] : null, at: now() }); },
    drop(playerId) { entries.delete(playerId); },
    clear() { entries.clear(); },
  };
}

/** The view's side of the setup pad shortcuts (SpectateView supplies the live store / crosshair / renderer). */
export interface PadSetupHostDeps {
  players(): readonly PadSetupPlayer[] | null;
  currentPlayerId(): string | null;
  place(playerId: string, square: SetupSquare): void;
  remove(playerId: string): void;
  /** The crosshair's setup cycle (reserves as `{ dugoutPlayerId }`, then placed players). */
  cycleOrder(): readonly ({ dugoutPlayerId: string } | { square: SetupSquare })[];
  moveCrosshair(target: { dugoutPlayerId: string } | { square: SetupSquare }): void;
  /** The view's own setup selection drops a player sent to the reserves. */
  deselect(playerId: string): void;
  pending?: PendingPlacements;
}
/** The PRODUCTION setup LB / RB handlers (SpectateView's runner `setup` deps), through the existing place / remove
 *  wire. LB: next free line square, then on to the next reserve not already on its way. RB: release the player's
 *  pending placement at once (Astra P2-d1), then send it to the reserves. */
export function createPadSetupHost(deps: PadSetupHostDeps): { active(): boolean; placeOnLos(): boolean; sendToReserve(): boolean; pending: PendingPlacements } {
  const pending = deps.pending ?? createPendingPlacements();
  return {
    pending,
    active: () => !!deps.players(),
    placeOnLos() {
      const players = deps.players();
      if (!players) return false;
      const snap = pending.current(players);
      const d = padSetupPlaceDecision(players, deps.currentPlayerId(), snap);
      if (d.kind !== 'place') return false;
      deps.place(d.playerId, d.square);
      pending.add(d.playerId, d.square, players.find((p) => p.playerId === d.playerId)?.coord ?? null);
      const next = deps.cycleOrder().find((t) => 'dugoutPlayerId' in t && t.dugoutPlayerId !== d.playerId && !snap.players.has(t.dugoutPlayerId));
      deps.moveCrosshair(next ?? { square: d.square });
      return true;
    },
    sendToReserve() {
      const players = deps.players();
      if (!players) return false;
      const current = deps.currentPlayerId();
      if (current) pending.drop(current);
      const d = padSetupReserveDecision(players, current);
      if (d.kind !== 'remove') return false;
      deps.remove(d.playerId);
      deps.deselect(d.playerId);
      return true;
    },
  };
}
