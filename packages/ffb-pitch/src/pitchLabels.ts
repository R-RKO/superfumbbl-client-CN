/**
 * Display labels the pitch DRAWS (TOUCHDOWN, RESERVES, APOTHECARY, STUNNED ...), localised through a provider the client
 * installs (i18n 10-23, Astra r1 #6). The pitch package cannot import the app, so it asks this tiny registry for the
 * text of an English label at draw time; with no provider installed every label stays English.
 *
 * Only DISPLAY text goes through pitchLabel(). Internal identifiers (dugout section ids such as 'RESERVES', stamp kinds,
 * lettering surfaces) stay invariant English and are compared as such.
 */
export type PitchLabelProvider = (english: string) => string;

let provider: PitchLabelProvider | null = null;
let revision = 0;
const listeners = new Set<() => void>();

/** Installs (or with null removes) the client's label provider and redraws every live renderer's labels. */
export function setPitchLabelProvider(next: PitchLabelProvider | null): void {
  provider = next;
  notifyPitchLabelsChanged();
}

/** The text to draw for an English pitch label in the active language (the English itself when untranslated). */
export function pitchLabel(english: string): string {
  if (!provider) return english;
  try {
    const out = provider(english);
    return typeof out === 'string' && out ? out : english;
  } catch {
    return english;
  }
}

/** Bumped on every provider / language change; caches keyed on drawn text fold it in. */
export function pitchLabelRevision(): number {
  return revision;
}

/** The client calls this when its language changes: every live renderer redraws its lettering. */
export function notifyPitchLabelsChanged(): void {
  revision++;
  for (const fn of [...listeners]) {
    try { fn(); } catch { /* one renderer's failure never stops the others */ }
  }
}

/** Renderer seam: `fn` runs after every label change; returns the unsubscribe. */
export function onPitchLabelsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
