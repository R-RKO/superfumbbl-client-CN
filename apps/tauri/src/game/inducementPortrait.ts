import { playerSpriteAsset } from '@fumbbl40k/ffb-pitch';

export interface InducementPortraitPosition {
  positionId?: string;
  urlPortrait?: string;
  urlIconSet?: string;
}

export interface InducementPortraitView {
  url: string | null;
  glyph: string;
  /** 'iconset' = a 4-frame FUMBBL sheet from an installed pack (cropped); 'custom' = one pack sprite image;
   *  'walker' = the single idle frame (already cropped to the figure, 2x) of a walk sheet. */
  source?: 'iconset' | 'custom' | 'walker';
}

export type InducementAssetResolver = (relativeUrl: string | undefined) => string | undefined;
export type InducementCustomSpriteResolver = (teamId: string, positionId: string) => string | undefined;

/**
 * Walk-sheet tier (owner 10-26: "Default to our star sheets, packs still win"). Injected so this module stays pure.
 * Returns null when NO sheet/sprite exists for the position (the iconset fallback may then apply); a frame with a
 * null url means a sheet exists but its idle frame is still rendering (keep the glyph, do not flash an iconset).
 *  - kind 'sprite': an active pack player-sprite target (single image, matched by side/race like the pitch);
 *  - kind 'pack': the idle frame of an active pack WALK SHEET;
 *  - kind 'bundled': the idle frame of the bundled Super FUMBBL walk sheet.
 */
export type InducementWalkerFrame = { kind: 'sprite' | 'pack' | 'bundled'; url: string | null };
export type InducementWalkerResolver = (position: InducementPortraitPosition & { positionName?: string }) => InducementWalkerFrame | null;

export interface InducementWalkerTier {
  resolve: InducementWalkerResolver;
  /** False when the user assigned a pack to the player-sprite / walk-sheet slot (`spritePackSelected`): the pitch then
   *  drops the bundled walkers to the placeholder tier BELOW installed-pack iconsets (renderer selectedWalker). */
  bundledIsSelection: boolean;
}

/**
 * Resolve an inducement-card player sprite from installed local asset packs.
 *
 * `urlIconSet` is the same four-frame player sprite sheet used on the pitch. The
 * card component crops its first standing frame into the thumbnail. Deliberately
 * do not use `urlPortrait` (the FUMBBL web portrait) or manufacture a CDN URL: a
 * missing local sprite must leave the component's generic glyph fallback visible
 * in a packaged build.
 */
export function cachedInducementPortrait(
  position: InducementPortraitPosition | null | undefined,
  glyph: string,
  resolveCached: InducementAssetResolver,
): InducementPortraitView {
  const iconset = resolveCached(position?.urlIconSet);
  if (iconset) return { url: iconset, glyph, source: 'iconset' };

  return { url: null, glyph };
}

/**
 * Sol r1 (P1, asset-provenance law): the iconset tier may only ever yield a LOCAL url owned by a user-installed pack.
 * `resolveLocal` is the installed-pack binding lookup (fumbblAssetCache.selectedLocalFumbblAssetUrl: every installed
 * pack's FUMBBL-id images, never a network lookup); `resolveNamed` maps a legacy named iconset reference to its
 * canonical id through the bundled register (which carries ids only, no artwork). A miss is `undefined`, never a CDN
 * url for the browser to fetch.
 */
export function localPackIconsetResolver(
  base: string | undefined,
  resolveLocal: (rel?: string, base?: string) => string | null,
  resolveNamed: (rel: string | undefined) => string | undefined,
): InducementAssetResolver {
  const isLocal = (url: string | null | undefined): url is string => !!url && !/^https?:\/\/([a-z0-9-]+\.)*fumbbl\.com\//i.test(url);
  return (rel) => {
    if (!rel) return undefined;
    const direct = resolveLocal(rel, base);
    if (isLocal(direct)) return direct;
    const named = resolveNamed(rel);
    const viaNamed = named ? resolveLocal(named) : null;
    return isLocal(viaNamed) ? viaNamed : undefined;
  };
}

/**
 * Sol r1/r2: a held review snapshot keeps the server identity (card keys + the panel's protocol seat); its portraits
 * are re-projected live against the team at that captured seat — never the live role mapping, which is torn down
 * with the buy/reveal state once the coin sequence starts.
 */
