import { ref, type Ref } from 'vue';
import { DUGOUT_LETTERING, composeDisplayLettering, loadDisplayFonts } from '@fumbbl40k/ffb-pitch';

/**
 * Owner 10-15 (Graphical log): the "KO" icon - the stylised lettering the pitch draws its dugout box labels in (Graduate
 * C: Nuffle lead letter + Graduate small capitals), composed by the SAME call and style the renderer uses for those
 * labels (composeDisplayLettering(label, DUGOUT_LETTERING) - renderer.letteringFor('dugout', ...)), rendered once to an
 * image for the log. Null until the display fonts have loaded (or where there is no 2D canvas, e.g. a test runtime):
 * the log then shows a plain "KO" fallback.
 */
let started = false;
const url: Ref<string | null> = ref(null);

function compose(): void {
  try {
    const art = composeDisplayLettering('KO', DUGOUT_LETTERING);
    if (art) url.value = art.canvas.toDataURL('image/png');
  } catch {
    url.value = null;
  }
}

/** The KO lettering image URL (reactive). The first call starts the font load and composes once it settles. */
export function koLetteringUrl(): Ref<string | null> {
  if (!started) {
    started = true;
    compose();
    void loadDisplayFonts().then(compose);
  }
  return url;
}
