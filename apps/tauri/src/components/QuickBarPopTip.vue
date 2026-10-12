<script lang="ts">
/** How long a popped quick-bar tooltip stays up. */
export const QUICK_BAR_TIP_MS = 1500;
</script>

<script setup lang="ts">
/**
 * Owner 10-12 (Kildash 10-11, "the icons bottom right sometimes do not work"): a quick-bar press pops that button's
 * tooltip for QUICK_BAR_TIP_MS so the coach sees the new state. The quick-bar tooltips are native `title` attributes,
 * which script cannot open, so this surface shows the SAME text (read from the button's `title` after the press has
 * re-rendered it) in a box styled after the Windows / Chromium native tooltip. One at a time, a new press replaces
 * it, it never takes the pointer, and it is hidden from assistive tech (the button's own name/description already
 * carries the state). A button that is not on screen (bar hidden, off-viewport) gets no pop. Placement
 * (placeQuickBarTip) keeps it off the `avoid` elements (the bar and the Pause / Live row above it) and in the viewport.
 */
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import { placeQuickBarTip, type TipRect } from '../game/quickBarTipPlacement';

const tip = reactive({ visible: false, text: '', left: 0, top: 0, measured: false });
const el = ref<HTMLElement | null>(null);
let timer = 0;
let token = 0;

/** On screen = has a box, intersects the viewport, and is not hidden by display / visibility / opacity. */
function onScreen(button: HTMLElement): boolean {
  if (!button.isConnected) return false;
  const r = button.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return false;
  const check = (button as HTMLElement & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (typeof check === 'function' && !check.call(button, { opacityProperty: true, visibilityProperty: true })) return false;
  return true;
}

function hide(): void {
  window.clearTimeout(timer);
  timer = 0;
  token++;
  tip.visible = false;
}

const rectOf = (e: Element): TipRect => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };

/** Pop `button`'s tooltip, kept clear of `avoid`. Returns false (and shows nothing) when the button is missing,
 *  untitled or off screen. */
async function pop(button: HTMLElement | null | undefined, avoid: (Element | null | undefined)[] = []): Promise<boolean> {
  const text = button?.getAttribute('title')?.trim() ?? '';
  if (!button || !text || !onScreen(button)) { hide(); return false; }
  window.clearTimeout(timer);
  const mine = ++token;
  tip.text = text;
  tip.top = 0;
  tip.left = 0; // measure at the top-left corner so the text wraps only at max-width, not at a viewport edge
  tip.measured = false;
  tip.visible = true;
  timer = window.setTimeout(() => { if (mine === token) hide(); }, QUICK_BAR_TIP_MS);
  await nextTick();
  if (mine !== token || !el.value) return true;
  const place = placeQuickBarTip({
    button: rectOf(button),
    avoid: avoid.filter((e): e is Element => !!e).map(rectOf),
    width: el.value.offsetWidth,
    height: el.value.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  if (!place) { hide(); return false; } // nowhere clear of the bar and inside the viewport: no tip
  tip.left = Math.round(place.left);
  tip.top = Math.round(place.top);
  tip.measured = true;
  return true;
}

onBeforeUnmount(hide);
defineExpose({ pop, hide, state: tip });
</script>

<template>
  <Teleport to="body">
    <div v-if="tip.visible" ref="el" class="quick-bar-pop-tip" data-testid="quick-bar-pop-tip" aria-hidden="true"
      :style="{ left: `${tip.left}px`, top: `${tip.top}px`, visibility: tip.measured ? 'visible' : 'hidden', pointerEvents: 'none' }">{{ tip.text }}</div>
  </Teleport>
</template>

<style scoped>
/* The Windows native (comctl) tooltip Chromium / WebView2 shows for a `title`: white, thin grey border, Segoe UI 9pt. */
.quick-bar-pop-tip {
  position: fixed;
  z-index: 2147483000;
  max-width: min(400px, calc(100vw - 16px));
  box-sizing: border-box;
  padding: 2px 6px 3px;
  background: #ffffff;
  color: #575757;
  border: 1px solid #767676;
  box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.25);
  font: 12px/1.35 "Segoe UI", system-ui, sans-serif;
  letter-spacing: normal;
  text-transform: none;
  white-space: normal;
  pointer-events: none;
  user-select: none;
}
</style>
