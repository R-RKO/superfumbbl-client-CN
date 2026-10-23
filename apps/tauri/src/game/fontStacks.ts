/**
 * Script support (owner 10-23): the client's font stacks. The values live in ONE place, the pitch package
 * (packages/ffb-pitch/src/fontStacks.ts), because the pitch lettering draws with them too; this module re-exports them
 * for the client and publishes them as CSS custom properties, so every `font-family: var(--font-display)` in a
 * stylesheet and every `ctx.font` built with `canvasFont` read the same string.
 *
 * Rule (pinned by test/fontStacksGuard.test.ts): no canvas font string or CSS font-family in apps/tauri/src names
 * Nuffle, Graduate or SNES directly; they go through these constants or the custom properties.
 */
import { FONT_STACK_CSS_VARIABLES } from '@fumbbl40k/ffb-pitch/src/fontStacks';

export {
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

/** Write the stacks onto `root` (default: the document element) as --font-display / --font-graduate / --font-snes /
 *  --font-fallback / --font-body. Called once before mount (main.ts, assetPackBuilderMain.ts). Never throws. */
export function installFontStackVariables(root?: { style: { setProperty(name: string, value: string): void } } | null): void {
  try {
    const target = root ?? (typeof document === 'undefined' ? null : document.documentElement);
    if (!target) return;
    for (const [name, value] of Object.entries(FONT_STACK_CSS_VARIABLES)) target.style.setProperty(name, value);
  } catch {
    /* no DOM: nothing to publish */
  }
}
