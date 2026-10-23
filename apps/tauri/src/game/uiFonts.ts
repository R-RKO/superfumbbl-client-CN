import type { AppSettings } from './settings';
import { FONT_DISPLAY_FAMILY } from './fontStacks';

/** B2-16/UI11 + B3-8: the user-selectable UI typeface stacks (`settings.uiFont`). App.vue applies the chosen one as
 *  `--ui-font`; the first-launch setup wizard's Font step renders its samples with the same stacks (owner 10-06). */
export const UI_FONTS: Readonly<Record<AppSettings['uiFont'], string>> = {
  nuffle: FONT_DISPLAY_FAMILY,
  system: 'system-ui, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
};
