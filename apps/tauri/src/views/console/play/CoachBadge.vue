<script lang="ts">
/**
 * A FUMBBL coach status title on its original rank badge (public/badges/coach/<slug>.png, no text baked in), the
 * title text centred on the badge horizontally AND vertically (owner 10-20: "Text should be centered to the badge").
 * Shared by the Play header coach card (40 px) and the game-load rank panel (96 px).
 *
 * The overlay is plain text in the house display font - not DisplayCaps, whose per-run art spans and visually-hidden
 * plain copy pushed the text off-centre. The text box covers the whole badge (inset 0) and centres its one label
 * span with flex + text-align. The fit is MEASURED in the house font (game/coachBadgeFit.ts, canvas measureText; Astra
 * r3 P3): the largest size down to a 6 px floor whose lines fit 86% of the badge, at most two lines ("Emerging Star"
 * -> EMERGING / STAR), squeezed horizontally only when the floor still overflows (EXPERIENCED at 40 px). Re-fitted
 * once the web fonts have loaded. White with a 1 px dark outline plus a soft shadow, so it reads on
 * every metal. The image is decorative (alt=""); the caller labels the card.
 *
 * The art set follows the coachBadgeStyle setting (realistic / retro pixel art, drawn pixelated).
 *
 * Emits `error` when the image fails, so the caller can fall back to its text chip. Unknown title -> renders nothing.
 */
import { computed, ref } from 'vue';
import { coachTitleBadgeUrl, coachTitleSlug } from '../../../game/fumbblCoachProfile';
import { settings } from '../../../game/settings';
import { fitBadgeTitle, measureBadgeText } from '../../../game/coachBadgeFit';

/** Bumped when the web fonts finish loading, so a fit measured against a fallback font is redone in Nuffle. */
const fontsEpoch = ref(0);
if (typeof document !== 'undefined' && document.fonts?.ready) {
  void document.fonts.ready.then(() => { fontsEpoch.value++; });
}
</script>

<script setup lang="ts">

const props = defineProps<{ title: string; size: number }>();
const emit = defineEmits<{ error: [] }>();

const slug = computed(() => coachTitleSlug(props.title));
const retro = computed(() => settings.coachBadgeStyle === 'retro');
const url = computed(() => coachTitleBadgeUrl(props.title, settings.coachBadgeStyle));
const fit = computed(() => { void fontsEpoch.value; return fitBadgeTitle(props.title, props.size, measureBadgeText); });
const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
const textStyle = computed(() => ({ fontSize: `${fit.value.px.toFixed(1)}px` }));
const labelStyle = computed(() => (fit.value.scaleX < 1 ? { transform: `scaleX(${fit.value.scaleX.toFixed(3)})` } : undefined));
</script>

<template>
  <span v-if="url" class="coach-badge" :class="[`tier-${slug}`, { retro }]" :style="boxStyle">
    <img :src="url" alt="" draggable="false" @error="emit('error')" />
    <span class="coach-badge-text" :style="textStyle"><span class="coach-badge-label" :style="labelStyle"><span
      v-for="(line, i) in fit.lines" :key="i" class="coach-badge-line">{{ line }}{{ i < fit.lines.length - 1 ? ' ' : '' }}</span></span></span>
  </span>
</template>

<style scoped>
.coach-badge { position: relative; display: block; flex: none; }
.coach-badge img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
/* Owner 10-20: the retro set is 128 px pixel art - keep its pixels hard at 96 px (and accept the 40 px downscale). */
.coach-badge.retro img { image-rendering: pixelated; }
.coach-badge-text {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 7%;
  text-align: center; pointer-events: none;
}
.coach-badge-label {
  display: block; white-space: nowrap; transform-origin: center;
  color: #fff; font-family: var(--font-display); font-weight: 800; letter-spacing: 0; line-height: 1;
  text-align: center; text-transform: uppercase; overflow-wrap: normal; word-break: keep-all;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 1px 3px rgba(0, 0, 0, .7);
}
.coach-badge-line { display: block; }
</style>