export function reprojectHeldPortraits<
  C extends { key: string; portrait: InducementPortraitView },
  P extends { seat: 'home' | 'away'; cards: C[] },
  T,
>(panel: P | undefined, teams: { home: T; away: T } | null, portraitFor: (key: string, team: T | null) => InducementPortraitView): P | undefined {
  if (!panel) return panel;
  const team = teams ? teams[panel.seat] : null;
  return { ...panel, cards: panel.cards.map((card) => ({ ...card, portrait: portraitFor(card.key, team) })) };
}

/**
 * Stars and mercenaries share the same positive-cache-only sprite contract.
 * Keep the `kind` argument in the view seam because callers project separate
 * blades, but neither blade may fall back to remote FUMBBL artwork.
 */
export function inducementRosterPortrait(
  kind: 'star' | 'mercenary',
  position: InducementPortraitPosition | null | undefined,
  glyph: string,
  resolveCached: InducementAssetResolver,
  resolveFumbbl: (relativeUrl: string | undefined) => string | null,
): InducementPortraitView {
  void kind;
  void resolveFumbbl;
  return cachedInducementPortrait(position, glyph, resolveCached);
}

/** Resolve an exact team+position custom sprite before the bundled cache.
 *  The identity pair is the mod-pack authority; names/races never participate. */
/**
 * Card precedence (owner 10-26, mirrors the pitch's sprite chain):
 *   (a) exact team+position pack player sprite;
 *   (b) active pack player sprite matched by side/race, then the active pack WALK SHEET idle frame;
 *   (c) the bundled Super FUMBBL walk sheet idle frame (stars via the 'stars' pseudo-race);
 *   (d) the cached FUMBBL iconset from a user-installed pack — only when no walk sheet exists for the position
 *       (or, as on the pitch, above (c) when the user put a pack in the sprite slot);
 *   (e) glyph.
 * Without a walker tier the chain is (a) > (d) > (e) (the pre-10-26 contract, kept for callers/tests).
 */
export function configuredInducementSprite(
  teamId: string,
  position: (InducementPortraitPosition & { positionName?: string }) | null | undefined,
  glyph: string,
  resolveCustom: InducementCustomSpriteResolver,
  resolveCached: InducementAssetResolver,
  walker?: InducementWalkerTier,
): InducementPortraitView {
  const positionId = String(position?.positionId ?? '');
  const custom = teamId && positionId ? resolveCustom(teamId, positionId) : undefined;
  if (custom) return { url: custom, glyph, source: 'custom' };
  const frame = walker && position ? walker.resolve(position) : null;
  if (frame && frame.kind !== 'bundled') return walkerView(frame, glyph);
  if (frame && walker!.bundledIsSelection) return walkerView(frame, glyph);
  const iconset = cachedInducementPortrait(position, glyph, resolveCached);
  if (iconset.url || !frame) return iconset;
  return walkerView(frame, glyph); // slot pack selected but it has no icon for this position: placeholder tier
}

function walkerView(frame: InducementWalkerFrame, glyph: string): InducementPortraitView {
  if (!frame.url) return { url: null, glyph }; // idle frame still rendering: the glyph, never a flash of other art
  return { url: frame.url, glyph, source: frame.kind === 'sprite' ? 'custom' : 'walker' };
}

/** Production active-pack seam used by every inducement player card. Keeping
 *  the exact identity lookup here lets mounted UI tests exercise the real pack
 *  activation registry rather than substituting a portrait callback. */
export function activeInducementSprite(
  teamId: string,
  position: (InducementPortraitPosition & { positionName?: string }) | null | undefined,
  glyph: string,
  resolveCached: InducementAssetResolver,
  walker?: InducementWalkerTier,
  side?: 'home' | 'away',
): InducementPortraitView {
  return configuredInducementSprite(
    teamId,
    position,
    glyph,
    // Sol r1: the hiring team's kit side, so an exact-team side binding beats its 'any' twin as on the pitch.
    (exactTeamId, positionId) => playerSpriteAsset(exactTeamId, positionId, side)?.url,
    resolveCached,
    walker,
  );
}
