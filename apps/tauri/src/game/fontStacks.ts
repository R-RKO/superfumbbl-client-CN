/**
 * Script support (owner 10-23): the client's font stacks. The values live in ONE place, the pitch package
 * (packages/ffb-pitch/src/fontStacks.ts), because the pitch lettering draws with them too; this module re-exports them
 * for the client and publishes them as CSS custom properties, so every `font-family: var(--font-display)` in a
 * stylesheet and every `ctx.font` built with `canvasFont` read the same string.
 *
 * Rule (pinned by test/fontStacksGuard.test.ts): no canvas font string or CSS font-family in apps/tauri/src names
 * Nuffle, Graduate or SNES directly; they go through these constants or the custom properties.
 */
import { FALLBACK_FONT_FACES, FONT_STACK_CSS_VARIABLES } from '@fumbbl40k/ffb-pitch/src/fontStacks';

export {
  FALLBACK_FONT_FACES,
  FONT_BODY_FAMILY,
  FONT_DISPLAY_FAMILY,
  FONT_FALLBACK_FAMILY,
  FONT_GRADUATE_FAMILY,
  FONT_SCRIPT_TAIL,
  FONT_SNES_FAMILY,
  FONT_STACK_CSS_VARIABLES,
  canvasFont,
  quoteFontFamilies,
} from '@fumbbl40k/ffb-pitch/src/fontStacks';

type FontSetLike = { add(face: FontFace): void; forEach(callback: (face: FontFace) => void): void };
type FontFaceCtor = new (family: string, source: string, descriptors?: FontFaceDescriptors) => FontFace;

/** Register the bundled last-resort faces (FALLBACK_FONT_FACES) with font-display swap and their unicode-range. They
 *  are only REGISTERED: the browser fetches one when text on screen needs a character in its range that no face
 *  before it carries. Idempotent (a family already registered is skipped); never throws. */
export function registerFallbackFontFaces(fonts?: FontSetLike | null, ctor?: FontFaceCtor | null): number {
  let added = 0;
  try {
    const set = fonts ?? (typeof document === 'undefined' ? null : (document.fonts as unknown as FontSetLike));
    const Face = ctor ?? (typeof FontFace === 'undefined' ? null : (FontFace as unknown as FontFaceCtor));
    if (!set || !Face) return 0;
    const present = new Set<string>();
    set.forEach((face) => present.add(face.family.replace(/^["']|["']$/g, '')));
    for (const face of FALLBACK_FONT_FACES) {
      if (present.has(face.family)) continue;
      set.add(new Face(face.family, `url(${face.url}) format('woff2')`, { display: 'swap', unicodeRange: face.unicodeRange }));
      added++;
    }
  } catch {
    /* no Font Loading API: the system faces are all there is */
  }
  return added;
}

/** Write the stacks onto `root` (default: the document element) as --font-display / --font-graduate / --font-snes /
 *  --font-fallback / --font-body, and register the bundled last-resort faces. Called once before mount (main.ts,
 *  assetPackBuilderMain.ts, the dev harnesses). Never throws. */
export function installFontStackVariables(root?: { style: { setProperty(name: string, value: string): void } } | null): void {
  try {
    const target = root ?? (typeof document === 'undefined' ? null : document.documentElement);
    if (target) for (const [name, value] of Object.entries(FONT_STACK_CSS_VARIABLES)) target.style.setProperty(name, value);
  } catch {
    /* no DOM: nothing to publish */
  }
  if (!root) registerFallbackFontFaces();
}
