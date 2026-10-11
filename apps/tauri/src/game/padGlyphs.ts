/**
 * Controller support P2b (owner round 2): glyph prompts. Resolves a pad input name (`A`, `LB`, `DpadUp`, a chord
 * `LB+DpadUp`, a trigger gesture `RT(tap)`) to the glyph image(s) of the active family — Xbox for every pad, the generic
 * shape set (✕ ○ □ △) when the pad reports Sony (vendor 054c). Assets: src/assets/glyphs/{xbox,sony}/<Name>.svg
 * (see the README there for provenance).
 */
import type { PadGlyphFamily } from './controls';

// Public integration (10-10): the SVG TEXT is bundled (`?raw`) and served as data URIs. Emitted as files they land in
// the app patch's `images` part (apps/tauri/app-patch-build.mjs), and 50 KB of glyphs would make every installed
// client download that whole ~16 MB part again; in the code bundle they ride the `app` part, which every patch
// replaces anyway.
const XBOX = import.meta.glob('../assets/glyphs/xbox/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const SONY = import.meta.glob('../assets/glyphs/sony/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}
function table(files: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, svg] of Object.entries(files)) {
    const name = /([^/]+)\.svg$/.exec(path)?.[1];
    if (name && typeof svg === 'string' && svg.includes('<svg')) out.set(name, svgDataUri(svg));
  }
  return out;
}
const TABLES: Record<PadGlyphFamily, Map<string, string>> = { xbox: table(XBOX), sony: table(SONY) };

/** Spoken / alt label of each input per family. */
const LABELS: Record<PadGlyphFamily, Record<string, string>> = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', View: 'View', Start: 'Menu', L3: 'L3', R3: 'R3' },
  sony: { A: 'Cross', B: 'Circle', X: 'Square', Y: 'Triangle', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', View: 'Create', Start: 'Options', L3: 'L3', R3: 'R3' },
};
const COMMON_LABELS: Record<string, string> = {
  DpadUp: 'D-pad up', DpadDown: 'D-pad down', DpadLeft: 'D-pad left', DpadRight: 'D-pad right', Dpad: 'D-pad',
  LeftStick: 'Left stick', RightStick: 'Right stick',
};

export interface PadGlyphPart { name: string; family: PadGlyphFamily; src: string | null; label: string }

/** `LB+DpadUp` → [LB, DpadUp]; `RT(tap)` → [RT]. */
export function padGlyphParts(input: string, family: PadGlyphFamily): PadGlyphPart[] {
  if (!input) return [];
  return input.split('+').map((raw) => {
    const name = raw.replace(/\((tap|hold)\)$/, '');
    return { name, family, src: TABLES[family].get(name) ?? null, label: LABELS[family][name] ?? COMMON_LABELS[name] ?? name };
  });
}
export function padGlyphLabel(input: string, family: PadGlyphFamily): string {
  return padGlyphParts(input, family).map((p) => p.label).join(' + ');
}
