<script setup lang="ts">
/**
 * Controller support P2b: the pad overlays, fixed over the whole app.
 *  - The card focus ring + glyph badges (game/cardFocus.ts padFocusView): A at the focused control, B at the
 *    decline, X / Y at the card's key controls.
 *  - The chord layer (owner addition 10-07): while LB / RT is held every `[data-pad-action]` control reachable under
 *    it shows its chord button's glyph; the badges fade ~150 ms after release.
 * Pointer-transparent. Positions follow the controls every frame while anything is shown.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PadGlyph from './PadGlyph.vue';
import { activeInput, heldModifiers } from '../game/controls';
import { padFocusScopeCount, padFocusView, refreshPadFocus, type PadFocusRect } from '../game/cardFocus';
import { CHORD_BADGE_FADE_MS, chordBadges } from '../game/padChordBadges';
import { settings } from '../game/settings';

const chordBadgeList = ref<{ key: string; glyph: string; rect: PadFocusRect }[]>([]);
/** 1 while a modifier is held, 0 while fading out. */
const chordOpacity = ref(0);
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function collectChordBadges(): void {
  const held = heldModifiers.value;
  if (!held.LB && !held.RT) return; // keep the last positions while fading
  if (activeInput.value !== 'controller' || typeof document === 'undefined') { chordBadgeList.value = []; return; }
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-pad-action]'));
  const badges = chordBadges(settings, held, els.map((el) => ({ target: el, actionId: el.getAttribute('data-pad-action') })));
  chordBadgeList.value = badges
    .map((b, i) => {
      const r = b.target.getBoundingClientRect();
      return { key: `${b.actionId}-${i}`, glyph: b.glyph, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    });
}

watch(heldModifiers, (held) => {
  if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
  if (held.LB || held.RT) {
    collectChordBadges();
    chordOpacity.value = 1;
    kick();
  } else if (chordBadgeList.value.length) {
    chordOpacity.value = 0;
    fadeTimer = setTimeout(() => { fadeTimer = null; chordBadgeList.value = []; }, CHORD_BADGE_FADE_MS);
  }
}, { deep: true });

let raf = 0;
function frame(): void {
  raf = 0;
  refreshPadFocus();
  collectChordBadges();
  if (padFocusScopeCount.value > 0 || heldModifiers.value.LB || heldModifiers.value.RT) raf = requestAnimationFrame(frame);
}
function kick(): void {
  if (raf || typeof requestAnimationFrame === 'undefined') return;
  raf = requestAnimationFrame(frame);
}
watch(padFocusScopeCount, (n) => { if (n > 0) kick(); else refreshPadFocus(); });
watch(activeInput, () => { refreshPadFocus(); kick(); });
onMounted(() => { refreshPadFocus(); if (padFocusScopeCount.value > 0) kick(); });
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  if (fadeTimer) clearTimeout(fadeTimer);
});

const ring = computed(() => padFocusView.value.ring);
const badges = computed(() => padFocusView.value.badges);
const BADGE = 20;
function badgeStyle(rect: PadFocusRect, i = 0): Record<string, string> {
  return { left: `${Math.round(rect.left + rect.width - BADGE * 0.6 - i * 4)}px`, top: `${Math.round(rect.top - BADGE * 0.4)}px` };
}
</script>

<template>
  <div class="pad-overlay" aria-hidden="true">
    <div v-if="ring" class="pad-focus-ring" data-testid="pad-focus-ring"
      :style="{ left: ring.left - 3 + 'px', top: ring.top - 3 + 'px', width: ring.width + 6 + 'px', height: ring.height + 6 + 'px' }" />
    <span v-for="(b, i) in badges" :key="'f' + i + b.name" class="pad-badge" data-testid="pad-focus-badge" :data-glyph="b.name"
      :style="badgeStyle(b.rect)"><PadGlyph :name="b.name" :size="BADGE" /></span>
    <span v-for="b in chordBadgeList" :key="b.key" class="pad-badge pad-chord-badge" data-testid="pad-chord-badge"
      :data-glyph="b.glyph" :style="{ ...badgeStyle(b.rect), opacity: String(chordOpacity) }"><PadGlyph :name="b.glyph" :size="BADGE" /></span>
  </div>
</template>

<style scoped>
.pad-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.pad-focus-ring {
  position: fixed;
  border: 2px solid var(--ui-accent, #f2c418);
  border-radius: 6px;
  box-shadow: 0 0 0 2px #000a, 0 0 10px color-mix(in srgb, var(--ui-accent, #f2c418) 70%, transparent);
  transition: left 90ms ease-out, top 90ms ease-out, width 90ms ease-out, height 90ms ease-out;
}
.pad-badge { position: fixed; display: block; line-height: 0; }
.pad-chord-badge { transition: opacity 150ms ease-out; }
</style>
