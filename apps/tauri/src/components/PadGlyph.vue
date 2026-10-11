<script setup lang="ts">
/**
 * Controller support P2b: a glyph prompt (`<PadGlyph name="A" />`, chords `LB+DpadUp`). Renders ONLY in controller mode
 * unless `always` is set; the family follows the last pad used (Sony pads get the shape set).
 */
import { computed } from 'vue';
import { activeInput, activePadGlyphFamily, type PadGlyphFamily } from '../game/controls';
import { padGlyphLabel, padGlyphParts } from '../game/padGlyphs';

const props = withDefaults(defineProps<{ name: string; always?: boolean; family?: PadGlyphFamily; size?: number }>(), {
  always: false, family: undefined, size: 18,
});
const fam = computed<PadGlyphFamily>(() => props.family ?? activePadGlyphFamily.value);
const parts = computed(() => padGlyphParts(props.name, fam.value));
const shown = computed(() => props.always || activeInput.value === 'controller');
</script>

<template>
  <span v-if="shown && parts.length" class="pad-glyph" :data-glyph="name" :data-family="fam" :title="padGlyphLabel(name, fam)"
    role="img" :aria-label="padGlyphLabel(name, fam)">
    <template v-for="(p, i) in parts" :key="i">
      <span v-if="i" class="pad-glyph-plus" aria-hidden="true">+</span>
      <img v-if="p.src" :src="p.src" :alt="p.label" :data-glyph-part="p.name" :width="size" :height="size" draggable="false" />
      <span v-else class="pad-glyph-text" :data-glyph-part="p.name">{{ p.label }}</span>
    </template>
  </span>
</template>

<style scoped>
.pad-glyph { display: inline-flex; align-items: center; gap: 1px; vertical-align: middle; pointer-events: none; line-height: 1; }
.pad-glyph img { display: block; filter: drop-shadow(0 1px 1px #000a); }
.pad-glyph-plus { font: 700 10px/1 Arial, sans-serif; color: #f2f2f2; text-shadow: 0 1px 1px #000; }
.pad-glyph-text { font: 700 10px/1 Arial, sans-serif; color: #f2f2f2; background: #1d1f24; border-radius: 4px; padding: 2px 3px; }
</style>
