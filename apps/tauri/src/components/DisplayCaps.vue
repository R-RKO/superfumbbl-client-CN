<script setup lang="ts">
/**
 * "Graduate C" display lettering for menu text (owner 10-11): the first letter of each word in Nuffle, 25% larger,
 * the rest in Graduate small capitals. One line per label: `<DisplayCaps text="Game statistics" />` inside the
 * heading / button / hint that carries it. The casing rules are the shared `displayCapsRuns` (ffb-pitch), the same
 * function the end-zone lettering on the pitch uses.
 *
 * The label itself stays in the document as ONE plain text node (`.display-caps-plain`, visually hidden): that is
 * what a screen reader announces and what the element's text content is. The lettering beside it is aria-hidden and
 * carries no text of its own (each run is painted from a data attribute), so nothing is read out letter by letter.
 *
 * Only with the default UI font. A coach who chose System or Arial in Settings gets the plain label in that font,
 * exactly as before.
 */
import { computed } from 'vue';
import { displayCapsRuns } from '@fumbbl40k/ffb-pitch';
import { settings } from '../game/settings';

const props = defineProps<{ text: string }>();
const runs = computed(() => (settings.uiFont === 'nuffle' ? displayCapsRuns(props.text) : null));
</script>

<template>
  <span v-if="runs" class="display-caps"><span class="display-caps-plain">{{ text }}</span><span class="display-caps-art" aria-hidden="true"><span
    v-for="(run, index) in runs" :key="index" :class="run.lead ? 'display-caps-lead' : 'display-caps-rest'" :data-t="run.text"></span></span></span>
  <template v-else>{{ text }}</template>
</template>

<style>
.display-caps { position: relative; }
.display-caps-plain {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.display-caps-art { white-space: pre-wrap; }
/* line-height 0 on every run: neither the larger lead letter nor Graduate's own metrics may grow the line box. The
   host element's font sets the line height, so a button is exactly as tall as it was with a plain label. */
.display-caps-art > span { line-height: 0; }
.display-caps-art > span::before { content: attr(data-t); }
/* Graduate has no lowercase: its lowercase glyphs are small capitals. A character it does not carry falls back to
   Nuffle, then the system face. */
.display-caps-rest { font-family: 'Graduate', 'Nuffle', system-ui, sans-serif; }
.display-caps-lead { font-family: 'Nuffle', system-ui, sans-serif; font-size: 1.25em; }
</style>
